// scripts/lib/products/external-flows.mjs: the money that crosses India's border, month by month and
// week by week: reserves, the rupee's price, the RBI's dollar desk, the foreign-exchange market,
// foreign investment, external borrowing, remittances out (LRS) and NRI deposits, rupee invoicing,
// and India's external debt. RBI DBIE through the owner's Data Bank mirror (read-only).
//
// Reports and datasets read (DBIE report ids), and what each becomes:
//   574  Foreign exchange reserves, weekly, US$ / ₹ / SDR, gold in tonnes -> external-reserves-weekly
//   184  Foreign exchange reserves, monthly from March 1990 -> external-reserves-monthly
//   415  Foreign exchange reserves as on 31 March, from 1950-51 -> external-reserves-annual
//   730  Sale and purchase of US dollars by the RBI, monthly, US$ and ₹, the forward book, its
//        maturity profile and the futures segment -> external-intervention, external-intervention-inr,
//        external-forward-book
//   1347 Turnover in the foreign exchange market, monthly -> external-fx-turnover
//   558  Forward premia, monthly average, 1, 3, 6 months -> external-forward-premia
//   698  Daily forward premia (two layouts) -> external-forward-premia-daily
//   719  Monthly average exchange rates, US$, £, €, ¥, from 1966 -> external-rupee
//   1374 Monthly average and month-end rates incl. the SDR -> external-rupee-sdr
//   575  Daily reference rate -> external-rupee-daily
//   691  Daily interbank USD/INR open, high, low, close -> external-rupee-interbank-daily
//   720  Monthly average rates for 155 currencies -> external-rupee-155
//   583  Monthly high and low rates (two layouts) -> external-rupee-highlow
//   768  Month high / low: FEDAI rates and reference-rate extremes -> external-rupee-month-extremes
//   304 / 156  Annual average rates, fiscal and calendar years -> external-rupee-annual(-calendar)
//   34   Foreign investment inflows, monthly: new format (2011-12 on) -> external-fdi; old
//        format (1995 to 2011) -> external-fdi-1995. Two layouts, never joined.
//   290  Foreign investment inflows, annual, US$ and ₹, old and new layouts -> external-fdi-annual*
//   136  Net investment by FPIs, monthly, ₹ -> external-fpi
//   55   External commercial borrowings, monthly registrations: the framework in force to December
//        2024 -> external-ecb; the revised framework from January 2025 (general and special
//        permission, new borrower categories) -> external-ecb-2025; annual -> external-ecb-annual
//   793  Outward remittances under the LRS, monthly -> external-lrs; 752 annual -> external-lrs-annual
//   417  NRI deposits, monthly outstanding and flows by scheme -> external-nri; 420 / 628 / 419 /
//        421 annual flows and stocks, US$ and ₹ -> external-nri-annual(-inr)
//   1550 / 1551  Invoicing and settlement in rupees of exports and imports -> external-invoicing
//   563 / 570  External debt as on end-March, US$ / ₹ -> external-debt-annual(-inr)
//   660  External debt, quarterly, ₹ (creditor lines and, from 2017-18, borrower x maturity x
//        instrument lines) -> external-debt-inr. The US$ provider of 660 in the Data Bank mirror has
//        no amount column (seen 2026-10-08), so the quarterly US$ series comes from
//   CAS EXT_DBT_RT_RN  external debt, quarterly, US$ -> external-debt
//   418  External assistance, annual -> external-assistance
//   695  Mutual funds' foreign liabilities and assets -> external-mf
//
// Hand checks (2026-10-09) are recorded in docs/status/external.md and the bundle notes:
// weekly reserves for the week ended 11 September 2026 are US$ 780,782 million in WSS; the bundle
// carries 780,781.84 (the Data Bank's own validation, docs/RBI_DBIE_SOURCES.md there).
import { writeSeries } from "../util.mjs";
import {
  databankRoot, databankQuery, dbieProviders, provider, actuals, num, monthOf, quarterOf, dayOf, fyStart, fyEnd, fyQuarter,
  monthLabel, vrank, slug, tidy, bakeLong, finish, archive, onAxis, monthAxis, dupHandle,
} from "./external-dbie.mjs";

const MN = 1e6, CR = 1e7;
const RAW = "data/raw/external-dbie";

export async function buildExternalFlows(root, dcfg, vintage, cfg) {
  const db = databankRoot(cfg?.families?.databank);
  const P = (id) => dbieProviders(db, id);
  const meta = (extra) => ({ dossier: "external-flows", source: dcfg.source_agency, geo: "IND", releaseDate: null, mock: false, revisionPolicy: dcfg.revision_policy, base: "as published", ...extra });
  const write = (rel, body, m, gapsNote = "Not published for these periods.") => {
    const b = finish(body, gapsNote);
    if (b.empty.length) m.emptyLines = b.empty;
    delete b.empty; delete b.vintages;
    writeSeries(root, `data/series/${rel}.json`, { meta: { ...m, latestPeriod: m.frequency === "weekly" || m.frequency === "daily" ? b.dates.at(-1) : b.dates.at(-1).slice(0, 7) }, dates: b.dates, series: b.series });
    return b;
  };

  // one bundle per currency of account: the page draws the dollar series, the rupee and SDR
  // valuations are the same holdings at other prices and ride in their own bundle
  const subset = (b, re) => ({ dates: [...b.dates], series: Object.fromEntries(Object.entries(b.series).filter(([k]) => re.test(k)).map(([k, v]) => [k, { ...v, data: [...v.data] }])) });

  /* =================== reserves =================== */
  {
    const prov = P("574");
    const V = archive(root, `${RAW}/reserves-weekly.json`, vintage, "RBI DBIE report 574: foreign exchange reserves, weekly, US$ / ₹ / SDR providers and gold volume in tonnes.", prov);
    const COMP = { TR: "total", FCA: "fca", GOLD: "gold", SDR: "sdr", IMF: "imf" };
    const LAB = { total: "Total reserves", fca: "Foreign currency assets", gold: "Gold", sdr: "Special drawing rights", imf: "Reserve position in the IMF" };
    const CUR = { USD: ["usd", MN, "US$ million"], INR: ["inr", CR, "₹ crore"], SDR: ["sdr", MN, "SDR million"] };
    const rows = prov.filter((p) => ["Dollar", "INR"].includes(p.name)).flatMap((p) => actuals(p).map((r) => ({ ...r, _p: p.name })));
    const b = bakeLong(rows, { date: (r) => dayOf(r["Week End Date (Weekly)"]), round: 2,
      key: (r) => (COMP[r["Fx Reserves Code"]] && CUR[r["Currency Code"]] ? `${COMP[r["Fx Reserves Code"]]}_${CUR[r["Currency Code"]][0]}` : null),
      value: (r) => { const v = num(r.Amount); return v == null ? null : v / CUR[r["Currency Code"]][1]; },
      label: (k, r) => `${LAB[COMP[r["Fx Reserves Code"]]]}, ${CUR[r["Currency Code"]][2]}`,
      order: (r) => `${["USD", "INR", "SDR"].indexOf(r["Currency Code"])}|${r["Fx Reserves Display Order"]}` });
    // gold in tonnes
    const gv = prov.find((p) => p.name === "Gold Vol");
    const g = bakeLong(gv.rows, { date: (r) => dayOf(r["Week End Date (Weekly)"]), key: () => "gold_tonnes", value: (r) => num(r.Amount), round: 3, label: () => "Gold held, tonnes" });
    const all = [...new Set([...b.dates, ...g.dates])].sort();
    onAxis(b, all); onAxis(g, all);
    b.series.gold_tonnes = g.series.gold_tonnes;
    if (!(b.series.total_usd?.data.at(-1) > 100000)) throw new Error("external-flows: weekly reserves anchor failed (no total reserves above US$100 bn in the last week)");
    write("external-reserves-weekly-inr", subset(b, /_(inr|sdr)$/), meta({ frequency: "weekly", unit: "inr_crore", vintage: V, product: "Foreign exchange reserves, weekly (DBIE report 574)",
      coverage: "Foreign exchange reserves every week since April 2001, valued in rupees and in SDRs",
      note: "RBI DBIE report 574, week-ending Fridays plus 31 March and a few holiday-shifted dates. ₹ crore and SDR million: the same holdings as external-reserves-weekly, valued at other prices." }),
    "RBI did not publish the line for these weeks.");
    write("external-reserves-weekly", subset(b, /_(usd|tonnes)$/), meta({ frequency: "weekly", unit: "usd_million", vintage: V, product: "Foreign exchange reserves, weekly (DBIE report 574)",
      coverage: "Foreign exchange reserves every week since April 2001: foreign currency assets, gold, SDRs, IMF position, in dollars, and gold in tonnes",
      note: "RBI DBIE report 574 (Weekly Statistical Supplement table 2), week-ending Fridays. US$ million, ₹ crore, SDR million as published; gold volume in tonnes. A week's change mixes RBI's market operations with revaluation: gold and non-dollar currencies are valued in dollars at market prices. Besides the Fridays, RBI reports reserves as on 31 March each year and on a few holiday-shifted dates; those dates are kept." }),
    "RBI did not publish the line for these weeks.");

    // monthly from March 1990 (Handbook table 184) and annual as on 31 March from 1950-51 (415).
    // Before 1990 the RBI publishes reserves only as on 31 March; DBIE's Data Query element
    // FR_EXG_RESV_M_RN carries the same figures (checked in the catalogue), so it is not baked.
    const P184 = P("184"), P415 = P("415");
    const VM = archive(root, `${RAW}/reserves-monthly-annual.json`, vintage, "RBI DBIE: foreign exchange reserves, monthly (184; its USD, INR and SDR providers carry the same rows, the USD one is archived) and annual as on 31 March (415, all providers).",
      [P184.find((x) => x.name === "USD"), ...P415]);
    const resBody = (rows, dateOf, amt, ccy) => bakeLong(rows, { date: dateOf, round: 2,
      key: (r) => (COMP[r["Fx Reserves Code"]] && CUR[r[ccy]] ? `${COMP[r["Fx Reserves Code"]]}_${CUR[r[ccy]][0]}` : null),
      value: (r) => { const v = num(r[amt]); return v == null ? null : v / CUR[r[ccy]][1]; },
      label: (k, r) => `${LAB[COMP[r["Fx Reserves Code"]]]}, ${CUR[r[ccy]][2]}`,
      order: (r) => `${["USD", "INR", "SDR"].indexOf(r[ccy])}|${r["Fx Reserves Display Order"]}` });
    const m = resBody(actuals(P184.find((x) => x.name === "USD")), (r) => monthOf(r["Time Date"]), "Amount - Monthly", "Currency Code");
    onAxis(m, monthAxis(m.dates[0], m.dates.at(-1)));
    write("external-reserves-monthly", subset(m, /_usd$/), meta({ frequency: "monthly", unit: "usd_million", vintage: VM, product: "Foreign exchange reserves, monthly (DBIE report 184)",
      coverage: "Foreign exchange reserves at the end of every month since March 1990, by component, in dollars",
      note: "RBI DBIE report 184 (Handbook), end of month, plotted at the month, US$ million. The IMF reserve position is shown separately from the 2000s; before that it sat inside the other lines as RBI published them." }),
    "Not reported for these months.");
    write("external-reserves-monthly-inr", subset(m, /_(inr|sdr)$/), meta({ frequency: "monthly", unit: "inr_crore", vintage: VM, product: "Foreign exchange reserves, monthly (DBIE report 184)",
      coverage: "Foreign exchange reserves at the end of every month since March 1990, valued in rupees and in SDRs",
      note: "RBI DBIE report 184, ₹ crore and SDR million: the same holdings as external-reserves-monthly at other prices." }),
    "Not reported for these months.");
    const a = resBody(actuals(P415.find((x) => x.name === "Dollar")), (r) => fyEnd(r["Time Fis Year"]), "amount", "currency_code");
    onAxis(a, monthAxis(a.dates[0], a.dates.at(-1), 12));
    write("external-reserves-annual", a, meta({ frequency: "annual", unit: "usd_million", vintage: VM, product: "Foreign exchange reserves, annual (DBIE report 415)",
      coverage: "Foreign exchange reserves as on 31 March every year since 1951, by component",
      note: "RBI DBIE report 415, as on 31 March, plotted at March. US$ million, ₹ crore, SDR million. SDRs exist from 1970 (the SDR was created in 1969). The table's gold 'volume' provider carries two unlabelled amounts per year and is not read." }),
    "Not reported for these years.");
  }

  /* =================== the RBI's dollar desk =================== */
  {
    const prov = P("730");
    const V = archive(root, `${RAW}/intervention.json`, vintage, "RBI DBIE report 730: sale and purchase of US dollars by the RBI (US$ and ₹), forward book maturity profile, currency futures segment.", prov);
    const sp = (name, scale, unit) => {
      const p = prov.find((x) => x.name === name);
      const K = { "Foreign Currency Purchase": "purchase", "Foreign Currency Sales": "sale", "Outstanding Net Forward sales (-) / purchase (+) at end of month": "forward_outstanding" };
      const L = { purchase: "Gross purchases of dollars", sale: "Gross sales of dollars", forward_outstanding: "Forward book: outstanding net forward sales (−) / purchases (+), end of month" };
      const b = bakeLong(actuals(p), { date: (r) => monthOf(r.Month), key: (r) => K[r["Sale_purchase Item Description"]] ?? null, value: (r) => num(r["Sale_purchase Item_Amount"]), unitScale: scale, round: 3,
        label: (k) => `${L[k]}, ${unit}`, order: (r) => +r["Item Display Order"] });
      onAxis(b, monthAxis(b.dates[0], b.dates.at(-1)));
      // net = purchases - sales, derived, only where both legs are published
      b.series.net = { label: `Net purchase (+) / sale (−), ${unit} (derived: purchases minus sales)`, data: b.series.purchase.data.map((v, i) => (v != null && b.series.sale.data[i] != null ? +(v - b.series.sale.data[i]).toFixed(3) : null)) };
      return b;
    };
    const usd = sp("Sale_dollar", MN, "US$ million");
    // futures segment, same months where published
    const fp = prov.find((x) => x.name === "Query 2");
    const FK = { "Net Purchase/Sale of Foreign Currency (US$Million) (1.1–1.2)": "futures_net", "1.1 Purchase (+)": "futures_purchase", "1.2 Sale (–)": "futures_sale" };
    const f = bakeLong(actuals(fp), { date: (r) => monthOf(r["D Time D Date"]), value: (r) => num(r["Future_segment Item_Amount"]), unitScale: MN, round: 3,
      key: (r) => FK[r["Future_segment Item Description"]] ?? (/Outstanding Net Currency Futures/.test(r["Future_segment Item Description"]) ? "futures_outstanding" : null),
      label: (k) => ({ futures_net: "Currency futures: net purchase (+) / sale (−), US$ million", futures_purchase: "Currency futures: purchases, US$ million", futures_sale: "Currency futures: sales, US$ million", futures_outstanding: "Currency futures: outstanding net position, end of month, US$ million" })[k] });
    onAxis(f, usd.dates);
    Object.assign(usd.series, f.series);
    if (!usd.series.net.data.some((v) => v != null)) throw new Error("external-flows: report 730 served no dollar purchases or sales");
    write("external-intervention", usd, meta({ frequency: "monthly", unit: "usd_million", vintage: V, product: "Sale and purchase of US dollars by the RBI (DBIE report 730)",
      coverage: "The RBI's dollar desk: gross purchases and sales every month since 1995, the net, the outstanding forward book and the currency futures segment",
      note: "RBI DBIE report 730, US$ million. Net = purchases minus sales, derived (the table publishes both legs). The forward book is a stock at the end of the month, not a flow. Months the source leaves blank are months with no reported operations, disclosed per series." }),
    "No operation reported for these months.");
    const inr = sp("Sale_inr", CR, "₹ crore");
    write("external-intervention-inr", inr, meta({ frequency: "monthly", unit: "inr_crore", vintage: V, product: "Sale and purchase of US dollars by the RBI, rupee value (DBIE report 730)",
      coverage: "The RBI's dollar purchases and sales, valued in rupees", note: "RBI DBIE report 730, ₹ crore: the rupee amounts the RBI paid or received. Net derived as purchases minus sales." }),
    "No operation reported for these months.");
    const mp = prov.find((x) => x.name === "Query 3");
    const mb = bakeLong(actuals(mp), { date: (r) => monthOf(r["D Time D Date"]), value: (r) => num(r["Maturity_breakdwown Item_values"]), unitScale: MN, round: 3,
      key: (r) => `${slug(r["Maturity_breakdwown hierarchy_level1"].replace(/^\d\.\s*/, "").replace(/\(.*\)/, ""), 30)}_${/Long/.test(r["Maturity_breakdwown hierarchy_level2"]) ? "long" : /Short/.test(r["Maturity_breakdwown hierarchy_level2"]) ? "short" : "net"}`,
      label: (k, r) => `Forward book, ${r["Maturity_breakdwown hierarchy_level1"].replace(/^\d\.\s*/, "").replace(/\s+/g, " ").toLowerCase()}: ${/Long/.test(r["Maturity_breakdwown hierarchy_level2"]) ? "long (+)" : /Short/.test(r["Maturity_breakdwown hierarchy_level2"]) ? "short (−)" : "net"}, US$ million`,
      order: (r) => +r["Maturity_breakdwown Display Order"] });
    onAxis(mb, monthAxis(mb.dates[0], mb.dates.at(-1)));
    write("external-forward-book", mb, meta({ frequency: "monthly", unit: "usd_million", vintage: V, product: "RBI forward book by residual maturity (DBIE report 730)",
      coverage: "The RBI's outstanding forward dollar position by time to delivery: up to a month, one to three months, three months to a year, over a year",
      note: "RBI DBIE report 730, US$ million, end of month, from 2015. Long = dollars the RBI will receive, short = dollars it must deliver." }));
  }

  /* =================== the foreign exchange market =================== */
  {
    const prov = P("1347"); const p = prov.find((x) => x.name === "Query 1");
    const V = archive(root, `${RAW}/fx-market.json`, vintage, "RBI DBIE: FX market turnover monthly (1347), forward premia monthly (558) and daily (698).", [...prov, ...P("558"), ...P("698")]);
    const b = bakeLong(p.rows, { date: (r) => monthOf(r["Time Date"]), value: (r) => num(r["Amount (in USD Million)"]), unitScale: MN, round: 3,
      key: (r) => [r["Turnover Description"], r["Instrument Type"] || "all", r["Currency Type"] || "all", r["Sales Purchase Flag"]].map((x) => slug(x, 20)).join("_"),
      label: (k, r) => `${r["Turnover Description"]}${r["Instrument Type"] ? ", " + r["Instrument Type"].toLowerCase() : ""}${r["Currency Type"] && r["Currency Type"] !== "Total" ? ", " + r["Currency Type"] : r["Currency Type"] === "Total" ? ", all currency pairs" : ""}: ${r["Sales Purchase Flag"].toLowerCase()}, US$ million`,
      order: (r) => [["Merchant", "Inter-bank", "Grand Total"].indexOf(r["Turnover Description"]), r["Instrument Type"], r["Currency Type"], r["Sales Purchase Flag"]].join("|") });
    onAxis(b, monthAxis(b.dates[0], b.dates.at(-1)));
    write("external-fx-turnover", b, meta({ frequency: "monthly", unit: "usd_million", vintage: V, product: "Turnover in the foreign exchange market (DBIE report 1347)",
      coverage: "How much foreign exchange changes hands in India each month: merchant (customers) and inter-bank, spot, forward, swap and cancellations, rupee and cross-currency, purchases and sales",
      note: "RBI DBIE report 1347, US$ million, monthly sums of daily turnover reported by authorised dealers, since 1996. The grand total equals merchant plus inter-bank in every month but September 2018, where RBI's own table puts the grand total about US$ 28 bn (purchases) and 33 bn (sales) higher; kept as published." }));
    const pm = P("558")[0];
    const fp = bakeLong(pm.rows, { date: (r) => monthOf(r.time_date), key: (r) => `m${r["item description"].match(/^(\d+)/)[1]}`, value: (r) => num(r.item_value), round: 4,
      label: (k, r) => `Forward premium, ${r["item description"]}, per cent a year`, order: (r) => +r["Item Sk"] });
    onAxis(fp, monthAxis(fp.dates[0], fp.dates.at(-1)));
    write("external-forward-premia", fp, meta({ frequency: "monthly", unit: "pct_per_annum", vintage: V, product: "Forward premia, inter-bank, monthly average (DBIE report 558)",
      coverage: "What it costs to buy dollars for later delivery: the annualised forward premium at one, three and six months",
      note: "RBI DBIE report 558, per cent a year, monthly averages of daily inter-bank premia, since 1993. A premium is roughly the interest-rate gap between India and the US." }));
    const pd = P("698")[0];
    // the table's "Reference Rate (in Rs.)" item carries two currencies on the same day with no
    // currency column (82.93 and 89.97 on 5 March 2024: the dollar and the euro), so it is not
    // read; the reference rate is baked from report 575
    const fd = bakeLong(pd.rows.filter((r) => !/^Reference Rate/.test(r["item description"])), { date: (r) => dayOf(r["Report Date"]), round: 4,
      key: (r) => slug(r["item description"].replace(/\(in (Paise|Rs\.)\)/, "$1"), 30), value: (r) => num(r.item_value),
      label: (k, r) => /month$/.test(r["item description"]) ? `Forward premium, ${r["item description"]}, per cent a year` : r["item description"].replace("(in Paise)", ", paise per US$").replace("(in Rs.)", ", ₹ per US$").replace(/\s+,/, ","),
      order: (r) => `${/Paise|Rs/.test(r["item description"]) ? 1 : 0}|${r["item display order"]}` });
    write("external-forward-premia-daily", fd, meta({ frequency: "daily", unit: "mixed", vintage: V, product: "Daily forward premia, inter-bank (DBIE report 698)",
      coverage: "Forward premia every trading day: annualised premia (1, 3, 6 months) and forward cash premia in paise",
      note: "RBI DBIE report 698. Two layouts in one table: annualised premia in per cent a year, and forward cash premia in paise per dollar. The table's reference-rate column mixes the dollar and the euro on the same day with no currency named, so it is left out; the reference rate is in external-rupee-daily. Trading days only." }),
    "Not published on these trading days.");
  }

  /* =================== the rupee's price =================== */
  {
    const V = archive(root, `${RAW}/rupee.json`, vintage, "RBI DBIE exchange-rate tables: 719, 1374, 575, 691, 720, 583, 768, 304, 156.",
      ["719", "1374", "575", "691", "720", "583", "768", "304", "156"].flatMap((id) => P(id)));
    const CUR = { USD: "usd", GBP: "gbp", EUR: "eur", JPY: "jpy", EURO: "eur", YEN: "jpy", SDR: "sdr" };
    const NAME = { usd: "US dollar", gbp: "Pound sterling", eur: "Euro", jpy: "100 Japanese yen", sdr: "SDR", aed: "UAE dirham", idr: "Indonesian rupiah (in RBI's quotation unit)" };
    // 719: monthly average, four currencies, from 1966
    {
      const p = P("719")[0];
      const b = bakeLong(p.rows, { date: (r) => monthOf(r["Time Date"]), key: (r) => CUR[r["Currency Code Dim Currency"]] ?? null, value: (r) => num(r["Forex Rate"]), round: 4,
        // this table quotes the yen per single yen (0.61 in 2026), unlike the RBI's per-100 tables
        label: (k) => `₹ per ${k === "jpy" ? "Japanese yen (one yen)" : NAME[k]}, monthly average`, order: (r) => ["USD", "GBP", "EUR", "JPY"].indexOf(r["Currency Code Dim Currency"]) });
      onAxis(b, monthAxis(b.dates[0], b.dates.at(-1)));
      if (!(b.series.usd?.data.at(-1) > 40)) throw new Error("external-flows: report 719 has no recent USD rate");
      write("external-rupee", b, meta({ frequency: "monthly", unit: "inr_per_unit", vintage: V, product: "Monthly average exchange rates (DBIE report 719)",
        coverage: "The rupee against the dollar, pound, euro and yen, monthly average, since 1966",
        note: "RBI DBIE report 719, rupees per unit of foreign currency, monthly averages of the RBI/FBIL reference rate. This table quotes the yen per single yen, not per 100. The euro starts in January 1999. A higher number is a weaker rupee." }), "No rate published for these months.");
    }
    // 1374: SDR and four currencies (+AED, IDR), average and month-end
    {
      const p = P("1374")[0];
      const ck = { SDR: "sdr", "US Dollar": "usd", "Pound Sterling": "gbp", "Deutsche Mark/Euro": "eur", "Japanese Yen": "jpy", "UAE DIRHAMS": "aed", "INDONESIAN RUPIAHS": "idr" };
      const b = bakeLong(p.rows, { date: (r) => monthOf(r.Date), round: 4,
        key: (r) => (ck[r.Currency] ? `${ck[r.Currency]}_${r.Items === "Monthly Average" ? "avg" : "end"}` : null), value: (r) => num(r.Value),
        label: (k, r) => `₹ per ${NAME[ck[r.Currency]]}, ${r.Items === "Monthly Average" ? "monthly average" : "end of month"}`, order: (r) => `${r["Currency Display Order"].padStart(2, "0")}|${r.Items}` });
      onAxis(b, monthAxis(b.dates[0], b.dates.at(-1)));
      write("external-rupee-sdr", b, meta({ frequency: "monthly", unit: "inr_per_unit", vintage: V, product: "Exchange rate of the rupee vis-a-vis the SDR, US$, £, € and ¥ (DBIE report 1374)",
        coverage: "The rupee against the SDR and the major currencies, monthly average and end of month, since 1992",
        note: "RBI DBIE report 1374. Rupees per unit (yen per 100). The UAE dirham and Indonesian rupiah were added as reference currencies in 2026 and have only a few months." }), "No rate published for these months.");
    }
    // 575: daily reference rate
    {
      const p = P("575")[0];
      const ck = { USD: "usd", GBP: "gbp", EURO: "eur", YEN: "jpy", AED: "aed", IDR: "idr" };
      const b = bakeLong(p.rows, { date: (r) => dayOf(r.Date), key: (r) => ck[r["Currency Code"]] ?? slug(r["Currency Code"], 8), value: (r) => num(r["Exchange Rate"]), round: 4,
        label: (k, r) => `₹ per ${NAME[ck[r["Currency Code"]]] ?? r["Currency Desc"]}, reference rate`, order: (r) => +r["Currency Sk"] });
      write("external-rupee-daily", b, meta({ frequency: "daily", unit: "inr_per_unit", vintage: V, product: "Daily reference rate (DBIE report 575)",
        coverage: "The rupee's reference rate every working day since August 1998: dollar, pound, euro, yen, and from 2026 the dirham and rupiah",
        note: "RBI DBIE report 575: the RBI reference rate to 2018, FBIL's thereafter. Rupees per unit (yen per 100). Working days only." }), "No rate on these working days.");
    }
    // 691: interbank daily OHLC
    {
      const p = P("691")[0];
      // a rate of 0 is a day without a quote, and a value outside 10 to 200 rupees a dollar is a
      // misprint (3,355.73 on one day): both are left empty, never read as a rate
      const b = bakeLong(p.rows, { date: (r) => dayOf(r["Time Date"]), key: (r) => slug(r["Forex Item Description"].replace(/^Interbank /, ""), 20), value: (r) => { const v = num(r["Forex Rate"]); return v != null && v >= 10 && v <= 200 ? v : null; }, round: 4,
        label: (k, r) => `₹ per US$, ${r["Forex Item Description"].toLowerCase()}`, order: (r) => +r["Forex Item Display Order"] });
      write("external-rupee-interbank-daily", b, meta({ frequency: "daily", unit: "inr_per_usd", vintage: V, product: "Daily inter-bank forex rates, USD/INR (DBIE report 691)",
        coverage: "The dollar's price in the inter-bank market each day: open, high, low, close, beside the reference rate",
        note: "RBI DBIE report 691, rupees per US dollar, trading days since August 2000. Days the table records as 0 (no quote) and one misprint (3,355.73) are left empty and disclosed per series." }), "No quote on these trading days (recorded as 0 in the source), or a misprinted value.");
    }
    // 720: 155 currencies
    {
      const p = P("720")[0];
      const b = bakeLong(p.rows, { date: (r) => monthOf(r["Time Date"]), key: (r) => `${slug(r["Currency Code Dim Currency"], 6)}_${slug(r["Currency Description Dim Currency"], 24)}`, value: (r) => num(r["Forex Rate"]), round: 6,
        label: (k, r) => `₹ per ${tidy(r["Currency Description Dim Currency"]).toLowerCase()} (${r["Currency Code Dim Currency"]}), monthly average` });
      onAxis(b, monthAxis(b.dates[0], b.dates.at(-1)));
      write("external-rupee-155", b, meta({ frequency: "monthly", unit: "inr_per_unit", vintage: V, product: "Monthly average exchange rates, 155 currencies (DBIE report 720)",
        coverage: "The rupee against every currency the RBI quotes, monthly average",
        note: "RBI DBIE report 720, rupees per unit of each currency as published (some currencies are quoted per 100 units; the label names the currency, not the quotation unit). Currencies enter and leave the table over the years. A few codes carry two currency names with different rates (SKK as both 'Slovak koruna' and 'koruna'); each name is kept as its own series, as published." }), "No rate published for these months.");
    }
    // 583: monthly high / low, two layouts
    {
      const ps = P("583");
      const ck = { "US Dollar": "usd", "Pound Sterling": "gbp", "Euro": "eur", "Deutsche Mark/Euro": "eur", "Japanese Yen": "jpy", SDR: "sdr", "UAE DIRHAMS": "aed", "INDONESIAN RUPIAHS": "idr" };
      const rows = [];
      for (const p of ps) for (const r of p.rows) {
        const c = ck[r["Currency Desc"]] ?? slug(r["Currency Desc"], 8);
        if (p.header.includes("Hi Buy Exchg Rate")) for (const [col, nm] of [["Hi Buy Exchg Rate", "buy_high"], ["Lw Buy Exchg Rate", "buy_low"], ["Hi Sell Exchg Rate", "sell_high"], ["Lw Sell Exchg Rate", "sell_low"]]) rows.push({ d: r["Time Date"], k: `${c}_${nm}`, v: r[col], cur: r["Currency Desc"], nm });
        else for (const [col, nm] of [["Hi Exchg Rate", "high"], ["Lw Bexchg Rate", "low"]]) rows.push({ d: r["Time Date"], k: `${c}_${nm}`, v: r[col], cur: r["Currency Desc"], nm });
      }
      const b = bakeLong(rows, { date: (r) => monthOf(r.d), key: (r) => r.k, value: (r) => { const v = num(r.v); return v === 0 ? null : v; }, round: 4,
        label: (k, r) => `₹ per ${r.cur}, month ${r.nm.replace("_", " ")}`, order: (r) => r.k });
      onAxis(b, monthAxis(b.dates[0], b.dates.at(-1)));
      write("external-rupee-highlow", b, meta({ frequency: "monthly", unit: "inr_per_unit", vintage: V, product: "Exchange rate of the rupee, high and low during the month (DBIE report 583)",
        coverage: "How far the rupee swung within each month: highest and lowest rates",
        note: "RBI DBIE report 583. Two layouts kept as separate series: buying and selling highs and lows (1993 to 2012) and the reference-rate high and low (2008 on). Zeros in the old layout mean 'not quoted' and are left empty." }), "Not quoted in these months.");
    }
    // 768: month high / low, FEDAI and reference
    {
      const ps = P("768"); const rows = [];
      for (const p of ps) for (const r of p.rows) {
        if (p.name === "FEDAI") rows.push({ d: r["Time Date"], k: `fedai_${slug(r["Forex Item Code"].replace(/^FEDAI_/, ""), 20)}_${slug(r["Currency Code"], 4)}`, v: r["Forex Rate"], l: `FEDAI ${r["Forex Item Description"].replace(/^Monthly FEDAI /, "").replace("(in Rs.)", "").trim().toLowerCase()}, ₹ per ${r["Currency Description"].toLowerCase()}` });
        // the "Max" provider holds both the month's high and low reference rate (Hi Lw column); the
        // "Min" provider is the daily reference rate itself, a copy of report 575, not read here
        else if (p.name === "Reference Rate Max") rows.push({ d: r["Time Date"], k: `ref_${slug(r["Hi Lw Exchg Rate Desc"], 4)}_${slug(r["Currency Code"], 4)}`, v: r["Exchg Rate Value"], l: `Reference rate, month ${r["Hi Lw Exchg Rate Desc"].toLowerCase()}, ₹ per ${r["Currency Desc"]}` });
      }
      const b = bakeLong(rows, { date: (r) => monthOf(r.d), key: (r) => r.k, value: (r) => num(r.v), round: 4, label: (k, r) => r.l, order: (r) => r.k });
      onAxis(b, monthAxis(b.dates[0], b.dates.at(-1)));
      write("external-rupee-month-extremes", b, meta({ frequency: "monthly", unit: "inr_per_unit", vintage: V, product: "Forex rates, month high and month low (DBIE report 768)",
        coverage: "The month's highest and lowest rupee rates: FEDAI quotes (2000 to 2012) and reference-rate extremes",
        note: "RBI DBIE report 768. Reference-rate month highs and lows run from August 1998 to January 2024; FEDAI offer and bid extremes from 2000 to 2012. The report's third provider repeats the daily reference rate (report 575, baked as external-rupee-daily)." }), "Not published in these months.");
    }
    // annual: fiscal (304) and calendar (156)
    for (const [id, rel, fiscal] of [["304", "external-rupee-annual", true], ["156", "external-rupee-annual-calendar", false]]) {
      const p = P(id)[0];
      const vcol = fiscal ? "Value Financial Year" : "Value Cal Year";
      const ycol = fiscal ? "Fiscal Year_HBS_Table_148" : "Calendar Year_HBS_Table_147";
      const b = bakeLong(p.rows, { date: (r) => (fiscal ? fyStart(r[ycol]) : (/^\d{4}$/.test(r[ycol]) ? `${r[ycol]}-01-01` : null)), round: 4,
        key: (r) => `${slug(r.Currency.replace("Deutsche Mark/Euro", "eur").replace("D.M./Euro", "eur"), 12)}_${slug(r.Items, 12)}`, value: (r) => num(r[vcol]),
        label: (k, r) => `₹ per ${r.Currency}, ${r.Items.toLowerCase()}`, order: (r) => `${r.Currency}|${r.Items}` });
      onAxis(b, monthAxis(b.dates[0], b.dates.at(-1), 12));
      write(rel, b, meta({ frequency: "annual", unit: "inr_per_unit", vintage: V, product: `Exchange rate of the rupee, annual (DBIE report ${id})`,
        coverage: `The rupee's yearly average${fiscal ? " and end-year rate" : ""} against the SDR, dollar, pound, Deutsche Mark/euro and yen, ${fiscal ? "fiscal" : "calendar"} years`,
        note: `RBI DBIE report ${id} (Handbook table), rupees per unit (yen per 100). ${fiscal ? "Fiscal years plotted at April of the first year." : "Calendar years."} Before 1999 the European column is the Deutsche Mark.` }), "Not published for these years.");
    }
  }

  /* =================== foreign investment =================== */
  {
    const prov = P("34");
    const V = archive(root, `${RAW}/foreign-investment.json`, vintage, "RBI DBIE: foreign investment inflows monthly (34, new and old formats), annual (290), net FPI investment (136).", [...prov, ...P("290"), ...P("136")]);
    const fiKey = (s) => { const m = s.match(/^([A-Z](?:\.[A-Za-z]+)*\.?\)?)\s+(.*)$/); const n = (m ? m[1] : "").replace(/[.)]+$/, "").toLowerCase().replace(/\./g, "_"); return `${n ? n + "_" : ""}${slug(tidy(m ? m[2] : s).replace(/\s*\(.*$/, ""), 30)}`; };
    const fiLabel = (s) => tidy(s).replace(/\s*\([A-Za-z.+\-]+\)\s*$/, "").replace(/\s+/g, " ");
    for (const [name, rel, cov, note] of [
      ["Query 1 (New Format)", "external-fdi", "Foreign investment flows every month since April 2011: direct investment into India (gross, repatriation, net), Indian direct investment abroad, portfolio flows",
        "RBI DBIE report 34 (new format), US$ million, monthly. Direct investment to India is gross inflows minus repatriation; FDI by India is net of its own repatriation. Portfolio flows here are FPI net purchases as reported, monthly."],
      ["Query 1 (Old Format)", "external-fdi-1995", "Foreign investment inflows by route, monthly, 1995 to 2011 (old format)",
        "RBI DBIE report 34 (old format), US$ million. The old format reports gross inflows only, with no repatriation or outward FDI lines; a different table from the post-2011 format, never joined to it."]]) {
      const p = prov.find((x) => x.name === name);
      const b = bakeLong(actuals(p), { date: (r) => monthLabel(r.Month), key: (r) => fiKey(r["Investment Items Description (RBIB)"]), value: (r) => num(r["Amount (US $ Million)"]), unitScale: MN, round: 3,
        label: (k, r) => fiLabel(r["Investment Items Description (RBIB)"]), order: (r) => +(r["Item Display Order"] ?? r.Sequence) });
      onAxis(b, monthAxis(b.dates[0], b.dates.at(-1)));
      write(rel, b, meta({ frequency: "monthly", unit: "usd_million", vintage: V, product: `Foreign investment inflows (DBIE report 34, ${name.includes("New") ? "new" : "old"} format)`, coverage: cov, note }),
      "Not published for these months.");
    }
    // annual, 290: four providers
    for (const [name, rel, scale, unit, col] of [["USD OLD", "external-fdi-annual", MN, "usd_million", "Item Value Usd Million"], ["INR OLD", "external-fdi-annual-inr", CR, "inr_crore", "Item Value Inr Crore"],
      ["USD NEW", "external-fdi-annual-new", MN, "usd_million", "Amount (US $ Million)"], ["INR New", "external-fdi-annual-new-inr", CR, "inr_crore", "Amount (Rs. crore)"]]) {
      const p = P("290").find((x) => x.name === name);
      const b = bakeLong(actuals(p), { date: (r) => fyStart(r.Year), key: (r) => fiKey(r.Items), value: (r) => num(r[col]), unitScale: scale, round: 3,
        label: (k, r) => fiLabel(r.Items), order: (r) => +r["Item Display Order"] });
      onAxis(b, monthAxis(b.dates[0], b.dates.at(-1), 12));
      write(rel, b, meta({ frequency: "annual", unit, vintage: V, product: `Foreign investment inflows, annual (DBIE report 290, ${name})`,
        coverage: `Foreign investment, fiscal years${name.includes("NEW") || name.includes("New") ? ", the summary lines of the current layout" : ", every line of the older layout"}${unit === "inr_crore" ? ", in rupees" : ""}`,
        note: `RBI DBIE report 290 (Handbook), ${unit === "inr_crore" ? "₹ crore" : "US$ million"}, fiscal years plotted at April of the first year. The Handbook keeps two layouts: the older detailed one (1990-91 to 2022-23) and the current summary (2000-01 on); they are separate series.` }),
      "Not published for these years.");
    }
    // 136: net FPI investment, ₹ crore, monthly
    {
      const p = P("136")[0];
      const b = bakeLong(actuals(p), { date: (r) => monthLabel(r.Month), key: () => "fpi_net", value: (r) => num(r.Value), unitScale: CR, round: 2, label: () => "Net investment by FPIs in the Indian capital market, ₹ crore" });
      onAxis(b, monthAxis(b.dates[0], b.dates.at(-1)));
      write("external-fpi", b, meta({ frequency: "monthly", unit: "inr_crore", vintage: V, product: "Net investment by FPIs in the Indian capital market (DBIE report 136)",
        coverage: "Foreign portfolio investors' net purchases of Indian shares and bonds, every month since 1992, in rupees",
        note: "RBI DBIE report 136 (Handbook), ₹ crore, net purchases (purchases minus sales) in equity and debt as reported by the depositories. Not the BoP portfolio line: different timing and coverage." }),
      "Not published for these months.");
    }
  }

  /* =================== external commercial borrowings =================== */
  {
    const prov = P("55");
    const V = archive(root, `${RAW}/ecb.json`, vintage, "RBI DBIE report 55: external commercial borrowings, monthly and annual registrations.", prov);
    const p = prov.find((x) => x.name === "Monthly");
    const lab = (r) => `${r["Ecb Reg Hierarchy Level 1"].replace(/^\d+\.\s*/, "").replace(/\s+/g, " ")}: ${r["Ecb Reg Hierarchy Level 2"].replace(/^[\dIVX]+\.[\d.]*\s*|^[a-g]\.?\)\s*/, "").replace(/\s+/g, " ")}`.replace(/^Borrower Category: /, "Borrower: ");
    const unitOf = (code) => (/_NUM|NUMBER/.test(code) ? "number" : /WAM/.test(code) ? "years" : /INT_RATE/.test(code) ? "per cent" : "US$ million");
    const scaleOf = (code) => (unitOf(code) === "US$ million" ? MN : 1);
    // DBIE stamps each line with the classification it belongs to (Start/End Effective Date). Lines
    // of the framework revised in January 2025 start 2025-01-01; the earlier classification's lines
    // run on beside them to February 2026; headline lines (totals, maturity, rates) carry 1901 and
    // belong to both. Keys carry the classification's start year so no two regimes share a series.
    const sy = (r) => (r["Start Effective Date"] || "1901").slice(0, 4);
    const kOf = (r) => `${slug(r["Ecb Reg Description"], 28)}${sy(r) === "1901" ? "" : "_" + sy(r)}`;
    for (const [rel, keep, cov, note] of [
      ["external-ecb", (r) => sy(r) < "2025", "External commercial borrowings registered each month since April 2004 under the earlier classification: number, amount, automatic and approval routes, maturity, interest, and borrower industries",
        "RBI DBIE report 55, US$ million (counts as numbers, maturity in years, rates in per cent). The classification in force before the January 2025 revision; DBIE carries its borrower lines to February 2026. Lines are keyed by the year their classification took effect."],
      ["external-ecb-2025", (r) => sy(r) >= "2025" || (sy(r) === "1901" && monthOf(r["Time Date"]) >= "2025-01-01"), "External commercial borrowings registered each month under the revised framework, from January 2025: general and special permission, borrower categories",
        "RBI DBIE report 55. From January 2025 the RBI reports registrations by general and special permission and new borrower categories; a different classification from the earlier routes, never joined to it. Headline totals are the same figures as in external-ecb."]]) {
      const rows = actuals(p).filter((r) => monthOf(r["Time Date"]) && keep(r));
      const b = bakeLong(rows, { date: (r) => monthOf(r["Time Date"]), key: kOf, value: (r) => num(r["Ecb Reg Value"]),
        unitScale: 1, round: 4, label: (k, r) => `${lab(r)}, ${unitOf(r["Ecb Reg Description"])}`, order: (r) => `${sy(r)}|${String(+r["Ecb Display Order"]).padStart(4, "0")}` });
      for (const [k, s] of Object.entries(b.series)) { const code = k.toUpperCase(); if (scaleOf(code) !== 1) s.data = s.data.map((v) => (v == null ? null : +(v / MN).toFixed(3))); }
      onAxis(b, monthAxis(b.dates[0], b.dates.at(-1)));
      write(rel, b, meta({ frequency: "monthly", unit: "mixed", vintage: V, product: "External commercial borrowings, registrations (DBIE report 55)", coverage: cov, note }), "Not published for these months.");
    }
    const a = prov.find((x) => x.name === "Annual");
    const b = bakeLong(actuals(a), { date: (r) => fyStart(r["Time Fis Year"]), key: (r) => slug(r["Ecb Reg Description"], 32) + "_" + String(+r["Ecb Display Order"]), value: (r) => num(r["Ecb Reg Value"]), round: 4,
      label: (k, r) => `${lab(r)}, ${unitOf(r["Ecb Reg Description"])}`, order: (r) => +r["Ecb Display Order"] });
    for (const [k, s] of Object.entries(b.series)) if (scaleOf(k.toUpperCase().replace(/_\d+$/, "")) !== 1) s.data = s.data.map((v) => (v == null ? null : +(v / MN).toFixed(3)));
    onAxis(b, monthAxis(b.dates[0], b.dates.at(-1), 12));
    write("external-ecb-annual", b, meta({ frequency: "annual", unit: "mixed", vintage: V, product: "External commercial borrowings, annual (DBIE report 55)",
      coverage: "External commercial borrowings registered each fiscal year, by route and borrower", note: "RBI DBIE report 55 (annual provider), fiscal years plotted at April of the first year; both frameworks' lines are kept as published." }),
    "Not published for these years.");
  }

  /* =================== remittances out (LRS) =================== */
  {
    const V = archive(root, `${RAW}/lrs.json`, vintage, "RBI DBIE: outward remittances under the LRS, monthly (793) and annual (752).", [...P("793"), ...P("752")]);
    const lk = (s) => slug(tidy(s).replace(/^[\d.]+\s*/, "").replace(/\s*\(.*$/, ""), 32);
    const p = P("793")[0];
    const b = bakeLong(actuals(p), { date: (r) => monthOf(r["Month (RBIB)"]), key: (r) => (/^1 Outward/.test(r["Item Desc"]) ? "total" : lk(r["Item Desc"])), value: (r) => num(r["Amount (in USD Million)"]), unitScale: MN, round: 3,
      label: (k, r) => (k === "total" ? "Total outward remittances under the LRS" : tidy(r["Item Desc"]).replace(/^[\d.]+\s*/, "").replace(/\*+$/, "")) + ", US$ million", order: (r) => +r["Remittance Display Order"] });
    onAxis(b, monthAxis(b.dates[0], b.dates.at(-1)));
    if (!(b.series.total?.data.at(-1) > 100)) throw new Error("external-flows: LRS anchor failed");
    write("external-lrs", b, meta({ frequency: "monthly", unit: "usd_million", vintage: V, product: "Outward remittances under the Liberalised Remittance Scheme (DBIE report 793)",
      coverage: "What resident Indians send abroad each month under the LRS: travel, studies, relatives, gifts, investments, property, deposits",
      note: "RBI DBIE report 793, US$ million, monthly. Travel is split into business, pilgrimage, medical, education and other travel only for a few recent months. The LRS limit is US$ 250,000 a person a year." }), "Not published for these months.");
    const pa = P("752")[0];
    const ba = bakeLong(actuals(pa), { date: (r) => fyStart(r["Time Fis Year"]), key: (r) => (/^1 Outward/.test(r["Item Desc"]) ? "total" : lk(r["Item Desc"])), value: (r) => num(r["Amount (in USD Million)"]), unitScale: MN, round: 3,
      label: (k, r) => (k === "total" ? "Total outward remittances under the LRS" : tidy(r["Item Desc"]).replace(/^[\d.]+\s*/, "").replace(/\*+$/, "")) + ", US$ million", order: (r) => +r["Remittance Display Order"] });
    onAxis(ba, monthAxis(ba.dates[0], ba.dates.at(-1), 12));
    write("external-lrs-annual", ba, meta({ frequency: "annual", unit: "usd_million", vintage: V, product: "Outright remittances under the LRS, yearly (DBIE report 752)",
      coverage: "LRS remittances by purpose, fiscal years 2008-09 to 2024-25", note: "RBI DBIE report 752, US$ million, fiscal years plotted at April of the first year." }), "Not published for these years.");
  }

  /* =================== NRI deposits =================== */
  {
    const V = archive(root, `${RAW}/nri.json`, vintage, "RBI DBIE: NRI deposits monthly (417) and annual flows and stocks (419, 420, 421, 628).", ["417", "419", "420", "421", "628"].flatMap((id) => P(id)));
    const SCH = { "1.1 FCNR(B)": "fcnr_b", "1.2 NR(E)RA": "nre", "1.3 NRO": "nro" };
    const SL = { fcnr_b: "FCNR(B), foreign-currency deposits", nre: "NR(E)RA, rupee deposits, repatriable", nro: "NRO, rupee deposits, non-repatriable" };
    const p = P("417").find((x) => x.name === "Month End");
    const b = bakeLong(actuals(p), { date: (r) => monthOf(r["Time Date"]), round: 3, unitScale: MN, value: (r) => num(r["Amount (USD Million) Monthly"]),
      key: (r) => (SCH[r["Instrumet(HBS) Monthly"]] ? `${SCH[r["Instrumet(HBS) Monthly"]]}_${/Outstanding/.test(r["Item Hierarchy Level1"]) ? "outstanding" : "flow"}` : null),
      label: (k) => `${SL[k.replace(/_(outstanding|flow)$/, "")]}: ${/outstanding$/.test(k) ? "outstanding, end of month" : "inflow (+) / outflow (−) in the month"}, US$ million`,
      order: (r) => `${/Outstanding/.test(r["Item Hierarchy Level1"]) ? 0 : 1}|${r.item_display_order}` });
    onAxis(b, monthAxis(b.dates[0], b.dates.at(-1)));
    // total outstanding, derived, where all three schemes are published
    const o = ["fcnr_b", "nre", "nro"].map((k) => b.series[`${k}_outstanding`].data);
    b.series.total_outstanding = { label: "All NRI deposits outstanding, US$ million (derived: sum of the three schemes)", data: o[0].map((_, i) => (o.every((s) => s[i] != null) ? +(o[0][i] + o[1][i] + o[2][i]).toFixed(3) : null)) };
    write("external-nri", b, meta({ frequency: "monthly", unit: "usd_million", vintage: V, product: "NRI deposits (DBIE report 417)",
      coverage: "Money Indians abroad keep in Indian banks: outstanding and monthly flows for FCNR(B), NRE and NRO accounts",
      note: "RBI DBIE report 417, US$ million. NRO balances are published from 2005 (outstanding) and with flows from then; the total is derived only where all three are published. Flows are not the change in outstanding: outstanding amounts also move with the rupee's value." }), "Not published for these months.");
    for (const [ids, rel, unit, scale] of [[["420", "628"], "external-nri-annual", "usd_million", MN], [["419", "421"], "external-nri-annual-inr", "inr_crore", CR]]) {
      const rows = [];
      for (const id of ids) for (const pp of P(id)) {
        const amt = pp.header.find((h) => /^Amount/.test(h)); if (!amt) continue;
        const ins = pp.header.find((h) => /^Instrume?n?t\(HBS\)$/.test(h) || /^Instrumet\(HBS\)$/.test(h));
        const yr = pp.header.includes("Fiscal Year") ? "Fiscal Year" : "Time Date";
        for (const r of actuals(pp)) rows.push({ d: yr === "Fiscal Year" ? fyStart(r[yr]) : fyStart(`${+r[yr].slice(0, 4) - 1}-${r[yr].slice(2, 4)}`), k: `${slug(r[ins], 12)}_${id === ids[0] ? "flow" : "outstanding"}`, v: r[amt], l: `${r[ins]}: ${id === ids[0] ? "inflow (+) / outflow (−) in the year" : "outstanding at end-March"}` });
      }
      const ba = bakeLong(rows, { date: (r) => r.d, key: (r) => r.k, value: (r) => num(r.v), unitScale: scale, round: 3, label: (k, r) => `${r.l}, ${unit === "usd_million" ? "US$ million" : "₹ crore"}`, order: (r) => r.k });
      onAxis(ba, monthAxis(ba.dates[0], ba.dates.at(-1), 12));
      write(rel, ba, meta({ frequency: "annual", unit, vintage: V, product: `NRI deposit schemes, annual (DBIE reports ${ids.join(", ")})`,
        coverage: `NRI deposits by scheme since 1990-91, including closed schemes (FCNR(A), NR(NR)RD, FC(B&O)D, FC(O)N): yearly flows and end-March stocks${unit === "inr_crore" ? ", in rupees" : ""}`,
        note: `RBI DBIE reports ${ids.join(" and ")}. Fiscal years plotted at April of the first year; stocks are as on 31 March at the end of that year. Closed schemes stop when they were wound up.` }), "Not published for these years.");
    }
  }

  /* =================== invoicing in rupees =================== */
  {
    const V = archive(root, `${RAW}/invoicing.json`, vintage, "RBI DBIE: invoicing (1550) and settlement (1551) in INR of exports of goods and software and imports of goods.", [...P("1550"), ...P("1551")]);
    const rows = [];
    for (const [id, what] of [["1550", "invoiced"], ["1551", "settled"]]) for (const r of P(id).find((x) => x.name === "Query 1").rows)
      rows.push({ ...r, _k: `${what}_${slug(r["Item Description"], 20)}`, _l: `${/Export/.test(r["Item Description"]) ? "Exports of goods and software" : "Imports of goods"} ${what} in rupees, ${/Percent/.test(r["Item Description"]) ? "share of the total, per cent" : "₹ crore"}, fiscal year to date` });
    const b = bakeLong(rows, { date: (r) => monthOf(r["Time Date"]), key: (r) => r._k, value: (r) => { const v = num(r["Item Value"]); return /Percent/.test(r["Item Description"]) ? v : v == null ? null : v / CR; },
      rank: (r) => vrank(r["Version Desc"]), version: (r) => r["Version Desc"], round: 3, label: (k, r) => r._l, order: (r) => r._k });
    onAxis(b, monthAxis(b.dates[0], b.dates.at(-1)));
    write("external-invoicing", b, meta({ frequency: "monthly", unit: "mixed", vintage: V, product: "Invoicing and settlement in INR of India's trade (DBIE reports 1550, 1551)",
      coverage: "How much of India's trade is priced and paid in rupees rather than dollars",
      note: "RBI DBIE reports 1550 and 1551. Cumulative from April of each fiscal year (fiscal year to date), so values rise through the year and restart in April; shares in per cent, amounts in ₹ crore. The first point is the full year 2023-24 (as on March 2024). RBI has not published every month: missing months are disclosed per series." }),
    "RBI did not publish these months.");
  }

  /* =================== external debt =================== */
  {
    const V = archive(root, `${RAW}/external-debt.json`, vintage, "RBI DBIE: external debt end-March, US$ (563) and ₹ (570); quarterly ₹ (660, whose US$ provider has no amount column in the mirror); Data Bank CAS element EXT_DBT_RT_RN (quarterly US$ and ₹).",
      [...P("563"), ...P("570"), ...P("660")]);
    const dk = (s) => { const m = s.match(/^(E\.[\d.]+)\s+(.*)$/); return m ? `${m[1].toLowerCase().replace(/\./g, "_")}_${slug(tidy(m[2]).replace(/\s*\(.*$/, ""), 30)}` : slug(tidy(s), 40); };
    const dl = (s) => tidy(s).replace(/\s*\([0-9.]+ ?To ?[0-9.]+\)\s*/i, " ").replace(/\s+/g, " ").trim();
    // ratio lines: DBIE also carries some of them multiplied by a million (the latest year's
    // short-term share is both 19.56 and 19564873.05); a per cent above 1,000 is that glitch and is
    // divided back, so the two copies agree. Labels of the "As % of total debt" lines come from
    // the table's own hierarchy column, since three lines share that text.
    const isPct = (r) => /%|Ratio/.test(r["External Debt Classification"]);
    const pctFix = (v, scale) => (v != null && Math.abs(v) > 1000 ? v / scale : v);   // the glitch factor is the table's own unit (million for US$, crore for ₹)
    const pctLabel = (r) => { const h = r["Ext Debt Hierarchy Level1"]?.trim(); const L = r["External Debt Classification"];
      return /^E\.3 /.test(L) ? "Long-term debt (line E.2) as % of total debt" : h && /%/.test(h) ? h : dl(L); };
    for (const [id, rel, unit, scale, col] of [["563", "external-debt-annual", "usd_million", MN, "Amount (USD million)"], ["570", "external-debt-annual-inr", "inr_crore", CR, null]]) {
      const p = P(id)[0]; const c = col ?? p.header.find((h) => /^Amount/.test(h));
      const taken = new Map();
      const b = bakeLong(actuals(p), { date: (r) => fyEnd(r["Fiscal Year"]),
        key: (r) => { let k = dk(r["External Debt Classification"]); if (taken.has(k) && taken.get(k) !== r.ext_debt_code) k += "_" + r.ext_debt_code; taken.set(k, r.ext_debt_code); return k; },
        value: (r) => { const v = num(r[c]); return isPct(r) ? (v == null ? null : pctFix(v, scale) * scale) : v; }, unitScale: scale, round: 3,
        rank: (r) => vrank(r["Version Desc"]), version: (r) => r["Version Desc"], label: (k, r) => (isPct(r) ? `${pctLabel(r)}${/%|ratio/i.test(pctLabel(r)) ? "" : ", per cent"}` : `${dl(r["External Debt Classification"])}${unit === "usd_million" ? ", US$ million" : ", ₹ crore"}`),
        order: (r) => +r.ext_debt_code });
      onAxis(b, monthAxis(b.dates[0], b.dates.at(-1), 12));
      if (id === "563" && !(b.series["e_1_gross_external_debt_position"]?.data.at(-1) > 300000)) throw new Error("external-flows: external debt anchor failed (gross debt line missing or implausible)");
      write(rel, b, meta({ frequency: "annual", unit, vintage: V, product: `India's external debt, end-March (DBIE report ${id})`,
        coverage: `India's external debt as on 31 March each year since 1991, by creditor and instrument, with the debt ratios${unit === "inr_crore" ? ", in rupees" : ""}`,
        note: `RBI DBIE report ${id}. Stocks as on 31 March, plotted at March. Ratio lines (long-term and short-term shares, concessional share, debt to GDP, debt service, reserves to debt) are in per cent; where DBIE carries a ratio multiplied by the table's unit (a million, or a crore in rupees) it is divided back (the two copies then agree). Latest revision of each year.` }), "Not published for these years.");
    }
    // quarterly, rupees (660): creditor lines and, from 2017-18, the sector x maturity x instrument lines
    {
      const p = P("660").find((x) => x.name === "INR");
      // the ratio lines (E.3, E.5, E.7, E.8, E.9) are not read from this table: their values are
      // scaled by a crore and, for several 2017-18 and 2018-19 quarters, are amounts rather than
      // ratios (E.9 "reserves to total debt" reads 2,217,440,472,510 at March 2018). The end-March
      // table (563) carries the same ratios cleanly: external-debt-annual.
      const rows = actuals(p).filter((r) => /^\d{4}-\d{2}:Q[1-4]$/.test(r.Quarter) && r.Quarter >= "1999-00:Q2" && !/%|Ratio/.test(r["External Debt Classification"]));
      // QEDS lines (display order >= 80): labels with their sector and maturity parents
      const q = [...new Map(rows.filter((r) => +r["item display order"] >= 80).map((r) => [r["Ext Debt Code"], { code: r["Ext Debt Code"], label: r["External Debt Classification"], o: +r["item display order"] }])).values()].sort((a, b) => a.o - b.o);
      const ql = new Map(); let sector = "", maturity = "";
      for (const it of q) {
        const L = it.label.replace(/\s+/g, " ").trim();
        if (/^(I|II|III|IV|V)\.\s/.test(L) || /^IV\.\d\.\s/.test(L)) { sector = L.replace(/^[IV]+\.(\d\.)?\s*/, ""); maturity = ""; ql.set(it.code, sector); }
        else if (/^[IV]+\.(\d\.)?[AB]\.\s/.test(L)) { maturity = L.replace(/^[IV]+\.(\d\.)?[AB]\.\s*/, ""); ql.set(it.code, `${sector}, ${maturity.toLowerCase()}`); }
        else if (/^[ABC]\.\s/.test(L)) ql.set(it.code, `${sector}: ${L.replace(/^[ABC]\.\s*/, "")}`);
        else if (/^Gross External Debt Position/.test(L)) ql.set(it.code, "Gross external debt position (by borrowing sector)");
        else ql.set(it.code, `${sector}, ${maturity.toLowerCase()}: ${L.replace(/^\(\w+\)\s*/, "")}`);
      }
      const taken = new Map();
      const b = bakeLong(rows, { date: (r) => fyQuarter(r.Quarter), value: (r) => num(r["Amount (Rs. Crore)"]), unitScale: CR, round: 3,
        key: (r) => { const qd = ql.get(r["Ext Debt Code"]); let k = qd ? `s_${slug(qd, 50)}` : dk(r["External Debt Classification"]); if (taken.has(k) && taken.get(k) !== r["Ext Debt Code"]) k += "_" + r["Ext Debt Code"]; taken.set(k, r["Ext Debt Code"]); return k; },
        rank: (r) => vrank(r["Version Desc"]), version: (r) => r["Version Desc"],
        label: (k, r) => `${ql.get(r["Ext Debt Code"]) ?? dl(r["External Debt Classification"])}${/%|Ratio/.test(r["External Debt Classification"]) ? ", per cent" : ", ₹ crore"}`,
        order: (r) => +r["item display order"] || 999 });
      onAxis(b, monthAxis(b.dates[0], b.dates.at(-1), 3));
      write("external-debt-sector-inr", subset(b, /^s_/), meta({ frequency: "quarterly", unit: "inr_crore", vintage: V, product: "External debt of India, quarterly, rupees (DBIE report 660)",
        coverage: "India's external debt by who borrowed (government, RBI, banks, companies, households), for how long and through what instrument, quarterly from March 2021, in rupees",
        note: "RBI DBIE report 660, ₹ crore, the IMF's borrower-by-maturity layout (quarterly external debt statistics), stocks at the end of each quarter plotted at the quarter's first month. Shares of the total are the same in rupees and dollars at any one date. The rupee value of dollar debt moves with the exchange rate." }),
      "Not published for these quarters.");
      for (const k of Object.keys(b.series)) if (/^s_/.test(k)) delete b.series[k];
      write("external-debt-inr", b, meta({ frequency: "quarterly", unit: "inr_crore", vintage: V, product: "External debt of India, quarterly, rupees (DBIE report 660)",
        coverage: "India's external debt at the end of every quarter since September 1999, in rupees, by creditor and instrument",
        note: "RBI DBIE report 660, ₹ crore, stocks at the end of each quarter plotted at the quarter's first month, by creditor (lines E.1...). The same table's borrower-by-maturity layout (from March 2021) is external-debt-sector-inr. The rupee value of dollar debt moves with the exchange rate. The table's ratio lines are left out (scaled by a crore, and amounts in place of ratios in some 2017-19 quarters); the ratios are in external-debt-annual. The table's US$ column is missing from the Data Bank mirror; the dollar series is external-debt." }),
      "Not published for these quarters.");
    }
    // quarterly, US$, from the CAS element
    {
      const qq = databankQuery(db, "rbi_dbie_cas_money", "select observation_date, series_key, series_label, arg_max(value, source_retrieved_at) as value from {table} where dsd_code='EXT_DBT_RT_RN' group by 1,2,3 order by 1,2");
      const VQ = archive(root, `${RAW}/external-debt-cas.json`, vintage, "Data Bank parsed dataset rbi_dbie_cas_money, element EXT_DBT_RT_RN (external debt, quarterly), latest parse per observation.",
        [{ id: "cas", name: "EXT_DBT_RT_RN", header: ["observation_date", "series_key", "series_label", "value"], rows: qq.rows.map((r) => ({ ...r, value: String(r.value) })), provenance: { report_id: "CAS:EXT_DBT_RT_RN", ...qq.provenance } }]);
      const rows = qq.rows.filter((r) => /unit_measure=USD$/.test(r.series_key));
      const b = bakeLong(rows, { date: (r) => quarterOf(r.observation_date), value: (r) => r.value, unitScale: MN, round: 3,
        key: (r) => slug(r.series_key.match(/typ_ext_debt_rn=([A-Z_]+)/)[1], 30),
        label: (k, r) => `${r.series_label.split(" / ").reverse().join(": ").replace(/^Gross Debt: /, "").replace(/\s+/g, " ")}, US$ million` });
      onAxis(b, monthAxis(b.dates[0], b.dates.at(-1), 3));
      write("external-debt", b, meta({ frequency: "quarterly", unit: "usd_million", vintage: VQ, product: "External debt of India, quarterly, US$ (DBIE Data Query element EXT_DBT_RT_RN)",
        coverage: "India's external debt at the end of every quarter since June 2004, in dollars, by creditor and instrument",
        note: "RBI DBIE Data Query element EXT_DBT_RT_RN through the Data Bank, US$ million, stocks at the end of each quarter plotted at the quarter's first month. This element ends one quarter before the rupee table (report 660); the end-March 2026 dollar figure is in external-debt-annual." }),
      "Not published for these quarters.");
    }
  }

  /* =================== external assistance, mutual funds =================== */
  {
    const V = archive(root, `${RAW}/assistance-mf.json`, vintage, "RBI DBIE: external assistance (418), mutual funds' foreign liabilities and assets (695).", [...P("418"), ...P("695")]);
    for (const [name, rel, unit, scale] of [["usd", "external-assistance", "usd_million", MN], ["inr", "external-assistance-inr", "inr_crore", CR]]) {
      const p = P("418").find((x) => x.name === name);
      const b = bakeLong(actuals(p), { date: (r) => fyStart(r["Fiscal Year"]), key: (r) => slug(r["Item Description"], 30), value: (r) => num(r["Item Value"]), unitScale: scale, round: 3,
        label: (k, r) => `External assistance: ${r["Item Description"].toLowerCase()}, ${unit === "usd_million" ? "US$ million" : "₹ crore"}`, order: (r) => +r["Item Display Order"] });
      onAxis(b, monthAxis(b.dates[0], b.dates.at(-1), 12));
      write(rel, b, meta({ frequency: "annual", unit, vintage: V, product: "External assistance (DBIE report 418)",
        coverage: `Foreign aid to India: loans and grants authorised and used, debt service on them, and the net inflow, fiscal years${unit === "inr_crore" ? ", in rupees" : ""}`,
        note: "RBI DBIE report 418, fiscal years plotted at April of the first year." }), "Not published for these years.");
    }
    for (const [name, rel, unit, scale, col] of [["USD", "external-mf", "usd_million", MN, "Amount In Usr Million"], ["INR", "external-mf-inr", "inr_crore", CR, "Amount In Inr Crore"]]) {
      const p = P("695").find((x) => x.name === name);
      const b = bakeLong(actuals(p), { date: (r) => fyEnd(r["Time Fis Year"]), key: (r) => `t${r["Table No"]}_${slug(r["Name Of Company"], 16)}_${slug(r["Lib Ass Type"], 24)}`, value: (r) => num(r[col]), unitScale: scale, round: 3,
        label: (k, r) => `${r["Name Of Company"]}, ${r["Lib Ass Desc"].replace("Assests", "assets").toLowerCase()}: ${r["Lib Ass Type"].replace("Assests", "assets").toLowerCase()} (DBIE table ${r["Table No"]}), ${unit === "usd_million" ? "US$ million" : "₹ crore"}`, order: (r) => `${r["Table No"]}|${r["Type Of Company"]}|${r["Subject Sk"]}` });
      onAxis(b, monthAxis(b.dates[0], b.dates.at(-1), 12));
      write(rel, b, meta({ frequency: "annual", unit, vintage: V, product: "Foreign liabilities and assets of mutual funds and asset management companies (DBIE report 695)",
        coverage: "What Indian mutual funds and their managers owe abroad and own abroad, end-March", note: "RBI DBIE report 695, from the annual census of foreign liabilities and assets; as on 31 March. DBIE keys the lines by table number without naming the tables; the asset management companies' lines in table 1 equal the mutual funds' market-value liabilities plus other liabilities (6,113 = 6,107 + 6 US$ million in 2008-09), so table 1 looks like the combined total. Kept as published, with the table number in each label." }), "Not published for these years.");
    }
  }
}

/* ---------------- catalogue ---------------- */

export function catalogue(db) {
  const items = [], handles = {};
  const add = (id, label, dims) => items.push({ id, label, dims });
  const each = (rep, rows, keyFn, labFn, dims = {}) => {
    const seen = new Set();
    for (const r of rows) { const k = keyFn(r); if (k == null || seen.has(k)) continue; seen.add(k); add(`dbie:${rep}:${k}`, labFn(r), { report: rep, ...dims }); }
    handles[rep] = "primary";
  };
  const P = (id) => dbieProviders(db, id);
  const copy = (dup, prim, cell, note, min) => {
    handles[dup] = dupHandle(db, prim, dup, cell, undefined, min);
    add(`dbie:${dup}:copy`, `${note} (DBIE report ${dup}): the same table as report ${prim}`, { report: dup, copyOf: prim, match: handles[dup].match, cells: handles[dup].cells });
  };
  // reserves
  each("574", P("574").flatMap((p) => actuals(p).map((r) => ({ ...r, _p: p.name }))), (r) => `${slug(r["Fx Reserves Code"] ?? "gold", 6)}:${slug(r["Currency Code"] ?? r._p, 8)}`, (r) => `Reserves, weekly: ${r["Components of Forex Reserves"]} (${r["Currency"] ?? r._p})`, { freq: "weekly" });
  // value cells only: the tables' "Volume" providers run two numbers together (853.64 tonnes of
  // gold reads 5265299180853.64 on 6 September 2024), so volumes are compared nowhere and baked
  // only from report 574's clean "Gold Vol" provider
  const cellWk = (r) => { const d = r["Week End Date (Weekly)"]; const a = r.Amount; const c = r["Currency Code"] ?? r.currency_code; return d && a && c && r["Unit Description"] === "ACTUALS" ? [`${d}|${r["Fx Reserves Code"]}|${c}`, num(a)] : null; };
  copy("1", "574", cellWk, "Foreign exchange reserves, weekly (WSS table 2)");
  copy("53", "574", cellWk, "Foreign exchange reserves, weekly (Bulletin)");
  copy("687", "574", cellWk, "Foreign exchange reserves, weekly (Forex Reserve menu)");
  copy("95", "574", cellWk, "Foreign exchange reserves, weekly (Handbook)");
  for (const id of ["184", "414", "415", "816"]) { const p = P(id)[0]; add(`dbie:${id}:table`, `${p.provenance.report ?? "Foreign exchange reserves"} (DBIE report ${id})`, { report: id, freq: /415|816/.test(id) ? "annual" : "monthly" }); handles[id] = "primary"; }
  // intervention, market
  each("730", P("730").flatMap((p) => actuals(p).map((r) => ({ ...r, _p: p.name }))), (r) => {
    const d = (r["Sale_purchase Item Description"] ?? r["Future_segment Item Description"] ?? r["Maturity_breakdwown Item Description"] ?? "").replace(/\s+/g, " ").trim();
    return d ? `${slug(r._p, 12)}:${slug(d, 40)}` : null;
  }, (r) => `RBI dollar desk (${r._p}): ${(r["Sale_purchase Item Description"] ?? r["Future_segment Item Description"] ?? r["Maturity_breakdwown Item Description"] ?? "").replace(/\s+/g, " ").trim()}`, { freq: "monthly" });
  copy("14", "730", (r) => r.Month && r["Sale_purchase Item Description"] && r["Unit Description"] === "ACTUALS" ? [`${r.Month}|${r["Sale_purchase Item Description"]}|${r["Sale_purchase Item_Amount"]}`, num(r["Sale_purchase Item_Amount"])] : null, "Sale and purchase of US dollars by the RBI (Bulletin)");
  copy("92", "730", (r) => r.Month && r["Sale_purchase Item Description"] && r["Unit Description"] === "ACTUALS" ? [`${r.Month}|${r["Sale_purchase Item Description"]}|${r["Sale_purchase Item_Amount"]}`, num(r["Sale_purchase Item_Amount"])] : null, "Sales and purchases of US dollar by the RBI (Handbook)");
  each("1347", P("1347").find((p) => p.name === "Query 1").rows, (r) => [r["Turnover Description"], r["Instrument Type"] || "all", r["Currency Type"] || "all", r["Sales Purchase Flag"]].map((x) => slug(x, 20)).join(":"),
    (r) => `FX turnover: ${r["Turnover Description"]} ${r["Instrument Type"] ?? ""} ${r["Currency Type"] ?? ""} ${r["Sales Purchase Flag"]}`.replace(/\s+/g, " "), { freq: "monthly" });
  copy("1507", "1347", (r) => r["Time Date"] && r["Amount (in USD Million)"] ? [`${r["Time Date"]}|${r["Turnover Description"]}|${r["Instrument Type"]}|${r["Currency Type"]}|${r["Sales Purchase Flag"]}`, num(r["Amount (in USD Million)"])] : null, "Turnover in the foreign exchange market (Handbook)");
  each("694", P("694").find((p) => p.name === "Query 1").rows, (r) => [r["Turnover Description"], r["Tr Item Description"], r["Fx Currency Description"], r["Trade Description"]].map((x) => slug(x, 16)).join(":"),
    (r) => `FX turnover, daily: ${r["Turnover Description"]} ${r["Tr Item Description"]} ${r["Fx Currency Description"]} ${r["Trade Description"]}`, { freq: "daily" });
  each("558", P("558")[0].rows, (r) => slug(r["item description"], 10), (r) => `Forward premium, monthly average, ${r["item description"]}`, { freq: "monthly" });
  copy("578", "558", (r) => r.time_date && r.item_value ? [`${r.time_date}|${r["item description"]}`, num(r.item_value)] : null, "Forward premia, monthly average (Handbook)");
  each("698", P("698")[0].rows, (r) => slug(r["item description"], 30), (r) => `Forward premium, daily: ${r["item description"]}`, { freq: "daily" });
  copy("260", "698", (r) => r["Report Date"] && r.item_value ? [`${r["Report Date"]}|${r["item description"]}`, num(r.item_value)] : null, "Daily forward premia (Handbook)");
  each("767", P("767")[0].rows, (r) => slug(r["Item Description"], 30), (r) => `Forward premium, daily (paise): ${r["Item Description"]}`, { freq: "daily" });
  // rupee
  each("719", P("719")[0].rows, (r) => slug(r["Currency Code Dim Currency"], 4), (r) => `Rupee monthly average: ${r["Currency Description Dim Currency"]}`, { freq: "monthly" });
  each("1374", P("1374")[0].rows, (r) => `${slug(r.Currency, 16)}:${slug(r.Items, 14)}`, (r) => `Rupee vs ${r.Currency}, ${r.Items}`, { freq: "monthly" });
  copy("146", "1374", (r) => r.Date && r.Currency && r.Items ? [`${r.Date}|${r.Currency}|${r.Items}`, num(r.Value)] : null, "Exchange rate of the rupee vis-a-vis the SDR and major currencies (Handbook)");
  each("575", P("575")[0].rows, (r) => slug(r["Currency Code"], 6), (r) => `Daily reference rate: ${r["Currency Desc"]}`, { freq: "daily" });
  copy("268", "575", (r) => r.Date && r["Currency Code"] ? [`${r.Date}|${r["Currency Code"]}`, num(r["Exchange Rate"])] : null, "Daily exchange rate of the rupee (Handbook)");
  copy("675", "575", (r) => r.Date && r["Currency Code"] ? [`${r.Date}|${r["Currency Code"]}`, num(r["Exchange Rate"])] : null, "Daily exchange rate of the rupee (Forex Market menu)");
  each("691", P("691")[0].rows, (r) => slug(r["Forex Item Description"], 20), (r) => `Daily inter-bank USD/INR: ${r["Forex Item Description"]}`, { freq: "daily" });
  each("720", P("720")[0].rows, (r) => slug(r["Currency Code Dim Currency"], 6), (r) => `Monthly average rate: ${tidy(r["Currency Description Dim Currency"])}`, { freq: "monthly" });
  each("583", P("583").flatMap((p) => p.rows.map((r) => ({ ...r, _p: p.name }))), (r) => `${slug(r._p, 10)}:${slug(r["Currency Desc"], 12)}`, (r) => `Monthly high and low (${r._p}): ${r["Currency Desc"]}`, { freq: "monthly" });
  copy("1505", "583", (r) => r["Time Date"] && r["Currency Desc"] ? [`${r["Time Date"]}|${r["Currency Desc"]}|${r["Hi Exchg Rate"] ?? r["Hi Buy Exchg Rate"]}`, num(r["Lw Bexchg Rate"] ?? r["Lw Sell Exchg Rate"])] : null, "Exchange rate high and low (Handbook)");
  each("768", P("768").flatMap((p) => p.rows.map((r) => ({ ...r, _p: p.name }))), (r) => `${slug(r._p, 20)}:${slug(r["Forex Item Code"] ?? r["Currency Code"], 20)}:${slug(r["Currency Code"], 4)}`, (r) => `Month high/low (${r._p}): ${r["Forex Item Description"] ?? r["Currency Desc"]}`, { freq: "monthly" });
  each("304", P("304")[0].rows, (r) => `${slug(r.Currency, 16)}:${slug(r.Items, 12)}`, (r) => `Rupee, fiscal-year ${r.Items}: ${r.Currency}`, { freq: "annual" });
  each("156", P("156")[0].rows, (r) => `${slug(r.Currency, 16)}:${slug(r.Items, 12)}`, (r) => `Rupee, calendar-year ${r.Items}: ${r.Currency}`, { freq: "annual" });
  copy("1348", "304", (r) => r["Fiscal Year_HBS_Table_148"] && r.Currency ? [`${r["Fiscal Year_HBS_Table_148"]}|${r.Currency}|${r.Items}`, num(r["Value Financial Year"])] : null, "Exchange rate of the rupee, fiscal years (Forex Market menu)");
  copy("1349", "156", (r) => r["Calendar Year_HBS_Table_147"] && r.Currency ? [`${r["Calendar Year_HBS_Table_147"]}|${r.Currency}|${r.Items}`, num(r["Value Cal Year"])] : null, "Exchange rate of the rupee, calendar years (Forex Market menu)");
  // foreign investment
  each("34", P("34").flatMap((p) => actuals(p).map((r) => ({ ...r, _p: p.name }))), (r) => `${/New/.test(r._p) ? "new" : "old"}:${slug(r["Investment Items Description (RBIB)"], 40)}`, (r) => `Foreign investment inflows, monthly (${/New/.test(r._p) ? "new" : "old"} format): ${tidy(r["Investment Items Description (RBIB)"])}`, { freq: "monthly" });
  copy("997", "34", (r) => r.Month && r["Investment Items Description (RBIB)"] && r["Unit Description"] === "ACTUALS" ? [`${r.Month}|${r["Investment Items Description (RBIB)"]}`, num(r["Amount (US $ Million)"])] : null, "Foreign investment inflows (International Finance menu)");
  each("290", P("290").flatMap((p) => actuals(p).map((r) => ({ ...r, _p: p.name }))), (r) => `${slug(r._p, 8)}:${slug(r.Items, 40)}`, (r) => `Foreign investment inflows, annual (${r._p}): ${tidy(r.Items)}`, { freq: "annual" });
  each("1064", actuals(P("1064")[0]), (r) => slug(r["Item Description Bulletin"], 40), (r) => `Foreign investment inflows, yearly: ${tidy(r["Item Description Bulletin"])}`, { freq: "annual" });
  each("136", actuals(P("136")[0]), () => "fpi_net", () => "Net investment by FPIs in the Indian capital market, monthly, ₹", { freq: "monthly" });
  copy("1354", "136", (r) => r.Month && r.Unit === "1" ? [r.Month, num(r.Value)] : null, "Net investments by FIIs in the Indian capital market (Equity and Corporate Debt Market menu)");
  // ECB, LRS, NRI, invoicing
  each("55", P("55").filter((p) => /^(Monthly|Annual)$/.test(p.name)).flatMap((p) => actuals(p).map((r) => ({ ...r, _p: p.name }))), (r) => `${slug(r._p, 8)}:${slug(r["Ecb Reg Description"], 32)}`, (r) => `ECB registrations (${r._p.toLowerCase()}): ${r["Ecb Reg Hierarchy Level 1"]}, ${r["Ecb Reg Hierarchy Level 2"]}`.replace(/\s+/g, " "), { freq: "monthly" });
  each("793", actuals(P("793")[0]), (r) => slug(tidy(r["Item Desc"]), 40), (r) => `LRS outward remittances, monthly: ${tidy(r["Item Desc"])}`, { freq: "monthly" });
  copy("19", "793", (r) => r["Month (RBIB)"] && r["Item Desc"] && r["Unit Description"] === "ACTUALS" ? [`${r["Month (RBIB)"]}|${r["Item Desc"]}`, num(r["Amount (in USD Million)"])] : null, "Outward remittances under the LRS (Bulletin)");
  each("752", actuals(P("752")[0]), (r) => slug(tidy(r["Item Desc"]), 40), (r) => `LRS outward remittances, yearly: ${tidy(r["Item Desc"])}`, { freq: "annual" });
  each("417", actuals(P("417").find((p) => p.name === "Month End")), (r) => `${slug(r["Item Hierarchy Level1"], 12)}:${slug(r["Instrumet(HBS) Monthly"], 12)}`, (r) => `NRI deposits, monthly: ${r["Instrumet(HBS) Monthly"]}, ${r["Item Hierarchy Level1"]}`, { freq: "monthly" });
  copy("33", "417", (r) => r["Time Date"] && r["Instrumet(HBS) Monthly"] && r["Unit Description"] === "ACTUALS" ? [`${r["Time Date"]}|${r["Instrumet(HBS) Monthly"]}|${r["Item Hierarchy Level1"]}`, num(r["Amount (USD Million) Monthly"])] : null, "NRI deposits (Bulletin)");
  for (const id of ["419", "420", "421", "628"]) { const p = P(id).find((x) => x.header.some((h) => /^Amount/.test(h))); const ins = p.header.find((h) => /^Instrume?n?t\(HBS\)$/.test(h) || /^Instrumet\(HBS\)$/.test(h));
    each(id, actuals(p), (r) => slug(r[ins], 12), (r) => `NRI deposits, annual (${id}): ${r[ins]}`, { freq: "annual" }); }
  each("1550", P("1550").find((p) => p.name === "Query 1").rows, (r) => slug(r["Item Description"], 20), (r) => `Invoicing in INR: ${r["Item Description"]}`, { freq: "monthly" });
  each("1551", P("1551").find((p) => p.name === "Query 1").rows, (r) => slug(r["Item Description"], 20), (r) => `Settlement in INR: ${r["Item Description"]}`, { freq: "monthly" });
  // debt
  for (const id of ["563", "570"]) each(id, actuals(P(id)[0]), (r) => slug(r["External Debt Classification"], 50), (r) => `External debt, end-March (${id === "563" ? "US$" : "₹"}): ${r["External Debt Classification"]}`, { freq: "annual" });
  const cellDebtA = (r) => r["Fiscal Year"] && r["External Debt Classification"] && r["Unit Description"] === "ACTUALS" ? [`${r["Fiscal Year"]}|${r.ext_debt_code}|${r["Version Desc"]}`, num(r[Object.keys(r).find((k) => /^Amount/.test(k))])] : null;
  copy("561", "563", cellDebtA, "India's external debt, US$, end-March (Public Debt Statistics)");
  copy("532", "563", cellDebtA, "India's external debt, US$, end-March (Handbook)");
  copy("571", "570", cellDebtA, "India's external debt, ₹, end-March (Public Debt Statistics)");
  copy("569", "570", cellDebtA, "India's external debt, ₹, end-March (Handbook)");
  { const pi = P("660").find((p) => p.name === "INR");
    each("660", actuals(pi), (r) => `inr:${slug(r["Ext Debt Code"], 8)}`, (r) => `External debt, quarterly (₹): ${r["External Debt Classification"]}`, { freq: "quarterly" });
    const pu = P("660").find((p) => p.name === "USD");
    for (const r of actuals(pu)) { const k = `dbie:660:usd:${slug(r["Ext Debt Code"], 8)}`; if (!items.some((i) => i.id === k)) add(k, `External debt, quarterly (US$): ${r["External Debt Classification"]}`, { report: "660", freq: "quarterly", unit: "usd", amountColumn: pu.header.some((h) => /^Amount/.test(h)) }); } }
  { const cell = (r) => r.Quarter && r["Ext Debt Code"] && r["Unit Description"] === "ACTUALS" && r["Amount (Rs. Crore)"] ? [`${r.Quarter}|${r["Ext Debt Code"]}|${r["Version Desc"]}`, num(r["Amount (Rs. Crore)"])] : null;
    handles["603"] = dupHandle(db, "660", "603", cell, (ps) => ps.filter((p) => p.name === "INR"));
    add("dbie:603:copy", "External debt of India, quarterly (Public Debt Statistics, DBIE report 603): the same table as report 660", { report: "603", copyOf: "660", match: handles["603"].match }); }
  // assistance, mutual funds
  each("418", P("418").flatMap((p) => actuals(p).map((r) => ({ ...r, _p: p.name }))), (r) => `${r._p}:${slug(r["Item Description"], 30)}`, (r) => `External assistance (${r._p}): ${r["Item Description"]}`, { freq: "annual" });
  copy("528", "418", (r) => r["Fiscal Year"] && r["Item Description"] && r["Unit Description"] === "ACTUALS" ? [`${r["Fiscal Year"]}|${r["Item Description"]}|${r["Item Value"]}`, num(r["Item Value"])] : null, "External assistance, US$ (Handbook)");
  each("695", P("695").flatMap((p) => actuals(p).map((r) => ({ ...r, _p: p.name }))), (r) => `${r._p}:${slug(r["Name Of Company"], 16)}:${slug(r["Lib Ass Type"], 24)}`, (r) => `Mutual funds' foreign liabilities and assets (${r._p}): ${r["Name Of Company"]}, ${r["Lib Ass Type"]}`, { freq: "annual" });
  each("696", actuals(P("696").find((p) => p.name === "Query 1 (1)")), (r) => `table_${r["Table No"]}:${slug(r["Country Name"], 30)}`, (r) => `Mutual funds' foreign liabilities and assets by country, table ${r["Table No"]}: ${r["Country Name"]}`, { freq: "annual" });
  // international banking statistics: one item per statement and data provider
  for (const id of ["1384", "1385", "1386", "1387", "1388", "1389", "1390", "1391", "1392", "1393", "1394"]) {
    for (const p of P(id)) { if (!p.header.some((h) => /^Measure/.test(h))) continue;
      add(`dbie:${id}:${slug(p.name, 16)}`, `${p.provenance.report ?? "International banking statistics"} (provider "${p.name}", ${p.header.filter((h) => /^Measure/.test(h)).length} unnamed measures)`, { report: id, freq: "quarterly", measures: p.header.filter((h) => /^Measure/.test(h)).length }); }
    handles[id] = "primary";
  }
  return { items, handles };
}
