/* station 2 — waterfront. the vault, the reflecting pool, the fountain. */
(function () {
  const AQ = window.AQ;
  const { W, H } = AQ;
  const A = AQ.audio;
  const S = { name: "Waterfront", ambience: "vault" };
  const cam = new AQ.Camera({ x: 0, y: 4.2, z: 0, f: 560, cy: 390 });
  const WY = -1.2; // water level
  const PE = 5.0; // platform edge
  const VR = 10.5, VY = 0.8, ZEND = 164;
  const ROCK = { z: 13.5 };
  let st = null;
  let waterPoly = null, signPolys = [], pylonBox = null, VP = [600, 400];

  const fog = (p) => Math.exp(-Math.max(0, p[2] - 12) / 62);
  const up = AQ.uplight(
    [
      { at: (p) => [PE + 0.4, 0.9, p[2]], k: 1 },
      { at: (p) => [-PE - 0.4, 0.9, p[2]], k: 1 },
    ],
    0.28,
    0.62
  );
  const light = (p, n) => up(p, n) * fog(p);
  const vaultOpts = () => ({
    axis: "z", c: [0, VY, 0], R: VR, depth: 0.55, margin: 0.13,
    along: [4, ZEND], len: 2.0, n: 17, th: [-0.075, Math.PI + 0.075],
    col: [216, 201, 178], light,
  });

  S.reset = function () {
    st = {
      ducks: [
        { x: -2.6, z: 19, dir: 1, sp: 0.35 },
        { x: 2.0, z: 25, dir: -1, sp: 0.28 },
        { x: 0.6, z: 34, dir: 1, sp: 0.22 },
      ],
      birds: [],
      nextBirds: 3 + Math.random() * 4,
      ghost: 0,
      nextGhost: 14 + Math.random() * 10,
      ripples: new AQ.Ripples(),
      burst: 0,
    };
    const rp = cam.proj([0, WY, ROCK.z]);
    st.plume = new AQ.Plume({ x: rp[0], y: rp[1] - 34, rate: 420, spread: 1.1, speed: 200, gravity: 380, size: 1.8, life: 1.4, floor: rp[1] + 6, baseW: 34 });
    st.jet = new AQ.Plume({ x: rp[0], y: rp[1] - 40, rate: 260, spread: 0.16, speed: 290, gravity: 380, size: 2.2, life: 1.7, floor: rp[1] + 2, baseW: 8 });
  };

  // ---------- bake ----------
  S.bake = function () {
    const b = (S.b = {});
    b.back = AQ.makeCanvas();
    const x = b.back.x;
    x.fillStyle = "#0a0c0d";
    x.fillRect(0, 0, W, H);
    AQ.drawVaultCells(x, cam, AQ.vaultCells(vaultOpts()));
    endCap(x, cam);

    // platforms: red hex tile, granite edge, the drop to the trackbed
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? -10.45 : PE + 0.6, x1 = s < 0 ? -PE - 0.6 : 10.45;
      AQ.hexFloor(x, cam, {
        x0, x1, y: 0, z0: 5, z1: ZEND, r: 0.3, col: [146, 62, 44], seed: s < 0 ? 3 : 9,
        light: (px, pz) => (0.75 + 0.35 * Math.exp(-Math.abs(Math.abs(px) - PE) / 2.5)) * fog([0, 0, pz]),
      });
      AQ.poly3(x, cam, [[s * PE, 0, 5], [s * (PE + 0.6), 0, 5], [s * (PE + 0.6), 0, ZEND], [s * PE, 0, ZEND]], "#cfc9bc");
      AQ.poly3(x, cam, [[s * PE, WY, 5], [s * PE, 0, 5], [s * PE, 0, ZEND], [s * PE, WY, ZEND]], "#2c2a27");
    }
    waterPoly = cam.projPoly([[-PE, WY, 4], [PE, WY, 4], [PE, WY, ZEND], [-PE, WY, ZEND]]);
    AQ.pathPts(x, waterPoly);
    x.fillStyle = "#0a1c20";
    x.fill();
    VP = cam.proj([0, WY + 1.4, ZEND]);

    // station name along both walls
    const sign = AQ.textCanvas("Waterfront", { h: 90, w: 560, stripe: AQ.LINES.aqua });
    signPolys = [];
    for (const [z0, z1] of [[9, 18], [40, 49]]) {
      for (const s of [-1, 1]) {
        const xw = s * 10.28;
        AQ.wallImage(x, cam, sign, { x: xw, y0: 1.6, y1: 2.45, z0, z1, flip: s > 0 });
        signPolys.push(cam.projPoly([[xw, 1.6, z0], [xw, 1.6, z1], [xw, 2.45, z1], [xw, 2.45, z0]]));
      }
    }

    // ---- reflection: the same vault seen from under the water ----
    b.refl = AQ.makeCanvas();
    const r = b.refl.x;
    r.fillStyle = "#050d0f";
    r.fillRect(0, 0, W, H);
    const mcam = AQ.mirrorCam(cam, WY);
    AQ.drawVaultCells(r, mcam, AQ.vaultCells(vaultOpts()), { camPos: [0, 2 * WY - cam.y, 0] });
    endCap(r, mcam);
    for (const s of [-1, 1]) {
      AQ.poly3(r, mcam, [[s * PE, WY, 5], [s * PE, 0, 5], [s * PE, 0, ZEND], [s * PE, WY, ZEND]], "#1a1917");
    }
    for (const [z0, z1] of [[9, 18], [40, 49]]) {
      for (const s of [-1, 1]) AQ.wallImage(r, mcam, sign, { x: s * 10.28, y0: 1.6, y1: 2.45, z0, z1, flip: s > 0 });
    }

    // ---- the rock in the pool ----
    b.rock = AQ.makeCanvas();
    paintRock(b.rock.x);

    // ---- foreground: the pylon on the platform, the mezzanine parapet ----
    b.fg = AQ.makeCanvas();
    const f = b.fg.x;
    const pb = cam.proj([-7.4, 0, 11]);
    const ph = (cam.f * 2.7) / 11, pw = (cam.f * 0.5) / 11;
    AQ.pylon(f, pb[0], pb[1], ph, pw, new Array(7).fill(0.85), { side: 1 });
    pylonBox = [pb[0] - pw, pb[1] - ph - 6, pb[0] + pw, pb[1]];
    // a granite bench on the right platform
    AQ.poly3(f, cam, [[6.4, 0.45, 13], [8.2, 0.45, 13], [8.2, 0.45, 15.5], [6.4, 0.45, 15.5]], "#bdb7aa");
    AQ.poly3(f, cam, [[6.4, 0, 13], [6.4, 0.45, 13], [6.4, 0.45, 15.5], [6.4, 0, 15.5]], "#8f897e");
    AQ.poly3(f, cam, [[6.4, 0, 13], [8.2, 0, 13], [8.2, 0.45, 13], [6.4, 0.45, 13]], "#a49e92");
    // parapet
    const g = f.createLinearGradient(0, 738, 0, H);
    g.addColorStop(0, "#b9b2a5");
    g.addColorStop(1, "#7e776c");
    f.fillStyle = g;
    f.fillRect(0, 740, W, H - 740);
    f.fillStyle = "#d8d2c6";
    f.fillRect(0, 734, W, 8);
    f.fillStyle = "rgba(0,0,0,0.25)";
    f.fillRect(0, 742, W, 3);
    f.strokeStyle = "#a07d3a";
    f.lineWidth = 5;
    f.beginPath(); f.moveTo(0, 708); f.lineTo(W, 708); f.stroke();
    f.strokeStyle = "rgba(255,230,160,0.5)";
    f.lineWidth = 1.2;
    f.beginPath(); f.moveTo(0, 706.5); f.lineTo(W, 706.5); f.stroke();
    f.fillStyle = "#6f5626";
    for (let px = 60; px < W; px += 180) f.fillRect(px - 2.5, 708, 5, 28);
  };

  function endCap(x, c) {
    const pts = [];
    for (let i = 0; i <= 30; i++) {
      const th = -0.075 + (i / 30) * (Math.PI + 0.15);
      pts.push([Math.cos(th) * VR, VY + Math.sin(th) * VR, ZEND]);
    }
    pts.push([-VR, WY, ZEND], [VR, WY, ZEND]);
    const sp = c.projPoly(pts);
    AQ.pathPts(x, sp);
    x.fillStyle = "#0c1213";
    x.fill();
    // the tunnel mouth, glowing
    const m = c.proj([0, WY + 1.6, ZEND]);
    const g = x.createRadialGradient(m[0], m[1], 1, m[0], m[1], 46);
    g.addColorStop(0, "rgba(220,255,250,0.95)");
    g.addColorStop(0.18, "rgba(80,230,220,0.7)");
    g.addColorStop(1, "rgba(20,90,90,0)");
    x.fillStyle = g;
    x.fillRect(m[0] - 50, m[1] - 50, 100, 100);
    // soften the vanishing point into dark
    const vp = c.proj([0, VY + 2, ZEND]);
    const d = x.createRadialGradient(vp[0], vp[1], 10, vp[0], vp[1], 160);
    d.addColorStop(0, "rgba(5,8,9,0.55)");
    d.addColorStop(1, "rgba(5,8,9,0)");
    x.fillStyle = d;
    x.fillRect(vp[0] - 170, vp[1] - 170, 340, 340);
  }

  function paintRock(x) {
    const c = cam.proj([0, WY, ROCK.z]);
    const k = cam.f / ROCK.z;
    const rng = AQ.rng(77);
    const pts = [];
    for (let i = 0; i <= 18; i++) {
      const a = Math.PI + (i / 18) * Math.PI;
      const rr = (1.15 + rng() * 0.45) * k;
      pts.push([c[0] + Math.cos(a) * rr * 1.15, c[1] + Math.sin(a) * rr * 0.75 + 2]);
    }
    x.beginPath();
    pts.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])));
    x.closePath();
    const g = x.createLinearGradient(c[0] - k, c[1] - k, c[0] + k, c[1]);
    g.addColorStop(0, "#7b7670");
    g.addColorStop(1, "#2f2d2a");
    x.fillStyle = g;
    x.fill();
    for (let i = 0; i < 26; i++) {
      x.fillStyle = `rgba(${rng() < 0.5 ? "255,255,255" : "0,0,0"},${0.08 + rng() * 0.12})`;
      x.beginPath();
      x.arc(c[0] + (rng() - 0.5) * k * 1.8, c[1] - rng() * k * 0.6, 2 + rng() * 6, 0, Math.PI * 2);
      x.fill();
    }
    S.rockAt = c;
    S.rockK = k;
  }

  // ---------- frame ----------
  S.draw = function (ctx, t, dt) {
    const b = S.b;
    ctx.drawImage(b.back.c, 0, 0, W, H);
    AQ.water(ctx, b.refl.c, {
      clip: waterPoly, y0: VP[1] + 6, y1: 740, horizon: VP[1], amp: 2.4,
      tint: ["rgba(10,60,64,0.28)", "rgba(4,30,36,0.5)"],
    }, t);

    // platform edge lights; now and then they ripple like a train is coming. it isn't.
    st.nextGhost -= dt;
    if (st.nextGhost <= 0) {
      st.nextGhost = 28 + Math.random() * 20;
      st.ghost = 5;
      A.train(true, 5, 0.35);
    }
    if (st.ghost > 0) st.ghost -= dt;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const s of [-1, 1]) {
      for (let z = 7.5; z < 110; z += 2.4) {
        const p = cam.proj([s * (PE + 0.3), 0.02, z]);
        const rx = (cam.f * 0.13) / z;
        let k = 0.35;
        if (st.ghost > 0) k += 0.65 * Math.pow(Math.max(0, Math.sin(z * 0.5 - t * 9)), 2);
        ctx.fillStyle = `rgba(255,240,200,${k * fog([0, 0, z])})`;
        ctx.beginPath();
        ctx.ellipse(p[0], p[1], rx, rx * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // ducks (far first)
    st.ducks.sort((a, b2) => b2.z - a.z);
    for (const d of st.ducks) {
      d.x += d.dir * d.sp * dt;
      if (Math.abs(d.x) > PE - 0.8) d.dir = -Math.sign(d.x);
      const p = cam.proj([d.x, WY, d.z]);
      const s = (cam.f * 0.75) / d.z / 32;
      d.sx = p[0]; d.sy = p[1]; d.s = s;
      // a faint wake
      ctx.strokeStyle = "rgba(220,255,250,0.18)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(p[0] - d.dir * 10 * s, p[1] + 2 * s, 16 * s, 3 * s, 0, 0, Math.PI * 2);
      ctx.stroke();
      AQ.duck(ctx, p[0], p[1], s, d.dir < 0, t);
    }

    // the rock + fountain
    st.burst = Math.max(0, st.burst - dt);
    st.plume.o.rate = 240 + st.burst * 500;
    st.jet.o.speed = 250 + st.burst * 120;
    st.plume.step(dt);
    st.jet.step(dt);
    ctx.drawImage(b.rock.c, 0, 0, W, H);
    st.plume.draw(ctx);
    st.jet.draw(ctx);
    const rc = S.rockAt, k = S.rockK;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + t * 0.6;
      ctx.fillStyle = `rgba(240,255,252,${0.25 + 0.15 * Math.sin(t * 5 + i)})`;
      ctx.beginPath();
      ctx.ellipse(rc[0] + Math.cos(a) * k * 1.3, rc[1] + 3 + Math.sin(a) * k * 0.22, 7, 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    st.ripples.draw(ctx, dt);

    // pigeons crossing the vault
    st.nextBirds -= dt;
    if (st.nextBirds <= 0) {
      st.nextBirds = 9 + Math.random() * 10;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        st.birds.push({ x: dir > 0 ? -30 - i * 40 : W + 30 + i * 40, y: 150 + Math.random() * 120 + i * 12, vx: dir * (140 + Math.random() * 40), ph: Math.random() * 6, s: 1 + Math.random() * 0.4 });
      }
      if (Math.random() < 0.6) A.coo();
    }
    for (const bd of st.birds) {
      bd.x += bd.vx * dt;
      bd.y += Math.sin(bd.ph) * 10 * dt;
      bd.ph += dt * 14;
      AQ.bird(ctx, bd.x, bd.y, bd.s, bd.ph);
    }
    st.birds = st.birds.filter((bd) => bd.x > -100 && bd.x < W + 100);

    ctx.drawImage(b.fg.c, 0, 0, W, H);
  };

  // ---------- interaction ----------
  S.hotspots = function () {
    const hs = [
      {
        id: "tunnel",
        caption: "toward the light",
        test: (x, y) => Math.hypot(x - VP[0], (y - VP[1]) * 1.3) < 48,
        click: () => AQ.app.go(2, { zoom: VP }),
      },
      {
        id: "pylon",
        caption: "station pylon",
        test: (x, y) => x > pylonBox[0] && x < pylonBox[2] && y > pylonBox[1] && y < pylonBox[3],
        click: () => A.announce("Waterfront. Doors will open on the left. And the right. And below."),
      },
    ];
    for (const d of st.ducks) {
      hs.push({
        id: "duck" + d.z,
        caption: "a duck",
        test: (x, y) => d.sx != null && Math.abs(x - d.sx) < 24 * d.s + 6 && y > d.sy - 18 * d.s - 4 && y < d.sy + 8 * d.s + 4,
        click: () => {
          A.quack((d.sx - 600) / 600);
          d.dir = -d.dir;
          d.sp = Math.min(1.2, d.sp + 0.4);
          setTimeout(() => (d.sp = Math.max(0.2, d.sp - 0.4)), 1600);
          st.ripples.add(d.sx, d.sy + 2, 0.25, 0.4);
        },
      });
    }
    hs.push(
      {
        id: "fountain",
        caption: "the fountain",
        test: (x, y) => Math.abs(x - S.rockAt[0]) < S.rockK * 1.5 && y > S.rockAt[1] - 95 && y < S.rockAt[1] + 10,
        click: () => {
          st.burst = 1.2;
          A.splash(0);
        },
      },
      {
        id: "sign",
        caption: "waterfront",
        test: (x, y) => signPolys.some((p) => p && AQ.inPoly(p, x, y)),
        click: () => A.announce("This is Waterfront. Please mind the gap. The gap is full of water."),
      },
      {
        id: "water",
        caption: "the reflecting pool",
        cursor: "crosshair",
        test: (x, y) => y < 734 && waterPoly && AQ.inPoly(waterPoly, x, y),
        click: (x, y) => {
          const depth = (y - VP[1]) / (740 - VP[1]);
          st.ripples.add(x, y, 0.12 + depth * 0.25, 0.3 + depth);
          A.plop((x - 600) / 600, 0.6 + depth * 0.5);
        },
      }
    );
    return hs;
  };

  AQ.scenes[1] = S;
})();
