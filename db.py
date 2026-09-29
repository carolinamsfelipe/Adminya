"""AdminYAAA · Gestión interna — capa de base de datos (SQLite)."""

import sqlite3
import secrets
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "gestion.sqlite3"
UPLOADS_DIR = BASE_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

SCHEMA = """
-- 1. Usuarios internos (Admin = socios, Operador = asistentes)
CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('admin','operador')),
  cargo TEXT,
  sueldo_base INTEGER NOT NULL DEFAULT 0,
  activo INTEGER NOT NULL DEFAULT 1,
  creado TEXT NOT NULL
);

-- Estudios contables aliados (módulo 7)
CREATE TABLE IF NOT EXISTS estudios_contables (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  zona TEXT NOT NULL,
  contador_referente TEXT,
  telefono TEXT,
  mail TEXT,
  activo INTEGER NOT NULL DEFAULT 1
);

-- 2. Clientes y fichas comerciales
CREATE TABLE IF NOT EXISTS clientes (
  id TEXT PRIMARY KEY,
  nombre_comercial TEXT NOT NULL,
  razon_social TEXT,
  cuit TEXT,
  rubro TEXT NOT NULL CHECK (rubro IN ('gastronomia','distribuidora','comercio','servicio','estudio_contable','otro')),
  tipo_contrato TEXT NOT NULL CHECK (tipo_contrato IN ('abono','puntual')),
  monto_abono INTEGER NOT NULL DEFAULT 0,
  direccion TEXT,
  contacto_nombre TEXT,
  contacto_whatsapp TEXT,
  dia_facturacion INTEGER NOT NULL DEFAULT 1,
  estudio_contable_id TEXT REFERENCES estudios_contables(id),
  notas_internas TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  creado TEXT NOT NULL
);

-- Derivaciones entre AdminYAAA y estudios contables aliados
CREATE TABLE IF NOT EXISTS derivaciones (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL REFERENCES clientes(id),
  estudio_id TEXT NOT NULL REFERENCES estudios_contables(id),
  direccion TEXT NOT NULL CHECK (direccion IN ('hacia_estudio','desde_estudio')),
  fecha TEXT NOT NULL,
  nota TEXT
);

-- 3. Registro de tareas / trabajos ejecutados
CREATE TABLE IF NOT EXISTS tareas (
  id TEXT PRIMARY KEY,
  fecha TEXT NOT NULL,
  cliente_id TEXT NOT NULL REFERENCES clientes(id),
  operador_id TEXT NOT NULL REFERENCES usuarios(id),
  descripcion TEXT NOT NULL,
  horas REAL NOT NULL DEFAULT 0,
  precio INTEGER NOT NULL DEFAULT 0,
  modalidad TEXT NOT NULL CHECK (modalidad IN ('abono','puntual')),
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','realizado','facturado','cobrado')),
  eliminado INTEGER NOT NULL DEFAULT 0
);

-- 4. Planilla gastronómica (cajas y márgenes por turno)
CREATE TABLE IF NOT EXISTS planillas_turno (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL REFERENCES clientes(id),
  fecha TEXT NOT NULL,
  ventas_tarde INTEGER NOT NULL DEFAULT 0,
  ventas_noche INTEGER NOT NULL DEFAULT 0,
  gastos_dia INTEGER NOT NULL DEFAULT 0,
  objetivo_mensual INTEGER NOT NULL DEFAULT 0,
  nota TEXT
);

-- 5. Stock y presupuestador digital
CREATE TABLE IF NOT EXISTS stock_items (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL REFERENCES clientes(id),
  codigo TEXT,
  descripcion TEXT NOT NULL,
  unidad TEXT NOT NULL DEFAULT 'un',
  precio_unitario INTEGER NOT NULL DEFAULT 0,
  cantidad INTEGER NOT NULL DEFAULT 0,
  minimo INTEGER NOT NULL DEFAULT 0,
  eliminado INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS presupuestos (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL REFERENCES clientes(id),
  fecha TEXT NOT NULL,
  items TEXT NOT NULL DEFAULT '[]',
  subtotal INTEGER NOT NULL DEFAULT 0,
  iva INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aprobado','rechazado')),
  eliminado INTEGER NOT NULL DEFAULT 0
);

-- 6. Cuentas corrientes (libro mayor) y tesorería
CREATE TABLE IF NOT EXISTS cuentas_dinero (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('banco','mercadopago','efectivo','caja_chica')),
  saldo INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS movimientos_cc (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL REFERENCES clientes(id),
  fecha TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('debito','credito')),
  monto INTEGER NOT NULL,
  concepto TEXT NOT NULL,
  cuenta_id TEXT REFERENCES cuentas_dinero(id),
  comprobante TEXT,
  referencia_tarea_id TEXT REFERENCES tareas(id),
  saldo_pendiente INTEGER NOT NULL DEFAULT 0
);

-- 8. Sueldos, adicionales y préstamos al personal
CREATE TABLE IF NOT EXISTS liquidaciones (
  id TEXT PRIMARY KEY,
  operador_id TEXT NOT NULL REFERENCES usuarios(id),
  periodo TEXT NOT NULL,
  sueldo_base INTEGER NOT NULL DEFAULT 0,
  adicionales INTEGER NOT NULL DEFAULT 0,
  descuentos_ausencias INTEGER NOT NULL DEFAULT 0,
  descuentos_prestamo INTEGER NOT NULL DEFAULT 0,
  neto INTEGER NOT NULL DEFAULT 0,
  fecha TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','pagado'))
);

CREATE TABLE IF NOT EXISTS prestamos (
  id TEXT PRIMARY KEY,
  operador_id TEXT NOT NULL REFERENCES usuarios(id),
  monto_total INTEGER NOT NULL,
  cuotas INTEGER NOT NULL,
  valor_cuota INTEGER NOT NULL,
  cuotas_pagadas INTEGER NOT NULL DEFAULT 0,
  fecha TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','saldado'))
);

-- 9. Fondos y cajas chicas por operador
CREATE TABLE IF NOT EXISTS cajas_chicas (
  id TEXT PRIMARY KEY,
  operador_id TEXT NOT NULL REFERENCES usuarios(id),
  tope INTEGER NOT NULL DEFAULT 0,
  saldo_actual INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rendiciones (
  id TEXT PRIMARY KEY,
  caja_id TEXT NOT NULL REFERENCES cajas_chicas(id),
  fecha TEXT NOT NULL,
  motivo TEXT NOT NULL,
  monto INTEGER NOT NULL,
  comprobante TEXT
);

-- 10. Presentismo
CREATE TABLE IF NOT EXISTS presentismo (
  id TEXT PRIMARY KEY,
  operador_id TEXT NOT NULL REFERENCES usuarios(id),
  fecha TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('falta','demora')),
  motivo TEXT,
  estado TEXT NOT NULL DEFAULT 'registrado'
);

-- 11. Gastos operativos del negocio
CREATE TABLE IF NOT EXISTS gastos_operativos (
  id TEXT PRIMARY KEY,
  categoria TEXT NOT NULL,
  proveedor TEXT,
  monto INTEGER NOT NULL,
  vencimiento TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','pagado')),
  eliminado INTEGER NOT NULL DEFAULT 0
);

-- 12. Finanzas de socios (solo admin)
CREATE TABLE IF NOT EXISTS retiros_socios (
  id TEXT PRIMARY KEY,
  socio_id TEXT NOT NULL REFERENCES usuarios(id),
  fecha TEXT NOT NULL,
  monto INTEGER NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('retiro','gasto_personal')),
  nota TEXT
);

-- 16. Configuración general del sistema
CREATE TABLE IF NOT EXISTS config (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

-- Auditoría / actividad
CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  fecha TEXT NOT NULL,
  usuario_id TEXT REFERENCES usuarios(id),
  texto TEXT NOT NULL
);
"""


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_connection()
    conn.executescript(SCHEMA)
    conn.commit()
    conn.close()


def new_id(prefix):
    return f"{prefix}_{secrets.token_hex(4)}"
