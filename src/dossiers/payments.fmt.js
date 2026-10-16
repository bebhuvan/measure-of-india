// src/dossiers/payments.fmt.js: the payments guide's number renderers, shared by the page
// (payments.astro), its charts (payments.charts.js) and scripts/qc.mjs, so a rendered figure and its gate can never
// disagree. Bundles store volumes as counts and values as rupees (DBIE's ACTUALS).
const grp = (v, d = 0) => v.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });

/** a count in crore, readable: whole from 100 crore up (23658353000 -> "2,366 crore"), else one decimal ("60.5 crore") */
export const crore = (v) => grp(v / 1e7, Math.abs(v) >= 1e9 ? 0 : 1) + " crore";
/** a count in lakh, one decimal: 252508 -> "2.5 lakh" */
export const lakh = (v) => grp(v / 1e5, 1) + " lakh";
/** a count, read at its own scale: crore from a crore, lakh from a lakh, else whole */
export const count = (v) => (Math.abs(v) >= 1e7 ? crore(v) : Math.abs(v) >= 1e5 ? lakh(v) : grp(Math.round(v)));
/** rupees in lakh crore, one decimal: 29878804800000 -> "₹29.9 lakh crore" */
export const lakhCrore = (v) => "₹" + grp(v / 1e12, 1) + " lakh crore";
/** rupees in crore, whole: 7716600000 -> "₹772 crore"; below ₹100 crore, two decimals */
export const rsCrore = (v) => "₹" + (Math.abs(v) >= 1e9 ? grp(v / 1e7) : grp(v / 1e7, 2)) + " crore";
/** rupees, read at their own scale */
export const rs = (v) => (Math.abs(v) >= 1e12 ? lakhCrore(v) : Math.abs(v) >= 1e7 ? rsCrore(v) : "₹" + grp(Math.round(v)));
/** a rupee amount per payment, whole rupees: 1262.93 -> "₹1,263" */
export const rupees = (v) => "₹" + grp(Math.round(v));
/** a growth rate, signed, one decimal */
export const growth = (a, b) => { const g = (a / b - 1) * 100; return (g < 0 ? "−" : "+") + Math.abs(g).toFixed(1) + "%"; };
/** a share, one decimal */
export const share = (a, b) => ((100 * a) / b).toFixed(1) + "%";
