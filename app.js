/* =========================================================
   Mis Cuentas — Libro de gastos e ingresos
   App 100% local (localStorage). Sin dependencias externas.
   ========================================================= */
'use strict';

/* ---------- Claves y datos por defecto ---------- */
const LS_KEY = 'misCuentas.v1';

const DEFAULT_CATEGORIES = [
  { id: 'c-comida',     name: 'Comida',      icon: '🍔', color: '#e07b39', type: 'expense' },
  { id: 'c-transporte', name: 'Transporte',  icon: '🚌', color: '#3b7dd8', type: 'expense' },
  { id: 'c-hogar',      name: 'Hogar',       icon: '🏠', color: '#8a5fc2', type: 'expense' },
  { id: 'c-servicios',  name: 'Servicios',   icon: '💡', color: '#c2a41e', type: 'expense' },
  { id: 'c-salud',      name: 'Salud',       icon: '💊', color: '#d14874', type: 'expense' },
  { id: 'c-ocio',       name: 'Ocio',        icon: '🎮', color: '#2fa8a0', type: 'expense' },
  { id: 'c-educacion',  name: 'Educación',   icon: '📚', color: '#5c7a3a', type: 'expense' },
  { id: 'c-ropa',       name: 'Ropa',        icon: '👕', color: '#b05c8f', type: 'expense' },
  { id: 'c-otros-g',    name: 'Otros gastos',icon: '📦', color: '#707d78', type: 'expense' },
  { id: 'c-salario',    name: 'Salario',     icon: '💼', color: '#157f3d', type: 'income' },
  { id: 'c-ventas',     name: 'Ventas',      icon: '🛍️', color: '#1d8a52', type: 'income' },
  { id: 'c-inversion',  name: 'Inversiones', icon: '📈', color: '#0e7a5f', type: 'income' },
  { id: 'c-regalos',    name: 'Regalos',     icon: '🎁', color: '#3d9e6d', type: 'income' },
  { id: 'c-otros-i',    name: 'Otros ingresos', icon: '➕', color: '#587d68', type: 'income' },
];

/* ---------- Estado ---------- */
/* ---------- Cuentas por defecto (incluye la bóveda "Oculto") ---------- */
const HIDDEN_ACC_ID = 'a-oculto';
const DEFAULT_ACCOUNTS = [
  { id: 'a-efectivo', name: 'Efectivo', icon: '💵', color: '#12734f' },
  { id: 'a-banco', name: 'Cuenta de banco', icon: '🏦', color: '#274f8f' },
  { id: HIDDEN_ACC_ID, name: 'Oculto', icon: '🫣', color: '#5d6d75', hidden: true },
];

function freshState() {
  return {
    transactions: [], // {id,type('income'|'expense'|'transfer'),amount,categoryId,accountId,toAccountId?,date,description,createdAt}
    categories: structuredClone(DEFAULT_CATEGORIES), // + budget opcional por categoría
    accounts: structuredClone(DEFAULT_ACCOUNTS),
    templates: [],    // {id,type,amount,categoryId,accountId,description,freq,lastPosted,createdAt}
    goals: [],        // {id,name,icon,target,saved,deadline,createdAt}
    settings: { currency: 'MXN', budget: 0, theme: 'light', lock: null, hiddenMasked: true },
  };
}

/* Garantiza integridad: cuentas válidas, bóveda presente y referencias
   correctas. MIGRACIÓN automática para respaldos antiguos. */
function normalizeState(s) {
  if (!Array.isArray(s.accounts) || !s.accounts.length) {
    s.accounts = structuredClone(DEFAULT_ACCOUNTS);
  }
  // La cuenta Oculto siempre existe y está protegida
  if (!s.accounts.some(a => a.hidden)) {
    s.accounts.push({ id: HIDDEN_ACC_ID, name: 'Oculto', icon: '🫣', color: '#5d6d75', hidden: true, createdAt: Date.now() });
  }
  const ids = new Set(s.accounts.map(a => a.id));
  const hiddenIds = new Set(s.accounts.filter(a => a.hidden).map(a => a.id));
  const normal = s.accounts.filter(a => !a.hidden);
  const dflt = (normal[0] || s.accounts[0]).id;
  const otherOf = (id) => (s.accounts.find(a => a.id !== id) || s.accounts[0]).id;
  s.transactions.forEach(t => {
    if (t.type === 'transfer') {
      if (!ids.has(t.accountId)) t.accountId = dflt;
      if (!ids.has(t.toAccountId) || t.toAccountId === t.accountId) t.toAccountId = otherOf(t.accountId);
    } else {
      // Los gastos/ingresos nunca viven en la bóveda (solo entra por transferencia)
      if (!ids.has(t.accountId) || hiddenIds.has(t.accountId)) t.accountId = dflt;
    }
  });
  s.templates.forEach(t => {
    if (!ids.has(t.accountId) || hiddenIds.has(t.accountId)) t.accountId = dflt;
  });
  return s;
}

let state = load();
let editingId = null;

const filters = {
  q: '',
  type: 'all',
  category: 'all',
  account: 'all', // id de cuenta | 'all'
  month: currentMonth(), // 'YYYY-MM' | 'all'
  from: '',   // 'YYYY-MM-DD' | ''  (rango anula "month")
  to: '',
  min: '',    // número | ''
  max: '',
};

/* ---------- Almacenamiento a prueba de fallos ----------
   Si el navegador/visor bloquea localStorage (modo privado,
   visor de archivos en iframe, etc.), se usa memoria temporal
   y se avisa al usuario en vez de fallar en silencio. */
const storage = (() => {
  try {
    const probe = '__mc_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return {
      ok: true,
      get: (k) => localStorage.getItem(k),
      set: (k, v) => localStorage.setItem(k, v),
    };
  } catch {
    const mem = {};
    return {
      ok: false,
      get: (k) => (k in mem ? mem[k] : null),
      set: (k, v) => { mem[k] = String(v); },
    };
  }
})();

function load() {
  try {
    const raw = storage.get(LS_KEY);
    if (!raw) return freshState();
    const data = JSON.parse(raw);
    const base = freshState();
    return normalizeState({
      transactions: Array.isArray(data.transactions) ? data.transactions : [],
      categories: Array.isArray(data.categories) && data.categories.length ? data.categories : base.categories,
      accounts: Array.isArray(data.accounts) && data.accounts.length ? data.accounts : base.accounts,
      templates: Array.isArray(data.templates) ? data.templates : [],
      goals: Array.isArray(data.goals) ? data.goals : [],
      settings: { ...base.settings, ...(data.settings || {}) },
    });
  } catch {
    return freshState();
  }
}

function save() {
  try {
    storage.set(LS_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    console.error('No se pudo guardar:', err);
    toast('No se pudo guardar en este navegador');
    return false;
  }
}

/* ---------- Utilidades ---------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

function uid() {
  return (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2));
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmt(amount) {
  try {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: state.settings.currency || 'MXN',
    }).format(amount);
  } catch {
    return '$' + amount.toFixed(2);
  }
}

function fmtDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const hoy = todayISO();
  const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
  const ayerISO = `${ayer.getFullYear()}-${String(ayer.getMonth() + 1).padStart(2, '0')}-${String(ayer.getDate()).padStart(2, '0')}`;
  const opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  let label = date.toLocaleDateString('es-MX', opts);
  if (iso === hoy) label = 'Hoy · ' + label;
  else if (iso === ayerISO) label = 'Ayer · ' + label;
  return label;
}

function catById(id) {
  return state.categories.find(c => c.id === id) || { id, name: 'Sin categoría', icon: '❔', color: '#888', type: 'both' };
}

function accById(id) {
  return state.accounts.find(a => a.id === id) || { id, name: 'Sin cuenta', icon: '❔', color: '#888' };
}

/* Saldo de una cuenta: ingresos − gastos ± transferencias */
function accountBalance(accId) {
  let bal = 0;
  state.transactions.forEach(t => {
    if (t.type === 'transfer') {
      if (t.accountId === accId) bal -= t.amount;
      if (t.toAccountId === accId) bal += t.amount;
    } else if (t.accountId === accId) {
      bal += t.type === 'income' ? t.amount : -t.amount;
    }
  });
  return Math.round(bal * 100) / 100;
}

/* Dinero "normal" (sin la bóveda Oculto) */
function normalAccounts() { return state.accounts.filter(a => !a.hidden); }
function hiddenAccounts() { return state.accounts.filter(a => a.hidden); }
function normalTotal() { return normalAccounts().reduce((s, a) => s + accountBalance(a.id), 0); }
function hiddenTotal() { return hiddenAccounts().reduce((s, a) => s + accountBalance(a.id), 0); }

function hexToRgba(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

/* ---------- Lógica de datos ---------- */
function filteredTx() {
  const q = filters.q.trim().toLowerCase();
  const useRange = !!(filters.from || filters.to);
  const hid = new Set(hiddenAccounts().map(a => a.id));
  return state.transactions
    .filter(t => {
      // Los movimientos de/ hacia Oculto jamás aparecen en el libro normal
      if (t.type === 'transfer' && (hid.has(t.accountId) || hid.has(t.toAccountId))) return false;
      if (filters.type !== 'all' && t.type !== filters.type) return false;
      if (filters.category !== 'all' && t.categoryId !== filters.category) return false;
      if (filters.account !== 'all') {
        const a = filters.account;
        if (t.type === 'transfer') {
          if (t.accountId !== a && t.toAccountId !== a) return false;
        } else if (t.accountId !== a) return false;
      }
      // Mes rápido cede ante el rango de fechas avanzado
      if (!useRange && filters.month !== 'all' && !t.date.startsWith(filters.month)) return false;
      if (filters.from && t.date < filters.from) return false;
      if (filters.to && t.date > filters.to) return false;
      if (filters.min !== '' && t.amount < filters.min) return false;
      if (filters.max !== '' && t.amount > filters.max) return false;
      if (q && !t.description.toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

function monthTx(month) {
  return state.transactions.filter(t => t.date.startsWith(month));
}

function sum(list, type) {
  return list.filter(t => t.type === type).reduce((s, t) => s + t.amount, 0);
}

/* ---------- Render: resumen ---------- */
function renderSummary() {
  const balance = normalTotal(); // sin el dinero Oculto
  $('#sum-balance').textContent = fmt(balance);
  $('#sum-balance').classList.toggle('negative', balance < 0);
  $('#sum-balance').style.color = balance < 0 ? 'var(--out)' : '';

  const hBal = hiddenTotal();
  $('#sum-balance-hint').textContent = hBal !== 0
    ? 'Histórico · sin contar el dinero apartado'
    : 'Ingresos − gastos (histórico)';

  const scope = filters.month === 'all' ? 'total' : 'filtrado';
  $('#sum-in-scope').textContent = `(${scope})`;
  $('#sum-out-scope').textContent = `(${scope})`;

  const list = filteredTx();
  const tin = list.filter(t => t.type === 'income');
  const tout = list.filter(t => t.type === 'expense');
  $('#sum-in').textContent = fmt(sum(list, 'income'));
  $('#sum-out').textContent = fmt(sum(list, 'expense'));
  $('#sum-in-count').textContent = `${tin.length} movimiento${tin.length === 1 ? '' : 's'}`;
  $('#sum-out-count').textContent = `${tout.length} movimiento${tout.length === 1 ? '' : 's'}`;

  // Presupuesto (siempre contra el mes calendario actual)
  const budget = Number(state.settings.budget) || 0;
  const spentThisMonth = sum(monthTx(currentMonth()), 'expense');
  const availEl = $('#sum-available');
  const barEl = $('#budget-bar');
  const hintEl = $('#budget-hint');

  if (budget > 0) {
    const available = budget - spentThisMonth;
    const pct = Math.min(100, (spentThisMonth / budget) * 100);
    availEl.textContent = fmt(available);
    availEl.style.color = available < 0 ? 'var(--out)' : '';
    barEl.style.width = pct + '%';
    barEl.className = 'progress-fill' + (pct >= 100 ? ' over' : pct >= 75 ? ' warn' : '');
    hintEl.innerHTML = `Gastado ${fmt(spentThisMonth)} de ${fmt(budget)} (${Math.round(pct)}%)`;
    document.title = `${fmt(available)} disponibles · Mis Cuentas`;
  } else {
    availEl.textContent = '—';
    availEl.style.color = '';
    barEl.style.width = '0%';
    hintEl.innerHTML = 'Sin presupuesto — <button class="link-btn" id="link-set-budget">establecer</button>';
    $('#link-set-budget').addEventListener('click', () => openSettings(true));
  }
}

/* ---------- Render: gráfica dona ---------- */
function renderDonut() {
  const canvas = $('#chart-donut');
  const ctx = canvas.getContext('2d');
  const legend = $('#chart-legend');
  const empty = $('#chart-empty');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  legend.innerHTML = '';

  const expenses = filteredTx().filter(t => t.type === 'expense');
  const byCat = {};
  expenses.forEach(t => { byCat[t.categoryId] = (byCat[t.categoryId] || 0) + t.amount; });
  const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0);

  empty.hidden = entries.length > 0;
  canvas.style.display = entries.length ? '' : 'none';
  if (!entries.length) return;

  const cx = canvas.width / 2, cy = canvas.height / 2;
  const r = Math.min(cx, cy) - 8, rInner = r * 0.62;
  let angle = -Math.PI / 2;

  entries.forEach(([catId, val]) => {
    const cat = catById(catId);
    const sweep = (val / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, angle, angle + sweep);
    ctx.arc(cx, cy, rInner, angle + sweep, angle, true);
    ctx.closePath();
    ctx.fillStyle = cat.color;
    ctx.fill();
    angle += sweep;

    const li = document.createElement('li');
    li.innerHTML = `<span class="dot" style="background:${cat.color}"></span>
      <span>${cat.icon} ${escapeHtml(cat.name)}</span>
      <span class="lg-val">${fmt(val)} · ${Math.round((val / total) * 100)}%</span>`;
    legend.appendChild(li);
  });

  // Texto central
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--muted');
  ctx.textAlign = 'center';
  ctx.font = '600 13px system-ui';
  ctx.fillText('Total gastos', cx, cy - 6);
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text');
  ctx.font = '700 15px system-ui';
  ctx.fillText(fmt(total), cx, cy + 14);
}

/* ---------- Render: flujo del mes (anillo ingreso vs. gasto) ---------- */
function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function renderFlow() {
  const canvas = $('#chart-flow');
  const ctx = canvas.getContext('2d');
  // Mes analizado: el del filtro; si el filtro es "todos", el mes calendario actual
  const monthKey = filters.month === 'all' ? currentMonth() : filters.month;
  $('#flow-month').textContent = '· ' + monthLabel(monthKey);

  const list = monthTx(monthKey);
  const inc = sum(list, 'income');
  const out = sum(list, 'expense');

  // Tamaño nítido en pantallas de alta densidad
  const SIZE = 200;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = SIZE * dpr;
  canvas.height = SIZE * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, SIZE, SIZE);

  const css = getComputedStyle(document.body);
  const cIn = css.getPropertyValue('--in').trim() || '#12734f';
  const cOut = css.getPropertyValue('--out').trim() || '#c0392b';
  const cText = css.getPropertyValue('--text').trim() || '#1d2b32';
  const cMuted = css.getPropertyValue('--muted').trim() || '#5d6d75';
  const cSurf2 = css.getPropertyValue('--surface-2').trim() || '#eef2f3';

  const cx = SIZE / 2, cy = SIZE / 2, r = SIZE / 2 - 16;
  const start = -Math.PI / 2;
  const hasData = inc > 0 || out > 0;
  const pct = inc > 0 ? (out / inc) * 100 : (out > 0 ? 100 : 0);

  // Anillo base: el 100% del ingreso del mes
  ctx.lineWidth = 18;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.strokeStyle = inc > 0 ? hexToRgba(cIn, 0.22) : cSurf2;
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // Arco rojo: porción del ingreso ya gastada
  if (out > 0) {
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.strokeStyle = cOut;
    ctx.arc(cx, cy, r, start, start + (Math.min(pct, 100) / 100) * Math.PI * 2);
    ctx.stroke();
    // Franja de exceso: se gastó más de lo que ingresó
    if (pct > 100) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.strokeStyle = '#7d1a12';
      ctx.arc(cx, cy, r, start, start + (Math.min(pct - 100, 100) / 100) * Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Texto central
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = (hasData && inc > 0) ? cText : cMuted;
  ctx.font = '700 30px system-ui, sans-serif';
  ctx.fillText((hasData && inc > 0) ? Math.round(pct) + '%' : '—', cx, cy - 8);
  ctx.fillStyle = cMuted;
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillText(inc > 0 ? 'del ingreso gastado' : (out > 0 ? 'sin ingresos' : 'sin movimientos'), cx, cy + 18);

  // Estadísticas laterales
  $('#flow-in').textContent = fmt(inc);
  $('#flow-out').textContent = fmt(out);
  const left = inc - out;
  $('#flow-left').textContent = inc > 0 ? fmt(left) : '—';
  $('#flow-left').style.color = (inc > 0 && left < 0) ? cOut : '';

  // Nota contextual
  const note = $('#flow-note');
  if (!hasData) {
    note.hidden = false;
    note.textContent = 'Aún no hay movimientos registrados en este período.';
  } else if (inc === 0) {
    note.hidden = false;
    note.textContent = 'Hay gastos registrados, pero ningún ingreso en el mes.';
  } else if (pct > 100) {
    note.hidden = false;
    note.textContent = `Los gastos superan los ingresos del mes en ${fmt(out - inc)}.`;
  } else if (pct >= 90) {
    note.hidden = false;
    note.textContent = `Atención: ya utilizaste el ${Math.round(pct)}% del ingreso del mes.`;
  } else {
    note.hidden = true;
  }
}

/* ---------- Render: barras 6 meses ---------- */
function renderMonths() {
  const wrap = $('#chart-months');
  wrap.innerHTML = '';
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('es-MX', { month: 'short' }).replace('.', ''),
    });
  }
  const data = months.map(m => {
    const list = monthTx(m.key);
    return { ...m, in: sum(list, 'income'), out: sum(list, 'expense') };
  });
  const max = Math.max(1, ...data.map(d => Math.max(d.in, d.out)));

  data.forEach(d => {
    const col = document.createElement('div');
    col.className = 'bar-col';
    col.title = `${d.label}: +${fmt(d.in)} / −${fmt(d.out)}`;
    col.innerHTML = `
      <div class="bar-pair">
        <div class="bar in" style="height:${(d.in / max) * 100}%"></div>
        <div class="bar out" style="height:${(d.out / max) * 100}%"></div>
      </div>
      <span>${d.label}</span>`;
    wrap.appendChild(col);
  });
}

/* ---------- Render: filtros ---------- */
function renderFilterOptions() {
  const selCat = $('#f-category');
  const current = selCat.value || 'all';
  selCat.innerHTML = '<option value="all">Todas las categorías</option>' +
    state.categories.map(c => `<option value="${c.id}">${c.icon} ${escapeHtml(c.name)}</option>`).join('');
  selCat.value = state.categories.some(c => c.id === current) ? current : 'all';
  filters.category = selCat.value;
}

/* ---------- Render: libro de cuentas ---------- */
function txItemEl(t) {
  const isTransfer = t.type === 'transfer';
  const cat = isTransfer ? null : catById(t.categoryId);
  const acc = accById(t.accountId);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tx-item';
  btn.setAttribute('aria-label', `Editar: ${t.description}`);

  if (isTransfer) {
    const to = accById(t.toAccountId);
    btn.innerHTML = `
      <span class="tx-ico" style="background:var(--surface-2);border:1px solid var(--border)">⇄</span>
      <span style="min-width:0">
        <span class="tx-desc">${escapeHtml(t.description)}</span><br>
        <span class="tx-cat">${escapeHtml(acc.name)} → ${escapeHtml(to.name)}</span>
      </span>
      <span class="tx-amt trn">${fmt(t.amount)}</span>`;
    btn.addEventListener('click', () => openTransferModal(t));
    return btn;
  }

  btn.innerHTML = `
    <span class="tx-ico" style="background:${hexToRgba(cat.color, .16)}">${cat.icon}</span>
    <span style="min-width:0">
      <span class="tx-desc">${escapeHtml(t.description)}</span><br>
      <span class="tx-cat">${escapeHtml(cat.name)} · ${escapeHtml(acc.name)}</span>
    </span>
    <span class="tx-amt ${t.type === 'income' ? 'in' : 'out'}">
      ${t.type === 'income' ? '+' : '−'}${fmt(t.amount)}
    </span>`;
  btn.addEventListener('click', () => openTxModal(t));
  return btn;
}

function renderList() {
  const list = filteredTx();
  const wrap = $('#tx-list');
  const empty = $('#tx-empty');
  wrap.innerHTML = '';

  $('#ledger-count').textContent = `${list.length} movimiento${list.length === 1 ? '' : 's'}`;
  empty.hidden = list.length > 0;
  $('#btn-demo').hidden = state.transactions.length > 0;

  // Agrupar por fecha
  const groups = {};
  list.forEach(t => { (groups[t.date] = groups[t.date] || []).push(t); });

  Object.keys(groups).sort((a, b) => b.localeCompare(a)).forEach(date => {
    const items = groups[date];
    const dayIn = sum(items, 'income');
    const dayOut = sum(items, 'expense');
    const net = dayIn - dayOut;

    const section = document.createElement('div');
    section.className = 'tx-day';

    const head = document.createElement('div');
    head.className = 'tx-day-head';
    head.innerHTML = `<span>${fmtDate(date)}</span>
      <span>${net >= 0 ? '+' : '−'}${fmt(Math.abs(net))}</span>`;
    section.appendChild(head);

    items.forEach(t => section.appendChild(txItemEl(t)));

    wrap.appendChild(section);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function renderAll() {
  renderFilterOptions();
  renderAccounts();
  renderHidden();
  renderSummary();
  renderFlow();
  renderCatBudgets();
  renderDonut();
  renderGoals();
  renderMonths();
  renderQuick();
  renderList();
  if (view === 'calendar') { renderCalendar(); renderCalDetail(); }
}

/* ---------- Modal: movimiento ---------- */
const modalTx = $('#modal-tx');

function fillTxCategories(type, selectedId) {
  const sel = $('#tx-category');
  const cats = state.categories.filter(c => c.type === type || c.type === 'both');
  sel.innerHTML = cats.map(c => `<option value="${c.id}">${c.icon} ${escapeHtml(c.name)}</option>`).join('');
  if (selectedId && cats.some(c => c.id === selectedId)) sel.value = selectedId;
}

function fillTxAccounts(selectedId) {
  const sel = $('#tx-account');
  // Los gastos/ingresos normales no van a la bóveda Oculto
  sel.innerHTML = normalAccounts().map(a => `<option value="${a.id}">${a.icon} ${escapeHtml(a.name)}</option>`).join('');
  if (selectedId && normalAccounts().some(a => a.id === selectedId)) sel.value = selectedId;
}

/* Selector de tipo mediante botones reales (fiable en táctil y WebViews).
   El valor vive en modalTx.dataset.type: 'expense' | 'income'. */
function setTxType(type) {
  modalTx.dataset.type = type === 'income' ? 'income' : 'expense';
  $('#seg-expense').classList.toggle('active', modalTx.dataset.type === 'expense');
  $('#seg-income').classList.toggle('active', modalTx.dataset.type === 'income');
  fillTxCategories(modalTx.dataset.type, $('#tx-category').value);
}

function currentTxType() {
  return modalTx.dataset.type === 'income' ? 'income' : 'expense';
}

$('#seg-expense').addEventListener('click', () => setTxType('expense'));
$('#seg-income').addEventListener('click', () => setTxType('income'));

/* Marca un campo inválido y lo enfoca */
function flagInvalid(el, msg) {
  el.classList.add('invalid');
  el.addEventListener('input', () => el.classList.remove('invalid'), { once: true });
  el.focus();
  return toast(msg);
}

function openTxModal(tx = null, presetDate = null) {
  editingId = tx ? tx.id : null;
  $('#modal-tx-title').textContent = tx ? 'Editar movimiento' : 'Nuevo movimiento';
  $('#btn-tx-delete').hidden = !tx;

  setTxType(tx ? tx.type : 'expense');
  fillTxCategories(tx ? tx.type : 'expense', tx ? tx.categoryId : null);
  fillTxAccounts(tx ? tx.accountId : null);

  $('#tx-amount').value = tx ? tx.amount : '';
  $('#tx-date').value = tx ? tx.date : (presetDate || todayISO());
  $('#tx-desc').value = tx ? tx.description : '';
  $$('#form-tx .invalid').forEach(el => el.classList.remove('invalid'));

  modalTx.showModal();
  setTimeout(() => $('#tx-amount').focus(), 60);
}

$('#form-tx').addEventListener('submit', (e) => {
  e.preventDefault();
  try {
    const amount = parseFloat($('#tx-amount').value);
    const desc = $('#tx-desc').value.trim();
    const date = $('#tx-date').value;
    if (!amount || amount <= 0 || !isFinite(amount)) return flagInvalid($('#tx-amount'), 'Ingresa un monto válido');
    if (!date) return flagInvalid($('#tx-date'), 'Selecciona una fecha');
    if (!desc) return flagInvalid($('#tx-desc'), 'La descripción es obligatoria');

    const data = {
      type: currentTxType(),
      amount: Math.round(amount * 100) / 100,
      categoryId: $('#tx-category').value,
      accountId: $('#tx-account').value,
      date,
      description: desc,
    };

    let msg;
    if (editingId) {
      const idx = state.transactions.findIndex(t => t.id === editingId);
      if (idx >= 0) state.transactions[idx] = { ...state.transactions[idx], ...data };
      msg = 'Movimiento actualizado';
    } else {
      state.transactions.push({ id: uid(), createdAt: Date.now(), ...data });
      msg = data.type === 'income' ? 'Ingreso registrado' : 'Gasto registrado';
    }
    save();
    modalTx.close();
    renderAll();
    toast(msg);
  } catch (err) {
    console.error('Error al guardar el movimiento:', err);
    toast('Error al guardar: ' + err.message);
  }
});

$('#btn-tx-delete').addEventListener('click', () => {
  if (!editingId) return;
  if (!confirm('¿Eliminar este movimiento?')) return;
  state.transactions = state.transactions.filter(t => t.id !== editingId);
  save();
  renderAll();
  modalTx.close();
  toast('Movimiento eliminado');
});

$('#btn-add').addEventListener('click', () => openTxModal());

/* ---------- Modal: categorías ---------- */
const modalCats = $('#modal-cats');

function renderCatList() {
  const ul = $('#cat-list');
  ul.innerHTML = '';
  state.categories.forEach(c => {
    const used = state.transactions.some(t => t.categoryId === c.id);
    const canBudget = c.type !== 'income';
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="ci" style="background:${hexToRgba(c.color, .18)}">${c.icon}</span>
      <span style="min-width:0">${escapeHtml(c.name)}</span>
      ${canBudget
        ? `<input type="number" class="cat-budget" min="0" step="0.01" placeholder="Presup./mes" value="${c.budget || ''}" title="Presupuesto mensual para «${escapeHtml(c.name)}» (0 = sin límite)">`
        : '<span class="cat-nobudget"></span>'}
      <span class="ct">${c.type === 'both' ? 'ambos' : c.type === 'income' ? 'ingreso' : 'gasto'}</span>
      <button type="button" class="cd" title="${used ? 'Tiene movimientos: se reasignarán a «Otros»' : 'Eliminar'}">🗑</button>`;
    if (canBudget) {
      li.querySelector('.cat-budget').addEventListener('change', (e) => {
        c.budget = Math.max(0, parseFloat(e.target.value) || 0);
        save();
        renderCatBudgets();
        toast(c.budget > 0 ? `Presupuesto de ${c.name}: ${fmt(c.budget)}/mes` : `Presupuesto de ${c.name} eliminado`);
      });
    }
    li.querySelector('.cd').addEventListener('click', () => deleteCategory(c.id));
    ul.appendChild(li);
  });
}

function deleteCategory(id) {
  const fallbackId = state.categories.find(c => c.type === 'expense' && c.id !== id)?.id
    || state.categories.find(c => c.id !== id)?.id;
  if (!fallbackId) return toast('Debe existir al menos una categoría');
  const n = state.transactions.filter(t => t.categoryId === id).length;
  const msg = n > 0
    ? `Esta categoría tiene ${n} movimiento(s) que se reasignarán. ¿Eliminar?`
    : '¿Eliminar esta categoría?';
  if (!confirm(msg)) return;
  state.transactions.forEach(t => { if (t.categoryId === id) t.categoryId = fallbackId; });
  state.categories = state.categories.filter(c => c.id !== id);
  save();
  renderCatList();
  renderAll();
  toast('Categoría eliminada');
}

$('#form-cat').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('#cat-name').value.trim();
  if (!name) return toast('Escribe un nombre');
  const icon = ($('#cat-icon').value.trim() || '🏷️').slice(0, 2);
  state.categories.push({
    id: uid(),
    name,
    icon,
    color: $('#cat-color').value,
    type: $('#cat-type').value,
  });
  save();
  $('#cat-name').value = '';
  $('#cat-icon').value = '';
  renderCatList();
  renderAll();
  toast('Categoría creada');
});

$('#link-new-cat').addEventListener('click', () => { renderCatList(); modalCats.showModal(); });
$('#btn-manage-cats').addEventListener('click', () => { $('#modal-settings').close(); renderCatList(); modalCats.showModal(); });

/* ---------- Modal: configuración ---------- */
const modalSettings = $('#modal-settings');

function openSettings(focusBudget = false) {
  $('#set-currency').value = state.settings.currency || 'MXN';
  $('#set-budget').value = state.settings.budget || '';
  renderLockSection();
  modalSettings.showModal();
  if (focusBudget) setTimeout(() => $('#set-budget').focus(), 60);
}

$('#btn-settings').addEventListener('click', () => openSettings());

$('#form-settings').addEventListener('submit', (e) => {
  e.preventDefault();
  state.settings.currency = $('#set-currency').value;
  state.settings.budget = Math.max(0, parseFloat($('#set-budget').value) || 0);
  save();
  renderAll();
  modalSettings.close();
  toast('Configuración guardada');
});

$('#btn-howto').addEventListener('click', () => {
  $('#modal-settings').close();
  $('#modal-help').showModal();
});

$('#btn-about').addEventListener('click', () => {
  $('#modal-settings').close();
  $('#modal-about').showModal();
});

$('#btn-wipe').addEventListener('click', () => {
  if (!confirm('Esto borrará TODOS los datos guardados en este navegador. ¿Continuar?')) return;
  if (!confirm('¿Estás completamente seguro? Exporta un respaldo primero si lo necesitas.')) return;
  state = freshState();
  save();
  applyTheme();
  renderAll();
  modalSettings.close();
  toast('Datos borrados');
});

/* =========================================================
   PARTE 2 — Bloqueo con PIN
   El PIN nunca se guarda en texto plano: solo su huella
   SHA-256 (con sal). Es una medida de privacidad local.
   ========================================================= */

let isUnlocked = !state.settings.lock;

function genSalt() {
  if (crypto.getRandomValues) {
    return [...crypto.getRandomValues(new Uint8Array(8))].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

async function hashPin(salt, pin) {
  const msg = salt + '::' + pin;
  if (crypto.subtle && crypto.subtle.digest) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback para contextos sin WebCrypto (http no seguro): doble FNV (disuasorio)
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < msg.length; i++) {
    h1 = Math.imul(h1 ^ msg.charCodeAt(i), 16777619) >>> 0;
    h2 = Math.imul(h2 ^ msg.charCodeAt(i), (31 + i) | 1) >>> 0;
  }
  return 'fnv' + h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

/* ---------- Sección de seguridad en Configuración ---------- */
function renderLockSection() {
  const on = !!state.settings.lock;
  const status = $('#lock-status');
  status.textContent = on ? 'Bloqueo con PIN: activado' : 'Bloqueo con PIN: desactivado';
  status.classList.toggle('on', on);
  $('#btn-lock-set').textContent = on ? 'Cambiar PIN' : 'Activar PIN';
  $('#btn-lock-off').hidden = !on;
}

$('#btn-lock-set').addEventListener('click', () => openPinModal(state.settings.lock ? 'change' : 'enable'));
$('#btn-lock-off').addEventListener('click', () => openPinModal('disable'));

/* ---------- Modal de PIN (activar / cambiar / desactivar) ---------- */
let pinMode = 'enable';
const modalPin = $('#modal-pin');

function openPinModal(mode) {
  pinMode = mode;
  $('#pin-title').textContent =
    mode === 'disable' ? 'Desactivar bloqueo' :
    mode === 'change' ? 'Cambiar PIN' : 'Activar bloqueo con PIN';
  $('#pin-current-wrap').style.display = (mode === 'enable') ? 'none' : '';
  $('#pin-new-wrap').style.display = (mode === 'disable') ? 'none' : '';
  $('#pin-confirm-wrap').style.display = (mode === 'disable') ? 'none' : '';
  $('#pin-submit').textContent = mode === 'disable' ? 'Desactivar' : 'Guardar';
  ['#pin-current', '#pin-new', '#pin-confirm'].forEach(s => { $(s).value = ''; $(s).classList.remove('invalid'); });
  modalPin.showModal();
  setTimeout(() => $(mode === 'enable' ? '#pin-new' : '#pin-current').focus(), 60);
}

$('#form-pin').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const lock = state.settings.lock;

    if (pinMode !== 'enable') {
      const cur = $('#pin-current').value.trim();
      if (!cur) return flagInvalid($('#pin-current'), 'Ingresa tu PIN actual');
      const h = await hashPin(lock.salt, cur);
      if (h !== lock.hash) return flagInvalid($('#pin-current'), 'PIN actual incorrecto');
    }

    if (pinMode === 'disable') {
      state.settings.lock = null;
      save();
      renderLockSection();
      modalPin.close();
      return toast('Bloqueo desactivado');
    }

    const nw = $('#pin-new').value.trim();
    const cf = $('#pin-confirm').value.trim();
    if (!/^\d{4,6}$/.test(nw)) return flagInvalid($('#pin-new'), 'El PIN debe tener de 4 a 6 dígitos');
    if (nw !== cf) return flagInvalid($('#pin-confirm'), 'La confirmación no coincide');

    const salt = genSalt();
    state.settings.lock = { salt, hash: await hashPin(salt, nw) };
    save();
    renderLockSection();
    modalPin.close();
    toast(pinMode === 'change' ? 'PIN actualizado' : 'Bloqueo con PIN activado');
  } catch (err) {
    console.error(err);
    toast('Error: ' + err.message);
  }
});

/* ---------- Pantalla de bloqueo ---------- */
function showLock() {
  $('#lock-error').hidden = true;
  $('#lock-pin').value = '';
  $('#lock-screen').hidden = false;
  setTimeout(() => $('#lock-pin').focus(), 80);
}

$('#form-lock').addEventListener('submit', async (e) => {
  e.preventDefault();
  const lock = state.settings.lock;
  if (!lock) { $('#lock-screen').hidden = true; return; }
  const pin = $('#lock-pin').value.trim();
  if (!pin) return;
  try {
    const h = await hashPin(lock.salt, pin);
    if (h === lock.hash) {
      isUnlocked = true;
      $('#lock-pin').value = '';
      $('#lock-screen').hidden = true;
    } else {
      $('#lock-error').hidden = false;
      $('#lock-pin').value = '';
      $('#lock-pin').classList.add('err');
      setTimeout(() => $('#lock-pin').classList.remove('err'), 400);
      $('#lock-pin').focus();
    }
  } catch (err) {
    console.error(err);
    $('#lock-error').hidden = false;
  }
});

/* Teclado numérico en pantalla (táctil) */
(function buildKeypad() {
  const pad = $('#lock-keypad');
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].forEach(k => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = k;
    if (!k) { b.disabled = true; b.style.visibility = 'hidden'; }
    b.addEventListener('click', () => {
      const inp = $('#lock-pin');
      if (k === '⌫') inp.value = inp.value.slice(0, -1);
      else if (inp.value.length < 6) inp.value += k;
      $('#lock-error').hidden = true;
      inp.focus();
    });
    pad.appendChild(b);
  });
})();

/* Re-bloqueo automático al salir y volver a la app */
document.addEventListener('visibilitychange', () => {
  if (!state.settings.lock) return;
  if (document.hidden) { isUnlocked = false; }
  else if (!isUnlocked) showLock();
});

/* =========================================================
   PARTE 5 — Vista de calendario
   ========================================================= */
let view = 'list';                 // 'list' | 'calendar'
let calMonth = currentMonth();     // 'YYYY-MM' mostrado en el calendario
let calSelectedDay = null;         // 'YYYY-MM-DD' seleccionado

function setView(v) {
  view = v;
  $('#tab-list').classList.toggle('active', v === 'list');
  $('#tab-cal').classList.toggle('active', v === 'calendar');
  $('#tab-list').setAttribute('aria-selected', String(v === 'list'));
  $('#tab-cal').setAttribute('aria-selected', String(v === 'calendar'));
  $('#view-list').hidden = v !== 'list';
  $('#view-calendar').hidden = v !== 'calendar';
  if (v === 'calendar') { renderCalendar(); renderCalDetail(); }
}

$('#tab-list').addEventListener('click', () => setView('list'));
$('#tab-cal').addEventListener('click', () => setView('calendar'));

/* Formato compacto para las celdas: 1500 → 1.5k */
function shortAmt(v) {
  if (v >= 1000000) return (v / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (v >= 10000) return Math.round(v / 1000) + 'k';
  if (v >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(Math.round(v));
}

function renderCalendar() {
  const [y, m] = calMonth.split('-').map(Number);
  $('#cal-title').textContent = monthLabel(calMonth);
  const grid = $('#cal-grid');
  grid.innerHTML = '';

  const first = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const offset = (first.getDay() + 6) % 7; // semana inicia en lunes

  // Totales por día del mes mostrado (las transferencias no alteran el balance global)
  const daily = {};
  monthTx(calMonth).forEach(t => {
    if (t.type === 'transfer') return;
    const d = daily[t.date] || (daily[t.date] = { in: 0, out: 0 });
    d[t.type === 'income' ? 'in' : 'out'] += t.amount;
  });

  const today = todayISO();
  for (let i = 0; i < offset; i++) {
    const blank = document.createElement('div');
    blank.className = 'cal-cell cal-blank';
    grid.appendChild(blank);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${calMonth}-${String(d).padStart(2, '0')}`;
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cal-cell';
    if (iso === today) cell.classList.add('cal-today');
    if (iso === calSelectedDay) cell.classList.add('cal-selected');

    let html = `<span class="cal-day">${d}</span>`;
    const tot = daily[iso];
    if (tot) {
      html += '<span class="cal-tots">';
      if (tot.in > 0) html += `<span class="cal-in">+${shortAmt(tot.in)}</span>`;
      if (tot.out > 0) html += `<span class="cal-out">−${shortAmt(tot.out)}</span>`;
      html += '</span>';
    }
    cell.innerHTML = html;
    cell.setAttribute('aria-label', `Ver movimientos del ${d}`);
    cell.addEventListener('click', () => {
      calSelectedDay = iso;
      renderCalendar();
      renderCalDetail();
    });
    grid.appendChild(cell);
  }
}

function renderCalDetail() {
  const box = $('#cal-detail');
  if (!calSelectedDay) { box.hidden = true; return; }
  box.hidden = false;

  const items = state.transactions
    .filter(t => t.date === calSelectedDay)
    .sort((a, b) => b.createdAt - a.createdAt);

  $('#cal-detail-title').textContent = fmtDate(calSelectedDay);
  const net = sum(items, 'income') - sum(items, 'expense');
  $('#cal-detail-totals').textContent =
    `${net >= 0 ? '+' : '−'}${fmt(Math.abs(net))} · ${items.length} movimiento${items.length === 1 ? '' : 's'}`;

  const list = $('#cal-detail-list');
  list.innerHTML = '';
  if (!items.length) {
    list.innerHTML = '<p class="cal-none">Sin movimientos este día. Usa «＋ Agregar» para registrar uno.</p>';
    return;
  }
  items.forEach(t => list.appendChild(txItemEl(t)));
}

function shiftCalMonth(delta) {
  const [y, m] = calMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  calMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  calSelectedDay = null;
  renderCalendar();
  renderCalDetail();
}

$('#cal-prev').addEventListener('click', () => shiftCalMonth(-1));
$('#cal-next').addEventListener('click', () => shiftCalMonth(1));
$('#cal-today').addEventListener('click', () => {
  calMonth = currentMonth();
  calSelectedDay = todayISO();
  renderCalendar();
  renderCalDetail();
});
$('#cal-add').addEventListener('click', () => openTxModal(null, calSelectedDay));
$('#cal-close').addEventListener('click', () => {
  calSelectedDay = null;
  renderCalendar();
  renderCalDetail();
});

/* =========================================================
   PARTE 6 — Metas de ahorro
   ========================================================= */
const modalGoal = $('#modal-goal');
const modalGoalAmt = $('#modal-goal-amt');
let editingGoalId = null;
let amtGoalId = null;
let amtMode = 'add'; // 'add' | 'sub'

function openGoalModal(id = null) {
  editingGoalId = id;
  const g = id ? state.goals.find(x => x.id === id) : null;
  $('#goal-title').textContent = g ? 'Editar meta' : 'Nueva meta de ahorro';
  $('#goal-icon').value = g ? g.icon : '';
  $('#goal-name').value = g ? g.name : '';
  $('#goal-target').value = g ? g.target : '';
  $('#goal-deadline').value = g && g.deadline ? g.deadline : '';
  $$('#form-goal .invalid').forEach(el => el.classList.remove('invalid'));
  modalGoal.showModal();
  setTimeout(() => $('#goal-name').focus(), 60);
}

$('#goal-new').addEventListener('click', () => openGoalModal());

$('#form-goal').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('#goal-name').value.trim();
  const target = parseFloat($('#goal-target').value);
  const deadline = $('#goal-deadline').value || null;
  if (!name) return flagInvalid($('#goal-name'), 'Escribe el nombre de la meta');
  if (!target || target <= 0 || !isFinite(target)) return flagInvalid($('#goal-target'), 'Ingresa un monto objetivo válido');

  const data = {
    name,
    target: Math.round(target * 100) / 100,
    deadline,
    icon: ($('#goal-icon').value.trim() || '🎯').slice(0, 2),
  };
  if (editingGoalId) {
    const g = state.goals.find(x => x.id === editingGoalId);
    if (g) Object.assign(g, data);
    toast('Meta actualizada');
  } else {
    state.goals.push({ id: uid(), saved: 0, createdAt: Date.now(), ...data });
    toast('Meta creada 🎯');
  }
  save();
  renderGoals();
  modalGoal.close();
});

function goalHint(g) {
  const remaining = g.target - g.saved;
  if (remaining <= 0) return { text: '¡Meta cumplida!', done: true };
  if (!g.deadline) return { text: 'Faltan ' + fmt(remaining), done: false };
  const days = Math.ceil((new Date(g.deadline + 'T00:00:00') - new Date(todayISO() + 'T00:00:00')) / 86400000);
  if (days < 0) return { text: `Plazo vencido · faltan ${fmt(remaining)}`, done: false, over: true };
  if (days === 0) return { text: `Vence hoy · faltan ${fmt(remaining)}`, done: false, over: true };
  if (days <= 62) {
    const wk = Math.max(1, Math.ceil(days / 7));
    return { text: `${days} días restantes · sugerido ${fmt(remaining / wk)} por semana`, done: false };
  }
  const months = Math.max(1, Math.round(days / 30.44));
  return { text: `${days} días restantes · sugerido ${fmt(remaining / months)} por mes`, done: false };
}

function renderGoals() {
  const grid = $('#goals-grid');
  const empty = $('#goals-empty');
  if (!grid) return;
  grid.innerHTML = '';
  empty.hidden = state.goals.length > 0;

  state.goals.forEach(g => {
    const pct = Math.min(100, (g.saved / g.target) * 100);
    const hint = goalHint(g);
    const done = g.saved >= g.target;

    const card = document.createElement('div');
    card.className = 'goal' + (done ? ' done' : '');
    card.innerHTML = `
      <span class="goal-ico">${g.icon || '🎯'}</span>
      <div class="goal-body">
        <div class="goal-head">
          <span class="goal-name">${escapeHtml(g.name)}</span>
          <span class="goal-nums">${fmt(g.saved)} / ${fmt(g.target)}</span>
        </div>
        <div class="progress"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="goal-meta">
          <span class="goal-pct">${Math.round(pct)}%</span>
          <span class="goal-ddl ${hint.over ? 'over' : ''}">${hint.text}</span>
        </div>
      </div>
      <div class="goal-actions">
        <button type="button" class="ga-add" title="Abonar" ${done ? 'disabled' : ''}>＋</button>
        <button type="button" class="ga-sub" title="Retirar" ${g.saved <= 0 ? 'disabled' : ''}>−</button>
        <button type="button" class="ga-edit" title="Editar">✏️</button>
        <button type="button" class="ga-del" title="Eliminar">🗑</button>
      </div>`;

    card.querySelector('.ga-add').addEventListener('click', () => openGoalAmt(g, 'add'));
    card.querySelector('.ga-sub').addEventListener('click', () => openGoalAmt(g, 'sub'));
    card.querySelector('.ga-edit').addEventListener('click', () => openGoalModal(g.id));
    card.querySelector('.ga-del').addEventListener('click', () => {
      if (!confirm(`¿Eliminar la meta «${g.name}»? (los abonos registrados como movimientos no se tocan)`)) return;
      state.goals = state.goals.filter(x => x.id !== g.id);
      save();
      renderGoals();
      toast('Meta eliminada');
    });
    grid.appendChild(card);
  });
}

function openGoalAmt(g, mode) {
  amtGoalId = g.id;
  amtMode = mode;
  $('#goal-amt-title').textContent = (mode === 'add' ? 'Abonar a «' : 'Retirar de «') + g.name + '»';
  $('#goal-amt-submit').textContent = mode === 'add' ? 'Abonar' : 'Retirar';
  $('#goal-amt-info').textContent = mode === 'add'
    ? `Ahorrado: ${fmt(g.saved)} de ${fmt(g.target)} (faltan ${fmt(Math.max(0, g.target - g.saved))}).`
    : `Disponible para retirar: ${fmt(g.saved)}.`;
  $('#goal-amt').value = '';
  $('#goal-amt').classList.remove('invalid');
  modalGoalAmt.showModal();
  setTimeout(() => $('#goal-amt').focus(), 60);
}

$('#form-goal-amt').addEventListener('submit', (e) => {
  e.preventDefault();
  const g = state.goals.find(x => x.id === amtGoalId);
  if (!g) { modalGoalAmt.close(); return; }
  const amount = parseFloat($('#goal-amt').value);
  if (!amount || amount <= 0 || !isFinite(amount)) return flagInvalid($('#goal-amt'), 'Ingresa un monto válido');

  if (amtMode === 'add') {
    const wasDone = g.saved >= g.target;
    g.saved = Math.min(g.target, Math.round((g.saved + amount) * 100) / 100);
    if (!wasDone && g.saved >= g.target) toast(`¡Meta «${g.name}» cumplida!`);
    else toast(`Abonado ${fmt(amount)} a «${g.name}»`);
  } else {
    if (amount > g.saved) return flagInvalid($('#goal-amt'), `Solo hay ${fmt(g.saved)} ahorrados`);
    g.saved = Math.round((g.saved - amount) * 100) / 100;
    toast(`Retirado ${fmt(amount)} de «${g.name}»`);
  }
  save();
  renderGoals();
  modalGoalAmt.close();
});

/* =========================================================
   PARTE 7 — Múltiples cuentas y transferencias
   ========================================================= */

/* Strip de cuentas con saldo en vivo + acceso a gestor y transferencias */
function renderAccounts() {
  const row = $('#acc-row');
  if (!row) return;
  row.innerHTML = '';

  const mkCard = ({ id, icon, color, name, bal, action }) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'acc-card' + (action ? ' acc-btn' : '') + (filters.account === id ? ' active' : '');
    if (action) {
      b.innerHTML = `<span>${icon}</span> ${name}`;
    } else {
      b.innerHTML = `
        <span class="acc-top"><span class="ai" style="background:${hexToRgba(color, .18)}">${icon}</span><span>${escapeHtml(name)}</span></span>
        <span class="acc-bal ${bal < 0 ? 'neg' : ''}">${fmt(bal)}</span>`;
    }
    return b;
  };

  // Tarjeta global "Todas" (sin Oculto)
  const allCard = mkCard({ id: 'all', icon: '🧮', color: '#5d6d75', name: 'Todas las cuentas', bal: normalTotal() });
  allCard.addEventListener('click', () => {
    filters.account = 'all';
    renderAccounts();
    refreshFilteredViews();
  });
  row.appendChild(allCard);

  // Una tarjeta por cuenta normal (tocar = filtrar el libro)
  normalAccounts().forEach(a => {
    const card = mkCard({ id: a.id, icon: a.icon, color: a.color, name: a.name, bal: accountBalance(a.id) });
    card.title = `Filtrar por «${a.name}»`;
    card.addEventListener('click', () => {
      filters.account = (filters.account === a.id) ? 'all' : a.id;
      renderAccounts();
      refreshFilteredViews();
    });
    row.appendChild(card);
  });

  // La bóveda Oculto no tiene tarjeta en la pantalla principal:
  // solo es accesible desde Configuración → Dinero Oculto → Detalles (con PIN).

  // Acciones
  const addBtn = mkCard({ id: null, icon: '＋', name: 'Nueva cuenta', action: true });
  addBtn.addEventListener('click', () => openAccModal());
  row.appendChild(addBtn);

  const trBtn = mkCard({ id: null, icon: '⇄', name: 'Transferir', action: true });
  trBtn.addEventListener('click', () => openTransferModal());
  row.appendChild(trBtn);
}

/* ---------- Gestor de cuentas ---------- */
const modalAcc = $('#modal-acc');
let editingAccId = null;

function resetAccForm() {
  editingAccId = null;
  $('#acc-submit').textContent = 'Añadir';
  $('#acc-cancel-edit').hidden = true;
  $('#acc-icon').value = '';
  $('#acc-name').value = '';
  $('#acc-color').value = '#274f8f';
}

function openAccModal() {
  resetAccForm();
  renderAccList();
  modalAcc.showModal();
}

$('#btn-manage-acc').addEventListener('click', () => { $('#modal-settings').close(); openAccModal(); });
$('#acc-cancel-edit').addEventListener('click', resetAccForm);

$('#form-acc').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('#acc-name').value.trim();
  if (!name) return flagInvalid($('#acc-name'), 'Escribe el nombre de la cuenta');
  const data = {
    name,
    icon: ($('#acc-icon').value.trim() || '🏦').slice(0, 2),
    color: $('#acc-color').value,
  };
  if (editingAccId) {
    const a = state.accounts.find(x => x.id === editingAccId);
    if (a) Object.assign(a, data);
    toast('Cuenta actualizada');
  } else {
    state.accounts.push({ id: uid(), createdAt: Date.now(), ...data });
    toast('Cuenta creada');
  }
  save();
  resetAccForm();
  renderAccList();
  renderAccounts();
});

function renderAccList() {
  const ul = $('#acc-list');
  ul.innerHTML = '';
  // La bóveda Oculto no se lista aquí; se gestiona desde Configuración → Detalles
  normalAccounts().forEach(a => {
    const nTx = state.transactions.filter(t =>
      t.type === 'transfer' ? (t.accountId === a.id || t.toAccountId === a.id) : t.accountId === a.id
    ).length;
    const bal = accountBalance(a.id);
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="ci" style="background:${hexToRgba(a.color, .18)}">${a.icon}</span>
      <span style="min-width:0">
        ${escapeHtml(a.name)}
        <div class="tfreq">${nTx} movimiento${nTx === 1 ? '' : 's'}</div>
      </span>
      <span class="ab ${bal < 0 ? 'neg' : ''}">${fmt(bal)}</span>
      <button type="button" class="ce" title="Editar">✏️</button>
      <button type="button" class="cd" title="Eliminar">🗑</button>`;
    li.querySelector('.ce').addEventListener('click', () => {
      editingAccId = a.id;
      $('#acc-icon').value = a.icon;
      $('#acc-name').value = a.name;
      $('#acc-color').value = a.color;
      $('#acc-submit').textContent = 'Actualizar';
      $('#acc-cancel-edit').hidden = false;
      $('#acc-name').focus();
    });
    li.querySelector('.cd').addEventListener('click', () => deleteAccount(a.id));
    ul.appendChild(li);
  });
}

function deleteAccount(id) {
  const acc = accById(id);
  if (acc.hidden) return toast('La cuenta Oculto está protegida');
  if (normalAccounts().length <= 1) return toast('Debe existir al menos una cuenta normal');
  const fallback = normalAccounts().find(a => a.id !== id).id;
  const n = state.transactions.filter(t =>
    t.type === 'transfer' ? (t.accountId === id || t.toAccountId === id) : t.accountId === id
  ).length;
  const msg = n > 0
    ? `«${acc.name}» tiene ${n} movimiento(s) que pasarán a otra cuenta. ¿Eliminarla?`
    : `¿Eliminar la cuenta «${acc.name}»?`;
  if (!confirm(msg)) return;
  state.transactions.forEach(t => {
    if (t.accountId === id) t.accountId = fallback;
    if (t.toAccountId === id) t.toAccountId = fallback;
  });
  state.templates.forEach(t => { if (t.accountId === id) t.accountId = fallback; });
  state.accounts = state.accounts.filter(a => a.id !== id);
  if (filters.account === id) filters.account = 'all';
  normalizeState(state); // evita transferencias a sí misma tras la reasignación
  save();
  if (editingAccId === id) resetAccForm();
  renderAccList();
  renderAll();
  toast('Cuenta eliminada');
}

/* ---------- Transferencias ---------- */
const modalTransfer = $('#modal-transfer');
let editingTrId = null;

function openTransferModal(tr = null, presetFrom = null, presetTo = null) {
  if (state.accounts.length < 2) return toast('Necesitas al menos dos cuentas para transferir');
  editingTrId = tr ? tr.id : null;
  $('#tr-title').textContent = tr ? 'Editar transferencia' : 'Nueva transferencia';
  $('#tr-delete').hidden = !tr;
  const opts = state.accounts.map(a => `<option value="${a.id}">${a.icon} ${escapeHtml(a.name)}</option>`).join('');
  $('#tr-from').innerHTML = opts;
  $('#tr-to').innerHTML = opts;
  if (tr) {
    $('#tr-from').value = tr.accountId;
    $('#tr-to').value = tr.toAccountId;
    $('#tr-amount').value = tr.amount;
    $('#tr-date').value = tr.date;
    $('#tr-desc').value = tr.description === 'Transferencia' ? '' : tr.description;
  } else {
    if (presetFrom && state.accounts.some(a => a.id === presetFrom)) $('#tr-from').value = presetFrom;
    if (presetTo && state.accounts.some(a => a.id === presetTo)) $('#tr-to').value = presetTo;
    else $('#tr-to').selectedIndex = state.accounts.length > 1 ? 1 : 0;
    $('#tr-amount').value = '';
    $('#tr-date').value = todayISO();
    $('#tr-desc').value = '';
  }
  $$('#form-transfer .invalid').forEach(el => el.classList.remove('invalid'));
  modalTransfer.showModal();
  setTimeout(() => $('#tr-amount').focus(), 60);
}

$('#form-transfer').addEventListener('submit', (e) => {
  e.preventDefault();
  const from = $('#tr-from').value;
  const to = $('#tr-to').value;
  const amount = parseFloat($('#tr-amount').value);
  const date = $('#tr-date').value;
  if (from === to) return flagInvalid($('#tr-to'), 'Elige dos cuentas diferentes');
  if (!amount || amount <= 0 || !isFinite(amount)) return flagInvalid($('#tr-amount'), 'Ingresa un monto válido');
  if (!date) return flagInvalid($('#tr-date'), 'Selecciona una fecha');

  const data = {
    type: 'transfer',
    amount: Math.round(amount * 100) / 100,
    accountId: from,
    toAccountId: to,
    categoryId: null,
    date,
    description: $('#tr-desc').value.trim() || 'Transferencia',
  };
  if (editingTrId) {
    const idx = state.transactions.findIndex(t => t.id === editingTrId);
    if (idx >= 0) state.transactions[idx] = { ...state.transactions[idx], ...data };
    toast('Transferencia actualizada');
  } else {
    state.transactions.push({ id: uid(), createdAt: Date.now(), ...data });
    toast('Transferencia registrada ⇄');
  }
  save();
  renderAll();
  modalTransfer.close();
});

$('#tr-delete').addEventListener('click', () => {
  if (!editingTrId) return;
  if (!confirm('¿Eliminar esta transferencia?')) return;
  state.transactions = state.transactions.filter(t => t.id !== editingTrId);
  save();
  renderAll();
  modalTransfer.close();
  toast('Transferencia eliminada');
});

/* =========================================================
   DINERO OCULTO — vista protegida con PIN (a pedido del usuario)
   ========================================================= */

/* Movimientos que entran o salen de la bóveda (solo visibles aquí) */
function hiddenMovements() {
  const hid = new Set(hiddenAccounts().map(a => a.id));
  return state.transactions
    .filter(t => t.type === 'transfer' && (hid.has(t.accountId) || hid.has(t.toAccountId)))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

function shortDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

function openHiddenDetails() {
  renderHidden();
  $('#modal-hidden').showModal();
}

function renderHidden() {
  const box = $('#modal-hidden');
  if (!box) return;
  const hv = hiddenAccounts()[0];
  if (!hv) return;

  $('#hid-balance').textContent = fmt(accountBalance(hv.id));
  $('#hid-balance').style.color = accountBalance(hv.id) < 0 ? 'var(--out)' : '';

  const list = hiddenMovements();
  $('#hid-count').textContent = `${list.length} movimiento${list.length === 1 ? '' : 's'}`;

  const wrap = $('#hid-list');
  wrap.innerHTML = '';
  if (!list.length) {
    wrap.innerHTML = '<p class="cal-none">Sin movimientos. Usa «Apartar dinero» para mover saldo aquí.</p>';
    return;
  }
  list.forEach(t => {
    const entering = t.toAccountId === hv.id;
    const other = accById(entering ? t.accountId : t.toAccountId);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tx-item';
    b.setAttribute('aria-label', `Editar ${entering ? 'apartado' : 'retiro'}`);
    b.innerHTML = `
      <span class="tx-ico hid-ico">${entering ? '↓' : '↑'}</span>
      <span style="min-width:0">
        <span class="tx-desc">${escapeHtml(t.description)}</span><br>
        <span class="tx-cat">${entering ? 'Apartado desde' : 'Retirado hacia'} ${escapeHtml(other.name)} · ${shortDate(t.date)}</span>
      </span>
      <span class="tx-amt ${entering ? 'in' : 'out'}">${entering ? '+' : '−'}${fmt(t.amount)}</span>`;
    b.addEventListener('click', () => openTransferModal(t)); // edición/borrado del movimiento oculto
    wrap.appendChild(b);
  });
}

/* Botón "Detalles" en Configuración: exige PIN */
$('#btn-hidden-details').addEventListener('click', () => {
  $('#modal-settings').close();
  if (!state.settings.lock) {
    toast('Para proteger el dinero Oculto, primero activa el bloqueo con PIN');
    openPinModal('enable');
    return;
  }
  $('#gate-pin').value = '';
  $('#gate-error').hidden = true;
  $('#modal-gate').showModal();
  setTimeout(() => $('#gate-pin').focus(), 60);
});

$('#form-gate').addEventListener('submit', async (e) => {
  e.preventDefault();
  const lock = state.settings.lock;
  if (!lock) { $('#modal-gate').close(); openHiddenDetails(); return; }
  const pin = $('#gate-pin').value.trim();
  if (!pin) return;
  try {
    const h = await hashPin(lock.salt, pin);
    if (h === lock.hash) {
      $('#modal-gate').close();
      openHiddenDetails();
    } else {
      $('#gate-error').hidden = false;
      $('#gate-pin').value = '';
      $('#gate-pin').focus();
    }
  } catch (err) {
    console.error(err);
    $('#gate-error').hidden = false;
  }
});

/* Acciones dentro de la vista Oculto */
$('#hid-apartar').addEventListener('click', () => {
  const hv = hiddenAccounts()[0];
  if (!hv) return;
  openTransferModal(null, (normalAccounts()[0] || {}).id, hv.id); // la vista Oculto queda detrás y se actualiza al guardar
});

$('#hid-retirar').addEventListener('click', () => {
  const hv = hiddenAccounts()[0];
  if (!hv) return;
  openTransferModal(null, hv.id, (normalAccounts()[0] || {}).id);
});

/* =========================================================
   PARTE 3 — Presupuestos por categoría
   ========================================================= */
function renderCatBudgets() {
  const wrap = $('#budgets-list');
  const empty = $('#budgets-empty');
  if (!wrap) return;
  const monthKey = filters.month === 'all' ? currentMonth() : filters.month;
  $('#budgets-month').textContent = '· ' + monthLabel(monthKey);

  const txs = monthTx(monthKey).filter(t => t.type === 'expense');
  const rows = state.categories
    .filter(c => c.type !== 'income' && Number(c.budget) > 0)
    .map(c => {
      const spent = txs.filter(t => t.categoryId === c.id).reduce((s, t) => s + t.amount, 0);
      return { c, spent, pct: (spent / c.budget) * 100 };
    })
    .sort((a, b) => b.pct - a.pct);

  wrap.innerHTML = '';
  empty.hidden = rows.length > 0;

  rows.forEach(({ c, spent, pct }) => {
    const left = c.budget - spent;
    const status = pct >= 100 ? 'over' : pct >= 75 ? 'warn' : '';
    const row = document.createElement('div');
    row.className = 'cb-row';
    row.innerHTML = `
      <span class="tx-ico cb-ico" style="background:${hexToRgba(c.color, .16)}">${c.icon}</span>
      <div class="cb-mid">
        <div class="cb-top">
          <span class="cb-name">${escapeHtml(c.name)}</span>
          <span class="cb-nums">${fmt(spent)} / ${fmt(c.budget)}</span>
        </div>
        <div class="progress"><div class="progress-fill ${status}" style="width:${Math.min(100, pct)}%"></div></div>
        <div class="cb-status ${status}">${pct >= 100
          ? 'Excedido en ' + fmt(Math.abs(left))
          : 'Disponible ' + fmt(left) + ' · ' + Math.round(pct) + '% usado'}</div>
      </div>`;
    wrap.appendChild(row);
  });
}

/* =========================================================
   PARTE 8 — Movimientos frecuentes (registro rápido + recurrencia)
   ========================================================= */
const FREQ_LABELS = { none: 'Acceso rápido', weekly: 'Auto · semanal', biweekly: 'Auto · quincenal', monthly: 'Auto · mensual' };

const modalTpl = $('#modal-tpl');
let editingTplId = null;

function fillTplCategories(type, selectedId) {
  const sel = $('#tpl-category');
  const cats = state.categories.filter(c => c.type === type || c.type === 'both');
  sel.innerHTML = cats.map(c => `<option value="${c.id}">${c.icon} ${escapeHtml(c.name)}</option>`).join('');
  if (selectedId && cats.some(c => c.id === selectedId)) sel.value = selectedId;
}

function fillTplAccounts(selectedId) {
  const sel = $('#tpl-account');
  sel.innerHTML = normalAccounts().map(a => `<option value="${a.id}">${a.icon} ${escapeHtml(a.name)}</option>`).join('');
  if (selectedId && normalAccounts().some(a => a.id === selectedId)) sel.value = selectedId;
}

function resetTplForm() {
  editingTplId = null;
  $('#tpl-submit').textContent = 'Añadir';
  $('#tpl-cancel-edit').hidden = true;
  $('#tpl-type').value = 'expense';
  $('#tpl-amount').value = '';
  $('#tpl-desc').value = '';
  $('#tpl-freq').value = 'none';
  fillTplCategories('expense');
  fillTplAccounts();
}

function openTplModal() {
  resetTplForm();
  renderTplList();
  modalTpl.showModal();
}

$('#quick-manage').addEventListener('click', openTplModal);
$('#quick-create').addEventListener('click', openTplModal);
$('#btn-manage-tpl').addEventListener('click', () => { $('#modal-settings').close(); openTplModal(); });
$('#tpl-type').addEventListener('change', () => fillTplCategories($('#tpl-type').value, $('#tpl-category').value));
$('#tpl-cancel-edit').addEventListener('click', resetTplForm);

$('#form-tpl').addEventListener('submit', (e) => {
  e.preventDefault();
  const amount = parseFloat($('#tpl-amount').value);
  const desc = $('#tpl-desc').value.trim();
  if (!amount || amount <= 0 || !isFinite(amount)) return flagInvalid($('#tpl-amount'), 'Ingresa un monto válido');
  if (!desc) return flagInvalid($('#tpl-desc'), 'La descripción es obligatoria');

  const data = {
    type: $('#tpl-type').value === 'income' ? 'income' : 'expense',
    amount: Math.round(amount * 100) / 100,
    categoryId: $('#tpl-category').value,
    accountId: $('#tpl-account').value,
    description: desc,
    freq: $('#tpl-freq').value,
  };
  if (editingTplId) {
    const t = state.templates.find(t => t.id === editingTplId);
    if (t) Object.assign(t, data);
    toast('Frecuente actualizado');
  } else {
    state.templates.push({ id: uid(), createdAt: Date.now(), lastPosted: null, ...data });
    toast('Frecuente creado');
  }
  save();
  resetTplForm();
  renderTplList();
  renderQuick();
});

function renderTplList() {
  const ul = $('#tpl-list');
  ul.innerHTML = '';
  if (!state.templates.length) {
    ul.innerHTML = '<li style="justify-content:center;color:var(--muted)">Sin movimientos frecuentes. Crea uno arriba.</li>';
    return;
  }
  state.templates.forEach(t => {
    const cat = catById(t.categoryId);
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="ci" style="background:${hexToRgba(cat.color, .18)}">${cat.icon}</span>
      <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(t.description)}</span>
      <span class="tf">
        <span class="ta ${t.type === 'income' ? 'in' : 'out'}">${t.type === 'income' ? '+' : '−'}${fmt(t.amount)}</span>
        <span class="tfreq">${FREQ_LABELS[t.freq] || FREQ_LABELS.none}</span>
      </span>
      <button type="button" class="ce" title="Editar">✏️</button>
      <button type="button" class="cd" title="Eliminar">🗑</button>`;
    li.querySelector('.ce').addEventListener('click', () => {
      editingTplId = t.id;
      $('#tpl-type').value = t.type;
      fillTplCategories(t.type, t.categoryId);
      fillTplAccounts(t.accountId);
      $('#tpl-amount').value = t.amount;
      $('#tpl-desc').value = t.description;
      $('#tpl-freq').value = t.freq || 'none';
      $('#tpl-submit').textContent = 'Actualizar';
      $('#tpl-cancel-edit').hidden = false;
      $('#tpl-amount').focus();
    });
    li.querySelector('.cd').addEventListener('click', () => {
      if (!confirm(`¿Eliminar «${t.description}» de frecuentes?`)) return;
      state.templates = state.templates.filter(x => x.id !== t.id);
      if (editingTplId === t.id) resetTplForm();
      save();
      renderTplList();
      renderQuick();
      toast('Frecuente eliminado');
    });
    ul.appendChild(li);
  });
}

/* Chips de registro rápido: un toque = movimiento de hoy */
function renderQuick() {
  const list = $('#quick-list');
  const hint = $('#quick-hint');
  if (!list) return;
  list.innerHTML = '';
  hint.hidden = state.templates.length > 0;
  state.templates.forEach(t => {
    const cat = catById(t.categoryId);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip ' + (t.type === 'income' ? 'chip-in' : 'chip-out');
    b.title = `Registrar hoy · ${cat.name}` + (t.freq && t.freq !== 'none' ? ` · ${FREQ_LABELS[t.freq]}` : '');
    b.innerHTML = `
      <span class="chip-ico">${cat.icon}</span>
      <span class="chip-desc">${escapeHtml(t.description)}</span>
      <span class="chip-amt">${t.type === 'income' ? '+' : '−'}${fmt(t.amount)}</span>
      ${t.freq && t.freq !== 'none' ? '<span class="chip-freq">↻</span>' : ''}`;
    b.addEventListener('click', () => {
      state.transactions.push({
        id: uid(), createdAt: Date.now(),
        type: t.type, amount: t.amount, categoryId: t.categoryId, accountId: t.accountId,
        date: todayISO(), description: t.description,
      });
      save();
      renderAll();
      toast(`${t.type === 'income' ? 'Ingreso' : 'Gasto'} registrado: ${t.description} ${fmt(t.amount)}`);
    });
    list.appendChild(b);
  });
}

/* Recurrencia automática: se ejecuta al abrir la app */
function isDue(freq, last, today) {
  if (!last) return true;
  if (freq === 'monthly') return last.slice(0, 7) !== today.slice(0, 7);
  const days = Math.floor((new Date(today + 'T00:00:00') - new Date(last + 'T00:00:00')) / 86400000);
  if (freq === 'weekly') return days >= 7;
  if (freq === 'biweekly') return days >= 15;
  return false;
}

function runRecurring() {
  const today = todayISO();
  let posted = 0;
  state.templates.forEach(t => {
    if (!t.freq || t.freq === 'none') return;
    if (isDue(t.freq, t.lastPosted, today)) {
      state.transactions.push({
        id: uid(), createdAt: Date.now(),
        type: t.type, amount: t.amount, categoryId: t.categoryId, accountId: t.accountId,
        date: today, description: t.description + ' (auto)',
      });
      t.lastPosted = today;
      posted++;
    }
  });
  if (posted > 0) {
    save();
    setTimeout(() => toast(`${posted} movimiento(s) frecuente(s) registrado(s) automáticamente`), 900);
  }
}

/* ---------- Exportar / Importar ---------- */
function download(filename, text, mime = 'application/json') {
  const blob = new Blob([text], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

$('#btn-export-json').addEventListener('click', () => {
  download(`mis-cuentas-respaldo-${todayISO()}.json`, JSON.stringify(state, null, 2));
  toast('Respaldo JSON descargado');
});

$('#btn-export-csv').addEventListener('click', () => {
  const list = filteredTx();
  if (!list.length) return toast('No hay movimientos para exportar');
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const typeLabel = (t) => t.type === 'income' ? 'ingreso' : t.type === 'expense' ? 'gasto' : 'transferencia';
  const rows = [
    ['fecha', 'tipo', 'categoria', 'cuenta', 'cuenta_destino', 'descripcion', 'monto'].join(','),
    ...list.map(t => [
      t.date,
      typeLabel(t),
      t.type === 'transfer' ? '' : esc(catById(t.categoryId).name),
      esc(accById(t.accountId).name),
      t.type === 'transfer' ? esc(accById(t.toAccountId).name) : '',
      esc(t.description),
      (t.type === 'expense' ? '-' : '') + t.amount.toFixed(2),
    ].join(',')),
  ];
  download(`mis-cuentas-${todayISO()}.csv`, '﻿' + rows.join('\n'), 'text/csv');
  toast('CSV exportado');
});

$('#btn-import').addEventListener('click', () => $('#file-import').click());

$('#file-import').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.transactions) || !Array.isArray(data.categories)) {
        throw new Error('formato inválido');
      }
      if (!confirm(`Se importarán ${data.transactions.length} movimientos y ${data.categories.length} categorías, reemplazando los datos actuales. ¿Continuar?`)) return;
      const base = freshState();
      state = normalizeState({
        transactions: data.transactions.filter(t => t && t.id && t.amount > 0 && t.date),
        categories: data.categories.filter(c => c && c.id && c.name),
        accounts: Array.isArray(data.accounts) ? data.accounts.filter(a => a && a.id && a.name) : freshState().accounts,
        templates: Array.isArray(data.templates) ? data.templates.filter(t => t && t.id && t.amount > 0) : [],
        goals: Array.isArray(data.goals) ? data.goals.filter(g => g && g.id && g.target > 0) : [],
        settings: { ...base.settings, ...(data.settings || {}) },
      });
      save();
      applyTheme();
      renderAll();
      toast('Datos importados correctamente');
    } catch {
      toast('Archivo no válido');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
});

/* ---------- Tema ---------- */
function applyTheme() {
  document.documentElement.dataset.theme = state.settings.theme || 'light';
}

$('#btn-theme').addEventListener('click', () => {
  state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
  save();
  applyTheme();
  renderFlow();
  renderDonut();
  renderMonths();
});

/* ---------- Filtros: eventos ---------- */
$('#f-search').addEventListener('input', (e) => { filters.q = e.target.value; renderSummary(); renderDonut(); renderList(); });
$('#f-type').addEventListener('change', (e) => { filters.type = e.target.value; renderSummary(); renderDonut(); renderList(); });
$('#f-category').addEventListener('change', (e) => { filters.category = e.target.value; renderSummary(); renderDonut(); renderList(); });
$('#f-month').addEventListener('change', (e) => {
  filters.month = e.target.value || 'all';
  calMonth = filters.month === 'all' ? currentMonth() : filters.month;
  calSelectedDay = null;
  renderSummary(); renderFlow(); renderCatBudgets(); renderDonut(); renderList();
  if (view === 'calendar') { renderCalendar(); renderCalDetail(); }
});
/* ---------- Filtros avanzados ---------- */
function updateAdvUI() {
  const from = $('#f-from').value, to = $('#f-to').value;
  const active = [filters.from, filters.to, filters.min, filters.max].filter(v => v !== '').length;
  const badge = $('#f-adv-badge');
  badge.hidden = active === 0;
  badge.textContent = active;
  const rangeOn = !!(from || to);
  $('#f-month').disabled = rangeOn;
  $('#adv-month-note').hidden = !rangeOn;
}

function refreshFilteredViews() {
  renderSummary(); renderCatBudgets(); renderDonut(); renderList();
}

function bindAdv(id, key, numeric = false) {
  $(id).addEventListener('input', (e) => {
    if (!numeric) {
      filters[key] = e.target.value || '';
    } else {
      const v = e.target.value;
      const n = parseFloat(v);
      filters[key] = (v === '' || !isFinite(n) || n < 0) ? '' : n;
    }
    updateAdvUI();
    refreshFilteredViews();
  });
}

bindAdv('#f-from', 'from');
bindAdv('#f-to', 'to');
bindAdv('#f-min', 'min', true);
bindAdv('#f-max', 'max', true);

$('#f-adv-toggle').addEventListener('click', () => {
  const panel = $('#f-adv');
  const open = panel.hidden;
  panel.hidden = !open;
  $('#f-adv-arrow').textContent = open ? '▴' : '▾';
  $('#f-adv-toggle').setAttribute('aria-expanded', String(open));
});

function resetAdvFilters() {
  filters.from = ''; filters.to = ''; filters.min = ''; filters.max = '';
  $('#f-from').value = ''; $('#f-to').value = ''; $('#f-min').value = ''; $('#f-max').value = '';
  updateAdvUI();
}

$('#f-clear').addEventListener('click', () => {
  filters.q = ''; filters.type = 'all'; filters.category = 'all'; filters.account = 'all'; filters.month = currentMonth();
  $('#f-search').value = ''; $('#f-type').value = 'all'; $('#f-category').value = 'all'; $('#f-month').value = currentMonth();
  resetAdvFilters();
  renderAccounts();
  renderSummary(); renderFlow(); renderCatBudgets(); renderDonut(); renderList();
  toast('Filtros restablecidos');
});

/* ---------- Cerrar modales ---------- */
$$('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
$$('dialog').forEach(d => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));

/* ---------- Datos de ejemplo ---------- */
function loadDemo() {
  if (state.transactions.length && !confirm('Esto agregará movimientos de ejemplo a tus datos actuales. ¿Continuar?')) return;
  const mainAcc = (normalAccounts()[0] || state.accounts[0]).id;
  const mk = (daysAgo, type, amount, cat, desc) => {
    const d = new Date(); d.setDate(d.getDate() - daysAgo);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { id: uid(), type, amount, categoryId: cat, accountId: mainAcc, date: iso, description: desc, createdAt: Date.now() - daysAgo * 1000 };
  };
  state.transactions.push(
    mk(28, 'income', 15000, 'c-salario', 'Nómina quincenal'),
    mk(13, 'income', 15000, 'c-salario', 'Nómina quincenal'),
    mk(6, 'income', 1850, 'c-ventas', 'Venta de artículos en línea'),
    mk(26, 'expense', 1450.5, 'c-comida', 'Supermercado de la quincena'),
    mk(22, 'expense', 89, 'c-transporte', 'Recarga tarjeta de transporte'),
    mk(20, 'expense', 420, 'c-servicios', 'Recibo de luz'),
    mk(18, 'expense', 315, 'c-servicios', 'Internet del hogar'),
    mk(15, 'expense', 260, 'c-ocio', 'Cine con amigos'),
    mk(9, 'expense', 530, 'c-salud', 'Farmacia'),
    mk(5, 'expense', 780.9, 'c-comida', 'Despensa semanal'),
    mk(3, 'expense', 199, 'c-ocio', 'Suscripción de streaming'),
    mk(1, 'expense', 350, 'c-ropa', 'Playera nueva'),
  );
  if (!state.settings.budget) state.settings.budget = 8000;
  save();
  renderAll();
  toast('Datos de ejemplo cargados ✨');
}

$('#btn-demo').addEventListener('click', loadDemo);
$('#btn-demo-2').addEventListener('click', () => { loadDemo(); });

/* ---------- PWA ---------- */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

/* ---------- Inicio ---------- */
(function init() {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches && !storage.get(LS_KEY)) {
    state.settings.theme = 'dark';
    save();
  }
  applyTheme();
  $('#f-month').value = currentMonth();
  renderLockSection();
  runRecurring();
  renderAll();
  if (state.settings.lock) showLock();
  if (!storage.ok) {
    setTimeout(() => toast('Este visor no permite guardar datos; se perderán al cerrar'), 600);
  }
})();
