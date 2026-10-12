# 🎨 Paint Runner

A black & white world. Throw paint to change it.

**Play:** https://filossof.github.io/paintrunner/

| Paint | What it does |
|---|---|
| 🔵 Blue | Bounce high |
| 🔴 Red | Run fast, jump far |
| 🟢 Green | Sticky: climb walls, hang from ceilings |
| 🟡 Yellow | Toggle big / small |
| 🟣 Purple | Two portals; keep your speed through them |

21 levels, monsters (Inky walkers, washers and color-hat shooters), moving platforms, three paint cans (stars) per level, procedural music.

**Controls:** A/D move · W/Space jump · S drop / don't bounce · mouse aim · click throw · right-click wash · 1-5 or Q/E colors · R restart · L leaderboards · M music · Esc menu

## Online features

- **Sign in with Google** (optional) to sync progress between computers and appear on the leaderboards.
- **Leaderboards per level:** ⚡ fastest, ★★★ fastest perfect run (all 3 cans), 🎨 fewest throws, plus an overall star ranking.
- **Owner stats:** [`stats.html`](https://filossof.github.io/paintrunner/stats.html) shows players, where people get stuck, and recent activity. Only the owner account can read that data.

Data lives in Firebase Firestore in the same project as [Quizzle](https://github.com/filossof/quizzle) (`quizzle-a3132`), in collections starting with `pr_`. Who can read and write what is defined in [`firestore.rules`](firestore.rules), which contains **both** apps' rules. After changing it, paste the whole file into the Firebase console (**Firestore Database → Rules → Publish**). Keep Quizzle's copy in sync.

## Files

| File | Purpose |
|---|---|
| `index.html`, `style.css` | Page + overlay styles |
| `levels.js` | All level maps, cans, monsters, platforms |
| `world.js` | Game rules and physics (no rendering, runs in Node for tests) |
| `main.js` | Input, rendering, menus |
| `audio.js` | Procedural music and sound effects |
| `cloud.js`, `config.js` | Firebase: sign-in, leaderboards, progress sync |
| `ui.js` | Sign-in chip and leaderboard window |
| `stats.html`, `stats.js` | Owner-only dashboard |

Run locally with any static server (e.g. `python3 -m http.server`) and open `http://localhost:8000`. Add `#level=5` to jump to a level.
