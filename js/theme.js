/* ==========================================================
   Alternador de tema (claro/escuro)
   - Escolha salva no navegador; sem escolha, segue o sistema
   - O <head> aplica o tema antes da pintura (sem "flash")
   ========================================================== */

const Theme = (() => {
  const KEY = 'corteza_tema';
  const META_COLOR = { light: '#EEEAE3', dark: '#0F0E0D' };
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  const saved = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const system = () => (media.matches ? 'dark' : 'light');
  const current = () => document.documentElement.dataset.theme || system();

  /** Aplica o tema; animate=true faz as cores transicionarem juntas */
  function apply(theme, animate) {
    const root = document.documentElement;
    if (animate && !reduceMotion()) {
      root.classList.add('theme-anim');
      clearTimeout(apply._t);
      apply._t = setTimeout(() => root.classList.remove('theme-anim'), 550);
    }
    root.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = META_COLOR[theme];
    syncButton(theme);
  }

  function syncButton(theme) {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    const toDark = theme !== 'dark';
    btn.setAttribute('aria-pressed', String(theme === 'dark'));
    btn.setAttribute('aria-label', toDark ? 'Ativar tema escuro' : 'Ativar tema claro');
    btn.title = toDark ? 'Tema escuro' : 'Tema claro';
  }

  function toggle() {
    const next = current() === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(KEY, next); } catch (e) { /* modo privado: só nesta visita */ }
    apply(next, true);
  }

  function init() {
    apply(saved() || system(), false);
    document.getElementById('themeToggle').addEventListener('click', toggle);
    // Sem escolha salva, acompanha a troca de tema do sistema em tempo real
    media.addEventListener('change', () => { if (!saved()) apply(system(), true); });
  }

  return { init, toggle, current };
})();

function initTheme() { Theme.init(); }
