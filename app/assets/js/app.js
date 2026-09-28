/* AdminYAAA · Panel — router, vistas e interacciones. Vanilla JS, sin dependencias. */

const qs = (sel, root) => (root || document).querySelector(sel);
const qsa = (sel, root) => Array.from((root || document).querySelectorAll(sel));
const icon = (name, cls) => `<svg class="i ${cls || ''}" aria-hidden="true"><use href="#${name}"/></svg>`;
const escapeHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let Ctx = { user: null, role: null, empresa: null };
let PageState = {};

/* Un empleado de AdminYAAA solo tiene acceso a los clientes que tiene designados
   (el campo `responsable` de la empresa), no a toda la cartera. */
function misEmpresas() {
  return AyData.getEmpresas().filter(e => e.responsable === Ctx.user.nombre);
}
function misEmpresaIds() {
  return misEmpresas().map(e => e.id);
}

/* ---------------------------------------------------------------------
   Arranque + sesión
   --------------------------------------------------------------------- */
function boot() {
  const session = AyData.getSession();
  const user = session && AyData.getUser(session.userId);
  if (!user) { window.location.href = 'index.html'; return; }
  setCtx(user);
  buildSidebar();
  wireShell();
  window.addEventListener('hashchange', renderRoute);
  if (!location.hash) location.hash = '#/dashboard';
  renderRoute();
}

function setCtx(user) {
  Ctx.user = user;
  Ctx.role = user.role;
  Ctx.empresa = user.role === 'client' ? AyData.getEmpresa(user.empresaId) : null;
  document.body.classList.toggle('role-client', user.role === 'client');
  document.body.classList.toggle('role-employee', user.role === 'employee');
  qs('#sidebar-role-tag').textContent = user.role === 'client' ? 'Panel cliente' : 'Panel equipo AdminYAAA';
  qs('#user-menu-avatar').textContent = user.iniciales;
  qs('#user-menu-name').textContent = user.nombre.split(' ')[0];
}

function switchUser(userId) {
  AyData.setSession(userId);
  const user = AyData.getUser(userId);
  setCtx(user);
  buildSidebar();
  PageState = {};
  location.hash = '#/dashboard';
  renderRoute();
  toast(`Ahora estás viendo el panel como ${user.nombre}.`);
}

/* ---------------------------------------------------------------------
   Navegación / sidebar
   --------------------------------------------------------------------- */
function navConfig() {
  if (Ctx.role === 'client') {
    const emp = Ctx.empresa;
    const pend = AyData.getRequests(emp.id).filter(r => r.estado === 'nuevo' || r.estado === 'proceso').length;
    const sections = [{ title: null, items: [
      { route: 'dashboard', label: 'Dashboard', icon: 'i-grid' },
      { route: 'documentos', label: 'Documentos', icon: 'i-file' },
      { route: 'reportes', label: 'Reportes', icon: 'i-bar' },
      { route: 'solicitudes', label: 'Solicitudes', icon: 'i-inbox', badge: pend || null },
      { route: 'actividad', label: 'Actividad', icon: 'i-activity' },
    ] }];
    const moduleItems = [];
    if (emp.modulos.includes('stock')) moduleItems.push({ route: 'stock', label: 'Stock', icon: 'i-box' });
    if (emp.modulos.includes('presupuestos')) moduleItems.push({ route: 'presupuestos', label: 'Presupuestos', icon: 'i-calc' });
    if (emp.modulos.includes('cuentas-corrientes')) moduleItems.push({ route: 'cuentas', label: 'Cuentas corrientes', icon: 'i-card' });
    if (moduleItems.length) sections.push({ title: 'Módulos', items: moduleItems });
    sections.push({ title: null, items: [{ route: 'perfil', label: 'Perfil', icon: 'i-user' }] });
    return sections;
  }
  const ids = misEmpresaIds();
  const solicitudesNuevas = AyData.getRequests().filter(r => ids.includes(r.empresaId) && r.estado === 'nuevo').length;
  const tareasPend = AyData.getTasks().filter(t => (t.empresaId == null || ids.includes(t.empresaId)) && t.estado !== 'finalizado').length;
  return [{ title: null, items: [
    { route: 'dashboard', label: 'Dashboard', icon: 'i-grid' },
    { route: 'clientes', label: 'Clientes', icon: 'i-users' },
    { route: 'solicitudes', label: 'Solicitudes', icon: 'i-inbox', badge: solicitudesNuevas || null },
    { route: 'documentos', label: 'Documentos', icon: 'i-file' },
    { route: 'reportes', label: 'Reportes', icon: 'i-bar' },
    { route: 'tareas', label: 'Tareas', icon: 'i-check-sq', badge: tareasPend || null },
    { route: 'actividad', label: 'Actividad', icon: 'i-activity' },
    { route: 'notas', label: 'Notas internas', icon: 'i-note' },
    { route: 'usuarios', label: 'Usuarios', icon: 'i-user-cog' },
  ] }];
}

function buildSidebar() {
  const nav = qs('#sidebar-nav');
  nav.innerHTML = navConfig().map(section => `
    ${section.title ? `<div class="sidebar-section">${section.title}</div>` : ''}
    ${section.items.map(it => `
      <a href="#/${it.route}" data-route="${it.route}">
        ${icon(it.icon)}<span>${it.label}</span>
        ${it.badge ? `<span class="badge-count">${it.badge}</span>` : ''}
      </a>
    `).join('')}
  `).join('');

  const list = qs('#user-menu-list');
  list.innerHTML = AyData.getUsers().map(u => `
    <button class="dropdown-item ${u.id === Ctx.user.id ? 'is-current' : ''}" data-switch-user="${u.id}">
      ${icon(u.role === 'client' ? 'i-building' : 'i-user')}
      <span>${u.nombre}${u.id === Ctx.user.id ? ' (actual)' : ''}</span>
    </button>
  `).join('');
}

function markActiveNav(top) {
  qsa('#sidebar-nav a').forEach(a => a.classList.toggle('is-active', a.dataset.route === top));
}

/* ---------------------------------------------------------------------
   Shell: topbar, menú de usuario, modal, búsqueda global
   --------------------------------------------------------------------- */
function wireShell() {
  qs('#menu-toggle').addEventListener('click', () => {
    qs('#sidebar').classList.add('is-open');
    qs('#sidebar-scrim').classList.add('is-open');
  });
  qs('#sidebar-scrim').addEventListener('click', closeMobileSidebar);
  qs('#sidebar-nav').addEventListener('click', (e) => { if (e.target.closest('a')) closeMobileSidebar(); });

  qs('#user-menu-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    qs('#user-menu-panel').classList.toggle('is-open');
  });
  document.addEventListener('click', () => qs('#user-menu-panel').classList.remove('is-open'));
  qs('#user-menu-panel').addEventListener('click', (e) => e.stopPropagation());
  qs('#user-menu-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-switch-user]');
    if (btn) { qs('#user-menu-panel').classList.remove('is-open'); switchUser(btn.dataset.switchUser); }
  });
  qs('#logout-btn').addEventListener('click', () => { AyData.clearSession(); window.location.href = 'index.html'; });
  qs('#reset-demo-btn').addEventListener('click', () => {
    AyData.reset();
    qs('#user-menu-panel').classList.remove('is-open');
    toast('Se restablecieron los datos de demostración.');
    buildSidebar();
    renderRoute();
  });
  qs('#notif-btn').addEventListener('click', () => toast('No tenés notificaciones nuevas.'));

  qs('#modal-overlay').addEventListener('click', (e) => { if (e.target === qs('#modal-overlay')) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  document.addEventListener('click', (e) => { if (e.target.closest('[data-close-modal]')) closeModal(); });

  const searchInput = qs('#global-search');
  searchInput.addEventListener('input', () => renderGlobalSearch(searchInput.value.trim()));
  searchInput.addEventListener('blur', () => setTimeout(() => { const p = qs('#global-search-panel'); if (p) p.remove(); }, 150));
}

function closeMobileSidebar() {
  qs('#sidebar').classList.remove('is-open');
  qs('#sidebar-scrim').classList.remove('is-open');
}

function renderGlobalSearch(q) {
  let panel = qs('#global-search-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'global-search-panel';
    panel.className = 'dropdown-panel is-open';
    panel.style.cssText = 'position:absolute;top:calc(100% + 8px);left:0;right:0;width:auto;';
    qs('.topbar-search').appendChild(panel);
  }
  if (!q) { panel.remove(); return; }
  const ql = q.toLowerCase();
  const ids = misEmpresaIds();
  const clientes = misEmpresas().filter(e => e.nombre.toLowerCase().includes(ql) || e.rubro.toLowerCase().includes(ql)).slice(0, 4);
  const solicitudes = AyData.getRequests().filter(r => ids.includes(r.empresaId) && r.titulo.toLowerCase().includes(ql)).slice(0, 4);
  const docs = AyData.getDocuments().filter(d => ids.includes(d.empresaId) && d.nombre.toLowerCase().includes(ql)).slice(0, 3);
  if (!clientes.length && !solicitudes.length && !docs.length) {
    panel.innerHTML = `<div class="dropdown-label">Sin resultados para “${escapeHtml(q)}”</div>`;
    return;
  }
  panel.innerHTML = `
    ${clientes.length ? `<div class="dropdown-label">Clientes</div>${clientes.map(c => `<a class="dropdown-item" href="#/clientes/${c.id}">${icon('i-building')}<span>${escapeHtml(c.nombre)}</span></a>`).join('')}` : ''}
    ${solicitudes.length ? `<div class="dropdown-label">Solicitudes</div>${solicitudes.map(r => `<a class="dropdown-item" href="#/solicitudes">${icon('i-inbox')}<span>${escapeHtml(r.titulo)}</span></a>`).join('')}` : ''}
    ${docs.length ? `<div class="dropdown-label">Documentos</div>${docs.map(d => `<a class="dropdown-item" href="#/documentos">${icon('i-file')}<span>${escapeHtml(d.nombre)}</span></a>`).join('')}` : ''}
  `;
}

/* ---------------------------------------------------------------------
   Modal + toast
   --------------------------------------------------------------------- */
function openModal({ title, sub, body, foot, size }) {
  qs('#modal').className = 'modal' + (size === 'lg' ? ' modal--lg' : '');
  qs('#modal').innerHTML = `
    <div class="modal-head">
      <div><div class="modal-title">${title}</div>${sub ? `<div class="modal-sub">${sub}</div>` : ''}</div>
      <button class="btn-icon" data-close-modal aria-label="Cerrar">${icon('i-x')}</button>
    </div>
    <div class="modal-body">${body}</div>
    ${foot ? `<div class="modal-foot">${foot}</div>` : ''}
  `;
  qs('#modal-overlay').classList.add('is-open');
  const first = qs('#modal input, #modal select, #modal textarea');
  if (first) setTimeout(() => first.focus(), 50);
}
function closeModal() {
  qs('#modal-overlay').classList.remove('is-open');
  setTimeout(() => { qs('#modal').innerHTML = ''; }, 150);
}
function toast(msg, type) {
  const t = document.createElement('div');
  t.className = 'toast' + (type ? ' toast--' + type : '');
  t.innerHTML = `${icon(type === 'error' ? 'i-alert' : 'i-check')}<span>${escapeHtml(msg)}</span>`;
  qs('#toast-stack').appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .25s'; setTimeout(() => t.remove(), 250); }, 3400);
}

/* ---------------------------------------------------------------------
   Componente genérico: lista filtrable (buscador + chips de estado)
   --------------------------------------------------------------------- */
function filterBarHtml(id, { placeholder, statusOptions, statusKey }) {
  return `
    <div class="toolbar" id="${id}">
      <div class="search-box">${icon('i-search')}<input type="search" data-role="search" placeholder="${placeholder}" autocomplete="off"></div>
      ${statusOptions ? `
        <div class="filter-chips" data-role="chips">
          <button class="filter-chip is-active" data-status="todos">Todos</button>
          ${statusOptions.map(s => `<button class="filter-chip" data-status="${s}">${AyLabels.estado(s)}</button>`).join('')}
        </div>` : ''}
    </div>`;
}

function wireFilterableList(root, { data, renderRow, matches, statusKey, tbodySelector, wrapSelector, emptySelector, afterRender }) {
  const searchInput = root.querySelector('[data-role=search]');
  const chips = qsa('[data-status]', root);
  let status = 'todos';
  const tbody = root.querySelector(tbodySelector);
  const wrap = root.querySelector(wrapSelector);
  const empty = root.querySelector(emptySelector);

  function apply() {
    const q = searchInput ? searchInput.value.trim().toLowerCase() : '';
    let items = data;
    if (q) items = items.filter(it => matches(it, q));
    if (statusKey && status !== 'todos') items = items.filter(it => it[statusKey] === status);
    if (!items.length) {
      if (wrap) wrap.style.display = 'none';
      if (empty) empty.style.display = 'flex';
    } else {
      if (wrap) wrap.style.display = '';
      if (empty) empty.style.display = 'none';
      tbody.innerHTML = items.map(renderRow).join('');
    }
    if (afterRender) afterRender(root);
  }
  if (searchInput) searchInput.addEventListener('input', apply);
  chips.forEach(chip => chip.addEventListener('click', () => {
    chips.forEach(c => c.classList.remove('is-active'));
    chip.classList.add('is-active');
    status = chip.dataset.status;
    apply();
  }));
  apply();
  return apply;
}

/* ---------------------------------------------------------------------
   Encabezado de página reutilizable
   --------------------------------------------------------------------- */
function pageHead({ eyebrow, title, sub, actions }) {
  return `
    <div class="page-head">
      <div>
        ${eyebrow ? `<div class="page-eyebrow">${eyebrow}</div>` : ''}
        <h2 class="page-title">${title}</h2>
        ${sub ? `<p class="page-sub">${sub}</p>` : ''}
      </div>
      ${actions ? `<div class="page-actions">${actions}</div>` : ''}
    </div>`;
}

function emptyState({ icon: ic, title, text, action }) {
  return `<div class="empty-state">${icon(ic, 'i--lg')}<h3>${title}</h3><p>${text}</p>${action || ''}</div>`;
}

/* =======================================================================
   ROUTER
   ======================================================================= */
const TITLES = {
  dashboard: 'Dashboard', documentos: 'Documentos', reportes: 'Reportes', solicitudes: 'Solicitudes',
  actividad: 'Actividad', perfil: 'Perfil', stock: 'Stock', presupuestos: 'Presupuestos', cuentas: 'Cuentas corrientes',
  clientes: 'Clientes', tareas: 'Tareas', notas: 'Notas internas', usuarios: 'Gestión de usuarios',
};

function renderRoute() {
  const parts = (location.hash.replace(/^#\/?/, '') || 'dashboard').split('/').filter(Boolean);
  const top = parts[0] || 'dashboard';
  markActiveNav(top);
  const view = qs('#view');
  view.scrollTop = 0;
  window.scrollTo(0, 0);

  if (Ctx.role === 'client') {
    qs('#topbar-title').textContent = TITLES[top] || 'Panel';
    const emp = Ctx.empresa;
    switch (top) {
      case 'dashboard': return renderClientDashboard(view, emp);
      case 'documentos': return renderClientDocumentos(view, emp);
      case 'reportes': return renderClientReportes(view, emp);
      case 'solicitudes': return renderClientSolicitudes(view, emp);
      case 'actividad': return renderClientActividad(view, emp);
      case 'perfil': return renderClientPerfil(view, emp);
      case 'stock': return renderClientStock(view, emp);
      case 'presupuestos': return renderClientPresupuestos(view, emp);
      case 'cuentas': return renderClientCuentas(view, emp);
      default: return renderClientDashboard(view, emp);
    }
  } else {
    switch (top) {
      case 'dashboard': qs('#topbar-title').textContent = 'Dashboard'; return renderEmployeeDashboard(view);
      case 'clientes':
        if (parts[1]) { qs('#topbar-title').textContent = 'Cliente'; return renderClienteDetail(view, parts[1]); }
        qs('#topbar-title').textContent = 'Clientes'; return renderEmployeeClientes(view);
      case 'solicitudes': qs('#topbar-title').textContent = 'Solicitudes'; return renderEmployeeSolicitudes(view);
      case 'documentos': qs('#topbar-title').textContent = 'Documentos'; return renderEmployeeDocumentos(view);
      case 'reportes': qs('#topbar-title').textContent = 'Reportes'; return renderEmployeeReportes(view);
      case 'tareas': qs('#topbar-title').textContent = 'Tareas'; return renderEmployeeTareas(view);
      case 'actividad': qs('#topbar-title').textContent = 'Actividad'; return renderEmployeeActividad(view);
      case 'notas': qs('#topbar-title').textContent = 'Notas internas'; return renderEmployeeNotas(view);
      case 'usuarios': qs('#topbar-title').textContent = 'Gestión de usuarios'; return renderEmployeeUsuarios(view);
      default: qs('#topbar-title').textContent = 'Dashboard'; return renderEmployeeDashboard(view);
    }
  }
}

/* =======================================================================
   PANEL CLIENTE
   ======================================================================= */
function renderClientDashboard(view, emp) {
  const requests = AyData.getRequests(emp.id);
  const pendReq = requests.filter(r => r.estado === 'nuevo' || r.estado === 'proceso');
  const revisionDocs = AyData.getDocuments(emp.id).filter(d => d.estado === 'revision');
  const activity = AyData.getActivity(emp.id).slice(0, 4);
  const lastReport = AyData.getReports(emp.id)[0];
  const hour = new Date().getHours();
  const saludo = hour < 12 ? 'Buen día' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';

  const statCards = [
    { label: 'Ventas del mes', value: ayFormatMoney(emp.kpis.ventas), trend: emp.kpis.ventasVar, icon: 'i-bar', color: 'blue' },
    { label: 'Margen', value: emp.kpis.margen + '%', trend: emp.kpis.margenVar, icon: 'i-activity', color: 'green' },
    emp.kpis.stockPct != null
      ? { label: 'Stock disponible', value: emp.kpis.stockPct + '%', icon: 'i-box', color: 'amber' }
      : { label: 'Documentos por revisar', value: String(revisionDocs.length), icon: 'i-file', color: 'amber' },
    { label: 'Tareas pendientes', value: String(emp.kpis.tareasPendientes), icon: 'i-check-sq', color: 'violet' },
  ];

  view.innerHTML = `
    ${pageHead({ eyebrow: emp.nombre, title: `${saludo}, ${Ctx.user.nombre.split(' ')[0]}.`, sub: 'Este es el estado de tu negocio.' })}

    <div class="grid grid-4" style="margin-bottom:22px;">
      ${statCards.map(c => `
        <div class="card stat-card">
          <div class="stat-top">
            <div class="stat-icon stat-icon--${c.color}">${icon(c.icon)}</div>
            ${c.trend != null ? `<span class="stat-trend ${c.trend >= 0 ? 'stat-trend--up' : 'stat-trend--down'}">${c.trend >= 0 ? '▲' : '▼'} ${Math.abs(c.trend)}%</span>` : ''}
          </div>
          <div class="stat-value">${c.value}</div>
          <div class="stat-label">${c.label}</div>
        </div>`).join('')}
    </div>

    <div class="grid grid-2" style="align-items:start;">
      <div class="card">
        <div class="section-head"><span class="section-title">Actividad reciente</span><a class="section-link" href="#/actividad">Ver todo ${icon('i-arrow-right', 'i--sm')}</a></div>
        ${activity.length ? `<div class="activity-list">${activity.map(a => activityRow(a, false)).join('')}</div>` : emptyState({ icon: 'i-activity', title: 'Todavía no hay actividad', text: 'Acá vas a ver las novedades de tu negocio apenas empecemos a trabajar.' })}
      </div>

      <div class="card">
        <div class="section-head"><span class="section-title">Pendientes</span></div>
        <div class="pending-list">
          ${pendReq.length ? `<a class="pending-row" href="#/solicitudes">${icon('i-clock')}<span class="pending-text">${pendReq.length} ${pendReq.length === 1 ? 'solicitud en proceso' : 'solicitudes en proceso'}<div class="pending-sub">Las estamos gestionando con vos</div></span>${icon('i-arrow-right', 'i--sm')}</a>` : ''}
          ${revisionDocs.length ? `<a class="pending-row" href="#/documentos">${icon('i-file')}<span class="pending-text">${revisionDocs.length} ${revisionDocs.length === 1 ? 'documento requiere revisión' : 'documentos requieren revisión'}<div class="pending-sub">Los estamos procesando</div></span>${icon('i-arrow-right', 'i--sm')}</a>` : ''}
          ${(!pendReq.length && !revisionDocs.length) ? emptyState({ icon: 'i-check-sq', title: 'Todo al día', text: 'No tenés pendientes en este momento.' }) : ''}
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:18px;">
      <div class="section-head"><span class="section-title">Último informe</span><a class="section-link" href="#/reportes">Ver todos ${icon('i-arrow-right', 'i--sm')}</a></div>
      ${lastReport ? reportPreviewHtml(lastReport, true) : emptyState({ icon: 'i-bar', title: 'Sin informes todavía', text: 'Tu primer informe va a aparecer acá.' })}
    </div>
  `;

  if (lastReport) qs('[data-action="ver-informe"]', view)?.addEventListener('click', () => openReportModal(lastReport, { hideDownload: true }));
}

function activityRow(a, showEmpresa) {
  const meta = { solicitud: ['i-inbox', 'blue'], documento: ['i-file', 'violet'], reporte: ['i-bar', 'green'], stock: ['i-box', 'amber'], general: ['i-activity', 'blue'] }[a.tipo] || ['i-activity', 'blue'];
  const empresa = showEmpresa && a.empresaId ? AyData.getEmpresa(a.empresaId) : null;
  return `
    <div class="activity-row">
      <div class="activity-icon stat-icon--${meta[1]}">${icon(meta[0], 'i--sm')}</div>
      <div class="activity-body">
        ${empresa ? `<div class="activity-empresa">${escapeHtml(empresa.nombre)}</div>` : ''}
        <div class="activity-text">${escapeHtml(a.texto)}</div>
        <div class="activity-meta">${ayFormatDate(a.fecha)} · ${ayRelativeLabel(a.fecha)}</div>
      </div>
    </div>`;
}

function reportPreviewHtml(rep, withButton) {
  return `
    <div class="report-preview">
      <div class="report-preview-head">
        <div><h3>${escapeHtml(rep.titulo)}</h3><p style="color:#C9D8EA;font-size:0.85rem;margin-top:4px;">${rep.tipo} · ${ayFormatDate(rep.fecha)}</p></div>
        ${withButton ? `<button class="btn btn--accent btn--sm" data-action="ver-informe">Ver informe completo</button>` : ''}
      </div>
      <div class="report-metric-row">${rep.metrics.map(m => `<div class="report-metric"><div class="report-metric-label">${m.label}</div><div class="report-metric-value">${m.value}</div></div>`).join('')}</div>
      <div class="report-body">${escapeHtml(rep.resumen)}</div>
    </div>`;
}

function openReportModal(rep, opts) {
  const hideDownload = opts && opts.hideDownload;
  openModal({
    title: 'Informe', size: 'lg',
    body: reportPreviewHtml(rep, false),
    foot: `<button class="btn btn--ghost" data-close-modal>Cerrar</button>${hideDownload ? '' : `<button class="btn btn--primary" id="dl-report">${icon('i-download')}Descargar PDF</button>`}`,
  });
  if (!hideDownload) qs('#dl-report').addEventListener('click', () => { toast('Descarga simulada: en la versión final se genera el PDF real.'); });
}

function renderClientDocumentos(view, emp) {
  const docs = AyData.getDocuments(emp.id);
  view.innerHTML = `
    ${pageHead({ eyebrow: 'Documentos', title: 'Tus documentos', sub: 'Facturas, balances y otros archivos que AdminYAAA gestiona por vos.', actions: `<button class="btn btn--primary" id="btn-upload">${icon('i-upload')}Subir documento</button>` })}
    <div id="doc-list">
      ${filterBarHtml('doc-toolbar', { placeholder: 'Buscar documento…' })}
      <div class="table-wrap" data-role="wrap">
        <table class="data-table">
          <thead><tr><th>Documento</th><th>Categoría</th><th>Fecha</th><th>Estado</th></tr></thead>
          <tbody data-role="tbody"></tbody>
        </table>
      </div>
      <div data-role="empty" style="display:none;">${emptyState({ icon: 'i-file', title: 'No encontramos documentos', text: 'Probá con otra búsqueda o subí un documento nuevo.' })}</div>
    </div>
  `;
  wireFilterableList(qs('#doc-list'), {
    data: docs, tbodySelector: '[data-role=tbody]', wrapSelector: '[data-role=wrap]', emptySelector: '[data-role=empty]',
    matches: (d, q) => d.nombre.toLowerCase().includes(q) || d.categoria.toLowerCase().includes(q),
    renderRow: (d) => `
      <tr>
        <td><div class="cell-main">${icon('i-file', 'i--sm')} ${escapeHtml(d.nombre)}</div></td>
        <td class="cell-muted">${escapeHtml(d.categoria)}</td>
        <td class="cell-muted">${ayFormatDate(d.fecha)}</td>
        <td><span class="badge-status badge-status--${d.estado}">${AyLabels.estado(d.estado)}</span></td>
      </tr>`,
  });
  qs('#btn-upload').addEventListener('click', () => openUploadDocModal(emp.id, () => renderClientDocumentos(view, emp)));
}

function openUploadDocModal(empresaId, onDone) {
  openModal({
    title: 'Subir documento', sub: 'Los documentos que subís pasan a revisión antes de quedar disponibles.',
    body: `
      <div class="field"><label for="doc-nombre">Nombre del archivo</label><input id="doc-nombre" placeholder="Ej: Factura proveedor.pdf"></div>
      <div class="field"><label for="doc-cat">Categoría</label>
        <select id="doc-cat"><option>Facturación</option><option>Balances</option><option>Contratos</option><option>Stock</option><option>Otro</option></select>
      </div>
      <div class="field"><label for="doc-file">Archivo (simulado)</label><input id="doc-file" type="file"></div>
    `,
    foot: `<button class="btn btn--ghost" data-close-modal>Cancelar</button><button class="btn btn--primary" id="doc-submit">${icon('i-upload')}Subir</button>`,
  });
  qs('#doc-submit').addEventListener('click', () => {
    const nombreInput = qs('#doc-nombre');
    let nombre = nombreInput.value.trim();
    const fileInput = qs('#doc-file');
    if (!nombre && fileInput.files[0]) nombre = fileInput.files[0].name;
    if (!nombre) { nombreInput.closest('.field').classList.add('has-error'); return; }
    AyData.addDocument({ empresaId, nombre, categoria: qs('#doc-cat').value, tamano: Math.round(60 + Math.random() * 900) + ' KB', estado: 'revision', subidoPor: Ctx.user.nombre });
    closeModal();
    toast('Documento subido. Lo vamos a revisar y avisarte.');
    onDone();
  });
}

function renderClientReportes(view, emp) {
  const reports = AyData.getReports(emp.id);
  view.innerHTML = `
    ${pageHead({ eyebrow: 'Reportes', title: 'Tus informes', sub: 'Informes semanales y mensuales que preparamos con tus números.' })}
    ${reports.length ? `<div class="grid grid-2">${reports.map(r => `
      <div class="card">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">
          <div>
            <span class="badge-module">${r.tipo}</span>
            <h3 style="margin-top:10px;">${escapeHtml(r.titulo)}</h3>
            <p style="color:var(--ink-muted);font-size:0.85rem;margin-top:4px;">${ayFormatDate(r.fecha)}</p>
          </div>
        </div>
        <p style="margin-top:12px;color:var(--ink-muted);font-size:0.88rem;">${escapeHtml(r.resumen.slice(0, 110))}${r.resumen.length > 110 ? '…' : ''}</p>
        <button class="btn btn--ghost btn--sm" style="margin-top:14px;" data-open-report="${r.id}">${icon('i-eye', 'i--sm')}Ver informe</button>
      </div>`).join('')}</div>` : emptyState({ icon: 'i-bar', title: 'Todavía no hay informes', text: 'Cuando generemos tu primer informe, lo vas a ver acá.' })}
  `;
  qsa('[data-open-report]', view).forEach(btn => btn.addEventListener('click', () => openReportModal(reports.find(r => r.id === btn.dataset.openReport), { hideDownload: true })));
}

function renderClientSolicitudes(view, emp) {
  const requests = AyData.getRequests(emp.id);
  view.innerHTML = `
    ${pageHead({ eyebrow: 'Solicitudes', title: 'Tus solicitudes', sub: 'Pedí presupuestos, cambios o cualquier trámite y seguí el estado acá.', actions: `<button class="btn btn--primary" id="btn-new-req">${icon('i-plus')}Nueva solicitud</button>` })}
    <div id="req-list">
      ${filterBarHtml('req-toolbar', { placeholder: 'Buscar solicitud…', statusOptions: ['nuevo', 'proceso', 'esperando_info', 'terminado'], statusKey: 'estado' })}
      <div class="table-wrap" data-role="wrap">
        <table class="data-table">
          <thead><tr><th>Solicitud</th><th>Tipo</th><th>Estado</th><th>Fecha</th></tr></thead>
          <tbody data-role="tbody"></tbody>
        </table>
      </div>
      <div data-role="empty" style="display:none;">${emptyState({ icon: 'i-inbox', title: 'No encontramos solicitudes', text: 'Probá con otro filtro o creá una nueva solicitud.' })}</div>
    </div>
  `;
  wireFilterableList(qs('#req-list'), {
    data: requests, statusKey: 'estado', tbodySelector: '[data-role=tbody]', wrapSelector: '[data-role=wrap]', emptySelector: '[data-role=empty]',
    matches: (r, q) => r.titulo.toLowerCase().includes(q) || r.tipo.toLowerCase().includes(q),
    renderRow: (r) => `
      <tr class="is-clickable" data-open-req="${r.id}">
        <td><div class="cell-main">${escapeHtml(r.titulo)}</div></td>
        <td class="cell-muted">${escapeHtml(r.tipo)}</td>
        <td><span class="badge-status badge-status--${r.estado}">${AyLabels.estado(r.estado)}</span></td>
        <td class="cell-muted">${ayFormatDate(r.fecha)}</td>
      </tr>`,
  });
  qs('#req-list').addEventListener('click', (e) => {
    const row = e.target.closest('[data-open-req]');
    if (row) openRequestDetailModal(requests.find(r => r.id === row.dataset.openReq), false);
  });
  qs('#btn-new-req').addEventListener('click', () => openNewRequestModal(emp, () => renderClientSolicitudes(view, emp)));
}

function openRequestDetailModal(r, isEmployee) {
  openModal({
    title: escapeHtml(r.titulo), sub: `${r.tipo} · Enviada el ${ayFormatDate(r.fecha)}`,
    body: `
      <p style="color:var(--ink-muted);font-size:0.92rem;line-height:1.6;">${escapeHtml(r.descripcion || 'Sin descripción adicional.')}</p>
      <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;">
        <span class="badge-status badge-status--${r.estado}">${AyLabels.estado(r.estado)}</span>
        <span class="badge-module">Prioridad ${AyLabels.prioridad(r.prioridad)}</span>
        <span class="badge-module">Responsable: ${escapeHtml(r.responsable)}</span>
      </div>
    `,
    foot: `<button class="btn btn--ghost" data-close-modal>Cerrar</button>`,
  });
}

function openNewRequestModal(emp, onDone) {
  openModal({
    title: 'Nueva solicitud', sub: `Se la vamos a asignar a ${escapeHtml(emp.responsable)}.`,
    body: `
      <div class="field"><label for="nr-tipo">Tipo de solicitud</label>
        <select id="nr-tipo"><option>Presupuesto</option><option>Administración</option><option>Pago</option><option>Reporte</option><option>Stock</option><option>Cuenta corriente</option><option>Otro</option></select>
      </div>
      <div class="field"><label for="nr-titulo">Título</label><input id="nr-titulo" placeholder="Ej: Necesito un presupuesto para..."></div>
      <div class="field"><label for="nr-desc">Contanos los detalles</label><textarea id="nr-desc" rows="4" placeholder="Describí qué necesitás"></textarea></div>
      <div class="field"><label for="nr-prio">Prioridad</label><select id="nr-prio"><option value="baja">Baja</option><option value="media" selected>Media</option><option value="alta">Alta</option></select></div>
    `,
    foot: `<button class="btn btn--ghost" data-close-modal>Cancelar</button><button class="btn btn--primary" id="nr-submit">${icon('i-plus')}Enviar solicitud</button>`,
  });
  qs('#nr-submit').addEventListener('click', () => {
    const titulo = qs('#nr-titulo').value.trim();
    if (!titulo) { qs('#nr-titulo').closest('.field').classList.add('has-error'); return; }
    AyData.addRequest({ empresaId: emp.id, titulo, tipo: qs('#nr-tipo').value, descripcion: qs('#nr-desc').value.trim(), prioridad: qs('#nr-prio').value, responsable: emp.responsable, estado: 'nuevo' });
    closeModal();
    toast('Solicitud enviada. Te vamos a avisar cuando la tomemos.');
    buildSidebar();
    onDone();
  });
}

function renderClientActividad(view, emp) {
  const activity = AyData.getActivity(emp.id);
  view.innerHTML = `
    ${pageHead({ eyebrow: 'Actividad', title: 'Qué hicimos por tu negocio', sub: 'Un registro de todo lo que fuimos gestionando.' })}
    <div class="card">${activity.length ? `<div class="activity-list">${activity.map(a => activityRow(a, false)).join('')}</div>` : emptyState({ icon: 'i-activity', title: 'Sin actividad todavía', text: 'Acá vas a ver el historial de tu cuenta.' })}</div>
  `;
}

function renderClientPerfil(view, emp) {
  view.innerHTML = `
    ${pageHead({ eyebrow: 'Perfil', title: 'Tu cuenta', sub: 'Información de tu negocio y de tu plan con AdminYAAA.' })}
    <div class="grid grid-2" style="align-items:start;">
      <div class="card">
        <div class="entity-head">
          <div class="entity-avatar">${emp.nombre.slice(0, 2).toUpperCase()}</div>
          <div><div class="entity-name">${escapeHtml(emp.nombre)}</div><div class="entity-meta">${escapeHtml(emp.rubro)}</div></div>
        </div>
        <div style="display:grid;gap:12px;font-size:0.9rem;">
          <div><strong>Contacto:</strong> ${escapeHtml(emp.contacto)}</div>
          <div><strong>Correo:</strong> ${escapeHtml(emp.email)}</div>
          <div><strong>Teléfono:</strong> ${escapeHtml(emp.telefono)}</div>
          <div><strong>Cliente desde:</strong> ${ayFormatDate(emp.desde)}</div>
          <div><strong>Responsable en AdminYAAA:</strong> ${escapeHtml(emp.responsable)}</div>
        </div>
      </div>
      <div class="card">
        <div class="section-title" style="margin-bottom:14px;">Tu plan</div>
        <span class="badge-module" style="margin-bottom:14px;display:inline-block;">${escapeHtml(emp.plan)}</span>
        <p style="color:var(--ink-muted);font-size:0.88rem;margin-bottom:10px;">Módulos activos:</p>
        <div class="entity-modules">
          <span class="badge-module">Documentos</span><span class="badge-module">Reportes</span><span class="badge-module">Solicitudes</span>
          ${emp.modulos.map(m => `<span class="badge-module">${AyLabels.modulo(m)}</span>`).join('')}
        </div>
        <button class="btn btn--ghost btn--sm" style="margin-top:18px;" id="btn-plan">Solicitar cambio de plan</button>
      </div>
    </div>
    <p style="margin-top:18px;"><span class="demo-tag">${icon('i-alert', 'i--sm')} Datos de demostración</span></p>
  `;
  qs('#btn-plan').addEventListener('click', () => {
    AyData.addRequest({ empresaId: emp.id, titulo: 'Solicitud de cambio de plan', tipo: 'Administración', descripcion: 'Quiero revisar los módulos y el plan actual.', prioridad: 'media', responsable: emp.responsable, estado: 'nuevo' });
    toast('Le avisamos a tu responsable que querés revisar el plan.');
  });
}

function renderClientStock(view, emp) {
  const items = AyData.getStock(emp.id);
  const bajos = items.filter(it => it.cantidad < it.minimo);
  view.innerHTML = `
    ${pageHead({ eyebrow: 'Módulo', title: 'Stock', sub: 'Nivel de stock de tus productos principales.' })}
    ${bajos.length ? `<div class="pending-row" style="margin-bottom:16px;">${icon('i-alert')}<span class="pending-text">${bajos.length} ${bajos.length === 1 ? 'producto está' : 'productos están'} por debajo del mínimo<div class="pending-sub">${bajos.map(b => escapeHtml(b.producto)).join(', ')}</div></span></div>` : ''}
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Producto</th><th>Cantidad</th><th>Mínimo</th><th>Nivel</th></tr></thead>
        <tbody>
          ${items.map(it => {
            const pct = Math.min(100, Math.round((it.cantidad / (it.minimo * 2)) * 100));
            const low = it.cantidad < it.minimo;
            return `<tr>
              <td class="cell-main">${escapeHtml(it.producto)}</td>
              <td class="cell-muted">${it.cantidad} ${escapeHtml(it.unidad)}</td>
              <td class="cell-muted">${it.minimo} ${escapeHtml(it.unidad)}</td>
              <td style="min-width:160px;">
                <div class="progress"><div class="progress-bar ${low ? 'progress-bar--red' : ''}" style="width:${pct}%;"></div></div>
                ${low ? `<span class="badge-status badge-status--alerta" style="margin-top:6px;">Por debajo del mínimo</span>` : ''}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderClientPresupuestos(view, emp) {
  const items = AyData.getBudgets(emp.id);
  view.innerHTML = `
    ${pageHead({ eyebrow: 'Módulo', title: 'Presupuestos', sub: 'Presupuestos que emitiste a tus propios clientes, gestionados desde AdminYAAA.' })}
    ${items.length ? `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>Cliente</th><th>Monto</th><th>Estado</th><th>Fecha</th></tr></thead>
      <tbody>${items.map(b => `<tr><td class="cell-main">${escapeHtml(b.cliente)}</td><td class="cell-muted">${ayFormatMoney(b.monto)}</td><td><span class="badge-status badge-status--${b.estado}">${AyLabels.estado(b.estado)}</span></td><td class="cell-muted">${ayFormatDate(b.fecha)}</td></tr>`).join('')}</tbody>
    </table></div>` : emptyState({ icon: 'i-calc', title: 'Sin presupuestos', text: 'Todavía no cargamos presupuestos para tu negocio.' })}
  `;
}

function renderClientCuentas(view, emp) {
  const items = AyData.getAccounts(emp.id);
  const vencidas = items.filter(a => a.estado === 'vencido');
  view.innerHTML = `
    ${pageHead({ eyebrow: 'Módulo', title: 'Cuentas corrientes', sub: 'Saldos de tus clientes y proveedores.' })}
    ${vencidas.length ? `<div class="pending-row" style="margin-bottom:16px;">${icon('i-alert')}<span class="pending-text">${vencidas.length} ${vencidas.length === 1 ? 'cuenta vencida' : 'cuentas vencidas'} por ${ayFormatMoney(vencidas.reduce((s, a) => s + a.saldo, 0))}<div class="pending-sub">${vencidas.map(a => escapeHtml(a.cliente)).join(', ')}</div></span></div>` : ''}
    ${items.length ? `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>Cliente / Cuenta</th><th>Saldo</th><th>Estado</th><th>Último movimiento</th></tr></thead>
      <tbody>${items.map(a => `<tr><td class="cell-main">${escapeHtml(a.cliente)}</td><td class="cell-muted">${ayFormatMoney(a.saldo)}</td><td><span class="badge-status badge-status--${a.estado === 'al_dia' ? 'activo' : 'vencida'}">${a.estado === 'al_dia' ? 'Al día' : 'Vencido'}</span></td><td class="cell-muted">${ayFormatDate(a.ultimoMovimiento)}</td></tr>`).join('')}</tbody>
    </table></div>` : emptyState({ icon: 'i-card', title: 'Sin cuentas cargadas', text: 'Todavía no hay movimientos para mostrar.' })}
  `;
}

/* =======================================================================
   PANEL EMPLEADO
   ======================================================================= */
function renderEmployeeDashboard(view) {
  const ids = misEmpresaIds();
  const empresas = misEmpresas();
  const allReq = AyData.getRequests().filter(r => ids.includes(r.empresaId));
  const misTareas = AyData.getTasks().filter(t => t.empresaId == null || ids.includes(t.empresaId));
  const nuevas = allReq.filter(r => r.estado === 'nuevo').length;
  const tareasPend = misTareas.filter(t => t.estado !== 'finalizado').length;
  const informesPorEntregar = allReq.filter(r => r.tipo === 'Reporte' && r.estado !== 'terminado').length;
  const recientes = allReq.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 6);
  const activity = AyData.getActivity().filter(a => ids.includes(a.empresaId)).slice(0, 6);
  const atencion = empresas.filter(e => e.atencion);
  const hour = new Date().getHours();
  const saludo = hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';

  const cards = [
    { label: 'Tus clientes', value: String(empresas.length), icon: 'i-users', color: 'blue' },
    { label: 'Solicitudes nuevas', value: String(nuevas), icon: 'i-inbox', color: 'amber' },
    { label: 'Tareas pendientes', value: String(tareasPend), icon: 'i-check-sq', color: 'violet' },
    { label: 'Informes por entregar', value: String(informesPorEntregar), icon: 'i-bar', color: 'green' },
  ];

  view.innerHTML = `
    ${pageHead({ eyebrow: 'Centro de operaciones', title: `${saludo}, ${Ctx.user.nombre.split(' ')[0]}.`, sub: 'Esto está pasando en AdminYAAA.' })}
    <div class="grid grid-4" style="margin-bottom:22px;">
      ${cards.map(c => `<div class="card stat-card"><div class="stat-top"><div class="stat-icon stat-icon--${c.color}">${icon(c.icon)}</div></div><div class="stat-value">${c.value}</div><div class="stat-label">${c.label}</div></div>`).join('')}
    </div>

    <div class="card" style="margin-bottom:18px;">
      <div class="section-head"><span class="section-title">Solicitudes recientes</span><a class="section-link" href="#/solicitudes">Ver todas ${icon('i-arrow-right', 'i--sm')}</a></div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Cliente</th><th>Solicitud</th><th>Responsable</th><th>Estado</th><th>Fecha</th></tr></thead>
          <tbody>${recientes.map(r => {
            const e = AyData.getEmpresa(r.empresaId);
            return `<tr class="is-clickable" data-go="#/clientes/${e.id}"><td class="cell-main">${escapeHtml(e.nombre)}</td><td>${escapeHtml(r.titulo)}</td><td class="cell-muted">${escapeHtml(r.responsable)}</td><td><span class="badge-status badge-status--${r.estado}">${AyLabels.estado(r.estado)}</span></td><td class="cell-muted">${ayFormatDate(r.fecha)}</td></tr>`;
          }).join('')}</tbody>
        </table>
      </div>
    </div>

    <div class="grid grid-2" style="align-items:start;">
      <div class="card">
        <div class="section-head"><span class="section-title">Actividad</span><a class="section-link" href="#/actividad">Ver todo ${icon('i-arrow-right', 'i--sm')}</a></div>
        <div class="activity-list">${activity.map(a => activityRow(a, true)).join('')}</div>
      </div>
      <div class="card">
        <div class="section-head"><span class="section-title">Clientes que requieren atención</span></div>
        ${atencion.length ? `<div class="pending-list">${atencion.map(e => `
          <a class="pending-row" href="#/clientes/${e.id}">
            ${icon('i-alert')}
            <span class="pending-text">${escapeHtml(e.nombre)}<div class="pending-sub">${escapeHtml(e.motivoAtencion || 'Requiere seguimiento')}</div></span>
            ${icon('i-arrow-right', 'i--sm')}
          </a>`).join('')}</div>` : emptyState({ icon: 'i-check-sq', title: 'Todo tranquilo', text: 'Ningún cliente requiere atención especial hoy.' })}
      </div>
    </div>
  `;
  qsa('[data-go]', view).forEach(row => row.addEventListener('click', () => { location.hash = row.dataset.go; }));
}

function renderEmployeeClientes(view) {
  const empresas = misEmpresas();
  view.innerHTML = `
    ${pageHead({ eyebrow: 'Cartera', title: 'Clientes', sub: `Tenés ${empresas.length} ${empresas.length === 1 ? 'cliente designado' : 'clientes designados'}.` })}
    <div id="cli-list">
      ${filterBarHtml('cli-toolbar', { placeholder: 'Buscar cliente, rubro o responsable…' })}
      <div class="table-wrap" data-role="wrap">
        <table class="data-table">
          <thead><tr><th>Cliente</th><th>Rubro</th><th>Plan</th><th>Responsable</th><th>Estado</th></tr></thead>
          <tbody data-role="tbody"></tbody>
        </table>
      </div>
      <div data-role="empty" style="display:none;">${emptyState({ icon: 'i-users', title: 'Sin resultados', text: 'Probá con otra búsqueda.' })}</div>
    </div>
  `;
  wireFilterableList(qs('#cli-list'), {
    data: empresas, tbodySelector: '[data-role=tbody]', wrapSelector: '[data-role=wrap]', emptySelector: '[data-role=empty]',
    matches: (e, q) => e.nombre.toLowerCase().includes(q) || e.rubro.toLowerCase().includes(q) || e.responsable.toLowerCase().includes(q),
    renderRow: (e) => `
      <tr class="is-clickable" data-go="#/clientes/${e.id}">
        <td><div class="cell-main">${escapeHtml(e.nombre)}</div><div class="cell-sub">Cliente desde ${ayFormatDate(e.desde)}</div></td>
        <td class="cell-muted">${escapeHtml(e.rubro)}</td>
        <td class="cell-muted">${escapeHtml(e.plan)}</td>
        <td class="cell-muted">${escapeHtml(e.responsable)}</td>
        <td>${e.atencion ? `<span class="badge-status badge-status--alerta">Requiere atención</span>` : `<span class="badge-status badge-status--activo">Al día</span>`}</td>
      </tr>`,
  });
  qs('#cli-list').addEventListener('click', (e) => { const row = e.target.closest('[data-go]'); if (row) location.hash = row.dataset.go; });
}

function renderClienteDetail(view, empresaId) {
  const emp = AyData.getEmpresa(empresaId);
  if (!emp) { view.innerHTML = emptyState({ icon: 'i-alert', title: 'Cliente no encontrado', text: 'Puede que haya sido eliminado en esta demo.' }); return; }
  if (!misEmpresaIds().includes(emp.id)) {
    qs('#topbar-title').textContent = 'Sin acceso';
    view.innerHTML = `<a class="back-link" href="#/clientes">${icon('i-arrow-left', 'i--sm')}Volver a Clientes</a>` + emptyState({ icon: 'i-alert', title: 'No tenés acceso a este cliente', text: `${escapeHtml(emp.nombre)} está a cargo de ${escapeHtml(emp.responsable)}. Cada empleado ve solo a sus clientes designados.` });
    return;
  }
  qs('#topbar-title').textContent = emp.nombre;
  const tab = PageState.clienteTab || 'resumen';

  view.innerHTML = `
    <a class="back-link" href="#/clientes">${icon('i-arrow-left', 'i--sm')}Volver a Clientes</a>
    <div class="entity-head">
      <div class="entity-avatar">${emp.nombre.slice(0, 2).toUpperCase()}</div>
      <div>
        <div class="entity-name">${escapeHtml(emp.nombre)}</div>
        <div class="entity-meta">${escapeHtml(emp.rubro)} · ${escapeHtml(emp.contacto)} · ${escapeHtml(emp.telefono)}</div>
        <div class="entity-modules"><span class="badge-module">${escapeHtml(emp.plan)}</span>${emp.modulos.map(m => `<span class="badge-module">${AyLabels.modulo(m)}</span>`).join('')}${emp.atencion ? `<span class="badge-status badge-status--alerta">Requiere atención</span>` : ''}</div>
      </div>
    </div>
    <div class="tabs" id="cli-tabs">
      ${['resumen', 'documentos', 'solicitudes', 'reportes', 'tareas', 'notas', 'actividad'].map(t => `<button class="tab-btn ${t === tab ? 'is-active' : ''}" data-tab="${t}">${t.charAt(0).toUpperCase() + t.slice(1)}</button>`).join('')}
    </div>
    <div id="cli-tab-body"></div>
  `;
  qsa('[data-tab]', view).forEach(btn => btn.addEventListener('click', () => { PageState.clienteTab = btn.dataset.tab; renderClienteDetail(view, empresaId); }));
  renderClienteTabBody(qs('#cli-tab-body'), emp, tab);
}

function renderClienteTabBody(el, emp, tab) {
  if (tab === 'resumen') {
    el.innerHTML = `
      <div class="grid grid-4" style="margin-bottom:18px;">
        <div class="card stat-card"><div class="stat-value">${ayFormatMoney(emp.kpis.ventas)}</div><div class="stat-label">Ventas del mes</div></div>
        <div class="card stat-card"><div class="stat-value">${emp.kpis.margen}%</div><div class="stat-label">Margen</div></div>
        <div class="card stat-card"><div class="stat-value">${AyData.getRequests(emp.id).length}</div><div class="stat-label">Solicitudes totales</div></div>
        <div class="card stat-card"><div class="stat-value">${AyData.getDocuments(emp.id).length}</div><div class="stat-label">Documentos</div></div>
      </div>
      <div class="card"><div class="section-title" style="margin-bottom:12px;">Contacto</div>
        <div style="display:grid;gap:10px;font-size:0.9rem;">
          <div><strong>Correo:</strong> ${escapeHtml(emp.email)}</div>
          <div><strong>Responsable en AdminYAAA:</strong> ${escapeHtml(emp.responsable)}</div>
          <div><strong>Cliente desde:</strong> ${ayFormatDate(emp.desde)}</div>
          ${emp.motivoAtencion ? `<div><strong>Motivo de atención:</strong> ${escapeHtml(emp.motivoAtencion)}</div>` : ''}
        </div>
      </div>`;
    return;
  }
  if (tab === 'documentos') {
    const docs = AyData.getDocuments(emp.id);
    el.innerHTML = `
      <div class="page-actions" style="margin-bottom:14px;"><button class="btn btn--primary btn--sm" id="cli-doc-add">${icon('i-upload')}Cargar documento</button></div>
      ${docs.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Documento</th><th>Categoría</th><th>Fecha</th><th>Estado</th></tr></thead>
      <tbody>${docs.map(d => `<tr><td class="cell-main">${escapeHtml(d.nombre)}</td><td class="cell-muted">${escapeHtml(d.categoria)}</td><td class="cell-muted">${ayFormatDate(d.fecha)}</td><td><span class="badge-status badge-status--${d.estado}">${AyLabels.estado(d.estado)}</span></td></tr>`).join('')}</tbody></table></div>`
      : emptyState({ icon: 'i-file', title: 'Sin documentos', text: 'Este cliente todavía no tiene documentos cargados.' })}
    `;
    qs('#cli-doc-add').addEventListener('click', () => openUploadDocModal(emp.id, () => renderClienteTabBody(el, emp, 'documentos')));
    return;
  }
  if (tab === 'solicitudes') {
    const reqs = AyData.getRequests(emp.id);
    el.innerHTML = `
      <div class="page-actions" style="margin-bottom:14px;"><button class="btn btn--primary btn--sm" id="cli-req-add">${icon('i-plus')}Nueva solicitud</button></div>
      ${reqs.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Solicitud</th><th>Tipo</th><th>Estado</th><th>Fecha</th></tr></thead>
      <tbody>${reqs.map(r => `<tr><td class="cell-main">${escapeHtml(r.titulo)}</td><td class="cell-muted">${escapeHtml(r.tipo)}</td><td>${statusSelectHtml(r)}</td><td class="cell-muted">${ayFormatDate(r.fecha)}</td></tr>`).join('')}</tbody></table></div>`
      : emptyState({ icon: 'i-inbox', title: 'Sin solicitudes', text: 'Este cliente todavía no generó solicitudes.' })}
    `;
    wireStatusSelects(el, () => renderClienteTabBody(el, emp, 'solicitudes'));
    qs('#cli-req-add').addEventListener('click', () => openEmployeeNewRequestModal(emp, () => renderClienteTabBody(el, emp, 'solicitudes')));
    return;
  }
  if (tab === 'reportes') {
    const reps = AyData.getReports(emp.id);
    el.innerHTML = `
      <div class="page-actions" style="margin-bottom:14px;"><button class="btn btn--primary btn--sm" id="cli-rep-add">${icon('i-plus')}Cargar informe</button></div>
      ${reps.length ? `<div class="grid grid-2">${reps.map(r => `<div class="card"><span class="badge-module">${r.tipo}</span><h3 style="margin-top:10px;">${escapeHtml(r.titulo)}</h3><p style="color:var(--ink-muted);font-size:0.85rem;margin-top:4px;">${ayFormatDate(r.fecha)}</p><button class="btn btn--ghost btn--sm" style="margin-top:12px;" data-open-report="${r.id}">${icon('i-eye', 'i--sm')}Ver</button></div>`).join('')}</div>`
      : emptyState({ icon: 'i-bar', title: 'Sin informes', text: 'Todavía no cargaste informes para este cliente.' })}
    `;
    qsa('[data-open-report]', el).forEach(btn => btn.addEventListener('click', () => openReportModal(reps.find(r => r.id === btn.dataset.openReport))));
    qs('#cli-rep-add').addEventListener('click', () => openNewReportModal(emp, () => renderClienteTabBody(el, emp, 'reportes')));
    return;
  }
  if (tab === 'tareas') {
    const tasks = AyData.getTasks(emp.id);
    el.innerHTML = `
      <div class="page-actions" style="margin-bottom:14px;"><button class="btn btn--primary btn--sm" id="cli-task-add">${icon('i-plus')}Asignar tarea</button></div>
      ${tasks.length ? taskBoardHtml(tasks) : emptyState({ icon: 'i-check-sq', title: 'Sin tareas', text: 'No hay tareas asignadas para este cliente.' })}
    `;
    wireTaskBoard(el, () => renderClienteTabBody(el, emp, 'tareas'));
    qs('#cli-task-add').addEventListener('click', () => openNewTaskModal(emp, () => renderClienteTabBody(el, emp, 'tareas')));
    return;
  }
  if (tab === 'notas') {
    const notes = AyData.getNotes(emp.id);
    el.innerHTML = `
      <div class="page-actions" style="margin-bottom:14px;"><button class="btn btn--primary btn--sm" id="cli-note-add">${icon('i-plus')}Agregar nota</button></div>
      ${notes.length ? notes.map(n => `<div class="note-card"><div class="note-head"><span>${escapeHtml(n.autor)}</span><span>${ayFormatDate(n.fecha)}</span></div><div class="note-text">${escapeHtml(n.texto)}</div></div>`).join('')
      : emptyState({ icon: 'i-note', title: 'Sin notas internas', text: 'Agregá observaciones que solo ve el equipo de AdminYAAA.' })}
    `;
    qs('#cli-note-add').addEventListener('click', () => openNewNoteModal(emp, () => renderClienteTabBody(el, emp, 'notas')));
    return;
  }
  if (tab === 'actividad') {
    const activity = AyData.getActivity(emp.id);
    el.innerHTML = `<div class="card">${activity.length ? `<div class="activity-list">${activity.map(a => activityRow(a, false)).join('')}</div>` : emptyState({ icon: 'i-activity', title: 'Sin actividad', text: 'Todavía no hay registros para este cliente.' })}</div>`;
  }
}

function statusSelectHtml(r) {
  const opts = ['nuevo', 'proceso', 'esperando_info', 'terminado'];
  return `<select class="filter-select" data-status-select="${r.id}">${opts.map(o => `<option value="${o}" ${o === r.estado ? 'selected' : ''}>${AyLabels.estado(o)}</option>`).join('')}</select>`;
}
function wireStatusSelects(root, onChange) {
  qsa('[data-status-select]', root).forEach(sel => sel.addEventListener('change', () => {
    AyData.updateRequestStatus(sel.dataset.statusSelect, sel.value);
    toast('Estado actualizado.');
    buildSidebar();
    onChange();
  }));
}

const TASK_STATES = [['proceso', 'En proceso'], ['demora', 'Con demora'], ['no_cumplido', 'No cumplido'], ['finalizado', 'Finalizado']];
function taskMoveBtnClass(key) {
  return key === 'finalizado' ? 'btn--accent' : key === 'no_cumplido' ? 'btn--danger' : 'btn--ghost';
}
function taskBoardHtml(tasks) {
  return `<div class="task-cols">${TASK_STATES.map(([key, label]) => `
    <div>
      <div class="task-col-head"><span>${label}</span><span class="badge-count" style="background:var(--surface-alt);color:var(--ink-muted);">${tasks.filter(t => t.estado === key).length}</span></div>
      <div class="task-col-body">
        ${tasks.filter(t => t.estado === key).map(t => `
          <div class="task-card">
            <div class="task-card-title">${escapeHtml(t.titulo)}</div>
            <div class="task-card-meta">
              <span class="task-priority task-priority--${t.prioridad}">${AyLabels.prioridad(t.prioridad)}</span>
              <span>${escapeHtml(t.responsable)}</span>
            </div>
            <div class="task-card-meta"><span>Vence ${ayFormatDate(t.vencimiento)}</span></div>
            <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;">
              ${TASK_STATES.filter(([k]) => k !== key).map(([k, l]) => `<button class="btn ${taskMoveBtnClass(k)} btn--sm" data-task-move="${t.id}" data-to="${k}">${l}</button>`).join('')}
            </div>
          </div>`).join('') || '<p style="font-size:0.82rem;color:var(--ink-faint);padding:8px 4px;">Sin tareas</p>'}
      </div>
    </div>`).join('')}</div>`;
}
function wireTaskBoard(root, onChange) {
  qsa('[data-task-move]', root).forEach(btn => btn.addEventListener('click', () => {
    AyData.updateTaskStatus(btn.dataset.taskMove, btn.dataset.to);
    toast('Tarea actualizada.');
    buildSidebar();
    onChange();
  }));
}

function renderEmployeeSolicitudes(view) {
  const requests = AyData.getRequests().filter(r => misEmpresaIds().includes(r.empresaId));
  view.innerHTML = `
    ${pageHead({ eyebrow: 'Operación', title: 'Solicitudes', sub: 'Solicitudes de tus clientes designados.', actions: `<button class="btn btn--primary" id="btn-new-req">${icon('i-plus')}Nueva solicitud</button>` })}
    <div id="req-list">
      ${filterBarHtml('req-toolbar', { placeholder: 'Buscar por cliente o solicitud…', statusOptions: ['nuevo', 'proceso', 'esperando_info', 'terminado'], statusKey: 'estado' })}
      <div class="table-wrap" data-role="wrap">
        <table class="data-table">
          <thead><tr><th>Cliente</th><th>Solicitud</th><th>Responsable</th><th>Estado</th><th>Fecha</th></tr></thead>
          <tbody data-role="tbody"></tbody>
        </table>
      </div>
      <div data-role="empty" style="display:none;">${emptyState({ icon: 'i-inbox', title: 'Sin resultados', text: 'Probá con otro filtro.' })}</div>
    </div>
  `;
  const refresh = wireFilterableList(qs('#req-list'), {
    data: requests, statusKey: 'estado', tbodySelector: '[data-role=tbody]', wrapSelector: '[data-role=wrap]', emptySelector: '[data-role=empty]',
    matches: (r, q) => r.titulo.toLowerCase().includes(q) || AyData.getEmpresa(r.empresaId).nombre.toLowerCase().includes(q),
    renderRow: (r) => `<tr><td class="cell-main"><a href="#/clientes/${r.empresaId}">${escapeHtml(AyData.getEmpresa(r.empresaId).nombre)}</a></td><td>${escapeHtml(r.titulo)}</td><td class="cell-muted">${escapeHtml(r.responsable)}</td><td>${statusSelectHtml(r)}</td><td class="cell-muted">${ayFormatDate(r.fecha)}</td></tr>`,
    afterRender: (root) => wireStatusSelects(root, () => renderEmployeeSolicitudes(view)),
  });
  qs('#btn-new-req').addEventListener('click', () => openEmployeeNewRequestModal(null, () => renderEmployeeSolicitudes(view)));
}

function empresaSelectHtml(id, selectedId) {
  return `<select id="${id}">${misEmpresas().map(e => `<option value="${e.id}" ${e.id === selectedId ? 'selected' : ''}>${escapeHtml(e.nombre)}</option>`).join('')}</select>`;
}

function openEmployeeNewRequestModal(presetEmpresa, onDone) {
  openModal({
    title: 'Nueva solicitud',
    body: `
      <div class="field"><label for="er-emp">Cliente</label>${empresaSelectHtml('er-emp', presetEmpresa && presetEmpresa.id)}</div>
      <div class="field"><label for="er-tipo">Tipo</label><select id="er-tipo"><option>Presupuesto</option><option>Administración</option><option>Pago</option><option>Reporte</option><option>Stock</option><option>Cuenta corriente</option></select></div>
      <div class="field"><label for="er-titulo">Título</label><input id="er-titulo" placeholder="Título de la solicitud"></div>
      <div class="field"><label for="er-desc">Descripción</label><textarea id="er-desc" rows="3"></textarea></div>
      <div class="field"><label for="er-resp">Responsable</label><select id="er-resp">${AyData.getUsers().filter(u => u.role === 'employee').map(u => `<option>${escapeHtml(u.nombre)}</option>`).join('')}</select></div>
    `,
    foot: `<button class="btn btn--ghost" data-close-modal>Cancelar</button><button class="btn btn--primary" id="er-submit">${icon('i-plus')}Crear solicitud</button>`,
  });
  qs('#er-submit').addEventListener('click', () => {
    const titulo = qs('#er-titulo').value.trim();
    if (!titulo) { qs('#er-titulo').closest('.field').classList.add('has-error'); return; }
    AyData.addRequest({ empresaId: qs('#er-emp').value, titulo, tipo: qs('#er-tipo').value, descripcion: qs('#er-desc').value.trim(), prioridad: 'media', responsable: qs('#er-resp').value, estado: 'nuevo' });
    closeModal();
    toast('Solicitud creada.');
    buildSidebar();
    onDone();
  });
}

function renderEmployeeDocumentos(view) {
  const docs = AyData.getDocuments().filter(d => misEmpresaIds().includes(d.empresaId));
  view.innerHTML = `
    ${pageHead({ eyebrow: 'Operación', title: 'Documentos', sub: 'Documentos de tus clientes designados.', actions: `<button class="btn btn--primary" id="btn-doc-add">${icon('i-upload')}Cargar documento</button>` })}
    <div id="doc-list">
      ${filterBarHtml('doc-toolbar', { placeholder: 'Buscar por cliente o documento…' })}
      <div class="table-wrap" data-role="wrap">
        <table class="data-table">
          <thead><tr><th>Cliente</th><th>Documento</th><th>Categoría</th><th>Fecha</th><th>Estado</th></tr></thead>
          <tbody data-role="tbody"></tbody>
        </table>
      </div>
      <div data-role="empty" style="display:none;">${emptyState({ icon: 'i-file', title: 'Sin resultados', text: 'Probá con otra búsqueda.' })}</div>
    </div>
  `;
  wireFilterableList(qs('#doc-list'), {
    data: docs, tbodySelector: '[data-role=tbody]', wrapSelector: '[data-role=wrap]', emptySelector: '[data-role=empty]',
    matches: (d, q) => d.nombre.toLowerCase().includes(q) || AyData.getEmpresa(d.empresaId).nombre.toLowerCase().includes(q),
    renderRow: (d) => `<tr><td class="cell-main"><a href="#/clientes/${d.empresaId}">${escapeHtml(AyData.getEmpresa(d.empresaId).nombre)}</a></td><td>${escapeHtml(d.nombre)}</td><td class="cell-muted">${escapeHtml(d.categoria)}</td><td class="cell-muted">${ayFormatDate(d.fecha)}</td><td><span class="badge-status badge-status--${d.estado}">${AyLabels.estado(d.estado)}</span></td></tr>`,
  });
  qs('#btn-doc-add').addEventListener('click', () => openEmployeeUploadModal(null, () => renderEmployeeDocumentos(view)));
}

function openEmployeeUploadModal(presetEmpresa, onDone) {
  openModal({
    title: 'Cargar documento',
    body: `
      <div class="field"><label for="ed-emp">Cliente</label>${empresaSelectHtml('ed-emp', presetEmpresa && presetEmpresa.id)}</div>
      <div class="field"><label for="ed-nombre">Nombre del archivo</label><input id="ed-nombre" placeholder="Ej: Balance septiembre.pdf"></div>
      <div class="field"><label for="ed-cat">Categoría</label><select id="ed-cat"><option>Facturación</option><option>Balances</option><option>Contratos</option><option>Stock</option><option>Reportes</option><option>Otro</option></select></div>
    `,
    foot: `<button class="btn btn--ghost" data-close-modal>Cancelar</button><button class="btn btn--primary" id="ed-submit">${icon('i-upload')}Cargar</button>`,
  });
  qs('#ed-submit').addEventListener('click', () => {
    const nombre = qs('#ed-nombre').value.trim();
    if (!nombre) { qs('#ed-nombre').closest('.field').classList.add('has-error'); return; }
    AyData.addDocument({ empresaId: qs('#ed-emp').value, nombre, categoria: qs('#ed-cat').value, tamano: Math.round(60 + Math.random() * 900) + ' KB', estado: 'disponible', subidoPor: Ctx.user.nombre });
    closeModal();
    toast('Documento cargado y disponible para el cliente.');
    onDone();
  });
}

function renderEmployeeReportes(view) {
  const reps = AyData.getReports().filter(r => misEmpresaIds().includes(r.empresaId));
  view.innerHTML = `
    ${pageHead({ eyebrow: 'Operación', title: 'Reportes', sub: 'Informes generados para tus clientes designados.', actions: `<button class="btn btn--primary" id="btn-rep-add">${icon('i-plus')}Generar informe</button>` })}
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Cliente</th><th>Informe</th><th>Tipo</th><th>Fecha</th><th></th></tr></thead>
        <tbody>${reps.map(r => `<tr><td class="cell-main"><a href="#/clientes/${r.empresaId}">${escapeHtml(AyData.getEmpresa(r.empresaId).nombre)}</a></td><td>${escapeHtml(r.titulo)}</td><td class="cell-muted">${r.tipo}</td><td class="cell-muted">${ayFormatDate(r.fecha)}</td><td><button class="btn-icon" data-open-report="${r.id}">${icon('i-eye')}</button></td></tr>`).join('')}</tbody>
      </table>
    </div>
  `;
  qsa('[data-open-report]', view).forEach(btn => btn.addEventListener('click', () => openReportModal(reps.find(r => r.id === btn.dataset.openReport))));
  qs('#btn-rep-add').addEventListener('click', () => openNewReportModal(null, () => renderEmployeeReportes(view)));
}

function openNewReportModal(presetEmpresa, onDone) {
  openModal({
    title: 'Generar informe', size: 'lg',
    body: `
      <div class="field"><label for="nrep-emp">Cliente</label>${empresaSelectHtml('nrep-emp', presetEmpresa && presetEmpresa.id)}</div>
      <div class="field"><label for="nrep-titulo">Título</label><input id="nrep-titulo" placeholder="Ej: Informe semanal — semana del..."></div>
      <div class="field"><label for="nrep-tipo">Tipo</label><select id="nrep-tipo"><option>Semanal</option><option>Mensual</option><option>Mercado</option></select></div>
      <div class="grid grid-2">
        <div class="field"><label for="nrep-m1l">Métrica 1</label><input id="nrep-m1l" placeholder="Ej: Ventas" value="Ventas"></div>
        <div class="field"><label for="nrep-m1v">Valor</label><input id="nrep-m1v" placeholder="Ej: $ 1.000.000"></div>
        <div class="field"><label for="nrep-m2l">Métrica 2</label><input id="nrep-m2l" placeholder="Ej: Margen" value="Margen"></div>
        <div class="field"><label for="nrep-m2v">Valor</label><input id="nrep-m2v" placeholder="Ej: 25%"></div>
      </div>
      <div class="field"><label for="nrep-resumen">Resumen para el cliente</label><textarea id="nrep-resumen" rows="4" placeholder="Explicá en lenguaje simple qué pasó y qué recomendás"></textarea></div>
    `,
    foot: `<button class="btn btn--ghost" data-close-modal>Cancelar</button><button class="btn btn--primary" id="nrep-submit">${icon('i-plus')}Publicar informe</button>`,
  });
  qs('#nrep-submit').addEventListener('click', () => {
    const titulo = qs('#nrep-titulo').value.trim();
    if (!titulo) { qs('#nrep-titulo').closest('.field').classList.add('has-error'); return; }
    const metrics = [];
    if (qs('#nrep-m1v').value.trim()) metrics.push({ label: qs('#nrep-m1l').value.trim() || 'Métrica', value: qs('#nrep-m1v').value.trim() });
    if (qs('#nrep-m2v').value.trim()) metrics.push({ label: qs('#nrep-m2l').value.trim() || 'Métrica', value: qs('#nrep-m2v').value.trim() });
    AyData.addReport({ empresaId: qs('#nrep-emp').value, titulo, tipo: qs('#nrep-tipo').value, resumen: qs('#nrep-resumen').value.trim() || 'Sin comentarios adicionales.', metrics: metrics.length ? metrics : [{ label: 'Estado', value: 'Al día' }] });
    closeModal();
    toast('Informe publicado. El cliente ya puede verlo.');
    onDone();
  });
}

function renderEmployeeTareas(view) {
  const ids = misEmpresaIds();
  const tasks = AyData.getTasks().filter(t => t.empresaId == null || ids.includes(t.empresaId));
  view.innerHTML = `
    ${pageHead({ eyebrow: 'Operación', title: 'Tareas', sub: 'Tus tareas y las de tus clientes designados.', actions: `<button class="btn btn--primary" id="btn-task-add">${icon('i-plus')}Nueva tarea</button>` })}
    ${taskBoardHtml(tasks)}
  `;
  wireTaskBoard(view, () => renderEmployeeTareas(view));
  qs('#btn-task-add').addEventListener('click', () => openNewTaskModal(null, () => renderEmployeeTareas(view)));
}

function openNewTaskModal(presetEmpresa, onDone) {
  openModal({
    title: 'Nueva tarea',
    body: `
      <div class="field"><label for="nt-emp">Cliente (opcional)</label><select id="nt-emp"><option value="">Interna (sin cliente)</option>${misEmpresas().map(e => `<option value="${e.id}" ${presetEmpresa && presetEmpresa.id === e.id ? 'selected' : ''}>${escapeHtml(e.nombre)}</option>`).join('')}</select></div>
      <div class="field"><label for="nt-titulo">Título</label><input id="nt-titulo" placeholder="Ej: Actualizar lista de precios"></div>
      <div class="field"><label for="nt-resp">Responsable</label><select id="nt-resp">${AyData.getUsers().filter(u => u.role === 'employee').map(u => `<option>${escapeHtml(u.nombre)}</option>`).join('')}</select></div>
      <div class="grid grid-2">
        <div class="field"><label for="nt-prio">Prioridad</label><select id="nt-prio"><option value="baja">Baja</option><option value="media" selected>Media</option><option value="alta">Alta</option></select></div>
        <div class="field"><label for="nt-fecha">Vencimiento</label><input id="nt-fecha" type="date" value="${ayToday(2)}"></div>
      </div>
    `,
    foot: `<button class="btn btn--ghost" data-close-modal>Cancelar</button><button class="btn btn--primary" id="nt-submit">${icon('i-plus')}Asignar</button>`,
  });
  qs('#nt-submit').addEventListener('click', () => {
    const titulo = qs('#nt-titulo').value.trim();
    if (!titulo) { qs('#nt-titulo').closest('.field').classList.add('has-error'); return; }
    AyData.addTask({ empresaId: qs('#nt-emp').value || null, titulo, responsable: qs('#nt-resp').value, prioridad: qs('#nt-prio').value, vencimiento: qs('#nt-fecha').value || ayToday(2) });
    closeModal();
    toast('Tarea asignada.');
    buildSidebar();
    onDone();
  });
}

function renderEmployeeActividad(view) {
  const activity = AyData.getActivity().filter(a => misEmpresaIds().includes(a.empresaId));
  view.innerHTML = `
    ${pageHead({ eyebrow: 'Operación', title: 'Actividad', sub: 'Todo lo que fuiste haciendo con tus clientes designados.' })}
    <div class="card"><div class="activity-list">${activity.map(a => activityRow(a, true)).join('')}</div></div>
  `;
}

function renderEmployeeNotas(view) {
  const notes = AyData.getNotes().filter(n => misEmpresaIds().includes(n.empresaId));
  view.innerHTML = `
    ${pageHead({ eyebrow: 'Interno', title: 'Notas internas', sub: 'Observaciones del equipo sobre tus clientes designados.', actions: `<button class="btn btn--primary" id="btn-note-add">${icon('i-plus')}Nueva nota</button>` })}
    ${notes.length ? notes.map(n => `<div class="note-card"><div class="note-head"><span>${escapeHtml(AyData.getEmpresa(n.empresaId).nombre)} · ${escapeHtml(n.autor)}</span><span>${ayFormatDate(n.fecha)}</span></div><div class="note-text">${escapeHtml(n.texto)}</div></div>`).join('')
    : emptyState({ icon: 'i-note', title: 'Sin notas', text: 'Todavía no hay notas internas cargadas.' })}
  `;
  qs('#btn-note-add').addEventListener('click', () => openNewNoteModal(null, () => renderEmployeeNotas(view)));
}

function openNewNoteModal(presetEmpresa, onDone) {
  openModal({
    title: 'Nueva nota interna', sub: 'Solo la ve el equipo de AdminYAAA.',
    body: `
      <div class="field"><label for="nn-emp">Cliente</label>${empresaSelectHtml('nn-emp', presetEmpresa && presetEmpresa.id)}</div>
      <div class="field"><label for="nn-texto">Nota</label><textarea id="nn-texto" rows="4" placeholder="Ej: Preferencias del cliente, contexto útil, alertas..."></textarea></div>
    `,
    foot: `<button class="btn btn--ghost" data-close-modal>Cancelar</button><button class="btn btn--primary" id="nn-submit">${icon('i-plus')}Guardar nota</button>`,
  });
  qs('#nn-submit').addEventListener('click', () => {
    const texto = qs('#nn-texto').value.trim();
    if (!texto) { qs('#nn-texto').closest('.field').classList.add('has-error'); return; }
    AyData.addNote({ empresaId: qs('#nn-emp').value, autor: Ctx.user.nombre, texto });
    closeModal();
    toast('Nota guardada.');
    onDone();
  });
}

function renderEmployeeUsuarios(view) {
  const users = AyData.getUsers();
  view.innerHTML = `
    ${pageHead({ eyebrow: 'Interno', title: 'Gestión de usuarios', sub: 'Usuarios del panel: clientes y equipo de AdminYAAA.', actions: `<button class="btn btn--primary" id="btn-user-add">${icon('i-plus')}Nuevo usuario</button>` })}
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Nombre</th><th>Rol</th><th>Empresa / Cargo</th><th>Correo</th><th>Estado</th><th></th></tr></thead>
        <tbody>${users.map(u => `
          <tr>
            <td class="cell-main">${u.iniciales} · ${escapeHtml(u.nombre)}</td>
            <td class="cell-muted">${u.role === 'client' ? 'Cliente' : 'Equipo AdminYAAA'}</td>
            <td class="cell-muted">${u.role === 'client' ? escapeHtml(AyData.getEmpresa(u.empresaId).nombre) : escapeHtml(u.cargo || '—')}</td>
            <td class="cell-muted">${escapeHtml(u.email)}</td>
            <td>${u.activo === false ? `<span class="badge-status badge-status--alerta">Inactivo</span>` : `<span class="badge-status badge-status--activo">Activo</span>`}</td>
            <td class="row-actions"><button class="btn btn--ghost btn--sm" data-toggle-user="${u.id}">${u.activo === false ? 'Activar' : 'Desactivar'}</button></td>
          </tr>`).join('')}</tbody>
      </table>
    </div>
  `;
  qsa('[data-toggle-user]', view).forEach(btn => btn.addEventListener('click', () => {
    const u = AyData.getUser(btn.dataset.toggleUser);
    AyData.updateUser(u.id, { activo: u.activo === false });
    toast(u.activo === false ? `${u.nombre} fue reactivado.` : `${u.nombre} fue desactivado.`);
    renderEmployeeUsuarios(view);
  }));
  qs('#btn-user-add').addEventListener('click', () => openNewUserModal(() => renderEmployeeUsuarios(view)));
}

function openNewUserModal(onDone) {
  openModal({
    title: 'Nuevo usuario',
    body: `
      <div class="field"><label for="nu-nombre">Nombre completo</label><input id="nu-nombre" placeholder="Ej: Laura Pérez"></div>
      <div class="field"><label for="nu-email">Correo</label><input id="nu-email" type="email" placeholder="laura@negocio.com"></div>
      <div class="field"><label for="nu-role">Rol</label><select id="nu-role"><option value="client">Cliente</option><option value="employee">Equipo AdminYAAA</option></select></div>
      <div class="field" id="nu-emp-field"><label for="nu-emp">Empresa</label>${empresaSelectHtml('nu-emp')}</div>
      <div class="field" id="nu-cargo-field" style="display:none;"><label for="nu-cargo">Cargo</label><input id="nu-cargo" placeholder="Ej: Administrador de cuentas"></div>
    `,
    foot: `<button class="btn btn--ghost" data-close-modal>Cancelar</button><button class="btn btn--primary" id="nu-submit">${icon('i-plus')}Crear usuario</button>`,
  });
  qs('#nu-role').addEventListener('change', (e) => {
    const isClient = e.target.value === 'client';
    qs('#nu-emp-field').style.display = isClient ? '' : 'none';
    qs('#nu-cargo-field').style.display = isClient ? 'none' : '';
  });
  qs('#nu-submit').addEventListener('click', () => {
    const nombre = qs('#nu-nombre').value.trim();
    const email = qs('#nu-email').value.trim();
    if (!nombre || !email) {
      qs('#nu-nombre').closest('.field').classList.toggle('has-error', !nombre);
      qs('#nu-email').closest('.field').classList.toggle('has-error', !email);
      return;
    }
    const role = qs('#nu-role').value;
    const iniciales = nombre.split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
    AyData.addUser(role === 'client'
      ? { nombre, email, role, iniciales, empresaId: qs('#nu-emp').value }
      : { nombre, email, role, iniciales, cargo: qs('#nu-cargo').value.trim() || 'Equipo AdminYAAA' });
    closeModal();
    toast('Usuario creado.');
    buildSidebar();
    onDone();
  });
}

boot();
