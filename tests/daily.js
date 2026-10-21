// The Daily Chase: is every day's level beatable (at the computer speed, the faster one)?
// Checks the next DAYS days (60 by default). Run: node tests/daily.js [days]
const { dailyLevel } = require('../levels.js');
const { Daily } = require('../daily.js');
const { runChase } = require('./bosses.js');
const days = +process.argv[2] || +process.env.DAYS || 60;
let bad = 0;
const today = Daily.key();
for (let i = 0; i < days; i++) {
  const day = Daily.addDays(today, i), def = dailyLevel(day, Daily.weekday(day));
  const r = runChase(def);
  if (!r.won || r.cans < 3) { bad++; console.log(`FAIL  ${day} ${def.name}: ${JSON.stringify(r)} | ${def.parts.map((p) => p.kind).join(' ')}`); }
  else if (process.env.VERBOSE) console.log(`PASS  ${day} ${def.name.padEnd(26)} ${r.secs}s, Eraser ${r.lead} behind`);
}
console.log(bad ? `FAIL  ${bad} of the next ${days} Dailies` : `PASS  the next ${days} Daily Chases can all be beaten`);
module.exports = { bad };
if (require.main === module) process.exit(bad ? 1 : 0);
