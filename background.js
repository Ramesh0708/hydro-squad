importScripts("meals.js");

const DEFAULTS = {
  onboarded: false,
  intervalMin: 45,
  personality: "roast",
  overlayEnabled: true,
  lastSip: 0,
  snoozeUntil: 0,
  sipsToday: 0,
  lastSipDay: "",
  streak: 0,
  bestStreak: 0,
  goal: 8,
  displayName: "friend",
  mealsEnabled: true,
  meals: DEFAULT_MEALS,
  eatenToday: {},
  lastMealDay: "",
  fastingWeekdays: [],
  fastingDates: [],
  fastingTodayKey: "",
  fastingTodayLabel: "",
  fastingHonoredDay: "",
  iObserveFasts: false
};

const LINES = {
  roast: [
    "A cactus just texted. It feels seen.",
    "Your blood called. It wants a raise and a glass of water.",
    "This is not a reminder. This is an intervention.",
    "You have time to open 14 tabs. You have time to sip.",
    "Dew is writing a tell-all. Chapter 1: The Drought Years."
  ],
  gentle: [
    "Hey. Tiny sip. Future-you will high-five you.",
    "Water break. Your brain is doing a lot.",
    "Dew brought you a pause. Drink a little.",
    "Soft reminder: you are allowed to take care of yourself.",
    "One glass. Then back to being brilliant."
  ],
  chaos: [
    "CODE RED. THE OCEAN IS FILING A MISSING-PERSON REPORT.",
    "HYDRATION POLICE. HANDS WHERE DEW CAN SEE THEM.",
    "This tab is now a fountain. Mentally. Sip.",
    "Breaking news: local human forgets they are 60% water.",
    "Dew has entered the chat. Dew will not leave until you sip."
  ]
};

const TITLES = [
  { min: 0, name: "Puddle" },
  { min: 3, name: "Stream" },
  { min: 8, name: "River" },
  { min: 16, name: "Lake" },
  { min: 30, name: "Ocean" },
  { min: 50, name: "Hydrolegend" }
];

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rankFor(sips) {
  let rank = TITLES[0];
  for (const title of TITLES) {
    if (sips >= title.min) rank = title;
  }
  return rank.name;
}

async function getState() {
  const stored = await chrome.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...stored };
}

async function setState(patch) {
  await chrome.storage.local.set(patch);
  return getState();
}

function unionFastDates(stored, packed) {
  const map = new Map();
  for (const item of packed || []) {
    if (item?.date) map.set(item.date, { ...item });
  }
  for (const item of stored || []) {
    if (!item?.date) continue;
    const prev = map.get(item.date) || {};
    map.set(item.date, {
      ...prev,
      ...item,
      mode: item.mode || prev.mode,
      greeting: item.greeting || prev.greeting,
      faith: item.faith || prev.faith
    });
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

async function applyOfficeFasts() {
  const pack = await loadOfficeFasts();
  const state = await getState();
  return setState({
    fastingWeekdays: state.fastingWeekdays?.length ? state.fastingWeekdays : pack.weekdays || [],
    fastingDates: unionFastDates(state.fastingDates, pack.dates)
  });
}

async function loadOfficeFasts() {
  try {
    const res = await fetch(chrome.runtime.getURL("office-fasts.json"));
    return await res.json();
  } catch {
    return { weekdays: [], dates: [] };
  }
}

async function scheduleAlarm(intervalMin) {
  await chrome.alarms.clear("hydro-check");
  chrome.alarms.create("hydro-check", {
    periodInMinutes: Math.max(1, Number(intervalMin) || 45)
  });
}

async function scheduleMeals(state) {
  const all = await chrome.alarms.getAll();
  await Promise.all(
    all.filter((alarm) => alarm.name.startsWith("meal-")).map((alarm) => chrome.alarms.clear(alarm.name))
  );
  if (state.mealsEnabled === false) return;
  for (const meal of mealsList(state)) {
    chrome.alarms.create(`meal-${meal.id}`, { when: nextOccurrence(meal) });
  }
}

async function eatMeal(mealId) {
  const state = await getState();
  const key = localDayKey();
  const eaten = { ...resetEaten(state, key), [mealId]: true };
  return setState({ eatenToday: eaten, lastMealDay: key });
}

async function honorFast() {
  return setState({ fastingHonoredDay: localDayKey() });
}

async function notifyMeal(state, meal) {
  const day = occasionInfo(state);
  const title = day.festive
    ? `Dew · ${day.reason}`
    : day.fasting
      ? `Dew · ${day.reason}`
      : `Dew · ${meal.label}`;
  await chrome.notifications.create(`meal-${meal.id}`, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title,
    message: mealMessage(meal, day).slice(0, 240),
    priority: 2
  });
}

function overdueRatio(state, now = Date.now()) {
  const span = Math.max(1, state.intervalMin) * 60 * 1000;
  if (!state.lastSip) return 2;
  return (now - state.lastSip) / span;
}

function thirsty(state, now = Date.now()) {
  if (state.snoozeUntil && now < state.snoozeUntil) return false;
  if (!state.lastSip) return true;
  return now - state.lastSip >= state.intervalMin * 60 * 1000;
}

async function refreshBadge(state) {
  if (!thirsty(state)) {
    await chrome.action.setBadgeText({ text: "" });
    await chrome.action.setTitle({ title: "Hydro Squad — Dew is thriving" });
    return;
  }
  await chrome.action.setBadgeBackgroundColor({ color: "#1aa7b8" });
  await chrome.action.setBadgeText({ text: "sip" });
  await chrome.action.setTitle({ title: "Dew is dramatic. Sip water." });
}

async function notify(state) {
  const pool = LINES[state.personality] || LINES.roast;
  await chrome.notifications.create("hydro-sip", {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "Dew needs you",
    message: pick(pool),
    priority: 1
  });
}

async function sip() {
  const state = await getState();
  const now = Date.now();
  const day = todayKey();
  let sipsToday = state.sipsToday;
  let streak = state.streak;

  if (state.lastSipDay !== day) {
    const yesterday = todayKey(new Date(now - 86400000));
    streak = state.lastSipDay === yesterday ? streak + 1 : 1;
    sipsToday = 0;
  }

  sipsToday += 1;
  const next = await setState({
    lastSip: now,
    lastSipDay: day,
    sipsToday,
    streak,
    bestStreak: Math.max(state.bestStreak || 0, streak),
    snoozeUntil: 0
  });
  await refreshBadge(next);
  return next;
}

chrome.runtime.onInstalled.addListener(async () => {
  const merged = await applyOfficeFasts();
  await scheduleAlarm(merged.intervalMin);
  await scheduleMeals(merged);
  await refreshBadge(merged);
});

chrome.runtime.onStartup.addListener(async () => {
  const merged = await applyOfficeFasts();
  await scheduleAlarm(merged.intervalMin);
  await scheduleMeals(merged);
  await refreshBadge(merged);
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  const state = await getState();
  if (alarm.name === "hydro-check") {
    await refreshBadge(state);
    if (state.onboarded && thirsty(state)) await notify(state);
    return;
  }
  if (alarm.name.startsWith("meal-") && state.onboarded && state.mealsEnabled !== false) {
    const mealId = alarm.name.slice(5);
    const meal = mealsList(state).find((item) => item.id === mealId);
    if (meal && state.fastingHonoredDay !== localDayKey() && !resetEaten(state)[meal.id]) {
      await notifyMeal(state, meal);
    }
    if (meal) chrome.alarms.create(alarm.name, { when: nextOccurrence(meal) });
  }
});

chrome.notifications.onClicked.addListener(async (id) => {
  if (id === "hydro-sip") {
    await sip();
    await chrome.notifications.clear(id);
    return;
  }
  if (id.startsWith("meal-")) {
    const state = await getState();
    const fast = fastingInfo(state);
    if (fast.fasting && state.iObserveFasts) await honorFast();
    else await eatMeal(id.slice(5));
    await chrome.notifications.clear(id);
  }
});

function publicState(state, extra = {}) {
  const day = occasionInfo(state);
  const due = mealDue(state);
  const upcoming = nextMeal(state);
  return {
    ...state,
    thirsty: thirsty(state),
    overdueRatio: overdueRatio(state),
    rank: rankFor(state.sipsToday),
    fasting: day.fasting,
    festive: day.festive,
    fastingReason: day.reason,
    greeting: day.greeting,
    faith: day.faith,
    mealDue: due,
    nextMeal: upcoming
      ? {
          ...upcoming,
          clock: formatClock(upcoming.hour, upcoming.minute),
          wait: formatMealWait(upcoming.inMs)
        }
      : null,
    ...extra
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message.type === "get-state") {
      sendResponse(publicState(await getState()));
      return;
    }
    if (message.type === "sip") {
      sendResponse(publicState(await sip(), { thirsty: false, overdueRatio: 0 }));
      return;
    }
    if (message.type === "snooze") {
      const minutes = Number(message.minutes) || 10;
      const state = await setState({
        snoozeUntil: Date.now() + minutes * 60 * 1000
      });
      await refreshBadge(state);
      sendResponse(publicState(state));
      return;
    }
    if (message.type === "eat-meal") {
      sendResponse(publicState(await eatMeal(message.mealId)));
      return;
    }
    if (message.type === "honor-fast") {
      sendResponse(publicState(await honorFast()));
      return;
    }
    if (message.type === "save-settings") {
      const patch = {};
      if (message.intervalMin) patch.intervalMin = Number(message.intervalMin);
      if (message.personality) patch.personality = message.personality;
      if (typeof message.overlayEnabled === "boolean") {
        patch.overlayEnabled = message.overlayEnabled;
      }
      if (typeof message.displayName === "string") {
        patch.displayName = message.displayName.slice(0, 18);
      }
      if (message.onboarded) patch.onboarded = true;
      if (typeof message.mealsEnabled === "boolean") patch.mealsEnabled = message.mealsEnabled;
      if (typeof message.iObserveFasts === "boolean") patch.iObserveFasts = message.iObserveFasts;
      if (Array.isArray(message.fastingWeekdays)) patch.fastingWeekdays = message.fastingWeekdays;
      if (Array.isArray(message.fastingDates)) patch.fastingDates = message.fastingDates;
      if (Array.isArray(message.meals)) patch.meals = message.meals;
      if (message.fastingToday === true) {
        patch.fastingTodayKey = localDayKey();
        patch.fastingTodayLabel = (message.fastingTodayLabel || "Office fasting day").slice(0, 40);
      }
      if (message.fastingToday === false) {
        patch.fastingTodayKey = "";
        patch.fastingTodayLabel = "";
        patch.fastingHonoredDay = "";
      }
      const state = await setState(patch);
      if (patch.intervalMin) await scheduleAlarm(patch.intervalMin);
      await scheduleMeals(state);
      await refreshBadge(state);
      sendResponse(publicState(state));
    }
  })();
  return true;
});
