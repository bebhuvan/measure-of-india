// Frozen launch archive: verify the admitted source corpus; never acquire or refresh.
import {pensionsModel} from '../../../src/dossiers/pensions.model.js';
export async function buildPensionsProduct(ROOT){
 const model=pensionsModel({root:ROOT});
 return {mode:'frozen-source-archive',bundles:model.manifest.bundles.length,records:model.coverage.publicationRecords,reviewed:model.coverage.reviewedStandaloneRecords,pending:model.coverage.pendingRecords,sourceOnly:model.coverage.sourceOnlyRecords};
}
