function dewMarkup() {
  return `
    <span class="feather" aria-hidden="true"></span>
    <div class="dew-body">
      <span class="brow left"></span>
      <span class="brow right"></span>
      <span class="tilak"></span>
      <span class="eye left"><i class="pupil"></i></span>
      <span class="eye right"><i class="pupil"></i></span>
      <span class="nath"></span>
      <span class="blush left"></span>
      <span class="blush right"></span>
      <span class="mouth"></span>
      <span class="mala"></span>
      <span class="shine"></span>
      <span class="sweat"></span>
      <span class="spark"></span>
      <span class="diya"></span>
      <span class="steam"></span>
      <span class="hands"><span class="hand left"></span><span class="hand right"></span></span>
    </div>
  `;
}

const POKES = ["wink", "dizzy", "sideeye", "love", "judging", "wave"];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function lineFor(mood, personality, locale = "en") {
  const pack = typeof i18nPack === "function" ? i18nPack(locale) : null;
  if (!pack) return "";
  if (mood === "thirsty" && pack.thirstByVibe?.[personality]?.length) {
    return pick(pack.thirstByVibe[personality]);
  }
  if (mood === "feral" && personality === "gentle" && pack.feralGentle) {
    return pick([].concat(pack.feralGentle));
  }
  return pick(pack.reactions[mood] || pack.reactions.ok);
}

function homeMood(data, justSipped = false) {
  if (justSipped) return "happy";
  if (data.mealDue && data.fasting) return "fasting";
  if (data.mealDue && data.festive) return "festive";
  if (data.mealDue) return "hungry";
  if (data.fasting && data.iObserveFasts) return "fasting";
  if (data.festive) return "festive";
  return thirstMood(data);
}

function thirstMood(data) {
  if (data.snoozeUntil && Date.now() < data.snoozeUntil) return "sleepy";
  if (!data.thirsty) {
    if ((data.sipsToday || 0) >= (data.goal || 8)) return "smug";
    if ((data.streak || 0) >= 3) return "love";
    return "ok";
  }
  const ratio = data.overdueRatio || 1;
  if (ratio >= 2.5) return "feral";
  if (ratio >= 1.6) return "dramatic";
  if (!data.lastSip) return "judging";
  return "thirsty";
}
