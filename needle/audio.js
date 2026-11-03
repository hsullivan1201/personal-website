// Every sound is synthesized, nothing to download. Off until you turn it on.

let ctx = null;
let enabled = false;

export function setSound(on) {
  enabled = on;
  if (on && !ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (on && ctx.state === 'suspended') ctx.resume();
}

function tone({ type = 'sine', from, to = from, dur = 0.2, vol = 0.15, delay = 0 }) {
  if (!enabled || !ctx) return;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(from, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noise(dur = 0.3, vol = 0.12, delay = 0) {
  if (!enabled || !ctx) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 1800;
  src.buffer = buf; g.gain.value = vol;
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(ctx.currentTime + delay);
}

export const sfx = {
  clunk: (v = 1) => tone({ type: 'square', from: 90, to: 50, dur: 0.07, vol: 0.05 * Math.min(1, v) }),
  // wah wah wah waaaah
  over: () => {
    [392, 370, 349].forEach((f, i) => tone({ type: 'sawtooth', from: f, to: f * 0.97, dur: 0.38, vol: 0.07, delay: i * 0.42 }));
    tone({ type: 'sawtooth', from: 330, to: 240, dur: 1.2, vol: 0.08, delay: 1.26 });
  },
  // an airhorn, roughly, if you squint with your ears
  back: () => {
    for (let i = 0; i < 3; i++) {
      tone({ type: 'sawtooth', from: 466, to: 470, dur: 0.22, vol: 0.06, delay: i * 0.26 });
      tone({ type: 'sawtooth', from: 587, to: 590, dur: 0.22, vol: 0.05, delay: i * 0.26 });
    }
    noise(0.25, 0.05, 0.78);
    [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', from: f, dur: 0.18, vol: 0.09, delay: 0.85 + i * 0.09 }));
  },
  ding: () => {
    tone({ type: 'sine', from: 1318, dur: 0.9, vol: 0.12 });
    tone({ type: 'sine', from: 1975, dur: 0.6, vol: 0.05, delay: 0.01 });
  },
};
