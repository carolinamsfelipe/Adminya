(function () {
  'use strict';

  var main = document.getElementById('main');
  var modalOverlay = document.getElementById('modal-overlay');
  var modalContent = document.getElementById('modal-content');
  var toastContainer = document.getElementById('toast-container');

  function toast(msg, isError) {
    var el = document.createElement('div');
    el.className = 'toast' + (isError ? ' error' : '');
    el.textContent = msg;
    toastContainer.appendChild(el);
    setTimeout(function () { el.remove(); }, 3200);
  }

  function closeModal() {
    modalOverlay.classList.remove('is-open');
    modalContent.innerHTML = '';
  }

  function openModal(html) {
    modalContent.innerHTML = html;
    modalOverlay.classList.add('is-open');
  }

  modalOverlay.addEventListener('click', function (e) {
    if (e.target === modalOverlay) closeModal();
  });

  var RUBROS = { gastronomia: 'Gastronomía', distribuidora: 'Distribuidora', comercio: 'Comercio', servicio: 'Servicio', estudio_contable: 'Estudio contable', otro: 'Otro' };
  var ESTADOS_TAREA = ['pendiente', 'realizado', 'facturado', 'cobrado'];

  function clienteNombre(id) {
    var c = AyData.state.clientes.find(function (x) { return x.id === id; });
    return c ? c.nombreComercial : '—';
  }

  function usuarioNombre(id) {
    var u = AyData.state.usuarios.find(function (x) { return x.id === id; });
    return u ? u.nombre : '—';
  }

  /* ---------- Vista: Dashboard ---------- */
  function renderDashboard() {
    var m = AyData.state.metricas;
    var isAdmin = AyData.state.user.rol === 'admin';

    var metricsHtml = '';
    if (isAdmin && m) {
      metricsHtml = '' +
        '<div class="grid-metrics">' +
        metricCard('Facturado este mes', fmtMoneda(m.facturadoMes), true) +
        metricCard('Cobrado este mes', fmtMoneda(m.cobradoMes)) +
        metricCard('Pendiente de cobro (total)', fmtMoneda(m.pendienteCobroTotal)) +
        metricCard('Promedio por cliente', fmtMoneda(m.promedioFacturacionCliente)) +
        metricCard('Tareas ejecutadas', String(m.tareasEjecutadasMes)) +
        '</div>';
    }

    var pendientes = AyData.state.tareas.filter(function (t) { return t.estado === 'pendiente'; }).slice(0, 8);

    main.innerHTML = '' +
      '<div class="page-header"><div><h1 class="page-title">Dashboard</h1>' +
      '<div class="page-sub">' + (isAdmin ? 'Vista ejecutiva' : 'Tus tareas y clientes asignados') + '</div></div></div>' +
      metricsHtml +
      (isAdmin ? '<div class="card" style="margin-bottom:20px"><h2 class="section-title">Acción rápida de facturación</h2><div id="facturacion-rapida"></div></div>' : '') +
      '<div class="card">' +
      '<h2 class="section-title">Servicios sin realizar este mes</h2>' +
      renderTareasTable(pendientes, false) +
      '</div>';

    attachTareaEstadoHandlers();
    if (isAdmin) renderFacturacionRapida();
  }

  function renderFacturacionRapida() {
    var box = document.getElementById('facturacion-rapida');
    var fp = AyData.state.facturacionPendiente;
    if (!fp || (!fp.abonos.length && !fp.tareas.length)) {
      box.innerHTML = '<div class="empty-state">No hay abonos ni tareas puntuales listas para facturar este mes.</div>';
      return;
    }
    var filasAbono = fp.abonos.map(function (c) {
      return '<tr><td><input type="checkbox" class="chk-abono" value="' + c.id + '" checked></td>' +
        '<td>' + c.nombreComercial + '</td><td>Abono mensual</td><td class="text-right mono">' + fmtMoneda(c.montoAbono) + '</td></tr>';
    }).join('');
    var filasTarea = fp.tareas.map(function (t) {
      return '<tr><td><input type="checkbox" class="chk-tarea" value="' + t.id + '" checked></td>' +
        '<td>' + clienteNombre(t.clienteId) + '</td><td>' + t.descripcion + '</td><td class="text-right mono">' + fmtMoneda(t.precio) + '</td></tr>';
    }).join('');
    box.innerHTML = '' +
      '<table><thead><tr><th></th><th>Cliente</th><th>Concepto</th><th class="text-right">Monto</th></tr></thead>' +
      '<tbody>' + filasAbono + filasTarea + '</tbody></table>' +
      '<div class="modal-actions" style="justify-content:flex-start;margin-top:14px">' +
      '<button class="btn btn-primary" id="btn-facturar-seleccionados">Facturar seleccionados</button></div>';

    document.getElementById('btn-facturar-seleccionados').addEventListener('click', async function () {
      var abonoIds = Array.from(box.querySelectorAll('.chk-abono:checked')).map(function (c) { return c.value; });
      var tareaIds = Array.from(box.querySelectorAll('.chk-tarea:checked')).map(function (c) { return c.value; });
      if (!abonoIds.length && !tareaIds.length) { toast('Seleccioná al menos un ítem.', true); return; }
      try {
        await AyData.facturarSeleccionados({ abonoClienteIds: abonoIds, tareaIds: tareaIds });
        toast('Facturación generada.');
        renderDashboard();
      } catch (err) { toast(err.message, true); }
    });
  }

  function metricCard(label, value, accent) {
    return '<div class="metric-card"><div class="metric-label">' + label + '</div>' +
      '<div class="metric-value' + (accent ? ' accent' : '') + '">' + value + '</div></div>';
  }

  /* ---------- Vista: Clientes ---------- */
  function renderClientes() {
    main.innerHTML = '' +
      '<div class="page-header"><div><h1 class="page-title">Clientes</h1>' +
      '<div class="page-sub">Fichas comerciales de PyMEs, comercios, gastronómicos y distribuidoras</div></div>' +
      '<button class="btn btn-primary" id="btn-nuevo-cliente">+ Nuevo cliente</button></div>' +
      '<div class="card"><div id="clientes-table"></div></div>';

    document.getElementById('btn-nuevo-cliente').addEventListener('click', function () { openClienteModal(); });
    renderClientesTable();
  }

  function renderClientesTable() {
    var clientes = AyData.state.clientes;
    var box = document.getElementById('clientes-table');
    if (!clientes.length) {
      box.innerHTML = '<div class="empty-state"><div class="icon">🏢</div>Todavía no cargaste ningún cliente.</div>';
      return;
    }
    var rows = clientes.map(function (c) {
      return '<tr>' +
        '<td>' + c.nombreComercial + '</td>' +
        '<td>' + (RUBROS[c.rubro] || c.rubro) + '</td>' +
        '<td>' + (c.tipoContrato === 'abono' ? 'Abono mensual' : 'Trabajo puntual') + '</td>' +
        '<td class="text-right mono">' + (c.tipoContrato === 'abono' ? fmtMoneda(c.montoAbono) : '—') + '</td>' +
        '<td>' + (c.contactoWhatsapp || '—') + '</td>' +
        '<td class="text-right">' +
        '<button class="btn btn-secondary" data-edit="' + c.id + '">Editar</button> ' +
        '<button class="btn btn-danger" data-del="' + c.id + '">Dar de baja</button>' +
        '</td></tr>';
    }).join('');
    box.innerHTML = '<table><thead><tr><th>Nombre comercial</th><th>Rubro</th><th>Contrato</th><th class="text-right">Abono</th><th>WhatsApp</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>';

    box.querySelectorAll('[data-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () { openClienteModal(btn.dataset.edit); });
    });
    box.querySelectorAll('[data-del]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!confirm('¿Dar de baja este cliente? Se puede reactivar más adelante desde la base de datos.')) return;
        try {
          await AyData.deleteCliente(btn.dataset.del);
          toast('Cliente dado de baja.');
          renderClientesTable();
        } catch (e) { toast(e.message, true); }
      });
    });
  }

  function openClienteModal(id) {
    var c = id ? AyData.state.clientes.find(function (x) { return x.id === id; }) : null;
    var opciones = Object.keys(RUBROS).map(function (k) {
      return '<option value="' + k + '"' + (c && c.rubro === k ? ' selected' : '') + '>' + RUBROS[k] + '</option>';
    }).join('');

    openModal('' +
      '<h3>' + (c ? 'Editar cliente' : 'Nuevo cliente') + '</h3>' +
      '<form id="cliente-form">' +
      field('nombreComercial', 'Nombre comercial', c && c.nombreComercial, true) +
      field('razonSocial', 'Razón social', c && c.razonSocial) +
      field('cuit', 'CUIT', c && c.cuit) +
      '<div class="field"><label>Rubro</label><select name="rubro" required>' + opciones + '</select></div>' +
      '<div class="field"><label>Tipo de contrato</label><select name="tipoContrato">' +
      '<option value="abono"' + (c && c.tipoContrato === 'abono' ? ' selected' : '') + '>Abono mensual recurrente</option>' +
      '<option value="puntual"' + (c && c.tipoContrato === 'puntual' ? ' selected' : '') + '>Trabajo puntual</option>' +
      '</select></div>' +
      field('montoAbono', 'Monto de abono (ARS)', c && c.montoAbono, false, 'number') +
      field('contactoNombre', 'Nombre del dueño / contacto', c && c.contactoNombre) +
      field('contactoWhatsapp', 'WhatsApp directo', c && c.contactoWhatsapp) +
      field('direccion', 'Dirección', c && c.direccion) +
      field('diaFacturacion', 'Día de facturación mensual', c && c.diaFacturacion, false, 'number') +
      '<div class="field"><label>Notas internas (confidenciales)</label><textarea name="notasInternas" rows="3">' + (c && c.notasInternas || '') + '</textarea></div>' +
      '<div class="modal-actions">' +
      '<button type="button" class="btn btn-secondary" id="btn-cancel-modal">Cancelar</button>' +
      '<button type="submit" class="btn btn-primary">Guardar</button>' +
      '</div></form>');

    document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);
    document.getElementById('cliente-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var payload = Object.fromEntries(fd.entries());
      try {
        if (c) await AyData.updateCliente(c.id, payload);
        else await AyData.addCliente(payload);
        toast(c ? 'Cliente actualizado.' : 'Cliente creado.');
        closeModal();
        renderClientesTable();
      } catch (err) { toast(err.message, true); }
    });
  }

  function field(name, label, value, required, type) {
    return '<div class="field"><label>' + label + '</label>' +
      '<input name="' + name + '" type="' + (type || 'text') + '" value="' + (value != null ? value : '') + '"' + (required ? ' required' : '') + '></div>';
  }

  /* ---------- Vista: Tareas ---------- */
  function renderTareas() {
    main.innerHTML = '' +
      '<div class="page-header"><div><h1 class="page-title">Tareas y servicios</h1>' +
      '<div class="page-sub">Registro diario de trabajos ejecutados por cliente y operador</div></div>' +
      '<button class="btn btn-primary" id="btn-nueva-tarea">+ Nueva tarea</button></div>' +
      '<div class="toolbar">' +
      '<input type="search" id="filtro-tarea" placeholder="Buscar por cliente, operador o descripción...">' +
      '<select id="filtro-estado"><option value="">Todos los estados</option>' +
      ESTADOS_TAREA.map(function (e) { return '<option value="' + e + '">' + capitalize(e) + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="card"><div id="tareas-table"></div></div>';

    document.getElementById('btn-nueva-tarea').addEventListener('click', openTareaModal);
    document.getElementById('filtro-tarea').addEventListener('input', renderTareasFiltradas);
    document.getElementById('filtro-estado').addEventListener('change', renderTareasFiltradas);
    renderTareasFiltradas();
  }

  function renderTareasFiltradas() {
    var q = (document.getElementById('filtro-tarea').value || '').toLowerCase();
    var estado = document.getElementById('filtro-estado').value;
    var filtradas = AyData.state.tareas.filter(function (t) {
      var texto = (clienteNombre(t.clienteId) + ' ' + usuarioNombre(t.operadorId) + ' ' + t.descripcion).toLowerCase();
      return texto.indexOf(q) >= 0 && (!estado || t.estado === estado);
    });
    document.getElementById('tareas-table').innerHTML = renderTareasTable(filtradas, true);
    attachTareaEstadoHandlers();
  }

  function renderTareasTable(tareas, conAcciones) {
    if (!tareas.length) return '<div class="empty-state"><div class="icon">📋</div>No hay tareas para mostrar.</div>';
    var rows = tareas.map(function (t) {
      return '<tr>' +
        '<td>' + fmtFecha(t.fecha) + '</td>' +
        '<td>' + clienteNombre(t.clienteId) + '</td>' +
        '<td>' + usuarioNombre(t.operadorId) + '</td>' +
        '<td>' + t.descripcion + '</td>' +
        '<td class="text-right mono">' + t.horas + 'h</td>' +
        '<td class="text-right mono">' + (t.modalidad === 'puntual' ? fmtMoneda(t.precio) : 'Abono') + '</td>' +
        '<td><span class="badge badge-' + t.estado + '">' + capitalize(t.estado) + '</span></td>' +
        (conAcciones ? '<td class="text-right">' + estadoSelect(t) + '</td>' : '') +
        '</tr>';
    }).join('');
    return '<table><thead><tr><th>Fecha</th><th>Cliente</th><th>Operador</th><th>Descripción</th>' +
      '<th class="text-right">Horas</th><th class="text-right">Precio</th><th>Estado</th>' + (conAcciones ? '<th></th>' : '') + '</tr></thead><tbody>' + rows + '</tbody></table>';
  }

  function estadoSelect(t) {
    return '<select class="cambiar-estado" data-id="' + t.id + '">' +
      ESTADOS_TAREA.map(function (e) { return '<option value="' + e + '"' + (e === t.estado ? ' selected' : '') + '>' + capitalize(e) + '</option>'; }).join('') +
      '</select>';
  }

  function attachTareaEstadoHandlers() {
    document.querySelectorAll('.cambiar-estado').forEach(function (sel) {
      sel.addEventListener('change', async function () {
        try {
          await AyData.updateTareaEstado(sel.dataset.id, sel.value);
          toast('Estado actualizado.');
        } catch (e) { toast(e.message, true); }
      });
    });
  }

  function openTareaModal() {
    var clientesOpts = AyData.state.clientes.map(function (c) { return '<option value="' + c.id + '">' + c.nombreComercial + '</option>'; }).join('');
    var operadoresOpts = AyData.state.usuarios.map(function (u) { return '<option value="' + u.id + '">' + u.nombre + '</option>'; }).join('');

    openModal('' +
      '<h3>Nueva tarea</h3>' +
      '<form id="tarea-form">' +
      '<div class="field"><label>Fecha</label><input type="date" name="fecha" value="' + hoyISO() + '" required></div>' +
      '<div class="field"><label>Cliente</label><select name="clienteId" required>' + clientesOpts + '</select></div>' +
      '<div class="field"><label>Operador asignado</label><select name="operadorId" required>' + operadoresOpts + '</select></div>' +
      '<div class="field"><label>Descripción de la tarea</label><input name="descripcion" required placeholder="Ej: Cierre de cajas y márgenes"></div>' +
      '<div class="field"><label>Horas insumidas</label><input type="number" step="0.5" name="horas" value="1"></div>' +
      '<div class="field"><label>Modalidad</label><select name="modalidad">' +
      '<option value="abono">Incluida en abono mensual</option><option value="puntual">Trabajo puntual (a cobrar aparte)</option>' +
      '</select></div>' +
      '<div class="field"><label>Precio a cobrar (si es puntual)</label><input type="number" name="precio" value="0"></div>' +
      '<div class="modal-actions">' +
      '<button type="button" class="btn btn-secondary" id="btn-cancel-modal">Cancelar</button>' +
      '<button type="submit" class="btn btn-primary">Guardar</button>' +
      '</div></form>');

    document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);
    document.getElementById('tarea-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var payload = Object.fromEntries(fd.entries());
      try {
        await AyData.addTarea(payload);
        toast('Tarea creada.');
        closeModal();
        renderTareasFiltradas();
      } catch (err) { toast(err.message, true); }
    });
  }

  /* ---------- Vista: Presupuestador y stock ---------- */
  var presupuestadorClienteId = null;

  function renderPresupuestador() {
    var clientesOpts = AyData.state.clientes.map(function (c) {
      return '<option value="' + c.id + '"' + (c.id === presupuestadorClienteId ? ' selected' : '') + '>' + c.nombreComercial + '</option>';
    }).join('');

    main.innerHTML = '' +
      '<div class="page-header"><div><h1 class="page-title">Presupuestador y stock</h1>' +
      '<div class="page-sub">Catálogo de insumos por cliente y generación de presupuestos con descuento automático de stock</div></div></div>' +
      '<div class="toolbar"><select id="presu-cliente"><option value="">Elegí un cliente...</option>' + clientesOpts + '</select></div>' +
      '<div id="presupuestador-body"></div>';

    var sel = document.getElementById('presu-cliente');
    if (presupuestadorClienteId) sel.value = presupuestadorClienteId;
    sel.addEventListener('change', function () {
      presupuestadorClienteId = sel.value || null;
      renderPresupuestadorBody();
    });
    renderPresupuestadorBody();
  }

  function renderPresupuestadorBody() {
    var box = document.getElementById('presupuestador-body');
    if (!presupuestadorClienteId) {
      box.innerHTML = '<div class="empty-state"><div class="icon">📦</div>Elegí un cliente para ver su stock y sus presupuestos.</div>';
      return;
    }
    var stockCliente = AyData.state.stock.filter(function (s) { return s.clienteId === presupuestadorClienteId; });
    var presupuestosCliente = AyData.state.presupuestos.filter(function (p) { return p.clienteId === presupuestadorClienteId; });

    box.innerHTML = '' +
      '<div class="card" style="margin-bottom:16px">' +
      '<div class="page-header" style="margin-bottom:12px"><h2 class="section-title" style="margin:0">Stock</h2>' +
      '<button class="btn btn-primary" id="btn-nuevo-stock">+ Nuevo ítem</button></div>' +
      '<div id="stock-table"></div></div>' +
      '<div class="card"><div class="page-header" style="margin-bottom:12px"><h2 class="section-title" style="margin:0">Presupuestos</h2>' +
      '<button class="btn btn-primary" id="btn-nuevo-presupuesto">+ Nuevo presupuesto</button></div>' +
      '<div id="presupuestos-table"></div></div>';

    renderStockTable(stockCliente);
    renderPresupuestosTable(presupuestosCliente);
    document.getElementById('btn-nuevo-stock').addEventListener('click', function () { openStockModal(); });
    document.getElementById('btn-nuevo-presupuesto').addEventListener('click', function () { openPresupuestoModal(stockCliente); });
  }

  function renderStockTable(items) {
    var box = document.getElementById('stock-table');
    if (!items.length) {
      box.innerHTML = '<div class="empty-state">Sin ítems de stock cargados para este cliente.</div>';
      return;
    }
    var rows = items.map(function (i) {
      var bajo = i.cantidad <= i.minimo;
      return '<tr>' +
        '<td>' + (i.codigo || '—') + '</td>' +
        '<td>' + i.descripcion + '</td>' +
        '<td>' + i.unidad + '</td>' +
        '<td class="text-right mono">' + fmtMoneda(i.precioUnitario) + '</td>' +
        '<td class="text-right mono' + (bajo ? ' stock-low' : '') + '">' + i.cantidad + (bajo ? ' ⚠' : '') + '</td>' +
        '<td class="text-right">' +
        '<button class="btn btn-secondary" data-edit-stock="' + i.id + '">Editar</button> ' +
        '<button class="btn btn-danger" data-del-stock="' + i.id + '">Eliminar</button></td></tr>';
    }).join('');
    box.innerHTML = '<table><thead><tr><th>Código</th><th>Descripción</th><th>Unidad</th><th class="text-right">Precio</th><th class="text-right">Cantidad</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>';

    box.querySelectorAll('[data-edit-stock]').forEach(function (btn) {
      btn.addEventListener('click', function () { openStockModal(btn.dataset.editStock); });
    });
    box.querySelectorAll('[data-del-stock]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!confirm('¿Eliminar este ítem de stock?')) return;
        try {
          await AyData.deleteStock(btn.dataset.delStock);
          toast('Ítem eliminado.');
          renderPresupuestadorBody();
        } catch (e) { toast(e.message, true); }
      });
    });
  }

  function openStockModal(id) {
    var item = id ? AyData.state.stock.find(function (s) { return s.id === id; }) : null;
    openModal('' +
      '<h3>' + (item ? 'Editar ítem de stock' : 'Nuevo ítem de stock') + '</h3>' +
      '<form id="stock-form">' +
      field('codigo', 'Código', item && item.codigo) +
      field('descripcion', 'Descripción', item && item.descripcion, true) +
      field('unidad', 'Unidad de medida', (item && item.unidad) || 'un') +
      field('precioUnitario', 'Precio unitario (ARS)', item && item.precioUnitario, false, 'number') +
      field('cantidad', 'Cantidad en stock', item && item.cantidad, false, 'number') +
      field('minimo', 'Cantidad mínima (alerta)', item && item.minimo, false, 'number') +
      '<div class="modal-actions">' +
      '<button type="button" class="btn btn-secondary" id="btn-cancel-modal">Cancelar</button>' +
      '<button type="submit" class="btn btn-primary">Guardar</button></div></form>');

    document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);
    document.getElementById('stock-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var payload = Object.fromEntries(fd.entries());
      payload.clienteId = presupuestadorClienteId;
      try {
        if (item) await AyData.updateStock(item.id, payload);
        else await AyData.addStock(payload);
        toast(item ? 'Ítem actualizado.' : 'Ítem creado.');
        closeModal();
        renderPresupuestadorBody();
      } catch (err) { toast(err.message, true); }
    });
  }

  function renderPresupuestosTable(presupuestos) {
    var box = document.getElementById('presupuestos-table');
    if (!presupuestos.length) {
      box.innerHTML = '<div class="empty-state">Todavía no hay presupuestos para este cliente.</div>';
      return;
    }
    var rows = presupuestos.map(function (p) {
      return '<tr>' +
        '<td>' + fmtFecha(p.fecha) + '</td>' +
        '<td>' + p.items.length + ' ítem(s)</td>' +
        '<td class="text-right mono">' + fmtMoneda(p.total) + '</td>' +
        '<td><span class="badge badge-' + p.estado + '">' + capitalize(p.estado) + '</span></td>' +
        '<td class="text-right">' +
        '<select class="cambiar-estado-presu" data-id="' + p.id + '">' +
        '<option value="pendiente"' + (p.estado === 'pendiente' ? ' selected' : '') + '>Pendiente</option>' +
        '<option value="aprobado"' + (p.estado === 'aprobado' ? ' selected' : '') + '>Aprobado</option>' +
        '<option value="rechazado"' + (p.estado === 'rechazado' ? ' selected' : '') + '>Rechazado</option>' +
        '</select> <button class="btn btn-secondary" data-imprimir="' + p.id + '">Imprimir</button></td></tr>';
    }).join('');
    box.innerHTML = '<table><thead><tr><th>Fecha</th><th>Ítems</th><th class="text-right">Total</th><th>Estado</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>';

    box.querySelectorAll('.cambiar-estado-presu').forEach(function (sel) {
      sel.addEventListener('change', async function () {
        try {
          await AyData.updatePresupuestoEstado(sel.dataset.id, sel.value);
          toast('Estado actualizado.');
          renderPresupuestadorBody();
        } catch (e) { toast(e.message, true); }
      });
    });
    box.querySelectorAll('[data-imprimir]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        window.open('/presupuestos/' + btn.dataset.imprimir + '/imprimir', '_blank');
      });
    });
  }

  function openPresupuestoModal(stockCliente) {
    var itemsState = [];

    openModal('' +
      '<h3>Nuevo presupuesto</h3>' +
      '<div id="presu-items"></div>' +
      '<button type="button" class="btn btn-secondary" id="btn-add-item" style="margin-bottom:12px">+ Agregar ítem</button>' +
      '<div class="presupuesto-totales" id="presu-totales"></div>' +
      '<div class="modal-actions">' +
      '<button type="button" class="btn btn-secondary" id="btn-cancel-modal">Cancelar</button>' +
      '<button type="button" class="btn btn-primary" id="btn-guardar-presupuesto">Generar presupuesto</button></div>');

    document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);

    function renderRows() {
      var box = document.getElementById('presu-items');
      box.innerHTML = itemsState.map(function (it, idx) {
        var opciones = '<option value="">Libre (sin stock)</option>' + stockCliente.map(function (s) {
          return '<option value="' + s.id + '"' + (it.stockItemId === s.id ? ' selected' : '') + '>' + s.descripcion + ' (disp: ' + s.cantidad + ')</option>';
        }).join('');
        return '<div class="presupuesto-item-row" data-idx="' + idx + '">' +
          '<div class="field" style="margin-bottom:0"><label>Ítem de stock</label><select class="item-select" data-idx="' + idx + '">' + opciones + '</select></div>' +
          '<div class="field" style="margin-bottom:0"><label>Descripción</label><input type="text" class="item-desc" data-idx="' + idx + '" value="' + (it.descripcion || '') + '"' + (it.stockItemId ? ' readonly' : '') + '></div>' +
          '<div class="field" style="margin-bottom:0"><label>Cantidad</label><input type="number" class="item-cantidad" data-idx="' + idx + '" min="1" value="' + it.cantidad + '"></div>' +
          '<div class="field" style="margin-bottom:0"><label>Precio unit.</label><input type="number" class="item-precio" data-idx="' + idx + '" value="' + it.precioUnitario + '"' + (it.stockItemId ? ' readonly' : '') + '></div>' +
          '<button type="button" class="btn btn-danger" data-remove="' + idx + '">✕</button></div>';
      }).join('');

      box.querySelectorAll('.item-select').forEach(function (sel) {
        sel.addEventListener('change', function () {
          var idx = +sel.dataset.idx;
          var stockItem = stockCliente.find(function (s) { return s.id === sel.value; });
          itemsState[idx].stockItemId = sel.value || null;
          if (stockItem) {
            itemsState[idx].descripcion = stockItem.descripcion;
            itemsState[idx].precioUnitario = stockItem.precioUnitario;
          } else {
            itemsState[idx].descripcion = '';
          }
          renderRows();
          renderTotales();
        });
      });
      box.querySelectorAll('.item-desc').forEach(function (inp) {
        inp.addEventListener('input', function () { itemsState[+inp.dataset.idx].descripcion = inp.value; });
      });
      box.querySelectorAll('.item-cantidad').forEach(function (inp) {
        inp.addEventListener('input', function () { itemsState[+inp.dataset.idx].cantidad = parseInt(inp.value) || 0; renderTotales(); });
      });
      box.querySelectorAll('.item-precio').forEach(function (inp) {
        inp.addEventListener('input', function () { itemsState[+inp.dataset.idx].precioUnitario = parseInt(inp.value) || 0; renderTotales(); });
      });
      box.querySelectorAll('[data-remove]').forEach(function (btn) {
        btn.addEventListener('click', function () { itemsState.splice(+btn.dataset.remove, 1); renderRows(); renderTotales(); });
      });
    }

    function renderTotales() {
      var subtotal = itemsState.reduce(function (sum, it) { return sum + it.cantidad * it.precioUnitario; }, 0);
      var iva = Math.round(subtotal * 0.21);
      var total = subtotal + iva;
      document.getElementById('presu-totales').innerHTML =
        '<div>Subtotal: ' + fmtMoneda(subtotal) + '</div>' +
        '<div>IVA (21%): ' + fmtMoneda(iva) + '</div>' +
        '<div class="total-final">Total: ' + fmtMoneda(total) + '</div>';
    }

    document.getElementById('btn-add-item').addEventListener('click', function () {
      itemsState.push({ stockItemId: '', descripcion: '', cantidad: 1, precioUnitario: 0 });
      renderRows();
    });
    itemsState.push({ stockItemId: '', descripcion: '', cantidad: 1, precioUnitario: 0 });
    renderRows();
    renderTotales();

    document.getElementById('btn-guardar-presupuesto').addEventListener('click', async function () {
      var itemsValidos = itemsState.filter(function (it) { return it.descripcion && it.cantidad > 0; });
      if (!itemsValidos.length) { toast('Agregá al menos un ítem con descripción y cantidad.', true); return; }
      try {
        await AyData.addPresupuesto({ clienteId: presupuestadorClienteId, items: itemsValidos });
        toast('Presupuesto generado.');
        closeModal();
        renderPresupuestadorBody();
      } catch (err) { toast(err.message, true); }
    });
  }

  /* ---------- Vista: Planilla gastronómica ---------- */
  var planillaClienteId = null;

  function renderPlanilla() {
    var clientesOpts = AyData.state.clientes.map(function (c) {
      return '<option value="' + c.id + '"' + (c.id === planillaClienteId ? ' selected' : '') + '>' + c.nombreComercial + ' (' + (RUBROS[c.rubro] || c.rubro) + ')</option>';
    }).join('');

    main.innerHTML = '' +
      '<div class="page-header"><div><h1 class="page-title">Planilla gastronómica</h1>' +
      '<div class="page-sub">Cajas y márgenes por turno para gastronómicos y comercios</div></div></div>' +
      '<div class="toolbar"><select id="planilla-cliente"><option value="">Elegí un cliente...</option>' + clientesOpts + '</select></div>' +
      '<div id="planilla-body"></div>';

    var sel = document.getElementById('planilla-cliente');
    if (planillaClienteId) sel.value = planillaClienteId;
    sel.addEventListener('change', function () { planillaClienteId = sel.value || null; renderPlanillaBody(); });
    renderPlanillaBody();
  }

  function renderPlanillaBody() {
    var box = document.getElementById('planilla-body');
    if (!planillaClienteId) {
      box.innerHTML = '<div class="empty-state"><div class="icon">🍽️</div>Elegí un cliente para cargar su planilla diaria.</div>';
      return;
    }
    var filas = AyData.state.planillas.filter(function (p) { return p.clienteId === planillaClienteId; })
      .sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; });
    var ultimoObjetivo = filas.length ? filas[0].objetivoMensual : 0;

    box.innerHTML = '' +
      '<div class="card" style="margin-bottom:16px">' +
      '<h2 class="section-title">Carga diaria</h2>' +
      '<form id="planilla-form" class="presupuesto-item-row" style="grid-template-columns: 1fr 1fr 1fr 1fr 1fr auto; align-items:end">' +
      '<div class="field" style="margin-bottom:0"><label>Fecha</label><input type="date" name="fecha" value="' + hoyISO() + '"></div>' +
      '<div class="field" style="margin-bottom:0"><label>Ventas turno tarde</label><input type="number" name="ventasTarde" value="0"></div>' +
      '<div class="field" style="margin-bottom:0"><label>Ventas turno noche</label><input type="number" name="ventasNoche" value="0"></div>' +
      '<div class="field" style="margin-bottom:0"><label>Gastos del día</label><input type="number" name="gastosDia" value="0"></div>' +
      '<div class="field" style="margin-bottom:0"><label>Objetivo mensual</label><input type="number" name="objetivoMensual" value="' + ultimoObjetivo + '"></div>' +
      '<button type="submit" class="btn btn-primary">Guardar</button>' +
      '</form></div>' +
      '<div class="card" style="margin-bottom:16px">' +
      '<div class="page-header" style="margin-bottom:12px"><h2 class="section-title" style="margin:0">Historial</h2>' +
      '<button class="btn btn-secondary" id="btn-reporte-semanal">📤 Generar reporte semanal</button></div>' +
      '<div id="planilla-tabla"></div></div>' +
      '<div id="reporte-semanal-box"></div>';

    document.getElementById('planilla-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var payload = Object.fromEntries(fd.entries());
      payload.clienteId = planillaClienteId;
      try {
        await AyData.guardarPlanilla(payload);
        toast('Planilla del día guardada.');
        renderPlanillaBody();
      } catch (err) { toast(err.message, true); }
    });
    document.getElementById('btn-reporte-semanal').addEventListener('click', function () { mostrarReporteSemanal(filas); });

    renderPlanillaTabla(filas);
  }

  function renderPlanillaTabla(filas) {
    var box = document.getElementById('planilla-tabla');
    if (!filas.length) {
      box.innerHTML = '<div class="empty-state">Todavía no cargaste ningún día para este cliente.</div>';
      return;
    }
    var rows = filas.map(function (p) {
      var total = p.ventasTarde + p.ventasNoche;
      var diff = p.ventasTarde > 0 ? Math.round((p.ventasNoche - p.ventasTarde) / p.ventasTarde * 100) : 0;
      var margen = total - p.gastosDia;
      var objetivoDiario = p.objetivoMensual ? p.objetivoMensual / 30 : 0;
      var vsObjetivo = objetivoDiario ? Math.round((total / objetivoDiario) * 100) : null;
      return '<tr>' +
        '<td>' + fmtFecha(p.fecha) + '</td>' +
        '<td class="text-right mono">' + fmtMoneda(p.ventasTarde) + '</td>' +
        '<td class="text-right mono">' + fmtMoneda(p.ventasNoche) + '</td>' +
        '<td class="text-right mono">' + (diff >= 0 ? '+' : '') + diff + '%</td>' +
        '<td class="text-right mono">' + fmtMoneda(total) + '</td>' +
        '<td class="text-right mono">' + fmtMoneda(p.gastosDia) + '</td>' +
        '<td class="text-right mono">' + fmtMoneda(margen) + '</td>' +
        '<td class="text-right mono">' + (vsObjetivo != null ? vsObjetivo + '%' : '—') + '</td>' +
        '</tr>';
    }).join('');
    box.innerHTML = '<table><thead><tr><th>Fecha</th><th class="text-right">Tarde</th><th class="text-right">Noche</th>' +
      '<th class="text-right">Dif. tarde/noche</th><th class="text-right">Total día</th><th class="text-right">Gastos</th>' +
      '<th class="text-right">Margen</th><th class="text-right">% obj. diario</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  function mostrarReporteSemanal(filas) {
    var semana = filas.slice(0, 7);
    if (!semana.length) { toast('No hay datos cargados todavía para generar el reporte.', true); return; }
    var cliente = AyData.state.clientes.find(function (c) { return c.id === planillaClienteId; });
    var tarde = semana.reduce(function (s, p) { return s + p.ventasTarde; }, 0);
    var noche = semana.reduce(function (s, p) { return s + p.ventasNoche; }, 0);
    var gastos = semana.reduce(function (s, p) { return s + p.gastosDia; }, 0);
    var total = tarde + noche;
    var margen = total - gastos;
    var objetivoSemanal = (semana[0].objetivoMensual || 0) / 4.33;
    var pctObjetivo = objetivoSemanal ? Math.round((total / objetivoSemanal) * 100) : null;
    var desde = semana[semana.length - 1].fecha, hasta = semana[0].fecha;

    var texto = 'Resumen semanal — ' + (cliente ? cliente.nombreComercial : '') + '\n' +
      'Período: ' + fmtFecha(desde) + ' al ' + fmtFecha(hasta) + '\n\n' +
      'Ventas turno tarde: ' + fmtMoneda(tarde) + '\n' +
      'Ventas turno noche: ' + fmtMoneda(noche) + '\n' +
      'Total facturado: ' + fmtMoneda(total) + '\n' +
      'Gastos operativos: ' + fmtMoneda(gastos) + '\n' +
      'Margen bruto estimado: ' + fmtMoneda(margen) + '\n' +
      (pctObjetivo != null ? 'Cumplimiento del objetivo semanal: ' + pctObjetivo + '%\n' : '') +
      '\nAdminYAAA — administración de tu negocio';

    document.getElementById('reporte-semanal-box').innerHTML = '' +
      '<div class="card"><h2 class="section-title">Mensaje para enviar por WhatsApp</h2>' +
      '<textarea id="reporte-texto" rows="10" style="width:100%; font-family:var(--font); padding:10px; border:1px solid var(--slate-200); border-radius:6px;">' + texto + '</textarea>' +
      '<div class="modal-actions" style="justify-content:flex-start; margin-top:10px">' +
      '<button class="btn btn-primary" id="btn-copiar-reporte">Copiar mensaje</button></div></div>';

    document.getElementById('btn-copiar-reporte').addEventListener('click', function () {
      navigator.clipboard.writeText(document.getElementById('reporte-texto').value).then(function () { toast('Mensaje copiado al portapapeles.'); });
    });
  }

  /* ---------- Vista: Cuentas corrientes ---------- */
  var cuentasClienteId = null;

  function renderCuentas() {
    var clientesOpts = AyData.state.clientes.map(function (c) {
      return '<option value="' + c.id + '"' + (c.id === cuentasClienteId ? ' selected' : '') + '>' + c.nombreComercial + '</option>';
    }).join('');

    var configBox = '';
    if (AyData.state.user.rol === 'admin') {
      var cfg = AyData.state.config;
      configBox = '<details class="card" style="margin-bottom:16px"><summary style="cursor:pointer;font-weight:600">Datos bancarios de AdminYAAA (para el mensaje de cobro)</summary>' +
        '<form id="config-form" style="margin-top:14px">' +
        field('banco_titular', 'Titular', cfg.banco_titular) +
        field('banco_cuit', 'CUIT/CUIL', cfg.banco_cuit) +
        field('banco_cbu', 'CBU/CVU', cfg.banco_cbu) +
        field('banco_alias', 'Alias', cfg.banco_alias) +
        field('banco_nombre', 'Banco', cfg.banco_nombre) +
        '<button type="submit" class="btn btn-primary">Guardar datos</button></form></details>';
    }

    main.innerHTML = '' +
      '<div class="page-header"><div><h1 class="page-title">Cuentas corrientes</h1>' +
      '<div class="page-sub">Libro mayor por cliente, cobros con aplicación FIFO y mensajes de cobro por WhatsApp</div></div></div>' +
      configBox +
      '<div class="toolbar"><select id="cuentas-cliente"><option value="">Elegí un cliente...</option>' + clientesOpts + '</select></div>' +
      '<div id="cuentas-body"></div>';

    var sel = document.getElementById('cuentas-cliente');
    if (cuentasClienteId) sel.value = cuentasClienteId;
    sel.addEventListener('change', function () { cuentasClienteId = sel.value || null; renderCuentasBody(); });

    if (AyData.state.user.rol === 'admin') {
      document.getElementById('config-form').addEventListener('submit', async function (e) {
        e.preventDefault();
        var fd = new FormData(e.target);
        try {
          await AyData.guardarConfig(Object.fromEntries(fd.entries()));
          toast('Datos bancarios actualizados.');
        } catch (err) { toast(err.message, true); }
      });
    }

    renderCuentasBody();
  }

  function renderCuentasBody() {
    var box = document.getElementById('cuentas-body');
    if (!cuentasClienteId) {
      box.innerHTML = '<div class="empty-state"><div class="icon">📒</div>Elegí un cliente para ver su cuenta corriente.</div>';
      return;
    }
    var movs = AyData.state.movimientos.filter(function (m) { return m.clienteId === cuentasClienteId; })
      .sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
    var saldoDeudor = movs.filter(function (m) { return m.tipo === 'debito'; }).reduce(function (s, m) { return s + m.saldoPendiente; }, 0);

    var acumulado = 0;
    var rows = movs.map(function (m) {
      acumulado += m.tipo === 'debito' ? m.monto : -m.monto;
      return '<tr>' +
        '<td>' + fmtFecha(m.fecha) + '</td>' +
        '<td><span class="badge ' + (m.tipo === 'debito' ? 'badge-pendiente' : 'badge-cobrado') + '">' + (m.tipo === 'debito' ? 'Débito' : 'Crédito') + '</span></td>' +
        '<td>' + m.concepto + '</td>' +
        '<td class="text-right mono">' + fmtMoneda(m.monto) + '</td>' +
        '<td class="text-right mono">' + fmtMoneda(acumulado) + '</td>' +
        '</tr>';
    }).join('');

    box.innerHTML = '' +
      '<div class="grid-metrics" style="grid-template-columns: repeat(auto-fit, minmax(220px,1fr))">' +
      metricCard('Saldo pendiente de cobro', fmtMoneda(saldoDeudor), saldoDeudor > 0) +
      '</div>' +
      '<div class="toolbar">' +
      '<button class="btn btn-primary" id="btn-registrar-pago">+ Registrar pago</button>' +
      (saldoDeudor > 0 ? '<button class="btn btn-secondary" id="btn-mensaje-cobro">💬 Generar mensaje de cobro</button>' : '') +
      '</div>' +
      '<div class="card"><h2 class="section-title">Movimientos</h2>' +
      (rows ? '<table><thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th class="text-right">Monto</th><th class="text-right">Saldo acumulado</th></tr></thead><tbody>' + rows + '</tbody></table>'
        : '<div class="empty-state">Todavía no hay movimientos para este cliente.</div>') +
      '</div><div id="mensaje-cobro-box"></div>';

    document.getElementById('btn-registrar-pago').addEventListener('click', openPagoModal);
    var btnMsg = document.getElementById('btn-mensaje-cobro');
    if (btnMsg) btnMsg.addEventListener('click', function () { mostrarMensajeCobro(saldoDeudor); });
  }

  function openPagoModal() {
    var cuentasOpts = AyData.state.cuentas.map(function (c) { return '<option value="' + c.id + '">' + c.nombre + '</option>'; }).join('');
    openModal('' +
      '<h3>Registrar pago</h3>' +
      '<form id="pago-form">' +
      '<div class="field"><label>Fecha</label><input type="date" name="fecha" value="' + hoyISO() + '" required></div>' +
      '<div class="field"><label>Monto recibido (ARS)</label><input type="number" name="monto" required></div>' +
      '<div class="field"><label>Cuenta de destino</label><select name="cuentaId">' + cuentasOpts + '</select></div>' +
      '<div class="field"><label>Comprobante / referencia</label><input name="comprobante" placeholder="N° de operación"></div>' +
      '<div class="modal-actions">' +
      '<button type="button" class="btn btn-secondary" id="btn-cancel-modal">Cancelar</button>' +
      '<button type="submit" class="btn btn-primary">Registrar</button></div></form>');

    document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);
    document.getElementById('pago-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var payload = Object.fromEntries(fd.entries());
      payload.clienteId = cuentasClienteId;
      payload.concepto = 'Pago recibido';
      try {
        await AyData.registrarPago(payload);
        toast('Pago registrado y aplicado a la deuda más antigua.');
        closeModal();
        renderCuentasBody();
      } catch (err) { toast(err.message, true); }
    });
  }

  function waLink(phone, text) {
    var digits = (phone || '').replace(/\D/g, '');
    if (digits && !digits.startsWith('54')) digits = '549' + digits;
    return 'https://wa.me/' + digits + '?text=' + encodeURIComponent(text);
  }

  function mostrarMensajeCobro(saldo) {
    var cliente = AyData.state.clientes.find(function (c) { return c.id === cuentasClienteId; });
    var cfg = AyData.state.config;
    var texto = 'Hola' + (cliente && cliente.contactoNombre ? ' ' + cliente.contactoNombre : '') + ', te escribimos de AdminYAAA.\n\n' +
      'Te recordamos que ' + (cliente ? cliente.nombreComercial : 'tu cuenta') + ' tiene un saldo pendiente de ' + fmtMoneda(saldo) + '.\n\n' +
      'Datos para transferir:\n' +
      'Titular: ' + (cfg.banco_titular || '[completar]') + '\n' +
      'CUIT/CUIL: ' + (cfg.banco_cuit || '[completar]') + '\n' +
      'CBU/CVU: ' + (cfg.banco_cbu || '[completar]') + '\n' +
      'Alias: ' + (cfg.banco_alias || '[completar]') + '\n' +
      'Banco: ' + (cfg.banco_nombre || '[completar]') + '\n' +
      'Monto: ' + fmtMoneda(saldo) + '\n\n' +
      'Cualquier duda, quedamos a disposición. ¡Gracias!';

    document.getElementById('mensaje-cobro-box').innerHTML = '' +
      '<div class="card"><h2 class="section-title">Mensaje de cobro</h2>' +
      '<textarea id="cobro-texto" rows="12" style="width:100%; font-family:var(--font); padding:10px; border:1px solid var(--slate-200); border-radius:6px;">' + texto + '</textarea>' +
      '<div class="modal-actions" style="justify-content:flex-start; margin-top:10px">' +
      '<button class="btn btn-primary" id="btn-copiar-cobro">Copiar mensaje</button> ' +
      (cliente && cliente.contactoWhatsapp ? '<a class="btn btn-secondary" id="btn-abrir-wsp" target="_blank">Abrir en WhatsApp</a>' : '') +
      '</div></div>';

    document.getElementById('btn-copiar-cobro').addEventListener('click', function () {
      navigator.clipboard.writeText(document.getElementById('cobro-texto').value).then(function () { toast('Mensaje copiado al portapapeles.'); });
    });
    var btnWsp = document.getElementById('btn-abrir-wsp');
    if (btnWsp) btnWsp.href = waLink(cliente.contactoWhatsapp, texto);
  }

  /* ---------- Vista: Sueldos y préstamos (solo admin) ---------- */
  var BILLETES = [20000, 10000, 2000, 1000, 500, 200, 100, 50, 20, 10];

  function desgloseEfectivo(monto) {
    var restante = Math.max(0, Math.round(monto));
    return BILLETES.map(function (b) {
      var cantidad = Math.floor(restante / b);
      restante -= cantidad * b;
      return { billete: b, cantidad: cantidad };
    }).filter(function (x) { return x.cantidad > 0; });
  }

  function renderSueldos() {
    main.innerHTML = '' +
      '<div class="page-header"><div><h1 class="page-title">Sueldos y préstamos</h1>' +
      '<div class="page-sub">Solo visible para el administrador principal</div></div></div>' +
      '<div class="card" style="margin-bottom:16px">' +
      '<div class="page-header" style="margin-bottom:12px"><h2 class="section-title" style="margin:0">Préstamos al personal</h2>' +
      '<button class="btn btn-primary" id="btn-nuevo-prestamo">+ Nuevo préstamo</button></div>' +
      '<div id="prestamos-table"></div></div>' +
      '<div class="card" style="margin-bottom:16px">' +
      '<h2 class="section-title">Generar liquidación</h2>' +
      '<form id="liquidacion-form" class="presupuesto-item-row" style="grid-template-columns: 1.4fr 1fr 1fr auto; align-items:end">' +
      '<div class="field" style="margin-bottom:0"><label>Operador</label><select name="operadorId" required>' +
      AyData.state.usuarios.map(function (u) { return '<option value="' + u.id + '">' + u.nombre + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="field" style="margin-bottom:0"><label>Período</label><input type="month" name="periodo" value="' + hoyISO().slice(0, 7) + '" required></div>' +
      '<div class="field" style="margin-bottom:0"><label>Adicionales</label><input type="number" name="adicionales" value="0"></div>' +
      '<button type="submit" class="btn btn-primary">Generar</button>' +
      '</form></div>' +
      '<div class="card"><h2 class="section-title">Liquidaciones generadas</h2><div id="liquidaciones-table"></div></div>' +
      '<div id="sobre-efectivo-box"></div>';

    renderPrestamosTable();
    renderLiquidacionesTable();

    document.getElementById('btn-nuevo-prestamo').addEventListener('click', openPrestamoModal);
    document.getElementById('liquidacion-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var payload = Object.fromEntries(fd.entries());
      try {
        await AyData.addLiquidacion(payload);
        toast('Liquidación generada.');
        renderPrestamosTable();
        renderLiquidacionesTable();
      } catch (err) { toast(err.message, true); }
    });
  }

  function renderPrestamosTable() {
    var box = document.getElementById('prestamos-table');
    if (!AyData.state.prestamos.length) {
      box.innerHTML = '<div class="empty-state">Todavía no hay préstamos cargados.</div>';
      return;
    }
    var rows = AyData.state.prestamos.map(function (p) {
      return '<tr>' +
        '<td>' + usuarioNombre(p.operadorId) + '</td>' +
        '<td class="text-right mono">' + fmtMoneda(p.montoTotal) + '</td>' +
        '<td class="text-right mono">' + fmtMoneda(p.valorCuota) + '</td>' +
        '<td class="text-right mono">' + p.cuotasPagadas + ' / ' + p.cuotas + '</td>' +
        '<td><span class="badge ' + (p.estado === 'saldado' ? 'badge-cobrado' : 'badge-pendiente') + '">' + capitalize(p.estado) + '</span></td>' +
        '</tr>';
    }).join('');
    box.innerHTML = '<table><thead><tr><th>Operador</th><th class="text-right">Monto total</th><th class="text-right">Valor cuota</th><th class="text-right">Cuotas</th><th>Estado</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  function openPrestamoModal() {
    openModal('' +
      '<h3>Nuevo préstamo</h3>' +
      '<form id="prestamo-form">' +
      '<div class="field"><label>Operador</label><select name="operadorId" required>' +
      AyData.state.usuarios.map(function (u) { return '<option value="' + u.id + '">' + u.nombre + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="field"><label>Monto total (ARS)</label><input type="number" name="montoTotal" required></div>' +
      '<div class="field"><label>Cantidad de cuotas</label><input type="number" name="cuotas" value="3" required></div>' +
      '<div class="modal-actions">' +
      '<button type="button" class="btn btn-secondary" id="btn-cancel-modal">Cancelar</button>' +
      '<button type="submit" class="btn btn-primary">Otorgar préstamo</button></div></form>');

    document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);
    document.getElementById('prestamo-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      try {
        await AyData.addPrestamo(Object.fromEntries(fd.entries()));
        toast('Préstamo otorgado.');
        closeModal();
        renderPrestamosTable();
      } catch (err) { toast(err.message, true); }
    });
  }

  function renderLiquidacionesTable() {
    var box = document.getElementById('liquidaciones-table');
    if (!AyData.state.liquidaciones.length) {
      box.innerHTML = '<div class="empty-state">Todavía no generaste ninguna liquidación.</div>';
      return;
    }
    var rows = AyData.state.liquidaciones.map(function (l) {
      return '<tr>' +
        '<td>' + usuarioNombre(l.operadorId) + '</td>' +
        '<td>' + l.periodo + '</td>' +
        '<td class="text-right mono">' + fmtMoneda(l.sueldoBase) + '</td>' +
        '<td class="text-right mono">+' + fmtMoneda(l.adicionales) + '</td>' +
        '<td class="text-right mono">-' + fmtMoneda(l.descuentosAusencias) + '</td>' +
        '<td class="text-right mono">-' + fmtMoneda(l.descuentosPrestamo) + '</td>' +
        '<td class="text-right mono" style="font-weight:700">' + fmtMoneda(l.neto) + '</td>' +
        '<td><span class="badge ' + (l.estado === 'pagado' ? 'badge-cobrado' : 'badge-pendiente') + '">' + capitalize(l.estado) + '</span></td>' +
        '<td class="text-right">' +
        (l.estado === 'pendiente' ? '<button class="btn btn-secondary" data-pagar="' + l.id + '">Marcar pagado</button> ' : '') +
        '<button class="btn btn-secondary" data-sobre="' + l.id + '">Sobre de efectivo</button></td></tr>';
    }).join('');
    box.innerHTML = '<table><thead><tr><th>Operador</th><th>Período</th><th class="text-right">Base</th><th class="text-right">Adic.</th>' +
      '<th class="text-right">Ausencias</th><th class="text-right">Préstamo</th><th class="text-right">Neto</th><th>Estado</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>';

    box.querySelectorAll('[data-pagar]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        try {
          await AyData.marcarLiquidacionPagada(btn.dataset.pagar);
          toast('Liquidación marcada como pagada.');
          renderLiquidacionesTable();
        } catch (e) { toast(e.message, true); }
      });
    });
    box.querySelectorAll('[data-sobre]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var liq = AyData.state.liquidaciones.find(function (l) { return l.id === btn.dataset.sobre; });
        mostrarSobreEfectivo(liq);
      });
    });
  }

  function mostrarSobreEfectivo(liq) {
    var desglose = desgloseEfectivo(liq.neto);
    var rows = desglose.map(function (d) {
      return '<tr><td>$' + d.billete.toLocaleString('es-AR') + '</td><td class="text-right mono">x' + d.cantidad + '</td>' +
        '<td class="text-right mono">' + fmtMoneda(d.billete * d.cantidad) + '</td></tr>';
    }).join('');
    document.getElementById('sobre-efectivo-box').innerHTML = '' +
      '<div class="card"><h2 class="section-title">Sobre de efectivo — ' + usuarioNombre(liq.operadorId) + ' (' + liq.periodo + ')</h2>' +
      '<table><thead><tr><th>Billete</th><th class="text-right">Cantidad</th><th class="text-right">Subtotal</th></tr></thead><tbody>' + rows + '</tbody>' +
      '<tfoot><tr class="totales"><td colspan="2" style="text-align:right;font-weight:700;padding:8px">Total</td><td class="text-right mono" style="font-weight:700">' + fmtMoneda(liq.neto) + '</td></tr></tfoot></table></div>';
  }

  /* ---------- Vista: Cajas chicas ---------- */
  function renderCajas() {
    var esAdmin = AyData.state.user.rol === 'admin';
    main.innerHTML = '' +
      '<div class="page-header"><div><h1 class="page-title">Cajas chicas</h1>' +
      '<div class="page-sub">Fondos asignados a cada operador para gastos menores</div></div>' +
      (esAdmin ? '<button class="btn btn-primary" id="btn-nueva-caja">+ Asignar caja chica</button>' : '') +
      '</div>' +
      '<div class="card" style="margin-bottom:16px"><div id="cajas-table"></div></div>' +
      '<div class="card"><h2 class="section-title">Rendiciones recientes</h2><div id="rendiciones-table"></div></div>';

    renderCajasTable();
    renderRendicionesTable();
    if (esAdmin) document.getElementById('btn-nueva-caja').addEventListener('click', openCajaModal);
  }

  function renderCajasTable() {
    var esAdmin = AyData.state.user.rol === 'admin';
    var box = document.getElementById('cajas-table');
    if (!AyData.state.cajas.length) {
      box.innerHTML = '<div class="empty-state">Todavía no hay cajas chicas asignadas.</div>';
      return;
    }
    var rows = AyData.state.cajas.map(function (c) {
      var bajo = c.saldoActual <= c.tope * 0.2;
      return '<tr>' +
        '<td>' + usuarioNombre(c.operadorId) + '</td>' +
        '<td class="text-right mono">' + fmtMoneda(c.tope) + '</td>' +
        '<td class="text-right mono' + (bajo ? ' stock-low' : '') + '">' + fmtMoneda(c.saldoActual) + (bajo ? ' ⚠' : '') + '</td>' +
        '<td class="text-right">' +
        '<button class="btn btn-secondary" data-rendir="' + c.id + '">Rendir gasto</button> ' +
        (esAdmin ? '<button class="btn btn-secondary" data-reponer="' + c.id + '">Reponer al tope</button>' : '') +
        '</td></tr>';
    }).join('');
    box.innerHTML = '<table><thead><tr><th>Operador</th><th class="text-right">Tope</th><th class="text-right">Saldo actual</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>';

    box.querySelectorAll('[data-rendir]').forEach(function (btn) {
      btn.addEventListener('click', function () { openRendicionModal(btn.dataset.rendir); });
    });
    box.querySelectorAll('[data-reponer]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        try {
          await AyData.reponerCaja(btn.dataset.reponer);
          toast('Fondo repuesto al tope.');
          renderCajasTable();
        } catch (e) { toast(e.message, true); }
      });
    });
  }

  function openCajaModal() {
    var operadoresSinCaja = AyData.state.usuarios.filter(function (u) {
      return !AyData.state.cajas.some(function (c) { return c.operadorId === u.id; });
    });
    if (!operadoresSinCaja.length) { toast('Todos los operadores ya tienen una caja chica asignada.', true); return; }
    openModal('' +
      '<h3>Asignar caja chica</h3>' +
      '<form id="caja-form">' +
      '<div class="field"><label>Operador</label><select name="operadorId" required>' +
      operadoresSinCaja.map(function (u) { return '<option value="' + u.id + '">' + u.nombre + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="field"><label>Tope del fondo (ARS)</label><input type="number" name="tope" required></div>' +
      '<div class="modal-actions">' +
      '<button type="button" class="btn btn-secondary" id="btn-cancel-modal">Cancelar</button>' +
      '<button type="submit" class="btn btn-primary">Asignar</button></div></form>');

    document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);
    document.getElementById('caja-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      try {
        await AyData.addCaja(Object.fromEntries(fd.entries()));
        toast('Caja chica asignada.');
        closeModal();
        renderCajasTable();
      } catch (err) { toast(err.message, true); }
    });
  }

  function openRendicionModal(cajaId) {
    openModal('' +
      '<h3>Rendir gasto</h3>' +
      '<form id="rendicion-form">' +
      '<div class="field"><label>Fecha</label><input type="date" name="fecha" value="' + hoyISO() + '" required></div>' +
      '<div class="field"><label>Motivo</label><input name="motivo" required placeholder="Ej: insumos de oficina"></div>' +
      '<div class="field"><label>Monto (ARS)</label><input type="number" name="monto" required></div>' +
      '<div class="field"><label>Comprobante</label><input name="comprobante" placeholder="N° de ticket/factura"></div>' +
      '<div class="modal-actions">' +
      '<button type="button" class="btn btn-secondary" id="btn-cancel-modal">Cancelar</button>' +
      '<button type="submit" class="btn btn-primary">Registrar</button></div></form>');

    document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);
    document.getElementById('rendicion-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      try {
        await AyData.rendirGasto(cajaId, Object.fromEntries(fd.entries()));
        toast('Gasto rendido.');
        closeModal();
        renderCajasTable();
        renderRendicionesTable();
      } catch (err) { toast(err.message, true); }
    });
  }

  function renderRendicionesTable() {
    var box = document.getElementById('rendiciones-table');
    if (!AyData.state.rendiciones.length) {
      box.innerHTML = '<div class="empty-state">Todavía no hay rendiciones cargadas.</div>';
      return;
    }
    var cajaOperador = {};
    AyData.state.cajas.forEach(function (c) { cajaOperador[c.id] = c.operadorId; });
    var rows = AyData.state.rendiciones.map(function (r) {
      return '<tr><td>' + fmtFecha(r.fecha) + '</td><td>' + usuarioNombre(cajaOperador[r.cajaId]) + '</td>' +
        '<td>' + r.motivo + '</td><td class="text-right mono">' + fmtMoneda(r.monto) + '</td></tr>';
    }).join('');
    box.innerHTML = '<table><thead><tr><th>Fecha</th><th>Operador</th><th>Motivo</th><th class="text-right">Monto</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  /* ---------- Vista: Presentismo ---------- */
  function renderPresentismo() {
    main.innerHTML = '' +
      '<div class="page-header"><div><h1 class="page-title">Presentismo</h1>' +
      '<div class="page-sub">Registro de faltas y demoras del equipo</div></div></div>' +
      '<div class="card" style="margin-bottom:16px">' +
      '<h2 class="section-title">Nuevo registro</h2>' +
      '<form id="presentismo-form" class="presupuesto-item-row" style="grid-template-columns: 1.2fr 1fr 1fr 1.6fr auto; align-items:end">' +
      '<div class="field" style="margin-bottom:0"><label>Operador</label><select name="operadorId" required>' +
      AyData.state.usuarios.map(function (u) { return '<option value="' + u.id + '">' + u.nombre + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="field" style="margin-bottom:0"><label>Fecha</label><input type="date" name="fecha" value="' + hoyISO() + '" required></div>' +
      '<div class="field" style="margin-bottom:0"><label>Tipo</label><select name="tipo"><option value="falta">Falta</option><option value="demora">Demora</option></select></div>' +
      '<div class="field" style="margin-bottom:0"><label>Motivo</label><input name="motivo" placeholder="Opcional"></div>' +
      '<button type="submit" class="btn btn-primary">Registrar</button>' +
      '</form></div>' +
      '<div class="card" style="margin-bottom:16px"><h2 class="section-title">Resumen del mes</h2><div id="presentismo-resumen"></div></div>' +
      '<div class="card"><h2 class="section-title">Historial</h2><div id="presentismo-tabla"></div></div>';

    document.getElementById('presentismo-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      try {
        await AyData.addPresentismo(Object.fromEntries(fd.entries()));
        toast('Registro guardado.');
        renderPresentismoResumen();
        renderPresentismoTabla();
      } catch (err) { toast(err.message, true); }
    });

    renderPresentismoResumen();
    renderPresentismoTabla();
  }

  function renderPresentismoResumen() {
    var mesActual = hoyISO().slice(0, 7);
    var box = document.getElementById('presentismo-resumen');
    var porOperador = {};
    AyData.state.presentismo.filter(function (p) { return p.fecha.startsWith(mesActual); }).forEach(function (p) {
      porOperador[p.operadorId] = porOperador[p.operadorId] || { falta: 0, demora: 0 };
      porOperador[p.operadorId][p.tipo]++;
    });
    var ids = Object.keys(porOperador);
    if (!ids.length) { box.innerHTML = '<div class="empty-state">Sin faltas ni demoras este mes.</div>'; return; }
    var rows = ids.map(function (id) {
      return '<tr><td>' + usuarioNombre(id) + '</td><td class="text-right mono">' + porOperador[id].falta + '</td><td class="text-right mono">' + porOperador[id].demora + '</td></tr>';
    }).join('');
    box.innerHTML = '<table><thead><tr><th>Operador</th><th class="text-right">Faltas</th><th class="text-right">Demoras</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  function renderPresentismoTabla() {
    var box = document.getElementById('presentismo-tabla');
    if (!AyData.state.presentismo.length) {
      box.innerHTML = '<div class="empty-state">Todavía no hay registros.</div>';
      return;
    }
    var rows = AyData.state.presentismo.map(function (p) {
      return '<tr><td>' + fmtFecha(p.fecha) + '</td><td>' + usuarioNombre(p.operadorId) + '</td>' +
        '<td><span class="badge ' + (p.tipo === 'falta' ? 'badge-rechazado' : 'badge-pendiente') + '">' + capitalize(p.tipo) + '</span></td>' +
        '<td>' + (p.motivo || '—') + '</td>' +
        '<td class="text-right"><button class="btn btn-danger" data-deshacer="' + p.id + '">Deshacer</button></td></tr>';
    }).join('');
    box.innerHTML = '<table><thead><tr><th>Fecha</th><th>Operador</th><th>Tipo</th><th>Motivo</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>';

    box.querySelectorAll('[data-deshacer]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        try {
          await AyData.deletePresentismo(btn.dataset.deshacer);
          toast('Registro eliminado.');
          renderPresentismoResumen();
          renderPresentismoTabla();
        } catch (e) { toast(e.message, true); }
      });
    });
  }

  /* ---------- Vista: Gastos operativos ---------- */
  function renderGastos() {
    main.innerHTML = '' +
      '<div class="page-header"><div><h1 class="page-title">Gastos operativos</h1>' +
      '<div class="page-sub">Licencias, servidores, telefonía, insumos y marketing del negocio</div></div>' +
      '<button class="btn btn-primary" id="btn-nuevo-gasto">+ Nuevo gasto</button></div>' +
      '<div class="card"><div id="gastos-table"></div></div>';

    document.getElementById('btn-nuevo-gasto').addEventListener('click', openGastoModal);
    renderGastosTable();
  }

  function renderGastosTable() {
    var box = document.getElementById('gastos-table');
    var gastos = AyData.state.gastos.slice().sort(function (a, b) { return (a.vencimiento || '') < (b.vencimiento || '') ? -1 : 1; });
    if (!gastos.length) {
      box.innerHTML = '<div class="empty-state">Todavía no cargaste ningún gasto.</div>';
      return;
    }
    var rows = gastos.map(function (g) {
      return '<tr>' +
        '<td>' + g.categoria + '</td>' +
        '<td>' + (g.proveedor || '—') + '</td>' +
        '<td class="text-right mono">' + fmtMoneda(g.monto) + '</td>' +
        '<td>' + (g.vencimiento ? fmtFecha(g.vencimiento) : '—') + '</td>' +
        '<td><span class="badge ' + (g.estado === 'pagado' ? 'badge-cobrado' : 'badge-pendiente') + '">' + capitalize(g.estado) + '</span></td>' +
        '<td class="text-right">' +
        (g.estado === 'pendiente' ? '<button class="btn btn-secondary" data-pagar-gasto="' + g.id + '">Marcar pagado</button> ' : '') +
        '<button class="btn btn-danger" data-del-gasto="' + g.id + '">Eliminar</button></td></tr>';
    }).join('');
    box.innerHTML = '<table><thead><tr><th>Categoría</th><th>Proveedor</th><th class="text-right">Monto</th><th>Vencimiento</th><th>Estado</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>';

    box.querySelectorAll('[data-pagar-gasto]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        try { await AyData.updateGastoEstado(btn.dataset.pagarGasto, 'pagado'); toast('Gasto marcado como pagado.'); renderGastosTable(); }
        catch (e) { toast(e.message, true); }
      });
    });
    box.querySelectorAll('[data-del-gasto]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!confirm('¿Eliminar este gasto?')) return;
        try { await AyData.deleteGasto(btn.dataset.delGasto); toast('Gasto eliminado.'); renderGastosTable(); }
        catch (e) { toast(e.message, true); }
      });
    });
  }

  function openGastoModal() {
    openModal('' +
      '<h3>Nuevo gasto operativo</h3>' +
      '<form id="gasto-form">' +
      field('categoria', 'Categoría', null, true) +
      field('proveedor', 'Proveedor') +
      field('monto', 'Monto (ARS)', null, true, 'number') +
      '<div class="field"><label>Fecha de vencimiento</label><input type="date" name="vencimiento"></div>' +
      '<div class="modal-actions">' +
      '<button type="button" class="btn btn-secondary" id="btn-cancel-modal">Cancelar</button>' +
      '<button type="submit" class="btn btn-primary">Guardar</button></div></form>');

    document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);
    document.getElementById('gasto-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      try {
        await AyData.addGasto(Object.fromEntries(fd.entries()));
        toast('Gasto cargado.');
        closeModal();
        renderGastosTable();
      } catch (err) { toast(err.message, true); }
    });
  }

  /* ---------- Vista: Finanzas de socios (solo admin) ---------- */
  function renderSocios() {
    var socios = AyData.state.usuarios.filter(function (u) { return u.rol === 'admin'; });
    main.innerHTML = '' +
      '<div class="page-header"><div><h1 class="page-title">Finanzas de socios</h1>' +
      '<div class="page-sub">Retiros, gastos personales y proyección de flujo de caja — solo administrador</div></div>' +
      '<button class="btn btn-primary" id="btn-nuevo-retiro">+ Registrar retiro / gasto</button></div>' +
      '<div class="card" style="margin-bottom:16px"><h2 class="section-title">Retiros y gastos personales</h2><div id="retiros-table"></div></div>' +
      '<div class="card"><h2 class="section-title">Proyección de flujo de caja (90 días)</h2><div id="cashflow-box"></div></div>';

    renderRetirosTable(socios);
    renderCashflow();
    document.getElementById('btn-nuevo-retiro').addEventListener('click', function () { openRetiroModal(socios); });
  }

  function renderRetirosTable(socios) {
    var box = document.getElementById('retiros-table');
    if (!AyData.state.retiros.length) {
      box.innerHTML = '<div class="empty-state">Todavía no hay retiros cargados.</div>';
      return;
    }
    var rows = AyData.state.retiros.map(function (r) {
      return '<tr><td>' + fmtFecha(r.fecha) + '</td><td>' + usuarioNombre(r.socioId) + '</td>' +
        '<td><span class="badge ' + (r.tipo === 'retiro' ? 'badge-pendiente' : 'badge-rechazado') + '">' + (r.tipo === 'retiro' ? 'Retiro' : 'Gasto personal') + '</span></td>' +
        '<td class="text-right mono">' + fmtMoneda(r.monto) + '</td><td>' + (r.nota || '—') + '</td></tr>';
    }).join('');
    box.innerHTML = '<table><thead><tr><th>Fecha</th><th>Socio</th><th>Tipo</th><th class="text-right">Monto</th><th>Nota</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  function openRetiroModal(socios) {
    openModal('' +
      '<h3>Registrar retiro o gasto personal</h3>' +
      '<form id="retiro-form">' +
      '<div class="field"><label>Socio</label><select name="socioId" required>' +
      socios.map(function (u) { return '<option value="' + u.id + '">' + u.nombre + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="field"><label>Tipo</label><select name="tipo"><option value="retiro">Retiro</option><option value="gasto_personal">Gasto personal aislado</option></select></div>' +
      '<div class="field"><label>Fecha</label><input type="date" name="fecha" value="' + hoyISO() + '" required></div>' +
      '<div class="field"><label>Monto (ARS)</label><input type="number" name="monto" required></div>' +
      '<div class="field"><label>Nota</label><input name="nota" placeholder="Opcional"></div>' +
      '<div class="modal-actions">' +
      '<button type="button" class="btn btn-secondary" id="btn-cancel-modal">Cancelar</button>' +
      '<button type="submit" class="btn btn-primary">Registrar</button></div></form>');

    document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);
    document.getElementById('retiro-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      try {
        await AyData.addRetiro(Object.fromEntries(fd.entries()));
        toast('Movimiento registrado.');
        closeModal();
        renderRetirosTable(AyData.state.usuarios.filter(function (u) { return u.rol === 'admin'; }));
      } catch (err) { toast(err.message, true); }
    });
  }

  function renderCashflow() {
    var ingresoMensual = AyData.state.clientes
      .filter(function (c) { return c.tipoContrato === 'abono'; })
      .reduce(function (s, c) { return s + c.montoAbono; }, 0);

    var hoy = new Date();
    var meses = [0, 1, 2].map(function (offset) {
      var d = new Date(hoy.getFullYear(), hoy.getMonth() + offset, 1);
      return { year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }) };
    });

    var box = document.getElementById('cashflow-box');
    var rows = meses.map(function (m) {
      var gastosDelMes = AyData.state.gastos.filter(function (g) {
        if (!g.vencimiento || g.estado === 'pagado') return false;
        var v = new Date(g.vencimiento + 'T00:00:00');
        return v.getFullYear() === m.year && v.getMonth() === m.month;
      }).reduce(function (s, g) { return s + g.monto; }, 0);
      var resultado = ingresoMensual - gastosDelMes;
      return '<tr><td>' + capitalize(m.label) + '</td>' +
        '<td class="text-right mono">' + fmtMoneda(ingresoMensual) + '</td>' +
        '<td class="text-right mono">' + fmtMoneda(gastosDelMes) + '</td>' +
        '<td class="text-right mono" style="font-weight:700; color:' + (resultado >= 0 ? 'var(--emerald-600)' : 'var(--red-500)') + '">' + fmtMoneda(resultado) + '</td></tr>';
    }).join('');
    box.innerHTML = '' +
      '<p style="color:var(--navy-600); font-size:13px; margin-top:0">Estimado a partir de los abonos mensuales recurrentes activos y los gastos operativos con vencimiento cargado. No incluye trabajos puntuales todavía sin facturar.</p>' +
      '<table><thead><tr><th>Mes</th><th class="text-right">Ingresos por abonos</th><th class="text-right">Gastos programados</th><th class="text-right">Resultado proyectado</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  /* ---------- Vista: Tesorería ---------- */
  function renderTesoreria() {
    var esAdmin = AyData.state.user.rol === 'admin';
    var totalConsolidado = AyData.state.cuentas.reduce(function (s, c) { return s + c.saldo; }, 0);
    var rows = AyData.state.cuentas.map(function (c) {
      return '<tr><td>' + c.nombre + '</td><td>' + capitalize(c.tipo.replace('_', ' ')) + '</td>' +
        '<td class="text-right mono">' + fmtMoneda(c.saldo) + '</td>' +
        (esAdmin ? '<td class="text-right"><button class="btn btn-secondary" data-ajustar="' + c.id + '">Ajustar saldo</button></td>' : '') +
        '</tr>';
    }).join('');
    main.innerHTML = '' +
      '<div class="page-header"><div><h1 class="page-title">Tesorería</h1>' +
      '<div class="page-sub">Cuentas de dinero de AdminYAAA y su saldo consolidado</div></div></div>' +
      '<div class="grid-metrics"><div class="metric-card">' +
      '<div class="metric-label">Saldo consolidado</div><div class="metric-value accent">' + fmtMoneda(totalConsolidado) + '</div></div></div>' +
      '<div class="card"><table><thead><tr><th>Cuenta</th><th>Tipo</th><th class="text-right">Saldo</th>' + (esAdmin ? '<th></th>' : '') + '</tr></thead><tbody>' + rows + '</tbody></table></div>';

    if (esAdmin) {
      main.querySelectorAll('[data-ajustar]').forEach(function (btn) {
        btn.addEventListener('click', function () { openAjusteModal(btn.dataset.ajustar); });
      });
    }
  }

  function openAjusteModal(cuentaId) {
    var cuenta = AyData.state.cuentas.find(function (c) { return c.id === cuentaId; });
    openModal('' +
      '<h3>Ajustar saldo — ' + cuenta.nombre + '</h3>' +
      '<p style="color:var(--navy-600); font-size:13px">Saldo actual: ' + fmtMoneda(cuenta.saldo) + '. Usalo solo para conciliar contra el extracto real de la cuenta.</p>' +
      '<form id="ajuste-form">' +
      '<div class="field"><label>Nuevo saldo (ARS)</label><input type="number" name="nuevoSaldo" value="' + cuenta.saldo + '" required></div>' +
      '<div class="field"><label>Motivo del ajuste</label><input name="motivo" placeholder="Ej: conciliación con extracto bancario"></div>' +
      '<div class="modal-actions">' +
      '<button type="button" class="btn btn-secondary" id="btn-cancel-modal">Cancelar</button>' +
      '<button type="submit" class="btn btn-primary">Ajustar</button></div></form>');

    document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);
    document.getElementById('ajuste-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var payload = Object.fromEntries(fd.entries());
      try {
        await AyData.ajustarCuenta(cuentaId, payload);
        toast('Saldo ajustado.');
        closeModal();
        renderTesoreria();
      } catch (err) { toast(err.message, true); }
    });
  }

  /* ---------- Vista: Usuarios y roles (auditoría de permisos, solo admin) ---------- */
  function renderUsuarios() {
    main.innerHTML = '' +
      '<div class="page-header"><div><h1 class="page-title">Usuarios y roles</h1>' +
      '<div class="page-sub">Quién tiene acceso al sistema y qué puede ver cada rol</div></div>' +
      '<button class="btn btn-primary" id="btn-nuevo-usuario">+ Nuevo usuario</button></div>' +
      '<div class="card" style="margin-bottom:16px">' +
      '<h2 class="section-title">Qué ve cada rol</h2>' +
      '<p style="font-size:13px; color:var(--navy-600); margin:0 0 6px">' +
      '<strong>Administrador:</strong> acceso total, incluye métricas ejecutivas, sueldos del equipo, finanzas de socios y control ejecutivo.</p>' +
      '<p style="font-size:13px; color:var(--navy-600); margin:0">' +
      '<strong>Operador:</strong> clientes, tareas asignadas y planillas operativas — sin ver márgenes globales, ingresos de la empresa, sueldos de otros ni finanzas de socios.</p>' +
      '</div>' +
      '<div class="card"><div id="usuarios-table"></div></div>';

    renderUsuariosTable();
    document.getElementById('btn-nuevo-usuario').addEventListener('click', openUsuarioModal);
  }

  function renderUsuariosTable() {
    var box = document.getElementById('usuarios-table');
    var rows = AyData.state.usuariosTodos.map(function (u) {
      return '<tr' + (!u.activo ? ' style="opacity:.5"' : '') + '>' +
        '<td>' + u.nombre + '</td><td>' + u.email + '</td>' +
        '<td><span class="badge ' + (u.rol === 'admin' ? 'badge-cobrado' : 'badge-pendiente') + '">' + capitalize(u.rol) + '</span></td>' +
        '<td>' + (u.cargo || '—') + '</td>' +
        '<td>' + (u.activo ? 'Activo' : 'Desactivado') + '</td>' +
        '<td class="text-right">' +
        '<select class="cambiar-rol" data-id="' + u.id + '"><option value="operador"' + (u.rol === 'operador' ? ' selected' : '') + '>Operador</option><option value="admin"' + (u.rol === 'admin' ? ' selected' : '') + '>Admin</option></select> ' +
        '<button class="btn btn-secondary" data-toggle="' + u.id + '" data-activo="' + u.activo + '">' + (u.activo ? 'Desactivar' : 'Reactivar') + '</button></td></tr>';
    }).join('');
    box.innerHTML = '<table><thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Cargo</th><th>Estado</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>';

    box.querySelectorAll('.cambiar-rol').forEach(function (sel) {
      sel.addEventListener('change', async function () {
        try { await AyData.updateUsuario(sel.dataset.id, { rol: sel.value }); toast('Rol actualizado.'); renderUsuariosTable(); }
        catch (e) { toast(e.message, true); renderUsuariosTable(); }
      });
    });
    box.querySelectorAll('[data-toggle]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var activoActual = btn.dataset.activo === 'true';
        try {
          await AyData.updateUsuario(btn.dataset.toggle, { activo: !activoActual });
          toast(activoActual ? 'Usuario desactivado.' : 'Usuario reactivado.');
          renderUsuariosTable();
        } catch (e) { toast(e.message, true); }
      });
    });
  }

  function openUsuarioModal() {
    openModal('' +
      '<h3>Nuevo usuario interno</h3>' +
      '<form id="usuario-form">' +
      field('nombre', 'Nombre', null, true) +
      field('email', 'Email', null, true, 'email') +
      field('password', 'Contraseña provisoria', null, true, 'password') +
      '<div class="field"><label>Rol</label><select name="rol"><option value="operador">Operador</option><option value="admin">Admin</option></select></div>' +
      field('cargo', 'Cargo') +
      field('sueldoBase', 'Sueldo base (ARS)', 0, false, 'number') +
      '<div class="modal-actions">' +
      '<button type="button" class="btn btn-secondary" id="btn-cancel-modal">Cancelar</button>' +
      '<button type="submit" class="btn btn-primary">Crear usuario</button></div></form>');

    document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);
    document.getElementById('usuario-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      try {
        await AyData.addUsuario(Object.fromEntries(fd.entries()));
        toast('Usuario creado.');
        closeModal();
        renderUsuariosTable();
      } catch (err) { toast(err.message, true); }
    });
  }

  /* ---------- Vista: próximamente ---------- */
  function renderSoon(label) {
    main.innerHTML = '<div class="soon-panel"><h2>' + label + '</h2>' +
      '<p>Este módulo todavía no está construido — es parte de las fases siguientes del desarrollo.</p></div>';
  }

  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ---------- Navegación ---------- */
  var VIEWS = {
    dashboard: renderDashboard, clientes: renderClientes, tareas: renderTareas, presupuestador: renderPresupuestador,
    planilla: renderPlanilla, cuentas: renderCuentas, sueldos: renderSueldos, cajas: renderCajas, presentismo: renderPresentismo,
    gastos: renderGastos, socios: renderSocios, tesoreria: renderTesoreria, usuarios: renderUsuarios,
  };

  function setActiveNav(el) {
    document.querySelectorAll('.nav-item').forEach(function (n) { n.classList.remove('is-active'); });
    el.classList.add('is-active');
  }

  function initNav() {
    document.querySelectorAll('.nav-item').forEach(function (item) {
      item.addEventListener('click', function () {
        setActiveNav(item);
        var view = item.dataset.view;
        if (view === 'soon') renderSoon(item.dataset.label);
        else VIEWS[view]();
      });
    });
  }

  async function init() {
    try {
      await AyData.loadState();
    } catch (e) {
      return;
    }
    document.getElementById('sidebar-user-name').textContent = AyData.state.user.nombre;
    document.getElementById('sidebar-user-role').textContent = AyData.state.user.rol === 'admin' ? 'Administrador principal' : 'Operador / Asistente';
    document.getElementById('btn-logout').addEventListener('click', AyData.logout);

    if (AyData.state.user.rol !== 'admin') {
      document.querySelectorAll('[data-admin-only]').forEach(function (el) { el.style.display = 'none'; });
    }

    initNav();
    var first = document.querySelector('.nav-item[data-view]');
    setActiveNav(first);
    renderDashboard();
  }

  init();
})();
