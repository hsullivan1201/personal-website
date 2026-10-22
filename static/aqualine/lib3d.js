/* aqua line 3d — shared builders: textures, the waffle vault, water, particles, low-poly props. */
import * as THREE from "three";
import { Reflector } from "./vendor/jsm/objects/Reflector.js";
import { mergeGeometries } from "./vendor/jsm/utils/BufferGeometryUtils.js";

const AQ = window.AQ;
export { THREE };
export const LINES = AQ.LINES;
export const LINE_ORDER = AQ.LINE_ORDER;
export const rng = AQ.rng;
export const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- textures ----------
export function canvasTex(w, h, paint, o = {}) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  paint(c.getContext("2d"), w, h, c);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = o.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (o.repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(o.repeat[0], o.repeat[1]);
  }
  t.userData.canvas = c;
  return t;
}
export function texFrom(canvas, o = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = o.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// pointy-top hex quarry tile, seamless: 4 hexes across, 2 row-pairs down
const HEX_R_WORLD = 0.3;
export const HEX_TILE = { w: 4 * Math.sqrt(3) * HEX_R_WORLD, h: 6 * HEX_R_WORLD };
function paintHex(x, w, h, colorFn, grout) {
  const r = h / 6;
  const hw = Math.sqrt(3) * r;
  x.fillStyle = grout;
  x.fillRect(0, 0, w, h);
  const g = rng(17);
  for (let row = -1; row <= 4; row++) {
    for (let col = -1; col <= 4; col++) {
      const cx = col * hw + (row % 2 ? hw / 2 : 0);
      const cy = row * r * 1.5 + r;
      for (const [ox, oy] of [[0, 0], [w, 0], [0, h], [w, h], [-w, 0], [0, -h]]) {
        x.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (Math.PI / 3) * k + Math.PI / 6;
          const px = cx + ox + Math.cos(a) * r * 0.91, py = cy + oy + Math.sin(a) * r * 0.91;
          k ? x.lineTo(px, py) : x.moveTo(px, py);
        }
        x.closePath();
        x.fillStyle = colorFn(g, cx, cy);
        x.fill();
      }
    }
  }
  // speckle
  for (let i = 0; i < w * h * 0.02; i++) {
    x.fillStyle = `rgba(${g() < 0.5 ? "0,0,0" : "255,240,220"},${0.05 + g() * 0.07})`;
    x.fillRect(g() * w, g() * h, 1.5, 1.5);
  }
}
const hexCache = {};
export function hexTextures(variant = "red") {
  if (hexCache[variant]) return hexCache[variant];
  const W = 512, H = Math.round((512 / (4 * Math.sqrt(3))) * 6);
  const colorFn = variant === "red"
    ? (g) => `rgb(${150 + g() * 30},${58 + g() * 16},${40 + g() * 10})`
    : (g) => `rgb(${200 + g() * 20},${196 + g() * 18},${186 + g() * 16})`;
  const grout = variant === "red" ? "#4a231a" : "#8a8478";
  const map = canvasTex(W, H, (x) => paintHex(x, W, H, colorFn, grout), { repeat: [1, 1] });
  const bump = canvasTex(W, H, (x) => paintHex(x, W, H, () => "#fff", "#000"), { repeat: [1, 1], linear: true });
  return (hexCache[variant] = { map, bump });
}
export function hexFloor(w, d, o = {}) {
  const { map, bump } = hexTextures(o.variant || "red");
  const m = map.clone(), b = bump.clone();
  m.repeat.set(w / HEX_TILE.w, d / HEX_TILE.h);
  b.repeat.copy(m.repeat);
  m.needsUpdate = b.needsUpdate = true;
  const mat = new THREE.MeshStandardMaterial({ map: m, bumpMap: b, bumpScale: 1.2, roughness: o.roughness ?? 0.55, metalness: 0, color: o.color || 0xffffff });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  return mesh;
}

export const noiseTex = (() => {
  let t = null;
  return () => {
    if (t) return t;
    t = canvasTex(256, 256, (x, w, h) => {
      const img = x.createImageData(w, h);
      const g = rng(5);
      for (let i = 0; i < w * h; i++) {
        const v = 222 + g() * 33;
        img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      for (let i = 0; i < 40; i++) {
        const cx = g() * w, cy = g() * h, r = 20 + g() * 50;
        const gr = x.createRadialGradient(cx, cy, 0, cx, cy, r);
        gr.addColorStop(0, `rgba(0,0,0,${0.025 + g() * 0.03})`);
        gr.addColorStop(1, "rgba(0,0,0,0)");
        x.fillStyle = gr;
        x.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
    }, { repeat: [1, 1] });
    return t;
  };
})();
export function concrete(color = 0xd8c8ad, o = {}) {
  const map = noiseTex().clone();
  map.repeat.set(o.repeat || 2, o.repeat || 2);
  map.needsUpdate = true;
  return new THREE.MeshStandardMaterial({ color, map, roughness: o.roughness ?? 0.88, metalness: 0, vertexColors: !!o.vertexColors, side: o.side || THREE.FrontSide });
}
export function granite(color = 0xc4bab0) {
  const map = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = "#c9c0b6";
    x.fillRect(0, 0, w, h);
    const g = rng(9);
    for (let i = 0; i < 5000; i++) {
      const c = g();
      x.fillStyle = c < 0.3 ? "#6f6760" : c < 0.6 ? "#e8e2da" : c < 0.75 ? "#a88f86" : "#3b3633";
      x.fillRect(g() * w, g() * h, 1 + g() * 2, 1 + g() * 2);
    }
  }, { repeat: [1, 1] });
  return new THREE.MeshStandardMaterial({ color, map, roughness: 0.45, metalness: 0.05 });
}
export const bronze = () => new THREE.MeshStandardMaterial({ color: 0x5a4434, roughness: 0.42, metalness: 0.55 });
export const steel = () => new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.28, metalness: 0.9 });
export const glow = (color, intensity = 2) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(color), emissiveIntensity: intensity });

export function textTexture(text, o = {}) {
  return texFrom(AQ.textCanvas(text, o));
}
export function signPlane(text, w, h, o = {}) {
  const tex = textTexture(text, Object.assign({ h: 96, w: Math.round((96 * w) / h) }, o));
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, emissive: o.emissive ? 0xffffff : 0x000000, emissiveMap: o.emissive ? tex : null, emissiveIntensity: o.emissive || 0 });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

// ---------- the waffle vault ----------
// real recessed coffers; ambient occlusion baked into vertex colors so the recesses read
// even under flat light. axis 'z' runs away from the camera, 'x' runs across.
export function cofferVault(o) {
  const pos = [], col = [], uv = [];
  const n = o.n, R = o.R, d = o.depth ?? 0.5, m = o.margin ?? 0.14;
  const [t0, t1] = o.th || [0, Math.PI];
  const [a0, a1] = o.along;
  const L = o.len;
  const [cx, cy, cz] = o.c;
  const P = (th, a, r) => (o.axis === "z"
    ? new THREE.Vector3(cx + Math.cos(th) * r, cy + Math.sin(th) * r, a)
    : new THREE.Vector3(a, cy + Math.sin(th) * r, cz + Math.cos(th) * r));
  const axisPt = (p) => (o.axis === "z" ? new THREE.Vector3(cx, cy, p.z) : new THREE.Vector3(p.x, cy, cz));
  const tri = (A, B, C, ca, cb, cc, ref) => {
    const nrm = new THREE.Vector3().subVectors(B, A).cross(new THREE.Vector3().subVectors(C, A));
    const cen = new THREE.Vector3().add(A).add(B).add(C).multiplyScalar(1 / 3);
    if (nrm.dot(new THREE.Vector3().subVectors(ref, cen)) < 0) {
      [B, C] = [C, B];
      [cb, cc] = [cc, cb];
    }
    for (const [p, c] of [[A, ca], [B, cb], [C, cc]]) {
      pos.push(p.x, p.y, p.z);
      col.push(c, c, c);
      uv.push(p.x * 0.25 + p.z * 0.25, p.y * 0.25);
    }
  };
  const quad = (A, B, C, D, cA, cB, cC, cD, ref) => {
    tri(A, B, C, cA, cB, cC, ref);
    tri(A, C, D, cA, cC, cD, ref);
  };
  const count = Math.round((a1 - a0) / L);
  for (let i = 0; i < n; i++) {
    const th0 = t0 + ((t1 - t0) * i) / n, th1 = t0 + ((t1 - t0) * (i + 1)) / n;
    const dth = (th1 - th0) * m;
    for (let j = 0; j < count; j++) {
      const z0 = a0 + j * L, z1 = z0 + L, dz = L * m;
      const mid = P((th0 + th1) / 2, (z0 + z1) / 2, R);
      if (o.skip && o.skip(mid)) continue;
      const ax = axisPt(mid);
      const O = [P(th0, z0, R), P(th1, z0, R), P(th1, z1, R), P(th0, z1, R)];
      const I = [P(th0 + dth, z0 + dz, R), P(th1 - dth, z0 + dz, R), P(th1 - dth, z1 - dz, R), P(th0 + dth, z1 - dz, R)];
      const i2 = dth * 2.1, z2 = dz * 2.1;
      const F = [P(th0 + i2, z0 + z2, R + d), P(th1 - i2, z0 + z2, R + d), P(th1 - i2, z1 - z2, R + d), P(th0 + i2, z1 - z2, R + d)];
      for (let k = 0; k < 4; k++) {
        const k2 = (k + 1) % 4;
        quad(O[k], O[k2], I[k2], I[k], 1, 1, 0.97, 0.97, ax);
      }
      const fc = new THREE.Vector3().add(F[0]).add(F[2]).multiplyScalar(0.5);
      const inward = fc.clone().lerp(ax, 0.08);
      for (let k = 0; k < 4; k++) {
        const k2 = (k + 1) % 4;
        quad(I[k], I[k2], F[k2], F[k], 0.9, 0.9, 0.56, 0.56, inward);
      }
      quad(F[0], F[1], F[2], F[3], 0.6, 0.6, 0.6, 0.6, ax);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, o.material || concrete(o.color || 0xd9c9ae, { vertexColors: true }));
  mesh.receiveShadow = true;
  return mesh;
}

// ---------- water ----------
const WaterShader = {
  name: "AquaWater",
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    time: { value: 0 },
    deep: { value: new THREE.Color(0x0b3a40) },
    strength: { value: 1 },
    reflectivity: { value: 0.85 },
    ripples: { value: [new THREE.Vector4(0, 0, -99, 0), new THREE.Vector4(0, 0, -99, 0), new THREE.Vector4(0, 0, -99, 0), new THREE.Vector4(0, 0, -99, 0), new THREE.Vector4(0, 0, -99, 0), new THREE.Vector4(0, 0, -99, 0)] },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vWorld;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      #include <logdepthbuf_vertex>
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    uniform vec3 deep;
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float strength;
    uniform float reflectivity;
    uniform vec4 ripples[6];
    varying vec4 vUv;
    varying vec3 vWorld;
    #include <logdepthbuf_pars_fragment>
    void main() {
      #include <logdepthbuf_fragment>
      vec2 p = vWorld.xz;
      vec2 d = vec2(
        sin(p.y * 1.7 + time * 1.3) + 0.6 * sin(p.x * 2.3 - time * 1.1) + 0.3 * sin((p.x + p.y) * 5.1 + time * 2.7),
        cos(p.x * 1.9 + time * 1.6) + 0.5 * cos(p.y * 2.7 + time * 0.9) + 0.3 * cos((p.x - p.y) * 4.3 - time * 2.2)
      ) * 0.010 * strength;
      float ring = 0.0;
      for (int i = 0; i < 6; i++) {
        float age = time - ripples[i].z;
        if (age > 0.0 && age < 3.5) {
          vec2 dv = p - ripples[i].xy;
          float r = length(dv);
          float front = r - age * 1.6;
          float w = sin(front * 18.0) * exp(-abs(front) * 4.0) * exp(-age * 1.1) * ripples[i].w;
          d += normalize(dv + 1e-4) * w * 0.035;
          ring += w;
        }
      }
      vec4 uv = vUv;
      uv.xy += d * uv.w * 2.2;
      vec3 refl = texture2DProj(tDiffuse, uv).rgb;
      vec3 V = normalize(cameraPosition - vWorld);
      float fres = 0.18 + 0.82 * pow(1.0 - clamp(V.y, 0.0, 1.0), 2.5);
      vec3 col = mix(deep, refl * color, clamp(fres * reflectivity + 0.25, 0.0, 1.0));
      col += vec3(0.7, 1.0, 0.95) * max(ring, 0.0) * 0.18;
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};
export function water(w, d, o = {}) {
  const scale = o.res || 0.5;
  const mesh = new Reflector(new THREE.PlaneGeometry(w, d), {
    shader: WaterShader,
    textureWidth: Math.round(window.innerWidth * scale),
    textureHeight: Math.round(window.innerHeight * scale),
    color: o.color || 0xc8e6e2,
    clipBias: 0.003,
    multisample: 2,
  });
  mesh.rotation.x = -Math.PI / 2;
  const u = mesh.material.uniforms;
  if (o.deep) u.deep.value = new THREE.Color(o.deep);
  if (o.reflectivity != null) u.reflectivity.value = o.reflectivity;
  if (o.strength != null) u.strength.value = o.strength;
  let next = 0;
  mesh.userData.ripple = (x, z, s = 1) => {
    u.ripples.value[next].set(x, z, u.time.value, s);
    next = (next + 1) % 6;
  };
  mesh.userData.tick = (t) => (u.time.value = t);
  return mesh;
}

// ---------- particles ----------
const dotTex = canvasTex(64, 64, (x) => {
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.7)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
});
// a fountain: particles launched from an emitter, falling under gravity, recycled
export class Spray {
  constructor(o) {
    this.o = Object.assign({ count: 1200, rate: 500, speed: 3, spread: 0.3, gravity: 9.8, life: 1.6, size: 0.06, floorY: 0, color: 0xeaffff, radius: 0.05, opacity: 0.8, dir: new THREE.Vector3(0, 1, 0) }, o);
    const N = this.o.count;
    this.p = new Float32Array(N * 3);
    this.v = new Float32Array(N * 3);
    this.age = new Float32Array(N).fill(1e9);
    this.alpha = new Float32Array(N);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.p, 3));
    g.setAttribute("alpha", new THREE.BufferAttribute(this.alpha, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: dotTex }, color: { value: new THREE.Color(this.o.color) }, size: { value: this.o.size }, scale: { value: 600 } },
      vertexShader: `attribute float alpha; varying float vA; uniform float size; uniform float scale;
        void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; uniform vec3 color; varying float vA;
        void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(color, t.a * vA); }`,
      transparent: true,
      depthWrite: false,
      blending: this.o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.i = 0;
    this.acc = 0;
    this.boost = 0;
  }
  emit(n) {
    const o = this.o;
    const N = o.count;
    const up = o.dir;
    for (let k = 0; k < n; k++) {
      const i = this.i;
      this.i = (this.i + 1) % N;
      const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * o.radius;
      const ox = o.ring ? Math.cos(a) * o.ring : Math.cos(a) * rr;
      const oz = o.ring ? Math.sin(a) * o.ring : Math.sin(a) * rr;
      this.p[i * 3] = o.at.x + ox;
      this.p[i * 3 + 1] = o.at.y;
      this.p[i * 3 + 2] = o.at.z + oz;
      const sp = o.speed * (0.75 + Math.random() * 0.4) * (1 + this.boost * 0.4);
      const sx = (Math.random() - 0.5) * o.spread, sz = (Math.random() - 0.5) * o.spread;
      if (o.ring) {
        this.v[i * 3] = Math.cos(a) * sp * 0.4 + sx;
        this.v[i * 3 + 1] = up.y * sp * 0.2;
        this.v[i * 3 + 2] = Math.sin(a) * sp * 0.4 + sz;
      } else {
        this.v[i * 3] = up.x * sp + sx * sp;
        this.v[i * 3 + 1] = up.y * sp;
        this.v[i * 3 + 2] = up.z * sp + sz * sp;
      }
      this.age[i] = 0;
    }
  }
  update(dt) {
    const o = this.o;
    this.boost = Math.max(0, this.boost - dt);
    this.acc += dt * o.rate * (1 + this.boost);
    const n = Math.floor(this.acc);
    this.acc -= n;
    this.emit(n);
    for (let i = 0; i < o.count; i++) {
      if (this.age[i] > o.life) { this.alpha[i] = 0; continue; }
      this.age[i] += dt;
      this.v[i * 3 + 1] -= o.gravity * dt;
      this.p[i * 3] += this.v[i * 3] * dt;
      this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt;
      this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      if (this.p[i * 3 + 1] < o.floorY) { this.age[i] = 1e9; this.alpha[i] = 0; continue; }
      this.alpha[i] = o.opacity * (1 - this.age[i] / o.life);
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.alpha.needsUpdate = true;
  }
}

// ---------- low-poly props (flat shaded, very 1999) ----------
export function rock(r = 1, seed = 1, color = 0x6c6762) {
  const g = new THREE.IcosahedronGeometry(r, 1);
  const p = g.attributes.position;
  const R = rng(seed);
  const seen = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!seen.has(key)) seen.set(key, 0.75 + R() * 0.45);
    const k = seen.get(key);
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.7, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true }));
  m.castShadow = m.receiveShadow = true;
  return m;
}
export function bush(w, h, seed = 1, color = 0x2f5e2a) {
  const grp = new THREE.Group();
  const R = rng(seed);
  const mats = [0.8, 1, 1.2].map((k) => new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(k), roughness: 0.9, flatShading: true }));
  const n = Math.round(6 + w * h * 3);
  for (let i = 0; i < n; i++) {
    const s = 0.25 + R() * 0.35 * Math.min(w, h);
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), mats[Math.floor(R() * 3)]);
    const a = R() * Math.PI * 2, dd = Math.sqrt(R());
    b.position.set(Math.cos(a) * dd * w * 0.45, s * 0.6 + R() * h * 0.7, Math.sin(a) * dd * w * 0.3);
    b.rotation.set(R() * 3, R() * 3, R() * 3);
    b.castShadow = b.receiveShadow = true;
    grp.add(b);
  }
  return grp;
}
export function duck() {
  const grp = new THREE.Group();
  const fs = (c, r = 0.7) => new THREE.MeshStandardMaterial({ color: c, roughness: r, flatShading: true });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), fs(0x6e5b47));
  body.scale.set(1.6, 0.75, 0.9);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), fs(0xe6dfd2));
  belly.scale.set(1.4, 0.55, 0.85);
  belly.position.set(-0.03, -0.04, 0);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 5), fs(0x3f3428));
  tail.rotation.z = Math.PI / 2 + 0.5;
  tail.position.set(-0.32, 0.05, 0);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.12, 6), fs(0xe9e3d6));
  neck.position.set(0.24, 0.12, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.095, 8, 6), fs(0x1f6b3a, 0.35));
  head.position.set(0.27, 0.23, 0);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 5), fs(0xe7b42a));
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.39, 0.21, 0);
  const wing = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), fs(0x3b4a7a, 0.4));
  wing.scale.set(1.4, 0.4, 0.3);
  wing.position.set(-0.02, 0.06, 0.15);
  const wing2 = wing.clone();
  wing2.position.z = -0.15;
  grp.add(body, belly, tail, neck, head, beak, wing, wing2);
  grp.traverse((o) => (o.castShadow = true));
  return grp;
}
export function pigeon() {
  const grp = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x8a8d96, roughness: 0.7, flatShading: true, side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), mat);
  body.scale.set(1.8, 0.8, 0.8);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), new THREE.MeshStandardMaterial({ color: 0x4f5a6a, flatShading: true }));
  head.position.set(0.22, 0.05, 0);
  grp.add(body, head);
  const wingG = new THREE.BufferGeometry();
  wingG.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0.15, 0, 0.45, -0.12, 0, 0.4, 0.15, 0, 0, -0.12, 0, 0.4, -0.12, 0, 0], 3));
  wingG.computeVertexNormals();
  const wl = new THREE.Mesh(wingG, mat), wr = new THREE.Mesh(wingG, mat);
  wr.scale.z = -1;
  grp.add(wl, wr);
  grp.userData.flap = (t) => {
    const a = Math.sin(t) * 0.9;
    wl.rotation.x = a;
    wr.rotation.x = -a;
  };
  return grp;
}
// a billboard-ish fern: three crossed planes of a painted frond canvas
const fernCache = {};
export function fern(size = 1, seed = 1, color = [40, 98, 54]) {
  const key = seed + color.join();
  if (!fernCache[key]) {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 512;
    AQ.fern(c.getContext("2d"), rng(seed), 256, 470, 330, color);
    fernCache[key] = texFrom(c);
  }
  const mat = new THREE.MeshStandardMaterial({ map: fernCache[key], alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 });
  const grp = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    pl.position.y = size * 0.42;
    pl.rotation.y = (i / 3) * Math.PI;
    pl.castShadow = true;
    grp.add(pl);
  }
  return grp;
}
// lathe-turned stone things: urns, fountains, bowls
export function lathe(profile, color = 0xa8784f, o = {}) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(r, y));
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, o.segments || 32), o.material || new THREE.MeshStandardMaterial({ color, roughness: o.roughness ?? 0.7, flatShading: !!o.flat, side: THREE.DoubleSide }));
  m.castShadow = m.receiveShadow = true;
  return m;
}

// cherry tree: merged branch cylinders + thousands of instanced blossoms
const blossomTex = canvasTex(64, 64, (x) => {
  x.translate(32, 32);
  for (let k = 0; k < 5; k++) {
    x.rotate((Math.PI * 2) / 5);
    x.fillStyle = k % 2 ? "#ffd6e6" : "#ffc2d8";
    x.beginPath();
    x.ellipse(0, -13, 9, 14, 0, 0, Math.PI * 2);
    x.fill();
  }
  x.fillStyle = "#d4527a";
  x.beginPath();
  x.arc(0, 0, 5, 0, Math.PI * 2);
  x.fill();
});
export function cherryTree(o = {}) {
  const R = rng(o.seed || 3);
  const geos = [];
  const tips = [];
  const up = new THREE.Vector3(0, 1, 0);
  const grow = (start, dir, len, rad, depth) => {
    const end = start.clone().addScaledVector(dir, len);
    const g = new THREE.CylinderGeometry(rad * 0.7, rad, len, 6, 1);
    g.translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
    g.applyQuaternion(q);
    g.translate(start.x, start.y, start.z);
    geos.push(g);
    if (depth <= 0 || len < 0.25) { tips.push(end); return; }
    const kids = 2 + (R() < 0.45 ? 1 : 0);
    for (let i = 0; i < kids; i++) {
      const nd = dir.clone().add(new THREE.Vector3((R() - 0.5) * 1.3, (R() - 0.2) * 0.8, (R() - 0.5) * 1.3)).normalize();
      grow(end, nd, len * (0.62 + R() * 0.2), rad * 0.62, depth - 1);
    }
    if (depth < 3) tips.push(start.clone().lerp(end, 0.6));
  };
  grow(new THREE.Vector3(0, 0, 0), (o.lean || new THREE.Vector3(0.2, 1, 0)).normalize(), o.trunk || 1.6, o.radius || 0.16, o.depth || 5);
  const wood = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({ color: 0x3b2621, roughness: 0.9, flatShading: true }));
  wood.castShadow = true;
  const per = o.perTip || 40;
  const inst = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.11, 0.11), new THREE.MeshStandardMaterial({ map: blossomTex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.7, emissive: 0x401020, emissiveIntensity: 0.25 }), tips.length * per);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3();
  let k = 0;
  for (const t of tips) {
    for (let i = 0; i < per; i++) {
      const p = t.clone().add(new THREE.Vector3((R() - 0.5) * 0.7, (R() - 0.5) * 0.45, (R() - 0.5) * 0.7));
      e.set(R() * 6, R() * 6, R() * 6);
      q.setFromEuler(e);
      const sc = 0.7 + R() * 0.7;
      s.set(sc, sc, sc);
      m4.compose(p, q, s);
      inst.setMatrixAt(k++, m4);
    }
  }
  inst.castShadow = true;
  const grp = new THREE.Group();
  grp.add(wood, inst);
  grp.userData.tips = tips;
  return grp;
}
export const petalTex = blossomTex;

// the bronze pylon, with stripes that can glow
export function pylon(o = {}) {
  const grp = new THREE.Group();
  const h = o.h || 4, w = o.w || 0.42;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), bronze());
  body.position.y = h / 2;
  body.castShadow = body.receiveShadow = true;
  grp.add(body);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.05, w + 0.04), bronze());
  cap.position.y = h + 0.02;
  grp.add(cap);
  const mTex = canvasTex(128, 128, (x) => {
    x.fillStyle = "#5a4434";
    x.fillRect(0, 0, 128, 128);
    x.fillStyle = "#f3efe6";
    x.font = 'bold 96px "Helvetica Neue", Helvetica, Arial, sans-serif';
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText("M", 64, 70);
  });
  for (const face of [1, -1]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, w * 0.9), new THREE.MeshStandardMaterial({ map: mTex, roughness: 0.5 }));
    m.position.set(0, h - w * 0.55, (face * w) / 2 + face * 0.002);
    if (face < 0) m.rotation.y = Math.PI;
    grp.add(m);
  }
  const stripes = [];
  LINE_ORDER.forEach((nm, i) => {
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(LINES[nm]).multiplyScalar(0.55), emissive: new THREE.Color(LINES[nm]), emissiveIntensity: o.lit ? 1.4 : 0, roughness: 0.4 });
    const s = new THREE.Mesh(new THREE.BoxGeometry(w * 0.76, 0.1, w + 0.012), mat);
    s.position.y = h - w * 1.25 - i * 0.14;
    grp.add(s);
    stripes.push(mat);
  });
  grp.userData.stripes = stripes;
  return grp;
}

export function globeLamp(h = 3.6) {
  const grp = new THREE.Group();
  const iron = new THREE.MeshStandardMaterial({ color: 0x1c2420, roughness: 0.5, metalness: 0.6 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, h, 8), iron);
  pole.position.y = h / 2;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.4, 8), iron);
  base.position.y = 0.2;
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), new THREE.MeshStandardMaterial({ color: 0xf4f1e8, emissive: 0xfff4d6, emissiveIntensity: 0.6, roughness: 0.2 }));
  globe.position.y = h + 0.3;
  const finial = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 8), iron);
  finial.position.y = h + 0.6;
  grp.add(pole, base, globe, finial);
  grp.traverse((o) => (o.castShadow = true));
  return grp;
}

export function at(obj, x, y, z) {
  obj.position.set(x, y, z);
  return obj;
}
export function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}
export function hitProxy(w, h, d, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
  m.position.set(x, y, z);
  return m;
}
export function glowSprite(color, size, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.set(size, size, 1);
  return s;
}
// a glowing tube along a curve, colored along its length
export function glowTube(curve, radius, colors, intensity = 3) {
  const g = new THREE.TubeGeometry(curve, 80, radius, 8, false);
  const c = new THREE.Color();
  const cols = [];
  const p = g.attributes.position;
  const segs = 80, rad = 9;
  for (let i = 0; i < p.count; i++) {
    const u = Math.floor(i / rad) / segs;
    const idx = Math.min(colors.length - 1, Math.floor(u * colors.length));
    c.set(colors[idx]);
    cols.push(c.r * intensity, c.g * intensity, c.b * intensity);
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
}
export { mergeGeometries };
