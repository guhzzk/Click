/* ==========================================================
   Seções da página: menu, status, serviços, planos, produtos,
   carrinho, lightbox e animações
   ========================================================== */

/* ----------------------------------------------------------
   MENU MOBILE
   ---------------------------------------------------------- */
function initMenu() {
  const burger = $('#burger'), nav = $('#nav');
  const setOpen = (open) => {
    nav.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('no-scroll', open);
  };
  burger.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
  $$('a, button', nav).forEach((a) => a.addEventListener('click', () => setOpen(false)));

  // Header ganha sombra ao rolar
  const header = $('#header');
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 10);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ----------------------------------------------------------
   STATUS ABERTO / FECHADO + TABELA DE HORÁRIOS
   ---------------------------------------------------------- */
function statusText() {
  const now = nowLocal();
  const today = CONFIG.hours[now.dow];
  if (today && now.minutes >= today[0] * 60 && now.minutes < today[1] * 60) {
    return { open: true, text: `Aberto agora · fecha às ${today[1]}h` };
  }
  if (today && now.minutes < today[0] * 60) return { open: false, text: `Fechado · abre hoje às ${today[0]}h` };
  let i = 1;
  while (!CONFIG.hours[(now.dow + i) % 7]) i++;
  const nd = (now.dow + i) % 7;
  return { open: false, text: `Fechado · abre ${i === 1 ? 'amanhã' : WEEK[nd]} às ${CONFIG.hours[nd][0]}h` };
}

function initStatus() {
  const el = $('#openStatus');
  const update = () => {
    const s = statusText();
    el.classList.remove('is-loading', 'is-open', 'is-closed');
    el.classList.add(s.open ? 'is-open' : 'is-closed');
    $('b', el).textContent = s.text;
  };
  // Mostra o "Verificando horário…" com a linha de carregamento por um instante
  setTimeout(update, reduceMotion() ? 0 : 900);
  setInterval(update, 60000);

  const tbody = $('#hoursTable tbody');
  const now = nowLocal();
  tbody.innerHTML = [2, 3, 4, 5, 6, 0, 1].map((d) => {
    const h = CONFIG.hours[d];
    const cls = [d === now.dow && 'is-today', !h && 'is-closed'].filter(Boolean).join(' ');
    const day = WEEK[d][0].toUpperCase() + WEEK[d].slice(1);
    return `<tr class="${cls}"><td>${day}${d === now.dow ? ' · hoje' : ''}</td><td>${h ? `${h[0]}h às ${h[1]}h` : 'Fechado'}</td></tr>`;
  }).join('');
}

/* ----------------------------------------------------------
   SERVIÇOS
   ---------------------------------------------------------- */
function renderServices(tab) {
  $('#servicesGrid').innerHTML = SERVICES[tab].map((s, i) => `
    <article class="service reveal" data-id="${s.id}" style="--i:${i}">
      <span class="service__tag">${TAB_LABEL[tab]}</span>
      <h3 class="service__name">${s.name}</h3>
      ${s.art ? `<button class="service__art" data-art="${s.art}" data-alt="${s.name}">ver arte</button>` : ''}
      <div class="service__foot">
        ${s.price != null ? `<span class="price"><small>R$</small>${brlShort(s.price)}</span>` : '<span class="price price--ask">Sob consulta</span>'}
        <button class="add-btn" data-toggle="${s.id}" data-on="✓ Adicionado" data-off="+ Adicionar"></button>
      </div>
    </article>`).join('');
  syncSelection();
}

function initServices() {
  const grid = $('#servicesGrid');
  renderServices('avulsos');
  Reveal.observe(grid);
  const movePill = initTabPill($('.tabs'), '.tab.is-active');
  $$('.tab').forEach((t) => t.addEventListener('click', () => {
    if (t.classList.contains('is-active')) return;
    $$('.tab').forEach((x) => { x.classList.toggle('is-active', x === t); x.setAttribute('aria-selected', String(x === t)); });
    movePill();
    swapContent(grid, () => renderServices(t.dataset.tab));
  }));
}

/* ----------------------------------------------------------
   PLANOS
   ---------------------------------------------------------- */
function renderPlans(kind) {
  const meta = PLAN_META[kind];
  $('#plansGrid').innerHTML = PLANS[kind].map((p, i) => `
    <article class="plan plan--${kind} reveal" style="--i:${i}">
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

const planLabel = (kind, p) => `${p.club || 'Club ' + PLAN_META[kind].name} — ${p.what}`;

function initPlans() {
  const grid = $('#plansGrid');
  renderPlans('one');
  Reveal.observe(grid);
  const movePill = initTabPill($('.club-tabs'), '.club-tab.is-active');
  $$('.club-tab').forEach((t) => t.addEventListener('click', () => {
    if (t.classList.contains('is-active')) return;
    $$('.club-tab').forEach((x) => x.classList.toggle('is-active', x === t));
    movePill();
    swapContent(grid, () => renderPlans(t.dataset.club));
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
  $('#productsGrid').innerHTML = PRODUCTS.map((p, i) => `
    <article class="product reveal" data-id="${p.id}" style="--i:${i}">
      <div class="product__img" data-art="${p.img}" data-alt="${p.name}">
        <img src="${p.img}" alt="${p.name} El Guapo" loading="lazy" width="400" height="400" class="fade-img">
      </div>
      <div class="product__body">
        <span class="product__sub">${p.sub}</span>
        <h3 class="product__name">${p.name}</h3>
        <p class="product__desc">${p.desc}</p>
        <div class="product__foot">
          <span class="product__price">${brl(p.price)}</span>
          <button class="add-btn" data-toggle="${p.id}" data-on="✓ Reservado" data-off="+ Reservar"></button>
        </div>
      </div>
    </article>`).join('');
}

/* ----------------------------------------------------------
   CARRINHO (serviços + produtos)
   Só atualiza classes e textos — não redesenha os cards,
   assim as animações não se repetem a cada clique.
   ---------------------------------------------------------- */
// A sacola fica salva no navegador: sobrevive a recarregar a página, voltar do
// WhatsApp e ir/voltar entre as etapas. Só é esvaziada quando o agendamento é
// confirmado ou quando o cliente toca em "Limpar sacola".
const CART_KEY = 'corteza_sacola';
const cart = new Set((store(CART_KEY) || []).filter((id) => ALL_ITEMS[id]));
const saveCart = () => store(CART_KEY, [...cart]);

function clearCart() {
  cart.clear();
  onCartChange(false);
}

function cartTotals() {
  const items = [...cart].map((id) => ALL_ITEMS[id]);
  const total = items.reduce((s, i) => s + (i.price || 0), 0);
  const ask = items.some((i) => i.price == null);
  return { items, total, ask };
}

function syncSelection() {
  $$('[data-id]').forEach((el) => el.classList.toggle('is-selected', cart.has(el.dataset.id)));
  $$('[data-toggle]').forEach((b) => {
    const on = cart.has(b.dataset.toggle);
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-pressed', String(on));
    if (b.dataset.on) b.textContent = on ? b.dataset.on : b.dataset.off;
  });
}

let bookingInView = false;
function syncCartBar(bump) {
  const { items, total, ask } = cartTotals();
  const bar = $('#cartbar');
  bar.hidden = items.length === 0 || bookingInView;
  document.body.classList.toggle('has-cart', !bar.hidden);
  $('#cartCount').textContent = `${items.length} ${items.length === 1 ? 'item' : 'itens'}`;
  $('#cartTotal').textContent = total ? `${brl(total)}${ask ? ' + consulta' : ''}` : 'Valor sob consulta';
  if (bump) bumpCart();
}

/** "Tremidinha" da barra da sacola */
function bumpCart() {
  const bar = $('#cartbar');
  if (bar.hidden) return;
  bar.classList.remove('is-bump');
  void bar.offsetWidth; // reinicia a animação
  bar.classList.add('is-bump');
}

function onCartChange(bump) {
  saveCart();
  $('#clearCart').hidden = cart.size === 0;
  syncSelection();
  syncCartBar(bump);
  if (typeof renderSummary === 'function') renderSummary();
}

function toggleItem(id, sourceEl) {
  const adding = !cart.has(id);
  if (adding) cart.add(id); else cart.delete(id);
  if (!adding) { onCartChange(false); return; }

  const it = ALL_ITEMS[id];
  toast(`${it.name} ${it.type === 'produto' ? 'reservado' : 'adicionado'} ✓`);
  // Fora do agendamento, o item "voa" até a sacola e ela pula quando ele chega
  const inPicker = sourceEl && sourceEl.closest('#servicePicker');
  if (sourceEl && !inPicker) {
    onCartChange(false);
    flyToCart(sourceEl, it).then(bumpCart);
  } else {
    onCartChange(true);
  }
}

function initCart() {
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-toggle]');
    if (t) toggleItem(t.dataset.toggle, t);
  });
  $('#clearCart').addEventListener('click', () => {
    if (!cart.size) return;
    clearCart();
    toast('Sacola esvaziada');
  });
  onCartChange(false); // aplica a sacola salva
  new IntersectionObserver(([en]) => { bookingInView = en.isIntersecting; syncCartBar(false); }, { threshold: 0.15 })
    .observe($('#agendar'));
  $('#cartGo').addEventListener('click', () => { if (bookingStep() === 'done') goStep(1); });
}

/* ----------------------------------------------------------
   AVISO DO PRÓXIMO AGENDAMENTO
   ---------------------------------------------------------- */
function renderNextBooking() {
  const el = $('#nextBooking');
  const user = Auth.user();
  const today = nowLocal().iso;
  let next = null;
  if (user && user.role === 'cliente') {
    next = DB.forUser(user.email).find((b) => b.status === 'agendado' && b.date >= today);
  } else {
    const last = DB.get(store('corteza_ultimo_id'));
    if (last && last.status === 'agendado' && last.date >= today) next = last;
  }
  if (!next) { el.hidden = true; return; }
  const first = (next.name || '').split(' ')[0];
  el.innerHTML = `💈 Olá${first ? ', ' + esc(first) : ''}! Seu horário: <b>${formatDateLong(next.date)} às ${next.time}</b>`;
  el.hidden = false;
}

/* ----------------------------------------------------------
   LIGHTBOX (artes)
   ---------------------------------------------------------- */
function initLightbox() {
  const lb = $('#lightbox'), img = $('#lightboxImg');
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-art]');
    if (!a) return;
    img.classList.remove('is-loaded');
    img.onload = () => img.classList.add('is-loaded');
    img.src = a.dataset.art;
    img.alt = a.dataset.alt || '';
    openModal(lb);
  });
  lb.addEventListener('click', () => closeModal(lb));
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    $$('.modal, .lightbox, .panel').filter((m) => !m.hidden).forEach(closeModal);
  });
}

/* ----------------------------------------------------------
   ANIMAÇÕES
   ---------------------------------------------------------- */

/** Liga o reveal repetível em toda a página (ver js/motion.js) */
function initReveal() {
  Reveal.observe(document);
}

/** Imagens aparecem com fade quando terminam de carregar */
function initImageFades() {
  // Fundo do hero: pré-carrega e só então mostra
  const hero = $('.hero__media');
  const bg = new Image();
  bg.onload = () => hero.classList.add('is-loaded');
  bg.onerror = () => hero.classList.add('is-loaded');
  bg.src = IMG + 'banner-corteza.webp';

  $$('img.fade-img').forEach((img) => {
    if (img.complete && img.naturalWidth) img.classList.add('is-loaded');
    else img.addEventListener('load', () => img.classList.add('is-loaded'), { once: true });
  });
}
