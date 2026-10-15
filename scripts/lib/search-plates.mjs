import {parse, serialize} from 'parse5';

// Build-time inert HTML parsing creates no windows, listeners or resource loader.
// Return only strings; the per-page syntax tree cannot escape into the index.
const attr=(node,name)=>node.attrs?.find(a=>a.name===name)?.value;
function* descendants(root){const stack=[...(root.childNodes??[])].reverse();while(stack.length){const node=stack.pop();yield node;const children=node.childNodes??[];for(let i=children.length-1;i>=0;i--)stack.push(children[i]);}}
export function discoverSearchPlates(html) {
  const document=parse(html),plates=[],ids=new Set();
  for(const figure of descendants(document)){
    if(figure.tagName!=='figure'||attr(figure,'id')===undefined)continue;
    const id=attr(figure,'id');
    if(!id)throw Error('search-index: empty figure id');
    if(ids.has(id))throw Error(`search-index: duplicate figure id ${id}`);
    ids.add(id);
    let title, finding;
    for(const node of descendants(figure)){
      if(!title&&node.tagName==='h3')title=node;
      if(!finding&&node.tagName==='div'&&(attr(node,'class')??'').split(/\s+/).includes('sub'))finding=node;
    }
    if(title)plates.push({id,titleHTML:serialize(title),findingHTML:finding?serialize(finding):null});
  }
  return plates;
}
