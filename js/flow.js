function addBenchUnit(unit) {
  if (state.bench.length < BENCH_LIMIT) {
    state.bench.push(unit);
    state.inspected = { source: "bench", index: state.bench.length - 1 };
    if (unit.effect) unlockUnit(unit.effect);
  }
}

function summon() {
  if (!canManageUnits()) return;
  const cost = summonCost();
  if (state.grain < cost || state.bench.length >= BENCH_LIMIT) return;
  state.grain -= cost;
  const summonFragment = state.summonsSinceFragment >= 2 || Math.random() < 0.35;
  if (summonFragment) {
    addBenchUnit(randomFragmentUnit());
    state.summonsSinceFragment = 0;
    recordActivity("summon");
    playGameSound("summonGod");
    log("神名字入列，靠近另一字才會啟動。");
    renderAll();
    return;
  }

  addBenchUnit(randomBaseUnit());
  state.summonsSinceFragment += 1;
  recordActivity("summon");
  playGameSound("summon");
  log("新法器已入列。");
  renderAll();
}

function startWave() {
  state.phase = "play";
  state.waveTotal = 6 + state.wave * 2;
  state.spawnLeft = state.waveTotal;
  state.spawnDelay = Math.max(18, 42 - state.wave * 2);
  state.spawnTimer = 18;
  playGameSound("wave");
  const bossType = BOSS_WAVES[state.wave];
  log(bossType ? `第 ${state.wave} 波，${ENEMY_TYPES[bossType].name}壓陣。` : `第 ${state.wave} 波妖邪逼近。`);
  updateHud();
}

function handlePaceAction() {
  if (state.phase === "play") {
    state.phase = "paused";
    playGameSound("pause");
    log("香路暫歇。");
    updateHud();
    return;
  }
  if (state.phase === "paused") {
    state.phase = "play";
    playGameSound("resume");
    log(`第 ${state.wave} 波續行。`);
    updateHud();
    return;
  }
  if (state.phase === "ready" || state.phase === "between") startWave();
}

function toggleGameSpeed() {
  if (state.phase === "choice" || state.phase === "ended") return;
  state.gameSpeed = state.gameSpeed === 1 ? 2 : 1;
  playGameSound("resume");
  log(`戰鬥速度切換為 ${state.gameSpeed} 倍。`);
  updateHud();
}

function spawnEnemy() {
  let type = "怪";
  const roll = Math.random();
  const waveBoss = BOSS_WAVES[state.wave];
  if (waveBoss && state.spawnLeft === 1) type = waveBoss;
  else if (state.wave >= 3 && roll > 0.72) type = "妖";
  else if (state.wave >= 2 && roll > 0.44) type = "鬼";

  const data = ENEMY_TYPES[type];
  const hp = Math.round(data.hp * (1 + (state.wave - 1) * 0.19));
  const enemy = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Math.random()),
    type,
    hp,
    maxHp: hp,
    pathIndex: 0,
    progress: 0,
    speed: data.speed,
    reward: data.reward,
    stun: 0,
    slow: 0,
    armor: data.armor || 0,
    statusResistance: data.statusResistance || 1,
    baseDamage: data.baseDamage || 1,
    enraged: false
  };
  state.enemies.push(enemy);
  unlockUnit(type);

  if (data.boss) {
    const entrance = PATH[0];
    bossEntranceVfx(entrance.x, entrance.y, data.color, data.name);
    playGameSound("boss");
  }
}

function gameTick() {
  if (state.phase !== "play") return;

  const steps = Math.max(1, state.gameSpeed);
  for (let step = 0; step < steps; step += 1) {
    if (state.phase !== "play") break;
    handleSpawning();
    moveEnemies();
    attackWithUnits();
    clearDefeated();
    checkWaveClear();
  }
  renderEnemies();
  updateHud();
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
    if (enemy.type === "魈" && !enemy.enraged && enemy.hp <= enemy.maxHp * 0.5) {
      enemy.enraged = true;
      log("山魈鬼王負傷疾走。");
      playGameSound("boss");
    }
    const rageFactor = enemy.enraged ? 1.42 : 1;
    enemy.progress += (0.03 + (state.wave - 1) * 0.0015) * enemy.speed * slowFactor * rageFactor;
    while (enemy.progress >= 1) {
      enemy.progress -= 1;
      enemy.pathIndex += 1;
      if (enemy.pathIndex >= PATH.length - 1) {
        state.baseHp -= enemy.baseDamage;
        state.enemies.splice(i, 1);
        playGameSound("baseHit");
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

      const damage = attackPower(def, unit.level);
      pulseUnitAt(x, y, targets[0].pos);
      resolveAttack(def, x, y, targets, damage, unit.level, [unit.char]);
      playGameSound(def.effect || def.special || "sword");
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

    const damage = attackPower(pair.def, pair.level);
    pulseUnitAt(pair.leftX, pair.leftY, targets[0].pos);
    pulseUnitAt(pair.rightX, pair.rightY, targets[0].pos);
    resolveAttack(pair.def, pair.cx, pair.cy, targets, damage, pair.level, [pair.left.char, pair.right.char]);
    godAttackVfx(pair, targets[0].pos);
    playGameSound(pair.def.special === "mercy" ? "mercy" : "deity");
    triggerScreenShake("heavy");
    pair.left.cooldown = Math.max(8, Math.floor(pair.def.cooldown * state.passives.speed));
  });
}

function resolveAttack(def, x, y, targets, damage, level, glyphs = ["令"]) {
  const primary = targets[0];
  const effect = def.effect || def.special || "single";

  if (def.special === "cleave") {
    targets.forEach(target => {
      const dealt = damageEnemy(target.enemy, damage, "cleave", def.color);
      slashVfx(target.pos.x, target.pos.y, def.color);
      hitVfx(target.pos.x, target.pos.y, def.color, "ink-hit hit-cleave", dealt);
    });
    glyphScatter(x, y, glyphs, def.color);
    return;
  }

  if (def.special === "stun") {
    targets.forEach(target => {
      const dealt = damageEnemy(target.enemy, damage, "stun", def.color);
      target.enemy.stun = Math.max(target.enemy.stun, statusDuration(target.enemy, 28 + level * 8));
      wardVfx(target.pos.x, target.pos.y, def.color, "鎮");
      hitVfx(target.pos.x, target.pos.y, def.color, "ink-hit hit-stun", dealt);
    });
    glyphScatter(x, y, glyphs, def.color);
    return;
  }

  if (def.special === "dash") {
    targets.slice(0, 3).forEach(target => {
      const dealt = damageEnemy(target.enemy, Math.round(damage * 0.9), "dash", def.color);
      glyphs.forEach((glyph, index) => {
        shotFromTo(x, y, target.pos.x, target.pos.y, def.color, glyph, index, "dash");
      });
      wardVfx(target.pos.x, target.pos.y, def.color, "巡");
      hitVfx(target.pos.x, target.pos.y, def.color, "ink-hit hit-dash", dealt);
    });
    return;
  }

  if (def.special === "pierce") {
    targets.slice(0, 2 + level).forEach(target => {
      const dealt = damageEnemy(target.enemy, damage, "pierce", def.color);
      beamFromTo(x, y, target.pos.x, target.pos.y, def.color, "pierce-beam");
      glyphs.forEach((glyph, index) => {
        shotFromTo(x, y, target.pos.x, target.pos.y, def.color, glyph, index, "pierce");
      });
      hitVfx(target.pos.x, target.pos.y, def.color, "ink-hit hit-pierce", dealt);
    });
    return;
  }

  if (def.special === "mercy") {
    targets.slice(0, 1 + Math.ceil(level / 2)).forEach((target, targetIndex) => {
      const mercyDamage = Math.round(damage * (targetIndex === 0 ? 1 : 0.76));
      const dealt = damageEnemy(target.enemy, mercyDamage, "mercy", def.color);
      beamFromTo(x, y, target.pos.x, target.pos.y, def.color, "mercy-beam");
      glyphs.forEach((glyph, index) => {
        shotFromTo(x, y, target.pos.x, target.pos.y, def.color, glyph, index, "mercy");
      });
      hitVfx(target.pos.x, target.pos.y, def.color, "ink-hit hit-mercy", dealt);
    });

    state.mercyCharge = Math.min(4, state.mercyCharge + 1);
    if (state.mercyCharge >= 4 && state.baseHp < state.baseMaxHp) {
      state.baseHp += 1;
      state.mercyCharge = 0;
      const gate = PATH[PATH.length - 1];
      floatText(gate.x, gate.y, "香爐 +1", def.color);
    }
    return;
  }

  if (def.special === "mirror") {
    targets.slice(0, 1 + level).forEach((target, targetIndex) => {
      const mirrorDamage = Math.round(damage * (targetIndex === 0 ? 1 : 0.72));
      const dealt = damageEnemy(target.enemy, mirrorDamage, "mirror", def.color);
      beamFromTo(x, y, target.pos.x, target.pos.y, def.color, "mirror-beam");
      glyphs.forEach((glyph, index) => {
        shotFromTo(x, y, target.pos.x, target.pos.y, def.color, glyph, index, "mirror");
      });
      hitVfx(target.pos.x, target.pos.y, def.color, "ink-hit hit-mirror", dealt);
    });
    return;
  }

  if (def.special === "charm") {
    targets.slice(0, 3 + level).forEach((target, targetIndex) => {
      const charmDamage = Math.round(damage * (targetIndex === 0 ? 1 : 0.82));
      const dealt = damageEnemy(target.enemy, charmDamage, "charm", def.color);
      glyphs.forEach((glyph, index) => {
        shotFromTo(x, y, target.pos.x, target.pos.y, def.color, glyph, index + targetIndex, "charm");
      });
      hitVfx(target.pos.x, target.pos.y, def.color, "ink-hit hit-charm", dealt);
    });
    glyphScatter(x, y, glyphs, def.color);
    return;
  }

  if (def.special === "bell") {
    targets.slice(0, 2).forEach(target => {
      const dealt = damageEnemy(target.enemy, damage, "bell", def.color);
      target.enemy.slow = Math.max(target.enemy.slow || 0, statusDuration(target.enemy, 34 + level * 7));
      shotFromTo(x, y, target.pos.x, target.pos.y, def.color, glyphs[0], 0, "bell");
      wardVfx(target.pos.x, target.pos.y, def.color, "鈴");
      hitVfx(target.pos.x, target.pos.y, def.color, "ink-hit hit-bell", dealt);
    });
    return;
  }

  if (def.special === "seal") {
    const dealt = damageEnemy(primary.enemy, damage, "seal", def.color);
    primary.enemy.stun = Math.max(primary.enemy.stun, statusDuration(primary.enemy, 16 + level * 6));
    glyphs.forEach((glyph, index) => {
      shotFromTo(x, y, primary.pos.x, primary.pos.y, def.color, glyph, index, "seal");
    });
    wardVfx(primary.pos.x, primary.pos.y, def.color, "印");
    hitVfx(primary.pos.x, primary.pos.y, def.color, "ink-hit hit-seal", dealt);
    return;
  }

  const dealt = damageEnemy(primary.enemy, damage, effect, def.color);
  glyphs.forEach((glyph, index) => {
    shotFromTo(x, y, primary.pos.x, primary.pos.y, def.color, glyph, index, effect);
  });
  if (effect === "sword") slashVfx(primary.pos.x, primary.pos.y, def.color);
  hitVfx(primary.pos.x, primary.pos.y, def.color, `ink-hit hit-${effect}`, dealt);
}

function damageEnemy(enemy, amount, effect = "single", color = "#17110c") {
  const dealt = Math.max(1, Math.round(amount * (1 - (enemy.armor || 0))));
  enemy.hp -= dealt;
  enemyHitReaction(enemy, effect, color);
  return dealt;
}

function statusDuration(enemy, duration) {
  return Math.max(1, Math.round(duration * (enemy.statusResistance || 1)));
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
          level: Math.min(5, Math.max(left.level, right.level)),
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

function godPairAtCell(x, y) {
  const key = cellKey(x, y);
  return activeGodPairs().find(pair => pair.cells.includes(key)) || null;
}

function setGodPairLevel(pair, level) {
  const sharedLevel = Math.max(1, Math.min(5, Math.round(level)));
  pair.left.level = sharedLevel;
  pair.right.level = sharedLevel;
  pair.level = sharedLevel;
  return sharedLevel;
}

function activeGodPairIds() {
  return new Set(activeGodPairs().map(pair => pairId(pair)));
}

function pairId(pair) {
  return `${pair.def.title}:${pair.cells.slice().sort().join("|")}`;
}

function announceNewGodPairs(previousIds) {
  activeGodPairs().forEach(pair => {
    setGodPairLevel(pair, pair.level);
    if (previousIds.has(pairId(pair))) return;
    const label = `${pair.def.title}降臨`;
    playGameSound("summonGod");
    godCallVfx(pair.cx, pair.cy, pair.def.color, label);
    log(`${pair.def.title}已啟動。`);
    unlockUnit(pair.def.slug);
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
    const enemyData = ENEMY_TYPES[enemy.type];
    recordActivity("kill");
    if (enemyData.boss) recordActivity("boss");
    playGameSound(enemyData.boss ? "bossDown" : "enemyDown");
    enemyDefeatVfx(enemy, pos);
    state.enemies.splice(i, 1);
  }
}

function checkWaveClear() {
  if (state.phase !== "play") return;
  if (state.spawnLeft > 0 || state.enemies.length > 0) return;

  state.phase = "between";
  state.grain += 18 + state.wave * 3;
  recordActivity("wave");
  playGameSound("clear");
  log(`第 ${state.wave} 波已淨。`);

  if (state.wave >= MAX_WAVE) {
    state.phase = "ended";
    updateHud();
    setTimeout(() => endGame(true), 500);
    return;
  }

  if (state.wave % 3 === 0) {
    state.phase = "choice";
    updateHud();
    setTimeout(openChoices, 550);
  } else {
    state.wave += 1;
    recordHighestWave(state.wave);
    log(`第 ${state.wave - 1} 波已淨，香路待陣。`);
    renderAll();
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
      recordHighestWave(state.wave);
      state.phase = "between";
      playGameSound("blessing");
      log(`${choice.name}落籤。`);
      renderAll();
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

