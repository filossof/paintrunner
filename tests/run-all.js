// Plays every level with the test bot (real throws only, live monsters) and checks:
//   - the level can be won without dying, and how many of its 3 cans the bot collected
//   - no level can be won without painting
// Run: node tests/run-all.js
const B = require('./bot.js');
const results = Object.assign({},
  require('./blue.js').R, require('./red.js').R, require('./green.js').R,
  require('./yellow.js').R, require('./purple.js').R, require('./finale.js').R,
  require('./bosses.js').R);   // the boss chases (wide levels, the Eraser chasing)
let bad = 0;
console.log('Bot playthroughs (levels without a bot here are covered by older tests):');
for (const [name, r] of Object.entries(results)) {
  if (typeof r !== 'object' || r === null) continue;
  const i = B.LEVELS.findIndex((l) => l.name === name) + 1;
  const ok = r.won && r.cans === 3;
  if (!ok) bad++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${String(i).padStart(2)}. ${name.padEnd(20)} ${r.won ? `won, cans ${r.cans}/3` : `NOT WON: ${r.fail || 'died (' + r.died + ')'}`}`);
}
// the next two weeks of Daily Chases (tests/daily.js checks 60 days)
process.env.DAYS = process.env.DAYS || 14;
if (require('./daily.js').bad) bad++;
const free = B.LEVELS.filter((l) => B.noPaintWin(l)).map((l) => l.name);
console.log(free.length ? `FAIL beatable without paint: ${free.join(', ')}` : 'PASS  no level can be beaten without paint');
process.exit(bad || free.length ? 1 : 0);
