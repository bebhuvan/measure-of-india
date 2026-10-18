// A PostCSS plugin (astro.config.mjs): every :hover rule applies only on a pointer that can hover.
// On a phone a tap leaves :hover set on what was tapped until the next tap elsewhere, so a row wash
// or a colour change sticks after the finger has gone (DESIGN.md, the front-page ledger). Rather
// than wrap each rule by hand, the build moves every :hover selector into @media (hover:hover);
// selectors in the same rule without :hover (":focus-visible") stay where they were. Rules already
// inside a hover query are left alone.
const inHoverQuery = (node) => {
  for (let p = node.parent; p; p = p.parent) if (p.type === "atrule" && /hover/.test(p.params)) return true;
  return false;
};

export default function hoverOnly() {
  return {
    postcssPlugin: "atlas-hover-only",
    Rule(rule, { AtRule }) {
      if (rule.__hoverDone || !rule.selector.includes(":hover") || inHoverQuery(rule)) return;
      if (rule.parent?.type === "atrule" && /keyframes/.test(rule.parent.name)) return;
      const sels = rule.selectors, hover = sels.filter((s) => s.includes(":hover")), rest = sels.filter((s) => !s.includes(":hover"));
      const media = new AtRule({ name: "media", params: "(hover:hover)" });
      const moved = rule.clone({ selectors: hover });
      moved.__hoverDone = true;
      media.append(moved);
      rule.after(media);
      if (rest.length) rule.selectors = rest; else rule.remove();
    },
  };
}
hoverOnly.postcss = true;
