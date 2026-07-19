const boardEl = document.getElementById("board");
const enemyLayer = document.getElementById("enemy-layer");
const fxLayer = document.getElementById("fx-layer");
const benchEl = document.getElementById("bench");
const baseHpEl = document.getElementById("base-hp");
const waveEl = document.getElementById("wave");
const grainEl = document.getElementById("grain");
const killsEl = document.getElementById("kills");
const remainingEl = document.getElementById("remaining");
const summonBtn = document.getElementById("summon-btn");
const summonCostEl = document.getElementById("summon-cost");
const discardBtn = document.getElementById("discard-zone");
const paceBtn = document.getElementById("pace-btn");
const speedBtn = document.getElementById("speed-btn");
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
  waveTotal: 0,
  summonsSinceFragment: 0,
  mercyCharge: 0,
  gameSpeed: 1,
  phase: "ready",
  interval: null,
  passives: {
    damage: 1,
    range: 1,
    speed: 1,
    discount: 0
  }
};

let dragState = null;

function canManageUnits() {
  return ["ready", "play", "paused", "between"].includes(state.phase);
}

