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

