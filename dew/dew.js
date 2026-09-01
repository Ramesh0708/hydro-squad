function dewMarkup() {
  return `
    <div class="dew-body">
      <span class="brow left"></span>
      <span class="brow right"></span>
      <span class="eye left"><i class="pupil"></i></span>
      <span class="eye right"><i class="pupil"></i></span>
      <span class="blush left"></span>
      <span class="blush right"></span>
      <span class="mouth"></span>
      <span class="shine"></span>
      <span class="sweat"></span>
      <span class="spark"></span>
      <span class="steam"></span>
    </div>
  `;
}

const REACTIONS = {
  ok: [
    "Dew is plump. Keep this energy.",
    "Hydration looks good on you.",
    "The squad is thriving. One more later."
  ],
  smug: [
    "Look at you, actually drinking water. Dew is insufferable about it.",
    "Goal crushed. Dew will be telling the other droplets.",
    "Smug mode unlocked. You did this."
  ],
  love: [
    "Streak? Streak. Dew is blushing on purpose.",
    "You keep showing up. Dew is emotionally unwell about it. In a good way."
  ],
  sleepy: [
    "Fine. Ten minutes. Dew is taking a tiny nap.",
    "Snoozed. Dew will remember this. Softly."
  ],
  judging: [
    "Dew saw that empty glass. Dew is choosing violence with eyebrows.",
    "No sip yet. Interesting choice, historically."
  ],
  thirsty: [
    "A cactus just texted. It feels seen.",
    "Your blood wants a raise and a glass of water.",
    "Dew is drafting a TED talk about your neglect."
  ],
  dramatic: [
    "This is not a reminder. This is an opera.",
    "Dew has written a sad violin part just for your kidneys.",
    "The drought years. Directed by you."
  ],
  feral: [
    "SIP. SIP NOW. DEW HAS LEFT THE CHAT AND ENTERED THE ROOM.",
    "Your cells have unionized. Their only demand is water.",
    "Dew is one ignored nudge away from becoming weather."
  ],
  happy: [
    "GULP REGISTERED. Dew is doing a little dance.",
    "That’s the stuff. Your cells just high-fived.",
    "Dew will allow you to continue being a person."
  ],
  wink: ["Dew saw that. Proud of you. A little."],
  dizzy: ["You poked Dew. Dew is experiencing emotions."],
  sideeye: ["…anyway. Water exists."],
  wave: ["Hi. I’m Dew. I live here now."],
  fasting: [
    "Today is a fasting day. If that’s you, Dew is not the canteen committee.",
    "Fasting day. Observers skip the plate. Dew will still bully you about water."
  ],
  festive: [
    "Festival mode. Dew put on imaginary fairy lights.",
    "The office has a vibe. Dew is not above mithai."
  ]
};

const POKES = ["wink", "dizzy", "sideeye", "love", "judging"];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function lineFor(mood, personality) {
  if (mood === "thirsty" && personality === "gentle") {
    return pick([
      "Tiny sip. That’s the whole quest.",
      "Your brain does better with water. Dew believes in you."
    ]);
  }
  if (mood === "thirsty" && personality === "chaos") {
    return pick([
      "THE DROUGHT COUNCIL IS IN SESSION.",
      "SIP OR DEW BECOMES A CLOUD AND RAINS ON THIS TAB."
    ]);
  }
  if (mood === "feral" && personality === "gentle") {
    return "Okay. Dew is still kind. Dew is also vibrating.";
  }
  return pick(REACTIONS[mood] || REACTIONS.ok);
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
