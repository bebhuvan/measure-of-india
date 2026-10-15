import {unitOf} from '../../src/dossiers/units.js';

// An unknown unit must never turn a source-specific check into an unbounded range.
export function registeredSeriesRanges(bundle, registered, slug) {
  return Object.fromEntries(Object.entries(bundle.series).map(([key, series]) => {
    const unit=unitOf(bundle,series), bounds=registered?.[unit];
    if(!Array.isArray(bounds)||bounds.length!==2||!bounds.every(Number.isFinite)||bounds[0]>bounds[1])
      throw Error(`${slug}.${key}: no valid finite registered range for ${unit}`);
    return [key,bounds];
  }));
}
