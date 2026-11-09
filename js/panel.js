/* ==========================================================
   Painel do barbeiro: ver agendamentos e criar horários
   ========================================================== */

const panel = { filter: 'hoje', highlight: null };

function openPanel() {
  const u = Auth.user();
  if (!u || u.role !== 'barbeiro') return;
  $('#panelUser').textContent = u.name;
  showPanelTab('agenda');
  renderPanel();
  openModal($('#panel'));
}

function showPanelTab(tab) {
  $$('[data-ptab]').forEach((b) => b.classList.toggle('is-active', b.dataset.ptab === tab));
  $$('[data-ppane]').forEach((p) => { p.hidden = p.dataset.ppane !== tab; });
  if (tab === 'novo') prepareNewForm();
}

/* ----------------------------------------------------------
   AGENDA
   ---------------------------------------------------------- */
function filteredBookings() {
  const today = nowLocal().iso;
  const all = DB.all();
  switch (panel.filter) {
    case 'hoje': return all.filter((b) => b.date === today && b.status !== 'cancelado');
    case 'proximos': return all.filter((b) => b.date >= today && b.status === 'agendado');
    case 'cancelados': return all.filter((b) => b.status === 'cancelado').reverse();
    default: return all.slice().reverse();
  }
}

function renderPanelStats() {
  const today = nowLocal().iso;
  const week = addDays(today, 7).iso;
  const all = DB.all().filter((b) => b.kind === 'agendamento' && b.status !== 'cancelado');
  const hoje = all.filter((b) => b.date === today);
  const semana = all.filter((b) => b.date >= today && b.date < week && b.status === 'agendado');
  const previsto = hoje.reduce((s, b) => s + (b.total || 0), 0);
  const feitos = hoje.filter((b) => b.status === 'concluido').length;
  $('#panelStats').innerHTML = `
    <div class="stat"><span>Hoje</span><b>${hoje.length}</b><small>${feitos} concluído${feitos === 1 ? '' : 's'}</small></div>
    <div class="stat"><span>Próximos 7 dias</span><b>${semana.length}</b><small>agendados</small></div>
    <div class="stat"><span>Previsto hoje</span><b>${brl(previsto)}</b><small>serviços com preço</small></div>`;
}

function renderPanel() {
  renderPanelStats();
  $$('[data-filter]').forEach((b) => b.classList.toggle('is-active', b.dataset.filter === panel.filter));

  const list = filteredBookings();
  const box = $('#panelList');
  if (!list.length) {
    const msg = { hoje: 'Nenhum horário para hoje.', proximos: 'Nenhum agendamento futuro.', cancelados: 'Nenhum cancelamento.', todos: 'A agenda está vazia.' }[panel.filter];
    box.innerHTML = `<div class="empty">${msg}<br><button class="btn btn--dark btn--sm" data-ptab-go="novo">+ Criar horário</button></div>`;
    return;
  }

  // Agrupa por data
  const groups = {};
  list.forEach((b) => (groups[b.date] = groups[b.date] || []).push(b));
  const today = nowLocal().iso;

  box.innerHTML = Object.entries(groups).map(([date, items]) => `
    <section class="pday">
      <h4>${date === today ? 'Hoje · ' : ''}${formatDateLong(date)}</h4>
      ${items.map((b, i) => {
        const block = b.kind === 'bloqueio';
        const origin = block ? 'Bloqueio' : b.origin === 'barbeiro' ? 'Criado por você' : 'Pelo site';
        return `
        <article class="pbk pbk--${b.status} ${block ? 'pbk--block' : ''} ${panel.highlight === b.id ? 'is-new' : ''}" style="--i:${i}">
          <div class="pbk__time">${b.time}</div>
          <div class="pbk__main">
            <strong>${block ? 'Horário bloqueado' : esc(b.name)}</strong>
            <span>${esc(block ? (b.note || 'Indisponível para clientes') : bookingItemsText(b))}</span>
            <small>
              ${block ? '' : `${b.total ? brl(b.total) : 'sob consulta'} · ${b.pay === 'pix' ? (b.paid ? 'Pix pago' : 'Pix') : 'na barbearia'} · `}${origin}
            </small>
          </div>
          <span class="badge badge--${block && b.status === 'agendado' ? 'bloqueio' : b.status}">${block ? (b.status === 'agendado' ? 'Bloqueado' : 'Liberado') : STATUS_LABEL[b.status]}</span>
          <div class="pbk__actions">
            ${!block && b.phone ? `<a class="icon-btn icon-btn--whats" href="${whatsUrl(`Olá, ${b.name.split(' ')[0]}! Aqui é o ${CONFIG.barber} da Corteza. Confirmando seu horário de ${formatDateLong(b.date)} às ${b.time}. 💈`, b.phone)}" target="_blank" rel="noopener" title="Chamar no WhatsApp">WhatsApp</a>` : ''}
            ${b.status === 'agendado' && !block ? `<button class="icon-btn icon-btn--ok" data-act="done" data-id="${b.id}">Concluir</button>` : ''}
            ${b.status === 'agendado' ? `<button class="icon-btn" data-act="cancel" data-id="${b.id}">${block ? 'Liberar' : 'Cancelar'}</button>` : ''}
            ${b.status !== 'agendado' && !block ? `<button class="icon-btn" data-act="restore" data-id="${b.id}">Reabrir</button>` : ''}
          </div>
        </article>`;
      }).join('')}
    </section>`).join('');
  panel.highlight = null;
}

/* ----------------------------------------------------------
   NOVO HORÁRIO
   ---------------------------------------------------------- */
function prepareNewForm() {
  const today = nowLocal().iso;
  const d = $('#nDate');
  d.min = today;
  if (!d.value || d.value < today) {
    // Próximo dia de funcionamento com horário livre
    for (let i = 0; i < 30; i++) {
      const day = addDays(today, i).iso;
      if (daySlots(day).some((m) => !isPastSlot(day, m) && !DB.isTaken(day, toHHMM(m)))) { d.value = day; break; }
    }
  }
  renderNewSlots();
  syncNewKind();
}

function renderNewSlots() {
  const date = $('#nDate').value;
  const sel = $('#nTime');
  const hint = $('#nDateHint');
  if (!date) { sel.innerHTML = '<option value="">Escolha a data</option>'; return; }
  const dow = addDays(date, 0).dow;
  if (!CONFIG.hours[dow]) {
    sel.innerHTML = '<option value="">Fechado neste dia</option>';
    hint.textContent = `A barbearia não abre ${WEEK[dow]}.`;
    return;
  }
  const opts = daySlots(date).filter((m) => !isPastSlot(date, m)).map((m) => {
    const t = toHHMM(m);
    const taken = DB.isTaken(date, t);
    return `<option value="${t}" ${taken ? 'disabled' : ''}>${t}${taken ? ' — ocupado' : ''}</option>`;
  });
  const free = opts.filter((o) => !o.includes('disabled')).length;
  sel.innerHTML = opts.length ? opts.join('') : '<option value="">Sem horários neste dia</option>';
  const firstFree = $('option:not([disabled])', sel);
  if (firstFree) sel.value = firstFree.value;
  hint.textContent = `${formatDateLong(date)} · ${free} horário${free === 1 ? '' : 's'} livre${free === 1 ? '' : 's'}`;
}

function syncNewKind() {
  const block = $('input[name="nKind"]:checked').value === 'bloqueio';
  $('#newForm').classList.toggle('is-block', block);
  $('#nSubmit').textContent = block ? 'Bloquear horário' : 'Salvar agendamento';
}

function renderNewServices() {
  const list = [...SERVICES.combos, ...SERVICES.avulsos, ...SERVICES.quimicas];
  $('#nServices').innerHTML = list.map((s) => `
    <label class="chip chip--check"><input type="checkbox" value="${s.id}"><span>${s.name}<small>${s.price != null ? 'R$ ' + brlShort(s.price) : 'consulta'}</small></span></label>`).join('');
}

function submitNew(e) {
  e.preventDefault();
  const block = $('input[name="nKind"]:checked').value === 'bloqueio';
  const date = $('#nDate').value;
  const time = $('#nTime').value;
  const name = $('#nName').value.trim();
  const phone = $('#nPhone').value.trim();
  const items = $$('#nServices input:checked').map((i) => i.value);

  if (!date || !time) return toast('Escolha data e horário');
  if (isPastSlot(date, toMinutes(time))) return toast('Esse horário já passou');
  if (DB.isTaken(date, time)) { renderNewSlots(); return toast('Esse horário já está ocupado'); }
  if (!block && name.length < 2) { $('#nName').focus(); return toast('Digite o nome do cliente'); }
  if (!block && !items.length) return toast('Escolha pelo menos um serviço');

  const prices = items.map((id) => ALL_ITEMS[id].price);
  const saved = DB.add(block
    ? { kind: 'bloqueio', date, time, items: [], total: 0, note: $('#nNote').value.trim(), origin: 'barbeiro' }
    : {
      kind: 'agendamento', date, time, items, name, phone,
      total: prices.reduce((s, p) => s + (p || 0), 0),
      ask: prices.some((p) => p == null),
      pay: 'local', origin: 'barbeiro',
    });

  toast(block ? 'Horário bloqueado ✓' : 'Agendamento criado ✓');
  $('#newForm').reset();
  $('#nDate').value = date;
  panel.filter = date === nowLocal().iso ? 'hoje' : 'proximos';
  panel.highlight = saved.id;
  showPanelTab('agenda');
  renderPanel();
  // Atualiza o agendamento do site caso esteja aberto na etapa 2
  if (bookingStep() === 2) { renderDays(); renderSlots(); }
}

/* ----------------------------------------------------------
   INIT
   ---------------------------------------------------------- */
function initPanel() {
  const el = $('#panel');
  renderNewServices();
  maskPhone($('#nPhone'));

  $('#panelClose').addEventListener('click', () => closeModal(el));
  $('#panelLogout').addEventListener('click', logout);

  el.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-ptab], [data-ptab-go]');
    if (tab) showPanelTab(tab.dataset.ptab || tab.dataset.ptabGo);

    const f = e.target.closest('[data-filter]');
    if (f) { panel.filter = f.dataset.filter; renderPanel(); }

    const act = e.target.closest('[data-act]');
    if (act) {
      const b = DB.get(act.dataset.id);
      if (act.dataset.act === 'done') { DB.update(b.id, { status: 'concluido' }); toast('Atendimento concluído ✓'); }
      if (act.dataset.act === 'cancel') {
        if (!confirm(b.kind === 'bloqueio' ? 'Liberar este horário?' : `Cancelar o horário de ${b.name}?`)) return;
        DB.update(b.id, { status: 'cancelado' });
        toast(b.kind === 'bloqueio' ? 'Horário liberado' : 'Agendamento cancelado');
      }
      if (act.dataset.act === 'restore') {
        if (DB.isTaken(b.date, b.time, b.id)) return toast('Esse horário já foi ocupado por outro cliente');
        DB.update(b.id, { status: 'agendado' });
        toast('Agendamento reaberto');
      }
      renderPanel();
      renderNextBooking();
    }
  });

  $('#nDate').addEventListener('change', renderNewSlots);
  $$('input[name="nKind"]').forEach((r) => r.addEventListener('change', syncNewKind));
  $('#newForm').addEventListener('submit', submitNew);

  // Atualiza a agenda se outro separador do navegador mudar os dados
  window.addEventListener('storage', (e) => {
    if (e.key === 'corteza_agenda_v1' && !el.hidden) renderPanel();
  });
}
