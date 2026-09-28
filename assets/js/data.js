/* AdminYAAA · Panel — datos de demostración + capa de persistencia (localStorage). */

const AY_STORAGE_KEY = 'ay_demo_state_v1';
const AY_SESSION_KEY = 'ay_demo_session_v1';

function ayUid(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 9);
}

function ayToday(offsetDays) {
  const d = new Date('2026-09-27T09:00:00');
  d.setDate(d.getDate() + (offsetDays || 0));
  return d.toISOString().slice(0, 10);
}

function ayFormatDate(iso) {
  const [y, m, d] = iso.split('-');
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const base = `${parseInt(d, 10)} ${meses[parseInt(m, 10) - 1]}`;
  return y === '2026' ? base : `${base} ${y}`;
}

function ayFormatMoney(n) {
  return '$ ' + Math.round(n).toLocaleString('es-AR');
}

function ayRelativeLabel(iso) {
  const diff = Math.round((new Date(iso) - new Date(ayToday(0))) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === -1) return 'Ayer';
  if (diff > 0) return `En ${diff} días`;
  return `Hace ${Math.abs(diff)} días`;
}

/* ---------------------------------------------------------------------
   Semilla de datos
   --------------------------------------------------------------------- */
function ayBuildSeed() {
  const empresas = {
    'distribuidora-maximo': {
      id: 'distribuidora-maximo',
      nombre: 'Distribuidora Máximo',
      rubro: 'Distribución mayorista de almacén',
      contacto: 'Máximo Fernández',
      email: 'maximo@distribuidoramaximo.com.ar',
      telefono: '11 4455-2210',
      desde: '2023-03-01',
      responsable: 'Joaquín Ibáñez',
      plan: 'Gestión integral',
      modulos: ['presupuestos', 'stock', 'cuentas-corrientes'],
      atencion: false,
      kpis: { ventas: 4820000, ventasVar: 6.4, margen: 22, margenVar: -1.2, stockPct: 68, tareasPendientes: 3 },
    },
    'parrilla-encuentro': {
      id: 'parrilla-encuentro',
      nombre: 'Parrilla El Encuentro',
      rubro: 'Gastronomía · Restaurante',
      contacto: 'Rosana Gómez',
      email: 'rosana@parrillaelencuentro.com.ar',
      telefono: '11 5566-3321',
      desde: '2024-01-15',
      responsable: 'Carolina Suárez',
      plan: 'Administración + Reportes',
      modulos: [],
      atencion: true,
      motivoAtencion: 'Ventas bajaron 3,8% y tiene una solicitud de pago sin resolver.',
      kpis: { ventas: 3190000, ventasVar: -3.8, margen: 31, margenVar: 2.1, stockPct: null, tareasPendientes: 1 },
    },
    'ferreteria-ortiz': {
      id: 'ferreteria-ortiz',
      nombre: 'Ferretería Ortiz',
      rubro: 'Comercio minorista',
      contacto: 'Diego Ortiz',
      email: 'diego@ferreteriaortiz.com.ar',
      telefono: '11 3344-9087',
      desde: '2024-06-10',
      responsable: 'Joaquín Ibáñez',
      plan: 'Gestión integral',
      modulos: ['stock', 'cuentas-corrientes'],
      atencion: true,
      motivoAtencion: 'Stock de materiales clave por debajo del mínimo antes de octubre.',
      kpis: { ventas: 2150000, ventasVar: 1.1, margen: 27, margenVar: 0.4, stockPct: 41, tareasPendientes: 2 },
    },
    'estudio-valle': {
      id: 'estudio-valle',
      nombre: 'Estudio Contable Valle',
      rubro: 'Servicios profesionales',
      contacto: 'Lucía Valle',
      email: 'lucia@estudiovalle.com.ar',
      telefono: '11 2233-7765',
      desde: '2022-11-02',
      responsable: 'Carolina Suárez',
      plan: 'Reportes + Solicitudes',
      modulos: [],
      atencion: false,
      kpis: { ventas: 1580000, ventasVar: 4.0, margen: 45, margenVar: 0.8, stockPct: null, tareasPendientes: 0 },
    },
    'kiosco-don-pepe': {
      id: 'kiosco-don-pepe',
      nombre: 'Kiosco Don Pepe',
      rubro: 'Comercio minorista',
      contacto: 'José Ramírez',
      email: 'jose@kioscodonpepe.com.ar',
      telefono: '11 6677-1102',
      desde: '2025-02-20',
      responsable: 'Joaquín Ibáñez',
      plan: 'Administración',
      modulos: ['stock'],
      atencion: false,
      kpis: { ventas: 980000, ventasVar: 2.6, margen: 19, margenVar: -0.5, stockPct: 55, tareasPendientes: 1 },
    },
  };

  const users = [
    { id: 'maximo', role: 'client', empresaId: 'distribuidora-maximo', nombre: 'Máximo Fernández', iniciales: 'MF', email: 'maximo@distribuidoramaximo.com.ar' },
    { id: 'rosana', role: 'client', empresaId: 'parrilla-encuentro', nombre: 'Rosana Gómez', iniciales: 'RG', email: 'rosana@parrillaelencuentro.com.ar' },
    { id: 'joaquin', role: 'employee', nombre: 'Joaquín Ibáñez', iniciales: 'JI', email: 'joaquin@adminyaaa.com.ar', cargo: 'Administrador de cuentas' },
    { id: 'carolina', role: 'employee', nombre: 'Carolina Suárez', iniciales: 'CS', email: 'carolina@adminyaaa.com.ar', cargo: 'Administradora de cuentas' },
  ];

  const requests = [
    { id: ayUid('sol'), empresaId: 'distribuidora-maximo', titulo: 'Presupuesto para ampliar depósito', tipo: 'Presupuesto', responsable: 'Joaquín Ibáñez', estado: 'proceso', prioridad: 'media', fecha: ayToday(-2), descripcion: 'Necesitamos un presupuesto para evaluar el alquiler de un depósito adicional en Ciudadela.' },
    { id: ayUid('sol'), empresaId: 'distribuidora-maximo', titulo: 'Revisión de cuenta corriente — Kiosco Sur', tipo: 'Cuenta corriente', responsable: 'Joaquín Ibáñez', estado: 'esperando_info', prioridad: 'alta', fecha: ayToday(-5), descripcion: 'El cliente Kiosco Sur tiene un saldo que no coincide con lo facturado. Pedimos el detalle de movimientos de agosto para revisar.' },
    { id: ayUid('sol'), empresaId: 'distribuidora-maximo', titulo: 'Alta de nuevo proveedor', tipo: 'Administración', responsable: 'Joaquín Ibáñez', estado: 'terminado', prioridad: 'baja', fecha: ayToday(-10), descripcion: 'Cargar a "Envases del Oeste" como proveedor habitual.' },
    { id: ayUid('sol'), empresaId: 'parrilla-encuentro', titulo: 'Informe de rentabilidad por plato', tipo: 'Reporte', responsable: 'Carolina Suárez', estado: 'nuevo', prioridad: 'media', fecha: ayToday(-1), descripcion: 'Necesitamos saber qué platos del menú dejan más margen antes de actualizar precios.' },
    { id: ayUid('sol'), empresaId: 'parrilla-encuentro', titulo: 'Pago a proveedor de carnes', tipo: 'Pago', responsable: 'Carolina Suárez', estado: 'proceso', prioridad: 'alta', fecha: ayToday(-3), descripcion: 'Coordinar el pago pendiente con Frigorífico Sur antes del viernes.' },
    { id: ayUid('sol'), empresaId: 'ferreteria-ortiz', titulo: 'Actualización de precios por inflación', tipo: 'Stock', responsable: 'Joaquín Ibáñez', estado: 'nuevo', prioridad: 'media', fecha: ayToday(-1), descripcion: 'Actualizar lista de precios según el último aumento de proveedores.' },
    { id: ayUid('sol'), empresaId: 'ferreteria-ortiz', titulo: 'Presupuesto obra Barrio Norte', tipo: 'Presupuesto', responsable: 'Joaquín Ibáñez', estado: 'terminado', prioridad: 'baja', fecha: ayToday(-12), descripcion: 'Presupuesto de materiales para la obra del Barrio Norte.' },
    { id: ayUid('sol'), empresaId: 'estudio-valle', titulo: 'Informe mensual de honorarios', tipo: 'Reporte', responsable: 'Carolina Suárez', estado: 'terminado', prioridad: 'baja', fecha: ayToday(-8), descripcion: 'Informe de honorarios facturados durante agosto.' },
    { id: ayUid('sol'), empresaId: 'kiosco-don-pepe', titulo: 'Solicitud de crédito a proveedor', tipo: 'Administración', responsable: 'Joaquín Ibáñez', estado: 'terminado', prioridad: 'media', fecha: ayToday(-6), descripcion: 'El proveedor no otorgó el crédito solicitado; buscamos una alternativa con otro proveedor.' },
  ];

  const documents = [
    { id: ayUid('doc'), empresaId: 'distribuidora-maximo', nombre: 'Balance agosto 2026.pdf', categoria: 'Balances', fecha: ayToday(-3), tamano: '1.2 MB', estado: 'disponible', subidoPor: 'Joaquín Ibáñez' },
    { id: ayUid('doc'), empresaId: 'distribuidora-maximo', nombre: 'Factura A-0004-00231.pdf', categoria: 'Facturación', fecha: ayToday(-1), tamano: '210 KB', estado: 'disponible', subidoPor: 'AdminYAAA' },
    { id: ayUid('doc'), empresaId: 'distribuidora-maximo', nombre: 'Contrato depósito (borrador).docx', categoria: 'Contratos', fecha: ayToday(-2), tamano: '88 KB', estado: 'revision', subidoPor: 'Máximo Fernández' },
    { id: ayUid('doc'), empresaId: 'distribuidora-maximo', nombre: 'Listado de stock — septiembre.xlsx', categoria: 'Stock', fecha: ayToday(0), tamano: '340 KB', estado: 'disponible', subidoPor: 'Joaquín Ibáñez' },
    { id: ayUid('doc'), empresaId: 'parrilla-encuentro', nombre: 'Ventas por turno — agosto.xlsx', categoria: 'Reportes', fecha: ayToday(-4), tamano: '150 KB', estado: 'disponible', subidoPor: 'Carolina Suárez' },
    { id: ayUid('doc'), empresaId: 'parrilla-encuentro', nombre: 'Factura proveedor carnes.pdf', categoria: 'Facturación', fecha: ayToday(-2), tamano: '96 KB', estado: 'revision', subidoPor: 'Rosana Gómez' },
    { id: ayUid('doc'), empresaId: 'ferreteria-ortiz', nombre: 'Lista de precios septiembre.pdf', categoria: 'Stock', fecha: ayToday(-1), tamano: '410 KB', estado: 'disponible', subidoPor: 'Joaquín Ibáñez' },
    { id: ayUid('doc'), empresaId: 'estudio-valle', nombre: 'Balance trimestral.pdf', categoria: 'Balances', fecha: ayToday(-9), tamano: '980 KB', estado: 'disponible', subidoPor: 'Carolina Suárez' },
  ];

  const reports = [
    {
      id: ayUid('rep'), empresaId: 'distribuidora-maximo', titulo: 'Informe semanal — 21 al 27 de septiembre', tipo: 'Semanal', fecha: ayToday(0),
      resumen: 'Las ventas subieron 6,4% respecto a la semana anterior, impulsadas por dos pedidos grandes de almacenes de Ramos Mejía. El margen bajó levemente por el aumento de flete.',
      metrics: [
        { label: 'Ventas', value: ayFormatMoney(4820000) },
        { label: 'Margen', value: '22%' },
        { label: 'Pedidos', value: '134' },
        { label: 'Ticket prom.', value: ayFormatMoney(35970) },
      ],
    },
    {
      id: ayUid('rep'), empresaId: 'distribuidora-maximo', titulo: 'Informe semanal — 14 al 20 de septiembre', tipo: 'Semanal', fecha: ayToday(-7),
      resumen: 'Semana estable. Se detectó un faltante de stock en 3 productos de alta rotación; ya se generó el pedido a proveedor.',
      metrics: [
        { label: 'Ventas', value: ayFormatMoney(4530000) },
        { label: 'Margen', value: '23.2%' },
        { label: 'Pedidos', value: '121' },
        { label: 'Ticket prom.', value: ayFormatMoney(37440) },
      ],
    },
    {
      id: ayUid('rep'), empresaId: 'parrilla-encuentro', titulo: 'Informe semanal — 21 al 27 de septiembre', tipo: 'Semanal', fecha: ayToday(-1),
      resumen: 'Las ventas de fin de semana bajaron por el clima. El margen mejoró gracias a la renegociación con el proveedor de bebidas.',
      metrics: [
        { label: 'Ventas', value: ayFormatMoney(3190000) },
        { label: 'Margen', value: '31%' },
        { label: 'Cubiertos', value: '1.840' },
        { label: 'Ticket prom.', value: ayFormatMoney(1734) },
      ],
    },
    {
      id: ayUid('rep'), empresaId: 'ferreteria-ortiz', titulo: 'Informe mensual — agosto 2026', tipo: 'Mensual', fecha: ayToday(-15),
      resumen: 'Buen mes por la temporada de obras. Se recomienda reforzar stock de cemento e hidrófugo para octubre.',
      metrics: [
        { label: 'Ventas', value: ayFormatMoney(2150000) },
        { label: 'Margen', value: '27%' },
        { label: 'Clientes nuevos', value: '14' },
      ],
    },
    {
      id: ayUid('rep'), empresaId: 'distribuidora-maximo', titulo: 'Informe de mercado — almacenes de Zona Oeste', tipo: 'Mercado', fecha: ayToday(-6),
      resumen: 'Relevamos precios de 8 distribuidoras competidoras en la zona. Tenés margen para subir precio en yerba y aceite sin perder competitividad; el arroz está por encima del promedio de la zona.',
      metrics: [
        { label: 'Competidores relevados', value: '8' },
        { label: 'Productos por debajo del precio de mercado', value: '2' },
        { label: 'Productos por encima', value: '1' },
      ],
    },
  ];

  const tasks = [
    { id: ayUid('tar'), empresaId: 'distribuidora-maximo', titulo: 'Cargar balance de agosto al panel del cliente', responsable: 'Joaquín Ibáñez', estado: 'finalizado', prioridad: 'media', vencimiento: ayToday(-2) },
    { id: ayUid('tar'), empresaId: 'distribuidora-maximo', titulo: 'Confirmar presupuesto de depósito con el cliente', responsable: 'Joaquín Ibáñez', estado: 'proceso', prioridad: 'alta', vencimiento: ayToday(1) },
    { id: ayUid('tar'), empresaId: 'ferreteria-ortiz', titulo: 'Actualizar lista de precios en el sistema', responsable: 'Joaquín Ibáñez', estado: 'demora', prioridad: 'alta', vencimiento: ayToday(0) },
    { id: ayUid('tar'), empresaId: 'parrilla-encuentro', titulo: 'Armar informe de rentabilidad por plato', responsable: 'Carolina Suárez', estado: 'proceso', prioridad: 'media', vencimiento: ayToday(2) },
    { id: ayUid('tar'), empresaId: 'kiosco-don-pepe', titulo: 'Buscar alternativa de crédito con otro proveedor', responsable: 'Joaquín Ibáñez', estado: 'no_cumplido', prioridad: 'media', vencimiento: ayToday(3) },
    { id: ayUid('tar'), empresaId: null, titulo: 'Preparar reunión mensual de equipo', responsable: 'Carolina Suárez', estado: 'proceso', prioridad: 'baja', vencimiento: ayToday(4) },
    { id: ayUid('tar'), empresaId: 'estudio-valle', titulo: 'Enviar informe trimestral al cliente', responsable: 'Carolina Suárez', estado: 'finalizado', prioridad: 'baja', vencimiento: ayToday(-5) },
  ];

  const activity = [
    { id: ayUid('act'), empresaId: 'distribuidora-maximo', fecha: ayToday(0), texto: 'Se actualizó el listado de stock', tipo: 'stock' },
    { id: ayUid('act'), empresaId: 'distribuidora-maximo', fecha: ayToday(-1), texto: 'Nueva factura cargada: A-0004-00231', tipo: 'documento' },
    { id: ayUid('act'), empresaId: 'distribuidora-maximo', fecha: ayToday(-2), texto: 'Solicitud enviada: presupuesto para ampliar depósito', tipo: 'solicitud' },
    { id: ayUid('act'), empresaId: 'distribuidora-maximo', fecha: ayToday(-3), texto: 'Informe semanal disponible', tipo: 'reporte' },
    { id: ayUid('act'), empresaId: 'distribuidora-maximo', fecha: ayToday(-5), texto: 'Solicitud enviada: revisión de cuenta corriente', tipo: 'solicitud' },
    { id: ayUid('act'), empresaId: 'parrilla-encuentro', fecha: ayToday(-1), texto: 'Informe semanal disponible', tipo: 'reporte' },
    { id: ayUid('act'), empresaId: 'parrilla-encuentro', fecha: ayToday(-2), texto: 'Documento cargado: factura de proveedor de carnes', tipo: 'documento' },
    { id: ayUid('act'), empresaId: 'parrilla-encuentro', fecha: ayToday(-3), texto: 'Solicitud enviada: pago a proveedor de carnes', tipo: 'solicitud' },
    { id: ayUid('act'), empresaId: 'ferreteria-ortiz', fecha: ayToday(-1), texto: 'Lista de precios actualizada', tipo: 'stock' },
    { id: ayUid('act'), empresaId: 'ferreteria-ortiz', fecha: ayToday(-12), texto: 'Presupuesto completado: obra Barrio Norte', tipo: 'solicitud' },
    { id: ayUid('act'), empresaId: 'estudio-valle', fecha: ayToday(-8), texto: 'Informe de honorarios enviado', tipo: 'reporte' },
    { id: ayUid('act'), empresaId: 'kiosco-don-pepe', fecha: ayToday(-6), texto: 'Solicitud de crédito rechazada por el proveedor', tipo: 'solicitud' },
  ];

  const notes = [
    { id: ayUid('nota'), empresaId: 'parrilla-encuentro', autor: 'Carolina Suárez', fecha: ayToday(-2), texto: 'La clienta está sensible con los costos de carne; conviene mostrarle el informe de rentabilidad apenas esté listo, antes de tocar precios del menú.' },
    { id: ayUid('nota'), empresaId: 'ferreteria-ortiz', autor: 'Joaquín Ibáñez', fecha: ayToday(-3), texto: 'Pidió que lo llamemos en vez de escribirle por WhatsApp para temas de precios, prefiere hablarlo por teléfono.' },
    { id: ayUid('nota'), empresaId: 'distribuidora-maximo', autor: 'Joaquín Ibáñez', fecha: ayToday(-6), texto: 'Está evaluando sumar un segundo depósito. Buen momento para ofrecerle el módulo de cuentas corrientes ampliado.' },
    { id: ayUid('nota'), empresaId: 'kiosco-don-pepe', autor: 'Joaquín Ibáñez', fecha: ayToday(-6), texto: 'No aceptó el crédito con el proveedor actual. Buscar otra opción antes de fin de mes.' },
  ];

  const stock = {
    'distribuidora-maximo': [
      { producto: 'Aceite de girasol 900ml (caja x15)', cantidad: 42, minimo: 20, unidad: 'cajas' },
      { producto: 'Arroz largo fino 1kg (caja x10)', cantidad: 12, minimo: 15, unidad: 'cajas' },
      { producto: 'Yerba mate 1kg (caja x10)', cantidad: 58, minimo: 25, unidad: 'cajas' },
      { producto: 'Fideos secos 500g (caja x20)', cantidad: 9, minimo: 18, unidad: 'cajas' },
      { producto: 'Azúcar 1kg (caja x10)', cantidad: 33, minimo: 20, unidad: 'cajas' },
    ],
    'ferreteria-ortiz': [
      { producto: 'Cemento Portland (bolsa 50kg)', cantidad: 18, minimo: 40, unidad: 'bolsas' },
      { producto: 'Hidrófugo (balde 20L)', cantidad: 6, minimo: 15, unidad: 'baldes' },
      { producto: 'Clavos punta París 2"', cantidad: 120, minimo: 50, unidad: 'kg' },
      { producto: 'Pintura látex interior 20L', cantidad: 22, minimo: 10, unidad: 'baldes' },
    ],
    'kiosco-don-pepe': [
      { producto: 'Gaseosas línea cola 2.25L', cantidad: 40, minimo: 24, unidad: 'unidades' },
      { producto: 'Golosinas surtidas (display)', cantidad: 5, minimo: 10, unidad: 'displays' },
      { producto: 'Cigarrillos (cartón)', cantidad: 15, minimo: 8, unidad: 'cartones' },
    ],
  };

  const budgets = {
    'distribuidora-maximo': [
      { id: ayUid('pre'), cliente: 'Almacén Rivadavia', monto: 890000, estado: 'aprobado', fecha: ayToday(-4) },
      { id: ayUid('pre'), cliente: 'Kiosco Sur', monto: 340000, estado: 'pendiente', fecha: ayToday(-2) },
      { id: ayUid('pre'), cliente: 'Autoservicio Belgrano', monto: 1250000, estado: 'proceso', fecha: ayToday(-1) },
      { id: ayUid('pre'), cliente: 'Despensa Norte', monto: 210000, estado: 'rechazada', fecha: ayToday(-9) },
    ],
  };

  const accounts = {
    'distribuidora-maximo': [
      { id: ayUid('cta'), cliente: 'Almacén Rivadavia', saldo: 420000, estado: 'al_dia', ultimoMovimiento: ayToday(-2) },
      { id: ayUid('cta'), cliente: 'Kiosco Sur', saldo: 890000, estado: 'vencido', ultimoMovimiento: ayToday(-18) },
      { id: ayUid('cta'), cliente: 'Autoservicio Belgrano', saldo: 0, estado: 'al_dia', ultimoMovimiento: ayToday(-5) },
      { id: ayUid('cta'), cliente: 'Despensa Norte', saldo: 156000, estado: 'al_dia', ultimoMovimiento: ayToday(-3) },
    ],
    'ferreteria-ortiz': [
      { id: ayUid('cta'), cliente: 'Constructora Medina', saldo: 640000, estado: 'al_dia', ultimoMovimiento: ayToday(-6) },
      { id: ayUid('cta'), cliente: 'Obra Barrio Norte', saldo: 980000, estado: 'vencido', ultimoMovimiento: ayToday(-22) },
    ],
  };

  return { empresas, users, requests, documents, reports, tasks, activity, notes, stock, budgets, accounts };
}

/* ---------------------------------------------------------------------
   Persistencia
   --------------------------------------------------------------------- */
const AyData = {
  state: null,

  load() {
    if (this.state) return this.state;
    try {
      const raw = localStorage.getItem(AY_STORAGE_KEY);
      if (raw) {
        this.state = JSON.parse(raw);
        return this.state;
      }
    } catch (e) { /* ignora estado corrupto y reinicia */ }
    this.state = ayBuildSeed();
    this.save();
    return this.state;
  },

  save() {
    try { localStorage.setItem(AY_STORAGE_KEY, JSON.stringify(this.state)); } catch (e) { /* localStorage no disponible */ }
  },

  reset() {
    this.state = ayBuildSeed();
    this.save();
  },

  getUsers() { return this.load().users; },
  getUser(id) { return this.load().users.find(u => u.id === id); },
  getEmpresa(id) { return this.load().empresas[id]; },
  getEmpresas() { return Object.values(this.load().empresas); },

  getRequests(empresaId) {
    const all = this.load().requests;
    return empresaId ? all.filter(r => r.empresaId === empresaId) : all;
  },
  addRequest(req) {
    const s = this.load();
    const item = Object.assign({ id: ayUid('sol'), estado: 'nuevo', fecha: ayToday(0) }, req);
    s.requests.unshift(item);
    this.logActivity(req.empresaId, `Nueva solicitud: ${req.titulo}`, 'solicitud');
    this.save();
    return item;
  },
  updateRequestStatus(id, estado) {
    const s = this.load();
    const r = s.requests.find(x => x.id === id);
    if (!r) return;
    r.estado = estado;
    this.logActivity(r.empresaId, `Solicitud "${r.titulo}" pasó a estado: ${AyLabels.estado(estado)}`, 'solicitud');
    this.save();
  },

  getDocuments(empresaId) {
    const all = this.load().documents;
    return empresaId ? all.filter(d => d.empresaId === empresaId) : all;
  },
  addDocument(doc) {
    const s = this.load();
    const item = Object.assign({ id: ayUid('doc'), fecha: ayToday(0), estado: 'disponible' }, doc);
    s.documents.unshift(item);
    this.logActivity(doc.empresaId, `Documento cargado: ${doc.nombre}`, 'documento');
    this.save();
    return item;
  },

  getReports(empresaId) {
    const all = this.load().reports;
    return empresaId ? all.filter(r => r.empresaId === empresaId) : all;
  },
  addReport(rep) {
    const s = this.load();
    const item = Object.assign({ id: ayUid('rep'), fecha: ayToday(0) }, rep);
    s.reports.unshift(item);
    this.logActivity(rep.empresaId, `Informe generado: ${rep.titulo}`, 'reporte');
    this.save();
    return item;
  },

  getTasks(empresaId) {
    const all = this.load().tasks;
    return empresaId === undefined ? all : all.filter(t => t.empresaId === empresaId);
  },
  addTask(task) {
    const s = this.load();
    const item = Object.assign({ id: ayUid('tar'), estado: 'proceso' }, task);
    s.tasks.unshift(item);
    this.save();
    return item;
  },
  updateTaskStatus(id, estado) {
    const s = this.load();
    const t = s.tasks.find(x => x.id === id);
    if (!t) return;
    t.estado = estado;
    this.save();
  },

  getActivity(empresaId) {
    const all = this.load().activity;
    const list = empresaId ? all.filter(a => a.empresaId === empresaId) : all;
    return list.slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
  },
  logActivity(empresaId, texto, tipo) {
    const s = this.load();
    s.activity.unshift({ id: ayUid('act'), empresaId, fecha: ayToday(0), texto, tipo: tipo || 'general' });
  },

  getNotes(empresaId) {
    const all = this.load().notes;
    const list = empresaId ? all.filter(n => n.empresaId === empresaId) : all;
    return list.slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
  },
  addNote(note) {
    const s = this.load();
    const item = Object.assign({ id: ayUid('nota'), fecha: ayToday(0) }, note);
    s.notes.unshift(item);
    this.save();
    return item;
  },

  getStock(empresaId) { return this.load().stock[empresaId] || []; },
  getBudgets(empresaId) { return this.load().budgets[empresaId] || []; },
  getAccounts(empresaId) { return this.load().accounts[empresaId] || []; },

  addUser(user) {
    const s = this.load();
    const item = Object.assign({ id: ayUid('user'), activo: true }, user);
    s.users.push(item);
    this.save();
    return item;
  },
  updateUser(id, patch) {
    const s = this.load();
    const u = s.users.find(x => x.id === id);
    if (!u) return;
    Object.assign(u, patch);
    this.save();
  },

  /* Sesión activa (quién está "logueado" en la demo) */
  getSession() {
    try { return JSON.parse(localStorage.getItem(AY_SESSION_KEY)); } catch (e) { return null; }
  },
  setSession(userId) {
    localStorage.setItem(AY_SESSION_KEY, JSON.stringify({ userId }));
  },
  clearSession() {
    localStorage.removeItem(AY_SESSION_KEY);
  },
};

const AyLabels = {
  estado(v) {
    return {
      nuevo: 'Nuevo', proceso: 'En proceso', esperando_info: 'Esperando información', terminado: 'Terminado',
      pendiente: 'Pendiente', revision: 'En revisión', completada: 'Completada', rechazada: 'Rechazada', aprobado: 'Aprobado',
      hecha: 'Hecha', en_curso: 'En curso', finalizado: 'Finalizado', demora: 'Con demora', no_cumplido: 'No cumplido',
      disponible: 'Disponible', activo: 'Activo',
    }[v] || v;
  },
  modulo(v) {
    return { presupuestos: 'Presupuestos', stock: 'Stock', 'cuentas-corrientes': 'Cuentas corrientes' }[v] || v;
  },
  prioridad(v) {
    return { alta: 'Alta', media: 'Media', baja: 'Baja' }[v] || v;
  },
};
