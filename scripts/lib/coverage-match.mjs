// Exact catalogue IDs are common in source-cell ledgers. Match them in a Set
// rather than testing thousands of regular expressions for every source item.
// Glob semantics and the caller's first-matching-rule priority are unchanged.
const toRegex=g=>new RegExp('^'+g.split('*').map(s=>s.replace(/[.+?^${}()|[\]\\]/g,'\\$&')).join('.*')+'$');
export function coverageMatcher(patterns){
 const exact=new Set(patterns.filter(p=>!p.includes('*')));
 const globs=patterns.filter(p=>p.includes('*')).map(toRegex);
 return id=>exact.has(id)||globs.some(re=>re.test(id));
}
