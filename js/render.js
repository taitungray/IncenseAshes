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

function preferredFragmentChars() {
  const counts = new Map([...FRAGMENT_SET].map(char => [char, 0]));
  state.bench.forEach(unit => {
    if (unit?.kind === "fragment") counts.set(unit.char, (counts.get(unit.char) || 0) + 1);
  });
  state.board.flat().forEach(unit => {
    if (unit?.kind === "fragment") counts.set(unit.char, (counts.get(unit.char) || 0) + 1);
  });

  const preferred = [];
  GOD_PAIRS.forEach(pair => {
    const [first, second] = pair.chars;
    const firstCount = counts.get(first) || 0;
    const secondCount = counts.get(second) || 0;
    if (firstCount > secondCount) preferred.push(second);
    if (secondCount > firstCount) preferred.push(first);
  });
  return preferred;
}

function randomFragmentUnit() {
  const preferred = preferredFragmentChars();
  const chars = preferred.length > 0 && Math.random() < 0.72 ? preferred : [...FRAGMENT_SET];
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
  renderUnitInspector();
}

function inspectedUnit() {
  if (!state.inspected) return null;
  if (state.inspected.source === "bench") {
    return state.bench[state.inspected.index] || null;
  }
  return state.board[state.inspected.y]?.[state.inspected.x] || null;
}

function renderUnitInspector() {
  const unit = inspectedUnit();
  if (!unit) {
    unitInspectorNameEl.textContent = "法壇";
    unitInspectorLevelEl.textContent = "待命";
    unitInspectorAttackEl.textContent = "-";
    unitInspectorEl.setAttribute("aria-label", "尚未選取法器");
    return;
  }

  let name;
  let level = unit.level;
  let damage = 0;

  if (unit.kind === "base") {
    const def = BASE_UNITS[unit.char];
    name = def.name;
    damage = attackPower(def, level);
  } else {
    const pair = state.inspected.source === "board"
      ? godPairAtCell(state.inspected.x, state.inspected.y)
      : null;
    if (pair) {
      name = pair.def.title;
      level = pair.level;
      damage = attackPower(pair.def, level);
    } else {
      name = `${unit.char}・未成組`;
    }
  }

  unitInspectorNameEl.textContent = name;
  unitInspectorLevelEl.textContent = `${level}級`;
  unitInspectorAttackEl.textContent = String(damage);
  unitInspectorEl.setAttribute("aria-label", `${name}，${level}級，攻擊力 ${damage}`);
}

function renderBoard() {
  const activePairs = activeGodPairs();
  const activePairCells = new Set();
  const pairByCell = new Map();
  activePairs.forEach(pair => pair.cells.forEach(key => {
    activePairCells.add(key);
    pairByCell.set(key, pair);
  }));
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
    unitEl.className = `unit ${unit.kind === "base" ? "artifact" : ""} ${fragmentClasses(unit)} ${activePairCells.has(key) ? "linked" : ""}`.trim();
    applyFragmentData(unitEl, unit);
    applyGlyphMotion(unitEl, x + y * COLS);
    const linkedPair = pairByCell.get(key);
    unitEl.innerHTML = glyphHtml(unit.char, unit.kind === "base") + (linkedPair ? "" : `<small>${unit.level}</small>`);
    unitEl.title = unitTitle(unit, activePairCells.has(key));
    unitEl.addEventListener("pointerdown", event => beginDrag(event, { source: "board", x, y }));
    cell.appendChild(unitEl);
  });
  renderPairRings(activePairs);
}

function renderPairRings(activePairs) {
  activePairs.forEach(pair => {
    const minX = Math.min(pair.leftX, pair.rightX);
    const maxX = Math.max(pair.leftX, pair.rightX);
    const minY = Math.min(pair.leftY, pair.rightY);
    const maxY = Math.max(pair.leftY, pair.rightY);
    const ring = document.createElement("div");
    ring.className = `pair-ring deity-pair-ring pair-${pair.def.slug} ${minY === maxY ? "horizontal-ring" : "vertical-ring"}`;
    ring.dataset.deity = pair.def.title;
    ring.style.setProperty("--pair-color", pair.def.color);
    ring.style.left = `${(minX / COLS) * 100}%`;
    ring.style.top = `${(minY / ROWS) * 100}%`;
    ring.style.width = `${((maxX - minX + 1) / COLS) * 100}%`;
    ring.style.height = `${((maxY - minY + 1) / ROWS) * 100}%`;
    ring.innerHTML = `<span class="pair-level">${pair.level}</span>`;
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

function glyphHtml(char, split = false) {
  if (split && char === "符") {
    return (
      `<span class="glyph artifact-glyph artifact-glyph-符" data-glyph="符" role="img" aria-label="符">`
      + `<span class="artifact-rest-whole artifact-charm-whole">符</span>`
      + `<span class="artifact-parts">`
      + `<span class="artifact-part artifact-part-0 artifact-charm-radical">⺮</span>`
      + `<span class="artifact-part artifact-part-1 artifact-charm-body">付</span>`
      + `</span>`
      + `</span>`
    );
  }

  if (split && char === "印") {
    return (
      `<span class="glyph artifact-glyph artifact-glyph-印" data-glyph="印" role="img" aria-label="印">`
      + `<span class="artifact-rest-whole artifact-ink-whole">印</span>`
      + `<span class="artifact-parts">`
      + `<span class="artifact-part artifact-part-0 artifact-ink-slice artifact-ink-left"><span class="artifact-ink-source">印</span></span>`
      + `<span class="artifact-part artifact-part-1 artifact-ink-slice artifact-ink-right"><span class="artifact-ink-source">印</span></span>`
      + `</span>`
      + `</span>`
    );
  }

  if (split && BASE_UNITS[char] && GLYPH_PARTS[char]) {
    const legacyParts = GLYPH_PARTS[char]
      .map((part, index) => `<span class="artifact-part artifact-part-${index}" data-part="${part}">${part}</span>`)
      .join("");
    return (
      `<span class="glyph artifact-glyph artifact-glyph-${char}" data-glyph="${char}" role="img" aria-label="${char}">`
      + `<span class="artifact-rest-whole">${char}</span>`
      + `<span class="artifact-parts">${legacyParts}</span>`
      + `</span>`
    );
  }
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
    
    const enemyData = ENEMY_TYPES[enemy.type];
    el.className = `enemy enemy-${enemy.type} ${enemyData.boss ? "boss" : ""} ${enemy.enraged ? "enraged" : ""} ${enemy.stun > 0 ? "stunned" : ""} ${enemy.slow > 0 ? "slowed" : ""}`;
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
  const remaining = state.spawnLeft + state.enemies.length;
  remainingEl.textContent = state.phase === "ready" || state.phase === "between" ? "-" : `${remaining}`;
  summonCostEl.textContent = `${summonCost()}`;
  summonBtn.disabled = state.grain < summonCost() || state.bench.length >= BENCH_LIMIT || !canManageUnits();
  discardBtn.disabled = !state.selected || !canManageUnits();

  paceBtn.hidden = state.phase === "choice" || state.phase === "ended";
  paceBtn.disabled = !["ready", "play", "paused", "between"].includes(state.phase);
  if (state.phase === "play") paceBtn.textContent = "暫停";
  else if (state.phase === "paused") paceBtn.textContent = "繼續";
  else paceBtn.textContent = `迎第 ${state.wave} 波`;

  speedBtn.textContent = `${state.gameSpeed}×`;
  speedBtn.classList.toggle("fast", state.gameSpeed === 2);
  speedBtn.disabled = state.phase === "choice" || state.phase === "ended";
  speedBtn.setAttribute("aria-pressed", String(state.gameSpeed === 2));
  speedBtn.setAttribute("aria-label", `戰鬥速度 ${state.gameSpeed} 倍`);
}

function log(message) {
  battleLogEl.textContent = message;
}

