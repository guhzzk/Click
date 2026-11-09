/* ==========================================================
   Mensagens do WhatsApp escritas pelo barbeiro
   - Cada automação tem um texto editável com campos automáticos
     ({nome}, {data}, {hora}, {servico}...)
   - O interruptor liga/desliga o botão de envio na agenda
   - O envio abre o WhatsApp do cliente com o texto pronto
     (envio 100% automático exige a API oficial do WhatsApp)
   ========================================================== */

const Messages = (() => {
  const TPL_KEY = 'corteza_mensagens_v1';
  const ON_KEY = 'corteza_automacoes';

  /** Cada mensagem: onde é usada e o texto padrão */
  const LIST = [
    {
      key: 'confirm', title: 'Confirmação de agendamento', where: 'Botão "Confirmar" em cada horário da agenda', on: true,
      text: 'Olá, {nome}! Seu horário na Corteza está confirmado: {data} às {hora} ({servico}). Endereço: {endereco}. Até lá! 💈',
    },
    {
      key: 'noshow', title: 'Lembrete anti-falta', where: 'Botão "Lembrete" em cada horário da agenda', on: true,
      text: 'Fala, {nome}! Passando pra lembrar do seu horário {data} às {hora} com o {barbeiro}. Responde 1 pra confirmar ou 2 pra remarcar. ✂️',
    },
    {
      key: 'cancel', title: 'Aviso de cancelamento', where: 'Botão "Avisar cliente" em horários cancelados', on: true,
      text: 'Olá, {nome}. Precisei cancelar seu horário de {data} às {hora}. Me chama aqui que a gente remarca rapidinho! 🙏',
    },
    {
      key: 'review', title: 'Pós-atendimento', where: 'Botão "Pedir avaliação" em atendimentos concluídos', on: false,
      text: 'Valeu pela visita, {nome}! Se curtiu o resultado, deixa sua avaliação pra gente? Faz muita diferença. 🙌',
    },
    {
      key: 'fila', title: 'Aviso da fila de espera', where: 'Botão "Avisar vaga" na fila de espera da agenda', on: true,
      text: 'Olá, {nome}! Abriu uma vaga na Corteza em {data} ({periodo}). Quer que eu reserve pra você? 💈',
    },
    {
      key: 'birthday', title: 'Aniversário', where: 'Fica guardada para quando o cadastro do cliente tiver a data de aniversário', on: true,
      text: 'Feliz aniversário, {nome}! 🎉 A Corteza te deseja um dia daqueles. Passa aqui pra ficar na régua!',
    },
  ];

  /** Campos que o barbeiro pode inserir no texto */
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

  const saved = () => store(TPL_KEY) || {};
  const def = (key) => LIST.find((m) => m.key === key);
  const text = (key) => saved()[key] ?? def(key).text;
  const isCustom = (key) => saved()[key] != null && saved()[key] !== def(key).text;

  function enabledMap() {
    const base = Object.fromEntries(LIST.map((m) => [m.key, m.on]));
    return { ...base, ...(store(ON_KEY) || {}) };
  }
  const enabled = (key) => !!enabledMap()[key];

  /** Troca {campo} pelos dados; campos sem valor ficam em branco */
  function fill(tpl, data) {
    const all = { barbeiro: CONFIG.barber, endereco: CONFIG.address, ...data };
    return tpl.replace(/\{(\w+)\}/g, (m, k) => (k in all ? String(all[k] ?? '') : m)).replace(/ {2,}/g, ' ').trim();
  }

  /** Dados de um agendamento para preencher a mensagem */
  function bookingData(b) {
    return {
      nome: (b.name || '').split(' ')[0],
      data: formatDateLong(b.date),
      hora: b.time,
      servico: bookingItemsText(b),
      valor: b.total ? brl(b.total) : '',
    };
  }

  /** Link do WhatsApp do cliente com a mensagem escolhida (null se desligada ou sem telefone) */
  function link(key, phone, data) {
    if (!enabled(key) || !phone) return null;
    return whatsUrl(fill(text(key), data), phone);
  }

  /* ---------- Tela de Automação ---------- */
  function render() {
    const on = enabledMap();
    $('#autoCount').textContent = `${Object.values(on).filter(Boolean).length} de ${LIST.length} ativas`;
    $('#autoList').innerHTML = LIST.map((m) => `
      <div class="msg-item ${on[m.key] ? 'is-on' : ''}" data-msg="${m.key}">
        <div class="msg-item__head">
          <div class="msg-item__txt">
            <b>${m.title}${isCustom(m.key) ? ' <em class="msg-item__tag">sua mensagem</em>' : ''}</b>
            <small>${m.where}</small>
          </div>
          <button class="msg-item__edit btn btn--text btn--sm" type="button" data-msg-edit="${m.key}" aria-expanded="false">Editar mensagem</button>
          <button class="msg-switch ${on[m.key] ? 'is-on' : ''}" type="button" role="switch" aria-checked="${on[m.key]}" data-msg-toggle="${m.key}" aria-label="${m.title}">
            <span class="ai-switch__track" aria-hidden="true"><span class="ai-switch__thumb"></span></span>
          </button>
        </div>
        <p class="msg-item__preview">${esc(fill(text(m.key), EXAMPLE))}</p>
        <div class="msg-editor" hidden>
          <label class="field field--full">
            <span>Escreva com as suas palavras</span>
            <textarea rows="4" maxlength="700" data-msg-text="${m.key}">${esc(text(m.key))}</textarea>
          </label>
          <div class="msg-vars">
            <span>Inserir:</span>
            ${VARS.map((v) => `<button type="button" class="msg-var" data-var="${v.key}" title="${v.label}">{${v.key}}</button>`).join('')}
          </div>
          <div class="msg-preview">
            <small>Como o cliente vai receber</small>
            <div class="msg-bubble" data-msg-preview="${m.key}">${esc(fill(text(m.key), EXAMPLE))}</div>
          </div>
          <div class="msg-editor__actions">
            <button type="button" class="btn btn--text btn--sm" data-msg-reset="${m.key}">Voltar ao texto padrão</button>
            <button type="button" class="btn btn--gold btn--sm" data-msg-save="${m.key}">Salvar mensagem</button>
          </div>
        </div>
      </div>`).join('');
  }

  function insertAtCursor(ta, str) {
    const s = ta.selectionStart ?? ta.value.length;
    const e = ta.selectionEnd ?? ta.value.length;
    ta.value = ta.value.slice(0, s) + str + ta.value.slice(e);
    ta.focus();
    ta.setSelectionRange(s + str.length, s + str.length);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function init() {
    const box = $('#autoList');
    box.addEventListener('click', (e) => {
      const item = e.target.closest('[data-msg]');
      if (!item) return;
      const key = item.dataset.msg;

      if (e.target.closest('[data-msg-toggle]')) {
        const on = enabledMap();
        on[key] = !on[key];
        store(ON_KEY, on);
        render();
        toast(on[key] ? 'Mensagem ativada' : 'Mensagem desativada');
        if (typeof refreshPanel === 'function') refreshPanel();
        return;
      }
      if (e.target.closest('[data-msg-edit]')) {
        const ed = $('.msg-editor', item);
        const open = ed.hidden;
        ed.hidden = !open;
        e.target.closest('[data-msg-edit]').setAttribute('aria-expanded', String(open));
        e.target.closest('[data-msg-edit]').textContent = open ? 'Fechar' : 'Editar mensagem';
        if (open) $('textarea', item).focus();
        return;
      }
      const v = e.target.closest('[data-var]');
      if (v) { insertAtCursor($('textarea', item), `{${v.dataset.var}}`); return; }

      if (e.target.closest('[data-msg-save]')) {
        const value = $('textarea', item).value.trim();
        if (value.length < 3) return toast('Escreva a mensagem antes de salvar');
        const all = saved();
        all[key] = value;
        store(TPL_KEY, all);
        render();
        toast('Mensagem salva ✓');
        return;
      }
      if (e.target.closest('[data-msg-reset]')) {
        $('textarea', item).value = def(key).text;
        $('textarea', item).dispatchEvent(new Event('input', { bubbles: true }));
        const all = saved();
        delete all[key];
        store(TPL_KEY, all);
        toast('Texto padrão restaurado');
      }
    });
    // Prévia ao vivo enquanto digita
    box.addEventListener('input', (e) => {
      const ta = e.target.closest('[data-msg-text]');
      if (ta) $(`[data-msg-preview="${ta.dataset.msgText}"]`).textContent = fill(ta.value, EXAMPLE);
    });
  }

  return { LIST, text, fill, link, bookingData, enabled, render, init };
})();
