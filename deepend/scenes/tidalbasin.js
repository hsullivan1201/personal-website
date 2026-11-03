/* station 5 — tidal basin. end of the line, and the pool goes further down than it should. */
import * as L from "../lib3d.js";
const { THREE } = L;
const AQ = window.AQ;
const A = AQ.audio;

const S = {
  name: "Tidal Basin",
  ambience: "platform",
  song: "faith",
  exposure: 0.95,
  bloom: { strength: 0.7, radius: 0.55, threshold: 0.88 },
  pose: { pos: [0, 1.65, 1.4], look: [0, 1.15, -5], fov: 58 },
  arrive: { pos: [0, 2.3, 4.2], look: [0, 1.4, -5] },
  arriveDur: 2.0,
};
const TZ = -5.05; // train side face
const DOOR_X = [-9.4, -6.25, -3.1, 0, 3.1, 6.25, 9.4];
const MAIN_DOORS = [2, 3, 4];
let st = null;
let water, train, leaves = [], frames = [], lamps = [], doorProxies = [], speakers = [], floaters, coneMat;
let lanterns, bubbles, motes, glowRing;

// ---------- the car side, painted ----------
function paintCar(x, w, h, glowOnly) {
  const ppm = w / 23; // pixels per meter
  const Y = (m) => h - (m - 0.3) * ppm; // car-local meters (0.3..3.35) to canvas y
  if (!glowOnly) {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#9da3a8");
    g.addColorStop(0.06, "#e1e4e6");
    g.addColorStop(0.5, "#c3c8cc");
    g.addColorStop(1, "#8e9398");
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    x.fillStyle = L.LINES.aqua;
    x.fillRect(0, Y(1.15), w, ppm * 0.09);
    x.fillStyle = "#3c4248";
    x.fillRect(0, Y(1.15) + ppm * 0.12, w, ppm * 0.03);
  } else {
    x.fillStyle = "#000";
    x.fillRect(0, 0, w, h);
  }
  const cx = w / 2;
  const occupied = DOOR_X.map((d) => [cx + (d - 0.95) * ppm, cx + (d + 0.95) * ppm]);
  const interior = (x0, y0, ww, hh, r, door) => {
    x.save();
    AQ.roundRect(x, x0, y0, ww, hh, r);
    x.clip();
    const g = x.createLinearGradient(0, y0, 0, y0 + hh);
    g.addColorStop(0, glowOnly ? "#fff4d8" : "#f6f1df");
    g.addColorStop(0.5, glowOnly ? "#7a7464" : "#c9c3b0");
    g.addColorStop(1, glowOnly ? "#111" : "#6a6458");
    x.fillStyle = g;
    x.fillRect(x0, y0, ww, hh);
    if (!glowOnly) {
      x.fillStyle = "rgba(40,60,70,0.55)";
      x.fillRect(x0, y0 + hh * 0.12, ww, hh * (door ? 0.32 : 0.45));
      const seatY = y0 + hh * (door ? 0.62 : 0.66);
      for (let sx = x0 - 20; sx < x0 + ww; sx += 46) {
        x.fillStyle = Math.floor(sx / 46) % 2 ? "#a3263a" : "#2c4a8a";
        x.fillRect(sx, seatY, 40, hh * 0.3);
      }
      if (door) { x.fillStyle = "#e6e2d8"; x.fillRect(x0 + ww / 2 - 3, y0, 6, hh); }
    }
    x.restore();
  };
  for (let xx = 40; xx < w - 140; xx += 1.35 * ppm) {
    const x0 = xx, x1 = xx + 1.1 * ppm;
    if (occupied.some(([a, c]) => x1 > a && x0 < c)) continue;
    interior(x0, Y(2.45), x1 - x0, ppm * 1.0, 14, false);
  }
  for (const d of DOOR_X) {
    const dx = cx + d * ppm, hw = 0.8 * ppm;
    if (!glowOnly) {
      x.fillStyle = "#6e1b1b";
      AQ.roundRect(x, dx - hw - 12, Y(2.62) - 12, hw * 2 + 24, ppm * 2.0 + 16, 12);
      x.fill();
    }
    interior(dx - hw, Y(2.62), hw * 2, ppm * 2.0, 6, true);
  }
  // destination sign
  const sx = cx - 2.55 * ppm, sy = Y(3.12);
  x.fillStyle = "#0b0b0b";
  AQ.roundRect(x, sx, sy, 2.0 * ppm, ppm * 0.22, 5);
  x.fill();
  AQ.ledText(x, "~~  NOT IN SERVICE", sx + 12, sy + 9, ppm * 0.022, "rgba(255,157,46,1)", !glowOnly);
  if (!glowOnly) {
    x.fillStyle = "#30353a";
    x.font = `bold ${ppm * 0.12}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    x.fillText("7777", cx - 1.2 * ppm, Y(0.75));
  }
}

S.build = function ({ envTex }) {
  const scene = (S.scene = new THREE.Scene());
  scene.background = new THREE.Color(0x0a0908);
  scene.environment = envTex;
  scene.environmentIntensity = 0.45;
  scene.fog = new THREE.FogExp2(0x0b0a09, 0.02);

  // the vault over everything, and the far wall the train hides
  const vault = L.cofferVault({ axis: "x", c: [0, 0.8, -3.2], R: 6.4, depth: 0.42, margin: 0.13, along: [-30, 30], len: 2, n: 10, th: [0, Math.PI], color: 0xd2c0a4 });
  L.caustics(vault.material, { color: 0x9ff6ff, strength: 0.7, scale: 1.1, y0: 1, y1: 8 });
  scene.add(vault);
  scene.add(L.box(60, 0.9, 0.4, L.concrete(0xcbbda5), 0, 0.4, -9.6));
  const endSign = L.signPlane("Tidal Basin", 4.2, 0.8, { stripe: L.LINES.aqua, emissive: 0.2 });
  endSign.position.set(0, 1.9, -9.45);
  scene.add(endSign);
  const eol = L.signPlane("END OF THE LINE · ALL WATER MUST LEAVE THE TRAIN", 4.4, 0.24, { bg: "#00000000", fg: "#f3efe6" });
  eol.position.set(0, 1.3, -9.45);
  scene.add(eol);

  // the pool
  water = L.water(6.0, 7.2, { deep: 0x0c3c42, reflectivity: 0.92, res: 0.6, strength: 0.35 });
  water.position.set(0, 0, -1.0);
  scene.add(water);

  // decks: sides, far deck with steps, coping
  const gran = L.granite();
  for (const s of [-1, 1]) {
    scene.add(L.box(6.2, 1.5, 10, L.concrete(0x6c2b1e), s * 6.1, -0.25, -0.6));
    const top = L.hexFloor(6.2, 10, { roughness: 0.5 });
    top.position.set(s * 6.1, 0.502, -0.6);
    scene.add(top);
    scene.add(L.box(0.32, 0.08, 10, gran, s * 3.12, 0.53, -0.6));
  }
  scene.add(L.box(30, 1.5, 0.62, L.concrete(0x6c2b1e), 0, -0.25, -4.74));
  const deckTop = L.hexFloor(30, 0.62, { roughness: 0.5 });
  deckTop.position.set(0, 0.502, -4.74);
  scene.add(deckTop);
  scene.add(L.box(30, 0.05, 0.08, gran, 0, 0.5, -4.46));
  scene.add(L.box(30, 0.33, 0.26, L.concrete(0x7c3424), 0, 0.165, -4.3), L.box(30, 0.04, 0.06, gran, 0, 0.33, -4.2));
  scene.add(L.box(30, 0.17, 0.26, L.concrete(0x6b2d20), 0, 0.085, -4.05), L.box(30, 0.04, 0.06, gran, 0, 0.17, -3.95));

  // petals scattered on the decks
  {
    const n = 260;
    const p = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.05, 0.035), new THREE.MeshStandardMaterial({ map: L.petalTex, alphaTest: 0.3, side: THREE.DoubleSide }), n);
    const R = L.rng(55), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0; i < n; i++) {
      const far = R() < 0.4;
      const x = far ? (R() - 0.5) * 14 : (R() < 0.5 ? -1 : 1) * (3.2 + R() * 2.5);
      const z = far ? -4.5 - R() * 0.5 : 1.5 - R() * 6;
      q.setFromEuler(e.set(-Math.PI / 2, 0, R() * 6));
      m4.compose(new THREE.Vector3(x, 0.508, z), q, new THREE.Vector3(1, 1, 1));
      p.setMatrixAt(i, m4);
    }
    scene.add(p);
    floaters = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.06, 0.04), new THREE.MeshStandardMaterial({ map: L.petalTex, alphaTest: 0.3, side: THREE.DoubleSide, emissive: 0x401020, emissiveIntensity: 0.3 }), 18);
    floaters.userData.p = Array.from({ length: 18 }, () => ({ x: (Math.random() - 0.5) * 5.6, z: 1.5 - Math.random() * 5.5, r: Math.random() * 6, v: 0.03 + Math.random() * 0.05 }));
    scene.add(floaters);
  }

  // ---- the train ----
  train = new THREE.Group();
  const steel = L.steel();
  const body = L.box(23, 3.05, 3.0, new THREE.MeshStandardMaterial({ color: 0xb9bec2, roughness: 0.35, metalness: 0.8 }), 0, 1.825, TZ - 1.52);
  train.add(body);
  const roofG = new THREE.CylinderGeometry(1.5, 1.5, 23, 24, 1, false, Math.PI, Math.PI).rotateZ(-Math.PI / 2).scale(1, 0.22, 1);
  const roof = new THREE.Mesh(roofG, steel);
  roof.position.set(0, 3.35, TZ - 1.52);
  train.add(roof);
  const sideMap = L.canvasTex(4096, 544, (x, w, h) => paintCar(x, w, h, false));
  const sideGlow = L.canvasTex(4096, 544, (x, w, h) => paintCar(x, w, h, true));
  const side = new THREE.Mesh(new THREE.PlaneGeometry(23, 3.05), new THREE.MeshStandardMaterial({ map: sideMap, emissive: 0xffffff, emissiveMap: sideGlow, emissiveIntensity: 1.1, roughness: 0.3, metalness: 0.55 }));
  side.position.set(0, 1.825, TZ + 0.005);
  train.add(side);
  const leafTex = L.canvasTex(128, 320, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, "#d2d6da");
    g.addColorStop(1, "#aeb3b8");
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    x.fillStyle = "#24343e";
    AQ.roundRect(x, w * 0.18, h * 0.08, w * 0.64, h * 0.5, 14);
    x.fill();
    x.strokeStyle = "rgba(255,255,255,0.3)";
    x.lineWidth = 5;
    x.beginPath(); x.moveTo(w * 0.28, h * 0.45); x.lineTo(w * 0.62, h * 0.15); x.stroke();
    x.fillStyle = "#111";
    x.fillRect(w - 5, 0, 5, h);
  });
  leaves = [];
  frames = [];
  lamps = [];
  const redFrame = () => new THREE.MeshStandardMaterial({ color: 0x6e1b1b, roughness: 0.4, emissive: 0x000000, emissiveIntensity: 1 });
  DOOR_X.forEach((d, i) => {
    for (const s of [-1, 1]) {
      const lf = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.0, 0.05), [steel, steel, steel, steel, new THREE.MeshStandardMaterial({ map: leafTex, roughness: 0.55, metalness: 0.25 }), steel]);
      if (s > 0) lf.material[4].map = leafTex;
      lf.scale.x = s > 0 ? -1 : 1;
      lf.position.set(d + s * 0.4, 1.62, TZ + 0.035);
      lf.userData = { base: d + s * 0.4, s };
      train.add(lf);
      leaves.push(lf);
    }
    if (MAIN_DOORS.includes(i)) {
      const fm = redFrame();
      for (const [w, h, x, y] of [[1.9, 0.1, d, 2.67], [0.1, 2.1, d - 0.9, 1.62], [0.1, 2.1, d + 0.9, 1.62]]) train.add(L.box(w, h, 0.06, fm, x, y, TZ + 0.04));
      frames.push(fm);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), new THREE.MeshStandardMaterial({ color: 0x5a3a10, emissive: 0xffb43c, emissiveIntensity: 0 }));
      lamp.position.set(d, 2.86, TZ + 0.06);
      train.add(lamp);
      lamps.push(lamp.material);
      const proxy = L.hitProxy(1.9, 2.3, 0.4, d, 1.6, TZ + 0.2);
      train.add(proxy);
      doorProxies.push(proxy);
    }
  });
  const interiorLight = new THREE.PointLight(0xfff0d0, 3, 8, 1.6);
  interiorLight.position.set(0, 2.2, TZ + 0.8);
  train.add(interiorLight);
  scene.add(train);

  // pillars, speakers, the strip-map "painting"
  speakers = [];
  for (const s of [-1, 1]) {
    const px = s * 4.55;
    scene.add(L.box(0.62, 7, 0.62, L.concrete(0x3a3530, { repeat: 1 }), px, 3.5, -4.72));
    L.LINE_ORDER.forEach((nm, i) => scene.add(L.box(0.7, 0.06, 0.7, new THREE.MeshStandardMaterial({ color: L.LINES[nm], emissive: L.LINES[nm], emissiveIntensity: 0.35, roughness: 0.4 }), px, 3.45 + i * 0.06, -4.72)));
    const spk = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.14, 24), new THREE.MeshStandardMaterial({ color: 0xd0cac0, roughness: 0.5 }));
    cone.rotation.x = Math.PI / 2;
    const grille = new THREE.Mesh(new THREE.CircleGeometry(0.13, 24), new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 }));
    grille.position.z = 0.075;
    spk.add(cone, grille);
    spk.position.set(px, 4.25, -4.38);
    scene.add(spk);
    speakers.push(spk);
    if (s < 0) {
      const posterTex = L.canvasTex(256, 360, (x, w, h) => {
        x.fillStyle = "#c7a24a"; x.fillRect(0, 0, w, h);
        x.fillStyle = "#f4efe3"; x.fillRect(12, 12, w - 24, h - 24);
        x.fillStyle = L.LINES.aqua; x.fillRect(w / 2 - 6, 40, 12, h - 80);
        ["Foggy Bottom", "Waterfront", "Metro Center", "Potomac Ave", "Tidal Basin"].forEach((nm, i) => {
          const y = 50 + i * ((h - 100) / 4);
          x.fillStyle = "#fff"; x.strokeStyle = "#222"; x.lineWidth = 4;
          x.beginPath(); x.arc(w / 2, y, 12, 0, Math.PI * 2); x.fill(); x.stroke();
          x.fillStyle = "#222"; x.font = 'bold 15px "Helvetica Neue", Helvetica, Arial, sans-serif';
          x.fillText(nm, w / 2 + 20, y + 5);
        });
      });
      const poster = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), new THREE.MeshStandardMaterial({ map: posterTex, roughness: 0.5 }));
      poster.position.set(px, 2.3, -4.405);
      scene.add(poster);
    }
  }
  // urns between the doors, ferns on the side decks
  const terracotta = new THREE.MeshStandardMaterial({ color: 0x8a4526, roughness: 0.7 });
  for (const ux of [-1.55, 1.55]) scene.add(L.at(L.lathe([[0, 0], [0.13, 0], [0.19, 0.16], [0.13, 0.36], [0.09, 0.41], [0.12, 0.44], [0, 0.44]], 0, { material: terracotta }), ux, 0.5, -4.75));
  for (const [x, z, sz, seed] of [[-3.95, -0.4, 1.9, 71], [3.95, -0.6, 1.9, 72], [-4.4, -3.4, 1.6, 73], [4.4, -3.4, 1.6, 74], [-3.9, 2.3, 2.2, 75], [3.9, 2.1, 2.2, 76]]) {
    scene.add(L.at(L.lathe([[0, 0], [0.24, 0], [0.32, 0.48], [0.35, 0.5], [0, 0.5]], 0, { material: new THREE.MeshStandardMaterial({ color: 0x3b2a20, roughness: 0.8 }) }), x, 0.5, z));
    scene.add(L.at(L.fern(sz, seed, [36, 98, 54]), x, 0.95, z));
  }

  // the lamp, with a fake volumetric cone
  const lampGlow = L.glowSprite(0xfff6e0, 1.6, 0.9);
  lampGlow.position.set(0, 5.5, -3.0);
  scene.add(lampGlow);
  const coneTex = L.canvasTex(64, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "rgba(255,246,220,0.5)");
    g.addColorStop(1, "rgba(255,246,220,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
  });
  coneMat = new THREE.MeshBasicMaterial({ map: coneTex, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(2.4, 5.2, 40, 1, true), coneMat);
  cone.position.set(0, 2.9, -3.0);
  scene.add(cone);
  const key = new THREE.PointLight(0xffe8c4, 10, 14, 1.4);
  key.position.set(0, 5.2, -3.0);
  scene.add(key);
  for (const s of [-1, 1]) {
    const up = new THREE.PointLight(0xffd8a8, 2.2, 10, 1.5);
    up.position.set(s * 4.0, 0.9, -3.6);
    scene.add(up);
    const fill = new THREE.PointLight(0xffd8a8, 2.5, 12, 1.5);
    fill.position.set(s * 4, 2.6, 2.2);
    scene.add(fill);
  }
  scene.add(new THREE.HemisphereLight(0xffe8cc, 0x1e1812, 0.12));

  // a faint ring of light deep under the surface, where the pool keeps going
  glowRing = new THREE.Mesh(new THREE.RingGeometry(0.6, 1.4, 48), new THREE.MeshBasicMaterial({ color: 0x7ffff0, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  glowRing.rotation.x = -Math.PI / 2;
  glowRing.position.set(0, 0.01, -1.6);
  scene.add(glowRing);
  bubbles = new L.Bubbles({ count: 18, area: { x0: -2.6, x1: 2.6, z0: -3.8, z1: 0.8, y0: 0.0, y1: 4.5 }, size: [0.05, 0.16], speed: [0.2, 0.45] });
  scene.add(bubbles.mesh);
  motes = new L.Motes({ count: 60, color: 0x9ffcff, size: 0.06, blink: false, rise: 0.2, drift: 0.6, area: { x0: -3, x1: 3, y0: 0.2, y1: 3.5, z0: -4, z1: 1 } });
  scene.add(motes.points);
  // paper lanterns, floating above the pool. you can only see them in the water.
  lanterns = new THREE.Group();
  [[-1.8, 2.4, -2.6], [0.4, 3.1, -3.4], [1.9, 2.2, -1.8], [-0.6, 3.6, -1.2], [2.6, 3.4, -3.8], [-2.6, 3.0, -0.4]].forEach(([x, y, z], i) => {
    const l = L.lantern([0xffb35a, 0xff7fae, 0xffd27a][i % 3]);
    l.position.set(x, y, z);
    l.userData.base = y;
    lanterns.add(l);
  });
  scene.add(L.ghost(lanterns));
};

S.reset = function () {
  st = { doors: 0, doorTarget: 0, leaving: false, v: 0, hoverDoor: false, boarding: null, hoverWater: 0, diving: false };
  train.position.x = 0;
};

const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
S.update = function (dt, t) {
  water.userData.tick(t);
  // doors + train
  if (st.doorTarget !== st.doors) st.doors = AQ.clamp(st.doors + Math.sign(st.doorTarget - st.doors) * dt / 0.7, 0, 1);
  const slide = AQ.ease.inOut(st.doors) * 0.74;
  for (const lf of leaves) lf.position.x = lf.userData.base + lf.userData.s * slide;
  const blink = (st.boarding || (st.doors > 0.01 && st.doors < 0.99)) && Math.floor(t * 4) % 2 === 0;
  for (const m of lamps) m.emissiveIntensity = blink ? 3 : 0;
  const glow = st.hoverDoor && !st.leaving ? 0.6 + 0.4 * Math.sin(t * 5) : 0;
  frames.forEach((m) => m.emissive.setRGB(glow * 0.75, glow * 0.35, glow * 1.0));
  if (st.leaving) {
    st.v += dt * 2.2;
    train.position.x -= st.v * dt;
  }
  // petals drifting on the water
  floaters.userData.p.forEach((p, i) => {
    p.x += p.v * dt;
    p.r += dt * 0.3;
    if (p.x > 2.9) p.x = -2.9;
    q.setFromEuler(e.set(-Math.PI / 2, 0, p.r));
    m4.compose(new THREE.Vector3(p.x, 0.012 + Math.sin(t * 1.5 + i) * 0.004, p.z), q, one);
    floaters.setMatrixAt(i, m4);
  });
  floaters.instanceMatrix.needsUpdate = true;
  coneMat.opacity = 0.11 + 0.02 * Math.sin(t * 0.9);
  lanterns.children.forEach((l, i) => {
    l.position.y = l.userData.base + Math.sin(t * 0.6 + i) * 0.15;
    l.rotation.y += dt * 0.3;
  });
  bubbles.update(dt, t);
  motes.update(dt, t);
  // the ring below the surface breathes, and leans toward you when you hover the water
  st.hoverWater += ((app().hover && app().hover.id === "water" ? 1 : 0) - st.hoverWater) * Math.min(1, dt * 3);
  glowRing.material.opacity = 0.12 + 0.08 * Math.sin(t * 1.2) + st.hoverWater * 0.25;
  glowRing.scale.setScalar(1 + 0.1 * Math.sin(t * 0.8) + st.hoverWater * 0.3);
};
const app = () => AQ.app;

// ---------- interaction ----------
function rideBack() {
  if (st.boarding) return;
  st.boarding = true;
  AQ.app.busy = true;
  AQ.app.caption("");
  setTimeout(() => { st.doorTarget = 1; A.doors(); }, 300);
  setTimeout(() => A.announce("Step back. Doors closing."), 1100);
  setTimeout(() => { st.doorTarget = 0; A.doors(); }, 2900);
  setTimeout(() => { st.leaving = true; A.train(false, 5); }, 3800);
  setTimeout(() => AQ.app.fly(0, [{ pos: [0.6, 1.7, 1.2], look: [-6, 1.6, -5] }], { dur: 1.6, fadeFrom: 0.2, whoosh: false }), 5500);
}
function dive(hit) {
  if (st.diving) return;
  st.diving = true;
  const x = hit ? hit.point.x * 0.4 : 0;
  water.userData.ripple(x, -1.6, 2);
  A.dive();
  setTimeout(() => A.underwater(true, 1.5), 900);
  AQ.app.fly(5, [
    { pos: [x * 0.5, 1.9, 0.4], look: [x, -0.4, -2.2] },
    { pos: [x, 0.6, -1.0], look: [x, -2.5, -2.4] },
    { pos: [x, -0.8, -1.6], look: [x, -4, -2.8] },
  ], { dur: 1.9, fadeFrom: 0.5, ease: "in", whoosh: false });
}
S.flares = () => [{ pos: new THREE.Vector3(0, 5.5, -3.0), strength: 0.45, size: 0.7 }];
S.hotspots = function () {
  return [
    {
      id: "doors",
      caption: "ride back to foggy bottom",
      objects: doorProxies,
      enter: () => (st.hoverDoor = true),
      leave: () => (st.hoverDoor = false),
      click: rideBack,
    },
    {
      id: "water",
      caption: "the deep end",
      objects: [water],
      click: (hit) => dive(hit),
    },
    {
      id: "bubbles",
      caption: "a bubble",
      objects: [bubbles.mesh],
      click: (hit) => { if (hit && hit.instanceId != null) { bubbles.pop(hit.instanceId); A.pop(hit.point.x / 3); } },
    },
    { id: "speaker", caption: "the pa", objects: speakers, click: () => A.announce("Tidal Basin. End of the line. The pool is closed. The pool is always open.") },
  ];
};

export default S;
