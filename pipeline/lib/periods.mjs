// pipeline/lib/periods.mjs — period labelling and parsing, calendar-aware.
// THE one place fiscal-vs-calendar semantics live: facts.mjs labels periods
// with makePeriodLabel, verify.mjs parses prose period references back to
// axis indices with makePeriodIndex. A dossier declares `calendar` in
// src/dossiers/registry.js: "fiscal-apr" (Indian official statistics:
// FY ends March, Q1 = Apr–Jun) or "calendar" (World Bank/OWID style:
// Q1 = Jan–Mar, annual labels are bare years).

export const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export const MONTHS_FULL = ["january","february","march","april","may","june","july","august","september","october","november","december"];

/** iso "YYYY-MM-DD" → human label for the bundle's frequency and calendar. */
export function makePeriodLabel(frequency, calendar = "fiscal-apr") {
  const monthly = frequency === "monthly";
  const annual = frequency === "annual";
  const fiscal = calendar === "fiscal-apr";
  return (iso) => {
    const [y, m] = iso.split("-").map(Number);
    if (monthly) return `${MONTHS_SHORT[m - 1]} ${y}`;
    if (annual) return fiscal ? "FY" + String(y + 1).slice(2) : String(y);
    if (fiscal) {
      // any month of the quarter names it (start-month axes, 04/07/10/01, and the quarter-end
      // axes of stocks as on 30 June, 30 September, 31 December, 31 March, alike)
      const q = Math.floor(((m - 4 + 12) % 12) / 3) + 1;
      return "Q" + q + " FY" + String(q === 4 ? y : y + 1).slice(2);
    }
    return "Q" + Math.ceil(m / 3) + " " + y;
  };
}

/** human period reference → index into the bundle's date axis (or -1). */
export function makePeriodIndex(dates, frequency, calendar = "fiscal-apr") {
  const monthly = frequency === "monthly";
  const annual = frequency === "annual";
  const fiscal = calendar === "fiscal-apr";
  return (str) => {
    str = str.trim().replace(/\./g, "").replace(/\s+/g, " ");
    if (monthly) {
      const m = str.match(/^([A-Za-z]+)\s+(\d{4})$/);
      if (!m) return -1;
      const mi = MONTHS_FULL.findIndex((f) => f.startsWith(m[1].toLowerCase().slice(0, 3)));
      if (mi < 0) return -1;
      return dates.indexOf(`${m[2]}-${String(mi + 1).padStart(2, "0")}-01`);
    }
    if (annual && !fiscal) return dates.indexOf(`${str}-01-01`);   // "2024" on a calendar axis
    const fq = str.match(/^Q([1-4])\s*FY\s?(\d{2})$/i);            // fiscal: Q1 = Apr–Jun
    if (fq) {
      // FY label is the ENDING year (facts.mjs: 2025-04 → "Q1 FY26",
      // 2026-01 → "Q4 FY26"), so the ISO year is FY−1 for Q1–Q3, FY for Q4.
      const qn = Number(fq[1]);
      const isoY = 2000 + Number(fq[2]) - (qn === 4 ? 0 : 1);
      const mm = { 1: "04", 2: "07", 3: "10", 4: "01" }[qn];
      const i = dates.indexOf(`${isoY}-${mm}-01`);
      if (i >= 0) return i;
      // a quarter-end axis (stocks as on the quarter's last day): the quarter's third month
      const me = { 1: "06", 2: "09", 3: "12", 4: "03" }[qn];
      return dates.indexOf(`${isoY}-${me}-01`);
    }
    const cq = str.match(/^Q([1-4])\s+(\d{4})$/);                  // calendar: Q1 = Jan–Mar
    if (!cq) return -1;
    return dates.indexOf(`${cq[2]}-${{ 1: "01", 2: "04", 3: "07", 4: "10" }[cq[1]]}-01`);
  };
}

/** year-ago lag in periods: 12 monthly, 1 annual, 4 quarterly. */
export function yearLag(frequency) {
  return frequency === "monthly" ? 12 : frequency === "annual" ? 1 : 4;
}
