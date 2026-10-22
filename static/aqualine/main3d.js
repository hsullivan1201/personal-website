/* aqua line 3d — renderer, camera flights, hotspots, hud. */
import * as THREE from "three";
import { EffectComposer } from "./vendor/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "./vendor/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "./vendor/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "./vendor/jsm/postprocessing/OutputPass.js";
import { RoomEnvironment } from "./vendor/jsm/environments/RoomEnvironment.js";
import foggy from "./scenes/foggy.js";
import waterfront from "./scenes/waterfront.js";
import metrocenter from "./scenes/metrocenter.js";
import potomac from "./scenes/potomac.js";
import tidalbasin from "./scenes/tidalbasin.js";

const AQ = window.AQ;
const A = AQ.audio;
const SCENES = [foggy, waterfront, metrocenter, potomac, tidalbasin];

const stage = document.getElementById("stage");
const canvas = document.getElementById("view");
const fadeEl = document.getElementById("fade");
const capEl = document.getElementById("caption");
const btn = document.getElementById("access");
const muteBtn = document.getElementById("mute");
const strip = document.getElementById("strip");
const loader = document.getElementById("loader");
const reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- renderer ----------
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
} catch (e) {
  location.replace("classic/");
  throw e;
}
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;
const camera = new THREE.PerspectiveCamera(55, 1.5, 0.05, 900);
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(new THREE.Scene(), camera);
const bloom = new UnrealBloomPass(new THREE.Vector2(600, 400), 0.6, 0.5, 0.85);
composer.addPass(renderPass);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const app = (AQ.app = {
  cur: -1,
  t: 0,
  busy: true,
  hover: null,
  flight: null,
  visited: new Set(),
  camera,
  renderer,
  pointer: new THREE.Vector2(),
});
try {
  JSON.parse(localStorage.getItem("aqualine-visited") || "[]").forEach((i) => app.visited.add(i));
} catch (e) {}

// ---------- sizing + adaptive resolution ----------
let pixelScale = Math.min(window.devicePixelRatio || 1, 1.5);
function fit() {
  const stripH = strip.offsetHeight || 0;
  let w = Math.min(window.innerWidth, (window.innerHeight - stripH - 8) * 1.5);
  w = Math.max(280, w);
  const h = w / 1.5;
  stage.style.width = w + "px";
  stage.style.height = h + "px";
  renderer.setPixelRatio(pixelScale);
  renderer.setSize(w, h, false);
  composer.setPixelRatio(pixelScale);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
let rt;
window.addEventListener("resize", () => {
  clearTimeout(rt);
  rt = setTimeout(fit, 120);
});
// if frames are slow, quietly drop resolution (phones, old laptops)
const perf = { acc: 0, n: 0 };
function adapt(dt) {
  perf.acc += dt;
  perf.n++;
  if (perf.acc > 2.5) {
    const avg = perf.acc / perf.n;
    perf.acc = perf.n = 0;
    if (avg > 0.034 && pixelScale > 0.6) {
      pixelScale = Math.max(0.6, pixelScale * 0.8);
      fit();
    }
  }
}

// ---------- camera: a base pose, plus a little mouse-look ----------
const pose = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 55 };
const look = { x: 0, y: 0, tx: 0, ty: 0 };
const UP = new THREE.Vector3(0, 1, 0);
function applyCamera(t) {
  look.x += (look.tx - look.x) * 0.05;
  look.y += (look.ty - look.y) * 0.05;
  camera.position.copy(pose.pos);
  camera.position.y += Math.sin(t * 0.6) * 0.012;
  const dir = new THREE.Vector3().subVectors(pose.look, pose.pos);
  const dist = dir.length();
  const right = new THREE.Vector3().crossVectors(dir, UP).normalize();
  const up2 = new THREE.Vector3().crossVectors(right, dir).normalize();
  const k = app.flight ? 0.3 : 1;
  const tgt = pose.look.clone().addScaledVector(right, look.x * dist * 0.07 * k).addScaledVector(up2, -look.y * dist * 0.045 * k);
  camera.lookAt(tgt);
  if (camera.fov !== pose.fov) {
    camera.fov = pose.fov;
    camera.updateProjectionMatrix();
  }
}
const vec = (a) => (a.isVector3 ? a.clone() : new THREE.Vector3(a[0], a[1], a[2]));

// ---------- hud ----------
app.canvasCursor = (c) => (canvas.style.cursor = c);
app.caption = (text) => {
  capEl.textContent = text || "";
  capEl.classList.toggle("on", !!text);
};
app.button = (show, label) => {
  if (label) btn.textContent = label;
  btn.classList.toggle("on", !!show);
  btn.tabIndex = show ? 0 : -1;
};
function buildStrip() {
  strip.innerHTML = '<div class="strip-line"></div>';
  SCENES.forEach((s, i) => {
    const b = document.createElement("button");
    b.className = "stop";
    b.innerHTML = `<span class="dot"></span><span class="nm">${s.name}</span>`;
    b.setAttribute("aria-label", `go to ${s.name}`);
    b.addEventListener("click", () => {
      if (app.busy || i === app.cur) return;
      if (!app.visited.has(i)) {
        A.reject();
        app.caption("you haven't ridden that far yet");
        return;
      }
      A.ui();
      app.go(i);
    });
    strip.appendChild(b);
  });
}
function updateStrip() {
  [...strip.querySelectorAll(".stop")].forEach((b, i) => {
    b.classList.toggle("here", i === app.cur);
    b.classList.toggle("seen", app.visited.has(i));
  });
}
function syncMute() {
  const m = A.isMuted();
  muteBtn.textContent = m ? "sound: off" : "sound: on";
  muteBtn.setAttribute("aria-pressed", m ? "false" : "true");
}
muteBtn.addEventListener("click", () => {
  A.start();
  A.setMuted(!A.isMuted());
  syncMute();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "m" || e.key === "M") muteBtn.click();
});
btn.addEventListener("click", () => {
  A.start();
  const s = SCENES[app.cur];
  if (!app.busy && s && s.onButton) s.onButton();
});
btn.addEventListener("mouseenter", () => A.ui());

// ---------- flights between stations ----------
// fly the camera along a path inside this station, fade, then arrive in the next one
app.fly = function (next, path, o = {}) {
  if (app.flight) return;
  app.busy = true;
  app.button(false);
  setHover(null);
  const dur = reduceMotion ? 0.6 : o.dur || 2.6;
  const ps = [pose.pos.clone(), ...path.map((p) => vec(p.pos))];
  const ls = [pose.look.clone(), ...path.map((p) => vec(p.look))];
  if (ps.length < 2) { ps.push(ps[0].clone()); ls.push(ls[0].clone()); }
  app.flight = {
    t: 0, dur, next,
    pc: new THREE.CatmullRomCurve3(ps, false, "centripetal"),
    lc: new THREE.CatmullRomCurve3(ls, false, "centripetal"),
    fadeFrom: o.fadeFrom ?? 0.62,
    ease: o.ease || "inOut",
  };
  if (!reduceMotion && o.whoosh !== false) A.whoosh(dur * 0.95);
};
app.go = function (next) {
  app.fly(next, [], { dur: 0.7, fadeFrom: 0, whoosh: false });
};
let arrival = null;
// test hook: jump to the end of an arrival (software-rendered screenshots run at ~1fps)
app.settle = () => { if (arrival) arrival.t = arrival.dur; };
function enter(idx) {
  const prev = SCENES[app.cur];
  if (prev && prev.exit) prev.exit();
  app.cur = idx;
  app.visited.add(idx);
  try { localStorage.setItem("aqualine-visited", JSON.stringify([...app.visited])); } catch (e) {}
  const s = SCENES[idx];
  if (s.reset) s.reset();
  renderPass.scene = s.scene;
  bloom.strength = s.bloom?.strength ?? 0.6;
  bloom.radius = s.bloom?.radius ?? 0.5;
  bloom.threshold = s.bloom?.threshold ?? 0.85;
  renderer.toneMappingExposure = s.exposure ?? 1;
  A.setScene(s.ambience || "vault");
  const from = s.arrive || s.pose;
  pose.pos.copy(vec(from.pos));
  pose.look.copy(vec(from.look));
  pose.fov = s.pose.fov || 55;
  arrival = { t: 0, dur: reduceMotion ? 0.01 : s.arriveDur || 1.8, fromP: vec(from.pos), fromL: vec(from.look), toP: vec(s.pose.pos), toL: vec(s.pose.look) };
  if (s.enter) s.enter();
  updateStrip();
  document.title = `aqua line — ${s.name.toLowerCase()}`;
}

// ---------- hotspots ----------
const ray = new THREE.Raycaster();
function hitTest(px, py) {
  const s = SCENES[app.cur];
  if (!s || !s.hotspots) return null;
  app.pointer.set(px * 2 - 1, -(py * 2 - 1));
  ray.setFromCamera(app.pointer, camera);
  let best = null;
  for (const h of s.hotspots()) {
    if (h.active && !h.active()) continue;
    if (h.screen) {
      if (h.screen(px, py)) return { h, hit: null };
      continue;
    }
    const hits = ray.intersectObjects(h.objects, true);
    if (hits.length && (!best || hits[0].distance < best.hit.distance)) best = { h, hit: hits[0] };
  }
  return best;
}
function setHover(h) {
  if (app.hover === h || (h && app.hover && h.id === app.hover.id)) {
    app.hover = h;
    return;
  }
  if (app.hover && app.hover.leave) app.hover.leave();
  app.hover = h;
  if (h && h.enter) h.enter();
  canvas.style.cursor = h ? h.cursor || "pointer" : "default";
  app.caption(h ? h.caption : "");
}
const rel = (e) => {
  const r = canvas.getBoundingClientRect();
  return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
};
canvas.addEventListener("pointermove", (e) => {
  const [px, py] = rel(e);
  look.tx = (px - 0.5) * 2;
  look.ty = (py - 0.5) * 2;
  if (app.busy) return;
  const r = hitTest(px, py);
  setHover(r ? r.h : null);
  if (r && r.h.move) r.h.move(r.hit);
});
canvas.addEventListener("pointerleave", () => {
  look.tx = look.ty = 0;
  setHover(null);
});
canvas.addEventListener("pointerdown", (e) => {
  A.start();
  if (app.busy) return;
  const [px, py] = rel(e);
  const r = hitTest(px, py);
  if (!r) return;
  if (e.pointerType !== "mouse") setHover(r.h);
  if (r.h.click) r.h.click(r.hit);
});

// ---------- loop ----------
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(0.05, clock.getDelta()) * (app.dtScale || 1);
  app.t += dt;
  const s = SCENES[app.cur];
  if (app.flight) {
    const f = app.flight;
    f.t += dt;
    const k = Math.min(1, f.t / f.dur);
    const e = f.ease === "in" ? k * k * k : AQ.ease.inOut(k);
    f.pc.getPoint(e, pose.pos);
    f.lc.getPoint(e, pose.look);
    fadeEl.style.opacity = f.fadeFrom >= 1 ? 0 : AQ.clamp((k - f.fadeFrom) / (1 - f.fadeFrom), 0, 1);
    if (k >= 1) {
      app.flight = null;
      enter(f.next);
    }
  } else if (arrival) {
    arrival.t += dt;
    const k = Math.min(1, arrival.t / arrival.dur);
    const e = AQ.ease.out(k);
    pose.pos.lerpVectors(arrival.fromP, arrival.toP, e);
    pose.look.lerpVectors(arrival.fromL, arrival.toL, e);
    fadeEl.style.opacity = 1 - AQ.clamp(k * 1.6, 0, 1);
    if (k >= 1) {
      arrival = null;
      fadeEl.style.opacity = 0;
      if (!s.holdInput) app.busy = false;
      if (s.afterIn) s.afterIn();
    }
  }
  if (s) {
    s.update(dt, app.t);
    applyCamera(app.t);
    composer.render();
  }
  adapt(dt);
  requestAnimationFrame(frame);
}

// ---------- boot ----------
function boot() {
  buildStrip();
  fit();
  const bar = document.getElementById("load-bar");
  let i = 0;
  const ctx = { THREE, renderer, envTex, camera };
  const next = () => {
    if (i < SCENES.length) {
      const s = SCENES[i];
      s.build(ctx);
      if (s.reset) s.reset();
      // warm the shaders so the first flight in doesn't stutter
      pose.pos.copy(vec(s.pose.pos));
      pose.look.copy(vec(s.pose.look));
      applyCamera(0);
      renderPass.scene = s.scene;
      try { composer.render(); } catch (e) { console.error(e); }
      i++;
      bar.style.width = `${(i / SCENES.length) * 100}%`;
      setTimeout(next, 20);
    } else {
      loader.classList.add("ready");
      document.getElementById("enter").focus({ preventScroll: true });
    }
  };
  setTimeout(next, 30);
  const start = (sound) => {
    if (!loader.classList.contains("ready")) return;
    if (!sound) A.setMuted(true);
    A.start();
    syncMute();
    loader.classList.add("gone");
    setTimeout(() => loader.remove(), 900);
    fadeEl.style.opacity = 1;
    enter(0);
    clock.getDelta();
    requestAnimationFrame(frame);
  };
  document.getElementById("enter").addEventListener("click", () => start(true));
  document.getElementById("enter-quiet").addEventListener("click", () => start(false));
  syncMute();
}
boot();
