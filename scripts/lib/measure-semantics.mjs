// Test the measure, not a household/occupation label attached to its universe.
// Structured source cells identify their submeasure explicitly; older bundles
// still carry that semantic information in their full label/name/coverage.
export function isWageRate(s,unit,meta={}){
 if(!/^inr(_per_(day|hour|month|30_days|year))?$/.test(unit??''))return false;
 const measure=s.dims?.sub_indicator??s.dims?.subindicator??s.dims?.measure;
 const text=measure??`${s.label} ${s.name} ${meta.coverage??''}`;
 // Household income components can be zero when no member earns from that activity.
 // A rupee amount naming wages is not necessarily a rate per employed person.
 const perPerson=/\bper (?:person|worker|employee)\b/i.test(text);
 const coverage=meta.coverage??'';
 const householdIncome=/\b(?:per households?|household income|income from wages?)\b/i.test(text)
  || /\bincome\b/i.test(coverage)&&/\bper\s+(?:[a-z]+\s+){0,3}(?:households?|hh)\b/i.test(coverage);
 if(householdIncome&&!perPerson)return false;
 // Pension/remittance receipts are income transfers, even when called earnings.
 if(/\b(?:pensions?|remittances?)\b/i.test(text)&&!/\b(?:wages?|emoluments?)\b/i.test(text))return false;
 return /\b(wages?|emoluments?|earnings?)\b/i.test(text);
}
