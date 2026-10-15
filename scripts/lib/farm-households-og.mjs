import fs from 'node:fs';
export function farmHouseholdsOg(){
 const key='c_f933a5307465e8a32ad64e2d';
 const rows=[['After paid-out costs',24],['After paid-out and imputed costs',25]].map(([label,code])=>{
  const b=JSON.parse(fs.readFileSync(`data/series/farm-households-nss77-${code}-03.json`));
  const s=b.series[key];if(!s||!Number.isFinite(s.data[0]))throw Error('Missing national farm income');
  return {label,value:s.data[0],period:s.dims.season};
 });
 if(rows[0].period!==rows[1].period)throw Error('Different income periods');
 const bars=rows.map((r,i)=>{
  const y=100+i*145,w=r.value/12000*690;
  return `<text x="0" y="${y-20}" font-family="Golos Text" font-size="21" fill="#4A5160">${r.label}</text><rect x="0" y="${y}" width="${w}" height="40" fill="${i?'#878D99':'#2E4BD8'}"/><text x="${w+18}" y="${y+30}" font-family="Source Serif 4" font-size="36" fill="#161A22">₹${r.value.toLocaleString('en-IN')}</text>`;
 }).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="400"><text x="0" y="35" font-family="Golos Text" font-size="19" fill="#4A5160">Mean monthly income per agricultural household, ${rows[0].period}</text>${bars}</svg>`;
}
