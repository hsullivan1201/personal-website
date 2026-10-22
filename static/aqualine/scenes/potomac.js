/* station 4 — potomac ave, in 3d. the mezzanine at night; the lights come up in banks. */
import * as L from "../lib3d.js";
const { THREE } = L;
const AQ = window.AQ;
const A = AQ.audio;

const S = {
  name: "Potomac Ave",
  ambience: "dark",
  holdInput: true,
  exposure: 1.0,
  bloom: { strength: 0.65, radius: 0.5, threshold: 0.9 },
  pose: { pos: [0, 1.7, 0.4], look: [0, 2.7, -12], fov: 62 },
  arrive: { pos: [0, 1.75, 4.5], look: [0, 2.6, -12] },
  arriveDur: 2.4,
};
const FZ = -7.4, WZ = -13.4;
const PORTALS = [
  { x: -5, name: "Anacostia", line: "green", id: "left" },
  { x: 0, name: "Fountain", line: "aqua", id: "center" },
  { x: 5, name: "Tidal Basin", line: "aqua", id: "right" },
];
let st = null;
let groups = [[], [], []], fixtures = [[], [], []], hemi, clock, clockTex, portalProxies = [], fountainProxy, spout, veil, rightGlow, poolWater;
const LIGHT_K = 5.5;

function drawClock(x, w) {
  const c = w / 2, r = w * 0.48;
  x.clearRect(0, 0, w, w);
  x.fillStyle = "#f6efdc";
  x.beginPath(); x.arc(c, c, r, 0, Math.PI * 2); x.fill();
  x.strokeStyle = "#2a241e";
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    x.lineWidth = i % 5 ? w * 0.006 : w * 0.018;
    const r0 = i % 5 ? r * 0.88 : r * 0.8;
    x.beginPath();
    x.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0);
    x.lineTo(c + Math.cos(a) * r * 0.94, c + Math.sin(a) * r * 0.94);
    x.stroke();
  }
  x.fillStyle = "#4b3a2e";
  x.font = `bold ${w * 0.07}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  x.textAlign = "center";
  x.fillText("AQUA LINE", c, c + r * 0.42);
  const now = new Date();
  const hr = now.getHours() % 12, mn = now.getMinutes(), sc = now.getSeconds();
  const hand = (ang, len, lw, col) => {
    x.strokeStyle = col;
    x.lineWidth = lw;
    x.lineCap = "round";
    x.beginPath();
    x.moveTo(c, c);
    x.lineTo(c + Math.sin(ang) * r * len, c - Math.cos(ang) * r * len);
    x.stroke();
  };
  hand(((hr + mn / 60) / 12) * Math.PI * 2, 0.5, w * 0.03, "#1d1915");
  hand(((mn + sc / 60) / 60) * Math.PI * 2, 0.76, w * 0.02, "#1d1915");
  hand((sc / 60) * Math.PI * 2, 0.82, w * 0.008, L.LINES.red);
  x.fillStyle = "#1d1915";
  x.beginPath(); x.arc(c, c, w * 0.02, 0, Math.PI * 2); x.fill();
}

S.build = function ({ envTex }) {
  const scene = (S.scene = new THREE.Scene());
  scene.background = new THREE.Color(0x050505);
  scene.environment = envTex;
  scene.environmentIntensity = 0.2;
  scene.fog = new THREE.FogExp2(0x070605, 0.012);

  scene.add(L.cofferVault({ axis: "x", c: [0, 0.6, -7], R: 7, depth: 0.42, margin: 0.13, along: [-30, 30], len: 2, n: 8, th: [0.94, Math.PI + 0.08], color: 0xe2c9a4, skip: (p) => p.y < 4.4 && p.z < -12 && PORTALS.some((q) => Math.abs(p.x - q.x) < 1.9) }));

  // the portal wall: arches cut out of an extruded slab
  const warm = L.concrete(0xd9c09c, { repeat: 1 });
  const shape = new THREE.Shape();
  shape.moveTo(-30, -0.1); shape.lineTo(30, -0.1); shape.lineTo(30, 4.6); shape.lineTo(-30, 4.6); shape.closePath();
  const arch = (cx, r, h) => {
    const p = new THREE.Path();
    p.moveTo(cx - r, 0);
    p.lineTo(cx - r, h);
    p.absarc(cx, h, r, Math.PI, 0, true);
    p.lineTo(cx + r, 0);
    p.closePath();
    return p;
  };
  for (const p of PORTALS) shape.holes.push(arch(p.x, 1.4, 2.2));
  const wall = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false }), warm);
  const uv = wall.geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.25, uv.getY(i) * 0.25);
  wall.position.z = WZ - 0.5;
  wall.receiveShadow = true;
  scene.add(wall);
  const bronze = L.bronze();
  portalProxies = [];
  PORTALS.forEach((p) => {
    // bronze trim
    const ts = new THREE.Shape();
    ts.moveTo(p.x - 1.62, 0);
    ts.lineTo(p.x - 1.62, 2.2);
    ts.absarc(p.x, 2.2, 1.62, Math.PI, 0, true);
    ts.lineTo(p.x + 1.62, 0);
    ts.lineTo(p.x + 1.4, 0);
    ts.lineTo(p.x + 1.4, 2.2);
    ts.absarc(p.x, 2.2, 1.4, 0, Math.PI, false);
    ts.lineTo(p.x - 1.4, 0);
    ts.closePath();
    const trim = new THREE.Mesh(new THREE.ExtrudeGeometry(ts, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 }), bronze);
    trim.position.z = WZ;
    scene.add(trim);
    // the passage behind
    const tun = new THREE.Mesh(new THREE.BoxGeometry(2.8, 3.7, 14), new THREE.MeshStandardMaterial({ color: p.id === "right" ? 0x2c4a4a : 0x2a2622, roughness: 0.9, side: THREE.BackSide }));
    tun.position.set(p.x, 1.85, WZ - 7.5);
    scene.add(tun);
    const end = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.4), p.id === "right" ? L.glow(0x7ffff0, 2.2) : new THREE.MeshStandardMaterial({ color: 0x0c0b0a }));
    end.position.set(p.x, 1.7, WZ - 14.3);
    scene.add(end);
    const tl = new THREE.PointLight(p.id === "right" ? 0x6ff5ea : 0xffcf96, p.id === "right" ? 6 : 0.8, 14, 1.5);
    tl.position.set(p.x, 2.2, WZ - 5);
    scene.add(tl);
    if (p.id === "right") rightGlow = tl;
    // sign
    const sg = L.signPlane(p.name, 2.2, 0.4, { emissive: 0.45 });
    sg.position.set(p.x, 4.0, -12.88);
    scene.add(sg);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.1, 20), L.glow(L.LINES[p.line], 1.6));
    dot.position.set(p.x + (p.x < 0 ? -1.3 : 1.3), 4.0, -12.87);
    scene.add(dot);
    const proxy = L.hitProxy(2.8, 3.6, 0.6, p.x, 1.8, WZ);
    scene.add(proxy);
    portalProxies.push(proxy);
  });

  // the clock on the curve of the vault
  clockTex = L.canvasTex(512, 512, (x, w) => drawClock(x, w));
  clock = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.16, 48), bronze);
  ring.rotation.x = Math.PI / 2;
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.8, 48), new THREE.MeshStandardMaterial({ map: clockTex, emissive: 0xffffff, emissiveMap: clockTex, emissiveIntensity: 0.32 }));
  face.position.z = 0.085;
  clock.add(ring, face);
  clock.position.set(0, 5.7, -11.45);
  clock.lookAt(0, 1.2, -1);
  scene.add(clock);

  // floor + mosaic rug
  const fl = L.hexFloor(60, 14.6, { roughness: 0.5 });
  fl.position.set(0, 0, -6.6);
  scene.add(fl);
  const rugCols = ["aqua", "blue", "green", "yellow", "orange", "red"].map((n) => L.LINES[n]);
  const rugTex = L.canvasTex(1024, 1024, (x, w) => {
    x.clearRect(0, 0, w, w);
    const r = 30, hw = Math.sqrt(3) * r, c = w / 2;
    for (let row = -20; row <= 20; row++) for (let col = -12; col <= 12; col++) {
      const cx = c + col * hw + (row % 2 ? hw / 2 : 0), cy = c + row * r * 1.5;
      const d = Math.hypot(cx - c, cy - c) / (w / 2);
      if (d > 0.98) continue;
      x.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 3) * k + Math.PI / 6;
        x.lineTo(cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92);
      }
      x.closePath();
      x.fillStyle = d < 0.38 ? "#26262a" : rugCols[Math.floor((d - 0.38) / 0.1) % rugCols.length];
      x.fill();
    }
  });
  const rug = new THREE.Mesh(new THREE.CircleGeometry(3.3, 64), new THREE.MeshStandardMaterial({ map: rugTex, transparent: true, roughness: 0.35, alphaTest: 0.1 }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.004, FZ);
  rug.receiveShadow = true;
  scene.add(rug);

  // the tiered fountain
  const stone = new THREE.MeshStandardMaterial({ color: 0xb48256, roughness: 0.6, flatShading: true });
  scene.add(L.at(L.lathe([[0, 0.36], [1.0, 0.36], [1.0, 0.45], [1.17, 0.45], [1.17, 0], [0, 0]], 0, { material: stone, segments: 8 }), 0, 0, FZ));
  poolWater = new THREE.Mesh(new THREE.CircleGeometry(1.0, 8), new THREE.MeshStandardMaterial({ color: 0x1d6066, roughness: 0.05, metalness: 0.5, emissive: 0x0e4c50, emissiveIntensity: 0.9 }));
  poolWater.rotation.x = -Math.PI / 2;
  poolWater.rotation.z = Math.PI / 8;
  poolWater.position.set(0, 0.39, FZ);
  scene.add(poolWater);
  const smooth = new THREE.MeshStandardMaterial({ color: 0xb48256, roughness: 0.55 });
  scene.add(L.at(L.lathe([[0.13, 0.38], [0.08, 0.7], [0.07, 0.95], [0.55, 1.0], [0.58, 1.06], [0.5, 1.05], [0.07, 1.0]], 0, { material: smooth }), 0, 0, FZ));
  scene.add(L.at(L.lathe([[0.05, 1.0], [0.035, 1.18], [0.08, 1.22], [0.05, 1.28], [0, 1.3]], 0, { material: smooth }), 0, 0, FZ));
  spout = new L.Spray({ at: new THREE.Vector3(0, 1.3, FZ), count: 500, rate: 160, speed: 2.0, spread: 0.5, life: 0.8, size: 0.035, floorY: 1.0, radius: 0.01 });
  veil = new L.Spray({ at: new THREE.Vector3(0, 1.03, FZ), count: 900, rate: 380, speed: 0.6, ring: 0.57, life: 0.6, size: 0.03, floorY: 0.38, spread: 0.2 });
  scene.add(spout.points, veil.points);
  const pl = new THREE.PointLight(0x80e8ee, 1.2, 4, 1.6);
  pl.position.set(0, 0.6, FZ);
  scene.add(pl);
  fountainProxy = L.hitProxy(2.6, 1.6, 2.6, 0, 0.8, FZ);
  scene.add(fountainProxy);

  // urns with ferns, foreground ferns
  const terracotta = new THREE.MeshStandardMaterial({ color: 0x8a4526, roughness: 0.7 });
  for (const ux of [-2.5, 2.5]) {
    scene.add(L.at(L.lathe([[0, 0], [0.22, 0], [0.3, 0.25], [0.22, 0.55], [0.16, 0.62], [0.2, 0.66], [0, 0.66]], 0, { material: terracotta }), ux, 0, WZ + 0.6));
    scene.add(L.at(L.fern(1.1, 50 + ux), ux, 0.6, WZ + 0.6));
  }
  for (const [x, z, sz, seed] of [[-3.6, -2.2, 2.4, 401], [3.7, -2.4, 2.4, 402]]) scene.add(L.at(L.fern(sz, seed), x, 0, z));

  // the light banks: wall-washers at the base of the wall + one over the fountain
  groups = [[], [], []];
  fixtures = [[], [], []];
  const fixMat = () => new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff0d2, emissiveIntensity: 0 });
  for (const fx of [-13, -8.6, -2.5, 2.5, 8.6, 13]) {
    const g = fx < -3 ? 0 : fx > 3 ? 2 : 1;
    const light = new THREE.PointLight(0xffcf96, 0, 16, 1.5);
    light.position.set(fx, 0.5, WZ + 0.9);
    scene.add(light);
    groups[g].push(light);
    const fix = L.box(0.5, 0.08, 0.2, fixMat(), fx, 0.04, WZ + 0.7);
    scene.add(fix);
    fixtures[g].push(fix.material);
  }
  const over = new THREE.PointLight(0xffd9a8, 0, 14, 1.5);
  over.position.set(0, 4.2, -5);
  scene.add(over);
  groups[1].push(over);
  hemi = new THREE.HemisphereLight(0xffe0bc, 0x201812, 0);
  scene.add(hemi);
};

S.reset = function () {
  st = { t: 0, stage: 0, out: false, outT: 0, level: [0, 0, 0], clockT: 0 };
  applyLights();
};
S.enter = () => A.setScene("dark");

function applyLights(flicker = 0) {
  for (let g = 0; g < 3; g++) {
    const k = st.level[g] * (1 - flicker * Math.random());
    groups[g].forEach((l, i) => (l.intensity = k * (i === groups[g].length - 1 && g === 1 ? LIGHT_K * 0.9 : LIGHT_K)));
    fixtures[g].forEach((m) => (m.emissiveIntensity = k * 3));
  }
  hemi.intensity = 0.02 + 0.1 * (st.level[0] + st.level[1] + st.level[2]) / 3;
}

S.update = function (dt, t) {
  // lights up on arrival, in three banks, with a clunk each
  if (!st.out) {
    st.t += dt;
    const marks = [0.6, 1.35, 2.1];
    while (st.stage < 3 && st.t > marks[st.stage]) {
      A.clunk(st.stage);
      st.level[[0, 2, 1][st.stage]] = 1;
      st.stage++;
      if (st.stage === 3) { A.setScene("mezz"); AQ.app.busy = false; }
    }
    const since = st.stage ? st.t - marks[st.stage - 1] : 1;
    applyLights(since < 0.25 ? 0.6 : 0);
  } else {
    st.outT += dt;
    const marks = [0.12, 0.42, 0.72];
    while (st.stage > 0 && st.outT > marks[3 - st.stage]) {
      st.stage--;
      st.level[[0, 2, 1][st.stage]] = 0;
      if (st.stage === 2) A.lightsOut();
      else A.thud(undefined, 0.6);
    }
    applyLights();
  }
  spout.update(dt);
  veil.update(dt);
  poolWater.material.emissiveIntensity = 0.8 + 0.15 * Math.sin(t * 3);
  rightGlow.intensity = 9 + 2 * Math.sin(t * 1.8) + (st.hoverR ? 6 : 0);
  st.clockT -= dt;
  if (st.clockT <= 0) {
    st.clockT = 0.5;
    drawClock(clockTex.userData.canvas.getContext("2d"), 512);
    clockTex.needsUpdate = true;
  }
};

function timeWords() {
  const d = new Date();
  let h = d.getHours();
  const ap = h < 12 ? "A M" : "P M";
  h = h % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, "0")} ${ap}`;
}
S.hotspots = function () {
  return [
    { id: "clock", caption: "the station clock", objects: [clock], click: () => A.announce(`The time is ${timeWords()}. The next train is eventually.`) },
    {
      id: "right",
      caption: "→ tidal basin",
      objects: [portalProxies[2]],
      enter: () => (st.hoverR = true),
      leave: () => (st.hoverR = false),
      click: () => {
        if (st.out) return;
        st.out = true;
        st.outT = 0;
        AQ.app.fly(4, [
          { pos: [2.4, 1.7, -5.5], look: [5, 1.7, -16] },
          { pos: [5, 1.65, -11.6], look: [5, 1.6, -24] },
          { pos: [5, 1.6, -17], look: [5, 1.6, -28] },
        ], { dur: 2.8, fadeFrom: 0.45 });
      },
    },
    { id: "left", caption: "← anacostia", objects: [portalProxies[0]], click: () => A.announce("Anacostia service is provided by shuttle boat. Please board from the fountain.") },
    {
      id: "center",
      caption: "fountain (service suspended)",
      objects: [portalProxies[1]],
      click: () => { A.reject(); AQ.app.caption("this passage is flooded. on purpose."); },
    },
    { id: "fountain", caption: "the fountain", objects: [fountainProxy], click: () => { A.plop(0, 0.8); veil.boost = 1.5; spout.boost = 1.5; } },
  ];
};

export default S;
