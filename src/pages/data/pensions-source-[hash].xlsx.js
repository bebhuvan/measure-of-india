// Exact retained originals, independently bound by the reviewed download contract.
import {loadPensionDownloadContract,pensionOriginalResponse} from "../../dossiers/governed-downloads.js";
export function getStaticPaths(){return loadPensionDownloadContract().originals.map(s=>({params:{hash:s.sha256}}));}
export function GET({params}){return pensionOriginalResponse(params.hash);}
