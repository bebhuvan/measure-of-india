// No average of state ratios; every row is a published survey cell.
import fs from 'node:fs';
import {vintageText} from '../../scripts/lib/vintage.mjs';
const codes=[2,3,4,5,6,8,9,10,11,12,16,17,18,19,24,26,29,30,32,34,36,38];
export const descriptions={
2:['Asset stocks and cash debt by occupation','The cell units in this API table are aggregate rupee-lakh totals, despite its heading calling them averages. A total rises with the number of households as well as the amount owned. Do not treat it as a household mean.'],
3:['Household livelihoods and their balance sheets','Household type describes the main livelihood classification. The gender cut refers to the household head, not ownership by each man or woman. Household shares, borrowing incidence and rupee means have different denominators.'],
4:['Asset classes and cash borrowing','Asset-holding classes are all-India sector deciles, ordered from the lowest to the highest assets. A class mean does not describe every household in that class or establish wealth inequality. Gender here describes the household head.'],
5:['Spending quintiles and household assets','Expenditure quintiles group households by usual monthly consumption expenditure per person. They are different from asset classes. A higher spending-group mean does not establish that an individual household can easily service its loans.'],
6:['Social groups and household balance sheets','Each mean and incidence rate uses households in the named social group. Differences in group means cannot recover the distribution within those groups or identify a cause.'],
8:['Owning assets and owing cash loans','Reporting an asset and the value of that asset answer different questions. Fixed assets, financial assets and valuables can coexist in one household; their reporting rates must not be added. Asset classes and expenditure quintiles are separate classifications.'],
9:['Fixed assets, financial assets and valuables','These are mean values across households in the named group, including those without that asset. Valuables are separately recorded from the survey’s physical and financial asset total. A mean is not the representative household’s portfolio.'],
10:['Which assets households report','Land, buildings, animals, business equipment, transport, deposits and shares describe different forms of ownership. One household can report several categories. The “any asset” rate is a union, not a sum of the component rates.'],
11:['Where household asset value is held','Land and buildings are assets, but their valuation does not make them immediately spendable. Deposits and shares are different financial instruments. “Any asset” is the overlapping total; cash debt is a liability and is not another asset component.'],
12:['Bullion and ornaments are a separate store of value','The ownership rate includes households reporting bullion or ornaments; the mean amount uses all households in the named group. Gold and other valuables must not silently be added to the survey’s headline physical and financial asset total.'],
16:['Capital expenditure and land purchases by occupation','These API cells are aggregate amounts in rupee lakh. They do not measure the average household’s spending despite the broad indicator heading. Purchasing existing land transfers ownership; it is different from creating a new productive asset.'],
17:['Investment across household livelihoods','Reporting expenditure is an incidence measure. The rupee average uses all households in the relevant type, including households without that expenditure. Land purchase is separately measured.'],
18:['Investment across asset classes','The source supplies both the share reporting expenditure and the average amount across all households. Do not call the average the bill of households that invested. Existing land purchases and fixed capital expenditure are separate measures.'],
19:['Housing and business capital expenditure','Residential land and buildings, farm business and non-farm business answer different investment questions. The “all” amount is the total, not another component. Incidence rates can overlap because one household can invest in several activities.'],
24:['Borrowing to finance capital expenditure','This is borrowing during the expenditure reference period, distinct from the outstanding debt stock. Institutional and non-institutional borrowing can coexist in the same household; their reporting rates must not be added.'],
26:['Interest terms and the outstanding loan amount','The household reporting measure and the distribution of loan rupees use different bases. A household can have several loans and interest terms. A debt-amount share describes the stock of money owed, not the fraction of households paying that interest rate.'],
29:['Who lends to households','Institutional lenders include banks and other institutions. Non-institutional lenders include moneylenders and relatives. Household incidence overlaps across creditors; debt-amount shares partition rupees, with agency totals overlapping their components.'],
30:['Interest bands within each creditor group','These source cells use households reporting any outstanding cash loan as the base. They count households with a loan from the named creditor in the named interest band per thousand indebted households. Multiple loans can place the same household in more than one band. They are not debt-amount shares or an average interest rate.'],
32:['Creditors across asset classes','This is the number reporting a loan from the named agency per thousand households of that asset class. Agency totals overlap their constituents, and households can owe several agencies.'],
34:['What outstanding loans were used for','The purpose attached to a loan describes its reported use. Household reporting rates can overlap; rupee shares describe how outstanding amounts are distributed. Farm and non-farm expenditure subtotals overlap their capital and revenue components.'],
36:['Loan tenure is a different dimension of borrowing','Short, medium and long tenure describe the source’s loan classification. Households can have several loans; reporting rates by tenure are not a mutually exclusive household distribution.'],
38:['The size of outstanding cash loans','The API and detailed table supply loan-size codes without rupee boundaries. Those codes are retained as source classes; no rupee ranges are invented. Asset-holding classes, in contrast, are documented sector asset deciles. These reporting rates use all households in the asset class. They are not the average loan among indebted households.']};
const all=x=>/^All(?:\b|$)/i.test(x);
const cache=new Map();
export const householdBundle=c=>cache.get(c)??(cache.set(c,JSON.parse(fs.readFileSync(`data/series/households-aidis-${c}.json`))),cache.get(c));
const measureShort=m=>m.replace(/^All households - /,'').replace(/ - cash loan \(Rs\.\) per Rs\. 1000 of total cash loan outstanding.*$/,'Debt amount share').replace(/ - per 1000 no\. of households reporting cash loan outstanding.*$/,'Loan-reporting incidence').replace(/^Per 1000 no\. of households reporting - /,'Reporting: ').replace(/^Average value of assets \(Rs\.\) - /,'Mean value: ').replace(/^Per 1000 no\. of households reported having /,'Reporting: ').replace(/^Per 1000 no\. of households reporting /,'Reporting: ').replace(/\s+/g,' ').trim();
const classLabel=(dim,v)=>{
 if(dim==='asset_holding_class')return /^\d+$/.test(v)?'Asset decile '+v:'All asset deciles';
 if(dim==='asset_quintile_class')return /^\d+$/.test(v)?'Asset decile '+v:/^Q\d+$/.test(v)?'Expenditure quintile '+v.slice(1):v.includes('Asset')?'All asset deciles':'All expenditure quintiles';
 return dim.replaceAll('_',' ')+': '+v;
};
export function householdModel(){
 const plates=[],used=new Map(),facts={},factSources={};
 const mark=(c,k)=>{const slug=`households-aidis-${c}`;(used.get(slug)??(used.set(slug,new Set()),used.get(slug))).add(k);};
 const ec=new Map(),dc=new Map();
 const entries=c=>ec.get(c)??(ec.set(c,Object.entries(householdBundle(c).series).map(([key,s])=>({key,...s,value:s.data[0]}))),ec.get(c));
 const defaults=(c,dim)=>{
  if(dc.has(c+':'+dim))return dc.get(c+':'+dim);
  const fixed={gender:'Person',state:'All-India',nature_of_interest:'All',asset_quintile_class:'All (Asset Holding Class)'};
  const v=fixed[dim]??[...new Set(entries(c).map(s=>s.dims[dim]))].find(all);
  dc.set(c+':'+dim,v);return v;
 };
 const add=(c,id,title,rows,sub,explain=descriptions[c][1])=>{
  rows=rows.filter(r=>Number.isFinite(r.value));if(!rows.length)throw Error(`Empty household plate ${id}`);
  rows.forEach(r=>mark(c,r.key));const b=householdBundle(c);
  const labelled=rows.map(r=>({name:r.name,value:r.value,unit:r.unit,series:r.key}));
  if(new Set(labelled.map(r=>r.name)).size!==labelled.length)throw Error('Duplicate household labels '+id);
  plates.push({id,title,sub,explain,bundle:`households-aidis-${c}`,period:b.meta.latestPeriod,date:b.dates[0],vintage:b.meta.vintage,vintageStatus:b.meta.vintageStatus,vintageNote:b.meta.vintageNote,vintageText:vintageText(b.meta),archiveCapturedDate:b.meta.archiveCapturedDate,reportEditionDate:b.meta.reportEditionDate,apiRevisionDate:b.meta.apiRevisionDate,source:b.meta.source,sourceUrl:b.meta.sourceUrl,rows:labelled,unit:rows[0].unit,group:c<=12?'Household assets and who owns them':c<=24?'Investment and borrowing flows':'Cash debt, creditors and loan terms'});
 };
 for(const c of codes){
  const b=householdBundle(c),dims=b.meta.dimensions.filter(d=>!['state','sector','sub_indicator'].includes(d));
  const measures=[...new Set(entries(c).map(s=>s.dims.sub_indicator))];
  // Each published measure gets an analytical view, preserving all primary categories.
  for(const [mi,m] of measures.entries()){
   if([26,29,34].includes(c)&&!m.startsWith('All households'))continue;
   let vary={2:'occupational_category',3:'household_type',4:'asset_holding_class',5:'quintile_class',6:'social_group',8:null,9:null,10:null,11:null,12:'occupational_category',16:'occupational_category',17:'household_type',18:'asset_holding_class',19:'occupational_category',24:'credit_agency',26:'rate_of_interest',29:'credit_agency',30:'credit_agency',32:'credit_agency',34:'purpose_of_loan',36:'loan_tenure',38:'size_class'}[c];
   const chosen=entries(c).filter(s=>s.dims.state==='All-India'&&s.dims.sub_indicator===m&&dims.every(d=>d===vary||!defaults(c,d)||s.dims[d]===defaults(c,d)));
   add(c,`aidis-${c}-${mi}`,descriptions[c][0]+': '+measureShort(m),chosen.map(r=>({...r,name:[r.dims.sector,vary?classLabel(vary,r.dims[vary]):''].filter(Boolean).join(' / ')})),m+'. All-India; rural and urban kept separate. Source totals are shown explicitly and overlap components.');
  }
 }
 // Deep dimensions get direct evidence and explanation beyond a searchable tail.
 for(const [c,dim,rx] of [[9,'occupational_category',/fixed assets/],[9,'asset_quintile_class',/financial assets/],[10,'occupational_category',/ - land$/],[11,'asset_holding_class',/ - land$/],[3,'gender',/Average amount of cash loan/],[8,'asset_quintile_class',/cash loan outstanding/],[32,'asset_holding_class',/./],[36,'asset_holding_class',/./],[38,'asset_holding_class',/./]]){
  const b=householdBundle(c),dims=b.meta.dimensions.filter(d=>!['state','sector','sub_indicator',dim].includes(d));
  const rows=entries(c).filter(s=>s.dims.state==='All-India'&&rx.test(s.dims.sub_indicator)&&dims.every(d=>!defaults(c,d)||s.dims[d]===defaults(c,d)));
  add(c,`cut-${c}-${dim}`,descriptions[c][0]+': '+dim.replaceAll('_',' '),rows.map(r=>({...r,name:r.dims.sector+' / '+classLabel(dim,r.dims[dim])})),'All-India, published '+dim.replaceAll('_',' ')+' cuts; other dimensions at their source totals.');
 }
 // State evidence is shown in source order, never ranked as a quality/wealth league table.
 for(const sector of ['Rural','Urban'])for(const [name,rx] of [['asset-value',/Average value of assets per household/],['debt-incidence',/No. of households reporting cash loan/]]){
  const rows=entries(6).filter(s=>s.dims.state!=='All-India'&&s.dims.sector===sector&&all(s.dims.social_group)&&rx.test(s.dims.sub_indicator));
  add(6,`states-${sector.toLowerCase()}-${name}`,`${sector} state estimates: ${name==='asset-value'?'mean assets':'cash-loan incidence'}`,rows.map(r=>({...r,name:r.dims.state})),`${sector}; all social groups including not reported. Published state/UT estimates, in source order.`, 'Each estimate uses households in its own state and sector. Small samples can make estimates unstable; the source report supplies RSEs for selected indicators. These are displayed to show geographic coverage, without a ranking or an average across states. Historical state boundaries belong to the survey round.');
 }
 for(const sector of ['Rural','Urban'])for(const [name,rx] of [['assets',/Average value of assets per household/],['debt',/Average amount of cash loan/],['incidence',/No. of households reporting cash loan/]]){
  const matches=entries(6).filter(s=>s.dims.state==='All-India'&&s.dims.sector===sector&&all(s.dims.social_group)&&rx.test(s.dims.sub_indicator));
  if(matches.length!==1)throw Error('Ambiguous household headline '+name);
  const r=matches[0],id=sector.toLowerCase()+'_'+name;facts[id]={value:r.value,unit:r.unit};factSources[id]={bundle:'households-aidis-6',series:r.key,date:householdBundle(6).dates[0]};mark(6,r.key);
 }
 const release=householdBundle('release');
 const rr=Object.entries(release.series).map(([key,s])=>({key,...s,name:s.dims.sector+' / '+s.dims.occupational_category,value:s.data[0]}));
 add('release','indebted-households','Debt among indebted households uses a narrower base',rr,'Published mean cash debt per indebted household, rural and urban occupational groups.','These conditional means use households with outstanding cash debt. They are published directly by MoSPI; dividing the all-household mean by a rounded incidence rate would give a slightly different result. Compare the population base before comparing the amounts.');
 for(const sector of ['rural','urban']){const key=sector+'_all',id=sector+'_indebted';facts[id]={value:release.series[key].data[0],unit:'inr'};factSources[id]={bundle:'households-aidis-release',series:key,date:release.dates[0]};}
 return {plates,used,facts,factSources,summary:{sourceIndicators:22,bundles:23,series:6+codes.reduce((a,c)=>a+Object.keys(householdBundle(c).series).length,0)}};
}
