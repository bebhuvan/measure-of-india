export function energyReportCells(raw){const tables=[];
for(const page of raw.text.split('\f')){
 const title=page.match(/Table[ -][^\n]*?:\s*Energy Balance of India for (20\d\d-\d\d)[^\n]*/i);if(!title)continue;
 const unit=/All figures in Peta/i.test(page)?'pj':'ktoe';
 const fuels=/Lignite/.test(page)?['Coal','Lignite','Crude Oil','Oil Products','Natural Gas','Nuclear','Hydro','Solar, Wind, Others','Electricity','Total']:['Coal (including lignite)','Crude Oil','Oil Products','Natural Gas','Nuclear','Hydro','Solar, Wind, Others','Electricity','Total'];
 const rows=[];
 for(const line of page.split('\n')){const m=line.match(/^([A-Za-z][A-Za-z .,&()/#-]+?)\s{2,}(-?[\d,]+(?:\.\d+)?(?:\s+-?[\d,]+(?:\.\d+)?)+)\s*$/);if(!m)continue;
 const values=m[2].trim().split(/\s+/).map(x=>Number(x.replaceAll(',','')));if(values.length!==fuels.length)throw Error('Report column mismatch '+title[0]+' '+m[1]+' '+values.length);
 rows.push({flow:m[1].trim(),values});
 }
 
 tables.push({title:title[0].trim(),year:title[1],unit,fuels,rows});
}
if(tables.length!==14)throw Error('Expected 12 historical KToE and 2 PJ tables, got '+tables.length);
return tables;}
