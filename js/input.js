function onBenchClick(index) {
  if (Date.now() < state.suppressClickUntil) return;
  if (!canManageUnits()) return;
  state.inspected = { source: "bench", index };
  if (isSelectedBench(index)) {
    state.selected = null;
  } else {
    state.selected = { source: "bench", index };
  }
  renderAll();
}

function onBoardClick(x, y) {
  if (Date.now() < state.suppressClickUntil) return;
  if (!canManageUnits()) return;
  if (isPath(x, y)) return;

  if (!state.selected) {
    if (state.board[y][x]) {
      state.inspected = { source: "board", x, y };
      state.selected = { source: "board", x, y };
      renderAll();
    }
    return;
  }

  moveSelectedToBoard(x, y);
  renderAll();
}

function beginDrag(event, selection) {
  if (!canManageUnits()) return;
  if (event.button !== undefined && event.button !== 0) return;

  const unit = selection.source === "bench"
    ? state.bench[selection.index]
    : state.board[selection.y]?.[selection.x];
  if (!unit) return;

  event.preventDefault();
  event.stopPropagation();

  state.selected = selection;
  state.inspected = { ...selection };
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
  if (!unit || !canManageUnits()) return;
  const refund = discardRefund(unit);
  const pos = selectedUnitBoardPosition();
  removeSelectedUnit();
  state.grain += refund;
  state.selected = null;
  state.inspected = state.bench.length > 0 ? { source: "bench", index: 0 } : null;
  playGameSound("discard");
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
    state.inspected = { source: "board", x, y };
    playGameSound("place");
    announceNewGodPairs(activeBefore);
    return;
  }

  if (canMergeAt(moving, target, x, y)) {
    const mergedKind = target.kind;
    const targetPair = mergedKind === "fragment" ? godPairAtCell(x, y) : null;
    removeSelectedUnit();
    if (targetPair) {
      const nextLevel = setGodPairLevel(targetPair, targetPair.level + 1);
      state.selected = null;
      state.inspected = { source: "board", x, y };
      recordActivity("merge");
      playGameSound("merge");
      mergeVfx(targetPair.cx, targetPair.cy, targetPair.left, `${targetPair.def.title} ${nextLevel}`);
      announceNewGodPairs(activeBefore);
      log(`${targetPair.def.title}升至 ${nextLevel} 級。`);
      return;
    }

    state.board[y][x] = mergeUnits(target, moving);
    state.selected = null;
    state.inspected = { source: "board", x, y };
    recordActivity("merge");
    playGameSound("merge");
    mergeVfx(x, y, state.board[y][x]);
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
    state.inspected = { source: "board", x, y };
    playGameSound("place");
    announceNewGodPairs(activeBefore);
  }
}

function canMergeAt(a, b, targetX, targetY) {
  if (!a || !b) return false;
  if (a.char !== b.char || a.kind !== b.kind) return false;
  if (a.kind === "base") return a.level === b.level && a.level < 5;
  const pair = godPairAtCell(targetX, targetY);
  return Boolean(pair && pair.level < 5);
}

function mergeUnits(a, b) {
  return makeUnit(a.char, a.level + 1, a.kind);
}

