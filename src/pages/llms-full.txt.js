// /llms-full.txt: every guide's latest reading, data files and every state's figures (src/seo/llms.js).
import { llmsFullTxt } from "../seo/llms.js";
export async function GET() {
  return new Response(await llmsFullTxt(), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
