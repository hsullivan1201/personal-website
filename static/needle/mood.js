// The vibes desk. None of this touches the model; it shoves needles around and
// stops the presses. The real number is printed in the deck of every front page.

import { sfx } from './audio.js';

// The classics show up most.
const OVER = [
  "IT'S SO OVER", "IT'S SO OVER", "IT'S SO OVER", "IT'S JOEVER", "IT'S JOEVER", "IT'S SO JOEVER",
  "IT'S OVER", "WE'RE COOKED", "NOT LIKE THIS", "PAIN", "NGMI", "GG GO NEXT", "PACK IT UP",
  "LOG OFF", "IT'S OVER. IT'S SO OVER.", "COPIUM DEPLETED", "THE VIBES ARE OFF",
];
const BACK = [
  "WE'RE SO BACK", "WE'RE SO BACK", "WE'RE SO BACK", "WE ARE SO BACK", "WE'RE BACK",
  "IT'S SO BACK", "WE'RE SO BACK BABY", "WAGMI", "HOPIUM RESTORED", "NEVER DOUBTED",
  "LET THEM COOK", "BACK BACK BACK", "DOOMERS IN SHAMBLES", "VIBE SHIFT", "WE LIVE",
];
const JK = ['WAIT NO', "JK IT'S OVER", 'NEVERMIND', 'HOLD ON', 'UH OH'];
const KICKER = {
  over: ['BREAKING', 'DOOMPOST', 'LATE EDITION', 'VIBE CHECK: FAILED', 'COPE ALERT'],
  back: ['EXTRA EXTRA', 'HOPIUM ALERT', 'VIBE CHECK: PASSED', 'BREAKING', 'SPECIAL EDITION'],
};
const SUB = {
  over: ['Doomers vindicated.', 'Copium reserves: empty.', 'Refreshing will not help.', 'Touch grass immediately.', 'The vibes have left the building.', 'Somebody check on the guy at the big board.'],
  back: ['Hopium levels: critical (good).', 'Doomers in shambles.', 'The vibes are immaculate.', 'Never in doubt.', 'Uncork something.', "Say it with me: we're so back."],
};

// Never more than one cycle every 3 minutes, whatever triggers it.
const COOLDOWN_MS = 180000;
// Mean seconds between random cycles, on top of the cooldown ("constantly" is the cooldown itself).
const RATES = { off: 0, sometimes: 600, often: 240, unhinged: 180 };

const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class Mood {
  constructor({ overlay, kicker, head, deck, stamp, shakeEl, truth }) {
    Object.assign(this, { overlay, kicker, head, deck, stamp, shakeEl, truth });
    this.kind = 'calm';
    this.steps = [];
    this.stepEnds = 0;
    this.dir = 1;
    this.lastStart = -Infinity;
    this.nextRandom = performance.now() + 45000;
    this.listeners = [];
  }

  onChange(fn) { this.listeners.push(fn); }

  /** team: 'D' | 'R' | 'chaos'. "Over" pushes needles toward the other team. */
  teamDir(team) {
    if (team === 'D') return 1;
    if (team === 'R') return -1;
    return Math.random() < 0.5 ? 1 : -1;
  }

  episode(steps, settings, reason) {
    this.lastStart = performance.now(); // every cycle counts toward the cooldown, even a test one
    this.dir = this.teamDir(settings.team);
    this.lonerSign = undefined;
    this.steps = steps.map((s) => ({ ...s, reason }));
    this.advance(performance.now(), settings);
  }

  /** Real data moved: a shorter, honest freakout. */
  react(kind, reason, settings) {
    if (settings.moods === 'off') return;
    if (this.kind !== 'calm') return;
    if (performance.now() - this.lastStart < COOLDOWN_MS) return;
    this.episode([{ kind, ms: 2600, word: kind === 'over' ? pick(OVER) : pick(BACK) }], settings, reason);
  }

  advance(now, settings) {
    const s = this.steps.shift();
    if (!s) { this.set('calm'); return; }
    this.stepEnds = now + s.ms;
    this.set(s.kind, s.word, s.reason, settings);
  }

  set(kind, word, reason, settings) {
    const prev = this.kind;
    this.kind = kind;
    document.body.classList.toggle('mood-over', kind === 'over');
    document.body.classList.toggle('mood-back', kind === 'back');
    this.overlay.classList.remove('show', 'over', 'back');
    if (kind !== 'calm') {
      void this.overlay.offsetWidth; // restart the slam
      this.overlay.classList.add('show', kind);
      this.kicker.textContent = pick(KICKER[kind]);
      for (const span of this.head.children) span.textContent = word;
      this.head.classList.toggle('long', word.length > 12);
      this.stamp.textContent = kind === 'over' ? 'L' : 'W';
      // the meme line, then the real odds, always
      this.deck.textContent = (reason ? reason[0].toUpperCase() + reason.slice(1) + '. ' : '') + pick(SUB[kind]) + ' ' + this.truth();
      kind === 'over' ? sfx.over() : sfx.back();
      if (settings?.shake) this.shake();
    }
    if (prev !== kind) this.listeners.forEach((fn) => fn(kind));
  }

  tick(now, settings) {
    if (this.kind !== 'calm' && now >= this.stepEnds) this.advance(now, settings);
    const mean = RATES[settings.moods] || 0;
    if (!mean || !settings.team) { this.nextRandom = now + 8000; return; }
    if (this.kind === 'calm' && now >= this.nextRandom && now - this.lastStart >= COOLDOWN_MS) {
      const r = Math.random();
      if (r < 0.72) {
        this.episode([{ kind: 'over', ms: 3200, word: pick(OVER) }, { kind: 'back', ms: 2900, word: pick(BACK) }], settings);
      } else if (r < 0.9) {
        // false dawn
        this.episode([
          { kind: 'back', ms: 2000, word: pick(BACK) },
          { kind: 'over', ms: 2400, word: pick(JK) },
          { kind: 'back', ms: 2600, word: pick(BACK) },
        ], settings);
      } else {
        // all five stages, compressed
        this.episode([
          { kind: 'over', ms: 1800, word: pick(OVER) },
          { kind: 'back', ms: 1500, word: pick(BACK) },
          { kind: 'over', ms: 1500, word: pick(OVER) },
          { kind: 'back', ms: 2800, word: "OK WE'RE ACTUALLY SO BACK" },
        ], settings);
      }
      const wait = settings.moods === 'unhinged' ? COOLDOWN_MS : -Math.log(1 - Math.random()) * mean * 1000;
      this.nextRandom = now + Math.max(COOLDOWN_MS, wait);
    }
  }

  /**
   * Push on the shared national wobble, in sds (positive = toward the GOP).
   * Every race moves with it, so when it's over, it's over everywhere.
   */
  nationalZ(settings) {
    if (this.kind === 'calm') return 0;
    return this.dir * settings.intensity * (this.kind === 'over' ? 1.8 : -1.5);
  }

  /** D.C. has its own politics: a coin flip per episode. */
  lonerZ(settings) {
    if (this.kind === 'calm') return 0;
    if (this.lonerSign === undefined) this.lonerSign = Math.random() < 0.5 ? -1 : 1;
    return this.lonerSign * settings.intensity * 1.2;
  }

  shake() {
    this.shakeEl.classList.remove('shake');
    void this.shakeEl.offsetWidth;
    this.shakeEl.classList.add('shake');
  }

  /** A quick print hiccup, for race calls. */
  jolt(kind) {
    const cls = kind === 'over' ? 'jolt-over' : 'jolt-back';
    document.body.classList.remove('jolt-over', 'jolt-back');
    void document.body.offsetWidth;
    document.body.classList.add(cls);
    setTimeout(() => document.body.classList.remove(cls), 700);
  }
}
