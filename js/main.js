/* ==========================================================
   Inicialização
   ========================================================== */
document.addEventListener('DOMContentLoaded', () => {
  $('#year').textContent = new Date().getFullYear();
  $$('[data-whats]').forEach((a) => {
    a.href = whatsUrl('Olá! Vim pelo site da Corteza Barbearia e gostaria de mais informações. 💈');
    a.target = '_blank';
    a.rel = 'noopener';
  });
  initTheme();
  initLocationLinks();
  initFaq();

  initMenu();
  initStatus();
  initServices();
  renderProducts();
  initPlans();
  initCart();
  initBooking();
  initPix();
  initLightbox();
  initLogin();
  initAccount();
  initPanel();
  initPremium();
  initAdmin();

  renderAccountBtn();
  renderNextBooking();
  initImageFades();
  initReveal();
  initNeon();
});
