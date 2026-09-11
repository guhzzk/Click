// ==========================================================
// SIGMA CLICKER 9000
// Jogo de clique simples. Tudo salvo no localStorage do
// navegador — sem backend, sem banco de dados.
// ==========================================================

const SAVE_KEY = "sigmaClicker9000_save";

// ---------- estado do jogo ----------

const defaultState = {
  score: 0,
  clickPower: 1,      // quanto cada clique vale (base)
  autoPerSecond: 0,   // quanto ganha por segundo (upgrades automáticos)
  critChance: 0.05,   // chance de crítico (5% inicial)
  owned: {},          // quantas vezes cada upgrade foi comprada
};

let state = loadState();

// ---------- upgrades disponíveis ----------
// custo sobe geometricamente a cada compra (custoBase * 1.15^quantidade)

const upgrades = [
  {
    id: "dedo",
    name: "Dedo turbinado",
    desc: "+1 ponto por clique",
    baseCost: 15,
    apply: () => { state.clickPower += 1; },
  },
  {
    id: "estagiario",
    name: "Estagiário clicando",
    desc: "+1 ponto por segundo, automático",
    baseCost: 40,
    apply: () => { state.autoPerSecond += 1; },
  },
  {
    id: "sorte",
    name: "Trevo de sorte",
    desc: "+3% de chance de crítico",
    baseCost: 80,
    apply: () => { state.critChance = Math.min(0.6, state.critChance + 0.03); },
  },
  {
    id: "robo",
    name: "Robô clicador",
    desc: "+8 pontos por segundo, automático",
    baseCost: 250,
    apply: () => { state.autoPerSecond += 8; },
  },
  {
    id: "luva",
    name: "Luva de sigma",
    desc: "+10 pontos por clique",
    baseCost: 600,
    apply: () => { state.clickPower += 10; },
  },
  {
    id: "fabrica",
    name: "Fábrica de rizz",
    desc: "+40 pontos por segundo, automático",
    baseCost: 1800,
    apply: () => { state.autoPerSecond += 40; },
  },
];

function costOf(upgrade) {
  const n = state.owned[upgrade.id] || 0;
  return Math.round(upgrade.baseCost * Math.pow(1.15, n));
}

// ---------- elementos da tela ----------

const scoreEl = document.getElementById("score");
const rateLabelEl = document.getElementById("rateLabel");
const blobEl = document.getElementById("blob");
const blobEmojiEl = document.getElementById("blobEmoji");
const floatersEl = document.getElementById("floaters");
const critBannerEl = document.getElementById("critBanner");
const shopListEl = document.getElementById("shopList");
const resetBtn = document.getElementById("resetBtn");
const toastEl = document.getElementById("toast");

const blobEmojis = ["🗿", "🐸", "🦍", "🐉", "👑", "🔥"];

// ---------- raridades do clique (RNG / dopamina) ----------
// cada clique sorteia uma raridade; raridades melhores dão
// multiplicadores maiores mas são bem mais raras.

const rarities = [
  { key: "common", label: "", chance: 0.80, mult: 1 },
  { key: "rare", label: "RARO", chance: 0.14, mult: 2.5 },
  { key: "epic", label: "ÉPICO", chance: 0.05, mult: 6 },
  { key: "legendary", label: "LENDÁRIO", chance: 0.01, mult: 20 },
];

function rollRarity() {
  const roll = Math.random();
  let acc = 0;
  for (const r of rarities) {
    acc += r.chance;
    if (roll <= acc) return r;
  }
  return rarities[0];
}

// ---------- clique principal ----------

blobEl.addEventListener("click", (e) => {
  const rarity = rollRarity();
  const isCrit = Math.random() < state.critChance;
  const critMult = isCrit ? 3 : 1;

  const gained = Math.max(1, Math.round(state.clickPower * rarity.mult * critMult));
  state.score += gained;

  updateScoreDisplay(true);
  spawnFloater(e.clientX, e.clientY, gained, rarity.key, isCrit);

  if (isCrit) triggerCrit();
  if (rarity.key !== "common") shakeBlob();
  if (Math.random() < 0.15) randomizeBlobEmoji();

  renderShop();
  saveState();
});

function spawnFloater(x, y, amount, rarityKey, isCrit) {
  const el = document.createElement("div");
  el.className = "floater " + (rarityKey !== "common" ? rarityKey : "");
  const rarityInfo = rarities.find((r) => r.key === rarityKey);
  const prefix = rarityInfo.label ? rarityInfo.label + " " : "";
  const suffix = isCrit ? " CRIT!" : "";
  el.textContent = `${prefix}+${amount}${suffix}`;

  const jitterX = (Math.random() - 0.5) * 60;
  el.style.left = x - 20 + jitterX + "px";
  el.style.top = y - 20 + "px";

  floatersEl.appendChild(el);
  setTimeout(() => el.remove(), 950);
}

function triggerCrit() {
  critBannerEl.textContent = "CRÍTICO!";
  critBannerEl.classList.remove("show");
  void critBannerEl.offsetWidth; // reinicia a animação
  critBannerEl.classList.add("show");
}

function shakeBlob() {
  blobEl.classList.remove("shake");
  void blobEl.offsetWidth;
  blobEl.classList.add("shake");
}

function randomizeBlobEmoji() {
  blobEmojiEl.textContent = blobEmojis[Math.floor(Math.random() * blobEmojis.length)];
}

// ---------- placar ----------

function updateScoreDisplay(bump) {
  scoreEl.textContent = Math.floor(state.score).toLocaleString("pt-BR");
  rateLabelEl.textContent = `+${state.autoPerSecond}/s automático · crítico ${(state.critChance * 100).toFixed(0)}%`;
  if (bump) {
    scoreEl.classList.remove("bump");
    void scoreEl.offsetWidth;
    scoreEl.classList.add("bump");
  }
}

// ---------- loja ----------

function renderShop() {
  shopListEl.innerHTML = "";
  upgrades.forEach((u) => {
    const cost = costOf(u);
    const owned = state.owned[u.id] || 0;
    const btn = document.createElement("button");
    btn.className = "shop-item";
    btn.disabled = state.score < cost;
    btn.innerHTML = `
      <div class="name">${u.name} <span class="owned">${owned > 0 ? "x" + owned : ""}</span></div>
      <div class="desc">${u.desc}</div>
      <div class="price">${cost.toLocaleString("pt-BR")} pts</div>
    `;
    btn.addEventListener("click", () => buyUpgrade(u));
    shopListEl.appendChild(btn);
  });
}

function buyUpgrade(u) {
  const cost = costOf(u);
  if (state.score < cost) return;

  state.score -= cost;
  state.owned[u.id] = (state.owned[u.id] || 0) + 1;
  u.apply();

  updateScoreDisplay(false);
  renderShop();
  showToast(`comprou: ${u.name}`);
  saveState();
}

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.remove("show"), 1600);
}

// ---------- loop automático (ganho passivo por segundo) ----------

setInterval(() => {
  if (state.autoPerSecond > 0) {
    state.score += state.autoPerSecond;
    updateScoreDisplay(false);
    renderShop();
    saveState();
  }
}, 1000);

// ---------- salvar / carregar (localStorage) ----------

function saveState() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error("Não foi possível salvar o progresso:", err);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return { ...structuredClone(defaultState), ...parsed, owned: parsed.owned || {} };
  } catch (err) {
    console.error("Save corrompido, começando do zero:", err);
    return structuredClone(defaultState);
  }
}

resetBtn.addEventListener("click", () => {
  if (!confirm("Isso vai apagar todo o seu progresso salvo. Tem certeza?")) return;
  localStorage.removeItem(SAVE_KEY);
  state = structuredClone(defaultState);
  updateScoreDisplay(false);
  renderShop();
  showToast("progresso reiniciado");
});

// ---------- inicialização ----------

updateScoreDisplay(false);
renderShop();
