/* ==========================================================
   Painel do barbeiro: agenda, novo horário/bloqueio e renda
   ========================================================== */

const panel = { tab: 'agenda', filter: 'hoje', highlight: null, report: 'dia', doneId: null };

function openPanel() {
  const u = Auth.user();
  if (!u || u.role !== 'barbeiro') return;
  $('#panelUser').textContent = u.name;
  openModal($('#panel'));
  showView('geral'); // área administrativa (js/admin.js)
}

function showPanelTab(tab) {
  panel.tab = tab;
  $$('[data-ptab]').forEach((b) => b.classList.toggle('is-active', b.dataset.ptab === tab));
  $$('[data-ppane]').forEach((p) => {
    const show = p.dataset.ppane === tab;
    p.hidden = !show;
    if (show) { p.classList.remove('pane-in'); void p.offsetWidth; p.classList.add('pane-in'); }
  });
  if (tab === 'agenda') renderPanel();
  if (tab === 'novo') { prepareNewForm(); SmartFit.render(); }
}

/** Redesenha o que estiver visível depois de uma mudança nos dados */
function refreshPanel() {
  renderPanelStats();
  if (admin.view === 'geral') { Overview.render(); renderReport(); }
  if (admin.view === 'agenda') { renderAgendaStatus(); if (panel.tab === 'agenda') renderPanel(); }
  if (admin.view === 'estoque') Stock.render();
  renderNextBooking();
  if (bookingStep() === 2) { renderDays(); renderSlots(); }
}

/* ----------------------------------------------------------
   RESUMO NO TOPO
   ---------------------------------------------------------- */
const sumAmount = (list) => list.reduce((s, r) => s + r.amount, 0);

function renderPanelStats() {
  const now = nowLocal();
  const all = DB.all().filter((b) => b.kind === 'agendamento' && b.status !== 'cancelado' && !b.demo);
  const hoje = all.filter((b) => b.date === now.iso);
  const pendentes = hoje.filter((b) => b.status === 'agendado');
  const previsto = pendentes.reduce((s, b) => s + (b.total || 0), 0);
  const revenue = DB.revenue();
  const faturadoHoje = sumAmount(revenue.filter((r) => r.date === now.iso));
  const month = now.iso.slice(0, 7);
  const doMes = revenue.filter((r) => r.date.startsWith(month));
  const feitos = hoje.filter((b) => b.status === 'concluido').length;
  $('#panelStats').innerHTML = `
    <div class="stat"><span>Hoje</span><b>${hoje.length}</b><small>${feitos} concluído${feitos === 1 ? '' : 's'}</small></div>
    <div class="stat"><span>A receber hoje</span><b>${brl(previsto)}</b><small>${pendentes.length} pendente${pendentes.length === 1 ? '' : 's'}</small></div>
    <div class="stat stat--money"><span>Faturado hoje</span><b>${brl(faturadoHoje)}</b><small>atendimentos concluídos</small></div>
    <div class="stat stat--money"><span>Faturado no mês</span><b>${brl(sumAmount(doMes))}</b><small>${doMes.length} atendimento${doMes.length === 1 ? '' : 's'} em ${MONTH_NAME[now.m - 1]}</small></div>`;
}

/* ----------------------------------------------------------
   AGENDA
   ---------------------------------------------------------- */
/* Filtros de data da agenda */
const AGENDA_FILTERS = {
  hoje: { label: 'Hoje', from: 0, to: 0 },
  amanha: { label: 'Amanhã', from: 1, to: 1 },
  semana: { label: 'Esta Semana', from: 0, to: 6 },
  todos: { label: 'Ver Todos' },
};

/** Intervalo de datas do filtro atual (null = sem limite) */
function filterRange(filter = panel.filter) {
  const f = AGENDA_FILTERS[filter];
  if (!f || f.from == null) return null;
  const today = nowLocal().iso;
  return { from: addDays(today, f.from).iso, to: addDays(today, f.to).iso };
}

/** Agendamentos do filtro: Hoje, Amanhã e Esta Semana sem cancelados; Ver Todos com tudo */
function filteredBookings() {
  const all = DB.all().filter((b) => !b.demo);
  const range = filterRange();
  if (range) return all.filter((b) => b.date >= range.from && b.date <= range.to && b.status !== 'cancelado');
  // Ver Todos: de hoje em diante (ordem cronológica) e depois o histórico (mais recente primeiro)
  const today = nowLocal().iso;
  return [...all.filter((b) => b.date >= today), ...all.filter((b) => b.date < today).reverse()];
}

function bookingRow(b, i) {
  const block = b.kind === 'bloqueio';
  const d = addDays(b.date, 0);
  const dateChip = `${WEEK_SHORT[d.dow]} · ${pad(d.d)}/${pad(d.m + 1)}`;
  const value = block ? '' : b.status === 'concluido'
    ? `<span class="pbk__value pbk__value--paid">${brl(b.amount || 0)}<small>recebido${b.method ? ' · ' + esc(b.method) : ''}</small></span>`
    : `<span class="pbk__value">${b.total ? brl(b.total) : 'Sob consulta'}<small>${b.pay === 'pix' ? (b.paid ? 'Pix pago' : 'Pix') : 'na barbearia'}</small></span>`;
  const badgeCls = block ? (b.status === 'agendado' ? 'bloqueio' : 'cancelado') : b.status;
  const badgeTxt = block ? (b.status === 'agendado' ? 'Bloqueado' : 'Liberado') : STATUS_LABEL[b.status];
  // Mensagens do barbeiro (js/messages.js): cada botão abre o WhatsApp com o texto dele
  const msgBtn = (key, label) => {
    const href = Messages.link(key, b.phone, Messages.bookingData(b));
    return href ? `<a class="icon-btn icon-btn--whats" href="${href}" target="_blank" rel="noopener" aria-label="${label} para ${esc(b.name)} pelo WhatsApp">${label}</a>` : '';
  };
  const wa = block ? '' : b.status === 'agendado' ? msgBtn('confirm', 'Confirmar') + msgBtn('noshow', 'Lembrete')
    : b.status === 'concluido' ? msgBtn('review', 'Pedir avaliação')
    : msgBtn('cancel', 'Avisar cliente');
  return `
    <article class="pbk pbk--${b.status} ${block ? 'pbk--block' : ''} ${panel.highlight === b.id ? 'is-new' : ''}" style="--i:${i}" data-booking="${b.id}">
      <div class="pbk__time"><span class="pbk__date">${dateChip}</span>${b.time}${b.endTime ? `<small>até ${b.endTime}</small>` : ''}</div>
      <div class="pbk__main">
        <strong>${block ? 'Horário bloqueado' : esc(b.name)}</strong>
        <span>${esc(block ? (b.note || 'Indisponível para clientes') : bookingItemsText(b))}</span>
      </div>
      ${value}
      <span class="badge badge--${badgeCls}">${badgeTxt}</span>
      <div class="pbk__actions">
        ${b.status === 'agendado' && !block ? `<button class="icon-btn icon-btn--ok" data-act="done" data-id="${b.id}">✓ Marcar como Concluído</button>` : ''}
        ${b.status === 'agendado' ? `<button class="icon-btn" data-act="cancel" data-id="${b.id}">${block ? 'Liberar' : 'Cancelar'}</button>` : ''}
        ${b.status !== 'agendado' && !block ? `<button class="icon-btn" data-act="restore" data-id="${b.id}">${b.status === 'concluido' ? 'Desfazer' : 'Reabrir'}</button>` : ''}
        ${wa}
      </div>
    </article>`;
}

function renderPanel() {
  renderWaitlistPanel();
  $$('[data-filter]').forEach((b) => b.classList.toggle('is-active', b.dataset.filter === panel.filter));
  const list = filteredBookings();
  const today = nowLocal().iso;
  const range = filterRange();

  // Resumo do período: horários, previsto e recebido
  const appts = list.filter((b) => b.kind === 'agendamento' && b.status !== 'cancelado');
  const previsto = appts.filter((b) => b.status === 'agendado').reduce((t, b) => t + (b.total || 0), 0);
  const recebido = appts.filter((b) => b.status === 'concluido').reduce((t, b) => t + (b.amount || 0), 0);
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const rangeTxt = !range ? 'Todos os horários' : range.from === range.to ? cap(formatDateLong(range.from)) : `${fmtShortDate(range.from)} a ${fmtShortDate(range.to)}`;
  const hasSamples = DB.all().some((b) => b.sample);
  $('#agendaSummary').innerHTML = `
    <span class="agenda-summary__range">${rangeTxt}</span>
    <span><b>${appts.length}</b> horário${appts.length === 1 ? '' : 's'}</span>
    <span><b>${brl(previsto)}</b> a receber</span>
    <span class="agenda-summary__paid"><b>${brl(recebido)}</b> recebido</span>
    ${hasSamples ? '<button class="btn btn--text btn--sm" data-agenda-clear-samples>Remover exemplos</button>' : ''}`;

  const box = $('#panelList');
  const groups = {};
  list.forEach((b) => (groups[b.date] = groups[b.date] || []).push(b));

  // Esta Semana mostra os 7 dias, inclusive os livres e fechados (para planejar)
  let dates = Object.keys(groups);
  if (panel.filter === 'semana') dates = Array.from({ length: 7 }, (_, i) => addDays(today, i).iso);

  if (!dates.length) {
    const msg = { hoje: 'Nenhum horário para hoje.', amanha: 'Nenhum horário para amanhã.', todos: 'A agenda está vazia.' }[panel.filter];
    box.innerHTML = `<div class="empty">${msg}<br><button class="btn btn--dark btn--sm" data-ptab-go="novo">+ Novo horário</button></div>`;
    panel.highlight = null;
    return;
  }

  let n = 0;
  box.innerHTML = dates.map((date) => {
    const items = groups[date] || [];
    const d = addDays(date, 0);
    const open = !!CONFIG.hours[d.dow];
    const dayAppts = items.filter((b) => b.kind === 'agendamento' && b.status !== 'cancelado');
    const dayTotal = dayAppts.reduce((t, b) => t + (b.status === 'concluido' ? (b.amount || 0) : (b.total || 0)), 0);
    const title = `${date === today ? 'Hoje · ' : date === addDays(today, 1).iso ? 'Amanhã · ' : ''}${formatDateLong(date)}`;
    const meta = !open && !items.length ? 'Fechado'
      : `${dayAppts.length} horário${dayAppts.length === 1 ? '' : 's'}${dayAppts.length ? ' · ' + brl(dayTotal) : ''}`;
    const body = items.length ? items.map((b) => bookingRow(b, n++)).join('')
      : `<p class="pday__empty">${open ? 'Dia livre: nenhum horário marcado.' : 'Barbearia fechada.'}</p>`;
    return `
      <section class="pday ${!open && !items.length ? 'pday--closed' : ''}">
        <h4><span>${title}</span><small>${meta}</small></h4>
        ${body}
      </section>`;
  }).join('');
  panel.highlight = null;
}

/* ----------------------------------------------------------
   CONCLUIR ATENDIMENTO (lança o valor no faturamento)
   ---------------------------------------------------------- */
/** Concluir: soma o valor no faturamento e dá baixa nos produtos do atendimento */
function completeBooking(id, amount, method) {
  const b = DB.get(id);
  DB.complete(id, amount, method);
  const moved = (b.items || []).filter((it) => ALL_ITEMS[it] && ALL_ITEMS[it].type === 'produto')
    .map((it) => Stock.moveByProduct(it, -1)).filter(Boolean);
  const low = moved.filter((p) => p.qty <= LOW_STOCK);
  toast(`Concluído · ${brl(amount)} somado ao faturamento ✓${moved.length ? ` · ${moved.length} produto${moved.length === 1 ? '' : 's'} baixado${moved.length === 1 ? '' : 's'} do estoque` : ''}`);
  if (low.length) setTimeout(() => toast(`⚠️ Estoque baixo: ${low.map((p) => `${p.name} (${p.qty})`).join(', ')}`), 2500);
  refreshPanel();
}

/** Clique em "Marcar como Concluído" */
function markDone(id) {
  const b = DB.get(id);
  if (b.total > 0 && !b.ask) {
    completeBooking(id, b.total, b.pay === 'pix' && b.paid ? 'Pix' : null);
    const row = document.querySelector(`[data-booking="${id}"]`);
    if (row) { row.classList.add('just-done'); }
    return;
  }
  openDone(id); // serviço sob consulta: pergunta o valor cobrado
}

function openDone(id) {
  const b = DB.get(id);
  panel.doneId = id;
  $('#doneWho').textContent = `${b.name} · ${formatDateLong(b.date)} às ${b.time}`;
  $('#doneItems').textContent = bookingItemsText(b);
  $('#doneAmount').value = b.total ? b.total.toFixed(2).replace('.', ',') : '';
  $('#doneAsk').hidden = !b.ask;
  $('#doneMethod').value = b.pay === 'pix' ? 'Pix' : 'Dinheiro';
  openModal($('#doneModal'));
  setTimeout(() => { $('#doneAmount').focus(); $('#doneAmount').select(); }, 80);
}

function confirmDone(e) {
  e.preventDefault();
  const raw = $('#doneAmount').value.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.');
  const amount = parseFloat(raw);
  if (!(amount >= 0) || raw === '') { toast('Digite o valor recebido'); $('#doneAmount').focus(); return; }
  closeModal($('#doneModal'));
  completeBooking(panel.doneId, amount, $('#doneMethod').value);
}

/* ----------------------------------------------------------
   RELATÓRIO DE RENDA
   ---------------------------------------------------------- */
const MONTH_NAME = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Segunda-feira da semana de uma data ISO */
function weekStart(iso) {
  const { dow } = addDays(iso, 0);
  return addDays(iso, -((dow + 6) % 7)).iso;
}

function sumBy(entries, keyFn) {
  const map = {};
  entries.forEach((r) => { const k = keyFn(r.date); map[k] = (map[k] || 0) + r.amount; });
  return map;
}

/** Variação percentual formatada (ou null) */
function delta(cur, prev) {
  if (!prev) return null;
  const p = ((cur - prev) / prev) * 100;
  return { txt: `${p >= 0 ? '▲' : '▼'} ${Math.abs(p).toFixed(0)}%`, up: p >= 0 };
}

function tile(label, value, sub, d) {
  return `<div class="rtile"><span>${label}</span><b>${value}</b>
    <small>${d ? `<em class="${d.up ? 'up' : 'down'}">${d.txt}</em> ` : ''}${sub}</small></div>`;
}

/** Gráfico de barras simples (uma série). bars: [{ label, full, value, current, closed }] */
function barChart(title, bars) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  const nice = niceMax(max);
  const grid = [1, 0.5].map((f) => `<div class="chart__grid" style="bottom:${f * 100}%"><span>${brlCompact(nice * f)}</span></div>`).join('');
  const cols = bars.map((b, i) => {
    const h = (b.value / nice) * 100;
    return `
      <div class="chart__col ${b.current ? 'is-current' : ''} ${b.closed ? 'is-closed' : ''}" tabindex="0" style="--i:${i};--h:${h}%"
           aria-label="${b.full}: ${brl(b.value)}">
        <div class="chart__bar">
          ${b.current && b.value ? `<span class="chart__val">${brlCompact(b.value)}</span>` : ''}
        </div>
        <div class="chart__tip"><b>${brl(b.value)}</b>${b.full}</div>
        <span class="chart__x">${b.label}</span>
      </div>`;
  }).join('');
  const rows = bars.map((b) => `<tr><td>${b.full}</td><td>${brl(b.value)}</td></tr>`).join('');
  return `
    <figure class="chart">
      <figcaption>${title}</figcaption>
      <div class="chart__plot">${grid}<div class="chart__cols" style="--n:${bars.length}">${cols}</div></div>
      <details class="chart__table"><summary>Ver em tabela</summary>
        <table><thead><tr><th>Período</th><th>Faturamento</th></tr></thead><tbody>${rows}</tbody></table>
      </details>
    </figure>`;
}

function niceMax(v) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}
const brlCompact = (v) => (v >= 1000 ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : `R$ ${Math.round(v)}`);

function renderReport() {
  $$('[data-report]').forEach((b) => b.classList.toggle('is-active', b.dataset.report === panel.report));
  const entries = DB.revenue();
  const hasDemo = DB.all().some((b) => b.demo);
  $('#demoData').innerHTML = hasDemo
    ? '<span>Exibindo dados de exemplo.</span> <button class="btn btn--text btn--sm" data-demo-data="clear">Apagar exemplos</button>'
    : `<span>${entries.length ? 'Quer ver o relatório com mais histórico?' : 'Ainda não há atendimentos concluídos.'}</span> <button class="btn btn--dark btn--sm" data-demo-data="seed">Gerar dados de exemplo</button>`;

  const today = nowLocal().iso;
  const out = $('#reportBody');
  let html = '';

  if (panel.report === 'dia') {
    const byDay = sumBy(entries, (d) => d);
    const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
    const vals = days.map((d) => byDay[d.iso] || 0);
    const hoje = byDay[today] || 0;
    let back = 1;
    while (back < 7 && !CONFIG.hours[addDays(today, -back).dow]) back++;
    const ultimo = addDays(today, -back).iso;
    const ontem = byDay[ultimo] || 0;
    const abertos = days.filter((d) => CONFIG.hours[d.dow] && d.iso < today);
    const media = abertos.length ? abertos.reduce((s, d) => s + (byDay[d.iso] || 0), 0) / abertos.length : 0;
    html += `<div class="rtiles">
      ${tile('Hoje', brl(hoje), back === 1 ? 'vs. ontem' : 'vs. último dia aberto', delta(hoje, ontem))}
      ${tile(back === 1 ? 'Ontem' : 'Último dia aberto', brl(ontem), formatDateLong(ultimo))}
      ${tile('Média por dia aberto', brl(media), 'últimos 13 dias')}
    </div>`;
    html += barChart('Faturamento dos últimos 14 dias', days.map((d, i) => ({
      label: `${pad(d.d)}/${pad(d.m + 1)}`,
      full: `${formatDateLong(d.iso)}${d.iso === today ? ' (hoje)' : ''}${!CONFIG.hours[d.dow] ? ' · fechado' : ''}`,
      value: vals[i], current: d.iso === today, closed: !CONFIG.hours[d.dow],
    })));
  }

  if (panel.report === 'semana') {
    const byWeek = sumBy(entries, weekStart);
    const cur = weekStart(today);
    const weeks = Array.from({ length: 8 }, (_, i) => addDays(cur, (i - 7) * 7).iso);
    const esta = byWeek[cur] || 0;
    const dias = Math.round((Date.parse(today) - Date.parse(cur)) / 864e5); // 0 = segunda
    const passadaAteHoje = entries.filter((r) => r.date >= addDays(cur, -7).iso && r.date <= addDays(cur, dias - 7).iso)
      .reduce((s, r) => s + r.amount, 0);
    const passada = byWeek[addDays(cur, -7).iso] || 0;
    const byDay = sumBy(entries, (d) => d);
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(cur, i));
    html += `<div class="rtiles">
      ${tile('Esta semana', brl(esta), 'vs. mesmos dias da semana passada', delta(esta, passadaAteHoje))}
      ${tile('Semana passada', brl(passada), `${fmtShort(addDays(cur, -7).iso)} a ${fmtShort(addDays(cur, -1).iso)}`)}
      ${tile('Média das 8 semanas', brl(weeks.reduce((s, w) => s + (byWeek[w] || 0), 0) / 8), 'por semana')}
    </div>`;
    html += barChart(`Semana atual · ${fmtShort(cur)} a ${fmtShort(addDays(cur, 6).iso)}`, weekDays.map((d) => ({
      label: WEEK_SHORT[d.dow],
      full: `${formatDateLong(d.iso)}${!CONFIG.hours[d.dow] ? ' · fechado' : ''}`,
      value: byDay[d.iso] || 0, current: d.iso === today, closed: !CONFIG.hours[d.dow],
    })));
    html += barChart('Semana a semana (últimas 8)', weeks.map((w) => ({
      label: fmtShort(w),
      full: `Semana de ${fmtShort(w)} a ${fmtShort(addDays(w, 6).iso)}`,
      value: byWeek[w] || 0, current: w === cur,
    })));
  }

  if (panel.report === 'mes') {
    const byMonth = sumBy(entries, (d) => d.slice(0, 7));
    const now = nowLocal();
    const months = Array.from({ length: 12 }, (_, i) => {
      const dt = new Date(Date.UTC(now.y, now.m - 1 - (11 - i), 1));
      return { key: dt.toISOString().slice(0, 7), m: dt.getUTCMonth(), y: dt.getUTCFullYear() };
    });
    const cur = months[11], prev = months[10];
    const este = byMonth[cur.key] || 0, passado = byMonth[prev.key] || 0;
    const passadoAteHoje = entries.filter((r) => r.date.startsWith(prev.key) && +r.date.slice(8) <= now.d)
      .reduce((s, r) => s + r.amount, 0);
    const atend = DB.all().filter((b) => b.status === 'concluido' && b.amount > 0 && (b.paidDate || b.date).startsWith(cur.key)).length;
    html += `<div class="rtiles">
      ${tile('Este mês', brl(este), `vs. 1 a ${now.d} de ${MONTH_NAME[prev.m]}`, delta(este, passadoAteHoje))}
      ${tile('Mês passado', brl(passado), `${MONTH_NAME[prev.m]} de ${prev.y}`)}
      ${tile('Ticket médio', brl(atend ? este / atend : 0), `${atend} atendimento${atend === 1 ? '' : 's'} no mês`)}
    </div>`;
    html += barChart('Histórico mensal (últimos 12 meses)', months.map((mo) => ({
      label: MONTH_SHORT[mo.m],
      full: `${MONTH_NAME[mo.m]} de ${mo.y}`,
      value: byMonth[mo.key] || 0, current: mo.key === cur.key,
    })));
  }

  out.innerHTML = html;
}

const fmtShort = (iso) => { const d = addDays(iso, 0); return `${pad(d.d)}/${pad(d.m + 1)}`; };

/** Dados de exemplo para apresentar o relatório (marcados com demo: true) */
function seedDemoData() {
  const today = nowLocal().iso;
  const priced = [...SERVICES.combos, ...SERVICES.avulsos].filter((s) => s.price);
  const names = ['Rafael', 'Bruno', 'Diego', 'Lucas', 'Matheus', 'Thiago', 'Felipe', 'André', 'Caio', 'Vitor'];
  const methods = ['Pix', 'Pix', 'Cartão', 'Dinheiro'];
  const items = [];
  for (let i = 1; i <= 330; i++) {
    const day = addDays(today, -i);
    const h = CONFIG.hours[day.dow];
    if (!h) continue;
    const n = 3 + Math.floor(Math.random() * (day.dow === 6 ? 8 : 5));
    const slots = daySlots(day.iso).sort(() => Math.random() - 0.5).slice(0, n).sort((a, b) => a - b);
    slots.forEach((m) => {
      const s = priced[Math.floor(Math.random() * priced.length)];
      items.push({
        demo: true, kind: 'agendamento', status: 'concluido', origin: 'barbeiro',
        date: day.iso, time: toHHMM(m), items: [s.id], total: s.price, ask: false, pay: 'local',
        name: names[Math.floor(Math.random() * names.length)] + ' (exemplo)', phone: '',
        amount: s.price, method: methods[Math.floor(Math.random() * methods.length)], paidDate: day.iso,
      });
    });
  }
  DB.addMany(items);
}

/* ----------------------------------------------------------
   NOVO HORÁRIO / BLOQUEIO POR INTERVALO
   ---------------------------------------------------------- */
const isBlockMode = () => $('input[name="nKind"]:checked').value === 'bloqueio';

function prepareNewForm() {
  const today = nowLocal().iso;
  const d = $('#nDate');
  d.min = today;
  if (!d.value || d.value < today) {
    for (let i = 0; i < 30; i++) {
      const day = addDays(today, i).iso;
      if (daySlots(day).some((m) => !isPastSlot(day, m) && !DB.isTaken(day, toHHMM(m)))) { d.value = day; break; }
    }
  }
  syncNewKind();
}

/** Atualiza horários do formulário conforme a data e o modo */
function renderNewSlots() {
  const date = $('#nDate').value;
  const hint = $('#nDateHint');
  const sel = $('#nTime'), start = $('#nStart');
  const fail = (msg, h = '') => {
    [sel, start, $('#nEnd')].forEach((s) => (s.innerHTML = `<option value="">${msg}</option>`));
    hint.textContent = h;
  };
  if (!date) return fail('Escolha a data');
  const dow = addDays(date, 0).dow;
  if (!CONFIG.hours[dow]) return fail('Fechado', `A barbearia não abre ${WEEK[dow]}.`);

  const future = daySlots(date).filter((m) => !isPastSlot(date, m));
  if (!future.length) return fail('Sem horários', 'Não há mais horários neste dia.');
  const free = future.filter((m) => !DB.isTaken(date, toHHMM(m)));

  // Agendar cliente: um horário
  sel.innerHTML = future.map((m) => {
    const t = toHHMM(m), taken = DB.isTaken(date, t);
    return `<option value="${t}" ${taken ? 'disabled' : ''}>${t}${taken ? ' — ocupado' : ''}</option>`;
  }).join('');
  const firstFree = $('option:not([disabled])', sel);
  if (firstFree) sel.value = firstFree.value;

  // Bloqueio: início
  const prevStart = start.value;
  start.innerHTML = future.map((m) => {
    const t = toHHMM(m), taken = DB.isTaken(date, t);
    return `<option value="${t}">${t}${taken ? ' — ocupado' : ''}</option>`;
  }).join('');
  start.value = future.map(toHHMM).includes(prevStart) ? prevStart : toHHMM(free[0] ?? future[0]);
  renderEndOptions();

  hint.textContent = `${formatDateLong(date)} · ${free.length} horário${free.length === 1 ? '' : 's'} livre${free.length === 1 ? '' : 's'}`;
}

/** Término: de início + 30 min até o fechamento */
function renderEndOptions() {
  const date = $('#nDate').value;
  const start = $('#nStart').value;
  const end = $('#nEnd');
  if (!date || !start || !CONFIG.hours[addDays(date, 0).dow]) return;
  const close = CONFIG.hours[addDays(date, 0).dow][1] * 60;
  const prev = end.value;
  const opts = [];
  for (let m = toMinutes(start) + CONFIG.slotMinutes; m <= close; m += CONFIG.slotMinutes) opts.push(toHHMM(m));
  end.innerHTML = opts.map((t) => `<option value="${t}">${t}</option>`).join('');
  end.value = opts.includes(prev) ? prev : opts[Math.min(1, opts.length - 1)];
  updateRangeHint();
}

/** Slots (HH:MM) contidos no intervalo [início, término) */
function rangeSlots(date, start, end) {
  return daySlots(date).map(toHHMM).filter((t) => t >= start && t < end);
}

function updateRangeHint() {
  const date = $('#nDate').value, start = $('#nStart').value, end = $('#nEnd').value;
  const el = $('#nRangeHint');
  if (!start || !end) { el.textContent = ''; return; }
  const slots = rangeSlots(date, start, end);
  const busy = slots.filter((t) => DB.isTaken(date, t));
  el.innerHTML = `Vai bloquear <b>${slots.length} horário${slots.length === 1 ? '' : 's'}</b>: ${slots.join(', ')}`
    + (busy.length ? `<br><span class="warn">Já ocupado${busy.length === 1 ? '' : 's'}: ${busy.join(', ')}</span>` : '');
}

function syncNewKind() {
  const block = isBlockMode();
  $('#newForm').classList.toggle('is-block', block);
  $('#nSubmit').textContent = block ? 'Bloquear intervalo' : 'Salvar agendamento';
  renderNewSlots();
}

function renderNewServices() {
  const box = $('#nServices');
  if (!box || typeof Catalog === 'undefined') return;
  const checked = $$('input:checked', box).map((i) => i.value);
  box.innerHTML = Catalog.list().map((s) => `
    <label class="chip chip--check"><input type="checkbox" value="${s.id}" ${checked.includes(s.id) ? 'checked' : ''}><span>${esc(s.name)}<small>${s.price != null ? 'R$ ' + brlShort(s.price) : 'consulta'}</small></span></label>`).join('');
}

function submitNew(e) {
  e.preventDefault();
  const date = $('#nDate').value;
  let saved;

  if (isBlockMode()) {
    const start = $('#nStart').value, end = $('#nEnd').value;
    if (!date || !start || !end) return toast('Escolha o início e o término');
    if (isPastSlot(date, toMinutes(start))) return toast('O início já passou');
    const slots = rangeSlots(date, start, end);
    const busy = slots.filter((t) => DB.isTaken(date, t));
    if (busy.length === slots.length) return toast('Todos os horários desse intervalo já estão ocupados');
    if (busy.length && !confirm(`Já existe agendamento em ${busy.join(', ')}. Esses clientes continuam marcados. Bloquear os demais horários do intervalo?`)) return;
    saved = DB.add({ kind: 'bloqueio', date, time: start, endTime: end, items: [], total: 0, note: $('#nNote').value.trim(), origin: 'barbeiro' });
    toast(`Bloqueado das ${start} às ${end} ✓`);
  } else {
    const time = $('#nTime').value;
    const name = $('#nName').value.trim();
    const items = $$('#nServices input:checked').map((i) => i.value);
    if (!date || !time) return toast('Escolha data e horário');
    if (isPastSlot(date, toMinutes(time))) return toast('Esse horário já passou');
    if (DB.isTaken(date, time)) { renderNewSlots(); return toast('Esse horário já está ocupado'); }
    if (name.length < 2) { $('#nName').focus(); return toast('Digite o nome do cliente'); }
    if (!items.length) return toast('Escolha pelo menos um serviço');
    const prices = items.map((id) => (Catalog.get(id) || ALL_ITEMS[id] || {}).price ?? null);
    saved = DB.add({
      kind: 'agendamento', date, time, items, name, phone: $('#nPhone').value.trim(),
      total: prices.reduce((s, p) => s + (p || 0), 0), ask: prices.some((p) => p == null),
      pay: 'local', origin: 'barbeiro',
    });
    toast('Agendamento criado ✓');
  }

  const kind = $('input[name="nKind"]:checked').value;
  $('#newForm').reset();
  $(`input[name="nKind"][value="${kind}"]`).checked = true;
  $('#nDate').value = date;
  const today = nowLocal().iso;
  panel.filter = date === today ? 'hoje' : date === addDays(today, 1).iso ? 'amanha' : date <= addDays(today, 6).iso ? 'semana' : 'todos';
  panel.highlight = saved.id;
  showPanelTab('agenda');
  refreshPanel();
}

/* ----------------------------------------------------------
   INIT
   ---------------------------------------------------------- */
function initPanel() {
  const el = $('#panel');
  maskPhone($('#nPhone'));

  $('#panelClose').addEventListener('click', () => closeModal(el));
  $('#panelLogout').addEventListener('click', logout);

  el.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-ptab], [data-ptab-go]');
    if (tab) {
      if (admin.view !== 'agenda') showView('agenda');
      showPanelTab(tab.dataset.ptab || tab.dataset.ptabGo);
    }

    const f = e.target.closest('[data-filter]');
    if (f) { panel.filter = f.dataset.filter; renderPanel(); }

    if (e.target.closest('[data-agenda-clear-samples]') && confirm('Remover os horários de exemplo da agenda?')) {
      AgendaSeed.clear();
      refreshPanel();
    }

    const r = e.target.closest('[data-report]');
    if (r) { panel.report = r.dataset.report; renderReport(); }

    const demo = e.target.closest('[data-demo-data]');
    if (demo) {
      if (demo.dataset.demoData === 'seed') { seedDemoData(); toast('Dados de exemplo gerados'); }
      else if (confirm('Apagar todos os dados de exemplo?')) { DB.removeWhere((b) => b.demo); toast('Exemplos apagados'); }
      refreshPanel();
    }

    const act = e.target.closest('[data-act]');
    if (act) {
      const b = DB.get(act.dataset.id);
      if (act.dataset.act === 'done') return markDone(b.id);
      if (act.dataset.act === 'cancel') {
        if (!confirm(b.kind === 'bloqueio' ? `Liberar ${b.endTime ? `das ${b.time} às ${b.endTime}` : 'este horário'}?` : `Cancelar o horário de ${b.name}?`)) return;
        DB.update(b.id, { status: 'cancelado' });
        toast(b.kind === 'bloqueio' ? 'Horário liberado' : 'Agendamento cancelado');
      }
      if (act.dataset.act === 'restore') {
        if (b.status === 'cancelado' && DB.isTaken(b.date, b.time, b.id)) return toast('Esse horário já foi ocupado');
        const wasDone = b.status === 'concluido';
        DB.reopen(b.id);
        // Desfazer a conclusão devolve os produtos ao estoque
        if (wasDone) (b.items || []).filter((it) => ALL_ITEMS[it] && ALL_ITEMS[it].type === 'produto').forEach((it) => Stock.moveByProduct(it, 1));
        toast(wasDone ? `Desfeito · ${brl(b.amount || 0)} retirado do faturamento` : 'Agendamento reaberto');
      }
      refreshPanel();
    }
  });

  // Modal de conclusão
  const dm = $('#doneModal');
  $$('[data-close]', dm).forEach((b) => b.addEventListener('click', () => closeModal(dm)));
  $('#doneForm').addEventListener('submit', confirmDone);

  $('#nDate').addEventListener('change', renderNewSlots);
  $('#nStart').addEventListener('change', renderEndOptions);
  $('#nEnd').addEventListener('change', updateRangeHint);
  $$('input[name="nKind"]').forEach((r) => r.addEventListener('change', syncNewKind));
  $('#newForm').addEventListener('submit', submitNew);

  // Atualiza se outra aba do navegador mudar os dados
  window.addEventListener('storage', (e) => {
    if (e.key === 'corteza_agenda_v1' && !el.hidden) refreshPanel();
  });
}
