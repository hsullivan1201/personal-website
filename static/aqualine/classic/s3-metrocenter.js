/* station 3 — metro center. two vaults cross; the escalators are waterfalls now. */
(function () {
  const AQ = window.AQ;
  const { W, H } = AQ;
  const A = AQ.audio;
  const S = { name: "Metro Center", ambience: "crossing" };
  const cam = new AQ.Camera({ x: 0, y: 1.7, z: 0, f: 520, cy: 430 });
  const YC = 1.4, R = 10, ZC = 18;
  const ESC = { xIn: 6.4, xOut: 8.6, z0: 8, z1: 15.2, top: 5.6, steps: 22 };
  const GAL = { x: 6.2, z0: 15.2, z1: 26.5, y0: 5.6, y1: 6.2 };
  let st = null;
  let escPolys = [], escSteps = [], basin = null;

  const light = (p, n) => {
    const tgt = [p[0] * 0.35, 0.3, ZC + (p[2] - ZC) * 0.35];
    const d = AQ.norm(AQ.sub(tgt, p));
    const lam = Math.max(0, AQ.dot(n, d));
    const dist = Math.hypot(p[0], p[1] - 1.7, p[2]);
    return (0.3 + 0.78 * lam) * Math.exp(-Math.max(0, dist - 16) / 48);
  };

  S.reset = function () {
    const jp = cam.proj([0, 1.15, ZC]);
    const bp = cam.proj([0, 1.0, ZC]);
    st = {
      jet: new AQ.Plume({ x: jp[0], y: jp[1], rate: 220, spread: 0.14, speed: 235, gravity: 380, size: 1.8, life: 1.5, floor: cam.proj([0, 0.4, ZC])[1], baseW: 4 }),
      veil: new AQ.Plume({ x: bp[0], y: bp[1], rate: 200, spread: 2.6, speed: 40, gravity: 300, size: 1.4, life: 0.9, floor: cam.proj([0, 0.4, ZC - 1])[1], baseW: 30 }),
      ripples: new AQ.Ripples(),
      nextRip: 0,
      flow: 0,
      burst: 0,
      hits: [0, 0, 0, 0, 0],
      notes: [],
    };
    A.gogo.onStep = (s) => {
      const G = A.GOGO;
      if (G.kick[s]) st.hits[0] = 1;
      if (G.snare[s] > 0.5) st.hits[1] = 1;
      if (G.congaHi[s]) st.hits[2] = 1;
      if (G.congaLo[s]) st.hits[3] = 1;
      if (G.bell[s]) st.hits[4] = 1;
      if (s % 4 === 0) st.notes.push({ x: 900 + Math.random() * 90, y: 560, t: 0 });
    };
  };
  S.exit = function () {
    if (A.gogo.playing) A.toggleGogo();
    A.gogo.onStep = null;
  };

  // ---------- bake ----------
  S.bake = function () {
    const b = (S.b = {});
    b.back = AQ.makeCanvas();
    const x = b.back.x;
    x.fillStyle = "#6f675b";
    x.fillRect(0, 0, W, H);
    const th = [-0.14, Math.PI + 0.14];
    const main = AQ.vaultCells({
      axis: "z", c: [0, YC, 0], R, depth: 0.5, margin: 0.13, along: [2, 150], len: 2, n: 16, th,
      col: [216, 200, 176], light, skip: (p) => (p[2] - ZC) ** 2 + (p[1] - YC) ** 2 < (R - 1.4) ** 2,
    });
    const cross = AQ.vaultCells({
      axis: "x", c: [0, YC, ZC], R, depth: 0.5, margin: 0.13, along: [-60, 60], len: 2, n: 16, th,
      col: [216, 200, 176], light, skip: (p) => p[0] ** 2 + (p[1] - YC) ** 2 < (R - 1.4) ** 2,
    });
    AQ.drawVaultCells(x, cam, main.concat(cross));
    // far end of the main vault fades out
    const vp = cam.proj([0, YC + 2, 150]);
    const d = x.createRadialGradient(vp[0], vp[1], 6, vp[0], vp[1], 120);
    d.addColorStop(0, "rgba(6,9,10,0.95)");
    d.addColorStop(1, "rgba(6,9,10,0)");
    x.fillStyle = d;
    x.fillRect(vp[0] - 130, vp[1] - 130, 260, 260);

    // the rainbow: every line color, traced along the groin where the vaults meet
    x.save();
    x.lineCap = "round";
    for (const pass of [0, 1]) {
      x.globalCompositeOperation = pass ? "source-over" : "lighter";
      for (const sgn of [1, -1]) {
        AQ.LINE_ORDER.forEach((nm, k) => {
          const Rk = R - 0.1 - k * 0.17;
          x.strokeStyle = AQ.LINES[nm];
          x.globalAlpha = pass ? 0.92 : 0.22;
          for (let i = 0; i < 64; i++) {
            const a0 = (i / 64) * Math.PI, a1 = ((i + 1) / 64) * Math.PI;
            const P = (a) => [Rk * Math.cos(a), YC + Rk * Math.sin(a), ZC + sgn * Rk * Math.cos(a)];
            const p0 = cam.proj(P(a0)), p1 = cam.proj(P(a1));
            x.lineWidth = ((cam.f * 0.17) / p0[2]) * (pass ? 1 : 3);
            x.beginPath(); x.moveTo(p0[0], p0[1]); x.lineTo(p1[0], p1[1]); x.stroke();
          }
        });
      }
    }
    x.restore();

    // floors
    const fl = { r: 0.3, col: [146, 62, 44], y: 0 };
    AQ.hexFloor(x, cam, Object.assign({ x0: -9.95, x1: 9.95, z0: 1, z1: 150, seed: 5 }, fl));
    AQ.hexFloor(x, cam, Object.assign({ x0: -50, x1: -9.95, z0: ZC - 9.9, z1: ZC + 9.9, seed: 6 }, fl));
    AQ.hexFloor(x, cam, Object.assign({ x0: 9.95, x1: 50, z0: ZC - 9.9, z1: ZC + 9.9, seed: 8 }, fl));

    // galleries at the top of the escalators
    for (const s of [-1, 1]) {
      const gx = s * GAL.x, far = s * 50;
      AQ.poly3(x, cam, [[gx, GAL.y0, GAL.z0], [far, GAL.y0, GAL.z0], [far, GAL.y0, GAL.z1], [gx, GAL.y0, GAL.z1]], "#4d4740");
      AQ.poly3(x, cam, [[gx, GAL.y0, GAL.z0], [gx, GAL.y0, GAL.z1], [gx, GAL.y1, GAL.z1], [gx, GAL.y1, GAL.z0]], "#a39a8c");
      AQ.poly3(x, cam, [[gx, GAL.y0, GAL.z0], [far, GAL.y0, GAL.z0], [far, GAL.y1, GAL.z0], [gx, GAL.y1, GAL.z0]], "#b3aa9b");
      // glass parapet + brass rail
      AQ.poly3(x, cam, [[gx, GAL.y1, GAL.z0], [gx, GAL.y1, GAL.z1], [gx, GAL.y1 + 1, GAL.z1], [gx, GAL.y1 + 1, GAL.z0]], "rgba(170,215,220,0.22)");
      AQ.poly3(x, cam, [[s * (ESC.xOut + 0.1), GAL.y1, GAL.z0], [far, GAL.y1, GAL.z0], [far, GAL.y1 + 1, GAL.z0], [s * (ESC.xOut + 0.1), GAL.y1 + 1, GAL.z0]], "rgba(170,215,220,0.22)");
      x.strokeStyle = "#b08a3e";
      x.lineWidth = 3;
      for (const seg of [[[gx, GAL.y1 + 1, GAL.z0], [gx, GAL.y1 + 1, GAL.z1]], [[s * (ESC.xOut + 0.1), GAL.y1 + 1, GAL.z0], [far, GAL.y1 + 1, GAL.z0]]]) {
        const a = cam.proj(seg[0]), bb = cam.proj(seg[1]);
        x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(bb[0], bb[1]); x.stroke();
      }
      // pa speaker
      const sp = cam.proj([gx, GAL.y0 - 0.5, GAL.z0 + 1.6]);
      x.fillStyle = "#2a2a2a";
      x.fillRect(sp[0] - 9, sp[1] - 10, 18, 20);
      x.fillStyle = "#555";
      x.beginPath(); x.arc(sp[0], sp[1] - 2, 5, 0, Math.PI * 2); x.fill();
    }

    // escalators: outer balustrade, then the steps
    escPolys = [];
    escSteps = [];
    for (const s of [-1, 1]) {
      const xi = s * ESC.xIn, xo = s * ESC.xOut;
      const yAt = (z) => ((z - ESC.z0) / (ESC.z1 - ESC.z0)) * ESC.top;
      AQ.poly3(x, cam, [[xo, 0, ESC.z0], [xo, ESC.top, ESC.z1], [xo, ESC.top + 1.1, ESC.z1], [xo, 1.1, ESC.z0]], "#5f6265");
      const steps = [];
      for (let i = ESC.steps - 1; i >= 0; i--) {
        const za = ESC.z0 + ((ESC.z1 - ESC.z0) * i) / ESC.steps;
        const zb = ESC.z0 + ((ESC.z1 - ESC.z0) * (i + 1)) / ESC.steps;
        const ya = yAt(za), yb = yAt(zb);
        // tread at height yb spanning za..zb, riser at za from ya to yb
        const tread = [[xo, yb, za], [xi, yb, za], [xi, yb, zb], [xo, yb, zb]];
        const riser = [[xo, ya, za], [xi, ya, za], [xi, yb, za], [xo, yb, za]];
        if (yb < cam.y) AQ.poly3(x, cam, tread, i % 2 ? "#3b4043" : "#353a3d");
        AQ.poly3(x, cam, riser, "#26292b");
        const comb = cam.projPoly([[xo, yb - 0.02, za], [xi, yb - 0.02, za], [xi, yb, za], [xo, yb, za]]);
        if (comb) { AQ.pathPts(x, comb); x.fillStyle = "#c9b23a"; x.fill(); }
        steps.push(cam.projPoly(riser));
      }
      escSteps.push(steps);
      escPolys.push(cam.projPoly([[xo, 0, ESC.z0], [xi, 0, ESC.z0], [xi, ESC.top + 1, ESC.z1], [xo, ESC.top + 1, ESC.z1]]));
      // a catch-basin at the foot
      AQ.poly3(x, cam, [[xo - s * 0.2, 0.01, ESC.z0 - 1.2], [xi + s * 0.3, 0.01, ESC.z0 - 1.2], [xi + s * 0.3, 0.01, ESC.z0], [xo - s * 0.2, 0.01, ESC.z0]], "#123238");
    }

    // the fountain basin
    basin = paintBasin(x);

    // ---- foreground: planter left; the bucket kit is drawn live ----
    b.fg = AQ.makeCanvas();
    const f = b.fg.x;
    const rng = AQ.rng(303);
    f.fillStyle = "#8a8378";
    f.fillRect(120, 640, 190, 120);
    f.fillStyle = "#a59e92";
    f.fillRect(112, 630, 206, 14);
    f.fillStyle = "#3a2a1c";
    f.fillRect(124, 644, 182, 6);
    AQ.fern(f, rng, 215, 640, 150);
    AQ.fern(f, AQ.rng(304), 1180, 760, 120);
  };

  function paintBasin(x) {
    const r0 = 2.4, r1 = 2.7, hW = 0.45;
    const ring = (r, y) => {
      const pts = [];
      for (let i = 0; i < 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        pts.push([r * Math.cos(a), y, ZC + r * Math.sin(a)]);
      }
      return pts;
    };
    const water = cam.projPoly(ring(r0, 0.38));
    AQ.pathPts(x, water);
    const c = cam.proj([0, 0.38, ZC]);
    const g = x.createRadialGradient(c[0], c[1], 4, c[0], c[1], 80);
    g.addColorStop(0, "#5fd4cf");
    g.addColorStop(1, "#0f3c44");
    x.fillStyle = g;
    x.fill();
    // rim
    const outer = cam.projPoly(ring(r1, hW)), inner = cam.projPoly(ring(r0, hW));
    x.beginPath();
    outer.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])));
    x.closePath();
    inner.slice().reverse().forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])));
    x.closePath();
    x.fillStyle = "#d8d0c2";
    x.fill("evenodd");
    // near wall face
    for (let i = 32; i < 64; i++) {
      const a0 = (i / 64) * Math.PI * 2, a1 = ((i + 1) / 64) * Math.PI * 2;
      const q = [[r1 * Math.cos(a0), 0, ZC + r1 * Math.sin(a0)], [r1 * Math.cos(a1), 0, ZC + r1 * Math.sin(a1)], [r1 * Math.cos(a1), hW, ZC + r1 * Math.sin(a1)], [r1 * Math.cos(a0), hW, ZC + r1 * Math.sin(a0)]];
      AQ.poly3(x, cam, q, AQ.rgb([176, 166, 152], 0.75 + 0.25 * Math.abs(Math.cos(a0))));
    }
    // pedestal + bowl
    const pb = cam.proj([0, 0.38, ZC]), pt = cam.proj([0, 1.0, ZC]);
    const k = cam.f / ZC;
    x.fillStyle = "#b9b0a2";
    x.fillRect(pb[0] - 0.14 * k, pt[1], 0.28 * k, pb[1] - pt[1]);
    x.fillStyle = "#cfc6b7";
    x.beginPath();
    x.ellipse(pt[0], pt[1], 0.75 * k, 0.12 * k, 0, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = "#9d9486";
    x.beginPath();
    x.ellipse(pt[0], pt[1] + 3, 0.75 * k, 0.16 * k, 0, 0, Math.PI);
    x.fill();
    return { c, k, poly: water, box: [c[0] - r1 * k, c[1] - 90, c[0] + r1 * k, c[1] + 0.6 * k * 1.3] };
  }

  // ---------- frame ----------
  function drawCascades(ctx, t, dt) {
    st.flow += dt;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    escSteps.forEach((steps) => {
      const n = steps.length;
      steps.forEach((q, j) => {
        if (!q) return;
        const i = n - 1 - j; // step index from the bottom
        const a = 0.18 + 0.14 * Math.sin(i * 1.7 - st.flow * 9) + 0.08 * Math.sin(i * 0.6 + st.flow * 3);
        AQ.pathPts(ctx, q);
        ctx.fillStyle = `rgba(190,245,245,${Math.max(0.05, a)})`;
        ctx.fill();
        // lip highlight where water spills over the step edge
        ctx.strokeStyle = `rgba(240,255,255,${0.35 + 0.2 * Math.sin(i + st.flow * 12)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(q[3][0], q[3][1]);
        ctx.lineTo(q[2][0], q[2][1]);
        ctx.stroke();
      });
    });
    ctx.restore();
    // foam at the feet
    for (const s of [-1, 1]) {
      const p = cam.proj([s * (ESC.xIn + ESC.xOut) / 2, 0.05, ESC.z0 - 0.4]);
      for (let i = 0; i < 16; i++) {
        const ox = Math.sin(i * 2.1 + t * 3) * 34;
        ctx.fillStyle = `rgba(235,255,255,${0.25 + 0.2 * Math.sin(t * 7 + i)})`;
        ctx.beginPath();
        ctx.ellipse(p[0] + ox, p[1] + Math.cos(i + t * 4) * 4, 9, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // glass balustrades + handrails over the water
    for (const s of [-1, 1]) {
      const xi = s * ESC.xIn, xo = s * ESC.xOut;
      AQ.poly3(ctx, cam, [[xi, 0, ESC.z0], [xi, ESC.top, ESC.z1], [xi, ESC.top + 1.05, ESC.z1], [xi, 1.05, ESC.z0]], "rgba(175,220,225,0.2)", "rgba(220,240,240,0.35)", 1);
      for (const [xx, w] of [[xi, 5], [xo, 4]]) {
        const a = cam.proj([xx, 1.05, ESC.z0 - 0.3]), bb = cam.proj([xx, ESC.top + 1.05, ESC.z1]);
        ctx.strokeStyle = "#0e0f10";
        ctx.lineWidth = w;
        ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(bb[0], bb[1]); ctx.stroke();
      }
    }
  }

  const BUCKETS = [
    { x: 875, y: 690, w: 58, h: 62, col: "#efede6", band: "#d9d6cc" },
    { x: 945, y: 676, w: 52, h: 56, col: "#e8742a", band: "#c95e1b" },
    { x: 1012, y: 694, w: 56, h: 60, col: "#efede6", band: "#d9d6cc" },
    { x: 905, y: 622, w: 40, h: 40, col: "#e8742a", band: "#c95e1b" },
  ];
  function drawKit(ctx, t, dt) {
    for (let i = 0; i < 5; i++) st.hits[i] = Math.max(0, st.hits[i] - dt * 7);
    // milk crate throne
    ctx.fillStyle = "#23408a";
    ctx.fillRect(1040, 610, 70, 54);
    ctx.strokeStyle = "#16295a";
    ctx.lineWidth = 3;
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(1040 + i * 17.5, 610); ctx.lineTo(1040 + i * 17.5, 664); ctx.stroke(); }
    BUCKETS.forEach((bk, i) => {
      const hit = st.hits[i === 3 ? 2 : i] || 0;
      const sq = 1 - hit * 0.08;
      const bx = bk.x, by = bk.y, w = bk.w, h = bk.h * sq;
      // body (upside down: wider at the bottom)
      ctx.fillStyle = bk.col;
      ctx.beginPath();
      ctx.moveTo(bx - w / 2, by);
      ctx.lineTo(bx - w * 0.42, by - h);
      ctx.lineTo(bx + w * 0.42, by - h);
      ctx.lineTo(bx + w / 2, by);
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillRect(bx + w * 0.1, by - h, w * 0.32, h);
      ctx.fillStyle = bk.band;
      for (const k of [0.25, 0.4]) ctx.fillRect(bx - w * 0.46, by - h * k, w * 0.92, 3);
      // the drumhead (the bucket's bottom)
      ctx.fillStyle = hit > 0.1 ? "#ffffff" : bk.band;
      ctx.beginPath();
      ctx.ellipse(bx, by - h, w * 0.42, w * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.ellipse(bx, by, w / 2, w * 0.13, 0, 0, Math.PI);
      ctx.fill();
    });
    // a pot lid for a cymbal
    const ph = st.hits[4];
    ctx.save();
    ctx.translate(985, 616 - ph * 3);
    ctx.rotate(-0.15 + ph * 0.12);
    ctx.fillStyle = "#b8b6ae";
    ctx.beginPath(); ctx.ellipse(0, 0, 28, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e6e4dc";
    ctx.beginPath(); ctx.ellipse(-4, -2, 14, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "#8a8378";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(985, 620); ctx.lineTo(985, 690); ctx.stroke();
    // sticks
    ctx.strokeStyle = "#d9b77a";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    const lift = A.gogo.playing ? Math.abs(Math.sin(t * 10)) * 10 : 0;
    ctx.beginPath(); ctx.moveTo(925, 610 - lift); ctx.lineTo(985, 650); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1000, 612 - (A.gogo.playing ? 10 - lift : 0)); ctx.lineTo(950, 652); ctx.stroke();
    // little notes floating up while it plays
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = 'bold 18px "Helvetica Neue", Helvetica, Arial, sans-serif';
    for (const n of st.notes) {
      n.t += dt;
      ctx.globalAlpha = Math.max(0, 1 - n.t / 1.6);
      ctx.fillText(n.t % 0.8 < 0.4 ? "♪" : "♫", n.x + Math.sin(n.t * 4) * 6, n.y - n.t * 50);
    }
    ctx.globalAlpha = 1;
    st.notes = st.notes.filter((n) => n.t < 1.6);
  }

  S.draw = function (ctx, t, dt) {
    const b = S.b;
    ctx.drawImage(b.back.c, 0, 0, W, H);
    drawCascades(ctx, t, dt);
    // fountain
    st.burst = Math.max(0, st.burst - dt);
    st.jet.o.speed = 235 + st.burst * 110;
    st.jet.o.rate = 220 + st.burst * 200;
    st.jet.step(dt);
    st.veil.step(dt);
    st.nextRip -= dt;
    if (st.nextRip <= 0) {
      st.nextRip = 0.25 + Math.random() * 0.35;
      st.ripples.add(basin.c[0] + (Math.random() - 0.5) * basin.k * 2.4, basin.c[1] + (Math.random() - 0.5) * basin.k * 0.5, 0.3, 0.22);
    }
    ctx.save();
    AQ.pathPts(ctx, basin.poly);
    ctx.clip();
    st.ripples.draw(ctx, dt);
    ctx.restore();
    st.veil.draw(ctx);
    st.jet.draw(ctx);
    ctx.drawImage(b.fg.c, 0, 0, W, H);
    drawKit(ctx, t, dt);
  };

  // ---------- interaction ----------
  S.hotspots = function () {
    return [
      {
        id: "kit",
        caption: A.gogo.playing ? "stop the go-go" : "bucket drums",
        test: (x, y) => x > 840 && x < 1115 && y > 590 && y < 712,
        click: () => {
          const on = A.toggleGogo();
          AQ.app.caption(on ? "stop the go-go" : "bucket drums");
        },
      },
      {
        id: "escL",
        caption: "up the escalator (it's a waterfall now)",
        test: (x, y) => escPolys[0] && AQ.inPoly(escPolys[0], x, y),
        click: () => AQ.app.go(3, { zoom: cam.proj([-7.5, ESC.top + 1, ESC.z1]) }),
      },
      {
        id: "escR",
        caption: "up the escalator (it's a waterfall now)",
        test: (x, y) => escPolys[1] && AQ.inPoly(escPolys[1], x, y),
        click: () => AQ.app.go(3, { zoom: cam.proj([7.5, ESC.top + 1, ESC.z1]) }),
      },
      {
        id: "fountain",
        caption: "the fountain",
        test: (x, y) => x > basin.box[0] && x < basin.box[2] && y > basin.box[1] && y < basin.box[3],
        click: () => {
          st.burst = 1.4;
          A.splash(0);
        },
      },
      {
        id: "crossing",
        caption: "the crossing",
        test: (x, y) => y < 230 && x > 320 && x < 880,
        click: () => A.announce("Metro Center. Transfer to all lines. Including the ones that don't exist yet."),
      },
    ];
  };

  AQ.scenes[2] = S;
})();
