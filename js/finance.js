/* ==========================================================
   Financeiro — extrato da barbearia
   - Entradas: atendimentos concluídos (automático) + lançamentos
   - Saídas: despesas avulsas e contas fixas (repetem todo mês)
   - Lançar em 3 toques: Saída → valor → categoria → Salvar
   - Planilha CSV do mês para o contador
   ========================================================== */

const Finance = (() => {
  const KEY = 'corteza_lancamentos_v1';

  const CATS = {
    despesa: [
      ['Aluguel', '🏠'], ['Energia', '💡'], ['Água', '💧'], ['Internet e telefone', '📶'],
      ['Produtos e insumos', '🧴'], ['Compra de estoque', '📦'], ['Impostos / MEI', '🧾'], ['Contador', '📊'],
      ['Marketing', '📣'], ['Equipamentos', '🪒'], ['Manutenção', '🔧'], ['Pró-labore', '👤'],
      ['Transporte', '🚗'], ['Alimentação', '🍽️'], ['Outros', '•'],
    ],
    receita: [['Venda de produto', '🛍️'], ['Serviço fora da agenda', '✂️'], ['Assinatura do clube', '⭐'], ['Outros', '•']],
  };
  const METHODS = ['Pix', 'Dinheiro', 'Débito', 'Crédito', 'Boleto', 'Transferência'];
  const ICON = Object.fromEntries([...CATS.despesa, ...CATS.receita]);

  const state = { month: null, filter: 'tudo', open: {}, sheet: null };

  /* ---------- Dados ---------- */
  const all = () => store(KEY) || [];
  const save = (list) => store(KEY, list);
  const today = () => nowLocal().iso;
  const curMonth = () => state.month || today().slice(0, 7);
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const monthLabel = (ym) => { const [y, m] = ym.split('-').map(Number); return `${MONTH_NAME[m - 1]} de ${y}`; };
  const shiftMonth = (ym, n) => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7); };
  const daysIn = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
  const money = (v) => brl(Math.abs(v));

  /** Lançamentos do mês (cada conta fixa gera a ocorrência do mês) */
  function entriesOf(ym) {
    const out = [];
    all().forEach((e) => {
      if (e.recurring) {
        const start = e.date.slice(0, 7);
        if (ym < start || (e.endMonth && ym > e.endMonth)) return;
        const day = Math.min(+e.date.slice(8), daysIn(ym));
        out.push({ ...e, date: `${ym}-${pad(day)}`, paid: (e.paidMonths || []).includes(ym), occurrence: ym });
      } else if (e.date.startsWith(ym)) out.push(e);
    });
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }

  /** Atendimentos concluídos no mês (entrada automática da agenda) */
  function appointmentsOf(ym) {
    return DB.all().filter((b) => b.status === 'concluido' && b.kind === 'agendamento' && b.amount > 0 && (b.paidDate || b.date).startsWith(ym));
  }

  function totals(ym) {
    const entries = entriesOf(ym);
    const appts = appointmentsOf(ym);
    const apptTotal = appts.reduce((t, b) => t + b.amount, 0);
    const recManual = entries.filter((e) => e.type === 'receita').reduce((t, e) => t + e.value, 0);
    const desp = entries.filter((e) => e.type === 'despesa');
    const despTotal = desp.reduce((t, e) => t + e.value, 0);
    const pendingList = desp.filter((e) => !e.paid);
    const pending = pendingList.reduce((t, e) => t + e.value, 0);
    const receitas = apptTotal + recManual;
    return { entries, appts, apptTotal, recManual, receitas, despTotal, pending, pendingList, resultado: receitas - despTotal };
  }

  /* ==========================================================
     TELA
     ========================================================== */
  function render() {
    const ym = curMonth();
    const t = totals(ym);
    $('#finMonth').textContent = cap(monthLabel(ym));

    // Saldo do mês
    const pct = t.receitas > 0 ? Math.min(100, (t.despTotal / t.receitas) * 100) : (t.despTotal > 0 ? 100 : 0);
    $('#finHero').innerHTML = `
      <span class="money-hero__label">Saldo do mês</span>
      <b class="money-hero__value ${t.resultado < 0 ? 'is-neg' : ''}">${t.resultado < 0 ? '−' : ''}${money(t.resultado)}</b>
      <div class="money-hero__bar" title="Quanto das entradas já saiu"><i style="width:${pct}%"></i></div>
      <div class="money-hero__row">
        <span class="in">▲ Entrou <b>${money(t.receitas)}</b></span>
        <span class="out">▼ Saiu <b>${money(t.despTotal)}</b></span>
        ${t.pending ? `<span class="due">⏳ A pagar <b>${money(t.pending)}</b></span>` : ''}
      </div>`;

    // Contas a pagar
    const due = $('#finDue');
    due.hidden = !t.pendingList.length;
    due.innerHTML = t.pendingList.length ? `
      <h4 class="card-title">Contas a pagar <small>${t.pendingList.length}</small></h4>
      ${t.pendingList.map((e) => {
        const late = e.date < today();
        return `
          <div class="due-row ${late ? 'is-late' : ''}">
            <span class="money-icon">${ICON[e.cat] || '•'}</span>
            <button type="button" class="due-row__main" data-fin-open="${e.id}" data-occ="${e.occurrence || ''}">
              <b>${esc(e.desc)}</b><small>${late ? 'venceu' : 'vence'} ${fmtShortDate(e.date)}${e.recurring ? ' · fixa' : ''}</small>
            </button>
            <span class="due-row__val">${money(e.value)}</span>
            <button type="button" class="btn btn--sm btn--pay" data-fin-pay="${e.id}" data-occ="${e.occurrence || ''}">✓ Pagar</button>
          </div>`;
      }).join('')}` : '';

    $$('[data-fin-filter]').forEach((b) => b.classList.toggle('is-active', b.dataset.finFilter === state.filter));
    renderStatement(ym, t);
    renderCats(t);
    renderFixed(ym);
  }

  /** Extrato agrupado por dia */
  function renderStatement(ym, t) {
    const f = state.filter;
    const rows = [];
    t.entries.forEach((e) => {
      if (f === 'entradas' && e.type !== 'receita') return;
      if (f === 'saidas' && e.type !== 'despesa') return;
      if (f === 'pendentes' && (e.paid || e.type !== 'despesa')) return;
      rows.push({ date: e.date, kind: 'entry', e });
    });
    if (f === 'tudo' || f === 'entradas') {
      const byDay = {};
      t.appts.forEach((b) => { const d = b.paidDate || b.date; (byDay[d] = byDay[d] || []).push(b); });
      Object.entries(byDay).forEach(([date, list]) => rows.push({ date, kind: 'appts', list }));
    }

    const days = {};
    rows.forEach((r) => (days[r.date] = days[r.date] || []).push(r));
    const dates = Object.keys(days).sort().reverse(); // mais recente primeiro
    const tdy = today();
    const yest = addDays(tdy, -1).iso;

    $('#finList').innerHTML = dates.length ? dates.map((date) => {
      const items = days[date];
      const net = items.reduce((s, r) => s + (r.kind === 'appts'
        ? r.list.reduce((a, b) => a + b.amount, 0)
        : (r.e.type === 'receita' ? r.e.value : -r.e.value)), 0);
      const title = date === tdy ? 'Hoje' : date === yest ? 'Ontem' : cap(formatDateLong(date));
      return `
        <section class="money-day">
          <h4><span>${title}</span><small class="${net >= 0 ? 'in' : 'out'}">${net >= 0 ? '+' : '−'} ${money(net)}</small></h4>
          ${items.map((r) => r.kind === 'appts' ? apptsRow(date, r.list) : entryRow(r.e)).join('')}
        </section>`;
    }).join('') : `<p class="empty">${{ tudo: 'Nada lançado neste mês ainda.', entradas: 'Nenhuma entrada neste mês.', saidas: 'Nenhuma saída neste mês.', pendentes: 'Nenhuma conta a pagar. 🎉' }[f]}</p>`;
  }

  function entryRow(e) {
    const isIn = e.type === 'receita';
    return `
      <button type="button" class="money-row ${isIn ? 'is-in' : 'is-out'} ${!e.paid && !isIn ? 'is-due' : ''}" data-fin-open="${e.id}" data-occ="${e.occurrence || ''}">
        <span class="money-icon">${ICON[e.cat] || '•'}</span>
        <span class="money-row__main">
          <b>${esc(e.desc)}</b>
          <small>${esc(e.cat)}${e.method ? ' · ' + esc(e.method) : ''}${e.recurring ? ' · fixa' : ''}${!e.paid ? (isIn ? ' · a receber' : ' · a pagar') : ''}</small>
        </span>
        <span class="money-row__val">${isIn ? '+' : '−'} ${money(e.value)}</span>
      </button>`;
  }

  function apptsRow(date, list) {
    const total = list.reduce((s, b) => s + b.amount, 0);
    const open = !!state.open[date];
    return `
      <button type="button" class="money-row is-in" data-fin-appts="${date}" aria-expanded="${open}">
        <span class="money-icon">✂️</span>
        <span class="money-row__main"><b>Atendimentos</b><small>${list.length} concluído${list.length === 1 ? '' : 's'} na agenda · toque para ${open ? 'esconder' : 'ver'}</small></span>
        <span class="money-row__val">+ ${money(total)}</span>
      </button>
      ${open ? `<div class="money-sub">${list.map((b) => `<div><span>${b.time}</span><span>${esc(b.name)} · ${esc(bookingItemsText(b))}</span><b>${money(b.amount)}</b></div>`).join('')}</div>` : ''}`;
  }

  /** Para onde foi o dinheiro (saídas por categoria) */
  function renderCats(t) {
    const byCat = {};
    t.entries.filter((e) => e.type === 'despesa').forEach((e) => (byCat[e.cat] = (byCat[e.cat] || 0) + e.value));
    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const max = cats.length ? cats[0][1] : 1;
    $('#finCats').innerHTML = cats.length ? cats.map(([c, v]) => `
      <div class="cat-bar">
        <span class="money-icon money-icon--sm">${ICON[c] || '•'}</span>
        <span class="cat-bar__name">${esc(c)}</span>
        <b>${money(v)}</b>
        <small>${Math.round((v / t.despTotal) * 100)}%</small>
        <div class="cat-bar__track"><i style="width:${(v / max) * 100}%"></i></div>
      </div>`).join('') : '<p class="muted">Sem saídas neste mês.</p>';
  }

  /** Contas fixas ativas no mês */
  function renderFixed(ym) {
    const fixed = entriesOf(ym).filter((e) => e.recurring);
    const total = fixed.reduce((s, e) => s + e.value, 0);
    $('#finFixed').innerHTML = fixed.length ? `
      ${fixed.map((e) => `
        <button type="button" class="fixed-row" data-fin-open="${e.id}" data-occ="${e.occurrence}">
          <span class="money-icon money-icon--sm">${ICON[e.cat] || '•'}</span>
          <span class="fixed-row__main"><b>${esc(e.desc)}</b><small>todo dia ${+e.date.slice(8)}</small></span>
          <span class="fixed-row__val">${money(e.value)}</span>
          <span class="pill ${e.paid ? 'pill--ok' : 'pill--due'}">${e.paid ? 'paga' : 'a pagar'}</span>
        </button>`).join('')}
      <p class="fixed-total">Total fixo por mês: <b>${money(total)}</b></p>`
      : '<p class="muted">Nenhuma conta fixa. Ao lançar uma saída, marque “Repetir todo mês”.</p>';
  }

  /* ==========================================================
     LANÇAMENTO (folha de baixo no celular)
     ========================================================== */
  const sheet = () => $('#finSheet');

  /** Valor no estilo caixa eletrônico: os números entram pela direita */
  function setCents(cents) {
    state.sheet.cents = Math.max(0, Math.min(cents, 99999999));
    $('#sValue').value = brl(state.sheet.cents / 100);
  }

  function renderCatChips() {
    const s = state.sheet;
    $('#sCats').innerHTML = CATS[s.type].map(([c, i]) => `
      <button type="button" class="cat-chip ${s.cat === c ? 'is-on' : ''}" data-cat="${c}" aria-pressed="${s.cat === c}">
        <span>${i}</span><small>${c}</small>
      </button>`).join('');
  }

  function renderSheet() {
    const s = state.sheet;
    const isOut = s.type === 'despesa';
    sheet().classList.toggle('is-in', !isOut);
    $('#sTitle').textContent = s.id ? 'Editar lançamento' : isOut ? 'Nova saída' : 'Nova entrada';
    $$('[data-stype]').forEach((b) => b.classList.toggle('is-active', b.dataset.stype === s.type));
    renderCatChips();
    $$('[data-sdate]').forEach((b) => b.classList.toggle('is-active', b.dataset.sdate === s.dateMode));
    $('#sDate').hidden = s.dateMode !== 'outra';
    $$('[data-smethod]').forEach((b) => b.classList.toggle('is-active', b.dataset.smethod === s.method));
    $('#sPaidLabel').textContent = isOut ? 'Já paguei' : 'Já recebi';
    $('#sRecurringWrap').hidden = !isOut;
    $('#sDelete').hidden = !s.id;
  }

  /** Abre a folha: type = despesa | receita; e = lançamento para editar */
  function openSheet(type, e = null, occ = '') {
    const base = e ? all().find((x) => x.id === e) : null;
    const occurrence = base && base.recurring ? entriesOf(curMonth()).find((x) => x.id === base.id) : null;
    const tdy = today();
    const date = base ? (occurrence ? occurrence.date : base.date) : (curMonth() === tdy.slice(0, 7) ? tdy : `${curMonth()}-01`);
    state.sheet = {
      id: base ? base.id : null,
      occ: occ || (occurrence ? occurrence.occurrence : ''),
      type: base ? base.type : type,
      cat: base ? base.cat : null,
      method: base ? base.method : 'Pix',
      dateMode: date === tdy ? 'hoje' : date === addDays(tdy, -1).iso ? 'ontem' : 'outra',
      cents: 0,
    };
    $('#sDesc').value = base ? base.desc : '';
    $('#sDate').value = date;
    $('#sPaid').checked = base ? (occurrence ? occurrence.paid : base.paid) : true;
    $('#sRecurring').checked = base ? !!base.recurring : false;
    setCents(base ? Math.round(base.value * 100) : 0);
    renderSheet();
    openModal(sheet());
    setTimeout(() => $('#sValue').focus({ preventScroll: true }), 120);
  }

  function submitSheet(ev) {
    ev.preventDefault();
    const s = state.sheet;
    const value = s.cents / 100;
    if (!value) { $('#sValue').focus(); return toast('Digite o valor'); }
    if (!s.cat) return toast('Escolha a categoria');
    const tdy = today();
    const date = s.dateMode === 'hoje' ? tdy : s.dateMode === 'ontem' ? addDays(tdy, -1).iso : $('#sDate').value;
    if (!date) return toast('Escolha a data');
    const desc = $('#sDesc').value.trim() || s.cat; // sem descrição, usa a categoria
    const recurring = s.type === 'despesa' && $('#sRecurring').checked;
    const paid = $('#sPaid').checked;
    const data = { type: s.type, desc, cat: s.cat, value, method: s.method, recurring };

    const list = all();
    if (s.id) {
      const it = list.find((x) => x.id === s.id);
      const wasRecurring = it.recurring;
      Object.assign(it, data);
      if (recurring) {
        // Conta fixa: muda o dia de vencimento, mantém o mês de início; "pago" vale para o mês aberto
        it.date = wasRecurring ? `${it.date.slice(0, 8)}${date.slice(8)}` : date;
        const ym = s.occ || date.slice(0, 7);
        it.paidMonths = (it.paidMonths || []).filter((m) => m !== ym).concat(paid ? [ym] : []);
        delete it.paid;
      } else {
        it.date = date;
        it.paid = paid;
        delete it.paidMonths; delete it.endMonth;
      }
    } else {
      list.push(recurring
        ? { id: 'fin-' + uidShort(), ...data, date, paidMonths: paid ? [date.slice(0, 7)] : [] }
        : { id: 'fin-' + uidShort(), ...data, date, paid });
    }
    save(list);
    closeModal(sheet());
    toast(s.id ? 'Lançamento atualizado ✓' : `${s.type === 'despesa' ? 'Saída' : 'Entrada'} de ${brl(value)} lançada ✓${recurring ? ' · todo mês' : ''}`);
    if (!s.id) state.month = date.slice(0, 7);
    render();
    if (typeof refreshPanel === 'function') renderPanelStats();
  }

  function deleteFromSheet() {
    const s = state.sheet;
    const list = all();
    const it = list.find((x) => x.id === s.id);
    if (!it) return;
    if (it.recurring) {
      const occ = s.occ || curMonth();
      if (!confirm(`Parar a conta fixa "${it.desc}" a partir de ${monthLabel(occ)}?\nOs meses anteriores continuam no histórico.`)) return;
      if (occ <= it.date.slice(0, 7)) save(list.filter((x) => x.id !== it.id));
      else { it.endMonth = shiftMonth(occ, -1); save(list); }
    } else {
      if (!confirm(`Excluir "${it.desc}" (${brl(it.value)})?`)) return;
      save(list.filter((x) => x.id !== it.id));
    }
    closeModal(sheet());
    toast('Lançamento excluído');
    render();
  }

  function togglePaid(id, occ) {
    const list = all();
    const it = list.find((x) => x.id === id);
    if (!it) return;
    if (it.recurring) {
      const set = new Set(it.paidMonths || []);
      if (set.has(occ)) set.delete(occ); else set.add(occ);
      it.paidMonths = [...set];
    } else it.paid = !it.paid;
    save(list);
    toast(`${it.desc} pago ✓`);
    render();
  }

  /* ---------- Planilha para o contador ---------- */
  function exportCsv() {
    const ym = curMonth();
    const t = totals(ym);
    const num = (v) => v.toFixed(2).replace('.', ',');
    const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const br = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
    const lines = [['Data', 'Tipo', 'Categoria', 'Descrição', 'Forma de pagamento', 'Situação', 'Valor (R$)'].join(';')];
    t.appts.forEach((b) => lines.push([br(b.paidDate || b.date), 'Entrada', 'Atendimento', q(`${b.name} · ${bookingItemsText(b)}`), q(b.method || ''), 'Recebido', num(b.amount)].join(';')));
    t.entries.forEach((e) => lines.push([br(e.date), e.type === 'receita' ? 'Entrada' : 'Saída', q(e.cat), q(e.desc + (e.recurring ? ' (fixa)' : '')), q(e.method || ''),
      e.paid ? (e.type === 'receita' ? 'Recebido' : 'Pago') : (e.type === 'receita' ? 'A receber' : 'A pagar'), num(e.type === 'receita' ? e.value : -e.value)].join(';')));
    lines.push('', `;;;;;Entradas;${num(t.receitas)}`, `;;;;;Saídas;${num(-t.despTotal)}`, `;;;;;Saldo;${num(t.resultado)}`);
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `corteza-financeiro-${ym}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast('Planilha do mês baixada');
  }

  /** Lança uma saída vinda de outra tela (ex.: compra de estoque) */
  function addExpense({ desc, cat, value, method = 'Pix', date = today(), paid = true }) {
    const list = all();
    list.push({ id: 'fin-' + uidShort(), type: 'despesa', desc, cat, value, date, method, recurring: false, paid });
    save(list);
  }

  /* ---------- Eventos ---------- */
  function init() {
    $('#finPrev').addEventListener('click', () => { state.month = shiftMonth(curMonth(), -1); render(); });
    $('#finNext').addEventListener('click', () => { state.month = shiftMonth(curMonth(), 1); render(); });
    $('#finMonth').addEventListener('click', () => { state.month = null; render(); });
    $('#finNewOut').addEventListener('click', () => openSheet('despesa'));
    $('#finNewIn').addEventListener('click', () => openSheet('receita'));
    $('#finExport').addEventListener('click', exportCsv);

    const view = $('[data-view-pane="financeiro"]');
    view.addEventListener('click', (e) => {
      const f = e.target.closest('[data-fin-filter]');
      if (f) { state.filter = f.dataset.finFilter; render(); return; }
      const pay = e.target.closest('[data-fin-pay]');
      if (pay) { togglePaid(pay.dataset.finPay, pay.dataset.occ); return; }
      const ap = e.target.closest('[data-fin-appts]');
      if (ap) { state.open[ap.dataset.finAppts] = !state.open[ap.dataset.finAppts]; render(); return; }
      const op = e.target.closest('[data-fin-open]');
      if (op) openSheet(null, op.dataset.finOpen, op.dataset.occ);
    });

    // Folha de lançamento
    const sh = sheet();
    $$('[data-close]', sh).forEach((b) => b.addEventListener('click', () => closeModal(sh)));
    $('#sForm').addEventListener('submit', submitSheet);
    $('#sDelete').addEventListener('click', deleteFromSheet);
    sh.addEventListener('click', (e) => {
      const t = e.target.closest('[data-stype]');
      if (t && !state.sheet.id) {
        state.sheet.type = t.dataset.stype;
        if (!CATS[state.sheet.type].some(([c]) => c === state.sheet.cat)) state.sheet.cat = null;
        renderSheet();
      }
      const c = e.target.closest('[data-cat]');
      if (c) { state.sheet.cat = c.dataset.cat; renderCatChips(); }
      const d = e.target.closest('[data-sdate]');
      if (d) {
        state.sheet.dateMode = d.dataset.sdate;
        renderSheet();
        if (d.dataset.sdate === 'outra') $('#sDate').focus();
      }
      const m = e.target.closest('[data-smethod]');
      if (m) { state.sheet.method = m.dataset.smethod; renderSheet(); }
    });
    $('#sMethods').innerHTML = METHODS.map((m) => `<button type="button" class="mini-chip" data-smethod="${m}">${m}</button>`).join('');

    // Campo de valor: digitar números (entram pela direita) e apagar
    const val = $('#sValue');
    val.addEventListener('keydown', (e) => {
      if (/^\d$/.test(e.key)) { e.preventDefault(); setCents(state.sheet.cents * 10 + Number(e.key)); }
      else if (e.key === 'Backspace') { e.preventDefault(); setCents(Math.floor(state.sheet.cents / 10)); }
      else if (e.key === 'Delete') { e.preventDefault(); setCents(0); }
    });
    // Celular (teclado virtual) e colar: pega só os números digitados
    val.addEventListener('input', () => {
      const digits = val.value.replace(/\D/g, '');
      setCents(Number(digits || 0));
    });
  }

  return { render, init, totals, addExpense };
})();
