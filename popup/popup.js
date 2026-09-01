const state = {
  intervalMin: 45,
  personality: "roast",
  overlayEnabled: true,
  displayName: "",
  mood: "ok"
};

let cycleTimer = 0;
let pokeLock = false;
let introTimer = 0;

function $(id) {
  return document.getElementById(id);
}

function show(id) {
  document.querySelectorAll(".screen").forEach((el) => el.classList.add("hidden"));
  $(id).classList.remove("hidden");
}

function send(type, extra = {}) {
  return chrome.runtime.sendMessage({ type, ...extra });
}

function markPills(rootId, attr, value) {
  document.querySelectorAll(`#${rootId} button`).forEach((btn) => {
    btn.classList.toggle("on", btn.dataset[attr] === String(value));
  });
}

function bindPills(rootId, attr, onPick) {
  document.querySelectorAll(`#${rootId} button`).forEach((btn) => {
    btn.addEventListener("click", () => onPick(btn.dataset[attr]));
  });
}

function formatWait(data) {
  if (data.snoozeUntil && Date.now() < data.snoozeUntil) {
    const m = Math.ceil((data.snoozeUntil - Date.now()) / 60000);
    return `${m}m nap`;
  }
  if (!data.lastSip) return "now";
  const due = data.lastSip + data.intervalMin * 60 * 1000;
  const left = due - Date.now();
  if (left <= 0) return "now";
  const m = Math.ceil(left / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

function dropSound() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(880, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.18);
  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.24);
}

function setMood(el, mood) {
  el.dataset.mood = mood;
  state.mood = mood;
  const tag = $("mood-tag");
  if (tag) tag.textContent = mood;
}

function hydrateDews() {
  document.querySelectorAll(".dew").forEach((el) => {
    if (!el.querySelector(".dew-body")) el.innerHTML = dewMarkup();
  });
}

function idleCycle(data) {
  clearInterval(cycleTimer);
  const base = homeMood(data);
  const fidgets = {
    ok: ["ok", "wink", "sideeye"],
    smug: ["smug", "wink", "happy"],
    love: ["love", "wink", "happy"],
    thirsty: ["thirsty", "judging", "sideeye"],
    dramatic: ["dramatic", "thirsty", "dizzy"],
    feral: ["feral", "dramatic", "dizzy"],
    judging: ["judging", "sideeye", "thirsty"],
    sleepy: ["sleepy", "ok"],
    fasting: ["fasting", "wink", "ok"],
    hungry: ["hungry", "judging", "dramatic"],
    festive: ["festive", "love", "wink"]
  };
  const pool = fidgets[base] || [base];
  cycleTimer = setInterval(() => {
    if (pokeLock) return;
    const next = pick(pool);
    setMood($("dew"), next);
    $("status").textContent = lineFor(next, data.personality);
  }, 4200);
}

function render(data, justSipped = false) {
  Object.assign(state, data);
  hydrateDews();
  $("hello").textContent = data.displayName ? `Hey, ${data.displayName}.` : "Hey, legend.";
  $("rank").textContent = data.rank || "Puddle";
  $("streak").textContent = data.streak || 0;
  $("next").textContent = formatWait(data);
  $("meter-copy").textContent = `${data.sipsToday || 0} / ${data.goal || 8} sips today`;
  $("fill").style.width = `${Math.min(100, ((data.sipsToday || 0) / (data.goal || 8)) * 100)}%`;
  $("overlay").checked = data.overlayEnabled !== false;
  $("meals-on").checked = data.mealsEnabled !== false;
  $("observe").checked = !!data.iObserveFasts;
  $("fast-today").checked = data.fastingTodayKey === localDayKey();
  $("fast-label").value = data.fastingTodayLabel || "";

  const banner = $("fast-banner");
  const special = !!(data.fasting || data.festive);
  banner.classList.toggle("hidden", !special);
  banner.classList.toggle("festive", !!data.festive && !data.fasting);
  $("day-title").textContent = data.festive && data.fasting
    ? "Festival + fasting"
    : data.festive
      ? "Festival"
      : "Fasting day";
  $("fast-reason").textContent = data.greeting
    ? `${data.greeting}${data.faith ? ` · ${data.faith}` : ""}`
    : data.fasting
      ? `${data.fastingReason}. If you’re observing, do not eat. If you’re not, eat as usual.`
      : "";

  const due = data.mealDue;
  const upcoming = data.nextMeal;
  $("meal-label").textContent = due
    ? data.fasting
      ? `${due.label} · fasting caution`
      : `${due.label} · now`
    : "Next plate";
  $("meal-when").textContent = due
    ? data.fasting
      ? "Skip if you’re fasting"
      : "Go eat"
    : upcoming
      ? `${upcoming.label} · ${upcoming.clock} · ${upcoming.wait}`
      : "Office meals off";
  $("honor").classList.toggle("hidden", !data.fasting);

  drawMealTimes(data);
  drawWeekdays(data);
  drawFastDates(data);

  const dew = $("dew");
  const mood = homeMood(data, justSipped);
  setMood(dew, mood);
  $("status").textContent = data.greeting || (data.fasting && !due
    ? lineFor("fasting", data.personality)
    : lineFor(mood, data.personality));
  idleCycle(data);

  markPills("set-intervals", "interval", data.intervalMin);
  markPills("set-personalities", "personality", data.personality);
}

function playIntro() {
  const dew = document.querySelector("#onboard .dew");
  const beats = ["wave", "wink", "judging", "happy", "ok"];
  let i = 0;
  clearInterval(introTimer);
  introTimer = setInterval(() => {
    i = (i + 1) % beats.length;
    dew.dataset.mood = beats[i];
  }, 1600);
}

async function load() {
  hydrateDews();
  const data = await send("get-state");
  if (!data.onboarded) {
    show("onboard");
    playIntro();
    return;
  }
  clearInterval(introTimer);
  show("home");
  render(data);
}

bindPills("intervals", "interval", (value) => {
  state.intervalMin = Number(value);
  markPills("intervals", "interval", value);
});

bindPills("personalities", "personality", (value) => {
  state.personality = value;
  markPills("personalities", "personality", value);
});

bindPills("set-intervals", "interval", async (value) => {
  render(await send("save-settings", { intervalMin: Number(value) }));
});

bindPills("set-personalities", "personality", async (value) => {
  render(await send("save-settings", { personality: value }));
});

$("start").addEventListener("click", async () => {
  clearInterval(introTimer);
  const data = await send("save-settings", {
    onboarded: true,
    intervalMin: state.intervalMin,
    personality: state.personality,
    displayName: $("name").value.trim()
  });
  show("home");
  render(data);
});

$("sip").addEventListener("click", async () => {
  dropSound();
  pokeLock = true;
  render(await send("sip"), true);
  setTimeout(() => {
    pokeLock = false;
  }, 1800);
});

$("snooze").addEventListener("click", async () => {
  render(await send("snooze", { minutes: 10 }));
});

$("dew").addEventListener("click", () => {
  if (pokeLock) return;
  pokeLock = true;
  const mood = pick(POKES);
  setMood($("dew"), mood);
  $("status").textContent = lineFor(mood, state.personality);
  setTimeout(() => {
    pokeLock = false;
    setMood($("dew"), homeMood(state));
  }, 1400);
});

$("settings-btn").addEventListener("click", () => show("settings"));
$("back").addEventListener("click", () => {
  show("home");
  load();
});

$("overlay").addEventListener("change", async (event) => {
  render(await send("save-settings", { overlayEnabled: event.target.checked }));
});

$("meals-on").addEventListener("change", async (event) => {
  render(await send("save-settings", { mealsEnabled: event.target.checked }));
});

$("observe").addEventListener("change", async (event) => {
  render(await send("save-settings", { iObserveFasts: event.target.checked }));
});

$("fast-today").addEventListener("change", async (event) => {
  render(
    await send("save-settings", {
      fastingToday: event.target.checked,
      fastingTodayLabel: $("fast-label").value.trim()
    })
  );
});

$("ate").addEventListener("click", async () => {
  const mealId = state.mealDue?.id || state.nextMeal?.id;
  if (!mealId) return;
  render(await send("eat-meal", { mealId }));
});

$("honor").addEventListener("click", async () => {
  render(await send("honor-fast"));
});

$("add-fast").addEventListener("click", async () => {
  const date = $("fast-date").value;
  const label = $("fast-date-label").value.trim() || "Fasting day";
  if (!date) return;
  const fastingDates = [...(state.fastingDates || []).filter((item) => item.date !== date), { date, label }];
  $("fast-date").value = "";
  $("fast-date-label").value = "";
  render(await send("save-settings", { fastingDates }));
});

function timeValue(meal) {
  return `${String(meal.hour).padStart(2, "0")}:${String(meal.minute).padStart(2, "0")}`;
}

function drawMealTimes(data) {
  const root = $("meal-times");
  root.innerHTML = mealsList(data)
    .map(
      (meal) => `
      <label>${meal.label}
        <input type="time" data-meal="${meal.id}" value="${timeValue(meal)}" />
      </label>`
    )
    .join("");
  root.querySelectorAll("input").forEach((input) => {
    input.addEventListener("change", async () => {
      const meals = mealsList(state).map((meal) => {
        const field = document.querySelector(`[data-meal="${meal.id}"]`);
        const [hour, minute] = field.value.split(":").map(Number);
        return { ...meal, hour, minute };
      });
      render(await send("save-settings", { meals }));
    });
  });
}

function drawWeekdays(data) {
  const selected = data.fastingWeekdays || [];
  const root = $("weekdays");
  root.innerHTML = WEEKDAYS.map(
    (day) =>
      `<button type="button" data-day="${day.id}" class="${selected.includes(day.id) ? "on" : ""}">${day.short}</button>`
  ).join("");
  root.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.dataset.day);
      const next = new Set(state.fastingWeekdays || []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      render(await send("save-settings", { fastingWeekdays: [...next] }));
    });
  });
}

function drawFastDates(data) {
  const root = $("fast-list");
  const dates = data.fastingDates || [];
  root.innerHTML = dates
    .map(
      (item) =>
        `<button type="button" data-date="${item.date}"><span>${item.date} · ${item.label}</span><span>✕</span></button>`
    )
    .join("");
  root.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const fastingDates = (state.fastingDates || []).filter((item) => item.date !== btn.dataset.date);
      render(await send("save-settings", { fastingDates }));
    });
  });
}

load();
