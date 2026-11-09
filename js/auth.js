/* ==========================================================
   Login de demonstração + área do cliente
   Não é um login seguro: o site é estático e as contas ficam em
   js/config.js. Para produção, use um backend (ex.: Firebase/Supabase).
   ========================================================== */

const Auth = (() => {
  const KEY = 'corteza_sessao';
  return {
    user() {
      const email = store(KEY);
      return USERS.find((u) => u.email === email) || null;
    },
    login(id, password) {
      const key = id.trim().toLowerCase();
      const u = USERS.find((x) => (x.email === key || x.user === key) && x.password === password);
      if (u) store(KEY, u.email);
      return u || null;
    },
    logout() { store(KEY, null); },
  };
})();

const STATUS_LABEL = { agendado: 'Agendado', concluido: 'Concluído', cancelado: 'Cancelado' };

/* ----------------------------------------------------------
   BOTÃO DA CONTA NO HEADER
   ---------------------------------------------------------- */
function renderAccountBtn() {
  const u = Auth.user();
  const btn = $('#accountBtn');
  const label = $('span', btn);
  btn.classList.toggle('is-logged', !!u);
  if (!u) label.textContent = 'Entrar';
  else if (u.role === 'barbeiro') label.textContent = 'Painel';
  else label.textContent = `Olá, ${u.name.split(' ')[0]}`;
  btn.setAttribute('aria-label', u ? `Conta de ${u.name}` : 'Entrar na conta');
}

function onAccountClick() {
  const u = Auth.user();
  if (!u) openModal($('#loginModal'));
  else if (u.role === 'barbeiro') openPanel();
  else openAccount();
}

/* ----------------------------------------------------------
   LOGIN
   ---------------------------------------------------------- */
function initLogin() {
  const modal = $('#loginModal');
  const form = $('#loginForm');
  const err = $('#loginError');

  $$('[data-close]', modal).forEach((b) => b.addEventListener('click', () => closeModal(modal)));

  // Preenche as contas de demonstração
  $$('[data-demo]', modal).forEach((b) => b.addEventListener('click', () => {
    const u = USERS.find((x) => x.user === b.dataset.demo);
    $('#lUser').value = u.email;
    $('#lPass').value = u.password;
    err.hidden = true;
  }));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const u = Auth.login($('#lUser').value, $('#lPass').value);
    if (!u) {
      err.hidden = false;
      form.classList.remove('is-shake');
      void form.offsetWidth;
      form.classList.add('is-shake');
      return;
    }
    err.hidden = true;
    form.reset();
    closeModal(modal);
    afterAuthChange();
    toast(`Bem-vindo, ${u.name}!`);
    if (u.role === 'barbeiro') openPanel();
  });

  $('#accountBtn').addEventListener('click', onAccountClick);
}

function logout() {
  Auth.logout();
  $$('.modal, .panel').filter((m) => !m.hidden).forEach(closeModal);
  $('#fName').value = '';
  $('#fPhone').value = '';
  afterAuthChange();
  toast('Você saiu da conta');
}

function afterAuthChange() {
  renderAccountBtn();
  renderNextBooking();
  fillClient();
}

/* ----------------------------------------------------------
   ÁREA DO CLIENTE
   ---------------------------------------------------------- */
function bookingItemsText(b) {
  if (b.kind === 'bloqueio') return 'Horário bloqueado';
  return b.items.map((id) => ALL_ITEMS[id]?.name || id).join(', ') || '—';
}

function openAccount() {
  const u = Auth.user();
  $('#accName').textContent = u.name;
  $('#accEmail').textContent = u.email;
  renderMyBookings();
  openModal($('#accountModal'));
}

function renderMyBookings() {
  const u = Auth.user();
  const today = nowLocal().iso;
  const list = DB.forUser(u.email).reverse();
  $('#myBookings').innerHTML = list.length ? list.map((b) => {
    const canCancel = b.status === 'agendado' && b.date >= today;
    return `
      <li class="mybk mybk--${b.status}">
        <div class="mybk__when"><b>${formatDateLong(b.date)}</b><span>${b.time}</span></div>
        <div class="mybk__what">${esc(bookingItemsText(b))}<small>${b.total ? brl(b.total) : 'sob consulta'} · ${b.pay === 'pix' ? 'Pix' : 'na barbearia'}</small></div>
        <span class="badge badge--${b.status}">${STATUS_LABEL[b.status]}</span>
        ${canCancel ? `<button class="btn btn--text btn--sm" data-cancel="${b.id}">Cancelar</button>` : ''}
      </li>`;
  }).join('') : '<li class="empty">Você ainda não tem agendamentos. Que tal marcar um?</li>';
}

function initAccount() {
  const modal = $('#accountModal');
  $$('[data-close]', modal).forEach((b) => b.addEventListener('click', () => closeModal(modal)));
  $('#logoutBtn').addEventListener('click', logout);
  $('#accGoBook').addEventListener('click', () => {
    closeModal(modal);
    if (bookingStep() === 'done') resetBooking();
    $('#agendar').scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth' });
  });
  $('#myBookings').addEventListener('click', (e) => {
    const c = e.target.closest('[data-cancel]');
    if (!c) return;
    const b = DB.get(c.dataset.cancel);
    if (!confirm(`Cancelar o horário de ${formatDateLong(b.date)} às ${b.time}?`)) return;
    DB.update(b.id, { status: 'cancelado' });
    renderMyBookings();
    renderNextBooking();
    toast('Agendamento cancelado');
    window.open(whatsUrl(`Olá! Preciso cancelar meu horário de *${formatDateLong(b.date)} às ${b.time}* na Corteza. Obrigado!`), '_blank');
  });
}
