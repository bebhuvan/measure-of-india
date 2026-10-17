import {SITE} from '../site.js';
// The chart is drawn with the house chart kit (src/kit/kit.js) in the browser, at the container's
// measured width, because the reader picks the series; src/kit/enhance.js adds hover and the
// SVG/PNG downloads (the figure's data-dl buttons). Missing values stay null and break the line.
import * as K from '../kit/kit.js';
import {figure} from '../kit/figure.js';
import {enhance} from '../kit/enhance.js';
import {createSearch,expectedScheduleContext} from '../dossiers/search-core.js';
import {createLoader} from './loader.js';
import {MAX_COMPARE,canComparePolicy,seriesURL,parseIdentity,assertCompatible,assertExpectedPolicy,observations,aligned,selectedCSV,selectedJSON,identity,unitLabel,expectedAsOf} from './model.js';
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
  // kit drawing helpers: frequency for the hover and tick labels, unit suffix, decimals the source publishes
  const freqOf=(m,dates)=>m.frequency==='monthly'?'month':m.frequency==='quarterly'?'quarter':m.frequency==='annual'?(m.calendar==='fiscal-apr'||(m.calendar!=='calendar'&&dates.every(d=>d.slice(5)==='04-01'))?'fy':'year'):'day';
  const PCT=new Set(['pct','pct_yoy','percent','pct_gdp','pct_rse']);
  const unitOf=u=>PCT.has(u)?{suffix:'%'}:{};
  const dpOf=vals=>Math.min(3,Math.max(0,...vals.map(v=>{const t=String(+(+v).toFixed(6));return t.includes('e')?3:(t.split('.')[1]||'').length;})));
  // end labels: the series number (as in the list below the chart) and the cut's name, cut at a word; the number is tied to the first word so a phone keeps both
  const short=(r,i)=>{const n=displayName(r),t=n.split(': ').at(-1)||n,w=t.split(/\s+/);let out=w[0];for(const x of w.slice(1)){if((out+' '+x).length>24){out+='…';break;}out+=' '+x;}return `${i+1}.\u00a0${out.replace(/[,;:]…$/,'…')}`;};
  const esc=t=>String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;');
  let drawnWidth=0;
  function chartHTML(){
    const r=records[0],expectedSchedule=Boolean(expectedScheduleContext(r.quality)),width=Math.max(300,Math.min(1184,el('explore-chart').clientWidth||880));drawnWidth=width;
    const snapshot=records.every(r=>r.series.data.filter(v=>v!=null).length<=1);
    const obs=records.map(r=>observations(r,range()));
    const vals=obs.flatMap(o=>o.map(d=>d.value).filter(v=>v!=null)),dp=dpOf(vals),unit=unitOf(r.unit),freq=freqOf(r.meta,r.dates);
    const label=(expectedSchedule?'Expected source schedule':snapshot?'Published snapshot':`Published series: ${displayName(r)}`)+`. ${r.unit}; missing observations are gaps. Underlying values are in the table.`;
    const widths={wide:width,mid:width,phone:width};
    let draw;
    if(snapshot){
      // row names: one series is named by the title, so its bar carries the reference period; several
      // are named by what tells the cuts apart (the words they do not share), numbered as in the list, fitted to the name column
      const words=records.map(r=>displayName(r).split(/\s+/));let pre=0,suf=0;
      if(words.length>1){while(words.every(w=>w[pre]===words[0][pre]&&pre<w.length-1))pre++;while(words.every(w=>w.at(-1-suf)===words[0].at(-1-suf)&&suf<w.length-1-pre))suf++;}
      const fit=(t,max)=>{if(K.tw(t,13,400)<=max)return t;while(t.length>1&&K.tw(t+'…',13,400)>max)t=t.slice(0,-1);return t.trimEnd().replace(/[,;:-]$/,'')+'…';};
      const nameOf=(i,w)=>{const t=(words.length>1?words[i].slice(pre,words[i].length-suf):words[i]).join(' ').replace(/^[,;:-]\s*|\s*[,;:-]$/g,'')||displayName(records[i]);return fit(`${i+1}. ${t}`,w<560?w-24:Math.min(320,Math.round(w*.45))-16);};
      draw=w=>K.bars({width:w,unit,dp,sort:false,nameMax:Math.min(320,Math.round(w*.45)),rows:records.map((r,i)=>{const d=obs[i].find(d=>d.value!=null);return d?{name:records.length===1?(d.period||d.date):nameOf(i,w),value:d.value,color:records.length===1?K.C.lead:K.CAT[i]}:null;}).filter(Boolean)});
    }else{
      const series=records.map((r,i)=>({name:displayName(r),short:short(r,i),data:obs[i].map(d=>[d.date,d.value]),role:records.length===1?'lead':'cat',color:records.length===1?K.C.lead:K.CAT[i],dots:expectedSchedule?'open':undefined}));
      // estimated observations: hollow dots over the line (the same series, never joined to anything)
      records.forEach((r,i)=>{if(obs[i].some(d=>d.estimated&&d.value!=null))series.push({name:displayName(r)+', estimate',data:obs[i].map(d=>[d.date,d.estimated?d.value:null]),role:'cat',color:series[i].color,dots:'open',label:false,hover:false});});
      let xTicks;
      // annual series: one tick per year, thinned to the width (the kit's own ticks assume a span of years)
      if(!expectedSchedule&&(freq==='fy'||freq==='year')){const ds=obs[0].map(d=>d.date),step=Math.max(1,Math.ceil(ds.length/Math.max(2,Math.floor(width/(freq==='fy'?84:64)))));xTicks=ds.filter((_,k)=>(ds.length-1-k)%step===0).map(d=>({t:d,label:K.tlabel(d,freq)}));}
      if(expectedSchedule){const ds=obs[0].map(d=>d.date),step=Math.max(1,Math.ceil(ds.length/Math.max(2,Math.floor(width/90))));xTicks=ds.filter((_,k)=>k%step===0).map(d=>({t:d,label:r.periods[r.dates.indexOf(d)]||d}));}
      draw=w=>K.line({width:w,height:w<520?260:380,series,unit,dp:undefined,endDp:dp,hoverDp:dp,freq,...(xTicks?{xTicks}:{})});
    }
    return `<span class="akf-title" hidden>${esc(el('explore-title').textContent)}</span><span class="akf-src" hidden>${esc('Source: '+(r.series.source||r.meta.source||SITE.name))}</span>`+
      figure({bare:true,file:'atlas-series',label,widths,draw,data:{cols:['Period',...records.map(displayName)],rows:aligned(records,range()).map(row=>[row.date,...row.values])}});
  }
  function drawChart(){const box=el('explore-chart');box.innerHTML=chartHTML();chart=box.querySelector('.akf');enhance(box);}
  new ResizeObserver(()=>{if(!chart||!records.length)return;const w=Math.max(300,Math.min(1184,el('explore-chart').clientWidth||880));if(Math.abs(w-drawnWidth)>4){clearTimeout(drawChart.t);drawChart.t=setTimeout(drawChart,120);}}).observe(el('explore-chart'));
  function draw(){
    if(!records.length)return;
    records.forEach(assertExpectedPolicy);
    const r=records[0],expectedSchedule=Boolean(expectedScheduleContext(r.quality)),from=range().from,to=range().to;if(expectedSchedule&&r.meta.observationKind!=='expected-schedule')throw Error('Expected source policy and canonical class differ');if(from&&to&&from>to){status('The start date must be before the end date.');return;}
    const points=records.flatMap(r=>observations(r,range()));
    const snapshot=records.every(r=>r.series.data.filter(v=>v!=null).length<=1);
    el('explore-range').hidden=snapshot&&!from&&!to;
    if (!points.some(d=>d.value!=null)) {chart=null;el('explore-chart').textContent='No published observations in this date range.';el('explore-chart-note').textContent='Unpublished observations remain null in the table and downloads.';el('explore-unit').textContent=`Unit: ${unitLabel(r.unit)}. ${r.meta.frequency}.`;el('explore-svg').disabled=true;el('explore-png').disabled=true;table();return;}
    el('explore-svg').disabled=false;el('explore-png').disabled=false;
    drawChart();
    el('explore-chart-note').textContent=(expectedSchedule?`Expected administrative schedule by the source fiscal years, not realised exits. Hollow dots mark expected counts. ${expectedAsOf(r.meta)}. ${r.meta.forecastWindowNote||''}`:snapshot?'Snapshot: one published reference period. No trend or change rate is inferred.':'Straight segments join published values. Missing values break the line. Hollow dots identify estimated observations.')+' Axis values use Indian digit grouping (12,34,567). Source units and observations are unchanged.';
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
      document.title=el('explore-quality-title').textContent+' | '+SITE.short;status('Source mapping under review. Numeric interpretation and selected exports are withheld.');return;
    }
    el('explore-title').textContent=records.length>1?'Compare compatible series':(/^(Headline|Food|Core)$/i.test(first.series.label||'')&&first.guides[0]?`${first.guides[0].title}: ${displayName(first)}`:displayName(first));
    document.title=el('explore-title').textContent+' | '+SITE.short;
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
  // SVG and PNG: the buttons carry data-dl; src/kit/enhance.js composes them from the drawn figure
  const q=el('explore-search');let timer;
  async function search(){const mine=++searchEpoch,text=q.value.trim();const out=el('explore-results');out.replaceChildren();if(!text)return;out.append(node('p','Searching the catalogue…'));try{
    searchPromise??=fetch('/search/core.json').then(r=>{if(!r.ok)throw new Error('Search is unavailable. Browse the guides below.');return r.json();}).then(core=>createSearch(core,p=>fetch('/search/'+p).then(r=>{if(!r.ok)throw new Error('Search data could not load.');return r.json();}),{expectedQualityVersion:root.dataset.qualityVersion})).catch(e=>{searchPromise=null;throw e;});
    const S=await searchPromise,result=await S.series(text,{limit:12});if(mine!==searchEpoch)return;out.replaceChildren();if(!result.rows.length)out.append(node('p',result.tooBroad?'Add a state, item or specific measure to narrow the search.':'No matching series. Try fewer words or browse a guide.'));
    for(const r of result.rows){const id=r.identity;if(!id)throw new Error('Search and explorer versions differ. Refresh this page.');parseIdentity(id);const li=node('li');const a=node('a',r.label);a.href=seriesURL([id]);a.onclick=e=>{e.preventDefault();navigate([id]);};const blocked=r.quality?.canInterpret===false;li.append(a,node('small',blocked?`Under review: ${r.quality.reason}`:`${r.file}; ${r.expectedSchedule?r.expectedSchedule.label+': ':''}${r.latest}, ${r.period}${r.expectedSchedule?'; '+r.expectedSchedule.asOf:''}`));if(records.length&&!blocked&&canComparePolicy(r.quality)&&records.every(record=>canComparePolicy(record.quality))){const b=node('button','Add to comparison');b.onclick=()=>navigate([...records.map(r=>r.id),id]);li.append(b);}out.append(li);}
  }catch(error){if(mine===searchEpoch)out.replaceChildren(node('p',error.message));}}
  q.oninput=()=>{searchEpoch++;clearTimeout(timer);timer=setTimeout(search,180);};
  el('explore-search-form').onsubmit=e=>{e.preventDefault();clearTimeout(timer);search();};
}
