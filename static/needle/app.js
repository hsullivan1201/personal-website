import { Needle } from './needle.js';
import { Driver, Z_STEP, phi, invPhi } from './wobble.js';
import { Mood } from './mood.js';
import { setSound, sfx } from './audio.js';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const API = ($('meta[name="needle-api"]')?.content || '').replace(/\/$/, '');

// ---------- settings ----------

const PRESETS = {
  // the house setting
  house: { amount: 6, speed: 1.2, style: 'seismic', bounce: 0.2, moods: 'sometimes', intensity: 0.4, shake: true, misregister: true },
  sedated: { amount: 0, speed: 1, style: 'jitter', bounce: 0.1, moods: 'off', intensity: 0.5, shake: false, misregister: false },
  classic: { amount: 1, speed: 1, style: 'jitter', bounce: 0.2, moods: 'off', intensity: 0.6, shake: false, misregister: true },
  wobbly: { amount: 3, speed: 1.2, style: 'pendulum', bounce: 0.8, moods: 'sometimes', intensity: 0.7, shake: false, misregister: true },
  doomer: { amount: 2.5, speed: 1, style: 'jitter', bounce: 0.5, moods: 'often', intensity: 0.95, shake: true, misregister: true },
  schizo: { amount: 11, speed: 2.2, style: 'seismic', bounce: 0.93, moods: 'unhinged', intensity: 1, shake: true, misregister: true },
};
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DEFAULTS = { ...(reduced ? PRESETS.classic : PRESETS.house), lean: 0, team: 'D', sound: true, truth: true, sort: 'close', hideSafe: false };

function loadSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('needle-settings') || '{}') }; } catch { return { ...DEFAULTS }; }
}
const S = loadSettings();
function save() {
  try { localStorage.setItem('needle-settings', JSON.stringify(S)); } catch {}
}

// ---------- formatting ----------

const pct = (x, d = 0) => (100 * x).toFixed(d) + '%';
// Odds for a race nobody has called yet: never a flat 0 or 100.
const openPct = (x) => (x >= 0.995 ? '>99%' : x <= 0.005 ? '<1%' : pct(x));
// Same rule for Senate control, until the model itself says it's decided.
const ctlPct = (x) => (state && state.control.p_rep > 0 && state.control.p_rep < 1 ? openPct : pct)(x);
// "an 82%", "an 18%", "a 47%"
const aPct = (x) => { const n = Math.round(100 * x); return (n === 8 || n === 11 || n === 18 || (n >= 80 && n < 90) ? 'an ' : 'a ') + n + '%'; };
const lastName = (n) => (n || '?').replace(/\s+(Jr\.|Sr\.|II|III)$/, '').split(' ').pop();
const RATING = { 'solid-dem': 'Solid D', 'likely-dem': 'Likely D', 'lean-dem': 'Lean D', tossup: 'Toss-up', 'lean-rep': 'Lean R', 'likely-rep': 'Likely R', 'solid-rep': 'Solid R' };
const PARTY = { DEM: 'D', GOP: 'R', IND: 'I' };
const et = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });
const sideKey = (party) => (party === 'DEM' ? 'DEM' : 'IND');
const margin = (m) => (m >= 0 ? '+' : '−') + Math.abs(m).toFixed(1);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- state ----------

let state = null;
let history = [];
let runId = null;
let lastP = null;
const seenCalls = new Set();
let firstState = true;

const mainNeedle = new Needle($('#mainNeedle'), { big: true });
let foieNeedle = null;
let lastMeasure = null;
const cards = new Map();
// what the wobbling page currently shows, as opposed to what the model says
let shownRep = null, shownSeats = null, seatSd = 1;

const mood = new Mood({
  overlay: $('#mood'), kicker: $('#moodKicker'), head: $('#moodHead'), deck: $('#moodDeck'), stamp: $('#moodStamp'), shakeEl: $('#stage'),
  truth: () => state ? `The needle is being dramatic. The model puts Republican control at ${pct(state.control.p_rep, 1)}.` : '',
});
mood.onChange(() => { updateTitle(); updateMoodEar(); });
mainNeedle.onPeg = (v) => {
  sfx.clunk(v);
  if (S.shake) mood.shake();
};

// ---------- the lead story ----------

const priorName = () => (state?.prior_source ? 'the pre-election forecast' : 'the race ratings');

function headline(p, c) {
  const open = 100 - c.holdover_dem - c.holdover_rep - c.called_dem - c.called_rep - c.called_ind;
  // only the model gets to say it's decided; the wobble never does
  if (c.p_rep === 1 && open < 35) return 'Republicans Keep the Senate';
  if (c.p_rep === 0 && open < 35) return 'Democrats Take the Senate';
  if (p >= 0.95) return 'Republicans Will Very Likely Keep the Senate';
  if (p >= 0.75) return 'Republicans Are Favored to Keep the Senate';
  if (p >= 0.6) return 'Republicans Have the Edge for the Senate';
  if (p > 0.4) return 'The Senate Is a Toss-Up';
  if (p > 0.25) return 'Democrats Have the Edge for the Senate';
  if (p > 0.05) return 'Democrats Are Favored to Take the Senate';
  return 'Democrats Will Very Likely Take the Senate';
}

// The headline and dek read the wobbling needle, not the model, a few times a second.
function renderLead(shown, seats) {
  const c = state.control;
  const undecided = c.p_rep > 0 && c.p_rep < 1;
  const p = undecided ? Math.min(0.994, Math.max(0.006, shown)) : c.p_rep;
  const called = c.called_dem + c.called_rep + c.called_ind;
  const counting = state.races.filter((r) => r.votes_total > 0).length;
  const lead = p >= 0.5
    ? `Republicans have ${aPct(p)} chance of holding the chamber`
    : `Democrats and independents have ${aPct(1 - p)} chance of taking the chamber`;
  const progress = counting === 0
    ? `No votes are in yet, so this is ${priorName()} talking.`
    : `${counting} of 35 races are counting, ${called} called.`;
  setText('#hed', headline(p, c));
  setText('#dek', `${lead}, with about ${Math.round(seats)} Republican seats expected. ${progress}`);
}

function setText(sel, text, root = document) {
  const el = $(sel, root);
  if (el.textContent !== text) el.textContent = text;
}

function renderControl(c) {
  mainNeedle.set(c.p_rep, false);
  const dem = 1 - c.p_rep;
  // spread of the seat count, so the wobble knows what a seat is worth in odds
  const mean = c.rep_seat_dist.reduce((a, q, k) => a + k * q, 0);
  seatSd = Math.sqrt(Math.max(0, c.rep_seat_dist.reduce((a, q, k) => a + k * k * q, 0) - mean * mean));

  $('#tControl').textContent = pct(c.p_rep, 1);
  $('#tDem').textContent = pct(dem, 1);
  $('#tSeats').textContent = c.rep_seats_mean.toFixed(1);
  $('#tSeatRange').textContent = `${c.rep_seats_lo} to ${c.rep_seats_hi}`;
  $('#tKing').textContent = pct(c.p_kingmaker, 1);
  const sw = c.national_swing;
  $('#tSwingLabel').textContent = state?.prior_source ? 'National swing vs. forecast' : 'National swing vs. ratings';
  $('#tSwing').textContent = `${sw >= 0 ? 'D' : 'R'}+${Math.abs(sw).toFixed(1)} ± ${c.national_swing_sd.toFixed(1)}`;
  $('#tCalled').textContent = `D ${c.called_dem}, R ${c.called_rep}${c.called_ind ? `, I ${c.called_ind}` : ''}`;
  $('#tHold').textContent = `D ${c.holdover_dem}, R ${c.holdover_rep}`;
  renderSeats(c);
}

function renderSeats(c) {
  const open = 100 - c.holdover_dem - c.holdover_rep - c.called_dem - c.called_rep - c.called_ind;
  const segs = [
    ['hold-d', c.holdover_dem, `${c.holdover_dem} Democratic and independent seats not up`],
    ['call-d', c.called_dem + c.called_ind, 'called for Democrats and independents'],
    ['open', open, `${open} still out`],
    ['call-r', c.called_rep, 'called for Republicans'],
    ['hold-r', c.holdover_rep, `${c.holdover_rep} Republican seats not up`],
  ];
  $('#seatBar').replaceChildren(...segs.filter(([, n]) => n > 0).map(([cls, n, title]) => {
    const d = document.createElement('div');
    d.className = 'seg ' + cls; d.style.flexGrow = n; d.title = title;
    d.textContent = n >= 3 ? n : '';
    return d;
  }));

  const dist = c.rep_seat_dist;
  let lo = dist.findIndex((x) => x > 0.002), hi = dist.length - 1 - [...dist].reverse().findIndex((x) => x > 0.002);
  if (lo < 0) { lo = 45; hi = 55; }
  lo = Math.min(lo, 46); hi = Math.max(hi, 54);
  const max = Math.max(...dist.slice(lo, hi + 1), 0.01);
  $('#seatHist').replaceChildren(...Array.from({ length: hi - lo + 1 }, (_, i) => {
    const k = lo + i, b = document.createElement('div');
    b.className = 'hbar ' + (k >= 50 ? 'r' : 'd');
    b.style.height = (100 * dist[k] / max).toFixed(1) + '%';
    b.title = `${k} Republican seats: ${pct(dist[k], 1)}`;
    const lab = document.createElement('span');
    lab.textContent = k % 2 === 0 ? k : '';
    b.appendChild(lab);
    return b;
  }));
}

// ---------- race cards ----------

function makeCard(r) {
  const art = document.createElement('article');
  art.className = 'race-card';
  art.innerHTML = `
    <header><span class="nm"></span><span class="rating"></span></header>
    <div class="dial"></div>
    <div class="odds"><span class="ol"></span><span class="or"></span></div>
    <div class="cands">
      <div class="cand l"><span class="who"></span><span class="v"></span></div>
      <div class="cand r"><span class="who"></span><span class="v"></span></div>
    </div>
    <div class="meta"></div>
    <div class="more"></div>
    <div class="stamp"></div>`;
  const needle = new Needle($('.dial', art), { left: sideKey(r.chal.party) });
  art.addEventListener('click', () => art.classList.toggle('open'));
  $('#races').appendChild(art);
  const card = { el: art, needle, r, driver: new Driver(0.55 + Math.random() * 1.1) };
  cards.set(r.id, card);
  return card;
}

function nowForPolls() {
  return state?.sim_clock ? new Date(state.sim_clock) : new Date();
}

function renderRace(r) {
  const card = cards.get(r.id) || makeCard(r);
  card.r = r;
  const { el, needle } = card;
  needle.setSides(sideKey(r.chal.party), 'GOP');
  needle.set(1 - r.p_chal, !!r.called);
  el.classList.toggle('ind', r.chal.party !== 'DEM');

  $('.nm', el).textContent = r.special ? `${r.state_name} (special)` : r.state_name;
  $('.rating', el).textContent = RATING[r.rating] || '';
  const L = $('.cand.l', el), R = $('.cand.r', el);
  $('.who', L).textContent = `${lastName(r.chal.name)}${r.chal.incumbent ? '*' : ''} (${PARTY[r.chal.party] || r.chal.party[0]})`;
  $('.who', R).textContent = `${lastName(r.rep.name)}${r.rep.incumbent ? '*' : ''} (R)`;
  const counting = r.votes_total > 0;
  $('.v', L).textContent = counting ? r.chal.pct.toFixed(1) + '%' : '';
  $('.v', R).textContent = counting ? r.rep.pct.toFixed(1) + '%' : '';

  const leader = r.est_margin >= 0 ? lastName(r.chal.name) : lastName(r.rep.name);
  const closes = r.poll_close ? new Date(r.poll_close) : null;
  let meta;
  if (r.called) meta = `${Math.round(r.eevp)}% in`;
  else if (counting) meta = `${Math.round(r.eevp)}% in · model: ${leader} ${margin(Math.abs(r.est_margin))}`;
  else if (closes && closes > nowForPolls()) meta = `Polls close ${et.format(closes)} ET`;
  else meta = 'Polls closed, waiting on votes';
  $('.meta', el).textContent = meta;
  $('.more', el).innerHTML = `
    <div>Votes: ${Math.round(r.chal.votes).toLocaleString()} to ${Math.round(r.rep.votes).toLocaleString()}${r.other_pct > 0.5 ? `, others ${r.other_pct.toFixed(1)}%` : ''}</div>
    <div>Estimated final: ${esc(lastName(r.chal.name))} ${margin(r.est_margin)} <span class="dim">(80% range ${margin(r.margin_lo)} to ${margin(r.margin_hi)})</span></div>
    <div>${r.units_reporting} of ${r.units_total || 1} areas reporting${r.rcv ? ', ranked-choice count' : ''}</div>
    ${counting ? '' : `<div class="dim">No votes yet. Odds come from ${esc(priorName())}.</div>`}`;

  if (r.called) {
    const w = r.called === r.chal.id ? r.chal : r.rep;
    $('.stamp', el).textContent = `Called: ${lastName(w.name)}`;
    el.classList.add('called');
    el.classList.toggle('called-l', w === r.chal);
  } else {
    el.classList.remove('called', 'called-l');
  }
  el.classList.toggle('snooze', !r.called && (r.p_chal < 0.03 || r.p_chal > 0.97));
}

function sortCards() {
  const list = [...cards.values()];
  const closeness = (c) => (c.r.called ? 10 : 0) + Math.abs(c.r.p_chal - 0.5);
  const key = {
    close: closeness,
    polls: (c) => (c.r.poll_close ? new Date(c.r.poll_close).getTime() / 1e12 : 9) + closeness(c) / 1e3,
    az: (c) => c.r.state_name,
  }[S.sort] || closeness;
  list.sort((a, b) => { const x = key(a), y = key(b); return x < y ? -1 : x > y ? 1 : 0; });
  const host = $('#races');
  list.forEach((c, i) => { if (host.children[i] !== c.el) host.insertBefore(c.el, host.children[i] || null); });
  host.classList.toggle('hide-safe', S.hideSafe);
}

// ---------- D.C. ----------

function renderMeasure(m) {
  if (!foieNeedle) {
    foieNeedle = new Needle($('#foieNeedle'), { left: 'YES', right: 'NO' });
    foieNeedle.loner = true;
  }
  foieNeedle.set(1 - m.p_chal, !!m.called);
  lastMeasure = m;
  let status;
  if (m.called) status = m.called === m.chal.id ? 'Called: the ban passes.' : 'Called: the ban fails.';
  else if (m.votes_total > 0) status = `${Math.round(m.eevp)}% in. Yes ${m.chal.pct.toFixed(1)}%, no ${m.rep.pct.toFixed(1)}%. Model: ${m.est_margin >= 0 ? 'yes' : 'no'} by ${Math.abs(m.est_margin).toFixed(1)}.`;
  else {
    const closes = m.poll_close ? new Date(m.poll_close) : null;
    status = closes && closes > nowForPolls()
      ? `Polls close ${et.format(closes)} ET. There's no public polling, so until votes come in this is a guess.`
      : 'Polls closed, waiting on D.C.';
  }
  $('#foieStatus').textContent = status;
}

function duckLine(m, p) {
  if (m.called) return m.called === m.chal.id ? 'The ducks could not be reached for comment.' : 'Foie gras stays on the menu.';
  return p > 0.8 ? 'Duck sentiment: optimistic.' : p > 0.55 ? 'Duck sentiment: hopeful.' : p > 0.45 ? 'Duck sentiment: nervous.' : p > 0.2 ? 'Duck sentiment: bleak.' : 'Duck sentiment: has retained counsel.';
}

// ---------- fever chart ----------

const strip = $('#strip');
const sctx = strip.getContext('2d');

function drawStrip() {
  const dpr = window.devicePixelRatio || 1;
  const w = strip.clientWidth, h = strip.clientHeight;
  if (strip.width !== w * dpr || strip.height !== h * dpr) { strip.width = w * dpr; strip.height = h * dpr; }
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  sctx.clearRect(0, 0, w, h);
  const css = getComputedStyle(document.body);
  const ink = css.getPropertyValue('--ink').trim(), grid = css.getPropertyValue('--paper-line').trim();
  const red = css.getPropertyValue('--r').trim(), blue = css.getPropertyValue('--d').trim();
  const pad = { l: 30, r: 20, t: 10, b: 22 };
  const W = w - pad.l - pad.r, H = h - pad.t - pad.b;

  sctx.font = '500 11px Archivo, sans-serif';
  sctx.lineWidth = 1;
  for (const v of [0, 0.25, 0.5, 0.75, 1]) {
    const y = pad.t + H * (1 - v);
    sctx.strokeStyle = v === 0.5 ? ink : grid;
    sctx.setLineDash(v === 0.5 ? [] : [2, 3]);
    sctx.beginPath(); sctx.moveTo(pad.l, y); sctx.lineTo(w - pad.r, y); sctx.stroke();
    sctx.fillStyle = ink; sctx.globalAlpha = 0.65;
    sctx.fillText((v * 100).toFixed(0), 2, y + 4);
    sctx.globalAlpha = 1;
  }
  sctx.setLineDash([]);
  if (!history.length) return;
  const t0 = new Date(history[0].t).getTime();
  const t1 = Math.max(new Date(history[history.length - 1].t).getTime(), t0 + 3600e3);
  const x = (t) => pad.l + W * 0.96 * (new Date(t).getTime() - t0) / (t1 - t0);
  const y = (p) => pad.t + H * (1 - p);

  // ink above and below the midline in party colors
  const line = () => { history.forEach((pt, i) => (i ? sctx.lineTo(x(pt.t), y(pt.p_rep)) : sctx.moveTo(x(pt.t), y(pt.p_rep)))); };
  for (const [color, top] of [[red, true], [blue, false]]) {
    sctx.save();
    sctx.beginPath();
    top ? sctx.rect(0, 0, w, y(0.5)) : sctx.rect(0, y(0.5), w, h);
    sctx.clip();
    sctx.beginPath();
    line();
    sctx.lineTo(x(history[history.length - 1].t), y(0.5));
    sctx.lineTo(x(history[0].t), y(0.5));
    sctx.closePath();
    sctx.globalAlpha = 0.18; sctx.fillStyle = color; sctx.fill();
    sctx.globalAlpha = 1;
    sctx.beginPath(); line(); sctx.strokeStyle = color; sctx.lineWidth = 2; sctx.stroke();
    sctx.restore();
  }

  // the pen wobbles with the needle; the line it leaves behind doesn't
  const last = history[history.length - 1];
  const px = x(last.t), py = y(mainNeedle.reading());
  sctx.strokeStyle = ink; sctx.lineWidth = 1; sctx.setLineDash([1, 3]);
  sctx.beginPath(); sctx.moveTo(px, y(last.p_rep)); sctx.lineTo(px + 12, py); sctx.stroke();
  sctx.setLineDash([]);
  sctx.fillStyle = ink;
  sctx.beginPath(); sctx.moveTo(px + 12, py); sctx.lineTo(px + 19, py - 3.5); sctx.lineTo(px + 19, py + 3.5); sctx.fill();

  // race calls along the bottom
  sctx.font = '600 9.5px Archivo, sans-serif';
  let lastX = -99;
  for (const e of [...(state?.ticker || [])].reverse()) {
    if (e.kind !== 'call' || !e.race || e.race.includes('-')) continue;
    const ex = x(e.t);
    if (ex < pad.l || ex > w) continue;
    sctx.globalAlpha = 0.5; sctx.fillStyle = ink; sctx.fillRect(ex, pad.t + H - 6, 1, 6);
    if (ex - lastX > 18) { sctx.globalAlpha = 0.85; sctx.fillText(e.race, ex - 6, pad.t + H + 15); lastX = ex; }
  }
  sctx.globalAlpha = 1;
  $('#stripRange').textContent = `${et.format(new Date(t0))} to ${et.format(new Date(last.t))} ET`;
}

// ---------- wire ----------

const VIBES = [
  "Someone in your group chat has said 'it's over' four times now.",
  'The remaining vote in {state} is, scientifically speaking, vibes.',
  'A cable news anchor is zooming in on a county the size of a parking lot.',
  'Mail ballots exist and they are slow.',
  "A pundit has said 'path to 51' for the 900th time tonight.",
  'Somewhere in {state} a county clerk is doing their best. Leave them alone.',
  'Early votes are not final votes.',
  'A man named Doug is very confident about {state}. Doug has no data.',
  'The needle is not a person. Please stop yelling at it.',
  'You have refreshed {state} eleven times in two minutes.',
];
const track = $('#tickerTrack');
let tickerX = 0;
const tickerSeen = new Set();
let vibeTurn = 0;

function vibeLine() {
  const live = (state?.races || []).filter((r) => !r.called && r.votes_total > 0);
  const pool = live.length ? live : state?.races || [];
  const r = pool[Math.floor(Math.random() * pool.length)];
  return VIBES[Math.floor(Math.random() * VIBES.length)].replace('{state}', r ? r.state_name : 'Ohio');
}

function tickerItem(text, kind, label) {
  const s = document.createElement('span');
  s.className = 'tk ' + kind;
  if (label) { const k = document.createElement('b'); k.className = 'k'; k.textContent = label; s.appendChild(k); }
  s.appendChild(document.createTextNode(text));
  return s;
}

let recent = [];
let realIdx = 0;
const wireItem = (e) => tickerItem(e.text.replace(/^CALLED: /, ''), 'real ' + e.kind, e.kind === 'call' ? 'Called' : null);
function nextTickerItem() {
  // two real items for every bit of color, cycling newest to oldest
  vibeTurn = (vibeTurn + 1) % 3;
  if (vibeTurn === 0 || !recent.length) return tickerItem(vibeLine(), 'vibe');
  realIdx = (realIdx + 1) % Math.min(recent.length, 12);
  return wireItem(recent[realIdx]);
}

function feedTicker() {
  const want = Math.max(track.parentElement.clientWidth, 600) * 2;
  for (let i = 0; i < 12 && track.scrollWidth + tickerX < want; i++) track.appendChild(nextTickerItem());
}

function stepTicker(dt) {
  tickerX -= dt * 60;
  const first = track.firstElementChild;
  if (!first) tickerX = track.parentElement.clientWidth * 0.3;
  const step = first ? first.offsetWidth + 22 : 0;
  if (first && -tickerX > step) { tickerX += step; first.remove(); }
  if (track.scrollWidth + tickerX < track.parentElement.clientWidth * 1.5) feedTicker();
  track.style.transform = `translateX(${tickerX.toFixed(1)}px)`;
}

function ingestTicker(events) {
  recent = events.filter((e) => e.kind !== 'progress');
  const fresh = [];
  for (const e of [...events].reverse()) {
    const k = e.t + e.text;
    if (tickerSeen.has(k)) continue;
    tickerSeen.add(k);
    if (!firstState) fresh.push(e);
  }
  // fresh news cuts the line
  const anchor = track.children[2] || null;
  for (const e of fresh) track.insertBefore(wireItem(e), anchor);
}

// ---------- toasts ----------

function toast(kicker, text, cls) {
  const t = document.createElement('div');
  t.className = 'toast ' + (cls || '');
  const k = document.createElement('span');
  k.className = 'k'; k.textContent = kicker;
  t.append(k, document.createTextNode(text));
  const host = $('#toasts');
  host.appendChild(t);
  while (host.children.length > 3) host.firstElementChild.remove();
  setTimeout(() => t.remove(), 6000);
}

// ---------- incoming data ----------

const userSide = (pRep) => (S.team === 'R' ? pRep : 1 - pRep);

function onState(next) {
  if (runId !== null && next.run_id !== runId) {
    history = [];
    seenCalls.clear();
    lastP = null; // a new night isn't a swing
    toast('Simulator', 'A brand new fake night just started.', '');
  }
  runId = next.run_id;
  const prev = state;
  state = next;

  $('#simBanner').hidden = next.source !== 'sim';
  renderControl(next.control);
  // until the needles start moving (or in a background tab), show the model's own words
  if (shownRep === null) renderLead(next.control.p_rep, next.control.rep_seats_mean);
  next.races.forEach(renderRace);
  sortCards();
  const foie = next.measures.find((m) => /foie/i.test(m.title)) || next.measures[0];
  $('#foiePanel').hidden = !foie;
  if (foie) renderMeasure(foie);

  const t = next.sim_clock || next.fetched_at;
  if (!history.length || history[history.length - 1].t !== t) history.push({ t, p_rep: next.control.p_rep });

  ingestTicker(next.ticker);

  for (const r of [...next.races, ...next.measures]) {
    if (!r.called || seenCalls.has(r.id)) continue;
    seenCalls.add(r.id);
    if (firstState) continue;
    const w = r.called === r.chal.id ? r.chal : r.rep;
    if (r.kind === 'measure') {
      toast('Called in D.C.', `Initiative 86 ${w === r.chal ? 'passes' : 'fails'}.`, '');
    } else {
      toast(`Called · ${r.state_name}`, `${w.name} wins.`, w === r.rep ? 'r' : 'd');
    }
    sfx.ding();
    if (r.kind !== 'measure' && (S.team === 'D' || S.team === 'R')) {
      mood.jolt((S.team === 'R') === (w === r.rep) ? 'back' : 'over');
    }
  }

  // real swings get a real (shorter) freakout
  if (lastP !== null && prev && S.team) {
    const d = next.control.p_rep - lastP;
    if (Math.abs(d) >= 0.04) {
      const good = S.team === 'chaos' ? Math.random() < 0.5 : userSide(next.control.p_rep) > userSide(lastP);
      mood.react(good ? 'back' : 'over', `control odds just moved ${Math.round(Math.abs(d) * 100)} points`, S);
      lastP = next.control.p_rep;
    }
  } else {
    lastP = next.control.p_rep;
  }
  firstState = false;
  updateTitle();
  updateMoodEar();
}

function updateTitle() {
  if (mood.kind === 'over') document.title = "IT'S SO OVER";
  else if (mood.kind === 'back') document.title = "WE'RE SO BACK";
  else if (state) document.title = `GOP ${ctlPct(shownRep ?? state.control.p_rep)} · The Needle`;
}

function updateMoodEar() {
  let text;
  if (mood.kind === 'over') text = "It's over.";
  else if (mood.kind === 'back') text = 'So back.';
  else if (!state || !S.team) text = 'Anxious.';
  else if (S.team === 'chaos') text = 'Unstable.';
  else {
    const p = userSide(shownRep ?? state.control.p_rep);
    text = p > 0.9 ? 'Smug.' : p > 0.7 ? 'Cautiously optimistic.' : p > 0.55 ? 'Hopeful, nervous.' : p > 0.45 ? 'Anxious.' : p > 0.3 ? 'Bracing.' : p > 0.1 ? 'Grim.' : 'Beyond help.';
  }
  setText('#moodEar', text);
}

async function loadHistory() {
  try {
    const h = await fetch(`${API}/api/history`).then((r) => r.json());
    history = h.map((p) => ({ t: p.t, p_rep: p.p_rep }));
  } catch {}
}

async function boot() {
  await loadHistory();
  connect();
}

let lastMsg = 0, retry = 0, outage = false;
function connect() {
  const es = new EventSource(`${API}/api/stream`);
  es.onopen = () => {
    retry = 0;
    if (outage) { outage = false; loadHistory(); } // fill the chart's gap
  };
  es.onmessage = (ev) => {
    lastMsg = Date.now();
    try { onState(JSON.parse(ev.data)); } catch (e) { console.error(e); }
  };
  es.onerror = () => {
    $('#lamp').className = 'lamp bad';
    // Browsers retry a dropped connection on their own, but an error response
    // (a 502 mid-redeploy, a 503 from the cap) closes the stream for good.
    if (es.readyState === EventSource.CLOSED) {
      outage = true;
      retry = Math.min(retry + 1, 6);
      setTimeout(connect, 2 ** retry * 1000 + Math.random() * 5000);
    }
  };
}

function updateStatus() {
  if (!state) { $('#source').textContent = 'connecting'; return; }
  const age = (Date.now() - new Date(state.fetched_at).getTime()) / 1000;
  const msgAge = (Date.now() - lastMsg) / 1000;
  const sim = state.source === 'sim';
  const stale = sim ? msgAge > 10 : age > 120;
  $('#lamp').className = 'lamp ' + (msgAge > 300 ? 'bad' : stale ? 'warn' : 'ok');
  $('#source').textContent = sim ? 'Simulated returns' : `NYT feed, checked ${Math.round(age)}s ago`;
  const clock = state.sim_clock ? new Date(state.sim_clock) : new Date();
  $('#clock').textContent = et.format(clock).replace('AM', 'a.m.').replace('PM', 'p.m.') + ' ET';
  $('#editionK').textContent = sim ? 'Practice edition' : 'Late edition';
}

// ---------- the frame loop ----------

const nationalDriver = new Driver(), mainDriver = new Driver(1.7), foieDriver = new Driver(0.8);
// Each race's own wobble, as a share of what the model would give it. Under 1 so
// the races visibly move together; the shared national part is the model's.
const OWN_SHARE = 0.5;
let lastFrame = performance.now();
let lastText = 0, lastShown = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  mood.tick(now, S);
  const reach = Z_STEP * S.amount;

  // One national wobble moves every race at once, each as much as the model
  // says it moves with the national swing. Each race also has a bit of its own.
  const g = nationalDriver.step(dt, now, S, reach, S.lean) + mood.nationalZ(S);
  let seatsShown = 0, seatsModel = 0;
  for (const card of cards.values()) {
    const r = card.r;
    if (r.called) { card.needle.step(dt, now, S, 1 - r.p_chal); continue; }
    const rho = Math.min(0.98, r.nat_corr || 0);
    const own = card.driver.step(dt, now, S, reach * Math.sqrt(1 - rho * rho) * OWN_SHARE);
    card.needle.step(dt, now, S, phi(-invPhi(r.p_chal) + rho * g + own));
    seatsShown += card.needle.reading();
    seatsModel += 1 - r.p_chal;
  }
  // Control follows the races: shift its odds by however many seats the wobble moved.
  if (state) {
    const c = state.control;
    const own = mainDriver.step(dt, now, S, reach * 0.25);
    const settled = c.p_rep <= 0 || c.p_rep >= 1 || seatSd < 0.05;
    mainNeedle.step(dt, now, S, settled ? c.p_rep : phi(invPhi(c.p_rep) + (seatsShown - seatsModel) / seatSd + own));
    // anchored on the model's own seat mean, so Wobble 0 prints exactly the box's number
    shownSeats = c.rep_seats_mean + (seatsShown - seatsModel);
  }
  if (foieNeedle && lastMeasure) {
    const own = foieDriver.step(dt, now, S, reach);
    foieNeedle.step(dt, now, S, phi(-invPhi(lastMeasure.p_chal) + own + mood.lonerZ(S)));
  }

  if (state && now - lastShown > 250) {
    lastShown = now;
    renderShown();
  }
  if (now - lastText > 90) {
    lastText = now;
    const q = mainNeedle.reading();
    $('#readL').textContent = ctlPct(1 - q);
    $('#readR').textContent = ctlPct(q);
    drawStrip();
  }
  stepTicker(dt);
  requestAnimationFrame(frame);
}

// Every number outside the model box reads the needles.
function renderShown() {
  shownRep = mainNeedle.reading();
  renderLead(shownRep, shownSeats ?? state.control.rep_seats_mean);
  for (const card of cards.values()) {
    const q = card.needle.reading();
    const fmt = card.r.called ? pct : openPct;
    setText('.ol', fmt(1 - q), card.el);
    setText('.or', fmt(q), card.el);
  }
  if (foieNeedle && lastMeasure) {
    const yes = 1 - foieNeedle.reading();
    const fmt = lastMeasure.called ? pct : openPct;
    setText('#foieYes', fmt(yes));
    setText('#foieNo', fmt(1 - yes));
    setText('#duckMood', duckLine(lastMeasure, yes));
  }
  updateTitle();
  updateMoodEar();
}

// ---------- wobble controls ----------

function bindSettings() {
  const drawer = $('#settings');
  $('#settingsBtn').addEventListener('click', () => drawer.classList.toggle('open'));
  $('#settingsClose').addEventListener('click', () => drawer.classList.remove('open'));

  const sliders = { amount: '#setAmount', lean: '#setLean', speed: '#setSpeed', bounce: '#setBounce', intensity: '#setIntensity' };
  const describe = {
    amount: (v) => v == 0 ? 'still' : v <= 1 ? 'the original' : v <= 3 ? 'caffeinated' : v <= 6 ? 'extra wobbly' : v < 11 ? 'unwell' : 'this one goes to 11',
    lean: (v) => Math.abs(v) < 0.05 ? 'none' : `${Math.abs(v) < 0.4 ? 'a little' : Math.abs(v) < 0.75 ? 'noticeably' : 'hard'} toward ${v > 0 ? 'GOP' : 'Dems'}`,
    speed: (v) => v < 0.6 ? 'molasses' : v < 1.4 ? 'normal' : v < 2.2 ? 'jittery' : 'hummingbird',
    bounce: (v) => v < 0.3 ? 'damped' : v < 0.6 ? 'springy' : v < 0.85 ? 'boingy' : 'trampoline',
    intensity: (v) => v < 0.3 ? 'mild' : v < 0.7 ? 'dramatic' : 'operatic',
  };
  for (const [k, sel] of Object.entries(sliders)) {
    const input = $(sel), out = $(sel + 'Out');
    input.addEventListener('input', () => { S[k] = +input.value; out.textContent = describe[k](S[k]); save(); });
  }
  for (const group of ['style', 'moods', 'team']) {
    $$(`[data-${group}]`).forEach((b) => b.addEventListener('click', () => {
      S[group] = b.dataset[group];
      save(); syncSettings();
      if (group === 'team') { lastP = state?.control.p_rep ?? null; updateMoodEar(); }
    }));
  }
  for (const k of ['misregister', 'shake', 'sound', 'truth', 'hideSafe']) {
    const box = $(`#set_${k}`);
    box.addEventListener('change', () => {
      S[k] = box.checked; save(); syncSettings();
      if (k === 'sound') setSound(S.sound);
      if (k === 'hideSafe') sortCards();
    });
  }
  $$('[data-preset]').forEach((b) => b.addEventListener('click', () => {
    Object.assign(S, PRESETS[b.dataset.preset]); save(); syncSettings();
    if (b.dataset.preset === 'schizo') mood.episode([{ kind: 'over', ms: 1500, word: 'OH NO' }, { kind: 'back', ms: 1900, word: "LET'S GO" }], S, 'you asked for this');
  }));
  $('#touchGrass').addEventListener('click', () => {
    Object.assign(S, PRESETS.sedated); save(); syncSettings();
    mood.steps = [];
    mood.set('calm');
    toast('Settings', 'Grass touched. Needles sedated.', '');
  });
  $('#sortSel').addEventListener('change', (e) => { S.sort = e.target.value; save(); sortCards(); });
  $('#hideSafeQuick').addEventListener('change', (e) => { S.hideSafe = e.target.checked; save(); syncSettings(); sortCards(); });
  $('#moodTest').addEventListener('click', () => mood.episode([{ kind: 'over', ms: 3000, word: "IT'S SO OVER" }, { kind: 'back', ms: 2800, word: "WE'RE SO BACK" }], S, 'you pressed the button'));

  $$('[data-pick]').forEach((b) => b.addEventListener('click', () => {
    S.team = b.dataset.pick; save(); syncSettings();
    $('#onboard').classList.remove('open');
    lastP = state?.control.p_rep ?? null;
    updateMoodEar();
  }));
  if (!S.team) $('#onboard').classList.add('open');
}

function syncSettings() {
  for (const k of ['amount', 'lean', 'speed', 'bounce', 'intensity']) {
    const sel = '#set' + k[0].toUpperCase() + k.slice(1);
    $(sel).value = S[k];
    $(sel).dispatchEvent(new Event('input'));
  }
  for (const group of ['style', 'moods', 'team']) {
    $$(`[data-${group}]`).forEach((b) => b.classList.toggle('on', b.dataset[group] === S[group]));
  }
  for (const k of ['misregister', 'shake', 'sound', 'truth', 'hideSafe']) $(`#set_${k}`).checked = !!S[k];
  $('#hideSafeQuick').checked = !!S.hideSafe;
  $('#sortSel').value = S.sort;
  document.body.classList.toggle('no-truth', !S.truth);
  $('#teamTag').textContent = { D: 'Rooting for Democrats', R: 'Rooting for Republicans', chaos: 'Rooting for chaos' }[S.team] || 'Rooting for nobody yet';
}

bindSettings();
syncSettings();
if (S.sound) document.addEventListener('pointerdown', () => setSound(true), { once: true });
setInterval(updateStatus, 1000);
requestAnimationFrame(frame);
boot();
