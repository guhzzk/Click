/* ==========================================================
   Agendamento em 4 etapas + Pix
   ========================================================== */

const booking = { date: null, time: null, step: 1, pixAutoOff: false };
const bookingStep = () => booking.step;

/* ----------------------------------------------------------
   ETAPA 1 — serviços
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
        ${list.map((s) => `<button class="chip" data-toggle="${s.id}">${s.name}<small>${s.price != null ? 'R$ ' + brlShort(s.price) : 'consulta'}</small></button>`).join('')}
      </div>
    </div>`).join('');
  syncSelection();
}

/* ----------------------------------------------------------
   ETAPA 2 — dia e horário
   ---------------------------------------------------------- */
/** Horários livres de um dia (sem passados, ocupados ou dia lotado) */
function freeSlots(iso) {
  return daySlots(iso).filter((m) => !isPastSlot(iso, m) && !slotUnavailable(iso, toHHMM(m)));
}

function renderDays() {
  const now = nowLocal();
  const days = [];
  for (let i = 0; days.length < CONFIG.bookingDays && i < 60; i++) {
    const d = addDays(now.iso, i);
    if (!CONFIG.hours[d.dow]) continue;
    if (i === 0 && freeSlots(d.iso).length === 0) continue; // hoje sem horários
    days.push({ ...d, today: i === 0, tomorrow: i === 1 });
  }
  $('#daysList').innerHTML = days.map((d) => {
    const full = isDayFull(d.iso);
    return `
    <button class="day ${booking.date === d.iso ? 'is-on' : ''} ${full ? 'day--full' : ''}" data-day="${d.iso}">
      <span>${d.today ? 'hoje' : d.tomorrow ? 'amanhã' : WEEK_SHORT[d.dow]}</span>
      <b>${pad(d.d)}</b>
      <span>${MONTH_SHORT[d.m]}</span>
      ${full ? '<em class="day__tag">lotado</em>' : ''}
    </button>`;
  }).join('');
}

function renderSlots() {
  const box = $('#slotsList');
  if (!booking.date) {
    box.innerHTML = '<p class="muted">Selecione um dia primeiro.</p>';
    Waitlist.render(null, false);
    return;
  }
  // Se o horário escolhido já passou ou foi ocupado, limpa a escolha
  if (booking.time && (isPastSlot(booking.date, toMinutes(booking.time)) || slotUnavailable(booking.date, booking.time))) {
    booking.time = null;
    toast('O horário escolhido não está mais disponível. Escolha outro.');
  }
  const full = isDayFull(booking.date);
  box.classList.toggle('slots--full', full);
  let html = '';
  daySlots(booking.date).forEach((m, i) => {
    if (isPastSlot(booking.date, m)) return; // horários que já passaram não aparecem
    const label = toHHMM(m);
    const taken = slotUnavailable(booking.date, label);
    html += `<button class="slot ${booking.time === label ? 'is-on' : ''} ${full ? 'slot--full' : ''}" data-slot="${label}" style="--i:${i}" ${taken ? `disabled title="${full ? 'Lotado' : 'Ocupado'}"` : ''}>${label}</button>`;
  });
  box.innerHTML = (full ? '<p class="slots__full-note">Todos os horários deste dia já foram reservados.</p>' : '')
    + (html || '<p class="muted">Não há mais horários livres neste dia. Escolha outro.</p>');
  Waitlist.render(booking.date, full);
}

/* ----------------------------------------------------------
   ETAPA 4 — resumo
   ---------------------------------------------------------- */
function renderSummary() {
  const box = $('#summary');
  const { items, total, ask } = cartTotals();
  const pay = $('input[name="pay"]:checked')?.value;
  const rows = items.map((i) => `<div class="summary__row"><span>${i.name}${i.type === 'produto' ? ' <em class="muted">(produto)</em>' : ''}</span><span>${i.price != null ? brl(i.price) : 'consulta'}</span></div>`).join('');
  box.innerHTML = `
    <h4>Resumo</h4>
    ${rows || '<p class="muted">Nenhum serviço selecionado.</p>'}
    <div class="summary__row"><span>Data</span><span>${booking.date ? formatDateLong(booking.date) : '—'}</span></div>
    <div class="summary__row"><span>Horário</span><span>${booking.time || '—'}</span></div>
    <div class="summary__row"><span>Barbeiro</span><span>${CONFIG.barber}</span></div>
    <div class="summary__row summary__total"><span>Total</span><span>${total ? brl(total) : '—'}${ask ? ' + itens sob consulta' : ''}</span></div>
    ${pay === 'pix' && ask ? '<p class="summary__note">No Pix você paga agora os itens com preço; os itens sob consulta são acertados na barbearia.</p>' : ''}`;

  // Pix só faz sentido se houver valor
  const pixInput = $('input[name="pay"][value="pix"]');
  pixInput.disabled = total === 0;
  pixInput.closest('.payopt').classList.toggle('is-disabled', total === 0);
  if (total === 0 && pixInput.checked) {
    $('input[name="pay"][value="local"]').checked = true;
    booking.pixAutoOff = true; // desmarcado automaticamente, não pelo cliente
  } else if (total > 0 && booking.pixAutoOff) {
    pixInput.checked = true;
    booking.pixAutoOff = false;
  }
}

/* ----------------------------------------------------------
   NAVEGAÇÃO ENTRE ETAPAS (com animação de slide)
   ---------------------------------------------------------- */
const stepOrder = (s) => (s === 'done' ? 5 : s);

function goStep(n) {
  const prev = booking.step;
  booking.step = n;
  const from = $(`.step[data-step="${prev}"]`);
  const to = $(`.step[data-step="${n}"]`);
  const forward = stepOrder(n) >= stepOrder(prev);

  $$('[data-step-dot]').forEach((d) => {
    const k = +d.dataset.stepDot;
    d.classList.toggle('is-active', k === n);
    d.classList.toggle('is-done', n === 'done' || k < n);
  });
  if (n === 2) { renderDays(); renderSlots(); }
  if (n === 3) fillClient();
  if (n === 4) renderSummary();

  const show = () => {
    $$('.step').forEach((s) => s.classList.remove('is-active', 'leave-left', 'leave-right', 'enter-left', 'enter-right'));
    to.classList.add('is-active', forward ? 'enter-right' : 'enter-left');
  };
  if (from && from !== to && !reduceMotion()) {
    from.classList.add(forward ? 'leave-left' : 'leave-right');
    setTimeout(show, 420); // mesmo tempo do .leave-* no CSS
  } else {
    show();
  }

  const top = $('#booking').getBoundingClientRect().top + window.scrollY - 90;
  if (Math.abs(window.scrollY - top) > 200) window.scrollTo({ top, behavior: reduceMotion() ? 'auto' : 'smooth' });
}

function validate(step) {
  if (step === 1 && cart.size === 0) { toast('Escolha pelo menos um serviço'); return false; }
  if (step === 1 && ![...cart].some((id) => ALL_ITEMS[id].type === 'servico')) { toast('Adicione um serviço para agendar'); return false; }
  if (step === 2 && !booking.date) { toast('Escolha o dia'); return false; }
  if (step === 2 && !booking.time) { toast('Escolha o horário'); return false; }
  if (step === 2 && (isPastSlot(booking.date, toMinutes(booking.time)) || slotUnavailable(booking.date, booking.time))) {
    booking.time = null;
    toast('Esse horário não está mais disponível. Escolha outro.');
    if (booking.step !== 2) goStep(2); else renderSlots();
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

/* ----------------------------------------------------------
   DADOS DO CLIENTE (salvos no aparelho)
   ---------------------------------------------------------- */
const CLIENT_KEY = 'corteza_cliente';
function saveClient() {
  store(CLIENT_KEY, { name: $('#fName').value.trim(), phone: $('#fPhone').value.trim() });
}
function fillClient() {
  const user = Auth.user();
  const saved = user && user.role === 'cliente' ? { name: user.name, phone: user.phone } : store(CLIENT_KEY);
  if (!saved) return;
  if (!$('#fName').value) $('#fName').value = saved.name || '';
  if (!$('#fPhone').value) $('#fPhone').value = saved.phone || '';
}

/* ----------------------------------------------------------
   MENSAGEM DO WHATSAPP E FINALIZAÇÃO
   ---------------------------------------------------------- */
function buildMessage(b, paidPix, autoPix) {
  const items = b.items.map((id) => ALL_ITEMS[id]);
  const servs = items.filter((i) => i.type === 'servico');
  const prods = items.filter((i) => i.type === 'produto');
  const price = (i) => (i.price != null ? brl(i.price) : 'sob consulta');
  const lines = [
    '✂️ *NOVO AGENDAMENTO - CORTEZA*',
    '',
    `👤 *Cliente:* ${b.name}`,
    `📱 *WhatsApp:* ${b.phone}`,
    '',
    `📅 *Data:* ${formatDateLong(b.date)}`,
    `⏰ *Horário:* ${b.time}`,
    '',
    '🛠️ *Serviços:*',
    ...servs.map((i) => `• ${i.name} — ${price(i)}`),
  ];
  if (prods.length) lines.push('', '🛍️ *Produtos para retirar:*', ...prods.map((i) => `• ${i.name} — ${price(i)}`));
  lines.push(
    '',
    `💰 *Total:* ${b.total ? brl(b.total) : 'sob consulta'}${b.total && b.ask ? ' + itens sob consulta' : ''}`,
    `💳 *Forma de Pagamento:* ${b.pay === 'pix' ? 'Pix pelo Site' : 'Pagar na Barbearia'}`,
  );
  if (b.pay === 'pix' && autoPix) lines.push('', '✅ *Pix confirmado automaticamente pelo site.*');
  else if (b.pay === 'pix' && paidPix) lines.push('', '_Segue o comprovante do Pix._');
  return lines.join('\n');
}

function finishBooking(paidPix, autoPix) {
  const { total, ask } = cartTotals();
  const user = Auth.user();
  const saved = DB.add({
    date: booking.date,
    time: booking.time,
    items: [...cart],
    total, ask,
    pay: $('input[name="pay"]:checked').value,
    paid: !!paidPix,
    pixAuto: !!autoPix,
    name: $('#fName').value.trim(),
    phone: $('#fPhone').value.trim(),
    userEmail: user && user.role === 'cliente' ? user.email : null,
    origin: 'site',
  });
  store('corteza_ultimo_id', saved.id);
  saveClient();
  // Agendamento confirmado: os itens já estão nele, então a sacola é liberada
  cart.clear();
  saveCart();
  syncSelection();
  syncCartBar(false);

  const url = whatsUrl(buildMessage(saved, paidPix, autoPix));
  $('#doneText').textContent = `${formatDateLong(saved.date)} às ${saved.time} com o ${CONFIG.barber}. Envie a mensagem no WhatsApp para confirmar o horário.`;
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

/** Volta para a etapa 1 sem mexer na sacola */
function resetBooking() {
  clearInterval(finishBooking._t);
  booking.date = null;
  booking.time = null;
  onCartChange(false);
  goStep(1);
}

/* ----------------------------------------------------------
   INIT
   ---------------------------------------------------------- */
function initBooking() {
  renderPicker();
  fillClient();
  maskPhone($('#fPhone'));

  $$('[data-next]').forEach((b) => b.addEventListener('click', () => { if (validate(booking.step)) goStep(booking.step + 1); }));
  $$('[data-prev]').forEach((b) => b.addEventListener('click', () => goStep(booking.step - 1)));

  $('#daysList').addEventListener('click', (e) => {
    const d = e.target.closest('[data-day]');
    if (!d) return;
    booking.date = d.dataset.day;
    booking.time = null;
    $$('.day').forEach((x) => x.classList.toggle('is-on', x === d));
    renderSlots();
  });
  $('#slotsList').addEventListener('click', (e) => {
    const s = e.target.closest('[data-slot]');
    if (!s) return;
    booking.time = s.dataset.slot;
    $$('.slot').forEach((x) => x.classList.toggle('is-on', x === s));
  });

  // Atualiza dias/horários a cada minuto enquanto a etapa 2 estiver aberta
  setInterval(() => { if (booking.step === 2) { renderDays(); renderSlots(); } }, 60000);

  $$('input[name="pay"]').forEach((r) => r.addEventListener('change', () => { booking.pixAutoOff = false; renderSummary(); }));

  $('#confirmBtn').addEventListener('click', () => {
    if (!validate(1) || !validate(2) || !validate(3)) return;
    const pay = $('input[name="pay"]:checked').value;
    const { total } = cartTotals();
    if (pay === 'pix' && total > 0) {
      openPix(total, `Agendamento ${formatDateLong(booking.date)} às ${booking.time}`, ({ auto }) => finishBooking(true, auto));
    } else {
      finishBooking(false);
    }
  });

  $('#newBooking').addEventListener('click', resetBooking);
}

/* ==========================================================
   PIX — código "copia e cola" no padrão BR Code do Banco Central
   ========================================================== */
const emv = (id, value) => id + pad(value.length) + value;

function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    crc &= 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

const pixClean = (s, max) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 ]/g, '').toUpperCase().slice(0, max);

function pixPayload(amount, key) {
  const txid = ('CORTEZA' + Date.now().toString(36)).toUpperCase().slice(0, 25);
  const p = emv('00', '01')
    + emv('26', emv('00', 'br.gov.bcb.pix') + emv('01', key))
    + emv('52', '0000')
    + emv('53', '986')
    + emv('54', amount.toFixed(2))
    + emv('58', 'BR')
    + emv('59', pixClean(CONFIG.pixName, 25))
    + emv('60', pixClean(CONFIG.pixCity, 15))
    + emv('62', emv('05', txid))
    + '6304';
  return p + crc16(p);
}

let pixDoneCb = null;
function openPix(amount, desc, onDone) {
  const demo = !CONFIG.pixKey;
  const code = pixPayload(amount, demo ? 'chave-pix-demonstracao' : CONFIG.pixKey);
  pixDoneCb = onDone;
  $('#pixTitle').textContent = brl(amount);
  // Na apresentação (demoMode) o aviso some; fora dela, lembra de configurar a chave
  $('#pixDesc').innerHTML = `${esc(desc)}${demo && !isDemo() ? '<br><strong class="demo-note">Configure a chave Pix em js/config.js.</strong>' : ''}`;
  PixWatch.reset();
  $('#pixCode').value = code;
  const btn = $('#pixCopy');
  btn.textContent = 'Copiar código';
  btn.classList.remove('is-copied');
  const qr = $('#pixQr');
  qr.innerHTML = '';
  if (window.qrcode) {
    const q = window.qrcode(0, 'M');
    q.addData(code);
    q.make();
    qr.innerHTML = q.createImgTag(8, 8, 'QR Code Pix');
  }
  openModal($('#pixModal'));
}

function initPix() {
  const modal = $('#pixModal');
  $$('[data-close]', modal).forEach((b) => b.addEventListener('click', () => { PixWatch.stop(); closeModal(modal); }));
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
    PixWatch.start(); // demonstração: "Aguardando pagamento…" e confirmação automática
  });
  // Pagamento informado manualmente (comprovante pelo WhatsApp)
  $('#pixDone').addEventListener('click', () => {
    PixWatch.stop();
    closeModal(modal);
    if (pixDoneCb) pixDoneCb({ auto: false });
  });
  // Pagamento detectado automaticamente
  $('#pixContinue').addEventListener('click', () => {
    closeModal(modal);
    if (pixDoneCb) pixDoneCb({ auto: true });
  });
}
