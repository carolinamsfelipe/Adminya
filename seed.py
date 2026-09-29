"""Seed idempotente de datos de demostración para AdminYAAA · Gestión interna."""

import datetime
from werkzeug.security import generate_password_hash

import db

DEMO_PASSWORD = "adminyaaa2026"


def run():
    db.init_db()
    conn = db.get_connection()

    ya_sembrado = conn.execute("SELECT COUNT(*) AS c FROM usuarios").fetchone()["c"]
    if ya_sembrado:
        conn.close()
        print("Ya hay datos cargados, no se vuelve a sembrar.")
        return

    hoy = datetime.date.today()
    ahora = datetime.datetime.now().isoformat(timespec="seconds")

    usuarios = [
        ("usr_joaquin", "Joaquín", "joaquin@adminya.com.ar", "admin", "Socio / Gerente", 0),
        ("usr_maximo", "Máximo", "maximo@adminya.com.ar", "admin", "Socio", 0),
        ("usr_ana", "Ana", "ana@adminya.com.ar", "operador", "Asistente administrativa", 450000),
    ]
    for uid, nombre, email, rol, cargo, sueldo in usuarios:
        conn.execute(
            "INSERT INTO usuarios (id, nombre, email, password_hash, rol, cargo, sueldo_base, activo, creado) VALUES (?,?,?,?,?,?,?,1,?)",
            (uid, nombre, email, generate_password_hash(DEMO_PASSWORD), rol, cargo, sueldo, ahora),
        )

    clientes = [
        ("cli_kiosco", "Kiosco Don Juan", "Juan Pérez", "20-11111111-1", "comercio", "abono", 45000, "11-5555-1111"),
        ("cli_parrilla", "Parrilla El Fogón", "Fogón SRL", "30-22222222-2", "gastronomia", "abono", 90000, "11-5555-2222"),
        ("cli_maderera", "Maderera del Sur", "Maderas del Sur SA", "30-33333333-3", "distribuidora", "puntual", 0, "11-5555-3333"),
        ("cli_distribuidora", "Distribuidora Máximo", "Distribuidora MG SRL", "30-44444444-4", "distribuidora", "abono", 120000, "11-5555-4444"),
    ]
    for cid, nombre, razon, cuit, rubro, contrato, abono, wsp in clientes:
        conn.execute(
            """INSERT INTO clientes (id, nombre_comercial, razon_social, cuit, rubro, tipo_contrato,
               monto_abono, direccion, contacto_nombre, contacto_whatsapp, dia_facturacion, activo, creado)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?)""",
            (cid, nombre, razon, cuit, rubro, contrato, abono, "Ramos Mejía, Buenos Aires", nombre.split()[0], wsp, 10, ahora),
        )

    mes = hoy.strftime("%Y-%m")
    tareas = [
        (f"{mes}-03", "cli_kiosco", "usr_ana", "Confección de recibos de sueldo", 2, 0, "abono", "cobrado"),
        (f"{mes}-05", "cli_parrilla", "usr_ana", "Cierre de cajas y márgenes", 3, 0, "abono", "facturado"),
        (f"{mes}-08", "cli_maderera", "usr_joaquin", "Presupuestación digital a depósito", 4, 60000, "puntual", "realizado"),
        (f"{mes}-10", "cli_distribuidora", "usr_maximo", "Armado de ficha de stock", 2.5, 0, "abono", "cobrado"),
        (f"{mes}-12", "cli_kiosco", "usr_ana", "Carga de gastos e insumos", 1, 0, "abono", "pendiente"),
    ]
    for fecha, cliente_id, operador_id, desc, horas, precio, modalidad, estado in tareas:
        conn.execute(
            "INSERT INTO tareas (id, fecha, cliente_id, operador_id, descripcion, horas, precio, modalidad, estado, eliminado) VALUES (?,?,?,?,?,?,?,?,?,0)",
            (db.new_id("tar"), fecha, cliente_id, operador_id, desc, horas, precio, modalidad, estado),
        )

    stock = [
        ("cli_maderera", "MAD-001", "Tabla de pino 2.5m", "un", 8500, 40, 10),
        ("cli_maderera", "MAD-002", "Placa fenólica 18mm", "un", 15200, 15, 5),
        ("cli_maderera", "MAD-003", "Listón de eucalipto 3m", "un", 4200, 60, 15),
        ("cli_distribuidora", "DIS-001", "Aceite de girasol 900ml", "caja x12", 18000, 30, 8),
        ("cli_distribuidora", "DIS-002", "Arroz largo fino 1kg", "caja x20", 22000, 25, 6),
        ("cli_distribuidora", "DIS-003", "Yerba mate 1kg", "caja x10", 26000, 4, 5),
    ]
    for cliente_id, codigo, descripcion, unidad, precio, cantidad, minimo in stock:
        conn.execute(
            "INSERT INTO stock_items (id, cliente_id, codigo, descripcion, unidad, precio_unitario, cantidad, minimo, eliminado) VALUES (?,?,?,?,?,?,?,?,0)",
            (db.new_id("stk"), cliente_id, codigo, descripcion, unidad, precio, cantidad, minimo),
        )

    planillas = [
        (1, 180000, 210000, 95000),
        (2, 165000, 195000, 88000),
        (3, 190000, 240000, 102000),
    ]
    for dias_atras, tarde, noche, gastos in planillas:
        fecha = (hoy - datetime.timedelta(days=dias_atras)).isoformat()
        conn.execute(
            "INSERT INTO planillas_turno (id, cliente_id, fecha, ventas_tarde, ventas_noche, gastos_dia, objetivo_mensual, nota) VALUES (?,?,?,?,?,?,?,?)",
            (db.new_id("pla"), "cli_parrilla", fecha, tarde, noche, gastos, 12000000, None),
        )

    cuentas = [
        ("cta_nacion", "Banco Nación", "banco", 850000),
        ("cta_galicia", "Banco Galicia", "banco", 420000),
        ("cta_mp", "Mercado Pago", "mercadopago", 150000),
        ("cta_efectivo", "Caja Efectivo Ramos Mejía", "efectivo", 60000),
    ]
    for cid, nombre, tipo, saldo in cuentas:
        conn.execute(
            "INSERT INTO cuentas_dinero (id, nombre, tipo, saldo) VALUES (?,?,?,?)",
            (cid, nombre, tipo, saldo),
        )

    # Cuenta corriente de ejemplo: un débito grande con un pago parcial (queda saldo pendiente real).
    deb_id = db.new_id("mov")
    conn.execute(
        "INSERT INTO movimientos_cc (id, cliente_id, fecha, tipo, monto, concepto, saldo_pendiente) VALUES (?,?,?, 'debito', ?, ?, ?)",
        (deb_id, "cli_distribuidora", (hoy - datetime.timedelta(days=20)).isoformat(), 120000, "Abono mensual facturado", 120000),
    )
    conn.execute(
        "INSERT INTO movimientos_cc (id, cliente_id, fecha, tipo, monto, concepto, cuenta_id, saldo_pendiente) VALUES (?,?,?, 'credito', ?, ?, ?, 0)",
        (db.new_id("mov"), "cli_distribuidora", (hoy - datetime.timedelta(days=5)).isoformat(), 70000, "Pago parcial por transferencia", "cta_mp"),
    )
    conn.execute("UPDATE movimientos_cc SET saldo_pendiente = saldo_pendiente - 70000 WHERE id = ?", (deb_id,))

    config = [
        ("banco_titular", "AdminYAAA"),
        ("banco_cuit", "30-99999999-9"),
        ("banco_cbu", "0000003100000000000000"),
        ("banco_alias", "ADMINYAAA.PAGOS"),
        ("banco_nombre", "Banco Nación"),
    ]
    for clave, valor in config:
        conn.execute("INSERT INTO config (clave, valor) VALUES (?, ?)", (clave, valor))

    # Préstamo al personal de ejemplo (usr_ana), con una cuota ya descontada.
    conn.execute(
        "INSERT INTO prestamos (id, operador_id, monto_total, cuotas, valor_cuota, cuotas_pagadas, fecha, estado) VALUES (?,?,?,?,?,?,?, 'activo')",
        (db.new_id("prs"), "usr_ana", 90000, 3, 30000, 1, (hoy - datetime.timedelta(days=15)).isoformat()),
    )

    # Caja chica asignada a Ana, con una rendición ya cargada.
    caja_id = db.new_id("caj")
    conn.execute(
        "INSERT INTO cajas_chicas (id, operador_id, tope, saldo_actual) VALUES (?,?,?,?)",
        (caja_id, "usr_ana", 50000, 35000),
    )
    conn.execute(
        "INSERT INTO rendiciones (id, caja_id, fecha, motivo, monto, comprobante) VALUES (?,?,?,?,?,?)",
        (db.new_id("ren"), caja_id, (hoy - datetime.timedelta(days=3)).isoformat(), "Resma de hojas e insumos de oficina", 15000, None),
    )

    # Presentismo de ejemplo: una demora este mes.
    conn.execute(
        "INSERT INTO presentismo (id, operador_id, fecha, tipo, motivo, estado) VALUES (?,?,?,?,?, 'registrado')",
        (db.new_id("pre"), "usr_ana", (hoy - datetime.timedelta(days=6)).isoformat(), "demora", "Llegó 40 minutos tarde"),
    )

    gastos = [
        ("Software e IA", "Suscripciones varias", 45000, 5, "pagado"),
        ("Telefonía", "Movistar", 18000, 12, "pendiente"),
        ("Servidores", "Hosting Netlify + dominio", 22000, 20, "pendiente"),
        ("Marketing", "Diseño de piezas para Instagram", 35000, 45, "pendiente"),
        ("Insumos de oficina", "Librería Ramos Mejía", 12000, 70, "pendiente"),
    ]
    for categoria, proveedor, monto, dias, estado in gastos:
        vencimiento = (hoy + datetime.timedelta(days=dias)).isoformat()
        conn.execute(
            "INSERT INTO gastos_operativos (id, categoria, proveedor, monto, vencimiento, estado, eliminado) VALUES (?,?,?,?,?,?,0)",
            (db.new_id("gas"), categoria, proveedor, monto, vencimiento, estado),
        )

    # Retiro de socio de ejemplo.
    conn.execute(
        "INSERT INTO retiros_socios (id, socio_id, fecha, monto, tipo, nota) VALUES (?,?,?,?,?,?)",
        (db.new_id("ret"), "usr_joaquin", (hoy - datetime.timedelta(days=10)).isoformat(), 200000, "retiro", "Retiro mensual"),
    )

    conn.commit()
    conn.close()
    print(f"Seed cargado. Usuarios demo (contraseña para todos: {DEMO_PASSWORD}):")
    for _, nombre, email, rol, *_ in usuarios:
        print(f"  {email}  ({rol}) — {nombre}")


if __name__ == "__main__":
    run()
