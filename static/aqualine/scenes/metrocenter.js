/* station 3 — metro center, in 3d. two vaults cross; the escalators are waterfalls. */
import * as L from "../lib3d.js";
const { THREE } = L;
const AQ = window.AQ;
const A = AQ.audio;

const S = {
  name: "Metro Center",
  ambience: "crossing",
  exposure: 1.0,
  bloom: { strength: 0.5, radius: 0.5, threshold: 0.96 },
  pose: { pos: [0, 1.7, 0.5], look: [0, 3.4, -18], fov: 62 },
  arrive: { pos: [0, 2.6, 7], look: [0, 3.8, -18] },
  arriveDur: 2.0,
};
const YC = 1.4, R = 10, ZC = -18;
const ESC = { xIn: 6.4, xOut: 8.6, z0: -8, z1: -15.2, top: 5.6, steps: 24 };
let st = null;
let jet, veil, sheets = [], escProxies = [], kit, buckets = [], lid, rainbow, fountainProxy, waterTex, basinWater;

S.build = function ({ envTex }) {
  const scene = (S.scene = new THREE.Scene());
  scene.background = new THREE.Color(0x0a0a0a);
  scene.environment = envTex;
  scene.environmentIntensity = 0.3;
  scene.fog = new THREE.FogExp2(0x0b0b0b, 0.009);

  const th = [-0.14, Math.PI + 0.14];
  scene.add(L.cofferVault({ axis: "z", c: [0, YC, 0], R, depth: 0.5, margin: 0.13, along: [-150, 4], len: 2, n: 16, th, skip: (p) => (p.z - ZC) ** 2 + (p.y - YC) ** 2 < (R - 1.4) ** 2 }));
  scene.add(L.cofferVault({ axis: "x", c: [0, YC, ZC], R, depth: 0.5, margin: 0.13, along: [-60, 60], len: 2, n: 16, th, skip: (p) => p.x ** 2 + (p.y - YC) ** 2 < (R - 1.4) ** 2 }));

  // the rainbow: every line color traced along the groin where the vaults meet
  rainbow = new THREE.Group();
  for (const sgn of [1, -1]) {
    L.LINE_ORDER.forEach((nm, k) => {
      const Rk = R - 0.12 - k * 0.17;
      const pts = [];
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * Math.PI;
        pts.push(new THREE.Vector3(Rk * Math.cos(a), YC + Rk * Math.sin(a), ZC + sgn * Rk * Math.cos(a)));
      }
      const c = new THREE.Color(L.LINES[nm]).multiplyScalar(1.25);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 96, 0.075, 6), new THREE.MeshBasicMaterial({ color: c, toneMapped: false }));
      rainbow.add(tube);
    });
  }
  scene.add(rainbow);

  // floors
  const f1 = L.hexFloor(20, 156, { roughness: 0.6 });
  f1.position.set(0, 0, -74);
  scene.add(f1);
  for (const s of [-1, 1]) {
    const f = L.hexFloor(40, 20, { roughness: 0.6 });
    f.position.set(s * 30, 0, ZC);
    scene.add(f);
  }

  // galleries at the top of the escalators
  const conc = L.concrete(0xa49b8d, { repeat: 3 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xbfe6ea, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.3, depthWrite: false, side: THREE.DoubleSide });
  const brass = new THREE.MeshStandardMaterial({ color: 0xb08a3e, metalness: 0.9, roughness: 0.3 });
  for (const s of [-1, 1]) {
    scene.add(L.box(24, 0.6, 11.3, conc, s * 18.2, 5.9, -20.85));
    const gp = new THREE.Mesh(new THREE.PlaneGeometry(11.3, 1), glass);
    gp.position.set(s * 6.2, 6.7, -20.85);
    gp.rotation.y = Math.PI / 2;
    scene.add(gp);
    const fp = new THREE.Mesh(new THREE.PlaneGeometry(21.4, 1), glass);
    fp.position.set(s * 19.3, 6.7, -15.2);
    scene.add(fp);
    scene.add(L.box(0.06, 0.06, 11.3, brass, s * 6.2, 7.2, -20.85), L.box(21.4, 0.06, 0.06, brass, s * 19.3, 7.2, -15.2));
    // pa speaker
    scene.add(L.box(0.3, 0.35, 0.3, new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 }), s * 6.4, 5.2, -16.8));
  }

  // escalators: real steps, glass balustrades, water sheeting down
  waterTex = L.canvasTex(128, 512, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    const g = L.rng(8);
    for (let i = 0; i < 110; i++) {
      x.strokeStyle = `rgba(215,255,252,${0.12 + g() * 0.45})`;
      x.lineWidth = 1 + g() * 3;
      const xx = g() * w, y = g() * h, len = 20 + g() * 90;
      x.beginPath(); x.moveTo(xx, y); x.lineTo(xx + (g() - 0.5) * 5, y + len); x.stroke();
    }
  }, { repeat: [2, 3] });
  const stepMat = new THREE.MeshStandardMaterial({ color: 0x3a4044, metalness: 0.6, roughness: 0.35 });
  const combMat = new THREE.MeshStandardMaterial({ color: 0xc9b23a, metalness: 0.5, roughness: 0.4 });
  const black = new THREE.MeshStandardMaterial({ color: 0x0c0d0e, roughness: 0.3 });
  const run = (ESC.z0 - ESC.z1) / ESC.steps, rise = ESC.top / ESC.steps;
  const len = Math.hypot(ESC.z0 - ESC.z1, ESC.top), ang = Math.atan2(ESC.top, ESC.z0 - ESC.z1);
  sheets = [];
  escProxies = [];
  for (const s of [-1, 1]) {
    const xc = s * (ESC.xIn + ESC.xOut) / 2, w = ESC.xOut - ESC.xIn;
    const steps = new THREE.InstancedMesh(new THREE.BoxGeometry(w, rise, run), stepMat, ESC.steps);
    const combs = new THREE.InstancedMesh(new THREE.BoxGeometry(w, 0.015, 0.04), combMat, ESC.steps);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < ESC.steps; i++) {
      m4.makeTranslation(xc, rise * (i + 0.5), ESC.z0 - run * (i + 0.5));
      steps.setMatrixAt(i, m4);
      m4.makeTranslation(xc, rise * (i + 1) + 0.005, ESC.z0 - run * i - 0.02);
      combs.setMatrixAt(i, m4);
    }
    steps.castShadow = steps.receiveShadow = true;
    scene.add(steps, combs);
    // underside truss
    const truss = L.box(w + 0.3, 0.5, len, L.steel(), xc, ESC.top / 2 - 0.25, (ESC.z0 + ESC.z1) / 2);
    truss.rotation.x = ang;
    scene.add(truss);
    // outer solid balustrade, inner glass
    const outer = L.box(0.12, 1.0, len, L.steel(), s * (ESC.xOut + 0.06), ESC.top / 2 + 0.55, (ESC.z0 + ESC.z1) / 2);
    outer.rotation.x = ang;
    const inner = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.0, len), glass);
    inner.position.set(s * (ESC.xIn - 0.02), ESC.top / 2 + 0.55, (ESC.z0 + ESC.z1) / 2);
    inner.rotation.x = ang;
    scene.add(outer, inner);
    for (const xx of [ESC.xIn - 0.02, ESC.xOut + 0.06]) {
      const hr = L.box(0.09, 0.07, len + 0.6, black, s * xx, ESC.top / 2 + 1.07, (ESC.z0 + ESC.z1) / 2);
      hr.rotation.x = ang;
      scene.add(hr);
    }
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(w, len), new THREE.MeshBasicMaterial({ map: waterTex, transparent: true, color: 0xa8fff6, blending: THREE.AdditiveBlending, depthWrite: false }));
    sheet.position.set(xc, ESC.top / 2 + 0.06, (ESC.z0 + ESC.z1) / 2 - 0.05);
    sheet.rotation.x = -Math.PI / 2 + ang;
    scene.add(sheet);
    sheets.push(sheet);
    // catch basin + foam at the foot
    const basin = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.6, 1.4), new THREE.MeshStandardMaterial({ color: 0x0f3a40, roughness: 0.05, metalness: 0.4 }));
    basin.rotation.x = -Math.PI / 2;
    basin.position.set(xc, 0.01, ESC.z0 + 0.7);
    scene.add(basin);
    const foam = new L.Spray({ at: new THREE.Vector3(xc, 0.1, ESC.z0 + 0.2), count: 500, rate: 260, speed: 1.6, spread: 1.4, life: 0.7, size: 0.06, floorY: 0, radius: 0.9 });
    scene.add(foam.points);
    sheets.push({ spray: foam });
    const proxy = L.hitProxy(w + 0.6, ESC.top + 1.4, ESC.z0 - ESC.z1 + 1, xc, ESC.top / 2 + 0.6, (ESC.z0 + ESC.z1) / 2);
    scene.add(proxy);
    escProxies.push(proxy);
  }

  // the fountain under the crossing
  const stone = new THREE.MeshStandardMaterial({ color: 0xd2c8b8, roughness: 0.55 });
  scene.add(L.at(L.lathe([[0, 0.36], [2.4, 0.36], [2.4, 0.48], [2.72, 0.48], [2.72, 0.0], [0, 0]], 0, { material: stone, segments: 64 }), 0, 0, ZC));
  basinWater = new THREE.Mesh(new THREE.CircleGeometry(2.4, 64), new THREE.MeshStandardMaterial({ color: 0x1d6c70, roughness: 0.04, metalness: 0.6, emissive: 0x0b3b40, emissiveIntensity: 0.6 }));
  basinWater.rotation.x = -Math.PI / 2;
  basinWater.position.set(0, 0.4, ZC);
  scene.add(basinWater);
  scene.add(L.at(L.lathe([[0.16, 0.4], [0.12, 0.7], [0.1, 0.95], [0.74, 1.0], [0.78, 1.06], [0.68, 1.05], [0.1, 1.0]], 0, { material: stone }), 0, 0, ZC));
  const pool = new THREE.PointLight(0x7ff0ea, 4, 8, 1.5);
  pool.position.set(0, 0.6, ZC);
  scene.add(pool);
  jet = new L.Spray({ at: new THREE.Vector3(0, 1.1, ZC), count: 1400, rate: 520, speed: 6.4, spread: 0.12, life: 1.5, size: 0.06, floorY: 0.4, radius: 0.04 });
  veil = new L.Spray({ at: new THREE.Vector3(0, 1.04, ZC), count: 1400, rate: 650, speed: 1.2, ring: 0.76, life: 0.8, size: 0.045, floorY: 0.4, spread: 0.3 });
  scene.add(jet.points, veil.points);
  fountainProxy = L.hitProxy(5.6, 3.4, 5.6, 0, 1.7, ZC);
  scene.add(fountainProxy);

  // lights: a ring of uplights around the crossing + a few down the main vault
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const pl = new THREE.PointLight(0xffdcb0, 3.2, 24, 1.4);
    pl.position.set(Math.cos(a) * 7.5, 0.8, ZC + Math.sin(a) * 7.5);
    scene.add(pl);
  }
  for (const z of [-34, -56]) for (const s of [-1, 1]) {
    const pl = new THREE.PointLight(0xffdcb0, 3, 24, 1.4);
    pl.position.set(s * 6, 0.8, z);
    scene.add(pl);
  }
  const near = new THREE.PointLight(0xffe2c0, 2, 14, 1.5);
  near.position.set(0, 3.5, -2);
  scene.add(near);
  scene.add(new THREE.HemisphereLight(0xffe8cc, 0x2a2018, 0.08));

  // bucket kit, foreground right
  kit = new THREE.Group();
  const plastic = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 });
  buckets = [];
  for (const [x, z, c, s] of [[0, 0, 0xefede6, 1], [0.42, -0.22, 0xe8742a, 0.92], [0.86, 0.04, 0xefede6, 1], [0.22, -0.62, 0xe8742a, 0.75]]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * s, 0.15 * s, 0.36 * s, 20), plastic(c));
    b.position.set(x, 0.18 * s, z);
    b.castShadow = true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.145 * s, 0.008, 6, 24), plastic(new THREE.Color(c).multiplyScalar(0.85)));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.08 * s;
    b.add(ring);
    b.userData = { s, base: 0.18 * s };
    kit.add(b);
    buckets.push(b);
  }
  lid = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.012, 24), L.steel());
  lid.position.set(0.66, 0.62, -0.42);
  lid.rotation.z = 0.15;
  const stand = L.box(0.02, 0.62, 0.02, L.steel(), 0.66, 0.31, -0.42);
  const crate = L.box(0.42, 0.34, 0.42, plastic(0x23408a), 1.25, 0.17, -0.5);
  const stickMat = plastic(0xd9b77a);
  const st1 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 6), stickMat);
  st1.position.set(0.3, 0.42, 0.05);
  st1.rotation.set(0.2, 0, 1.2);
  const st2 = st1.clone();
  st2.position.set(0.5, 0.4, 0.1);
  st2.rotation.set(-0.2, 0, -1.1);
  kit.add(lid, stand, crate, st1, st2);
  kit.position.set(1.7, 0, -4.4);
  kit.rotation.y = -0.4;
  scene.add(kit);

  // planter with a fern, foreground left
  const planter = L.box(1.5, 0.75, 0.75, L.concrete(0x8a8378), -2.8, 0.375, -4.2);
  scene.add(planter);
  const fr = L.fern(2.2, 31);
  fr.position.set(-2.8, 0.7, -4.2);
  scene.add(fr);
};

S.reset = function () {
  st = { burst: 0, hits: [0, 0, 0, 0, 0] };
  A.gogo.onStep = (s) => {
    const G = A.GOGO;
    if (G.kick[s]) st.hits[0] = 1;
    if (G.snare[s] > 0.5) st.hits[1] = 1;
    if (G.congaHi[s]) st.hits[2] = 1;
    if (G.congaLo[s]) st.hits[3] = 1;
    if (G.bell[s]) st.hits[4] = 1;
  };
};
S.exit = function () {
  if (A.gogo.playing) A.toggleGogo();
  A.gogo.onStep = null;
};

S.update = function (dt, t) {
  st.burst = Math.max(0, st.burst - dt);
  jet.boost = st.burst;
  jet.update(dt);
  veil.update(dt);
  waterTex.offset.y += dt * 1.1;
  for (const s of sheets) if (s.spray) s.spray.update(dt);
  basinWater.material.emissiveIntensity = 0.55 + 0.1 * Math.sin(t * 3);
  for (let i = 0; i < 5; i++) st.hits[i] = Math.max(0, st.hits[i] - dt * 7);
  buckets.forEach((b, i) => {
    const h = st.hits[Math.min(i, 3)];
    b.scale.y = 1 - h * 0.12;
    b.position.y = b.userData.base * (1 - h * 0.12);
    b.material.emissive.setRGB(h * 0.3, h * 0.25, h * 0.2);
  });
  lid.rotation.z = 0.15 + st.hits[4] * 0.25;
};

const climb = (s) => [
  { pos: [s * 5.2, 2.0, -5.5], look: [s * 7.5, 3.6, -12] },
  { pos: [s * 7.5, 2.4, -8.4], look: [s * 7.5, 5.6, -15] },
  { pos: [s * 7.5, 6.6, -14.4], look: [s * 9, 7.2, -21] },
  { pos: [s * 8.5, 7.4, -17.5], look: [s * 18, 7.4, -21] },
];
S.hotspots = function () {
  return [
    {
      id: "kit",
      caption: A.gogo.playing ? "stop the go-go" : "bucket drums",
      objects: [kit],
      click: () => {
        const on = A.toggleGogo();
        AQ.app.caption(on ? "stop the go-go" : "bucket drums");
      },
    },
    { id: "escL", caption: "up the escalator (it's a waterfall now)", objects: [escProxies[0]], click: () => AQ.app.fly(3, climb(-1), { dur: 3.6, fadeFrom: 0.65 }) },
    { id: "escR", caption: "up the escalator (it's a waterfall now)", objects: [escProxies[1]], click: () => AQ.app.fly(3, climb(1), { dur: 3.6, fadeFrom: 0.65 }) },
    { id: "fountain", caption: "the fountain", objects: [fountainProxy], click: () => { st.burst = 1.4; A.splash(0); } },
    { id: "crossing", caption: "the crossing", objects: [rainbow], click: () => A.announce("Metro Center. Transfer to all lines. Including the ones that don't exist yet.") },
  ];
};

export default S;
