function endGame(win) {
  state.phase = "ended";
  playGameSound(win ? "win" : "lose");
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
  state.inspected = null;
  state.grain = 80;
  state.wave = 1;
  state.kills = 0;
  state.baseHp = 10;
  state.baseMaxHp = 10;
  state.spawnLeft = 0;
  state.spawnTimer = 0;
  state.waveTotal = 0;
  state.summonsSinceFragment = 0;
  state.mercyCharge = 0;
  state.phase = "ready";
  state.passives = {
    damage: 1,
    range: 1,
    speed: 1,
    discount: 0
  };

  initBoard();
  for (let i = 0; i < 4; i += 1) addBenchUnit(randomBaseUnit());
  state.inspected = { source: "bench", index: 0 };
  choiceModal.classList.add("hidden");
  resultModal.classList.add("hidden");
  fxLayer.innerHTML = "";
  renderAll();
  log("香路未啟，廟埕待陣。");
}

summonBtn.addEventListener("click", summon);
paceBtn.addEventListener("click", handlePaceAction);
speedBtn.addEventListener("click", toggleGameSpeed);
discardBtn.addEventListener("click", () => {
  if (Date.now() < state.suppressClickUntil) return;
  discardSelectedUnit();
  renderAll();
});
restartBtn.addEventListener("click", () => {
  playGameSound("place");
  resetGame();
});
resultBtn.addEventListener("click", resetGame);

const titleScreen = document.getElementById("title-screen");
const gameShell = document.getElementById("game-shell");
const startGameBtn = document.getElementById("start-game-btn");

startGameBtn.addEventListener("click", () => {
  titleScreen.style.display = "none";
  gameShell.style.display = ""; // Remove inline display:none
  playGameSound("place"); // Play a sound on start
  resetGame();
  if (state.interval) clearInterval(state.interval);
  state.interval = setInterval(gameTick, TICK_MS);
});

// App & PWA initializations
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.log('ServiceWorker registration failed: ', err);
    });
  });
}

// Hide Capacitor Splash Screen
const SplashScreen = (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.SplashScreen) 
  ? window.Capacitor.Plugins.SplashScreen : null;
if (SplashScreen) {
  setTimeout(() => {
    SplashScreen.hide().catch(err => console.warn(err));
  }, 100);
}

// Capacitor App Plugin Handlers
const CapApp = (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App)
  ? window.Capacitor.Plugins.App : null;

if (CapApp) {
  // 1. App Lifecycle: Pause/Resume
  CapApp.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) {
      if (typeof gameAudio?.pauseForBackground === "function") {
        gameAudio.pauseForBackground();
      }
      if (state.interval) {
        clearInterval(state.interval);
        state.interval = null;
        if (state.phase === "play") {
          state.phase = "paused";
          if (typeof updateHud === "function") updateHud();
        }
      }
    } else {
      if (typeof gameAudio?.resumeFromBackground === "function") {
        gameAudio.resumeFromBackground();
      }
      if (state.phase === "paused" && titleScreen.style.display === "none") {
        state.phase = "play";
        state.interval = setInterval(gameTick, TICK_MS);
      }
    }
  });

  // 2. Android Back Button Handling
  CapApp.addListener('backButton', () => {
    // Check if any modal is open
    const openModal = document.querySelector('.modal:not(.hidden)');
    if (openModal) {
      openModal.classList.add('hidden');
      return;
    }
    
    // Check if activity hub is open
    if (typeof gameShellEl !== 'undefined' && gameShellEl.classList.contains('hub-active')) {
      if (typeof closeActivityHub === 'function') closeActivityHub();
      return;
    }

    // Otherwise prompt to exit
    if (confirm("確定要退出《廟埕守香》嗎？")) {
      CapApp.exitApp();
    }
  });
}

