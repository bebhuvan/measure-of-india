import {mospi} from './lib/mospi.mjs';
import {guardEnergyArchive} from './lib/energy-archive-guard.mjs';
import {writeRaw} from './lib/util.mjs';
for(const [tag,route,params] of [['list','energy/getEnergyIndicatorList',{}],... [1,2].flatMap(ind=>[1,2].map(use=>[`filter-${ind}-${use}`,'energy/getEnergyFilterByIndicatorId',{indicator_code:ind,use_of_energy_balance_code:use}]))]){
 const body=await mospi(route,params); guardEnergyArchive(process.cwd(),`data/raw/energy-${tag}.json`,{body},['body']);writeRaw(process.cwd(),`data/raw/energy-${tag}.json`,{route,params,body});console.log(tag,JSON.stringify(body).slice(0,16000));
}
