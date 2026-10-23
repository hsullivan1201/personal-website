/* the deep end — sound. beds and sfx are synthesized with webaudio; the music is
   streamed (tanner helland, cc by 4.0) through the same graph so it can go
   underwater with everything else. */
(function () {
  const AQ = (window.AQ = window.AQ || {});
  const A = (AQ.audio = {});
  let ctx = null, master, revIn, revOut, comp, masterLP;
  let muted = false;
  try { muted = localStorage.getItem("deepend-muted") === "1"; } catch (e) {}
  let beds = {};
  let scene = "street";
  let noise = {};

  A.isMuted = () => muted;
  A.live = () => !!ctx && ctx.state === "running" && !muted;
  A.now = () => (ctx ? ctx.currentTime : 0);

  A.start = function () {
    if (ctx) {
      if (ctx.state === "suspended") ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.85;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3.5;
    comp.attack.value = 0.01;
    comp.release.value = 0.25;
    masterLP = ctx.createBiquadFilter();
    masterLP.type = "lowpass";
    masterLP.frequency.value = 20000;
    masterLP.Q.value = 0.8;
    master.connect(masterLP);
    masterLP.connect(comp);
    comp.connect(ctx.destination);
    const rev = ctx.createConvolver();
    rev.buffer = impulse(3.6, 2.4);
    revIn = ctx.createGain();
    revOut = ctx.createGain();
    revOut.gain.value = 0.55;
    revIn.connect(rev);
    rev.connect(revOut);
    revOut.connect(master);
    noise.white = noiseBuf("white");
    noise.brown = noiseBuf("brown");
    noise.pink = noiseBuf("pink");
    buildBeds();
    A.setScene(scene, true);
    setInterval(tick, 25);
    randomEvents();
  };

  A.setMuted = function (m) {
    muted = m;
    try { localStorage.setItem("deepend-muted", m ? "1" : "0"); } catch (e) {}
    if (ctx) master.gain.setTargetAtTime(m ? 0 : 0.85, ctx.currentTime, 0.08);
    if (m && window.speechSynthesis) speechSynthesis.cancel();
  };

  // ---------- plumbing ----------
  function impulse(sec, decay) {
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        // early reflections, then a long concrete tail
        const er = i < ctx.sampleRate * 0.08 && Math.random() < 0.004 ? 1.8 : 0;
        d[i] = ((Math.random() * 2 - 1) + er) * Math.pow(1 - t, decay);
      }
    }
    return buf;
  }
  function noiseBuf(kind) {
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0, b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === "white") d[i] = w;
      else if (kind === "brown") {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else {
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.963 * b1 + w * 0.2965164;
        b2 = 0.57 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18;
      }
    }
    return buf;
  }
  // route a node to the master with a reverb send and optional pan
  function out(node, wet = 0.3, pan = 0, dry = 1) {
    let n = node;
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      n.connect(p);
      n = p;
    }
    if (dry > 0) {
      const g = ctx.createGain();
      g.gain.value = dry;
      n.connect(g);
      g.connect(master);
    }
    if (wet > 0) {
      const s = ctx.createGain();
      s.gain.value = wet;
      n.connect(s);
      s.connect(revIn);
    }
    return n;
  }
  function src(kind, rate = 1) {
    const s = ctx.createBufferSource();
    s.buffer = noise[kind];
    s.loop = true;
    s.playbackRate.value = rate;
    s.start(ctx.currentTime, Math.random() * 3);
    return s;
  }
  function filt(type, freq, q = 0.7) {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }
  function env(g, t, a, peak, d, end = 0.0001) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(end, t + a + d);
  }
  function osc(type, freq, t, dur) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // ---------- ambience beds ----------
  function lfo(param, rate, depth) {
    const o = ctx.createOscillator();
    o.frequency.value = rate;
    const g = ctx.createGain();
    g.gain.value = depth;
    o.connect(g);
    g.connect(param);
    o.start();
  }
  function buildBeds() {
    // city: distant traffic + wind
    {
      const s = src("brown", 0.7);
      const f = filt("lowpass", 380);
      const g = ctx.createGain();
      g.gain.value = 0;
      lfo(f.frequency, 0.07, 160);
      s.connect(f); f.connect(g);
      out(g, 0.05);
      beds.city = g;
    }
    // room tone: the big low hvac air of a station
    {
      const s = src("brown", 0.45);
      const f = filt("lowpass", 160);
      const g = ctx.createGain();
      g.gain.value = 0;
      s.connect(f); f.connect(g);
      out(g, 0.2);
      beds.room = g;
    }
    // mains hum + fluorescent buzz
    {
      const g = ctx.createGain();
      g.gain.value = 0;
      [60, 120, 180].forEach((fq, i) => {
        const o = ctx.createOscillator();
        o.type = i === 2 ? "sawtooth" : "sine";
        o.frequency.value = fq;
        const og = ctx.createGain();
        og.gain.value = [0.5, 0.3, 0.04][i];
        o.connect(og); og.connect(g);
        o.start();
      });
      out(g, 0.15);
      beds.hum = g;
    }
    // fountain: bright hiss, gently modulated
    {
      const s = src("white");
      const f = filt("bandpass", 1500, 0.5);
      const f2 = filt("highshelf", 4000);
      f2.gain.value = -8;
      const g = ctx.createGain();
      g.gain.value = 0;
      const am = ctx.createGain();
      am.gain.value = 0.8;
      lfo(am.gain, 0.6, 0.15);
      lfo(f.frequency, 0.23, 300);
      s.connect(f); f.connect(f2); f2.connect(am); am.connect(g);
      out(g, 0.45);
      beds.fountain = g;
    }
    // falls: the escalator waterfalls, a wider roar
    {
      const s = src("pink");
      const f = filt("lowpass", 2400);
      const hp = filt("highpass", 120);
      const g = ctx.createGain();
      g.gain.value = 0;
      s.connect(hp); hp.connect(f); f.connect(g);
      out(g, 0.5);
      beds.falls = g;
    }
    // lapping water: slow swells of low filtered noise
    {
      const s = src("pink", 0.8);
      const f = filt("lowpass", 700);
      const g = ctx.createGain();
      g.gain.value = 0;
      const am = ctx.createGain();
      am.gain.value = 0.6;
      lfo(am.gain, 0.17, 0.4);
      lfo(f.frequency, 0.11, 250);
      s.connect(f); f.connect(am); am.connect(g);
      out(g, 0.4);
      beds.lap = g;
    }
  }
  const PRESETS = {
    street: { city: 0.32, room: 0, hum: 0, fountain: 0.03, falls: 0, lap: 0, rev: 0.18, birds: 1, drips: 0 },
    gateOpen: { city: 0.22, room: 0.05, hum: 0, fountain: 0.05, falls: 0.16, lap: 0, rev: 0.3, birds: 1, drips: 0 },
    vault: { city: 0, room: 0.5, hum: 0.012, fountain: 0.2, falls: 0.03, lap: 0.12, rev: 0.75, birds: 0, drips: 1, pigeons: 1 },
    crossing: { city: 0, room: 0.45, hum: 0.012, fountain: 0.14, falls: 0.24, lap: 0.04, rev: 0.75, birds: 0, drips: 1 },
    dark: { city: 0, room: 0.3, hum: 0, fountain: 0.04, falls: 0, lap: 0.03, rev: 0.6, birds: 0, drips: 1 },
    mezz: { city: 0, room: 0.4, hum: 0.03, fountain: 0.1, falls: 0, lap: 0.05, rev: 0.6, birds: 0, drips: 1 },
    platform: { city: 0, room: 0.4, hum: 0.012, fountain: 0, falls: 0, lap: 0.32, rev: 0.6, birds: 0, drips: 1 },
    silent: { city: 0, room: 0, hum: 0, fountain: 0, falls: 0, lap: 0, rev: 0.5, birds: 0, drips: 0 },
  };
  let cur = PRESETS.street;
  A.setScene = function (name, instant) {
    scene = name;
    cur = PRESETS[name] || PRESETS.street;
    if (!ctx) return;
    const t = ctx.currentTime;
    for (const k in beds) beds[k].gain.setTargetAtTime(cur[k] || 0, t, instant ? 0.01 : 0.9);
    revOut.gain.setTargetAtTime(cur.rev, t, 0.6);
  };

  // birds, drips and pigeons sprinkled at random
  function randomEvents() {
    const loop = () => {
      if (ctx && ctx.state === "running") {
        if (cur.birds && Math.random() < 0.35) A.chirp();
        if (cur.drips && Math.random() < 0.55) A.drip();
        if (cur.pigeons && Math.random() < 0.05) A.coo();
      }
      setTimeout(loop, 500 + Math.random() * 1400);
    };
    loop();
  }

  // ---------- one-shots ----------
  A.chirp = function () {
    if (!A.live()) return;
    const t = ctx.currentTime;
    const n = 2 + Math.floor(Math.random() * 4);
    const base = 2800 + Math.random() * 1600;
    const pan = Math.random() * 1.6 - 0.8;
    for (let i = 0; i < n; i++) {
      const tt = t + i * (0.09 + Math.random() * 0.04);
      const o = osc("sine", base, tt, 0.08);
      o.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.3), tt + 0.03);
      o.frequency.exponentialRampToValueAtTime(base * 0.9, tt + 0.07);
      const g = ctx.createGain();
      env(g, tt, 0.006, 0.035, 0.07);
      o.connect(g);
      out(g, 0.1, pan);
    }
  };
  A.drip = function (vol = 1) {
    if (!A.live()) return;
    const t = ctx.currentTime;
    const f = 900 + Math.random() * 1500;
    const o = osc("sine", f, t, 0.2);
    o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.06);
    o.frequency.exponentialRampToValueAtTime(f * 1.1, t + 0.12);
    const g = ctx.createGain();
    env(g, t, 0.003, 0.05 * vol, 0.12);
    o.connect(g);
    out(g, 0.9, Math.random() * 1.4 - 0.7, 0.6);
  };
  A.coo = function () {
    if (!A.live()) return;
    const t = ctx.currentTime;
    const pan = Math.random() * 1.2 - 0.6;
    [0, 0.32, 0.5].forEach((d, i) => {
      const tt = t + d;
      const o = osc("sine", 420, tt, 0.3);
      o.frequency.setValueAtTime(380, tt);
      o.frequency.linearRampToValueAtTime(i === 1 ? 520 : 460, tt + 0.08);
      o.frequency.linearRampToValueAtTime(360, tt + 0.25);
      const v = ctx.createOscillator();
      v.frequency.value = 28;
      const vg = ctx.createGain();
      vg.gain.value = 18;
      v.connect(vg); vg.connect(o.frequency);
      v.start(tt); v.stop(tt + 0.35);
      const g = ctx.createGain();
      env(g, tt, 0.04, 0.05, 0.24);
      const f = filt("lowpass", 900);
      o.connect(f); f.connect(g);
      out(g, 0.6, pan, 0.7);
    });
  };
  A.tap = function () {
    if (!A.live()) return;
    const t = ctx.currentTime;
    [0, 0.11].forEach((d, i) => {
      const o = osc("square", i ? 1760 : 1568, t + d, 0.09);
      const f = filt("lowpass", 3500);
      const g = ctx.createGain();
      env(g, t + d, 0.004, 0.09, 0.08);
      o.connect(f); f.connect(g);
      out(g, 0.15);
    });
  };
  A.reject = function () {
    if (!A.live()) return;
    const t = ctx.currentTime;
    const o = osc("square", 220, t, 0.35);
    const g = ctx.createGain();
    env(g, t, 0.01, 0.06, 0.3);
    const f = filt("lowpass", 1200);
    o.connect(f); f.connect(g);
    out(g, 0.15);
  };
  A.grille = function (dur = 1.2) {
    if (!A.live()) return;
    const t = ctx.currentTime;
    const steps = Math.floor(dur / 0.035);
    for (let i = 0; i < steps; i++) {
      const tt = t + i * 0.035 + Math.random() * 0.01;
      const s = ctx.createBufferSource();
      s.buffer = noise.white;
      const f = filt("bandpass", 2200 + Math.random() * 2400, 3);
      const g = ctx.createGain();
      env(g, tt, 0.002, 0.18 * (1 - (i / steps) * 0.6), 0.03);
      s.connect(f); f.connect(g);
      out(g, 0.25);
      s.start(tt, Math.random() * 3, 0.06);
    }
    const m = osc("sawtooth", 70, t, dur);
    m.frequency.linearRampToValueAtTime(95, t + dur);
    const mf = filt("lowpass", 300);
    const mg = ctx.createGain();
    env(mg, t, 0.1, 0.12, dur);
    m.connect(mf); mf.connect(mg);
    out(mg, 0.2);
    // final clunk
    A.thud(t + dur, 0.5);
  };
  A.thud = function (at, vol = 1) {
    if (!A.live()) return;
    const t = at || ctx.currentTime;
    const o = osc("sine", 110, t, 0.3);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.2);
    const g = ctx.createGain();
    env(g, t, 0.004, 0.5 * vol, 0.25);
    o.connect(g);
    out(g, 0.5);
    const s = ctx.createBufferSource();
    s.buffer = noise.white;
    const f = filt("bandpass", 900, 1.2);
    const g2 = ctx.createGain();
    env(g2, t, 0.002, 0.25 * vol, 0.06);
    s.connect(f); f.connect(g2);
    out(g2, 0.4);
    s.start(t, Math.random(), 0.1);
  };
  A.whoosh = function (dur = 1.2, up = true) {
    if (!A.live()) return;
    const t = ctx.currentTime;
    const s = src("pink");
    const f = filt("bandpass", up ? 250 : 2400, 0.9);
    f.frequency.exponentialRampToValueAtTime(up ? 2600 : 200, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g);
    out(g, 0.5);
    s.stop(t + dur + 0.1);
  };
  A.plop = function (pan = 0, big = 1) {
    if (!A.live()) return;
    const t = ctx.currentTime;
    const o = osc("sine", 820 * (1.1 - big * 0.2), t, 0.25);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.14);
    const g = ctx.createGain();
    env(g, t, 0.004, 0.28 * big, 0.18);
    o.connect(g);
    out(g, 0.6, pan);
    const s = ctx.createBufferSource();
    s.buffer = noise.white;
    const f = filt("highpass", 1800);
    const g2 = ctx.createGain();
    env(g2, t + 0.02, 0.005, 0.12 * big, 0.25);
    s.connect(f); f.connect(g2);
    out(g2, 0.6, pan);
    s.start(t, Math.random(), 0.4);
  };
  A.splash = function (pan = 0) {
    if (!A.live()) return;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = noise.pink;
    const f = filt("lowpass", 5000);
    f.frequency.exponentialRampToValueAtTime(600, t + 0.9);
    const g = ctx.createGain();
    env(g, t, 0.01, 0.5, 0.9);
    s.connect(f); f.connect(g);
    out(g, 0.7, pan);
    s.start(t, Math.random(), 1.2);
    for (let i = 0; i < 6; i++) setTimeout(() => A.drip(1.6), 120 + Math.random() * 600);
  };
  A.quack = function (pan = 0) {
    if (!A.live()) return;
    const t = ctx.currentTime;
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const tt = t + i * 0.22;
      const o = osc("sawtooth", 300, tt, 0.2);
      o.frequency.setValueAtTime(330, tt);
      o.frequency.linearRampToValueAtTime(240, tt + 0.16);
      const f1 = filt("bandpass", 1150, 5);
      const f2 = filt("bandpass", 2300, 6);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, tt);
      g.gain.exponentialRampToValueAtTime(0.5, tt + 0.02);
      g.gain.setValueAtTime(0.45, tt + 0.1);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.19);
      o.connect(f1); o.connect(f2);
      f1.connect(g); f2.connect(g);
      out(g, 0.5, pan);
    }
  };
  // a bell partial stack
  function bell(t, f, vol, decay, pan = 0, wet = 0.5) {
    [[1, 1], [2.0, 0.35], [3.01, 0.18], [4.2, 0.08]].forEach(([r, a]) => {
      const o = osc("sine", f * r, t, decay);
      const g = ctx.createGain();
      env(g, t, 0.004, vol * a, decay / r);
      o.connect(g);
      out(g, wet, pan);
    });
  }
  // the door chime: a descending bing-bong
  A.chime = function () {
    if (!A.live()) return;
    const t = ctx.currentTime;
    bell(t, 659.25, 0.22, 1.4);
    bell(t + 0.42, 523.25, 0.22, 1.8);
  };
  A.clunk = function (n = 0) {
    if (!A.live()) return;
    const t = ctx.currentTime;
    A.thud(t, 0.7);
    // tube strike: ping + crackle
    const o = osc("sine", 3100 + n * 230, t + 0.05, 0.4);
    const g = ctx.createGain();
    env(g, t + 0.05, 0.004, 0.03, 0.35);
    o.connect(g);
    out(g, 0.6, n % 2 ? 0.5 : -0.5);
    for (let i = 0; i < 5; i++) {
      const tt = t + 0.04 + Math.random() * 0.25;
      const s = ctx.createBufferSource();
      s.buffer = noise.white;
      const f = filt("bandpass", 4000, 2);
      const g2 = ctx.createGain();
      env(g2, tt, 0.001, 0.08, 0.02);
      s.connect(f); f.connect(g2);
      out(g2, 0.3, n % 2 ? 0.5 : -0.5);
      s.start(tt, Math.random() * 3, 0.03);
    }
  };
  A.lightsOut = function () {
    if (!A.live()) return;
    const t = ctx.currentTime;
    const o = osc("sawtooth", 120, t, 0.6);
    o.frequency.exponentialRampToValueAtTime(30, t + 0.5);
    const f = filt("lowpass", 900);
    const g = ctx.createGain();
    env(g, t, 0.01, 0.08, 0.5);
    o.connect(f); f.connect(g);
    out(g, 0.5);
    A.thud(t + 0.05, 0.9);
  };
  A.ignite = function (i) {
    if (!A.live()) return;
    const t = ctx.currentTime;
    const notes = [62, 66, 69, 73, 74, 78, 81];
    bell(t, mtof(notes[i % notes.length] + 12), 0.06, 1.6, i % 2 ? 0.6 : -0.6, 0.8);
    const s = ctx.createBufferSource();
    s.buffer = noise.pink;
    const f = filt("bandpass", 600, 1);
    f.frequency.exponentialRampToValueAtTime(3000, t + 0.25);
    const g = ctx.createGain();
    env(g, t, 0.02, 0.12, 0.3);
    s.connect(f); f.connect(g);
    out(g, 0.4, i % 2 ? 0.6 : -0.6);
    s.start(t, Math.random(), 0.5);
  };
  A.shimmer = function (rise = true) {
    if (!A.live()) return;
    const t = ctx.currentTime;
    const scale = [74, 76, 79, 81, 83, 86, 88, 91];
    scale.forEach((m, i) => {
      const k = rise ? i : scale.length - 1 - i;
      bell(t + k * 0.07, mtof(m), 0.035, 1.8, (i / scale.length) * 1.2 - 0.6, 0.8);
    });
    // water gurgle
    const s = src("white");
    const f = filt("bandpass", 500, 6);
    const g = ctx.createGain();
    env(g, t, 0.1, 0.25, 1.3);
    const wob = ctx.createOscillator();
    wob.type = "square";
    wob.frequency.value = 9;
    const wg = ctx.createGain();
    wg.gain.value = 300;
    wob.connect(wg); wg.connect(f.frequency);
    wob.start(t); wob.stop(t + 1.5);
    s.connect(f); f.connect(g);
    out(g, 0.5);
    s.stop(t + 1.6);
  };
  A.ui = function () {
    if (!A.live()) return;
    const t = ctx.currentTime;
    const o = osc("triangle", 2200, t, 0.05);
    const g = ctx.createGain();
    env(g, t, 0.002, 0.05, 0.04);
    o.connect(g);
    out(g, 0.1);
  };
  // trains: rumble, clack, brake squeal
  A.train = function (arrive = true, dur = 5, vol = 1) {
    if (!A.live()) return;
    const t = ctx.currentTime;
    const s = src("brown");
    const f = filt("lowpass", 120);
    const g = ctx.createGain();
    if (arrive) {
      f.frequency.setValueAtTime(90, t);
      f.frequency.exponentialRampToValueAtTime(700, t + dur * 0.6);
      f.frequency.exponentialRampToValueAtTime(150, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.9 * vol, t + dur * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    } else {
      f.frequency.setValueAtTime(200, t);
      f.frequency.exponentialRampToValueAtTime(800, t + dur * 0.3);
      f.frequency.exponentialRampToValueAtTime(90, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.9 * vol, t + dur * 0.25);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    }
    s.connect(f); f.connect(g);
    out(g, 0.5);
    s.stop(t + dur + 0.2);
    // wheel clacks speeding up (depart) or slowing (arrive)
    let tt = t + 0.2;
    let gap = arrive ? 0.18 : 0.7;
    while (tt < t + dur - 0.3) {
      const k = (tt - t) / dur;
      const k2 = arrive ? Math.sin(k * Math.PI) : Math.sin(Math.min(1, k * 1.4) * Math.PI);
      for (const d of [0, 0.07]) {
        const c = ctx.createBufferSource();
        c.buffer = noise.white;
        const cf = filt("bandpass", 1300, 2);
        const cg = ctx.createGain();
        env(cg, tt + d, 0.002, (0.18 * k2 + 0.001) * vol, 0.05);
        c.connect(cf); cf.connect(cg);
        out(cg, 0.4);
        c.start(tt + d, Math.random() * 3, 0.08);
      }
      tt += gap;
      gap = arrive ? gap * 1.09 : Math.max(0.16, gap * 0.86);
    }
    if (arrive) {
      const sq = osc("sine", 2900, t + dur * 0.55, dur * 0.4);
      const v = ctx.createOscillator();
      v.frequency.value = 7;
      const vg = ctx.createGain();
      vg.gain.value = 40;
      v.connect(vg); vg.connect(sq.frequency);
      v.start(t + dur * 0.55); v.stop(t + dur);
      const sg = ctx.createGain();
      sg.gain.setValueAtTime(0.0001, t + dur * 0.55);
      sg.gain.exponentialRampToValueAtTime(0.03 * vol, t + dur * 0.7);
      sg.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.95);
      sq.connect(sg);
      out(sg, 0.6);
    }
  };
  // doors opening/closing hiss
  A.doors = function () {
    if (!A.live()) return;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = noise.white;
    const f = filt("highpass", 2500);
    const g = ctx.createGain();
    env(g, t, 0.03, 0.12, 0.6);
    s.connect(f); f.connect(g);
    out(g, 0.4);
    s.start(t, Math.random(), 0.8);
    A.thud(t + 0.7, 0.4);
  };

  // ---------- the pa ----------
  let voice = null;
  function pickVoice() {
    if (!window.speechSynthesis) return null;
    const vs = speechSynthesis.getVoices();
    if (!vs.length) return null;
    const pref = [/Samantha/i, /Google US English/i, /Aria/i, /Jenny/i, /Zira/i, /en-US/i, /en/i];
    for (const p of pref) {
      const v = vs.find((v) => p.test(v.name) || p.test(v.lang));
      if (v) return v;
    }
    return vs[0];
  }
  if (window.speechSynthesis) {
    speechSynthesis.onvoiceschanged = () => { voice = pickVoice(); };
  }
  A.announce = function (text, chime = true) {
    if (!A.live() || !window.speechSynthesis) return;
    speechSynthesis.cancel();
    if (chime) A.chime();
    setTimeout(() => {
      if (!A.live()) return;
      const u = new SpeechSynthesisUtterance(text);
      voice = voice || pickVoice();
      if (voice) u.voice = voice;
      u.rate = 0.93;
      u.pitch = 0.92;
      u.volume = 0.85;
      speechSynthesis.speak(u);
    }, chime ? 1100 : 0);
  };

  // ---------- step sequencer ----------
  let seq = null; // {bpm, swing, step, next, fn}
  function tick() {
    if (!ctx || !seq) return;
    const ahead = ctx.currentTime + 0.12;
    while (seq && seq.next < ahead) {
      const sixteenth = 60 / seq.bpm / 4;
      const sw = seq.step % 2 ? sixteenth * (seq.swing || 0) : 0;
      seq.fn(seq.step, seq.next + sw);
      if (seq.onStep) {
        const st = seq.step, at = seq.next + sw;
        setTimeout(() => seq && seq.onStep && seq.onStep(st), Math.max(0, (at - ctx.currentTime) * 1000));
      }
      seq.step++;
      seq.next += sixteenth;
    }
  }
  function startSeq(s) {
    if (!ctx) return;
    seq = Object.assign({ step: 0, next: ctx.currentTime + 0.08 }, s);
  }
  A.stopAll = function () {
    seq = null;
  };

  // ---------- music: streamed songs, one per station, crossfaded ----------
  const SONGS = {
    destiny: { title: "Destiny", file: "music/destiny.mp3" },
    deeper: { title: "Deeper", file: "music/deeper.mp3" },
    syntheticity: { title: "Syntheticity", file: "music/syntheticity.mp3" },
    nevermore: { title: "Nevermore", file: "music/nevermore.mp3" },
    faith: { title: "Faith (love remix)", file: "music/faith-love-remix.mp3" },
    islands: { title: "Lost Islands", file: "music/lost-islands.mp3" },
  };
  A.songs = SONGS;
  let song = null; // { key, el, gain }
  let musicBus = null, duck = null;
  A.onSong = null;
  A.nowSong = () => (song ? song.key : null);
  function musicGraph() {
    if (musicBus) return;
    duck = ctx.createGain();
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.55;
    musicBus.connect(duck);
    duck.connect(master);
    const send = ctx.createGain();
    send.gain.value = 0.12;
    duck.connect(send);
    send.connect(revIn);
  }
  A.playSong = function (key, fade = 2.5) {
    if (!ctx || !SONGS[key]) return;
    if (song && song.key === key) return;
    musicGraph();
    const t = ctx.currentTime;
    if (song) {
      const old = song;
      old.gain.gain.cancelScheduledValues(t);
      old.gain.gain.setValueAtTime(old.gain.gain.value, t);
      old.gain.gain.linearRampToValueAtTime(0, t + fade);
      setTimeout(() => { old.el.pause(); old.el.src = ""; try { old.node.disconnect(); } catch (e) {} }, fade * 1000 + 200);
    }
    const el = new Audio(SONGS[key].file);
    el.loop = true;
    el.preload = "auto";
    const node = ctx.createMediaElementSource(el);
    const g = ctx.createGain();
    g.gain.value = 0;
    node.connect(g);
    g.connect(musicBus);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1, t + fade);
    el.play().catch(() => {});
    song = { key, el, gain: g, node };
    if (A.onSong) A.onSong(SONGS[key]);
  };
  A.stopSong = function (fade = 1.5) {
    if (!song || !ctx) return;
    const old = song;
    song = null;
    old.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + fade);
    setTimeout(() => { old.el.pause(); old.el.src = ""; }, fade * 1000 + 200);
    if (A.onSong) A.onSong(null);
  };
  A.duckSong = function (on) {
    if (!duck) return;
    duck.gain.setTargetAtTime(on ? 0.12 : 1, ctx.currentTime, 0.3);
  };
  // everything goes muffled and slow when you're below the surface
  A.underwater = function (on, time = 1.2) {
    if (!ctx) return;
    masterLP.frequency.cancelScheduledValues(ctx.currentTime);
    masterLP.frequency.setTargetAtTime(on ? 620 : 20000, ctx.currentTime, time / 3);
    revOut.gain.setTargetAtTime(on ? 1.1 : cur.rev, ctx.currentTime, time / 3);
  };

  // ---------- the mystical bits ----------
  // jellyfish: soft glass bells on a d major pentatonic, drowned in reverb
  const JELLY = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83];
  A.jelly = function (i, pan = 0) {
    if (!A.live()) return;
    const t = ctx.currentTime;
    const f = mtof(JELLY[((i % JELLY.length) + JELLY.length) % JELLY.length]);
    const c = osc("sine", f, t, 3);
    const m = osc("sine", f * 2.01, t, 3);
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(f * 1.2, t);
    mg.gain.exponentialRampToValueAtTime(f * 0.02, t + 1.6);
    m.connect(mg); mg.connect(c.frequency);
    const g = ctx.createGain();
    env(g, t, 0.01, 0.07, 2.8);
    c.connect(g);
    out(g, 0.9, pan, 0.5);
    const sh = osc("sine", f * 4, t, 1);
    const sg = ctx.createGain();
    env(sg, t, 0.005, 0.015, 0.8);
    sh.connect(sg);
    out(sg, 1, -pan, 0.3);
  };
  // a glossy bubble popping
  A.pop = function (pan = 0) {
    if (!A.live()) return;
    const t = ctx.currentTime;
    const f = 500 + Math.random() * 500;
    const o = osc("sine", f, t, 0.15);
    o.frequency.exponentialRampToValueAtTime(f * 2.6, t + 0.07);
    const g = ctx.createGain();
    env(g, t, 0.003, 0.12, 0.09);
    o.connect(g);
    out(g, 0.5, pan);
  };
  // a coin flipped into a fountain: ting, ting, plop
  A.coin = function (pan = 0) {
    if (!A.live()) return;
    const t = ctx.currentTime;
    [0, 0.09, 0.15].forEach((d, i) => {
      [1, 2.76, 5.4].forEach((r, k) => {
        const o = osc("sine", 2600 * r * (1 - i * 0.03), t + d, 0.5);
        const g = ctx.createGain();
        env(g, t + d, 0.001, (0.06 / (k + 1)) * (1 - i * 0.3), 0.35 / (k + 1));
        o.connect(g);
        out(g, 0.4, pan);
      });
    });
    setTimeout(() => A.plop(pan, 0.6), 650);
  };
  // the dive: a big splash, then bubbles boiling past the ears
  A.dive = function () {
    if (!A.live()) return;
    A.splash(0);
    const t = ctx.currentTime;
    for (let i = 0; i < 40; i++) {
      const tt = t + 0.3 + Math.random() * 1.8;
      const f = 300 + Math.random() * 900;
      const o = osc("sine", f, tt, 0.12);
      o.frequency.exponentialRampToValueAtTime(f * 1.8, tt + 0.06);
      const g = ctx.createGain();
      env(g, tt, 0.004, 0.05 + Math.random() * 0.05, 0.08);
      o.connect(g);
      out(g, 0.6, Math.random() * 1.6 - 0.8);
    }
    const s = src("brown", 0.6);
    const f = filt("lowpass", 300);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.6, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
    s.connect(f); f.connect(g);
    out(g, 0.6);
    s.stop(t + 3.2);
  };
  // a long, glassy swell for strange moments
  A.swell = function (root = 50) {
    if (!A.live()) return;
    const t = ctx.currentTime;
    [0, 7, 12, 16, 19].forEach((iv, i) => {
      const o = osc(i % 2 ? "triangle" : "sine", mtof(root + iv), t, 5);
      o.detune.value = (Math.random() - 0.5) * 12;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.03, t + 1.8);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 5);
      o.connect(g);
      out(g, 1, (i - 2) * 0.3, 0.4);
    });
  };

  // ---------- bucket go-go ----------
  // a swung pocket at ~95bpm: bucket bottoms for kick, rims for snare, congas, cowbell.
  function bucket(t, low, vol) {
    const o = osc("sine", low ? 130 : 210, t, 0.25);
    o.frequency.exponentialRampToValueAtTime(low ? 55 : 120, t + 0.12);
    const g = ctx.createGain();
    env(g, t, 0.002, vol, low ? 0.22 : 0.12);
    o.connect(g);
    out(g, 0.25, low ? 0 : -0.2);
    const s = ctx.createBufferSource();
    s.buffer = noise.white;
    const f = filt("bandpass", low ? 400 : 900, 1.5);
    const g2 = ctx.createGain();
    env(g2, t, 0.001, vol * 0.4, 0.04);
    s.connect(f); f.connect(g2);
    out(g2, 0.2);
    s.start(t, Math.random() * 3, 0.06);
  }
  function rim(t, vol) {
    const s = ctx.createBufferSource();
    s.buffer = noise.white;
    const f = filt("bandpass", 1900, 1.3);
    const g = ctx.createGain();
    env(g, t, 0.001, vol, 0.11);
    s.connect(f); f.connect(g);
    out(g, 0.35, 0.15);
    s.start(t, Math.random() * 3, 0.15);
    const o = osc("triangle", 330, t, 0.08);
    const og = ctx.createGain();
    env(og, t, 0.001, vol * 0.4, 0.06);
    o.connect(og);
    out(og, 0.2, 0.15);
  }
  function conga(t, hi, vol) {
    const f = hi ? 330 : 220;
    const o = osc("sine", f * 1.25, t, 0.25);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
    const g = ctx.createGain();
    env(g, t, 0.002, vol, hi ? 0.18 : 0.26);
    o.connect(g);
    out(g, 0.25, hi ? 0.45 : 0.3);
  }
  function cowbell(t, hi, vol) {
    const g = ctx.createGain();
    env(g, t, 0.001, vol, 0.22);
    const f = filt("bandpass", hi ? 900 : 700, 2.5);
    [hi ? 587 : 540, hi ? 845 : 800].forEach((fq) => {
      const o = osc("square", fq, t, 0.25);
      o.connect(f);
    });
    f.connect(g);
    out(g, 0.25, -0.45);
  }
  function hat(t, vol) {
    const s = ctx.createBufferSource();
    s.buffer = noise.white;
    const f = filt("highpass", 7500);
    const g = ctx.createGain();
    env(g, t, 0.001, vol, 0.04);
    s.connect(f); f.connect(g);
    out(g, 0.1, 0.2);
    s.start(t, Math.random() * 3, 0.06);
  }
  const GOGO = {
    kick: [1, 0, 0, 0, 0, 0, 0.7, 0, 0, 0, 1, 0, 0, 0, 0, 0.5],
    snare: [0, 0, 0, 0, 1, 0, 0, 0.25, 0, 0.2, 0, 0, 1, 0, 0, 0.3],
    hat: [1, 0, 0.6, 0, 1, 0, 0.6, 0, 1, 0, 0.6, 0, 1, 0, 0.6, 0.8],
    congaHi: [0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 1],
    congaLo: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0],
    bell: ["H", 0, 0, "L", 0, 0, "H", 0, 0, 0, "H", 0, "L", 0, 0, 0],
  };
  A.GOGO = GOGO;
  A.gogo = { playing: false, onStep: null };
  A.toggleGogo = function () {
    if (!ctx) return false;
    if (A.gogo.playing) {
      A.gogo.playing = false;
      seq = null;
      A.duckSong(false);
      return false;
    }
    A.gogo.playing = true;
    A.duckSong(true);
    startSeq({
      bpm: 95,
      swing: 0.09,
      onStep: (s) => A.gogo.onStep && A.gogo.onStep(s),
      fn(step, t) {
        const s = step % 16;
        const hum = 0.85 + Math.random() * 0.3;
        if (GOGO.kick[s]) bucket(t, true, 0.55 * GOGO.kick[s] * hum);
        if (GOGO.snare[s]) rim(t, 0.32 * GOGO.snare[s] * hum);
        if (GOGO.hat[s]) hat(t, 0.05 * GOGO.hat[s]);
        if (GOGO.congaHi[s]) conga(t, true, 0.16 * hum);
        if (GOGO.congaLo[s]) conga(t, false, 0.18 * hum);
        if (GOGO.bell[s]) cowbell(t, GOGO.bell[s] === "H", 0.07 * hum);
        if (s === 0 && Math.random() < 0.3) bucket(t + 0.04, false, 0.2);
      },
    });
    return true;
  };
})();
