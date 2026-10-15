import {readRaw,rawExists} from './util.mjs';
// Acquisition in this wave reproduces an already reviewed edition. A changed
// source must be staged and assigned a reviewed data vintage before replacing it.
export function assertEnergyArchiveIdentity(previous,incoming,fields){
 for(const field of fields){const value=JSON.stringify(incoming[field]);if(value===undefined)throw Error('Energy source identity missing '+field);
  if(previous&&JSON.stringify(previous[field])!==value)throw Error('Energy archived edition changed ('+field+'); existing raw preserved. Stage and review a new source vintage before replacement.');
 }
}
export function guardEnergyArchive(root,file,incoming,fields){assertEnergyArchiveIdentity(rawExists(root,file)?readRaw(root,file):null,incoming,fields);}
