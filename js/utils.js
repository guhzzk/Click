/* ==========================================================
   Utilitários compartilhados
   ========================================================== */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brlShort = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', ','));
const pad = (n) => String(n).padStart(2, '0');

const WEEK = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const WEEK_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MONTH_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Escapa texto digitado pelo usuário antes de colocar em HTML */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Todos os itens (serviços + produtos) por id */
const ALL_ITEMS = {};
Object.entries(SERVICES).forEach(([cat, list]) => list.forEach((s) => (ALL_ITEMS[s.id] = { ...s, type: 'servico', cat })));
PRODUCTS.forEach((p) => (ALL_ITEMS[p.id] = { ...p, type: 'produto' }));

/* ---------- Datas no fuso da barbearia ---------- */

/** Data/hora atual no fuso da barbearia */
function nowLocal() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CONFIG.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  const y = +get('year'), m = +get('month'), d = +get('day');
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { y, m, d, dow, minutes: +get('hour') * 60 + +get('minute'), iso: `${y}-${pad(m)}-${pad(d)}` };
}

/** Soma dias numa data ISO (sem depender do fuso do aparelho) */
function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return { iso: dt.toISOString().slice(0, 10), dow: dt.getUTCDay(), d: dt.getUTCDate(), m: dt.getUTCMonth() };
}

function formatDateLong(iso) {
  const { dow, d, m } = addDays(iso, 0);
  return `${WEEK[dow]}, ${pad(d)}/${pad(m + 1)}`;
}

const toMinutes = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const toHHMM = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

/** Horário já passou (considerando a antecedência mínima)? */
function isPastSlot(iso, minutes) {
  const now = nowLocal();
  if (iso < now.iso) return true;
  return iso === now.iso && minutes <= now.minutes + CONFIG.minAdvanceMinutes;
}

/** Lista de horários (em minutos) de um dia de funcionamento */
function daySlots(iso) {
  const h = CONFIG.hours[addDays(iso, 0).dow];
  if (!h) return [];
  const out = [];
  for (let m = h[0] * 60; m <= h[1] * 60 - CONFIG.slotMinutes; m += CONFIG.slotMinutes) out.push(m);
  return out;
}

/* ---------- WhatsApp, toast e armazenamento ---------- */

function whatsUrl(text, phone = CONFIG.whatsapp) {
  let num = String(phone || '').replace(/\D/g, '');
  if (num && num.length <= 11) num = '55' + num; // número brasileiro sem DDI
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('is-show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('is-show'), 2400);
}

/** Lê (1 argumento) ou grava (2 argumentos) JSON no localStorage */
function store(key, val) {
  try {
    if (val === undefined) return JSON.parse(localStorage.getItem(key));
    if (val === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(val));
  } catch (e) { return null; }
  return val;
}

/** Máscara (41) 99999-9999 */
function maskPhone(input) {
  input.addEventListener('input', () => {
    let v = input.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 6) v = `(${v.slice(0, 2)}) ${v.slice(2, v.length - 4)}-${v.slice(-4)}`;
    else if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
    input.value = v;
  });
}

/* ---------- Modais ---------- */
const MODAL_MS = 450; // duração da animação de abrir/fechar (igual ao CSS)

function openModal(el) {
  clearTimeout(el._closeT);
  el.classList.remove('is-closing');
  el.hidden = false;
  document.body.classList.add('no-scroll');
  const focusable = el.querySelector('input, button:not([data-close])');
  if (focusable) setTimeout(() => focusable.focus({ preventScroll: true }), 60);
}

function closeModal(el) {
  if (el.hidden) return;
  const finish = () => {
    el.hidden = true;
    el.classList.remove('is-closing');
    if (!$$('.modal, .lightbox, .panel').some((m) => !m.hidden)) document.body.classList.remove('no-scroll');
  };
  if (reduceMotion()) return finish();
  el.classList.add('is-closing');
  clearTimeout(el._closeT);
  el._closeT = setTimeout(finish, MODAL_MS);
}
