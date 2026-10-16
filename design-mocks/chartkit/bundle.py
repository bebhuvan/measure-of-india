# Bundles the specimen (index.html + kit.js + specimen.js + fixtures.json) into one self-contained page.
# Usage: python3 bundle.py <out.html>
import re, sys
html=open('index.html').read(); kit=open('kit.js').read(); spec=open('specimen.js').read(); fx=open('fixtures.json').read()
style=re.search(r'<style>(.*?)</style>',html,re.S).group(1)
style=re.sub(r'@font-face\{[^}]*\}\n','',style)
style=style.replace('body{margin:0;background:var(--paper);color:var(--ink);font:400 17px/1.55 var(--serif)}',
 'body{margin:0;background:var(--paper);color:var(--ink);font:400 17px/1.55 var(--serif);padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}')
style=style.replace('.wrap{max-width:1040px;margin:0 auto;padding:0 32px}\n@media (max-width:600px){.wrap{padding:0 16px}}','.wrap{max-width:1040px;margin:0 auto;padding-inline:16px}\n@media (max-width:600px){.wrap{padding-inline:0}}')
style=style.replace(':root{',':root{color-scheme:light;',1)
body=re.search(r'<body>(.*?)<script type="module"',html,re.S).group(1)
k=re.sub(r'^export (const|function|let)',r'\1',kit,flags=re.M)
names=re.findall(r'^export (?:const|function|let) (\w+)',kit,flags=re.M)
k+='\nconst K = {'+', '.join(names)+'};\n'
sp=spec.replace("import * as K from './kit.js';\n",'').replace("const F = await (await fetch('fixtures.json')).json();","const F = JSON.parse(document.getElementById('fx').textContent);")
fonts='<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,300..600&family=Libre+Franklin:wght@400;500;600&family=Golos+Text:wght@400;500;600&family=Source+Sans+3:wght@400;500;600&display=swap">'
open(sys.argv[1],'w').write(f'<title>Atlas Chart Kit</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n{fonts}\n<style>{style}</style>\n{body}\n<script type="application/json" id="fx">{fx}</script>\n<script type="module">\n{k}\n{sp}\n</script>\n')
