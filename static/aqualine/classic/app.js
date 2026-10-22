/* aqua line — stage, loop, input, transitions, hud. */
(function () {
  const AQ = (window.AQ = window.AQ || {});
  const { W, H } = AQ;
  const A = AQ.audio;
  AQ.scenes = AQ.scenes || [];

  const reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const stage = document.getElementById("stage");
  const view = document.getElementById("view");
  const ctx = view.getContext("2d");
  const capEl = document.getElementById("caption");
  const btn = document.getElementById("access");
  const muteBtn = document.getElementById("mute");
  const strip = document.getElementById("strip");
  const loader = document.getElementById("loader");

  const app = (AQ.app = {
    cur: -1,
    t: 0,
    busy: true,
    hover: null,
    mouse: [W / 2, H / 2],
    trans: null,
    visited: new Set(),
  });

  try {
    JSON.parse(localStorage.getItem("aqualine-visited") || "[]").forEach((i) => app.visited.add(i));
  } catch (e) {}

  // ---------- sizing ----------
  function fit() {
    const stripH = strip.offsetHeight || 0;
    const availW = window.innerWidth;
    const availH = window.innerHeight - stripH - 8;
    let w = Math.min(availW, availH * 1.5);
    w = Math.max(280, w);
    const h = w / 1.5;
    stage.style.width = w + "px";
    stage.style.height = h + "px";
    const dpr = window.devicePixelRatio || 1;
    const R = AQ.clamp((w / W) * dpr, 0.5, 2);
    if (Math.abs(R - AQ.R) / AQ.R > 0.08 || view.width !== Math.round(W * AQ.R)) {
      AQ.R = R;
      view.width = Math.round(W * R);
      view.height = Math.round(H * R);
      for (const s of AQ.scenes) s._R = null; // re-bake lazily at the new resolution
    }
  }
  let rt;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(fit, 120);
  });

  function ensureBaked(s) {
    if (s._R !== AQ.R) {
      s.bake();
      s._R = AQ.R;
    }
  }

  // ---------- captions + button ----------
  app.caption = function (text) {
    capEl.textContent = text || "";
    capEl.classList.toggle("on", !!text);
  };
  app.button = function (show, label) {
    if (label) btn.textContent = label;
    btn.classList.toggle("on", !!show);
    btn.tabIndex = show ? 0 : -1;
  };

  // ---------- strip map ----------
  function buildStrip() {
    strip.innerHTML = "";
    const line = document.createElement("div");
    line.className = "strip-line";
    strip.appendChild(line);
    AQ.scenes.forEach((s, i) => {
      const b = document.createElement("button");
      b.className = "stop";
      b.innerHTML = `<span class="dot"></span><span class="nm">${s.name}</span>`;
      b.setAttribute("aria-label", `go to ${s.name}`);
      b.addEventListener("click", () => {
        if (app.busy || i === app.cur) return;
        if (!app.visited.has(i)) {
          A.reject();
          app.caption("you haven't ridden that far yet");
          return;
        }
        A.ui();
        app.go(i, { fade: true });
      });
      strip.appendChild(b);
    });
    updateStrip();
  }
  function updateStrip() {
    [...strip.querySelectorAll(".stop")].forEach((b, i) => {
      b.classList.toggle("here", i === app.cur);
      b.classList.toggle("seen", app.visited.has(i));
    });
  }

  // ---------- transitions ----------
  // zoom: push the current frame toward a point and fade to black (the old flash dolly)
  app.go = function (idx, o = {}) {
    if (app.trans) return;
    app.busy = true;
    app.button(false);
    app.caption("");
    setHover(null);
    const snap = document.createElement("canvas");
    snap.width = view.width;
    snap.height = view.height;
    snap.getContext("2d").drawImage(view, 0, 0);
    const zoom = !reduceMotion && o.zoom && !o.fade;
    const dur = o.dur || (zoom ? 1.5 : 0.8);
    if (zoom) A.whoosh(dur * 0.9);
    app.trans = { phase: "out", t: 0, dur, snap, zoom: zoom ? o.zoom : null, next: idx };
  };

  function enter(idx) {
    const prev = AQ.scenes[app.cur];
    if (prev && prev.exit) prev.exit();
    app.cur = idx;
    app.visited.add(idx);
    try { localStorage.setItem("aqualine-visited", JSON.stringify([...app.visited])); } catch (e) {}
    const s = AQ.scenes[idx];
    ensureBaked(s);
    if (s.reset) s.reset();
    A.setScene(s.ambience || "vault");
    if (s.enter) s.enter();
    updateStrip();
    document.title = `aqua line — ${s.name.toLowerCase()}`;
  }

  // ---------- input ----------
  function toStage(e) {
    const r = view.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
  }
  function hitTest(x, y) {
    const s = AQ.scenes[app.cur];
    if (!s || !s.hotspots) return null;
    for (const h of s.hotspots()) {
      if (h.active && !h.active()) continue;
      if (h.test(x, y)) return h;
    }
    return null;
  }
  function setHover(h) {
    if (app.hover === h) return;
    if (app.hover && app.hover.leave) app.hover.leave();
    app.hover = h;
    if (h && h.enter) h.enter();
    view.style.cursor = h ? h.cursor || "pointer" : "default";
    app.caption(h ? h.caption : "");
  }
  view.addEventListener("pointermove", (e) => {
    const p = toStage(e);
    app.mouse = p;
    if (app.busy) return;
    const h = hitTest(p[0], p[1]);
    // hotspots with the same id are the same thing; avoid flicker on rebuilt arrays
    if (h && app.hover && h.id === app.hover.id) { app.hover = h; return; }
    setHover(h);
  });
  view.addEventListener("pointerleave", () => setHover(null));
  view.addEventListener("pointerdown", (e) => {
    A.start();
    if (app.busy) return;
    const p = toStage(e);
    const h = hitTest(p[0], p[1]);
    if (e.pointerType !== "mouse" && h && h.enter && app.hover !== h) {
      // touch has no hover: give the hover effect a beat before the click
      setHover(h);
    }
    if (h && h.click) h.click(p[0], p[1]);
  });
  document.addEventListener("pointerdown", () => A.start(), { once: true });
  btn.addEventListener("click", () => {
    A.start();
    const s = AQ.scenes[app.cur];
    if (!app.busy && s && s.onButton) s.onButton();
  });
  btn.addEventListener("mouseenter", () => A.ui());

  function syncMute() {
    const m = A.isMuted();
    muteBtn.textContent = m ? "sound: off" : "sound: on";
    muteBtn.setAttribute("aria-pressed", m ? "false" : "true");
  }
  muteBtn.addEventListener("click", () => {
    A.start();
    A.setMuted(!A.isMuted());
    syncMute();
  });
  syncMute();

  document.addEventListener("keydown", (e) => {
    if (e.key === "m" || e.key === "M") muteBtn.click();
  });

  // ---------- loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    app.t += dt;
    const R = AQ.R;
    const tr = app.trans;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (tr && tr.phase === "out") {
      tr.t += dt;
      const k = Math.min(1, tr.t / tr.dur);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, view.width, view.height);
      if (tr.zoom) {
        const e = AQ.ease.in(k);
        const sc = 1 + e * 2.4;
        const [zx, zy] = tr.zoom;
        // drift the focus toward the center as we push in
        const fx = AQ.lerp(zx, W / 2, e * 0.25) * R;
        const fy = AQ.lerp(zy, H / 2, e * 0.25) * R;
        ctx.setTransform(sc, 0, 0, sc, fx - fx * sc + (W / 2 * R - fx) * e * 0.3, fy - fy * sc + (H / 2 * R - fy) * e * 0.3);
      }
      ctx.drawImage(tr.snap, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const fade = tr.zoom ? AQ.clamp((k - 0.45) / 0.55, 0, 1) : k;
      ctx.fillStyle = `rgba(0,0,0,${fade})`;
      ctx.fillRect(0, 0, view.width, view.height);
      if (k >= 1) {
        enter(tr.next);
        app.trans = { phase: "in", t: 0, dur: 0.9 };
      }
    } else {
      const s = AQ.scenes[app.cur];
      if (s) {
        ensureBaked(s);
        ctx.setTransform(R, 0, 0, R, 0, 0);
        s.draw(ctx, app.t, dt);
      }
      if (tr && tr.phase === "in") {
        tr.t += dt;
        const k = Math.min(1, tr.t / tr.dur);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = `rgba(0,0,0,${1 - AQ.ease.out(k)})`;
        ctx.fillRect(0, 0, view.width, view.height);
        if (k >= 1) {
          app.trans = null;
          const sc = AQ.scenes[app.cur];
          if (!sc.holdInput) app.busy = false;
          if (sc.afterIn) sc.afterIn();
        }
      }
    }
    requestAnimationFrame(frame);
  }

  // ---------- boot: a flash-era preloader ----------
  function boot() {
    buildStrip();
    fit();
    const bar = document.getElementById("load-bar");
    const go = document.getElementById("enter");
    const steps = AQ.scenes.length;
    let i = 0;
    // bake every station up front, one per tick, so the bar is honest
    const bakeNext = () => {
      if (i < steps) {
        if (AQ.scenes[i]) ensureBaked(AQ.scenes[i]);
        i++;
        bar.style.width = `${(i / steps) * 100}%`;
        setTimeout(bakeNext, 30);
      } else {
        loader.classList.add("ready");
        go.focus({ preventScroll: true });
      }
    };
    setTimeout(bakeNext, 50);
    const start = (withSound) => {
      if (!loader.classList.contains("ready")) return;
      if (withSound) A.start();
      else { A.setMuted(true); A.start(); syncMute(); }
      loader.classList.add("gone");
      setTimeout(() => loader.remove(), 900);
      enter(0);
      app.trans = { phase: "in", t: 0, dur: 1.4 };
    };
    go.addEventListener("click", () => start(true));
    document.getElementById("enter-quiet").addEventListener("click", () => start(false));
    requestAnimationFrame(frame);
  }
  window.addEventListener("DOMContentLoaded", boot);
})();
