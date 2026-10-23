/* the secret station — below. the pool keeps going, into a drowned vault. */
import * as L from "../lib3d.js";
const { THREE } = L;
const AQ = window.AQ;
const A = AQ.audio;

const S = {
  name: "Below",
  secret: true,
  ambience: "silent",
  song: "islands",
  exposure: 1.05,
  bloom: { strength: 0.9, radius: 0.7, threshold: 0.78 },
  pose: { pos: [0, -4.2, 2], look: [0, -5.2, -14], fov: 64 },
  arrive: { pos: [0, -1.2, 1.2], look: [0, -6.5, -6] },
  arriveDur: 3.2,
};
const SURFACE = 0, FLOOR = -9, VC = -5.4, VR = 7, SZ = -6.5; // SZ: where the light comes down
let st = null;
let surface, rays = [], jellies = [], kois = [], mantaG, bubbles, snow, pylonG, light, train, crown;

S.build = function ({ envTex }) {
  const scene = (S.scene = new THREE.Scene());
  scene.background = new THREE.Color(0x02222a);
  scene.environment = envTex;
  scene.environmentIntensity = 0.3;
  scene.fog = new THREE.FogExp2(0x03313a, 0.055);

  // a drowned vault, its coffers swimming with caustics
  const vault = L.cofferVault({ axis: "z", c: [0, VC, 0], R: VR, depth: 0.45, margin: 0.13, along: [-90, 8], len: 1.8, n: 12, th: [-0.55, Math.PI + 0.55], color: 0x8aa8a0 });
  L.caustics(vault.material, { color: 0xb8fff6, strength: 1.1, scale: 0.8, key: "below" });
  scene.add(vault);
  const floor = L.hexFloor(16, 100, { roughness: 0.8, color: 0x6a8a84 });
  floor.position.set(0, FLOOR, -40);
  L.caustics(floor.material, { color: 0xc8fff8, strength: 1.4, scale: 1.1, key: "belowfloor" });
  scene.add(floor);

  // the underside of the pool's surface, far above, bright and moving
  surface = new THREE.Mesh(new THREE.CircleGeometry(4.5, 48), new THREE.MeshStandardMaterial({ color: 0x0, emissive: 0x7ff6ff, emissiveIntensity: 1.6, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
  L.caustics(surface.material, { color: 0xffffff, strength: 1.6, scale: 0.9, key: "surface" });
  surface.rotation.x = Math.PI / 2;
  surface.position.set(0, SURFACE + 0.4, SZ);
  scene.add(surface);
  // god rays falling from it
  const rayTex = L.canvasTex(64, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "rgba(200,255,250,0.6)");
    g.addColorStop(1, "rgba(200,255,250,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    const gx = x.createLinearGradient(0, 0, w, 0);
    gx.addColorStop(0, "rgba(0,0,0,1)");
    gx.addColorStop(0.5, "rgba(0,0,0,0)");
    gx.addColorStop(1, "rgba(0,0,0,1)");
    x.globalCompositeOperation = "destination-out";
    x.fillStyle = gx;
    x.fillRect(0, 0, w, h);
  });
  rays = [];
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.6 + Math.random() * 1.1, 12), new THREE.MeshBasicMaterial({ map: rayTex, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    m.position.set((Math.random() - 0.5) * 6, SURFACE - 5.6, SZ + (Math.random() - 0.5) * 5);
    m.rotation.set(0, Math.random() * Math.PI, (Math.random() - 0.5) * 0.35);
    m.userData.ph = Math.random() * 6;
    scene.add(m);
    rays.push(m);
  }

  // what sank: a pylon, still lit; a bench; a car with its lights on
  pylonG = L.pylon({ h: 3.2, w: 0.5, lit: true });
  pylonG.position.set(-3.4, FLOOR, -9);
  pylonG.rotation.set(0.25, 0.6, -0.35);
  scene.add(pylonG);
  const bench = L.box(1.9, 0.14, 0.7, L.granite(), 3.4, FLOOR + 0.42, -7);
  bench.rotation.z = 0.2;
  scene.add(bench);
  train = new THREE.Group();
  const winTex = L.canvasTex(1024, 128, (x, w, h) => {
    x.fillStyle = "#3a4a4c";
    x.fillRect(0, 0, w, h);
    for (let i = 0; i < 14; i++) {
      const g = x.createLinearGradient(0, 22, 0, 70);
      g.addColorStop(0, "#d8fff8");
      g.addColorStop(1, "#5fd8d0");
      x.fillStyle = g;
      x.fillRect(20 + i * 72, 22, 52, 46);
    }
  });
  const car = new THREE.Mesh(new THREE.BoxGeometry(3, 3.1, 22), [
    new THREE.MeshStandardMaterial({ map: winTex, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 0.8 }),
    new THREE.MeshStandardMaterial({ map: winTex, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 0.8 }),
    new THREE.MeshStandardMaterial({ color: 0x4a5a5c }), new THREE.MeshStandardMaterial({ color: 0x4a5a5c }),
    new THREE.MeshStandardMaterial({ color: 0x4a5a5c, emissive: 0x7ff6ff, emissiveIntensity: 0.5 }), new THREE.MeshStandardMaterial({ color: 0x4a5a5c }),
  ]);
  train.add(car);
  train.position.set(0.5, FLOOR + 1.4, -30);
  train.rotation.set(0.05, 0.12, 0.08);
  scene.add(train);
  const tl = new THREE.PointLight(0x7ff6ff, 8, 16, 1.5);
  tl.position.set(0.5, FLOOR + 3, -22);
  scene.add(tl);

  // the way back up: a crown of light where the surface is
  crown = new THREE.Group();
  const halo = L.glowSprite(0xdffffb, 7, 0.7);
  crown.add(halo);
  crown.position.set(0, SURFACE - 0.6, SZ);
  scene.add(crown);

  light = new THREE.PointLight(0x9ff8ff, 14, 26, 1.3);
  light.position.set(0, SURFACE - 1.5, SZ);
  scene.add(light);
  scene.add(new THREE.HemisphereLight(0x7fe8f0, 0x0a2a30, 0.45));

  // life
  jellies = [];
  const jc = [0x7ff6ff, 0xc89bff, 0xff9be0, 0x7fffc4, 0x9fc4ff, 0xffd27a, 0x7ff6ff, 0xc89bff];
  for (let i = 0; i < 8; i++) {
    const j = new L.Jelly({ color: jc[i], size: 0.35 + Math.random() * 0.4, len: 1.2 + Math.random() * 1.4 }).at((Math.random() - 0.5) * 8, -6 + Math.random() * 4, -4 - i * 3.2);
    scene.add(j.group);
    jellies.push(j);
  }
  kois = [];
  for (let i = 0; i < 7; i++) {
    const pts = [];
    const r = 2 + Math.random() * 3, cz = -8 - Math.random() * 8, cy = -6 + Math.random() * 3;
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, cy + Math.sin(a * 2) * 0.8, cz + Math.sin(a) * r * 1.4));
    }
    const kf = new L.Koi(pts, { speed: 0.02 + Math.random() * 0.02, color: [0xf06a28, 0xf2f0ea, 0xffb13a, 0xe8461e][i % 4], size: 1.2 });
    scene.add(kf.group);
    kois.push(kf);
  }
  mantaG = L.manta(0x2a4a5a);
  mantaG.scale.setScalar(1.6);
  scene.add(mantaG);
  bubbles = new L.Bubbles({ count: 40, area: { x0: -5, x1: 5, z0: -14, z1: 1, y0: FLOOR, y1: SURFACE }, size: [0.04, 0.16], speed: [0.4, 0.9] });
  scene.add(bubbles.mesh);
  snow = new L.Motes({ count: 220, color: 0xc8fff8, size: 0.05, blink: false, drift: 1.2, area: { x0: -6, x1: 6, y0: FLOOR, y1: SURFACE - 1, z0: -24, z1: 2 } });
  scene.add(snow.points);
};

S.reset = function () {
  st = { mantaU: 0.2, sang: 0 };
};
S.enter = () => {
  A.underwater(true, 0.5);
  setTimeout(() => A.swell(45), 1400);
};
S.exit = () => A.underwater(false, 1.5);

S.update = function (dt, t) {
  for (const j of jellies) j.update(dt, t);
  for (const k of kois) k.update(dt, t);
  bubbles.update(dt, t);
  snow.update(dt, t);
  rays.forEach((r) => {
    r.material.opacity = 0.12 + 0.08 * Math.sin(t * 0.7 + r.userData.ph);
    r.rotation.y += dt * 0.03;
  });
  // the manta loops slowly through the murk
  st.mantaU = (st.mantaU + dt * 0.018) % 1;
  const a = st.mantaU * Math.PI * 2;
  const p = new THREE.Vector3(Math.cos(a) * 6, -5.5 + Math.sin(a * 2) * 1.2, -12 + Math.sin(a) * 9);
  const n = new THREE.Vector3(Math.cos(a + 0.05) * 6, -5.5 + Math.sin((a + 0.05) * 2) * 1.2, -12 + Math.sin(a + 0.05) * 9);
  mantaG.position.copy(p);
  mantaG.lookAt(n);
  mantaG.rotateY(-Math.PI / 2);
  mantaG.userData.flap(t);
  crown.children[0].material.opacity = 0.55 + 0.15 * Math.sin(t * 1.1);
  light.intensity = 13 + 2 * Math.sin(t * 0.9);
};

function surfaceUp() {
  AQ.app.caption("");
  A.whoosh(2.4, true);
  setTimeout(() => A.underwater(false, 1.2), 1300);
  AQ.app.fly(0, [
    { pos: [0, -3.0, -2], look: [0, 2, SZ] },
    { pos: [0, -1.0, SZ + 0.6], look: [0, 6, SZ - 0.2] },
    { pos: [0, 1.5, SZ], look: [0, 10, SZ - 0.4] },
  ], { dur: 2.6, fadeFrom: 0.55, whoosh: false });
}
S.hotspots = function () {
  return [
    { id: "up", caption: "up, toward the light", objects: [crown, surface, ...rays], click: surfaceUp },
    ...jellies.map((j, i) => ({
      id: "jelly" + i,
      caption: "a jellyfish",
      objects: [j.group],
      click: () => { j.pulse(); A.jelly(i + 2, j.group.position.x / 6); },
    })),
    {
      id: "manta",
      caption: "it sings if you ask",
      objects: [mantaG],
      click: () => { st.sang++; A.swell(40 + (st.sang % 3) * 5); for (const j of jellies) j.pulse(); },
    },
    { id: "koi", caption: "koi, finally where they belong", objects: kois.map((k) => k.group), click: () => A.pop(0) },
    {
      id: "bubbles",
      caption: "a bubble",
      objects: [bubbles.mesh],
      click: (hit) => { if (hit && hit.instanceId != null) { bubbles.pop(hit.instanceId); A.pop(hit.point.x / 5); } },
    },
    { id: "pylon", caption: "a pylon, still lit", objects: [pylonG], click: () => { A.jelly(0); setTimeout(() => A.jelly(4), 180); setTimeout(() => A.jelly(7), 360); } },
    { id: "train", caption: "the train that was never late", objects: [train], click: () => A.train(true, 4, 0.25) },
  ];
};
S.flares = () => [{ pos: new THREE.Vector3(0, SURFACE - 0.6, SZ), strength: 0.6, size: 0.9 }];

export default S;
