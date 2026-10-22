/* station 5 — tidal basin. end of the line. the board rises out of the pool. */
(function () {
  const AQ = window.AQ;
  const { W, H } = AQ;
  const A = AQ.audio;
  const S = { name: "Tidal Basin", ambience: "platform" };
  // a hand-built view: eye 1.6m over the water, looking across at a docked train
  const F = 560, CY = 261, EYE = 1.6;
  const P = (x, y, z) => [600 + (F * x) / z, CY - (F * (y - EYE)) / z];
  const TZ = 5.0; // train / far deck back edge
  const DECK = 0.5;
  const WL = P(0, 0, 4.5)[1]; // far waterline
  const POOL_HW = 3.0;
  const PX = F / TZ; // px per meter at the train
  const DOOR_X = [-3.1, 0, 3.1];
  const DOOR_W = 1.6, DOOR_Y0 = 0.62, DOOR_Y1 = 2.62;
  const CAR_LEN = 23 * PX, CAR_GAP = 0.9 * PX;
  const PANEL = { x: 330, y: 318, w: 540, h: 270 };
  const EMERGE = PANEL.y + PANEL.h; // where the panel breaks the surface
  const DESTS = [
    { dest: "ABOUT", min: "2", url: "/pages/about/" },
    { dest: "NOW", min: "BRD", url: "/pages/now/" },
    { dest: "HORLOGE", min: "4", url: "/horloge/" },
    { dest: "SPARROWS", min: "7", url: "/sparrows/" },
    { dest: "HOME", min: "11", url: "/" },
  ];
  let st = null;
  let poolPoly = null, doorRects = [];

  S.reset = function () {
    st = {
      trainX: 0,
      trainV: 0,
      leaving: false,
      doors: 0, // 0 closed .. 1 open
      doorTarget: 0,
      panel: 0, // 0 sunk .. 1 risen
      panelTarget: 0,
      panelT: 0,
      ripples: new AQ.Ripples(),
      petals: [],
      hoverDoor: false,
      hoverRow: -1,
      boarding: null,
      blink: 0,
    };
    for (let i = 0; i < 12; i++) st.petals.push({ x: (Math.random() - 0.5) * 5, z: 2 + Math.random() * 2.4, r: Math.random() * 6, v: 0.04 + Math.random() * 0.06 });
  };
  S.exit = function () {
    A.stopMusic();
  };

  // ---------- bake ----------
  S.bake = function () {
    if (!st) S.reset();
    const b = (S.b = {});
    b.wall = AQ.makeCanvas();
    paintWall(b.wall.x);
    b.car = AQ.makeCanvas(CAR_LEN + CAR_GAP, 420);
    paintCar(b.car.x);
    b.far = AQ.makeCanvas();
    paintFar(b.far.x);
    b.near = AQ.makeCanvas();
    paintNear(b.near.x);
    b.above = AQ.makeCanvas(); // per-frame composite, used for the reflection
    compose(b.above.x);
    b.frost = { c: AQ.blurCopy(b.above.c, 14 * AQ.R) };
    poolPoly = [P(-POOL_HW, 0, 4.5), P(POOL_HW, 0, 4.5), P(POOL_HW, 0, 1.4), P(-POOL_HW, 0, 1.4)];
    doorRects = DOOR_X.map((dx) => {
      const a = P(dx - DOOR_W / 2, DOOR_Y1, TZ), c = P(dx + DOOR_W / 2, DOOR_Y0, TZ);
      return [a[0], a[1], c[0], c[1]];
    });
  };

  // the far wall: only seen once the train pulls out
  function paintWall(x) {
    x.fillStyle = "#cdbfa7";
    x.fillRect(0, 0, W, WL);
    const cell = 0.95 * PX;
    for (let yy = -cell * 0.3; yy < WL; yy += cell) {
      for (let xx = -cell * 0.5; xx < W; xx += cell) {
        const k = 0.75 + 0.25 * (yy / WL);
        x.fillStyle = AQ.rgb([206, 192, 168], k);
        x.fillRect(xx + 4, yy + 4, cell - 8, cell - 8);
        x.fillStyle = AQ.rgb([206, 192, 168], k * 0.82);
        x.fillRect(xx + 10, yy + 10, cell - 20, cell - 20);
      }
    }
    const sy = P(0, 1.9, TZ)[1];
    const sign = AQ.textCanvas("Tidal Basin", { h: 90, w: 900, stripe: AQ.LINES.aqua });
    x.drawImage(sign, 600 - 4.2 * PX / 2, sy - 0.42 * PX, 4.2 * PX, 0.84 * PX);
    x.fillStyle = "#f3efe6";
    x.font = 'bold 15px "Helvetica Neue", Helvetica, Arial, sans-serif';
    x.textAlign = "center";
    x.fillText("END OF THE LINE · ALL WATER MUST LEAVE THE TRAIN", 600, sy + 0.66 * PX);
  }

  function paintCar(x) {
    const w = CAR_LEN, top = P(0, 3.35, TZ)[1], bot = P(0, 0.3, TZ)[1];
    // body
    const g = x.createLinearGradient(0, top, 0, bot);
    g.addColorStop(0, "#9da3a8");
    g.addColorStop(0.08, "#e1e4e6");
    g.addColorStop(0.5, "#c3c8cc");
    g.addColorStop(1, "#8e9398");
    x.fillStyle = g;
    AQ.roundRect(x, 0, top, w, bot - top, 26);
    x.fill();
    // roof gear
    x.fillStyle = "#7d8287";
    for (let i = 0; i < 4; i++) x.fillRect(w * (0.15 + i * 0.22), top - 8, 90, 10);
    // stripes
    x.fillStyle = AQ.LINES.aqua;
    x.fillRect(0, P(0, 1.1, TZ)[1], w, 9);
    x.fillStyle = "#3c4248";
    x.fillRect(0, P(0, 1.1, TZ)[1] + 12, w, 3);
    const cx = w / 2; // car center in sprite coords
    const doorAt = (dx) => cx + dx * PX;
    const doorList = [-9.4, -6.25, ...DOOR_X, 6.25, 9.4];
    // windows between the doors
    const wy0 = P(0, 2.45, TZ)[1], wy1 = P(0, 1.45, TZ)[1];
    const occupied = doorList.map((d) => [doorAt(d) - (DOOR_W / 2) * PX - 16, doorAt(d) + (DOOR_W / 2) * PX + 16]);
    for (let xx = 30; xx < w - 120; xx += 1.35 * PX) {
      const x0 = xx, x1 = xx + 1.1 * PX;
      if (occupied.some(([a, c]) => x1 > a && x0 < c)) continue;
      interior(x, x0, wy0, x1 - x0, wy1 - wy0, 14);
    }
    // door frames + interior behind the leaves
    for (const d of doorList) {
      const dxs = doorAt(d), hw = (DOOR_W / 2) * PX;
      const y0 = P(0, DOOR_Y1, TZ)[1], y1 = P(0, DOOR_Y0, TZ)[1];
      x.fillStyle = "#6e1b1b";
      AQ.roundRect(x, dxs - hw - 10, y0 - 10, hw * 2 + 20, y1 - y0 + 14, 10);
      x.fill();
      interior(x, dxs - hw, y0, hw * 2, y1 - y0, 6, true);
      // door indicator lamp
      x.fillStyle = "#5a3a10";
      x.beginPath(); x.arc(dxs, y0 - 22, 6, 0, Math.PI * 2); x.fill();
    }
    // destination sign
    const sx = doorAt(-1.55) - 1.0 * PX, sy = P(0, 3.0, TZ)[1];
    x.fillStyle = "#0b0b0b";
    AQ.roundRect(x, sx, sy, 2.0 * PX, 30, 4);
    x.fill();
    AQ.ledText(x, "AQ  TIDAL BASIN", sx + 10, sy + 6, 2.2, "rgba(255,157,46,1)");
    // car number
    x.fillStyle = "#30353a";
    x.font = 'bold 13px "Helvetica Neue", Helvetica, Arial, sans-serif';
    x.fillText("7777", doorAt(-0.95) - 22, P(0, 0.75, TZ)[1]);
    // car ends
    x.fillStyle = "#7c8186";
    x.fillRect(0, top + 20, 6, bot - top - 20);
    x.fillRect(w - 6, top + 20, 6, bot - top - 20);
  }

  // the inside of the car: warm light, poles, red and blue seats
  function interior(x, x0, y0, w, h, r, door) {
    x.save();
    AQ.roundRect(x, x0, y0, w, h, r);
    x.clip();
    const g = x.createLinearGradient(0, y0, 0, y0 + h);
    g.addColorStop(0, "#f6f1df");
    g.addColorStop(0.5, "#c9c3b0");
    g.addColorStop(1, "#6a6458");
    x.fillStyle = g;
    x.fillRect(x0, y0, w, h);
    // far windows (the other side of the car)
    x.fillStyle = "rgba(40,60,70,0.55)";
    x.fillRect(x0, y0 + h * 0.12, w, h * (door ? 0.32 : 0.45));
    // seats
    const seatY = y0 + h * (door ? 0.62 : 0.66);
    for (let sx = x0 - 20; sx < x0 + w; sx += 46) {
      x.fillStyle = Math.floor(sx / 46) % 2 ? "#a3263a" : "#2c4a8a";
      x.fillRect(sx, seatY, 40, h * 0.3);
    }
    // stanchion
    if (door) {
      x.fillStyle = "#e6e2d8";
      x.fillRect(x0 + w / 2 - 2, y0, 4, h);
    }
    x.restore();
  }

  function paintFar(x) {
    // the vault strip above the train
    const top = P(0, 3.35, TZ)[1];
    x.fillStyle = "#bfb099";
    x.fillRect(0, 0, W, top + 6);
    for (let i = -2; i < 14; i++) {
      const xx = i * 96 - (i * i * 0.0);
      x.fillStyle = "#cfc1a9";
      x.fillRect(xx + 6, 4, 84, top - 10);
      x.fillStyle = "#ad9e86";
      x.fillRect(xx + 18, 10, 60, top - 24);
    }
    // lamp + rays
    x.save();
    x.globalCompositeOperation = "lighter";
    const g = x.createRadialGradient(600, 6, 2, 600, 6, 120);
    g.addColorStop(0, "rgba(255,250,230,0.95)");
    g.addColorStop(1, "rgba(255,250,230,0)");
    x.fillStyle = g;
    x.fillRect(480, -100, 240, 230);
    x.restore();
    // far deck: steps down into the water
    const d0 = P(0, DECK, 4.5)[1], d1 = P(0, DECK, TZ)[1];
    x.fillStyle = "#93402c";
    x.fillRect(0, d1, W, d0 - d1);
    x.strokeStyle = "rgba(0,0,0,0.18)";
    x.lineWidth = 1;
    for (let xx = -20; xx < W + 20; xx += 22) {
      x.beginPath(); x.moveTo(xx, d1); x.lineTo(600 + (xx - 600) * 1.11, d0); x.stroke();
    }
    x.fillStyle = "#d4cdbf";
    x.fillRect(0, d0 - 3, W, 5);
    const stepH = (WL - d0) / 2;
    for (let k = 0; k < 2; k++) {
      const yy = d0 + k * stepH;
      x.fillStyle = k ? "#6b2d20" : "#7c3424";
      x.fillRect(0, yy + 2, W, stepH);
      x.fillStyle = "#c8c0b2";
      x.fillRect(0, yy + stepH - 1, W, 3);
    }
    // petals on the deck
    const rng = AQ.rng(55);
    for (let i = 0; i < 70; i++) {
      x.fillStyle = rng() < 0.5 ? "rgba(214,140,200,0.85)" : "rgba(255,190,215,0.9)";
      x.beginPath();
      x.ellipse(rng() * W, d1 + rng() * (d0 - d1 + 4), 2.6, 1.3, rng() * 3, 0, Math.PI * 2);
      x.fill();
    }
    // urns and little palms between the doors
    for (const ux of [-1.55, 1.55]) {
      const c = P(ux, DECK, 4.75);
      x.fillStyle = "#7a3d22";
      x.beginPath();
      x.moveTo(c[0] - 12, c[1]);
      x.quadraticCurveTo(c[0] - 22, c[1] - 26, c[0] - 9, c[1] - 38);
      x.lineTo(c[0] + 9, c[1] - 38);
      x.quadraticCurveTo(c[0] + 22, c[1] - 26, c[0] + 12, c[1]);
      x.fill();
      x.fillStyle = "rgba(255,255,255,0.15)";
      x.fillRect(c[0] - 6, c[1] - 34, 4, 26);
    }
    // pillars with speakers and line-colored capitals
    for (const s of [-1, 1]) {
      const c = P(s * 4.55, DECK, 4.7);
      const pw = (0.6 * F) / 4.7;
      x.fillStyle = "#34302c";
      x.fillRect(c[0] - pw / 2, 0, pw, c[1]);
      x.fillStyle = "rgba(255,255,255,0.06)";
      x.fillRect(c[0] - pw / 2, 0, pw * 0.25, c[1]);
      const capY = P(0, 2.95, 4.7)[1];
      AQ.LINE_ORDER.forEach((nm, i) => {
        x.fillStyle = AQ.LINES[nm];
        x.fillRect(c[0] - pw / 2 - 5, capY + i * 5, pw + 10, 5);
      });
      // speaker
      const spY = P(0, 3.4, 4.7)[1];
      x.fillStyle = "#cfc9bf";
      x.beginPath(); x.arc(c[0], spY, pw * 0.32, 0, Math.PI * 2); x.fill();
      x.fillStyle = "#3a3a3a";
      x.beginPath(); x.arc(c[0], spY, pw * 0.2, 0, Math.PI * 2); x.fill();
      x.fillStyle = "#cfc9bf";
      x.beginPath(); x.arc(c[0] - pw * 0.15, spY + pw * 0.44, pw * 0.1, 0, Math.PI * 2); x.arc(c[0] + pw * 0.15, spY + pw * 0.44, pw * 0.1, 0, Math.PI * 2); x.fill();
      if (s < 0) {
        // the "painting": a framed strip map of the aqua line
        const py = P(0, 2.4, 4.7)[1], ph = (1.1 * F) / 4.7;
        x.fillStyle = "#c7a24a";
        x.fillRect(c[0] - pw * 0.42, py, pw * 0.84, ph);
        x.fillStyle = "#f4efe3";
        x.fillRect(c[0] - pw * 0.36, py + 5, pw * 0.72, ph - 10);
        x.fillStyle = AQ.LINES.aqua;
        x.fillRect(c[0] - 2, py + 12, 4, ph - 24);
        for (let i = 0; i < 5; i++) {
          x.fillStyle = "#fff";
          x.strokeStyle = "#222";
          x.lineWidth = 1.5;
          x.beginPath(); x.arc(c[0], py + 14 + i * ((ph - 28) / 4), 4, 0, Math.PI * 2); x.fill(); x.stroke();
        }
      }
    }
  }

  function paintNear(x) {
    // side decks with coping, ferns, petals
    for (const s of [-1, 1]) {
      const e0 = P(s * POOL_HW, 0, 4.5), e1 = P(s * POOL_HW, 0, 1.4);
      const t0 = P(s * POOL_HW, DECK * 0.6, 4.5), t1 = P(s * POOL_HW, DECK * 0.6, 1.4);
      const edgeX = s < 0 ? 0 : W;
      x.fillStyle = "#8e3e2b";
      x.beginPath();
      x.moveTo(t0[0], t0[1]); x.lineTo(t1[0], t1[1]); x.lineTo(edgeX, H + 400); x.lineTo(edgeX, t0[1]);
      x.closePath();
      x.fill();
      x.fillStyle = "#6c2b1e";
      x.beginPath();
      x.moveTo(t0[0], t0[1]); x.lineTo(t1[0], t1[1]); x.lineTo(e1[0], e1[1]); x.lineTo(e0[0], e0[1]);
      x.closePath();
      x.fill();
      x.strokeStyle = "#d8d0c2";
      x.lineWidth = 4;
      x.beginPath(); x.moveTo(t0[0], t0[1]); x.lineTo(t1[0], t1[1]); x.stroke();
      // a hint of the far deck wrapping round
      x.fillStyle = "#8e3e2b";
      x.fillRect(s < 0 ? 0 : t0[0], WL - 2, s < 0 ? t0[0] : W - t0[0], t0[1] - WL + 6);
    }
    const rng = AQ.rng(91);
    for (let i = 0; i < 50; i++) {
      const s = rng() < 0.5 ? -1 : 1;
      const z = 1.6 + rng() * 2.9;
      const p = P(s * (POOL_HW + 0.15 + rng() * 1.6), DECK * 0.6, z);
      x.fillStyle = rng() < 0.5 ? "rgba(214,140,200,0.9)" : "rgba(255,190,215,0.9)";
      x.beginPath();
      x.ellipse(p[0], p[1], 3.5, 1.8, rng() * 3, 0, Math.PI * 2);
      x.fill();
    }
    // potted ferns, big, like the ones flanking the pool in the original
    for (const [px, py, sz, seed] of [[70, 560, 210, 71], [1130, 560, 210, 72], [-10, 700, 260, 73], [1210, 700, 260, 74]]) {
      x.fillStyle = "#3b2a20";
      x.beginPath();
      x.moveTo(px - sz * 0.22, py);
      x.lineTo(px - sz * 0.17, py + sz * 0.35);
      x.lineTo(px + sz * 0.17, py + sz * 0.35);
      x.lineTo(px + sz * 0.22, py);
      x.fill();
      AQ.fern(x, AQ.rng(seed), px, py, sz, [36, 98, 54]);
    }
  }

  // ---------- compose + frame ----------
  function drawLeaves(x, ox) {
    const cx = ox + CAR_LEN / 2;
    for (const d of [-9.4, -6.25, ...DOOR_X, 6.25, 9.4]) {
      const dxs = cx + d * PX, hw = (DOOR_W / 2) * PX;
      if (dxs + hw < -20 || dxs - hw > W + 20) continue;
      const y0 = P(0, DOOR_Y1, TZ)[1], y1 = P(0, DOOR_Y0, TZ)[1];
      const slide = AQ.ease.inOut(st.doors) * hw * 0.92;
      for (const s of [-1, 1]) {
        const lx = s < 0 ? dxs - hw - slide : dxs + slide;
        x.save();
        x.beginPath();
        x.rect(dxs - hw, y0, hw * 2, y1 - y0);
        x.clip();
        const g = x.createLinearGradient(lx, 0, lx + hw, 0);
        g.addColorStop(0, "#c9cdd1");
        g.addColorStop(1, "#aeb3b8");
        x.fillStyle = g;
        x.fillRect(lx, y0, hw, y1 - y0);
        // tall window
        x.fillStyle = "#2a3a44";
        AQ.roundRect(x, lx + hw * 0.18, y0 + (y1 - y0) * 0.08, hw * 0.64, (y1 - y0) * 0.5, 10);
        x.fill();
        x.strokeStyle = "rgba(255,255,255,0.25)";
        x.lineWidth = 3;
        x.beginPath();
        x.moveTo(lx + hw * 0.25, y0 + (y1 - y0) * 0.45);
        x.lineTo(lx + hw * 0.6, y0 + (y1 - y0) * 0.14);
        x.stroke();
        x.fillStyle = "#111";
        x.fillRect(s < 0 ? lx + hw - 3 : lx, y0, 3, y1 - y0);
        x.restore();
      }
    }
  }
  function compose(x) {
    const b = S.b;
    x.clearRect(0, 0, W, H);
    x.drawImage(b.wall.c, 0, 0, W, H);
    const ox0 = 600 - CAR_LEN / 2 + st.trainX;
    for (let k = 0; k < 3; k++) {
      const ox = ox0 + k * (CAR_LEN + CAR_GAP);
      if (ox > W || ox + CAR_LEN < 0) continue;
      x.drawImage(b.car.c, ox, 0, CAR_LEN + CAR_GAP, 420);
      drawLeaves(x, ox);
    }
    // door lamps blink while doors move
    if (st.doors > 0.01 && st.doors < 0.99 || st.boarding) {
      const on = Math.floor(AQ.app.t * 4) % 2 === 0;
      if (on) {
        x.save();
        x.globalCompositeOperation = "lighter";
        for (const d of DOOR_X) {
          const p = [ox0 + CAR_LEN / 2 + d * PX, P(0, DOOR_Y1, TZ)[1] - 22];
          const g = x.createRadialGradient(p[0], p[1], 1, p[0], p[1], 18);
          g.addColorStop(0, "rgba(255,190,60,1)");
          g.addColorStop(1, "rgba(255,190,60,0)");
          x.fillStyle = g;
          x.fillRect(p[0] - 18, p[1] - 18, 36, 36);
        }
        x.restore();
      }
    }
    x.drawImage(b.far.c, 0, 0, W, H);
  }

  function drawPanel(ctx, t) {
    const k = AQ.ease.back(Math.min(1, st.panel)) ;
    const off = (1 - Math.min(1, k)) * (PANEL.h + 20);
    if (st.panel <= 0.001) return;
    const { x, w, h } = PANEL;
    const y = PANEL.y + off;
    const shape = (c, yy) => {
      // a slab of glass with a gently bowed top edge
      c.beginPath();
      c.moveTo(x + 14, yy + 6);
      c.quadraticCurveTo(x + w / 2, yy - 8, x + w - 14, yy + 6);
      c.quadraticCurveTo(x + w, yy + 8, x + w - 2, yy + 26);
      c.lineTo(x + w - 10, yy + h);
      c.lineTo(x + 10, yy + h);
      c.lineTo(x + 2, yy + 26);
      c.quadraticCurveTo(x, yy + 8, x + 14, yy + 6);
      c.closePath();
    };
    // reflection under the surface
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, EMERGE, W, 140);
    ctx.clip();
    ctx.globalAlpha = 0.12;
    ctx.translate(0, EMERGE * 2);
    ctx.scale(1, -1);
    shape(ctx, y);
    ctx.fillStyle = "rgba(200,240,240,0.9)";
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, EMERGE);
    ctx.clip();
    shape(ctx, y);
    ctx.save();
    ctx.clip();
    ctx.drawImage(S.b.frost.c, 0, 0, W, H);
    ctx.fillStyle = "rgba(190,232,232,0.2)";
    ctx.fillRect(x, y - 10, w, h + 10);
    // refractive streaks
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 9; i++) {
      const sx = x + 20 + ((i * 61 + t * 6) % (w - 40));
      const g = ctx.createLinearGradient(sx, 0, sx + 26, 0);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.5, "rgba(255,255,255,0.05)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(sx, y - 10, 26, h + 10);
    }
    const sh = ctx.createLinearGradient(x, y, x + w * 0.6, y + h);
    sh.addColorStop(0, "rgba(255,255,255,0.22)");
    sh.addColorStop(0.4, "rgba(255,255,255,0.02)");
    sh.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sh;
    ctx.fillRect(x, y - 10, w, h + 10);
    ctx.globalCompositeOperation = "source-over";
    drawPanelContent(ctx, x, y, w, h, t);
    ctx.restore();
    shape(ctx, y);
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
    // foam where it cuts the surface
    if (st.panel < 1.2) {
      for (let i = 0; i < 18; i++) {
        const fx = x + (i / 17) * w;
        ctx.fillStyle = `rgba(235,255,255,${0.3 + 0.2 * Math.sin(t * 6 + i)})`;
        ctx.beginPath();
        ctx.ellipse(fx, EMERGE + 2, 18, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  const LED = "rgba(255,157,46,1)", LED_AQ = "rgba(80,240,230,1)", DOT = 2.35;
  function drawPanelContent(ctx, x, y, w, h, t) {
    const placeholder = st.panelT < 0.75;
    // logo, stacked lowercase like the original
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = '300 25px "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ["aqua", "line", "club"].forEach((wd, i) => ctx.fillText(wd, x + 24, y + 48 + i * 23));
    // progress bar along the top
    const bx = x + 125, bw = w - 150;
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(bx, y + 22, bw, 2);
    const prog = A.music.playing ? (AQ.app.t * 0.02) % 1 : 0.6;
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillRect(bx, y + 21, bw * prog, 4);
    // the arrival board
    const lx = bx, ly = y + 34, lw = bw, lh = 150;
    ctx.fillStyle = "rgba(8,8,8,0.88)";
    AQ.roundRect(ctx, lx, ly, lw, lh, 5);
    ctx.fill();
    const rowH = 24, cols = Math.floor((lw - 12) / (DOT * 6));
    const px0 = lx + 8;
    const line = (str, row, col, color) => AQ.ledText(ctx, str, px0 + col * DOT * 6, ly + 8 + row * rowH, DOT, color);
    line("LN CAR DEST", 0, 0, "rgba(255,120,40,1)");
    line("MIN", 0, cols - 3, "rgba(255,120,40,1)");
    DESTS.forEach((d, i) => {
      const r = i + 1;
      const hot = st.hoverRow === i;
      const boarding = st.boarding && st.boarding.row === i;
      if (boarding && Math.floor(t * 6) % 2) return;
      if (hot) {
        ctx.fillStyle = "rgba(255,157,46,0.12)";
        ctx.fillRect(lx + 3, ly + 4 + r * rowH, lw - 6, rowH - 2);
      }
      if (placeholder) {
        line("txtDest", r, 7, LED);
        return;
      }
      line("AQ", r, 0, LED_AQ);
      line(i % 2 ? "6" : "8", r, 3, LED);
      line(d.dest, r, 7, LED);
      let mn = d.min;
      if (mn === "BRD" && Math.floor(t * 2) % 2) mn = "";
      line(mn, r, cols - mn.length, LED);
    });
    // player row
    const tr = A.tracks[A.music.index];
    ctx.fillStyle = "#fff";
    ctx.font = 'bold 15px "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.fillText(placeholder ? "txtTitle" : tr.title, bx, y + 206);
    ctx.font = '12px "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillText(placeholder ? "txtTitle" : tr.sub, bx, y + 222);
    S.buttons = [];
    const icons = ["prev", A.music.playing ? "pause" : "play", "stop", "next"];
    icons.forEach((ic, i) => {
      const cx = x + 36 + i * 24, cy = y + 214;
      S.buttons.push({ ic, cx, cy, r: 10 });
      ctx.fillStyle = "rgba(10,20,22,0.75)";
      ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      if (ic === "play") { ctx.moveTo(cx - 3, cy - 5); ctx.lineTo(cx + 5, cy); ctx.lineTo(cx - 3, cy + 5); }
      else if (ic === "pause") { ctx.rect(cx - 4, cy - 4.5, 3, 9); ctx.rect(cx + 1, cy - 4.5, 3, 9); }
      else if (ic === "stop") { ctx.rect(cx - 4, cy - 4, 8, 8); }
      else if (ic === "prev") { ctx.moveTo(cx + 4, cy - 4.5); ctx.lineTo(cx - 1, cy); ctx.lineTo(cx + 4, cy + 4.5); ctx.moveTo(cx - 1, cy - 4.5); ctx.lineTo(cx - 6, cy); ctx.lineTo(cx - 1, cy + 4.5); }
      else { ctx.moveTo(cx - 4, cy - 4.5); ctx.lineTo(cx + 1, cy); ctx.lineTo(cx - 4, cy + 4.5); ctx.moveTo(cx + 1, cy - 4.5); ctx.lineTo(cx + 6, cy); ctx.lineTo(cx + 1, cy + 4.5); }
      ctx.fill();
    });
    // little meter that dances while music plays
    for (let i = 0; i < 16; i++) {
      const hgt = A.music.playing ? 4 + Math.abs(Math.sin(t * (3 + i * 0.7) + i)) * 18 : 3;
      ctx.fillStyle = `rgba(80,240,230,${0.35 + i / 40})`;
      ctx.fillRect(x + w - 26 - (16 - i) * 9, y + 226 - hgt, 6, hgt);
    }
    S.rows = DESTS.map((d, i) => [lx, ly + 4 + (i + 1) * rowH, lx + lw, ly + 4 + (i + 2) * rowH]);
  }

  S.draw = function (ctx, t, dt) {
    const b = S.b;
    // panel + doors + train physics
    if (st.panelTarget !== st.panel) {
      const dir = Math.sign(st.panelTarget - st.panel);
      st.panel = AQ.clamp(st.panel + dir * dt / 1.3, 0, 1);
    }
    if (st.panel >= 1) st.panelT += dt;
    else st.panelT = 0;
    if (st.doorTarget !== st.doors) {
      const dir = Math.sign(st.doorTarget - st.doors);
      st.doors = AQ.clamp(st.doors + dir * dt / 0.7, 0, 1);
    }
    if (st.leaving) {
      st.trainV += dt * 180;
      st.trainX -= st.trainV * dt;
    }

    compose(b.above.x);
    ctx.drawImage(b.above.c, 0, 0, W, H);
    AQ.water(ctx, b.above.c, {
      clip: poolPoly, y0: WL, y1: H, mirrorY: WL, horizon: WL, amp: 2.6,
      tint: ["rgba(20,96,100,0.32)", "rgba(6,46,56,0.62)"],
    }, t);
    // floating petals
    for (const p of st.petals) {
      p.x += p.v * dt * 0.6;
      p.r += dt * 0.4;
      if (p.x > 3) p.x = -3;
      const s = P(p.x, 0, p.z);
      const k = F / p.z / 140;
      ctx.fillStyle = "rgba(255,196,220,0.9)";
      ctx.beginPath();
      ctx.ellipse(s[0], s[1] + Math.sin(t * 1.5 + p.r) * 1.2, 4 * k + 1.5, 2 * k + 0.8, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    st.ripples.draw(ctx, dt);
    // door glow on hover, violet-to-aqua like the original's shimmer
    if (st.hoverDoor && !st.leaving) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const a = 0.35 + 0.2 * Math.sin(t * 5);
      for (const r of doorRects) {
        const g = ctx.createLinearGradient(r[0], r[1], r[2], r[3]);
        g.addColorStop(0, `rgba(190,90,255,${a})`);
        g.addColorStop(1, `rgba(60,240,230,${a})`);
        ctx.strokeStyle = g;
        ctx.lineWidth = 6;
        AQ.roundRect(ctx, r[0] - 12, r[1] - 12, r[2] - r[0] + 24, r[3] - r[1] + 18, 12);
        ctx.stroke();
      }
      ctx.restore();
    }
    drawPanel(ctx, t);
    ctx.drawImage(b.near.c, 0, 0, W, H);
  };

  // ---------- interaction ----------
  function raise() {
    st.panelTarget = 1;
    A.shimmer(true);
    if (!A.music.playing) A.playTrack(A.music.index);
  }
  function sink() {
    st.panelTarget = 0;
    A.shimmer(false);
  }
  function depart(url, row) {
    if (st.boarding) return;
    st.boarding = { row };
    AQ.app.busy = true;
    AQ.app.caption("");
    A.stopMusic();
    if (row != null) A.ui();
    setTimeout(() => sink(), 500);
    setTimeout(() => { st.doorTarget = 1; A.doors(); }, 700);
    setTimeout(() => A.announce("Step back. Doors closing."), 1500);
    setTimeout(() => { st.doorTarget = 0; A.doors(); }, 3300);
    setTimeout(() => { st.leaving = true; A.train(false, 5); }, 4200);
    setTimeout(() => {
      if (url) {
        AQ.app.go(0, { fade: true, dur: 0.9 });
        setTimeout(() => (window.location.href = url), 950);
      } else {
        AQ.app.go(0, { fade: true, dur: 1.2 });
      }
    }, 6200);
  }
  const inPanel = (x, y) => st.panel > 0.95 && x > PANEL.x && x < PANEL.x + PANEL.w && y > PANEL.y - 6 && y < EMERGE;
  S.hotspots = function () {
    const hs = [];
    if (st.panel > 0.95 && st.panelT > 0.75) {
      (S.rows || []).forEach((r, i) => {
        hs.push({
          id: "row" + i,
          caption: `board for ${DESTS[i].dest.toLowerCase()}`,
          test: (x, y) => x > r[0] && x < r[2] && y > r[1] && y < r[3],
          enter: () => (st.hoverRow = i),
          leave: () => (st.hoverRow = -1),
          click: () => depart(DESTS[i].url, i),
        });
      });
      (S.buttons || []).forEach((bt) => {
        hs.push({
          id: "btn" + bt.ic,
          caption: { prev: "previous track", next: "next track", play: "play", pause: "pause", stop: "stop" }[bt.ic],
          test: (x, y) => Math.hypot(x - bt.cx, y - bt.cy) < bt.r + 3,
          click: () => {
            A.ui();
            if (bt.ic === "play") A.playTrack(A.music.index);
            else if (bt.ic === "pause" || bt.ic === "stop") A.stopMusic();
            else A.playTrack(A.music.index + (bt.ic === "next" ? 1 : -1));
          },
        });
      });
    }
    hs.push(
      {
        id: "panel",
        caption: "",
        cursor: "default",
        test: inPanel,
        click: () => {},
      },
      {
        id: "doors",
        caption: "ride back to foggy bottom",
        test: (x, y) => doorRects.some((r) => x > r[0] - 10 && x < r[2] + 10 && y > r[1] - 10 && y < r[3] + 6),
        enter: () => (st.hoverDoor = true),
        leave: () => (st.hoverDoor = false),
        click: () => depart(null, null),
      },
      {
        id: "water",
        caption: st.panel > 0.5 ? "let it sink" : "the water",
        cursor: "pointer",
        test: (x, y) => AQ.inPoly(poolPoly, x, y) && y > WL + 2,
        click: (x, y) => {
          const depth = (y - WL) / (H - WL);
          st.ripples.add(x, y, 0.12 + depth * 0.22, 0.4 + depth);
          A.plop((x - 600) / 600, 0.7 + depth * 0.4);
          if (st.panelTarget > 0.5) sink();
          else setTimeout(raise, 260);
        },
      },
      {
        id: "speaker",
        caption: "the pa",
        test: (x, y) => y < 140 && (x < 140 || x > 1060),
        click: () => A.announce("Tidal Basin. End of the line. All water must leave the train."),
      }
    );
    return hs;
  };

  AQ.scenes[4] = S;
})();
