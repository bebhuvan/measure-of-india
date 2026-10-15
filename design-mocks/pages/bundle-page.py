# Bundle a page mock (landing or guide) into one self-contained HTML file for sharing.
# Usage: python3 bundle-page.py landing|guide <out.html> "<title>"
import re, sys
page, out, title = sys.argv[1], sys.argv[2], sys.argv[3]
html = open(f'{page}.html').read(); css = open('pages.css').read(); kit = open('../chartkit/kit.js').read(); js = open(f'{page}.js').read()
fx = open('../chartkit/fixtures.json').read(); pd = open('page-data.json').read()
css = css.replace('body { margin: 0;', 'body { margin: 0;', 1)
k = re.sub(r'^export (const|function|let)', r'\1', kit, flags=re.M)
names = re.findall(r'^export (?:const|function|let) (\w+)', kit, flags=re.M)
k += '\nconst K = {' + ', '.join(names) + '};\n'
js = js.replace("import * as K from '../chartkit/kit.js';\n", '')
js = js.replace("await (await fetch('../chartkit/fixtures.json')).json()", "JSON.parse(document.getElementById('fx').textContent)")
js = js.replace("await (await fetch('page-data.json')).json()", "JSON.parse(document.getElementById('pd').textContent)")
body = re.search(r'<body>(.*?)<script type="module"', html, re.S).group(1)
fonts = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,300..600&family=Libre+Franklin:wght@400;500;600&display=swap">'
open(out, 'w').write(f'<title>{title}</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n{fonts}\n<style>{css}</style>\n{body}\n'
  f'<script type="application/json" id="fx">{fx}</script>\n<script type="application/json" id="pd">{pd}</script>\n<script type="module">\n{k}\n{js}\n</script>\n')
