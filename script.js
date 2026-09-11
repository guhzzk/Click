// ==========================================================
// SIGMA CLICKER 9000 — v2
// Jogo de clique com prestígio (Relíquias), 3 trilhas de
// upgrade, combo, conquistas e ganho offline.
// Tudo salvo no localStorage do navegador — sem backend.
// ==========================================================

const SAVE_KEY = "sigmaClicker9000_save_v2";
const ASCEND_THRESHOLD = 50000;   // total ganho na run pra poder ascender
const OFFLINE_CAP_SECONDS = 4 * 60 * 60; // no máximo 4h de ganho offline
const OFFLINE_EFFICIENCY = 0.5;  // offline rende 50% do automático normal

// ---------- estado base (o que reseta a cada ascensão) ----------

function freshRunState() {
  return {
    score: 0,
    totalEarned: 0,       // ganho nesta run (usado pro threshold de ascender)
    clickPower: 1,
    autoPerSecond: 0,
    critChance: 0.05,
    critMultiplier: 3,
    owned: {},            // upgrades normais compradas nesta run
  };
}

// ---------- estado permanente (sobrevive à ascensão) ----------

function freshMetaState() {
  return {
    relics: 0,
    relicOwned: {},       // upgrades de relíquia (permanentes)
    lifetimeEarned: 0,    // nunca reseta, usado pra conquistas
    hasCrit: false,
    hasLegendary: false,
    ascendCount: 0,
    achievementsUnlocked: [],
    lastSave: Date.now(),
  };
}

let run = freshRunState();
let meta = freshMetaState();
let activeTab = "click";
let comboCount = 0;
let lastClickTime = 0;

// ---------- upgrades normais (resetam na ascensão) ----------

const upgrades = [
  // trilha: clique
  { id: "dedo", category: "click", name: "Dedo turbinado", desc: "+1 ponto por clique", baseCost: 15, growth: 1.13, apply: () => { run.clickPower += 1; } },
  { id: "luva", category: "click", name: "Luva de sigma", desc: "+10 pontos por clique", baseCost: 250, growth: 1.13, apply: () => { run.clickPower += 10; } },
  { id: "punho", category: "click", name: "Punho de titânio", desc: "+50 pontos por clique", baseCost: 3000, growth: 1.13, apply: () => { run.clickPower += 50; } },
  { id: "braco", category: "click", name: "Braço mecânico", desc: "+300 pontos por clique", baseCost: 30000, growth: 1.14, apply: () => { run.clickPower += 300; } },
  { id: "mao_destino", category: "click", name: "Mão do destino", desc: "+2.000 pontos por clique", baseCost: 350000, growth: 1.14, apply: () => { run.clickPower += 2000; } },

  // trilha: automático
  { id: "estagiario", category: "auto", name: "Estagiário clicando", desc: "+1 ponto/s automático", baseCost: 40, growth: 1.13, apply: () => { run.autoPerSecond += 1; } },
  { id: "robo", category: "auto", name: "Robô clicador", desc: "+10 pontos/s automático", baseCost: 400, growth: 1.13, apply: () => { run.autoPerSecond += 10; } },
  { id: "fabrica", category: "auto", name: "Fábrica de rizz", desc: "+60 pontos/s automático", baseCost: 4500, growth: 1.13, apply: () => { run.autoPerSecond += 60; } },
  { id: "satelite", category: "auto", name: "Satélite de cliques", desc: "+350 pontos/s automático", baseCost: 45000, growth: 1.14, apply: () => { run.autoPerSecond += 350; } },
  { id: "portal", category: "auto", name: "Portal dimensional", desc: "+2.200 pontos/s automático", baseCost: 500000, growth: 1.14, apply: () => { run.autoPerSecond += 2200; } },

  // trilha: sorte
  { id: "trevo", category: "luck", name: "Trevo de sorte", desc: "+3% de chance de crítico", baseCost: 80, growth: 1.18, apply: () => { run.critChance = Math.min(0.95, run.critChance + 0.03); } },
  { id: "ferradura", category: "luck", name: "Ferradura dourada", desc: "+5% de chance de crítico", baseCost: 1200, growth: 1.2, apply: () => { run.critChance = Math.min(0.95, run.critChance + 0.05); } },
  { id: "amuleto", category: "luck", name: "Amuleto do crítico", desc: "+1x no multiplicador de crítico", baseCost: 6000, growth: 1.2, apply: () => { run.critMultiplier += 1; } },
  { id: "coroa", category: "luck", name: "Coroa da sorte", desc: "+8% de chance de crítico", baseCost: 60000, growth: 1.22, apply: () => { run.critChance = Math.min(0.95, run.critChance + 0.08); } },
];

function costOf(u) {
  const n = run.owned[u.id] || 0;
  return Math.round(u.baseCost * Math.pow(u.growth, n));
}

// ---------- upgrades de relíquia (permanentes, compradas com relíquias) ----------

const relicUpgrades = [
  { id: "inicio_turbo", name: "Início turbo", desc: "Começa cada ascensão com +20 no poder de clique", baseCost: 1, growth: 1.6, effect: { clickPowerStart: 20 } },
  { id: "motor_ancestral", name: "Motor ancestral", desc: "Começa cada ascensão com +8 automático/s", baseCost: 2, growth: 1.6, effect: { autoStart: 8 } },
  { id: "sorte_eterna", name: "Sorte eterna", desc: "+4% de crítico permanente em toda ascensão", baseCost: 3, growth: 1.7, effect: { critChanceStart: 0.04 } },
  { id: "mao_midas", name: "Mão de Midas", desc: "+20% em todo ganho por clique, pra sempre", baseCost: 5, growth: 1.8, effect: { clickMult: 0.2 } },
  { id: "fabrica_cosmica", name: "Fábrica cósmica", desc: "+20% em todo ganho automático, pra sempre", baseCost: 5, growth: 1.8, effect: { autoMult: 0.2 } },
  { id: "nucleo_infinito", name: "Núcleo infinito", desc: "+15% em TODO ganho (clique e automático), pra sempre", baseCost: 12, growth: 2, effect: { allMult: 0.15 } },
];

function relicCostOf(ru) {
  const n = meta.relicOwned[ru.id] || 0;
  return Math.ceil(ru.baseCost * Math.pow(ru.growth, n));
}

function relicOwnedCount(id) {
  return meta.relicOwned[id] || 0;
}

// multiplicador permanente total vindo das relíquias compradas + relíquias em si
function permanentClickMult() {
  let mult = 1 + meta.relics * 0.1; // cada relíquia = +10%
  mult += relicOwnedCount("mao_midas") * 0.2;
  mult += relicOwnedCount("nucleo_infinito") * 0.15;
  return mult;
}

function permanentAutoMult() {
  let mult = 1 + meta.relics * 0.1;
  mult += relicOwnedCount("fabrica_cosmica") * 0.2;
  mult += relicOwnedCount("nucleo_infinito") * 0.15;
  return mult;
}

// ---------- conquistas ----------

const achievements = [
  { id: "a1", name: "Primeiro clique", desc: "Clique pela primeira vez", check: () => meta.lifetimeEarned >= 1 },
  { id: "a2", name: "Mão quente", desc: "Ganhe 1.000 pontos no total", check: () => meta.lifetimeEarned >= 1000 },
  { id: "a3", name: "Milionário do rizz", desc: "Ganhe 1.000.000 de pontos no total", check: () => meta.lifetimeEarned >= 1000000 },
  { id: "a4", name: "Crítico!", desc: "Tire um clique crítico", check: () => meta.hasCrit },
  { id: "a5", name: "Lendário", desc: "Tire um drop lendário", check: () => meta.hasLegendary },
  { id: "a6", name: "Comprador", desc: "Compre qualquer upgrade", check: () => Object.keys(run.owned).length > 0 },
  { id: "a7", name: "Ascensão", desc: "Ascenda pela primeira vez", check: () => meta.ascendCount >= 1 },
  { id: "a8", name: "Colecionador", desc: "Tenha 10 relíquias", check: () => meta.relics >= 10 },
];

function checkAchievements() {
  achievements.forEach((a) => {
    if (!meta.achievementsUnlocked.includes(a.id) && a.check()) {
      meta.achievementsUnlocked.push(a.id);
      showToast(`🏆 conquista: ${a.name}`);
    }
  });
}

// ---------- elementos da tela ----------

const scoreEl = document.getElementById("score");
const rateLabelEl = document.getElementById("rateLabel");
const comboLabelEl = document.getElementById("comboLabel");
const blobEl = document.getElementById("blob");
const blobEmojiEl = document.getElementById("blobEmoji");
const floatersEl = document.getElementById("floaters");
const critBannerEl = document.getElementById("critBanner");
const shopListEl = document.getElementById("shopList");
const resetBtn = document.getElementById("resetBtn");
const toastEl = document.getElementById("toast");
const relicBadgeEl = document.getElementById("relicBadge");
const ascendBtnEl = document.getElementById("ascendBtn");
const tabsEl = document.getElementById("tabs");

const blobEmojis = ["🗿", "🐸", "🦍", "🐉", "👑", "🔥"];

// ---------- raridades do clique (RNG / dopamina) ----------

const rarities = [
  { key: "common", label: "", chance: 0.78, mult: 1 },
  { key: "rare", label: "RARO", chance: 0.15, mult: 2.5 },
  { key: "epic", label: "ÉPICO", chance: 0.06, mult: 6 },
  { key: "legendary", label: "LENDÁRIO", chance: 0.01, mult: 25 },
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
  const now = Date.now();
  if (now - lastClickTime < 700) {
    comboCount = Math.min(comboCount + 1, 60);
  } else {
    comboCount = 1;
  }
  lastClickTime = now;
  const comboMult = 1 + Math.min(comboCount, 60) * 0.015; // até +90% no combo máximo

  const rarity = rollRarity();
  const isCrit = Math.random() < run.critChance;
  const critMult = isCrit ? run.critMultiplier : 1;

  const base = run.clickPower * rarity.mult * critMult * comboMult * permanentClickMult();
  const gained = Math.max(1, Math.round(base));

  addPoints(gained);

  if (isCrit) meta.hasCrit = true;
  if (rarity.key === "legendary") meta.hasLegendary = true;

  spawnFloater(e.clientX, e.clientY, gained, rarity.key, isCrit);
  updateComboLabel();

  if (isCrit) triggerCrit();
  if (rarity.key !== "common") shakeBlob();
  if (Math.random() < 0.15) randomizeBlobEmoji();

  checkAchievements();
  renderShop();
  updateTopBar();
  saveState();
});

function addPoints(amount) {
  run.score += amount;
  run.totalEarned += amount;
  meta.lifetimeEarned += amount;
}

function spawnFloater(x, y, amount, rarityKey, isCrit) {
  const el = document.createElement("div");
  el.className = "floater " + (rarityKey !== "common" ? rarityKey : "");
  const rarityInfo = rarities.find((r) => r.key === rarityKey);
  const prefix = rarityInfo.label ? rarityInfo.label + " " : "";
  const suffix = isCrit ? " CRIT!" : "";
  el.textContent = `${prefix}+${amount.toLocaleString("pt-BR")}${suffix}`;

  const jitterX = (Math.random() - 0.5) * 60;
  el.style.left = x - 20 + jitterX + "px";
  el.style.top = y - 20 + "px";

  floatersEl.appendChild(el);
  setTimeout(() => el.remove(), 950);
}

function triggerCrit() {
  critBannerEl.textContent = "CRÍTICO!";
  critBannerEl.classList.remove("show");
  void critBannerEl.offsetWidth;
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

let comboFadeTimer = null;
function updateComboLabel() {
  if (comboCount > 1) {
    comboLabelEl.textContent = `combo x${comboCount} 🔥`;
    comboLabelEl.classList.add("show");
    clearTimeout(comboFadeTimer);
    comboFadeTimer = setTimeout(() => comboLabelEl.classList.remove("show"), 1200);
  }
}

// ---------- placar e topo ---------

function updateScoreDisplay(bump) {
  scoreEl.textContent = Math.floor(run.score).toLocaleString("pt-BR");
  const autoTotal = Math.round(run.autoPerSecond * permanentAutoMult());
  rateLabelEl.textContent = `+${autoTotal.toLocaleString("pt-BR")}/s automático · crítico ${(run.critChance * 100).toFixed(0)}%`;
  if (bump) {
    scoreEl.classList.remove("bump");
    void scoreEl.offsetWidth;
    scoreEl.classList.add("bump");
  }
}

function updateTopBar() {
  relicBadgeEl.textContent = `💎 ${meta.relics.toLocaleString("pt-BR")} relíquias`;

  if (run.totalEarned >= ASCEND_THRESHOLD) {
    const gain = relicsFromAscend();
    ascendBtnEl.hidden = false;
    ascendBtnEl.textContent = `✨ ascender — ganhar ${gain} relíquia${gain === 1 ? "" : "s"}`;
  } else {
    ascendBtnEl.hidden = true;
  }
}

function relicsFromAscend() {
  return Math.max(1, Math.floor(Math.sqrt(run.totalEarned / 10000)));
}

ascendBtnEl.addEventListener("click", () => {
  const gain = relicsFromAscend();
  if (!confirm(`Ascender reseta seus pontos e upgrades desta run, mas dá ${gain} relíquia(s) permanente(s), que aumentam TODO ganho futuro. Ascender agora?`)) return;

  meta.relics += gain;
  meta.ascendCount += 1;

  run = freshRunState();
  run.clickPower += relicOwnedCount("inicio_turbo") * 20;
  run.autoPerSecond += relicOwnedCount("motor_ancestral") * 8;
  run.critChance = Math.min(0.95, run.critChance + relicOwnedCount("sorte_eterna") * 0.04);

  showToast(`✨ ascendeu! +${gain} relíquias`);
  checkAchievements();
  updateScoreDisplay(false);
  updateTopBar();
  renderShop();
  saveState();
});

// ---------- loja com abas ----------

tabsEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".tab");
  if (!btn) return;
  activeTab = btn.dataset.tab;
  [...tabsEl.children].forEach((t) => t.classList.toggle("active", t === btn));
  renderShop();
});

function renderShop() {
  shopListEl.innerHTML = "";

  if (activeTab === "relic") {
    renderRelicShop();
    return;
  }
  if (activeTab === "ach") {
    renderAchievements();
    return;
  }

  const list = upgrades.filter((u) => u.category === activeTab);
  list.forEach((u) => {
    const cost = costOf(u);
    const owned = run.owned[u.id] || 0;
    const btn = document.createElement("button");
    btn.className = "shop-item";
    btn.disabled = run.score < cost;
    btn.innerHTML = `
      <div class="name">${u.name} <span class="owned">${owned > 0 ? "x" + owned : ""}</span></div>
      <div class="desc">${u.desc}</div>
      <div class="price">${cost.toLocaleString("pt-BR")} pts</div>
    `;
    btn.addEventListener("click", () => buyUpgrade(u));
    shopListEl.appendChild(btn);
  });
}

function renderRelicShop() {
  relicUpgrades.forEach((ru) => {
    const cost = relicCostOf(ru);
    const owned = relicOwnedCount(ru.id);
    const btn = document.createElement("button");
    btn.className = "shop-item relic";
    btn.disabled = meta.relics < cost;
    btn.innerHTML = `
      <div class="name">${ru.name} <span class="owned">${owned > 0 ? "x" + owned : ""}</span></div>
      <div class="desc">${ru.desc}</div>
      <div class="price">${cost.toLocaleString("pt-BR")} 💎</div>
    `;
    btn.addEventListener("click", () => buyRelicUpgrade(ru));
    shopListEl.appendChild(btn);
  });
  const note = document.createElement("div");
  note.className = "empty-msg";
  note.textContent = "Upgrades de relíquia nunca são perdidos, nem quando você ascende.";
  shopListEl.appendChild(note);
}

function renderAchievements() {
  achievements.forEach((a) => {
    const unlocked = meta.achievementsUnlocked.includes(a.id);
    const div = document.createElement("div");
    div.className = "ach-item" + (unlocked ? " unlocked" : "");
    div.innerHTML = `
      <div class="name">${unlocked ? "🏆" : "🔒"} ${a.name}</div>
      <div class="desc">${a.desc}</div>
    `;
    shopListEl.appendChild(div);
  });
}

function buyUpgrade(u) {
  const cost = costOf(u);
  if (run.score < cost) return;

  run.score -= cost;
  run.owned[u.id] = (run.owned[u.id] || 0) + 1;
  u.apply();

  updateScoreDisplay(false);
  updateTopBar();
  renderShop();
  showToast(`comprou: ${u.name}`);
  checkAchievements();
  saveState();
}

function buyRelicUpgrade(ru) {
  const cost = relicCostOf(ru);
  if (meta.relics < cost) return;

  meta.relics -= cost;
  meta.relicOwned[ru.id] = (meta.relicOwned[ru.id] || 0) + 1;

  updateScoreDisplay(false);
  updateTopBar();
  renderShop();
  showToast(`relíquia usada: ${ru.name}`);
  checkAchievements();
  saveState();
}

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.remove("show"), 1800);
}

// ---------- loop automático (ganho passivo por segundo) ----------

setInterval(() => {
  const autoTotal = run.autoPerSecond * permanentAutoMult();
  if (autoTotal > 0) {
    addPoints(autoTotal);
    updateScoreDisplay(false);
    updateTopBar();
    renderShop();
    checkAchievements();
    saveState();
  }
}, 1000);

// ---------- salvar / carregar (localStorage) ----------

function saveState() {
  meta.lastSave = Date.now();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ run, meta }));
  } catch (err) {
    console.error("Não foi possível salvar o progresso:", err);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    run = { ...freshRunState(), ...parsed.run, owned: parsed.run?.owned || {} };
    meta = { ...freshMetaState(), ...parsed.meta, relicOwned: parsed.meta?.relicOwned || {}, achievementsUnlocked: parsed.meta?.achievementsUnlocked || [] };
  } catch (err) {
    console.error("Save corrompido, começando do zero:", err);
  }
}

function applyOfflineEarnings() {
  const elapsedMs = Date.now() - (meta.lastSave || Date.now());
  const elapsedSeconds = Math.min(elapsedMs / 1000, OFFLINE_CAP_SECONDS);
  const autoTotal = run.autoPerSecond * permanentAutoMult();
  if (elapsedSeconds > 15 && autoTotal > 0) {
    const gained = Math.round(autoTotal * elapsedSeconds * OFFLINE_EFFICIENCY);
    if (gained > 0) {
      addPoints(gained);
      showToast(`💤 enquanto você tava fora, ganhou ${gained.toLocaleString("pt-BR")} pontos`);
    }
  }
}

resetBtn.addEventListener("click", () => {
  if (!confirm("Isso apaga TUDO, incluindo relíquias e conquistas. Tem certeza?")) return;
  localStorage.removeItem(SAVE_KEY);
  run = freshRunState();
  meta = freshMetaState();
  comboCount = 0;
  updateScoreDisplay(false);
  updateTopBar();
  renderShop();
  showToast("tudo reiniciado");
});

// ---------- inicialização ----------

loadState();
applyOfflineEarnings();
updateScoreDisplay(false);
updateTopBar();
renderShop();
saveState();
