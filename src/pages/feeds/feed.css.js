// /feeds/feed.css: how an RSS feed looks when someone opens it in a browser. A stylesheet in CSS
// rather than XSLT, which browsers are removing (src/seo/feeds.js). It sets the house type on the
// feed's own elements and says, above them, what a feed is for; readers ignore it.
import FONTS from "../../styles/fonts.generated.js";
import { SITE } from "../../site.js";
const face = (f) => `@font-face{font-family:"${f.family}";font-style:${f.style};font-weight:${f.weight};font-display:swap;src:url(/fonts/${f.files.primary}) format("woff2")}`;
export function GET() {
  const css = `@namespace atom url(http://www.w3.org/2005/Atom);
${face(FONTS.faces.serif)}
${face(FONTS.faces.sans)}
rss{display:block;background:#FFFFFF;color:#15171A;font:400 1.0625rem/1.6 "Newsreader",Georgia,serif;padding:48px 20px 96px}
channel{display:block;max-width:44rem;margin:0 auto}
channel::before{content:"This is a feed. To follow it, copy this page's address into a feed reader. Every feed the site offers is listed at ${SITE.host}/feeds/";display:block;font:400 .875rem/1.5 "Libre Franklin",Arial,sans-serif;color:#3D4148;background:#F6F7F8;padding:12px 16px;margin:0 0 40px;border-top:1px solid #15171A}
channel > title{display:block;font-size:2.25rem;line-height:1.1;font-weight:500;margin:0 0 12px}
channel > description{display:block;font-size:1.1875rem;color:#3D4148;margin:0 0 32px}
channel > link,channel > language,channel > lastBuildDate,channel > copyright,channel > generator,channel > docs,atom|link,guid,category,channel > image{display:none}
item{display:block;border-top:1px solid #E6E7E9;padding:20px 0}
item > title{display:block;font-weight:500;font-size:1.3125rem;line-height:1.3}
item > description{display:block;color:#22252A;margin:6px 0 0}
item > link{display:block;font:400 .8125rem/1.5 "Libre Franklin",Arial,sans-serif;color:#2E4BC4;margin:8px 0 0;word-break:break-all}
item > pubDate{display:block;font:400 .8125rem/1.5 "Libre Franklin",Arial,sans-serif;color:#6B7078;margin:4px 0 0}
`;
  return new Response(css, { headers: { "Content-Type": "text/css; charset=utf-8" } });
}
