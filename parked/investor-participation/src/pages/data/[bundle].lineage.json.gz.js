import {investorLineageContract,investorLineageBytes} from '../../../scripts/lib/investor-lineage.mjs';
export function getStaticPaths(){return investorLineageContract().files.map(f=>({params:{bundle:f.bundle}}));}
export function GET({params}){return new Response(investorLineageBytes(params.bundle),{headers:{'Content-Type':'application/gzip','Content-Disposition':`attachment; filename="${params.bundle}.lineage.json.gz"`}});}
