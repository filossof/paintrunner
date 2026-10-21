'use strict';

// ============================================================
//  The Daily: one chase level a day, the same for everyone, and the play streak.
//
//  A day starts at 3 am Israel time, for the whole world (so everyone races the same level).
//  The level itself is built from the date (levels.js: dailyLevel). The streak counts days on which
//  you finished any level; one missed day a week is forgiven (the streak saver).
// ============================================================

const Daily = (() => {
  const TZ = 'Asia/Jerusalem', RESET_HOUR = 3, DAY = 86400000;
  let fmt = null;
  // the date and time in Israel, `ms` milliseconds since 1970
  function israel(ms) {
    try {
      fmt = fmt || new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
      const p = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
      return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, min: +p.minute, s: +p.second };
    } catch (e) {   // no time zone support: Israel is about UTC+2/3
      const d = new Date(ms + 3 * 3600000);
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), min: d.getUTCMinutes(), s: d.getUTCSeconds() };
    }
  }
  // today's Daily, as 'YYYY-MM-DD' (the Israel date, counting from 3 am)
  function key(ms = Date.now()) {
    const p = israel(ms - RESET_HOUR * 3600000);
    return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
  }
  // milliseconds until the next Daily
  function msToNext(ms = Date.now()) {
    const p = israel(ms - RESET_HOUR * 3600000);
    return DAY - ((p.h * 60 + p.min) * 60 + p.s) * 1000;
  }
  const dayNum = (k) => { const [y, m, d] = k.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / DAY); };
  const weekday = (k) => new Date(dayNum(k) * DAY).getUTCDay();    // 0 Sunday ... 6 Saturday
  const addDays = (k, n) => { const d = new Date((dayNum(k) + n) * DAY); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; };

  // ---------- the streak ----------
  // s = { last: day key, count, best, saverAt: day key the saver was last used }
  // Marks today as played. Returns null if today was already counted, else { count, saved }.
  function markPlayed(s, today = key()) {
    if (s.last === today) return null;
    let saved = false;
    const gap = s.last ? dayNum(today) - dayNum(s.last) : 0;
    if (!s.last || gap < 1) s.count = 1;
    else if (gap === 1) s.count = (s.count || 0) + 1;
    else if (gap === 2 && saverReady(s, today)) { s.count = (s.count || 0) + 1; s.saverAt = today; saved = true; }
    else s.count = 1;
    s.last = today;
    s.best = Math.max(s.best || 0, s.count);
    return { count: s.count, saved };
  }
  // one missed day a week is forgiven
  const saverReady = (s, today = key()) => !s.saverAt || dayNum(today) - dayNum(s.saverAt) >= 7;
  // what the streak shows now: still alive if you played today or yesterday (or the day before, with the saver)
  function current(s, today = key()) {
    if (!s || !s.last) return 0;
    const gap = dayNum(today) - dayNum(s.last);
    return gap <= 1 || (gap === 2 && saverReady(s, today)) ? s.count : 0;
  }

  // ---------- the rewards for each day of the streak ----------
  // A week repeats: 50, 75, 100, a gift, 150, 200, and something special on day 7.
  // Days 7, 14, 30 and 100 give an item you can only get this way (the first time).
  const MILESTONES = { 7: 'streakblaze', 14: 'laurel', 30: 'livingpaint', 100: 'supernova' };
  const WEEK = [50, 75, 100, 'gift', 150, 200, 300];
  function reward(count) {
    if (MILESTONES[count]) return { item: MILESTONES[count] };
    const r = WEEK[(count - 1) % 7];
    return r === 'gift' ? { gift: true } : { drops: r };
  }

  return { key, msToNext, dayNum, weekday, addDays, markPlayed, current, saverReady, reward, MILESTONES, WEEK };
})();

if (typeof module !== 'undefined') module.exports = { Daily };
