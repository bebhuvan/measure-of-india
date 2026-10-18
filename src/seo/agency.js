// src/seo/agency.js: the statistical agency behind a bundle, as structured data names it.
// A bundle's meta.source is free text written for readers ("Reserve Bank of India, Handbook of
// Statistics on Indian States (via DBIE)", "Crime in India, National Crime Records Bureau, as
// reprinted in MoSPI's Women and Men in India 2025 (table 6.1)"). Dataset markup wants the
// organisation that made the figures, so the first rule that matches the part of the source before
// "as reprinted in" wins; the reprinting agency is named as the publisher. A source no rule knows
// falls back to its own first clause, never to a guess.

const ORGS = [
  [/Reserve Bank of India|\bRBI\b|DBIE/, "Reserve Bank of India", "https://www.rbi.org.in/"],
  [/National Crime Records Bureau/, "National Crime Records Bureau", "https://ncrb.gov.in/"],
  [/Registrar General of India|Sample Registration System|Civil Registration System|Census of India/, "Office of the Registrar General and Census Commissioner, India", "https://censusindia.gov.in/"],
  [/National Family Health Survey|NFHS|IIPS|International Institute for Population Sciences/, "International Institute for Population Sciences and the Ministry of Health and Family Welfare", "https://www.iipsindia.ac.in/"],
  [/UDISE|AISHE|All India Survey on Higher Education|Ministry of Education|School Education and Literacy|Educational Statistics/, "Ministry of Education, Government of India", "https://www.education.gov.in/"],
  [/Labour Bureau/, "Labour Bureau, Ministry of Labour and Employment", "https://labourbureau.gov.in/"],
  [/DPIIT|Office of the Economic Adviser|Promotion of Industry and Internal Trade/, "Office of the Economic Adviser, DPIIT", "https://eaindustry.nic.in/"],
  [/Ministry of New and Renewable Energy/, "Ministry of New and Renewable Energy", "https://mnre.gov.in/"],
  [/Ministry of Commerce|TradeStat|DGCI&S/, "Directorate General of Commercial Intelligence and Statistics, Ministry of Commerce and Industry", "https://www.dgciskol.gov.in/"],
  [/Pension Fund Regulatory/, "Pension Fund Regulatory and Development Authority", "https://www.pfrda.org.in/"],
  [/National Housing Bank/, "National Housing Bank", "https://nhb.org.in/"],
  [/NABARD/, "National Bank for Agriculture and Rural Development", "https://www.nabard.org/"],
  [/Election Commission/, "Election Commission of India", "https://www.eci.gov.in/"],
  [/Bank for International Settlements|\bBIS\b/, "Bank for International Settlements", "https://www.bis.org/"],
  [/World Bank/, "World Bank", "https://www.worldbank.org/"],
  [/\bILO\b|ILOSTAT/, "International Labour Organization", "https://ilostat.ilo.org/"],
  [/UN DESA|World Population Prospects/, "United Nations, Department of Economic and Social Affairs, Population Division", "https://population.un.org/wpp/"],
  [/\bEmber\b/, "Ember", "https://ember-energy.org/"],
  [/Our World in Data/, "Our World in Data", "https://ourworldindata.org/"],
  [/Computed by Measure of India/, null, null],
  // MoSPI last: many sources above are reprinted by it, and the reprint rule handles those
  [/MoSPI|National Statistic(?:al|s) Office|\bNSO\b|National Sample Survey|\bNSS\b|Periodic Labour Force Survey|Time Use Survey|Annual Survey of|Central Statistical Organisation|Energy Statistics India/, "National Statistics Office, Ministry of Statistics and Programme Implementation", "https://www.mospi.gov.in/"],
];

const MOSPI = ORGS.at(-1);
const org = (name, url) => ({ "@type": "Organization", name, ...(url ? { url } : {}) });

/** { creator, publisher? } schema.org Organizations for a bundle's meta.source. */
export function agencyOf(source, site) {
  const text = String(source ?? "").trim();
  const [made, reprint] = text.split(/,?\s+as (?:reprinted|republished|published) (?:in|by)\s+/);
  const hit = ORGS.find(([re]) => re.test(made));
  let creator;
  if (hit && hit[1]) creator = org(hit[1], hit[2]);
  else if (hit) creator = org(site.name, site.url + "/");   // our own computation, from named sources
  else creator = org(made.split(/[,;(]/)[0].trim() || text, null);
  const publisher = reprint && MOSPI[0].test(reprint) && creator.name !== MOSPI[1] ? org(MOSPI[1], MOSPI[2]) : null;
  return { creator, publisher };
}
