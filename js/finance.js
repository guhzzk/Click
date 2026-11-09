/* ==========================================================
   Financeiro (contabilidade da barbearia)
   - Receitas: atendimentos concluídos (automático) + lançamentos manuais
   - Despesas: lançamentos avulsos e contas fixas que repetem todo mês
   - Resumo do mês, gastos por categoria e exportação CSV p/ o contador
   ========================================================== */

const Finance = (() => {
  const KEY = 'corteza_lancamentos_v1';

  const CATS = {
    despesa: ['Aluguel', 'Energia', 'Água', 'Internet e telefone', 'Produtos e insumos', 'Compra de estoque', 'Impostos / MEI', 'Contador', 'Marketing', 'Equipamentos', 'Manutenção', 'Pró-labore', 'Transporte', 'Outros'],
    receita: ['Venda de produto', 'Serviço fora da agenda', 'Assinatura do clube', 'Outros'],
  };
  const METHODS = ['Pix', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Boleto', 'Transferência'];
  // Atalhos para lançar as contas mais comuns
  const QUICK = [
    { desc: 'Aluguel', cat: 'Aluguel', recurring: true },
    { desc: 'Conta de luz', cat: 'Energia', recurring: true },
    { desc: 'Conta de água', cat: 'Água', recurring: true },
    { desc: 'Internet', cat: 'Internet e telefone', recurring: true },
    { desc: 'DAS do MEI', cat: 'Impostos / MEI', recurring: true },
    { desc: 'Lâminas e insumos', cat: 'Produtos e insumos', recurring: false },
  ];

  const state = { month: null, type: 'despesa', editing: null, showAppts: false };

  const all = () => store(KEY) || [];
  const save = (list) => store(KEY, list);
  const curMonth = () => state.month || nowLocal().iso.slice(0, 7);
  const monthLabel = (ym) => { const [y, m] = ym.split('-').map(Number); return `${MONTH_NAME[m - 1]} de ${y}`; };
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const shiftMonth = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); };
  const daysIn = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };

  /** Lançamentos do mês (contas fixas viram uma ocorrência por mês) */
  function entriesOf(ym) {
    const out = [];
    all().forEach((e) => {
      if (e.recurring) {
        const start = e.date.slice(0, 7);
        if (ym < start || (e.endMonth && ym > e.endMonth)) return;
        const day = Math.min(+e.date.slice(8), daysIn(ym));
        out.push({ ...e, date: `${ym}-${pad(day)}`, paid: (e.paidMonths || []).includes(ym), occurrence: ym });
      } else if (e.date.startsWith(ym)) {
        out.push(e);
      }
    });
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }

  /** Atendimentos concluídos no mês (receita automática da agenda) */
  function appointmentsOf(ym) {
    return DB.all().filter((b) => b.status === 'concluido' && b.kind === 'agendamento' && b.amount > 0 && (b.paidDate || b.date).startsWith(ym))
      .sort((a, b) => (a.paidDate || a.date).localeCompare(b.paidDate || b.date));
  }

  function totals(ym) {
    const entries = entriesOf(ym);
    const appts = appointmentsOf(ym);
    const apptTotal = appts.reduce((t, b) => t + b.amount, 0);
    const recManual = entries.filter((e) => e.type === 'receita').reduce((t, e) => t + e.value, 0);
    const desp = entries.filter((e) => e.type === 'despesa');
    const despTotal = desp.reduce((t, e) => t + e.value, 0);
    const pending = desp.filter((e) => !e.paid).reduce((t, e) => t + e.value, 0);
    const receitas = apptTotal + recManual;
    return { entries, appts, apptTotal, recManual, receitas, despTotal, pending, resultado: receitas - despTotal };
  }

  /* ---------- Tela ---------- */
  function render() {
    const ym = curMonth();
    const t = totals(ym);
    const prev = totals(shiftMonth(ym, -1));
    $('#finMonth').textContent = cap(monthLabel(ym));

    const margin = t.receitas > 0 ? Math.round((t.resultado / t.receitas) * 100) : null;
    const marginTxt = t.resultado < 0 ? 'despesas acima das receitas' : margin != null ? `margem ${margin}%` : 'sem movimento';
    // Comparação só faz sentido entre dois meses com lucro
    const diff = prev.resultado > 0 && t.resultado > 0 ? ((t.resultado - prev.resultado) / prev.resultado) * 100 : null;
    $('#finCards').innerHTML = `
      <div class="fin-card fin-card--in"><span>Receitas</span><b>${brl(t.receitas)}</b><small>${t.appts.length} atendimento${t.appts.length === 1 ? '' : 's'} · ${brl(t.recManual)} outras</small></div>
      <div class="fin-card fin-card--out"><span>Despesas</span><b>${brl(t.despTotal)}</b><small>${t.pending ? `${brl(t.pending)} a pagar` : 'tudo pago'}</small></div>
      <div class="fin-card fin-card--res ${t.resultado < 0 ? 'is-neg' : ''}"><span>Resultado do mês</span><b>${brl(t.resultado)}</b><small>${marginTxt}${diff != null ? ` · ${diff >= 0 ? '▲' : '▼'} ${Math.abs(diff).toFixed(0)}% vs. mês anterior` : ''}</small></div>`;

    // Gastos por categoria
    const byCat = {};
    t.entries.filter((e) => e.type === 'despesa').forEach((e) => (byCat[e.cat] = (byCat[e.cat] || 0) + e.value));
    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const max = cats.length ? cats[0][1] : 1;
    $('#finCats').innerHTML = cats.length ? cats.map(([c, v]) => `
      <div class="cat-row">
        <span class="cat-row__name">${esc(c)}</span>
        <div class="cat-row__bar"><i style="width:${(v / max) * 100}%"></i></div>
        <b>${brl(v)}</b><small>${t.despTotal ? Math.round((v / t.despTotal) * 100) : 0}%</small>
      </div>`).join('') : '<p class="muted">Nenhuma despesa lançada neste mês.</p>';

    // Lançamentos
    const rows = [];
    if (t.appts.length) {
      rows.push(`
        <div class="led-row led-row--in led-row--group">
          <span class="led-row__date">${(() => {
            const first = fmtShortDate(t.appts[0].paidDate || t.appts[0].date);
            const last = fmtShortDate(t.appts[t.appts.length - 1].paidDate || t.appts[t.appts.length - 1].date);
            return first === last ? first : `${first}–${last}`;
          })()}</span>
          <div class="led-row__main"><b>Atendimentos concluídos</b><small>Receita automática da agenda · ${t.appts.length} atendimento${t.appts.length === 1 ? '' : 's'}</small></div>
          <span class="led-row__val">+ ${brl(t.apptTotal)}</span>
          <div class="led-row__actions"><button class="icon-btn" data-fin-appts>${state.showAppts ? 'Ocultar' : 'Ver todos'}</button></div>
        </div>`);
      if (state.showAppts) {
        rows.push(`<div class="led-sub">${t.appts.map((b) => `
          <div><span>${fmtShortDate(b.paidDate || b.date)}</span><span>${esc(b.name)} · ${esc(bookingItemsText(b))}</span><b>${brl(b.amount)}</b></div>`).join('')}</div>`);
      }
    }
    t.entries.forEach((e) => {
      const isIn = e.type === 'receita';
      rows.push(`
        <div class="led-row ${isIn ? 'led-row--in' : 'led-row--out'} ${!e.paid ? 'is-pending' : ''}">
          <span class="led-row__date">${fmtShortDate(e.date)}</span>
          <div class="led-row__main">
            <b>${esc(e.desc)}${e.recurring ? ' <em class="led-tag">fixa</em>' : ''}</b>
            <small>${esc(e.cat)}${e.method ? ' · ' + esc(e.method) : ''}</small>
          </div>
          <span class="led-row__val">${isIn ? '+' : '−'} ${brl(e.value)}</span>
          <div class="led-row__actions">
            <button class="icon-btn ${e.paid ? '' : 'icon-btn--ok'}" data-fin-pay="${e.id}" data-occ="${e.occurrence || ''}">${e.paid ? (isIn ? 'Recebido ✓' : 'Pago ✓') : (isIn ? 'Marcar recebido' : 'Marcar pago')}</button>
            <button class="icon-btn" data-fin-edit="${e.id}">Editar</button>
            <button class="icon-btn icon-btn--danger" data-fin-del="${e.id}" data-occ="${e.occurrence || ''}" aria-label="Excluir ${esc(e.desc)}">Excluir</button>
          </div>
        </div>`);
    });
    $('#finLedger').innerHTML = rows.length ? rows.join('') : '<p class="empty">Nada lançado em ' + monthLabel(ym) + '. Use os atalhos acima ou “+ Despesa”.</p>';
  }

  /* ---------- Formulário ---------- */
  function fillCats(type, selected) {
    $('#fCat').innerHTML = CATS[type].map((c) => `<option ${c === selected ? 'selected' : ''}>${c}</option>`).join('');
  }

  function openForm(type, preset = {}) {
    state.type = type;
    state.editing = preset.id || null;
    $('#finFormTitle').textContent = `${preset.id ? 'Editar' : 'Nova'} ${type === 'despesa' ? 'despesa' : 'receita'}`;
    $('#fType').value = type;
    fillCats(type, preset.cat);
    $('#fDesc').value = preset.desc || '';
    $('#fValue').value = preset.value != null ? String(preset.value).replace('.', ',') : '';
    const today = nowLocal().iso;
    $('#fDate').value = preset.date || (curMonth() === today.slice(0, 7) ? today : `${curMonth()}-01`);
    $('#fMethod').value = preset.method || 'Pix';
    $('#fPaid').checked = preset.paid != null ? preset.paid : true;
    $('#fPaidLabel').textContent = type === 'despesa' ? 'Já está pago' : 'Já recebi';
    $('#fRecurring').checked = !!preset.recurring;
    $('#fRecurringWrap').hidden = type !== 'despesa';
    const form = $('#finForm');
    form.hidden = false;
    form.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    setTimeout(() => (preset.desc ? $('#fValue') : $('#fDesc')).focus(), 50);
  }

  function closeForm() {
    $('#finForm').hidden = true;
    $('#finForm').reset();
    state.editing = null;
  }

  function submit(e) {
    e.preventDefault();
    const type = $('#fType').value;
    const desc = $('#fDesc').value.trim();
    const value = parseMoney($('#fValue').value);
    const date = $('#fDate').value;
    if (desc.length < 2) { $('#fDesc').focus(); return toast('Digite a descrição'); }
    if (!value) { $('#fValue').focus(); return toast('Digite o valor'); }
    if (!date) { $('#fDate').focus(); return toast('Escolha a data'); }
    const recurring = type === 'despesa' && $('#fRecurring').checked;
    const paid = $('#fPaid').checked;
    const data = { type, desc, cat: $('#fCat').value, value, date, method: $('#fMethod').value, recurring };

    const list = all();
    if (state.editing) {
      const it = list.find((x) => x.id === state.editing);
      Object.assign(it, data);
      if (recurring) {
        const ym = curMonth(); // o "pago" vale para o mês aberto na tela
        it.paidMonths = (it.paidMonths || []).filter((m) => m !== ym).concat(paid ? [ym] : []);
        delete it.paid;
      } else { it.paid = paid; delete it.paidMonths; }
    } else {
      list.push(recurring
        ? { id: 'fin-' + uidShort(), ...data, paidMonths: paid ? [date.slice(0, 7)] : [] }
        : { id: 'fin-' + uidShort(), ...data, paid });
    }
    save(list);
    toast(state.editing ? 'Lançamento atualizado ✓' : `${type === 'despesa' ? 'Despesa' : 'Receita'} lançada ✓${recurring ? ' · repete todo mês' : ''}`);
    if (!(state.editing && recurring)) state.month = date.slice(0, 7);
    closeForm();
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
    render();
  }

  function remove(id, occ) {
    const list = all();
    const it = list.find((x) => x.id === id);
    if (!it) return;
    if (it.recurring) {
      // Conta fixa: encerra a partir deste mês (os meses anteriores ficam no histórico)
      if (!confirm(`Encerrar a conta fixa "${it.desc}" a partir de ${monthLabel(occ)}? Os meses anteriores continuam no histórico.`)) return;
      const start = it.date.slice(0, 7);
      if (occ <= start) save(list.filter((x) => x.id !== id));
      else { it.endMonth = shiftMonth(occ, -1); save(list); }
    } else {
      if (!confirm(`Excluir "${it.desc}"?`)) return;
      save(list.filter((x) => x.id !== id));
    }
    toast('Lançamento removido');
    render();
  }

  /** Planilha do mês (abre no Excel/Google Planilhas) */
  function exportCsv() {
    const ym = curMonth();
    const t = totals(ym);
    const money = (v) => v.toFixed(2).replace('.', ',');
    const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const lines = [['Data', 'Tipo', 'Categoria', 'Descrição', 'Forma de pagamento', 'Situação', 'Valor (R$)'].join(';')];
    t.appts.forEach((b) => lines.push([fmtLong(b.paidDate || b.date), 'Receita', 'Atendimento', q(`${b.name} · ${bookingItemsText(b)}`), q(b.method || ''), 'Recebido', money(b.amount)].join(';')));
    t.entries.forEach((e) => lines.push([fmtLong(e.date), e.type === 'receita' ? 'Receita' : 'Despesa', q(e.cat), q(e.desc + (e.recurring ? ' (fixa)' : '')), q(e.method || ''), e.paid ? (e.type === 'receita' ? 'Recebido' : 'Pago') : (e.type === 'receita' ? 'A receber' : 'A pagar'), money(e.type === 'receita' ? e.value : -e.value)].join(';')));
    lines.push('', `;;;;;Receitas;${money(t.receitas)}`, `;;;;;Despesas;${money(-t.despTotal)}`, `;;;;;Resultado;${money(t.resultado)}`);
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `corteza-financeiro-${ym}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast('Planilha do mês baixada');
  }
  const fmtLong = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

  /** Lança uma despesa vinda de outra tela (ex.: compra de estoque) */
  function addExpense({ desc, cat, value, method = 'Pix', date = nowLocal().iso, paid = true }) {
    const list = all();
    list.push({ id: 'fin-' + uidShort(), type: 'despesa', desc, cat, value, date, method, recurring: false, paid });
    save(list);
  }

  function init() {
    $('#fType').addEventListener('change', (e) => openForm(e.target.value, { desc: $('#fDesc').value, value: parseMoney($('#fValue').value) }));
    $('#finPrev').addEventListener('click', () => { state.month = shiftMonth(curMonth(), -1); render(); });
    $('#finNext').addEventListener('click', () => { state.month = shiftMonth(curMonth(), 1); render(); });
    $('#finNewOut').addEventListener('click', () => openForm('despesa'));
    $('#finNewIn').addEventListener('click', () => openForm('receita'));
    $('#finExport').addEventListener('click', exportCsv);
    $('#finCancel').addEventListener('click', closeForm);
    $('#finForm').addEventListener('submit', submit);
    $('#finQuick').innerHTML = QUICK.map((q, i) => `<button type="button" class="chip" data-quick="${i}">+ ${q.desc}</button>`).join('');
    $('#finQuick').addEventListener('click', (e) => {
      const b = e.target.closest('[data-quick]');
      if (b) openForm('despesa', QUICK[+b.dataset.quick]);
    });
    $('#fMethod').innerHTML = METHODS.map((m) => `<option>${m}</option>`).join('');
    $('#finLedger').addEventListener('click', (e) => {
      const pay = e.target.closest('[data-fin-pay]');
      const ed = e.target.closest('[data-fin-edit]');
      const del = e.target.closest('[data-fin-del]');
      if (e.target.closest('[data-fin-appts]')) { state.showAppts = !state.showAppts; render(); }
      if (pay) togglePaid(pay.dataset.finPay, pay.dataset.occ);
      if (del) remove(del.dataset.finDel, del.dataset.occ);
      if (ed) {
        const it = all().find((x) => x.id === ed.dataset.finEdit);
        const occ = entriesOf(curMonth()).find((x) => x.id === it.id);
        openForm(it.type, { ...it, paid: occ ? occ.paid : it.paid });
      }
    });
  }

  return { render, init, totals, addExpense };
})();
