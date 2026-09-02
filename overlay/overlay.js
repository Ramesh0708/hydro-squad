const CARD_CSS = `
  :host {
    all: initial;
    position: fixed !important;
    inset: auto 18px 18px auto !important;
    margin: 0 !important;
    border: 0 !important;
    padding: 0 !important;
    width: 280px !important;
    display: block !important;
    overflow: visible !important;
    background: transparent !important;
    z-index: 2147483647 !important;
    pointer-events: auto !important;
  }
  .wrap {
    font-family: "Segoe UI", "Nirmala UI", "Noto Sans Devanagari", sans-serif;
    color: #fff4e4;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }
  .card {
    max-width: 270px;
    padding: 12px;
    border-radius: 18px;
    background: rgba(28, 10, 36, 0.96);
    box-shadow: 0 16px 40px rgba(40, 8, 18, 0.4);
    border: 1px solid rgba(240, 193, 75, 0.4);
  }
  .card.fast { border-color: rgba(240, 194, 122, 0.55); }
  .card.festive { border-color: rgba(238, 123, 42, 0.7); }
  .row { display: flex; gap: 10px; align-items: center; }
  .dew { width: 58px; height: 76px; flex: none; }
  .copy { margin: 0; font-size: 13px; line-height: 1.4; }
  .actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  button {
    border: 0; cursor: pointer;
    font: 12px/1.3 "Segoe UI", "Nirmala UI", sans-serif;
    padding: 8px 10px; border-radius: 999px;
  }
  .sip { background: linear-gradient(180deg, #ffb347, #ee7b2a); color: #3a1408; font-weight: 700; }
  .later { background: rgba(255, 255, 255, 0.1); color: #fff4e4; }
`;

const THIRST_CYCLE = {
  judging: ["judging", "sideeye", "thirsty"],
  thirsty: ["thirsty", "judging", "dramatic"],
  dramatic: ["dramatic", "dizzy", "feral"],
  feral: ["feral", "dramatic", "dizzy"],
  hungry: ["hungry", "judging"],
  fasting: ["fasting", "ok"],
  festive: ["festive", "love", "wink"]
};

let cycleTimer = 0;

function pinHost(host) {
  host.style.setProperty("position", "fixed", "important");
  host.style.setProperty("inset", "auto 18px 18px auto", "important");
  host.style.setProperty("margin", "0", "important");
  host.style.setProperty("border", "0", "important");
  host.style.setProperty("padding", "0", "important");
  host.style.setProperty("width", "280px", "important");
  host.style.setProperty("display", "block", "important");
  host.style.setProperty("z-index", "2147483647", "important");
  host.style.setProperty("background", "transparent", "important");
  host.style.setProperty("overflow", "visible", "important");
}

function removeDew() {
  clearInterval(cycleTimer);
  const host = document.getElementById("hydro-squad-dew");
  if (!host) return;
  try {
    if (typeof host.hidePopover === "function") host.hidePopover();
  } catch {
    /* ignore */
  }
  host.remove();
}

function bucketFor(data) {
  if (data.mealDue) return `meal-${data.mealDue.id}-${data.fasting ? "fast" : data.festive ? "fest" : "eat"}`;
  if (data.festive) return `festive-${data.fastingReason}`;
  return homeMood(data);
}

function showDew(data) {
  const bucket = bucketFor(data);
  const existing = document.getElementById("hydro-squad-dew");
  if (existing?.dataset.bucket === bucket) {
    try {
      if (typeof existing.showPopover === "function") existing.showPopover();
    } catch {
      /* already open */
    }
    return;
  }
  removeDew();

  const meal = data.mealDue;
  const mood = meal
    ? data.fasting
      ? "fasting"
      : data.festive
        ? "festive"
        : "hungry"
    : homeMood(data);
  const locale = data.locale || "en";
  const copy = meal
    ? mealMessage(meal, data, locale)
    : data.greeting || lineFor(mood, data.personality, locale);

  const host = document.createElement("div");
  host.id = "hydro-squad-dew";
  host.dataset.bucket = bucket;
  host.setAttribute("popover", "manual");
  pinHost(host);
  const shadow = host.attachShadow({ mode: "open" });

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = chrome.runtime.getURL("dew/dew.css");

  const style = document.createElement("style");
  style.textContent = CARD_CSS;

  const wrap = document.createElement("div");
  wrap.className = "wrap";
  const extra = meal
    ? data.fasting
      ? `<button class="sip" data-act="honor" type="button">${t(locale, "honor")}</button>
         <button class="later" data-act="eat" type="button">${t(locale, "ate")}</button>`
      : `<button class="sip" data-act="eat" type="button">${t(locale, "ate")}</button>
         <button class="later" data-act="later" type="button">${t(locale, "snooze")}</button>`
    : `<button class="sip" data-act="sip" type="button">${t(locale, "sip")}</button>
       <button class="later" data-act="later" type="button">${t(locale, "snooze")}</button>`;

  wrap.innerHTML = `
    <div class="card ${data.fasting ? "fast" : ""} ${data.festive ? "festive" : ""}">
      <div class="row">
        <div class="dew" data-mood="${mood}">${dewMarkup()}</div>
        <p class="copy">${copy}</p>
      </div>
      <div class="actions">${extra}</div>
    </div>
  `;

  wrap.addEventListener("click", async (event) => {
    const act = event.target.dataset?.act;
    if (!act) return;
    if (act === "sip") await chrome.runtime.sendMessage({ type: "sip" });
    if (act === "later") await chrome.runtime.sendMessage({ type: "snooze", minutes: 10 });
    if (act === "eat") await chrome.runtime.sendMessage({ type: "eat-meal", mealId: meal?.id });
    if (act === "honor") await chrome.runtime.sendMessage({ type: "honor-fast" });
    removeDew();
  });

  wrap.querySelector(".dew").addEventListener("click", (event) => {
    event.stopPropagation();
    const dew = wrap.querySelector(".dew");
    const poke = pick(POKES);
    dew.dataset.mood = poke;
    wrap.querySelector(".copy").textContent = lineFor(poke, data.personality, locale);
  });

  const pool = THIRST_CYCLE[mood] || [mood];
  cycleTimer = setInterval(() => {
    const next = pick(pool);
    wrap.querySelector(".dew").dataset.mood = next;
  }, 5000);

  shadow.append(link, style, wrap);
  const root = document.body || document.documentElement;
  root.appendChild(host);
  try {
    if (typeof host.showPopover === "function") host.showPopover();
  } catch {
    /* older Chrome, or already open */
  }
}

async function getData() {
  try {
    return await chrome.runtime.sendMessage({ type: "get-state" });
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return chrome.runtime.sendMessage({ type: "get-state" });
  }
}

async function sync() {
  try {
    const data = await getData();
    const show =
      data?.onboarded &&
      data.overlayEnabled !== false &&
      (data.mealDue || data.thirsty);
    if (show) showDew(data);
    else removeDew();
  } catch {
    removeDew();
  }
}

sync();
setInterval(sync, 10000);
chrome.storage.onChanged.addListener(sync);
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "hydro-nudge") sync();
});
