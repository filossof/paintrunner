'use strict';

// ============================================================
//  Sound: music tracks (music/*.mp3) + synthesized sound effects (Web Audio).
// ============================================================

const Sound = (() => {
  let ctx = null, master, sfxBus, noiseBuf;
  let musicOn = true;
  try { musicOn = JSON.parse(localStorage.getItem('paintRunner.music') ?? 'true'); } catch (e) { /* ignore */ }

  // Browsers only allow audio after a user gesture, so this runs on every key press / click.
  function init() {
    unlockTracks();
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      applyMusic();  // retry anything the browser blocked earlier
      return;
    }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) ctx.suspend(); else ctx.resume();
      applyMusic();
    });
    applyMusic();
  }

  // ---------- building blocks ----------
  function tone(freq, dur, { type = 'square', vol = 0.06, slideTo = null, when = 0, dest = sfxBus, filter = null } = {}) {
    if (!ctx) return;
    const t0 = Math.max(when, ctx.currentTime);
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = osc.connect(gain);
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = filter;
      node = node.connect(f);
    }
    node.connect(dest);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, { vol = 0.08, type = 'lowpass', freq = 1200, when = 0, dest = sfxBus } = {}) {
    if (!ctx) return;
    const t0 = Math.max(when, ctx.currentTime);
    const src = ctx.createBufferSource(), gain = ctx.createGain(), filt = ctx.createBiquadFilter();
    src.buffer = noiseBuf;
    filt.type = type; filt.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt).connect(gain).connect(dest);
    src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.02);
  }

  // ---------- music: two MP3 tracks, menu theme and level background ----------
  const TRACKS = { theme: 'music/theme.mp3', level: 'music/level.mp3' };
  // The level track sits under the sound effects; the menu theme can be fuller.
  const TRACK_VOLUME = { theme: 0.5, level: 0.22 };
  const FADE_MS = 700;
  const players = {};
  let wanted = 'theme';   // which track the game currently wants
  let fadeTimer = null;

  function track(name) {
    if (!players[name]) {
      const a = new Audio(TRACKS[name]);
      a.loop = true;
      a.preload = 'auto';
      a.volume = 0;
      players[name] = a;
    }
    return players[name];
  }

  // Some browsers (Safari especially) only let an audio element play if play() was first
  // called during a click or key press. Start every track silently inside the first
  // gesture so the level track can start later from the game loop.
  let unlocked = false;
  function unlockTracks() {
    if (unlocked) return;
    unlocked = true;
    for (const name of Object.keys(TRACKS)) {
      const a = track(name);
      if (!a.paused) continue;
      a.volume = 0;
      a.play()
        .then(() => { if (a.volume === 0 && name !== wanted) a.pause(); })
        .catch(() => { unlocked = false; }); // try again on the next gesture
    }
  }

  // Fades the wanted track in and every other track out.
  function applyMusic() {
    if (!ctx) return;  // nothing may play before the first click / key press
    clearInterval(fadeTimer);
    const target = (name) => (musicOn && name === wanted && !document.hidden ? TRACK_VOLUME[name] : 0);
    const all = Object.keys(TRACKS).map((n) => [n, track(n)]);
    for (const [name, a] of all) {
      if (target(name) > 0 && a.paused) a.play().catch(() => { });
    }
    const step = 0.5 / (FADE_MS / 30);
    fadeTimer = setInterval(() => {
      let done = true;
      for (const [name, a] of all) {
        const t = target(name);
        const v = a.volume < t ? Math.min(t, a.volume + step) : Math.max(t, a.volume - step);
        a.volume = v;
        if (v !== t) done = false;
        if (v === 0 && !a.paused) a.pause();
      }
      if (done) clearInterval(fadeTimer);
    }, 30);
  }

  // 'theme' on menus, 'level' while playing. Switching to the same track keeps it going.
  function setTrack(name) {
    if (name === wanted) return;
    // a fresh level track starts from the top; the theme resumes where it was
    if (name === 'level' && players.level && players.level.volume === 0) players.level.currentTime = 0;
    wanted = name;
    applyMusic();
  }

  function toggleMusic() {
    musicOn = !musicOn;
    try { localStorage.setItem('paintRunner.music', JSON.stringify(musicOn)); } catch (e) { /* ignore */ }
    applyMusic();
    return musicOn;
  }

  // ---------- sound effects ----------
  const sfx = {
    jump: () => tone(380, 0.12, { vol: 0.04, slideTo: 620 }),
    bounce: () => {
      tone(260, 0.3, { type: 'sine', vol: 0.12, slideTo: 900 });
      tone(520, 0.22, { type: 'triangle', vol: 0.04, slideTo: 1500 });
    },
    throw: () => {
      tone(700, 0.06, { type: 'triangle', vol: 0.03, slideTo: 300 });
      noise(0.05, { vol: 0.02, type: 'bandpass', freq: 2500 });
    },
    splat: () => { noise(0.14, { vol: 0.12, freq: 900 }); tone(160, 0.08, { type: 'sine', vol: 0.06, slideTo: 70 }); },
    clank: () => { tone(1400, 0.1, { vol: 0.025, slideTo: 1100 }); tone(2100, 0.06, { type: 'triangle', vol: 0.02 }); },
    stick: () => { noise(0.08, { vol: 0.07, freq: 500 }); tone(90, 0.08, { type: 'sine', vol: 0.06 }); },
    land: () => noise(0.06, { vol: 0.05, freq: 300 }),
    shrink: () => {
      const t = ctx ? ctx.currentTime : 0;
      [880, 660, 520, 390].forEach((f, i) => tone(f, 0.08, { type: 'square', vol: 0.035, when: t + i * 0.04, filter: 3000 }));
    },
    grow: () => {
      const t = ctx ? ctx.currentTime : 0;
      [260, 390, 520, 780].forEach((f, i) => tone(f, 0.1, { type: 'square', vol: 0.035, when: t + i * 0.045, filter: 3000 }));
    },
    die: () => { tone(400, 0.45, { type: 'sawtooth', vol: 0.05, slideTo: 50 }); noise(0.35, { vol: 0.1, freq: 600 }); },
    respawn: () => tone(500, 0.15, { type: 'sine', vol: 0.04, slideTo: 1000 }),
    win: () => {
      const t = ctx ? ctx.currentTime : 0;
      [523, 659, 784, 1047, 784, 1047].forEach((f, i) =>
        tone(f, i === 5 ? 0.5 : 0.16, { type: 'triangle', vol: 0.08, when: t + i * 0.09 }));
    },
    select: () => tone(880, 0.05, { type: 'sine', vol: 0.03 }),
    stomp: () => {
      tone(180, 0.15, { type: 'square', vol: 0.06, slideTo: 60, filter: 1500 });
      noise(0.12, { vol: 0.1, freq: 700 });
    },
    stun: () => {
      const t = ctx ? ctx.currentTime : 0;
      [1200, 900, 1200, 900].forEach((f, i) => tone(f, 0.05, { type: 'triangle', vol: 0.03, when: t + i * 0.05 }));
    },
    warn: () => tone(1500, 0.08, { type: 'square', vol: 0.025, filter: 2500 }),
    shoot: () => { tone(500, 0.12, { type: 'sawtooth', vol: 0.03, slideTo: 200, filter: 1800 }); noise(0.06, { vol: 0.04, freq: 1500 }); },
    can: () => {
      const t = ctx ? ctx.currentTime : 0;
      [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.12, { type: 'triangle', vol: 0.05, when: t + i * 0.05 }));
    },
    portal: () => { tone(300, 0.25, { type: 'sine', vol: 0.06, slideTo: 1200 }); tone(450, 0.2, { type: 'triangle', vol: 0.03, slideTo: 1800 }); },
    teleport: () => {
      tone(1600, 0.22, { type: 'sine', vol: 0.07, slideTo: 200 });
      noise(0.2, { vol: 0.05, type: 'bandpass', freq: 1800 });
    },
  };

  return {
    init, sfx, toggleMusic, setTrack,
    get musicOn() { return musicOn; },
  };
})();
