/* station 2 — waterfront, in 3d. the vault over a reflecting pool. */
import * as L from "../lib3d.js";
const { THREE } = L;
const AQ = window.AQ;
const A = AQ.audio;

const S = {
  name: "Waterfront",
  ambience: "vault",
  exposure: 1.0,
  bloom: { strength: 0.55, radius: 0.5, threshold: 0.95 },
  pose: { pos: [0, 4.4, -0.6], look: [0, 0.6, -40], fov: 58 },
  arrive: { pos: [0, 6.2, 5], look: [0, 1.6, -40] },
  arriveDur: 2.2,
};
const WY = -1.2, PE = 5.0, VR = 10.5, VY = 0.8, ZEND = -164;
const ROCK_Z = -13.5;
let st = null;
let water, rockMesh, rockProxy, jet, veil, foam, ducks = [], pigeons = [], edge, edgeCount = 0, tunnel, signs = [], pylonG;

S.build = function ({ envTex }) {
  const scene = (S.scene = new THREE.Scene());
  scene.background = new THREE.Color(0x07090a);
  scene.environment = envTex;
  scene.environmentIntensity = 0.25;
  scene.fog = new THREE.FogExp2(0x0a0d0e, 0.008);

  scene.add(L.cofferVault({ axis: "z", c: [0, VY, 0], R: VR, depth: 0.55, margin: 0.13, along: [ZEND, -2], len: 2.0, n: 17, th: [-0.075, Math.PI + 0.075] }));
  // end wall + tunnel mouth glow
  const cap = new THREE.Mesh(new THREE.CircleGeometry(VR + 0.5, 40, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x14191a, roughness: 1 }));
  cap.position.set(0, VY, ZEND + 0.5);
  scene.add(cap);
  tunnel = new THREE.Group();
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(2.4, 32), L.glow(0x8ffff2, 4));
  mouth.position.set(0, 0.6, ZEND + 0.6);
  const halo = L.glowSprite(0x6ff5ea, 16, 0.55);
  halo.position.set(0, 0.8, ZEND + 1);
  const tl = new THREE.PointLight(0x6ff5ea, 30, 50, 1.3);
  tl.position.set(0, 1.5, ZEND + 8);
  tunnel.add(mouth, halo, tl);
  scene.add(tunnel);

  // platforms
  for (const s of [-1, 1]) {
    const w = VR - PE - 0.05;
    const f = L.hexFloor(w, -ZEND, { roughness: 0.45 });
    f.position.set(s * (PE + w / 2), 0, ZEND / 2);
    scene.add(f);
    scene.add(L.box(0.62, 0.06, -ZEND, L.granite(), s * (PE + 0.3), 0.03, ZEND / 2));
    scene.add(L.box(0.2, -WY, -ZEND, L.concrete(0x3a3734), s * (PE - 0.05), WY / 2, ZEND / 2));
    // warm uplights along the platform edge: the real lighting scheme, roughly
    for (const z of [-7, -20, -36, -58, -88]) {
      const pl = new THREE.PointLight(0xffdcb4, 9, 30, 1.35);
      pl.position.set(s * (PE + 0.6), 0.9, z);
      scene.add(pl);
    }
  }
  scene.add(new THREE.HemisphereLight(0xffe8cc, 0x302820, 0.12));

  // edge lights (they flash for a train that never comes)
  const zs = [];
  for (let z = -6.5; z > -120; z -= 2.4) zs.push(z);
  edgeCount = zs.length * 2;
  edge = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), edgeCount);
  const m4 = new THREE.Matrix4();
  let k = 0;
  for (const s of [-1, 1]) for (const z of zs) {
    m4.makeTranslation(s * (PE + 0.3), 0.065, z);
    edge.setMatrixAt(k, m4);
    edge.setColorAt(k, new THREE.Color(1, 0.94, 0.8));
    edge.userData[k] = z;
    k++;
  }
  scene.add(edge);

  // the reflecting pool
  water = L.water(PE * 2, -ZEND, { deep: 0x0a2f34, reflectivity: 0.9 });
  water.position.set(0, WY, ZEND / 2);
  scene.add(water);

  // signs on both walls
  signs = [];
  for (const z of [-13.5, -44.5]) for (const s of [-1, 1]) {
    const sg = L.signPlane("Waterfront", 4.6, 0.86, { stripe: L.LINES.aqua, emissive: 0.15 });
    const xw = s * 10.28;
    sg.position.set(xw, 2.05, z);
    sg.rotation.y = -s * Math.PI / 2;
    scene.add(sg);
    signs.push(sg);
  }
  pylonG = L.pylon({ h: 2.7, w: 0.5, lit: true });
  pylonG.position.set(-7.4, 0, -11);
  pylonG.rotation.y = 0.35;
  scene.add(pylonG);
  const gr = L.granite();
  scene.add(L.box(1.9, 0.12, 0.7, gr, 7.4, 0.45, -14.2), L.box(0.25, 0.4, 0.5, gr, 6.8, 0.2, -14.2), L.box(0.25, 0.4, 0.5, gr, 8.0, 0.2, -14.2));

  // the mezzanine slab we're standing on (just its edge shows)
  scene.add(L.box(12, 0.4, 4, L.concrete(0xb8b0a2, { repeat: 4 }), 0, 2.5, 0.8));

  // the rock + fountain
  rockMesh = L.rock(1.5, 12, 0x6f6a64);
  rockMesh.position.set(0, WY - 0.1, ROCK_Z);
  scene.add(rockMesh);
  const r2 = L.rock(0.8, 13, 0x5c5853);
  r2.position.set(0.9, WY, ROCK_Z + 0.5);
  scene.add(r2);
  jet = new L.Spray({ at: new THREE.Vector3(0, WY + 0.9, ROCK_Z), count: 2200, rate: 800, speed: 6.4, spread: 0.16, life: 1.4, size: 0.07, floorY: WY, radius: 0.08 });
  veil = new L.Spray({ at: new THREE.Vector3(0, WY + 0.85, ROCK_Z), count: 1600, rate: 700, speed: 2.2, ring: 0.5, life: 0.9, size: 0.06, floorY: WY, spread: 0.6 });
  scene.add(jet.points, veil.points);
  const foamTex = L.canvasTex(256, 256, (x) => {
    const g = x.createRadialGradient(128, 128, 40, 128, 128, 128);
    g.addColorStop(0, "rgba(255,255,255,0.9)");
    g.addColorStop(0.5, "rgba(255,255,255,0.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 256);
    const R = L.rng(3);
    x.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 220; i++) { x.beginPath(); x.arc(R() * 256, R() * 256, 2 + R() * 7, 0, Math.PI * 2); x.fill(); }
  });
  foam = new THREE.Mesh(new THREE.CircleGeometry(2.4, 40), new THREE.MeshBasicMaterial({ map: foamTex, color: 0xeaffff, transparent: true, opacity: 0.25, depthWrite: false }));
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, WY + 0.02, ROCK_Z);
  scene.add(foam);
  rockProxy = L.hitProxy(3.4, 3.2, 3, 0, WY + 1.4, ROCK_Z);
  scene.add(rockProxy);

  // ducks + pigeons
  ducks = [];
  for (const [x, z, dir, sp] of [[-2.6, -19, 1, 0.35], [2.0, -25, -1, 0.28], [0.6, -34, 1, 0.22]]) {
    const d = L.duck();
    d.scale.setScalar(1.6);
    d.position.set(x, WY + 0.08, z);
    d.userData = { dir, sp, base: sp, ph: Math.random() * 6 };
    scene.add(d);
    ducks.push(d);
  }
  pigeons = [];
  for (let i = 0; i < 4; i++) {
    const p = L.pigeon();
    p.visible = false;
    p.scale.setScalar(1.6);
    scene.add(p);
    pigeons.push(p);
  }
};

S.reset = function () {
  st = { ghost: 0, nextGhost: 14 + Math.random() * 10, nextBirds: 2 + Math.random() * 3, burst: 0 };
};

const col = new THREE.Color();
S.update = function (dt, t) {
  water.userData.tick(t);
  jet.boost = veil.boost = st.burst;
  st.burst = Math.max(0, st.burst - dt);
  jet.update(dt);
  veil.update(dt);
  foam.material.opacity = 0.2 + 0.08 * Math.sin(t * 4);
  foam.rotation.z += dt * 0.3;
  // ghost train
  st.nextGhost -= dt;
  if (st.nextGhost <= 0) {
    st.nextGhost = 28 + Math.random() * 20;
    st.ghost = 5;
    A.train(true, 5, 0.35);
  }
  st.ghost = Math.max(0, st.ghost - dt);
  for (let i = 0; i < edgeCount; i++) {
    const z = edge.userData[i];
    let k = 0.9;
    if (st.ghost > 0) k += 2.6 * Math.pow(Math.max(0, Math.sin(-z * 0.5 - t * 9)), 2);
    edge.setColorAt(i, col.setRGB(k, k * 0.92, k * 0.78));
  }
  edge.instanceColor.needsUpdate = true;
  // ducks paddle and turn at the walls
  for (const d of ducks) {
    const u = d.userData;
    u.ph += dt;
    d.position.x += u.dir * u.sp * dt;
    if (Math.abs(d.position.x) > PE - 0.9) u.dir = -Math.sign(d.position.x);
    const target = u.dir > 0 ? 0 : Math.PI;
    d.rotation.y += (target - d.rotation.y) * Math.min(1, dt * 3);
    d.position.y = WY + 0.08 + Math.sin(u.ph * 2.2) * 0.015;
    d.rotation.z = Math.sin(u.ph * 1.7) * 0.04;
  }
  // pigeons cross the vault now and then
  st.nextBirds -= dt;
  if (st.nextBirds <= 0) {
    st.nextBirds = 9 + Math.random() * 10;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const n = 1 + Math.floor(Math.random() * 3);
    const z = -14 - Math.random() * 16, y = 6.5 + Math.random() * 2;
    for (let i = 0; i < n; i++) {
      const p = pigeons[i];
      p.visible = true;
      p.position.set(-dir * (12 + i * 1.6), y + i * 0.4, z - i * 0.8);
      p.rotation.y = dir > 0 ? 0 : Math.PI;
      p.userData.v = dir * (5.5 + Math.random());
      p.userData.ph = Math.random() * 6;
    }
    if (Math.random() < 0.6) A.coo();
  }
  for (const p of pigeons) {
    if (!p.visible) continue;
    p.position.x += p.userData.v * dt;
    p.userData.ph += dt * 16;
    p.userData.flap(p.userData.ph);
    p.position.y += Math.sin(p.userData.ph * 0.2) * 0.2 * dt;
    if (Math.abs(p.position.x) > 14) p.visible = false;
  }
  tunnel.children[1].material.opacity = 0.45 + 0.12 * Math.sin(t * 1.3);
};

S.hotspots = function () {
  return [
    {
      id: "tunnel",
      caption: "toward the light",
      objects: [tunnel],
      click: () => AQ.app.fly(2, [
        { pos: [0, 3.6, -16], look: [0, 1.6, -60] },
        { pos: [0, 1.6, -60], look: [0, 0.8, -150] },
        { pos: [0, 0.8, -125], look: [0, 0.6, -170] },
      ], { dur: 3.8, fadeFrom: 0.62 }),
    },
    ...ducks.map((d, i) => ({
      id: "duck" + i,
      caption: "a duck",
      objects: [d],
      click: () => {
        A.quack(d.position.x / 6);
        d.userData.dir *= -1;
        d.userData.sp = d.userData.base + 0.9;
        setTimeout(() => (d.userData.sp = d.userData.base), 1600);
        water.userData.ripple(d.position.x, d.position.z, 0.8);
      },
    })),
    {
      id: "fountain",
      caption: "the fountain",
      objects: [rockProxy],
      click: () => { st.burst = 1.4; A.splash(0); water.userData.ripple(0, ROCK_Z, 1.4); },
    },
    {
      id: "sign",
      caption: "waterfront",
      objects: signs,
      click: () => A.announce("This is Waterfront. Please mind the gap. The gap is full of water."),
    },
    {
      id: "pylon",
      caption: "station pylon",
      objects: [pylonG],
      click: () => A.announce("Waterfront. Doors will open on the left. And the right. And below."),
    },
    {
      id: "water",
      caption: "the reflecting pool",
      cursor: "crosshair",
      objects: [water],
      click: (hit) => {
        water.userData.ripple(hit.point.x, hit.point.z, 1.2);
        A.plop(hit.point.x / 6, 0.9);
      },
    },
  ];
};

export default S;
