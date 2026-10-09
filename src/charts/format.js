// src/charts/format.js — THE number renderers. One definition of every
// display format, imported by the page clients (via plumbing.js) and by
// scripts/qc.mjs alike, so a formatter change can never false-fail qc or
// desync a plate from its gate. qc's per-id checks render the expected
// string THROUGH these same functions.
//
// Convention: a minus is the typographic "−" (U+2212), never a hyphen,
// wherever it leads a rendered figure.

const MINUS = "−";
export const inr = (v) => Math.round(v).toLocaleString("en-IN");

export const pct2 = (v) => v.toFixed(2) + "%";
export const pct1 = (v) => v.toFixed(1) + "%";
export const pct0 = (v) => v.toFixed(0) + "%";
export const pct3 = (v) => v.toFixed(3) + "%";
// signed variants: −1.2% / +1.2%
export const pct1Minus = (v) => (v < 0 ? MINUS + Math.abs(v).toFixed(1) : v.toFixed(1)) + "%";
export const pct2Minus = (v) => (v < 0 ? MINUS : "") + Math.abs(v).toFixed(2) + "%";
export const pct2Plus = (v) => "+" + v.toFixed(2) + "%";
export const pct1Plus = (v) => "+" + v.toFixed(1) + "%";

export const pt1 = (v) => v.toFixed(1) + " pt";
export const pt1Plus = (v) => "+" + v.toFixed(1) + " pt";
export const pt2 = (v) => v.toFixed(2) + " pt";

// rupee figures, Indian digit-grouped
export const inrR = (v) => "₹" + inr(v);
export const lakh2 = (v) => (v / 1e5).toFixed(2) + "lakh";
export const crore2 = (v) => (v / 1e7).toFixed(2) + "crore";

// US$ billions: "auto" switches to whole dollars at three digits (the
// external-account plates), "fixed" never does; bnRound is a plain rounding
export const bnAuto = (v) => "$" + (Math.abs(v) >= 100 ? Math.round(Math.abs(v)) : Math.abs(v).toFixed(1)) + " bn";
export const bnAutoMinus = (v) => (v < 0 ? MINUS + "$" : "$") + bnAuto(v).slice(1);
export const bnFixed1 = (v) => (v < 0 ? MINUS + "$" : "$") + Math.abs(v).toFixed(1) + " bn";
export const bnRound = (v) => "$" + Math.round(v) + " bn";

export const gw1 = (v) => (v / 1000).toFixed(1) + "GW";
export const kg1 = (v) => v.toFixed(1) + " kg";
export const kg2 = (v) => v.toFixed(2) + " kg";
export const x1 = (v) => v.toFixed(1) + "×";
export const x2 = (v) => v.toFixed(2) + "×";
export const count = (v) => String(Math.round(v));

// bare numbers and composites the plates assemble themselves
export const num1 = (v) => v.toFixed(1);
export const num3 = (v) => v.toFixed(3);
export const num2 = (v) => v.toFixed(2);
export const pt0 = (v) => v.toFixed(0) + " pt";
export const inr2 = (v) => "₹" + v.toFixed(2);
export const lakhN = (v) => (v / 1e5).toFixed(2);
export const croreN = (v) => (v / 1e7).toFixed(2);
// ₹ lakh crore, from values already in lakh crore (BSR-2 deposits)
export const lc1 = (v) => "₹" + v.toFixed(1) + " lakh crore";
