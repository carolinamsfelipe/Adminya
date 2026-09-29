/* Cliente fetch para la API de AdminYAAA · Gestión interna. */
var AyData = (function () {
  var state = {
    user: null, clientes: [], tareas: [], usuarios: [], stock: [], presupuestos: [], planillas: [],
    movimientos: [], cuentas: [], config: {}, metricas: null,
    sueldosBase: {}, liquidaciones: [], prestamos: [], cajas: [], rendiciones: [], presentismo: [],
    gastos: [], retiros: [], usuariosTodos: [], facturacionPendiente: null,
  };

  async function api(path, options) {
    var res = await fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, options));
    if (res.status === 401) {
      window.location.href = '/index.html';
      throw new Error('No autenticado');
    }
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || 'Error de servidor');
    return data;
  }

  async function loadState() {
    var me = await api('/api/me');
    if (!me.user) { window.location.href = '/index.html'; return; }
    state.user = me.user;
    var s = await api('/api/state');
    state.clientes = s.clientes;
    state.tareas = s.tareas;
    state.usuarios = s.usuarios;
    state.stock = s.stock;
    state.presupuestos = s.presupuestos;
    state.planillas = s.planillas;
    state.movimientos = s.movimientos;
    state.cuentas = s.cuentas;
    state.config = s.config || {};
    state.metricas = s.metricas || null;
    state.cajas = s.cajas;
    state.rendiciones = s.rendiciones;
    state.presentismo = s.presentismo;
    state.sueldosBase = s.sueldosBase || {};
    state.liquidaciones = s.liquidaciones || [];
    state.prestamos = s.prestamos || [];
    state.gastos = s.gastos;
    state.retiros = s.retiros || [];
    state.usuariosTodos = s.usuariosTodos || [];
    state.facturacionPendiente = s.facturacionPendiente || null;
    return state;
  }

  async function logout() {
    await api('/api/logout', { method: 'POST' });
    window.location.href = '/index.html';
  }

  async function addCliente(payload) {
    var r = await api('/api/clientes', { method: 'POST', body: JSON.stringify(payload) });
    state.clientes.push(r.cliente);
    return r.cliente;
  }

  async function updateCliente(id, payload) {
    var r = await api('/api/clientes/' + id, { method: 'PUT', body: JSON.stringify(payload) });
    var idx = state.clientes.findIndex(function (c) { return c.id === id; });
    if (idx >= 0) state.clientes[idx] = r.cliente;
    return r.cliente;
  }

  async function deleteCliente(id) {
    await api('/api/clientes/' + id, { method: 'DELETE' });
    state.clientes = state.clientes.filter(function (c) { return c.id !== id; });
  }

  async function addTarea(payload) {
    var r = await api('/api/tareas', { method: 'POST', body: JSON.stringify(payload) });
    state.tareas.unshift(r.tarea);
    return r.tarea;
  }

  async function updateTareaEstado(id, estado) {
    var r = await api('/api/tareas/' + id, { method: 'PUT', body: JSON.stringify({ estado: estado }) });
    var idx = state.tareas.findIndex(function (t) { return t.id === id; });
    if (idx >= 0) state.tareas[idx] = r.tarea;
    return r.tarea;
  }

  async function addStock(payload) {
    var r = await api('/api/stock', { method: 'POST', body: JSON.stringify(payload) });
    state.stock.push(r.item);
    return r.item;
  }

  async function updateStock(id, payload) {
    var r = await api('/api/stock/' + id, { method: 'PUT', body: JSON.stringify(payload) });
    var idx = state.stock.findIndex(function (i) { return i.id === id; });
    if (idx >= 0) state.stock[idx] = r.item;
    return r.item;
  }

  async function deleteStock(id) {
    await api('/api/stock/' + id, { method: 'DELETE' });
    state.stock = state.stock.filter(function (i) { return i.id !== id; });
  }

  function ajustarStockLocal(items, signo) {
    items.forEach(function (it) {
      if (!it.stockItemId) return;
      var stockItem = state.stock.find(function (s) { return s.id === it.stockItemId; });
      if (stockItem) stockItem.cantidad += signo * it.cantidad;
    });
  }

  async function addPresupuesto(payload) {
    var r = await api('/api/presupuestos', { method: 'POST', body: JSON.stringify(payload) });
    state.presupuestos.unshift(r.presupuesto);
    ajustarStockLocal(r.presupuesto.items, -1);
    return r.presupuesto;
  }

  async function updatePresupuestoEstado(id, estado) {
    var anterior = state.presupuestos.find(function (p) { return p.id === id; });
    var eraRechazado = anterior && anterior.estado === 'rechazado';
    var r = await api('/api/presupuestos/' + id, { method: 'PUT', body: JSON.stringify({ estado: estado }) });
    var idx = state.presupuestos.findIndex(function (p) { return p.id === id; });
    if (idx >= 0) state.presupuestos[idx] = r.presupuesto;
    if (estado === 'rechazado' && !eraRechazado) ajustarStockLocal(r.presupuesto.items, 1);
    return r.presupuesto;
  }

  async function guardarPlanilla(payload) {
    var r = await api('/api/planillas', { method: 'POST', body: JSON.stringify(payload) });
    var idx = state.planillas.findIndex(function (p) { return p.id === r.planilla.id; });
    if (idx >= 0) state.planillas[idx] = r.planilla;
    else state.planillas.unshift(r.planilla);
    return r.planilla;
  }

  async function registrarPago(payload) {
    var r = await api('/api/movimientos', { method: 'POST', body: JSON.stringify(payload) });
    state.movimientos = state.movimientos.filter(function (m) { return m.clienteId !== payload.clienteId; }).concat(r.movimientos);
    if (payload.cuentaId) {
      var cuenta = state.cuentas.find(function (c) { return c.id === payload.cuentaId; });
      if (cuenta) cuenta.saldo += parseInt(payload.monto) || 0;
    }
    return r.movimientos;
  }

  async function guardarConfig(payload) {
    var r = await api('/api/config', { method: 'POST', body: JSON.stringify(payload) });
    state.config = r.config;
    return r.config;
  }

  async function addPrestamo(payload) {
    var r = await api('/api/prestamos', { method: 'POST', body: JSON.stringify(payload) });
    state.prestamos.unshift(r.prestamo);
    return r.prestamo;
  }

  async function addLiquidacion(payload) {
    var r = await api('/api/liquidaciones', { method: 'POST', body: JSON.stringify(payload) });
    state.liquidaciones.unshift(r.liquidacion);
    state.prestamos = r.prestamos;
    return r.liquidacion;
  }

  async function marcarLiquidacionPagada(id) {
    var r = await api('/api/liquidaciones/' + id, { method: 'PUT', body: JSON.stringify({ estado: 'pagado' }) });
    var idx = state.liquidaciones.findIndex(function (l) { return l.id === id; });
    if (idx >= 0) state.liquidaciones[idx] = r.liquidacion;
    return r.liquidacion;
  }

  async function addCaja(payload) {
    var r = await api('/api/cajas', { method: 'POST', body: JSON.stringify(payload) });
    state.cajas.push(r.caja);
    return r.caja;
  }

  async function rendirGasto(cajaId, payload) {
    var r = await api('/api/cajas/' + cajaId + '/rendicion', { method: 'POST', body: JSON.stringify(payload) });
    var idx = state.cajas.findIndex(function (c) { return c.id === cajaId; });
    if (idx >= 0) state.cajas[idx] = r.caja;
    state.rendiciones.unshift(r.rendicion);
    return r.caja;
  }

  async function reponerCaja(cajaId) {
    var r = await api('/api/cajas/' + cajaId + '/reponer', { method: 'POST' });
    var idx = state.cajas.findIndex(function (c) { return c.id === cajaId; });
    if (idx >= 0) state.cajas[idx] = r.caja;
    return r.caja;
  }

  async function addPresentismo(payload) {
    var r = await api('/api/presentismo', { method: 'POST', body: JSON.stringify(payload) });
    state.presentismo.unshift(r.registro);
    return r.registro;
  }

  async function deletePresentismo(id) {
    await api('/api/presentismo/' + id, { method: 'DELETE' });
    state.presentismo = state.presentismo.filter(function (p) { return p.id !== id; });
  }

  async function facturarSeleccionados(payload) {
    await api('/api/facturar-seleccionados', { method: 'POST', body: JSON.stringify(payload) });
    await loadState();
  }

  async function addGasto(payload) {
    var r = await api('/api/gastos', { method: 'POST', body: JSON.stringify(payload) });
    state.gastos.push(r.gasto);
    return r.gasto;
  }

  async function updateGastoEstado(id, estado) {
    var r = await api('/api/gastos/' + id, { method: 'PUT', body: JSON.stringify({ estado: estado }) });
    var idx = state.gastos.findIndex(function (g) { return g.id === id; });
    if (idx >= 0) state.gastos[idx] = r.gasto;
    return r.gasto;
  }

  async function deleteGasto(id) {
    await api('/api/gastos/' + id, { method: 'DELETE' });
    state.gastos = state.gastos.filter(function (g) { return g.id !== id; });
  }

  async function addRetiro(payload) {
    var r = await api('/api/retiros', { method: 'POST', body: JSON.stringify(payload) });
    state.retiros.unshift(r.retiro);
    return r.retiro;
  }

  async function ajustarCuenta(id, payload) {
    var r = await api('/api/cuentas/' + id + '/ajustar', { method: 'POST', body: JSON.stringify(payload) });
    var idx = state.cuentas.findIndex(function (c) { return c.id === id; });
    if (idx >= 0) state.cuentas[idx] = r.cuenta;
    return r.cuenta;
  }

  async function addUsuario(payload) {
    var r = await api('/api/usuarios', { method: 'POST', body: JSON.stringify(payload) });
    state.usuariosTodos.push(r.usuario);
    if (r.usuario.activo) state.usuarios.push(r.usuario);
    return r.usuario;
  }

  async function updateUsuario(id, payload) {
    var r = await api('/api/usuarios/' + id, { method: 'PUT', body: JSON.stringify(payload) });
    var idx = state.usuariosTodos.findIndex(function (u) { return u.id === id; });
    if (idx >= 0) state.usuariosTodos[idx] = r.usuario;
    idx = state.usuarios.findIndex(function (u) { return u.id === id; });
    if (r.usuario.activo && idx < 0) state.usuarios.push(r.usuario);
    else if (!r.usuario.activo && idx >= 0) state.usuarios.splice(idx, 1);
    else if (idx >= 0) state.usuarios[idx] = r.usuario;
    return r.usuario;
  }

  return {
    state: state,
    loadState: loadState,
    logout: logout,
    addCliente: addCliente,
    updateCliente: updateCliente,
    deleteCliente: deleteCliente,
    addTarea: addTarea,
    updateTareaEstado: updateTareaEstado,
    addStock: addStock,
    updateStock: updateStock,
    deleteStock: deleteStock,
    addPresupuesto: addPresupuesto,
    updatePresupuestoEstado: updatePresupuestoEstado,
    guardarPlanilla: guardarPlanilla,
    registrarPago: registrarPago,
    guardarConfig: guardarConfig,
    addPrestamo: addPrestamo,
    addLiquidacion: addLiquidacion,
    marcarLiquidacionPagada: marcarLiquidacionPagada,
    addCaja: addCaja,
    rendirGasto: rendirGasto,
    reponerCaja: reponerCaja,
    addPresentismo: addPresentismo,
    deletePresentismo: deletePresentismo,
    facturarSeleccionados: facturarSeleccionados,
    addGasto: addGasto,
    updateGastoEstado: updateGastoEstado,
    deleteGasto: deleteGasto,
    addRetiro: addRetiro,
    ajustarCuenta: ajustarCuenta,
    addUsuario: addUsuario,
    updateUsuario: updateUsuario,
  };
})();

/* ---------- Formato regional (Argentina) ---------- */
function fmtMoneda(valor) {
  return '$' + Math.round(valor || 0).toLocaleString('es-AR');
}

function fmtFecha(iso) {
  if (!iso) return '';
  var partes = iso.split('-');
  if (partes.length !== 3) return iso;
  return partes[2] + '/' + partes[1] + '/' + partes[0];
}

function hoyISO() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
