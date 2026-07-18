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

