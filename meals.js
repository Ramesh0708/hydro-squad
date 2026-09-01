const DEFAULT_MEALS = [
  { id: "breakfast", label: "Breakfast", hour: 8, minute: 15 },
  { id: "lunch", label: "Lunch", hour: 12, minute: 30 },
  { id: "snack", label: "Snack", hour: 17, minute: 0 },
  { id: "dinner", label: "Dinner", hour: 20, minute: 30 },
  { id: "midnight", label: "Midnight snack", hour: 0, minute: 0 }
];

const WEEKDAYS = [
  { id: 0, short: "Sun" },
  { id: 1, short: "Mon" },
  { id: 2, short: "Tue" },
  { id: 3, short: "Wed" },
  { id: 4, short: "Thu" },
  { id: 5, short: "Fri" },
  { id: 6, short: "Sat" }
];

const MEAL_LINES = {
  eat: {
    breakfast: "Breakfast. 8:15. Teams has the menu. Your stomach has a vacancy.",
    lunch: "Lunch. 12:30. Close the tab. Open a plate.",
    snack: "Snack. 5:00. This is the 5pm plot twist.",
    dinner: "Dinner. 8:30. The office day is over. You still have to eat it.",
    midnight: "Midnight snack. Dew will not judge. Dew will notice if you skip."
  },
  fast: {
    breakfast:
      "Breakfast bell — and today is a fasting day. If you’re observing, do not eat. If you’re not, the canteen is still real.",
    lunch:
      "Lunch bell — fasting day. Observers: skip. Everyone else: eat. Dew can hold two thoughts.",
    snack:
      "Snack time, but it’s a fasting day. If that’s you, Dew is the opposite of a peer-pressure snack.",
    dinner:
      "Dinner bell on a fasting day. Honor it if you’re fasting. Eat if you’re not.",
    midnight:
      "Midnight snack, fasting day. Observers stay closed. Non-fasters, Dew is not your priest."
  }
};

function localDayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function mealsList(state) {
  return Array.isArray(state.meals) && state.meals.length ? state.meals : DEFAULT_MEALS;
}

function atTime(hour, minute, date = new Date()) {
  const next = new Date(date);
  next.setHours(hour, minute, 0, 0);
  return next;
}

function nextOccurrence(meal, now = new Date()) {
  let stamp = atTime(meal.hour, meal.minute, now);
  if (stamp.getTime() <= now.getTime() + 5000) {
    stamp = atTime(meal.hour, meal.minute, new Date(now.getTime() + 86400000));
  }
  return stamp.getTime();
}

function isFastMode(mode) {
  return mode === "fast" || mode === "fast-and-festive";
}

function isFestiveMode(mode) {
  return mode === "festive" || mode === "fast-and-festive";
}

function occasionInfo(state, date = new Date()) {
  const key = localDayKey(date);
  if (state.fastingTodayKey === key) {
    return {
      fasting: true,
      festive: false,
      reason: state.fastingTodayLabel || "Office fasting day",
      greeting: "",
      faith: ""
    };
  }
  const named = (state.fastingDates || []).find((item) => item.date === key);
  if (named) {
    const mode = named.mode || "fast";
    return {
      fasting: isFastMode(mode),
      festive: isFestiveMode(mode),
      reason: named.label || "Observance",
      greeting: named.greeting || "",
      faith: named.faith || ""
    };
  }
  if ((state.fastingWeekdays || []).includes(date.getDay())) {
    return {
      fasting: true,
      festive: false,
      reason: "Weekly fast",
      greeting: "",
      faith: ""
    };
  }
  return { fasting: false, festive: false, reason: "", greeting: "", faith: "" };
}

function fastingInfo(state, date = new Date()) {
  return occasionInfo(state, date);
}

function resetEaten(state, key = localDayKey()) {
  if (state.lastMealDay === key && state.eatenToday) return state.eatenToday;
  return {};
}

function nextMeal(state, now = new Date()) {
  const list = mealsList(state);
  let best = null;
  for (const meal of list) {
    const at = nextOccurrence(meal, now);
    if (!best || at < best.at) best = { ...meal, at, inMs: at - now.getTime() };
  }
  return best;
}

function mealDue(state, now = new Date()) {
  if (state.mealsEnabled === false) return null;
  if (state.fastingHonoredDay === localDayKey(now)) return null;
  const eaten = resetEaten(state);
  const list = mealsList(state);
  for (const meal of list) {
    if (eaten[meal.id]) continue;
    const start = atTime(meal.hour, meal.minute, now).getTime();
    const end = start + 25 * 60 * 1000;
    const t = now.getTime();
    if (t >= start && t <= end) return { ...meal, at: start };
  }
  return null;
}

function mealMessage(meal, fastingOrInfo) {
  const info =
    typeof fastingOrInfo === "object" && fastingOrInfo
      ? fastingOrInfo
      : { fasting: !!fastingOrInfo, festive: false, greeting: "" };
  const base = (info.fasting ? MEAL_LINES.fast : MEAL_LINES.eat)[meal.id] || `${meal.label} is now.`;
  if (info.greeting) return `${info.greeting} ${base}`;
  return base;
}

function formatClock(hour, minute) {
  const d = atTime(hour, minute);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatMealWait(ms) {
  if (ms <= 0) return "now";
  const m = Math.ceil(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
