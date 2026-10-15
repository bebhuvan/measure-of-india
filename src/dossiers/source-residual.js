// Source residual labels are categorical rows, never territorial aliases.
// Exact declaration and preserved dimensions are required; metadata alone cannot
// turn an arbitrary or misspelled state into a residual category.
const SOURCE_RESIDUALS=new Set(['Others','Others (NRI/Defense)','NRI/Other']);
export function sourceNonTerritorialResidual(series){
 const state=series?.dims?.state,dimensions=series?.dimensions;
 return series?.dims?.geography_type==='source nonresident/other category'
  &&series?.geographyStatus==='source aggregate or nonresident category'
  &&SOURCE_RESIDUALS.has(state)&&Array.isArray(dimensions)
  &&dimensions[0]===state&&series.label===dimensions.join(' · ');
}
