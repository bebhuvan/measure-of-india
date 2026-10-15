import * as Plot from '@observablehq/plot';
import {a11y,downloadSVG,downloadPNG} from '../charts/plumbing.js';
import {createSearch,expectedScheduleContext} from '../dossiers/search-core.js';
import {createLoader} from './loader.js';
import {MAX_COMPARE,canComparePolicy,seriesURL,parseIdentity,assertCompatible,assertExpectedPolicy,observations,aligned,selectedCSV,selectedJSON,identity,unitLabel,compactAxisValue,expectedAsOf} from './model.js';
const root=document.getElementById('explorer');
if(root){
  const el=id=>document.getElementById(id),loader=createLoader(fetch,root.dataset.qualityVersion);let appliedRange={},records=[],chart=null,controller=null,epoch=0,searchEpoch=0,searchPromise=null,tablePage=0;
  const node=(tag,text)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;return e;};
  const status=text=>{el('explore-status').textContent=text;};
  const range=()=>appliedRange;
  const save=(text,type,name)=>{const url=URL.createObjectURL(new Blob([text],{type}));const a=node('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  const fmt=v=>v==null?'—':v.toLocaleString('en-IN',{maximumFractionDigits:20});
  const displayName=r=>(r.quality?.publicTitle?(r.quality.publicTitle+(r.series.geo||r.series.state?`: ${r.series.geo||r.series.state}`:'')):(r.series.label||r.key)).replace(/ · /g,', ').replace(/ — /g,': ').replace(/_/g,' ');
  function table(){
    const rows=aligned(records,range()),head=node('tr');head.append(node('th','Period'));
    records.forEach(r=>head.append(node('th',displayName(r))));el('explore-head').replaceChildren(head);
    const body=el('explore-body');body.replaceChildren();
    for(const row of rows.slice(tablePage*100,(tablePage+1)*100)){const tr=node('tr');const pi=records[0].dates.indexOf(row.date);tr.append(node('th',records[0].periods[pi]||row.date));row.values.forEach((v,i)=>{const td=node('td',fmt(v));if(records[i].meta.observationKind==='expected-schedule'&&records[i].series.expected?.includes(row.date))td.append(node('small','Expected schedule'));else if(records[i].series.estimated?.includes(row.date))td.append(node('small','Estimate'));tr.append(td);});body.append(tr);}
    el('explore-table-count').textContent=`${rows.length.toLocaleString('en-IN')} periods. Page ${tablePage+1} of ${Math.max(1,Math.ceil(rows.length/100))}. Downloads include the entire selected range.`;
    el('explore-prev').disabled=tablePage===0;el('explore-next').disabled=(tablePage+1)*100>=rows.length;
  }
  function draw(){
    if(!records.length)return;
    records.forEach(assertExpectedPolicy);
    const r=records[0],expectedSchedule=Boolean(expectedScheduleContext(r.quality)),from=range().from,to=range().to;if(expectedSchedule&&r.meta.observationKind!=='expected-schedule')throw Error('Expected source policy and canonical class differ');if(from&&to&&from>to){status('The start date must be before the end date.');return;}
    const points=records.flatMap((r,i)=>observations(r,range()).map(d=>({...d,date:new Date(d.date+'T00:00:00Z'),label:displayName(r),i})));
    const snapshot=records.every(r=>r.series.data.filter(v=>v!=null).length<=1),width=Math.max(280,Math.min(1184,el('explore-chart').clientWidth||880));
    el('explore-range').hidden=snapshot&&!from&&!to;
    if (!points.some(d=>d.value!=null)) {chart=null;el('explore-chart').textContent='No published observations in this date range.';el('explore-chart-note').textContent='Unpublished observations remain null in the table and downloads.';el('explore-unit').textContent=`Unit: ${unitLabel(r.unit)}. ${r.meta.frequency}.`;el('explore-svg').disabled=true;el('explore-png').disabled=true;table();return;}
    el('explore-svg').disabled=false;el('explore-png').disabled=false;
    const lastDates=records.map(r=>new Date(r.dates[r.series.data.findLastIndex(v=>v!=null)]+'T00:00:00Z').getTime());
    el('explore-range').hidden=snapshot&&!from&&!to;
    const plotOptions={width,height:snapshot?Math.max(200,records.length*65+70):380,marginLeft:64,marginRight:24,marginBottom:expectedSchedule?110:42,style:{fontFamily:'Golos Text, system-ui, sans-serif',fontSize:'12px'},color:{domain:records.map(displayName),range:['#2E4BD8','#C47A16','#5F6675','#A3A9B4']}};
    if(snapshot){plotOptions.x={label:null,grid:true,tickFormat:compactAxisValue};plotOptions.y={domain:records.map((_,i)=>String(i+1)),label:null};plotOptions.marks=[Plot.dot(points.filter(d=>d.value!=null),{x:'value',y:d=>String(d.i+1),fill:expectedSchedule?'white':'label',stroke:expectedSchedule?'label':undefined,r:5}),Plot.ruleX([0])];}
    else{plotOptions.x={type:'utc',label:null,...(expectedSchedule?{tickRotate:width<680?-90:0}:{}),ticks:expectedSchedule?r.dates.filter(d=>(!from||d>=from)&&(!to||d<=to)).map(d=>new Date(d+'T00:00:00Z')):Math.max(2,Math.floor(width/130)),tickFormat:d=>{if(expectedSchedule){const iso=d.toISOString().slice(0,10);return r.periods[r.dates.indexOf(iso)]||iso;}const span=points.at(-1)?.date-points[0]?.date;return span<90*86400000?d.toLocaleDateString('en-IN',{day:'numeric',month:'short',timeZone:'UTC'}):span<730*86400000?d.toLocaleDateString('en-IN',{month:'short',year:'2-digit',timeZone:'UTC'}):String(d.getUTCFullYear());}};plotOptions.y={label:null,grid:true,tickFormat:compactAxisValue};plotOptions.marks=records.flatMap((r,i)=>[Plot.lineY(points.filter(d=>d.i===i),{x:'date',y:'value',stroke:'label',strokeWidth:i?1.5:2,strokeDasharray:['','6,3','2,2','8,3,2,3'][i]}),Plot.dot(points.filter(d=>d.i===i&&d.value!=null&&(d.expected||d.estimated||d.date.getTime()===lastDates[i])),{x:'date',y:'value',stroke:'label',fill:d=>d.expected||d.estimated?'white':['#2E4BD8','#C47A16','#5F6675','#A3A9B4'][i],r:3})]);}
    chart=Plot.plot(plotOptions);
    if(records.length>1){
      const ns='http://www.w3.org/2000/svg',ctx=document.createElement('canvas').getContext('2d');ctx.font='12px Golos Text, system-ui, sans-serif';
      let baseline=plotOptions.height+24;
      records.forEach((r,i)=>{
        const words=(`${i+1}. ${displayName(r)}`).split(/\s+/),lines=[];let line='';const max=(width-84)*.9;
        for(const word of words){if(ctx.measureText((line?line+' ':'')+word).width>max&&line){lines.push(line);line='';}if(ctx.measureText(word).width>max){let part='';for(const char of word){if(ctx.measureText(part+char).width>max&&part){lines.push(part);part='';}part+=char;}line=part;}else line+=(line?' ':'')+word;}if(line)lines.push(line);
        const sample=document.createElementNS(ns,'line');for(const [k,v] of Object.entries({x1:24,x2:48,y1:baseline-4,y2:baseline-4,stroke:['#2E4BD8','#C47A16','#5F6675','#A3A9B4'][i],'stroke-width':2,'stroke-dasharray':['','6,3','2,2','8,3,2,3'][i]}))sample.setAttribute(k,String(v));chart.append(sample);
        for(const text of lines){const t=document.createElementNS(ns,'text');t.setAttribute('x','60');t.setAttribute('y',String(baseline));t.setAttribute('fill','#161A22');t.setAttribute('font-size','12');t.textContent=text;chart.append(t);baseline+=17;}baseline+=10;
      });chart.setAttribute('height',String(baseline+8));chart.setAttribute('viewBox',`0 0 ${width} ${baseline+8}`);
    }
    a11y(chart,expectedSchedule?'Expected source schedule':snapshot?'Published snapshot':`Published series: ${displayName(r)}`,`${r.unit}; missing observations are gaps. Underlying values are in the table.`);el('explore-chart').replaceChildren(chart);
    el('explore-chart-note').textContent=(expectedSchedule?`Expected administrative schedule by the source fiscal years, not realised exits. Hollow dots mark expected counts. ${expectedAsOf(r.meta)}. ${r.meta.forecastWindowNote||''}`:snapshot?'Snapshot: one published reference period. No trend or change rate is inferred.':'Straight segments join published values. Missing values break the line. Hollow dots identify estimated observations.')+' Axis abbreviations: k means thousand, m million, bn billion, tn trillion; very small or large ticks use scientific notation. Source units and observations are unchanged.';
    el('explore-unit').textContent=`Unit: ${unitLabel(r.unit)}. ${r.meta.frequency}. ${r.meta.base || 'No base year specified'}.`;
    table();
  }
  function render(){
    el('explore-static')?.setAttribute('hidden','');el('explore-view').hidden=!records.length;el('explore-intro').hidden=!!records.length;if(!records.length)return;
    const first=records[0];
    const held=records.find(r=>r.quality?.canInterpret===false);
    el('explore-quality').hidden=!held;
    if(held){
      el('explore-view').hidden=true;chart=null;
      const q=held.quality;el('explore-quality-title').textContent=(q.publicTitle||'Source record under review')+(held.series.geo||held.series.state?`: ${held.series.geo||held.series.state}`:'');
      el('explore-quality-reason').textContent=q.reason;el('explore-quality-status').textContent=`Review status: ${q.status.replace(/-/g,' ')}. This record remains accounted for in the catalogue.`;
      el('explore-quality-record').textContent=JSON.stringify({identity:held.id,sourceQuality:q,canonicalMeta:held.meta,canonicalSeries:held.series},null,2);
      const links=el('explore-quality-links');links.replaceChildren();
      for(const source of q.sourceLinks||[]){const a=node('a',source.title);a.href=source.url;const p=node('p');p.append(a);links.append(p);}
      const a=node('a','Download the archived canonical bundle mapping (under review)');a.href=`/data/${held.bundle}.json`;const p=node('p');p.append(a);links.append(p);
      document.title=el('explore-quality-title').textContent+' | India Atlas';status('Source mapping under review. Numeric interpretation and selected exports are withheld.');return;
    }
    el('explore-title').textContent=records.length>1?'Compare compatible series':(/^(Headline|Food|Core)$/i.test(first.series.label||'')&&first.guides[0]?`${first.guides[0].title}: ${displayName(first)}`:displayName(first));
    document.title=el('explore-title').textContent+' | India Atlas';
    el('explore-definition').textContent=first.quality?.definition||first.series.definition||first.meta.coverage||first.meta.product||'Read the parent guide for the definition and survey limits.';
    const list=el('explore-selected');list.replaceChildren();
    records.forEach((r,i)=>{const li=node('li');const mark=node('i');mark.className='series-mark';mark.setAttribute('aria-hidden','true');li.append(mark,node('strong',`${i+1}. ${displayName(r)}`));const last=r.series.data.findLastIndex(v=>v!=null);li.append(node('span',last<0?'No published value':`${r.meta.observationKind==='expected-schedule'?'Expected count at final source schedule period: ':''}${fmt(r.series.data[last])} ${unitLabel(r.unit)}, ${r.periods[last]||r.dates[last]}${r.meta.observationKind==='expected-schedule'?` (${expectedAsOf(r.meta)})`:r.series.estimated?.includes(r.dates[last])?' (estimate)':''}`));if(records.length>1){const button=node('button','Remove');button.onclick=()=>navigate(records.filter(x=>x.id!==r.id).map(x=>x.id));li.append(button);}list.append(li);});
    const info=el('explore-provenance');info.replaceChildren();
    const facts=[['Source quality',first.quality?.status==='canonical-values-checked'?'Canonical numeric checks passed':first.quality?.reason||'Source mapping status not supplied'],['Source',first.series.source||first.meta.source],['Geography and cuts',Object.entries(first.series.dims||{geography:first.series.state||(first.meta.geo==='IND'?'India':first.meta.geo),group:first.series.group}).filter(([,v])=>v!=null).map(([k,v])=>`${k.replace(/_/g,' ')}: ${v}`).join('; ')],['Instrument',`${first.bundle}; ${first.meta.base||'base not specified'}`],['Revision',first.quality?.sourceRevisionStatus==='unknown'?'Source revision date not published. Archive capture is separate.':first.meta.vintage?`Data vintage ${first.meta.vintage}`:`Revision date unknown. ${first.meta.vintageNote||''}`],['Reference period',first.quality?.referencePeriod||first.meta.latestPeriod||'Read the period labels in the table'],['Archive capture',first.quality?.archiveCapturedDate||first.meta.archiveCapturedDate||'Not separately declared'],['Revision policy',first.meta.revisionPolicy||'No revision policy published in this bundle.'],['Method and limits',first.meta.note||'See the guide and source metadata.'],['Missing periods',first.series.gaps?.length?first.series.gaps.join(', '):'No declared interior missing periods. Null observations remain unpublished.'],['Expected window',first.meta.observationKind==='expected-schedule'?first.meta.forecastWindowNote||'Read the source fiscal-year labels.':'Not an expected schedule'],['Expected schedule',first.meta.observationKind==='expected-schedule'?`All listed source years are expected schedule values; ${expectedAsOf(first.meta)}. ${first.series.expectedNote||''}`:'Not an expected schedule'],['Estimates',first.series.estimated?.length?`${first.series.estimated.join(', ')}. ${first.series.estimatedNote||'Estimated observations; method not declared here. Read the guide.'}`:'No observations marked estimated.']];
    facts.forEach(([label,value])=>{info.append(node('dt',label),node('dd',value||'Not declared'));});
    if(first.meta.sourceUrl&&/^https?:\/\//.test(first.meta.sourceUrl)){const a=node('a','Original source');a.href=first.meta.sourceUrl;const dd=node('dd');dd.append(a);info.append(node('dt','Source link'),dd);}
    const guides=el('explore-guides');guides.replaceChildren();for(const g of first.guides){const a=node('a',g.title);a.href=`/guides/${g.slug}/`;guides.append(a);}if(!first.guides.length)guides.textContent='No parent guide registered for this instrument.';
    const related=el('explore-related');related.replaceChildren();
    const peers=(canComparePolicy(first.quality)?first.related||[]:[]).filter(anchor=>!records.some(r=>r.id===identity(first.bundle,anchor)));
    if(peers.length){const show=node('button','Find compatible cuts');related.append(show);show.onclick=async()=>{show.disabled=true;show.textContent='Loading compatible cuts…';try{const candidates=await Promise.all(peers.map(anchor=>loader.load(identity(first.bundle,anchor),controller.signal)));if(!show.isConnected)return;related.replaceChildren();for(const candidate of candidates){if(!canComparePolicy(candidate.quality))continue;const b=node('button',displayName(candidate));b.dataset.series=candidate.id;b.onclick=()=>navigate([...records.map(r=>r.id),candidate.id]);related.append(b);}}catch(error){if(error.name!=='AbortError'){show.disabled=false;show.textContent='Retry compatible cuts';status(error.message);}}};}
    else related.textContent=first.compare?'Use search to add another observed cut in this set.':'No compatible set declared for this series.';
    el('explore-compatibility').textContent=!canComparePolicy(first.quality)?`Comparison is withheld by source policy. ${first.quality?.comparisonReason||first.quality?.reason||'Inspect this source record individually.'}`:first.compare?'This set holds the instrument, unit and measure fixed. Only explicitly observed state/sector cuts or same-instrument CPI components may vary. Dates align by published date key; missing values stay null.':'This series has no audited comparison set. Explore it individually; matching units alone do not establish comparable measures.';
    draw();status(`Loaded ${records.length} ${records.length===1?'series':'compatible series'}.`);
  }
  async function navigate(ids, push=true){
    controller?.abort();controller=new AbortController();const mine=++epoch;status('Loading selected observations…');
    try{if(ids.length>MAX_COMPARE)throw new Error(`Choose at most ${MAX_COMPARE} series.`);if(new Set(ids).size!==ids.length)throw new Error('That series is already selected.');ids.forEach(parseIdentity);const next=await Promise.all(ids.map(id=>loader.load(id,controller.signal)));assertCompatible(next);if(mine!==epoch)return;records=next;tablePage=0;if(push)history.pushState(null,'',seriesURL(ids,range()));render();}
    catch(error){if(error.name!=='AbortError'&&mine===epoch)status(error.message);}
  }
  const params=new URLSearchParams(location.search);for(const k of ['from','to']){const v=params.get(k);if(v&&/^\d{4}-\d{2}-\d{2}$/.test(v))el('explore-'+k).value=v;}
  appliedRange={from:el('explore-from').value,to:el('explore-to').value};
  const initial=params.has('series')?params.getAll('series'):(root.dataset.series?[root.dataset.series]:[]);if(initial.length)navigate(initial,false);
  addEventListener('popstate',()=>{const p=new URLSearchParams(location.search);for(const k of ['from','to'])el('explore-'+k).value=p.get(k)||'';appliedRange={from:el('explore-from').value,to:el('explore-to').value};navigate(p.getAll('series'),false);});
  el('explore-range').onsubmit=e=>{e.preventDefault();const next={from:el('explore-from').value,to:el('explore-to').value};if(next.from&&next.to&&next.from>next.to){status('The start date must be before the end date.');return;}appliedRange=next;tablePage=0;history.replaceState(null,'',seriesURL(records.map(r=>r.id),range()));draw();};
  el('explore-prev').onclick=()=>{tablePage--;table();};el('explore-next').onclick=()=>{tablePage++;table();};
  el('explore-quality-copy').onclick=()=>navigator.clipboard.writeText(location.href).then(()=>status('Record link copied.')).catch(()=>status('Copy this page’s address from your browser.'));
  el('explore-copy').onclick=()=>navigator.clipboard.writeText(location.href).then(()=>status('Series link copied.')).catch(()=>status('Copy this page’s address from your browser.'));
  el('explore-csv').onclick=()=>save(selectedCSV(records,range()),'text/csv','atlas-selected-series.csv');
  el('explore-json').onclick=()=>save(JSON.stringify(selectedJSON(records,range()),null,2),'application/json','atlas-selected-series.json');
  const meta=()=>({title:el('explore-title').textContent,sub:el('explore-unit').textContent,foot:records[0]?.meta.source||'India Atlas'});
  el('explore-svg').onclick=()=>chart&&downloadSVG(chart,'atlas-series',meta());el('explore-png').onclick=()=>chart&&downloadPNG(chart,'atlas-series',meta());
  const q=el('explore-search');let timer;
  async function search(){const mine=++searchEpoch,text=q.value.trim();const out=el('explore-results');out.replaceChildren();if(!text)return;out.append(node('p','Searching the catalogue…'));try{
    searchPromise??=fetch('/search/core.json').then(r=>{if(!r.ok)throw new Error('Search is unavailable. Browse the guides below.');return r.json();}).then(core=>createSearch(core,p=>fetch('/search/'+p).then(r=>{if(!r.ok)throw new Error('Search data could not load.');return r.json();}),{expectedQualityVersion:root.dataset.qualityVersion})).catch(e=>{searchPromise=null;throw e;});
    const S=await searchPromise,result=await S.series(text,{limit:12});if(mine!==searchEpoch)return;out.replaceChildren();if(!result.rows.length)out.append(node('p',result.tooBroad?'Add a state, item or specific measure to narrow the search.':'No matching series. Try fewer words or browse a guide.'));
    for(const r of result.rows){const id=r.identity;if(!id)throw new Error('Search and explorer versions differ. Refresh this page.');parseIdentity(id);const li=node('li');const a=node('a',r.label);a.href=seriesURL([id]);a.onclick=e=>{e.preventDefault();navigate([id]);};const blocked=r.quality?.canInterpret===false;li.append(a,node('small',blocked?`Under review: ${r.quality.reason}`:`${r.file}; ${r.expectedSchedule?r.expectedSchedule.label+': ':''}${r.latest}, ${r.period}${r.expectedSchedule?'; '+r.expectedSchedule.asOf:''}`));if(records.length&&!blocked&&canComparePolicy(r.quality)&&records.every(record=>canComparePolicy(record.quality))){const b=node('button','Add to comparison');b.onclick=()=>navigate([...records.map(r=>r.id),id]);li.append(b);}out.append(li);}
  }catch(error){if(mine===searchEpoch)out.replaceChildren(node('p',error.message));}}
  q.oninput=()=>{searchEpoch++;clearTimeout(timer);timer=setTimeout(search,180);};
  el('explore-search-form').onsubmit=e=>{e.preventDefault();clearTimeout(timer);search();};
}
