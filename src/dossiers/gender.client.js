// Women and men (MoSPI's Women and Men in India): the plates. Data is the inline JSON the page
// builds at build time (src/dossiers/gender.data.js), never a runtime fetch. Each table keeps
// its own instrument: where the compendium joins two (the PLFS designs, census and NSS
// literacy), the plate draws them apart with seamMarks, never as one line.
import { ACC, G1, G2, GOLD, f1, toCsv, wire, mount, dumbbell, stateStrip, lines, bars } from "./health-gender.charts.js";

const D = JSON.parse(document.getElementById("gender-data").textContent);
const dt = (iso) => new Date(iso + "T00:00:00Z");
const ser = (s) => ({ ...s, points: s.points.map((p) => ({ ...p, date: dt(p.iso) })), est: new Set(s.est ?? []) });
const f0 = (v) => (v == null ? "—" : Math.round(v).toLocaleString("en-IN"));
const lineCsv = (series, periods) => {
  const isos = [...new Set(series.flatMap((s) => s.points.map((p) => p.iso)))].sort();
  return toCsv(["period", ...series.map((s) => s.label)], isos.map((i) => [periods?.[i] ?? i.slice(0, 4), ...series.map((s) => s.points.find((p) => p.iso === i)?.value ?? null)]));
};

/* ---------- lines ---------- */
const LINES = [
  ["srb", { fmt: f0, lo: 860, hi: 940, title: "Girls born per 1,000 boys, India, towns and villages" }],
  ["census", { fmt: f0, lo: 900, hi: 960, xTicks: "points", title: "Women per 1,000 men, census years" }],
  ["imr", { fmt: f0, title: "Infant deaths per 1,000 births, girls and boys" }],
  ["mmr", { fmt: f0, title: "Maternal deaths per 1,00,000 births" }],
  ["life", { lo: 50, hi: 80, title: "Life expectancy at birth, women and men, with projections" }],
  ["lok-sabha", { title: "Women's share of Lok Sabha seats, per cent" }],
];
for (const [k, o] of LINES) {
  const el = mount("plot-" + k);
  if (!el || !D[k]) continue;
  const series = D[k].series.map(ser);
  const p = lines(el, series, { desc: series.map((s) => `${s.label}: ${f1(s.points.at(-1).value)}`).join("; "), periods: D[k].periods, ...o });
  wire("cb-" + k, p, "gender-" + k, lineCsv(series, D[k].periods));
}
/* literacy: the census line and the NSS survey point are two instruments, drawn side by side */
{
  const el = mount("plot-literacy");
  if (el) {
    const census = D.literacy.census.map(ser), nss = D.literacy.nss.map(ser);
    const series = [...census.map((s) => ({ ...s, ruler: true })), ...nss.map((s) => ({ ...s, ruler: true, noLabel: true }))];
    const p = lines(el, series, { lo: 0, hi: 100, rulers: census.map((c, i) => [{ ...c }, { ...nss[i] }]), seamMarker: { text: "NSS 2017-18, a different survey", y: 96 },
      title: "Literacy, women and men, census 1981-2011 and NSS 2017-18" });
    wire("cb-literacy", p, "gender-literacy", lineCsv([...census, ...nss]));
  }
}
/* work: three PLFS rulers for each sex, side by side, the changeovers marked */
{
  const el = mount("plot-work");
  if (el) {
    const groups = D.work.rulers.map((g) => g.map(ser));
    const all = groups.flat();
    const series = groups.map((g) => ({ ...g.at(-1), ruler: true, points: g.at(-1).points }));
    const p = lines(el, series, { lo: 0, hi: 90, rulers: groups, seamMarker: { text: "survey changes", y: 88 }, title: "Worker population ratio, women and men, three PLFS rulers" });
    wire("cb-work", p, "gender-wpr", lineCsv(all.map((s, i) => ({ ...s, label: `${s.label}, ${["agricultural years", "calendar years", "revamped 2025"][i % 3]}` }))));
  }
}
/* ---------- state strips ---------- */
const STRIPS = [
  ["srb-states", [{ key: "v", color: ACC }], "Sex ratio at birth by state"],
  ["mmr-states", [{ key: "v", color: ACC }], "Maternal mortality ratio by state"],
  ["marriage-states", [{ key: "v", color: ACC }], "Women's mean age at marriage by state"],
  ["schooling-states", [{ key: "women", color: ACC }, { key: "men", color: G1 }], "Mean years of schooling, 15 and over, women and men, by state"],
  ["lfpr-states", [{ key: "women", color: ACC }, { key: "men", color: G1 }], "Labour force participation, 15 and over, women and men, by state, 2025"],
  ["wage-states", [{ key: "women", color: ACC }, { key: "men", color: G1 }], "Rural casual daily wage, women and men, by state, 2025"],
  ["crime-states", [{ key: "v", color: ACC }], "Crimes against women per 1,00,000 women, by state"],
];
for (const [k, series, title] of STRIPS) {
  const el = mount("plot-" + k), S = D[k];
  if (!el || !S) continue;
  const lo = k === "srb-states" ? 800 : k === "marriage-states" ? 18 : 0;
  const p = stateStrip(el, S.rows, series, { ref: S.ref, refLabel: S.refLabel, lo, title, desc: `${S.rows.length} states and union territories`, fmt: S.fmt === "0" ? f0 : f1 });
  wire("cb-" + k, p, "gender-" + k, toCsv(["state", ...series.map((s) => s.key)], S.rows.map((r) => [r.geo, ...series.map((s) => r[s.key])])));
}
/* ---------- bars ---------- */
const BARS = [
  ["tfr-edu", (d) => d.rows, { ref: D["tfr-edu"]?.ref, refLabel: "all literate women", title: "Children per woman by schooling", fmt: f1 }],
  ["money", (d) => d, { hi: 100, title: "Women's share of accounts and holders, per cent" }],
  ["voice", (d) => d, { hi: 100, title: "Women's share of office, per cent" }],
  ["conviction", (d) => d, { title: "Convictions as a share of cases due for trial, per cent", fmt: (v) => v.toFixed(1) }],
];
for (const [k, rows, o] of BARS) {
  const el = mount("plot-" + k);
  if (!el || !D[k]) continue;
  const r = rows(D[k]).map((x) => ({ ...x, c: "#B9C3F3" }));   // areas take the pale tint (DESIGN.md §1)
  const p = bars(el, r, { desc: r.map((x) => `${x.label}: ${f1(x.v)}`).join("; "), ...o });
  wire("cb-" + k, p, "gender-" + k, toCsv(["measure", "value"], r.map((x) => [x.label, x.v])));
}
/* ---------- pairs: two instruments or two groups, side by side ---------- */
const PAIRS = [
  ["school", "Enrolment and dropout, boys and girls", {}],
  ["time", "Minutes a day per person, Time Use Survey 2019 and 2024", { fmt: f0 }],
  ["crime-heads", "Crimes against women registered, by head", { fmt: f0, tick: f0 }],
  ["causes", "Share of deaths by cause, men and women", {}],
];
for (const [k, title, o] of PAIRS) {
  const el = mount("plot-" + k);
  if (!el || !D[k]) continue;
  const p = dumbbell(el, D[k], { title, desc: D[k].map((r) => `${r.label}: ${f1(r.a)} and ${f1(r.b)}`).join("; "), ml: 300, ...o });
  wire("cb-" + k, p, "gender-" + k, toCsv(["measure", "first", "second"], D[k].map((r) => [r.label, r.a, r.b])));
}
