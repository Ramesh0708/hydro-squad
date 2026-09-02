# Hydro Squad

A Chromium extension for **Google Chrome** and **Microsoft Edge**. Dew is a dramatic water-droplet roommate in the toolbar: water reminders, office meal bells, and fasting/festival cautions.

No account. No server. Data stays on the machine. Silent — Dew uses the popup, badge, notifications, and on-page overlay. No extension sounds.

Current version: **1.3.5** · [github.com/Ramesh0708/hydro-squad](https://github.com/Ramesh0708/hydro-squad)

## What Dew does

- Introduces themselves in about 10 seconds (name, nudge interval, personality)
- Personalities: **Soft**, **Roast**, **Chaos**
- **I sipped** logs a sip, updates the daily meter, and keeps a streak (Puddle → Hydrolegend)
- **Give me 10 minutes** snoozes the water nag
- When water or a meal is overdue, Dew can appear on http(s) pages until you sip, eat, honor a fast, or snooze
- Faces change (wink, smug, sleepy, judging, dramatic, feral). Poke Dew
- Toolbar icons and desktop notifications stay still (first frame). Dew is CSS-animated in the popup and overlay
- Office meals in **local time**: breakfast **8:15**, lunch **12:30**, snack **17:00**, dinner **20:30**, midnight **00:00**
- Fasting/festival days from packed `office-fasts.json` (Hindu, Muslim, Jain, Sikh, Jewish, Christian, Buddhist dates among others). Observers get a caution; everyone else is still told to eat
- Mark today as a fast, weekly fasts, extra dates, or “I personally observe”
- Teams / Power Automate still owns the canteen menu. Dew only grabs people who never open Teams

Clicking a water notification counts as a sip. Meal notifications mark that meal eaten (or honor a fast if you observe).

## Install (unpacked)

Same folder for both browsers. After you pull updates, open the extensions page and click **Reload**.

### Chrome

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked**
4. Pick this `hydro-squad` folder

### Microsoft Edge

1. Open `edge://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked**
4. Pick this `hydro-squad` folder

Pin the icon. Click it. Let Dew move in.

## How to show friends

1. Send them this repo or a zip of the folder
2. They load unpacked once
3. They pick Roast or Chaos
4. Dew handles the rest

## Privacy

Everything stays in `chrome.storage.local` on that computer. Permissions are `storage`, `alarms`, and `notifications` only. No tracking, no analytics.
