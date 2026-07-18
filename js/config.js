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

