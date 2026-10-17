'use strict';

// ============================================================
//  Sound: music tracks (music/*.mp3) + synthesized sound effects (Web Audio).
// ============================================================

const Sound = (() => {
  let ctx = null, master, sfxBus, noiseBuf;
  let musicOn = true;
  try { musicOn = JSON.parse(localStorage.getItem('paintRunner.music') ?? 'true'); } catch (e) { /* ignore */ }
  let sfxOn = true;
  try { sfxOn = JSON.parse(localStorage.getItem('paintRunner.sfx') ?? 'true'); } catch (e) { /* ignore */ }

  // Browsers only allow audio after a user gesture, so this runs on every key press / click.
  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      unlockTracks();
      applyMusic();  // retry anything the browser blocked earlier
      return;
    }
    if (!setup()) { unlockTracks(); return; }
    unlockTracks();
    applyMusic();
  }

  // Tries to start the music without a tap. Most browsers block sound until the player has touched
  // or pressed something; where they allow it (e.g. sites you visit often), the theme starts right
  // away. If it's blocked nothing changes, and the first tap or key starts it as usual.
  // Resolves true if sound is allowed now (so no tap is needed).
  function tryAutoplay() {
    if (ctx && ctx.state === 'running') return Promise.resolve(true);
    if (!setup()) return Promise.resolve(false);
    return ctx.resume().then(() => {
      if (ctx.state !== 'running') return false;
      unlockTracks();
      applyMusic();
      // only "allowed" if the menu music really started (a running audio engine isn't proof)
      return new Promise((r) => setTimeout(() => r(soundAllowed()), 350));
    }).catch(() => false);
  }

  // The Web Audio graph for sound effects and music (made once).
  function setup() {
    if (ctx) return true;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return false; }
    master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxOn ? 1 : 0; sfxBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) ctx.suspend(); else ctx.resume();
      applyMusic();
    });
    return true;
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

  // ---------- music ----------
  // Tracks (music/*.mp3): the menu, five level tracks (a different one each level), the boss chase,
  // and short cues for the opening and closing story.
  //
  // Two "decks" (audio elements) play them, crossfading from one to the other. iPhones only let an
  // audio element play if it was first started during a tap, so the two decks are unlocked on the
  // first tap and then reused for every track (a track downloads only when it's first needed).
  // Volume and fades go through Web Audio gain nodes: iPhones ignore an audio element's own volume.
  const NAMES = ['menu', 'level1', 'level2', 'level3', 'level4', 'level5', 'boss',
    'story-open-1', 'story-open-2', 'story-open-3', 'story-end-1', 'story-end-2', 'story-end-3'];
  const url = (name) => `music/${name}.mp3`;
  // How loud each file is (measured), and how loud each kind of music should come out: level music
  // sits under the sound effects, the boss chase a little higher, menus and story fuller.
  const LOUDNESS = { menu: 0.187, level1: 0.165, level2: 0.168, level3: 0.167, level4: 0.131, level5: 0.161, boss: 0.151,
    'story-open-1': 0.152, 'story-open-2': 0.15, 'story-open-3': 0.123, 'story-end-1': 0.123, 'story-end-2': 0.136, 'story-end-3': 0.128 };
  const TARGET = { menu: 0.073, level: 0.034, boss: 0.042, story: 0.075 };
  const volumeOf = (name) => {
    const kind = name === 'menu' ? 'menu' : name === 'boss' ? 'boss' : name.startsWith('story') ? 'story' : 'level';
    return Math.min(1, TARGET[kind] / (LOUDNESS[name] || 0.15));
  };
  const LOOPS = (name) => !name.startsWith('story');   // story cues play once (the panel moves on before they end)
  const FADE = 0.7;            // seconds
  const decks = [];            // { el, gain, name }
  let cur = 0;                 // the deck that plays (or should play) the wanted track
  let wanted = 'menu';         // which track the game currently wants
  let held = false;            // music waits (e.g. a phone held upright, before the game is turned sideways)
  let musicBus = null;
  const resumeAt = {};         // the menu picks up where it left off

  // a tiny silent sound, to unlock a deck that has nothing to play yet
  let silent = null;
  function silence() {
    if (silent) return silent;
    const n = 800, b = new ArrayBuffer(44 + n * 2), v = new DataView(b);
    const str = (o, t) => [...t].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true);
    v.setUint32(28, 16000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 2, true);
    silent = URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
    return silent;
  }

  function deck(i) {
    if (!decks[i]) {
      const el = new Audio();
      el.preload = 'auto';
      let gain = null;
      if (ctx) {
        try {
          if (!musicBus) { musicBus = ctx.createGain(); musicBus.connect(ctx.destination); }
          gain = ctx.createGain();
          gain.gain.value = 0;
          ctx.createMediaElementSource(el).connect(gain).connect(musicBus);
        } catch (e) { gain = null; }
      }
      if (!gain) el.volume = 0;
      decks[i] = { el, gain, name: null };
    }
    return decks[i];
  }
  // put a track on a deck (from the top, or where the menu was left)
  function load(d, name) {
    if (d.name === name) return;
    if (d.name === 'menu') resumeAt.menu = d.el.currentTime;
    d.name = name;
    d.el.src = url(name);
    d.el.loop = LOOPS(name);
    if (name === 'menu' && resumeAt.menu) { const t = resumeAt.menu; d.el.addEventListener('loadedmetadata', () => { try { d.el.currentTime = t; } catch (e) { /* ignore */ } }, { once: true }); }
  }
  const level = (d) => (d.gain ? d.gain.gain.value : d.el.volume);
  function setLevel(d, v, fade) {
    if (d.gain) {
      const g = d.gain.gain, now = ctx.currentTime;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(v, now + (fade ? FADE : 0.01));
    } else {
      d.el.volume = v;   // no fades here; the other deck is paused right away instead
    }
  }

  // Inside the first tap or key press both decks start (silently) and pause again, so later the game
  // can start them from its loop.
  let unlocked = false;
  function unlockTracks() {
    if (unlocked || !ctx || ctx.state !== 'running') return;
    unlocked = true;
    [0, 1].forEach((i) => {
      const d = deck(i);
      if (!d.el.paused) return;
      if (i === cur) load(d, wanted); else if (!d.name) d.el.src = silence();
      setLevel(d, 0, false);
      d.el.play()
        .then(() => { if (!(i === cur && musicOn && !held)) d.el.pause(); applyMusic(); })
        .catch(() => { unlocked = false; });   // try again on the next gesture
    });
  }
  // true once the browser lets us make sound: the audio engine runs and the wanted track plays
  // (or the player has turned music off)
  const soundAllowed = () => !!ctx && ctx.state === 'running' && unlocked &&
    (!musicOn || held || (decks[cur] && !decks[cur].el.paused));

  // Fades the wanted track in on its deck and the other deck out, then pauses the silent one.
  let fadeToken = 0;
  function applyMusic() {
    if (!ctx) return;  // nothing may play before the first click / key press
    const token = ++fadeToken;
    const on = musicOn && !document.hidden && !held;
    [0, 1].forEach((i) => {
      const d = deck(i);
      if (i === cur && on) {
        load(d, wanted);
        if (d.el.paused) d.el.play().catch(() => { });
        setLevel(d, volumeOf(wanted), true);
      } else if (!d.gain) {
        d.el.pause();                     // can't fade: stop at once so tracks never overlap
      } else if (!d.el.paused) {
        setLevel(d, 0, true);
        setTimeout(() => { if (token === fadeToken && !(i === cur && on)) d.el.pause(); }, FADE * 1000 + 50);
      }
    });
  }

  // Asks for a track by name. Switching to the track already playing keeps it going; anything else
  // crossfades on the other deck.
  function setTrack(name) {
    if (name === 'theme') name = 'menu';
    if (!NAMES.includes(name) || name === wanted) return;
    wanted = name;
    const other = 1 - cur;
    if (decks[other] && decks[other].name === name) cur = other;            // still fading out: bring it back
    else if (!(decks[cur] && decks[cur].name === name)) cur = other;        // the other deck takes the new track
    // levels and story cues start from the top (the menu picks up where it was)
    const d = decks[cur];
    if (d && d.name === name && name !== 'menu' && d.el.paused) { try { d.el.currentTime = 0; } catch (e) { /* ignore */ } }
    applyMusic();
  }
  // The level track for a level: a random one of the five, never the same as the previous level's.
  let lastLevelTrack = null;
  function pickLevelTrack() {
    const pool = ['level1', 'level2', 'level3', 'level4', 'level5'].filter((n) => n !== lastLevelTrack);
    lastLevelTrack = pool[Math.floor(Math.random() * pool.length)];
    return lastLevelTrack;
  }

  // Holds the music back (true) or lets it play (false). A tap while held still unlocks audio, so the
  // music can start the moment the hold ends - without needing another tap.
  function hold(on) {
    if (held === on) return;
    held = on;
    applyMusic();
  }

  function toggleMusic() {
    musicOn = !musicOn;
    try { localStorage.setItem('paintRunner.music', JSON.stringify(musicOn)); } catch (e) { /* ignore */ }
    applyMusic();
    return musicOn;
  }

  function setSfx(on) {
    sfxOn = !!on;
    try { localStorage.setItem('paintRunner.sfx', JSON.stringify(sfxOn)); } catch (e) { /* ignore */ }
    if (sfxBus) sfxBus.gain.value = sfxOn ? 1 : 0;
    return sfxOn;
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
    sizzle: () => noise(0.25, { vol: 0.08, type: 'highpass', freq: 3000 }),
    burn: () => { noise(0.5, { vol: 0.14, type: 'lowpass', freq: 900 }); tone(300, 0.5, { type: 'sawtooth', vol: 0.04, slideTo: 40 }); },
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
    init, tryAutoplay, soundAllowed, hold, sfx, toggleMusic, setTrack, pickLevelTrack,
    // (for checking what plays)
    get nowPlaying() { return { wanted, decks: decks.map((d) => d && { name: d.name, playing: !d.el.paused, vol: +(d.gain ? d.gain.gain.value : d.el.volume).toFixed(3) }) }; },
    get musicOn() { return musicOn; },
    get sfxOn() { return sfxOn; },
    setSfx,
  };
})();
