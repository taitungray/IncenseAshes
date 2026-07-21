const audioButton = document.getElementById("audio-btn");

const gameAudio = {
  context: null,
  master: null,
  music: null,
  sfx: null,
  musicTimer: null,
  musicStep: 0,
  unlocked: false,
  muted: readAudioPreference(),
  lastPlayed: new Map()
};

const MUSIC_NOTES = [
  220.00, null, 261.63, 293.66,
  329.63, null, 293.66, null,
  261.63, 293.66, 329.63, 392.00,
  220.00, null, null, null,
  329.63, null, 392.00, 440.00,
  392.00, null, 329.63, null,
  293.66, 261.63, 220.00, 261.63,
  220.00, null, null, null
];

const SOUND_THROTTLES = {
  charm: 120,
  mirror: 110,
  bell: 180,
  sword: 100,
  seal: 140,
  deity: 180,
  mercy: 180,
  enemyDown: 80,
  baseHit: 220
};

function readAudioPreference() {
  try {
    return localStorage.getItem("incense-audio-muted") === "true";
  } catch {
    return false;
  }
}

function saveAudioPreference() {
  try {
    localStorage.setItem("incense-audio-muted", String(gameAudio.muted));
  } catch {
    // Audio still works when storage is unavailable.
  }
}

function createAudioGraph() {
  if (gameAudio.context) return gameAudio.context;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  const context = new AudioContextClass();
  const master = context.createGain();
  const music = context.createGain();
  const sfx = context.createGain();

  master.gain.value = gameAudio.muted ? 0 : 0.7;
  music.gain.value = 0.6;
  sfx.gain.value = 0.58;
  music.connect(master);
  sfx.connect(master);
  master.connect(context.destination);

  gameAudio.context = context;
  gameAudio.master = master;
  gameAudio.music = music;
  gameAudio.sfx = sfx;
  return context;
}

function unlockGameAudio() {
  gameAudio.unlocked = true;
  const context = createAudioGraph();
  if (!context || gameAudio.muted) return;
  if (context.state === "suspended") context.resume().catch(() => {});
  startTempleMusic();
}

function updateAudioButton() {
  if (!audioButton) return;
  audioButton.classList.toggle("muted", gameAudio.muted);
  audioButton.setAttribute("aria-pressed", String(!gameAudio.muted));
  audioButton.setAttribute("aria-label", gameAudio.muted ? "開啟音樂音效" : "關閉音樂音效");
  audioButton.title = gameAudio.muted ? "開啟音樂音效" : "關閉音樂音效";
}

function toggleGameAudio() {
  gameAudio.unlocked = true;
  gameAudio.muted = !gameAudio.muted;
  saveAudioPreference();
  const context = createAudioGraph();
  updateAudioButton();
  if (!context) return;

  const now = context.currentTime;
  gameAudio.master.gain.cancelScheduledValues(now);
  gameAudio.master.gain.setValueAtTime(gameAudio.master.gain.value, now);
  gameAudio.master.gain.linearRampToValueAtTime(gameAudio.muted ? 0 : 0.52, now + 0.08);

  if (!gameAudio.muted) {
    if (context.state === "suspended") context.resume().catch(() => {});
    startTempleMusic();
    playGameSound("resume", true);
  }
}

function startTempleMusic() {
  if (gameAudio.musicTimer || gameAudio.muted || !gameAudio.context) return;
  playMusicStep();
  gameAudio.musicTimer = window.setInterval(playMusicStep, 350);
}

function playMusicStep() {
  const context = gameAudio.context;
  if (!context || gameAudio.muted || context.state !== "running") return;
  const step = gameAudio.musicStep % MUSIC_NOTES.length;
  const note = MUSIC_NOTES[step];

  if (note) {
    const isLongNote = MUSIC_NOTES[(step + 1) % MUSIC_NOTES.length] === null;
    playTone(note, isLongNote ? 0.6 : 0.3, {
      destination: gameAudio.music,
      type: "sine",
      volume: 0.15,
      attack: 0.08,
      endFrequency: isLongNote ? note * 0.98 : undefined
    });
  }

  if (step % 8 === 0) {
    playRitualDrum({ destination: gameAudio.music, volume: 0.12 });
    if (step % 16 === 0) playTempleBell({ destination: gameAudio.music, volume: 0.1 });
  }

  if (step % 2 === 1) {
    playWoodenFish({ destination: gameAudio.music, volume: 0.05 });
  }

  if (step % 4 === 2) {
    playDaoistBell({ destination: gameAudio.music, volume: 0.03 });
  }

  gameAudio.musicStep += 1;
}

function playWoodenFish(options = {}) {
  const context = gameAudio.context;
  if (!context) return;
  const when = context.currentTime + (options.delay || 0);
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const destination = options.destination || gameAudio.sfx;
  
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(600, when);
  oscillator.frequency.exponentialRampToValueAtTime(300, when + 0.05);
  
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(options.volume || 0.1, when + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
  
  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.start(when);
  oscillator.stop(when + 0.06);
}

function playRitualDrum(options = {}) {
  const context = gameAudio.context;
  if (!context) return;
  const when = context.currentTime + (options.delay || 0);
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const destination = options.destination || gameAudio.sfx;
  
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(100, when);
  oscillator.frequency.exponentialRampToValueAtTime(40, when + 0.3);
  
  gain.gain.setValueAtTime(options.volume || 0.1, when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.4);
  
  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.start(when);
  oscillator.stop(when + 0.5);
  
  playNoise(0.2, { filter: "lowpass", frequency: 200, volume: (options.volume || 0.1) * 0.5, destination });
}

function playDaoistBell(options = {}) {
  const context = gameAudio.context;
  if (!context) return;
  const when = context.currentTime + (options.delay || 0);
  const osc1 = context.createOscillator();
  const osc2 = context.createOscillator();
  const gain = context.createGain();
  const destination = options.destination || gameAudio.sfx;
  
  osc1.type = "sine";
  osc2.type = "sine";
  osc1.frequency.setValueAtTime(2000, when);
  osc2.frequency.setValueAtTime(2800, when);
  
  gain.gain.setValueAtTime(options.volume || 0.1, when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.8);
  
  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(destination);
  
  osc1.start(when);
  osc2.start(when);
  osc1.stop(when + 1.0);
  osc2.stop(when + 1.0);
}

function playTempleBell(options = {}) {
  const context = gameAudio.context;
  if (!context) return;
  const when = context.currentTime + (options.delay || 0);
  const osc1 = context.createOscillator();
  const osc2 = context.createOscillator();
  const gain = context.createGain();
  const destination = options.destination || gameAudio.sfx;
  
  osc1.type = "sine";
  osc2.type = "sine";
  osc1.frequency.setValueAtTime(440, when);
  osc2.frequency.setValueAtTime(442, when);
  
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.linearRampToValueAtTime(options.volume || 0.1, when + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 3.0);
  
  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(destination);
  
  osc1.start(when);
  osc2.start(when);
  osc1.stop(when + 3.1);
  osc2.stop(when + 3.1);
}

function playTone(frequency, duration, options = {}) {
  const context = gameAudio.context;
  if (!context) return;
  const when = context.currentTime + (options.delay || 0);
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const destination = options.destination || gameAudio.sfx;
  const volume = Math.max(0.0001, options.volume || 0.1);
  const attack = Math.min(duration * 0.35, options.attack || 0.012);

  oscillator.type = options.type || "sine";
  oscillator.frequency.setValueAtTime(Math.max(30, frequency), when);
  if (options.endFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, options.endFrequency), when + duration);
  }

  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(volume, when + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.start(when);
  oscillator.stop(when + duration + 0.03);
}

function playNoise(duration, options = {}) {
  const context = gameAudio.context;
  if (!context) return;
  const when = context.currentTime + (options.delay || 0);
  const frameCount = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < frameCount; index += 1) {
    data[index] = (Math.random() * 2 - 1) * (1 - index / frameCount);
  }

  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  const destination = options.destination || gameAudio.sfx;
  source.buffer = buffer;
  filter.type = options.filter || "bandpass";
  filter.frequency.value = options.frequency || 900;
  filter.Q.value = options.q || 0.8;
  gain.gain.setValueAtTime(options.volume || 0.05, when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  source.start(when);
}

function playGameSound(name, force = false) {
  if (!gameAudio.unlocked || gameAudio.muted) return;
  const context = createAudioGraph();
  if (!context) return;
  if (context.state === "suspended") context.resume().catch(() => {});

  const nowMs = performance.now();
  const throttle = SOUND_THROTTLES[name] || 0;
  const lastPlayed = gameAudio.lastPlayed.get(name) || 0;
  if (!force && throttle > 0 && nowMs - lastPlayed < throttle) return;
  gameAudio.lastPlayed.set(name, nowMs);

  switch (name) {
    case "summon":
      playTone(392, 0.13, { type: "triangle", volume: 0.1 });
      playTone(587.33, 0.22, { type: "sine", volume: 0.08, delay: 0.08 });
      break;
    case "summonGod":
      playTone(293.66, 0.18, { type: "triangle", volume: 0.1 });
      playTone(440, 0.3, { type: "sine", volume: 0.09, delay: 0.08 });
      playTone(587.33, 0.42, { type: "sine", volume: 0.07, delay: 0.16 });
      break;
    case "place":
      playTone(246.94, 0.1, { type: "triangle", volume: 0.075, endFrequency: 220 });
      break;
    case "merge":
      playTone(329.63, 0.16, { type: "triangle", volume: 0.09 });
      playTone(493.88, 0.24, { type: "sine", volume: 0.08, delay: 0.07 });
      playTone(659.25, 0.34, { type: "sine", volume: 0.06, delay: 0.14 });
      break;
    case "discard":
      playNoise(0.22, { filter: "highpass", frequency: 700, volume: 0.07 });
      playTone(220, 0.25, { type: "triangle", volume: 0.06, endFrequency: 92 });
      break;
    case "wave":
      playTone(110, 0.75, { type: "sine", volume: 0.12, endFrequency: 82 });
      playTone(220, 0.42, { type: "triangle", volume: 0.055, delay: 0.06 });
      break;
    case "pause":
      playTone(293.66, 0.12, { type: "sine", volume: 0.06, endFrequency: 220 });
      break;
    case "resume":
      playTone(293.66, 0.12, { type: "sine", volume: 0.06 });
      playTone(392, 0.18, { type: "sine", volume: 0.055, delay: 0.07 });
      break;
    case "charm":
      playNoise(0.16, { filter: "highpass", frequency: 1200, volume: 0.052 });
      playTone(523.25, 0.18, { type: "triangle", volume: 0.055 });
      break;
    case "mirror":
      playTone(880, 0.22, { type: "sine", volume: 0.052 });
      playTone(1318.51, 0.28, { type: "sine", volume: 0.035, delay: 0.04 });
      break;
    case "bell":
      playTone(783.99, 0.48, { type: "sine", volume: 0.085 });
      playTone(1174.66, 0.62, { type: "sine", volume: 0.042, delay: 0.03 });
      break;
    case "sword":
      playNoise(0.12, { filter: "highpass", frequency: 1800, volume: 0.08 });
      playTone(196, 0.15, { type: "sawtooth", volume: 0.045, endFrequency: 98 });
      break;
    case "seal":
      playTone(123.47, 0.26, { type: "triangle", volume: 0.105, endFrequency: 82 });
      playNoise(0.1, { filter: "lowpass", frequency: 420, volume: 0.06 });
      break;
    case "deity":
      playTone(220, 0.2, { type: "triangle", volume: 0.08 });
      playTone(329.63, 0.26, { type: "triangle", volume: 0.065, delay: 0.04 });
      playTone(440, 0.34, { type: "sine", volume: 0.055, delay: 0.08 });
      break;
    case "mercy":
      playTone(440, 0.34, { type: "sine", volume: 0.065 });
      playTone(659.25, 0.46, { type: "sine", volume: 0.045, delay: 0.06 });
      break;
    case "enemyDown":
      playTone(174.61, 0.16, { type: "triangle", volume: 0.045, endFrequency: 87.31 });
      break;
    case "baseHit":
      playTone(73.42, 0.3, { type: "square", volume: 0.075, endFrequency: 55 });
      break;
    case "boss":
      playTone(65.41, 0.85, { type: "sine", volume: 0.13, endFrequency: 49 });
      playTone(98, 0.52, { type: "triangle", volume: 0.075, delay: 0.08, endFrequency: 73.42 });
      playNoise(0.28, { filter: "lowpass", frequency: 260, volume: 0.06, delay: 0.04 });
      break;
    case "bossDown":
      playTone(146.83, 0.3, { type: "triangle", volume: 0.1, endFrequency: 73.42 });
      playTone(220, 0.5, { type: "sine", volume: 0.07, delay: 0.12, endFrequency: 110 });
      playNoise(0.36, { filter: "lowpass", frequency: 380, volume: 0.07 });
      break;
    case "clear":
      playTone(293.66, 0.2, { type: "triangle", volume: 0.08 });
      playTone(392, 0.26, { type: "triangle", volume: 0.075, delay: 0.1 });
      playTone(493.88, 0.38, { type: "sine", volume: 0.065, delay: 0.2 });
      break;
    case "blessing":
      playTone(392, 0.18, { type: "sine", volume: 0.07 });
      playTone(587.33, 0.34, { type: "sine", volume: 0.06, delay: 0.09 });
      break;
    case "win":
      [293.66, 392, 493.88, 587.33].forEach((note, index) => {
        playTone(note, 0.46, { type: "triangle", volume: 0.07, delay: index * 0.13 });
      });
      break;
    case "lose":
      playTone(196, 0.42, { type: "triangle", volume: 0.08, endFrequency: 130.81 });
      playTone(98, 0.7, { type: "sine", volume: 0.075, delay: 0.16, endFrequency: 65.41 });
      break;
    default:
      break;
  }
}

function unlockAudioFromGesture(event) {
  if (event.target?.closest?.("#audio-btn")) return;
  unlockGameAudio();
  document.removeEventListener("pointerdown", unlockAudioFromGesture, true);
  document.removeEventListener("keydown", unlockAudioFromGesture, true);
}

audioButton?.addEventListener("click", toggleGameAudio);
document.addEventListener("pointerdown", unlockAudioFromGesture, true);
document.addEventListener("keydown", unlockAudioFromGesture, true);
updateAudioButton();

function pauseAudioForBackground() {
  if (gameAudio.context && gameAudio.context.state === "running") {
    gameAudio.context.suspend().catch(() => {});
  }
}

function resumeAudioFromBackground() {
  if (gameAudio.context && !gameAudio.muted && gameAudio.unlocked) {
    if (gameAudio.context.state === "suspended") {
      gameAudio.context.resume().catch(() => {});
    }
  }
}

gameAudio.pauseForBackground = pauseAudioForBackground;
gameAudio.resumeFromBackground = resumeAudioFromBackground;

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    pauseAudioForBackground();
  } else {
    resumeAudioFromBackground();
  }
});

document.addEventListener("pause", pauseAudioForBackground, false);
document.addEventListener("resume", resumeAudioFromBackground, false);
