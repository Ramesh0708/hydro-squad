const assert = require("assert");
const {
  thirsty,
  overdueRatio,
  sipAlarmDelayMin,
  sipDueAt,
  nagRepeatMin
} = require("../schedule.js");

const MIN = 60 * 1000;
const now = 1_700_000_000_000;

function almost(actual, expected, msg) {
  assert.ok(Math.abs(actual - expected) < 0.02, `${msg} (got ${actual}, expected ${expected})`);
}

assert.strictEqual(thirsty({ lastSip: 0, intervalMin: 45 }, now), true, "never sipped is thirsty");
assert.strictEqual(
  thirsty({ lastSip: now - 10 * MIN, intervalMin: 45, snoozeUntil: now + 5 * MIN }, now),
  false,
  "snooze blocks thirst"
);
assert.strictEqual(thirsty({ lastSip: now - 10 * MIN, intervalMin: 45 }, now), false, "recent sip is not thirsty");
assert.strictEqual(thirsty({ lastSip: now - 45 * MIN, intervalMin: 45 }, now), true, "due sip is thirsty");
assert.strictEqual(thirsty({ lastSip: now - 90 * MIN, intervalMin: 45 }, now), true, "overdue sip is thirsty");

assert.ok(overdueRatio({ lastSip: 0, intervalMin: 45 }, now) >= 2);
almost(overdueRatio({ lastSip: now - 90 * MIN, intervalMin: 45 }, now), 2, "90m overdue on 45m interval");

almost(sipAlarmDelayMin({ lastSip: 0, intervalMin: 45 }, now), 45, "first alarm waits a full interval");
almost(sipAlarmDelayMin({ lastSip: now, intervalMin: 45 }, now), 45, "fresh sip waits a full interval");
almost(sipAlarmDelayMin({ lastSip: now - 30 * MIN, intervalMin: 45 }, now), 15, "alarm aligns to last sip");
almost(
  sipAlarmDelayMin({ lastSip: now - 10 * MIN, intervalMin: 45, snoozeUntil: now + 10 * MIN }, now),
  10,
  "snooze owns the next alarm"
);
almost(sipAlarmDelayMin({ lastSip: now - 50 * MIN, intervalMin: 45 }, now), 0.05, "already due fires immediately");

// Old bug: a repeating alarm from install/startup could fire at T+45, T+90, …
// while last sip was at T+44, so the due time (T+89) never matched an alarm.
// Users only saw Dew after clicking the toolbar icon.
almost(
  sipAlarmDelayMin({ lastSip: now - 44 * MIN, intervalMin: 45 }, now),
  1,
  "next alarm is lastSip + interval, not the next wall-clock period"
);

assert.strictEqual(sipDueAt({ lastSip: now, intervalMin: 30 }, now), now + 30 * MIN);
assert.strictEqual(nagRepeatMin({ intervalMin: 45 }), 5);
assert.strictEqual(nagRepeatMin({ intervalMin: 1 }), 1);

console.log("schedule tests passed");
