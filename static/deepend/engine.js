/* the deep end — 2d helpers: math, painters (clouds, ferns, blossoms), led text.
   everything is drawn in a fixed 1200x800 "stage" space and scaled by AQ.R. */
(function () {
  const AQ = (window.AQ = window.AQ || {});
  const W = (AQ.W = 1200);
  const H = (AQ.H = 800);
  AQ.R = 1;
  AQ.scenes = AQ.scenes || [];

  // ---------- small math ----------
  AQ.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  AQ.lerp = (a, b, t) => a + (b - a) * t;
  AQ.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  AQ.ease = {
    inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    out: (t) => 1 - Math.pow(1 - t, 3),
    in: (t) => t * t * t,
    back: (t) => {
      const c = 1.4;
      return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
    },
  };

  AQ.LINES = {
    red: "#bf0d3e",
    orange: "#ed8b00",
    blue: "#009cde",
    green: "#00b140",
    yellow: "#ffd100",
    silver: "#919d9d",
    aqua: "#2fd6d0",
  };
  AQ.LINE_ORDER = ["red", "orange", "blue", "green", "yellow", "silver", "aqua"];

  // ---------- color ----------
  AQ.rgb = (c, k = 1, a = 1) => {
    const r = AQ.clamp(Math.round(c[0] * k), 0, 255);
    const g = AQ.clamp(Math.round(c[1] * k), 0, 255);
    const b = AQ.clamp(Math.round(c[2] * k), 0, 255);
    return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
  };
  AQ.mix = (c1, c2, t) => [AQ.lerp(c1[0], c2[0], t), AQ.lerp(c1[1], c2[1], t), AQ.lerp(c1[2], c2[2], t)];
  AQ.hex = (h) => {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };

  // ---------- canvases ----------
  AQ.makeCanvas = function (w = W, h = H, R = AQ.R) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * R));
    c.height = Math.max(1, Math.round(h * R));
    const x = c.getContext("2d");
    x.setTransform(R, 0, 0, R, 0, 0);
    return { c, x, w, h, R };
  };

  // cheap, portable blur: shrink then grow with smoothing (ctx.filter isn't everywhere)
  AQ.blurCopy = function (src, amount = 10) {
    const k = Math.max(2, amount);
    const small = document.createElement("canvas");
    small.width = Math.max(1, Math.round(src.width / k));
    small.height = Math.max(1, Math.round(src.height / k));
    const sx = small.getContext("2d");
    sx.imageSmoothingQuality = "high";
    sx.drawImage(src, 0, 0, small.width, small.height);
    const mid = document.createElement("canvas");
    mid.width = small.width * 3;
    mid.height = small.height * 3;
    const mx = mid.getContext("2d");
    mx.imageSmoothingQuality = "high";
    mx.drawImage(small, 0, 0, mid.width, mid.height);
    const out = document.createElement("canvas");
    out.width = src.width;
    out.height = src.height;
    const ox = out.getContext("2d");
    ox.imageSmoothingQuality = "high";
    ox.drawImage(mid, 0, 0, out.width, out.height);
    return out;
  };

  // ---------- 3d ----------
  // world: x right, y up, z forward. camera looks down +z (optionally pitched).
  function Camera(o) {
    this.x = o.x || 0;
    this.y = o.y || 0;
    this.z = o.z || 0;
    this.f = o.f || 600;
    this.cx = o.cx == null ? W / 2 : o.cx;
    this.cy = o.cy == null ? H / 2 : o.cy;
    this.near = o.near || 0.25;
  }
  Camera.prototype.toCam = function (p) {
    return [p[0] - this.x, p[1] - this.y, p[2] - this.z];
  };
  Camera.prototype.screen = function (c) {
    return [this.cx + (this.f * c[0]) / c[2], this.cy - (this.f * c[1]) / c[2], c[2]];
  };
  Camera.prototype.proj = function (p) {
    const c = this.toCam(p);
    if (c[2] < this.near) c[2] = this.near;
    return this.screen(c);
  };
  // project a polygon with near-plane clipping. returns screen points or null.
  Camera.prototype.projPoly = function (pts) {
    const n = this.near;
    const cs = pts.map((p) => this.toCam(p));
    let allIn = true;
    for (const c of cs) if (c[2] < n) { allIn = false; break; }
    let poly = cs;
    if (!allIn) {
      const out = [];
      for (let i = 0; i < cs.length; i++) {
        const a = cs[i], b = cs[(i + 1) % cs.length];
        const ain = a[2] >= n, bin = b[2] >= n;
        if (ain) out.push(a);
        if (ain !== bin) {
          const t = (n - a[2]) / (b[2] - a[2]);
          out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, n]);
        }
      }
      if (out.length < 3) return null;
      poly = out;
    }
    return poly.map((c) => this.screen(c));
  };
  AQ.Camera = Camera;

  AQ.sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  AQ.add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  AQ.scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  AQ.dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  AQ.cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  AQ.norm = (a) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  };
  AQ.centroid = (pts) => {
    const c = [0, 0, 0];
    for (const p of pts) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; }
    return AQ.scale(c, 1 / pts.length);
  };

  AQ.pathPts = function (ctx, sp) {
    ctx.beginPath();
    ctx.moveTo(sp[0][0], sp[0][1]);
    for (let i = 1; i < sp.length; i++) ctx.lineTo(sp[i][0], sp[i][1]);
    ctx.closePath();
  };
  AQ.poly3 = function (ctx, cam, pts, fill, stroke, lw) {
    const sp = cam.projPoly(pts);
    if (!sp) return null;
    AQ.pathPts(ctx, sp);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
    return sp;
  };
  // mirror a world-space painter about a horizontal plane y = y0
  AQ.mirrorCam = function (cam, y0) {
    const m = Object.create(Camera.prototype);
    Object.assign(m, cam);
    m.toCam = function (p) {
      return [p[0] - cam.x, 2 * y0 - p[1] - cam.y, p[2] - cam.z];
    };
    return m;
  };

  // ---------- coffered vault ----------
  // builds the famous waffle. returns drawable cells; caller sorts + draws (so two
  // vaults can interleave correctly at a groin crossing).
  //   axis: 'z' (vault runs away from camera) or 'x' (runs left-right)
  //   c: [cx, cy, cz] point on the axis, R radius, depth recess, along [a0,a1], len cell length
  //   n: cells across the half-circle, th: [t0,t1] angle range (0 = right/near spring)
  AQ.vaultCells = function (o) {
    const cells = [];
    const n = o.n, R = o.R, d = o.depth || 0.5, m = o.margin || 0.16;
    const t0 = o.th ? o.th[0] : 0, t1 = o.th ? o.th[1] : Math.PI;
    const a0 = o.along[0], a1 = o.along[1], L = o.len;
    const P = (th, a, r) => {
      const u = Math.cos(th) * r, v = Math.sin(th) * r;
      return o.axis === "z"
        ? [o.c[0] + u, o.c[1] + v, a]
        : [a, o.c[1] + v, o.c[2] + u];
    };
    const count = Math.round((a1 - a0) / L);
    for (let i = 0; i < n; i++) {
      const th0 = t0 + ((t1 - t0) * i) / n;
      const th1 = t0 + ((t1 - t0) * (i + 1)) / n;
      const dth = (th1 - th0) * m;
      for (let j = 0; j < count; j++) {
        const z0 = a0 + j * L, z1 = z0 + L, dz = L * m;
        const mid = P((th0 + th1) / 2, (z0 + z1) / 2, R);
        if (o.skip && o.skip(mid)) continue;
        const outer = [P(th0, z0, R), P(th1, z0, R), P(th1, z1, R), P(th0, z1, R)];
        const open = [P(th0 + dth, z0 + dz, R), P(th1 - dth, z0 + dz, R), P(th1 - dth, z1 - dz, R), P(th0 + dth, z1 - dz, R)];
        const i2 = dth * 2.1, z2 = dz * 2.1;
        const floor = [P(th0 + i2, z0 + z2, R + d), P(th1 - i2, z0 + z2, R + d), P(th1 - i2, z1 - z2, R + d), P(th0 + i2, z1 - z2, R + d)];
        cells.push({ outer, open, floor, mid, axisPt: o.axis === "z" ? [o.c[0], o.c[1], mid[2]] : [mid[0], o.c[1], o.c[2]], th: (th0 + th1) / 2, col: o.col, light: o.light });
      }
    }
    return cells;
  };

  function faceN(pts, toward) {
    let n = AQ.norm(AQ.cross(AQ.sub(pts[1], pts[0]), AQ.sub(pts[2], pts[0])));
    const c = AQ.centroid(pts);
    if (AQ.dot(n, AQ.sub(toward, c)) < 0) n = AQ.scale(n, -1);
    return { n, c };
  }

  AQ.drawVaultCells = function (ctx, cam, cells, opts = {}) {
    // for reflections pass the mirrored eye: same geometry, seen from below the water
    const camPos = opts.camPos || [cam.x, cam.y, cam.z];
    const camPosFn = camPos;
    cells.sort((a, b) => {
      const da = AQ.sub(a.mid, camPos), db = AQ.sub(b.mid, camPos);
      return AQ.dot(db, db) - AQ.dot(da, da);
    });
    for (const cell of cells) {
      const lightAt = cell.light;
      const base = cell.col || [214, 200, 178];
      const fo = faceN(cell.outer, cell.axisPt);
      const ko = lightAt(fo.c, fo.n);
      const so = AQ.poly3(ctx, cam, cell.outer, AQ.rgb(base, ko));
      if (!so) continue;
      // hairline between cells so the grid reads at a distance
      ctx.strokeStyle = AQ.rgb(base, ko * 0.82);
      ctx.lineWidth = 0.6;
      ctx.stroke();
      const sOpen = cam.projPoly(cell.open);
      if (!sOpen) continue;
      ctx.save();
      AQ.pathPts(ctx, sOpen);
      ctx.clip();
      const ff = faceN(cell.floor, cell.axisPt);
      AQ.poly3(ctx, cam, cell.floor, AQ.rgb(base, lightAt(ff.c, ff.n) * 0.86));
      const recess = AQ.centroid(cell.floor);
      const inward = AQ.add(recess, AQ.scale(AQ.sub(cell.axisPt, recess), 0.08));
      for (let k = 0; k < 4; k++) {
        const side = [cell.open[k], cell.open[(k + 1) % 4], cell.floor[(k + 1) % 4], cell.floor[k]];
        const fs = faceN(side, inward);
        const view = camPosFn ? AQ.dot(fs.n, AQ.sub(camPosFn, fs.c)) : 1;
        if (view <= 0 && camPosFn) continue;
        AQ.poly3(ctx, cam, side, AQ.rgb(base, lightAt(fs.c, fs.n) * 0.95));
      }
      ctx.restore();
    }
  };

  // uplight model: platform-edge lights along the vault, plus ambient. brighter low, dimmer at crown.
  AQ.uplight = function (lights, amb = 0.34, gain = 1.0) {
    return function (p, n) {
      let k = amb;
      for (const L of lights) {
        const d = AQ.sub(L.at(p), p);
        const dist = Math.hypot(d[0], d[1], d[2]);
        const dir = AQ.scale(d, 1 / dist);
        const lam = Math.max(0, AQ.dot(n, dir));
        k += (gain * L.k * lam) / (1 + dist * dist * 0.006);
      }
      return Math.min(k, 1.25);
    };
  };

  // ---------- hex tile floor (the red quarry tile) ----------
  AQ.hexFloor = function (ctx, cam, o) {
    const r = o.r || 0.3;
    const hw = r * Math.sqrt(3);
    const rng = AQ.rng(o.seed || 7);
    const base = o.col || [150, 62, 44];
    // base fill
    AQ.poly3(ctx, cam, [[o.x0, o.y, o.z0], [o.x1, o.y, o.z0], [o.x1, o.y, o.z1], [o.x0, o.y, o.z1]], AQ.rgb(base, 0.72));
    const zMax = Math.min(o.z1, (cam.f * r) / 2.2 + cam.z);
    const rows = Math.ceil((zMax - o.z0) / (r * 1.5));
    for (let j = rows; j >= 0; j--) {
      const z = o.z0 + j * r * 1.5;
      const off = j % 2 ? hw / 2 : 0;
      for (let x = o.x0 - hw + off; x < o.x1 + hw; x += hw) {
        const pts = [];
        let inside = true;
        for (let k = 0; k < 6; k++) {
          const a = (Math.PI / 3) * k + Math.PI / 6;
          const px = x + Math.cos(a) * r * 0.93, pz = z + Math.sin(a) * r * 0.93;
          if (px < o.x0 || px > o.x1 || pz < o.z0 || pz > o.z1) inside = false;
          pts.push([px, o.y, pz]);
        }
        if (!inside) continue;
        const dist = Math.hypot(x - cam.x, z - cam.z);
        const glow = o.light ? o.light(x, z) : 1;
        const k = (0.78 + rng() * 0.22) * glow * (1 - Math.min(0.35, dist * 0.004));
        const tint = o.tint ? o.tint(x, z, rng) : base;
        AQ.poly3(ctx, cam, pts, AQ.rgb(tint, k));
      }
    }
  };

  // ---------- sky + clouds ----------
  AQ.paintSky = function (ctx, y0, y1, top = "#2350c8", bottom = "#a9c6f2") {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, y0, W, y1 - y0);
  };
  AQ.paintCloud = function (ctx, rng, cx, cy, s) {
    const puffs = 7 + Math.floor(rng() * 8);
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < puffs; i++) {
        const a = rng() * Math.PI * 2;
        const rr = s * (0.25 + rng() * 0.55);
        const px = cx + Math.cos(a) * s * 0.9 * rng() * 1.4;
        const py = cy + Math.sin(a) * s * 0.28 * rng() - (pass ? rr * 0.25 : 0);
        const g = ctx.createRadialGradient(px, py - rr * 0.3, rr * 0.1, px, py, rr);
        if (pass === 0) {
          g.addColorStop(0, "rgba(150,165,200,0.55)");
          g.addColorStop(1, "rgba(150,165,200,0)");
        } else {
          g.addColorStop(0, "rgba(255,255,255,0.95)");
          g.addColorStop(0.6, "rgba(244,247,255,0.7)");
          g.addColorStop(1, "rgba(235,240,255,0)");
        }
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py + (pass ? 0 : rr * 0.35), rr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  // ---------- foliage ----------
  AQ.cherryBranch = function (ctx, rng, x, y, ang, len, w, depth) {
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    ctx.strokeStyle = "#3b2621";
    ctx.lineWidth = w;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    const bend = (rng() - 0.5) * len * 0.3;
    ctx.quadraticCurveTo((x + x2) / 2 + bend, (y + y2) / 2 - bend, x2, y2);
    ctx.stroke();
    if (depth <= 0 || len < 14) {
      AQ.blossoms(ctx, rng, x2, y2, 10 + len * 0.6);
      return;
    }
    const kids = 2 + (rng() < 0.4 ? 1 : 0);
    for (let i = 0; i < kids; i++) {
      const na = ang + (rng() - 0.5) * 1.3;
      AQ.cherryBranch(ctx, rng, x2, y2, na, len * (0.58 + rng() * 0.22), Math.max(1, w * 0.62), depth - 1);
    }
    if (depth < 3) AQ.blossoms(ctx, rng, (x + x2) / 2, (y + y2) / 2, 8 + len * 0.3);
  };
  AQ.blossoms = function (ctx, rng, x, y, spread) {
    const n = 7 + Math.floor(rng() * 9);
    for (let i = 0; i < n; i++) {
      const px = x + (rng() - 0.5) * spread * 1.6;
      const py = y + (rng() - 0.5) * spread;
      const r = 2.2 + rng() * 3.6;
      const pink = rng();
      ctx.fillStyle = pink < 0.2 ? "#fffafc" : pink < 0.7 ? "#ffd3e2" : "#f7a8c4";
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + rng();
        ctx.ellipse(px + Math.cos(a) * r * 0.7, py + Math.sin(a) * r * 0.7, r * 0.62, r * 0.42, a, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.fillStyle = "#c2416b";
      ctx.beginPath();
      ctx.arc(px, py, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  AQ.bush = function (ctx, rng, x, y, w, h, col = [46, 92, 40]) {
    const cy = y - h * 0.48;
    ctx.fillStyle = AQ.rgb(col, 0.42);
    ctx.beginPath();
    ctx.ellipse(x, cy, w / 2, h * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    const n = Math.round((w * h) / 140);
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * 0.92;
      const u = Math.cos(a) * d, v = Math.sin(a) * d;
      const r = 4 + rng() * 7;
      const k = 0.55 + -v * 0.3 + -u * 0.08 + rng() * 0.25;
      ctx.fillStyle = AQ.rgb(col, k);
      ctx.beginPath();
      ctx.arc(x + (u * w) / 2, cy + v * h * 0.5, r, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  AQ.fern = function (ctx, rng, x, y, size, col = [40, 96, 52]) {
    const fronds = 11;
    for (let i = 0; i < fronds; i++) {
      const a = -Math.PI / 2 + (i / (fronds - 1) - 0.5) * 2.6 + (rng() - 0.5) * 0.2;
      const len = size * (0.65 + rng() * 0.45);
      const k = 0.6 + rng() * 0.5;
      ctx.strokeStyle = AQ.rgb(col, k * 0.8);
      ctx.fillStyle = AQ.rgb(col, k);
      ctx.lineWidth = 1.4;
      let px = x, py = y;
      const steps = 12;
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const droop = t * t * size * 0.5;
        const nx = x + Math.cos(a) * len * t;
        const ny = y + Math.sin(a) * len * t + droop;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(nx, ny);
        ctx.stroke();
        const lw = (1 - t) * size * 0.11 + 2;
        const perp = Math.atan2(ny - py, nx - px) + Math.PI / 2;
        for (const sgn of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(nx + Math.cos(perp) * lw * sgn * 0.8, ny + Math.sin(perp) * lw * sgn * 0.8 + 1, lw, lw * 0.32, perp, 0, Math.PI * 2);
          ctx.fill();
        }
        px = nx; py = ny;
      }
    }
  };

  // ---------- water (the old java "lake applet" trick) ----------
  // src: canvas already holding the reflected image in stage coords (or the scene itself,
  // in which case pass mirrorY to flip about a horizontal line).
  AQ.water = function (ctx, src, o, t) {
    const R = src.width / W;
    const y0 = Math.floor(o.y0), y1 = Math.ceil(o.y1);
    const amp = o.amp || 3;
    const band = o.band || 2;
    ctx.save();
    if (o.clip) { AQ.pathPts(ctx, o.clip); ctx.clip(); }
    for (let y = y0; y < y1; y += band) {
      const depth = (y - (o.horizon != null ? o.horizon : y0)) / (y1 - y0 + 1);
      const a = amp * (0.25 + depth * 1.2);
      const dx = Math.sin(y * 0.11 + t * 2.3) * a + Math.sin(y * 0.037 - t * 1.4) * a * 0.7;
      let sy = o.mirrorY != null ? 2 * o.mirrorY - y : y;
      sy += Math.sin(y * 0.21 + t * 3.1) * a * 0.35;
      if (sy < 0) sy = 0;
      if (sy > H - band) sy = H - band;
      ctx.drawImage(src, 0, sy * R, src.width, band * R, dx - 4, y, W + 8, band + 0.6);
    }
    if (o.tint) {
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, o.tint[0]);
      g.addColorStop(1, o.tint[1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, y0, W, y1 - y0);
    }
    // glints
    if (o.glints !== false) {
      ctx.globalCompositeOperation = "lighter";
      const rng = AQ.rng(Math.floor(t * 3) + 11);
      for (let i = 0; i < (o.glintCount || 26); i++) {
        const gy = y0 + Math.pow(rng(), 0.7) * (y1 - y0);
        const gx = rng() * W;
        const life = (Math.sin(t * 2.4 + i * 1.7) + 1) / 2;
        const len = 4 + ((gy - y0) / (y1 - y0)) * 26;
        ctx.strokeStyle = `rgba(220,255,250,${0.12 * life})`;
        ctx.lineWidth = 1 + ((gy - y0) / (y1 - y0)) * 1.4;
        ctx.beginPath();
        ctx.moveTo(gx - len, gy);
        ctx.lineTo(gx + len, gy);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.restore();
  };

  // expanding ripple rings, squashed by perspective
  AQ.Ripples = function () {
    this.list = [];
  };
  AQ.Ripples.prototype.add = function (x, y, squash = 0.3, big = 1) {
    this.list.push({ x, y, t: 0, squash, big });
  };
  AQ.Ripples.prototype.draw = function (ctx, dt) {
    for (const r of this.list) r.t += dt;
    this.list = this.list.filter((r) => r.t < 2.2);
    for (const r of this.list) {
      for (let k = 0; k < 3; k++) {
        const tt = r.t - k * 0.22;
        if (tt <= 0) continue;
        const rad = tt * 90 * r.big;
        const a = Math.max(0, 0.55 * (1 - tt / 2));
        ctx.strokeStyle = `rgba(230,255,252,${a})`;
        ctx.lineWidth = 2 - k * 0.5;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, rad, rad * r.squash, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  };

  // fountain particles
  AQ.Plume = function (o) {
    this.o = Object.assign({ rate: 220, spread: 0.35, speed: 260, gravity: 420, size: 3, life: 1.6, color: "255,255,255" }, o);
    this.p = [];
    this.acc = 0;
  };
  AQ.Plume.prototype.step = function (dt) {
    const o = this.o;
    this.acc += dt * o.rate;
    while (this.acc > 1) {
      this.acc -= 1;
      const a = -Math.PI / 2 + (Math.random() - 0.5) * o.spread;
      const sp = o.speed * (0.7 + Math.random() * 0.45);
      this.p.push({ x: o.x + (Math.random() - 0.5) * (o.baseW || 6), y: o.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, s: o.size * (0.6 + Math.random()) });
    }
    for (const q of this.p) {
      q.t += dt;
      q.vy += o.gravity * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
    }
    this.p = this.p.filter((q) => q.t < o.life && q.y < o.floor);
  };
  AQ.Plume.prototype.draw = function (ctx) {
    const o = this.o;
    for (const q of this.p) {
      const a = Math.max(0, 0.65 * (1 - q.t / o.life));
      ctx.fillStyle = `rgba(${o.color},${a})`;
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.s * (1 + q.t * 0.8), 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // ---------- led dot-matrix text (5x7) ----------
  const FONT = {
    A: "0E11111F111111", B: "1E11111E11111E", C: "0E11101010110E", D: "1C12111111121C",
    E: "1F10101E10101F", F: "1F10101E101010", G: "0E1110171111 0F", H: "1111111F111111",
    I: "0E04040404040E", J: "0702020202120C", K: "11121418141211", L: "1010101010101F",
    M: "111B1515111111", N: "11111915131111", O: "0E11111111110E", P: "1E11111E101010",
    Q: "0E11111115120D", R: "1E11111E141211", S: "0F10100E01011E", T: "1F040404040404",
    U: "1111111111110E", V: "11111111110A04", W: "1111111515150A", X: "11110A040A1111",
    Y: "1111110A040404", Z: "1F01020408101F", 0: "0E11131519110E", 1: "040C040404040E",
    2: "0E11010204081F", 3: "1F02040201110E", 4: "02060A121F0202", 5: "1F101E0101110E",
    6: "0608101E11110E", 7: "1F010204080808", 8: "0E11110E11110E", 9: "0E11110F01020C",
    " ": "00000000000000", "-": "0000001F000000", ":": "000C0C000C0C00", ".": "00000000000C0C",
    "'": "0C040800000000", "!": "04040404040004", "?": "0E110102040004", "/": "00010204081000",
    ">": "08040201020408", "<": "02040810080402", "&": "0C121408151 20D", "+": "0004041F040400",
    "~": "00000815020000", "#": "0A0A1F0A1F0A0A", ",": "00000000000C04",
  };
  const glyph = (ch) => {
    const s = (FONT[ch] || FONT["?"]).replace(/ /g, "");
    const rows = [];
    for (let i = 0; i < 7; i++) rows.push(parseInt(s.substr(i * 2, 2), 16) || 0);
    return rows;
  };
  AQ.ledWidth = (str, dot) => str.length * 6 * dot;
  // draws lit dots only (call ledBack for the unlit matrix)
  AQ.ledText = function (ctx, str, x, y, dot, color, glow = true) {
    str = String(str).toUpperCase();
    const r = dot * 0.38;
    for (let pass = glow ? 0 : 1; pass < 2; pass++) {
      ctx.fillStyle = pass === 0 ? color.replace("1)", "0.22)") : color;
      for (let i = 0; i < str.length; i++) {
        const g = glyph(str[i]);
        for (let row = 0; row < 7; row++) {
          for (let col = 0; col < 5; col++) {
            if (!(g[row] & (1 << (4 - col)))) continue;
            const px = x + (i * 6 + col) * dot + dot / 2;
            const py = y + row * dot + dot / 2;
            ctx.beginPath();
            ctx.arc(px, py, pass === 0 ? r * 2.1 : r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
  };
  AQ.ledBack = function (ctx, x, y, cols, rows, dot, color = "rgba(120,30,10,0.28)") {
    ctx.fillStyle = color;
    const r = dot * 0.3;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        ctx.beginPath();
        ctx.arc(x + i * dot + dot / 2, y + j * dot + dot / 2, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  // ---------- misc painters ----------
  AQ.roundRect = function (ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  // the bronze metro pylon: square column, M at the top, line-color bands
  AQ.pylon = function (ctx, x, yb, h, w, lit = [], opts = {}) {
    const top = yb - h;
    const side = w * 0.28;
    const dir = opts.side || 1; // which side face shows
    // side face
    ctx.fillStyle = "#2b211a";
    ctx.beginPath();
    if (dir > 0) {
      ctx.moveTo(x + w / 2, top);
      ctx.lineTo(x + w / 2 + side, top + side * 0.5);
      ctx.lineTo(x + w / 2 + side, yb + side * 0.2);
      ctx.lineTo(x + w / 2, yb);
    } else {
      ctx.moveTo(x - w / 2, top);
      ctx.lineTo(x - w / 2 - side, top + side * 0.5);
      ctx.lineTo(x - w / 2 - side, yb + side * 0.2);
      ctx.lineTo(x - w / 2, yb);
    }
    ctx.fill();
    // front
    const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    g.addColorStop(0, "#5a4535");
    g.addColorStop(0.45, "#6e5543");
    g.addColorStop(1, "#47372b");
    ctx.fillStyle = g;
    ctx.fillRect(x - w / 2, top, w, h);
    // cap
    ctx.fillStyle = "#7d6450";
    ctx.fillRect(x - w / 2 - 2, top - 4, w + 4, 6);
    // M
    const mY = top + w * 0.18, mS = w * 0.62;
    ctx.fillStyle = "#f3efe6";
    ctx.font = `bold ${mS}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("M", x, mY);
    // bands
    const names = opts.lines || AQ.LINE_ORDER;
    const bandTop = top + w * 1.05;
    const bh = Math.min(16, (h * 0.32) / names.length);
    names.forEach((nm, i) => {
      const y = bandTop + i * (bh + 3);
      const col = AQ.LINES[nm];
      const on = lit[i] || 0;
      if (on > 0) {
        ctx.save();
        ctx.shadowColor = col;
        ctx.shadowBlur = 24 * on;
        ctx.fillStyle = col;
        ctx.fillRect(x - w * 0.36, y, w * 0.72, bh);
        ctx.restore();
        ctx.fillStyle = `rgba(255,255,255,${0.5 * on})`;
        ctx.fillRect(x - w * 0.36, y + bh * 0.3, w * 0.72, bh * 0.25);
      } else {
        ctx.fillStyle = AQ.rgb(AQ.hex(col), 0.5);
        ctx.fillRect(x - w * 0.36, y, w * 0.72, bh);
      }
    });
    if (opts.label) {
      ctx.fillStyle = "#f3efe6";
      ctx.font = `bold ${opts.labelSize || w * 0.15}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
      ctx.textBaseline = "top";
      const lines = opts.label.split("\n");
      lines.forEach((ln, i) => ctx.fillText(ln, x, bandTop + names.length * (bh + 3) + 10 + i * (opts.labelSize || w * 0.15) * 1.15));
    }
    return { top, bandTop, bh };
  };

  // the washington globe streetlight
  AQ.globeLamp = function (ctx, x, yb, h, lit = 0.3) {
    ctx.fillStyle = "#1c2420";
    ctx.fillRect(x - 3, yb - h, 6, h);
    ctx.fillRect(x - 8, yb - 14, 16, 14);
    ctx.fillRect(x - 6, yb - h - 6, 12, 8);
    const gy = yb - h - 22;
    const g = ctx.createRadialGradient(x - 5, gy - 5, 2, x, gy, 18);
    g.addColorStop(0, `rgba(255,255,240,${0.9})`);
    g.addColorStop(1, `rgba(220,225,215,${0.75})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, gy, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1c2420";
    ctx.fillRect(x - 3, gy - 24, 6, 7);
    if (lit > 0) {
      const halo = ctx.createRadialGradient(x, gy, 10, x, gy, 60);
      halo.addColorStop(0, `rgba(255,250,210,${0.35 * lit})`);
      halo.addColorStop(1, "rgba(255,250,210,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, gy, 60, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  AQ.duck = function (ctx, x, y, s, flip, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flip ? -s : s, s);
    const bob = Math.sin(t * 2.2 + x) * 0.6;
    ctx.translate(0, bob);
    // body
    ctx.fillStyle = "#6b5a46";
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e9e3d6";
    ctx.beginPath();
    ctx.ellipse(-2, 1.5, 9, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3b4a7a";
    ctx.fillRect(-4, -3, 6, 2);
    ctx.fillStyle = "#4a3c30";
    ctx.beginPath();
    ctx.moveTo(-13, -1);
    ctx.lineTo(-18, -5);
    ctx.lineTo(-12, 2);
    ctx.fill();
    // neck + head
    ctx.fillStyle = "#e9e3d6";
    ctx.fillRect(8, -6, 4, 2);
    ctx.fillStyle = "#1f6b3a";
    ctx.beginPath();
    ctx.ellipse(11, -10, 4.8, 4.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e7b42a";
    ctx.beginPath();
    ctx.moveTo(15, -10);
    ctx.lineTo(20, -8.5);
    ctx.lineTo(15, -7.5);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(12, -11, 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  AQ.bird = function (ctx, x, y, s, phase) {
    const f = Math.sin(phase) * 0.8;
    ctx.strokeStyle = "rgba(60,60,70,0.85)";
    ctx.lineWidth = 1.6 * s;
    ctx.beginPath();
    ctx.moveTo(x - 9 * s, y - 6 * s * f);
    ctx.quadraticCurveTo(x - 4 * s, y - 2 * s, x, y);
    ctx.quadraticCurveTo(x + 4 * s, y - 2 * s, x + 9 * s, y - 6 * s * f);
    ctx.stroke();
  };

  // map an image onto a wall plane x = o.x (parallel to the view axis) column by column,
  // which is exact for our no-roll camera because verticals stay vertical
  AQ.wallImage = function (ctx, cam, img, o) {
    const N = Math.min(img.width, 260);
    for (let k = 0; k < N; k++) {
      const u0 = k / N, u1 = (k + 1) / N;
      const za = o.z0 + (o.z1 - o.z0) * u0, zb = o.z0 + (o.z1 - o.z0) * u1;
      const ta = cam.proj([o.x, o.y1, za]), ba = cam.proj([o.x, o.y0, za]);
      const tb = cam.proj([o.x, o.y1, zb]);
      const su = o.flip ? 1 - u1 : u0;
      const dx = Math.min(ta[0], tb[0]);
      const dw = Math.abs(tb[0] - ta[0]) + 0.6;
      ctx.drawImage(img, su * img.width, 0, img.width / N, img.height, dx, ta[1], dw, ba[1] - ta[1]);
    }
  };

  AQ.textCanvas = function (text, o = {}) {
    const h = o.h || 80;
    const font = `${o.weight || "bold"} ${Math.round(h * 0.62)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    const probe = document.createElement("canvas").getContext("2d");
    probe.font = font;
    const w = Math.ceil(probe.measureText(text).width + h * 0.9);
    const c = document.createElement("canvas");
    c.width = o.w || w;
    c.height = h;
    const x = c.getContext("2d");
    x.fillStyle = o.bg || "#4b3a2e";
    x.fillRect(0, 0, c.width, h);
    if (o.stripe) {
      x.fillStyle = o.stripe;
      x.fillRect(0, h - h * 0.1, c.width, h * 0.1);
    }
    x.fillStyle = o.fg || "#f4efe6";
    x.font = font;
    x.textBaseline = "middle";
    x.textAlign = o.align || "center";
    x.fillText(text, o.align === "left" ? h * 0.4 : c.width / 2, h * 0.48);
    return c;
  };

  // polygon hit test
  AQ.inPoly = function (pts, x, y) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
})();
