const hubPanelEl = document.getElementById("activity-panel");
const hubContentEl = document.getElementById("hub-content");
const hubTitleEl = document.getElementById("hub-title");
const hubOpenBtn = document.getElementById("hub-btn");
const hubCloseBtn = document.getElementById("hub-close-btn");
const hubBackdropEl = document.getElementById("hub-backdrop");

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

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
    <article class="${group === "events" ? "activity-card" : "mission-row"}">
      <div class="${group === "events" ? "activity-card-head" : "mission-main"}">
        <div>
          <strong>${item.title}</strong>
          <p>${item.copy}</p>
        </div>
        ${group === "tasks" ? `<span class="mission-count">${progress}/${item.target}</span>` : ""}
      </div>
      <div class="activity-progress" aria-label="${item.title}進度 ${progress}/${item.target}">
        <i style="--progress:${percent}%"></i>
      </div>
      <div class="reward-line">
        <span>香火 ${item.reward}</span>
        <button class="claim-btn" type="button" data-claim-group="${group}" data-claim-id="${item.id}" ${!ready || claimed ? "disabled" : ""}>${buttonLabel}</button>
      </div>
    </article>
  `;
}

function renderEvents() {
  hubTitleEl.textContent = "每日活動";
  hubContentEl.innerHTML = `
    <section class="hub-banner">
      <small>每日 00:00 更新</small>
      <strong>廟會巡境</strong>
      <p>守住香火、降伏魔王，完成今日巡境。</p>
    </section>
    ${DAILY_EVENTS.map(item => missionCardHtml(item, "events")).join("")}
  `;
}

function renderTasks() {
  hubTitleEl.textContent = "每日任務";
  const completed = DAILY_TASKS.filter(item => (
    (activityState.counters[item.counter] || 0) >= item.target
    && activityState.claimed[`tasks:${item.id}`]
  )).length;
  hubContentEl.innerHTML = `
    <div class="checkin-summary">今日完成 ${completed}/${DAILY_TASKS.length}</div>
    ${DAILY_TASKS.map(item => missionCardHtml(item, "tasks")).join("")}
  `;
}

function renderCheckin() {
  hubTitleEl.textContent = "每日簽到";
  const today = localDateKey();
  const claimedToday = activityState.lastCheckin === today;
  const gap = dayDistance(activityState.lastCheckin, today);
  const streakActive = claimedToday || gap === 1;
  const cycleRestarting = !claimedToday && gap === 1 && activityState.checkinDay === 7;
  const claimedThrough = streakActive && !cycleRestarting ? activityState.checkinDay : 0;
  const currentDay = nextCheckinDay();

  hubContentEl.innerHTML = `
    <div class="checkin-summary">連續簽到可提高每日香火，第 7 日獎勵最多。</div>
    <div class="checkin-grid">
      ${CHECKIN_REWARDS.map((reward, index) => {
        const day = index + 1;
        const claimed = claimedThrough > 0 && day <= claimedThrough;
        return `
          <div class="checkin-day ${day === currentDay ? "current" : ""} ${claimed ? "claimed" : ""}">
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
  hubTitleEl.textContent = "神明譜";
  hubContentEl.innerHTML = `
    <div class="codex-list">
      <div class="codex-entry">
        <strong>法器</strong>
        <span>符、鏡、鈴、劍、印皆可升到 5 級。</span>
      </div>
      ${GOD_PAIRS.map(pair => `
        <div class="codex-entry" style="--pair-color:${pair.color}">
          <strong>${pair.chars.join("")}</strong>
          <span>${pair.title}：兩字相鄰後啟動，共用等級。</span>
        </div>
      `).join("")}
      <div class="codex-entry">
        <strong>魔王</strong>
        <span>第 4、8、12 波分別由魈、煞、魔壓陣。</span>
      </div>
    </div>
  `;
}

function renderActivityHub() {
  if (!hubContentEl) return;
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
