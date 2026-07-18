const COLS = 6;
const ROWS = 8;
const TICK_MS = 1000 / 30;
const MAX_WAVE = 12;
const BENCH_LIMIT = 7;

const PATH = [
  { x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 },
  { x: 2, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 },
  { x: 4, y: 4 }, { x: 3, y: 4 }, { x: 2, y: 4 }, { x: 1, y: 4 },
  { x: 1, y: 5 }, { x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 6 },
  { x: 4, y: 6 }, { x: 5, y: 6 }, { x: 5, y: 7 }
];

const BASE_UNITS = {
  "符": { name: "鎮煞符", range: 2.75, damage: 9, cooldown: 28, color: "#c53424", special: "charm", effect: "charm" },
  "鏡": { name: "照妖法鏡", range: 3.2, damage: 8, cooldown: 25, color: "#d7a02f", special: "mirror", effect: "mirror" },
  "鈴": { name: "淨壇法鈴", range: 1.7, damage: 12, cooldown: 34, color: "#14618a", special: "bell", effect: "bell" },
  "劍": { name: "斬煞法劍", range: 1.45, damage: 25, cooldown: 34, color: "#087668", special: "single", effect: "sword" },
  "印": { name: "敕令法印", range: 2.05, damage: 14, cooldown: 31, color: "#8b4b22", special: "seal", effect: "seal" }
};

const GLYPH_PARTS = {
  "符": ["竹", "付"],
  "鏡": ["金", "竟"],
  "鈴": ["金", "令"],
  "劍": ["僉", "刂"],
  "印": ["爪", "卩"],
  "媽": ["女", "馬"],
  "祖": ["示", "且"],
  "關": ["門", "絲"],
  "公": ["八", "厶"],
  "城": ["土", "成"],
  "隍": ["阝", "皇"],
  "觀": ["雚", "見"],
  "音": ["立", "日"],
  "王": ["一", "土"],
  "爺": ["父", "耶"],
  "怪": ["忄", "圣"],
  "鬼": ["丿", "鬼"],
  "妖": ["女", "夭"],
  "魔": ["麻", "鬼"]
};

const GOD_PAIRS = [
  { chars: ["媽", "祖"], title: "媽祖", slug: "mazu", range: 4.2, damage: 20, cooldown: 20, color: "#14618a", special: "pierce" },
  { chars: ["關", "公"], title: "關公", slug: "guangong", range: 1.9, damage: 34, cooldown: 30, color: "#c53424", special: "cleave" },
  { chars: ["城", "隍"], title: "城隍爺", slug: "chenghuang", range: 1.85, damage: 13, cooldown: 42, color: "#5b2f83", special: "stun" },
  { chars: ["觀", "音"], title: "觀音", slug: "guanyin", range: 4.0, damage: 17, cooldown: 24, color: "#087668", special: "pierce" },
  { chars: ["王", "爺"], title: "王爺", slug: "wangye", range: 2.4, damage: 22, cooldown: 22, color: "#8b4b22", special: "dash" }
];

const FRAGMENT_SET = new Set(GOD_PAIRS.flatMap(pair => pair.chars));

const ENEMY_TYPES = {
  "怪": { name: "小怪", hp: 48, speed: 1, reward: 4 },
  "鬼": { name: "野鬼", hp: 88, speed: 0.72, reward: 5 },
  "妖": { name: "山妖", hp: 58, speed: 1.34, reward: 6 },
  "魔": { name: "魔王", hp: 210, speed: 0.56, reward: 18 }
};

const CHOICES = [
  { id: "bell", name: "鈴聲淨壇", copy: "所有鎮守出手更快。", apply: state => { state.passives.speed *= 0.88; } },
  { id: "clear_incense", name: "清香繞境", copy: "護陣距離小幅提高。", apply: state => { state.passives.range *= 1.12; } },
  { id: "seal", name: "王爺敕令", copy: "所有鎮守威力提高。", apply: state => { state.passives.damage *= 1.16; } },
  { id: "incense", name: "添油香", copy: "請令花費降低。", apply: state => { state.passives.discount += 3; } },
  { id: "guard", name: "鎮殿安爐", copy: "香爐恢復並提高耐久。", apply: state => { state.baseMaxHp += 2; state.baseHp = Math.min(state.baseMaxHp, state.baseHp + 4); } },
  { id: "fate", name: "法器加持", copy: "立刻獲得一件隨機二階法器。", apply: state => { addBenchUnit(randomBaseUnit(2)); } }
];

const boardEl = document.getElementById("board");
const enemyLayer = document.getElementById("enemy-layer");
const fxLayer = document.getElementById("fx-layer");
const benchEl = document.getElementById("bench");
const baseHpEl = document.getElementById("base-hp");
const waveEl = document.getElementById("wave");
const grainEl = document.getElementById("grain");
const killsEl = document.getElementById("kills");
const summonBtn = document.getElementById("summon-btn");
const summonCostEl = document.getElementById("summon-cost");
const discardBtn = document.getElementById("discard-zone");
const battleLogEl = document.getElementById("battle-log");
const restartBtn = document.getElementById("restart-btn");
const choiceModal = document.getElementById("choice-modal");
const choiceList = document.getElementById("choice-list");
const resultModal = document.getElementById("result-modal");
const resultKicker = document.getElementById("result-kicker");
const resultTitle = document.getElementById("result-title");
const resultCopy = document.getElementById("result-copy");
const resultBtn = document.getElementById("result-btn");

const state = {
  board: [],
  bench: [],
  enemies: [],
  selected: null,
  suppressClickUntil: 0,
  grain: 80,
  wave: 1,
  kills: 0,
  baseHp: 10,
  baseMaxHp: 10,
  spawnLeft: 0,
  spawnTimer: 0,
  spawnDelay: 36,
  phase: "play",
  interval: null,
  passives: {
    damage: 1,
    range: 1,
    speed: 1,
    discount: 0
  }
};

let dragState = null;

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

function onBenchClick(index) {
  if (Date.now() < state.suppressClickUntil) return;
  if (state.phase !== "play") return;
  if (isSelectedBench(index)) {
    state.selected = null;
  } else {
    state.selected = { source: "bench", index };
  }
  renderAll();
}

function onBoardClick(x, y) {
  if (Date.now() < state.suppressClickUntil) return;
  if (state.phase !== "play") return;
  if (isPath(x, y)) return;

  if (!state.selected) {
    if (state.board[y][x]) {
      state.selected = { source: "board", x, y };
      renderAll();
    }
    return;
  }

  moveSelectedToBoard(x, y);
  renderAll();
}

function beginDrag(event, selection) {
  if (state.phase !== "play") return;
  if (event.button !== undefined && event.button !== 0) return;

  const unit = selection.source === "bench"
    ? state.bench[selection.index]
    : state.board[selection.y]?.[selection.x];
  if (!unit) return;

  event.preventDefault();
  event.stopPropagation();

  state.selected = selection;
  dragState = {
    pointerId: event.pointerId,
    selection,
    unit,
    ghost: createDragGhost(unit),
    targetCell: null,
    targetDiscard: false,
    startX: event.clientX,
    startY: event.clientY,
    didMove: false
  };

  document.body.classList.add("dragging-card");
  document.body.appendChild(dragState.ghost);
  updateDragGhost(event.clientX, event.clientY);
  renderAll();

  window.addEventListener("pointermove", onDragMove, { passive: false });
  window.addEventListener("pointerup", endDrag, { passive: false });
  window.addEventListener("pointercancel", cancelDrag, { passive: false });
}

function createDragGhost(unit) {
  const ghost = document.createElement("div");
  ghost.className = `drag-ghost ${fragmentClasses(unit)}`.trim();
  applyFragmentData(ghost, unit);
  applyGlyphMotion(ghost, 31);
  ghost.innerHTML = glyphHtml(unit.char) + `<small>${unit.level}</small>`;
  return ghost;
}

function onDragMove(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  event.preventDefault();
  const dx = event.clientX - dragState.startX;
  const dy = event.clientY - dragState.startY;
  if (Math.hypot(dx, dy) > 4) dragState.didMove = true;
  updateDragGhost(event.clientX, event.clientY);
  updateDropTarget(event.clientX, event.clientY);
}

function updateDragGhost(clientX, clientY) {
  if (!dragState?.ghost) return;
  dragState.ghost.style.left = `${clientX}px`;
  dragState.ghost.style.top = `${clientY}px`;
}

function updateDropTarget(clientX, clientY) {
  const discard = discardFromPoint(clientX, clientY);
  if (dragState.targetDiscard === discard && discard) return;
  if (discard) {
    clearDropTarget();
    dragState.targetDiscard = true;
    discardBtn.classList.add("discard-hover");
    return;
  }
  if (dragState.targetDiscard) clearDropTarget();

  const cell = cellFromPoint(clientX, clientY);
  if (dragState.targetCell === cell) return;
  clearDropTarget();
  dragState.targetCell = cell;
  if (!cell) return;

  const x = Number(cell.dataset.x);
  const y = Number(cell.dataset.y);
  cell.classList.add("drop-target");
  if (isPath(x, y)) {
    cell.classList.add("drop-blocked");
    return;
  }

  const moving = selectedUnit();
  const target = state.board[y][x];
  if (target && moving && canMergeAt(moving, target, x, y)) {
    cell.classList.add("drop-merge");
  }
}

function clearDropTarget() {
  if (dragState?.targetCell) {
    dragState.targetCell.classList.remove("drop-target", "drop-merge", "drop-blocked");
    dragState.targetCell = null;
  }
  if (dragState?.targetDiscard) {
    discardBtn.classList.remove("discard-hover");
    dragState.targetDiscard = false;
  }
}

function cellFromPoint(clientX, clientY) {
  return elementFromPointWithoutGhost(clientX, clientY)?.closest?.(".cell") || null;
}

function discardFromPoint(clientX, clientY) {
  return Boolean(elementFromPointWithoutGhost(clientX, clientY)?.closest?.("#discard-zone"));
}

function elementFromPointWithoutGhost(clientX, clientY) {
  const ghost = dragState?.ghost;
  const previousDisplay = ghost?.style.display;
  if (ghost) ghost.style.display = "none";
  const element = document.elementFromPoint(clientX, clientY);
  if (ghost) ghost.style.display = previousDisplay || "";
  return element;
}

function endDrag(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  event.preventDefault();
  if (discardFromPoint(event.clientX, event.clientY) && dragState.didMove) {
    discardSelectedUnit();
    state.suppressClickUntil = Date.now() + 300;
    renderAll();
    cleanupDrag();
    return;
  }

  const cell = cellFromPoint(event.clientX, event.clientY);
  if (cell && !isPath(Number(cell.dataset.x), Number(cell.dataset.y))) {
    moveSelectedToBoard(Number(cell.dataset.x), Number(cell.dataset.y));
    state.suppressClickUntil = Date.now() + 300;
    renderAll();
  } else if (dragState.didMove) {
    state.selected = null;
    state.suppressClickUntil = Date.now() + 300;
    renderAll();
  }
  cleanupDrag();
}

function cancelDrag(event) {
  if (dragState && event.pointerId !== dragState.pointerId) return;
  state.selected = null;
  cleanupDrag();
  renderAll();
}

function cleanupDrag() {
  clearDropTarget();
  dragState?.ghost?.remove();
  dragState = null;
  document.body.classList.remove("dragging-card");
  window.removeEventListener("pointermove", onDragMove);
  window.removeEventListener("pointerup", endDrag);
  window.removeEventListener("pointercancel", cancelDrag);
}

function isSelectedBench(index) {
  return state.selected?.source === "bench" && state.selected.index === index;
}

function isSelectedBoard(x, y) {
  return state.selected?.source === "board" && state.selected.x === x && state.selected.y === y;
}

function selectedUnit() {
  if (!state.selected) return null;
  if (state.selected.source === "bench") return state.bench[state.selected.index];
  return state.board[state.selected.y][state.selected.x];
}

function removeSelectedUnit() {
  if (!state.selected) return;
  if (state.selected.source === "bench") {
    state.bench.splice(state.selected.index, 1);
  } else {
    state.board[state.selected.y][state.selected.x] = null;
  }
}

function discardSelectedUnit() {
  const unit = selectedUnit();
  if (!unit || state.phase !== "play") return;
  const refund = discardRefund(unit);
  const pos = selectedUnitBoardPosition();
  removeSelectedUnit();
  state.grain += refund;
  state.selected = null;
  if (pos) {
    floatText(pos.x, pos.y, `+${refund}`, "#d7a02f");
  }
  log(`${unit.char}已化去，回收 ${refund} 香火。`);
}

function selectedUnitBoardPosition() {
  if (!state.selected || state.selected.source !== "board") return null;
  return { x: state.selected.x, y: state.selected.y };
}

function moveSelectedToBoard(x, y) {
  const moving = selectedUnit();
  if (!moving) {
    state.selected = null;
    return;
  }
  const activeBefore = activeGodPairIds();

  if (isSelectedBoard(x, y)) {
    state.selected = null;
    return;
  }

  const target = state.board[y][x];
  if (!target) {
    removeSelectedUnit();
    state.board[y][x] = moving;
    state.selected = null;
    announceNewGodPairs(activeBefore);
    return;
  }

  if (canMergeAt(moving, target, x, y)) {
    const mergedKind = target.kind;
    removeSelectedUnit();
    state.board[y][x] = mergeUnits(target, moving);
    state.selected = null;
    mergeVfx(x, y, state.board[y][x]);
    triggerScreenShake("medium");
    announceNewGodPairs(activeBefore);
    log(mergedKind === "fragment" ? "神名字升階，香火更旺。" : "法器相合，香火更旺。");
    return;
  }

  if (state.selected.source === "board") {
    const fromX = state.selected.x;
    const fromY = state.selected.y;
    state.board[fromY][fromX] = target;
    state.board[y][x] = moving;
    state.selected = null;
    announceNewGodPairs(activeBefore);
  }
}

function canMergeAt(a, b, targetX, targetY) {
  if (!a || !b) return false;
  if (a.char !== b.char || a.level !== b.level || a.kind !== b.kind) return false;
  if (a.kind === "base") return a.level < 5;
  return activePairCellKeys().has(cellKey(targetX, targetY));
}

function mergeUnits(a, b) {
  return makeUnit(a.char, a.level + 1, a.kind);
}

function addBenchUnit(unit) {
  if (state.bench.length < BENCH_LIMIT) {
    state.bench.push(unit);
  }
}

function summon() {
  if (state.phase !== "play") return;
  const cost = summonCost();
  if (state.grain < cost || state.bench.length >= BENCH_LIMIT) return;
  state.grain -= cost;
  if (Math.random() < 0.35) {
    addBenchUnit(randomFragmentUnit());
    log("神名字入列，靠近另一字才會啟動。");
    renderAll();
    return;
  }

  const level = Math.random() < 0.12 ? 2 : 1;
  addBenchUnit(randomBaseUnit(level));
  log("新法器已入列。");
  renderAll();
}

function startWave() {
  state.phase = "play";
  state.spawnLeft = 6 + state.wave * 2;
  state.spawnDelay = Math.max(18, 42 - state.wave * 2);
  state.spawnTimer = 18;
  log(`第 ${state.wave} 波妖魔逼近。`);
  updateHud();
}

function spawnEnemy() {
  let type = "怪";
  const roll = Math.random();
  if (state.wave % 5 === 0 && state.spawnLeft === 1) type = "魔";
  else if (roll > 0.80) type = "魔";
  else if (roll > 0.60) type = "妖";
  else if (roll > 0.35) type = "鬼";

  const data = ENEMY_TYPES[type];
  const hp = Math.round(data.hp * (1 + state.wave * 0.22));
  state.enemies.push({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Math.random()),
    type,
    hp,
    maxHp: hp,
    pathIndex: 0,
    progress: 0,
    speed: data.speed,
    reward: data.reward,
    stun: 0,
    slow: 0
  });
}

function gameTick() {
  if (state.phase !== "play") return;

  handleSpawning();
  moveEnemies();
  attackWithUnits();
  clearDefeated();
  renderEnemies();
  updateHud();
  checkWaveClear();
}

function handleSpawning() {
  if (state.spawnLeft <= 0) return;
  state.spawnTimer -= 1;
  if (state.spawnTimer <= 0) {
    spawnEnemy();
    state.spawnLeft -= 1;
    state.spawnTimer = state.spawnDelay;
  }
}

function moveEnemies() {
  for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = state.enemies[i];
    if (enemy.stun > 0) {
      enemy.stun -= 1;
      continue;
    }

    const slowFactor = enemy.slow > 0 ? 0.58 : 1;
    if (enemy.slow > 0) enemy.slow -= 1;
    enemy.progress += (0.032 + state.wave * 0.0018) * enemy.speed * slowFactor;
    while (enemy.progress >= 1) {
      enemy.progress -= 1;
      enemy.pathIndex += 1;
      if (enemy.pathIndex >= PATH.length - 1) {
        state.baseHp -= enemy.type === "魔" ? 3 : 1;
        state.enemies.splice(i, 1);
        burstAt(PATH[PATH.length - 1].x, PATH[PATH.length - 1].y, "#c53424", 1.2);
        triggerScreenShake(enemy.type === "魔" ? "heavy" : "light");
        if (state.baseHp <= 0) endGame(false);
        break;
      }
    }
  }
}

function attackWithUnits() {
  attackWithBaseUnits();
  attackWithGodPairs();
}

function attackWithBaseUnits() {
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const unit = state.board[y][x];
      if (!unit || unit.kind !== "base") continue;
      if (unit.cooldown > 0) {
        unit.cooldown -= 1;
        continue;
      }

      const def = BASE_UNITS[unit.char];
      const range = def.range * state.passives.range;
      const targets = enemiesInRange(x, y, range);
      if (targets.length === 0) continue;

      const damage = Math.round(def.damage * (1 + (unit.level - 1) * 0.62) * state.passives.damage);
      pulseUnitAt(x, y, targets[0].pos);
      resolveAttack(def, x, y, targets, damage, unit.level, [unit.char]);
      unit.cooldown = Math.max(8, Math.floor(def.cooldown * state.passives.speed));
    }
  }
}

function attackWithGodPairs() {
  activeGodPairs().forEach(pair => {
    if (pair.left.cooldown > 0) {
      pair.left.cooldown -= 1;
      return;
    }

    const range = pair.def.range * state.passives.range;
    const targets = enemiesInRange(pair.cx, pair.cy, range);
    if (targets.length === 0) return;

    const damage = Math.round(pair.def.damage * (1 + (pair.level - 1) * 0.62) * state.passives.damage);
    pulseUnitAt(pair.leftX, pair.leftY, targets[0].pos);
    pulseUnitAt(pair.rightX, pair.rightY, targets[0].pos);
    resolveAttack(pair.def, pair.cx, pair.cy, targets, damage, pair.level, [pair.left.char, pair.right.char]);
    godAttackVfx(pair, targets[0].pos);
    triggerScreenShake("heavy");
    pair.left.cooldown = Math.max(8, Math.floor(pair.def.cooldown * state.passives.speed));
  });
}

function resolveAttack(def, x, y, targets, damage, level, glyphs = ["令"]) {
  const primary = targets[0];
  const effect = def.effect || def.special || "single";

  if (def.special === "cleave") {
    targets.forEach(target => {
      target.enemy.hp -= damage;
      slashVfx(target.pos.x, target.pos.y, def.color);
      hitVfx(target.pos.x, target.pos.y, def.color, "ink-hit", damage);
    });
    glyphScatter(x, y, glyphs, def.color);
    return;
  }

  if (def.special === "stun") {
    targets.forEach(target => {
      target.enemy.hp -= damage;
      target.enemy.stun = Math.max(target.enemy.stun, 28 + level * 8);
      wardVfx(target.pos.x, target.pos.y, def.color, "鎮");
      hitVfx(target.pos.x, target.pos.y, def.color, "ink-hit", damage);
    });
    glyphScatter(x, y, glyphs, def.color);
    return;
  }

  if (def.special === "dash") {
    targets.slice(0, 3).forEach(target => {
      target.enemy.hp -= Math.round(damage * 0.9);
      glyphs.forEach((glyph, index) => {
        shotFromTo(x, y, target.pos.x, target.pos.y, def.color, glyph, index, "dash");
      });
      wardVfx(target.pos.x, target.pos.y, def.color, "巡");
      hitVfx(target.pos.x, target.pos.y, def.color, "ink-hit", Math.round(damage * 0.9));
    });
    return;
  }

  if (def.special === "pierce") {
    targets.slice(0, 2 + level).forEach(target => {
      target.enemy.hp -= damage;
      beamFromTo(x, y, target.pos.x, target.pos.y, def.color, "pierce-beam");
      glyphs.forEach((glyph, index) => {
        shotFromTo(x, y, target.pos.x, target.pos.y, def.color, glyph, index, "pierce");
      });
      hitVfx(target.pos.x, target.pos.y, def.color, "ink-hit", damage);
    });
    return;
  }

  if (def.special === "mirror") {
    targets.slice(0, 1 + level).forEach((target, targetIndex) => {
      const mirrorDamage = Math.round(damage * (targetIndex === 0 ? 1 : 0.72));
      target.enemy.hp -= mirrorDamage;
      beamFromTo(x, y, target.pos.x, target.pos.y, def.color, "mirror-beam");
      glyphs.forEach((glyph, index) => {
        shotFromTo(x, y, target.pos.x, target.pos.y, def.color, glyph, index, "mirror");
      });
      hitVfx(target.pos.x, target.pos.y, def.color, "ink-hit", mirrorDamage);
    });
    return;
  }

  if (def.special === "charm") {
    targets.slice(0, 3 + level).forEach((target, targetIndex) => {
      const charmDamage = Math.round(damage * (targetIndex === 0 ? 1 : 0.82));
      target.enemy.hp -= charmDamage;
      glyphs.forEach((glyph, index) => {
        shotFromTo(x, y, target.pos.x, target.pos.y, def.color, glyph, index + targetIndex, "charm");
      });
      hitVfx(target.pos.x, target.pos.y, def.color, "ink-hit", charmDamage);
    });
    glyphScatter(x, y, glyphs, def.color);
    return;
  }

  if (def.special === "bell") {
    targets.slice(0, 2).forEach(target => {
      target.enemy.hp -= damage;
      target.enemy.slow = Math.max(target.enemy.slow || 0, 34 + level * 7);
      shotFromTo(x, y, target.pos.x, target.pos.y, def.color, glyphs[0], 0, "bell");
      wardVfx(target.pos.x, target.pos.y, def.color, "鈴");
      hitVfx(target.pos.x, target.pos.y, def.color, "ink-hit", damage);
    });
    return;
  }

  if (def.special === "seal") {
    primary.enemy.hp -= damage;
    primary.enemy.stun = Math.max(primary.enemy.stun, 16 + level * 6);
    glyphs.forEach((glyph, index) => {
      shotFromTo(x, y, primary.pos.x, primary.pos.y, def.color, glyph, index, "seal");
    });
    wardVfx(primary.pos.x, primary.pos.y, def.color, "印");
    hitVfx(primary.pos.x, primary.pos.y, def.color, "ink-hit", damage);
    return;
  }

  primary.enemy.hp -= damage;
  glyphs.forEach((glyph, index) => {
    shotFromTo(x, y, primary.pos.x, primary.pos.y, def.color, glyph, index, effect);
  });
  if (effect === "sword") slashVfx(primary.pos.x, primary.pos.y, def.color);
  hitVfx(primary.pos.x, primary.pos.y, def.color, "ink-hit", damage);
}

function activeGodPairs() {
  const pairs = [];
  const seen = new Set();
  const dirs = [[1, 0], [0, 1]];

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const left = state.board[y][x];
      if (!left || left.kind !== "fragment") continue;

      dirs.forEach(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= COLS || ny >= ROWS) return;
        const right = state.board[ny][nx];
        if (!right || right.kind !== "fragment") return;
        const def = findGodPair(left.char, right.char);
        if (!def) return;

        const key = [cellKey(x, y), cellKey(nx, ny)].sort().join("|");
        if (seen.has(key)) return;
        seen.add(key);

        pairs.push({
          def,
          left,
          right,
          leftX: x,
          leftY: y,
          rightX: nx,
          rightY: ny,
          cx: (x + nx) / 2,
          cy: (y + ny) / 2,
          level: (left.level + right.level) / 2,
          cells: [cellKey(x, y), cellKey(nx, ny)]
        });
      });
    }
  }

  return pairs;
}

function activePairCellKeys() {
  const keys = new Set();
  activeGodPairs().forEach(pair => {
    pair.cells.forEach(key => keys.add(key));
  });
  return keys;
}

function activeGodPairIds() {
  return new Set(activeGodPairs().map(pair => pairId(pair)));
}

function pairId(pair) {
  return `${pair.def.title}:${pair.cells.slice().sort().join("|")}`;
}

function announceNewGodPairs(previousIds) {
  activeGodPairs().forEach(pair => {
    if (previousIds.has(pairId(pair))) return;
    const label = `${pair.def.title}降臨`;
    godCallVfx(pair.cx, pair.cy, pair.def.color, label);
    log(`${pair.def.title}已啟動。`);
  });
}

function findGodPair(a, b) {
  return GOD_PAIRS.find(pair => pair.chars.includes(a) && pair.chars.includes(b) && a !== b);
}

function otherFragment(pair, char) {
  return pair.chars.find(item => item !== char);
}

function cellKey(x, y) {
  return `${x},${y}`;
}

function enemiesInRange(x, y, range) {
  return state.enemies
    .map(enemy => ({ enemy, pos: getEnemyPosition(enemy) }))
    .map(item => ({ ...item, dist: distance(x, y, item.pos.x, item.pos.y) }))
    .filter(item => item.dist <= range)
    .sort((a, b) => progressScore(b.enemy) - progressScore(a.enemy));
}

function clearDefeated() {
  for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = state.enemies[i];
    if (enemy.hp > 0) continue;
    const pos = getEnemyPosition(enemy);
    state.grain += enemy.reward;
    state.kills += 1;
    floatText(pos.x, pos.y, `+${enemy.reward}`);
    state.enemies.splice(i, 1);
  }
}

function checkWaveClear() {
  if (state.phase !== "play") return;
  if (state.spawnLeft > 0 || state.enemies.length > 0) return;

  state.phase = "between";
  state.grain += 18 + state.wave * 3;
  log(`第 ${state.wave} 波已淨。`);

  if (state.wave >= MAX_WAVE) {
    setTimeout(() => endGame(true), 500);
    return;
  }

  if (state.wave % 3 === 0) {
    setTimeout(openChoices, 550);
  } else {
    setTimeout(() => {
      state.wave += 1;
      startWave();
    }, 850);
  }
}

function openChoices() {
  state.phase = "choice";
  choiceList.innerHTML = "";
  sampleChoices(3).forEach(choice => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-card";
    button.innerHTML = `<strong>${choice.name}</strong><span>${choice.copy}</span>`;
    button.addEventListener("click", () => {
      choice.apply(state);
      choiceModal.classList.add("hidden");
      state.wave += 1;
      log(`${choice.name}落籤。`);
      renderAll();
      startWave();
    });
    choiceList.appendChild(button);
  });
  choiceModal.classList.remove("hidden");
}

function sampleChoices(count) {
  const pool = [...CHOICES];
  const result = [];
  while (result.length < count && pool.length > 0) {
    const index = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(index, 1)[0]);
  }
  return result;
}

function getEnemyPosition(enemy) {
  const current = PATH[enemy.pathIndex];
  const next = PATH[Math.min(enemy.pathIndex + 1, PATH.length - 1)];
  return {
    x: current.x + (next.x - current.x) * enemy.progress,
    y: current.y + (next.y - current.y) * enemy.progress
  };
}

function progressScore(enemy) {
  return enemy.pathIndex + enemy.progress;
}

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function boardPercent(x, y) {
  return {
    left: `${((x + 0.5) / COLS) * 100}%`,
    top: `${((y + 0.5) / ROWS) * 100}%`
  };
}

function pulseUnitAt(x, y, target = null) {
  const index = y * COLS + x;
  const unitEl = boardEl.children[index]?.querySelector(".unit");
  if (!unitEl) return;
  const unit = state.board[y]?.[x];
  const dx = target ? Math.max(-1, Math.min(1, target.x - x)) * 12 : 0;
  const dy = target ? Math.max(-1, Math.min(1, target.y - y)) * 12 : -8;
  unitEl.style.setProperty("--attack-dx", `${dx}px`);
  unitEl.style.setProperty("--attack-dy", `${dy}px`);
  unitEl.classList.remove("attacking");
  void unitEl.offsetWidth;
  unitEl.classList.add("attacking");
  if (unit) unitRadicalVfx(x, y, unit, dx, dy);
  setTimeout(() => unitEl.classList.remove("attacking"), 360);
}

function unitRadicalVfx(x, y, unit, dx, dy) {
  const parts = glyphParts(unit.char);
  if (parts.length <= 1) return;
  const pos = boardPercent(x, y);
  const color = unitColor(unit);

  parts.forEach((part, index) => {
    const piece = document.createElement("div");
    piece.className = `unit-radical-fx unit-radical-${index}`;
    piece.textContent = part;
    piece.style.color = color;
    piece.style.left = pos.left;
    piece.style.top = pos.top;
    piece.style.setProperty("--radical-dx", `${dx * (0.28 + index * 0.08) + (index === 0 ? -10 : 10)}px`);
    piece.style.setProperty("--radical-dy", `${dy * (0.22 + index * 0.06) + (index === 0 ? -10 : 8)}px`);
    piece.style.setProperty("--radical-rot", `${index === 0 ? -16 : 18}deg`);
    fxLayer.appendChild(piece);
    setTimeout(() => piece.remove(), 420);
  });
}

function unitColor(unit) {
  if (unit.kind === "base") return BASE_UNITS[unit.char]?.color || "#17110c";
  return GOD_PAIRS.find(pair => pair.chars.includes(unit.char))?.color || "#17110c";
}

function glyphParts(glyph) {
  return GLYPH_PARTS[glyph] || [glyph];
}

function shotFromTo(sx, sy, tx, ty, color, glyph = "令", index = 0, mode = "single") {
  const start = boardPercent(sx, sy);
  const end = boardPercent(tx, ty);
  const shot = document.createElement("div");
  shot.className = `shot ${mode}-shot`.trim();
  shot.textContent = glyph;
  shot.style.color = color;
  shot.style.left = start.left;
  shot.style.top = start.top;
  shot.style.setProperty("--to-x", end.left);
  shot.style.setProperty("--to-y", end.top);
  const arc = mode === "dash" ? (index % 2 === 0 ? -28 : 28) : (index % 2 === 0 ? -12 : 12);
  shot.style.setProperty("--arc", `${arc}px`);
  fxLayer.appendChild(shot);
  setTimeout(() => shot.remove(), 560);
}

function battlefieldThump() {
  // Keep impact on the glyphs only; moving the whole board is dizzying.
}

function castVfx(x, y, color) {
  const pos = boardPercent(x, y);
  const cast = document.createElement("div");
  cast.className = "cast-ring";
  cast.style.color = color;
  cast.style.setProperty("--cast-x", pos.left);
  cast.style.setProperty("--cast-y", pos.top);
  fxLayer.appendChild(cast);
  setTimeout(() => cast.remove(), 320);
}

function hitVfx(x, y, color, extraClass = "", damage = null) {
  const pos = boardPercent(x, y);
  const hit = document.createElement("div");
  hit.className = `hit-spark ${extraClass}`.trim();
  hit.textContent = damage ? String(damage) : "";
  hit.style.color = color;
  hit.style.setProperty("--hit-x", pos.left);
  hit.style.setProperty("--hit-y", pos.top);
  fxLayer.appendChild(hit);
  setTimeout(() => hit.remove(), 360);
}

function slashVfx(x, y, color) {
  const pos = boardPercent(x, y);
  const slash = document.createElement("div");
  slash.className = "slash-mark";
  slash.style.color = color;
  slash.style.setProperty("--slash-x", pos.left);
  slash.style.setProperty("--slash-y", pos.top);
  fxLayer.appendChild(slash);
  setTimeout(() => slash.remove(), 420);
}

function wardVfx(x, y, color, text) {
  const pos = boardPercent(x, y);
  const ward = document.createElement("div");
  ward.className = `ward-mark ward-${text}`;
  ward.textContent = text;
  ward.style.color = color;
  ward.style.setProperty("--ward-x", pos.left);
  ward.style.setProperty("--ward-y", pos.top);
  fxLayer.appendChild(ward);
  setTimeout(() => ward.remove(), 520);
}

function glyphScatter(x, y, glyphs, color) {
  const pos = boardPercent(x, y);
  const pieces = glyphs;
  const spread = [
    { x: "-44px", y: "-20px", r: "-24deg" },
    { x: "42px", y: "-18px", r: "26deg" },
    { x: "-28px", y: "34px", r: "18deg" },
    { x: "30px", y: "34px", r: "-18deg" }
  ];

  pieces.forEach((glyph, index) => {
    const piece = document.createElement("div");
    const move = spread[index % spread.length];
    piece.className = "glyph-piece";
    piece.textContent = glyph;
    piece.style.color = color;
    piece.style.setProperty("--piece-x", pos.left);
    piece.style.setProperty("--piece-y", pos.top);
    piece.style.setProperty("--piece-dx", move.x);
    piece.style.setProperty("--piece-dy", move.y);
    piece.style.setProperty("--piece-rot", move.r);
    fxLayer.appendChild(piece);
    setTimeout(() => piece.remove(), 520);
  });
}

function burstAt(x, y, color, size, extraClass = "") {
  const pos = boardPercent(x, y);
  const burst = document.createElement("div");
  burst.className = `burst ${extraClass}`.trim();
  burst.style.color = color;
  burst.style.setProperty("--burst-x", pos.left);
  burst.style.setProperty("--burst-y", pos.top);
  burst.style.setProperty("--burst-size", `${Math.max(1, size) * 58}px`);
  fxLayer.appendChild(burst);
  setTimeout(() => burst.remove(), 360);
}

function floatText(x, y, text, color = "#d7a02f", extraClass = "") {
  const pos = boardPercent(x, y);
  const el = document.createElement("div");
  el.className = `float-text ${extraClass}`.trim();
  el.textContent = text;
  el.style.color = color;
  el.style.setProperty("--float-x", pos.left);
  el.style.setProperty("--float-y", pos.top);
  fxLayer.appendChild(el);
  setTimeout(() => el.remove(), 820);
}

function mergeVfx(x, y, unit) {
  const label = unit.kind === "fragment" ? `${unit.char}字升階` : `${unit.char}${unit.level}`;
  burstAt(x, y, "#d7a02f", 1.35, "merge-burst");
  floatText(x, y, label, "#fff0a8", "merge-text");
}

function godCallVfx(x, y, color, label) {
  burstAt(x, y, color, 1.75, "god-burst");
  floatText(x, y, label, "#fff6cf", "god-call");
}

function godAttackVfx(pair, targetPos) {
  if (pair.def.special === "pierce") {
    beamFromTo(pair.cx, pair.cy, targetPos.x, targetPos.y, pair.def.color);
    floatText(pair.cx, pair.cy, pair.def.title, pair.def.color, "attack-text");
  } else if (pair.def.special === "cleave") {
    floatText(pair.cx, pair.cy, "斬", pair.def.color, "attack-text");
  } else if (pair.def.special === "stun") {
    floatText(pair.cx, pair.cy, "鎮", pair.def.color, "attack-text");
  } else if (pair.def.special === "dash") {
    floatText(pair.cx, pair.cy, "巡", pair.def.color, "attack-text");
  }
}

function beamFromTo(sx, sy, tx, ty, color, extraClass = "") {
  const startX = ((sx + 0.5) / COLS) * 100;
  const startY = ((sy + 0.5) / ROWS) * 100;
  const endX = ((tx + 0.5) / COLS) * 100;
  const endY = ((ty + 0.5) / ROWS) * 100;
  const dx = endX - startX;
  const dy = endY - startY;
  const beam = document.createElement("div");
  beam.className = `beam ${extraClass}`.trim();
  beam.style.color = color;
  beam.style.left = `${startX}%`;
  beam.style.top = `${startY}%`;
  beam.style.width = `${Math.hypot(dx, dy)}%`;
  beam.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
  fxLayer.appendChild(beam);
  setTimeout(() => beam.remove(), 260);
}

function triggerScreenShake(intensity = "light") {
  const shell = document.getElementById("game-shell");
  if (!shell) return;
  shell.classList.remove("shake-light", "shake-medium", "shake-heavy");
  void shell.offsetWidth; // trigger reflow
  shell.classList.add(`shake-${intensity}`);
  setTimeout(() => shell.classList.remove(`shake-${intensity}`), 400);
}

function endGame(win) {
  state.phase = "ended";
  resultKicker.textContent = win ? "香火鼎盛" : "香爐失守";
  resultTitle.textContent = win ? "廟埕平安" : "香火暫斷";
  resultCopy.textContent = win
    ? `撐過 ${MAX_WAVE} 波，降伏 ${state.kills} 次。`
    : `止步第 ${state.wave} 波，降伏 ${state.kills} 次。`;
  resultModal.classList.remove("hidden");
  updateHud();
}

function resetGame() {
  state.enemies = [];
  state.bench = [];
  state.selected = null;
  state.grain = 80;
  state.wave = 1;
  state.kills = 0;
  state.baseHp = 10;
  state.baseMaxHp = 10;
  state.spawnLeft = 0;
  state.spawnTimer = 0;
  state.phase = "play";
  state.passives = {
    damage: 1,
    range: 1,
    speed: 1,
    discount: 0
  };

  initBoard();
  for (let i = 0; i < 4; i += 1) addBenchUnit(randomBaseUnit());
  choiceModal.classList.add("hidden");
  resultModal.classList.add("hidden");
  fxLayer.innerHTML = "";
  renderAll();
  startWave();
}

summonBtn.addEventListener("click", summon);
discardBtn.addEventListener("click", () => {
  if (Date.now() < state.suppressClickUntil) return;
  discardSelectedUnit();
  renderAll();
});
restartBtn.addEventListener("click", resetGame);
resultBtn.addEventListener("click", resetGame);

resetGame();
state.interval = setInterval(gameTick, TICK_MS);
