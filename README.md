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

45 levels in six worlds (one per color, then a finale), lava, monsters (Inky walkers, washers and color-hat shooters), moving platforms, three paint cans (stars) per level, and a soundtrack (`music/theme.mp3` on the menu, `music/level.mp3` in levels).

**Controls:** A/D move · W/Space jump · S drop / don't bounce · mouse aim · click throw · right-click wash · 1-5 or Q/E colors · R restart · L leaderboards · M music · Esc menu

## Paint Drops & store

Clearing levels earns **Paint Drops** (first clear +50, each new can +25, replays +10/5/2, new best time +15, first level of the day +30, stomps +1). Spend them in the **store (S)** on cosmetics only: hats, trails, colors, splat styles, finish flags and fall effects (`shop.js`). Stars are never spent; they unlock the 12 characters (`characters.js`).

## Online features

- **Sign in with Google** (optional) to sync progress between computers and appear on the leaderboards.
- **Leaderboards per level:** ⚡ fastest, ★★★ fastest perfect run (all 3 cans), 🎨 fewest throws, plus an overall star ranking.
- **Owner stats:** [`stats.html`](https://filossof.github.io/paintrunner/stats.html) shows players, where people get stuck, and recent activity. Only the owner account can read that data.

Data lives in its own Firebase project (`paintrunner`), in Firestore collections starting with `pr_`. Who can read and write what is defined in [`firestore.rules`](firestore.rules); after changing it, paste the whole file into the Firebase console (**Firestore Database → Rules → Publish**).

## Files

| File | Purpose |
|---|---|
| `index.html`, `style.css` | Page + overlay styles |
| `levels.js` | All level maps, cans, monsters, platforms, and `LEVEL_ORDER` (the play order) |
| `world.js` | Game rules and physics (no rendering, runs in Node for tests) |
| `main.js` | Input, rendering, menus |
| `audio.js` | Music player (menu/level tracks) and synthesized sound effects |
| `music/` | Soundtrack MP3s |
| `cloud.js`, `config.js` | Firebase: sign-in, leaderboards, progress sync |
| `ui.js` | Sign-in chip, leaderboards, character picker and store windows |
| `characters.js` | The 12 playable characters and their star thresholds |
| `shop.js` | Store items and how each cosmetic is drawn |
| `stats.html`, `stats.js` | Owner-only dashboard |

## Testing levels

`node tests/run-all.js` plays every new level with a bot that only paints by real, aimed throws, fights the live monsters, and must win without dying while collecting all 3 cans. It also checks that no level can be beaten without paint. Each world's solutions live in `tests/<color>.js`; add one when you add a level.

Run locally with any static server (e.g. `python3 -m http.server`) and open `http://localhost:8000`. Add `#level=5` to jump to a level.
