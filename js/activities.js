const hubPanelEl = document.getElementById("activity-panel");
const hubContentEl = document.getElementById("hub-content");
const hubTitleEl = document.getElementById("hub-title");
const hubOpenBtn = document.getElementById("hub-btn");
const hubCloseBtn = document.getElementById("hub-close-btn");
const hubBackdropEl = document.getElementById("hub-backdrop");
const hubSectionIconEl = document.getElementById("hub-section-icon");

const CHECKIN_REWARDS = [20, 25, 30, 35, 40, 50, 80];

const DAILY_TASKS = [
  { id: "summon", title: "壇前請令", copy: "請出 3 次法器或神名字", counter: "summons", target: 3, reward: 25 },
  { id: "merge", title: "法器相合", copy: "完成 1 次合成升級", counter: "merges", target: 1, reward: 30 },
  { id: "wave", title: "守住香路", copy: "完成 2 波守香", counter: "waves", target: 2, reward: 35 },
  { id: "defeat", title: "驅除邪祟", copy: "降伏 20 名敵兵", counter: "kills", target: 20, reward: 40 }
];

const DAILY_EVENTS = [
  { id: "patrol", title: "驅煞巡境", copy: "今日累計降伏 30 名妖邪", counter: "kills", target: 30, reward: 60 },
  { id: "boss", title: "魔王懸賞", copy: "今日降伏 1 名大魔王", counter: "bosses", target: 1, reward: 80 },
  { id: "three_waves", title: "三巡淨路", copy: "今日完成 3 波守香", counter: "waves", target: 3, reward: 50 }
];

const activityState = loadActivityState();
let currentHubTab = "events";

const HUB_META = {
  checkin: { title: "每日簽到", kicker: "香火日課", icon: "assets/nav-checkin.png" },
  tasks: { title: "每日任務", kicker: "今日功課", icon: "assets/nav-tasks.png" },
  events: { title: "每日活動", kicker: "廟會巡境", icon: "assets/nav-events.png" },
  codex: { title: "神明譜", kicker: "壇前典藏", icon: "assets/nav-codex.png" }
};

const ATTACK_TRAITS = {
  charm: "廣域群攻",
  mirror: "反射多體",
  bell: "群體緩速",
  single: "單體斬擊",
  seal: "定身鎮壓",
  pierce: "直線貫穿",
  cleave: "近戰橫掃",
  stun: "群體鎮止",
  mercy: "多體淨化",
  dash: "三路巡斬"
};

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dailyResetCopy() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const minutes = Math.max(0, Math.ceil((next - now) / 60000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}時${String(rest).padStart(2, "0")}分後更新`;
}

function missionSummary(items, group) {
  const completed = items.filter(item => (activityState.counters[item.counter] || 0) >= item.target).length;
  const claimed = items.filter(item => activityState.claimed[`${group}:${item.id}`]).length;
  const claimable = items.filter(item => (
    (activityState.counters[item.counter] || 0) >= item.target
    && !activityState.claimed[`${group}:${item.id}`]
  )).length;
  return { completed, claimed, claimable, percent: Math.round((completed / items.length) * 100) };
}

function dayDistance(fromKey, toKey) {
  if (!fromKey || !toKey) return Infinity;
  const from = new Date(`${fromKey}T00:00:00`);
  const to = new Date(`${toKey}T00:00:00`);
  return Math.round((to - from) / 86400000);
}

function freshDailyActivity() {
  return {
    date: localDateKey(),
    counters: {
      summons: 0,
      merges: 0,
      waves: 0,
      kills: 0,
      bosses: 0
    },
    claimed: {},
    lastCheckin: "",
    checkinDay: 0
  };
}

function loadActivityState() {
  const fallback = freshDailyActivity();
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem("incense-daily-activity") || "null");
  } catch {
    saved = null;
  }

  const loaded = {
    ...fallback,
    ...(saved || {}),
    counters: { ...fallback.counters, ...(saved?.counters || {}) },
    claimed: { ...(saved?.claimed || {}) }
  };

  if (loaded.date !== fallback.date) {
    loaded.date = fallback.date;
    loaded.counters = { ...fallback.counters };
    loaded.claimed = {};
  }
  return loaded;
}

function saveActivityState() {
  try {
    localStorage.setItem("incense-daily-activity", JSON.stringify(activityState));
  } catch {
    // Daily activities remain usable for the current session.
  }
}

function recordActivity(type, amount = 1) {
  const counterMap = {
    summon: "summons",
    merge: "merges",
    wave: "waves",
    kill: "kills",
    boss: "bosses"
  };
  const counter = counterMap[type];
  if (!counter) return;
  activityState.counters[counter] = Math.max(0, (activityState.counters[counter] || 0) + amount);
  saveActivityState();
  renderActivityHub();
  updateActivityAlerts();
}

function grantActivityReward(amount, label) {
  state.grain += amount;
  playGameSound("blessing");
  if (typeof updateHud === "function") updateHud();
  if (typeof log === "function") log(`${label}完成，獲得 ${amount} 香火。`);
}

function claimMission(group, id) {
  const source = group === "events" ? DAILY_EVENTS : DAILY_TASKS;
  const item = source.find(entry => entry.id === id);
  if (!item) return;
  const claimKey = `${group}:${id}`;
  const progress = activityState.counters[item.counter] || 0;
  if (progress < item.target || activityState.claimed[claimKey]) return;
  activityState.claimed[claimKey] = true;
  grantActivityReward(item.reward, item.title);
  saveActivityState();
  renderActivityHub();
  updateActivityAlerts();
}

function claimAllMissions(group) {
  const source = group === "events" ? DAILY_EVENTS : DAILY_TASKS;
  let reward = 0;
  let count = 0;

  source.forEach(item => {
    const claimKey = `${group}:${item.id}`;
    const progress = activityState.counters[item.counter] || 0;
    if (progress < item.target || activityState.claimed[claimKey]) return;
    activityState.claimed[claimKey] = true;
    reward += item.reward;
    count += 1;
  });

  if (count === 0) return;
  grantActivityReward(reward, group === "events" ? "巡境獎勵" : "每日功課");
  saveActivityState();
  renderActivityHub();
  updateActivityAlerts();
}

function nextCheckinDay() {
  const today = localDateKey();
  if (!activityState.lastCheckin) return 1;
  if (activityState.lastCheckin === today) return activityState.checkinDay || 1;
  return dayDistance(activityState.lastCheckin, today) === 1
    ? (activityState.checkinDay % 7) + 1
    : 1;
}

function claimDailyCheckin() {
  const today = localDateKey();
  if (activityState.lastCheckin === today) return;
  const day = nextCheckinDay();
  const reward = CHECKIN_REWARDS[day - 1];
  activityState.lastCheckin = today;
  activityState.checkinDay = day;
  grantActivityReward(reward, `第 ${day} 日簽到`);
  saveActivityState();
  renderActivityHub();
  updateActivityAlerts();
}

function missionCardHtml(item, group) {
  const progress = Math.min(item.target, activityState.counters[item.counter] || 0);
  const claimKey = `${group}:${item.id}`;
  const claimed = Boolean(activityState.claimed[claimKey]);
  const ready = progress >= item.target;
  const percent = Math.round((progress / item.target) * 100);
  const buttonLabel = claimed ? "已領取" : ready ? "領取" : "進行中";
  return `
    <article class="${group === "events" ? "activity-card" : "mission-row"} ${ready ? "ready" : ""} ${claimed ? "claimed" : ""}">
      <div class="${group === "events" ? "activity-card-head" : "mission-main"}">
        <div>
          <small class="mission-state">${claimed ? "功德已入帳" : ready ? "可以領取" : `進度 ${progress}/${item.target}`}</small>
          <strong>${item.title}</strong>
          <p>${item.copy}</p>
        </div>
        ${group === "tasks" ? `<span class="mission-count">${progress}/${item.target}</span>` : ""}
      </div>
      <div class="activity-progress" aria-label="${item.title}進度 ${progress}/${item.target}">
        <i style="--progress:${percent}%"></i>
      </div>
      <div class="reward-line">
        <span><i class="reward-flame" aria-hidden="true"></i>香火 ${item.reward}</span>
        <button class="claim-btn" type="button" data-claim-group="${group}" data-claim-id="${item.id}" ${!ready || claimed ? "disabled" : ""}>${buttonLabel}</button>
      </div>
    </article>
  `;
}

function renderEvents() {
  const summary = missionSummary(DAILY_EVENTS, "events");
  hubContentEl.innerHTML = `
    <section class="hub-banner">
      <small>${dailyResetCopy()}</small>
      <strong>廟會巡境</strong>
      <p>守住香火、降伏魔王，完成今日巡境。</p>
      <div class="hub-banner-progress">
        <span>巡境完成 ${summary.completed}/${DAILY_EVENTS.length}</span>
        <i><b style="--progress:${summary.percent}%"></b></i>
      </div>
    </section>
    <section class="hub-overview">
      <div><small>可領獎勵</small><strong>${summary.claimable}</strong></div>
      <div><small>已領功德</small><strong>${summary.claimed}</strong></div>
      <button class="claim-all-btn" type="button" data-claim-all="events" ${summary.claimable === 0 ? "disabled" : ""}>全部領取</button>
    </section>
    <section class="boss-route" aria-label="魔王波次">
      <span>魔王巡境</span>
      <div><i>4</i><strong>魈</strong></div>
      <div><i>8</i><strong>煞</strong></div>
      <div><i>12</i><strong>魔</strong></div>
    </section>
    ${DAILY_EVENTS.map(item => missionCardHtml(item, "events")).join("")}
  `;
}

function renderTasks() {
  const summary = missionSummary(DAILY_TASKS, "tasks");
  hubContentEl.innerHTML = `
    <section class="task-overview">
      <div class="task-ring" style="--task-progress:${summary.percent * 3.6}deg">
        <strong>${summary.completed}/${DAILY_TASKS.length}</strong>
        <small>完成</small>
      </div>
      <div>
        <small>${dailyResetCopy()}</small>
        <strong>今日功課</strong>
        <span>每項功課都會累積香火。</span>
      </div>
      <button class="claim-all-btn" type="button" data-claim-all="tasks" ${summary.claimable === 0 ? "disabled" : ""}>領取 ${summary.claimable}</button>
    </section>
    ${DAILY_TASKS.map(item => missionCardHtml(item, "tasks")).join("")}
  `;
}

function renderCheckin() {
  const today = localDateKey();
  const claimedToday = activityState.lastCheckin === today;
  const gap = dayDistance(activityState.lastCheckin, today);
  const streakActive = claimedToday || gap === 1;
  const cycleRestarting = !claimedToday && gap === 1 && activityState.checkinDay === 7;
  const claimedThrough = streakActive && !cycleRestarting ? activityState.checkinDay : 0;
  const currentDay = nextCheckinDay();
  const currentReward = CHECKIN_REWARDS[currentDay - 1];

  hubContentEl.innerHTML = `
    <section class="checkin-hero">
      <div class="checkin-seal" aria-hidden="true">${claimedToday ? "✓" : currentDay}</div>
      <div>
        <small>${claimedToday ? "今日功課已完成" : dailyResetCopy()}</small>
        <strong>第 ${currentDay} 日香火</strong>
        <span>${claimedToday ? "明日再回壇前參拜" : `今日可領 ${currentReward} 香火`}</span>
      </div>
    </section>
    <div class="checkin-grid">
      ${CHECKIN_REWARDS.map((reward, index) => {
        const day = index + 1;
        const claimed = claimedThrough > 0 && day <= claimedThrough;
        return `
          <div class="checkin-day ${day === 7 ? "day-seven" : ""} ${day === currentDay ? "current" : ""} ${claimed ? "claimed" : ""}">
            <div>
              <span>第 ${day} 日</span>
              <strong>香火 ${reward}</strong>
            </div>
            <i class="checkin-mark">${claimed ? "✓" : day}</i>
          </div>
        `;
      }).join("")}
    </div>
    <button class="checkin-claim-btn" type="button" data-checkin-claim ${claimedToday ? "disabled" : ""}>
      ${claimedToday ? "今日已簽到" : `領取第 ${currentDay} 日獎勵`}
    </button>
  `;
}

function renderCodex() {
  hubContentEl.innerHTML = `
    <section class="codex-summary">
      <span>壇前典藏</span>
      <strong>${Object.keys(BASE_UNITS).length} 件法器・${GOD_PAIRS.length} 尊神明・${Object.keys(ENEMY_TYPES).length} 類妖邪</strong>
    </section>
    <section class="codex-section">
      <div class="codex-section-title"><strong>五方法器</strong><span>皆可升至 5 級</span></div>
      <div class="artifact-codex-grid">
        ${Object.entries(BASE_UNITS).map(([char, def]) => `
          <article class="artifact-codex-entry" style="--codex-color:${def.color}">
            <b>${char}</b>
            <div><strong>${def.name}</strong><span>攻 ${def.damage}・距 ${def.range}</span></div>
            <small>${ATTACK_TRAITS[def.special] || "單體攻擊"}</small>
          </article>
        `).join("")}
      </div>
    </section>
    <section class="codex-section">
      <div class="codex-section-title"><strong>神明合字</strong><span>相鄰啟動・共用等級</span></div>
      <div class="deity-codex-list">
        ${GOD_PAIRS.map(pair => `
          <article class="deity-codex-entry" style="--pair-color:${pair.color}">
            <div class="deity-glyphs"><i>${pair.chars[0]}</i><i>${pair.chars[1]}</i></div>
            <div><strong>${pair.title}</strong><span>攻 ${pair.damage}・距 ${pair.range}・${ATTACK_TRAITS[pair.special]}</span></div>
          </article>
        `).join("")}
      </div>
    </section>
    <section class="codex-section">
      <div class="codex-section-title"><strong>妖邪錄</strong><span>魔王於指定波次壓陣</span></div>
      <div class="enemy-codex-grid">
        ${Object.entries(ENEMY_TYPES).map(([char, def]) => {
          const wave = Object.entries(BOSS_WAVES).find(([, type]) => type === char)?.[0];
          return `
            <article class="enemy-codex-entry ${def.boss ? "boss" : ""}" style="--enemy-codex-color:${def.color || "#5b3826"}">
              <b>${char}</b><strong>${def.name}</strong><span>血 ${def.hp}${wave ? `・第 ${wave} 波` : ""}</span>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderActivityHub() {
  if (!hubContentEl) return;
  const meta = HUB_META[currentHubTab] || HUB_META.events;
  hubTitleEl.textContent = meta.title;
  hubTitleEl.previousElementSibling.textContent = meta.kicker;
  hubSectionIconEl.src = meta.icon;
  if (currentHubTab === "tasks") renderTasks();
  else if (currentHubTab === "checkin") renderCheckin();
  else if (currentHubTab === "codex") renderCodex();
  else renderEvents();

  document.querySelectorAll(".hub-tabs [data-hub-tab]").forEach(button => {
    const active = button.dataset.hubTab === currentHubTab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });

  hubContentEl.querySelectorAll("[data-claim-group]").forEach(button => {
    button.addEventListener("click", () => claimMission(button.dataset.claimGroup, button.dataset.claimId));
  });
  hubContentEl.querySelector("[data-claim-all]")?.addEventListener("click", event => {
    claimAllMissions(event.currentTarget.dataset.claimAll);
  });
  hubContentEl.querySelector("[data-checkin-claim]")?.addEventListener("click", claimDailyCheckin);
}

function hasClaimable(items, group) {
  return items.some(item => (
    (activityState.counters[item.counter] || 0) >= item.target
    && !activityState.claimed[`${group}:${item.id}`]
  ));
}

function updateActivityAlerts() {
  const alertStates = {
    checkin: activityState.lastCheckin !== localDateKey(),
    tasks: hasClaimable(DAILY_TASKS, "tasks"),
    events: hasClaimable(DAILY_EVENTS, "events")
  };
  document.querySelectorAll("[data-alert]").forEach(dot => {
    dot.classList.toggle("visible", Boolean(alertStates[dot.dataset.alert]));
  });
  hubOpenBtn?.classList.toggle("has-alert", Object.values(alertStates).some(Boolean));
}

function openActivityHub(tab = currentHubTab) {
  currentHubTab = tab;
  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.toggle("active", item.dataset.hubTab === tab);
  });
  renderActivityHub();
  hubPanelEl.classList.add("open");
  hubBackdropEl.hidden = false;
  hubOpenBtn?.setAttribute("aria-expanded", "true");
}

function closeActivityHub() {
  hubPanelEl.classList.remove("open");
  hubBackdropEl.hidden = true;
  hubOpenBtn?.setAttribute("aria-expanded", "false");
  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.toggle("active", item.dataset.nav === "battle");
  });
}

document.querySelectorAll("[data-hub-tab]").forEach(button => {
  button.addEventListener("click", () => openActivityHub(button.dataset.hubTab));
});

document.querySelector("[data-nav='battle']")?.addEventListener("click", () => {
  document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.nav === "battle"));
  closeActivityHub();
});

hubOpenBtn?.addEventListener("click", () => openActivityHub(currentHubTab));
hubCloseBtn?.addEventListener("click", closeActivityHub);
hubBackdropEl?.addEventListener("click", closeActivityHub);
document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeActivityHub();
});

renderActivityHub();
updateActivityAlerts();
