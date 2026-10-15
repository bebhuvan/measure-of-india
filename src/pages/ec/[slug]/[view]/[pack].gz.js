// /ec/<guide>/<view>/<page>.<hash>.gz: the rows of one every-cut page past the first SSR_ROWS, as
// gzip of one <tr> per line, in the markup the page itself renders (src/dossiers/everycut-html.js).
// src/dossiers/everycut.client.js fetches it after first paint and streams the rows into the table.
// Content-named, so it caches forever (public/_headers /ec/*).
import zlib from "node:zlib";
import { DOSSIERS } from "../../../../dossiers/registry.js";
import { everyCutPlan } from "../../../../dossiers/everycut.js";
import { inlineSpec, tailSpec, packLink, packOf } from "../../../../dossiers/everycut-html.js";

export function getStaticPaths() {
  const out = [];
  for (const d of DOSSIERS) {
    const specs = [inlineSpec(d), ...everyCutPlan(d).tails.flatMap((t) => t.pages.map((_, n) => tailSpec(d, t, n)))];
    for (const spec of specs) {
      const link = packLink(d.slug, spec);
      if (link) out.push({ params: { slug: d.slug, view: spec.view, pack: link.href.split("/").at(-1).replace(/\.gz$/, "") }, props: { spec } });
    }
  }
  return out;
}

export function GET({ props }) {
  const { body } = packOf(props.spec.rows, props.spec.o);
  return new Response(zlib.gzipSync(body, { level: 9 }), { headers: { "Content-Type": "application/gzip" } });
}
