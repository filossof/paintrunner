'use strict';

// ============================================================
//  World: all game rules, no rendering or audio, so it can
//  also be loaded in Node for automated level tests.
// ============================================================

// In the browser LEVELS and the color constants come from levels.js as globals.
if (typeof module !== 'undefined') Object.assign(globalThis, require('./levels.js'));

const T = 32, COLS = 30, ROWS = 17, W = COLS * T, H = ROWS * T;

const SIZES = {
  big:   { w: 22, h: 40, jump: 10.5 },
  small: { w: 12, h: 18, jump: 8 },
};

const GRAV = 0.6, MAX_FALL = 13;
const RUN = 3.6, RED_RUN = 8.5;
const BOUNCE_V = 16.5;
const CLIMB = 3, CEIL_SPEED = 3;
const BLOB_SPEED = 13, BLOB_G = 0.15, THROW_COOLDOWN = 9;
const PLATFORM_H = 16;

const MONSTERS = {
  inky: { w: 24, h: 22, speed: 1.2, redSpeed: 2.8 },
  hat:  { w: 24, h: 28 },
};
const STUN_TIME = 180, SHOT_COOLDOWN = 150, SHOT_WARNING = 30;

function parseLevel(def) {
  if (def.map.length !== ROWS) throw new Error(`${def.name}: expected ${ROWS} rows, got ${def.map.length}`);
  const tiles = [], paint = [];
  let spawn = null, flag = null;
  def.map.forEach((row, r) => {
    if (row.length !== COLS) throw new Error(`${def.name}: row ${r} has ${row.length} cols`);
    tiles.push([]);
    paint.push(new Array(COLS).fill(NONE));
    for (let c = 0; c < COLS; c++) {
      let ch = row[c];
      if (ch === 'P') { spawn = { c, r }; ch = '.'; }
      if (ch === 'F') { flag = { c, r }; ch = '.'; }
      tiles[r].push(ch);
    }
  });
  if (!spawn || !flag) throw new Error(`${def.name}: missing P or F`);
  const solidAt = (c, r) => r < 0 || r >= ROWS || c < 0 || c >= COLS || tiles[r][c] === '#' || tiles[r][c] === 'M';
  const spikes = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (tiles[r][c] !== '^') continue;
      let dir = 'up';
      if (solidAt(c, r + 1)) dir = 'up';
      else if (solidAt(c, r - 1)) dir = 'down';
      else if (solidAt(c - 1, r)) dir = 'right';
      else if (solidAt(c + 1, r)) dir = 'left';
      spikes.push({ c, r, dir });
    }
  }
  // Lava: deadly liquid. The top tile of a pool has a surface you sink into a little.
  const lava = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (tiles[r][c] === 'L') lava.push({ c, r, surface: r === 0 || tiles[r - 1][c] !== 'L' });
    }
  }
  const platforms = (def.platforms || []).map((p) => ({
    x0: p.from[0] * T, y0: p.from[1] * T, x1: p.to[0] * T, y1: p.to[1] * T,
    x: p.from[0] * T, y: p.from[1] * T, w: p.w * T, h: PLATFORM_H,
    period: p.period, phase: p.phase || 0, color: NONE, dx: 0, dy: 0,
  }));
  const cans = (def.cans || []).map(([c, r]) => {
    if (solidAt(c, r)) throw new Error(`${def.name}: can at ${c},${r} is inside a wall`);
    return { c, r };
  });
  for (const m of def.monsters || []) {
    if (solidAt(m.c, m.r)) throw new Error(`${def.name}: monster at ${m.c},${m.r} is inside a wall`);
  }
  return { name: def.name, hint: def.hint, colors: def.colors, tiles, paint, spawn, flag, spikes, lava, platforms, cans,
    monsterDefs: def.monsters || [] };
}

function approach(v, target, step) {
  if (v < target) return Math.min(v + step, target);
  if (v > target) return Math.max(v - step, target);
  return v;
}

function overlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

class World {
  constructor(def) {
    this.def = def;
    this.events = [];
    this.deaths = 0;    // counts across restarts
    this.restart();
  }

  // A fresh attempt: timer, paint, throws, platforms, monsters and cans all reset.
  // (Dying restarts the whole level, so painting before a death can't help the next run.)
  restart() {
    this.level = parseLevel(this.def);
    this.platforms = this.level.platforms;
    this.blobs = [];
    this.tick = 0;      // drives platforms; keeps running while dead
    this.frame = 0;     // level timer
    this.throws = 0;
    this.state = 'play';
    this.timer = 0;
    this.portals = [];  // up to two { c, r, face }; the oldest is replaced first
    this.respawn();
  }

  // Puts the player, monsters and cans back at their starting state.
  respawn() {
    this.spawnPlayer();
    this.portals = [];  // dying closes your portals
    this.monsters = this.level.monsterDefs.map((d) => {
      const size = MONSTERS[d.type];
      return {
        type: d.type, color: d.color ?? NONE, w: size.w, h: size.h,
        x: d.c * T + (T - size.w) / 2, y: d.r * T + T - size.h,
        vx: 0, vy: 0, dir: d.dir || 1, alive: true, grounded: false, groundColor: NONE,
        stun: 0, stunColor: NONE, cooldown: 60, warning: 0, range: (d.range || 11) * T,
      };
    });
    this.cans = this.level.cans.map((c) => ({ ...c, got: false }));
  }

  get cansCollected() { return this.cans.filter((c) => c.got).length; }

  spawnPlayer() {
    const s = this.level.spawn, size = SIZES.big;
    this.player = {
      x: s.c * T + (T - size.w) / 2, y: s.r * T + T - size.h, w: size.w, h: size.h, size: 'big',
      vx: 0, vy: 0, face: 1,
      grounded: true, groundColor: NONE, coyote: 0, jumpBuf: 0, canCut: false,
      cling: 0, clingLock: 0, throwCd: 0, ride: null, yellowLatch: false, sizeCd: 0,
      preVx: 0, preVy: 0, portalLatch: false, portalCd: 0,
      carry: 0,   // sideways speed kept from a moving platform you jumped off
    };
    this.blobs = [];
  }

  // ---- tile helpers ----
  tile(c, r) {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return 'M';
    return this.level.tiles[r][c];
  }
  solid(c, r) { const t = this.tile(c, r); return t === '#' || t === 'M'; }
  colorAt(c, r) {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return NONE;
    return this.level.paint[r][c];
  }
  setPaint(c, r, color) {
    if (this.tile(c, r) !== '#') return false;
    this.level.paint[r][c] = color;
    this.portals = this.portals.filter((p) => p.c !== c || p.r !== r); // painting over a portal closes it
    return true;
  }

  // Purple: a portal on one face of one tile. Only two exist; a third replaces the oldest.
  placePortal(c, r, face) {
    if (this.tile(c, r) !== '#') return false;
    this.setPaint(c, r, NONE);
    this.portals.push({ c, r, face });
    if (this.portals.length > 2) this.portals.shift();
    return true;
  }

  // Does this rectangle overlap any solid tile or platform?
  rectHitsSolid(x, y, w, h, ignore = null) {
    const c0 = Math.floor(x / T), c1 = Math.floor((x + w - 0.01) / T);
    const r0 = Math.floor(y / T), r1 = Math.floor((y + h - 0.01) / T);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (this.solid(c, r)) return true;
    return this.platforms.some((pl) => pl !== ignore && overlap(x, y, w, h, pl.x, pl.y, pl.w, pl.h));
  }

  // A 1px strip just outside one side of the player.
  probe(p, side) {
    return {
      left: [p.x - 1, p.y + 6, 1, p.h - 12],
      right: [p.x + p.w, p.y + 6, 1, p.h - 12],
      up: [p.x + 2, p.y - 1, p.w - 4, 1],
      down: [p.x + 2, p.y + p.h, p.w - 4, 1],
    }[side];
  }

  touchingColor(p, side, color) {
    const [x, y, w, h] = this.probe(p, side);
    const c0 = Math.floor(x / T), c1 = Math.floor((x + w - 0.01) / T);
    const r0 = Math.floor(y / T), r1 = Math.floor((y + h - 0.01) / T);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) if (this.solid(c, r) && this.colorAt(c, r) === color) return true;
    }
    return this.platforms.some((pl) => pl.color === color && overlap(x, y, w, h, pl.x, pl.y, pl.w, pl.h));
  }

  platformTouching(p, side) {
    const [x, y, w, h] = this.probe(p, side);
    return this.platforms.find((pl) => overlap(x, y, w, h, pl.x, pl.y, pl.w, pl.h)) || null;
  }

  // Color of the solid tile hit along a row/column; prefer the one under the body's center.
  hitColor(cells, centerIdx) {
    const solidCells = cells.filter(([c, r]) => this.solid(c, r));
    if (!solidCells.length) return null;
    const center = solidCells.find(([c, r]) => c === centerIdx[0] || r === centerIdx[1]);
    const [c, r] = center || solidCells[0];
    return this.colorAt(c, r);
  }

  // ---- movement with collision against tiles and platforms ----
  moveX(p, ignore = null) {
    p.x += p.vx;
    let hit = null;
    const r0 = Math.floor(p.y / T), r1 = Math.floor((p.y + p.h - 0.01) / T);
    const cy = Math.floor((p.y + p.h / 2) / T);
    if (p.vx > 0) {
      const c = Math.floor((p.x + p.w - 0.01) / T);
      const cells = []; for (let r = r0; r <= r1; r++) cells.push([c, r]);
      const color = this.hitColor(cells, [-1, cy]);
      if (color !== null) { p.x = c * T - p.w; hit = { side: 1, color, plat: null }; }
    } else if (p.vx < 0) {
      const c = Math.floor(p.x / T);
      const cells = []; for (let r = r0; r <= r1; r++) cells.push([c, r]);
      const color = this.hitColor(cells, [-1, cy]);
      if (color !== null) { p.x = (c + 1) * T; hit = { side: -1, color, plat: null }; }
    }
    for (const pl of this.platforms) {
      if (pl === ignore || !overlap(p.x, p.y, p.w, p.h, pl.x, pl.y, pl.w, pl.h)) continue;
      if (p.vx > 0) { p.x = pl.x - p.w; hit = { side: 1, color: pl.color, plat: pl }; }
      else if (p.vx < 0) { p.x = pl.x + pl.w; hit = { side: -1, color: pl.color, plat: pl }; }
    }
    return hit;
  }

  moveY(p, ignore = null) {
    p.y += p.vy;
    let hit = null;
    const c0 = Math.floor(p.x / T), c1 = Math.floor((p.x + p.w - 0.01) / T);
    const cx = Math.floor((p.x + p.w / 2) / T);
    if (p.vy > 0) {
      const r = Math.floor((p.y + p.h - 0.01) / T);
      const cells = []; for (let c = c0; c <= c1; c++) cells.push([c, r]);
      const color = this.hitColor(cells, [cx, -1]);
      if (color !== null) { p.y = r * T - p.h; hit = { side: 1, color, plat: null }; }
    } else if (p.vy < 0) {
      const r = Math.floor(p.y / T);
      const cells = []; for (let c = c0; c <= c1; c++) cells.push([c, r]);
      const color = this.hitColor(cells, [cx, -1]);
      if (color !== null) { p.y = (r + 1) * T; hit = { side: -1, color, plat: null }; }
    }
    for (const pl of this.platforms) {
      if (pl === ignore || !overlap(p.x, p.y, p.w, p.h, pl.x, pl.y, pl.w, pl.h)) continue;
      if (p.vy > 0) { p.y = pl.y - p.h; hit = { side: 1, color: pl.color, plat: pl }; }
      else if (p.vy < 0) { p.y = pl.y + pl.h; hit = { side: -1, color: pl.color, plat: pl }; }
    }
    return hit;
  }

  // ---- moving platforms ----
  stepPlatforms() {
    const p = this.player;
    const alive = this.state === 'play';
    for (const pl of this.platforms) {
      const t = 0.5 - 0.5 * Math.cos(2 * Math.PI * (this.tick / pl.period + pl.phase));
      const nx = pl.x0 + (pl.x1 - pl.x0) * t, ny = pl.y0 + (pl.y1 - pl.y0) * t;
      pl.dx = nx - pl.x; pl.dy = ny - pl.y;
      pl.x = nx; pl.y = ny;
      if (alive && p.ride === pl) {
        // carry the rider, still colliding with everything else
        const vx = p.vx, vy = p.vy;
        p.vx = pl.dx; this.moveX(p, pl);
        p.vy = pl.dy; this.moveY(p, pl);
        p.vx = vx; p.vy = vy;
      }
    }
    if (!alive) return;
    // platforms push the player out of the way...
    for (const pl of this.platforms) {
      if (pl === p.ride || !overlap(p.x, p.y, p.w, p.h, pl.x, pl.y, pl.w, pl.h)) continue;
      if (Math.abs(pl.dx) >= Math.abs(pl.dy)) {
        p.x = pl.dx > 0 ? pl.x + pl.w : pl.x - p.w;
      } else if (pl.dy < 0) {
        p.y = pl.y - p.h; p.vy = Math.min(p.vy, 0); p.ride = pl;
      } else {
        p.y = pl.y + pl.h; p.vy = Math.max(p.vy, 0);
      }
    }
    // ...and squash them if there is nowhere to go
    if (this.rectHitsSolid(p.x + 1, p.y + 1, p.w - 2, p.h - 2)) this.die();
  }

  // ---- paint throwing ----
  throwPaint(tx, ty, color) {
    const p = this.player;
    if (this.state !== 'play' || p.throwCd > 0) return false;
    if (color !== NONE && !this.level.colors.includes(color)) return false;
    const cx = p.x + p.w / 2, cy = p.y + p.h * 0.25;
    const dx = tx - cx, dy = ty - cy;
    const d = Math.hypot(dx, dy) || 1;
    this.blobs.push({ x: cx, y: cy, vx: dx / d * BLOB_SPEED, vy: dy / d * BLOB_SPEED, color, owner: 'player' });
    p.throwCd = THROW_COOLDOWN;
    this.throws++;
    this.events.push({ type: 'throw', color });
    return true;
  }

  stepBlobs() {
    for (let i = this.blobs.length - 1; i >= 0; i--) {
      const b = this.blobs[i];
      let done = false;
      for (let s = 0; s < 3 && !done; s++) {
        b.vy += BLOB_G / 3;
        const nx = b.x + b.vx / 3, ny = b.y + b.vy / 3;
        const c = Math.floor(nx / T), r = Math.floor(ny / T);
        if (c < 0 || c >= COLS || r < 0 || r >= ROWS) { done = true; break; }
        const inside = (o) => nx >= o.x && nx <= o.x + o.w && ny >= o.y && ny <= o.y + o.h;
        const plat = this.platforms.find(inside);
        const t = this.tile(c, r);
        const p = this.player;
        if (b.owner === 'player') {
          const m = this.monsters.find((m) => m.alive && inside({ x: m.x - 6, y: m.y - 8, w: m.w + 12, h: m.h + 12 }));
          if (m) {
            if (m.type === 'hat' && m.color === b.color) {
              this.events.push({ type: 'deflect', x: nx, y: ny, color: b.color });
            } else {
              m.stun = STUN_TIME; m.stunColor = b.color; m.warning = 0;
              this.events.push({ type: 'stun', x: nx, y: ny, color: b.color });
            }
            done = true;
            break;
          }
        } else if (b.color === YELLOW && this.state === 'play' && inside(p)) {
          // a yellow hat's shot changes your size
          if (this.setSize(p, p.size === 'big' ? 'small' : 'big')) {
            p.sizeCd = 20;
            this.events.push({ type: p.size === 'small' ? 'shrink' : 'grow', x: p.x + p.w / 2, y: p.y + p.h / 2 });
          }
          this.events.push({ type: 'splat', x: nx, y: ny, color: b.color, painted: false, quiet: true });
          done = true;
          break;
        }
        if (plat) {
          const painted = b.color !== PURPLE;
          if (painted) plat.color = b.color;
          this.events.push({ type: 'splat', x: b.x, y: b.y, color: b.color, painted });
          done = true;
        } else if (t === 'L') {
          this.events.push({ type: 'sizzle', x: nx, y: ny });
          done = true;
        } else if (t === '^') {
          this.events.push({ type: 'splat', x: nx, y: ny, color: b.color, painted: false });
          done = true;
        } else if (t === '#' || t === 'M') {
          // Which face did we hit? Only faces we came from, and only ones open to the air.
          const pc = Math.floor(b.x / T), pr = Math.floor(b.y / T);
          const vertical = pr < r ? 'top' : pr > r ? 'bottom' : null;
          const horizontal = pc < c ? 'left' : pc > c ? 'right' : null;
          const open = (f) => f && !this.solid(c + { left: -1, right: 1, top: 0, bottom: 0 }[f], r + { top: -1, bottom: 1, left: 0, right: 0 }[f]);
          let face;
          if (open(vertical) && !open(horizontal)) face = vertical;
          else if (open(horizontal) && !open(vertical)) face = horizontal;
          else if (vertical && horizontal) face = Math.abs(b.vy) > Math.abs(b.vx) ? vertical : horizontal;
          else face = vertical || horizontal || (b.vy > 0 ? 'top' : 'bottom');
          const painted = b.color === PURPLE ? this.placePortal(c, r, face) : this.paintFace(c, r, face, b.color);
          this.events.push({ type: b.color === PURPLE && painted ? 'portal' : 'splat', x: b.x, y: b.y, color: b.color, painted });
          done = true;
        } else {
          b.x = nx; b.y = ny;
        }
      }
      if (done) this.blobs.splice(i, 1);
    }
  }

  // Paints the hit tile plus its neighbours along the same exposed face.
  paintFace(c, r, face, color) {
    const painted = this.setPaint(c, r, color);
    const [oc, or] = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] }[face];
    const neighbours = (face === 'top' || face === 'bottom') ? [[c - 1, r], [c + 1, r]] : [[c, r - 1], [c, r + 1]];
    for (const [nc, nr] of neighbours) {
      if (this.tile(nc, nr) === '#' && !this.solid(nc + oc, nr + or)) this.setPaint(nc, nr, color);
    }
    return painted;
  }

  // ---- size (yellow) ----
  setSize(p, size) {
    const s = SIZES[size];
    // keep the wall you're stuck to touching you; otherwise stay centered
    const nx = p.cling === 1 ? p.x + p.w - s.w : p.cling === -1 ? p.x : p.x + p.w / 2 - s.w / 2;
    const ny = p.cling === 2 ? p.y : p.y + p.h - s.h; // keep feet (or hands, on a ceiling) in place
    if (this.rectHitsSolid(nx, ny, s.w, s.h)) return false;
    p.x = nx; p.y = ny; p.w = s.w; p.h = s.h; p.size = size;
    return true;
  }

  // ---- portals ----
  touchingPortal(p) {
    // a portal on a tile's top face is entered by standing on it (our 'down' side), etc.
    const sideFor = { top: 'down', bottom: 'up', left: 'right', right: 'left' };
    for (const portal of this.portals) {
      const [x, y, w, h] = this.probe(p, sideFor[portal.face]);
      if (overlap(x, y, w, h, portal.c * T, portal.r * T, T, T)) return portal;
    }
    return null;
  }

  teleport(p, from, to) {
    const speedInto = {
      top: Math.max(p.preVy, 0), bottom: Math.max(-p.preVy, 0),
      left: Math.max(p.preVx, 0), right: Math.max(-p.preVx, 0),
    }[from.face];
    const { c, r, face } = to;
    const cx = c * T + T / 2 - p.w / 2;
    const spots = {
      top: [[cx, r * T - p.h]],
      bottom: [[cx, (r + 1) * T]],
      left: [[c * T - p.w, r * T + T / 2 - p.h / 2], [c * T - p.w, r * T + T - p.h], [c * T - p.w, r * T]],
      right: [[(c + 1) * T, r * T + T / 2 - p.h / 2], [(c + 1) * T, r * T + T - p.h], [(c + 1) * T, r * T]],
    }[face];
    const spot = spots.find(([x, y]) => !this.rectHitsSolid(x, y, p.w, p.h));
    if (!spot) return false;
    const fx = p.x + p.w / 2, fy = p.y + p.h / 2;
    [p.x, p.y] = spot;
    p.cling = 0; p.ride = null; p.grounded = false; p.canCut = false; p.coyote = 0;
    if (face === 'top') { p.vy = -speedInto; }
    if (face === 'bottom') { p.vy = speedInto; }
    if (face === 'left') { p.vx = -Math.max(speedInto, 2); p.vy = Math.min(p.vy, 0); }
    if (face === 'right') { p.vx = Math.max(speedInto, 2); p.vy = Math.min(p.vy, 0); }
    this.events.push({ type: 'teleport', fx, fy, x: p.x + p.w / 2, y: p.y + p.h / 2 });
    return true;
  }

  // ---- monsters ----
  canSee(m, p) {
    const ex = m.x + m.w / 2, ey = m.y + 6;
    const tx = p.x + p.w / 2, ty = p.y + p.h / 2;
    const d = Math.hypot(tx - ex, ty - ey);
    if (d > m.range) return false;
    const steps = Math.ceil(d / 8);
    for (let i = 1; i < steps; i++) {
      const x = ex + (tx - ex) * i / steps, y = ey + (ty - ey) * i / steps;
      if (this.solid(Math.floor(x / T), Math.floor(y / T))) return false;
    }
    return true;
  }

  shoot(m, p) {
    // lob a blob at the player's feet (or body, when airborne or climbing): it flies through
    // the player and paints whatever is behind or under them
    const sx = m.x + m.w / 2, sy = m.y - 4;
    const tx = p.x + p.w / 2, ty = p.grounded ? p.y + p.h + 6 : p.y + p.h / 2;
    const t = Math.max(18, Math.min(45, Math.hypot(tx - sx, ty - sy) / 7));
    this.blobs.push({ x: sx, y: sy, vx: (tx - sx) / t, vy: (ty - sy) / t - 0.5 * BLOB_G * t, color: m.color, owner: 'monster' });
    this.events.push({ type: 'shoot', color: m.color });
  }

  stepMonsters() {
    const p = this.player;
    for (const m of this.monsters) {
      if (!m.alive) continue;
      if (m.stun > 0) m.stun--;

      if (m.type === 'inky' && !m.stun) {
        const speed = m.groundColor === RED ? MONSTERS.inky.redSpeed : MONSTERS.inky.speed;
        m.vx = m.groundColor === GREEN && m.grounded ? 0 : m.dir * speed;   // green glue
        if (m.grounded && m.groundColor === BLUE) m.vy = -9;                // blue hop
      } else {
        m.vx = 0;
      }
      m.vy = Math.min(m.vy + GRAV, MAX_FALL);
      const hx = this.moveX(m);
      if (hx) m.dir = -m.dir;
      const hy = this.moveY(m);
      m.grounded = !!(hy && hy.side === 1);
      if (m.grounded) { m.vy = 0; m.groundColor = hy.color; }
      else if (hy) m.vy = 0;

      if (m.type === 'inky' && m.grounded && m.vx !== 0) {
        // turn around at ledges
        const fx = m.dir > 0 ? m.x + m.w + 1 : m.x - 1;
        if (!this.rectHitsSolid(fx, m.y + m.h + 1, 1, 1)) m.dir = -m.dir;
      }

      if (m.type === 'hat') {
        if (this.state === 'play') m.dir = p.x + p.w / 2 > m.x + m.w / 2 ? 1 : -1;
        if (m.stun) continue;
        if (m.warning > 0) {
          if (--m.warning === 0) {
            if (this.state === 'play') this.shoot(m, p);
            m.cooldown = SHOT_COOLDOWN;
          }
        } else if (m.cooldown > 0) {
          m.cooldown--;
        } else if (this.state === 'play' && this.canSee(m, p)) {
          m.warning = SHOT_WARNING;
          this.events.push({ type: 'warn', x: m.x + m.w / 2, y: m.y });
        }
      }

      // monsters die on spikes, in lava, or falling out of the world
      if (m.y > H) m.alive = false;
      if (this.inLava(m)) {
        m.alive = false;
        this.events.push({ type: 'monsterDie', x: m.x + m.w / 2, y: m.y + m.h / 2, cause: 'lava' });
        continue;
      }
      for (const s of this.level.spikes) {
        if (overlap(m.x, m.y, m.w, m.h, s.c * T + 4, s.r * T + 4, T - 8, T - 8)) {
          m.alive = false;
          this.events.push({ type: 'monsterDie', x: m.x + m.w / 2, y: m.y + m.h / 2 });
          break;
        }
      }
    }
  }

  inLava(o) {
    for (const l of this.level.lava) {
      const top = l.r * T + (l.surface ? 12 : 0);
      if (overlap(o.x, o.y, o.w, o.h, l.c * T, top, T, (l.r + 1) * T - top)) return true;
    }
    return false;
  }

  // ---- player ----
  die(cause) {
    if (this.state !== 'play') return;
    const p = this.player;
    this.state = 'dead';
    this.timer = 0;
    this.deaths++;
    this.events.push({ type: 'die', x: p.x + p.w / 2, y: p.y + p.h / 2, cause });
  }

  stepPlayer(inp) {
    const p = this.player;
    this.movePlayer(inp);

    // which platform (if any) we are attached to, so it can carry us next frame
    p.ride = null;
    if (p.grounded) p.ride = this.platformTouching(p, 'down');
    else if (p.cling === 2) p.ride = this.platformTouching(p, 'up');
    else if (p.cling) p.ride = this.platformTouching(p, p.cling < 0 ? 'left' : 'right');

    // purple: step into one portal, come out of the other with the same speed
    // (latched until you step off, plus a short cooldown so you can't bounce straight back)
    const touch = this.touchingPortal(p);
    if (p.portalCd > 0) p.portalCd--;
    if (!touch) p.portalLatch = false;
    else if (p.portalCd > 0) p.portalLatch = true;
    else if (!p.portalLatch && this.portals.length === 2) {
      const other = this.portals.find((q) => q !== touch);
      if (this.teleport(p, touch, other)) { p.portalLatch = true; p.portalCd = 20; }
    }

    // yellow: toggle size once per touch
    // (a short cooldown stops the narrower body flickering on a yellow edge)
    const onYellow = ['down', 'up', 'left', 'right'].some((s) => this.touchingColor(p, s, YELLOW));
    if (p.sizeCd > 0) p.sizeCd--;
    if (!onYellow) p.yellowLatch = false;
    else if (p.sizeCd > 0) p.yellowLatch = true;
    else if (!p.yellowLatch && this.setSize(p, p.size === 'big' ? 'small' : 'big')) {
      p.yellowLatch = true;
      p.sizeCd = 20;
      this.events.push({ type: p.size === 'small' ? 'shrink' : 'grow', x: p.x + p.w / 2, y: p.y + p.h / 2 });
    }
  }

  movePlayer(inp) {
    const p = this.player;
    const size = SIZES[p.size];
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (dir) p.face = dir;
    if (inp.jumpPressed) p.jumpBuf = 7; else if (p.jumpBuf > 0) p.jumpBuf--;
    if (p.clingLock > 0) p.clingLock--;
    if (p.throwCd > 0) p.throwCd--;

    // Hanging from a green ceiling
    if (p.cling === 2) {
      if (!this.touchingColor(p, 'up', GREEN) || inp.down || inp.spacePressed) {
        p.cling = 0; p.clingLock = 14; p.jumpBuf = 0; p.vy = 1;
      } else {
        p.vx = dir * CEIL_SPEED; p.vy = 0;
        p.preVx = p.vx; p.preVy = -1;
        this.moveX(p);
        if (!this.touchingColor(p, 'up', GREEN)) { p.cling = 0; p.clingLock = 14; }
        return;
      }
    }

    // Stuck to a green wall
    if (p.cling === -1 || p.cling === 1) {
      const side = p.cling;
      const wallSide = side < 0 ? 'left' : 'right';
      if (!this.touchingColor(p, wallSide, GREEN)) {
        if (inp.up) { p.vy = -7; p.vx = side * 3; p.canCut = false; } // climb over the lip
        p.cling = 0; p.clingLock = 8;
      } else if (inp.spacePressed || (inp.jumpPressed && dir === -side)) {
        p.cling = 0; p.clingLock = 10; p.jumpBuf = 0;
        p.vx = -side * 6; p.vy = -size.jump * 0.95; p.canCut = true; p.face = -side;
        this.events.push({ type: 'jump' });
      } else if (dir === -side) {
        p.cling = 0; p.clingLock = 10; p.vx = -side * 2;
      } else {
        p.vx = 0;
        p.vy = inp.up ? -CLIMB : inp.down ? CLIMB : 0;
        p.preVx = side; p.preVy = p.vy;
        const hit = this.moveY(p);
        if (hit && hit.side === 1) { p.cling = 0; p.grounded = true; p.groundColor = hit.color; p.vy = 0; }
        if (hit && hit.side === -1) p.vy = 0;
        return;
      }
    }

    // Horizontal control
    const onRed = p.grounded && p.groundColor === RED;
    if (p.grounded) {
      const max = onRed ? RED_RUN : RUN;
      const target = dir * max;
      let acc = onRed ? 0.55 : 0.8;
      if (!dir) acc = onRed ? 0.3 : 0.8;
      else if (Math.abs(p.vx) > max && Math.sign(p.vx) === dir) acc = 0.3; // bleed off red speed slowly
      p.vx = approach(p.vx, target, acc);
    } else if (dir) {
      if (Math.sign(p.vx) === dir && Math.abs(p.vx) > RUN) p.vx -= dir * 0.02; // keep momentum
      else p.vx = approach(p.vx, dir * RUN, 0.45);
    } else {
      p.vx = approach(p.vx, 0, 0.12);
    }

    // Jumping (with coyote time + input buffer)
    if (p.grounded) p.coyote = 6; else if (p.coyote > 0) p.coyote--;
    if (p.jumpBuf > 0 && p.coyote > 0) {
      const blue = p.groundColor === BLUE;
      p.carry = p.ride ? p.ride.dx : 0;
      p.vy = blue ? -BOUNCE_V : -size.jump;
      p.canCut = !blue;
      p.grounded = false; p.coyote = 0; p.jumpBuf = 0;
      this.events.push({ type: blue ? 'bounce' : 'jump', x: p.x + p.w / 2, y: p.y + p.h });
    }
    if (!inp.jump && p.canCut && p.vy < -4) { p.vy = -4; p.canCut = false; }
    p.vy = Math.min(p.vy + GRAV, MAX_FALL);
    p.preVx = p.vx; p.preVy = p.vy;

    // Horizontal move + wall interactions
    if (p.grounded || p.cling) p.carry = 0;
    if (p.carry) {
      const vx = p.vx;
      p.vx = p.carry;
      if (this.moveX(p)) p.carry = 0;
      p.vx = vx;
    }
    const hx = this.moveX(p);
    if (hx) {
      const airborne = !p.grounded;
      if (hx.color === BLUE && airborne && Math.abs(p.vx) > 1.5) {
        p.vx = -hx.side * 7; p.vy = Math.min(p.vy, -7); p.canCut = false;
        this.events.push({ type: 'bounce', x: p.x + (hx.side > 0 ? p.w : 0), y: p.y + p.h / 2 });
      } else {
        p.vx = 0;
        if (hx.color === GREEN && airborne && p.clingLock === 0) {
          p.cling = hx.side; p.vy = 0;
          this.events.push({ type: 'stick' });
        }
      }
    } else if (!p.grounded && dir && p.clingLock === 0 &&
               this.touchingColor(p, dir < 0 ? 'left' : 'right', GREEN)) {
      p.cling = dir; p.vy = 0; p.vx = 0;
      this.events.push({ type: 'stick' });
    }

    // Vertical move + floor/ceiling interactions
    const fallSpeed = p.vy;
    const wasGrounded = p.grounded;
    p.grounded = false;
    if (p.cling) { p.groundColor = NONE; return; }
    const hy = this.moveY(p);
    if (hy && hy.side === 1) {
      p.vy = 0;
      p.grounded = true;
      p.groundColor = hy.color;
      if (hy.color === BLUE && !inp.down && fallSpeed > 2) {
        p.vy = -BOUNCE_V; p.grounded = false; p.canCut = false;
        p.carry = hy.plat ? hy.plat.dx : 0;
        this.events.push({ type: 'bounce', x: p.x + p.w / 2, y: p.y + p.h });
      } else if (!wasGrounded && fallSpeed > 4) {
        this.events.push({ type: 'land', x: p.x + p.w / 2, y: p.y + p.h, v: fallSpeed });
      }
    } else if (hy && hy.side === -1) {
      p.vy = 0;
      if (hy.color === GREEN && p.clingLock === 0) {
        p.cling = 2;
        this.events.push({ type: 'stick' });
      }
    }
    if (!p.grounded) p.groundColor = NONE;
  }

  checkHazards() {
    if (this.state !== 'play') return;
    const p = this.player;
    for (const s of this.level.spikes) {
      const x = s.c * T, y = s.r * T;
      const box = {
        up: [x + 4, y + 12, T - 8, T - 12],
        down: [x + 4, y, T - 8, T - 12],
        right: [x, y + 4, T - 12, T - 8],
        left: [x + 12, y + 4, T - 12, T - 8],
      }[s.dir];
      if (overlap(p.x, p.y, p.w, p.h, ...box)) { this.die(); return; }
    }
    if (p.y > H + 40 || p.y < -80) { this.die(); return; }
    if (this.inLava(p)) { this.die('lava'); return; }

    for (const m of this.monsters) {
      if (!m.alive || !overlap(p.x, p.y, p.w, p.h, m.x, m.y, m.w, m.h)) continue;
      const prevBottom = p.y + p.h - p.preVy;
      if (p.preVy > 0 && prevBottom <= m.y + 6) {
        // stomp!
        m.alive = false;
        p.vy = -9; p.canCut = false; p.grounded = false;
        this.events.push({ type: 'stomp', x: m.x + m.w / 2, y: m.y + m.h / 2 });
      } else {
        this.die();
        return;
      }
    }

    for (const can of this.cans) {
      if (!can.got && overlap(p.x, p.y, p.w, p.h, can.c * T + 6, can.r * T + 6, T - 12, T - 12)) {
        can.got = true;
        this.events.push({ type: 'can', x: can.c * T + T / 2, y: can.r * T + T / 2, n: this.cansCollected });
      }
    }

    const f = this.level.flag;
    if (overlap(p.x, p.y, p.w, p.h, f.c * T + 4, f.r * T - T, T - 8, T * 2)) {
      this.state = 'won';
      this.timer = 0;
      this.events.push({ type: 'win', x: f.c * T + T / 2, y: f.r * T });
    }
  }

  step(inp) {
    this.tick++;
    this.stepBlobs();
    this.stepPlatforms();
    this.stepMonsters();
    if (this.state === 'dead') {
      if (++this.timer > 40) { this.restart(); this.events.push({ type: 'respawn' }); }
      return;
    }
    if (this.state === 'won') { this.timer++; return; }
    this.frame++;
    this.stepPlayer(inp);
    this.checkHazards();
  }
}

if (typeof module !== 'undefined') {
  module.exports = { World, LEVELS, parseLevel, SIZES, T, COLS, ROWS, NONE, BLUE, RED, GREEN, YELLOW, PURPLE };
}
