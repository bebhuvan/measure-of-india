// Build-time slices: all fine series stay in EveryCut/downloads, charts use published cells.
export const MARKETS_RBI_VIEWS = [
 ...['q','a'].flatMap(f=>[
  {f,cut:'sales',item:'sales',title:'Sales growth across company sales sizes',explain:'Sales-size groups place firms by their turnover in ₹ crore. Growth compares the companies present in both years. Firms can move between size groups; these groups are not a fixed panel.',unit:'pct'},
  {f,cut:'sales',item:'sal_share',title:'How sales are distributed across sales sizes',explain:'The share uses all-company sales as its denominator. Large firms can account for most sales while smaller firms account for many companies. This is a share of the period’s sales, not a growth rate.',unit:'pct'},
  {f,cut:'sales',item:'net_pft_to_sal',ratio:true,title:'Profit margins across sales sizes',explain:'Net profit divided by sales shows how much of a rupee of revenue remains after expenses and tax. A negative margin means a loss. Ratios describe this period’s reporting companies.',unit:'pct'},
  {f,cut:'sales',item:'companies',title:'The company samples behind sales-size comparisons',explain:'These are reporting company counts, not workers, households or all Indian businesses. Read the count alongside the growth and margin panels; a small sample is more sensitive to a large firm.',unit:'count'},
  {f,cut:'puc',item:'sales',title:'Sales growth across paid-up-capital sizes',explain:'Paid-up capital is the nominal capital shareholders have paid into the company. It differs from market value, turnover and debt. Size boundaries are in ₹ crore; growth compares common companies.',unit:'pct'},
  {f,cut:'puc',item:'puc_share',title:'How paid-up capital is distributed across capital sizes',explain:'This is each class’s share of total paid-up capital. It measures the distribution of nominal shareholder capital, not the distribution of company market value.',unit:'pct'},
  {f,cut:'puc',item:'net_pft_to_sal',ratio:true,title:'Profit margins across paid-up-capital sizes',explain:'Capital size and profitability answer different questions. A firm can have little nominal share capital and substantial sales or debt. Compare margins within this reporting period.',unit:'pct'},
  {f,cut:'puc',item:'companies',title:'The company samples behind capital-size comparisons',explain:'Counts show how many listed non-financial companies reported in each class. Their composition changes between periods. A rise in the count does not measure employment growth.',unit:'count'},
  {f,cut:'sector',item:'net_pft_to_sal',ratio:true,title:'Profit margins in manufacturing, IT and other services',explain:'Sales growth and profit margins can move in different directions. Margins include financing costs, tax and other income. They are aggregated ratios, not the median company’s margin.',unit:'pct'},
  {f,cut:'sector',item:'int_cvg',ratio:true,title:'How sector earnings cover interest bills',explain:'Interest coverage divides earnings before interest and tax by interest expense. It is measured in times, not per cent. Sector aggregates can conceal vulnerable individual companies.',unit:'times'},
  {f,cut:'sector',item:'companies',title:'The reporting samples by sector',explain:'These are the companies behind each period’s published sector study. Use RBI’s common-company growth rates for change. Differences between study totals can arise from changing samples. Sector counts are kept as printed and are not forced to add to the overall report’s count.',unit:'count'},
  {f,cut:'industry',item:'net_pft_to_sal',ratio:true,title:'Profit margins across every published industry',explain:'Industry totals include both broad groups and their narrower parts. The labels preserve that hierarchy; do not add a parent and its subindustries. Missing or not-meaningful ratios remain absent.',unit:'pct'},
  {f,cut:'industry',item:'companies',title:'How many companies sit behind each industry',explain:'A small industry’s aggregate can be moved by one firm. Parent groups include their subindustries; these company counts must not be summed across this chart.',unit:'count'},
  {f,cut:null,item:'companies',history:true,title:'Each study draws on a different company sample',explain:'Counts change as results become available. The count describes the study, not an unchanging cohort. Never calculate sales growth by dividing two study totals; RBI supplies growth on common companies.',unit:'count'},
 ]),
 {f:'a',cut:null,item:'sales',history:true,title:'Annual sales growth puts the quarterly swings in context',explain:'Annual growth compares the same listed companies across full financial years. It is nominal sales growth, so prices and volumes both contribute. Annual and quarterly rates cover different windows.',unit:'pct'},
 {f:'a',cut:'industry',item:'sales',title:'Annual sales growth across every published industry',explain:'The full-year comparison can differ from a single quarter. Parent groups and their parts appear together for reference; they are not independent sectors to add together.',unit:'pct'},
 ...['q','a'].map(f=>({f,cut:'sector',item:'sales',amount:true,title:'Sales totals for this period’s sector samples',explain:'These rupee totals describe the companies in this study only. The reporting sample changes each period, so the bars are a snapshot. Use common-company growth rates to compare performance over time.',unit:'inr_crore'})),
];
export function marketsRbiSlices(load) {
 return MARKETS_RBI_VIEWS.map((v,i)=>{
  const bundle=`markets-listed-${v.f}${v.cut?'-'+v.cut:''}${v.ratio?'-ratios':''}${v.amount?'-levels':''}`,b=load(bundle),date=b.dates.at(-1);
  const suffix=v.cut?'__'+v.item:v.item;
  const ss=Object.entries(b.series).filter(([k])=>v.cut?k.endsWith(suffix):k===suffix);
  const rows=v.history?b.dates.map((d,j)=>({label:v.f==='a'?`${d.slice(0,4)}–${String(+d.slice(0,4)+1).slice(2)}`:`${['Jan–Mar','Apr–Jun','Jul–Sep','Oct–Dec'][Math.floor((+d.slice(5,7)-1)/3)]} ${d.slice(0,4)}`,value:ss[0]?.[1].data[j]??null})):ss.map(([key,s])=>({key,label:s.group??s.label,value:s.data.at(-1),companies:s.sourceByDate?.[date]?.companies??null}));
  if(!v.history && ['sales','puc'].includes(v.cut)) {
   const size = label => /all companies/i.test(label) ? Infinity : /less than/i.test(label) ? -Infinity : Number(label.match(/\d+/)?.[0] ?? Infinity);
   rows.sort((a,b)=>size(a.label)-size(b.label));
  }
  return {...v,id:'rbi-'+i,bundle,date,rows,available:rows.filter(r=>r.value!=null).length,total:rows.length};
 });
}
