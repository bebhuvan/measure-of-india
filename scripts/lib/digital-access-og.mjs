const escape=text=>String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
export function digitalAccessOg(bundle){
  const value=bundle.series.c_9dfb5647c122b90f0409fc15?.data[0];
  if(bundle.dates.length!==1||!Number.isFinite(value)||value<0||value>100)throw Error('Invalid household internet snapshot for OG');
  const x=40+value/100*740;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="852" height="340"><text x="40" y="45" font-family="Golos Text" font-size="22" fill="#4A5160">Households with internet within their premises</text><text x="40" y="82" font-family="Golos Text" font-size="18" fill="#4A5160">${escape(bundle.meta.latestPeriod)} · survey snapshot</text><line x1="40" x2="780" y1="210" y2="210" stroke="#D3D7DE"/>${[0,25,50,75,100].map(v=>`<text x="${40+v*7.4}" y="260" text-anchor="middle" font-family="Golos Text" font-size="18" fill="#4A5160">${v}%</text>`).join('')}<circle cx="${x}" cy="210" r="7" fill="#2E4BD8"/><text x="${x}" y="170" text-anchor="middle" font-family="Source Serif 4" font-size="34" fill="#161A22">${value.toFixed(1)}%</text></svg>`;
}
