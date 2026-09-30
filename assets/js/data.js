/* AdminYAAA · Panel — cliente de la API real (fetch + sesión de servidor). */

function ayToday(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + (offsetDays || 0));
  return d.toISOString().slice(0, 10);
}

function ayFormatDate(iso) {
  const [y, m, d] = iso.split('-');
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const base = `${parseInt(d, 10)} ${meses[parseInt(m, 10) - 1]}`;
  return y === String(new Date().getFullYear()) ? base : `${base} ${y}`;
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

async function ayJson(res) {
  let data = {};
  try { data = await res.json(); } catch (e) { /* respuesta sin cuerpo */ }
  if (!res.ok) throw new Error(data.error || 'Algo falló. Probá de nuevo.');
  return data;
}

const AyData = {
  state: null,
  me: null,

  /* ---------------- Sesión ---------------- */
  async login(email, password) {
    const res = await fetch('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    let data = {};
    try { data = await res.json(); } catch (e) { /* sin cuerpo */ }
    if (!res.ok) return { ok: false, error: data.error || 'No pudimos iniciar sesión.' };
    this.me = data.user;
    return { ok: true, user: data.user };
  },
  async logout() {
    try { await fetch('/api/logout', { method: 'POST' }); } catch (e) { /* red caída: igual limpiamos localmente */ }
    this.me = null;
    this.state = null;
  },
  async fetchMe() {
    try {
      const res = await fetch('/api/me');
      if (!res.ok) { this.me = null; return null; }
      const data = await res.json();
      this.me = data.user;
      return this.me;
    } catch (e) { return null; }
  },
  async loadState() {
    const res = await fetch('/api/state');
    this.state = await ayJson(res);
    return this.state;
  },
  async resetDemo() {
    const res = await fetch('/api/reset-demo', { method: 'POST' });
    await ayJson(res);
    await this.loadState();
  },

  /* ---------------- Usuarios y empresas (lectura desde el estado ya cargado) ---------------- */
  getUsers() { return this.state.users; },
  getUser(id) {
    if (this.me && this.me.id === id) return this.me;
    return this.state.users.find(u => u.id === id);
  },
  getEmpresa(id) { return this.state.empresas[id]; },
  getEmpresas() { return Object.values(this.state.empresas); },

  async addUser(user) {
    const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(user) });
    const data = await ayJson(res);
    this.state.users.push(data.user);
    return data.user;
  },
  async updateUser(id, patch) {
    const res = await fetch(`/api/users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    const data = await ayJson(res);
    const idx = this.state.users.findIndex(u => u.id === id);
    if (idx >= 0) this.state.users[idx] = data.user;
    return data.user;
  },

  /* ---------------- Solicitudes ---------------- */
  getRequests(empresaId) {
    const all = this.state.requests;
    return empresaId ? all.filter(r => r.empresaId === empresaId) : all;
  },
  async addRequest(req) {
    const res = await fetch('/api/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req) });
    const data = await ayJson(res);
    this.state.requests.unshift(data.request);
    return data.request;
  },
  async updateRequestStatus(id, estado) {
    const res = await fetch(`/api/requests/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado }) });
    const data = await ayJson(res);
    const idx = this.state.requests.findIndex(r => r.id === id);
    if (idx >= 0) this.state.requests[idx] = data.request;
    return data.request;
  },

  /* ---------------- Documentos (con archivo real) ---------------- */
  getDocuments(empresaId) {
    const all = this.state.documents;
    return empresaId ? all.filter(d => d.empresaId === empresaId) : all;
  },
  async addDocument(doc, file) {
    const fd = new FormData();
    fd.append('empresaId', doc.empresaId);
    fd.append('categoria', doc.categoria || 'Otro');
    if (doc.nombre) fd.append('nombre', doc.nombre);
    if (file) fd.append('file', file);
    const res = await fetch('/api/documents', { method: 'POST', body: fd });
    const data = await ayJson(res);
    this.state.documents.unshift(data.document);
    return data.document;
  },
  downloadUrl(docId) { return `/api/documents/${docId}/file`; },

  /* ---------------- Reportes ---------------- */
  getReports(empresaId) {
    const all = this.state.reports;
    return empresaId ? all.filter(r => r.empresaId === empresaId) : all;
  },
  async addReport(rep) {
    const res = await fetch('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rep) });
    const data = await ayJson(res);
    this.state.reports.unshift(data.report);
    return data.report;
  },

  /* ---------------- Tareas ---------------- */
  getTasks(empresaId) {
    const all = this.state.tasks;
    return empresaId === undefined ? all : all.filter(t => t.empresaId === empresaId);
  },
  async addTask(task) {
    const res = await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(task) });
    const data = await ayJson(res);
    this.state.tasks.unshift(data.task);
    return data.task;
  },
  async updateTaskStatus(id, estado) {
    const res = await fetch(`/api/tasks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado }) });
    const data = await ayJson(res);
    const idx = this.state.tasks.findIndex(t => t.id === id);
    if (idx >= 0) this.state.tasks[idx] = data.task;
    return data.task;
  },

  /* ---------------- Actividad ---------------- */
  getActivity(empresaId) {
    const all = this.state.activity;
    const list = empresaId ? all.filter(a => a.empresaId === empresaId) : all;
    return list.slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
  },

  /* ---------------- Notas internas ---------------- */
  getNotes(empresaId) {
    const all = this.state.notes;
    const list = empresaId ? all.filter(n => n.empresaId === empresaId) : all;
    return list.slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
  },
  async addNote(note) {
    const res = await fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(note) });
    const data = await ayJson(res);
    this.state.notes.unshift(data.note);
    return data.note;
  },

  /* ---------------- Módulos del cliente ---------------- */
  getStock(empresaId) { return (this.state.stock[empresaId]) || []; },
  getBudgets(empresaId) { return (this.state.budgets[empresaId]) || []; },
  getAccounts(empresaId) { return (this.state.accounts[empresaId]) || []; },
};

const AyLabels = {
  estado(v) {
    return {
      nuevo: 'Nuevo', proceso: 'En proceso', esperando_info: 'Esperando información', terminado: 'Terminado',
      finalizado: 'Finalizado', demora: 'Con demora', no_cumplido: 'No cumplido',
      aprobado: 'Aprobado', pendiente: 'Pendiente', rechazada: 'Rechazada',
      disponible: 'Disponible', revision: 'En revisión', activo: 'Activo',
    }[v] || v;
  },
  modulo(v) {
    return { presupuestos: 'Presupuestos', stock: 'Stock', 'cuentas-corrientes': 'Cuentas corrientes' }[v] || v;
  },
  prioridad(v) {
    return { alta: 'Alta', media: 'Media', baja: 'Baja' }[v] || v;
  },
};
