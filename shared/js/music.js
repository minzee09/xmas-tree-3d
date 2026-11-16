// Music-box BGM and sound effects, synthesized with Web Audio (no audio files).
// The carols are public-domain melodies. Every effect is silent while the music is switched off.

/** [midi note, beats]. C4 = 60. */
const SONGS = [
  { name: 'Jingle Bells', bpm: 150, notes: [
    [64,1],[64,1],[64,2], [64,1],[64,1],[64,2], [64,1],[67,1],[60,1.5],[62,.5], [64,4],
    [65,1],[65,1],[65,1.5],[65,.5], [65,1],[64,1],[64,1],[64,.5],[64,.5], [64,1],[62,1],[62,1],[64,1], [62,2],[67,2],
    [64,1],[64,1],[64,2], [64,1],[64,1],[64,2], [64,1],[67,1],[60,1.5],[62,.5], [64,4],
    [65,1],[65,1],[65,1.5],[65,.5], [65,1],[64,1],[64,1],[64,.5],[64,.5], [67,1],[67,1],[65,1],[62,1], [60,4],
  ] },
  { name: 'We Wish You a Merry Christmas', bpm: 132, notes: [
    [62,1], [67,1],[67,.5],[69,.5],[67,.5],[66,.5], [64,1],[64,1],[64,1],
    [69,1],[69,.5],[71,.5],[69,.5],[67,.5], [66,1],[62,1],[62,1],
    [71,1],[71,.5],[72,.5],[71,.5],[69,.5], [67,1],[64,1],[62,.5],[62,.5], [64,1],[69,1],[66,1], [67,2],
    [62,1], [67,1],[67,1],[67,1], [66,2],[66,1], [67,1],[66,1],[64,1], [62,2],[69,1],
    [71,1],[69,1],[67,1], [74,1],[62,1],[62,.5],[62,.5], [64,1],[69,1],[66,1], [67,3],
  ] },
  { name: 'Deck the Halls', bpm: 140, notes: [
    [67,1.5],[65,.5],[64,1],[62,1], [60,1],[62,1],[64,1],[60,1], [62,.5],[64,.5],[65,.5],[62,.5],[64,1.5],[62,.5], [60,1],[59,1],[60,2],
    [67,1.5],[65,.5],[64,1],[62,1], [60,1],[62,1],[64,1],[60,1], [62,.5],[64,.5],[65,.5],[62,.5],[64,1.5],[62,.5], [60,1],[59,1],[60,2],
    [62,1.5],[64,.5],[65,1],[62,1], [64,1.5],[65,.5],[67,1],[62,1], [64,.5],[66,.5],[67,1],[69,.5],[71,.5],[72,1], [71,1],[69,1],[67,2],
    [67,1.5],[65,.5],[64,1],[62,1], [60,1],[62,1],[64,1],[60,1], [69,.5],[69,.5],[69,.5],[69,.5],[67,1.5],[65,.5], [64,1],[62,1],[60,2],
  ] },
];

let ctx = null, master = null, timer = null;
let song = 0, idx = 0, nextTime = 0;
let playing = false;

function build() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.16;
  // soft echo so the music box rings in the room
  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.27;
  const feedback = ctx.createGain(); feedback.gain.value = 0.28;
  const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2600;
  const wet = ctx.createGain(); wet.gain.value = 0.35;
  master.connect(ctx.destination);
  master.connect(delay); delay.connect(tone); tone.connect(feedback); feedback.connect(delay);
  tone.connect(wet); wet.connect(ctx.destination);
  return true;
}

/** One music-box note: a sine with a few partials and a fast metallic tine. */
function pluck(t, midi, beats, secondsPerBeat) {
  const f = 440 * Math.pow(2, (midi + 12 - 69) / 12); // one octave up: music-box register
  const ring = Math.max(0.9, beats * secondsPerBeat * 1.6);
  const voices = [
    { type: 'sine', mul: 1, gain: 0.9, decay: ring },
    { type: 'sine', mul: 2, gain: 0.25, decay: ring * 0.6 },
    { type: 'sine', mul: 4.2, gain: 0.12, decay: 0.25 },
    { type: 'triangle', mul: 0.5, gain: 0.18, decay: ring * 0.8 },
  ];
  for (const v of voices) {
    const o = ctx.createOscillator(); o.type = v.type; o.frequency.value = f * v.mul;
    const g = envelope(t, v.gain, v.decay);
    o.connect(g); o.start(t); o.stop(t + v.decay + 0.05);
  }
}

/** Gain node with a quick attack and exponential decay, already connected to the output. */
function envelope(t, peak, decay, attack = 0.006) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  g.connect(master);
  return g;
}

/** Oscillator sweeping between frequencies. */
function sweep(t, type, freqs, peak, decay) {
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(freqs[0][1], t);
  for (const [dt, f] of freqs.slice(1)) o.frequency.exponentialRampToValueAtTime(f, t + dt);
  o.connect(envelope(t, peak, decay, 0.01));
  o.start(t); o.stop(t + decay + 0.03);
}

/** Decaying white noise through a low-pass filter. Returns the filter so callers can sweep it. */
function noise(t, dur, freq, gain) {
  const len = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = ctx.createGain(); g.gain.value = gain;
  src.connect(f); f.connect(g); g.connect(master); src.start(t);
  return f;
}

function schedule() {
  const ahead = ctx.currentTime + 0.25;
  while (nextTime < ahead) {
    const s = SONGS[song];
    const spb = 60 / s.bpm;
    if (idx >= s.notes.length) {
      song = (song + 1) % SONGS.length; // short breath, then the next carol
      idx = 0;
      nextTime += spb * 3;
      continue;
    }
    const [m, b] = s.notes[idx++];
    pluck(nextTime, m, b, spb);
    nextTime += b * spb;
  }
}

function start() {
  if (!ctx && !build()) return;
  if (ctx.state === 'suspended') ctx.resume();
  if (!timer) {
    if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.1;
    timer = setInterval(schedule, 60);
    schedule();
  }
  playing = true;
}

function stop() {
  playing = false;
  if (timer) { clearInterval(timer); timer = null; }
  if (ctx) ctx.suspend();
}

document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend();
  else if (playing) ctx.resume();
});

/** Wrap an effect so it only plays while the music is on. */
const sfx = (fn) => () => { if (playing && ctx) fn(ctx.currentTime + 0.01); };

export const Music = {
  start,
  stop,
  get playing() { return playing; },

  /** Rising arpeggio (opening a decorative present). */
  chime: sfx((t) => [60, 64, 67, 72, 76, 79].forEach((m, i) => pluck(t + i * 0.055, m, 1.2, 0.5))),

  /** Arpeggio + chord (a winning gift). */
  fanfare: sfx((t) => {
    [48, 52, 55, 60, 52, 55, 60, 64, 67, 72].forEach((m, i) => pluck(t + i * 0.07, m, 1.4, 0.5));
    [60, 64, 67, 72].forEach((m) => pluck(t + 0.78, m, 4, 0.5));
  }),

  /** Two falling notes (a losing gift). */
  bloop: sfx((t) => { pluck(t, 55, 1, 0.45); pluck(t + 0.2, 48, 2.5, 0.45); }),

  /** Springy boing (the reindeer pops over the result panel). */
  boing: sfx((t) => {
    sweep(t, 'sine', [[0, 220], [0.12, 780], [0.3, 420]], 0.7, 0.42);
    pluck(t + 0.32, 72, 1, 0.4); pluck(t + 0.4, 76, 1.5, 0.4);
  }),

  /** Short pop (the reindeer appears). */
  pop: sfx((t) => sweep(t, 'sine', [[0, 300], [0.08, 900]], 0.6, 0.14)),

  /** Rising whoosh (snowball thrown). */
  whoosh: sfx((t) => {
    const f = noise(t, 0.45, 600, 0.9);
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(3000, t + 0.42);
  }),

  /** Thud (snowball hits the screen). */
  splat: sfx((t) => {
    noise(t, 0.28, 1400, 1.6);
    sweep(t, 'sine', [[0, 140], [0.2, 50]], 0.9, 0.25);
  }),

  /** Four quick chirps (the reindeer laughs). */
  giggle: sfx((t) => {
    [0, 0.13, 0.26, 0.39].forEach((d, i) => {
      const f0 = 880 - i * 40;
      sweep(t + d, 'triangle', [[0, f0], [0.06, f0 * 1.35]], 0.25, 0.1);
    });
  }),
};

const ICON = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" stroke="none"/>
    <g class="on"><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></g>
    <g class="off"><path d="m16 9 5 6"/><path d="m21 9-5 6"/></g>
  </svg>`;

/**
 * Add the speaker toggle to `container`.
 * Browsers only allow sound after a gesture, so music starts on the first touch, click or key
 * anywhere on the page — unless the viewer switched it off on an earlier visit.
 */
export function initMusicButton(container) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'music';
  btn.innerHTML = ICON;
  container.prepend(btn);

  let wanted = true;
  try { wanted = localStorage.getItem('xmas-music') !== 'off'; } catch (_) { /* storage blocked */ }
  const remember = (v) => { try { localStorage.setItem('xmas-music', v); } catch (_) { /* storage blocked */ } };

  const reflect = () => {
    const label = playing ? '음악 끄기' : '음악 켜기';
    btn.setAttribute('aria-pressed', String(playing));
    btn.setAttribute('aria-label', label);
    btn.title = label;
  };
  reflect();

  btn.addEventListener('click', () => {
    if (playing) { stop(); remember('off'); } else { start(); remember('on'); }
    reflect();
  });

  const firstGesture = (e) => {
    window.removeEventListener('pointerdown', firstGesture, true);
    window.removeEventListener('keydown', firstGesture, true);
    if (btn.contains(e.target)) return;
    if (wanted && !playing) { start(); reflect(); }
  };
  window.addEventListener('pointerdown', firstGesture, true);
  window.addEventListener('keydown', firstGesture, true);
}
