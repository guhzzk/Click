/* ==========================================================
   Mensagens do WhatsApp (criadas pelo barbeiro)
   - Lista livre: criar, editar, ligar/desligar e excluir
   - Cada mensagem diz ONDE aparece (horário marcado, concluído,
     cancelado, fila de espera ou só guardada)
   - Na agenda, o botão "WhatsApp ▾" lista as mensagens ativas
     daquele tipo e abre o WhatsApp do cliente com o texto pronto
   ========================================================== */

const Messages = (() => {
  const KEY = 'corteza_mensagens_v2';

  /** Onde a mensagem pode aparecer */
  const PLACES = {
    agendado: { label: 'Horário marcado', hint: 'aparece nos horários marcados da agenda' },
    concluido: { label: 'Atendimento concluído', hint: 'aparece nos atendimentos concluídos' },
    cancelado: { label: 'Horário cancelado', hint: 'aparece nos horários cancelados' },
    fila: { label: 'Fila de espera', hint: 'aparece na fila de espera' },
    guardada: { label: 'Só guardar', hint: 'fica guardada, sem botão na agenda' },
  };

  /** Mensagens iniciais (podem ser editadas ou excluídas) */
  const DEFAULTS = [
    { id: 'confirm', title: 'Confirmação', place: 'agendado', on: true, text: 'Olá, {nome}! Seu horário na Corteza está confirmado: {data} às {hora} ({servico}). Endereço: {endereco}. Até lá! 💈' },
    { id: 'noshow', title: 'Lembrete', place: 'agendado', on: true, text: 'Fala, {nome}! Passando pra lembrar do seu horário {data} às {hora} com o {barbeiro}. Responde 1 pra confirmar ou 2 pra remarcar. ✂️' },
    { id: 'cancel', title: 'Aviso de cancelamento', place: 'cancelado', on: true, text: 'Olá, {nome}. Precisei cancelar seu horário de {data} às {hora}. Me chama aqui que a gente remarca rapidinho! 🙏' },
    { id: 'review', title: 'Pedir avaliação', place: 'concluido', on: true, text: 'Valeu pela visita, {nome}! Se curtiu o resultado, deixa sua avaliação pra gente? Faz muita diferença. 🙌' },
    { id: 'fila', title: 'Avisar vaga', place: 'fila', on: true, text: 'Olá, {nome}! Abriu uma vaga na Corteza em {data} ({periodo}). Quer que eu reserve pra você? 💈' },
  ];

  /** Campos que viram dados do cliente */
  const VARS = [
    { key: 'nome', label: 'nome do cliente' },
    { key: 'data', label: 'data' },
    { key: 'hora', label: 'hora' },
    { key: 'servico', label: 'serviço' },
    { key: 'valor', label: 'valor' },
    { key: 'periodo', label: 'período (fila)' },
    { key: 'barbeiro', label: 'seu nome' },
    { key: 'endereco', label: 'endereço' },
  ];
  const EXAMPLE = { nome: 'Rafael', data: 'quarta, 11/11', hora: '15:00', servico: 'Corte + Barba', valor: 'R$ 75,00', periodo: 'tarde' };

  let editing = null; // id em edição ('' = nova)

  /* ---------- Dados ---------- */

  /** Converte o formato antigo (textos fixos + liga/desliga) na lista nova, uma vez */
  function migrate() {
    const oldText = store('corteza_mensagens_v1') || {};
    const oldOn = store('corteza_automacoes') || {};
    return DEFAULTS.map((m) => ({
      ...m,
      text: oldText[m.id] ?? m.text,
      on: oldOn[m.id] ?? m.on,
    }));
  }

  function list() {
    let l = store(KEY);
    if (!l) { l = migrate(); store(KEY, l); }
    return l;
  }
  const save = (l) => store(KEY, l);
  const get = (id) => list().find((m) => m.id === id);

  /** Troca {campo} pelos dados; campos desconhecidos ficam como estão */
  function fill(tpl, data) {
    const all = { barbeiro: CONFIG.barber, endereco: CONFIG.address, ...data };
    return tpl.replace(/\{(\w+)\}/g, (m, k) => (k in all ? String(all[k] ?? '') : m)).replace(/ {2,}/g, ' ').trim();
  }

  function bookingData(b) {
    return {
      nome: (b.name || '').split(' ')[0],
      data: formatDateLong(b.date),
      hora: b.time,
      servico: bookingItemsText(b),
      valor: b.total ? brl(b.total) : '',
    };
  }

  /** Mensagens ativas de um lugar */
  const forPlace = (place) => list().filter((m) => m.on && m.place === place);

  /**
   * Botão "WhatsApp ▾" com as mensagens ativas do lugar.
   * Uma só mensagem vira link direto; nenhuma = botão some.
   */
  function menu(place, phone, data, who = '') {
    if (!phone) return '';
    const msgs = forPlace(place);
    if (!msgs.length) return '';
    const label = who ? ` para ${esc(who)}` : '';
    if (msgs.length === 1) {
      const m = msgs[0];
      return `<a class="icon-btn icon-btn--whats" href="${whatsUrl(fill(m.text, data), phone)}" target="_blank" rel="noopener" aria-label="${esc(m.title)}${label} pelo WhatsApp">${esc(m.title)}</a>`;
    }
    return `
      <div class="wa-menu">
        <button type="button" class="icon-btn icon-btn--whats" data-wa-menu aria-haspopup="true" aria-expanded="false">WhatsApp ▾</button>
        <div class="wa-menu__list" role="menu" hidden>
          ${msgs.map((m) => `<a role="menuitem" href="${whatsUrl(fill(m.text, data), phone)}" target="_blank" rel="noopener"><b>${esc(m.title)}</b><small>${esc(fill(m.text, data)).slice(0, 70)}…</small></a>`).join('')}
        </div>
      </div>`;
  }

  /* ---------- Tela de Automação ---------- */
  function render() {
    const l = list();
    const active = l.filter((m) => m.on).length;
    $('#autoCount').textContent = `${l.length} mensage${l.length === 1 ? 'm' : 'ns'} · ${active} ativa${active === 1 ? '' : 's'}`;

    const editor = editing !== null ? editorHtml(editing ? get(editing) : null) : '';
    $('#autoList').innerHTML = (editing === '' ? editor : '') + (l.length ? l.map((m) => editing === m.id ? editor : `
      <div class="msg-item ${m.on ? 'is-on' : ''}" data-msg="${m.id}">
        <div class="msg-item__head">
          <div class="msg-item__txt">
            <b>${esc(m.title)}</b>
            <small class="msg-place msg-place--${m.place}">${PLACES[m.place].label}</small>
          </div>
          <button class="btn btn--text btn--sm msg-item__edit" type="button" data-msg-edit="${m.id}">Editar</button>
          <button class="msg-switch ${m.on ? 'is-on' : ''}" type="button" role="switch" aria-checked="${m.on}" data-msg-toggle="${m.id}" aria-label="Ativar ${esc(m.title)}">
            <span class="ai-switch__track" aria-hidden="true"><span class="ai-switch__thumb"></span></span>
          </button>
        </div>
        <p class="msg-item__preview">${esc(fill(m.text, EXAMPLE))}</p>
      </div>`).join('') : '<p class="empty">Nenhuma mensagem. Toque em “+ Nova mensagem”.</p>');
  }

  function editorHtml(m) {
    const place = m ? m.place : 'agendado';
    return `
      <form class="msg-editor-card" id="msgForm" novalidate>
        <h4 class="card-title">${m ? 'Editar mensagem' : 'Nova mensagem'}</h4>
        <label class="field field--full">
          <span>Nome da mensagem</span>
          <input type="text" id="msgTitle" maxlength="40" placeholder="Ex.: Promoção de terça" value="${m ? esc(m.title) : ''}">
        </label>
        <div class="field field--full">
          <span>Onde o botão aparece</span>
          <div class="seg-chips" role="radiogroup">
            ${Object.entries(PLACES).map(([k, p]) => `
              <label class="seg-chip"><input type="radio" name="msgPlace" value="${k}" ${k === place ? 'checked' : ''}><span>${p.label}</span></label>`).join('')}
          </div>
          <small class="muted" id="msgPlaceHint">${PLACES[place].hint}</small>
        </div>
        <label class="field field--full">
          <span>Texto (com as suas palavras)</span>
          <textarea id="msgText" rows="4" maxlength="700" placeholder="Ex.: Fala {nome}! Seu horário é {data} às {hora}.">${m ? esc(m.text) : ''}</textarea>
        </label>
        <div class="msg-vars">
          <span>Inserir:</span>
          ${VARS.map((v) => `<button type="button" class="msg-var" data-var="${v.key}" title="${v.label}">{${v.key}}</button>`).join('')}
        </div>
        <div class="msg-preview">
          <small>Como o cliente vai receber</small>
          <div class="msg-bubble" id="msgPreview">${m ? esc(fill(m.text, EXAMPLE)) : '…'}</div>
        </div>
        <div class="msg-editor__actions">
          ${m ? `<button type="button" class="btn btn--text btn--sm msg-delete" data-msg-delete="${m.id}">Excluir mensagem</button>` : ''}
          <span class="spacer"></span>
          <button type="button" class="btn btn--text btn--sm" data-msg-cancel>Cancelar</button>
          <button type="submit" class="btn btn--gold btn--sm">Salvar</button>
        </div>
      </form>`;
  }

  function openEditor(id) {
    editing = id;
    render();
    const f = $('#msgForm');
    f.scrollIntoView({ block: 'nearest' });
    (id ? $('#msgText') : $('#msgTitle')).focus();
  }

  function closeEditor() { editing = null; render(); }

  function submit(e) {
    e.preventDefault();
    const title = $('#msgTitle').value.trim();
    const text = $('#msgText').value.trim();
    const place = $('input[name="msgPlace"]:checked').value;
    if (title.length < 2) { $('#msgTitle').focus(); return toast('Dê um nome para a mensagem'); }
    if (text.length < 3) { $('#msgText').focus(); return toast('Escreva o texto da mensagem'); }
    const l = list();
    if (editing) Object.assign(l.find((m) => m.id === editing), { title, text, place });
    else l.push({ id: 'msg-' + Date.now().toString(36), title, text, place, on: true });
    save(l);
    toast(editing ? 'Mensagem salva ✓' : 'Mensagem criada ✓');
    closeEditor();
    if (typeof refreshPanel === 'function') refreshPanel();
  }

  function insertAtCursor(ta, str) {
    const s = ta.selectionStart ?? ta.value.length;
    const e = ta.selectionEnd ?? ta.value.length;
    ta.value = ta.value.slice(0, s) + str + ta.value.slice(e);
    ta.focus();
    ta.setSelectionRange(s + str.length, s + str.length);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /* ---------- Menu "WhatsApp ▾" (agenda e fila) ---------- */
  function closeMenus(except) {
    $$('.wa-menu__list').forEach((l) => {
      if (l === except) return;
      l.hidden = true;
      l.previousElementSibling.setAttribute('aria-expanded', 'false');
      const host = l.closest('.pbk, .wl-row');
      if (host) host.classList.remove('has-menu');
    });
  }

  function init() {
    $('#msgNew').addEventListener('click', () => openEditor(''));
    $('#msgRestore').addEventListener('click', () => {
      if (!confirm('Trazer de volta as 5 mensagens padrão? As suas mensagens continuam na lista.')) return;
      const l = list();
      DEFAULTS.forEach((d) => { if (!l.some((m) => m.id === d.id)) l.push({ ...d }); });
      save(l);
      render();
      toast('Mensagens padrão restauradas');
    });

    const box = $('#autoList');
    box.addEventListener('click', (e) => {
      const tog = e.target.closest('[data-msg-toggle]');
      if (tog) {
        const l = list();
        const m = l.find((x) => x.id === tog.dataset.msgToggle);
        m.on = !m.on;
        save(l);
        render();
        toast(m.on ? 'Mensagem ativada' : 'Mensagem desativada');
        if (typeof refreshPanel === 'function') refreshPanel();
        return;
      }
      const ed = e.target.closest('[data-msg-edit]');
      if (ed) return openEditor(ed.dataset.msgEdit);
      if (e.target.closest('[data-msg-cancel]')) return closeEditor();
      const del = e.target.closest('[data-msg-delete]');
      if (del) {
        const m = get(del.dataset.msgDelete);
        if (!confirm(`Excluir a mensagem "${m.title}"?`)) return;
        save(list().filter((x) => x.id !== m.id));
        toast('Mensagem excluída');
        closeEditor();
        if (typeof refreshPanel === 'function') refreshPanel();
        return;
      }
      const v = e.target.closest('[data-var]');
      if (v) insertAtCursor($('#msgText'), `{${v.dataset.var}}`);
    });
    box.addEventListener('input', (e) => {
      if (e.target.id === 'msgText') $('#msgPreview').textContent = fill(e.target.value, EXAMPLE) || '…';
    });
    box.addEventListener('change', (e) => {
      if (e.target.name === 'msgPlace') $('#msgPlaceHint').textContent = PLACES[e.target.value].hint;
    });
    box.addEventListener('submit', submit);

    // Abre/fecha os menus "WhatsApp ▾" em qualquer lugar do painel
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-wa-menu]');
      if (btn) {
        const l = btn.nextElementSibling;
        const open = l.hidden;
        closeMenus(l);
        l.hidden = !open;
        btn.setAttribute('aria-expanded', String(open));
        // O card com o menu aberto fica por cima dos vizinhos
        const host = btn.closest('.pbk, .wl-row');
        if (host) host.classList.toggle('has-menu', open);
        return;
      }
      if (e.target.closest('.wa-menu__list a')) { closeMenus(); return; }
      if (!e.target.closest('.wa-menu')) closeMenus();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenus(); });
  }

  return { list, fill, bookingData, menu, render, init };
})();
