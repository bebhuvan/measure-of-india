import fs from 'node:fs';import path from 'node:path';
export function validateMarketsRbi(root) {
 const errors=[],q=JSON.parse(fs.readFileSync(path.join(root,'data/coverage/markets-rbi.source-quality.json'),'utf8'));let identities=0,provenance=0;
 const reviewed=JSON.parse(fs.readFileSync(path.join(root,'data/coverage/markets-rbi.reviewed-conflicts.json'),'utf8'));
 if(JSON.stringify(q.conflicts)!==JSON.stringify(reviewed.conflicts))errors.push('Unreviewed CAS/report conflicts: inspect exact cells and record a source review before proceeding');
 for(const entry of q.bundles){const b=JSON.parse(fs.readFileSync(path.join(root,'data/series',entry.slug+'.json'),'utf8'));
  for(const [k,s] of Object.entries(b.series))for(let i=0;i<b.dates.length;i++){const v=s.data[i];if(v==null)continue;if(!s.sourceByDate?.[b.dates[i]]?.artifact)errors.push(`${entry.slug}.${k}: missing cell lineage ${b.dates[i]}`);else provenance++;if(Math.abs(v)===999999999)errors.push(`${entry.slug}.${k}: sentinel leaked`);}
  if(!entry.slug.endsWith('-levels'))continue;
  const groups=new Set(Object.keys(b.series).map(k=>k.includes('__')?k.split('__')[0]+'__':''));
  for(const pre of groups)for(let i=0;i<b.dates.length;i++){
   const value=k=>b.series[pre+k]?.data[i];const check=(lhs,rhs,desc)=>{if([...lhs,...rhs].some(v=>v==null))return;identities++;const a=lhs.reduce((s,v)=>s+v,0),z=rhs.reduce((s,v)=>s+v,0);if(Math.abs(a-z)>.05)errors.push(`${entry.slug} ${pre}${b.dates[i]} ${desc}: ${a} != ${z}`);};
   check([value('opr_pft'),value('oth_inc')],[value('ebitda')],'operating profit + other income = EBITDA');
   check([value('gross_pft_ebit'),value('deprc')],[value('ebitda')],'EBIT + depreciation = EBITDA');
   check([value('ebt_before_nop'),value('int')],[value('gross_pft_ebit')],'EBT + interest = EBIT');
   check([value('opr_pft'),value('expd')],[value('val_of_prod')],'operating profit + expenditure = production');
  }
 }
 if(!identities||!provenance)errors.push('Empty identity/provenance validation');
 return {errors,identities,provenance,counts:q.counts};
}
