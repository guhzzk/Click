/* ==========================================================
   Sanfona premium do FAQ
   - Altura animada a partir do scrollHeight real do conteúdo
   - Só uma pergunta aberta por vez
   - Teclado: setas ↑/↓, Home e End navegam entre as perguntas
   ========================================================== */

function initFaq(root = document.getElementById('faqList')) {
  if (!root) return;
  const items = [...root.querySelectorAll('.faq__item')];
  const DURATION = 450; // igual ao CSS (.faq__a)

  /** Abre um item medindo a altura do conteúdo */
  function open(item) {
    const btn = item.querySelector('.faq__q');
    const panel = item.querySelector('.faq__a');
    clearTimeout(panel._t);
    item.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');
    panel.style.maxHeight = panel.scrollHeight + 'px';
    // Depois da animação libera a altura (o texto pode quebrar diferente ao girar a tela)
    panel._t = setTimeout(() => { if (item.classList.contains('is-open')) panel.style.maxHeight = 'none'; }, DURATION);
  }

  /** Fecha partindo da altura atual em pixels (transição sem "pulo") */
  function close(item) {
    const btn = item.querySelector('.faq__q');
    const panel = item.querySelector('.faq__a');
    clearTimeout(panel._t);
    panel.style.maxHeight = panel.scrollHeight + 'px';
    void panel.offsetHeight; // força o navegador a registrar a altura inicial
    item.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
    panel.style.maxHeight = '0px';
  }

  items.forEach((item) => {
    const btn = item.querySelector('.faq__q');
    btn.addEventListener('click', () => {
      const willOpen = !item.classList.contains('is-open');
      items.forEach((other) => { if (other !== item && other.classList.contains('is-open')) close(other); });
      if (willOpen) open(item); else close(item);
    });
  });

  // Navegação por teclado entre as perguntas
  root.addEventListener('keydown', (e) => {
    const btns = items.map((i) => i.querySelector('.faq__q'));
    const idx = btns.indexOf(document.activeElement);
    if (idx < 0) return;
    const go = { ArrowDown: idx + 1, ArrowUp: idx - 1, Home: 0, End: btns.length - 1 }[e.key];
    if (go === undefined) return;
    e.preventDefault();
    btns[(go + btns.length) % btns.length].focus();
  });

  // Estado inicial: itens marcados como abertos no HTML
  items.filter((i) => i.classList.contains('is-open')).forEach((i) => {
    i.querySelector('.faq__a').style.maxHeight = 'none';
    i.querySelector('.faq__q').setAttribute('aria-expanded', 'true');
  });
}
