'use strict';

// ============================================================
//  Sound: procedural chiptune music + sound effects (Web Audio).
//  No audio files - everything is synthesized on the fly.
// ============================================================

const Sound = (() => {
  let ctx = null, master, musicBus, sfxBus, noiseBuf;
  let musicOn = true;
  try { musicOn = JSON.parse(localStorage.getItem('paintRunner.music') ?? 'true'); } catch (e) { /* ignore */ }

  // Browsers only allow audio after a user gesture, so this runs on the first key/click.
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.55; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) ctx.suspend(); else ctx.resume();
    });
    if (musicOn) startMusic();
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

  const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const note = (n) => 12 * (Number(n.slice(-1)) + 1) + SEMI[n[0]] + (n[1] === '#' ? 1 : 0);

  // ---------- music ----------
  const BPM = 120, STEP = 60 / BPM / 4;  // 16th notes
  const CHORDS = {
    C: { root: 48, third: 4 }, G: { root: 43, third: 4 }, Am: { root: 45, third: 3 }, F: { root: 41, third: 4 },
  };
  const PROGRESSION = ['C', 'G', 'Am', 'F', 'Am', 'F', 'C', 'G'];
  // Lead melody in 8th notes, one string per bar ('-' = rest).
  const MELODY = [
    'E5 - G5 A5 G5 - E5 D5', 'D5 - G4 - B4 D5 - -', 'C5 - E5 A5 G5 - E5 C5', 'D5 - C5 A4 C5 - - -',
    'E5 - C5 E5 A5 - G5 E5', 'F5 - E5 C5 D5 - C5 A4', 'G5 - E5 G5 C6 - G5 E5', 'D5 - B4 D5 G5 - F5 D5',
  ].map((bar) => bar.split(' '));
  const BASS = { 0: 0, 4: 0, 7: 7, 8: 12, 12: 0, 14: 7 };
  const TOTAL_STEPS = PROGRESSION.length * 16;

  let step = 0, nextTime = 0, timer = null;

  function playStep(s, t) {
    const bar = Math.floor(s / 16), inBar = s % 16;
    const chord = CHORDS[PROGRESSION[bar]];
    const tones = [0, chord.third, 7, 12];

    if (BASS[inBar] !== undefined) {
      tone(midi(chord.root + BASS[inBar]), 0.22, { type: 'triangle', vol: 0.16, when: t, dest: musicBus });
    }
    if (inBar % 2 === 0) {
      const n = chord.root + 24 + tones[(inBar / 2) % 4];
      tone(midi(n), 0.09, { type: 'square', vol: 0.022, when: t, dest: musicBus, filter: 1800 });
    }
    if (inBar % 2 === 0) {
      const m = MELODY[bar][inBar / 2];
      if (m !== '-') tone(midi(note(m)), 0.24, { type: 'square', vol: 0.04, when: t, dest: musicBus, filter: 3200 });
    }
    // drums
    if (inBar === 0 || inBar === 8 || (inBar === 10 && bar % 2 === 1)) {
      tone(140, 0.16, { type: 'sine', vol: 0.3, slideTo: 40, when: t, dest: musicBus });
    }
    if (inBar === 4 || inBar === 12) {
      noise(0.12, { vol: 0.07, type: 'highpass', freq: 1500, when: t, dest: musicBus });
      tone(220, 0.07, { type: 'triangle', vol: 0.05, slideTo: 120, when: t, dest: musicBus });
    }
    if (inBar % 2 === 1) noise(0.03, { vol: 0.025, type: 'highpass', freq: 7000, when: t, dest: musicBus });
  }

  function schedule() {
    if (nextTime < ctx.currentTime - 0.2) nextTime = ctx.currentTime + 0.05; // tab was asleep
    while (nextTime < ctx.currentTime + 0.12) {
      playStep(step, nextTime);
      nextTime += STEP;
      step = (step + 1) % TOTAL_STEPS;
    }
  }
  function startMusic() {
    if (!ctx || timer) return;
    step = 0; nextTime = ctx.currentTime + 0.08;
    timer = setInterval(schedule, 25);
  }
  function stopMusic() { clearInterval(timer); timer = null; }

  function toggleMusic() {
    musicOn = !musicOn;
    try { localStorage.setItem('paintRunner.music', JSON.stringify(musicOn)); } catch (e) { /* ignore */ }
    if (musicOn) startMusic(); else stopMusic();
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
    init, sfx, toggleMusic,
    get musicOn() { return musicOn; },
  };
})();
