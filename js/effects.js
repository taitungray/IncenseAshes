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
  setTimeout(() => unitEl.classList.remove("attacking"), 560);
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
  if (BASE_UNITS[glyph]) return [glyph];
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
  if (damage !== null) {
    const number = document.createElement("strong");
    number.className = `damage-number ${damage >= 25 ? "damage-heavy" : ""}`.trim();
    number.textContent = `-${damage}`;
    hit.appendChild(number);
  }
  hit.style.color = color;
  const driftDirection = Math.random() < 0.5 ? -1 : 1;
  hit.style.setProperty("--damage-drift", `${driftDirection * Math.round(14 + Math.random() * 8)}px`);
  hit.style.setProperty("--damage-tilt", `${Math.round(Math.random() * 8 - 4)}deg`);
  hit.style.setProperty("--hit-x", pos.left);
  hit.style.setProperty("--hit-y", pos.top);
  fxLayer.appendChild(hit);
  setTimeout(() => hit.remove(), 520);
}

function enemyHitReaction(enemy, effect, color) {
  const el = document.getElementById(`enemy-${enemy.id}`);
  if (!el) return;

  const token = `${Date.now()}-${Math.random()}`;
  const hitClasses = Array.from(el.classList).filter(name => name.startsWith("taking-hit"));
  el.classList.remove(...hitClasses);
  el.style.setProperty("--impact-color", color);
  el.dataset.hitToken = token;
  void el.offsetWidth;
  el.classList.add("taking-hit", `taking-hit-${effect}`);

  setTimeout(() => {
    if (el.dataset.hitToken !== token) return;
    el.classList.remove("taking-hit", `taking-hit-${effect}`);
  }, 300);
}

function enemyDefeatVfx(enemy, pos) {
  const enemyData = ENEMY_TYPES[enemy.type];
  const source = document.getElementById(`enemy-${enemy.id}`);
  const color = enemyData.color || (source ? getComputedStyle(source).color : "#43271a");
  const defeat = document.createElement("div");
  defeat.className = `enemy-defeat enemy-${enemy.type} enemy-defeat-${enemy.type} ${enemyData.boss ? "boss-defeat" : ""}`;
  defeat.style.color = color;
  const location = boardPercent(pos.x, pos.y);
  defeat.style.left = location.left;
  defeat.style.top = location.top;

  const whole = document.createElement("span");
  whole.className = "defeat-whole";
  whole.textContent = enemy.type;
  defeat.appendChild(whole);

  const sourceGlyph = source?.querySelector(".enemy-glyph-container");
  if (sourceGlyph) {
    const glyph = sourceGlyph.cloneNode(true);
    glyph.classList.add("defeat-glyph");
    defeat.appendChild(glyph);
  } else {
    const glyph = document.createElement("span");
    glyph.className = "defeat-glyph defeat-fallback";
    glyph.textContent = enemy.type;
    defeat.appendChild(glyph);
  }

  const particleCount = enemyData.boss ? 12 : 7;
  for (let index = 0; index < particleCount; index += 1) {
    const ink = document.createElement("i");
    ink.className = "defeat-ink";
    const angle = ((360 / particleCount) * index + (index % 2) * 17) * (Math.PI / 180);
    const distance = (enemyData.boss ? 34 : 23) + (index % 3) * 7;
    ink.style.setProperty("--ink-x", `${Math.cos(angle) * distance}px`);
    ink.style.setProperty("--ink-y", `${Math.sin(angle) * distance}px`);
    ink.style.setProperty("--ink-rot", `${index * 41 - 90}deg`);
    ink.style.setProperty("--ink-delay", `${(index % 4) * 24}ms`);
    defeat.appendChild(ink);
  }

  fxLayer.appendChild(defeat);
  setTimeout(() => defeat.remove(), enemyData.boss ? 980 : 720);
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

function mergeVfx(x, y, unit, customLabel = "") {
  const label = customLabel || (unit.kind === "fragment" ? `${unit.char}字升階` : `${unit.char}${unit.level}`);
  burstAt(x, y, "#d7a02f", 1.35, "merge-burst");
  floatText(x, y, label, "#fff0a8", "merge-text");
}

function godCallVfx(x, y, color, label) {
  burstAt(x, y, color, 1.75, "god-burst");
  floatText(x, y, label, "#fff6cf", "god-call");
}

function bossEntranceVfx(x, y, color, label) {
  burstAt(x, y, color, 2.05, "boss-arrival");
  floatText(x, y, label, color, "boss-call");
}

function godAttackVfx(pair, targetPos) {
  if (pair.def.special === "pierce") {
    beamFromTo(pair.cx, pair.cy, targetPos.x, targetPos.y, pair.def.color);
    floatText(pair.cx, pair.cy, pair.def.title, pair.def.color, "attack-text");
  } else if (pair.def.special === "mercy") {
    beamFromTo(pair.cx, pair.cy, targetPos.x, targetPos.y, pair.def.color, "mercy-beam");
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

function triggerScreenShake() {
  const shell = document.getElementById("game-shell");
  if (!shell) return;
  shell.classList.remove("shake-light", "shake-medium", "shake-heavy");
}

