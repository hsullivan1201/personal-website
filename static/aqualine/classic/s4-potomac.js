/* station 4 — potomac ave. the mezzanine at night; the lights come up in banks. */
(function () {
  const AQ = window.AQ;
  const { W, H } = AQ;
  const A = AQ.audio;
  const S = { name: "Potomac Ave", ambience: "dark", holdInput: true };
  const cam = new AQ.Camera({ x: 0, y: 1.7, z: 0, f: 560, cy: 470 });
  const VY = 0.6, VR = 7, VZ = 7;
  const PZ = 13.2; // portal plane
  const FZ = 7.4; // fountain
  const PORTALS = [
    { x: -5, name: "Anacostia", line: "green", id: "left" },
    { x: 0, name: "Fountain", line: "aqua", id: "center" },
    { x: 5, name: "Tidal Basin", line: "aqua", id: "right" },
  ];
  let st = null;
  let portalPolys = [], clock = null, fountain = null, fixtures = [];

  const warm = [226, 196, 156];
  const light = (p, n) => {
    const tgt = [p[0] * 0.8, 0.3, VZ];
    const d = AQ.norm(AQ.sub(tgt, p));
    const lam = Math.max(0, AQ.dot(n, d));
    const side = Math.exp(-Math.max(0, Math.abs(p[0]) - 9) / 9);
    return (0.26 + 0.8 * lam) * side;
  };

  S.reset = function () {
    const top = cam.proj([0, 1.28, FZ]);
    const bowl = cam.proj([0, 1.0, FZ]);
    st = {
      dark: 0.88,
      stage: 0,
      t: 0,
      out: false,
      outT: 0,
      groups: [0, 0, 0],
      spout: new AQ.Plume({ x: top[0], y: top[1], rate: 90, spread: 0.5, speed: 70, gravity: 260, size: 1.6, life: 0.8, floor: bowl[1], baseW: 2 }),
      veil: new AQ.Plume({ x: bowl[0], y: bowl[1] + 2, rate: 160, spread: 3, speed: 28, gravity: 320, size: 1.3, life: 0.7, floor: cam.proj([0, 0.4, FZ - 0.7])[1], baseW: 0.55 * cam.f / FZ * 2 }),
      ripples: new AQ.Ripples(),
      nextRip: 0,
    };
  };
  S.enter = function () {
    A.setScene("dark");
  };

  // ---------- bake ----------
  S.bake = function () {
    const b = (S.b = {});
    b.back = AQ.makeCanvas();
    const x = b.back.x;
    x.fillStyle = "#5b5045";
    x.fillRect(0, 0, W, H);
    AQ.drawVaultCells(x, cam, AQ.vaultCells({
      axis: "x", c: [0, VY, VZ], R: VR, depth: 0.42, margin: 0.13, along: [-40, 40], len: 2, n: 8,
      th: [-0.08, 2.2], col: warm, light,
    }));

    // floor with a line-color mosaic rug around the fountain
    const rugCols = ["aqua", "blue", "green", "yellow", "orange", "red"].map((n) => AQ.hex(AQ.LINES[n]));
    AQ.hexFloor(x, cam, {
      x0: -30, x1: 30, y: 0, z0: 0.6, z1: VZ + VR - 0.05, r: 0.26, col: [150, 64, 44], seed: 12,
      tint: (px, pz) => {
        const d = Math.hypot(px, (pz - FZ) * 1.0);
        if (d > 3.3) return [150, 64, 44];
        if (d < 1.35) return [40, 40, 44];
        return AQ.mix(rugCols[Math.floor((d - 1.35) / 0.33) % rugCols.length], [255, 255, 255], 0.08);
      },
      light: (px, pz) => 0.8 + 0.25 * Math.exp(-Math.abs(px) / 6),
    });

    // portals: dark passages with bronze frames
    portalPolys = [];
    const k = cam.f / (PZ - cam.z);
    PORTALS.forEach((p) => {
      const c = cam.proj([p.x, 0, PZ]);
      const w = 1.5 * k, hRect = 2.4 * k;
      const path = (ctx, grow = 0) => {
        ctx.beginPath();
        ctx.moveTo(c[0] - w - grow, c[1]);
        ctx.lineTo(c[0] - w - grow, c[1] - hRect);
        ctx.arc(c[0], c[1] - hRect, w + grow, Math.PI, 0);
        ctx.lineTo(c[0] + w + grow, c[1]);
        ctx.closePath();
      };
      path(x, 9);
      x.fillStyle = "#4b3a2e";
      x.fill();
      path(x, 3);
      x.fillStyle = "#6e5543";
      x.fill();
      path(x);
      const g = x.createLinearGradient(0, c[1] - hRect - w, 0, c[1]);
      g.addColorStop(0, "#050708");
      g.addColorStop(1, p.id === "right" ? "#0d3a3a" : "#14181a");
      x.fillStyle = g;
      x.fill();
      // a passage receding: a smaller arch inside, faintly lit
      x.save();
      path(x);
      x.clip();
      const vp = [c[0], c[1] - hRect * 0.45];
      const glow = x.createRadialGradient(vp[0], vp[1], 2, vp[0], vp[1], w * 1.4);
      glow.addColorStop(0, p.id === "right" ? "rgba(120,255,240,0.65)" : "rgba(255,220,170,0.18)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      x.fillStyle = glow;
      x.fillRect(c[0] - w * 2, c[1] - hRect * 2, w * 4, hRect * 2.4);
      x.strokeStyle = "rgba(255,255,255,0.06)";
      for (let i = 1; i < 6; i++) {
        const s = 1 - i * 0.14;
        x.beginPath();
        x.moveTo(c[0] - w * s, c[1] - (1 - s) * hRect * 0.45);
        x.lineTo(c[0] - w * s, c[1] - hRect * 0.45 - hRect * 0.55 * s);
        x.arc(c[0], c[1] - hRect * 0.45 - hRect * 0.55 * s, w * s, Math.PI, 0);
        x.lineTo(c[0] + w * s, c[1] - (1 - s) * hRect * 0.45);
        x.stroke();
      }
      x.restore();
      const poly = [];
      for (let i = 0; i <= 12; i++) {
        const a = Math.PI + (i / 12) * Math.PI;
        poly.push([c[0] + Math.cos(a) * w, c[1] - hRect + Math.sin(a) * w]);
      }
      poly.push([c[0] + w, c[1]], [c[0] - w, c[1]]);
      portalPolys.push({ poly, c, w, h: hRect });

      // the sign above
      const sz = 12.7, sk = cam.f / sz;
      const sc = cam.proj([p.x, 4.55, sz]);
      const sign = AQ.textCanvas(p.name, { h: 70, w: 300 });
      const sw = 2.9 * sk, sh = 0.68 * sk;
      x.drawImage(sign, sc[0] - sw / 2, sc[1] - sh / 2, sw, sh);
      x.fillStyle = AQ.LINES[p.line];
      x.beginPath();
      x.arc(sc[0] + (p.x < 0 ? -1 : 1) * (sw / 2 + sh * 0.32), sc[1], sh * 0.2, 0, Math.PI * 2);
      x.fill();
      p.signBox = [sc[0] - sw / 2, sc[1] - sh / 2, sc[0] + sw / 2, sc[1] + sh / 2];
    });

    // clock housing (face is drawn live)
    {
      const cz = 11.7, ck = cam.f / cz;
      const c = cam.proj([0, 5.8, cz]);
      clock = { x: c[0], y: c[1], r: 0.78 * ck };
      x.fillStyle = "#4b3a2e";
      x.beginPath(); x.arc(c[0], c[1], clock.r + 8, 0, Math.PI * 2); x.fill();
      x.fillStyle = "#8a6c52";
      x.beginPath(); x.arc(c[0], c[1], clock.r + 3, 0, Math.PI * 2); x.fill();
    }

    // wall-wash fixtures along the base of the far wall
    fixtures = [];
    for (let fx = -14; fx <= 14; fx += 2.4) {
      if (PORTALS.some((p) => Math.abs(fx - p.x) < 1.9)) continue;
      const p = cam.proj([fx, 0.08, 13.7]);
      fixtures.push({ x: p[0], y: p[1], k: cam.f / 13.7, g: fx < -2.5 ? 0 : fx > 2.5 ? 2 : 1 });
    }

    // urns with ferns between the portals
    for (const ux of [-2.5, 2.5]) {
      const c = cam.proj([ux, 0, 12.4]);
      const uk = cam.f / 12.4;
      x.fillStyle = "#7a3d22";
      x.beginPath();
      x.moveTo(c[0] - 0.22 * uk, c[1]);
      x.quadraticCurveTo(c[0] - 0.42 * uk, c[1] - 0.4 * uk, c[0] - 0.2 * uk, c[1] - 0.62 * uk);
      x.lineTo(c[0] + 0.2 * uk, c[1] - 0.62 * uk);
      x.quadraticCurveTo(c[0] + 0.42 * uk, c[1] - 0.4 * uk, c[0] + 0.22 * uk, c[1]);
      x.fill();
      AQ.fern(x, AQ.rng(ux * 10 + 50), c[0], c[1] - 0.6 * uk, 0.9 * uk, [44, 92, 50]);
    }

    fountain = paintFountain(x);

    // foreground ferns
    b.fg = AQ.makeCanvas();
    AQ.fern(b.fg.x, AQ.rng(401), 40, 820, 230);
    AQ.fern(b.fg.x, AQ.rng(402), 1170, 830, 240);
  };

  function paintFountain(x) {
    const k = cam.f / FZ;
    const oct = (r, y) => {
      const pts = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        pts.push([r * Math.cos(a), y, FZ + r * Math.sin(a)]);
      }
      return pts;
    };
    const stone = [168, 120, 82];
    const water = cam.projPoly(oct(1.0, 0.36));
    AQ.pathPts(x, water);
    x.fillStyle = "#1d5a60";
    x.fill();
    const rimO = oct(1.15, 0.42);
    const rimI = oct(1.0, 0.42);
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8;
      AQ.poly3(x, cam, [rimO[i], rimO[j], rimI[j], rimI[i]], AQ.rgb(stone, 1.15));
    }
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8;
      const a = rimO[i], bb = rimO[j];
      if ((a[2] + bb[2]) / 2 > FZ) continue;
      AQ.poly3(x, cam, [[a[0], 0, a[2]], [bb[0], 0, bb[2]], bb, a], AQ.rgb(stone, 0.75 + 0.2 * Math.abs(a[0] + bb[0]) / 2.3));
    }
    const pb = cam.proj([0, 0.36, FZ]), pt = cam.proj([0, 1.0, FZ]);
    x.fillStyle = AQ.rgb(stone, 0.85);
    x.beginPath();
    x.moveTo(pb[0] - 0.12 * k, pb[1]);
    x.quadraticCurveTo(pb[0] - 0.05 * k, (pb[1] + pt[1]) / 2, pt[0] - 0.1 * k, pt[1]);
    x.lineTo(pt[0] + 0.1 * k, pt[1]);
    x.quadraticCurveTo(pb[0] + 0.05 * k, (pb[1] + pt[1]) / 2, pb[0] + 0.12 * k, pb[1]);
    x.fill();
    x.fillStyle = AQ.rgb(stone, 1.05);
    x.beginPath(); x.ellipse(pt[0], pt[1], 0.55 * k, 0.1 * k, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = AQ.rgb(stone, 0.7);
    x.beginPath(); x.ellipse(pt[0], pt[1] + 2, 0.55 * k, 0.16 * k, 0, 0, Math.PI); x.fill();
    const ft = cam.proj([0, 1.25, FZ]);
    x.fillStyle = AQ.rgb(stone, 0.9);
    x.fillRect(ft[0] - 3, ft[1], 6, pt[1] - ft[1]);
    x.beginPath(); x.arc(ft[0], ft[1], 5, 0, Math.PI * 2); x.fill();
    return { water, k, c: cam.proj([0, 0.36, FZ]), box: [pb[0] - 1.2 * k, ft[1] - 20, pb[0] + 1.2 * k, cam.proj([0, 0, FZ - 1.15])[1]] };
  }

  // ---------- frame ----------
  function setDark(target) {
    st.dark = target;
  }
  function lightsUp(dt) {
    st.t += dt;
    const marks = [0.7, 1.45, 2.2];
    const levels = [0.6, 0.32, 0];
    while (st.stage < 3 && st.t > marks[st.stage]) {
      A.clunk(st.stage);
      const g = [0, 2, 1][st.stage];
      st.groups[g] = 1;
      setDark(levels[st.stage]);
      st.stage++;
      if (st.stage === 3) {
        A.setScene("mezz");
        AQ.app.busy = false;
      }
    }
  }
  function lightsDown(dt) {
    st.outT += dt;
    const marks = [0.15, 0.45, 0.75];
    const levels = [0.35, 0.65, 0.95];
    const k = Math.floor(st.outT >= marks[2] ? 3 : st.outT >= marks[1] ? 2 : st.outT >= marks[0] ? 1 : 0);
    while (st.stage > 3 - k) {
      st.stage--;
      const g = [0, 2, 1][st.stage];
      st.groups[g] = 0;
      setDark(levels[2 - st.stage]);
      if (st.stage === 2) A.lightsOut();
      else A.thud(undefined, 0.6);
    }
    if (st.outT > 1.4 && !st.gone) {
      st.gone = true;
      AQ.app.go(4, { fade: true, dur: 0.7 });
    }
  }

  S.draw = function (ctx, t, dt) {
    const b = S.b;
    if (st.out) lightsDown(dt);
    else lightsUp(dt);

    ctx.drawImage(b.back.c, 0, 0, W, H);
    // fountain water
    st.spout.step(dt);
    st.veil.step(dt);
    st.nextRip -= dt;
    if (st.nextRip <= 0) {
      st.nextRip = 0.4 + Math.random() * 0.4;
      st.ripples.add(fountain.c[0] + (Math.random() - 0.5) * fountain.k * 1.2, fountain.c[1] + (Math.random() - 0.5) * fountain.k * 0.2, 0.25, 0.25);
    }
    ctx.save();
    AQ.pathPts(ctx, fountain.water);
    ctx.clip();
    st.ripples.draw(ctx, dt);
    ctx.restore();
    st.veil.draw(ctx);
    st.spout.draw(ctx);
    ctx.drawImage(b.fg.c, 0, 0, W, H);

    // darkness, with a little flicker right after each clunk
    let d = st.dark;
    if (!st.out && st.stage > 0 && st.stage <= 3 && st.t - [0.7, 1.45, 2.2][st.stage - 1] < 0.25) d += Math.random() * 0.12;
    if (d > 0.005) {
      ctx.fillStyle = `rgba(3,5,9,${Math.min(0.96, d)})`;
      ctx.fillRect(0, 0, W, H);
    }

    // emissive bits: fixtures, the clock, the right-hand portal, the pool light
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const f of fixtures) {
      const on = st.groups[f.g];
      if (!on) continue;
      const g = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y - f.k * 0.8, f.k * 1.6);
      g.addColorStop(0, "rgba(255,214,160,0.45)");
      g.addColorStop(1, "rgba(255,214,160,0)");
      ctx.fillStyle = g;
      ctx.fillRect(f.x - f.k * 1.6, f.y - f.k * 2.6, f.k * 3.2, f.k * 2.8);
      ctx.fillStyle = "rgba(255,240,210,0.9)";
      ctx.fillRect(f.x - f.k * 0.18, f.y - 2, f.k * 0.36, 3);
    }
    const rp = portalPolys[2];
    if (rp) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 1.8);
      const g = ctx.createRadialGradient(rp.c[0], rp.c[1] - rp.h * 0.5, 4, rp.c[0], rp.c[1] - rp.h * 0.5, rp.w * 1.6);
      g.addColorStop(0, `rgba(90,255,235,${0.14 + 0.1 * pulse + (st.hoverR ? 0.2 : 0)})`);
      g.addColorStop(1, "rgba(90,255,235,0)");
      ctx.fillStyle = g;
      ctx.fillRect(rp.c[0] - rp.w * 2, rp.c[1] - rp.h * 1.6, rp.w * 4, rp.h * 1.8);
    }
    const pg = ctx.createRadialGradient(fountain.c[0], fountain.c[1], 2, fountain.c[0], fountain.c[1], fountain.k * 1.4);
    pg.addColorStop(0, `rgba(80,220,230,${0.25 + 0.05 * Math.sin(t * 3)})`);
    pg.addColorStop(1, "rgba(80,220,230,0)");
    ctx.fillStyle = pg;
    ctx.fillRect(fountain.c[0] - fountain.k * 1.5, fountain.c[1] - fountain.k, fountain.k * 3, fountain.k * 2);
    ctx.restore();
    drawClock(ctx, t);
  };

  function drawClock(ctx) {
    const { x, y, r } = clock;
    const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 1.8);
    g.addColorStop(0, "rgba(255,246,220,0.35)");
    g.addColorStop(1, "rgba(255,246,220,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
    ctx.fillStyle = "#f6efdc";
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#2a241e";
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.lineWidth = i % 3 ? 1.2 : 2.6;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8);
      ctx.lineTo(x + Math.cos(a) * r * 0.93, y + Math.sin(a) * r * 0.93);
      ctx.stroke();
    }
    const now = new Date();
    const hr = now.getHours() % 12, mn = now.getMinutes(), sc = now.getSeconds() + now.getMilliseconds() / 1000;
    const hand = (ang, len, w, col) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.sin(ang) * r * len, y - Math.cos(ang) * r * len);
      ctx.stroke();
    };
    hand(((hr + mn / 60) / 12) * Math.PI * 2, 0.5, 3.2, "#1d1915");
    hand(((mn + sc / 60) / 60) * Math.PI * 2, 0.74, 2.2, "#1d1915");
    hand((sc / 60) * Math.PI * 2, 0.8, 1, AQ.LINES.red);
    ctx.fillStyle = "#1d1915";
    ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill();
  }

  // ---------- interaction ----------
  function timeWords() {
    const d = new Date();
    let h = d.getHours();
    const m = d.getMinutes();
    const ap = h < 12 ? "A M" : "P M";
    h = h % 12 || 12;
    return `${h}:${String(m).padStart(2, "0")} ${ap}`;
  }
  S.hotspots = function () {
    return [
      {
        id: "clock",
        caption: "the station clock",
        test: (x, y) => Math.hypot(x - clock.x, y - clock.y) < clock.r + 8,
        click: () => A.announce(`The time is ${timeWords()}. The next train is eventually.`),
      },
      {
        id: "right",
        caption: "→ tidal basin",
        test: (x, y) => portalPolys[2] && AQ.inPoly(portalPolys[2].poly, x, y),
        enter: () => (st.hoverR = true),
        leave: () => (st.hoverR = false),
        click: () => {
          if (st.out) return;
          st.out = true;
          st.outT = 0;
          AQ.app.busy = true;
          AQ.app.caption("");
        },
      },
      {
        id: "left",
        caption: "← anacostia",
        test: (x, y) => portalPolys[0] && AQ.inPoly(portalPolys[0].poly, x, y),
        click: () => A.announce("Anacostia service is provided by shuttle boat. Please board from the fountain."),
      },
      {
        id: "center",
        caption: "fountain (service suspended)",
        test: (x, y) => portalPolys[1] && AQ.inPoly(portalPolys[1].poly, x, y),
        click: () => {
          A.reject();
          AQ.app.caption("this passage is flooded. on purpose.");
        },
      },
      {
        id: "fountain",
        caption: "the fountain",
        test: (x, y) => x > fountain.box[0] && x < fountain.box[2] && y > fountain.box[1] && y < fountain.box[3],
        click: (x, y) => {
          st.ripples.add(x, Math.min(y, fountain.c[1] + 6), 0.3, 0.5);
          A.plop((x - 600) / 600, 0.8);
        },
      },
    ];
  };

  AQ.scenes[3] = S;
})();
