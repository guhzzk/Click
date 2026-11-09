/* ==========================================================
   Localização: deep links de rota (Google Maps e Waze)
   Os dois links são "universal links": no celular abrem o app
   instalado; sem o app, abrem a versão web.
   ========================================================== */

/** Destino: coordenadas (mais preciso) ou o endereço de CONFIG */
function routeDestination() {
  const c = CONFIG.coords;
  return c && Number.isFinite(c.lat) && Number.isFinite(c.lng) ? { coords: `${c.lat},${c.lng}` } : { address: CONFIG.address };
}

/** Google Maps: rota a partir da localização atual, de carro */
function googleMapsUrl() {
  const d = routeDestination();
  const dest = encodeURIComponent(d.coords || d.address);
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
}

/** Waze: já inicia a navegação (navigate=yes) */
function wazeUrl() {
  const d = routeDestination();
  return d.coords
    ? `https://waze.com/ul?ll=${encodeURIComponent(d.coords)}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent(d.address)}&navigate=yes`;
}

function initLocationLinks() {
  const gm = document.getElementById('routeGmaps');
  const wz = document.getElementById('routeWaze');
  if (gm) gm.href = googleMapsUrl();
  if (wz) wz.href = wazeUrl();
}
