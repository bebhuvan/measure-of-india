import {mospiAll} from './lib/mospi.mjs';
import {writeRaw,rawExists,readRaw} from './lib/util.mjs';
for(const ind of [1,2])for(const use of [1,2]){
 const rel=`data/raw/energy-records-${ind}-${use}.json`;
 if(rawExists(process.cwd(),rel)){console.log('resume',rel);continue;}
 const rows=await mospiAll('energy/getEnergyRecords',{indicator_code:ind,use_of_energy_balance_code:use});
 writeRaw(process.cwd(),rel,{params:{indicator_code:ind,use_of_energy_balance_code:use},rows}); console.log(ind,use,rows.length,JSON.stringify(rows.slice(0,3)));
}
