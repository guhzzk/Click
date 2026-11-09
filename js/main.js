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
  $('#routeBtn').href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(CONFIG.address)}&travelmode=driving`;

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

  renderAccountBtn();
  renderNextBooking();
  initImageFades();
  initReveal();
});
