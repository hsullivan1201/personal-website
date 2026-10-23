/* station 1 — foggy bottom at dusk. the gate. */
import * as L from "../lib3d.js";
const { THREE } = L;
const AQ = window.AQ;
const A = AQ.audio;

const S = {
  name: "Foggy Bottom",
  ambience: "street",
  song: "destiny",
  exposure: 0.95,
  bloom: { strength: 0.75, radius: 0.55, threshold: 0.86 },
  pose: { pos: [0, 1.65, 0.6], look: [0, 2.05, -10], fov: 52 },
  arrive: { pos: [0, 2.1, 5.5], look: [0, 2.3, -10] },
  arriveDur: 2.6,
};
const GZ = -8.9; // grille plane
const SLOPE = -0.52; // escalator shaft pitch (radians)
let st = null;
let grille, emblem, beams = [], pylons = [], pylonLights = [], sky, petals, waterTex, gateProxy, monument, trees = [], lamps = [], flies;

function paintEmblem(x, s) {
  const c = s / 2, r = s * 0.44;
  x.strokeStyle = "#1b1e20";
  x.lineWidth = s * 0.05;
  x.beginPath(); x.arc(c, c, r, 0, Math.PI * 2); x.stroke();
  x.lineWidth = s * 0.02;
  x.beginPath(); x.arc(c, c, r * 0.68, 0, Math.PI * 2); x.stroke();
  x.fillStyle = "rgba(30,34,36,0.75)";
  x.beginPath(); x.arc(c, c, r * 0.97, 0, Math.PI * 2); x.arc(c, c, r * 0.71, 0, Math.PI * 2, true); x.fill();
  const txt = "THE DEEP END • NO LIFEGUARD ON DUTY • SWIM AT OWN RISK • ";
  x.fillStyle = "#e9e4d8";
  x.font = `bold ${s * 0.075}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  x.textAlign = "center";
  x.textBaseline = "middle";
  for (let i = 0; i < txt.length; i++) {
    const a = (i / txt.length) * Math.PI * 2 - Math.PI / 2;
    x.save();
    x.translate(c + Math.cos(a) * r * 0.84, c + Math.sin(a) * r * 0.84);
    x.rotate(a + Math.PI / 2);
    x.fillText(txt[i], 0, 0);
    x.restore();
  }
  x.strokeStyle = L.LINES.aqua;
  x.lineWidth = s * 0.022;
  for (let k = 0; k < 3; k++) {
    x.beginPath();
    for (let i = 0; i <= 30; i++) {
      const px = c - r * 0.42 + (i / 30) * r * 0.84;
      const py = c + r * 0.12 + k * r * 0.13 + Math.sin((i / 30) * Math.PI * 3) * r * 0.04;
      i ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    x.stroke();
  }
  x.fillStyle = "#e9e4d8";
  x.font = `bold ${s * 0.19}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  x.fillText("M", c, c - r * 0.16);
}

S.build = function ({ envTex }) {
  const scene = (S.scene = new THREE.Scene());
  scene.environment = envTex;
  scene.environmentIntensity = 0.35;
  scene.fog = new THREE.Fog(0x8a6a8c, 50, 360);

  // ---- sky dome with painted clouds ----
  const skyTex = L.canvasTex(2048, 1024, (x, w, h) => {
    // dusk: indigo overhead, violet, then a band of burning orange at the horizon
    const g = x.createLinearGradient(0, 0, 0, h / 2);
    g.addColorStop(0, "#070a2a");
    g.addColorStop(0.45, "#241a5a");
    g.addColorStop(0.72, "#6a3a86");
    g.addColorStop(0.9, "#d8668a");
    g.addColorStop(1, "#ffb070");
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    x.fillStyle = "#6a4a6a";
    x.fillRect(0, h / 2, w, h / 2);
    const R = L.rng(1201);
    // the first stars
    for (let i = 0; i < 500; i++) {
      const y = Math.pow(R(), 1.6) * h * 0.32;
      x.fillStyle = `rgba(255,255,255,${(0.25 + R() * 0.75) * (1 - y / (h * 0.34))})`;
      x.fillRect(R() * w, y, R() < 0.1 ? 2 : 1, R() < 0.1 ? 2 : 1);
    }
    // the sun going down, a soft bloom on the horizon (u = 0.14)
    const sx = w * 0.14, sy = h * 0.49;
    const sg = x.createRadialGradient(sx, sy, 0, sx, sy, h * 0.22);
    sg.addColorStop(0, "rgba(255,240,200,1)");
    sg.addColorStop(0.08, "rgba(255,190,120,0.9)");
    sg.addColorStop(0.4, "rgba(255,120,110,0.3)");
    sg.addColorStop(1, "rgba(255,120,110,0)");
    x.fillStyle = sg;
    x.fillRect(0, 0, w, h);
    // clouds lit pink from below
    x.globalCompositeOperation = "source-over";
    for (let i = 0; i < 30; i++) {
      const cx = R() * w, cy = h * 0.3 + Math.pow(R(), 0.8) * h * 0.17;
      const s = 18 + R() * 50 * (cy / (h / 2));
      const c = document.createElement("canvas");
      c.width = c.height = Math.ceil(s * 5);
      AQ.paintCloud(c.getContext("2d"), L.rng(i * 13 + 1), c.width / 2, c.height / 2, s);
      const cx2 = c.getContext("2d");
      cx2.globalCompositeOperation = "source-atop";
      const tint = cx2.createLinearGradient(0, 0, 0, c.height);
      tint.addColorStop(0, "rgba(90,70,150,0.75)");
      tint.addColorStop(0.6, "rgba(255,140,150,0.65)");
      tint.addColorStop(1, "rgba(255,190,120,0.7)");
      cx2.fillStyle = tint;
      cx2.fillRect(0, 0, c.width, c.height);
      for (const off of [-w, 0, w]) x.drawImage(c, cx + off - c.width / 2, cy - c.height / 2);
    }
  });
  sky = new THREE.Mesh(new THREE.SphereGeometry(420, 48, 24), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, color: 0xd8d8d8 }));
  scene.add(sky);

  // ---- light ----
  // a low sun ahead and to the left: long shadows run toward you
  const sun = new THREE.DirectionalLight(0xffa868, 2.4);
  sun.position.set(-34, 9, -40);
  sun.target.position.set(0, 0, -4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 5, far: 110 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0x8a7ad8, 0x4a3040, 0.75));
  S.sunPos = new THREE.Vector3(-210, 30, -330);

  // ---- ground with a hole for the escalator ----
  const jointTex = L.canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = "#a9a49a";
    x.fillRect(0, 0, w, h);
    const R = L.rng(4);
    for (let i = 0; i < 3000; i++) {
      x.fillStyle = `rgba(${R() < 0.5 ? "0,0,0" : "255,255,255"},${0.03 + R() * 0.05})`;
      x.fillRect(R() * w, R() * h, 2, 2);
    }
    x.strokeStyle = "rgba(70,66,60,0.55)";
    x.lineWidth = 3;
    x.strokeRect(0, 0, w, h);
  }, { repeat: [1, 1] });
  const shape = new THREE.Shape();
  shape.moveTo(-200, -200); shape.lineTo(200, -200); shape.lineTo(200, 200); shape.lineTo(-200, 200); shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-1.35, 8.9); hole.lineTo(1.35, 8.9); hole.lineTo(1.35, 19); hole.lineTo(-1.35, 19); hole.closePath();
  shape.holes.push(hole);
  const gg = new THREE.ShapeGeometry(shape);
  const uv = gg.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1.6, uv.getY(i) / 1.6);
  const ground = new THREE.Mesh(gg, new THREE.MeshStandardMaterial({ map: jointTex, roughness: 0.92 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // the brick hex path + granite curbs
  const path = L.hexFloor(2.44, 5.7, { roughness: 0.75, color: 0xb0a8a4 });
  path.position.set(0, 0.006, -5.75);
  scene.add(path);
  const gran = L.granite();
  for (const s of [-1, 1]) scene.add(L.box(0.18, 0.05, 5.7, gran, s * 1.31, 0.02, -5.75));
  scene.add(L.box(2.8, 0.04, 0.32, gran, 0, 0.02, -8.75));

  // ---- piers, housing, sign ----
  for (const s of [-1, 1]) {
    const p = L.box(0.9, 3.0, 1.1, gran, s * 1.8, 1.5, -9.15);
    scene.add(p);
    scene.add(L.box(1.02, 0.18, 1.22, gran, s * 1.8, 3.09, -9.15));
    for (let y = 0.5; y < 3; y += 0.5) scene.add(L.box(0.905, 0.012, 1.105, new THREE.MeshStandardMaterial({ color: 0x7f766d, roughness: 0.8 }), s * 1.8, y, -9.15));
  }
  scene.add(L.box(2.7, 0.45, 0.3, L.bronze(), 0, 2.78, GZ));
  const sign = L.signPlane("Foggy Bottom", 2.3, 0.36, { stripe: L.LINES.aqua });
  sign.position.set(0, 2.78, GZ + 0.152);
  scene.add(sign);

  // ---- the grille (rolls up, clipped at the housing) ----
  const clip = [new THREE.Plane(new THREE.Vector3(0, -1, 0), 2.55)];
  const grilleTex = L.canvasTex(512, 512, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.fillStyle = "#24282b";
    for (let i = 0; i < 31; i++) x.fillRect(4 + i * 16.4, 0, 5, h);
    for (let j = 0; j < 12; j++) x.fillRect(0, j * 44, w, 7);
    x.fillRect(0, h - 14, w, 14);
  });
  grille = new THREE.Group();
  const gm = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 2.55), new THREE.MeshStandardMaterial({ map: grilleTex, alphaTest: 0.5, metalness: 0.7, roughness: 0.45, side: THREE.DoubleSide, clippingPlanes: clip }));
  gm.position.y = 1.275;
  gm.castShadow = true;
  const embTex = L.canvasTex(512, 512, (x, w) => paintEmblem(x, w));
  emblem = new THREE.Mesh(new THREE.CircleGeometry(0.52, 48), new THREE.MeshStandardMaterial({ map: embTex, transparent: true, metalness: 0.4, roughness: 0.5, clippingPlanes: clip }));
  emblem.position.set(0, 1.25, 0.02);
  grille.add(gm, emblem);
  grille.position.set(0, 0, GZ);
  scene.add(grille);

  // ---- glass canopy with steel ribs ----
  {
    const segs = 28, rows = 6, z0 = -8.6, z1 = -13.5;
    const pos = [], idx = [];
    for (let r = 0; r <= rows; r++) {
      const z = z0 + ((z1 - z0) * r) / rows;
      const rise = 1.35 - (0.5 * r) / rows;
      for (let i = 0; i <= segs; i++) {
        const ph = (i / segs) * Math.PI;
        pos.push(Math.cos(ph) * 2.32, 3.18 + Math.sin(ph) * rise, z);
      }
    }
    for (let r = 0; r < rows; r++) for (let i = 0; i < segs; i++) {
      const a = r * (segs + 1) + i, b = a + segs + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const glass = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xbfe0ec, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.2, side: THREE.DoubleSide, depthWrite: false }));
    scene.add(glass);
    const st = L.steel();
    for (let r = 0; r <= rows; r++) {
      const z = z0 + ((z1 - z0) * r) / rows;
      const rise = 1.35 - (0.5 * r) / rows;
      const pts = [];
      for (let i = 0; i <= 24; i++) {
        const ph = (i / 24) * Math.PI;
        pts.push(new THREE.Vector3(Math.cos(ph) * 2.33, 3.18 + Math.sin(ph) * rise, z));
      }
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, r === 0 ? 0.06 : 0.035, 6), st);
      tube.castShadow = true;
      scene.add(tube);
    }
  }

  // ---- the escalator shaft, a sloped waffle tube falling away to an aqua glow ----
  {
    const shaft = new THREE.Group();
    const vault = L.cofferVault({ axis: "z", c: [0, 0.95, 0], R: 2.35, depth: 0.32, margin: 0.14, along: [-40, 0.4], len: 1.2, n: 9, th: [-0.41, Math.PI + 0.41], color: 0xd6c7ad });
    shaft.add(vault);
    // escalator surface: steps + water sheet
    const stepTex = L.canvasTex(64, 256, (x, w, h) => {
      for (let i = 0; i < 8; i++) {
        x.fillStyle = i % 2 ? "#2d3336" : "#3e4549";
        x.fillRect(0, i * 32, w, 32);
        x.fillStyle = "#c9b23a";
        x.fillRect(0, i * 32, w, 2);
      }
    }, { repeat: [1, 12] });
    const steps = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 40), new THREE.MeshStandardMaterial({ map: stepTex, roughness: 0.4, metalness: 0.5 }));
    steps.rotation.x = -Math.PI / 2;
    steps.position.set(0, 0.02, -19.6);
    shaft.add(steps);
    waterTex = L.canvasTex(128, 512, (x, w, h) => {
      x.clearRect(0, 0, w, h);
      const R = L.rng(8);
      for (let i = 0; i < 90; i++) {
        x.strokeStyle = `rgba(210,255,250,${0.15 + R() * 0.4})`;
        x.lineWidth = 1 + R() * 3;
        const xx = R() * w, y = R() * h, len = 20 + R() * 80;
        x.beginPath(); x.moveTo(xx, y); x.lineTo(xx + (R() - 0.5) * 6, y + len); x.stroke();
      }
    }, { repeat: [3, 10] });
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 40), new THREE.MeshBasicMaterial({ map: waterTex, transparent: true, color: 0x9ffff4, blending: THREE.AdditiveBlending, depthWrite: false }));
    sheet.rotation.x = -Math.PI / 2;
    sheet.position.set(0, 0.06, -19.6);
    shaft.add(sheet);
    for (const s of [-1, 1]) {
      shaft.add(L.box(0.22, 0.9, 40, L.steel(), s * 1.07, 0.45, -19.6));
      shaft.add(L.box(0.1, 0.08, 40, new THREE.MeshStandardMaterial({ color: 0x0c0d0e, roughness: 0.3 }), s * 1.07, 0.95, -19.6));
    }
    const end = new THREE.Mesh(new THREE.CircleGeometry(2.6, 32), L.glow(0x7ffff0, 3));
    end.position.set(0, 0.9, -39.5);
    shaft.add(end);
    const aq = new THREE.PointLight(0x6ff5ea, 60, 34, 1.4);
    aq.position.set(0, 1.4, -30);
    const warm = new THREE.PointLight(0xffe2b0, 8, 10, 1.6);
    warm.position.set(0, 1.4, -12);
    shaft.add(aq, warm);
    shaft.rotation.x = SLOPE;
    shaft.position.set(0, 0, GZ - 0.1);
    scene.add(shaft);
  }

  // ---- pylons ----
  pylons = [];
  pylonLights = [];
  for (const s of [-1, 1]) {
    const p = L.pylon({ h: 4.0, w: 0.42 });
    p.position.set(s * 2.6, 0, -6.2);
    p.rotation.y = -s * 0.25;
    scene.add(p);
    pylons.push(p);
    const pl = new THREE.PointLight(0x5ff0e6, 0, 9, 1.5);
    pl.position.set(s * 2.4, 3.0, -5.9);
    scene.add(pl);
    pylonLights.push(pl);
  }
  // beams that cross over the canopy (grow when lit)
  beams = [];
  for (const s of [-1, 1]) {
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(s * 2.6, 4.05, -6.2), new THREE.Vector3(s * 0.4, 6.4, -7.6), new THREE.Vector3(-s * 1.5, 4.6, -8.5));
    const t = L.glowTube(curve, 0.045, L.LINE_ORDER.map((n) => L.LINES[n]), 4);
    t.geometry.setDrawRange(0, 0);
    scene.add(t);
    beams.push(t);
  }

  // ---- cherry trees framing the top corners ----
  trees = [];
  for (const [x, z, lean, seed] of [[-4.0, -2.2, new THREE.Vector3(0.55, 1, -0.1), 31], [4.2, -2.8, new THREE.Vector3(-0.55, 1, -0.15), 33], [-6.5, -7, new THREE.Vector3(0.2, 1, 0), 35], [7, -8, new THREE.Vector3(-0.2, 1, 0), 37]]) {
    const tr = L.cherryTree({ seed, lean, trunk: 1.9, radius: 0.2, depth: 5, perTip: 34 });
    tr.position.set(x, 0, z);
    scene.add(tr);
    trees.push(tr);
  }
  petals = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.06, 0.05), new THREE.MeshStandardMaterial({ map: L.petalTex, alphaTest: 0.3, side: THREE.DoubleSide, emissive: 0x401020, emissiveIntensity: 0.3 }), 220);
  petals.frustumCulled = false;
  scene.add(petals);

  // ---- bushes, lamps, fence, background trees, the monument ----
  for (const [x, z, w, h, seed] of [[-4.6, -8.2, 3.4, 1.5, 1], [4.6, -8.4, 3.4, 1.5, 2], [-2.6, -9.6, 1.1, 0.7, 3], [2.6, -9.6, 1.1, 0.7, 4], [-7.5, -10, 3, 1.6, 5], [7.8, -10.5, 3, 1.6, 6]]) {
    const b = L.bush(w, h, seed);
    b.position.set(x, 0, z);
    scene.add(b);
  }
  lamps = [];
  for (const s of [-1, 1]) {
    const l = L.globeLamp(3.6);
    l.position.set(s * 4.9, 0, -10.5);
    l.children[2].material.emissiveIntensity = 2.4;
    scene.add(l);
    const pl = new THREE.PointLight(0xffd9a0, 9, 14, 1.4);
    pl.position.set(s * 4.9, 3.8, -10.3);
    scene.add(pl);
    lamps.push(new THREE.Vector3(s * 4.9, 3.9, -10.5));
  }
  // fireflies over the boxwoods
  flies = new L.Motes({ count: 70, color: 0xd8ff7a, size: 0.09, area: { x0: -9, x1: 9, y0: 0.4, y1: 2.6, z0: -12, z1: -4 } });
  scene.add(flies.points);
  {
    const iron = new THREE.MeshStandardMaterial({ color: 0x151816, roughness: 0.5, metalness: 0.6 });
    const n = 700;
    const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.025, 1.9, 0.025), iron, n);
    const tips = new THREE.InstancedMesh(new THREE.ConeGeometry(0.03, 0.12, 4), new THREE.MeshStandardMaterial({ color: 0xb8973c, metalness: 0.8, roughness: 0.35 }), n);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const x = -63 + i * 0.18;
      m4.makeTranslation(x, 0.95, -30);
      bars.setMatrixAt(i, m4);
      m4.makeTranslation(x, 1.95, -30);
      tips.setMatrixAt(i, m4);
    }
    scene.add(bars, tips, L.box(126, 0.05, 0.04, iron, 0, 1.75, -30), L.box(126, 0.05, 0.04, iron, 0, 0.25, -30));
    const R = L.rng(77);
    const leaf = [0x24442a, 0x2c5232, 0x1d3a22].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true }));
    const bark = new THREE.MeshStandardMaterial({ color: 0x3a2c22, roughness: 1 });
    for (let i = 0; i < 70; i++) {
      const x = -90 + R() * 180, z = -36 - R() * 30;
      const hgt = 5 + R() * 6;
      const t = new THREE.Group();
      t.add(L.box(0.4, hgt * 0.5, 0.4, bark, 0, hgt * 0.25, 0));
      for (let k = 0; k < 3; k++) {
        const b = new THREE.Mesh(new THREE.IcosahedronGeometry(2 + R() * 2, 0), leaf[k]);
        b.position.set((R() - 0.5) * 2.5, hgt * 0.55 + R() * hgt * 0.4, (R() - 0.5) * 2);
        b.castShadow = true;
        t.add(b);
      }
      t.position.set(x, 0, z);
      scene.add(t);
    }
    // the monument, hazed by distance
    const marble = new THREE.MeshStandardMaterial({ color: 0xece4d6, roughness: 0.6 });
    const shaftG = new THREE.CylinderGeometry(2.4, 3.4, 33, 4, 1);
    shaftG.rotateY(Math.PI / 4);
    monument = new THREE.Group();
    const ms = new THREE.Mesh(shaftG, marble);
    ms.position.y = 16.5;
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(2.98, 3.41, 10, 4, 1).rotateY(Math.PI / 4), new THREE.MeshStandardMaterial({ color: 0xf4eee4, roughness: 0.6 }));
    lower.position.y = 5;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(3.38, 3.4, 4).rotateY(Math.PI / 4), marble);
    tip.position.y = 34.7;
    monument.add(ms, lower, tip);
    monument.position.set(118, 0, -280);
    scene.add(monument);
  }

  gateProxy = L.hitProxy(5.2, 3.8, 1.6, 0, 1.9, -9.1);
  scene.add(gateProxy);
};

S.reset = function () {
  st = { igniting: false, igniteT: 0, nLit: 0, lit: [new Array(7).fill(0), new Array(7).fill(0)], beam: 0, ready: false, open: 0, opening: false, petals: [] };
  for (let i = 0; i < 220; i++) st.petals.push(newPetal(true));
  grille.position.y = 0;
  for (const p of pylons) for (const m of p.userData.stripes) m.emissiveIntensity = 0;
  for (const pl of pylonLights) pl.intensity = 0;
  for (const b of beams) b.geometry.setDrawRange(0, 0);
};
function newPetal(anywhere) {
  return {
    p: new THREE.Vector3(-7 + Math.random() * 14, anywhere ? Math.random() * 6 : 5 + Math.random() * 2, -1 - Math.random() * 9),
    v: new THREE.Vector3(0.25 + Math.random() * 0.3, -(0.35 + Math.random() * 0.35), (Math.random() - 0.5) * 0.2),
    r: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
    s: 0.8 + Math.random() * 0.8,
    ph: Math.random() * 6,
  };
}

const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
S.update = function (dt, t) {
  sky.rotation.y += dt * 0.004;
  // ignition: stripes light alternately like torches, then the beams cross
  if (st.igniting && st.nLit < 14) {
    st.igniteT += dt;
    const want = Math.min(14, Math.floor(st.igniteT / 0.13) + 1);
    while (st.nLit < want) {
      st.lit[st.nLit % 2][Math.floor(st.nLit / 2)] = 0.01;
      A.ignite(st.nLit);
      st.nLit++;
    }
  }
  pylons.forEach((p, side) => {
    p.userData.stripes.forEach((m, i) => {
      if (st.lit[side][i] > 0) st.lit[side][i] = Math.min(1, st.lit[side][i] + dt * 5);
      m.emissiveIntensity = st.lit[side][i] * (2.2 + 0.4 * Math.sin(t * 13 + i * 2 + side * 3));
    });
    pylonLights[side].intensity = (st.lit[side].reduce((a, b) => a + b, 0) / 7) * 6;
  });
  if (st.nLit >= 14 && st.lit[1][6] >= 1) {
    if (st.beam === 0) A.shimmer();
    st.beam = Math.min(1, st.beam + dt * 1.2);
    for (const b of beams) b.geometry.setDrawRange(0, Math.floor(b.geometry.index.count * AQ.ease.out(st.beam) / 6) * 6);
    if (st.beam >= 1 && !st.ready) {
      st.ready = true;
      AQ.app.caption("the gate is listening");
    }
  }
  if (st.opening) {
    st.open = Math.min(1, st.open + dt / 1.4);
    grille.position.y = AQ.ease.inOut(st.open) * 2.5;
  }
  waterTex.offset.y += dt * (0.5 + st.open * 0.5);
  flies.update(dt, t);
  // petals
  st.petals.forEach((pt, i) => {
    pt.ph += dt;
    pt.p.addScaledVector(pt.v, dt);
    pt.p.x += Math.sin(pt.ph * 1.3) * 0.15 * dt;
    pt.r.x += dt * 1.7; pt.r.y += dt * 1.1;
    if (pt.p.y < 0.02) Object.assign(pt, newPetal(false));
    q.setFromEuler(pt.r);
    sc.setScalar(pt.s);
    m4.compose(pt.p, q, sc);
    petals.setMatrixAt(i, m4);
  });
  petals.instanceMatrix.needsUpdate = true;
};

function ignite() {
  if (!st.igniting) st.igniting = true;
}
S.onButton = function () {
  if (st.opening || !st.ready) return;
  st.opening = true;
  AQ.app.busy = true;
  A.tap();
  setTimeout(() => { A.grille(1.4); A.setScene("gateOpen"); }, 300);
  setTimeout(() => {
    AQ.app.fly(1, [
      { pos: [0, 1.6, -6.4], look: [0, 1.3, -12] },
      { pos: [0, 1.35, -9.4], look: [0, -1.6, -15] },
      { pos: [0, -0.8, -12.8], look: [0, -4.6, -19] },
      { pos: [0, -3.2, -16.6], look: [0, -7.2, -23] },
    ], { dur: 3.6, fadeFrom: 0.7 });
  }, 2100);
};
S.hotspots = function () {
  return [
    {
      id: "gate",
      caption: st.ready ? "go down" : "the entrance",
      objects: [gateProxy],
      enter: ignite,
      click: () => { ignite(); if (st.ready) S.onButton(); },
    },
    {
      id: "pylon",
      caption: "metro pylon",
      objects: pylons,
      enter: ignite,
      click: () => { ignite(); if (st.ready) A.shimmer(Math.random() < 0.5); },
    },
    {
      id: "monument",
      caption: "the washington monument (not a station)",
      objects: [monument],
      click: () => A.announce("The Washington Monument is not a Metro station. Please stop asking."),
    },
    {
      id: "trees",
      caption: "cherry blossoms (peak bloom: always)",
      objects: trees.slice(0, 2),
      click: (hit) => {
        A.chirp();
        for (let i = 0; i < 30; i++) {
          const k = Math.floor(Math.random() * st.petals.length);
          st.petals[k].p.copy(hit.point).add(new THREE.Vector3((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.8));
        }
      },
    },
  ];
};
S.flares = () => [{ pos: S.sunPos, strength: 0.9, size: 1.1 }, ...lamps.map((p) => ({ pos: p, strength: 0.35, size: 0.5 }))];

export default S;
