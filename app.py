"""AdminYAAA · Gestión interna — servidor Flask.

Uso interno exclusivo (Admin/Operador). No tiene rol "cliente": los clientes
de AdminYAAA no acceden a esta app, es la herramienta de trabajo del equipo.
"""

import datetime
import json
from pathlib import Path

from flask import Flask, jsonify, request, session, send_from_directory
from markupsafe import escape
from werkzeug.security import check_password_hash, generate_password_hash

import db

BASE_DIR = Path(__file__).resolve().parent.parent

app = Flask(__name__, static_folder=None)
app.secret_key = "adminyaaa-gestion-dev-secret-cambiar-en-produccion"
app.config.update(SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE="Lax")

db.init_db()


# ---------- Archivos estáticos ----------
@app.route("/")
@app.route("/index.html")
def login_page():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/dashboard.html")
def dashboard_page():
    return send_from_directory(BASE_DIR, "dashboard.html")


@app.route("/assets/<path:filename>")
def assets(filename):
    return send_from_directory(BASE_DIR / "assets", filename)


# ---------- Auth y helpers de rol ----------
def current_user():
    uid = session.get("uid")
    if not uid:
        return None
    conn = db.get_connection()
    row = conn.execute("SELECT * FROM usuarios WHERE id = ? AND activo = 1", (uid,)).fetchone()
    conn.close()
    return row


def require_login():
    user = current_user()
    if not user:
        return None, (jsonify({"error": "No autenticado"}), 401)
    return user, None


def require_admin():
    user, err = require_login()
    if err:
        return None, err
    if user["rol"] != "admin":
        return None, (jsonify({"error": "Solo el administrador puede acceder a esto"}), 403)
    return user, None


def now_iso():
    return datetime.datetime.now().isoformat(timespec="seconds")


def hoy_iso():
    return datetime.date.today().isoformat()


def log_activity(conn, usuario_id, texto):
    conn.execute(
        "INSERT INTO activity_log (id, fecha, usuario_id, texto) VALUES (?, ?, ?, ?)",
        (db.new_id("act"), now_iso(), usuario_id, texto),
    )


def crear_debito(conn, cliente_id, fecha, monto, concepto, referencia_tarea_id=None):
    """Registra un débito en la cuenta corriente del cliente (módulo 6)."""
    if monto <= 0:
        return
    conn.execute(
        """INSERT INTO movimientos_cc (id, cliente_id, fecha, tipo, monto, concepto, referencia_tarea_id, saldo_pendiente)
           VALUES (?,?,?, 'debito', ?, ?, ?, ?)""",
        (db.new_id("mov"), cliente_id, fecha, monto, concepto, referencia_tarea_id, monto),
    )


def aplicar_fifo_credito(conn, cliente_id, monto_credito):
    """Cancela los débitos pendientes más antiguos del cliente, de más viejo a más nuevo."""
    restante = monto_credito
    debitos = conn.execute(
        """SELECT * FROM movimientos_cc WHERE cliente_id = ? AND tipo = 'debito' AND saldo_pendiente > 0
           ORDER BY fecha ASC, id ASC""",
        (cliente_id,),
    ).fetchall()
    for d in debitos:
        if restante <= 0:
            break
        aplicado = min(d["saldo_pendiente"], restante)
        conn.execute(
            "UPDATE movimientos_cc SET saldo_pendiente = saldo_pendiente - ? WHERE id = ?",
            (aplicado, d["id"]),
        )
        restante -= aplicado


# ---------- Serializadores ----------
def usuario_out(row):
    return {
        "id": row["id"],
        "nombre": row["nombre"],
        "email": row["email"],
        "rol": row["rol"],
        "cargo": row["cargo"],
        "activo": bool(row["activo"]),
    }


def cliente_out(row):
    return {
        "id": row["id"],
        "nombreComercial": row["nombre_comercial"],
        "razonSocial": row["razon_social"],
        "cuit": row["cuit"],
        "rubro": row["rubro"],
        "tipoContrato": row["tipo_contrato"],
        "montoAbono": row["monto_abono"],
        "direccion": row["direccion"],
        "contactoNombre": row["contacto_nombre"],
        "contactoWhatsapp": row["contacto_whatsapp"],
        "diaFacturacion": row["dia_facturacion"],
        "estudioContableId": row["estudio_contable_id"],
        "notasInternas": row["notas_internas"],
        "activo": bool(row["activo"]),
    }


def tarea_out(row):
    return {
        "id": row["id"],
        "fecha": row["fecha"],
        "clienteId": row["cliente_id"],
        "operadorId": row["operador_id"],
        "descripcion": row["descripcion"],
        "horas": row["horas"],
        "precio": row["precio"],
        "modalidad": row["modalidad"],
        "estado": row["estado"],
    }


def stock_out(row):
    return {
        "id": row["id"],
        "clienteId": row["cliente_id"],
        "codigo": row["codigo"],
        "descripcion": row["descripcion"],
        "unidad": row["unidad"],
        "precioUnitario": row["precio_unitario"],
        "cantidad": row["cantidad"],
        "minimo": row["minimo"],
    }


def presupuesto_out(row):
    return {
        "id": row["id"],
        "clienteId": row["cliente_id"],
        "fecha": row["fecha"],
        "items": json.loads(row["items"]),
        "subtotal": row["subtotal"],
        "iva": row["iva"],
        "total": row["total"],
        "estado": row["estado"],
    }


def planilla_out(row):
    return {
        "id": row["id"],
        "clienteId": row["cliente_id"],
        "fecha": row["fecha"],
        "ventasTarde": row["ventas_tarde"],
        "ventasNoche": row["ventas_noche"],
        "gastosDia": row["gastos_dia"],
        "objetivoMensual": row["objetivo_mensual"],
        "nota": row["nota"],
    }


def movimiento_out(row):
    return {
        "id": row["id"],
        "clienteId": row["cliente_id"],
        "fecha": row["fecha"],
        "tipo": row["tipo"],
        "monto": row["monto"],
        "concepto": row["concepto"],
        "cuentaId": row["cuenta_id"],
        "comprobante": row["comprobante"],
        "saldoPendiente": row["saldo_pendiente"],
    }


def cuenta_out(row):
    return {"id": row["id"], "nombre": row["nombre"], "tipo": row["tipo"], "saldo": row["saldo"]}


def liquidacion_out(row):
    return {
        "id": row["id"],
        "operadorId": row["operador_id"],
        "periodo": row["periodo"],
        "sueldoBase": row["sueldo_base"],
        "adicionales": row["adicionales"],
        "descuentosAusencias": row["descuentos_ausencias"],
        "descuentosPrestamo": row["descuentos_prestamo"],
        "neto": row["neto"],
        "fecha": row["fecha"],
        "estado": row["estado"],
    }


def prestamo_out(row):
    return {
        "id": row["id"],
        "operadorId": row["operador_id"],
        "montoTotal": row["monto_total"],
        "cuotas": row["cuotas"],
        "valorCuota": row["valor_cuota"],
        "cuotasPagadas": row["cuotas_pagadas"],
        "fecha": row["fecha"],
        "estado": row["estado"],
    }


def caja_out(row):
    return {"id": row["id"], "operadorId": row["operador_id"], "tope": row["tope"], "saldoActual": row["saldo_actual"]}


def rendicion_out(row):
    return {
        "id": row["id"],
        "cajaId": row["caja_id"],
        "fecha": row["fecha"],
        "motivo": row["motivo"],
        "monto": row["monto"],
        "comprobante": row["comprobante"],
    }


def presentismo_out(row):
    return {
        "id": row["id"],
        "operadorId": row["operador_id"],
        "fecha": row["fecha"],
        "tipo": row["tipo"],
        "motivo": row["motivo"],
        "estado": row["estado"],
    }


def gasto_out(row):
    return {
        "id": row["id"],
        "categoria": row["categoria"],
        "proveedor": row["proveedor"],
        "monto": row["monto"],
        "vencimiento": row["vencimiento"],
        "estado": row["estado"],
    }


def retiro_out(row):
    return {
        "id": row["id"],
        "socioId": row["socio_id"],
        "fecha": row["fecha"],
        "monto": row["monto"],
        "tipo": row["tipo"],
        "nota": row["nota"],
    }


# ---------- Login / logout ----------
@app.post("/api/login")
def login():
    data = request.get_json(force=True)
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    conn = db.get_connection()
    row = conn.execute("SELECT * FROM usuarios WHERE email = ? AND activo = 1", (email,)).fetchone()
    conn.close()
    if not row or not check_password_hash(row["password_hash"], password):
        return jsonify({"error": "Email o contraseña incorrectos"}), 401
    session["uid"] = row["id"]
    return jsonify({"user": usuario_out(row)})


@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify({"ok": True})


@app.get("/api/me")
def me():
    user = current_user()
    if not user:
        return jsonify({"user": None})
    return jsonify({"user": usuario_out(user)})


# ---------- Estado inicial (dashboard + listados según rol) ----------
@app.get("/api/state")
def get_state():
    user, err = require_login()
    if err:
        return err
    conn = db.get_connection()

    clientes = [cliente_out(r) for r in conn.execute(
        "SELECT * FROM clientes WHERE activo = 1 ORDER BY nombre_comercial"
    ).fetchall()]

    tareas = [tarea_out(r) for r in conn.execute(
        "SELECT * FROM tareas WHERE eliminado = 0 ORDER BY fecha DESC LIMIT 200"
    ).fetchall()]

    usuarios = [usuario_out(r) for r in conn.execute(
        "SELECT * FROM usuarios WHERE activo = 1 ORDER BY nombre"
    ).fetchall()]

    stock = [stock_out(r) for r in conn.execute(
        "SELECT * FROM stock_items WHERE eliminado = 0 ORDER BY descripcion"
    ).fetchall()]

    presupuestos = [presupuesto_out(r) for r in conn.execute(
        "SELECT * FROM presupuestos WHERE eliminado = 0 ORDER BY fecha DESC"
    ).fetchall()]

    planillas = [planilla_out(r) for r in conn.execute(
        "SELECT * FROM planillas_turno ORDER BY fecha DESC"
    ).fetchall()]

    movimientos = [movimiento_out(r) for r in conn.execute(
        "SELECT * FROM movimientos_cc ORDER BY fecha ASC"
    ).fetchall()]

    cuentas = [cuenta_out(r) for r in conn.execute(
        "SELECT * FROM cuentas_dinero ORDER BY nombre"
    ).fetchall()]

    config_rows = conn.execute("SELECT * FROM config").fetchall()
    config = {r["clave"]: r["valor"] for r in config_rows}

    cajas = [caja_out(r) for r in conn.execute("SELECT * FROM cajas_chicas").fetchall()]
    rendiciones = [rendicion_out(r) for r in conn.execute("SELECT * FROM rendiciones ORDER BY fecha DESC").fetchall()]
    presentismo = [presentismo_out(r) for r in conn.execute("SELECT * FROM presentismo ORDER BY fecha DESC").fetchall()]
    gastos = [gasto_out(r) for r in conn.execute(
        "SELECT * FROM gastos_operativos WHERE eliminado = 0 ORDER BY vencimiento ASC"
    ).fetchall()]

    payload = {
        "clientes": clientes,
        "tareas": tareas,
        "usuarios": usuarios,
        "stock": stock,
        "presupuestos": presupuestos,
        "planillas": planillas,
        "movimientos": movimientos,
        "cuentas": cuentas,
        "config": config,
        "cajas": cajas,
        "rendiciones": rendiciones,
        "presentismo": presentismo,
        "gastos": gastos,
    }

    # Sueldos y préstamos: solo admin. El operador no debe ver los sueldos
    # del resto del equipo (regla explícita del módulo 15 de permisos).
    if user["rol"] == "admin":
        payload["sueldosBase"] = {
            r["id"]: r["sueldo_base"] for r in conn.execute("SELECT id, sueldo_base FROM usuarios").fetchall()
        }
        payload["liquidaciones"] = [liquidacion_out(r) for r in conn.execute(
            "SELECT * FROM liquidaciones ORDER BY fecha DESC"
        ).fetchall()]
        payload["prestamos"] = [prestamo_out(r) for r in conn.execute(
            "SELECT * FROM prestamos ORDER BY fecha DESC"
        ).fetchall()]
        payload["retiros"] = [retiro_out(r) for r in conn.execute(
            "SELECT * FROM retiros_socios ORDER BY fecha DESC"
        ).fetchall()]
        payload["usuariosTodos"] = [usuario_out(r) for r in conn.execute(
            "SELECT * FROM usuarios ORDER BY nombre"
        ).fetchall()]

    # Métricas ejecutivas: solo admin (módulo 1). Los operadores no ven
    # facturación total ni rentabilidad de la empresa. Se calculan sobre el
    # libro mayor (módulo 6), así incluyen abonos y presupuestos además de
    # las tareas puntuales.
    if user["rol"] == "admin":
        mes_actual = datetime.date.today().strftime("%Y-%m")
        facturado_mes = conn.execute(
            "SELECT COALESCE(SUM(monto),0) AS t FROM movimientos_cc WHERE tipo = 'debito' AND fecha LIKE ?",
            (f"{mes_actual}%",),
        ).fetchone()["t"]
        cobrado_mes = conn.execute(
            "SELECT COALESCE(SUM(monto),0) AS t FROM movimientos_cc WHERE tipo = 'credito' AND fecha LIKE ?",
            (f"{mes_actual}%",),
        ).fetchone()["t"]
        pendiente_total = conn.execute(
            "SELECT COALESCE(SUM(saldo_pendiente),0) AS t FROM movimientos_cc WHERE tipo = 'debito'"
        ).fetchone()["t"]
        tareas_ejecutadas = conn.execute(
            "SELECT COUNT(*) AS c FROM tareas WHERE eliminado = 0 AND estado != 'pendiente' AND fecha LIKE ?",
            (f"{mes_actual}%",),
        ).fetchone()["c"]
        clientes_count = len(clientes) or 1
        payload["metricas"] = {
            "facturadoMes": facturado_mes,
            "cobradoMes": cobrado_mes,
            "pendienteCobroTotal": pendiente_total,
            "promedioFacturacionCliente": round(facturado_mes / clientes_count),
            "tareasEjecutadasMes": tareas_ejecutadas,
        }

        # Acción rápida de facturación: abonos del mes sin facturar todavía
        # y tareas puntuales ya realizadas y listas para facturar.
        abonos_facturados_ids = {
            r["cliente_id"] for r in conn.execute(
                "SELECT DISTINCT cliente_id FROM movimientos_cc WHERE concepto LIKE 'Abono mensual facturado%' AND fecha LIKE ?",
                (f"{mes_actual}%",),
            ).fetchall()
        }
        abonos_pendientes = [
            cliente_out(r) for r in conn.execute(
                "SELECT * FROM clientes WHERE activo = 1 AND tipo_contrato = 'abono' AND monto_abono > 0"
            ).fetchall() if r["id"] not in abonos_facturados_ids
        ]
        tareas_listas = [tarea_out(r) for r in conn.execute(
            "SELECT * FROM tareas WHERE eliminado = 0 AND estado = 'realizado' AND modalidad = 'puntual'"
        ).fetchall()]
        payload["facturacionPendiente"] = {
            "abonos": abonos_pendientes,
            "tareas": tareas_listas,
        }

    conn.close()
    return jsonify(payload)


# ---------- Clientes (módulo 2) ----------
@app.post("/api/clientes")
def create_cliente():
    user, err = require_login()
    if err:
        return err
    data = request.get_json(force=True)
    if not data.get("nombreComercial") or not data.get("rubro") or not data.get("tipoContrato"):
        return jsonify({"error": "Faltan campos obligatorios"}), 400
    conn = db.get_connection()
    cid = db.new_id("cli")
    conn.execute(
        """INSERT INTO clientes
           (id, nombre_comercial, razon_social, cuit, rubro, tipo_contrato, monto_abono,
            direccion, contacto_nombre, contacto_whatsapp, dia_facturacion,
            estudio_contable_id, notas_internas, activo, creado)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1,?)""",
        (
            cid,
            data["nombreComercial"],
            data.get("razonSocial"),
            data.get("cuit"),
            data["rubro"],
            data["tipoContrato"],
            int(data.get("montoAbono") or 0),
            data.get("direccion"),
            data.get("contactoNombre"),
            data.get("contactoWhatsapp"),
            int(data.get("diaFacturacion") or 1),
            data.get("estudioContableId"),
            data.get("notasInternas"),
            now_iso(),
        ),
    )
    log_activity(conn, user["id"], f"Alta de cliente: {data['nombreComercial']}")
    conn.commit()
    row = conn.execute("SELECT * FROM clientes WHERE id = ?", (cid,)).fetchone()
    conn.close()
    return jsonify({"cliente": cliente_out(row)}), 201


@app.put("/api/clientes/<cliente_id>")
def update_cliente(cliente_id):
    user, err = require_login()
    if err:
        return err
    data = request.get_json(force=True)
    conn = db.get_connection()
    existing = conn.execute("SELECT * FROM clientes WHERE id = ?", (cliente_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Cliente no encontrado"}), 404
    fields = {
        "nombre_comercial": data.get("nombreComercial", existing["nombre_comercial"]),
        "razon_social": data.get("razonSocial", existing["razon_social"]),
        "cuit": data.get("cuit", existing["cuit"]),
        "rubro": data.get("rubro", existing["rubro"]),
        "tipo_contrato": data.get("tipoContrato", existing["tipo_contrato"]),
        "monto_abono": int(data.get("montoAbono", existing["monto_abono"]) or 0),
        "direccion": data.get("direccion", existing["direccion"]),
        "contacto_nombre": data.get("contactoNombre", existing["contacto_nombre"]),
        "contacto_whatsapp": data.get("contactoWhatsapp", existing["contacto_whatsapp"]),
        "dia_facturacion": int(data.get("diaFacturacion", existing["dia_facturacion"]) or 1),
        "estudio_contable_id": data.get("estudioContableId", existing["estudio_contable_id"]),
        "notas_internas": data.get("notasInternas", existing["notas_internas"]),
    }
    conn.execute(
        """UPDATE clientes SET nombre_comercial=?, razon_social=?, cuit=?, rubro=?, tipo_contrato=?,
           monto_abono=?, direccion=?, contacto_nombre=?, contacto_whatsapp=?, dia_facturacion=?,
           estudio_contable_id=?, notas_internas=? WHERE id=?""",
        (*fields.values(), cliente_id),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM clientes WHERE id = ?", (cliente_id,)).fetchone()
    conn.close()
    return jsonify({"cliente": cliente_out(row)})


@app.delete("/api/clientes/<cliente_id>")
def delete_cliente(cliente_id):
    user, err = require_login()
    if err:
        return err
    conn = db.get_connection()
    conn.execute("UPDATE clientes SET activo = 0 WHERE id = ?", (cliente_id,))
    log_activity(conn, user["id"], f"Baja (soft delete) de cliente {cliente_id}")
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


# ---------- Tareas / operación diaria (módulo 3) ----------
@app.post("/api/tareas")
def create_tarea():
    user, err = require_login()
    if err:
        return err
    data = request.get_json(force=True)
    for campo in ("fecha", "clienteId", "operadorId", "descripcion", "modalidad"):
        if not data.get(campo):
            return jsonify({"error": f"Falta el campo {campo}"}), 400
    conn = db.get_connection()
    tid = db.new_id("tar")
    conn.execute(
        """INSERT INTO tareas (id, fecha, cliente_id, operador_id, descripcion, horas, precio,
           modalidad, estado, eliminado) VALUES (?,?,?,?,?,?,?,?,?,0)""",
        (
            tid,
            data["fecha"],
            data["clienteId"],
            data["operadorId"],
            data["descripcion"],
            float(data.get("horas") or 0),
            int(data.get("precio") or 0),
            data["modalidad"],
            data.get("estado") or "pendiente",
        ),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM tareas WHERE id = ?", (tid,)).fetchone()
    conn.close()
    return jsonify({"tarea": tarea_out(row)}), 201


@app.put("/api/tareas/<tarea_id>")
def update_tarea(tarea_id):
    user, err = require_login()
    if err:
        return err
    data = request.get_json(force=True)
    conn = db.get_connection()
    existing = conn.execute("SELECT * FROM tareas WHERE id = ?", (tarea_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Tarea no encontrada"}), 404
    nuevo_estado = data.get("estado", existing["estado"])
    if nuevo_estado not in ("pendiente", "realizado", "facturado", "cobrado"):
        conn.close()
        return jsonify({"error": "Estado inválido"}), 400
    conn.execute("UPDATE tareas SET estado = ? WHERE id = ?", (nuevo_estado, tarea_id))

    # Al facturar una tarea puntual, se registra el débito automáticamente
    # en la cuenta corriente del cliente (módulo 6).
    if nuevo_estado == "facturado" and existing["estado"] != "facturado" and existing["modalidad"] == "puntual":
        ya_existe = conn.execute(
            "SELECT 1 FROM movimientos_cc WHERE referencia_tarea_id = ?", (tarea_id,)
        ).fetchone()
        if not ya_existe:
            crear_debito(conn, existing["cliente_id"], hoy_iso(), existing["precio"],
                         f"Tarea facturada: {existing['descripcion']}", referencia_tarea_id=tarea_id)

    conn.commit()
    row = conn.execute("SELECT * FROM tareas WHERE id = ?", (tarea_id,)).fetchone()
    conn.close()
    return jsonify({"tarea": tarea_out(row)})


# ---------- Stock por cliente (módulo 5) ----------
@app.post("/api/stock")
def create_stock():
    user, err = require_login()
    if err:
        return err
    data = request.get_json(force=True)
    if not data.get("clienteId") or not data.get("descripcion"):
        return jsonify({"error": "Faltan campos obligatorios"}), 400
    conn = db.get_connection()
    sid = db.new_id("stk")
    conn.execute(
        """INSERT INTO stock_items (id, cliente_id, codigo, descripcion, unidad, precio_unitario,
           cantidad, minimo, eliminado) VALUES (?,?,?,?,?,?,?,?,0)""",
        (
            sid,
            data["clienteId"],
            data.get("codigo"),
            data["descripcion"],
            data.get("unidad") or "un",
            int(data.get("precioUnitario") or 0),
            int(data.get("cantidad") or 0),
            int(data.get("minimo") or 0),
        ),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM stock_items WHERE id = ?", (sid,)).fetchone()
    conn.close()
    return jsonify({"item": stock_out(row)}), 201


@app.put("/api/stock/<item_id>")
def update_stock(item_id):
    user, err = require_login()
    if err:
        return err
    data = request.get_json(force=True)
    conn = db.get_connection()
    existing = conn.execute("SELECT * FROM stock_items WHERE id = ?", (item_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Ítem de stock no encontrado"}), 404
    conn.execute(
        """UPDATE stock_items SET codigo=?, descripcion=?, unidad=?, precio_unitario=?,
           cantidad=?, minimo=? WHERE id=?""",
        (
            data.get("codigo", existing["codigo"]),
            data.get("descripcion", existing["descripcion"]),
            data.get("unidad", existing["unidad"]),
            int(data.get("precioUnitario", existing["precio_unitario"]) or 0),
            int(data.get("cantidad", existing["cantidad"]) or 0),
            int(data.get("minimo", existing["minimo"]) or 0),
            item_id,
        ),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM stock_items WHERE id = ?", (item_id,)).fetchone()
    conn.close()
    return jsonify({"item": stock_out(row)})


@app.delete("/api/stock/<item_id>")
def delete_stock(item_id):
    user, err = require_login()
    if err:
        return err
    conn = db.get_connection()
    conn.execute("UPDATE stock_items SET eliminado = 1 WHERE id = ?", (item_id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


# ---------- Presupuestador digital (módulo 5) ----------
IVA_PORCENTAJE = 0.21


@app.post("/api/presupuestos")
def create_presupuesto():
    user, err = require_login()
    if err:
        return err
    data = request.get_json(force=True)
    cliente_id = data.get("clienteId")
    items = data.get("items") or []
    if not cliente_id or not items:
        return jsonify({"error": "Elegí un cliente y agregá al menos un ítem"}), 400

    conn = db.get_connection()

    # Validar stock disponible antes de descontar nada.
    for it in items:
        if it.get("stockItemId"):
            row = conn.execute("SELECT * FROM stock_items WHERE id = ?", (it["stockItemId"],)).fetchone()
            if not row:
                conn.close()
                return jsonify({"error": f"Ítem de stock inexistente: {it['stockItemId']}"}), 400
            if row["cantidad"] < int(it.get("cantidad") or 0):
                conn.close()
                return jsonify({"error": f"Stock insuficiente de \"{row['descripcion']}\" (disponible: {row['cantidad']})"}), 400

    subtotal = 0
    items_normalizados = []
    for it in items:
        cantidad = int(it.get("cantidad") or 0)
        precio_unitario = int(it.get("precioUnitario") or 0)
        line_total = cantidad * precio_unitario
        subtotal += line_total
        items_normalizados.append({
            "stockItemId": it.get("stockItemId"),
            "descripcion": it.get("descripcion"),
            "cantidad": cantidad,
            "precioUnitario": precio_unitario,
        })

    iva = round(subtotal * IVA_PORCENTAJE)
    total = subtotal + iva

    pid = db.new_id("ppt")
    conn.execute(
        """INSERT INTO presupuestos (id, cliente_id, fecha, items, subtotal, iva, total, estado, eliminado)
           VALUES (?,?,?,?,?,?,?, 'pendiente', 0)""",
        (pid, cliente_id, data.get("fecha") or now_iso()[:10], json.dumps(items_normalizados), subtotal, iva, total),
    )

    # Descuento automático del stock al confirmar el presupuesto.
    for it in items_normalizados:
        if it["stockItemId"]:
            conn.execute(
                "UPDATE stock_items SET cantidad = cantidad - ? WHERE id = ?",
                (it["cantidad"], it["stockItemId"]),
            )

    log_activity(conn, user["id"], f"Presupuesto generado para cliente {cliente_id} por {total}")
    conn.commit()
    row = conn.execute("SELECT * FROM presupuestos WHERE id = ?", (pid,)).fetchone()
    conn.close()
    return jsonify({"presupuesto": presupuesto_out(row)}), 201


@app.put("/api/presupuestos/<presupuesto_id>")
def update_presupuesto(presupuesto_id):
    user, err = require_login()
    if err:
        return err
    data = request.get_json(force=True)
    nuevo_estado = data.get("estado")
    if nuevo_estado not in ("pendiente", "aprobado", "rechazado"):
        return jsonify({"error": "Estado inválido"}), 400

    conn = db.get_connection()
    existing = conn.execute("SELECT * FROM presupuestos WHERE id = ?", (presupuesto_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Presupuesto no encontrado"}), 404

    # Si se rechaza un presupuesto que ya había descontado stock, se repone.
    if nuevo_estado == "rechazado" and existing["estado"] != "rechazado":
        for it in json.loads(existing["items"]):
            if it.get("stockItemId"):
                conn.execute(
                    "UPDATE stock_items SET cantidad = cantidad + ? WHERE id = ?",
                    (it["cantidad"], it["stockItemId"]),
                )

    # Al aprobar un presupuesto, se registra el débito en la cuenta corriente.
    if nuevo_estado == "aprobado" and existing["estado"] != "aprobado":
        ya_existe = conn.execute(
            "SELECT 1 FROM movimientos_cc WHERE concepto LIKE ? AND cliente_id = ?",
            (f"%{presupuesto_id}%", existing["cliente_id"]),
        ).fetchone()
        if not ya_existe:
            crear_debito(conn, existing["cliente_id"], hoy_iso(), existing["total"],
                         f"Presupuesto aprobado ({presupuesto_id})")

    conn.execute("UPDATE presupuestos SET estado = ? WHERE id = ?", (nuevo_estado, presupuesto_id))
    conn.commit()
    row = conn.execute("SELECT * FROM presupuestos WHERE id = ?", (presupuesto_id,)).fetchone()
    conn.close()
    return jsonify({"presupuesto": presupuesto_out(row)})


@app.get("/presupuestos/<presupuesto_id>/imprimir")
def imprimir_presupuesto(presupuesto_id):
    user, err = require_login()
    if err:
        return "No autenticado", 401
    conn = db.get_connection()
    p = conn.execute("SELECT * FROM presupuestos WHERE id = ?", (presupuesto_id,)).fetchone()
    if not p:
        conn.close()
        return "Presupuesto no encontrado", 404
    cliente = conn.execute("SELECT * FROM clientes WHERE id = ?", (p["cliente_id"],)).fetchone()
    conn.close()

    def ars(n):
        return f"{n:,}".replace(",", ".")

    items = json.loads(p["items"])
    filas = "".join(
        f"<tr><td>{escape(it.get('descripcion') or '')}</td>"
        f"<td style='text-align:right'>{it.get('cantidad')}</td>"
        f"<td style='text-align:right'>${ars(it.get('precioUnitario'))}</td>"
        f"<td style='text-align:right'>${ars(it.get('cantidad') * it.get('precioUnitario'))}</td></tr>"
        for it in items
    )

    html = f"""<!DOCTYPE html>
<html lang="es-AR"><head><meta charset="UTF-8"><title>Presupuesto {escape(presupuesto_id)}</title>
<style>
body {{ font-family: Arial, sans-serif; color: #0f172a; padding: 40px; }}
h1 {{ font-size: 18px; }}
table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
th, td {{ padding: 8px; border-bottom: 1px solid #cbd5e1; font-size: 13px; }}
th {{ text-align: left; background: #f1f5f9; }}
.totales td {{ border: none; font-weight: bold; }}
</style></head>
<body>
<h1>AdminYAAA — Presupuesto</h1>
<p><strong>Cliente:</strong> {escape(cliente['nombre_comercial'] if cliente else '—')}<br>
<strong>Fecha:</strong> {escape(fmt_fecha(p['fecha']))}<br>
<strong>Estado:</strong> {escape(p['estado'])}</p>
<table>
<thead><tr><th>Descripción</th><th style="text-align:right">Cantidad</th><th style="text-align:right">Precio unit.</th><th style="text-align:right">Subtotal</th></tr></thead>
<tbody>{filas}</tbody>
<tfoot>
<tr class="totales"><td colspan="3" style="text-align:right">Subtotal</td><td style="text-align:right">${ars(p['subtotal'])}</td></tr>
<tr class="totales"><td colspan="3" style="text-align:right">IVA (21%)</td><td style="text-align:right">${ars(p['iva'])}</td></tr>
<tr class="totales"><td colspan="3" style="text-align:right">Total</td><td style="text-align:right">${ars(p['total'])}</td></tr>
</tfoot>
</table>
<script>window.print();</script>
</body></html>"""
    return html


# ---------- Planilla gastronómica (módulo 4) ----------
@app.post("/api/planillas")
def upsert_planilla():
    user, err = require_login()
    if err:
        return err
    data = request.get_json(force=True)
    if not data.get("clienteId") or not data.get("fecha"):
        return jsonify({"error": "Faltan campos obligatorios"}), 400
    conn = db.get_connection()
    existing = conn.execute(
        "SELECT * FROM planillas_turno WHERE cliente_id = ? AND fecha = ?",
        (data["clienteId"], data["fecha"]),
    ).fetchone()
    valores = (
        int(data.get("ventasTarde") or 0),
        int(data.get("ventasNoche") or 0),
        int(data.get("gastosDia") or 0),
        int(data.get("objetivoMensual") or 0),
        data.get("nota"),
    )
    if existing:
        conn.execute(
            """UPDATE planillas_turno SET ventas_tarde=?, ventas_noche=?, gastos_dia=?,
               objetivo_mensual=?, nota=? WHERE id=?""",
            (*valores, existing["id"]),
        )
        pid = existing["id"]
    else:
        pid = db.new_id("pla")
        conn.execute(
            """INSERT INTO planillas_turno (id, cliente_id, fecha, ventas_tarde, ventas_noche,
               gastos_dia, objetivo_mensual, nota) VALUES (?,?,?,?,?,?,?,?)""",
            (pid, data["clienteId"], data["fecha"], *valores),
        )
    conn.commit()
    row = conn.execute("SELECT * FROM planillas_turno WHERE id = ?", (pid,)).fetchone()
    conn.close()
    return jsonify({"planilla": planilla_out(row)}), 201


# ---------- Cuentas corrientes y tesorería (módulo 6) ----------
@app.post("/api/movimientos")
def create_movimiento():
    """Registra un pago (crédito) de un cliente y aplica FIFO contra sus débitos pendientes."""
    user, err = require_login()
    if err:
        return err
    data = request.get_json(force=True)
    cliente_id = data.get("clienteId")
    monto = int(data.get("monto") or 0)
    if not cliente_id or monto <= 0:
        return jsonify({"error": "Elegí un cliente y un monto válido"}), 400

    conn = db.get_connection()
    mid = db.new_id("mov")
    conn.execute(
        """INSERT INTO movimientos_cc (id, cliente_id, fecha, tipo, monto, concepto, cuenta_id,
           comprobante, saldo_pendiente) VALUES (?,?,?, 'credito', ?,?,?,?, 0)""",
        (
            mid,
            cliente_id,
            data.get("fecha") or hoy_iso(),
            monto,
            data.get("concepto") or "Pago recibido",
            data.get("cuentaId"),
            data.get("comprobante"),
        ),
    )
    if data.get("cuentaId"):
        conn.execute("UPDATE cuentas_dinero SET saldo = saldo + ? WHERE id = ?", (monto, data["cuentaId"]))
    aplicar_fifo_credito(conn, cliente_id, monto)
    log_activity(conn, user["id"], f"Pago registrado de cliente {cliente_id} por {monto}")
    conn.commit()

    movimientos = [movimiento_out(r) for r in conn.execute(
        "SELECT * FROM movimientos_cc WHERE cliente_id = ? ORDER BY fecha ASC", (cliente_id,)
    ).fetchall()]
    conn.close()
    return jsonify({"movimientos": movimientos}), 201


@app.post("/api/config")
def update_config():
    """Datos bancarios oficiales de AdminYAAA para el generador de mensajes de cobro (módulo 16)."""
    user, err = require_admin()
    if err:
        return err
    data = request.get_json(force=True)
    conn = db.get_connection()
    for clave, valor in data.items():
        conn.execute(
            "INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor",
            (clave, str(valor)),
        )
    conn.commit()
    config = {r["clave"]: r["valor"] for r in conn.execute("SELECT * FROM config").fetchall()}
    conn.close()
    return jsonify({"config": config})


# ---------- Préstamos al personal (módulo 8) ----------
@app.post("/api/prestamos")
def create_prestamo():
    user, err = require_admin()
    if err:
        return err
    data = request.get_json(force=True)
    monto_total = int(data.get("montoTotal") or 0)
    cuotas = int(data.get("cuotas") or 0)
    if not data.get("operadorId") or monto_total <= 0 or cuotas <= 0:
        return jsonify({"error": "Completá operador, monto y cantidad de cuotas"}), 400
    valor_cuota = round(monto_total / cuotas)
    conn = db.get_connection()
    pid = db.new_id("prs")
    conn.execute(
        """INSERT INTO prestamos (id, operador_id, monto_total, cuotas, valor_cuota, cuotas_pagadas, fecha, estado)
           VALUES (?,?,?,?,?,0,?, 'activo')""",
        (pid, data["operadorId"], monto_total, cuotas, valor_cuota, data.get("fecha") or hoy_iso()),
    )
    log_activity(conn, user["id"], f"Préstamo otorgado a {data['operadorId']} por {monto_total}")
    conn.commit()
    row = conn.execute("SELECT * FROM prestamos WHERE id = ?", (pid,)).fetchone()
    conn.close()
    return jsonify({"prestamo": prestamo_out(row)}), 201


# ---------- Liquidación de sueldos (módulo 8) ----------
@app.post("/api/liquidaciones")
def create_liquidacion():
    user, err = require_admin()
    if err:
        return err
    data = request.get_json(force=True)
    operador_id = data.get("operadorId")
    periodo = data.get("periodo")
    if not operador_id or not periodo:
        return jsonify({"error": "Elegí operador y período"}), 400

    conn = db.get_connection()
    operador = conn.execute("SELECT * FROM usuarios WHERE id = ?", (operador_id,)).fetchone()
    if not operador:
        conn.close()
        return jsonify({"error": "Operador no encontrado"}), 404

    sueldo_base = operador["sueldo_base"]
    adicionales = int(data.get("adicionales") or 0)

    # Descuento automático por ausencias/demoras del período (módulo 10).
    valor_dia = sueldo_base / 30 if sueldo_base else 0
    faltas = conn.execute(
        "SELECT COUNT(*) AS c FROM presentismo WHERE operador_id = ? AND tipo = 'falta' AND fecha LIKE ?",
        (operador_id, f"{periodo}%"),
    ).fetchone()["c"]
    demoras = conn.execute(
        "SELECT COUNT(*) AS c FROM presentismo WHERE operador_id = ? AND tipo = 'demora' AND fecha LIKE ?",
        (operador_id, f"{periodo}%"),
    ).fetchone()["c"]
    descuentos_ausencias = round(faltas * valor_dia + demoras * valor_dia * 0.5)

    # Descuento automático de la cuota vigente de un préstamo activo (módulo 8).
    descuentos_prestamo = 0
    prestamo = conn.execute(
        "SELECT * FROM prestamos WHERE operador_id = ? AND estado = 'activo' ORDER BY fecha ASC LIMIT 1",
        (operador_id,),
    ).fetchone()
    if prestamo:
        descuentos_prestamo = prestamo["valor_cuota"]
        nuevas_cuotas_pagadas = prestamo["cuotas_pagadas"] + 1
        nuevo_estado = "saldado" if nuevas_cuotas_pagadas >= prestamo["cuotas"] else "activo"
        conn.execute(
            "UPDATE prestamos SET cuotas_pagadas = ?, estado = ? WHERE id = ?",
            (nuevas_cuotas_pagadas, nuevo_estado, prestamo["id"]),
        )

    neto = sueldo_base + adicionales - descuentos_ausencias - descuentos_prestamo

    lid = db.new_id("liq")
    conn.execute(
        """INSERT INTO liquidaciones (id, operador_id, periodo, sueldo_base, adicionales,
           descuentos_ausencias, descuentos_prestamo, neto, fecha, estado)
           VALUES (?,?,?,?,?,?,?,?,?, 'pendiente')""",
        (lid, operador_id, periodo, sueldo_base, adicionales, descuentos_ausencias, descuentos_prestamo, neto, hoy_iso()),
    )
    log_activity(conn, user["id"], f"Liquidación generada para {operador_id} — período {periodo}")
    conn.commit()
    row = conn.execute("SELECT * FROM liquidaciones WHERE id = ?", (lid,)).fetchone()
    prestamos = [prestamo_out(r) for r in conn.execute("SELECT * FROM prestamos ORDER BY fecha DESC").fetchall()]
    conn.close()
    return jsonify({"liquidacion": liquidacion_out(row), "prestamos": prestamos}), 201


@app.put("/api/liquidaciones/<liquidacion_id>")
def update_liquidacion(liquidacion_id):
    user, err = require_admin()
    if err:
        return err
    data = request.get_json(force=True)
    if data.get("estado") != "pagado":
        return jsonify({"error": "Estado inválido"}), 400
    conn = db.get_connection()
    conn.execute("UPDATE liquidaciones SET estado = 'pagado' WHERE id = ?", (liquidacion_id,))
    conn.commit()
    row = conn.execute("SELECT * FROM liquidaciones WHERE id = ?", (liquidacion_id,)).fetchone()
    conn.close()
    return jsonify({"liquidacion": liquidacion_out(row)})


# ---------- Cajas chicas por operador (módulo 9) ----------
@app.post("/api/cajas")
def create_caja():
    user, err = require_admin()
    if err:
        return err
    data = request.get_json(force=True)
    tope = int(data.get("tope") or 0)
    if not data.get("operadorId") or tope <= 0:
        return jsonify({"error": "Elegí operador y un tope válido"}), 400
    conn = db.get_connection()
    existente = conn.execute("SELECT * FROM cajas_chicas WHERE operador_id = ?", (data["operadorId"],)).fetchone()
    if existente:
        conn.close()
        return jsonify({"error": "Ese operador ya tiene una caja chica asignada"}), 400
    cid = db.new_id("caj")
    conn.execute(
        "INSERT INTO cajas_chicas (id, operador_id, tope, saldo_actual) VALUES (?,?,?,?)",
        (cid, data["operadorId"], tope, tope),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM cajas_chicas WHERE id = ?", (cid,)).fetchone()
    conn.close()
    return jsonify({"caja": caja_out(row)}), 201


@app.post("/api/cajas/<caja_id>/rendicion")
def rendir_gasto(caja_id):
    user, err = require_login()
    if err:
        return err
    data = request.get_json(force=True)
    monto = int(data.get("monto") or 0)
    if not data.get("motivo") or monto <= 0:
        return jsonify({"error": "Completá el motivo y un monto válido"}), 400
    conn = db.get_connection()
    caja = conn.execute("SELECT * FROM cajas_chicas WHERE id = ?", (caja_id,)).fetchone()
    if not caja:
        conn.close()
        return jsonify({"error": "Caja chica no encontrada"}), 404
    if monto > caja["saldo_actual"]:
        conn.close()
        return jsonify({"error": f"El fondo solo tiene {caja['saldo_actual']} disponibles"}), 400
    rid = db.new_id("ren")
    conn.execute(
        "INSERT INTO rendiciones (id, caja_id, fecha, motivo, monto, comprobante) VALUES (?,?,?,?,?,?)",
        (rid, caja_id, data.get("fecha") or hoy_iso(), data["motivo"], monto, data.get("comprobante")),
    )
    conn.execute("UPDATE cajas_chicas SET saldo_actual = saldo_actual - ? WHERE id = ?", (monto, caja_id))
    conn.commit()
    caja_actualizada = conn.execute("SELECT * FROM cajas_chicas WHERE id = ?", (caja_id,)).fetchone()
    rendicion = conn.execute("SELECT * FROM rendiciones WHERE id = ?", (rid,)).fetchone()
    conn.close()
    return jsonify({"caja": caja_out(caja_actualizada), "rendicion": rendicion_out(rendicion)}), 201


@app.post("/api/cajas/<caja_id>/reponer")
def reponer_caja(caja_id):
    user, err = require_admin()
    if err:
        return err
    conn = db.get_connection()
    caja = conn.execute("SELECT * FROM cajas_chicas WHERE id = ?", (caja_id,)).fetchone()
    if not caja:
        conn.close()
        return jsonify({"error": "Caja chica no encontrada"}), 404
    conn.execute("UPDATE cajas_chicas SET saldo_actual = tope WHERE id = ?", (caja_id,))
    log_activity(conn, user["id"], f"Reposición de caja chica {caja_id}")
    conn.commit()
    row = conn.execute("SELECT * FROM cajas_chicas WHERE id = ?", (caja_id,)).fetchone()
    conn.close()
    return jsonify({"caja": caja_out(row)})


# ---------- Presentismo (módulo 10) ----------
@app.post("/api/presentismo")
def create_presentismo():
    user, err = require_login()
    if err:
        return err
    data = request.get_json(force=True)
    if not data.get("operadorId") or not data.get("fecha") or data.get("tipo") not in ("falta", "demora"):
        return jsonify({"error": "Faltan campos obligatorios"}), 400
    conn = db.get_connection()
    pid = db.new_id("pre")
    conn.execute(
        "INSERT INTO presentismo (id, operador_id, fecha, tipo, motivo, estado) VALUES (?,?,?,?,?, 'registrado')",
        (pid, data["operadorId"], data["fecha"], data["tipo"], data.get("motivo")),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM presentismo WHERE id = ?", (pid,)).fetchone()
    conn.close()
    return jsonify({"registro": presentismo_out(row)}), 201


@app.delete("/api/presentismo/<registro_id>")
def delete_presentismo(registro_id):
    user, err = require_login()
    if err:
        return err
    conn = db.get_connection()
    conn.execute("DELETE FROM presentismo WHERE id = ?", (registro_id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


# ---------- Dashboard: acción rápida de facturación (módulo 1) ----------
@app.post("/api/facturar-seleccionados")
def facturar_seleccionados():
    user, err = require_admin()
    if err:
        return err
    data = request.get_json(force=True)
    abono_ids = data.get("abonoClienteIds") or []
    tarea_ids = data.get("tareaIds") or []
    mes_actual = datetime.date.today().strftime("%Y-%m")

    conn = db.get_connection()
    for cliente_id in abono_ids:
        cliente = conn.execute("SELECT * FROM clientes WHERE id = ?", (cliente_id,)).fetchone()
        if cliente and cliente["monto_abono"] > 0:
            crear_debito(conn, cliente_id, hoy_iso(), cliente["monto_abono"],
                         f"Abono mensual facturado ({mes_actual})")

    for tarea_id in tarea_ids:
        tarea = conn.execute("SELECT * FROM tareas WHERE id = ? AND estado = 'realizado'", (tarea_id,)).fetchone()
        if tarea:
            conn.execute("UPDATE tareas SET estado = 'facturado' WHERE id = ?", (tarea_id,))
            ya_existe = conn.execute("SELECT 1 FROM movimientos_cc WHERE referencia_tarea_id = ?", (tarea_id,)).fetchone()
            if not ya_existe:
                crear_debito(conn, tarea["cliente_id"], hoy_iso(), tarea["precio"],
                             f"Tarea facturada: {tarea['descripcion']}", referencia_tarea_id=tarea_id)

    log_activity(conn, user["id"], f"Facturación rápida: {len(abono_ids)} abonos, {len(tarea_ids)} tareas")
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


# ---------- Gastos operativos del negocio (módulo 11) ----------
@app.post("/api/gastos")
def create_gasto():
    user, err = require_login()
    if err:
        return err
    data = request.get_json(force=True)
    monto = int(data.get("monto") or 0)
    if not data.get("categoria") or monto <= 0:
        return jsonify({"error": "Completá la categoría y un monto válido"}), 400
    conn = db.get_connection()
    gid = db.new_id("gas")
    conn.execute(
        """INSERT INTO gastos_operativos (id, categoria, proveedor, monto, vencimiento, estado, eliminado)
           VALUES (?,?,?,?,?, 'pendiente', 0)""",
        (gid, data["categoria"], data.get("proveedor"), monto, data.get("vencimiento")),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM gastos_operativos WHERE id = ?", (gid,)).fetchone()
    conn.close()
    return jsonify({"gasto": gasto_out(row)}), 201


@app.put("/api/gastos/<gasto_id>")
def update_gasto(gasto_id):
    user, err = require_login()
    if err:
        return err
    data = request.get_json(force=True)
    nuevo_estado = data.get("estado")
    if nuevo_estado not in ("pendiente", "pagado"):
        return jsonify({"error": "Estado inválido"}), 400
    conn = db.get_connection()
    conn.execute("UPDATE gastos_operativos SET estado = ? WHERE id = ?", (nuevo_estado, gasto_id))
    conn.commit()
    row = conn.execute("SELECT * FROM gastos_operativos WHERE id = ?", (gasto_id,)).fetchone()
    conn.close()
    return jsonify({"gasto": gasto_out(row)})


@app.delete("/api/gastos/<gasto_id>")
def delete_gasto(gasto_id):
    user, err = require_login()
    if err:
        return err
    conn = db.get_connection()
    conn.execute("UPDATE gastos_operativos SET eliminado = 1 WHERE id = ?", (gasto_id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


# ---------- Finanzas de socios (módulo 12, solo admin) ----------
@app.post("/api/retiros")
def create_retiro():
    user, err = require_admin()
    if err:
        return err
    data = request.get_json(force=True)
    monto = int(data.get("monto") or 0)
    if not data.get("socioId") or monto <= 0 or data.get("tipo") not in ("retiro", "gasto_personal"):
        return jsonify({"error": "Completá socio, tipo y un monto válido"}), 400
    conn = db.get_connection()
    rid = db.new_id("ret")
    conn.execute(
        "INSERT INTO retiros_socios (id, socio_id, fecha, monto, tipo, nota) VALUES (?,?,?,?,?,?)",
        (rid, data["socioId"], data.get("fecha") or hoy_iso(), monto, data["tipo"], data.get("nota")),
    )
    log_activity(conn, user["id"], f"{data['tipo']} de socio {data['socioId']} por {monto}")
    conn.commit()
    row = conn.execute("SELECT * FROM retiros_socios WHERE id = ?", (rid,)).fetchone()
    conn.close()
    return jsonify({"retiro": retiro_out(row)}), 201


# ---------- Tesorería (módulo 14) ----------
@app.post("/api/cuentas/<cuenta_id>/ajustar")
def ajustar_cuenta(cuenta_id):
    user, err = require_admin()
    if err:
        return err
    data = request.get_json(force=True)
    if "nuevoSaldo" not in data:
        return jsonify({"error": "Falta el nuevo saldo"}), 400
    conn = db.get_connection()
    cuenta = conn.execute("SELECT * FROM cuentas_dinero WHERE id = ?", (cuenta_id,)).fetchone()
    if not cuenta:
        conn.close()
        return jsonify({"error": "Cuenta no encontrada"}), 404
    nuevo_saldo = int(data["nuevoSaldo"])
    conn.execute("UPDATE cuentas_dinero SET saldo = ? WHERE id = ?", (nuevo_saldo, cuenta_id))
    log_activity(conn, user["id"],
                 f"Ajuste manual de {cuenta['nombre']}: {cuenta['saldo']} → {nuevo_saldo} ({data.get('motivo') or 'sin motivo'})")
    conn.commit()
    row = conn.execute("SELECT * FROM cuentas_dinero WHERE id = ?", (cuenta_id,)).fetchone()
    conn.close()
    return jsonify({"cuenta": cuenta_out(row)})


# ---------- Usuarios y roles / auditoría de permisos (módulo 15, solo admin) ----------
@app.post("/api/usuarios")
def create_usuario():
    user, err = require_admin()
    if err:
        return err
    data = request.get_json(force=True)
    email = (data.get("email") or "").strip().lower()
    if not data.get("nombre") or not email or not data.get("password") or data.get("rol") not in ("admin", "operador"):
        return jsonify({"error": "Completá nombre, email, contraseña y rol"}), 400
    conn = db.get_connection()
    if conn.execute("SELECT 1 FROM usuarios WHERE email = ?", (email,)).fetchone():
        conn.close()
        return jsonify({"error": "Ya existe un usuario con ese email"}), 400
    uid = db.new_id("usr")
    iniciales = "".join(p[0].upper() for p in data["nombre"].split()[:2])
    conn.execute(
        """INSERT INTO usuarios (id, nombre, email, password_hash, rol, cargo, sueldo_base, activo, creado)
           VALUES (?,?,?,?,?,?,?,1,?)""",
        (uid, data["nombre"], email, generate_password_hash(data["password"]), data["rol"],
         data.get("cargo"), int(data.get("sueldoBase") or 0), now_iso()),
    )
    log_activity(conn, user["id"], f"Alta de usuario interno: {data['nombre']} ({data['rol']})")
    conn.commit()
    row = conn.execute("SELECT * FROM usuarios WHERE id = ?", (uid,)).fetchone()
    conn.close()
    return jsonify({"usuario": usuario_out(row)}), 201


@app.put("/api/usuarios/<usuario_id>")
def update_usuario(usuario_id):
    user, err = require_admin()
    if err:
        return err
    data = request.get_json(force=True)
    conn = db.get_connection()
    existing = conn.execute("SELECT * FROM usuarios WHERE id = ?", (usuario_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Usuario no encontrado"}), 404
    if usuario_id == user["id"] and data.get("activo") is False:
        conn.close()
        return jsonify({"error": "No podés desactivar tu propio usuario"}), 400
    conn.execute(
        """UPDATE usuarios SET rol = ?, cargo = ?, sueldo_base = ?, activo = ? WHERE id = ?""",
        (
            data.get("rol", existing["rol"]),
            data.get("cargo", existing["cargo"]),
            int(data.get("sueldoBase", existing["sueldo_base"]) or 0),
            1 if data.get("activo", bool(existing["activo"])) else 0,
            usuario_id,
        ),
    )
    log_activity(conn, user["id"], f"Edición de usuario interno {usuario_id}")
    conn.commit()
    row = conn.execute("SELECT * FROM usuarios WHERE id = ?", (usuario_id,)).fetchone()
    conn.close()
    return jsonify({"usuario": usuario_out(row)})


def fmt_fecha(iso):
    partes = (iso or "").split("-")
    if len(partes) != 3:
        return iso or ""
    return f"{partes[2]}/{partes[1]}/{partes[0]}"


if __name__ == "__main__":
    app.run(port=4175, debug=True)
