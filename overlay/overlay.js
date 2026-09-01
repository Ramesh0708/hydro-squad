const CARD_CSS = `
  :host { all: initial; }
  .wrap {
    font-family: "Segoe UI", "Trebuchet MS", sans-serif;
    color: #e8fff8;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }
  .card {
    max-width: 270px;
    padding: 12px;
    border-radius: 18px;
    background: rgba(8, 40, 46, 0.94);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.28);
    border: 1px solid rgba(92, 225, 230, 0.25);
  }
  .card.fast { border-color: rgba(240, 194, 122, 0.45); }
  .card.festive { border-color: rgba(255, 211, 106, 0.55); }
  .row { display: flex; gap: 10px; align-items: center; }
  .dew { width: 54px; height: 70px; flex: none; }
  .copy { margin: 0; font-size: 13px; line-height: 1.35; }
  .actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  button {
    border: 0; cursor: pointer; font: 12px/1 "Segoe UI", sans-serif;
    padding: 8px 10px; border-radius: 999px;
  }
  .sip { background: #5ce1e6; color: #083238; font-weight: 700; }
  .later { background: rgba(255, 255, 255, 0.1); color: #e8fff8; }
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

function removeDew() {
  clearInterval(cycleTimer);
  document.getElementById("hydro-squad-dew")?.remove();
}

function bucketFor(data) {
  if (data.mealDue) return `meal-${data.mealDue.id}-${data.fasting ? "fast" : data.festive ? "fest" : "eat"}`;
  if (data.festive) return `festive-${data.fastingReason}`;
  return homeMood(data);
}

function showDew(data) {
  const bucket = bucketFor(data);
  const existing = document.getElementById("hydro-squad-dew");
  if (existing?.dataset.bucket === bucket) return;
  removeDew();

  const meal = data.mealDue;
  const mood = meal
    ? data.fasting
      ? "fasting"
      : data.festive
        ? "festive"
        : "hungry"
    : homeMood(data);
  const copy = meal
    ? mealMessage(meal, data)
    : data.greeting || lineFor(mood, data.personality);

  const host = document.createElement("div");
  host.id = "hydro-squad-dew";
  host.dataset.bucket = bucket;
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
      ? `<button class="sip" data-act="honor" type="button">I’m fasting</button>
         <button class="later" data-act="eat" type="button">I still eat</button>`
      : `<button class="sip" data-act="eat" type="button">I ate</button>
         <button class="later" data-act="later" type="button">10 min</button>`
    : `<button class="sip" data-act="sip" type="button">I sipped</button>
       <button class="later" data-act="later" type="button">10 min</button>`;

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
    wrap.querySelector(".copy").textContent = lineFor(poke, data.personality);
  });

  const pool = THIRST_CYCLE[mood] || [mood];
  cycleTimer = setInterval(() => {
    const next = pick(pool);
    wrap.querySelector(".dew").dataset.mood = next;
  }, 5000);

  shadow.append(link, style, wrap);
  document.documentElement.appendChild(host);
}

async function sync() {
  try {
    const data = await chrome.runtime.sendMessage({ type: "get-state" });
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
setInterval(sync, 20000);
chrome.storage.onChanged.addListener(sync);
