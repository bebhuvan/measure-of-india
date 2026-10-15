// Source-period labels only: resolve crowded ticks in time/pixel space without
// changing scale domains, observations, missing values, formatting or font size.
export function sourcePeriodTicks(points,{range,canvasWidth,maxTicks=6,format,measure,gap=8}={}){
 if(!Array.isArray(range)||range.length!==2||!range.every(Number.isFinite)||range[1]<=range[0]||!Number.isFinite(canvasWidth)||canvasWidth<=0||!Number.isInteger(maxTicks)||maxTicks<1||!Number.isFinite(gap)||gap<0)throw Error('Invalid source tick geometry');
 let previous=-Infinity;const rows=[];
 for(const p of points){const date=p.date instanceof Date?p.date:new Date(p.date),time=+date;if(!Number.isFinite(time)||time<=previous)throw Error('Source tick dates must be finite, unique and ordered');previous=time;if(p.value===null)continue;if(!Number.isFinite(p.value))throw Error('Source tick values must be finite or null');const text=format(date),width=measure(text);if(typeof text!=='string'||!text.trim()||!Number.isFinite(width)||width<0)throw Error('Source tick label or measurement missing');rows.push({date,time,text,width});}
 if(!rows.length)return [];
 const first=rows[0],last=rows.at(-1),span=last.time-first.time;
 for(const r of rows)r.x=span?range[0]+(r.time-first.time)/span*(range[1]-range[0]):(range[0]+range[1])/2;
 const fits=selected=>{const order=[...selected].sort((a,b)=>a.time-b.time);return order.every((r,i)=>r.x-r.width/2>=0&&r.x+r.width/2<=canvasWidth&&(!i||r.x-order[i-1].x>=(r.width+order[i-1].width)/2+gap));};
 const limit=Math.min(maxTicks,rows.length),legacy=[...new Set(Array.from({length:limit},(_,i)=>Math.round(i*(rows.length-1)/Math.max(1,limit-1))))].map(i=>rows[i]);
 if(fits(legacy))return legacy.map(r=>r.date);
 const selected=[];if(fits([last]))selected.push(last);if(limit>1&&first!==last&&fits([...selected,first]))selected.push(first);
 for(let i=1;i<limit-1;i++){const target=first.time+span*i/(limit-1),candidates=rows.filter(r=>!selected.includes(r)&&fits([...selected,r])).sort((a,b)=>Math.abs(a.time-target)-Math.abs(b.time-target)||a.time-b.time);if(candidates.length)selected.push(candidates[0]);}
 if(!selected.length){const middle=rows.filter(r=>fits([r])).sort((a,b)=>Math.abs(a.x-(range[0]+range[1])/2)-Math.abs(b.x-(range[0]+range[1])/2));if(middle.length)selected.push(middle[0]);}
 return selected.sort((a,b)=>a.time-b.time).map(r=>r.date);
}

// One read phase before chart writes. Native SVG advance widths use the exact
// formatted labels and chart font. Non-layout hosts (QC/jsdom) retain the shared
// chart system's conservative0.6em geometry; real-browser ink QA remains required.
export function measurePeriodLabels(labels,{document:doc=globalThis.document,fontFamily,fontSize=12}={}){
 const texts=[...new Set(labels)];if(texts.some(t=>typeof t!=='string'||!t.trim()))throw Error('Missing formatted source period');
 const fallback=()=>new Map(texts.map(t=>[t,t.length*fontSize*.6]));if(!doc?.createElementNS||!doc.body)return fallback();
 const ns='http://www.w3.org/2000/svg',probe=doc.createElementNS(ns,'text');if(typeof probe.getComputedTextLength!=='function')return fallback();
 const svg=doc.createElementNS(ns,'svg');svg.setAttribute('aria-hidden','true');svg.setAttribute('font-family',fontFamily);svg.setAttribute('font-size',String(fontSize));Object.assign(svg.style,{position:'fixed',left:'-10000px',top:'0',width:'1px',height:'1px',overflow:'visible',visibility:'hidden',pointerEvents:'none'});
 const nodes=texts.map(t=>{const n=doc.createElementNS(ns,'text');n.textContent=t;svg.append(n);return n;});doc.body.append(svg);
 try{return new Map(nodes.map((n,i)=>{const width=n.getComputedTextLength();if(!Number.isFinite(width)||width<=0)throw Error('Source label measurement failed');return [texts[i],width];}));}finally{svg.remove();}
}
