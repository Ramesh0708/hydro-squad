function intervalMs(state) {
  return Math.max(1, Number(state.intervalMin) || 45) * 60 * 1000;
}

function intervalMin(state) {
  return Math.max(1, Number(state.intervalMin) || 45);
}

function overdueRatio(state, now = Date.now()) {
  const span = intervalMs(state);
  if (!state.lastSip) return 2;
  return (now - state.lastSip) / span;
}

function thirsty(state, now = Date.now()) {
  if (state.snoozeUntil && now < state.snoozeUntil) return false;
  if (!state.lastSip) return true;
  return now - state.lastSip >= intervalMs(state);
}

function sipDueAt(state, now = Date.now()) {
  if (state.snoozeUntil && state.snoozeUntil > now) return state.snoozeUntil;
  if (!state.lastSip) return now + intervalMs(state);
  return state.lastSip + intervalMs(state);
}

/** Minutes until the sip alarm should fire. Never sipped: wait a full interval. */
function sipAlarmDelayMin(state, now = Date.now()) {
  const due = sipDueAt(state, now);
  const delay = (due - now) / 60000;
  if (delay <= 0) return 0.05;
  return delay;
}

function nagRepeatMin(state) {
  return Math.min(5, intervalMin(state));
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    intervalMs,
    intervalMin,
    overdueRatio,
    thirsty,
    sipDueAt,
    sipAlarmDelayMin,
    nagRepeatMin
  };
}
