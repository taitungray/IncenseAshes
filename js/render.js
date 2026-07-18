function isPath(x, y) {
  return PATH.some(point => point.x === x && point.y === y);
}

function isGate(x, y) {
  const end = PATH[PATH.length - 1];
  return end.x === x && end.y === y;
}

function makeUnit(char, level = 1, kind = "base") {
  return {
    char,
    level,
    kind,
    cooldown: Math.floor(Math.random() * 12)
  };
}

function randomBaseUnit(level = 1) {
  const chars = Object.keys(BASE_UNITS);
  return makeUnit(chars[Math.floor(Math.random() * chars.length)], level, "base");
}

function randomFragmentUnit() {
  const chars = [...FRAGMENT_SET];
  return makeUnit(chars[Math.floor(Math.random() * chars.length)], 1, "fragment");
}

function summonCost() {
  return Math.max(8, 18 - state.passives.discount);
}

function discardRefund(unit) {
  if (!unit) return 0;
  const base = unit.kind === "fragment" ? 8 : 5;
  return Math.max(1, Math.round(base * Math.pow(1.65, unit.level - 1)));
}

function initBoard() {
  state.board = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => null));
  boardEl.innerHTML = "";

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = `cell ${isPath(x, y) ? "path" : "buildable"} ${isGate(x, y) ? "gate" : ""}`;
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);
      cell.setAttribute("aria-label", `廟埕第 ${y + 1} 行第 ${x + 1} 格`);
      cell.addEventListener("click", () => onBoardClick(x, y));
      boardEl.appendChild(cell);
    }
  }
}

function renderAll() {
  renderBoard();
  renderBench();
  renderEnemies();
  updateHud();
}

function renderBoard() {
  const activePairs = activeGodPairs();
  const activePairCells = new Set();
  activePairs.forEach(pair => pair.cells.forEach(key => activePairCells.add(key)));
  boardEl.querySelectorAll(".pair-ring").forEach(el => el.remove());
  const cells = boardEl.querySelectorAll(".cell");
  cells.forEach(cell => {
    const x = Number(cell.dataset.x);
    const y = Number(cell.dataset.y);
    const unit = state.board[y][x];
    const key = cellKey(x, y);
    const info = fragmentInfo(unit);
    cell.classList.toggle("selected", isSelectedBoard(x, y));
    cell.classList.toggle("mergeable", Boolean(state.selected && unit && canMergeAt(selectedUnit(), unit, x, y)));
    cell.classList.toggle("fragment-cell", Boolean(info));
    cell.querySelectorAll(".unit").forEach(el => el.remove());

    if (!unit) return;
    const unitEl = document.createElement("div");
    unitEl.className = `unit ${fragmentClasses(unit)} ${activePairCells.has(key) ? "linked" : ""}`.trim();
    applyFragmentData(unitEl, unit);
    applyGlyphMotion(unitEl, x + y * COLS);
    unitEl.innerHTML = glyphHtml(unit.char) + `<small>${unit.level}</small>`;
    unitEl.title = unitTitle(unit, activePairCells.has(key));
    unitEl.addEventListener("pointerdown", event => beginDrag(event, { source: "board", x, y }));
    cell.appendChild(unitEl);
  });
  renderPairRings(activePairs);
}

function renderPairRings(activePairs) {
  activePairs.forEach(pair => {
    if (pair.def.slug !== "guangong") return;
    const minX = Math.min(pair.leftX, pair.rightX);
    const maxX = Math.max(pair.leftX, pair.rightX);
    const minY = Math.min(pair.leftY, pair.rightY);
    const maxY = Math.max(pair.leftY, pair.rightY);
    const ring = document.createElement("div");
    ring.className = `pair-ring guangong-ring ${minY === maxY ? "horizontal-ring" : "vertical-ring"}`;
    ring.style.left = `${(minX / COLS) * 100}%`;
    ring.style.top = `${(minY / ROWS) * 100}%`;
    ring.style.width = `${((maxX - minX + 1) / COLS) * 100}%`;
    ring.style.height = `${((maxY - minY + 1) / ROWS) * 100}%`;
    boardEl.appendChild(ring);
  });
}

function renderBench() {
  benchEl.innerHTML = "";
  state.bench.forEach((unit, index) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `bench-card ${fragmentClasses(unit)} ${isSelectedBench(index) ? "selected" : ""}`.trim();
    applyFragmentData(card, unit);
    applyGlyphMotion(card, index + 17);
    card.innerHTML = glyphHtml(unit.char) + `<small>${unit.level}</small>`;
    card.title = unitTitle(unit, false);
    card.addEventListener("pointerdown", event => beginDrag(event, { source: "bench", index }));
    card.addEventListener("click", () => onBenchClick(index));
    benchEl.appendChild(card);
  });
}

function unitTitle(unit, linked) {
  if (unit.kind === "fragment") {
    const pair = GOD_PAIRS.find(item => item.chars.includes(unit.char));
    return linked ? `${pair.title}已啟動` : `${pair.title}神名字：${unit.char}，需靠近${otherFragment(pair, unit.char)}`;
  }
  return BASE_UNITS[unit.char]?.name || `${unit.char}法器`;
}

function fragmentInfo(unit) {
  if (!unit || unit.kind !== "fragment") return null;
  const pair = GOD_PAIRS.find(item => item.chars.includes(unit.char));
  if (!pair) return null;
  return {
    pair,
    role: pair.chars[0] === unit.char ? "first" : "second"
  };
}

function fragmentClasses(unit) {
  const info = fragmentInfo(unit);
  if (!info) return "";
  return `fragment god-${info.pair.slug} fragment-${info.role}`;
}

function applyFragmentData(el, unit) {
  const info = fragmentInfo(unit);
  if (!info) return;
  el.dataset.deity = info.pair.title;
  el.dataset.fragment = unit.char;
  el.dataset.role = info.role;
}

function glyphHtml(char) {
  return `<span class="glyph whole-glyph" data-glyph="${char}">${char}</span>`;
}

function applyGlyphMotion(el, seed) {
  const tilt = ((seed * 7) % 11) - 5;
  const bob = 1 + ((seed * 5) % 4);
  const delay = -((seed * 137) % 1100);
  el.style.setProperty("--tilt", `${tilt}deg`);
  el.style.setProperty("--bob", `${bob}px`);
  el.style.setProperty("--glyph-delay", `${delay}ms`);
  el.style.setProperty("--part-a", `${tilt - 4}deg`);
  el.style.setProperty("--part-b", `${tilt + 5}deg`);
}

function renderEnemies() {
  const currentIds = new Set();
  
  state.enemies.forEach(enemy => {
    currentIds.add(enemy.id);
    const pos = getEnemyPosition(enemy);
    
    let el = document.getElementById(`enemy-${enemy.id}`);
    
    if (!el) {
      el = document.createElement("div");
      el.id = `enemy-${enemy.id}`;
      el.title = ENEMY_TYPES[enemy.type].name;
      
      const stepSeed = enemy.id.charCodeAt(enemy.id.length - 1) + enemy.pathIndex;
      el.style.setProperty("--enemy-step", `${stepSeed % 2 === 0 ? -1 : 1}`);
      el.style.setProperty("--enemy-delay", `${-(stepSeed % 7) * 70}ms`);
  
      const shadow = document.createElement("div");
      shadow.className = "enemy-shadow";
      el.appendChild(shadow);
  
      const glyphContainer = document.createElement("div");
      glyphContainer.className = "enemy-glyph-container";
      
      let bodyChar = enemy.type;
      let weaponChar = "";
      if (enemy.type === "怪") { bodyChar = "圣"; weaponChar = "忄"; }
      else if (enemy.type === "妖") { bodyChar = "夭"; weaponChar = "女"; }
      else if (enemy.type === "魔") { bodyChar = "魔"; weaponChar = ""; }
      
      const glyph = document.createElement("span");
      glyph.className = "enemy-glyph";
      glyph.innerHTML = glyphHtml(bodyChar);
      glyphContainer.appendChild(glyph);
  
      if (weaponChar) {
        const weapon = document.createElement("span");
        weapon.className = "enemy-weapon";
        weapon.textContent = weaponChar;
        glyphContainer.appendChild(weapon);
      }
  
      el.appendChild(glyphContainer);
  
      const hpLine = document.createElement("div");
      hpLine.className = "hp-line";
      const hpFill = document.createElement("i");
      hpFill.className = "hp-fill";
      hpLine.appendChild(hpFill);
      el.appendChild(hpLine);
      
      enemyLayer.appendChild(el);
    }
    
    el.className = `enemy enemy-${enemy.type} ${enemy.stun > 0 ? "stunned" : ""} ${enemy.slow > 0 ? "slowed" : ""}`;
    el.style.left = `${((pos.x + 0.5) / COLS) * 100}%`;
    el.style.top = `${((pos.y + 0.5) / ROWS) * 100}%`;
    
    const hpFill = el.querySelector(".hp-fill");
    if (hpFill) hpFill.style.width = `${Math.max(0, (enemy.hp / enemy.maxHp) * 100)}%`;
  });

  Array.from(enemyLayer.children).forEach(child => {
    if (!currentIds.has(child.id.replace("enemy-", ""))) {
      child.remove();
    }
  });
}

function updateHud() {
  baseHpEl.textContent = `${state.baseHp}/${state.baseMaxHp}`;
  waveEl.textContent = `${state.wave}`;
  grainEl.textContent = `${state.grain}`;
  killsEl.textContent = `${state.kills}`;
  summonCostEl.textContent = `${summonCost()}`;
  summonBtn.disabled = state.grain < summonCost() || state.bench.length >= BENCH_LIMIT || state.phase !== "play";
  discardBtn.disabled = !state.selected || state.phase !== "play";
}

function log(message) {
  battleLogEl.textContent = message;
}

