// Every analytical row is one source cell; never average states or periods.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {readRaw} from '../../scripts/lib/util.mjs';
import {vintageText} from '../../scripts/lib/vintage.mjs';
let cachedModel;
// Cache one immutable source snapshot per process. Development reloads and gates
// reuse it; any manifest, canonical bundle or definition archive change invalidates it.
export function farmModel(){
 const manifestFile='data/coverage/farm-households.manifest.json';
 const manifest=JSON.parse(fs.readFileSync(manifestFile));
 const paths=[manifestFile,'data/raw/farm-households-report.json.gz',...manifest.bundles.map(it=>`data/series/${it.slug}.json`)];
 const stamp=paths.map(p=>{const s=fs.statSync(p,{bigint:true});return p+':'+s.mtimeNs+':'+s.size;}).join('|');
 if(cachedModel?.stamp===stamp)return cachedModel.model;
 const model=farmModelUncached(manifest);cachedModel={stamp,model};return model;
}
function farmModelUncached(manifest){
 const tables=new Map(),metadata=new Map(),used=new Map(),plates=[],facts={},factSources={};
 for(const it of manifest.bundles){const b=JSON.parse(fs.readFileSync(`data/series/${it.slug}.json`));metadata.set(it.slug,b.meta);const arr=tables.get(it.code)??[];for(const [key,s]of Object.entries(b.series))arr.push({...s,key,bundle:it.slug,value:s.data[0]});tables.set(it.code,arr);}
 const groups=c=>String(c).startsWith('report-27')?'Income, costs and productive assets':c<=19?'Who lives from agriculture':c<=32?'Income, costs and productive assets':c===33?'Borrowing and creditors':c<=41?'Land, tenure and livestock':'Crop sales, inputs and risk';
 const explanations={
16:'Land possessed includes owned land retained, land leased in and land otherwise possessed. It differs from land ownership and the area operated. Visits are separate survey observations, not two populations to add.',
17:'These estimated household counts distinguish agricultural households from all rural households and from non-agricultural households. Social groups classify households; a group count does not measure its prosperity.',
18:'A livelihood classification, social group and land class describe different characteristics. The cell’s household base controls its interpretation. Component employment groups and their subtotals overlap.',
19:'An operational holding is land used as one technical unit for agricultural production. Holdings, parcels, area and crops harvested are different measures. Ownership is separate from operation.',
21:'Major disposal describes the principal sales channel. Satisfaction records the reported outcome, not an independently measured sale price or evidence of exploitation.',
22:'Resource use and procurement answer separate questions. The source follows the major procurement channel; it does not measure every transaction, expenditure or quantity of input used.',
23:'Seed quality is reported by households buying seed from the named agency. It is a perception measure for major procurement, not laboratory certification or all seed use.',
24:'The income total adds wages, leasing land and net receipts from crops, animals and non-farm business after paid-out expenses. Pension and remittance are separately displayed; they are not part of the published income total.',
25:'Imputed costs value inputs supplied by the household, including its own labour. They reduce net receipts without representing another cash payment. Compare with the paid-out-cost measure using the same household and season.',
26:'Net spending on productive assets records additions less receipts from disposals. It can be negative. This is a flow of investment, not the value of assets held or monthly consumption.',
27:'These means condition on reporting expenditure or selling assets. A receipt from selling livestock or machinery is not recurring farm income, and the reporting-household mean is not the all-household mean.',
28:'Crop costs and receipts here use households reporting crop production. That is a narrower base than the headline agricultural-household income. Net crop income cannot be reconstructed by subtracting these conditional means from the headline.',
29:'These expenses include paid-out and imputed inputs. Family labour can raise measured costs without another cash payment. Component costs are shown separately from the total.',
31:'The animal-farming table describes expenses among households reporting that activity. Despite the API heading mentioning receipts, the archived measure list contains only cost components and total costs. Missing receipts cannot be invented.',
32:'Non-farm business receipts and expenses use households engaged in non-farm business. The participation rate uses agricultural households as its base. A business mean therefore differs from its contribution to income across all agricultural households.',
33:'Lender shares describe outstanding loan rupees. Indebtedness counts agricultural households with loans; mean loan amount includes all agricultural households. A lender share is not the share of people borrowing from that lender.',
34:'Ownership holding includes homestead land and other land. Average owned area, household size and the distribution across holding sizes have different units and should not be added.',
35:'Land leased out leaves ownership with the lessor. The reporting rate uses households, while average leased area conditions on those reporting leasing. These bases are separate.',
36:'This is the leasing-in table. The API mistakenly repeats leasing-out sublabels; the table identity is preserved and the defect is disclosed. All 13,950 values match official report Table 34 at the same state, season, holding class, social group and measure.',
37:'Lease terms describe leased-out land, separate from the household rate reporting a lease and the estimated area leased out. Terms can include cash, produce, crop shares or arrangements with relatives.',
39:'Livestock reporting is per thousand rural households in the named holding and social group. Male/female here refer to livestock categories in this table; they must not be read as ownership by men and women.',
40:'Kinds of possession distinguish owned, leased and otherwise possessed land. Area shares describe land, while the homestead-only measure counts households. Leased-out land is not operated by its owner.',
41:'Operational holdings can be entirely owned, entirely leased, otherwise possessed or combine owned and leased land. A holding’s tenure does not establish a household’s legal title or security.',
42:'Crop-producer means, reporting rates, area, value, quantity and yield are different measures. Quantities, crop values and areas condition on households reporting crop production; they are not national production totals. Coconut quantity uses number rather than kilograms. These are household-survey estimates, distinct from the production instrument in Farms.',
43:'The household distribution by main disposal channel and the quantity distribution answer different questions. A large share of sellers does not imply an equally large share of crop tonnage.',
44:'Satisfaction is reported about the major sale. The reasons for dissatisfaction describe that reported experience. They cannot establish an independently measured market-price gap.',
45:'Seed procurement identifies the principal channel for the selected crop. Own-farm seed is separate from purchased seed; a procurement share does not measure certified seed use.',
46:'Quality of purchased seed is reported by users. Good, satisfactory and poor are survey responses, not laboratory quality grades. The unknown and unreported categories remain visible.',
47:'Knowing about MSP, knowing the procurement agency, selling to it and the share of output sold under MSP are different measures. The reporting base is households selling the selected crop. These report-native cells replace mislabelled API categories; they do not establish the price benefit for each farmer.',
48:'Non-insurance reasons use the source’s conditional household base. The API’s parenthesised strings are column headers and are withheld; these analytical values come directly from report Table 19. Lack of insurance is different from lack of awareness.',
49:'Insurance status distinguishes loan-linked and additional insurance. Receiving documents is a separate measure among insured households. A policy does not establish that every loss is covered or compensated.',
50:'Loss incidence uses crop-growing households; causes condition on households experiencing loss. Cause shares cannot be multiplied by an unrelated crop or household base without an explicit estimator.',
51:'Additional insurance, experiencing loss and receiving a claim narrow the population in stages. Claim outcomes describe these households, not all farmers or all policies.'};
 const baseline=(dim,vals)=>{
  const preferred=dim==='state'?['All India']:dim==='season'?['July 2018–June 2019','January 2019-June 2019']:dim==='visit_name'?['Visit 2']:dim==='household_classification'?['Agricultural Households']:dim==='gender'?['Person','None']:['All Size','All Sizes','All','All (incl. n.r.)','All (incl. n.r)','All (incl. nr)','None','Not applicable'];
  return preferred.find(x=>vals.includes(x))??vals[0];
 };
 const add=(c,id,vary,rows,fixed,title,minRows=2)=>{
  if(rows.length<minRows)return;
  const signature=rows.map(r=>r.bundle+':'+r.key).sort().join('|');if(plates.some(p=>p.signature===signature))return;
  const units=[...new Set(rows.map(s=>s.unit))];if(units.length!==1)throw Error('Mixed farm plate units '+id);
  const provenance=metadata.get(rows[0].bundle);
  const p={signature,id,title:title??manifest.bundles.find(x=>x.code===c).slug.replace('farm-households-nss77-','Table ')+': '+vary.replaceAll('_',' '),group:groups(c),unit:units[0],period:c===33?'Interview date in visit 1, January–August 2019':fixed.season??(fixed.visit_name?fixed.visit_name+'; survey reference in source':'July 2018–June 2019'),date:'2019-06-30',vintage:provenance.vintage,vintageStatus:provenance.vintageStatus,vintageNote:provenance.vintageNote,vintageText:vintageText(provenance),reportEditionDate:provenance.reportEditionDate,archiveCapturedDate:provenance.archiveCapturedDate,apiRevisionDate:provenance.apiRevisionDate??null,sourceRevisionDate:provenance.sourceRevisionDate??null,source:'MoSPI, NSS 77, Schedule 33.1',bundle:rows[0].bundle,bundles:[...new Set(rows.map(s=>s.bundle))],sub:Object.entries(fixed).filter(([k])=>k!==vary).map(([k,v])=>k.replaceAll('_',' ')+': '+v).join('; '),explain:explanations[c]??'Animal-farming receipts and paid-out costs condition on households engaged in animal farming. Total costs add imputed inputs; they cannot be treated as another cash bill. Seasonal references and the conditional base remain separate.',rows:rows.map(s=>({name:s.dims[vary],value:s.value,unit:s.unit,series:s.key,bundle:s.bundle}))};
  if(new Set(p.rows.map(r=>r.name)).size!==p.rows.length)throw Error('Duplicate farm labels '+id);
  plates.push(p);for(const r of rows){const set=used.get(r.bundle)??new Set();set.add(r.key);used.set(r.bundle,set);}
 };
 // Repaired report-native measures replace defective API analytical views. Original cubes stay in Every Cut.
 for(const [source,c] of [['report-29',33],['report-18',47],['report-19',48]])tables.set(c,tables.get(source));
 tables.delete('report-29');tables.delete('report-18');tables.delete('report-19');
 // Table order is source order (numeric codes first), whether or not an API table baked any cells.
 {const order=[...tables.keys()].sort((a,b)=>(typeof a==='number'?0:1)-(typeof b==='number'?0:1)||(typeof a==='number'?a-b:0));const copy=new Map(tables);tables.clear();for(const k of order)tables.set(k,copy.get(k));}
 const titles={16:'Households and land possessed',17:'Households by social group',18:'Livelihoods and land',19:'Operational holdings and parcels',21:'Sales channels and satisfaction',22:'Farming resources and procurement',23:'Seed quality by seller',24:'Income after paid-out costs',25:'Income after imputed costs',26:'Net investment in productive assets',27:'Buying and selling productive assets',28:'Crop receipts and paid-out costs',29:'Crop costs including imputed inputs',31:'Animal farming costs',32:'Non-farm business',33:'Debt and creditors',34:'Land owned and homestead area',35:'Leasing land out',36:'Leasing land in',37:'Lease terms',39:'Livestock ownership',40:'Land possession',41:'Operational tenure',42:'Crop production and yield',43:'Crop sales channels',44:'Crop sale satisfaction',45:'Seed procurement',46:'Purchased seed quality',47:'MSP awareness and procurement',48:'Reasons crops are uninsured',49:'Crop insurance and documents',50:'Crop losses and causes',51:'Claims following insured losses','report-27A':'Animal farming cash costs and receipts','report-27B':'Animal farming costs including own inputs'};
 const selectSlice=(all,dims,vary,fixed)=>{
  const scope=all.filter(s=>s.dims.state==='All India'&&Number.isFinite(s.value)&&(!fixed.sub_indicator||s.dims.sub_indicator===fixed.sub_indicator));
  const groups=new Map();for(const r of scope){const key=JSON.stringify(dims.filter(d=>d!==vary).map(d=>r.dims[d]));const a=groups.get(key)??[];a.push(r);groups.set(key,a);}
  const candidates=[...groups.values()].filter(a=>a.length>1);if(!candidates.length)return [];
  candidates.sort((a,b)=>{const score=x=>dims.filter(d=>d!==vary&&x[0].dims[d]===fixed[d]).length*3+Math.min(x.length,20);return score(b)-score(a);});return candidates[0];
 };
 for(const [c,all]of tables){
  const dims=Object.keys(all[0].dims),vals=Object.fromEntries(dims.map(d=>[d,[...new Set(all.map(s=>s.dims[d]))]]));
  const defaults=Object.fromEntries(dims.map(d=>[d,baseline(d,vals[d])]));
  const measures=dims.includes('sub_indicator')?vals.sub_indicator:[null];
  // Each substantive measure and each dimension gets a coordinated direct-cell slice.
  for(const [mi,measure] of measures.entries()){
   const base={...defaults,...(measure?{sub_indicator:measure}:{})};
   const candidates=dims.filter(d=>!['state','season','visit_name','sub_indicator'].includes(d)&&vals[d].length>1);
   const primary=({16:'Land_Possessed(hectares)',17:'Social Group',18:'household_employment',19:'operational_holding',21:'agency',22:'resource',23:'agency_procurement',24:'Land_Possessed(hectares)',25:'Land_Possessed(hectares)',26:'Land_Possessed(hectares)',27:'productive_assets',28:'crop_production',29:'crop_production',31:'expenses_imputed',32:'receipts_type',33:'Land_Possessed(hectares)',34:'ownership_holding',35:'ownership_holding',36:'ownership_holding',37:'terms_lease',39:'livestock_owned',40:'possession',41:'possession_holding',42:'crop',43:'crop_agency',44:'crop_satisfaction',45:'crop_procurement',46:'quality_seeds',47:'crop',48:'crop',49:'crop_insurance',50:'crop_loss',51:'crop_experienced','report-27A':'Land_Possessed(hectares)','report-27B':'Land_Possessed(hectares)'})[c]??candidates[0]??'state';
   let selected=all.filter(s=>Number.isFinite(s.value)&&dims.every(d=>d===primary||s.dims[d]===base[d]));if(selected.length<2){selected=selectSlice(all,dims,primary,base);if(selected.length)Object.assign(base,selected[0].dims);}
   for(const unit of [...new Set(selected.map(s=>s.unit))])add(c,`nss77-${c}-m${mi}-${unit}`,primary,selected.filter(s=>s.unit===unit),base,`${titles[c]}: ${measure??primary.replaceAll('_',' ')}`);
  }
  for(const dim of dims.filter(d=>d!=='state'&&vals[d].length>1)){
   let candidates=all.filter(s=>Number.isFinite(s.value)&&dims.every(d=>d===dim||s.dims[d]===defaults[d]));
   if(candidates.length<2)candidates=selectSlice(all,dims,dim,{...defaults,...(dim==='sub_indicator'?{sub_indicator:null}:{})});
   if(!candidates.length)continue;const fixed={...candidates[0].dims};
   for(const u of [...new Set(candidates.map(s=>s.unit))])add(c,`nss77-${c}-cut-${dim.replace(/[^a-z0-9]/gi,'')}-${u}`,dim,candidates.filter(s=>s.unit===u),fixed,`${titles[c]}: ${dim.replaceAll('_',' ')}`);
  }
 }
 // A nested crop production measure is the joint identity of these three fields.
 // A one-row coconut count is meaningful; it stays apart from kilogram comparisons.
 {
  const all=tables.get(42),dims=Object.keys(all[0].dims),semantic=['sub_indicator','harvested','sub_harvested'];
  const defaults=Object.fromEntries(dims.map(d=>[d,baseline(d,[...new Set(all.map(s=>s.dims[d]))])]));
  const metrics=new Map();for(const s of all){const key=JSON.stringify(semantic.map(d=>s.dims[d]));if(!metrics.has(key))metrics.set(key,Object.fromEntries(semantic.map(d=>[d,s.dims[d]])));}
  for(const [key,metric]of metrics){
   const observed=all.filter(s=>semantic.every(d=>s.dims[d]===metric[d]));
   const rows=selectSlice(observed,dims,'crop',{...defaults,...metric});if(!rows.length)continue;
   const fixed={...rows[0].dims},token=crypto.createHash('sha256').update(key).digest('hex').slice(0,12);
   for(const unit of [...new Set(rows.map(r=>r.unit))])add(42,`nss77-42-measure-${token}-${unit}`,'crop',rows.filter(r=>r.unit===unit),fixed,`Crop production and yield: ${semantic.map(d=>metric[d]).filter(v=>v!=='Not applicable').join('; ')}`,1);
  }
 }
 for(const c of [24,25]){
  const total=tables.get(c).filter(s=>s.dims['Social Group']==='All'&&s.dims['Land_Possessed(hectares)']==='All Size'&&s.dims.season==='July 2018–June 2019'&&s.dims.sub_indicator==='Total Income (rs.)');
  add(c,`income-states-${c}`,'state',total,{season:'July 2018–June 2019','Social Group':'All','Land_Possessed(hectares)':'All Size'},c===24?'Mean household income across states, after paid-out costs':'Mean household income across states, after imputed costs');
  const r=total.find(s=>s.dims.state==='All India');const id=c===24?'paid_income':'imputed_income';facts[id]={value:r.value,unit:r.unit};factSources[id]={bundle:r.bundle,series:r.key,date:'2019-06-30'};
 }
 for(const [id,m] of [['debt','Average Amount of Outstanding Loan per Agricultural Household (Rs.)'],['indebted','No. per 1000 of Indebted Agricultural Households']]){
  const rows=tables.get(33).filter(s=>s.dims['Land_Possessed(hectares)']==='All Size'&&s.dims.sub_indicator===(id==='debt'?'Mean outstanding loan per agricultural household':'Indebted households per thousand agricultural households'));
  add(33,'states-'+id,'state',rows,{'Land_Possessed(hectares)':'All Size',loan_outstanding:m},id==='debt'?'Outstanding debt per agricultural household, by state':'Agricultural households reporting debt, by state');
  const r=rows.find(s=>s.dims.state==='All India');facts[id]={value:r.value,unit:r.unit};factSources[id]={bundle:r.bundle,series:r.key,date:'2019-08-31'};
 }
 const report=readRaw(process.cwd(),'data/raw/farm-households-report.json');
 const definition=report.text.match(/An agricultural household for 77th Round survey was defined as[\s\S]*?value of produce more than Rs\. ([\d,]+)[\s\S]*?during last (\d+)\s+days/);
 if(!definition)throw Error('Agricultural-household definition anchor missing');
 facts.qualifying_produce={value:Number(definition[1].replaceAll(',','')),unit:'inr'};facts.definition_days={value:Number(definition[2]),unit:'count'};
 for(const id of ['qualifying_produce','definition_days'])factSources[id]={rawFile:'data/raw/farm-households-report.json',section:'1.6.3',sourceText:definition[0]};
 const periods={annual:tables.get(24).find(s=>s.dims.season.includes('June 2019')&&s.dims.season.startsWith('July')).dims.season,debt:'Interview date in visit 1, January–August 2019'};
 const provenance=Object.fromEntries([...metadata].map(([slug,m])=>[slug,Object.fromEntries(['vintage','vintageStatus','vintageBasis','vintageNote','reportEditionDate','apiRevisionDate','sourceRevisionDate','archiveCapturedDate','archiveCaptureNote','archiveSha256','sourceDocumentSha256','rawFile','sourceUrl'].filter(k=>k in m).map(k=>[k,m[k]]))]));
 return {periods,plates,used,facts,factSources,provenance,summary:{sourceIndicators:manifest.sourceIndicators,sourceRows:manifest.sourceRows,bundles:manifest.bundles.length,series:manifest.bundles.reduce((a,it)=>a+it.series,0),plates:plates.length}};
}
