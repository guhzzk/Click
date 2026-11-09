/* ==========================================================
   Motor de animações do site
   - Reveal que se repete sempre que o elemento volta à tela
   - Troca de abas com saída/entrada em cascata e altura suave
   - Pílula deslizante nas abas
   - Item "voando" até a sacola ao adicionar
   ========================================================== */

const MOTION = {
  leaveMs: 520,   // saída dos cards ao trocar de aba
  heightMs: 700,  // ajuste de altura da grade
  flyMs: 1000,    // voo até a sacola
};

const canAnimate = () => !reduceMotion() && 'IntersectionObserver' in window;

/* ----------------------------------------------------------
   REVEAL REPETÍVEL
   Entra na tela -> anima. Sai totalmente -> reseta, para animar
   de novo na próxima vez (rolando para baixo ou para cima).
   ---------------------------------------------------------- */
const Reveal = (() => {
  // Dois observadores: um para ENTRAR (12% visível) e outro, com folga de
  // 160px em volta da tela, para SAIR. A folga evita o "pisca-pisca" quando
  // a própria animação (que desloca o elemento) o empurra para fora da borda.
  let enterIO = null;
  let leaveIO = null;
  const seen = new WeakSet();

  function ensure() {
    if (enterIO) return;
    enterIO = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const el = en.target;
        if (!en.isIntersecting || en.intersectionRatio < 0.12 || el.classList.contains('is-visible')) return;
        // Vindo de cima (rolando para cima) entra descendo; de baixo, subindo
        el.style.setProperty('--rv-dir', en.boundingClientRect.top < 0 ? '-1' : '1');
        el.classList.add('is-visible');
      });
    }, { threshold: [0, 0.12] });

    leaveIO = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (!en.isIntersecting) en.target.classList.remove('is-visible'); });
    }, { rootMargin: '160px', threshold: 0 });
  }

  /** Observa todos os .reveal dentro de root (pode ser chamado após cada render) */
  function observe(root = document) {
    const els = [...root.querySelectorAll('.reveal')];
    if (root.classList && root.classList.contains('reveal')) els.push(root);
    if (!canAnimate()) { els.forEach((el) => el.classList.add('is-visible')); return; }
    ensure();
    els.forEach((el) => {
      if (seen.has(el)) return;
      seen.add(el);
      enterIO.observe(el);
      leaveIO.observe(el);
    });
  }

  /** Para de observar os .reveal de root (antes de trocar o conteúdo) */
  function unobserve(root) {
    if (!enterIO) return;
    root.querySelectorAll('.reveal').forEach((el) => { enterIO.unobserve(el); leaveIO.unobserve(el); });
  }

  return { observe, unobserve };
})();

/* ----------------------------------------------------------
   TROCA DE CONTEÚDO COM TRANSIÇÃO (abas de serviços e planos)
   ---------------------------------------------------------- */
function swapContent(container, render) {
  const done = () => Reveal.observe(container);
  if (!canAnimate() || !container.children.length) { render(); done(); return; }

  clearTimeout(container._leaveT);
  clearTimeout(container._heightT);
  container.style.height = container.offsetHeight + 'px';
  container.classList.add('is-swapping', 'is-leaving');
  [...container.children].forEach((c, i) => c.style.setProperty('--o', Math.min(i, 6)));

  container._leaveT = setTimeout(() => {
    container.classList.remove('is-leaving');
    Reveal.unobserve(container);
    render();
    done();
    container.style.height = container.scrollHeight + 'px'; // anima até a nova altura
    container._heightT = setTimeout(() => {
      container.style.height = '';
      container.classList.remove('is-swapping');
    }, MOTION.heightMs);
  }, MOTION.leaveMs);
}

/* ----------------------------------------------------------
   PÍLULA DESLIZANTE DAS ABAS
   ---------------------------------------------------------- */
function initTabPill(bar, activeSel) {
  if (!bar) return () => {};
  const pill = document.createElement('span');
  pill.className = 'tab-pill';
  pill.setAttribute('aria-hidden', 'true');
  bar.prepend(pill);
  bar.classList.add('has-pill');

  const move = (instant) => {
    const active = bar.querySelector(activeSel);
    if (!active) return;
    if (instant) pill.style.transition = 'none';
    pill.style.width = active.offsetWidth + 'px';
    pill.style.transform = `translateX(${active.offsetLeft}px)`;
    if (instant) { void pill.offsetWidth; pill.style.transition = ''; }
  };

  move(true);
  window.addEventListener('resize', () => move(true));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => move(true));
  return () => move(false);
}

/* ----------------------------------------------------------
   VOO ATÉ A SACOLA
   Retorna uma Promise resolvida quando o item "chega".
   ---------------------------------------------------------- */
function flyToCart(sourceEl, item) {
  if (!canAnimate() || !sourceEl || !document.body.animate) return Promise.resolve();

  const card = sourceEl.closest('.service, .product, .plan') || sourceEl;
  const img = card.querySelector('.product__img img');
  const from = (img || sourceEl).getBoundingClientRect();

  const bar = $('#cartbar');
  const target = !bar.hidden ? $('#cartCount').getBoundingClientRect()
    : { left: window.innerWidth / 2 - 20, top: window.innerHeight - 60, width: 40, height: 40 };

  const size = 64;
  const fly = document.createElement('div');
  fly.className = 'fly-item';
  fly.setAttribute('aria-hidden', 'true');
  fly.innerHTML = img ? `<img src="${img.currentSrc || img.src}" alt="">` : `<span>+</span>`;
  document.body.appendChild(fly);

  const x0 = from.left + from.width / 2 - size / 2;
  const y0 = from.top + from.height / 2 - size / 2;
  const x1 = target.left + target.width / 2 - size / 2;
  const y1 = target.top + target.height / 2 - size / 2;
  const peak = Math.min(y0, y1) - Math.max(80, Math.abs(x1 - x0) * 0.25); // arco para cima

  const anim = fly.animate([
    { transform: `translate(${x0}px, ${y0}px) scale(.6)`, opacity: 0 },
    { transform: `translate(${x0}px, ${y0 - 24}px) scale(1.1)`, opacity: 1, offset: 0.15 },
    { transform: `translate(${(x0 + x1) / 2}px, ${peak}px) scale(.9) rotate(-12deg)`, opacity: 1, offset: 0.55 },
    { transform: `translate(${x1}px, ${y1}px) scale(.25) rotate(8deg)`, opacity: 0.2 },
  ], { duration: MOTION.flyMs, easing: 'cubic-bezier(.45, 0, .25, 1)', fill: 'forwards' });

  return anim.finished.catch(() => {}).then(() => fly.remove());
}
