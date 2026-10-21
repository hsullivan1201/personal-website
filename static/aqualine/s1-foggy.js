/* station 1 — foggy bottom. the gate. */
(function () {
  const AQ = window.AQ;
  const { W, H } = AQ;
  const A = AQ.audio;
  const S = { name: "Foggy Bottom", ambience: "street" };
  const cam = new AQ.Camera({ x: 0, y: 1.6, z: 0, f: 700, cy: 430 });
  const GZ = 8.9; // grille plane
  const OPEN = { x0: 0, x1: 0, y0: 0, y1: 0 };
  const PYL = [
    { wx: -2.6, side: -1 },
    { wx: 2.6, side: 1 },
  ];
  let st = null;

  S.reset = function () {
    st = {
      lit: [new Array(7).fill(0), new Array(7).fill(0)],
      igniting: false,
      igniteT: 0,
      nLit: 0,
      beam: 0,
      ready: false,
      open: 0,
      opening: false,
      cloudX: Math.random() * W,
      petals: [],
      flow: 0,
    };
    for (let i = 0; i < 46; i++) st.petals.push(newPetal(true));
    AQ.app.button(false);
  };
  function newPetal(anywhere) {
    return {
      x: Math.random() * W * 1.1 - 60,
      y: anywhere ? Math.random() * H : -20 - Math.random() * 80,
      vx: 14 + Math.random() * 26,
      vy: 22 + Math.random() * 30,
      r: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 3,
      s: 2.5 + Math.random() * 3,
      ph: Math.random() * 6,
    };
  }

  // ---------- bake ----------
  S.bake = function () {
    const b = (S.b = {});
    const rng = AQ.rng(1201);

    b.sky = AQ.makeCanvas(W, 440);
    AQ.paintSky(b.sky.x, 0, 440, "#1d46c0", "#a3c4f1");

    b.clouds = AQ.makeCanvas(W * 2, 440);
    for (let i = 0; i < 30; i++) {
      const cx = rng() * W * 2;
      const cy = 30 + Math.pow(rng(), 1.3) * 330;
      const s = 34 + rng() * 70 * (1 - cy / 520);
      for (const off of [-W * 2, 0, W * 2]) AQ.paintCloud(b.clouds.x, AQ.rng(i * 97 + 3), cx + off, cy, s);
    }

    // ---- mid: everything between sky and the foreground branches ----
    b.mid = AQ.makeCanvas();
    const x = b.mid.x;

    // the monument, way off, poking over the trees
    {
      const mx = 838, top = 214, base = 432, bw = 9, tw = 6.5;
      const split = base - (base - top) * 0.3;
      x.fillStyle = "#e9e1d3";
      x.beginPath();
      x.moveTo(mx - bw, base); x.lineTo(mx - tw, top + 10); x.lineTo(mx + tw, top + 10); x.lineTo(mx + bw, base);
      x.fill();
      // the famous color change a third of the way up
      x.fillStyle = "#f2ece1";
      x.beginPath();
      x.moveTo(mx - bw, base); x.lineTo(mx - bw + 0.8, split); x.lineTo(mx + bw - 0.8, split); x.lineTo(mx + bw, base);
      x.fill();
      x.fillStyle = "rgba(120,110,130,0.35)";
      x.beginPath();
      x.moveTo(mx + 1, base); x.lineTo(mx + 1, top + 10); x.lineTo(mx + tw, top + 10); x.lineTo(mx + bw, base);
      x.fill();
      x.fillStyle = "#e2d9ca";
      x.beginPath();
      x.moveTo(mx - tw, top + 10); x.lineTo(mx, top); x.lineTo(mx + tw, top + 10);
      x.fill();
      x.fillStyle = "#d33";
      x.fillRect(mx - 0.6, top + 1, 1.2, 1.2);
    }

    // distant trees
    for (let i = 0; i < 90; i++) {
      const tx = rng() * W;
      const ty = 372 + rng() * 40;
      const r = 14 + rng() * 26;
      x.fillStyle = AQ.rgb([34, 66, 38], 0.6 + rng() * 0.5);
      x.beginPath();
      x.arc(tx, ty, r, 0, Math.PI * 2);
      x.fill();
    }
    x.fillStyle = "#1f3a22";
    x.fillRect(0, 405, W, 30);

    // ground: sidewalk to the horizon
    {
      const g = x.createLinearGradient(0, 430, 0, H);
      g.addColorStop(0, "#9c9a92");
      g.addColorStop(1, "#cbc6bb");
      x.fillStyle = g;
      x.fillRect(0, 430, W, H - 430);
      x.strokeStyle = "rgba(90,88,80,0.35)";
      x.lineWidth = 1;
      for (let gx = -40; gx <= 40; gx += 1.6) {
        const a = cam.proj([gx, 0, 2.2]), bb = cam.proj([gx, 0, 120]);
        x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(bb[0], bb[1]); x.stroke();
      }
      for (let gz = 2.4; gz < 60; gz *= 1.0 + 0.16) {
        const a = cam.proj([-60, 0, gz]), bb = cam.proj([60, 0, gz]);
        x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(bb[0], bb[1]); x.stroke();
      }
    }

    // a federal-park fence
    {
      const fz = 30;
      const y0 = cam.proj([0, 0, fz])[1], y1 = cam.proj([0, 1.9, fz])[1];
      x.strokeStyle = "#151816";
      x.lineWidth = 1.2;
      for (let fx = 0; fx < W; fx += 5) {
        x.beginPath(); x.moveTo(fx, y0); x.lineTo(fx, y1); x.stroke();
      }
      x.lineWidth = 2;
      for (const yy of [y1 + 3, y0 - 6]) {
        x.beginPath(); x.moveTo(0, yy); x.lineTo(W, yy); x.stroke();
      }
      x.fillStyle = "#b8973c";
      for (let fx = 0; fx < W; fx += 5) {
        x.beginPath(); x.moveTo(fx - 1.6, y1); x.lineTo(fx, y1 - 5); x.lineTo(fx + 1.6, y1); x.fill();
      }
      for (let fx = 20; fx < W; fx += 120) {
        x.fillStyle = "#151816";
        x.fillRect(fx - 3, y1 - 6, 6, y0 - y1 + 6);
      }
    }

    // the brick hex path (the orange carpet, but municipal)
    AQ.hexFloor(x, cam, {
      x0: -1.22, x1: 1.22, y: 0.005, z0: 2.6, z1: 8.6, r: 0.17, col: [168, 70, 46], seed: 4,
    });
    // granite curbs along it
    for (const sx of [-1, 1]) {
      AQ.poly3(x, cam, [[sx * 1.22, 0.01, 2.6], [sx * 1.4, 0.01, 2.6], [sx * 1.4, 0.01, 8.6], [sx * 1.22, 0.01, 8.6]], "#d9d3c8");
    }
    // threshold
    AQ.poly3(x, cam, [[-1.4, 0.01, 8.6], [1.4, 0.01, 8.6], [1.4, 0.01, GZ], [-1.4, 0.01, GZ]], "#e1dbd0");

    // bushes behind the pylons
    AQ.bush(x, rng, 150, 640, 360, 170);
    AQ.bush(x, rng, 1050, 640, 360, 170);
    AQ.bush(x, rng, 420, 585, 120, 60, [52, 104, 46]);
    AQ.bush(x, rng, 780, 585, 120, 60, [52, 104, 46]);

    // the globe lamps
    AQ.globeLamp(x, cam.proj([-4.7, 0, 9.5])[0], cam.proj([-4.7, 0, 9.5])[1], 270, 0.2);
    AQ.globeLamp(x, cam.proj([4.7, 0, 9.5])[0], cam.proj([4.7, 0, 9.5])[1], 270, 0.2);

    // --- the entrance: what's behind the grille first ---
    const oTL = cam.proj([-1.35, 2.55, GZ]);
    const oBR = cam.proj([1.35, 0, GZ]);
    OPEN.x0 = oTL[0]; OPEN.y0 = oTL[1]; OPEN.x1 = oBR[0]; OPEN.y1 = oBR[1];
    paintWell(x, rng);

    // piers: granite boxes
    const granite = [196, 186, 176];
    for (const sgn of [-1, 1]) {
      const xi = sgn * 1.35, xo = sgn * 2.25;
      // inner side face
      AQ.poly3(x, cam, [[xi, 0, 8.6], [xi, 0, 9.7], [xi, 3.0, 9.7], [xi, 3.0, 8.6]], AQ.rgb(granite, 0.72));
      // front face
      const f = AQ.poly3(x, cam, [[xi, 0, 8.6], [xo, 0, 8.6], [xo, 3.0, 8.6], [xi, 3.0, 8.6]], AQ.rgb(granite, 1));
      // courses
      x.strokeStyle = "rgba(90,80,75,0.35)";
      x.lineWidth = 1;
      for (let yy = 0.5; yy < 3; yy += 0.5) {
        const a = cam.proj([xi, yy, 8.6]), bb = cam.proj([xo, yy, 8.6]);
        x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(bb[0], bb[1]); x.stroke();
      }
      // cap
      AQ.poly3(x, cam, [[xi - sgn * 0.06, 3.0, 8.5], [xo + sgn * 0.06, 3.0, 8.5], [xo + sgn * 0.06, 3.18, 8.5], [xi - sgn * 0.06, 3.18, 8.5]], AQ.rgb(granite, 1.12));
    }
    // grille housing with the station name
    {
      const a = cam.proj([-1.35, 2.55, GZ - 0.05]), bb = cam.proj([1.35, 3.0, GZ - 0.05]);
      x.fillStyle = "#3d2f25";
      x.fillRect(a[0], bb[1], bb[0] - a[0], a[1] - bb[1]);
      x.fillStyle = "#f3eee6";
      x.font = `bold ${Math.round((a[1] - bb[1]) * 0.56)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
      x.textAlign = "center";
      x.textBaseline = "middle";
      x.fillText("Foggy Bottom", 600, (a[1] + bb[1]) / 2 + 1);
      x.fillStyle = AQ.LINES.aqua;
      x.fillRect(a[0], a[1] - 3, bb[0] - a[0], 3);
    }
    // the glass canopy arching over the escalator
    {
      const arc = (z, rise) => {
        const pts = [];
        for (let i = 0; i <= 24; i++) {
          const ph = Math.PI - (i / 24) * Math.PI;
          pts.push([Math.cos(ph) * 2.3, 3.15 + Math.sin(ph) * rise, z]);
        }
        return pts;
      };
      const front = arc(8.5, 1.35), back = arc(12.5, 0.9);
      for (let i = 0; i < 24; i++) {
        const q = [front[i], front[i + 1], back[i + 1], back[i]];
        AQ.poly3(x, cam, q, `rgba(${170 + i},${205 + i},${228},0.42)`, "rgba(60,70,80,0.6)", 1);
      }
      const fs = front.map((p) => cam.proj(p));
      x.strokeStyle = "#5f6870";
      x.lineWidth = 6;
      x.beginPath();
      fs.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])));
      x.stroke();
      x.strokeStyle = "rgba(255,255,255,0.5)";
      x.lineWidth = 1.5;
      x.stroke();
    }

    // ---- emblem (rides on the grille) ----
    b.emblem = AQ.makeCanvas(140, 140);
    paintEmblem(b.emblem.x);

    // ---- foreground branches ----
    b.fg = AQ.makeCanvas();
    const fx = b.fg.x;
    AQ.cherryBranch(fx, AQ.rng(31), -30, 20, 0.12, 150, 16, 4);
    AQ.cherryBranch(fx, AQ.rng(32), -20, -20, 0.5, 95, 10, 4);
    AQ.cherryBranch(fx, AQ.rng(33), W + 30, 20, Math.PI - 0.14, 160, 16, 4);
    AQ.cherryBranch(fx, AQ.rng(34), W + 20, 120, Math.PI - 0.35, 95, 10, 3);

    // pylon screen positions
    for (const p of PYL) {
      const base = cam.proj([p.wx, 0, 6.2]);
      p.x = base[0];
      p.yb = base[1];
      p.h = (cam.f * 4.0) / 6.2;
      p.w = (cam.f * 0.42) / 6.2;
    }
  };

  function paintEmblem(x) {
    const c = 70, r = 62;
    x.strokeStyle = "#1b1e20";
    x.lineWidth = 7;
    x.beginPath(); x.arc(c, c, r, 0, Math.PI * 2); x.stroke();
    x.lineWidth = 3;
    x.beginPath(); x.arc(c, c, r - 20, 0, Math.PI * 2); x.stroke();
    x.fillStyle = "rgba(30,34,36,0.5)";
    x.beginPath(); x.arc(c, c, r - 3, 0, Math.PI * 2); x.arc(c, c, r - 18, 0, Math.PI * 2, true); x.fill();
    const txt = "AQUA LINE • FOUNTAIN SERVICE • EST. NEVER • ";
    x.fillStyle = "#e9e4d8";
    x.font = 'bold 10.5px "Helvetica Neue", Helvetica, Arial, sans-serif';
    x.textAlign = "center";
    x.textBaseline = "middle";
    for (let i = 0; i < txt.length; i++) {
      const a = (i / txt.length) * Math.PI * 2 - Math.PI / 2;
      x.save();
      x.translate(c + Math.cos(a) * (r - 10.5), c + Math.sin(a) * (r - 10.5));
      x.rotate(a + Math.PI / 2);
      x.fillText(txt[i], 0, 0);
      x.restore();
    }
    // three waves and an M
    x.strokeStyle = AQ.LINES.aqua;
    x.lineWidth = 3;
    for (let k = 0; k < 3; k++) {
      x.beginPath();
      for (let i = 0; i <= 30; i++) {
        const px = c - 26 + (i / 30) * 52;
        const py = c + 8 + k * 8 + Math.sin(i / 30 * Math.PI * 3) * 2.6;
        i ? x.lineTo(px, py) : x.moveTo(px, py);
      }
      x.stroke();
    }
    x.fillStyle = "#e9e4d8";
    x.font = 'bold 26px "Helvetica Neue", Helvetica, Arial, sans-serif';
    x.fillText("M", c, c - 9);
  }

  // looking down the escalator shaft: a waffle tube falling away, aqua at the bottom
  function paintWell(x, rng) {
    const { x0, x1, y0, y1 } = OPEN;
    const vx = 600, vy = y0 + (y1 - y0) * 0.62;
    x.save();
    x.beginPath();
    x.rect(x0, y0, x1 - x0, y1 - y0);
    x.clip();
    const g = x.createRadialGradient(vx, vy, 4, vx, vy, (x1 - x0) * 0.75);
    g.addColorStop(0, "#d9fffb");
    g.addColorStop(0.12, "#5fe3dc");
    g.addColorStop(0.45, "#1b5560");
    g.addColorStop(1, "#0b1a1f");
    x.fillStyle = g;
    x.fillRect(x0, y0, x1 - x0, y1 - y0);
    // rings of coffers receding toward the glow
    const rings = 16, segs = 12;
    const R0 = (x1 - x0) * 0.62;
    const ringR = (k) => R0 / (1 + k * 0.42);
    for (let k = rings - 1; k >= 0; k--) {
      const ra = ringR(k), rb = ringR(k + 1);
      const glow = 1 - k / rings;
      for (let s = 0; s < segs; s++) {
        const a0 = Math.PI + (s / segs) * Math.PI, a1 = Math.PI + ((s + 1) / segs) * Math.PI;
        const P = (a, r) => [vx + Math.cos(a) * r, vy + Math.sin(a) * r * 0.95];
        const q = [P(a0, ra), P(a1, ra), P(a1, rb), P(a0, rb)];
        const tone = AQ.mix([40, 120, 125], [190, 205, 196], glow * 0.85);
        AQ.pathPts(x, q);
        x.fillStyle = AQ.rgb(tone, 0.9);
        x.fill();
        const mid = (a0 + a1) / 2, rm = (ra + rb) / 2;
        const ia0 = AQ.lerp(a0, mid, 0.25), ia1 = AQ.lerp(a1, mid, 0.25);
        const ira = AQ.lerp(ra, rm, 0.3), irb = AQ.lerp(rb, rm, 0.3);
        AQ.pathPts(x, [P(ia0, ira), P(ia1, ira), P(ia1, irb), P(ia0, irb)]);
        x.fillStyle = AQ.rgb(tone, 0.62);
        x.fill();
      }
    }
    // the escalator band dropping away
    const bw0 = (x1 - x0) * 0.42, bw1 = 10;
    const band = [[vx - bw0, y1], [vx + bw0, y1], [vx + bw1, vy + 4], [vx - bw1, vy + 4]];
    AQ.pathPts(x, band);
    x.fillStyle = "#2a3b40";
    x.fill();
    x.strokeStyle = "rgba(160,200,200,0.35)";
    x.lineWidth = 1;
    for (let k = 1; k < 40; k++) {
      const f = 1 - 1 / (1 + k * 0.18);
      const yy = AQ.lerp(y1, vy + 4, f);
      const hw = AQ.lerp(bw0, bw1, f);
      x.beginPath(); x.moveTo(vx - hw, yy); x.lineTo(vx + hw, yy); x.stroke();
    }
    // balustrades + handrails
    for (const sgn of [-1, 1]) {
      x.fillStyle = "#3c4a4e";
      AQ.pathPts(x, [[vx + sgn * bw0, y1], [vx + sgn * (bw0 + 18), y1], [vx + sgn * (bw1 + 3), vy + 2], [vx + sgn * bw1, vy + 4]]);
      x.fill();
      x.strokeStyle = "#0b0d0e";
      x.lineWidth = 4;
      x.beginPath(); x.moveTo(vx + sgn * (bw0 + 14), y1 - 22); x.lineTo(vx + sgn * (bw1 + 2), vy - 2); x.stroke();
    }
    x.restore();
    S.well = { vx, vy, bw0, bw1 };
  }

  // ---------- frame ----------
  function drawWater(ctx, t, dt) {
    const { x0, x1, y0, y1 } = OPEN;
    const w = S.well;
    st.flow += dt * (0.5 + st.open * 0.6);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, x1 - x0, y1 - y0);
    ctx.clip();
    ctx.globalCompositeOperation = "lighter";
    // sheets of water sliding down the steps, away from us
    for (let k = 0; k < 26; k++) {
      let s = (k / 26 + st.flow * 0.35) % 1;
      const f = 1 - 1 / (1 + s * 7);
      const yy = AQ.lerp(y1, w.vy + 4, f);
      const hw = AQ.lerp(w.bw0, w.bw1, f);
      const a = 0.12 + 0.12 * Math.sin(k * 2.3 + t * 3);
      ctx.strokeStyle = `rgba(190,255,250,${a})`;
      ctx.lineWidth = 3 * (1 - f) + 0.6;
      ctx.beginPath();
      ctx.moveTo(w.vx - hw * 0.95, yy);
      for (let i = 1; i <= 8; i++) {
        const px = w.vx - hw * 0.95 + (i / 8) * hw * 1.9;
        ctx.lineTo(px, yy + Math.sin(i * 1.7 + t * 6 + k) * 1.4 * (1 - f));
      }
      ctx.stroke();
    }
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.3);
    const g = ctx.createRadialGradient(w.vx, w.vy, 2, w.vx, w.vy, 50);
    g.addColorStop(0, `rgba(160,255,245,${0.18 + 0.12 * pulse})`);
    g.addColorStop(1, "rgba(160,255,245,0)");
    ctx.fillStyle = g;
    ctx.fillRect(w.vx - 60, w.vy - 60, 120, 120);
    ctx.restore();
  }

  function drawGrille(ctx) {
    const { x0, x1, y0, y1 } = OPEN;
    const travel = y1 - y0;
    const bottom = y1 - st.open * travel;
    if (bottom <= y0 + 1) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, x1 - x0, y1 - y0);
    ctx.clip();
    // horizontal slats
    ctx.fillStyle = "rgba(26,30,32,0.9)";
    for (let yy = bottom; yy > y0 - 20; yy -= 22) ctx.fillRect(x0, yy - 4, x1 - x0, 4);
    // vertical bars
    ctx.strokeStyle = "#202427";
    ctx.lineWidth = 2.4;
    for (let xx = x0 + 4; xx < x1; xx += 9) {
      ctx.beginPath(); ctx.moveTo(xx, y0); ctx.lineTo(xx, bottom); ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 0.8;
    for (let xx = x0 + 3.2; xx < x1; xx += 9) {
      ctx.beginPath(); ctx.moveTo(xx, y0); ctx.lineTo(xx, bottom); ctx.stroke();
    }
    // bottom bar
    ctx.fillStyle = "#2a2f33";
    ctx.fillRect(x0, bottom - 7, x1 - x0, 7);
    // the emblem rides up with it
    const ey = (y0 + y1) / 2 + 6 - st.open * travel;
    ctx.drawImage(S.b.emblem.c, 600 - 64, ey - 64, 128, 128);
    ctx.restore();
  }

  function drawBeams(ctx, t) {
    if (st.beam <= 0) return;
    const L = PYL[0], R = PYL[1];
    const k = AQ.ease.out(Math.min(1, st.beam));
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const arcs = [
      [L.x, L.yb - L.h + 10, 500, 120, R.x - 180, 236],
      [R.x, R.yb - R.h + 10, 700, 120, L.x + 180, 236],
    ];
    for (const [ax, ay, cx, cy, bx, by] of arcs) {
      const g = ctx.createLinearGradient(ax, ay, bx, by);
      AQ.LINE_ORDER.forEach((nm, i) => g.addColorStop(i / 6, AQ.LINES[nm]));
      const pts = [];
      for (let i = 0; i <= 40 * k; i++) {
        const u = i / 40;
        pts.push([(1 - u) * (1 - u) * ax + 2 * (1 - u) * u * cx + u * u * bx, (1 - u) * (1 - u) * ay + 2 * (1 - u) * u * cy + u * u * by]);
      }
      if (pts.length < 2) continue;
      for (const [lw, a] of [[16, 0.12], [8, 0.25], [3, 0.9]]) {
        ctx.strokeStyle = a > 0.5 ? `rgba(255,255,255,${0.75 + 0.25 * Math.sin(t * 9)})` : g;
        ctx.globalAlpha = a;
        ctx.lineWidth = lw;
        ctx.lineCap = "round";
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        ctx.stroke();
      }
      // sparks at the tip
      const tip = pts[pts.length - 1];
      for (let s = 0; s < 6; s++) {
        ctx.globalAlpha = 0.5 * Math.random();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(tip[0] + (Math.random() - 0.5) * 12, tip[1] + (Math.random() - 0.5) * 12, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  S.draw = function (ctx, t, dt) {
    const b = S.b;
    // ignition sequence: stripes light alternately, then the beams cross
    if (st.igniting && st.nLit < 14) {
      st.igniteT += dt;
      const want = Math.min(14, Math.floor(st.igniteT / 0.13) + 1);
      while (st.nLit < want) {
        const i = Math.floor(st.nLit / 2), side = st.nLit % 2;
        st.lit[side][i] = 0.01;
        A.ignite(st.nLit);
        st.nLit++;
      }
    }
    for (const arr of st.lit) for (let i = 0; i < 7; i++) if (arr[i] > 0) arr[i] = Math.min(1, arr[i] + dt * 5);
    if (st.nLit >= 14 && st.lit[1][6] >= 1) {
      if (st.beam === 0) A.shimmer();
      st.beam += dt * 1.4;
      if (st.beam >= 1 && !st.ready) {
        st.ready = true;
        if (!st.opening) AQ.app.button(true, "tap in");
      }
    }
    if (st.opening) st.open = Math.min(1, st.open + dt / 1.3);

    ctx.drawImage(b.sky.c, 0, 0, W, 440);
    st.cloudX = (st.cloudX + dt * 5) % (W * 2);
    ctx.drawImage(b.clouds.c, -st.cloudX, 0, W * 2, 440);
    ctx.drawImage(b.clouds.c, W * 2 - st.cloudX, 0, W * 2, 440);
    ctx.drawImage(b.mid.c, 0, 0, W, H);
    drawWater(ctx, t, dt);
    drawGrille(ctx);
    for (let i = 0; i < 2; i++) {
      const p = PYL[i];
      const flick = st.lit[i].map((v) => (v > 0 ? v * (0.85 + 0.15 * Math.sin(t * 13 + i * 3 + v * 7)) : 0));
      AQ.pylon(ctx, p.x, p.yb, p.h, p.w, flick, { side: p.side });
    }
    ctx.drawImage(b.fg.c, 0, 0, W, H);
    drawBeams(ctx, t);
    // petals
    for (const p of st.petals) {
      p.ph += dt;
      p.x += (p.vx + Math.sin(p.ph * 1.3) * 18) * dt;
      p.y += p.vy * dt;
      p.r += p.vr * dt;
      if (p.y > H + 10 || p.x > W + 30) Object.assign(p, newPetal(false));
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = "rgba(255,206,224,0.9)";
      ctx.beginPath();
      ctx.ellipse(0, 0, p.s, p.s * 0.55 * Math.abs(Math.sin(p.ph * 2)) + 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

  // ---------- interaction ----------
  function ignite() {
    if (st.igniting) return;
    st.igniting = true;
  }
  S.onButton = function () {
    if (st.opening || !st.ready) return;
    st.opening = true;
    AQ.app.busy = true;
    AQ.app.button(false);
    A.tap();
    setTimeout(() => {
      A.grille(1.3);
      A.setScene("gateOpen");
    }, 350);
    setTimeout(() => AQ.app.go(1, { zoom: [600, S.well.vy] }), 2300);
  };
  const gatePoly = () => [[OPEN.x0 - 70, OPEN.y0 - 70], [OPEN.x1 + 70, OPEN.y0 - 70], [OPEN.x1 + 70, OPEN.y1], [OPEN.x0 - 70, OPEN.y1]];
  S.hotspots = function () {
    return [
      {
        id: "gate",
        caption: st.ready ? "the gate is open. well, it's ready to be." : "the entrance",
        test: (x, y) => AQ.inPoly(gatePoly(), x, y),
        enter: ignite,
        click: () => {
          ignite();
          if (st.ready) S.onButton();
        },
      },
      {
        id: "pylon",
        caption: "metro pylon",
        test: (x, y) => PYL.some((p) => Math.abs(x - p.x) < p.w * 0.7 && y > p.yb - p.h - 6 && y < p.yb),
        enter: ignite,
        click: () => {
          ignite();
          if (st.ready) A.shimmer(Math.random() < 0.5);
        },
      },
      {
        id: "monument",
        caption: "the washington monument (not a station)",
        test: (x, y) => x > 822 && x < 854 && y > 205 && y < 380,
        click: () => A.announce("The Washington Monument is not a Metro station. Please stop asking."),
      },
      {
        id: "blossoms",
        caption: "cherry blossoms (peak bloom: always)",
        test: (x, y) => (y < 190 && (x < 290 || x > 910)) || (x < 150 && y < 360),
        click: (x, y) => {
          A.chirp();
          for (let i = 0; i < 18; i++) {
            const p = newPetal(false);
            p.x = x + (Math.random() - 0.5) * 60;
            p.y = y + (Math.random() - 0.5) * 40;
            st.petals.push(p);
          }
          if (st.petals.length > 140) st.petals.splice(0, st.petals.length - 140);
        },
      },
    ];
  };
  S.exit = function () {
    AQ.app.button(false);
  };

  AQ.scenes[0] = S;
})();
