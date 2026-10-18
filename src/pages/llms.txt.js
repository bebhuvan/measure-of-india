// /llms.txt: the site described for language models (src/seo/llms.js).
import { llmsTxt } from "../seo/llms.js";
export function GET() {
  return new Response(llmsTxt(), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
