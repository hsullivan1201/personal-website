/* Horloge Républicaine — web port of the macOS app. Same math, same theme. */
"use strict";

/* ---------- Republican calendar math (mirrors RepublicanCalendar.swift) ---------- */

const MS_DAY = 86400000;

function midnight(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Days between two local midnights, robust across DST (durations near a
// day round to exactly one).
function daysBetween(a, b) {
  return Math.round((b - a) / MS_DAY);
}

function anniversary(year) {
  return new Date(year, 8, 22); // September 22
}

function repDate(d) {
  const today = midnight(d);
  let anchorYear = d.getFullYear();
  if (today < anniversary(anchorYear)) anchorYear -= 1;
  const yearStart = anniversary(anchorYear);
  const dayOfYear = daysBetween(yearStart, today);
  const yearLength = daysBetween(yearStart, anniversary(anchorYear + 1));
  return {
    year: anchorYear - 1791,
    month: Math.min(Math.floor(dayOfYear / 30), 12), // 12 = sans-culottides
    day: dayOfYear < 360 ? (dayOfYear % 30) + 1 : dayOfYear - 359,
    isLeap: yearLength === 366,
    yearStart,
  };
}

function decTime(d) {
  const start = midnight(d);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  const frac = (d - start) / (end - start);
  const total = Math.min(Math.floor(frac * 100000), 99999);
  return {
    h: Math.floor(total / 10000),
    m: Math.floor(total / 100) % 100,
    s: total % 100,
    frac,
  };
}

function gregFromRep(year, month, day) {
  if (year < 1) return null;
  const start = anniversary(1791 + year);
  const offset = month === 12 ? 360 + day - 1 : month * 30 + day - 1;
  return new Date(start.getFullYear(), 8, 22 + offset);
}

function isLeapRep(year) {
  return daysBetween(anniversary(1791 + year), anniversary(1792 + year)) === 366;
}

function roman(n) {
  const vals = [[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],
                [50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]];
  let s = "";
  for (const [v, r] of vals) while (n >= v) { s += r; n -= v; }
  return s;
}

/* ---------- i18n ---------- */

// English by default; French if the browser says so. A manual choice sticks.
let lang = localStorage.getItem("horloge-lang") ||
  ((navigator.language || "").toLowerCase().startsWith("fr") ? "fr" : "en");

const L = {
  fr: {
    units: "heure décimale · 1 jour = 10 h · 1 h = 100 min · 1 min = 100 s",
    dayOf: r => `✿ jour consacré : ${r}`,
    compDay: n => `jour complémentaire ${n}`,
    oldstyle: "heure ancienne : ",
    oldstyleShort: "ancien style : ",
    backToday: "● revenir à aujourd'hui",
    scSub: "fêtes de fin d'année",
    convTitle: "Le convertisseur",
    g2r: "Ancien style → républicain",
    r2g: "Républicain → ancien style",
    t2d: "Ancienne heure → décimale",
    d2t: "Heure décimale → ancienne",
    decTime: "heure décimale",
    oldTime: "heure ancienne",
    beforeRep: "C'est avant la République ! Le calendrier commence le 22 septembre 1792.",
    almTitle: "L'almanach",
    sysT: "Le système",
    decT: "La décade",
    monthsT: "Les mois",
    leapOnly: "années sextiles seulement",
    animalDay: "jour des animaux",
    toolDay: "outils & repos",
    fromLatin: (l, w) => `du latin ${l}, « ${w} »`,
    nick: n => `La presse anglaise s'en est moquée en surnommant ce mois « ${n} ».`,
    etym: e => `Étymologie : ${e}.`,
    srcLink: "code source de l'horloge",
    sys: [
      "Le 5 octobre 1793, la Convention nationale adopte le calendrier républicain, et avec lui le temps décimal : le jour est divisé en 10 heures, chaque heure en 100 minutes, chaque minute en 100 secondes. Midi tombe à 5 heures, et une journée entière compte 100 000 secondes décimales.",
      "Une heure décimale vaut 2 h 24 anciennes, une minute décimale 1 min 26,4 s, et une seconde décimale 0,864 s. Des horlogers fabriquèrent de véritables montres à 10 heures, mais le temps décimal ne fut obligatoire que dix-sept mois environ avant d'être suspendu en 1795. Personne ne voulait remplacer sa montre.",
      "Le calendrier, lui, tint plus longtemps. Conçu par Gilbert Romme et nommé par le poète Fabre d'Églantine, il compte 12 mois de 30 jours exactement, soit trois décades de 10 jours, plus 5 ou 6 jours de fête en fin d'année, les sans-culottides. L'an I commence le 22 septembre 1792, jour de la proclamation de la République et de l'équinoxe d'automne. Napoléon l'abolit au 1er janvier 1806.",
      "À la place des saints du calendrier grégorien, chaque jour célèbre une plante, un minéral, un animal ou un outil agricole : le raisin, le safran, la pomme de terre, le bœuf, la charrue. Chaque quintidi honore un animal, chaque décadi un outil.",
    ],
    dec: [
      "La semaine de sept jours disparaît au profit de la décade. Les noms des jours sont d'une simplicité toute révolutionnaire : un ordinal latin suivi de « di », le jour. Le décadi remplaçait le dimanche comme jour de repos, soit un jour de congé tous les dix jours au lieu de sept. Ce détail n'a pas aidé à la popularité du système.",
    ],
    sc: [
      "Douze mois de trente jours ne font que 360 jours. Les 5 jours restants (6 les années sextiles) deviennent des fêtes nationales en l'honneur des sans-culottes, les révolutionnaires du peuple. Elles closent l'année entre la fin de Fructidor et le 1er Vendémiaire.",
    ],
    rhyme: "Les mois d'une même saison riment entre eux : -aire en automne, -ôse en hiver, -al au printemps, -idor en été.",
  },
  en: {
    units: "decimal time · 1 day = 10 h · 1 h = 100 min · 1 min = 100 s",
    dayOf: (r, en) => `✿ day of the ${en} · ${r}`,
    compDay: n => `complementary day ${n}`,
    oldstyle: "old-style time: ",
    oldstyleShort: "old style: ",
    backToday: "● back to today",
    scSub: "year-end festivals",
    convTitle: "The converter",
    g2r: "Old style → Republican",
    r2g: "Republican → old style",
    t2d: "Old time → decimal",
    d2t: "Decimal time → old",
    decTime: "decimal time",
    oldTime: "old-style time",
    beforeRep: "That is before the Republic! The calendar starts on September 22, 1792.",
    almTitle: "The almanac",
    sysT: "The system",
    decT: "The décade",
    monthsT: "The months",
    leapOnly: "leap years only",
    animalDay: "animal day",
    toolDay: "tools & rest",
    fromLatin: (l, w) => `from Latin ${l}, "${w}"`,
    nick: n => `The British press mocked the months, nicknaming this one "${n}".`,
    etym: e => `Etymology: ${e}.`,
    srcLink: "source code for the clock",
    sys: [
      "On October 5, 1793, the National Convention adopted the Republican calendar, and with it decimal time: the day is divided into 10 hours, each hour into 100 minutes, each minute into 100 seconds. Noon falls at 5 o'clock, and a full day has exactly 100,000 decimal seconds.",
      "One decimal hour is 2 h 24 min of old time, one decimal minute is 1 min 26.4 s, and one decimal second is 0.864 s. Watchmakers built real 10-hour watches, but decimal time was only mandatory for about seventeen months before being suspended in 1795. Nobody wanted to replace their watch.",
      "The calendar itself lasted longer. Designed by Gilbert Romme and named by the poet Fabre d'Églantine, it has 12 months of exactly 30 days each, made of three 10-day décades, plus 5 or 6 festival days at the end of the year, the sans-culottides. Year I begins on September 22, 1792, the day the Republic was proclaimed, which was also the autumn equinox. Napoleon abolished it on January 1, 1806.",
      "Instead of the saints of the Gregorian calendar, every day celebrates a plant, mineral, animal or farm tool: the grape, saffron, the potato, the ox, the plough. Every quintidi honors an animal, every décadi a tool.",
    ],
    dec: [
      "The seven-day week was replaced by the décade. The day names have a very revolutionary simplicity: a Latin ordinal followed by \"di\", meaning day. Décadi replaced Sunday as the day of rest, which meant one day off every ten days instead of seven. This detail did not help the system's popularity.",
    ],
    sc: [
      "Twelve months of thirty days only make 360 days. The 5 remaining days (6 in leap years) became national festivals honoring the sans-culottes, the working-class revolutionaries. They close the year between the end of Fructidor and the 1st of Vendémiaire.",
    ],
    rhyme: "The months of each season rhyme: -aire in autumn, -ôse in winter, -al in spring, -idor in summer.",
  },
};

const locale = () => (lang === "fr" ? "fr-FR" : "en-US");
const fmtFull = () => new Intl.DateTimeFormat(locale(), { dateStyle: "full" });
const fmtDayMonth = () => new Intl.DateTimeFormat(locale(), { day: "numeric", month: "long" });
const fmtLong = () => new Intl.DateTimeFormat(locale(), { day: "numeric", month: "long", year: "numeric" });

const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, "0");

function ruralName(month, day) {
  return DATA.ruralDays[month * 30 + day - 1];
}
function ruralNameEN(month, day) {
  return DATA.ruralDaysEN[month * 30 + day - 1];
}

/* ---------- Dial (SVG) ---------- */

const SVG = "http://www.w3.org/2000/svg";
let hands = {};

function el(name, attrs, parent) {
  const e = document.createElementNS(SVG, name);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  parent.appendChild(e);
  return e;
}

function buildDial() {
  const svg = $("dial");
  const c = 100, r = 96;
  el("circle", { cx: c, cy: c, r, fill: "rgba(255,255,255,.5)", stroke: "#1F2130", "stroke-width": 3 }, svg);
  for (let i = 0; i < 100; i++) {
    const major = i % 10 === 0;
    const a = (i / 100) * 2 * Math.PI - Math.PI / 2;
    const r1 = r - (major ? 11 : 6), r2 = r - 2;
    el("line", {
      x1: c + Math.cos(a) * r1, y1: c + Math.sin(a) * r1,
      x2: c + Math.cos(a) * r2, y2: c + Math.sin(a) * r2,
      stroke: "#1F2130", "stroke-width": major ? 2 : 0.7,
    }, svg);
  }
  for (let n = 1; n <= 10; n++) {
    const a = (n / 10) * 2 * Math.PI - Math.PI / 2;
    const t = el("text", {
      x: c + Math.cos(a) * (r - 24), y: c + Math.sin(a) * (r - 24),
      "text-anchor": "middle", "dominant-baseline": "central",
      "font-size": 15, "font-weight": 600, fill: "#1F2130",
      "font-family": "ui-serif, Georgia, serif",
    }, svg);
    t.textContent = n;
  }
  const hand = (len, w, color) =>
    el("line", { x1: c, y1: c + len * 0.15, x2: c, y2: c - len, stroke: color,
                 "stroke-width": w, "stroke-linecap": "round" }, svg);
  hands.hour = hand(r * 0.45, 4, "#002494");
  hands.minute = hand(r * 0.66, 2.5, "#1F2130");
  hands.second = hand(r * 0.74, 1, "#CC1C2B");
  el("circle", { cx: c, cy: c, r: 4, fill: "#CC1C2B" }, svg);
}

function updateDial(frac) {
  const deg = t => `rotate(${t * 360} 100 100)`;
  hands.hour.setAttribute("transform", deg(frac));
  hands.minute.setAttribute("transform", deg((frac * 10) % 1));
  hands.second.setAttribute("transform", deg((frac * 1000) % 1));
}

/* ---------- Main clock + calendar ---------- */

let browsedMonth = null; // null = follow today
let lastRendered = { key: "" };

function dateLineText(rep) {
  if (rep.month === 12) {
    return `${DATA.complementaryDays[rep.day - 1]} · An ${roman(rep.year)}`;
  }
  return `${DATA.decadeDays[(rep.day - 1) % 10]} ${rep.day} ${DATA.months[rep.month]} · An ${roman(rep.year)}`;
}

function renderBanner(rep) {
  $("dateline").textContent = dateLineText(rep);
  const ruralEl = $("rural");
  if (rep.month === 12) {
    ruralEl.textContent = lang === "fr"
      ? L.fr.compDay(rep.day)
      : `${DATA.complementaryDaysEN[rep.day - 1]} · ${L.en.compDay(rep.day)}`;
  } else {
    ruralEl.textContent = lang === "fr"
      ? L.fr.dayOf(ruralName(rep.month, rep.day))
      : L.en.dayOf(ruralName(rep.month, rep.day), ruralNameEN(rep.month, rep.day));
  }
}

function monthRangeText(rep, m) {
  const start = new Date(rep.yearStart);
  const len = m === 12 ? (rep.isLeap ? 6 : 5) : 30;
  const s = new Date(start.getFullYear(), 8, 22 + (m === 12 ? 360 : m * 30));
  const e = new Date(start.getFullYear(), 8, 22 + (m === 12 ? 360 : m * 30) + len - 1);
  return `${fmtDayMonth().format(s)} – ${fmtDayMonth().format(e)}`;
}

function renderCalendar(rep) {
  const m = browsedMonth === null ? rep.month : browsedMonth;
  $("monthname").textContent = m === 12 ? "Sans-culottides" : DATA.months[m];
  const meaning = m === 12
    ? L[lang].scSub
    : (lang === "fr" ? DATA.monthMeanings[m] : DATA.monthMeaningsEN[m]);
  $("monthsub").textContent = `${meaning} · ${monthRangeText(rep, m)}`;

  const grid = $("grid");
  grid.innerHTML = "";
  if (m === 12) {
    grid.style.display = "block";
    grid.className = "sclist";
    const count = rep.isLeap ? 6 : 5;
    for (let d = 1; d <= count; d++) {
      const row = document.createElement("button");
      row.className = "scrow" + (rep.month === 12 && rep.day === d ? " today" : "");
      row.innerHTML = `<span class="num">${d}</span><span>${DATA.complementaryDays[d - 1]}</span>` +
        (lang === "en" ? `<span class="en">${DATA.complementaryDaysEN[d - 1]}</span>` : "");
      row.addEventListener("click", () => showDayPopover(rep, 12, d));
      grid.appendChild(row);
    }
  } else {
    grid.style.display = "grid";
    grid.className = "";
    for (let i = 0; i < 10; i++) {
      const h = document.createElement("span");
      h.className = "colhead";
      h.textContent = DATA.decadeAbbrev[i];
      grid.appendChild(h);
    }
    for (let d = 1; d <= 30; d++) {
      const cell = document.createElement("button");
      cell.className = "cell" + (m === rep.month && d === rep.day ? " today" : "");
      cell.textContent = d;
      cell.title = `${DATA.decadeDays[(d - 1) % 10]} ${d} · ${ruralName(m, d)}`;
      cell.addEventListener("click", () => showDayPopover(rep, m, d));
      grid.appendChild(cell);
    }
  }

  const back = $("backtoday");
  back.hidden = browsedMonth === null;
  back.textContent = L[lang].backToday;
}

function showDayPopover(rep, m, d) {
  const pop = $("popover");
  const g = gregFromRep(rep.year, m, d);
  let title, sub;
  if (m === 12) {
    title = `${DATA.complementaryDays[d - 1]} · An ${roman(rep.year)}`;
    sub = lang === "en" ? DATA.complementaryDaysEN[d - 1] : "";
  } else {
    title = `${DATA.decadeDays[(d - 1) % 10]} ${d} ${DATA.months[m]} · An ${roman(rep.year)}`;
    sub = lang === "fr" ? `✿ ${ruralName(m, d)}` : `✿ ${ruralNameEN(m, d)} · ${ruralName(m, d)}`;
  }
  pop.innerHTML = `<p class="t">${title}</p>` +
    (sub ? `<p class="r">${sub}</p>` : "") +
    `<p class="g">${L[lang].oldstyleShort}${fmtFull().format(g)}</p>`;
  pop.hidden = false;
  $("backdrop").hidden = false;
}

function closePopover() {
  $("popover").hidden = true;
  $("backdrop").hidden = true;
}

function tick() {
  const now = new Date();
  const dec = decTime(now);
  $("dectime").textContent = `${dec.h}:${pad(dec.m)}:${pad(dec.s)}`;
  updateDial(dec.frac);

  const rep = repDate(now);
  const key = `${rep.year}-${rep.month}-${rep.day}-${browsedMonth}-${lang}`;
  if (key !== lastRendered.key) {
    lastRendered.key = key;
    renderBanner(rep);
    renderCalendar(rep);
  }

  $("oldstyle").textContent = L[lang].oldstyle +
    `${fmtLong().format(now)} · ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  requestAnimationFrame(tick);
}

/* ---------- Converter ---------- */

function fillSelect(sel, items, value) {
  sel.innerHTML = "";
  items.forEach(([v, label]) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = label;
    sel.appendChild(o);
  });
  sel.value = value;
}

function gregMonthNames() {
  const f = new Intl.DateTimeFormat(locale(), { month: "long" });
  return Array.from({ length: 12 }, (_, i) => f.format(new Date(2000, i, 15)));
}

function setupConverter() {
  const now = new Date();
  const rep = repDate(now);
  const dec = decTime(now);

  fillSelect($("g-month"), gregMonthNames().map((n, i) => [i, n]), now.getMonth());
  $("g-year").value = now.getFullYear();
  syncGregDays(now.getDate());

  fillSelect($("r-month"),
    [...DATA.months.map((n, i) => [i, n]), [12, "Sans-culottides"]],
    rep.month);
  $("r-year").value = rep.year;
  syncRepDays(rep.day);

  fillSelect($("t-hour"), Array.from({ length: 24 }, (_, i) => [i, pad(i)]), now.getHours());
  fillSelect($("t-min"), Array.from({ length: 60 }, (_, i) => [i, pad(i)]), now.getMinutes());
  fillSelect($("d-hour"), Array.from({ length: 10 }, (_, i) => [i, i]), dec.h);
  fillSelect($("d-min"), Array.from({ length: 100 }, (_, i) => [i, pad(i)]), dec.m);

  for (const id of ["g-day", "g-month", "g-year"]) $(id).addEventListener("change", onGregChange);
  for (const id of ["r-day", "r-month", "r-year"]) $(id).addEventListener("change", onRepChange);
  for (const id of ["t-hour", "t-min"]) $(id).addEventListener("change", renderTimeResults);
  for (const id of ["d-hour", "d-min"]) $(id).addEventListener("change", renderTimeResults);

  renderConvResults();
}

function daysInGregMonth(y, m) {
  return new Date(y, m + 1, 0).getDate();
}

function syncGregDays(keep) {
  const y = parseInt($("g-year").value || "2000", 10);
  const m = parseInt($("g-month").value, 10);
  const max = daysInGregMonth(y, m);
  fillSelect($("g-day"), Array.from({ length: max }, (_, i) => [i + 1, i + 1]), Math.min(keep, max));
}

function syncRepDays(keep) {
  const m = parseInt($("r-month").value, 10);
  const y = parseInt($("r-year").value || "1", 10);
  const max = m === 12 ? (isLeapRep(y) ? 6 : 5) : 30;
  fillSelect($("r-day"), Array.from({ length: max }, (_, i) => [i + 1, i + 1]), Math.min(keep, max));
}

function onGregChange() {
  syncGregDays(parseInt($("g-day").value, 10));
  renderConvResults();
}

function onRepChange() {
  syncRepDays(parseInt($("r-day").value, 10));
  renderConvResults();
}

function renderConvResults() {
  // Gregorian → Republican
  const gd = new Date(parseInt($("g-year").value || "2000", 10),
                      parseInt($("g-month").value, 10),
                      parseInt($("g-day").value, 10), 12);
  const rep = repDate(gd);
  const res = $("g2r-res");
  if (rep.year < 1) {
    res.innerHTML = `<span class="err">${L[lang].beforeRep}</span>`;
  } else {
    const sub = rep.month === 12
      ? (lang === "en" ? DATA.complementaryDaysEN[rep.day - 1] : "")
      : (lang === "fr" ? `✿ ${ruralName(rep.month, rep.day)}`
                       : `✿ ${ruralNameEN(rep.month, rep.day)} · ${ruralName(rep.month, rep.day)}`);
    res.innerHTML = dateLineText(rep) + (sub ? `<span class="sub">${sub}</span>` : "");
  }

  // Republican → Gregorian
  const ry = parseInt($("r-year").value || "1", 10);
  const rm = parseInt($("r-month").value, 10);
  const rd = parseInt($("r-day").value, 10);
  $("r-roman").textContent = `An ${roman(Math.max(ry, 1))}`;
  const g = gregFromRep(ry, rm, rd);
  const sub2 = rm === 12
    ? (lang === "fr" ? DATA.complementaryDays[rd - 1] : DATA.complementaryDaysEN[rd - 1])
    : (lang === "fr" ? `✿ ${ruralName(rm, rd)}`
                     : `✿ ${ruralNameEN(rm, rd)} · ${ruralName(rm, rd)}`);
  $("r2g-res").innerHTML = g
    ? `${fmtFull().format(g)}<span class="sub">${sub2}</span>`
    : `<span class="err">An I…</span>`;

  renderTimeResults();
}

function renderTimeResults() {
  const oh = parseInt($("t-hour").value, 10), om = parseInt($("t-min").value, 10);
  const total = Math.round(((oh * 3600 + om * 60) / 86400) * 100000) % 100000;
  $("t2d-res").innerHTML =
    `${Math.floor(total / 10000)}:${pad(Math.floor(total / 100) % 100)}:${pad(total % 100)}` +
    `<span class="sub">${L[lang].decTime}</span>`;

  const dh = parseInt($("d-hour").value, 10), dm = parseInt($("d-min").value, 10);
  const secs = Math.round(((dh * 10000 + dm * 100) / 100000) * 86400) % 86400;
  $("d2t-res").innerHTML =
    `${pad(Math.floor(secs / 3600))}:${pad(Math.floor(secs / 60) % 60)}:${pad(secs % 60)}` +
    `<span class="sub">${L[lang].oldTime}</span>`;
}

/* ---------- Almanac ---------- */

function renderProse(id, paras) {
  $(id).innerHTML = paras.map(p => `<p>${p}</p>`).join("");
}

function renderAlmanac() {
  const t = L[lang];
  $("alm-title").textContent = t.almTitle;
  $("alm-sys-t").textContent = t.sysT;
  $("alm-dec-t").textContent = t.decT;
  $("alm-months-t").textContent = t.monthsT;
  renderProse("alm-sys", t.sys);
  renderProse("alm-dec-intro", t.dec);
  renderProse("alm-sc-intro", t.sc);

  // décade table
  const dec = $("alm-dec");
  dec.className = "declist";
  dec.innerHTML = "";
  DATA.decadeDays.forEach((name, i) => {
    const [latin, fr, en] = DATA.decadeRoots[i];
    const row = document.createElement("div");
    row.className = "decrow";
    const note = i === 4 ? t.animalDay : i === 9 ? t.toolDay : "";
    row.innerHTML = `<span class="name">${name}</span>` +
      `<span class="root">${t.fromLatin(latin, lang === "fr" ? fr : en)}</span>` +
      (note ? `<span class="tagnote">${note}</span>` : "");
    dec.appendChild(row);
  });

  // month picker
  const sel = $("alm-month");
  const current = sel.value !== "" ? parseInt(sel.value, 10) : repDate(new Date()).month;
  fillSelect(sel,
    DATA.months.map((n, i) => [i, `${n} · ${DATA.monthTranslations[i]}`]),
    Math.min(current, 11));
  sel.onchange = renderAlmanacMonth;
  renderAlmanacMonth();

  // sans-culottides list
  const rep = repDate(new Date());
  const sc = $("alm-sc");
  sc.className = "daylist";
  sc.innerHTML = "";
  for (let d = 1; d <= 6; d++) {
    const row = document.createElement("div");
    row.className = "dayrow" + (rep.month === 12 && rep.day === d ? " today" : "");
    row.innerHTML = `<span class="num">${d}</span>` +
      `<span class="fr">${DATA.complementaryDays[d - 1]}</span>` +
      `<span class="en">${DATA.complementaryDaysEN[d - 1]}${d === 6 ? " · " + L[lang].leapOnly : ""}</span>`;
    sc.appendChild(row);
  }
}

function renderAlmanacMonth() {
  const m = parseInt($("alm-month").value, 10);
  const t = L[lang];
  const season = lang === "fr" ? DATA.seasonsFR[Math.floor(m / 3)] : DATA.seasonsEN[Math.floor(m / 3)];
  const etym = lang === "fr" ? DATA.monthEtymologiesFR[m] : DATA.monthEtymologiesEN[m];
  $("alm-month-meta").innerHTML =
    `<p><em>${lang === "fr" ? DATA.monthMeanings[m] : DATA.monthMeaningsEN[m]} · ${season}</em></p>` +
    `<p>${t.etym(etym)} ${t.rhyme} ${t.nick(DATA.monthNicknames[m])}</p>`;

  const rep = repDate(new Date());
  const list = $("alm-days");
  list.className = "daylist";
  list.innerHTML = "";
  for (let d = 1; d <= 30; d++) {
    const row = document.createElement("div");
    row.className = "dayrow" + (m === rep.month && d === rep.day ? " today" : "");
    row.innerHTML = `<span class="num">${d}</span>` +
      `<span class="wd">${DATA.decadeDays[(d - 1) % 10]}</span>` +
      `<span class="fr">${ruralName(m, d)}</span>` +
      `<span class="en">${ruralNameEN(m, d)}</span>`;
    list.appendChild(row);
  }
}

/* ---------- Language + boot ---------- */

function applyLang() {
  document.documentElement.lang = lang;
  $("lang-fr").classList.toggle("active", lang === "fr");
  $("lang-en").classList.toggle("active", lang === "en");
  const t = L[lang];
  $("cap-units").textContent = t.units;
  $("conv-title").textContent = t.convTitle;
  $("conv-g2r").textContent = t.g2r;
  $("conv-r2g").textContent = t.r2g;
  $("conv-t2d").textContent = t.t2d;
  $("conv-d2t").textContent = t.d2t;
  $("src-link").textContent = t.srcLink;

  // re-render locale-sensitive month names in the Gregorian picker
  const keepMonth = $("g-month").value;
  if (keepMonth !== "") {
    fillSelect($("g-month"), gregMonthNames().map((n, i) => [i, n]), keepMonth);
  }

  lastRendered.key = "";
  renderAlmanac();
  renderConvResults();
}

function setLang(l) {
  lang = l;
  localStorage.setItem("horloge-lang", l);
  applyLang();
}

buildDial();
setupConverter();

$("lang-fr").addEventListener("click", () => setLang("fr"));
$("lang-en").addEventListener("click", () => setLang("en"));
$("prev").addEventListener("click", () => {
  const rep = repDate(new Date());
  const cur = browsedMonth === null ? rep.month : browsedMonth;
  const next = (cur + 12) % 13;
  browsedMonth = next === rep.month ? null : next;
  lastRendered.key = "";
});
$("next").addEventListener("click", () => {
  const rep = repDate(new Date());
  const cur = browsedMonth === null ? rep.month : browsedMonth;
  const next = (cur + 1) % 13;
  browsedMonth = next === rep.month ? null : next;
  lastRendered.key = "";
});
$("backtoday").addEventListener("click", () => {
  browsedMonth = null;
  lastRendered.key = "";
});
$("backdrop").addEventListener("click", closePopover);
$("popover").addEventListener("click", closePopover);
document.addEventListener("keydown", e => { if (e.key === "Escape") closePopover(); });

applyLang();
requestAnimationFrame(tick);
