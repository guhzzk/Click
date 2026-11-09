/* ==========================================================
   Área administrativa premium (painel do barbeiro)
   - Navegação SPA entre 5 telas
   - Visão Geral: "Piloto Automático" + contadores
   - Agenda Multiprofissional: profissionais + agenda real
   - Clube de Assinaturas: diagnóstico e previsibilidade de caixa
   - Financeiro & IA: saúde financeira + precificação inteligente
   - Automação: WhatsApp, lembrete de no-show e fluxo do robô

   Os números de clube, mensagens e custos são DADOS DE
   DEMONSTRAÇÃO (abaixo). Agenda e relatório de renda usam os
   dados reais salvos no navegador.
   ========================================================== */

/* ----------------------------------------------------------
   DADOS DE DEMONSTRAÇÃO
   ---------------------------------------------------------- */
const ADMIN_DEMO = {
  // Visão geral (semana)
  kpis: { confirmed: 42, messages: 187, recovered: 5, pixSynced: 38, pixValue: 2946.2 },

  // Clube Corteza: assinantes por plano.
  // Os planos BLACK não têm preço publicado: o valor abaixo é ESTIMADO para a demonstração.
  club: [
    { id: 'one-corte', name: 'ONE · Corte', members: 14, price: 79.9 },
    { id: 'one-corte-sob', name: 'ONE · Corte + Sobrancelha', members: 6, price: 99.9 },
    { id: 'one-corte-barba', name: 'ONE · Corte + Barba', members: 8, price: 129.9 },
    { id: 'one-completo', name: 'ONE · Completo', members: 3, price: 159.9 },
    { id: 'black-corte-barba', name: 'BLACK · Corte & Barba', members: 5, price: 199.9, estimated: true },
  ],
  renewals: [
    { name: 'Rafael Moreira', plan: 'ONE · Corte + Barba', days: 1, price: 129.9 },
    { name: 'Bruno Kowalski', plan: 'BLACK · Corte & Barba', days: 2, price: 199.9 },
    { name: 'Lucas Andrade', plan: 'ONE · Corte', days: 3, price: 79.9 },
    { name: 'Matheus Ribas', plan: 'ONE · Completo', days: 5, price: 159.9 },
    { name: 'Felipe Zanon', plan: 'ONE · Corte', days: 6, price: 79.9 },
  ],
  retention: 92,     // % de assinantes que renovaram nos últimos 90 dias
  atRisk: 4,         // assinantes sem visita há 20+ dias

  // Financeiro (mês)
  finance: {
    avulsos: 128,        // atendimentos avulsos por mês
    ticket: 52.4,        // ticket médio dos avulsos
    produtos: 640,       // venda de produtos El Guapo
    cadeiras: 1,
    taxaCartao: 1.8,     // % média de taxas (maquininha)
    custos: { aluguel: 2200, energia: 420, insumos: 780, sistema: 189, contador: 350, outros: 300 },
  },

  // Volume mensal por serviço (precificação inteligente)
  volume: { corte: 62, barba: 18, sobrancelha: 14, 'c-corte-sobrancelha': 16, 'c-corte-barba': 22, 'c-barba-sobrancelha': 6, 'c-completo': 9 },

  // Antes x depois da automação
  contrast: [
    { label: 'Tempo no WhatsApp por dia', before: '3h10', after: '18 min', ratio: 0.09 },
    { label: 'Faltas (no-show) no mês', before: '14', after: '3', ratio: 0.21 },
    { label: 'Horários vagos sem cliente', before: '22', after: '6', ratio: 0.27 },
  ],
};

const COST_LABEL = { aluguel: 'Aluguel', energia: 'Energia e água', insumos: 'Produtos e insumos', sistema: 'Sistema e marketing', contador: 'Contador', outros: 'Outros' };
const ELASTICITY = { baixa: 0.4, media: 0.8, alta: 1.3 }; // % de clientes perdidos para cada 1% de aumento

const admin = { view: 'geral', flowTimer: null, flowRun: 0, noShowRun: 0 };

/* ----------------------------------------------------------
   NAVEGAÇÃO SPA
   ---------------------------------------------------------- */
function showView(view) {
  admin.view = view;
  $$('[data-view]').forEach((b) => {
    const on = b.dataset.view === view;
    b.classList.toggle('is-active', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  $$('.admin-view').forEach((s) => s.classList.toggle('is-active', s.dataset.viewPane === view));
  // Volta ao topo do painel ao trocar de tela
  const p = $('#panel');
  if (p.scrollTop > 120) p.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });

  if (view !== 'automacao') { AI.stop(); Automation.stop(); }
  if (view === 'geral') { renderPanelStats(); Overview.render(); }
  if (view === 'agenda') { Pros.render(); showPanelTab(['agenda', 'novo'].includes(panel.tab) ? panel.tab : 'agenda'); }
  if (view === 'clube') Club.render();
  if (view === 'financeiro') { Finance.render(); Pricing.render(); renderReport(); }
  if (view === 'automacao') { Automation.start(); AI.start(); }
}

/* ----------------------------------------------------------
   UTILITÁRIOS
   ---------------------------------------------------------- */
/** Anima um número de 0 até o valor (formatado por fmt) */
function countUp(el, to, fmt = (v) => Math.round(v).toLocaleString('pt-BR'), ms = 1300) {
  cancelAnimationFrame(el._raf);
  if (reduceMotion()) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / ms);
    const eased = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(to * eased);
    if (k < 1) el._raf = requestAnimationFrame(step);
  };
  el._raf = requestAnimationFrame(step);
}

/** Aplica um valor numérico em uma variável CSS animada (gráficos) */
function animateVar(el, name, value) {
  el.style.setProperty(name, 0);
  requestAnimationFrame(() => requestAnimationFrame(() => el.style.setProperty(name, value)));
}

/** Dias de funcionamento do mês atual: { all: [...iso], elapsed: n } */
function monthBusinessDays() {
  const now = nowLocal();
  const first = `${now.y}-${pad(now.m)}-01`;
  const days = [];
  for (let i = 0; i < 31; i++) {
    const d = addDays(first, i);
    if (d.m !== now.m - 1) break;
    if (CONFIG.hours[d.dow]) days.push(d.iso);
  }
  return { all: days, elapsed: days.filter((d) => d <= now.iso).length };
}

const fmtShortDate = (iso) => { const d = addDays(iso, 0); return `${pad(d.d)}/${pad(d.m + 1)}`; };

/* ==========================================================
   VISÃO GERAL
   ========================================================== */
const Overview = {
  render() {
    const k = ADMIN_DEMO.kpis;
    countUp($('#kpiConfirmed'), k.confirmed);
    countUp($('#kpiMessages'), k.messages);
    countUp($('#kpiRecovered'), k.recovered);
    countUp($('#kpiPix'), k.pixSynced);
    $('#kpiPixValue').textContent = brl(k.pixValue);

    // Antes x depois
    $('#ovContrast').innerHTML = ADMIN_DEMO.contrast.map((c, i) => `
      <div class="vs-row" style="--i:${i}">
        <span class="vs-row__label">${c.label}</span>
        <div class="vs-bar vs-bar--before"><span style="--w:100%"></span><b>${c.before}</b></div>
        <div class="vs-bar vs-bar--after"><span style="--w:${Math.max(6, c.ratio * 100)}%"></span><b>${c.after}</b></div>
      </div>`).join('');

    // Próximos horários (dados reais da agenda)
    const today = nowLocal().iso;
    const next = DB.all().filter((b) => b.kind === 'agendamento' && b.status === 'agendado' && b.date >= today && !b.demo).slice(0, 5);
    $('#ovUpcoming').innerHTML = next.length ? next.map((b) => `
      <li>
        <time><b>${b.time}</b>${b.date === today ? 'hoje' : fmtShortDate(b.date)}</time>
        <span><strong>${esc(b.name)}</strong><small>${esc(bookingItemsText(b))}</small></span>
        <em>${b.total ? brl(b.total) : '—'}</em>
      </li>`).join('') : '<li class="empty">Nenhum horário futuro. Os próximos agendamentos aparecem aqui.</li>';
  },
};

/* ==========================================================
   AGENDA MULTIPROFISSIONAL — profissionais
   ========================================================== */
const Pros = {
  render() {
    const now = nowLocal();
    const h = CONFIG.hours[now.dow];
    const today = DB.all().filter((b) => b.date === now.iso && b.kind === 'agendamento' && b.status !== 'cancelado');
    const inSlot = today.find((b) => now.minutes >= toMinutes(b.time) && now.minutes < toMinutes(b.time) + CONFIG.slotMinutes);
    let status = 'Fora do expediente', cls = 'off';
    if (h && now.minutes >= h[0] * 60 && now.minutes < h[1] * 60) {
      status = inSlot ? `Atendendo ${inSlot.name.split(' ')[0]}` : 'Livre agora';
      cls = inSlot ? 'busy' : 'free';
    }
    $('#proMain').innerHTML = `
      <span class="pro__avatar">G</span>
      <div class="pro__info">
        <b>${esc(CONFIG.barber)}</b>
        <small>Barbeiro · Cadeira 1</small>
        <span class="pro__status pro__status--${cls}"><i></i>${status}</span>
      </div>
      <div class="pro__count"><b>${today.length}</b><small>horário${today.length === 1 ? '' : 's'} hoje</small></div>`;
  },
};

/* ==========================================================
   CLUBE DE ASSINATURAS — diagnóstico
   ========================================================== */
const clubMRR = () => ADMIN_DEMO.club.reduce((s, p) => s + p.members * p.price, 0);
const clubMembers = () => ADMIN_DEMO.club.reduce((s, p) => s + p.members, 0);

const Club = {
  render() {
    const mrr = clubMRR();
    const f = Finance.compute();
    const pct = Math.round(f.previsibilidade * 100);

    countUp($('#clubMRR'), mrr, (v) => brl(v));
    $('#clubPct').textContent = `${pct}%`;
    animateVar($('#clubGauge'), '--p', pct);
    animateVar($('#clubProgress'), '--p', pct);
    $('#clubGaugeNote').textContent = `de ${brl(f.fat)} previstos para ${MONTH_NAME[nowLocal().m - 1]}`;

    const max = Math.max(...ADMIN_DEMO.club.map((p) => p.members * p.price));
    $('#clubPlans').innerHTML = ADMIN_DEMO.club.map((p, i) => {
      const v = p.members * p.price;
      return `
        <div class="plan-row ${p.id.startsWith('black') ? 'plan-row--black' : ''}" style="--i:${i}">
          <div class="plan-row__top"><b>${p.name}${p.estimated ? '<sup>*</sup>' : ''}</b><span>${p.members} assinantes</span><strong>${brl(v)}</strong></div>
          <div class="plan-row__bar"><span style="--w:${(v / max) * 100}%"></span></div>
        </div>`;
    }).join('') + `<p class="fineprint fineprint--left">* Preço do BLACK estimado para a demonstração.</p>`;
    $('#clubTotals').textContent = `${clubMembers()} assinantes ativos`;

    const migrate = 6, onePrice = PLANS.one[0].price;
    $('#clubInsights').innerHTML = `
      <div class="insight insight--good"><span>📈</span><p><b>Retenção de ${ADMIN_DEMO.retention}%</b> nos últimos 90 dias. Acima da média do setor.</p></div>
      <div class="insight insight--warn"><span>⚠️</span><p><b>${ADMIN_DEMO.atRisk} assinantes sem visita há 20+ dias.</b> Risco de cancelamento.</p>
        <button class="btn btn--sm btn--gold" data-admin-toast="Lembrete enviado pelo robô para ${ADMIN_DEMO.atRisk} assinantes 🤖">Enviar lembrete pelo robô</button></div>
      <div class="insight insight--tip"><span>💡</span><p>Se <b>${migrate} clientes avulsos frequentes</b> migrarem para o ONE Corte, a recorrência sobe para <b>${brl(mrr + migrate * onePrice)}</b>/mês.</p></div>`;

    const today = nowLocal().iso;
    $('#clubRenewals').innerHTML = ADMIN_DEMO.renewals.map((r) => `
      <li>
        <span class="ren__date">${fmtShortDate(addDays(today, r.days).iso)}</span>
        <span class="ren__who"><b>${r.name}</b><small>${r.plan}</small></span>
        <span class="ren__val">${brl(r.price)}<small>Pix automático</small></span>
      </li>`).join('');
  },
};

/* ==========================================================
   FINANCEIRO — calculadora de saúde financeira
   ========================================================== */
const Finance = {
  KEY: 'corteza_financeiro_v1',

  /** Parâmetros: os da demonstração, sobrescritos pelo que o barbeiro editou */
  params() {
    const saved = store(this.KEY) || {};
    const base = ADMIN_DEMO.finance;
    return { ...base, ...saved, custos: { ...base.custos, ...(saved.custos || {}) } };
  },

  save(patch) {
    const cur = store(this.KEY) || {};
    store(this.KEY, { ...cur, ...patch, custos: { ...(cur.custos || {}), ...(patch.custos || {}) } });
  },

  compute(extraRevenue = 0) {
    const p = this.params();
    const mrr = clubMRR();
    const avulsoRev = p.avulsos * p.ticket + extraRevenue;
    const fat = avulsoRev + mrr + p.produtos;
    const fixed = Object.values(p.custos).reduce((s, v) => s + (+v || 0), 0);
    const fees = (avulsoRev + p.produtos) * (p.taxaCartao / 100);
    const costs = fixed + fees;
    const profit = fat - costs;
    const margin = fat > 0 ? profit / fat : 0;

    const bd = monthBusinessDays();
    const progress = bd.all.length ? bd.elapsed / bd.all.length : 0;
    const realized = profit * progress;

    // Ponto de equilíbrio: em que dia de funcionamento o faturamento cobre os custos
    const beIndex = fat > 0 ? Math.ceil((costs / fat) * bd.all.length) : bd.all.length;
    const beDate = bd.all[Math.min(Math.max(beIndex, 1), bd.all.length) - 1];

    // Custo por cadeira (mês e por hora aberta)
    const hoursOpen = bd.all.reduce((s, iso) => { const h = CONFIG.hours[addDays(iso, 0).dow]; return s + (h[1] - h[0]); }, 0);
    const chair = costs / Math.max(1, p.cadeiras);
    const chairHour = chair / Math.max(1, hoursOpen); // cada cadeira fica aberta todas as horas do mês

    const previsibilidade = fat > 0 ? mrr / fat : 0;
    const score = Math.round(Math.max(0, Math.min(100, 38 + margin * 52 + previsibilidade * 30)));
    return { p, mrr, avulsoRev, fat, fixed, fees, costs, profit, margin, progress, realized, bd, beDate, beIndex, chair, chairHour, previsibilidade, score };
  },

  renderCosts() {
    const p = this.params();
    const field = (key, label, value, step = 10) => `
      <label class="cost-field"><span>${label}</span>
        <div class="cost-input"><em>R$</em><input type="number" inputmode="decimal" min="0" step="${step}" data-cost="${key}" value="${value}"></div>
      </label>`;
    $('#finCosts').innerHTML = Object.entries(p.custos).map(([k, v]) => field(k, COST_LABEL[k] || k, v)).join('');
    $('#finVolume').innerHTML = `
      <label class="cost-field"><span>Atendimentos avulsos/mês</span><div class="cost-input"><input type="number" min="0" step="1" data-fin="avulsos" value="${p.avulsos}"></div></label>
      <label class="cost-field"><span>Ticket médio avulso</span><div class="cost-input"><em>R$</em><input type="number" min="0" step="0.5" data-fin="ticket" value="${p.ticket}"></div></label>
      <label class="cost-field"><span>Venda de produtos/mês</span><div class="cost-input"><em>R$</em><input type="number" min="0" step="10" data-fin="produtos" value="${p.produtos}"></div></label>`;
  },

  render() {
    if (!$('#finCosts').children.length) this.renderCosts();
    this.update(true);
  },

  /** Recalcula e atualiza a tela (animate = contagem animada) */
  update(animate) {
    const f = this.compute();
    const set = (id, v) => (animate ? countUp($(id), v, (x) => brl(x)) : ($(id).textContent = brl(v)));
    set('#finFat', f.fat);
    set('#finProfit', f.realized);
    set('#finChair', f.chair);
    $('#finFatSub').textContent = `${brl(f.avulsoRev)} avulsos + ${brl(f.mrr)} clube + ${brl(f.p.produtos)} produtos`;
    $('#finProfitSub').textContent = `até hoje · ${f.bd.elapsed} de ${f.bd.all.length} dias de funcionamento (${brl(f.profit)} no mês)`;
    $('#finChairSub').textContent = `por mês · ${brl(f.chairHour)} por hora aberta`;
    $('#finMargin').textContent = `${Math.round(f.margin * 100)}%`;
    $('#finCostsTotal').textContent = brl(f.costs);
    $('#finBreakEven').textContent = f.beDate ? fmtShortDate(f.beDate) : '—';
    $('#finBreakEvenSub').textContent = f.beDate ? `${f.beIndex}º dia de funcionamento` : '';

    const label = f.score >= 75 ? 'Saudável' : f.score >= 50 ? 'Atenção' : 'Crítico';
    const ring = $('#finScore');
    ring.dataset.level = f.score >= 75 ? 'good' : f.score >= 50 ? 'warn' : 'bad';
    $('#finScoreLabel').textContent = label;
    if (animate) { animateVar(ring, '--s', f.score); countUp($('#finScoreNum'), f.score); }
    else { ring.style.setProperty('--s', f.score); $('#finScoreNum').textContent = f.score; }
  },

  init() {
    $('#finEditor').addEventListener('input', (e) => {
      const t = e.target;
      const v = Math.max(0, parseFloat(t.value) || 0);
      if (t.dataset.cost) this.save({ custos: { [t.dataset.cost]: v } });
      if (t.dataset.fin) this.save({ [t.dataset.fin]: v });
      this.update(false);
      Pricing.render(true);
    });
    $('#finReset').addEventListener('click', () => {
      store(this.KEY, null);
      this.renderCosts();
      this.update(true);
      Pricing.render(true);
      toast('Valores de exemplo restaurados');
    });
  },
};

/* ==========================================================
   PRECIFICAÇÃO INTELIGENTE
   ========================================================== */
const Pricing = {
  state: { id: 'corte', price: null, sens: 'media' },

  services() {
    return [...SERVICES.avulsos, ...SERVICES.combos].filter((s) => s.price != null && ADMIN_DEMO.volume[s.id]);
  },

  /** Clientes por mês num preço (demanda linear com a sensibilidade escolhida) */
  volumeAt(s, price) {
    const e = ELASTICITY[this.state.sens];
    const q0 = ADMIN_DEMO.volume[s.id];
    return Math.max(0, q0 * (1 - e * ((price - s.price) / s.price)));
  },

  /** Melhor preço (máxima receita) num intervalo de -10% a +25%, arredondado a R$ 5 */
  suggestion(s) {
    let best = { price: s.price, rev: s.price * ADMIN_DEMO.volume[s.id] };
    for (let p = Math.ceil(s.price * 0.9); p <= Math.floor(s.price * 1.25); p++) {
      const rev = p * this.volumeAt(s, p);
      if (rev > best.rev + 0.01) best = { price: p, rev };
    }
    const rounded = Math.round(best.price / 5) * 5;
    return { price: rounded, rev: rounded * this.volumeAt(s, rounded) };
  },

  render(keep) {
    const list = this.services();
    const sel = $('#priceService');
    if (!sel.options.length) sel.innerHTML = list.map((s) => `<option value="${s.id}">${s.name} — ${brl(s.price)}</option>`).join('');
    sel.value = this.state.id;
    const s = list.find((x) => x.id === this.state.id);
    const slider = $('#priceSlider');
    slider.min = Math.round(s.price * 0.5);
    slider.max = Math.round(s.price * 1.5);
    if (!keep || this.state.price == null) this.state.price = s.price;
    slider.value = this.state.price;
    $$('[data-sens]').forEach((b) => b.classList.toggle('is-active', b.dataset.sens === this.state.sens));
    this.update();
  },

  update() {
    const s = this.services().find((x) => x.id === this.state.id);
    const price = +this.state.price;
    const q0 = ADMIN_DEMO.volume[s.id];
    const q1 = this.volumeAt(s, price);
    const rev0 = s.price * q0;
    const rev1 = price * q1;
    const delta = rev1 - rev0;
    const base = Finance.compute();
    const total1 = base.fat + delta;
    const pctPrice = ((price - s.price) / s.price) * 100;
    const slider = $('#priceSlider');
    slider.style.setProperty('--fill', `${((price - slider.min) / (slider.max - slider.min)) * 100}%`);

    $('#priceNow').textContent = brl(s.price);
    $('#priceNew').textContent = brl(price);
    $('#priceNewPct').textContent = `${pctPrice >= 0 ? '+' : ''}${pctPrice.toFixed(0)}%`;
    $('#priceNewPct').className = pctPrice > 0 ? 'up' : pctPrice < 0 ? 'down' : '';
    $('#priceClients').textContent = `${Math.round(q0)} → ${Math.round(q1)} clientes/mês`;
    $('#priceRev0').textContent = brl(base.fat);
    $('#priceRev1').textContent = brl(total1);
    const max = Math.max(base.fat, total1);
    $('#priceBar0').style.setProperty('--w', `${(base.fat / max) * 100}%`);
    $('#priceBar1').style.setProperty('--w', `${(total1 / max) * 100}%`);
    const impact = $('#priceImpact');
    impact.textContent = `${delta >= 0 ? '+' : '−'}${brl(Math.abs(delta))}/mês`;
    impact.className = `price-impact ${delta > 0.5 ? 'up' : delta < -0.5 ? 'down' : ''}`;
    const pctTotal = ((delta / base.fat) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    $('#priceImpactPct').textContent = `${delta >= 0 ? '+' : ''}${pctTotal}% no faturamento mensal`;

    const sug = this.suggestion(s);
    const gain = sug.rev - rev0;
    $('#priceTip').innerHTML = sug.price === s.price || gain < 1
      ? `💡 <b>Sugestão da IA:</b> ${s.name} já está no preço ideal para a sensibilidade escolhida.`
      : `💡 <b>Sugestão da IA:</b> cobrar <b>${brl(sug.price)}</b> no ${s.name} aumenta a receita em <b>${brl(gain)}/mês</b>, com ${Math.round(this.volumeAt(s, sug.price))} clientes por mês.`;
    $('#priceApply').hidden = sug.price === s.price || gain < 1 || sug.price === price;
    $('#priceApply').dataset.price = sug.price;
  },

  init() {
    $('#priceService').addEventListener('change', (e) => { this.state.id = e.target.value; this.render(false); });
    $('#priceSlider').addEventListener('input', (e) => { this.state.price = +e.target.value; this.update(); });
    $$('[data-sens]').forEach((b) => b.addEventListener('click', () => { this.state.sens = b.dataset.sens; this.render(true); }));
    $('#priceApply').addEventListener('click', (e) => {
      this.state.price = +e.currentTarget.dataset.price;
      $('#priceSlider').value = this.state.price;
      this.update();
      toast('Preço sugerido aplicado na simulação');
    });
  },
};

/* ==========================================================
   AUTOMAÇÃO & WHATSAPP
   ========================================================== */
const Automation = (() => {
  const KEY = 'corteza_automacoes';
  const DEFAULTS = { noshow: true, confirm: true, fila: true, review: false, birthday: true };
  const FLOW = {
    1: { label: 'Agendar', reply: 'Tenho estes horários amanhã: 10:00 · 14:30 · 16:00. Toque no link para garantir o seu: corteza.app/agendar ✂️' },
    2: { label: 'Endereço', reply: `Estamos na ${CONFIG.address}. Rota pronta no Google Maps ou no Waze 📍` },
    3: { label: 'Planos', reply: `Club Corteza ONE a partir de ${brl(PLANS.one[0].price)}/mês, com cortes ilimitados* às segundas e terças. Quer conhecer o BLACK? 💈` },
  };

  const toggles = () => ({ ...DEFAULTS, ...(store(KEY) || {}) });

  function renderToggles() {
    const t = toggles();
    $$('[data-auto]').forEach((b) => {
      const on = !!t[b.dataset.auto];
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', String(on));
    });
    const active = Object.values(t).filter(Boolean).length;
    $('#autoCount').textContent = `${active} de ${Object.keys(t).length} automações ativas`;
    $('#autopilotCount').textContent = `${active} automações ativas`;
  }

  /** Cliente do lembrete: próximo horário real de hoje, ou um exemplo */
  function noShowTarget() {
    const now = nowLocal();
    const next = DB.all().find((b) => b.kind === 'agendamento' && b.status === 'agendado' && b.date === now.iso && toMinutes(b.time) > now.minutes && !b.demo);
    return next ? { name: next.name.split(' ')[0], time: next.time, real: true } : { name: 'Rafael', time: '17:30', real: false };
  }

  function renderNoShow() {
    const t = noShowTarget();
    const sendAt = toHHMM(Math.max(0, toMinutes(t.time) - 120));
    $('#noShowMsg').innerHTML = `Olá <b>${esc(t.name)}</b>, seu horário com o ${esc(CONFIG.barber)} é hoje às <b>${t.time}</b>. 💈<br>Responda <b>1</b> para confirmar ou <b>2</b> para remarcar.`;
    $('#noShowWhen').textContent = `Disparo automático às ${sendAt} (2h antes)${t.real ? ' · próximo cliente da agenda' : ''}`;
    $$('#noShowStatus li').forEach((li) => li.classList.remove('is-done', 'is-current'));
    $('#noShowStatus li').classList.add('is-done');
    $('#noShowStatus li small').textContent = sendAt;
    $('#noShowReply').classList.remove('is-shown');
    $('#noShowSim').disabled = false;
    $('#noShowSim').textContent = '▶ Simular disparo';
  }

  async function simulateNoShow() {
    const id = ++admin.noShowRun;
    const btn = $('#noShowSim');
    btn.disabled = true;
    btn.textContent = 'Disparando…';
    const steps = $$('#noShowStatus li');
    steps.forEach((li, i) => { li.classList.toggle('is-done', i === 0); li.classList.remove('is-current'); });
    $('#noShowReply').classList.remove('is-shown');
    const wait = (ms) => new Promise((r) => setTimeout(r, reduceMotion() ? 0 : ms));
    const time = () => new Date().toLocaleTimeString('pt-BR', { timeZone: CONFIG.timezone, hour: '2-digit', minute: '2-digit' });
    for (let i = 1; i < steps.length; i++) {
      steps[i].classList.add('is-current');
      await wait(i === steps.length - 1 ? 1300 : 900);
      if (id !== admin.noShowRun) return;
      steps[i].classList.remove('is-current');
      steps[i].classList.add('is-done');
      steps[i].querySelector('small').textContent = time();
      if (i === steps.length - 1) $('#noShowReply').classList.add('is-shown');
    }
    btn.disabled = false;
    btn.textContent = '↻ Simular de novo';
    toast('Cliente confirmou presença ✓');
  }

  /** Destaca um ramo da árvore e mostra a resposta do robô */
  async function showBranch(n, auto) {
    const run = ++admin.flowRun;
    if (!auto) clearTimeout(admin.flowTimer);
    $$('.flow-branch').forEach((b) => b.classList.toggle('is-active', b.dataset.branch === String(n)));
    $('#flowTree').dataset.active = n;
    const out = $('#flowReply');
    out.classList.remove('is-shown');
    out.innerHTML = '<span class="ai-typing"><span></span><span></span><span></span></span>';
    out.classList.add('is-typing');
    await new Promise((r) => setTimeout(r, reduceMotion() ? 0 : 900));
    if (run !== admin.flowRun) return;
    out.classList.remove('is-typing');
    out.innerHTML = `<small>🤖 Robô Corteza · resposta automática</small>${esc(FLOW[n].reply)}`;
    out.classList.add('is-shown');
    const c = $('#flowTouches');
    c.textContent = String((+c.dataset.n || 0) + 1);
    c.dataset.n = c.textContent;
  }

  /** Percorre 1 → 2 → 3 sozinho enquanto a tela estiver aberta */
  function autoplay(n = 1) {
    clearTimeout(admin.flowTimer);
    if (admin.view !== 'automacao' || $('#panel').hidden) return;
    showBranch(n, true);
    admin.flowTimer = setTimeout(() => autoplay(n % 3 + 1), 4200);
  }

  function start() {
    renderToggles();
    renderNoShow();
    $('#flowTouches').dataset.n = 0;
    $('#flowTouches').textContent = '0';
    autoplay(1);
  }

  function stop() {
    clearTimeout(admin.flowTimer);
    admin.flowRun++;
    admin.noShowRun++;
  }

  function init() {
    $$('[data-auto]').forEach((b) => b.addEventListener('click', () => {
      const t = toggles();
      t[b.dataset.auto] = !t[b.dataset.auto];
      store(KEY, t);
      renderToggles();
      toast(t[b.dataset.auto] ? 'Automação ativada ⚡' : 'Automação pausada');
    }));
    $('#noShowSim').addEventListener('click', simulateNoShow);
    $$('.flow-branch').forEach((b) => b.addEventListener('click', () => showBranch(+b.dataset.branch, false)));
  }

  return { init, start, stop, renderToggles };
})();

/* ----------------------------------------------------------
   INIT
   ---------------------------------------------------------- */
function initAdmin() {
  $$('[data-view]').forEach((b) => b.addEventListener('click', () => showView(b.dataset.view)));
  $('#panel').addEventListener('click', (e) => {
    const t = e.target.closest('[data-admin-toast]');
    if (t) toast(t.dataset.adminToast);
    const go = e.target.closest('[data-view-go]');
    if (go) showView(go.dataset.viewGo);
  });
  Finance.init();
  Pricing.init();
  Automation.init();
  Automation.renderToggles();
}
