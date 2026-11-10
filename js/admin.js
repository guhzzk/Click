/* ==========================================================
   Área administrativa do painel (barbeiro)
   Telas: Visão Geral · Agenda · Financeiro · Catálogo de Serviços ·
          Controle de Estoque · Automação (mensagens: js/messages.js,
          financeiro: js/finance.js)
   A agenda (lista, filtros e novo horário) fica em js/panel.js.
   Tudo é salvo no navegador (localStorage).
   ========================================================== */

const admin = { view: 'geral' };

/* ----------------------------------------------------------
   NAVEGAÇÃO ENTRE TELAS (instantânea, só troca de classe)
   ---------------------------------------------------------- */
function showView(view) {
  admin.view = view;
  AgendaSeed.ensure(); // demonstração: semana com horários de exemplo (só na primeira vez)
  $$('[data-view]').forEach((b) => {
    const on = b.dataset.view === view;
    b.classList.toggle('is-active', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  $$('.admin-view').forEach((s) => s.classList.toggle('is-active', s.dataset.viewPane === view));
  const p = $('#panel');
  if (p.scrollTop > 120) p.scrollTo({ top: 0, behavior: 'auto' });

  if (view === 'geral') { renderPanelStats(); Overview.render(); renderReport(); Backup.renderInfo(); }
  if (view === 'agenda') { renderAgendaStatus(); showPanelTab(['agenda', 'novo'].includes(panel.tab) ? panel.tab : 'agenda'); }
  if (view === 'catalogo') Catalog.render();
  if (view === 'estoque') Stock.render();
  if (view === 'financeiro') Finance.render();
  if (view === 'automacao') Messages.render();
}

const fmtShortDate = (iso) => { const d = addDays(iso, 0); return `${pad(d.d)}/${pad(d.m + 1)}`; };
const uidShort = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** Converte "1.234,56" / "45,90" / "45.9" em número (ou null se vazio) */
function parseMoney(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = parseFloat(s.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

/* ==========================================================
   VISÃO GERAL
   ========================================================== */
const Overview = {
  render() {
    // Alerta de estoque baixo
    const low = Stock.lowItems();
    const alert = $('#ovStockAlert');
    alert.hidden = !low.length;
    if (low.length) {
      alert.innerHTML = `<span aria-hidden="true">⚠️</span>
        <p><b>Estoque baixo:</b> ${low.map((p) => `${esc(p.name)} (${p.qty})`).join(', ')}</p>
        <button class="btn btn--sm btn--gold" data-view-go="estoque">Ver estoque</button>`;
    }

    // Contas a pagar no mês
    const fin = Finance.totals(nowLocal().iso.slice(0, 7));
    const bills = $('#ovBills');
    bills.hidden = !fin.pending;
    if (fin.pending) {
      bills.innerHTML = `<span aria-hidden="true">💸</span>
        <p><b>Contas a pagar:</b> ${brl(fin.pending)} em ${MONTH_NAME[nowLocal().m - 1]} · resultado do mês até agora ${brl(fin.resultado)}</p>
        <button class="btn btn--sm btn--gold" data-view-go="financeiro">Ver financeiro</button>`;
    }

    // Próximos horários
    const now = nowLocal();
    const next = DB.all().filter((b) => b.kind === 'agendamento' && b.status === 'agendado' && !b.demo
      && (b.date > now.iso || (b.date === now.iso && toMinutes(b.time) >= now.minutes - CONFIG.slotMinutes))).slice(0, 6);
    $('#ovUpcoming').innerHTML = next.length ? next.map((b) => `
      <li>
        <time><b>${b.time}</b>${b.date === now.iso ? 'hoje' : `${WEEK_SHORT[addDays(b.date, 0).dow]} ${fmtShortDate(b.date)}`}</time>
        <span><strong>${esc(b.name)}</strong><small>${esc(bookingItemsText(b))}</small></span>
        <em>${b.total ? brl(b.total) : '—'}</em>
      </li>`).join('') : '<li class="empty">Nenhum horário pela frente.</li>';
  },
};

/* ==========================================================
   AGENDA — status do Guilherme e horários de exemplo
   ========================================================== */
function renderAgendaStatus() {
  const now = nowLocal();
  const h = CONFIG.hours[now.dow];
  const today = DB.all().filter((b) => b.date === now.iso && b.kind === 'agendamento' && b.status !== 'cancelado');
  const inSlot = today.find((b) => b.status === 'agendado' && now.minutes >= toMinutes(b.time) && now.minutes < toMinutes(b.time) + CONFIG.slotMinutes);
  let status = 'Fora do expediente', cls = 'off';
  if (h && now.minutes >= h[0] * 60 && now.minutes < h[1] * 60) {
    status = inSlot ? `Atendendo ${inSlot.name.split(' ')[0]}` : 'Livre agora';
    cls = inSlot ? 'busy' : 'free';
  }
  $('#agendaStatus').innerHTML = `<i></i>${esc(CONFIG.barber)} · ${status}`;
  $('#agendaStatus').className = `pro__status pro__status--${cls}`;
}

/** No modo demonstração, preenche a semana com horários de exemplo (uma vez) */
const AgendaSeed = {
  KEY: 'corteza_agenda_exemplo',
  NAMES: ['Rafael Moreira', 'Bruno Kowalski', 'Lucas Andrade', 'Matheus Ribas', 'Felipe Zanon', 'Diego Prado', 'Thiago Lemos', 'André Souza', 'Caio Nogueira', 'Vitor Hugo', 'Gabriel Costa', 'Pedro Lima'],

  ensure() {
    if (!isDemo() || store(this.KEY)) return;
    const today = nowLocal().iso;
    const week = DB.all().some((b) => !b.demo && b.kind === 'agendamento' && b.date >= today && b.date <= addDays(today, 6).iso);
    store(this.KEY, true);
    if (week) return;

    const services = Catalog.list().filter((s) => s.price != null && ['corte', 'barba', 'sobrancelha', 'c-corte-barba', 'c-corte-sobrancelha', 'c-completo'].includes(s.id));
    const items = [];
    let n = 0;
    for (let i = 0; i < 7; i++) {
      const day = addDays(today, i);
      if (!CONFIG.hours[day.dow]) continue;
      const slots = daySlots(day.iso).filter((m) => !DB.isTaken(day.iso, toHHMM(m)));
      const count = day.dow === 6 ? 7 : 4 + (i % 2);
      // Espalha os horários pelo dia
      const step = Math.max(1, Math.floor(slots.length / count));
      for (let k = 0; k < count && k * step < slots.length; k++) {
        const s = services[(n + k) % services.length];
        const name = this.NAMES[n % this.NAMES.length];
        items.push({
          kind: 'agendamento', status: 'agendado', sample: true, origin: n % 3 ? 'site' : 'barbeiro',
          date: day.iso, time: toHHMM(slots[k * step + (n % 2)] ?? slots[k * step]),
          items: [s.id], total: s.price, ask: false, pay: n % 4 === 0 ? 'pix' : 'local', paid: n % 4 === 0,
          name, phone: `(41) 9${String(8800 + n * 37).padStart(4, '0')}-${String(1000 + n * 113).slice(-4)}`,
        });
        n++;
      }
    }
    DB.addMany(items);
  },

  clear() {
    DB.removeWhere((b) => b.sample);
    toast('Horários de exemplo removidos');
  },
};

/* ==========================================================
   CATÁLOGO DE SERVIÇOS
   ========================================================== */
const DEFAULT_DURATION = {
  corte: 30, barba: 30, sobrancelha: 15, cavanhaque: 15, hidratacao: 30, limpeza: 40, ozonio: 40, depilacao: 15, pintura: 45,
  'c-corte-sobrancelha': 45, 'c-corte-barba': 60, 'c-barba-sobrancelha': 45, 'c-completo': 75, nevou: 90,
};
const IN_PLAN = ['corte', 'barba', 'sobrancelha', 'c-corte-sobrancelha', 'c-corte-barba', 'c-barba-sobrancelha', 'c-completo'];

const Catalog = {
  KEY: 'corteza_catalogo_v1',
  editing: null,

  /** Lista salva; na primeira vez nasce dos serviços do site (js/config.js) */
  list() {
    let list = store(this.KEY);
    if (!list) {
      list = [...SERVICES.avulsos, ...SERVICES.combos, ...SERVICES.quimicas].map((s) => ({
        id: s.id, name: s.name, price: s.price, duration: DEFAULT_DURATION[s.id] || 30, plan: IN_PLAN.includes(s.id), fromSite: true,
      }));
      store(this.KEY, list);
    }
    return list;
  },

  save(list) {
    store(this.KEY, list);
    this.syncItems();
    renderNewServices();
  },

  get: (id) => Catalog.list().find((s) => s.id === id),

  /** Serviços criados no painel passam a valer na agenda (nomes e valores) */
  syncItems() {
    this.list().forEach((s) => {
      if (!ALL_ITEMS[s.id] || ALL_ITEMS[s.id].custom) ALL_ITEMS[s.id] = { id: s.id, name: s.name, price: s.price, type: 'servico', cat: 'catalogo', custom: true };
    });
  },

  render() {
    const list = this.list();
    const priced = list.filter((s) => s.price != null);
    const avg = priced.length ? priced.reduce((t, s) => t + s.price, 0) / priced.length : 0;
    $('#catSummary').innerHTML = `
      <div><b>${list.length}</b><span>serviços</span></div>
      <div><b>${list.filter((s) => s.plan).length}</b><span>inclusos no plano</span></div>
      <div><b>${brl(avg)}</b><span>preço médio</span></div>`;
    $('#catList').innerHTML = list.length ? list.map((s) => `
      <div class="erp-row" data-id="${s.id}">
        <div class="erp-row__main"><b>${esc(s.name)}</b><small>${s.duration} min</small></div>
        <span class="erp-row__price">${s.price != null ? brl(s.price) : 'Sob consulta'}</span>
        <span class="badge ${s.plan ? 'badge--concluido' : 'badge--cancelado'}">${s.plan ? 'No plano' : 'Avulso'}</span>
        <div class="erp-row__actions">
          <button class="icon-btn" data-cat-edit="${s.id}">Editar</button>
          <button class="icon-btn icon-btn--danger" data-cat-del="${s.id}" aria-label="Excluir ${esc(s.name)}">Excluir</button>
        </div>
      </div>`).join('') : '<p class="empty">Nenhum serviço cadastrado.</p>';
  },

  openForm(id) {
    const s = id ? this.get(id) : null;
    this.editing = id || null;
    $('#catFormTitle').textContent = s ? 'Editar serviço' : 'Novo serviço';
    $('#catName').value = s ? s.name : '';
    $('#catPrice').value = s && s.price != null ? String(s.price).replace('.', ',') : '';
    $('#catDuration').value = s ? s.duration : 30;
    $('#catPlan').checked = s ? !!s.plan : false;
    toggleForm($('#catForm'), true);
    setTimeout(() => $('#catName').focus(), 50);
  },

  submit(e) {
    e.preventDefault();
    const name = $('#catName').value.trim();
    const price = parseMoney($('#catPrice').value);
    const duration = Math.max(5, parseInt($('#catDuration').value, 10) || 0);
    if (name.length < 2) { $('#catName').focus(); return toast('Digite o nome do serviço'); }
    if ($('#catPrice').value.trim() && price == null) { $('#catPrice').focus(); return toast('Preço inválido'); }
    const list = this.list();
    const data = { name, price, duration, plan: $('#catPlan').checked };
    if (this.editing) Object.assign(list.find((s) => s.id === this.editing), data);
    else list.push({ id: 'svc-' + uidShort(), ...data });
    this.save(list);
    toggleForm($('#catForm'), false);
    toast(this.editing ? 'Serviço atualizado ✓' : 'Serviço cadastrado ✓');
    this.editing = null;
    this.render();
  },

  remove(id) {
    const s = this.get(id);
    if (!s || !confirm(`Excluir "${s.name}" do catálogo?`)) return;
    this.save(this.list().filter((x) => x.id !== id));
    toast('Serviço excluído');
    this.render();
  },

  init() {
    this.syncItems();
    $('#catNew').addEventListener('click', () => this.openForm(null));
    $('#catCancel').addEventListener('click', () => toggleForm($('#catForm'), false));
    $('#catForm').addEventListener('submit', (e) => this.submit(e));
    $('#catList').addEventListener('click', (e) => {
      const ed = e.target.closest('[data-cat-edit]');
      const del = e.target.closest('[data-cat-del]');
      if (ed) this.openForm(ed.dataset.catEdit);
      if (del) this.remove(del.dataset.catDel);
    });
  },
};

/* ==========================================================
   CONTROLE DE ESTOQUE
   ========================================================== */
const LOW_STOCK = 3;

const Stock = {
  KEY: 'corteza_estoque_v1',
  editing: null,

  list() {
    let list = store(this.KEY);
    if (!list) {
      // Demonstração: linha El Guapo com custos e quantidades de exemplo
      list = isDemo() ? [
        { id: 'st-oleo', productId: 'p-oleo', name: 'Óleo para barba El Guapo', cost: 27.5, price: 55, qty: 8 },
        { id: 'st-balm', productId: 'p-balm', name: 'Balm para barba El Guapo', cost: 30, price: 60, qty: 3 },
        { id: 'st-brilho', productId: 'p-brilho', name: 'Cera brilho El Guapo', cost: 32, price: 65, qty: 12 },
        { id: 'st-matte', productId: 'p-matte', name: 'Cera matte El Guapo', cost: 32, price: 65, qty: 2 },
      ] : [];
      store(this.KEY, list);
    }
    return list;
  },

  save(list) { store(this.KEY, list); },
  get: (id) => Stock.list().find((p) => p.id === id),
  lowItems: () => Stock.list().filter((p) => p.qty <= LOW_STOCK),

  /** Baixa (delta < 0) ou devolve (delta > 0) produtos vendidos num atendimento */
  moveByProduct(productId, delta) {
    const list = this.list();
    const item = list.find((p) => p.productId === productId);
    if (!item) return null;
    item.qty = Math.max(0, item.qty + delta);
    this.save(list);
    return item;
  },

  render() {
    const list = this.list();
    const low = this.lowItems();
    const units = list.reduce((t, p) => t + p.qty, 0);
    const costValue = list.reduce((t, p) => t + p.qty * p.cost, 0);
    const profit = list.reduce((t, p) => t + p.qty * (p.price - p.cost), 0);
    $('#stockSummary').innerHTML = `
      <div><b>${list.length}</b><span>produtos</span></div>
      <div><b>${units}</b><span>unidades</span></div>
      <div><b>${brl(costValue)}</b><span>em estoque (custo)</span></div>
      <div><b>${brl(profit)}</b><span>lucro se vender tudo</span></div>`;

    const alert = $('#stockAlert');
    alert.hidden = !low.length;
    alert.innerHTML = low.length
      ? `<span aria-hidden="true">⚠️</span><p><b>Estoque Baixo:</b> ${low.length} produto${low.length === 1 ? '' : 's'} com ${LOW_STOCK} unidades ou menos. Hora de repor.</p>`
      : '';

    $('#stockList').innerHTML = list.length ? list.map((p) => {
      const margin = p.price > 0 ? Math.round(((p.price - p.cost) / p.price) * 100) : 0;
      const isLow = p.qty <= LOW_STOCK;
      return `
        <div class="erp-row ${isLow ? 'erp-row--low' : ''}" data-id="${p.id}">
          <div class="erp-row__main">
            <b>${esc(p.name)}</b>
            <small>Custo ${brl(p.cost)} · Venda ${brl(p.price)} · Margem ${margin}%</small>
          </div>
          <div class="qty" role="group" aria-label="Quantidade de ${esc(p.name)}">
            <button class="qty__btn" data-qty="-1" data-id="${p.id}" aria-label="Diminuir">−</button>
            <b class="qty__val">${p.qty}</b>
            <button class="qty__btn" data-qty="1" data-id="${p.id}" aria-label="Aumentar">+</button>
          </div>
          ${isLow ? `<span class="badge badge--low">${p.qty === 0 ? 'Sem estoque' : 'Estoque baixo'}</span>` : '<span class="badge badge--concluido">Em estoque</span>'}
          <div class="erp-row__actions">
            <button class="icon-btn" data-stock-edit="${p.id}">Editar</button>
            <button class="icon-btn icon-btn--danger" data-stock-del="${p.id}" aria-label="Excluir ${esc(p.name)}">Excluir</button>
          </div>
        </div>`;
    }).join('') : '<p class="empty">Nenhum produto cadastrado. Toque em “+ Cadastrar Produto”.</p>';
  },

  openForm(id) {
    const p = id ? this.get(id) : null;
    this.editing = id || null;
    $('#stockFormTitle').textContent = p ? 'Editar produto' : 'Cadastrar produto';
    $('#stName').value = p ? p.name : '';
    $('#stCost').value = p ? String(p.cost).replace('.', ',') : '';
    $('#stPrice').value = p ? String(p.price).replace('.', ',') : '';
    $('#stQty').value = p ? p.qty : '';
    $('#stBuyWrap').hidden = !!p; // só ao cadastrar
    $('#stBuy').checked = true;
    toggleForm($('#stockForm'), true);
    setTimeout(() => $('#stName').focus(), 50);
  },

  submit(e) {
    e.preventDefault();
    const name = $('#stName').value.trim();
    const cost = parseMoney($('#stCost').value);
    const price = parseMoney($('#stPrice').value);
    const qty = parseInt($('#stQty').value, 10);
    if (name.length < 2) { $('#stName').focus(); return toast('Digite o nome do produto'); }
    if (cost == null) { $('#stCost').focus(); return toast('Digite o preço de custo'); }
    if (price == null) { $('#stPrice').focus(); return toast('Digite o preço de venda'); }
    if (!Number.isInteger(qty) || qty < 0) { $('#stQty').focus(); return toast('Digite a quantidade'); }
    const list = this.list();
    const data = { name, cost, price, qty };
    const buy = !this.editing && $('#stBuy').checked && qty > 0;
    if (this.editing) Object.assign(list.find((p) => p.id === this.editing), data);
    else list.push({ id: 'st-' + uidShort(), ...data });
    this.save(list);
    // Compra registrada como despesa no Financeiro
    if (buy) Finance.addExpense({ desc: `Compra de estoque: ${name} (${qty} un.)`, cat: 'Compra de estoque', value: Math.round(cost * qty * 100) / 100 });
    toggleForm($('#stockForm'), false);
    toast(this.editing ? 'Produto atualizado ✓' : `Produto cadastrado ✓${buy ? ` · compra de ${brl(cost * qty)} lançada no Financeiro` : ''}`);
    if (qty <= LOW_STOCK) setTimeout(() => toast(`⚠️ Estoque baixo: ${name} (${qty})`), 1300);
    this.editing = null;
    this.render();
  },

  remove(id) {
    const p = this.get(id);
    if (!p || !confirm(`Excluir "${p.name}" do estoque?`)) return;
    this.save(this.list().filter((x) => x.id !== id));
    toast('Produto excluído');
    this.render();
  },

  init() {
    $('#stockNew').addEventListener('click', () => this.openForm(null));
    $('#stockCancel').addEventListener('click', () => toggleForm($('#stockForm'), false));
    $('#stockForm').addEventListener('submit', (e) => this.submit(e));
    $('#stockList').addEventListener('click', (e) => {
      const q = e.target.closest('[data-qty]');
      const ed = e.target.closest('[data-stock-edit]');
      const del = e.target.closest('[data-stock-del]');
      if (q) {
        const list = this.list();
        const p = list.find((x) => x.id === q.dataset.id);
        p.qty = Math.max(0, p.qty + Number(q.dataset.qty));
        this.save(list);
        this.render();
        if (p.qty <= LOW_STOCK && Number(q.dataset.qty) < 0) toast(`⚠️ Estoque baixo: ${p.name} (${p.qty})`);
      }
      if (ed) this.openForm(ed.dataset.stockEdit);
      if (del) this.remove(del.dataset.stockDel);
    });
  },
};

/** Mostra/esconde o formulário de cadastro */
function toggleForm(form, open) {
  form.hidden = !open;
  if (!open) form.reset();
}

/* ==========================================================
   BACKUP — baixar e restaurar todos os dados do painel
   ========================================================== */
const Backup = {
  STAMP: 'corteza_ultimo_backup',
  PREFIX: 'corteza_',

  /** Chaves salvas pelo site (menos a sessão de login) */
  keys() {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(this.PREFIX) && k !== 'corteza_sessao' && k !== this.STAMP) out.push(k);
    }
    return out.sort();
  },

  renderInfo() {
    const last = store(this.STAMP);
    const days = last ? Math.floor((Date.now() - Date.parse(last)) / 864e5) : null;
    const late = days == null || days >= 7;
    $('#backupCard').classList.toggle('is-late', late);
    $('#backupInfo').textContent = days == null ? '⚠️ Você ainda não fez nenhum backup.'
      : days === 0 ? '✓ Último backup: hoje.' : `${late ? '⚠️' : '✓'} Último backup: há ${days} dia${days === 1 ? '' : 's'}.`;
  },

  download() {
    const data = {};
    this.keys().forEach((k) => { data[k] = localStorage.getItem(k); });
    const file = { app: 'corteza', version: 1, exportedAt: new Date().toISOString(), data };
    const blob = new Blob([JSON.stringify(file, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `corteza-backup-${nowLocal().iso}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    store(this.STAMP, new Date().toISOString());
    this.renderInfo();
    toast('Backup baixado ✓ Guarde o arquivo num lugar seguro');
  },

  restore(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try { parsed = JSON.parse(reader.result); } catch (e) { parsed = null; }
      if (!parsed || parsed.app !== 'corteza' || typeof parsed.data !== 'object') return toast('Esse arquivo não é um backup da Corteza');
      const when = parsed.exportedAt ? new Date(parsed.exportedAt).toLocaleDateString('pt-BR') : '?';
      if (!confirm(`Restaurar o backup de ${when}?\nOs dados atuais deste aparelho serão substituídos.`)) return;
      this.keys().forEach((k) => localStorage.removeItem(k));
      Object.entries(parsed.data).forEach(([k, v]) => { if (k.startsWith(this.PREFIX) && typeof v === 'string') localStorage.setItem(k, v); });
      toast('Backup restaurado ✓ Recarregando…');
      setTimeout(() => location.reload(), 900);
    };
    reader.readAsText(file);
  },

  init() {
    $('#backupDown').addEventListener('click', () => this.download());
    $('#backupFile').addEventListener('change', (e) => {
      if (e.target.files[0]) this.restore(e.target.files[0]);
      e.target.value = '';
    });
  },
};

/* ----------------------------------------------------------
   INIT
   ---------------------------------------------------------- */
function initAdmin() {
  $$('[data-view]').forEach((b) => b.addEventListener('click', () => showView(b.dataset.view)));
  $('#panel').addEventListener('click', (e) => {
    const go = e.target.closest('[data-view-go]');
    if (go) showView(go.dataset.viewGo);
  });
  Catalog.init();
  Stock.init();
  Finance.init();
  Messages.init();
  Backup.init();
  renderNewServices();
}
