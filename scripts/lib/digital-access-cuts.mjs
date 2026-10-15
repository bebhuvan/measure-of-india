// Restore only observed source cuts; API synthetic measure stays available to explorer.
export function digitalCuts(bundle,series){const map=series.dims??series.dimensions;if(!map)throw Error('Missing observed cut map');return bundle.meta.dimensions?Object.fromEntries(bundle.meta.dimensions.map(key=>[key,map[key]])):map;}

export {registeredSeriesRanges} from './series-range-contract.mjs';
