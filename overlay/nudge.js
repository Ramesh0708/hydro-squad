function $(id) {
  return document.getElementById(id);
}

function send(type, extra = {}) {
  return chrome.runtime.sendMessage({ type, ...extra });
}

function applyCopy(locale) {
  $("sip").textContent = t(locale, "sip");
  $("snooze").textContent = t(locale, "snooze");
  $("ate").textContent = t(locale, "ate");
  $("honor").textContent = t(locale, "honor");
}

async function load() {
  let data;
  try {
    data = await send("get-state");
  } catch {
    window.close();
    return;
  }
  if (!data?.onboarded || (!data.thirsty && !data.mealDue)) {
    window.close();
    return;
  }

  const locale = data.locale || "en";
  document.documentElement.lang = i18nPack(locale).htmlLang;
  document.title = i18nPack(locale).notifySip;
  applyCopy(locale);

  const dew = $("dew");
  if (!dew.querySelector(".dew-body")) dew.innerHTML = dewMarkup();
  const mood = homeMood(data);
  dew.dataset.mood = mood;
  $("mood-tag").textContent = i18nPack(locale).moods[mood] || mood;
  $("rank").textContent = data.rank || i18nPack(locale).ranks[0].name;
  $("status").textContent = data.mealDue
    ? mealMessage(data.mealDue, data, locale)
    : data.greeting || lineFor(mood, data.personality, locale);

  const meal = data.mealDue;
  $("meal-box").classList.toggle("hidden", !meal);
  if (meal) {
    const dueName = mealLabel(meal.id, locale);
    $("meal-label").textContent = data.fasting
      ? t(locale, "mealNowFast", { label: dueName })
      : t(locale, "mealNow", { label: dueName });
    $("meal-when").textContent = data.fasting ? t(locale, "skipIfFasting") : t(locale, "goEat");
  }
  $("sip").classList.toggle("hidden", !data.thirsty);
  $("ate").classList.toggle("hidden", !meal || !!data.fasting);
  $("honor").classList.toggle("hidden", !meal || !data.fasting);
}

$("sip").addEventListener("click", async () => {
  await send("sip");
  window.close();
});

$("snooze").addEventListener("click", async () => {
  await send("snooze", { minutes: 10 });
  window.close();
});

$("ate").addEventListener("click", async () => {
  const data = await send("get-state");
  if (data?.mealDue?.id) await send("eat-meal", { mealId: data.mealDue.id });
  window.close();
});

$("honor").addEventListener("click", async () => {
  await send("honor-fast");
  window.close();
});

window.addEventListener("unload", () => {
  try {
    chrome.runtime.sendMessage({ type: "nudge-closed" });
  } catch {
    /* ignore */
  }
});

load();
