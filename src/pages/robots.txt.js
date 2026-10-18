// /robots.txt: every crawler may read every page. Search engines and AI assistants are named so the
// policy is explicit to each (a crawler with its own group reads only that group, so each carries
// the same rules). Only machine files that are not pages are kept out: the search index shards,
// the every-cut row packs and the explorer's chunks, which a crawler would fetch by the thousand
// for nothing it can index. Pages, kit.json drawings, CSS and scripts stay open for rendering.
import { SITE } from "../site.js";

// search engines, then AI assistants and their retrieval agents (checked October 2026)
const AGENTS = [
  "Googlebot", "Bingbot", "DuckDuckBot", "Applebot", "YandexBot",
  "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "anthropic-ai",
  "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "Amazonbot", "meta-externalagent",
  "DuckAssistBot", "MistralAI-User", "cohere-ai", "CCBot",
];
const RULES = ["Allow: /", "Disallow: /search/", "Disallow: /ec/", "Disallow: /explore-data/"];

export function GET() {
  const groups = [...AGENTS, "*"].map((a) => [`User-agent: ${a}`, ...RULES].join("\n")).join("\n\n");
  const body = `# ${SITE.name}: ${SITE.url}/
# Guides, data files and feeds are open to every reader, human or machine. Plain-text summaries
# for language models: ${SITE.url}/llms.txt and ${SITE.url}/llms-full.txt

${groups}

Sitemap: ${SITE.url}/sitemap-index.xml
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
