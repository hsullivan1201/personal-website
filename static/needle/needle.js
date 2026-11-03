// A dial printed in halftone, and a needle with opinions about physics.
// Position is q = chance the RIGHT side wins (GOP / "No"), 0..1. Where it is
// headed comes from wobble.js; this file is the spring, the pins and the ink.
// When the needle moves fast its cyan and magenta plates fall out of register.

const NS = 'http://www.w3.org/2000/svg';
const CX = 100, CY = 100;

// [from, to, density, side] in q. Density 0..3.
const BANDS = [
  [0.00, 0.05, 3, 'L'], [0.05, 0.15, 2, 'L'], [0.15, 0.35, 1, 'L'],
  [0.35, 0.65, 0, 'M'],
  [0.65, 0.85, 1, 'R'], [0.85, 0.95, 2, 'R'], [0.95, 1.00, 3, 'R'],
];
const BAND_LABELS = ['', 'LIKELY', 'LEANS', 'TOSSUP', 'LEANS', 'LIKELY', ''];

export const INKS = { DEM: '#1f4f9e', GOP: '#cc2f27', IND: '#6b4a9c', YES: '#3d7a3a', NO: '#a86a1c' };
const DOT_R = [0.5, 0.78, 1.08, 1.5];

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

// One shared set of halftone screens for every dial on the page.
let screensMade = false;
function makeScreens() {
  if (screensMade) return;
  screensMade = true;
  const svg = el('svg', { width: 0, height: 0, style: 'position:absolute', 'aria-hidden': 'true' });
  const defs = el('defs', {}, svg);
  const screen = (id, color, r) => {
    const p = el('pattern', { id, width: 3.2, height: 3.2, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    el('circle', { cx: 1.6, cy: 1.6, r, fill: color }, p);
  };
  for (const [name, color] of Object.entries(INKS)) {
    for (let d = 1; d <= 3; d++) screen(`ht-${name}-${d}`, color, DOT_R[d]);
  }
  screen('ht-paper', 'rgba(20,18,15,0.22)', DOT_R[0]);
  document.body.appendChild(svg);
}

function pt(q, r) {
  const a = Math.PI * (1 - q);
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)];
}

function arc(q1, q2, r1, r2) {
  const [x1, y1] = pt(q1, r2), [x2, y2] = pt(q2, r2);
  const [x3, y3] = pt(q2, r1), [x4, y4] = pt(q1, r1);
  return `M${x1},${y1} A${r2},${r2} 0 0 1 ${x2},${y2} L${x3},${y3} A${r1},${r1} 0 0 0 ${x4},${y4} Z`;
}

export class Needle {
  constructor(host, { big = false, left = 'DEM', right = 'GOP' } = {}) {
    makeScreens();
    this.big = big;
    this.svg = el('svg', { viewBox: big ? '-4 -6 208 118' : '2 4 196 104', class: 'needle-svg' + (big ? ' big' : '') });
    host.appendChild(this.svg);
    this.bandGroup = el('g', {}, this.svg);
    this.setSides(left, right);

    const ticks = el('g', { class: 'ticks' }, this.svg);
    for (let i = 0; i <= 20; i++) {
      const q = i / 20, major = i % 5 === 0;
      const [x1, y1] = pt(q, 90), [x2, y2] = pt(q, major ? 97 : 93.5);
      el('line', { x1, y1, x2, y2, class: major ? 'tick major' : 'tick' }, ticks);
    }
    el('path', { d: `M${CX - 90},${CY} A90,90 0 0 1 ${CX + 90},${CY}`, class: 'rim' }, this.svg);
    if (big) {
      BANDS.forEach(([a, b], i) => {
        if (!BAND_LABELS[i]) return;
        const mid = (a + b) / 2;
        const [x, y] = pt(mid, 66);
        const t = el('text', { x, y, class: 'band-label', 'text-anchor': 'middle' }, this.svg);
        t.setAttribute('transform', `rotate(${(mid - 0.5) * 180} ${x} ${y})`);
        t.textContent = BAND_LABELS[i];
      });
      for (const [q, label] of [[0.05, '95'], [0.25, '75'], [0.5, '50'], [0.75, '75'], [0.95, '95']]) {
        const [x, y] = pt(q, 103.5);
        const t = el('text', { x, y, class: 'pct-label', 'text-anchor': 'middle' }, this.svg);
        t.setAttribute('transform', `rotate(${(q - 0.5) * 180} ${x} ${y})`);
        t.textContent = label;
      }
    }

    // three plates: cyan and magenta ghosts lag behind the black
    const len = big ? 86 : 82;
    const shape = `${CX - 2.4},${CY + 6} ${CX},${CY - len} ${CX + 2.4},${CY + 6}`;
    this.plates = ['plate-c', 'plate-m', 'plate-k'].map((cls) => {
      const g = el('g', { class: 'arm ' + cls }, this.svg);
      el('polygon', { points: shape }, g);
      return g;
    });
    el('circle', { cx: CX, cy: CY, r: big ? 6.5 : 5.5, class: 'pivot' }, this.svg);
    el('circle', { cx: CX, cy: CY, r: big ? 2 : 1.6, class: 'pivot-dot' }, this.svg);

    this.q = 0.5; this.v = 0;
    this.ghost = [0.5, 0.5];
    this.p = 0.5; this.called = false;
    this.lastPeg = 0;
    this.onPeg = null;
    this.first = true;
  }

  setSides(left, right) {
    if (this.sides === `${left}/${right}`) return;
    this.sides = `${left}/${right}`;
    this.bandGroup.replaceChildren();
    el('path', { d: arc(0, 1, 40, 90), class: 'dial-back' }, this.bandGroup);
    for (const [a, b, d, side] of BANDS) {
      const ink = side === 'L' ? left : side === 'R' ? right : null;
      const fill = ink ? `url(#ht-${ink}-${d})` : 'url(#ht-paper)';
      el('path', { d: arc(a, b, 44, 90), fill, class: 'band' }, this.bandGroup);
    }
    el('path', { d: arc(0.5 - 0.0015, 0.5 + 0.0015, 44, 90), class: 'midline' }, this.bandGroup);
  }

  /** The model's chance the right side wins. */
  set(p, called) {
    this.p = p; this.called = called;
    if (this.first) { this.q = p; this.ghost = [p, p]; this.first = false; }
  }

  /** Spring toward `target` (from wobble.js; the model's p when nothing wobbles). */
  step(dt, now, s, target) {
    const speed = s.speed;
    if (this.called) target = this.p;

    const k = 70 * Math.max(0.3, speed);
    const zeta = 1.05 - 0.95 * s.bounce;
    const c = 2 * Math.sqrt(k) * zeta;
    this.v += (k * (target - this.q) - c * this.v) * dt;
    this.q += this.v * dt;

    // the pins at either end
    if (this.q > 1.012 || this.q < -0.012) {
      this.q = this.q > 0.5 ? 1.012 : -0.012;
      if (Math.abs(this.v) > 0.4 && now - this.lastPeg > 120) { this.lastPeg = now; this.onPeg?.(Math.abs(this.v)); }
      this.v = -this.v * 0.45;
    }

    // plates chase the black one; faster needle, worse registration
    const slip = s.misregister ? 1 : 0;
    this.ghost[0] += (this.q - this.ghost[0]) * Math.min(1, dt * (slip ? 9 : 60));
    this.ghost[1] += (this.q - this.ghost[1]) * Math.min(1, dt * (slip ? 16 : 60));
    this.render();
  }

  render() {
    const qs = [this.ghost[0], this.ghost[1], this.q];
    this.plates.forEach((g, i) => {
      g.setAttribute('transform', `rotate(${((qs[i] - 0.5) * 180).toFixed(2)} ${CX} ${CY})`);
    });
  }

  reading() {
    return Math.min(1, Math.max(0, this.q));
  }
}
