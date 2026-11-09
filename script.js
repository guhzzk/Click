/* ==========================================================
   Corteza Barbearia — interações do site
   ========================================================== */

/* ----------------------------------------------------------
   CONFIGURAÇÃO — edite aqui antes de publicar
   ---------------------------------------------------------- */
const CONFIG = {
  // Número do WhatsApp com DDI + DDD, só números. Ex.: '5521987654321'
  // Enquanto estiver vazio, o WhatsApp abre para escolher o contato.
  whatsapp: '',
  // Chave Pix da barbearia (CPF, CNPJ, e-mail, telefone +55... ou chave aleatória).
  // Enquanto estiver vazia, o Pix funciona em modo demonstração.
  pixKey: '',
  pixName: 'CORTEZA BARBEARIA', // até 25 caracteres, sem acento
  pixCity: 'RIO DE JANEIRO',    // até 15 caracteres, sem acento
  barber: 'Guilherme',
  timezone: 'America/Sao_Paulo',
  slotMinutes: 30,
  bookingDays: 21,
  // Dia da semana (0 = domingo) -> [abre, fecha] em horas
  hours: { 2: [10, 20], 3: [10, 20], 4: [10, 20], 5: [10, 20], 6: [9, 20] },
};

/* ----------------------------------------------------------
   DADOS
   price: null => "sob consulta"
   ---------------------------------------------------------- */
const IMG = 'images/barbearia/';
const SERVICES = {
  avulsos: [
    { id: 'corte', name: 'Corte', price: 40, art: IMG + 'servicos/corte-avulso.webp' },
    { id: 'barba', name: 'Barba', price: 35, art: IMG + 'servicos/barba-avulso.webp' },
    { id: 'sobrancelha', name: 'Sobrancelha', price: 15, art: IMG + 'servicos/sobrancelha-avulso.webp' },
    { id: 'cavanhaque', name: 'Cavanhaque', price: null },
    { id: 'hidratacao', name: 'Hidratação', price: null },
    { id: 'limpeza', name: 'Limpeza de pele', price: null },
    { id: 'ozonio', name: 'Hidratação com ozonioterapia', price: null },
    { id: 'depilacao', name: 'Depilação com cera — nariz e orelhas', price: null },
    { id: 'pintura', name: 'Pintura', price: null },
  ],
  combos: [
    { id: 'c-corte-sobrancelha', name: 'Corte + Sobrancelha', price: 55, art: IMG + 'servicos/combo-corte-sobrancelha.webp' },
    { id: 'c-corte-barba', name: 'Corte + Barba', price: 75, art: IMG + 'servicos/combo-corte-barba.webp' },
    { id: 'c-barba-sobrancelha', name: 'Barba + Sobrancelha', price: 50, art: IMG + 'servicos/combo-barba-sobrancelha.webp' },
    { id: 'c-completo', name: 'Corte + Barba + Sobrancelha', price: 90, art: IMG + 'servicos/combo-corte-barba-sobrancelha.webp' },
  ],
  quimicas: [
    { id: 'nevou', name: 'Nevou', price: null },
  ],
};
const TAB_LABEL = { avulsos: 'Avulso', combos: 'Combo', quimicas: 'Química' };

const PLANS = {
  one: [
    { id: 'one-corte', what: 'Corte', price: 79.90, desc: 'Plano para manter o visual em dia.', art: IMG + 'planos/plano-corte.webp' },
    { id: 'one-corte-sob', what: 'Corte + Sobrancelha', price: 99.90, desc: 'Plano para corte com acabamento mais completo.', art: IMG + 'planos/plano-corte-sobrancelha.webp' },
    { id: 'one-corte-barba', what: 'Corte + Barba', price: 129.90, desc: 'Plano para manter cabelo e barba alinhados.', art: IMG + 'planos/plano-corte-barba.webp' },
    { id: 'one-completo', what: 'Corte + Barba + Sobrancelha', price: 159.90, desc: 'Plano completo para quem quer cuidado total.', art: IMG + 'planos/plano-corte-barba-sobrancelha.webp' },
  ],
  black: [
    { id: 'black-corte', what: 'Somente corte', price: null, desc: 'Ilimitado* no corte.' },
    { id: 'black-corte-sob', what: 'Corte & Sobrancelha', price: null, desc: 'Ilimitado* em corte e sobrancelha.' },
    { id: 'black-corte-barba', what: 'Corte & Barba', price: null, desc: 'Ilimitado* em corte e barba.' },
    { id: 'black-completo', what: 'Corte & Barba & Sobrancelha', price: null, desc: 'O pacote completo do Club Black.' },
  ],
  outros: [
    { id: 'club-2x', club: 'CLUB 2X', what: 'Somente corte', price: null, desc: 'Dois cortes garantidos no plano.' },
    { id: 'anual', club: 'ANUAL', what: 'Plano anual', price: null, desc: 'Seu visual garantido o ano inteiro.' },
  ],
};
const PLAN_META = {
  one: { club: 'clubcorteza', name: 'ONE', meta: 'Ilimitado* · Seg e Ter' },
  black: { club: 'clubcorteza', name: 'BLACK', meta: 'Ilimitado*' },
  outros: { club: 'clubcorteza', name: '', meta: 'Consulte condições' },
};

const PRODUCTS = [
  { id: 'p-oleo', name: 'Óleo para barba', sub: 'Nutre e finaliza', price: 55, img: IMG + 'oleo-para-barba.webp', desc: 'Ajuda a nutrir os fios, reduzir o ressecamento e dar acabamento à barba.' },
  { id: 'p-balm', name: 'Balm para barba', sub: 'Hidrata e alinha', price: 60, img: IMG + 'balm-para-barba.webp', desc: 'Ajuda a hidratar, amaciar e alinhar a barba no cuidado do dia a dia.' },
  { id: 'p-brilho', name: 'Cera brilho', sub: 'Efeito molhado', price: 65, img: IMG + 'cera-brilho.webp', desc: 'Ajuda a alinhar o penteado com definição e acabamento brilhante.' },
  { id: 'p-matte', name: 'Cera matte', sub: 'Efeito seco', price: 65, img: IMG + 'cera-matte.webp', desc: 'Modela com firmeza e mantém o penteado com acabamento seco e natural.' },
];

/* ----------------------------------------------------------
   UTILITÁRIOS
   ---------------------------------------------------------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brlShort = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', ','));
const pad = (n) => String(n).padStart(2, '0');
const WEEK = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const WEEK_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MONTH_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const ALL_ITEMS = {};
Object.entries(SERVICES).forEach(([cat, list]) => list.forEach((s) => (ALL_ITEMS[s.id] = { ...s, type: 'servico', cat })));
PRODUCTS.forEach((p) => (ALL_ITEMS[p.id] = { ...p, type: 'produto' }));

/** Data/hora atual no fuso da barbearia */
function nowLocal() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CONFIG.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
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
function whatsUrl(text) {
  const num = CONFIG.whatsapp.replace(/\D/g, '');
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('is-show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('is-show'), 2400);
}
function store(key, val) {
  try {
    if (val === undefined) return JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) { return null; }
}

/* ----------------------------------------------------------
   ESTADO
   ---------------------------------------------------------- */
const state = {
  cart: new Set(),
  date: null,
  time: null,
  step: 1,
};

/* ----------------------------------------------------------
   MENU MOBILE
   ---------------------------------------------------------- */
function initMenu() {
  const burger = $('#burger'), nav = $('#nav');
  const close = () => { nav.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; };
  burger.addEventListener('click', () => {
    const open = !nav.classList.contains('is-open');
    nav.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  });
  $$('a', nav).forEach((a) => a.addEventListener('click', close));
}

/* ----------------------------------------------------------
   STATUS ABERTO / FECHADO + TABELA DE HORÁRIOS
   ---------------------------------------------------------- */
function initStatus() {
  const el = $('#openStatus');
  const update = () => {
    const now = nowLocal();
    const today = CONFIG.hours[now.dow];
    el.classList.remove('is-open', 'is-closed');
    let text;
    if (today && now.minutes >= today[0] * 60 && now.minutes < today[1] * 60) {
      el.classList.add('is-open');
      text = `Aberto agora · fecha às ${today[1]}h`;
    } else {
      el.classList.add('is-closed');
      if (today && now.minutes < today[0] * 60) {
        text = `Fechado · abre hoje às ${today[0]}h`;
      } else {
        let i = 1;
        while (!CONFIG.hours[(now.dow + i) % 7]) i++;
        const nd = (now.dow + i) % 7;
        text = `Fechado · abre ${i === 1 ? 'amanhã' : WEEK[nd]} às ${CONFIG.hours[nd][0]}h`;
      }
    }
    $('b', el).textContent = text;
  };
  update();
  setInterval(update, 60000);

  const tbody = $('#hoursTable tbody');
  const now = nowLocal();
  [2, 3, 4, 5, 6, 0, 1].forEach((d) => {
    const h = CONFIG.hours[d];
    const tr = document.createElement('tr');
    if (d === now.dow) tr.classList.add('is-today');
    if (!h) tr.classList.add('is-closed');
    tr.innerHTML = `<td>${WEEK[d][0].toUpperCase() + WEEK[d].slice(1)}${d === now.dow ? ' · hoje' : ''}</td><td>${h ? `${h[0]}h às ${h[1]}h` : 'Fechado'}</td>`;
    tbody.appendChild(tr);
  });
}

/* ----------------------------------------------------------
   SERVIÇOS
   ---------------------------------------------------------- */
function renderServices(tab = 'avulsos') {
  const grid = $('#servicesGrid');
  grid.innerHTML = SERVICES[tab].map((s, i) => `
    <article class="service ${state.cart.has(s.id) ? 'is-selected' : ''}" data-id="${s.id}" style="animation-delay:${i * 40}ms">
      <span class="service__tag">${TAB_LABEL[tab]}</span>
      <h3 class="service__name">${s.name}</h3>
      ${s.art ? `<button class="service__art" data-art="${s.art}" data-alt="${s.name}">ver arte</button>` : ''}
      <div class="service__foot">
        ${s.price != null ? `<span class="price"><small>R$</small>${brlShort(s.price)}</span>` : '<span class="price price--ask">Sob consulta</span>'}
        <button class="add-btn" data-toggle="${s.id}">${state.cart.has(s.id) ? '✓ Adicionado' : '+ Adicionar'}</button>
      </div>
    </article>`).join('');
}
function initServices() {
  renderServices();
  $$('.tab').forEach((t) => t.addEventListener('click', () => {
    $$('.tab').forEach((x) => { x.classList.toggle('is-active', x === t); x.setAttribute('aria-selected', String(x === t)); });
    renderServices(t.dataset.tab);
  }));
}

/* ----------------------------------------------------------
   PLANOS
   ---------------------------------------------------------- */
function renderPlans(kind = 'one') {
  const meta = PLAN_META[kind];
  $('#plansGrid').innerHTML = PLANS[kind].map((p, i) => `
    <article class="plan plan--${kind}" style="animation-delay:${i * 50}ms">
      ${p.badge ? `<span class="plan__badge">${p.badge}</span>` : ''}
      <div class="plan__top">
        <div class="plan__club">${meta.club}</div>
        <div class="plan__name">${p.club || meta.name}</div>
        <div class="plan__meta">${meta.meta}</div>
      </div>
      <div class="plan__body">
        <div class="plan__what">${p.what}</div>
        <p class="plan__desc">${p.desc}</p>
        ${p.price != null
          ? `<div class="plan__price"><small>R$</small>${brlShort(p.price)}</div>`
          : '<div class="plan__price plan__price--ask">Valor sob consulta</div>'}
        <div class="plan__actions">
          ${p.price != null ? `<button class="btn btn--green" data-plan-pix="${p.id}" data-kind="${kind}">Assinar com Pix</button>` : ''}
          <button class="btn btn--outline" data-plan-whats="${p.id}" data-kind="${kind}">${p.price != null ? 'Tirar dúvidas' : 'Quero saber mais'}</button>
          ${p.art ? `<button class="plan__art" data-art="${p.art}" data-alt="Plano ${p.what}">ver arte do plano</button>` : ''}
        </div>
      </div>
    </article>`).join('');
}
function planLabel(kind, p) {
  return `${p.club || 'Club ' + PLAN_META[kind].name} — ${p.what}`;
}
function initPlans() {
  renderPlans();
  $$('.club-tab').forEach((t) => t.addEventListener('click', () => {
    $$('.club-tab').forEach((x) => x.classList.toggle('is-active', x === t));
    renderPlans(t.dataset.club);
  }));
  $('#plansGrid').addEventListener('click', (e) => {
    const w = e.target.closest('[data-plan-whats]');
    const p = e.target.closest('[data-plan-pix]');
    if (w) {
      const plan = PLANS[w.dataset.kind].find((x) => x.id === w.dataset.planWhats);
      window.open(whatsUrl(`Olá! Vim pelo site e quero saber mais sobre o plano *${planLabel(w.dataset.kind, plan)}* da Corteza. 💈`), '_blank');
    }
    if (p) {
      const plan = PLANS[p.dataset.kind].find((x) => x.id === p.dataset.planPix);
      const label = planLabel(p.dataset.kind, plan);
      openPix(plan.price, `Assinatura ${label}`, () => {
        window.open(whatsUrl(`Olá! Acabei de pagar via Pix a assinatura do plano *${label}* (${brl(plan.price)}) pelo site. Segue o comprovante. 💈`), '_blank');
      });
    }
  });
}

/* ----------------------------------------------------------
   PRODUTOS
   ---------------------------------------------------------- */
function renderProducts() {
  $('#productsGrid').innerHTML = PRODUCTS.map((p) => `
    <article class="product ${state.cart.has(p.id) ? 'is-selected' : ''}" data-id="${p.id}">
      <div class="product__img" data-art="${p.img}" data-alt="${p.name}">
        <img src="${p.img}" alt="${p.name} El Guapo" loading="lazy" width="400" height="400">
      </div>
      <div class="product__body">
        <span class="product__sub">${p.sub}</span>
        <h3 class="product__name">${p.name}</h3>
        <p class="product__desc">${p.desc}</p>
        <div class="product__foot">
          <span class="product__price">${brl(p.price)}</span>
          <button class="add-btn" data-toggle="${p.id}">${state.cart.has(p.id) ? '✓ Reservado' : '+ Reservar'}</button>
        </div>
      </div>
    </article>`).join('');
}

/* ----------------------------------------------------------
   CARRINHO (serviços + produtos)
   ---------------------------------------------------------- */
function toggleItem(id) {
  if (state.cart.has(id)) state.cart.delete(id);
  else {
    state.cart.add(id);
    const it = ALL_ITEMS[id];
    toast(`${it.name} ${it.type === 'produto' ? 'reservado' : 'adicionado'} ✓`);
  }
  syncCart();
}
function cartTotals() {
  const items = [...state.cart].map((id) => ALL_ITEMS[id]);
  const total = items.reduce((s, i) => s + (i.price || 0), 0);
  const ask = items.some((i) => i.price == null);
  return { items, total, ask };
}
function syncCart() {
  const activeTab = $('.tab.is-active').dataset.tab;
  renderServices(activeTab);
  renderProducts();
  renderPicker();
  renderSummary();

  const { items, total, ask } = cartTotals();
  const bar = $('#cartbar');
  const inBooking = isBookingVisible();
  bar.hidden = items.length === 0 || inBooking;
  document.body.classList.toggle('has-cart', !bar.hidden);
  $('#cartCount').textContent = `${items.length} ${items.length === 1 ? 'item' : 'itens'}`;
  $('#cartTotal').textContent = total ? `${brl(total)}${ask ? ' + consulta' : ''}` : 'Valor sob consulta';
}
let bookingVisible = false;
function isBookingVisible() { return bookingVisible; }
function initCart() {
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-toggle]');
    if (t) toggleItem(t.dataset.toggle);
  });
  const obs = new IntersectionObserver(([en]) => { bookingVisible = en.isIntersecting; syncCart(); }, { threshold: 0.15 });
  obs.observe($('#agendar'));
}

/* ----------------------------------------------------------
   AGENDAMENTO
   ---------------------------------------------------------- */
function renderPicker() {
  const groups = [
    ['Combos', SERVICES.combos],
    ['Avulsos', SERVICES.avulsos],
    ['Químicas', SERVICES.quimicas],
    ['Produtos para retirar', PRODUCTS],
  ];
  $('#servicePicker').innerHTML = groups.map(([title, list]) => `
    <div class="picker__group">
      <h4>${title}</h4>
      <div class="chips">
        ${list.map((s) => `<button class="chip ${state.cart.has(s.id) ? 'is-on' : ''}" data-toggle="${s.id}">${s.name}<small>${s.price != null ? 'R$ ' + brlShort(s.price) : 'consulta'}</small></button>`).join('')}
      </div>
    </div>`).join('');
}

function renderDays() {
  const now = nowLocal();
  const days = [];
  for (let i = 0; days.length < CONFIG.bookingDays && i < 60; i++) {
    const d = addDays(now.iso, i);
    const h = CONFIG.hours[d.dow];
    if (!h) continue;
    // Se hoje já passou do último horário, pula
    if (i === 0 && now.minutes + MIN_ADVANCE >= h[1] * 60 - CONFIG.slotMinutes) continue;
    days.push({ ...d, today: i === 0, tomorrow: i === 1 });
  }
  $('#daysList').innerHTML = days.map((d) => `
    <button class="day ${state.date === d.iso ? 'is-on' : ''}" data-day="${d.iso}">
      <span>${d.today ? 'hoje' : d.tomorrow ? 'amanhã' : WEEK_SHORT[d.dow]}</span>
      <b>${pad(d.d)}</b>
      <span>${MONTH_SHORT[d.m]}</span>
    </button>`).join('');
}
/** Minutos mínimos de antecedência para agendar no mesmo dia */
const MIN_ADVANCE = 15;
function isPastSlot(iso, minutes) {
  const now = nowLocal();
  if (iso < now.iso) return true;
  return iso === now.iso && minutes <= now.minutes + MIN_ADVANCE;
}
const toMinutes = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

function renderSlots() {
  const box = $('#slotsList');
  if (!state.date) { box.innerHTML = '<p class="muted">Selecione um dia primeiro.</p>'; return; }
  // Se o horário escolhido já passou (ex.: página aberta há muito tempo), limpa a escolha
  if (state.time && isPastSlot(state.date, toMinutes(state.time))) {
    state.time = null;
    toast('O horário escolhido já passou. Escolha outro.');
  }
  const { dow } = addDays(state.date, 0);
  const [open, close] = CONFIG.hours[dow];
  let html = '';
  for (let m = open * 60; m <= close * 60 - CONFIG.slotMinutes; m += CONFIG.slotMinutes) {
    if (isPastSlot(state.date, m)) continue; // horários que já passaram não aparecem
    const label = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
    html += `<button class="slot ${state.time === label ? 'is-on' : ''}" data-slot="${label}">${label}</button>`;
  }
  box.innerHTML = html || '<p class="muted">Não há mais horários livres hoje. Escolha outro dia.</p>';
}

function renderSummary() {
  const box = $('#summary');
  if (!box) return;
  const { items, total, ask } = cartTotals();
  const pay = $('input[name="pay"]:checked')?.value;
  const rows = items.map((i) => `<div class="summary__row"><span>${i.name}${i.type === 'produto' ? ' <em class="muted">(produto)</em>' : ''}</span><span>${i.price != null ? brl(i.price) : 'consulta'}</span></div>`).join('');
  box.innerHTML = `
    <h4>Resumo</h4>
    ${rows || '<p class="muted">Nenhum serviço selecionado.</p>'}
    <div class="summary__row"><span>Data</span><span>${state.date ? formatDateLong(state.date) : '—'}</span></div>
    <div class="summary__row"><span>Horário</span><span>${state.time || '—'}</span></div>
    <div class="summary__row"><span>Barbeiro</span><span>${CONFIG.barber}</span></div>
    <div class="summary__row summary__total"><span>Total</span><span>${total ? brl(total) : '—'}${ask ? ' + itens sob consulta' : ''}</span></div>
    ${pay === 'pix' && ask ? '<p class="summary__note">No Pix você paga agora os itens com preço; os itens sob consulta são acertados na barbearia.</p>' : ''}`;

  // Pix só faz sentido se houver valor
  const pixInput = $('input[name="pay"][value="pix"]');
  if (pixInput) {
    pixInput.disabled = total === 0;
    pixInput.closest('.payopt').style.opacity = total === 0 ? '.45' : '';
    if (total === 0 && pixInput.checked) {
      $('input[name="pay"][value="local"]').checked = true;
      state.pixAutoOff = true; // desmarcado automaticamente, não pelo cliente
    } else if (total > 0 && state.pixAutoOff) {
      pixInput.checked = true;
      state.pixAutoOff = false;
    }
  }
}

function goStep(n) {
  state.step = n;
  $$('.step').forEach((s) => s.classList.toggle('is-active', s.dataset.step === String(n)));
  $$('[data-step-dot]').forEach((d) => {
    const k = +d.dataset.stepDot;
    d.classList.toggle('is-active', k === n);
    d.classList.toggle('is-done', n === 'done' || k < n);
  });
  if (n === 2) { renderDays(); renderSlots(); }
  if (n === 4) renderSummary();
  const top = $('#booking').getBoundingClientRect().top + window.scrollY - 90;
  if (Math.abs(window.scrollY - top) > 200) window.scrollTo({ top, behavior: 'smooth' });
}

function validate(step) {
  if (step === 1 && state.cart.size === 0) { toast('Escolha pelo menos um serviço'); return false; }
  if (step === 1 && ![...state.cart].some((id) => ALL_ITEMS[id].type === 'servico')) { toast('Adicione um serviço para agendar'); return false; }
  if (step === 2 && !state.date) { toast('Escolha o dia'); return false; }
  if (step === 2 && !state.time) { toast('Escolha o horário'); return false; }
  if (step === 2 && isPastSlot(state.date, toMinutes(state.time))) {
    state.time = null;
    renderSlots();
    toast('Esse horário já passou. Escolha outro.');
    goStep(2);
    return false;
  }
  if (step === 3) {
    const name = $('#fName'), phone = $('#fPhone');
    const okName = name.value.trim().length >= 2;
    const okPhone = phone.value.replace(/\D/g, '').length >= 10;
    name.parentElement.classList.toggle('has-error', !okName);
    phone.parentElement.classList.toggle('has-error', !okPhone);
    if (!okName) { toast('Digite seu nome'); name.focus(); return false; }
    if (!okPhone) { toast('Digite um WhatsApp válido'); phone.focus(); return false; }
  }
  return true;
}

function buildMessage(paidPix) {
  const { items, total, ask } = cartTotals();
  const servs = items.filter((i) => i.type === 'servico');
  const prods = items.filter((i) => i.type === 'produto');
  const pay = $('input[name="pay"]:checked').value;
  const price = (i) => (i.price != null ? brl(i.price) : 'sob consulta');
  const lines = [
    '✂️ *NOVO AGENDAMENTO - CORTEZA*',
    '',
    `👤 *Cliente:* ${$('#fName').value.trim()}`,
    `📱 *WhatsApp:* ${$('#fPhone').value.trim()}`,
    '',
    `📅 *Data:* ${formatDateLong(state.date)}`,
    `⏰ *Horário:* ${state.time}`,
    '',
    '🛠️ *Serviços:*',
    ...servs.map((i) => `• ${i.name} — ${price(i)}`),
  ];
  if (prods.length) lines.push('', '🛍️ *Produtos para retirar:*', ...prods.map((i) => `• ${i.name} — ${price(i)}`));
  lines.push(
    '',
    `💰 *Total:* ${total ? brl(total) : 'sob consulta'}${total && ask ? ' + itens sob consulta' : ''}`,
    `💳 *Forma de Pagamento:* ${pay === 'pix' ? 'Pix pelo Site' : 'Pagar na Barbearia'}`,
  );
  if (pay === 'pix' && paidPix) lines.push('', '_Segue o comprovante do Pix._');
  return lines.join('\n');
}

function finishBooking(paidPix) {
  const msg = buildMessage(paidPix);
  const url = whatsUrl(msg);
  store('corteza_ultimo', { date: state.date, time: state.time, name: $('#fName').value.trim() });
  saveClient();

  $('#doneText').textContent = `${formatDateLong(state.date)} às ${state.time} com o ${CONFIG.barber}. Envie a mensagem no WhatsApp para confirmar o horário.`;
  $('#doneWhats').href = url;
  goStep('done');
  renderNextBooking();

  let s = 3;
  const cd = $('#countdown');
  cd.textContent = `Abrindo o WhatsApp em ${s}…`;
  clearInterval(finishBooking._t);
  finishBooking._t = setInterval(() => {
    s--;
    if (s > 0) { cd.textContent = `Abrindo o WhatsApp em ${s}…`; return; }
    clearInterval(finishBooking._t);
    cd.textContent = 'Se o WhatsApp não abriu, toque no botão abaixo.';
    window.location.href = url;
  }, 1000);
}

/* Dados do cliente guardados no aparelho para o próximo agendamento */
const CLIENT_KEY = 'corteza_cliente';
function saveClient() {
  store(CLIENT_KEY, { name: $('#fName').value.trim(), phone: $('#fPhone').value.trim() });
}
function fillClient() {
  const saved = store(CLIENT_KEY);
  if (!saved) return;
  if (!$('#fName').value) $('#fName').value = saved.name || '';
  if (!$('#fPhone').value) $('#fPhone').value = saved.phone || '';
}

function initBooking() {
  renderPicker();

  fillClient();

  $$('[data-next]').forEach((b) => b.addEventListener('click', () => { if (validate(state.step)) goStep(state.step + 1); }));
  $$('[data-prev]').forEach((b) => b.addEventListener('click', () => goStep(state.step - 1)));

  $('#daysList').addEventListener('click', (e) => {
    const d = e.target.closest('[data-day]');
    if (!d) return;
    state.date = d.dataset.day;
    state.time = null;
    renderDays();
    renderSlots();
  });
  $('#slotsList').addEventListener('click', (e) => {
    const s = e.target.closest('[data-slot]');
    if (!s) return;
    state.time = s.dataset.slot;
    renderSlots();
  });

  // Atualiza dias/horários a cada minuto enquanto a etapa 2 estiver aberta
  setInterval(() => { if (state.step === 2) { renderDays(); renderSlots(); } }, 60000);

  // Máscara de telefone
  $('#fPhone').addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 6) v = `(${v.slice(0, 2)}) ${v.slice(2, v.length - 4)}-${v.slice(-4)}`;
    else if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
    e.target.value = v;
  });

  $$('input[name="pay"]').forEach((r) => r.addEventListener('change', () => { state.pixAutoOff = false; renderSummary(); }));

  $('#confirmBtn').addEventListener('click', () => {
    if (!validate(1) || !validate(2) || !validate(3)) return;
    const pay = $('input[name="pay"]:checked').value;
    const { total } = cartTotals();
    if (pay === 'pix' && total > 0) {
      openPix(total, `Agendamento ${formatDateLong(state.date)} às ${state.time}`, () => finishBooking(true));
    } else {
      finishBooking(false);
    }
  });

  $('#newBooking').addEventListener('click', () => {
    clearInterval(finishBooking._t);
    state.cart.clear(); state.date = null; state.time = null;
    syncCart();
    goStep(1);
  });

  // Atalho "Agendar" leva direto ao passo certo
  $('#cartGo').addEventListener('click', () => { if (state.step === 'done') goStep(1); });
}

function renderNextBooking() {
  const el = $('#nextBooking');
  const last = store('corteza_ultimo');
  const now = nowLocal();
  if (!last || !last.date || last.date < now.iso) { el.hidden = true; return; }
  el.innerHTML = `💈 Olá${last.name ? ', ' + last.name.split(' ')[0] : ''}! Seu horário: <b>${formatDateLong(last.date)} às ${last.time}</b>`;
  el.hidden = false;
}

/* ----------------------------------------------------------
   PIX — gera o código "copia e cola" (padrão BR Code do Banco Central)
   ---------------------------------------------------------- */
function emv(id, value) { return id + pad(value.length) + value; }
function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    crc &= 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
function clean(s, max) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 ]/g, '').toUpperCase().slice(0, max);
}
function pixPayload(amount, key) {
  const txid = ('CORTEZA' + Date.now().toString(36)).toUpperCase().slice(0, 25);
  let p = emv('00', '01')
    + emv('26', emv('00', 'br.gov.bcb.pix') + emv('01', key))
    + emv('52', '0000')
    + emv('53', '986')
    + emv('54', amount.toFixed(2))
    + emv('58', 'BR')
    + emv('59', clean(CONFIG.pixName, 25))
    + emv('60', clean(CONFIG.pixCity, 15))
    + emv('62', emv('05', txid))
    + '6304';
  return p + crc16(p);
}

let pixDone = null;
function openPix(amount, desc, onDone) {
  const demo = !CONFIG.pixKey;
  const code = pixPayload(amount, demo ? 'chave-pix-demonstracao' : CONFIG.pixKey);
  pixDone = onDone;
  $('#pixTitle').textContent = brl(amount);
  $('#pixDesc').innerHTML = `${desc}${demo ? '<br><strong style="color:var(--red)">Modo demonstração: configure a chave Pix em script.js.</strong>' : ''}`;
  $('#pixCode').value = code;
  $('#pixCopy').textContent = 'Copiar código';
  $('#pixCopy').classList.remove('is-copied');
  const qr = $('#pixQr');
  qr.innerHTML = '';
  if (window.qrcode) {
    const q = window.qrcode(0, 'M');
    q.addData(code);
    q.make();
    qr.innerHTML = q.createImgTag(8, 8, 'QR Code Pix');
  }
  $('#pixModal').hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeModal(el) { el.hidden = true; document.body.style.overflow = ''; }
function initPix() {
  const modal = $('#pixModal');
  $$('[data-close]', modal).forEach((b) => b.addEventListener('click', () => closeModal(modal)));
  $('#pixCopy').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const code = $('#pixCode').value;
    let ok = false;
    try {
      await navigator.clipboard.writeText(code);
      ok = true;
    } catch (err) {
      // Alternativa para navegadores sem permissão da área de transferência
      const ta = $('#pixCode');
      ta.focus(); ta.select(); ta.setSelectionRange(0, code.length);
      try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
    }
    clearTimeout(btn._t);
    btn.textContent = ok ? '✅ Copiado!' : 'Selecione e copie o código acima';
    btn.classList.toggle('is-copied', ok);
    btn._t = setTimeout(() => { btn.textContent = 'Copiar código'; btn.classList.remove('is-copied'); }, 2000);
  });
  $('#pixDone').addEventListener('click', () => {
    closeModal(modal);
    if (pixDone) pixDone();
  });
}

/* ----------------------------------------------------------
   LIGHTBOX (artes)
   ---------------------------------------------------------- */
function initLightbox() {
  const lb = $('#lightbox'), img = $('#lightboxImg');
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-art]');
    if (!a) return;
    img.src = a.dataset.art;
    img.alt = a.dataset.alt || '';
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
  });
  lb.addEventListener('click', () => closeModal(lb));
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!lb.hidden) closeModal(lb);
    if (!$('#pixModal').hidden) closeModal($('#pixModal'));
  });
}

/* ----------------------------------------------------------
   INIT
   ---------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  $('#year').textContent = new Date().getFullYear();
  $$('[data-whats]').forEach((a) => {
    a.href = whatsUrl('Olá! Vim pelo site da Corteza Barbearia e gostaria de mais informações. 💈');
    a.target = '_blank';
    a.rel = 'noopener';
  });
  initMenu();
  initStatus();
  initServices();
  renderProducts();
  initPlans();
  initCart();
  initBooking();
  initPix();
  initLightbox();
  renderNextBooking();
});
