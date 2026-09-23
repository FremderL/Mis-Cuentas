/* =========================================================
   Mis Cuentas — Libro de gastos e ingresos
   App 100% local (localStorage). Sin dependencias externas.
   ========================================================= */
'use strict';

/* ---------- Claves y datos por defecto ---------- */
const LS_KEY = 'misCuentas.v1';
/* Versión de la app: se muestra en Configuración → Acerca de.
   Formato: MAYOR.MENOR.PARCHE.REVISIÓN (ej. 1.2.0.0) */
const APP_VERSION = '1.14.0.2';

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
    debts: [],        // 1.7.0.0 · {id,person,direction('owes-me'|'owe'),amount,paid,date,note,accountId,settled,createdAt}
    savedFilters: [], // 1.13.0.0 · {id,name,f:{q,type,category,account,month,from,to,min,max,tag},createdAt}
    settings: {
      currency: 'MXN', budget: 0, theme: 'light', lock: null, hiddenMasked: true,
      // 1.2.0.0 · notificaciones locales
      notify: { daily: false, time: '21:00', budget: true, rec: true, lastDaily: '' },
      rates: {}, // 1.5.0.0 · tasas manuales { USD: 18.5, ... } (1 unidad → moneda base)
      budgetAlert: { month: '', level: 0 },
      // 1.8.0.0 · biometría y personalización
      bio: null,        // {credId: base64url, createdAt} — credencial WebAuthn de este dispositivo
      accent: null,     // hex o null = color predeterminado del tema
      accOrder: [],     // ids de cuentas en el orden elegido por la persona (arrastrar/soltar)
      weekly: { enabled: true, lastKey: '' }, // 1.11.0.0 · repaso semanal de los lunes
      backup: { lastOK: 0, lastError: '' },   // 1.12.0.0 · respaldo automático (la carpeta vive en IndexedDB)
    },
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
  // 1.7.0.0: deudas cuya cuenta ligada ya no existe quedan informativas
  (s.debts || []).forEach(d => { if (d.accountId && (!ids.has(d.accountId) || hiddenIds.has(d.accountId))) d.accountId = null; });
  return s;
}

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
  tag: 'all', // 1.6.0.0 · etiqueta | 'all'
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

const LS_BACKUP = LS_KEY + '.backup';

function parseSaved(raw) {
  if (!raw) return null;
  const data = JSON.parse(raw); // lanza si está corrupto
  const base = freshState();
  return normalizeState({
    transactions: Array.isArray(data.transactions) ? data.transactions : [],
    categories: Array.isArray(data.categories) && data.categories.length ? data.categories : base.categories,
    accounts: Array.isArray(data.accounts) && data.accounts.length ? data.accounts : base.accounts,
    templates: Array.isArray(data.templates) ? data.templates : [],
    goals: Array.isArray(data.goals) ? data.goals : [],
    debts: Array.isArray(data.debts) ? data.debts : [],
    savedFilters: Array.isArray(data.savedFilters) ? data.savedFilters : [],
    settings: { ...base.settings, ...(data.settings || {}) },
  });
}

function load() {
  // 1) Copia principal
  try {
    const st = parseSaved(storage.get(LS_KEY));
    if (st) return st;
  } catch (err) {
    console.error('Datos principales ilegibles:', err);
  }
  // 2) Respaldo automático (último guardado correcto)
  try {
    const st = parseSaved(storage.get(LS_BACKUP));
    if (st) {
      storage.set(LS_KEY, storage.get(LS_BACKUP)); // restaura la principal
      setTimeout(() => toast('Se recuperó un respaldo automático de tus datos'), 900);
      return st;
    }
  } catch (err) {
    console.error('Respaldo ilegible:', err);
  }
  return freshState();
}

function save() {
  try {
    const payload = JSON.stringify(state);
    storage.set(LS_KEY, payload);
    storage.set(LS_BACKUP, payload); // respaldo del último guardado correcto
    return true;
  } catch (err) {
    console.error('No se pudo guardar:', err);
    toast('No se pudo guardar en este navegador');
    return false;
  }
}

/* Estado cargado DESPUÉS de definir storage/save:
   si se carga antes, `storage` aún no existe y load() caería
   silenciosamente a un estado vacío en cada recarga. */
let state = load();

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

/* =========================================================
   MULTI-MONEDA (1.5.0.0)
   - Moneda base = settings.currency.
   - Cada cuenta puede tener su moneda (acc.currency).
   - Cada movimiento guarda su moneda nativa (t.currency) y la
     tasa a moneda base vigente al registrarlo (t.rate) →
     historial de tasas por movimiento.
   - Flujos, gráficas y presupuestos: en moneda base con la
     tasa HISTÓRICA de cada movimiento.
   - Saldo de las tarjetas: en la moneda nativa de la cuenta;
     el total visible se consolida a moneda base con la tasa
     ACTUAL (settings.rates).
   ========================================================= */
const CURRENCIES = ['MXN', 'USD', 'EUR', 'COP', 'ARS', 'CLP', 'PEN'];

function baseCurrency() { return state.settings.currency || 'MXN'; }

function rateOf(currency) {
  if (!currency || currency === baseCurrency()) return 1;
  const r = state.settings.rates && Number(state.settings.rates[currency]);
  return r > 0 ? r : 1; // sin tasa definida: 1.0 (visible en Configuración)
}

/* Monto del movimiento convertido a moneda base (su tasa histórica) */
function txBase(t) {
  const r = Number(t.rate) > 0 ? Number(t.rate) : rateOf(t.currency);
  return t.amount * r;
}

function currenciesInUse() {
  const base = baseCurrency();
  const set = new Set();
  state.accounts.forEach(a => { if (a.currency && a.currency !== base) set.add(a.currency); });
  state.transactions.forEach(t => { if (t.currency && t.currency !== base) set.add(t.currency); });
  return [...set].sort();
}

function fmtCurrency(amount, currency) {
  const cur = currency || baseCurrency();
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: cur }).format(amount);
  } catch {
    return amount.toFixed(2) + ' ' + cur;
  }
}

/* Saldo de una cuenta en SU moneda nativa.
   Gastos/ingresos son siempre nativos (la moneda se fijó al registrarlos);
   las transferencias se valoran a base con su tasa histórica y a la moneda
   de esta cuenta con la tasa actual (así, el Dinero total refleja la tasa
   de hoy mientras los flujos conservan la de cada día). */
function accountBalance(accId) {
  const acc = accById(accId);
  const r = rateOf(acc.currency);
  let bal = 0;
  state.transactions.forEach(t => {
    if (t.type === 'transfer') {
      const vBase = txBase(t);
      if (t.accountId === accId) bal -= vBase / r;
      if (t.toAccountId === accId) bal += vBase / r;
    } else if (t.accountId === accId) {
      bal += t.type === 'income' ? t.amount : -t.amount;
    }
  });
  return Math.round(bal * 100) / 100;
}

/* Dinero "normal" (sin la bóveda Oculto), consolidado en moneda base */
function normalAccounts() { return state.accounts.filter(a => !a.hidden); }
function hiddenAccounts() { return state.accounts.filter(a => a.hidden); }
function accBalanceBase(acc) { return accountBalance(acc.id) * rateOf(acc.currency); }
function normalTotal() { return normalAccounts().reduce((s, a) => s + accBalanceBase(a), 0); }
function hiddenTotal() { return hiddenAccounts().reduce((s, a) => s + accBalanceBase(a), 0); }

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
      if (filters.min !== '' && txBase(t) < filters.min) return false;
      if (filters.max !== '' && txBase(t) > filters.max) return false;
      if (filters.tag !== 'all' && !(Array.isArray(t.tags) && t.tags.includes(filters.tag))) return false;
      if (q && !t.description.toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

function monthTx(month) {
  return state.transactions.filter(t => t.date.startsWith(month));
}

/* Suma en moneda base (aplica la tasa histórica de cada movimiento) */
function sum(list, type) {
  return list.filter(t => t.type === type).reduce((s, t) => s + txBase(t), 0);
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
  expenses.forEach(t => { byCat[t.categoryId] = (byCat[t.categoryId] || 0) + txBase(t); });
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

/* ---------- Render: resumen anual (1.3.0.0) ---------- */
let uiYear = new Date().getFullYear();
const MONTH_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/* Totales por mes del año (solo income/expense; transferencias no cuentan) */
function yearData(y) {
  const months = [];
  for (let m = 1; m <= 12; m++) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    const list = monthTx(key);
    months.push({ key, inc: sum(list, 'income'), out: sum(list, 'expense') });
  }
  const incT = months.reduce((s, m) => s + m.inc, 0);
  const outT = months.reduce((s, m) => s + m.out, 0);
  return {
    months, incT, outT, net: incT - outT,
    rate: incT > 0 ? ((incT - outT) / incT) * 100 : null,
  };
}

function renderYear() {
  const y = uiYear;
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1;

  $('#year-title').textContent = y;
  $('#year-next').disabled = y >= thisYear;
  $('#year-next').style.opacity = y >= thisYear ? 0.35 : 1;

  const d = yearData(y);
  const max = Math.max(1, ...d.months.map(m => Math.max(m.inc, m.out)));
  const bars = $('#year-bars');
  bars.innerHTML = '';
  d.months.forEach((m, i) => {
    const isCurrent = (y === thisYear && i + 1 === thisMonth);
    const future = y === thisYear && i + 1 > thisMonth;
    const empty = (m.inc === 0 && m.out === 0) || future;
    const col = document.createElement('div');
    col.className = 'bar-col' + (isCurrent ? ' current' : '');
    col.title = `${MONTH_SHORT[i]} ${y}: +${fmt(m.inc)} / −${fmt(m.out)}`;
    col.innerHTML = `
      <div class="bar-pair">
        <div class="bar in${empty ? ' bar-null' : ''}" style="height:${(m.inc / max) * 100}%"></div>
        <div class="bar out${empty ? ' bar-null' : ''}" style="height:${(m.out / max) * 100}%"></div>
      </div>
      <span>${MONTH_SHORT[i]}</span>`;
    bars.appendChild(col);
  });

  $('#year-empty').hidden = !(d.incT === 0 && d.outT === 0);

  // Coins totales del año (4 tarjetas: ingresos, gastos, ahorro neto, tasa)
  $('#year-stats').innerHTML = `
    <div class="year-chip">
      <span class="yc-label">Ingresos ${y}</span>
      <span class="yc-value" style="color:var(--in)">+${fmt(d.incT)}</span>
    </div>
    <div class="year-chip">
      <span class="yc-label">Gastos ${y}</span>
      <span class="yc-value" style="color:var(--out)">−${fmt(d.outT)}</span>
    </div>
    <div class="year-chip">
      <span class="yc-label">Ahorro neto</span>
      <span class="yc-value" style="color:${d.net >= 0 ? 'var(--in)' : 'var(--out)'}">${fmt(d.net)}</span>
      <span class="yc-sub">ingresos − gastos</span>
    </div>
    <div class="year-chip">
      <span class="yc-label">Tasa de ahorro</span>
      <span class="yc-value">${d.rate === null ? '—' : d.rate.toFixed(0) + ' %'}</span>
      <span class="yc-sub">% del ingreso que conservas</span>
    </div>`;

  // Comparativa interanual: el mes actual (o diciembre si es un año pasado)
  const refMonth = (y < thisYear) ? 12 : thisMonth;
  const refKey = `${y}-${String(refMonth).padStart(2, '0')}`;
  const prevKey = `${y - 1}-${String(refMonth).padStart(2, '0')}`;
  const curInc = sum(monthTx(refKey), 'income');
  const curOut = sum(monthTx(refKey), 'expense');
  const prevInc = sum(monthTx(prevKey), 'income');
  const prevOut = sum(monthTx(prevKey), 'expense');
  const cmp = $('#year-compare');
  if (prevInc === 0 && prevOut === 0) {
    cmp.textContent = `Sin datos de ${MONTH_SHORT[refMonth - 1]} ${y - 1} para comparar.`;
  } else {
    const delta = (cur, prev) => prev > 0 ? Math.round(((cur - prev) / prev) * 100) : (cur > 0 ? 100 : 0);
    const arrow = (pct) => pct === 0
      ? '<b>= 0 %</b>'
      : pct > 0
        ? `<span class="cmp-up">▲ ${pct} %</span>`
        : `<span class="cmp-down">▼ ${Math.abs(pct)} %</span>`;
    cmp.innerHTML =
      `<b>${MONTH_SHORT[refMonth - 1]} ${y}</b> vs ${MONTH_SHORT[refMonth - 1]} ${y - 1} · ` +
      `Ingresos <b>${fmt(curInc)}</b> ${arrow(delta(curInc, prevInc))} · ` +
      `Gastos <b>${fmt(curOut)}</b> ${arrow(delta(curOut, prevOut))}`;
  }
}

$('#year-prev').addEventListener('click', () => { uiYear--; renderYear(); });
$('#year-next').addEventListener('click', () => {
  if (uiYear < new Date().getFullYear()) { uiYear++; renderYear(); }
});

$('#btn-year-csv').addEventListener('click', () => {
  const y = uiYear;
  const d = yearData(y);
  if (d.incT === 0 && d.outT === 0) return toast(`Sin movimientos en ${y} para exportar`);
  const rows = [
    ['mes', 'ingresos', 'gastos', 'ahorro_neto', 'tasa_ahorro_pct'].join(','),
    ...d.months.map((m, i) => [
      `${MONTH_SHORT[i]} ${y}`,
      m.inc.toFixed(2),
      m.out.toFixed(2),
      (m.inc - m.out).toFixed(2),
      m.inc > 0 ? (((m.inc - m.out) / m.inc) * 100).toFixed(1) : '',
    ].join(',')),
    ['TOTAL ' + y, d.incT.toFixed(2), d.outT.toFixed(2), d.net.toFixed(2), d.rate === null ? '' : d.rate.toFixed(1)].join(','),
  ];
  download(`mis-cuentas-resumen-${y}.csv`, '﻿' + rows.join('\n'), 'text/csv');
  toast(`Resumen ${y} exportado en CSV`);
});

/* ---------- Render: filtros ---------- */
/* Etiquetas usadas actualmente (orden alfabético) */
function allTags() {
  const set = new Set();
  state.transactions.forEach(t => { if (Array.isArray(t.tags)) t.tags.forEach(tag => set.add(tag)); });
  return [...set].sort((a, b) => a.localeCompare(b));
}

function renderFilterOptions() {
  const selCat = $('#f-category');
  const current = selCat.value || 'all';
  selCat.innerHTML = '<option value="all">Todas las categorías</option>' +
    state.categories.map(c => `<option value="${c.id}">${c.icon} ${escapeHtml(c.name)}</option>`).join('');
  selCat.value = state.categories.some(c => c.id === current) ? current : 'all';
  filters.category = selCat.value;

  const selTag = $('#f-tag');
  if (selTag) {
    const curT = selTag.value || 'all';
    const tags = allTags();
    selTag.innerHTML = '<option value="all">Todas las etiquetas</option>' +
      tags.map(t => `<option value="${t}">#${escapeHtml(t)}</option>`).join('');
    selTag.value = tags.includes(curT) ? curT : 'all';
    filters.tag = selTag.value;
  }
}

/* Totales por etiqueta bajo los filtros actuales (se puden tocar para filtrar) */
function renderTagSummary() {
  const box = $('#tag-summary');
  if (!box) return;
  const tags = allTags();
  if (!tags.length) { box.hidden = true; box.innerHTML = ''; return; }
  // Calcular sobre los filtros actuales ignorando el propio filtro de etiqueta
  const prev = filters.tag;
  filters.tag = 'all';
  const list = filteredTx();
  filters.tag = prev;
  box.innerHTML = '';
  tags.forEach(tag => {
    const items = list.filter(t => Array.isArray(t.tags) && t.tags.includes(tag));
    if (!items.length) return;
    const net = sum(items, 'income') - sum(items, 'expense');
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'tag-chip' + (prev === tag ? ' on' : '');
    chip.title = `${items.length} movimiento(s) · ${prev === tag ? 'quitar filtro' : 'filtrar'} por #${tag}`;
    chip.innerHTML = `<span class="tc-name">#${escapeHtml(tag)}</span>
      <span class="tc-amt ${net >= 0 ? 'pos' : 'neg'}">${net >= 0 ? '+' : '−'}${fmt(Math.abs(net))}</span>`;
    chip.addEventListener('click', () => {
      filters.tag = filters.tag === tag ? 'all' : tag;
      $('#f-tag').value = filters.tag;
      refreshFilteredViews();
    });
    box.appendChild(chip);
  });
  box.hidden = box.children.length === 0;
}

/* ---------- Render: libro de cuentas ---------- */
function txItemEl(t) {
  const isTransfer = t.type === 'transfer';
  const cat = isTransfer ? null : catById(t.categoryId);
  const acc = accById(t.accountId);
  const baseNote2 = t.currency && t.currency !== baseCurrency()
    ? `<span class="tx-cur">≈ ${fmt(txBase(t))}</span>` : '';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tx-item';
  btn.setAttribute('aria-label', `Editar: ${t.description}`);

  if (isTransfer) {
    const to = accById(t.toAccountId);
    const baseNote = t.currency && t.currency !== baseCurrency()
      ? `<span class="tx-cur">≈ ${fmt(txBase(t))}</span>` : '';
    btn.innerHTML = `
      <span class="tx-ico" style="background:var(--surface-2);border:1px solid var(--border)">⇄</span>
      <span style="min-width:0">
        <span class="tx-desc">${escapeHtml(t.description)}</span><br>
        <span class="tx-cat">${escapeHtml(acc.name)} → ${escapeHtml(to.name)}</span>
      </span>
      <span class="tx-amt trn">${fmtCurrency(t.amount, t.currency)}${baseNote}</span>`;
    btn.addEventListener('click', () => openTransferModal(t));
    return btn;
  }

  btn.innerHTML = `
    <span class="tx-ico" style="background:${hexToRgba(cat.color, .16)}">${cat.icon}</span>
    <span style="min-width:0">
      <span class="tx-desc">${escapeHtml(t.description)}</span><br>
      <span class="tx-cat">${escapeHtml(cat.name)} · ${escapeHtml(acc.name)}</span>
      ${Array.isArray(t.tags) && t.tags.length ? `<span class="tx-tags">${t.tags.map(tag => `<span class="tx-tag">#${escapeHtml(tag)}</span>`).join('')}</span>` : ''}
    </span>
    <span class="tx-amt ${t.type === 'income' ? 'in' : 'out'}">
      ${t.type === 'income' ? '+' : '−'}${fmtCurrency(t.amount, t.currency)}${baseNote2}
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
  renderTagSummary();
}

/* Etiquetas: "hogar, trabajo" → ['hogar','trabajo'] */
function parseTags(str) {
  return [...new Set(String(str || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean))];
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
  renderDebts();
  renderWeekPanel(); // 1.11.0.0
  renderSavedSelect(); // 1.13.0.0
  renderMonths();
  renderYear();
  renderQuick();
  renderList();
  checkBudgetAlert();
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
  $('#tx-tags').value = tx && Array.isArray(tx.tags) ? tx.tags.join(', ') : '';
  $$('#form-tx .invalid').forEach(el => el.classList.remove('invalid'));

  modalTx.showModal();
  updateTxAmountNote();
  setTimeout(() => $('#tx-amount').focus(), 60);
}

/* Multi-moneda: aviso de conversión mientras se captura el monto */
function updateTxAmountNote() {
  const note = $('#tx-amount-note');
  if (!note) return;
  const cur = accById($('#tx-account').value).currency || baseCurrency();
  if (cur === baseCurrency()) { note.hidden = true; return; }
  const r = rateOf(cur);
  const amt = parseFloat($('#tx-amount').value);
  note.hidden = false;
  note.textContent = isFinite(amt) && amt > 0
    ? `Se registra en ${cur} · ≈ ${fmt(amt * r)} (tasa actual: 1 ${cur} = ${r} ${baseCurrency()})`
    : `Se registrará en ${cur} · tasa actual: 1 ${cur} = ${r} ${baseCurrency()}`;
}
$('#tx-amount').addEventListener('input', updateTxAmountNote);
$('#tx-account').addEventListener('change', updateTxAmountNote);

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
      tags: parseTags($('#tx-tags').value),
    };

    // Moneda/tasa: la de la cuenta elegida; si no cambió la moneda se conserva la histórica
    const accCur = accById(data.accountId).currency || baseCurrency();
    let msg;
    if (editingId) {
      const idx = state.transactions.findIndex(t => t.id === editingId);
      const prev = state.transactions[idx];
      if (prev && prev.currency === accCur && Number(prev.rate) > 0) {
        data.currency = accCur; data.rate = prev.rate;
      } else {
        data.currency = accCur; data.rate = rateOf(accCur);
      }
      if (idx >= 0) state.transactions[idx] = { ...state.transactions[idx], ...data };
      msg = 'Movimiento actualizado';
    } else {
      data.currency = accCur;
      data.rate = rateOf(accCur);
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

/* Multi-moneda: editor de tasas (solo aparece si hay monedas extra en uso) */
function renderRatesSection() {
  const field = $('#rates-field');
  const list = $('#rates-list');
  if (!field || !list) return;
  if (!state.settings.rates || typeof state.settings.rates !== 'object') state.settings.rates = {};
  const curs = currenciesInUse();
  field.hidden = curs.length === 0;
  list.innerHTML = '';
  curs.forEach(code => {
    const r = Number(state.settings.rates[code]);
    const row = document.createElement('div');
    row.className = 'rate-row';
    row.innerHTML = `
      <span class="rc-code">${code}</span>
      <span class="rc-eq">1 ${code} =</span>
      <input type="number" min="0" step="0.0001" placeholder="1.0" value="${r > 0 ? r : ''}" data-rate="${code}" aria-label="Tasa de ${code} a ${baseCurrency()}">
      <span class="rc-eq">${baseCurrency()}${r > 0 ? '' : ' · sin tasa (se asume 1.0)'}</span>`;
    list.appendChild(row);
  });
  list.querySelectorAll('[data-rate]').forEach(inp => inp.addEventListener('change', () => {
    const code = inp.dataset.rate;
    const v = parseFloat(inp.value);
    state.settings.rates[code] = v > 0 ? v : 0;
    save();
    renderAll();
    renderRatesSection();
    toast(`Tasa ${code} actualizada${v > 0 ? `: 1 ${code} = ${v} ${baseCurrency()}` : ' (se asumirá 1.0)'}`);
  }));
}

function openSettings(focusBudget = false) {
  $('#set-currency').value = state.settings.currency || 'MXN';
  $('#set-budget').value = state.settings.budget || '';
  renderLockSection();
  renderNotifSection();
  renderRatesSection();
  renderAccentRow(); // 1.8.0.0
  renderWeeklySection(); // 1.11.0.0
  renderBackupSection(); // 1.12.0.0
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
  $('#about-version').textContent = APP_VERSION;
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
  if (typeof renderBioSection === 'function') renderBioSection(); // 1.8.0.0
}

$('#btn-lock-set').addEventListener('click', () => openPinModal(state.settings.lock ? 'change' : 'enable'));
$('#btn-lock-off').addEventListener('click', () => openPinModal('disable'));

/* =========================================================
   PARTE 1.2.0.0 — Notificaciones locales (sin servidor)
   · Recordatorio diario a una hora elegida (se revisa cada
     minuto con la app abierta o al abrirla ese día).
   · Alertas de presupuesto al 90 % y 100 % del mes.
   · Aviso cuando los movimientos automáticos se registran.
   Todo es local: permiso del navegador, sin internet.
   ========================================================= */

function notifyCfg() {
  const dflt = { daily: false, time: '21:00', budget: true, rec: true, lastDaily: '' };
  state.settings.notify = { ...dflt, ...(state.settings.notify || {}) };
  return state.settings.notify;
}

function notifSupported() { return 'Notification' in window; }

function notifPermText() {
  if (!notifSupported()) return 'Este navegador no admite notificaciones del sistema (se usarán avisos dentro de la app).';
  const p = Notification.permission;
  return 'Permiso del sistema: ' + (
    p === 'granted' ? 'concedido' :
    p === 'denied' ? 'bloqueado (habilítalo en los permisos del navegador)' : 'sin decidir — se pedirá al activar');
}

async function ensureNotifPerm() {
  if (!notifSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try { return await Notification.requestPermission(); } catch { return Notification.permission; }
}

/* Si la app está al frente → toast; si está al fondo → notificación
   del sistema (vía service worker cuando existe). Nunca muestra nada
   con la pantalla de bloqueo activa (privacidad). */
async function systemNotify(title, body) {
  if (!isUnlocked) return;
  if (document.visibilityState === 'visible' || !notifSupported() || Notification.permission !== 'granted') {
    toast(body || title);
    return;
  }
  try {
    const reg = navigator.serviceWorker ? await navigator.serviceWorker.getRegistration() : null;
    if (reg && reg.showNotification) {
      await reg.showNotification(title, { body, icon: 'icon-192.png', badge: 'icon-192.png', tag: 'mis-cuentas-aviso' });
    } else {
      new Notification(title, { body, icon: 'icon-192.png' });
    }
  } catch {
    try { new Notification(title, { body }); } catch { toast(body || title); }
  }
}

function renderNotifSection() {
  const n = notifyCfg();
  $('#notif-daily-label').textContent = `Recordatorio diario: ${n.daily ? 'activado' : 'desactivado'}`;
  $('#notif-daily-toggle').textContent = n.daily ? 'Desactivar' : 'Activar';
  $('#notif-time-row').hidden = !n.daily;
  if (!$('#notif-time').value) $('#notif-time').value = n.time;
  $('#notif-budget-label').textContent = `Alertas de presupuesto (90 % y 100 %): ${n.budget ? 'activadas' : 'desactivadas'}`;
  $('#notif-budget-toggle').textContent = n.budget ? 'Desactivar' : 'Activar';
  $('#notif-rec-label').textContent = `Aviso de movimientos automáticos: ${n.rec ? 'activado' : 'desactivado'}`;
  $('#notif-rec-toggle').textContent = n.rec ? 'Desactivar' : 'Activar';
  $('#notif-note').textContent = notifPermText();
}

$('#notif-daily-toggle').addEventListener('click', async () => {
  const n = notifyCfg();
  if (!n.daily) {
    const perm = await ensureNotifPerm();
    if (perm === 'denied') toast('Permiso bloqueado en el navegador; usarás el aviso interno');
    else if (perm === 'unsupported') toast('Tu navegador no admite notificaciones; usarás el aviso interno');
    n.daily = true;
  } else {
    n.daily = false;
  }
  save();
  renderNotifSection();
  toast(n.daily ? 'Recordatorio diario activado' : 'Recordatorio diario desactivado');
});

$('#notif-time').addEventListener('change', () => {
  const n = notifyCfg();
  n.time = $('#notif-time').value || '21:00';
  save();
  toast('Recordatorio diario a las ' + n.time);
});

$('#notif-budget-toggle').addEventListener('click', () => {
  const n = notifyCfg();
  n.budget = !n.budget;
  save();
  renderNotifSection();
  toast(n.budget ? 'Alertas de presupuesto activadas' : 'Alertas de presupuesto desactivadas');
  if (n.budget) checkBudgetAlert();
});

$('#notif-rec-toggle').addEventListener('click', () => {
  const n = notifyCfg();
  n.rec = !n.rec;
  save();
  renderNotifSection();
  toast(n.rec ? 'Avisos de movimientos automáticos activados' : 'Avisos de movimientos automáticos desactivados');
});

$('#notif-test').addEventListener('click', async () => {
  await ensureNotifPerm();
  renderNotifSection();
  systemNotify('Mis Cuentas', 'Notificación de prueba: las alertas funcionan.');
});

/* Recordatorio diario */
function tickDailyReminder() {
  const n = notifyCfg();
  if (!n.daily || !isUnlocked) return;
  const today = todayISO();
  if (n.lastDaily === today) return;
  const now = new Date();
  const hhmm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  if (hhmm < n.time) return;
  n.lastDaily = today;
  save();
  const hasToday = state.transactions.some(t => t.type !== 'transfer' && t.date === today);
  if (!hasToday) systemNotify('Registro pendiente', 'Todavía no has registrado movimientos hoy.');
}
setInterval(tickDailyReminder, 60000);

/* Alertas de presupuesto mensual (90 % / 100 %, una vez por umbral y mes) */
function checkBudgetAlert() {
  if (!isUnlocked) return;
  const n = notifyCfg();
  let a = state.settings.budgetAlert;
  if (!a || typeof a !== 'object') a = state.settings.budgetAlert = { month: '', level: 0 };
  const m = currentMonth();
  if (a.month !== m) { a.month = m; a.level = 0; }
  const budget = state.settings.budget || 0;
  if (!budget || !n.budget) {
    if (a.level) { a.level = 0; save(); }
    return;
  }
  const spent = state.transactions
    .filter(t => t.type === 'expense' && t.date.startsWith(m))
    .reduce((s, t) => s + txBase(t), 0);
  const ratio = spent / budget;
  const level = ratio >= 1 ? 2 : ratio >= 0.9 ? 1 : 0;
  if (level > a.level) {
    a.level = level;
    save();
    const pct = Math.round(ratio * 100);
    if (level === 2) systemNotify('Presupuesto agotado', `Gasto del mes: ${fmt(spent)} de ${fmt(budget)} (${pct} %).`);
    else systemNotify('Presupuesto al límite', `Ya usaste el ${pct} % del presupuesto del mes (${fmt(spent)} de ${fmt(budget)}).`);
  } else if (level < a.level) {
    a.level = level; // si bajaste el gasto, la alerta se rearma
    save();
  }
}

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
      state.settings.bio = null; // 1.8.0.0 · sin PIN, la biometría ya no aplica
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
  if (typeof setupLockBio === 'function') setupLockBio(true); // 1.8.0.0 · botón + intento biométrico
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
      if (typeof consumeQuickParam === 'function') consumeQuickParam(); // 1.10.0.0
      if (typeof triggerWeekly === 'function') triggerWeekly(); // 1.11.0.0
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
    d[t.type === 'income' ? 'in' : 'out'] += txBase(t);
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
   PARTE 1.7.0.0 — Préstamos y deudas ("me deben / debo")
   Cada registro puede ligarse a una cuenta real: entonces la
   creación y los abonos generan movimientos reales (categoría
   «Préstamos» autocreada). Sin cuenta ligada es solo informativo.
   ========================================================= */

function loansCat() {
  let c = state.categories.find(x => x.name === 'Préstamos');
  if (!c) {
    c = { id: uid(), name: 'Préstamos', icon: '🤝', color: '#8a6d3b', type: 'both', budget: 0, createdAt: Date.now() };
    state.categories.push(c);
  }
  return c;
}

function debtRemaining(d) { return Math.max(0, d.amount - (d.paid || 0)); }
function debtCurrency(d) { return d.accountId ? (accById(d.accountId).currency || baseCurrency()) : baseCurrency(); }

/* Movimiento de abono ligado a cuenta:
   me deben → me entra dinero (ingreso); debo → me sale (gasto). */
function pushDebtTx(d, amount, kind) {
  const cur = debtCurrency(d);
  const isMe = d.direction === 'owes-me';
  state.transactions.push({
    id: uid(), createdAt: Date.now(),
    type: isMe ? 'income' : 'expense',
    amount: Math.round(amount * 100) / 100,
    categoryId: loansCat().id, accountId: d.accountId,
    currency: cur, rate: rateOf(cur),
    date: todayISO(),
    description: isMe ? `Abono de ${d.person} (recupero préstamo)` : `Pago a ${d.person} (saldo mi deuda)`,
  });
}

let editingDebtId = null;
let debtDir = 'owes-me';

function setDebtDir(dir) {
  debtDir = dir;
  $('#debt-dir-me').classList.toggle('active', dir === 'owes-me');
  $('#debt-dir-owe').classList.toggle('active', dir === 'owe');
}
$('#debt-dir-me').addEventListener('click', () => setDebtDir('owes-me'));
$('#debt-dir-owe').addEventListener('click', () => setDebtDir('owe'));

function fillDebtAccounts(selected) {
  const sel = $('#debt-account');
  sel.innerHTML = '<option value="">Sin movimiento en cuentas (solo informativo)</option>' +
    normalAccounts().map(a => `<option value="${a.id}">${escapeHtml(a.name)}${a.currency && a.currency !== baseCurrency() ? ' (' + a.currency + ')' : ''}</option>`).join('');
  sel.value = selected || '';
}

function openDebtModal(debt = null) {
  editingDebtId = debt ? debt.id : null;
  $('#debt-title').textContent = debt ? 'Editar registro' : 'Nuevo préstamo o deuda';
  setDebtDir(debt ? debt.direction : 'owes-me');
  $('#debt-person').value = debt ? debt.person : '';
  $('#debt-amount').value = debt ? debt.amount : '';
  $('#debt-date').value = debt ? debt.date : todayISO();
  $('#debt-note').value = debt ? (debt.note || '') : '';
  fillDebtAccounts(debt ? debt.accountId : '');
  // La vinculación se elige al crear (si editas, se conserva)
  $('#debt-account').disabled = !!debt;
  $('#debt-account').title = debt ? 'La vinculación se conserva como se creó' : '';
  $$('#form-debt .invalid').forEach(el => el.classList.remove('invalid'));
  $('#modal-debt').showModal();
  setTimeout(() => $('#debt-person').focus(), 60);
}
$('#debt-new').addEventListener('click', () => openDebtModal());

$('#form-debt').addEventListener('submit', (e) => {
  e.preventDefault();
  const person = $('#debt-person').value.trim();
  const amount = parseFloat($('#debt-amount').value);
  const date = $('#debt-date').value;
  if (!person) return flagInvalid($('#debt-person'), 'Escribe el nombre de la persona');
  if (!amount || amount <= 0 || !isFinite(amount)) return flagInvalid($('#debt-amount'), 'Ingresa un monto válido');
  if (!date) return flagInvalid($('#debt-date'), 'Selecciona una fecha');

  if (editingDebtId) {
    const d = state.debts.find(x => x.id === editingDebtId);
    if (d) Object.assign(d, { person, amount: Math.round(amount * 100) / 100, date, note: $('#debt-note').value.trim(), direction: debtDir });
    toast('Registro actualizado');
  } else {
    const accId = $('#debt-account').value || null;
    const d = {
      id: uid(), createdAt: Date.now(),
      person, direction: debtDir,
      amount: Math.round(amount * 100) / 100, paid: 0,
      date, note: $('#debt-note').value.trim(),
      accountId: accId, settled: false,
    };
    state.debts.push(d);
    if (accId) {
      // Movimiento real inicial: me deben → sale de mi cuenta; debo → entra
      const cur = debtCurrency(d);
      state.transactions.push({
        id: uid(), createdAt: Date.now(),
        type: debtDir === 'owes-me' ? 'expense' : 'income',
        amount: d.amount, categoryId: loansCat().id, accountId: accId,
        currency: cur, rate: rateOf(cur),
        date, description: debtDir === 'owes-me' ? `Préstamo a ${person}` : `Préstamo de ${person}`,
      });
    }
    toast(accId ? 'Registro creado y movimiento real agregado' : 'Registro creado');
  }
  save();
  renderAll();
  $('#modal-debt').close();
});

/* ---------- Abonos ---------- */
let abonoDebtId = null;

function openDebtAmt(d) {
  abonoDebtId = d.id;
  const isMe = d.direction === 'owes-me';
  $('#debt-amt-title').textContent = `Abonar — ${d.person}`;
  $('#debt-amt-info').textContent =
    `${isMe ? 'Te deben' : 'Debes'} ${fmtCurrency(d.amount, debtCurrency(d))} · ` +
    `abonado ${fmtCurrency(d.paid || 0, debtCurrency(d))} · restante ${fmtCurrency(debtRemaining(d), debtCurrency(d))}.` +
    (d.accountId ? ' Este abono también se registrará en tu cuenta.' : ' (Registro informativo, sin movimiento en cuentas.)');
  $('#debt-amt').value = '';
  $('#debt-amt').classList.remove('invalid');
  $('#modal-debt-amt').showModal();
  setTimeout(() => $('#debt-amt').focus(), 60);
}

$('#form-debt-amt').addEventListener('submit', (e) => {
  e.preventDefault();
  const d = state.debts.find(x => x.id === abonoDebtId);
  if (!d) return;
  const amount = parseFloat($('#debt-amt').value);
  if (!amount || amount <= 0 || !isFinite(amount)) return flagInvalid($('#debt-amt'), 'Ingresa un monto válido');
  const applied = Math.min(amount, debtRemaining(d));
  d.paid = (d.paid || 0) + applied;
  if (d.accountId) pushDebtTx(d, applied, 'abono');
  if (debtRemaining(d) === 0) {
    d.settled = true;
    toast(`Liquidado: ${d.person} ya no ${d.direction === 'owes-me' ? 'te debe' : 'le debes'} nada`);
  } else {
    toast(`Abono registrado · restante ${fmtCurrency(debtRemaining(d), debtCurrency(d))}`);
  }
  save();
  renderAll();
  $('#modal-debt-amt').close();
});

/* ---------- Render ---------- */
function debtsMeBase(list) {
  // Restantes por cobrar/pagar, consolidados en moneda base
  return list.reduce((s, d) => s + debtRemaining(d) * rateOf(debtCurrency(d)), 0);
}

function renderDebts() {
  const list = $('#debts-list');
  const settledWrap = $('#debts-settled');
  if (!list) return;
  const open = state.debts.filter(d => !d.settled);
  const settled = state.debts.filter(d => d.settled);

  $('#debts-me').textContent = fmt(debtsMeBase(open.filter(d => d.direction === 'owes-me')));
  $('#debts-owe').textContent = fmt(debtsMeBase(open.filter(d => d.direction === 'owe')));
  $('#debts-empty').hidden = state.debts.length > 0;

  const rowFor = (d) => {
    const isMe = d.direction === 'owes-me';
    const rem = debtRemaining(d);
    const pct = d.amount > 0 ? Math.min(100, ((d.paid || 0) / d.amount) * 100) : 100;
    const cur = debtCurrency(d);
    const row = document.createElement('div');
    row.className = 'debt-row' + (d.settled ? ' settled' : '');
    row.innerHTML = `
      <div class="debt-top">
        <span class="debt-person">${escapeHtml(d.person)}</span>
        <span class="debt-dir ${isMe ? 'me' : 'owe'}">${isMe ? 'ME DEBEN' : 'DEBO'}</span>
        <span class="debt-amt">${fmtCurrency(d.amount, cur)}</span>
      </div>
      <div class="debt-progress" role="progressbar"><i style="width:${pct}%"></i></div>
      <div class="debt-meta">
        ${d.settled
          ? `<span class="debt-paid-note">Liquidado · ${fmtCurrency(d.amount, cur)}</span>`
          : `Abonado ${fmtCurrency(d.paid || 0, cur)} de ${fmtCurrency(d.amount, cur)} · restante <b>${fmtCurrency(rem, cur)}</b>`}
        · ${fmtDate(d.date)}${d.note ? ' · ' + escapeHtml(d.note) : ''}${d.accountId ? ' · ligado a ' + escapeHtml(accById(d.accountId).name) : ''}
      </div>
      <div class="debt-actions">
        ${d.settled
          ? `<button type="button" class="link-btn" data-reopen="${d.id}">Reabrir</button>`
          : `<button type="button" class="link-btn" data-abono="${d.id}">Abonar</button>
             <button type="button" class="link-btn" data-settle="${d.id}">Liquidar</button>`}
        <button type="button" class="link-btn" data-editdebt="${d.id}">Editar</button>
        <button type="button" class="link-btn" data-deldebt="${d.id}">Eliminar</button>
      </div>`;
    return row;
  };

  list.innerHTML = '';
  open.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).forEach(d => list.appendChild(rowFor(d)));
  settledWrap.innerHTML = '';
  settled.sort((a, b) => b.date.localeCompare(a.date)).forEach(d => settledWrap.appendChild(rowFor(d)));

  const toggle = $('#debts-settled-toggle');
  toggle.hidden = settled.length === 0;
  if (settled.length) toggle.textContent = (settledWrap.hidden ? 'Ver' : 'Ocultar') + ` liquidados (${settled.length}) ` + (settledWrap.hidden ? '▾' : '▴');

  // Acciones
  const root = $('#debts-summary').parentElement;
  root.querySelectorAll('[data-abono]').forEach(b => b.addEventListener('click', () => {
    const d = state.debts.find(x => x.id === b.dataset.abono);
    if (d) openDebtAmt(d);
  }));
  root.querySelectorAll('[data-settle]').forEach(b => b.addEventListener('click', () => {
    const d = state.debts.find(x => x.id === b.dataset.settle);
    if (!d) return;
    const rem = debtRemaining(d);
    if (rem > 0 && d.accountId &&
        !confirm(`Queda un restante de ${fmtCurrency(rem, debtCurrency(d))}. ¿Liquidar y registrarlo como abono final en tu cuenta?`)) return;
    if (rem > 0 && d.accountId) { d.paid = d.amount; pushDebtTx(d, rem, 'liquidacion'); }
    else d.paid = d.amount;
    d.settled = true;
    save();
    renderAll();
    toast(`Liquidado: ${d.person}`);
  }));
  root.querySelectorAll('[data-reopen]').forEach(b => b.addEventListener('click', () => {
    const d = state.debts.find(x => x.id === b.dataset.reopen);
    if (!d) return;
    d.settled = false;
    d.paid = Math.min(d.paid || 0, d.amount);
    save();
    renderAll();
    toast('Registro reabierto');
  }));
  root.querySelectorAll('[data-editdebt]').forEach(b => b.addEventListener('click', () => {
    const d = state.debts.find(x => x.id === b.dataset.editdebt);
    if (d) openDebtModal(d);
  }));
  root.querySelectorAll('[data-deldebt]').forEach(b => b.addEventListener('click', () => {
    const d = state.debts.find(x => x.id === b.dataset.deldebt);
    if (!d) return;
    if (!confirm(`¿Eliminar el registro de «${d.person}»? Los movimientos reales ya registrados no se tocan.`)) return;
    state.debts = state.debts.filter(x => x.id !== d.id);
    save();
    renderAll();
    toast('Registro eliminado');
  }));
}

$('#debts-settled-toggle').addEventListener('click', () => {
  const w = $('#debts-settled');
  w.hidden = !w.hidden;
  renderDebts();
});

/* =========================================================
   PARTE 1.8.0.0 — Biometría y personalización
   - Desbloqueo con huella/rostro (WebAuthn) alternativa al PIN.
   - Color de acento elegido por la persona (sobre --primary).
   - Reordenar tarjetas de cuentas (arrastrar/soltar o ‹ ›).
   Todo local: la credencial biométrica no viaja a ningún
   servidor; el PIN siempre queda como respaldo.
   ========================================================= */

/* ---------- Biometría (WebAuthn, autenticador de plataforma) ---------- */
function bytesToB64url(buf) {
  const b = new Uint8Array(buf);
  let s = '';
  b.forEach(x => s += String.fromCharCode(x));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlToBytes(str) {
  const pad = '='.repeat((4 - str.length % 4) % 4);
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return b;
}
const bioCred = () => state.settings.bio || null;

let _bioCapable = null; // promesa cacheada: ¿este dispositivo tiene huella/rostro?
function bioSupported() {
  if (!_bioCapable) {
    _bioCapable = (async () => {
      try {
        if (!window.PublicKeyCredential || !navigator.credentials) return false;
        return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      } catch { return false; }
    })();
  }
  return _bioCapable;
}

async function registerBio() {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'Mis Cuentas' },
      user: { id: userId, name: 'usuario@mis-cuentas.local', displayName: 'Usuario de Mis Cuentas' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
      timeout: 60000,
      attestation: 'none',
    },
  });
  if (!cred) throw new Error('No se pudo crear la credencial');
  state.settings.bio = { credId: bytesToB64url(cred.rawId), createdAt: Date.now() };
  save();
}

async function tryBioUnlock(auto = false) {
  const bio = bioCred();
  if (!bio) return false;
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ id: b64urlToBytes(bio.credId), type: 'public-key', transports: ['internal'] }],
        userVerification: 'required',
        timeout: 60000,
      },
    });
    if (assertion) {
      isUnlocked = true;
      $('#lock-pin').value = '';
      $('#lock-screen').hidden = true;
      if (typeof consumeQuickParam === 'function') consumeQuickParam(); // 1.10.0.0
      if (typeof triggerWeekly === 'function') triggerWeekly(); // 1.11.0.0
      return true;
    }
  } catch (err) {
    if (!auto && err && err.name !== 'NotAllowedError') console.warn('Biometría:', err);
    // NotAllowedError = la persona canceló; queda el botón visible para reintentar
  }
  return false;
}

async function renderBioSection() {
  const row = $('#bio-row'), note = $('#bio-note');
  if (!row) return;
  const on = !!state.settings.lock;
  const capable = on && await bioSupported();
  row.hidden = !capable;
  note.hidden = !capable;
  if (!capable) return;
  const active = !!bioCred();
  $('#bio-status').textContent = 'Huella / rostro: ' + (active ? 'activado' : 'desactivado');
  $('#bio-status').classList.toggle('on', active);
  $('#btn-bio').textContent = active ? 'Desactivar' : 'Activar';
}

$('#btn-bio').addEventListener('click', async () => {
  if (bioCred()) {
    state.settings.bio = null;
    save();
    await renderBioSection();
    toast('Desbloqueo con huella/rostro desactivado');
    return;
  }
  if (!state.settings.lock) return toast('Primero activa el bloqueo con PIN');
  try {
    await registerBio();
    await renderBioSection();
    toast('Huella / rostro activada');
  } catch (err) {
    if (err && err.name === 'NotAllowedError') toast('Registro cancelado');
    else { console.warn(err); toast('No fue posible registrar la biometría en este dispositivo'); }
  }
});

$('#lock-bio').addEventListener('click', () => tryBioUnlock(false));

/* Pantalla de bloqueo: muestra el botón biométrico y lo intenta de inmediato.
   Definida como extensión de showLock() (PARTE 2). */
async function setupLockBio(auto = true) {
  const btn = $('#lock-bio');
  const has = !!bioCred();
  btn.hidden = !has;
  if (!has) return;
  if (auto && await bioSupported()) {
    setTimeout(() => { if (!$('#lock-screen').hidden) tryBioUnlock(true); }, 250);
  }
}

/* ---------- Color de acento ---------- */
const ACCENTS = [
  { id: 'verde',    label: 'Verde (predeterminado)', value: null },
  { id: 'mar',      label: 'Azul mar',      value: '#1f5fa8' },
  { id: 'petroleo', label: 'Petróleo',      value: '#0d7a8a' },
  { id: 'morado',   label: 'Morado',        value: '#6d4fa1' },
  { id: 'vino',     label: 'Vino',          value: '#a03a50' },
  { id: 'ocre',     label: 'Ocre',          value: '#b06f22' },
  { id: 'ciruela',  label: 'Ciruela',       value: '#8a4d76' },
  { id: 'grafito',  label: 'Grafito',       value: '#4a5a63' },
];

/* Oscurece un hex en pct% (0-100) para derivar --primary-strong. */
function shadeColor(hex, pct) {
  const h = hex.replace('#', '');
  const n = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  const f = 1 - Math.max(-80, Math.min(80, pct)) / 100; // pct<0 aclara, pct>0 oscurece
  return '#' + n.map(c => Math.max(0, Math.min(255, Math.round(c * f))).toString(16).padStart(2, '0')).join('');
}

function applyAccent() {
  const root = document.documentElement;
  const v = state.settings.accent;
  if (!v) {
    ['--primary', '--primary-strong', '--primary-soft'].forEach(p => root.style.removeProperty(p));
    return;
  }
  const dark = (state.settings.theme || 'light') === 'dark';
  root.style.setProperty('--primary', v);
  // En tema oscuro el acento «fuerte» se aclara; en claro se oscurece.
  root.style.setProperty('--primary-strong', dark ? shadeColor(v, -18) : shadeColor(v, 22));
  root.style.setProperty('--primary-soft', hexToRgba(v, dark ? .22 : .13));
}

function renderAccentRow() {
  const row = $('#accent-row');
  if (!row) return;
  row.innerHTML = '';
  ACCENTS.forEach(a => {
    const b = document.createElement('button');
    b.type = 'button';
    b.title = a.label;
    b.setAttribute('aria-label', a.label);
    const active = (state.settings.accent || null) === a.value;
    if (a.value === null) {
      b.className = 'link-btn accent-default' + (active ? ' active' : '');
      b.textContent = 'Predeterminado';
    } else {
      b.className = 'swatch' + (active ? ' active' : '');
      b.style.background = a.value;
    }
    b.addEventListener('click', () => {
      state.settings.accent = a.value;
      save();
      applyAccent();
      renderAccentRow();
      renderDonut();
    });
    row.appendChild(b);
  });
}

/* ---------- Reordenar cuentas ---------- */
function orderedAccounts() {
  const list = normalAccounts();
  const ord = state.settings.accOrder || [];
  if (!ord.length) return list;
  const rank = new Map(ord.map((id, i) => [id, i]));
  return [...list].sort((a, b) => {
    const ra = rank.has(a.id) ? rank.get(a.id) : ord.length + list.indexOf(a);
    const rb = rank.has(b.id) ? rank.get(b.id) : ord.length + list.indexOf(b);
    return ra - rb;
  });
}

/* Persiste el orden visible de las tarjetas reales. */
function persistAccOrderFromDom() {
  const row = $('#acc-row');
  const ids = [...row.querySelectorAll('.acc-card[data-acc]')].map(el => el.dataset.acc);
  state.settings.accOrder = ids;
  save();
}

/* Intercambia la posición de una cuenta (botones ‹ › del gestor). */
function moveAccount(id, dir) {
  const list = orderedAccounts();
  const i = list.findIndex(a => a.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  state.settings.accOrder = list.map(a => a.id);
  save();
  renderAccList();
  renderAccounts();
}

/* Arrastrar y soltar sobre la fila de tarjetas (escritorio). */
let accDragId = null;
function onAccDragStart(e) {
  const card = e.target.closest('.acc-card[data-acc]');
  if (!card) return;
  accDragId = card.dataset.acc;
  card.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', accDragId); } catch {}
}
function onAccDragOver(e) {
  const card = e.target.closest('.acc-card[data-acc]');
  if (!card || !accDragId || card.dataset.acc === accDragId) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const row = $('#acc-row');
  const dragging = row.querySelector('.acc-card.dragging');
  if (!dragging) return;
  const rect = card.getBoundingClientRect();
  const before = (e.clientX - rect.left) < rect.width / 2;
  row.querySelectorAll('.acc-card.drop-before,.acc-card.drop-after').forEach(c => c.classList.remove('drop-before', 'drop-after'));
  card.classList.add(before ? 'drop-before' : 'drop-after');
  row.insertBefore(dragging, before ? card : card.nextSibling);
}
function onAccDrop(e) {
  const card = e.target.closest('.acc-card[data-acc]');
  if (!card || !accDragId) return;
  e.preventDefault();
  endAccDrag(true);
}
function endAccDrag(persist = false) {
  const row = $('#acc-row');
  if (row) row.querySelectorAll('.acc-card.drop-before,.acc-card.drop-after,.acc-card.dragging')
    .forEach(c => c.classList.remove('drop-before', 'drop-after', 'dragging'));
  if (persist && accDragId) persistAccOrderFromDom();
  accDragId = null;
}

/* =========================================================
   PARTE 1.10.0.0 — Atajos y productividad
   - Atajos de la app instalada: ?quick=expense|income
     (manifest shortcuts) → abren "Nuevo movimiento" ya con
     el tipo elegido, respetando el bloqueo con PIN/biometría.
   - Atajos de teclado: + / N nuevo movimiento, / buscar,
     Esc cierra las ventanas (nativo de <dialog>).
   ========================================================= */

/* ---------- ?quick= (atajos del icono de la app instalada) ---------- */
let pendingQuick = null;
try {
  pendingQuick = new URLSearchParams(location.search).get('quick');
} catch { pendingQuick = null; }

function consumeQuickParam() {
  if (!pendingQuick) return;
  if (!isUnlocked) return; // se reintenta al desbloquear
  const v = pendingQuick;
  pendingQuick = null;
  try { history.replaceState(null, '', location.pathname); } catch {}
  if (v === 'expense' || v === 'income') {
    openTxModal();
    setTxType(v);
    fillTxCategories(v, null);
    setTimeout(() => $('#tx-amount').focus(), 60);
    toast(v === 'income' ? 'Atajo: nuevo ingreso' : 'Atajo: nuevo gasto');
  }
}

/* ---------- Atajos de teclado (escritorio) ---------- */
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (!isUnlocked) return;
  const t = e.target;
  const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  if (typing) return;
  const openDialog = document.querySelector('dialog[open]');
  if (e.key === '/') {
    e.preventDefault();
    $('#f-search').focus();
    $('#f-search').select();
  } else if (e.key === '+' || e.key.toLowerCase() === 'n') {
    if (openDialog) return; // dentro de un modal, Esc/cierra y botones mandan
    e.preventDefault();
    openTxModal();
  }
});

/* =========================================================
   PARTE 1.11.0.0 — Resumen semanal ("wrapped" de los lunes)
   - Panel permanente «Tu semana»: semana en curso (lunes a
     domingo), top de categorías, día pico y comparativa.
   - Repaso conmemorativo: la primera vez que abres la app en
     la semana (p. ej. el lunes), un resumen de la semana
     anterior — una vez por semana, desactivable en
     Configuración. Todo local; sin nada de nube.
   ========================================================= */

function mondayOf(iso) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() - (d.getDay() + 6) % 7); // retrocede al lunes
  return d;
}
function isoOfDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function shiftDays(d, n) {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

/* Estadísticas de un rango [from, to] (ISO), en moneda base, sin Oculto. */
function weeklyStats(fromISO, toISO) {
  const list = state.transactions.filter(t =>
    t.type !== 'transfer' && t.date >= fromISO && t.date <= toISO &&
    !accById(t.accountId).hidden
  );
  let inc = 0, out = 0;
  const byCat = {}, byDay = {};
  list.forEach(t => {
    const base = txBase(t);
    if (t.type === 'income') { inc += base; return; }
    out += base;
    byCat[t.categoryId] = (byCat[t.categoryId] || 0) + base;
    byDay[t.date] = (byDay[t.date] || 0) + base;
  });
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([cid, amt]) => ({ cat: catById(cid), amt }));
  let peak = null;
  Object.entries(byDay).forEach(([d, amt]) => { if (!peak || amt > peak.amt) peak = { date: d, amt }; });
  return { n: list.length, inc, out, top, peak, days: new Set(list.map(t => t.date)).size };
}

function weekRangeLabel(fromISO, toISO) {
  const f = new Date(fromISO + 'T00:00:00'), t = new Date(toISO + 'T00:00:00');
  const o1 = { day: 'numeric', month: 'short' }, o2 = { day: 'numeric', month: 'short', year: 'numeric' };
  return `${f.toLocaleDateString('es-MX', o1)} – ${t.toLocaleDateString('es-MX', o2)}`.replace(/\./g, '');
}

function weekCmpLabel(cur, prev) {
  if (prev <= 0) return null;
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (Math.abs(pct) < 1) return { cls: '', txt: '≈ igual que la semana anterior' };
  return pct > 0
    ? { cls: 'up', txt: `▲ ${pct}% más gasto que la semana anterior` }
    : { cls: 'down', txt: `▼ ${Math.abs(pct)}% menos gasto que la semana anterior` };
}

function weekBodyHtml(stats, cmpStats, prevStats) {
  let html = `<div class="week-nums">
      <div><b class="neg">${fmt(stats.out)}</b><span>gastaste</span></div>
      <div><b class="pos">${fmt(stats.inc)}</b><span>ingresaste</span></div>
      <div><b>${stats.n}</b><span>movimiento${stats.n === 1 ? '' : 's'}</span></div>
    </div>`;
  const cmp = weekCmpLabel(stats.out, cmpStats && cmpStats.out);
  if (cmp) html += `<p class="week-cmp ${cmp.cls}">${cmp.txt}</p>`;
  if (stats.top.length) {
    const max = stats.top[0].amt || 1;
    html += '<ul class="week-list">' + stats.top.map(x => `
      <li>
        <span>${x.cat.icon}</span>
        <span>${escapeHtml(x.cat.name)}</span>
        <b>${fmt(x.amt)}</b>
        <span class="wb"><i style="width:${Math.round(x.amt / max * 100)}%"></i></span>
      </li>`).join('') + '</ul>';
  }
  if (stats.peak) {
    const dayName = new Date(stats.peak.date + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long' });
    html += `<p class="week-note">Tu día de mayor gasto fue <b>${dayName}</b> (${fmt(stats.peak.amt)}).</p>`;
  }
  if (!stats.n) html += '<p class="week-empty">Sin movimientos en ese período.</p>';
  return html;
}

/* Panel permanente de la semana en curso */
function renderWeekPanel() {
  const body = $('#week-panel-body');
  if (!body) return;
  const mon = mondayOf(todayISO());
  const from = isoOfDate(mon);
  const to = isoOfDate(shiftDays(mon, 6));
  $('#week-range').textContent = weekRangeLabel(from, to);
  const cur = weeklyStats(from, to);
  const prev = weeklyStats(isoOfDate(shiftDays(mon, -7)), isoOfDate(shiftDays(mon, -1)));
  body.innerHTML = weekBodyHtml(cur, prev);
}

/* Repaso de la semana ANTERIOR (modal conmemorativo) */
function openWeekModal() {
  const mon = mondayOf(todayISO());
  const from = isoOfDate(shiftDays(mon, -7));
  const to = isoOfDate(shiftDays(mon, -1));
  const prev = weeklyStats(from, to);
  const before = weeklyStats(isoOfDate(shiftDays(mon, -14)), isoOfDate(shiftDays(mon, -8)));
  $('#week-body').innerHTML =
    `<p class="week-note">Repaso de la semana del <b>${weekRangeLabel(from, to)}</b>:</p>` +
    weekBodyHtml(prev, before);
  $('#modal-week').showModal();
}

$('#week-review').addEventListener('click', openWeekModal);

/* Una vez por semana natural: la primera apertura de la semana (el lunes
   si la abres ese día). Solo si la semana anterior tuvo movimientos. */
function triggerWeekly() {
  const w = state.settings.weekly || (state.settings.weekly = { enabled: true, lastKey: '' });
  if (!w.enabled) return;
  const mon = mondayOf(todayISO());
  const key = isoOfDate(mon);
  if (w.lastKey === key) return;
  const prev = weeklyStats(isoOfDate(shiftDays(mon, -7)), isoOfDate(shiftDays(mon, -1)));
  w.lastKey = key;
  save();
  if (prev.n > 0) setTimeout(openWeekModal, 350);
}

/* Activar/desactivar desde Configuración */
function renderWeeklySection() {
  const w = state.settings.weekly || { enabled: true };
  const lab = $('#weekly-label');
  if (!lab) return;
  lab.textContent = 'Repaso semanal de los lunes: ' + (w.enabled ? 'activado' : 'desactivado');
  lab.classList.toggle('on', !!w.enabled);
  $('#weekly-toggle').textContent = w.enabled ? 'Desactivar' : 'Activar';
}
$('#weekly-toggle').addEventListener('click', () => {
  const w = state.settings.weekly || (state.settings.weekly = { enabled: true, lastKey: '' });
  w.enabled = !w.enabled;
  save();
  renderWeeklySection();
  toast(w.enabled ? 'Repaso semanal activado' : 'Repaso semanal desactivado');
});
$('#week-off-btn').addEventListener('click', () => {
  const w = state.settings.weekly || (state.settings.weekly = { enabled: true, lastKey: '' });
  w.enabled = false;
  save();
  renderWeeklySection();
  $('#modal-week').close();
  toast('Repaso de los lunes desactivado (Configurable en Ajustes)');
});

/* =========================================================
   PARTE 1.12.0.0 — Respaldo automático a archivo
   File System Access API: la persona elige una carpeta una
   vez (el permiso se guarda en IndexedDB) y la app escribe
   mis-cuentas-AAAA-MM-DD.json al pasar a segundo plano.
   Rotación: se conservan los 7 respaldos más recientes.
   Sin nube: el archivo nunca sale del dispositivo.
   ========================================================= */
const BKP_KEEP = 7;
const bkupSupported = 'showDirectoryPicker' in window;

/* Mini store IndexedDB solo para el handle de carpeta
   (los FileSystemHandle no caben en localStorage). */
function _fsDb() {
  return new Promise((res, rej) => {
    const q = indexedDB.open('misCuentasFS', 1);
    q.onupgradeneeded = () => q.result.createObjectStore('kv');
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
}
async function idbSet(key, val) {
  const db = await _fsDb();
  return new Promise((res, rej) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(val, key);
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}
async function idbGet(key) {
  const db = await _fsDb();
  return new Promise((res, rej) => {
    const tx = db.transaction('kv', 'readonly');
    const r = tx.objectStore('kv').get(key);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbDel(key) {
  const db = await _fsDb();
  return new Promise((res, rej) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').delete(key);
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}

async function bkupDir() {
  try { return await idbGet('bkupDir'); } catch { return null; }
}

/* Rotación: borra los mis-cuentas-*.json que excedan BKP_KEEP. */
async function bkupRotate(dir) {
  const names = [];
  for await (const e of dir.values()) {
    if (e.kind === 'file' && /^mis-cuentas-\d{4}-\d{2}-\d{2}\.json$/.test(e.name)) names.push(e.name);
  }
  names.sort().reverse();
  for (const n of names.slice(BKP_KEEP)) {
    try { await dir.removeEntry(n); } catch (e) { console.warn('rotación:', e); }
  }
}

/* Escribe el respaldo del día (sobreescribe el de hoy si existe). */
async function backupNow(manual = false) {
  const dir = await bkupDir();
  if (!dir) return { ok: false, reason: 'no-dir' };
  let perm = 'denied';
  try {
    perm = await dir.queryPermission({ mode: 'readwrite' });
    if (perm !== 'granted' && manual) perm = await dir.requestPermission({ mode: 'readwrite' });
  } catch (e) { console.warn('permisos FS:', e); }
  if (perm !== 'granted') {
    state.settings.backup.lastError = 'permiso';
    save();
    renderBackupSection();
    return { ok: false, reason: 'perm' };
  }
  try {
    const name = `mis-cuentas-${todayISO()}.json`;
    const fh = await dir.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(JSON.stringify(state));
    await w.close();
    await bkupRotate(dir);
    state.settings.backup.lastOK = Date.now();
    state.settings.backup.lastError = '';
    save();
    renderBackupSection();
    return { ok: true, name };
  } catch (e) {
    console.warn('respaldo:', e);
    state.settings.backup.lastError = 'escritura';
    save();
    renderBackupSection();
    return { ok: false, reason: 'write' };
  }
}

/* Respaldo silencioso al ir a segundo plano (sin gesto: exige permiso
   ya concedido; si no, lo deja marcado para la próxima apertura). */
let _bkupRunning = false;
async function autoBackup() {
  if (!bkupSupported || _bkupRunning) return;
  const dir = await bkupDir();
  if (!dir) return;
  _bkupRunning = true;
  try { await backupNow(false); }
  finally { _bkupRunning = false; }
}

/* ---------- Sección en Configuración ---------- */
async function renderBackupSection() {
  const field = $('#bkup-field');
  if (!field) return;
  field.hidden = !bkupSupported;
  if (!bkupSupported) return;
  const dir = await bkupDir();
  const lab = $('#bkup-label');
  const acts = $('#bkup-actions');
  lab.classList.remove('fresh', 'stale');
  if (!dir) {
    lab.textContent = 'Sin carpeta elegida';
    acts.hidden = true;
    $('#bkup-choose').textContent = 'Elegir carpeta…';
    return;
  }
  acts.hidden = false;
  $('#bkup-choose').textContent = 'Cambiar…';
  const last = state.settings.backup.lastOK;
  if (state.settings.backup.lastError === 'permiso') {
    lab.textContent = `Carpeta «${dir.name}» · permiso pendiente (toca «Respaldar ahora»)`;
    lab.classList.add('stale');
  } else if (!last) {
    lab.textContent = `Carpeta «${dir.name}» · sin respaldos todavía`;
  } else {
    const days = Math.floor((Date.now() - last) / 86400000);
    const when = days === 0 ? 'hoy' : days === 1 ? 'ayer' : `hace ${days} días`;
    lab.textContent = `Carpeta «${dir.name}» · último respaldo: ${when}`;
    lab.classList.add(days <= 1 ? 'fresh' : 'stale');
  }
}

$('#bkup-choose').addEventListener('click', async () => {
  try {
    const dir = await showDirectoryPicker({ mode: 'readwrite' });
    await idbSet('bkupDir', dir);
    const r = await backupNow(true); // gesto fresco: permiso + primer respaldo
    renderBackupSection();
    if (r.ok) toast(`Respaldo automático activado · ${r.name}`);
    else toast('Carpeta guardada; se respaldará al pasar a segundo plano');
  } catch (e) {
    if (e && e.name !== 'AbortError') { console.warn(e); toast('No fue posible usar esa carpeta'); }
  }
});

$('#bkup-now').addEventListener('click', async () => {
  const r = await backupNow(true);
  if (r.ok) toast(`Respaldo listo: ${r.name}`);
  else if (r.reason === 'perm') toast('Se necesita permiso de escritura en la carpeta');
  else toast('No se pudo escribir el respaldo');
});

$('#bkup-forget').addEventListener('click', async () => {
  await idbDel('bkupDir');
  state.settings.backup.lastOK = 0;
  state.settings.backup.lastError = '';
  save();
  renderBackupSection();
  toast('Carpeta olvidada (los archivos existentes se conservan)');
});

/* Aviso al abrir si el respaldo está viejo (permisos caducados, etc.). */
async function warnStaleBackup() {
  if (!bkupSupported) return;
  const dir = await bkupDir();
  if (!dir || !state.transactions.length) return;
  const last = state.settings.backup.lastOK;
  if (!last || (Date.now() - last) > 7 * 86400000) {
    setTimeout(() => toast('Tu respaldo automático tiene más de 7 días: revísalo en Configuración'), 1200);
  }
}

/* =========================================================
   PARTE 1.13.0.0 — Búsquedas guardadas (filtros favoritos)
   Guarda la combinación actual de filtros con un nombre y la
   reaplica con un toque desde la barra de filtros o desde el
   modal gestor. Viajan en el respaldo JSON (state.savedFilters).
   ========================================================= */

const FILTER_KEYS = ['q', 'type', 'category', 'account', 'month', 'from', 'to', 'min', 'max', 'tag'];

function snapshotFilters() {
  const f = {};
  FILTER_KEYS.forEach(k => { f[k] = filters[k]; });
  return f;
}
function filtersAreDefault() {
  const d = { q: '', type: 'all', category: 'all', account: 'all', month: currentMonth(), from: '', to: '', min: '', max: '', tag: 'all' };
  return FILTER_KEYS.every(k => JSON.stringify(filters[k]) === JSON.stringify(d[k]));
}

/* Resumen legible de una combinación guardada. */
function filtersSummaryText(f) {
  const parts = [];
  if (f.type === 'income') parts.push('ingresos');
  if (f.type === 'expense') parts.push('gastos');
  if (f.category && f.category !== 'all') parts.push(catById(f.category).name);
  if (f.account && f.account !== 'all') parts.push(accById(f.account).name);
  if (f.tag && f.tag !== 'all') parts.push('#' + f.tag);
  if (f.q) parts.push(`«${f.q}»`);
  if (f.from || f.to) parts.push(`${f.from || '…'} → ${f.to || '…'}`);
  else if (f.month && f.month !== 'all') {
    const label = new Date(f.month + '-15T00:00:00').toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    parts.push(label);
  } else if (f.month === 'all') parts.push('todos los meses');
  if (f.min !== '' && f.min != null) parts.push(`≥ ${fmt(f.min)}`);
  if (f.max !== '' && f.max != null) parts.push(`≤ ${fmt(f.max)}`);
  return parts.length ? parts.join(' · ') : 'Todos los movimientos';
}

/* Selector de la barra de filtros (menú de acción). */
function renderSavedSelect() {
  const sel = $('#f-saved');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">Guardados…</option>';
  state.savedFilters.forEach(sf => {
    const o = document.createElement('option');
    o.value = sf.id;
    o.textContent = sf.name;
    sel.appendChild(o);
  });
  sel.value = state.savedFilters.some(sf => sf.id === cur) ? cur : '';
}

/* Aplica una combinación: estado + todos los controles visibles. */
function applySavedFilter(id) {
  const sf = state.savedFilters.find(x => x.id === id);
  if (!sf) return;
  FILTER_KEYS.forEach(k => { filters[k] = sf.f[k]; });
  $('#f-search').value = filters.q || '';
  $('#f-type').value = filters.type;
  $('#f-category').value = filters.category;
  $('#f-tag').value = filters.tag;
  $('#f-month').value = (filters.month && filters.month !== 'all') ? filters.month : '';
  $('#f-from').value = filters.from || '';
  $('#f-to').value = filters.to || '';
  $('#f-min').value = filters.min === '' ? '' : filters.min;
  $('#f-max').value = filters.max === '' ? '' : filters.max;
  if (typeof updateAdvUI === 'function') updateAdvUI();
  renderAccounts();
  refreshFilteredViews();
  if (typeof renderSavedSelect === 'function') renderSavedSelect();
  $('#f-saved').value = '';
}

$('#f-saved').addEventListener('change', (e) => {
  if (!e.target.value) return;
  applySavedFilter(e.target.value);
  toast('Filtro aplicado');
});

/* ---------- Modal gestor ---------- */
const modalFsave = $('#modal-fsave');

function renderFsaveList() {
  const ul = $('#fsave-list');
  ul.innerHTML = '';
  if (!state.savedFilters.length) {
    ul.innerHTML = '<li class="fsave-empty">Aún no guardas ninguna combinación.</li>';
    return;
  }
  state.savedFilters.forEach(sf => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="fsave-name"><b>${escapeHtml(sf.name)}</b></span>
      <span class="fsave-desc">${escapeHtml(filtersSummaryText(sf.f))}</span>
      <span class="spacer"></span>
      <button type="button" class="link-btn" data-apply="${sf.id}">Aplicar</button>
      <button type="button" class="link-btn del" data-delsaved="${sf.id}">Eliminar</button>`;
    li.querySelector('[data-apply]').addEventListener('click', () => {
      modalFsave.close();
      applySavedFilter(sf.id);
      toast(`Filtro «${sf.name}» aplicado`);
    });
    li.querySelector('[data-delsaved]').addEventListener('click', () => {
      if (!confirm(`¿Eliminar el filtro guardado «${sf.name}»?`)) return;
      state.savedFilters = state.savedFilters.filter(x => x.id !== sf.id);
      save();
      renderFsaveList();
      renderSavedSelect();
      toast('Filtro eliminado');
    });
    ul.appendChild(li);
  });
}

function openFsaveModal() {
  const active = !filtersAreDefault();
  $('#fsave-new').style.display = active ? '' : 'none';
  if (active) {
    $('#fsave-summary').textContent = 'Combinación actual: ' + filtersSummaryText(snapshotFilters());
    $('#fsave-name').value = '';
  }
  renderFsaveList();
  modalFsave.showModal();
  if (active) setTimeout(() => $('#fsave-name').focus(), 60);
}

$('#f-save').addEventListener('click', () => {
  if (filtersAreDefault()) toast('Ajusta algún filtro primero (los verás arriba de la lista)');
  openFsaveModal();
});

$('#form-fsave').addEventListener('submit', (e) => {
  e.preventDefault();
  if (filtersAreDefault()) return;
  const name = $('#fsave-name').value.trim();
  if (!name) return flagInvalid($('#fsave-name'), 'Ponle un nombre a esta combinación');
  state.savedFilters.push({ id: uid(), name, f: snapshotFilters(), createdAt: Date.now() });
  save();
  renderFsaveList();
  renderSavedSelect();
  $('#fsave-name').value = '';
  toast(`Filtro «${name}» guardado`);
});

/* =========================================================
   PARTE 1.14.0.0 — Personalizar portada
   Reordenar y mostrar/ocultar los paneles de información.
   Ocultar un panel jamás borra datos: el cálculo sigue
   corriendo; solo cambia la presentación.
   settings.panels = { order: [ids…], hidden: [ids…] } | null
   ========================================================= */

/* quick va fijo arriba (solo visible/oculto); los demás se reordenan. */
const LAYOUT_PANELS = [
  { id: 'quick',   label: 'Registro rápido',        moves: false },
  { id: 'flow',    label: 'Flujo del mes (anillo)', moves: true },
  { id: 'budgets', label: 'Presupuestos por categoría', moves: true },
  { id: 'donut',   label: 'Gastos por categoría',   moves: true },
  { id: 'goals',   label: 'Metas de ahorro',        moves: true },
  { id: 'debts',   label: 'Préstamos y deudas',     moves: true },
  { id: 'week',    label: 'Tu semana',              moves: true },
  { id: 'months',  label: 'Comparativa — 6 meses',  moves: true },
  { id: 'year',    label: 'Estadísticas del año',   moves: true },
];
const DEFAULT_PANEL_ORDER = LAYOUT_PANELS.filter(p => p.moves).map(p => p.id);

function panelsLayout() {
  const st = state.settings.panels;
  const order = [];
  if (st && Array.isArray(st.order)) {
    st.order.forEach(id => { if (DEFAULT_PANEL_ORDER.includes(id) && !order.includes(id)) order.push(id); });
  }
  DEFAULT_PANEL_ORDER.forEach(id => { if (!order.includes(id)) order.push(id); });
  const hidden = (st && Array.isArray(st.hidden)) ? st.hidden.filter(id => LAYOUT_PANELS.some(p => p.id === id)) : [];
  return { order, hidden, custom: !!st };
}

function applyPanelLayout() {
  const { order, hidden } = panelsLayout();
  const wrap = document.querySelector('.panels');
  if (!wrap) return;
  // Reordenar los 8 paneles del bloque de gráficas
  order.forEach(id => {
    const el = wrap.querySelector(`[data-panel="${id}"]`);
    if (el) wrap.appendChild(el);
  });
  // Mostrar/ocultar (incluido el registro rápido, que está fuera)
  LAYOUT_PANELS.forEach(p => {
    const el = document.querySelector(`[data-panel="${p.id}"]`);
    if (el) el.classList.toggle('panel-hidden', hidden.includes(p.id));
  });
}

function movePanel(id, dir) {
  const st = state.settings.panels || (state.settings.panels = { order: [...DEFAULT_PANEL_ORDER], hidden: [] });
  const cur = panelsLayout().order;
  const i = cur.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= cur.length) return;
  [cur[i], cur[j]] = [cur[j], cur[i]];
  st.order = cur;
  save();
  applyPanelLayout();
  renderLayoutList();
}

function togglePanelVisible(id) {
  const st = state.settings.panels || (state.settings.panels = { order: [...DEFAULT_PANEL_ORDER], hidden: [] });
  st.hidden = panelsLayout().hidden.includes(id)
    ? panelsLayout().hidden.filter(x => x !== id)
    : [...panelsLayout().hidden, id];
  save();
  applyPanelLayout();
  renderLayoutList();
}

function renderLayoutList() {
  const ul = $('#layout-list');
  if (!ul) return;
  ul.innerHTML = '';
  const { order, hidden } = panelsLayout();
  // quick primero (fijo), luego el orden elegido
  const seq = ['quick', ...order];
  seq.forEach((id) => {
    const meta = LAYOUT_PANELS.find(p => p.id === id);
    const idx = meta.moves ? order.indexOf(id) : -1;
    const off = hidden.includes(id);
    const li = document.createElement('li');
    li.innerHTML = `
      ${meta.moves
        ? `<button type="button" class="mv" title="Subir" aria-label="Subir" ${idx === 0 ? 'disabled' : ''}>‹</button>
           <button type="button" class="mv" title="Bajar" aria-label="Bajar" ${idx === order.length - 1 ? 'disabled' : ''}>›</button>`
        : `<span class="mv" aria-hidden="true"></span><span class="mv" aria-hidden="true" style="visibility:hidden"></span>`}
      <span class="lname ${off ? 'off' : ''}">${meta.label}${meta.moves ? '' : ' (fijo arriba)'}</span>
      <button type="button" class="link-btn ltog ${off ? '' : 'on'}">${off ? 'Mostrar' : 'Ocultar'}</button>`;
    if (meta.moves) {
      const [up, down] = li.querySelectorAll('.mv');
      up.addEventListener('click', () => movePanel(id, -1));
      down.addEventListener('click', () => movePanel(id, 1));
    }
    li.querySelector('.ltog').addEventListener('click', () => togglePanelVisible(id));
    ul.appendChild(li);
  });
}

$('#btn-layout').addEventListener('click', () => {
  $('#modal-settings').close();
  renderLayoutList();
  $('#modal-layout').showModal();
});

$('#layout-reset').addEventListener('click', () => {
  state.settings.panels = null;
  save();
  applyPanelLayout();
  renderLayoutList();
  toast('Portada restablecida');
});

/* =========================================================
   PARTE 7 — Múltiples cuentas y transferencias
   ========================================================= */

/* Strip de cuentas con saldo en vivo + acceso a gestor y transferencias */
function renderAccounts() {
  const row = $('#acc-row');
  if (!row) return;
  row.innerHTML = '';
  // 1.8.0.0 · arrastrar y soltar para reordenar (idempotente)
  row.ondragstart = onAccDragStart;
  row.ondragover = onAccDragOver;
  row.ondrop = onAccDrop;
  row.ondragend = () => endAccDrag(false);
  row.ondragleave = (e) => { if (e.target === row) row.querySelectorAll('.acc-card.drop-before,.acc-card.drop-after').forEach(c => c.classList.remove('drop-before', 'drop-after')); };

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
  // 1.8.0.0 · en el orden elegido por la persona y arrastrables
  orderedAccounts().forEach(a => {
    const card = mkCard({ id: a.id, icon: a.icon, color: a.color, name: a.name, bal: accountBalance(a.id) });
    card.dataset.acc = a.id;
    card.draggable = true;
    if (a.currency && a.currency !== baseCurrency()) {
      const balEl = card.querySelector('.acc-bal');
      balEl.textContent = fmtCurrency(accountBalance(a.id), a.currency);
      const sub = document.createElement('span');
      sub.className = 'acc-base';
      sub.textContent = `≈ ${fmt(accBalanceBase(a))}`;
      balEl.after(sub);
    }
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
  $('#acc-currency').value = baseCurrency();
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
    currency: $('#acc-currency').value || baseCurrency(),
  };
  if (editingAccId) {
    const a = state.accounts.find(x => x.id === editingAccId);
    if (a && (a.currency || baseCurrency()) !== data.currency) {
      const nTx = state.transactions.filter(t =>
        t.type === 'transfer' ? (t.accountId === a.id || t.toAccountId === a.id) : t.accountId === a.id).length;
      if (nTx && !confirm('Cambiar la moneda no altera tus movimientos: cada uno conserva su moneda y tasa de registro. ¿Continuar?')) return;
    }
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
  const list = orderedAccounts(); // 1.8.0.0
  list.forEach((a, idx) => {
    const nTx = state.transactions.filter(t =>
      t.type === 'transfer' ? (t.accountId === a.id || t.toAccountId === a.id) : t.accountId === a.id
    ).length;
    const bal = accountBalance(a.id);
    const li = document.createElement('li');
    li.innerHTML = `
      <button type="button" class="mv mv-up" title="Mover antes" aria-label="Mover antes" ${idx === 0 ? 'disabled' : ''}>‹</button>
      <button type="button" class="mv mv-down" title="Mover después" aria-label="Mover después" ${idx === list.length - 1 ? 'disabled' : ''}>›</button>
      <span class="ci" style="background:${hexToRgba(a.color, .18)}">${a.icon}</span>
      <span style="min-width:0">
        ${escapeHtml(a.name)}
        <div class="tfreq">${nTx} movimiento${nTx === 1 ? '' : 's'}${(a.currency && a.currency !== baseCurrency()) ? ' · ' + a.currency : ''}</div>
      </span>
      <span class="ab ${bal < 0 ? 'neg' : ''}">${fmtCurrency(bal, a.currency)}</span>
      <button type="button" class="ce" title="Editar">✏️</button>
      <button type="button" class="cd" title="Eliminar">🗑</button>`;
    li.querySelector('.mv-up').addEventListener('click', () => moveAccount(a.id, -1));
    li.querySelector('.mv-down').addEventListener('click', () => moveAccount(a.id, 1));
    li.querySelector('.ce').addEventListener('click', () => {
      editingAccId = a.id;
      $('#acc-icon').value = a.icon;
      $('#acc-name').value = a.name;
      $('#acc-color').value = a.color;
      $('#acc-currency').value = a.currency || baseCurrency();
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
  updateTrAmountNote();
  setTimeout(() => $('#tr-amount').focus(), 60);
}

function updateTrAmountNote() {
  const note = $('#tr-amount-note');
  if (!note) return;
  const cur = accById($('#tr-from').value).currency || baseCurrency();
  if (cur === baseCurrency()) { note.hidden = true; return; }
  const r = rateOf(cur);
  const amt = parseFloat($('#tr-amount').value);
  note.hidden = false;
  note.textContent = `La transferencia se registra en ${cur} · ≈ ${isFinite(amt) && amt > 0 ? fmt(amt * r) : '…'} (tasa actual: 1 ${cur} = ${r} ${baseCurrency()})`;
}
$('#tr-amount').addEventListener('input', updateTrAmountNote);
$('#tr-from').addEventListener('change', updateTrAmountNote);

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
    const prev = state.transactions[idx];
    const srcCur = accById(from).currency || baseCurrency();
    if (prev && prev.currency === srcCur && Number(prev.rate) > 0) { data.currency = srcCur; data.rate = prev.rate; }
    else { data.currency = srcCur; data.rate = rateOf(srcCur); }
    if (idx >= 0) state.transactions[idx] = { ...state.transactions[idx], ...data };
    toast('Transferencia actualizada');
  } else {
    const srcCur = accById(from).currency || baseCurrency();
    data.currency = srcCur;
    data.rate = rateOf(srcCur);
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
      <span class="tx-amt ${entering ? 'in' : 'out'}">${entering ? '+' : '−'}${fmt(txBase(t))}</span>`;
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
/* ---------- Presupuestos con arrastre / rollover (1.4.0.0) ----------
   Si una categoría tiene `rollover` activado, lo no gastado de cada
   mes suma al presupuesto del siguiente (y lo excedido se descuenta).
   El arrastre se calcula desde el primer mes con movimientos de esa
   categoría (antes no hay datos de dónde acumular). */
function catSpentMonth(catId, monthKey) {
  let s = 0;
  state.transactions.forEach(t => {
    if (t.type === 'expense' && t.categoryId === catId && t.date.startsWith(monthKey)) s += txBase(t);
  });
  return s;
}

function catEffectiveBudget(cat, monthKey) {
  const base = Number(cat.budget) || 0;
  if (!cat.rollover) return { base, carry: 0, effective: base };
  // Mes más antiguo con datos de la categoría (límite inferior del arrastre)
  let start = monthKey;
  state.transactions.forEach(t => {
    if (t.type === 'expense' && t.categoryId === cat.id) {
      const k = t.date.slice(0, 7);
      if (k < start) start = k;
    }
  });
  const endIdx = Number(monthKey.slice(0, 4)) * 12 + (Number(monthKey.slice(5, 7)) - 1);
  let idx = Number(start.slice(0, 4)) * 12 + (Number(start.slice(5, 7)) - 1);
  let carry = 0, guard = 0;
  while (idx < endIdx && guard < 600) {
    const key = `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
    carry += base - catSpentMonth(cat.id, key);
    idx++; guard++;
  }
  return { base, carry, effective: Math.max(0, base + carry) };
}

/* Historial de cumplimiento de los últimos n meses (para el detalle) */
function catHistory(cat, endMonthKey, n = 6) {
  const y0 = Number(endMonthKey.slice(0, 4)), m0 = Number(endMonthKey.slice(5, 7));
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const idx = y0 * 12 + (m0 - 1) - i;
    const key = `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
    const eff = catEffectiveBudget(cat, key);
    const spent = catSpentMonth(cat.id, key);
    const pct = eff.effective > 0 ? (spent / eff.effective) * 100 : (spent > 0 ? 100 : 0);
    out.push({ key, spent, effective: eff.effective, pct, month: MONTH_SHORT[idx % 12] });
  }
  return out;
}

/* Categorías cuyo historial está desplegado en el panel (solo sesión) */
const cbHistOpen = new Set();

function renderCatBudgets() {
  const wrap = $('#budgets-list');
  const empty = $('#budgets-empty');
  if (!wrap) return;
  const monthKey = filters.month === 'all' ? currentMonth() : filters.month;
  $('#budgets-month').textContent = '· ' + monthLabel(monthKey);

  const rows = state.categories
    .filter(c => c.type !== 'income' && Number(c.budget) > 0)
    .map(c => {
      const spent = catSpentMonth(c.id, monthKey);
      const eff = catEffectiveBudget(c, monthKey);
      const pct = eff.effective > 0 ? (spent / eff.effective) * 100 : (spent > 0 ? 100 : 0);
      return { c, spent, eff, pct };
    })
    .sort((a, b) => b.pct - a.pct);

  wrap.innerHTML = '';
  empty.hidden = rows.length > 0;

  rows.forEach(({ c, spent, eff, pct }) => {
    const left = eff.effective - spent;
    const status = pct >= 100 ? 'over' : pct >= 75 ? 'warn' : '';
    const rollNote = c.rollover
      ? `<span class="cb-roll">↺ base ${fmt(eff.base)} · arrastre ${eff.carry >= 0 ? '+' : '−'}${fmt(Math.abs(eff.carry))}</span>`
      : '';
    const row = document.createElement('div');
    row.className = 'cb-row';
    row.innerHTML = `
      <span class="tx-ico cb-ico" style="background:${hexToRgba(c.color, .16)}">${c.icon}</span>
      <div class="cb-mid">
        <div class="cb-top">
          <span class="cb-name">${escapeHtml(c.name)}</span>
          <span class="cb-nums">${fmt(spent)} / ${fmt(eff.effective)}</span>
        </div>
        <div class="progress"><div class="progress-fill ${status}" style="width:${Math.min(100, pct)}%"></div></div>
        <div class="cb-status ${status}">${pct >= 100
          ? 'Excedido en ' + fmt(Math.abs(left))
          : 'Disponible ' + fmt(left) + ' · ' + Math.round(pct) + '% usado'}</div>
        ${rollNote}
        <div class="cb-actions">
          <button type="button" class="link-btn cb-btn-roll${c.rollover ? ' on' : ''}" data-roll="${c.id}"
            title="Lo no gastado suma al mes siguiente; lo excedido se descuenta">
            ↺ Arrastre: ${c.rollover ? 'activado' : 'desactivado'}</button>
          <button type="button" class="link-btn" data-hist="${c.id}">${cbHistOpen.has(c.id) ? 'Ocultar historial ▴' : 'Historial ▾'}</button>
        </div>
      </div>`;

    if (cbHistOpen.has(c.id)) {
      const hist = document.createElement('div');
      hist.className = 'cb-hist';
      catHistory(c, monthKey, 6).forEach(h => {
        const cls = h.pct >= 100 ? 'over' : h.pct >= 90 ? 'warn' : 'ok';
        const cell = document.createElement('div');
        cell.className = 'cb-hcell ' + cls;
        cell.title = `${h.month} ${h.key.slice(0, 4)}: ${fmt(h.spent)} de ${fmt(h.effective)} (${Math.round(h.pct)} %)`;
        cell.innerHTML = `<span class="cb-hm">${h.month}</span><b>${Math.round(h.pct)}%</b>`;
        hist.appendChild(cell);
      });
      row.querySelector('.cb-mid').appendChild(hist);
    }
    wrap.appendChild(row);
  });

  // Botones: activar/desactivar arrastre y desplegar historial
  wrap.querySelectorAll('[data-roll]').forEach(btn => btn.addEventListener('click', () => {
    const cat = state.categories.find(c => c.id === btn.dataset.roll);
    if (!cat) return;
    cat.rollover = !cat.rollover;
    save();
    renderCatBudgets();
    toast(cat.rollover
      ? `Arrastre activado en «${cat.name}»: lo no gastado suma al siguiente mes`
      : `Arrastre desactivado en «${cat.name}»`);
  }));
  wrap.querySelectorAll('[data-hist]').forEach(btn => btn.addEventListener('click', () => {
    const id = btn.dataset.hist;
    if (cbHistOpen.has(id)) cbHistOpen.delete(id); else cbHistOpen.add(id);
    renderCatBudgets();
  }));
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
        <span class="ta ${t.type === 'income' ? 'in' : 'out'}">${t.type === 'income' ? '+' : '−'}${fmtCurrency(t.amount, t.currency)}</span>
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
      <span class="chip-amt">${t.type === 'income' ? '+' : '−'}${fmtCurrency(t.amount, accById(t.accountId).currency)}</span>
      ${t.freq && t.freq !== 'none' ? '<span class="chip-freq">↻</span>' : ''}`;
    b.addEventListener('click', () => {
      const cur = accById(t.accountId).currency || baseCurrency();
      state.transactions.push({
        id: uid(), createdAt: Date.now(),
        type: t.type, amount: t.amount, categoryId: t.categoryId, accountId: t.accountId,
        currency: cur, rate: rateOf(cur),
        date: todayISO(), description: t.description,
      });
      save();
      renderAll();
      toast(`${t.type === 'income' ? 'Ingreso' : 'Gasto'} registrado: ${t.description} ${fmtCurrency(t.amount, cur)}`);
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
      const cur = accById(t.accountId).currency || baseCurrency();
      state.transactions.push({
        id: uid(), createdAt: Date.now(),
        type: t.type, amount: t.amount, categoryId: t.categoryId, accountId: t.accountId,
        currency: cur, rate: rateOf(cur),
        date: today, description: t.description + ' (auto)',
      });
      t.lastPosted = today;
      posted++;
    }
  });
  if (posted > 0) {
    save();
    if (notifyCfg().rec) {
      // Toast si la app está al frente; notificación del sistema si está al fondo
      systemNotify('Movimientos automáticos', `${posted} movimiento(s) frecuente(s) se registraron hoy.`);
    }
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
    ['fecha', 'tipo', 'categoria', 'cuenta', 'cuenta_destino', 'descripcion', 'monto', 'moneda', 'tasa_base', 'monto_base', 'etiquetas'].join(','),
    ...list.map(t => [
      t.date,
      typeLabel(t),
      t.type === 'transfer' ? '' : esc(catById(t.categoryId).name),
      esc(accById(t.accountId).name),
      t.type === 'transfer' ? esc(accById(t.toAccountId).name) : '',
      esc(t.description),
      (t.type === 'expense' ? '-' : '') + t.amount.toFixed(2),
      t.currency || baseCurrency(),
      Number(t.rate) > 0 ? Number(t.rate) : 1,
      txBase(t).toFixed(2),
      esc(Array.isArray(t.tags) ? t.tags.join(';') : ''),
    ].join(',')),
  ];
  download(`mis-cuentas-${todayISO()}.csv`, '﻿' + rows.join('\n'), 'text/csv');
  toast('CSV exportado');
});


/* =========================================================
   PARTE 1.6.0.0 — Importar movimientos desde CSV
   Parser propio (sin dependencias): comillas, comas internas,
   BOM, números con formato '1.234,56' o '1,234.56', fechas
   ISO o DD/MM/AAAA.
   ========================================================= */

function csvParse(text) {
  text = String(text).replace(/^﻿/, '');
  const rows = [];
  let row = [], cur = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(cur.trim()); cur = ''; }
    else if (ch === '\n') { row.push(cur.trim()); rows.push(row); row = []; cur = ''; }
    else if (ch !== '\r') cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur.trim()); rows.push(row); }
  return rows.filter(r => r.some(c => c !== ''));
}

const normText = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const CSV_COLS = {
  date: ['fecha', 'date'],
  amount: ['monto', 'amount', 'importe', 'valor', 'total'],
  type: ['tipo', 'type', 'movimiento'],
  desc: ['descripcion', 'description', 'desc', 'concepto', 'detalle', 'nota', 'notas'],
  cat: ['categoria', 'category', 'cat'],
  acc: ['cuenta', 'account'],
  cur: ['moneda', 'currency'],
  rate: ['tasa', 'rate', 'tipo_cambio', 'tc'],
  tags: ['etiquetas', 'tags', 'tag'],
};

function parseAmountClean(raw) {
  let v = String(raw || '').replace(/[$\s]/g, '');
  if (!v) return NaN;
  let neg = false;
  if (/^\(.*\)$/.test(v)) { neg = true; v = v.slice(1, -1); }
  if (v.includes('.') && v.includes(',')) v = v.replace(/\./g, '').replace(',', '.');
  else if (v.includes(',')) v = /,\d{1,2}$/.test(v) ? v.replace(',', '.') : v.replace(/,/g, '');
  const n = parseFloat(v);
  if (!isFinite(n)) return NaN;
  return neg ? -n : n;
}

function parseDateClean(raw) {
  const v = String(raw || '').trim();
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = v.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

function mapCsvType(raw, amount) {
  const v = normText(raw);
  if (/ingreso|income|abono|entrada|deposit/.test(v)) return 'income';
  if (/gasto|expense|egreso|salida|cargo|pago/.test(v)) return 'expense';
  return amount < 0 ? 'expense' : 'income';
}

let csvState = null; // {rows:[{date,type,amount,desc,catName,catId,accId,cur,rate,tags,dup}], dupes, invalid, includeDupes}

$('#btn-import-csv').addEventListener('click', () => {
  csvState = null;
  $('#csv-file').value = '';
  $('#csv-step2').hidden = true;
  $('#csv-import-go').disabled = true;
  $('#modal-csv').showModal();
});

function dupKey(date, amountAbs, desc) {
  return `${date}|${amountAbs.toFixed(2)}|${normText(desc)}`;
}

$('#csv-file').addEventListener('change', () => {
  const file = $('#csv-file').files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      buildCsvPreview(String(reader.result), file.name);
    } catch (err) {
      toast('No se pudo leer el archivo: ' + err.message);
    }
  };
  reader.readAsText(file);
});

function buildCsvPreview(text) {
  const rows = csvParse(text);
  if (rows.length < 2) {
    toast('El archivo está vacío o no tiene filas de datos');
    return;
  }
  const headers = rows[0].map(normText);
  const col = {};
  Object.entries(CSV_COLS).forEach(([key, names]) => {
    const idx = headers.findIndex(h => names.includes(h));
    if (idx >= 0) col[key] = idx;
  });
  if (col.date === undefined || col.amount === undefined) {
    toast('No encontré columnas de fecha y monto en el archivo');
    return;
  }

  // Cuenta por defecto (select)
  const normals = normalAccounts();
  $('#csv-account').innerHTML = normals.map(a => `<option value="${a.id}">${escapeHtml(a.name)}${a.currency && a.currency !== baseCurrency() ? ' (' + a.currency + ')' : ''}</option>`).join('');
  const defaultAcc = normals[0];
  $('#csv-account').value = defaultAcc ? defaultAcc.id : '';

  // Detección de duplicados contra movimientos existentes
  const existing = new Map();
  state.transactions.forEach(t => {
    if (t.type !== 'transfer') existing.set(dupKey(t.date, Math.abs(t.amount), t.description), true);
  });

  const defCat = state.categories.find(c => c.type === 'expense' || c.type === 'both') || state.categories[0];
  const parsed = [];
  let invalid = 0, dupes = 0;
  rows.slice(1).forEach(r => {
    const get = (k) => col[k] !== undefined ? r[col[k]] : '';
    const date = parseDateClean(get('date'));
    const amountRaw = parseAmountClean(get('amount'));
    const desc = String(get('desc') || '').trim() || 'Importado';
    if (!date || !isFinite(amountRaw) || amountRaw === 0) { invalid++; return; }
    const type = col.type !== undefined ? mapCsvType(get('type'), amountRaw) : (amountRaw < 0 ? 'expense' : 'income');
    const amount = Math.round(Math.abs(amountRaw) * 100) / 100;

    // Categoría: por nombre; si no existe o falta, la categoría por defecto
    let catId = defCat ? defCat.id : null;
    let catDefault = !get('cat');
    if (get('cat')) {
      const found = state.categories.find(c => normText(c.name) === normText(get('cat')));
      if (found) { catId = found.id; catDefault = false; }
    }
    // Cuenta: por nombre; si no, la elegida en el select
    let accId = $('#csv-account').value;
    let accFromFile = false;
    if (get('acc')) {
      const foundA = state.accounts.find(a => !a.hidden && normText(a.name) === normText(get('acc')));
      if (foundA) { accId = foundA.id; accFromFile = true; }
    }
    const acc = accById(accId);
    let cur = String(get('cur') || '').trim().toUpperCase() || acc.currency || baseCurrency();
    if (!CURRENCIES.includes(cur)) cur = acc.currency || baseCurrency();
    let rate = parseAmountClean(get('rate'));
    rate = isFinite(rate) && rate > 0 ? rate : rateOf(cur);

    const tags = String(get('tags') || '').split(/[;,]/).map(t => t.trim().toLowerCase()).filter(Boolean);
    const dup = existing.has(dupKey(date, amount, desc)) || parsed.some(p => dupKey(p.date, p.amount, p.desc) === dupKey(date, amount, desc));
    if (dup) dupes++;
    parsed.push({ date, type, amount, desc, catId, catDefault, accId, accFromFile, cur, rate, tags, dup });
  });

  csvState = { rows: parsed, dupes, invalid, catDefaults: parsed.filter(p => p.catDefault).length, includeDupes: false };
  renderCsvPreview();
}

function renderCsvPreview() {
  if (!csvState) return;
  const { rows, dupes, invalid, catDefaults, includeDupes } = csvState;
  const importables = rows.filter(r => !r.dup || includeDupes).length;
  $('#csv-summary').innerHTML =
    `<b>${rows.length}</b> fila(s) válidas · <b>${importables}</b> se importarán` +
    (dupes ? ` · <span class="csv-dup-cell">${dupes} posible(s) duplicado(s)</span>` : '') +
    (invalid ? ` · ${invalid} omitida(s) por fecha/monto inválido` : '') +
    (catDefaults ? ` · ${catDefaults} usarán la categoría por defecto` : '');

  $('#csv-dupes-row').hidden = dupes === 0;
  $('#csv-dupes-label').textContent = `${dupes} posible(s) duplicado(s) detectado(s)`;
  $('#csv-dupes-toggle').textContent = includeDupes ? 'Excluir duplicados' : 'Incluir duplicados';

  const tbl = $('#csv-preview');
  const head = `<thead><tr><th>Fecha</th><th>Tipo</th><th>Monto</th><th>Categoría</th><th>Descripción</th><th>Etiquetas</th><th></th></tr></thead>`;
  const body = rows.slice(0, 8).map(r => `<tr>
    <td>${r.date}</td>
    <td>${r.type === 'income' ? 'ingreso' : 'gasto'}</td>
    <td>${fmtCurrency(r.amount, r.cur)}</td>
    <td>${escapeHtml(r.catId ? catById(r.catId).name : '—')}${r.catDefault ? ' *' : ''}</td>
    <td>${escapeHtml(r.desc.slice(0, 40))}</td>
    <td>${r.tags.map(t => '#' + escapeHtml(t)).join(' ')}</td>
    <td>${r.dup ? '<span class="csv-dup-cell" title="Ya existe un movimiento igual (fecha, monto y descripción)">dup</span>' : ''}</td>
  </tr>`).join('');
  tbl.innerHTML = head + `<tbody>${body}</tbody>`;

  $('#csv-step2').hidden = false;
  $('#csv-import-go').disabled = importables === 0;
  $('#csv-import-go').textContent = `Importar ${importables} movimiento${importables === 1 ? '' : 's'}`;
}

$('#csv-account').addEventListener('change', () => {
  if (!csvState) return;
  csvState.rows.forEach(r => { if (!r.accFromFile) r.accId = $('#csv-account').value; });
  renderCsvPreview();
});

$('#csv-dupes-toggle').addEventListener('click', () => {
  if (!csvState) return;
  csvState.includeDupes = !csvState.includeDupes;
  renderCsvPreview();
});

$('#csv-import-go').addEventListener('click', () => {
  if (!csvState) return;
  const { rows, includeDupes } = csvState;
  const toImport = rows.filter(r => !r.dup || includeDupes);
  if (!toImport.length) return;
  const base = Date.now();
  toImport.forEach((r, i) => {
    state.transactions.push({
      id: uid(), createdAt: base + i,
      type: r.type, amount: r.amount, categoryId: r.catId, accountId: r.accId,
      currency: r.cur, rate: r.rate,
      date: r.date, description: r.desc,
      tags: r.tags,
    });
  });
  save();
  renderAll();
  $('#modal-csv').close();
  toast(`${toImport.length} movimiento(s) importado(s)${csvState.dupes && !includeDupes ? ` · ${csvState.dupes} duplicado(s) omitido(s)` : ''}`);
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
        debts: Array.isArray(data.debts) ? data.debts.filter(d => d && d.id && d.person && d.amount > 0) : [],
        savedFilters: Array.isArray(data.savedFilters) ? data.savedFilters.filter(f => f && f.id && f.name && f.f) : [],
        settings: { ...base.settings, ...(data.settings || {}) },
      });
      save();
      applyTheme();
      if (typeof applyAccent === 'function') applyAccent();
      if (typeof applyPanelLayout === 'function') applyPanelLayout(); // 1.14.0.0
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
  if (typeof applyAccent === 'function') applyAccent(); // 1.8.0.0
  renderFlow();
  renderDonut();
  renderMonths();
});

/* ---------- Filtros: eventos ---------- */
$('#f-search').addEventListener('input', (e) => { filters.q = e.target.value; renderSummary(); renderDonut(); renderList(); });
$('#f-type').addEventListener('change', (e) => { filters.type = e.target.value; renderSummary(); renderDonut(); renderList(); });
$('#f-category').addEventListener('change', (e) => { filters.category = e.target.value; renderSummary(); renderDonut(); renderList(); });
$('#f-tag').addEventListener('change', (e) => { filters.tag = e.target.value; refreshFilteredViews(); });
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
  filters.q = ''; filters.type = 'all'; filters.category = 'all'; filters.account = 'all'; filters.month = currentMonth(); filters.tag = 'all';
  $('#f-search').value = ''; $('#f-type').value = 'all'; $('#f-category').value = 'all'; $('#f-month').value = currentMonth(); $('#f-tag').value = 'all';
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
  /* 1.14.0.1 · hay que distinguir: si YA existía un controlador al
     arrancar, el cambio significa una ACTUALIZACIÓN real (recargar para
     no mezclar versiones); si no existía, es la primera instalación del
     SW (no recargar, cortaría la interacción del usuario nuevo). */
  const _hadSwController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch(() => {});
  let _swReload = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (_swReload || !_hadSwController) return;
    _swReload = true;
    try { toast('Nueva versión instalada · recargando…'); } catch {}
    setTimeout(() => location.reload(), 600);
  });
}

/* ---------- Instalación como app (PWA) ---------- */
let installPrompt = null;
const btnInstall = $('#btn-install');

function runningAsApp() {
  return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
}
function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

if (!runningAsApp() && isIOS()) {
  btnInstall.hidden = false; // iOS no dispara beforeinstallprompt: muestra instrucciones
}

// Android/Chrome/Edge: el navegador avisa cuando la app es instalable
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  btnInstall.hidden = false;
});

btnInstall.addEventListener('click', async () => {
  if (installPrompt) {
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice.catch(() => ({ outcome: 'dismissed' }));
    if (outcome === 'accepted') {
      btnInstall.hidden = true;
      toast('Instalando Mis Cuentas…');
    }
    installPrompt = null;
  } else {
    $('#modal-install').showModal(); // iOS o instalación manual
  }
});

window.addEventListener('appinstalled', () => {
  btnInstall.hidden = true;
  installPrompt = null;
  toast('App instalada');
});

/* Guardado extra al cerrar/recargar o al mandar la app al fondo
   (cubre navegadores móviles que pueden interrumpir en cualquier punto). */
function flushSave() {
  try {
    storage.set(LS_KEY, JSON.stringify(state));
  } catch { /* sin almacenamiento disponible */ }
}
window.addEventListener('pagehide', flushSave);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    flushSave();
    if (typeof autoBackup === 'function') autoBackup(); // 1.12.0.0 · respaldo en segundo plano
  }
});

/* ---------- Inicio ---------- */
(function init() {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches && !storage.get(LS_KEY)) {
    state.settings.theme = 'dark';
    save();
  }
  applyTheme();
  applyAccent(); // 1.8.0.0
  if (typeof applyPanelLayout === 'function') applyPanelLayout(); // 1.14.0.0
  $('#f-month').value = currentMonth();
  renderLockSection();
  runRecurring();
  renderAll();
  tickDailyReminder();
  if (state.settings.lock) showLock();
  consumeQuickParam(); // 1.10.0.0 · atajo ?quick= (si hay bloqueo, corre al desbloquear)
  if (isUnlocked && typeof triggerWeekly === 'function') triggerWeekly(); // 1.11.0.0
  if (typeof warnStaleBackup === 'function') warnStaleBackup(); // 1.12.0.0
  if (!storage.ok) {
    setTimeout(() => toast('Este visor no permite guardar datos; se perderán al cerrar'), 600);
  }
})();
