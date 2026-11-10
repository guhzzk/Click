/* ==========================================================
   Recursos premium (modo demonstração)
   1) Pix com confirmação automática (webhook simulado)
   2) Fila de espera para dias lotados

   Tudo aqui é simulado no navegador para apresentar o upgrade.
   As simulações só rodam com CONFIG.demoMode = true.
   ========================================================== */

const isDemo = () => !!CONFIG.demoMode;

/* ----------------------------------------------------------
   DISPONIBILIDADE (inclui o sábado lotado da demonstração)
   ---------------------------------------------------------- */

/** Próximo sábado (nunca hoje) — o dia "lotado" da demonstração */
function demoFullDate() {
  const now = nowLocal();
  const ahead = (6 - now.dow + 7) % 7 || 7;
  return addDays(now.iso, ahead).iso;
}

const isDemoFullDay = (iso) => isDemo() && iso === demoFullDate();

/** Horário indisponível para o cliente: ocupado na agenda ou dia lotado da demo */
function slotUnavailable(iso, time) {
  return isDemoFullDay(iso) || DB.isTaken(iso, time);
}

/** Dia sem nenhum horário livre (considerando só os horários que ainda não passaram) */
function isDayFull(iso) {
  const future = daySlots(iso).filter((m) => !isPastSlot(iso, m));
  return future.length > 0 && future.every((m) => slotUnavailable(iso, toHHMM(m)));
}

/* ==========================================================
   1) PIX — CONFIRMAÇÃO AUTOMÁTICA (WEBHOOK SIMULADO)
   ========================================================== */
const PixWatch = (() => {
  let tickT = null;
  let doneT = null;
  let startedAt = 0;
  let state = 'idle'; // idle | waiting | paid

  const box = () => $('#pixStatus');
  const card = () => $('#pixModal .modal__card');

  /** Só simula quando não há chave Pix real (ninguém consegue pagar de verdade) */
  const enabled = () => isDemo() && !CONFIG.pixKey;

  function stop() {
    clearInterval(tickT);
    clearTimeout(doneT);
  }

  /** Volta o modal ao estado inicial (chamado a cada abertura) */
  function reset() {
    stop();
    state = 'idle';
    box().hidden = true;
    box().classList.remove('is-waiting', 'is-paid');
    card().classList.remove('pix-waiting', 'pix-paid');
    $('#pixCopy').hidden = false;
    $('#pixContinue').hidden = true;

    const manual = $('#pixDone');
    if (enabled()) {
      manual.className = 'btn btn--text btn--sm';
      manual.textContent = 'Já paguei e não confirmou? Enviar comprovante';
      $('#pixHint').textContent = 'A confirmação é automática: assim que o Pix cair, esta tela atualiza sozinha.';
    } else {
      manual.className = 'btn btn--whats';
      manual.textContent = 'Já paguei, enviar no WhatsApp';
      $('#pixHint').textContent = 'Após pagar, envie o comprovante na conversa do WhatsApp.';
    }
  }

  function renderTimer() {
    const s = Math.floor((Date.now() - startedAt) / 1000);
    $('#pixTimer').textContent = `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
  }

  /** "Aguardando pagamento…" e, depois do tempo configurado, confirma */
  function start() {
    if (!enabled() || state !== 'idle') return;
    state = 'waiting';
    startedAt = Date.now();
    box().hidden = false;
    void box().offsetWidth; // permite a transição de entrada
    box().classList.add('is-waiting');
    card().classList.add('pix-waiting');
    renderTimer();
    tickT = setInterval(renderTimer, 250);
    doneT = setTimeout(confirm, CONFIG.pixAutoConfirmMs || 5000);
  }

  function confirm() {
    stop();
    state = 'paid';
    const time = new Date().toLocaleTimeString('pt-BR', { timeZone: CONFIG.timezone });
    $('#pixOkInfo').textContent = `Detectado automaticamente via webhook às ${time}`;
    box().classList.remove('is-waiting');
    box().classList.add('is-paid');
    card().classList.add('pix-paid');
    $('#pixCopy').hidden = true;
    $('#pixDone').hidden = true;
    const cont = $('#pixContinue');
    cont.hidden = false;
    setTimeout(() => cont.focus({ preventScroll: true }), 400);
  }

  return { reset, start, stop, enabled, state: () => state };
})();

/* ==========================================================
   2) FILA DE ESPERA
   ========================================================== */
const Waitlist = (() => {
  const KEY = 'corteza_fila_v1';
  const PERIOD = { manha: 'Manhã', tarde: 'Tarde' };
  let currentDate = null;

  const all = () => store(KEY) || [];
  const save = (list) => store(KEY, list);

  function add(entry) {
    const list = all();
    const item = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), createdAt: new Date().toISOString(), ...entry };
    list.push(item);
    save(list);
    return item;
  }

  const remove = (id) => save(all().filter((e) => e.id !== id));

  /** Entradas de hoje em diante, ordenadas por data */
  const upcoming = () => all().filter((e) => e.date >= nowLocal().iso).sort((a, b) => (a.date + a.period).localeCompare(b.date + b.period));

  const findMine = (date, phone) => all().find((e) => e.date === date && e.phone.replace(/\D/g, '') === phone.replace(/\D/g, ''));

  /* ---------- UI no agendamento ---------- */
  const el = () => $('#waitlist');
  const panelEl = () => $('#wlPanel');

  function setOpen(open) {
    const wl = el(), panel = panelEl();
    clearTimeout(panel._t);
    $('#wlOpen').setAttribute('aria-expanded', String(open));
    if (open) {
      wl.classList.add('is-open');
      panel.style.maxHeight = panel.scrollHeight + 'px';
      panel._t = setTimeout(() => { if (wl.classList.contains('is-open')) panel.style.maxHeight = 'none'; }, 600);
    } else {
      panel.style.maxHeight = panel.scrollHeight + 'px';
      void panel.offsetHeight;
      wl.classList.remove('is-open');
      panel.style.maxHeight = '0px';
    }
  }

  function showDone(text) {
    $('#wlDoneText').textContent = text;
    el().classList.add('is-done');
    const panel = panelEl();
    if (el().classList.contains('is-open')) panel.style.maxHeight = 'none';
  }

  function doneText(entry) {
    if (isDemo()) return 'Pronto! Se alguém cancelar, nossa IA vai te notificar no WhatsApp instantaneamente.';
    return `Pronto! Você está na fila de ${formatDateLong(entry.date)} (${PERIOD[entry.period].toLowerCase()}). Se alguém cancelar, avisamos pelo WhatsApp.`;
  }

  /** Mostra/esconde o card conforme o dia escolhido está lotado */
  function render(date, full) {
    const wl = el();
    if (!full) { wl.hidden = true; currentDate = null; return; }
    const changed = currentDate !== date;
    currentDate = date;
    if (!changed && !wl.hidden) return;

    wl.hidden = false;
    wl.classList.remove('is-open', 'is-done');
    panelEl().style.maxHeight = '0px';
    $('#wlDateLabel').textContent = formatDateLong(date);
    $('#wlForm').reset();
    $('input[name="wlPeriod"][value="manha"]').checked = true;

    // Pré-preenche com os dados do cliente (conta ou último agendamento)
    const u = Auth.user();
    const saved = u && u.role === 'cliente' ? { name: u.name, phone: u.phone } : store('corteza_cliente');
    if (saved) { $('#wlName').value = saved.name || ''; $('#wlPhone').value = saved.phone || ''; }

    const mine = saved && saved.phone && findMine(date, saved.phone);
    if (mine) showDone(`Você já está na fila deste dia (${PERIOD[mine.period].toLowerCase()}). ${doneText(mine)}`);
  }

  function submit(e) {
    e.preventDefault();
    const name = $('#wlName'), phone = $('#wlPhone');
    const okName = name.value.trim().length >= 2;
    const okPhone = phone.value.replace(/\D/g, '').length >= 10;
    name.parentElement.classList.toggle('has-error', !okName);
    phone.parentElement.classList.toggle('has-error', !okPhone);
    if (!okName) { toast('Digite seu nome'); name.focus(); return; }
    if (!okPhone) { toast('Digite um WhatsApp válido'); phone.focus(); return; }

    const period = $('input[name="wlPeriod"]:checked').value;
    const exists = findMine(currentDate, phone.value);
    const entry = exists || add({ date: currentDate, period, name: name.value.trim(), phone: phone.value.trim() });
    store('corteza_cliente', { name: entry.name, phone: entry.phone });

    const btn = $('#wlForm button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Entrando na fila…';
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = 'Entrar na Fila';
      showDone(doneText(entry));
      // Fora da demonstração, o pedido também vai para o WhatsApp da barbearia
      if (!isDemo()) {
        window.open(whatsUrl(`Olá! Quero entrar na *fila de espera* de ${formatDateLong(entry.date)} (${PERIOD[entry.period].toLowerCase()}). Nome: ${entry.name} · WhatsApp: ${entry.phone}`), '_blank');
      }
    }, isDemo() ? 900 : 200);
  }

  function init() {
    maskPhone($('#wlPhone'));
    $('#wlOpen').addEventListener('click', () => setOpen(!el().classList.contains('is-open')));
    $('#wlForm').addEventListener('submit', submit);
  }

  return { init, render, upcoming, remove, PERIOD };
})();

/* ----------------------------------------------------------
   PAINEL: bloco da fila de espera na aba Agenda
   ---------------------------------------------------------- */
function renderWaitlistPanel() {
  const box = $('#panelWaitlist');
  const list = Waitlist.upcoming();
  if (!list.length) { box.innerHTML = ''; box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = `
    <h4>⏳ Fila de espera <span class="badge badge--agendado">${list.length}</span></h4>
    ${list.map((e) => `
      <div class="wl-row">
        <div><strong>${esc(e.name)}</strong><small>${formatDateLong(e.date)} · ${Waitlist.PERIOD[e.period]}</small></div>
        ${Messages.menu('fila', e.phone, { nome: e.name.split(' ')[0], data: formatDateLong(e.date), periodo: Waitlist.PERIOD[e.period].toLowerCase() }, e.name)}
        <button class="icon-btn" data-wl-remove="${e.id}" aria-label="Remover ${esc(e.name)} da fila">Remover</button>
      </div>`).join('')}`;
}

function initPremium() {
  Waitlist.init();
  $('#panelWaitlist').addEventListener('click', (e) => {
    const r = e.target.closest('[data-wl-remove]');
    if (!r) return;
    Waitlist.remove(r.dataset.wlRemove);
    renderWaitlistPanel();
    toast('Removido da fila de espera');
  });
}
