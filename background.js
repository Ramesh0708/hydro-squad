importScripts("i18n.js", "meals.js", "schedule.js");

const DEFAULTS = {
  onboarded: false,
  intervalMin: 45,
  personality: "roast",
  locale: "en",
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

const NUDGE_STORE = chrome.storage.session || chrome.storage.local;

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rankFor(sips, locale = "en") {
  let rank = i18nPack(locale).ranks[0];
  for (const title of i18nPack(locale).ranks) {
    if (sips >= title.min) rank = title;
  }
  return rank.name;
}

function iconUrl() {
  return chrome.runtime.getURL("icons/icon128.png");
}

function nudgePageUrl() {
  return chrome.runtime.getURL("overlay/nudge.html");
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

async function scheduleSipAlarm(state) {
  await chrome.alarms.clear("hydro-check");
  if (state.onboarded === false) return;
  const delayInMinutes = sipAlarmDelayMin(state);
  chrome.alarms.create("hydro-check", { delayInMinutes });
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
  const next = await setState({ eatenToday: eaten, lastMealDay: key });
  await closeNudgeWindow();
  return next;
}

async function honorFast() {
  const next = await setState({ fastingHonoredDay: localDayKey() });
  await closeNudgeWindow();
  return next;
}

async function snooze(minutes = 10) {
  const state = await setState({
    snoozeUntil: Date.now() + minutes * 60 * 1000
  });
  await refreshBadge(state);
  await chrome.alarms.clear("dew-followup");
  await scheduleSipAlarm(state);
  await closeNudgeWindow();
  return state;
}

async function createNotice(id, options) {
  try {
    await chrome.notifications.create(id, options);
  } catch {
    const fallback = { ...options };
    delete fallback.buttons;
    delete fallback.silent;
    try {
      await chrome.notifications.create(id, fallback);
    } catch (err) {
      console.warn("Dew notify failed", err);
    }
  }
}

async function notifyMeal(state, meal) {
  const pack = i18nPack(state.locale);
  const day = occasionInfo(state);
  const title = `Dew · ${day.reason || mealLabel(meal.id, state.locale)}`;
  await createNotice(`meal-${meal.id}`, {
    type: "basic",
    iconUrl: iconUrl(),
    title,
    message: mealMessage(meal, day, state.locale).slice(0, 240),
    priority: 2,
    requireInteraction: true,
    silent: false,
    buttons: day.fasting
      ? [{ title: pack.ui.honor }, { title: pack.ui.ate }]
      : [{ title: pack.ui.ate }, { title: pack.ui.snooze }]
  });
}

async function refreshBadge(state) {
  if (!thirsty(state)) {
    await chrome.action.setBadgeText({ text: "" });
    await chrome.action.setTitle({ title: i18nPack(state.locale).badgeOk });
    return;
  }
  await chrome.action.setBadgeBackgroundColor({ color: "#ee7b2a" });
  await chrome.action.setBadgeText({ text: i18nPack(state.locale).badgeSip });
  await chrome.action.setTitle({ title: i18nPack(state.locale).badgeThirsty });
}

async function notify(state) {
  const pack = i18nPack(state.locale);
  const pool = pack.notify[state.personality] || pack.notify.roast;
  await createNotice("hydro-sip", {
    type: "basic",
    iconUrl: iconUrl(),
    title: pack.notifySip,
    message: pick(pool),
    priority: 2,
    requireInteraction: true,
    silent: false,
    buttons: [{ title: pack.ui.sip }, { title: pack.ui.snooze }]
  });
}

async function pingOverlays() {
  await chrome.storage.local.set({ duePing: Date.now() });
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({});
  } catch {
    return;
  }
  await Promise.all(
    tabs.map((tab) =>
      tab.id
        ? chrome.tabs.sendMessage(tab.id, { type: "hydro-nudge" }).catch(() => {})
        : Promise.resolve()
    )
  );
}

async function openNudgeWindow() {
  try {
    const { nudgeWindowId } = await NUDGE_STORE.get("nudgeWindowId");
    if (nudgeWindowId) {
      try {
        try {
          await chrome.windows.update(nudgeWindowId, { focused: true, drawAttention: true });
        } catch {
          await chrome.windows.update(nudgeWindowId, { focused: true });
        }
        const tabs = await chrome.tabs.query({ windowId: nudgeWindowId });
        if (tabs[0]?.id) await chrome.tabs.reload(tabs[0].id);
        return;
      } catch {
        await NUDGE_STORE.remove("nudgeWindowId");
      }
    }
    const win = await chrome.windows.create({
      url: nudgePageUrl(),
      type: "popup",
      focused: true,
      width: 380,
      height: 540
    });
    if (win?.id) await NUDGE_STORE.set({ nudgeWindowId: win.id });
  } catch (err) {
    console.warn("Dew nudge window failed", err);
  }
}

async function closeNudgeWindow() {
  try {
    const { nudgeWindowId } = await NUDGE_STORE.get("nudgeWindowId");
    if (nudgeWindowId) {
      await chrome.windows.remove(nudgeWindowId).catch(() => {});
      await NUDGE_STORE.remove("nudgeWindowId");
    }
  } catch {
    /* ignore */
  }
}

async function nagFor(state, { sip = false, meal = null } = {}) {
  if (sip) await notify(state);
  if (meal) await notifyMeal(state, meal);
  await pingOverlays();
  await openNudgeWindow();
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
  await chrome.alarms.clear("dew-followup");
  await scheduleSipAlarm(next);
  await chrome.notifications.clear("hydro-sip");
  await closeNudgeWindow();
  return next;
}

async function boot() {
  const merged = await applyOfficeFasts();
  await scheduleMeals(merged);
  await refreshBadge(merged);
  if (merged.onboarded && thirsty(merged) && merged.lastSip) {
    await nagFor(merged, { sip: true, meal: mealDue(merged) });
    chrome.alarms.create("dew-followup", { delayInMinutes: nagRepeatMin(merged) });
    return;
  }
  await scheduleSipAlarm(merged);
}

chrome.runtime.onInstalled.addListener(() => {
  void boot();
});

chrome.runtime.onStartup.addListener(() => {
  void boot();
});

chrome.windows.onRemoved.addListener((id) => {
  void NUDGE_STORE.get("nudgeWindowId").then(({ nudgeWindowId }) => {
    if (nudgeWindowId === id) return NUDGE_STORE.remove("nudgeWindowId");
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  return handleAlarm(alarm);
});

async function handleAlarm(alarm) {
  const state = await getState();
  if (alarm.name === "hydro-check" || alarm.name === "dew-followup") {
    await refreshBadge(state);
    const dueMeal = state.onboarded && state.mealsEnabled !== false ? mealDue(state) : null;
    const sipDue = state.onboarded && thirsty(state);
    if (sipDue || dueMeal) {
      await nagFor(state, { sip: sipDue, meal: dueMeal });
      chrome.alarms.create("dew-followup", { delayInMinutes: nagRepeatMin(state) });
      if (sipDue) return;
    }
    if (alarm.name === "hydro-check") await scheduleSipAlarm(state);
    return;
  }
  if (alarm.name.startsWith("meal-") && state.onboarded && state.mealsEnabled !== false) {
    const mealId = alarm.name.slice(5);
    const meal = mealsList(state).find((item) => item.id === mealId);
    if (meal && state.fastingHonoredDay !== localDayKey() && !resetEaten(state)[meal.id]) {
      await nagFor(state, { sip: thirsty(state), meal });
      chrome.alarms.create("dew-followup", { delayInMinutes: nagRepeatMin(state) });
    }
    if (meal) chrome.alarms.create(alarm.name, { when: nextOccurrence(meal) });
  }
}

chrome.notifications.onClicked.addListener((id) => {
  void handleNotificationClick(id, null);
});

chrome.notifications.onButtonClicked.addListener((id, index) => {
  void handleNotificationClick(id, index);
});

async function handleNotificationClick(id, buttonIndex) {
  if (id === "hydro-sip") {
    if (buttonIndex === 1) await snooze(10);
    else await sip();
    await chrome.notifications.clear(id);
    return;
  }
  if (id.startsWith("meal-")) {
    const state = await getState();
    const fast = fastingInfo(state);
    if (buttonIndex === 1 && !fast.fasting) {
      await snooze(10);
    } else if (fast.fasting && state.iObserveFasts && buttonIndex !== 1) {
      await honorFast();
    } else {
      await eatMeal(id.slice(5));
    }
    await chrome.notifications.clear(id);
  }
}

function publicState(state, extra = {}) {
  const day = occasionInfo(state);
  const due = mealDue(state);
  const upcoming = nextMeal(state);
  return {
    ...state,
    thirsty: thirsty(state),
    overdueRatio: overdueRatio(state),
    rank: rankFor(state.sipsToday, state.locale),
    fasting: day.fasting,
    festive: day.festive,
    fastingReason: day.reason,
    greeting: day.greeting,
    faith: day.faith,
    mealDue: due,
    nextMeal: upcoming
      ? {
          ...upcoming,
          clock: formatClock(upcoming.hour, upcoming.minute, state.locale),
          wait: formatMealWait(upcoming.inMs, state.locale)
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
      sendResponse(publicState(await snooze(Number(message.minutes) || 10)));
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
    if (message.type === "nudge-closed") {
      await NUDGE_STORE.remove("nudgeWindowId");
      sendResponse({ ok: true });
      return;
    }
    if (message.type === "save-settings") {
      const patch = {};
      if (message.intervalMin) patch.intervalMin = Number(message.intervalMin);
      if (message.personality) patch.personality = message.personality;
      if (message.locale && I18N[message.locale]) patch.locale = message.locale;
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
        const current = await getState();
        const locale = patch.locale || current.locale || "en";
        patch.fastingTodayKey = localDayKey();
        patch.fastingTodayLabel = (message.fastingTodayLabel || t(locale, "defaultFast")).slice(0, 40);
      }
      if (message.fastingToday === false) {
        patch.fastingTodayKey = "";
        patch.fastingTodayLabel = "";
        patch.fastingHonoredDay = "";
      }
      const state = await setState(patch);
      await scheduleSipAlarm(state);
      await scheduleMeals(state);
      await refreshBadge(state);
      sendResponse(publicState(state));
    }
  })();
  return true;
});
