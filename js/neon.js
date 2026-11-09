/* ==========================================================
   Letreiro neon: "mau contato" em intervalos aleatórios
   O CSS cuida da pulsação contínua; aqui só sorteamos quando
   e qual tubo falha, e por quanto tempo.
   ========================================================== */

function initNeon() {
  const tubes = [...document.querySelectorAll('.neon')];
  const hero = document.querySelector('.hero');
  if (!tubes.length || reduceMotion()) return;

  const rand = (min, max) => min + Math.random() * (max - min);
  let visible = true;
  let timer = null;

  function flicker() {
    if (visible && !document.hidden) {
      // O tubo vermelho falha com mais frequência (é o que chama atenção)
      const tube = Math.random() < 0.7 ? tubes[tubes.length - 1] : tubes[Math.floor(Math.random() * tubes.length)];
      tube.style.setProperty('--flicker-ms', `${Math.round(rand(380, 950))}ms`);
      tube.classList.remove('is-flickering');
      void tube.offsetWidth; // reinicia a animação se cair no mesmo tubo
      tube.classList.add('is-flickering');
      tube.addEventListener('animationend', () => tube.classList.remove('is-flickering'), { once: true });
    }
    schedule();
  }

  function schedule() {
    clearTimeout(timer);
    // Às vezes duas falhas seguidas, como um reator ruim de verdade
    const next = Math.random() < 0.2 ? rand(250, 600) : rand(2800, 9000);
    timer = setTimeout(flicker, next);
  }

  // Pausa tudo quando o hero sai da tela
  if ('IntersectionObserver' in window && hero) {
    new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      hero.classList.toggle('is-offscreen', !visible);
    }, { threshold: 0 }).observe(hero);
  }

  schedule();
}
