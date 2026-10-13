const B = require('./bot.js');
const { World, T, BLUE, RED, GREEN, YELLOW, NONE, S, target, run, lvl, toward, DONE } = B;
const { bounce } = require('./blue.js');
const { runJump } = require('./red.js');
const R = {};
const tr = (name) => (process.env.TRACE === name ? { trace: B.tracer(2) } : {});

// walk onto a yellow tile at column c (feet row r) until the size changes to `want`
const becomeSize = (want, c, r) => (w, m) => {
  const p = w.player;
  if (p.size === want) return DONE;
  if ((m.t = (m.t || 0) + 1) > 400) return { fail: `never became ${want}` };
  if (w.level.paint[r][c] !== YELLOW && !m.inner) { m.inner = S.paint(target.tile(c, r, YELLOW), YELLOW, `yellow ${c},${r}`); m.im = {}; }
  if (m.inner) { const res = m.inner(w, m.im); if (res !== DONE) return res; m.inner = null; }
  const x = c * T + T / 2, cx = p.x + p.w / 2;
  return { right: cx < x - 1, left: cx > x + 1, down: true };
};

// ---------- 29. Shrink Climb ----------
{
  const w = new World(lvl('Shrink Climb'));
  R['Shrink Climb'] = run(w, [
    S.paint(target.tile(10, 12, GREEN), GREEN, 'face low'),
    S.paint(target.tile(10, 9, GREEN), GREEN, 'face mid'),
    S.paint(target.tile(10, 7, GREEN), GREEN, 'face top'),
    S.fn(becomeSize('small', 5, 15)),
    S.walk(9.3 * T), S.wait(6),
    S.jump(() => ({ right: true }), { untilCling: true }),
    S.climb(6 * T),                                 // up the face, can (9,9), hop into the tunnel
    S.walk(14 * T),                                 // through the tunnel, can (12,5)
    S.fn(becomeSize('big', 16, 6)),                 // grow on the shelf (away from where we'll land)
    S.walk(19.5 * T), S.wait(8), S.jump(),          // can (20,4)
    S.walk(22.3 * T), S.wait(6),
    S.jump(toward(25 * T)),                         // over to the flag ledge
    S.toFlag(),
  ], tr('sc'));
}

// ---------- 31. Small Fry ----------
{
  const w = new World(lvl('Small Fry'));
  R['Small Fry'] = run(w, [
    S.fn(becomeSize('small', 3, 15)),
    S.walk(11.3 * T),                               // through tunnel 1, can (7,14)
    S.fn((w, m) => (w.player.size === 'small' ? DONE : becomeSize('small', 10, 15)(w, m))),
    S.walk(11.4 * T), S.wait(4),
    S.jump(toward(14.6 * T)),                       // hop the lava, can (12,13)
    S.stompAll([1]),                                // the Inky comes out of tunnel 2
    S.fn((w, m) => (w.player.size === 'small' ? DONE : becomeSize('small', 15, 15)(w, m))),
    S.walk(21.5 * T),                               // through tunnel 2
    S.fn((w, m) => (w.player.size === 'big' ? DONE : becomeSize('big', 22, 15)(w, m))),
    S.walk(23.5 * T), S.wait(8), S.jump(),          // can (23,12) needs the big jump
    S.toFlag(),
  ], tr('sf'));
}

// ---------- 32. Size Matters ----------
{
  const w = new World(lvl('Size Matters'));
  R['Size Matters'] = run(w, [
    S.paint(target.tile(3, 14, BLUE), BLUE, 'stage 1 pad'),
    S.walk(3.5 * T), S.wait(6),
    S.jump(() => ({}), { rebounce: false }),        // bounce straight up: can (3,7)
    S.fn(becomeSize('small', 4, 14)),
    S.walk(7.5 * T),                                // through the tunnel
    S.fn(becomeSize('big', 7, 14)),                 // grow back for the long jump and the stomp
    S.paint(target.stun(0), RED, 'stun the washer before painting'),
    S.paint(target.tile(10, 14, RED), RED, 'runway end'),
    S.paint(target.tile(8, 14, RED), RED, 'runway (covers the yellow)'),
    S.walk(7.4 * T), S.wait(4),
    S.fn(runJump(12 * T)),                          // over the lava, can (14,12)
    S.stompAll([1]),
    S.waitFor((w) => w.monsters[0].stun > 0 || w.monsters[0].cooldown > 40, 300),
    S.paint(target.stun(0), GREEN, 'stun the washer'),
    S.paint(target.tile(24, 11, GREEN), GREEN, 'pillar low'),
    S.paint(target.tile(24, 8, GREEN), GREEN, 'pillar mid'),
    S.paint(target.tile(24, 5, GREEN), GREEN, 'pillar high'),
    S.walk(23.4 * T), S.wait(4),
    S.jump(() => ({ right: true }), { untilCling: true }),
    S.climb(3 * T),                                 // can (23,4)
    S.toFlag(),
  ], process.env.ARC === 'sm' ? { trace: B.arcTracer([12]) } : tr('sm'));
}

module.exports = { R, becomeSize };
if (require.main === module) console.log(R);
