import {parse as parseYaml} from 'yaml';
import {fail} from '../contracts.js';
export function note(text:string):{meta:Record<string,unknown>;body:string} {
  const match=/^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if(!match)fail('INVALID_INPUT','Missing note frontmatter');
  const meta=parseYaml(match[1],{maxAliasCount:10});
  if(!meta||typeof meta!=='object'||Array.isArray(meta))fail('INVALID_INPUT');
  return {meta,body:text.slice(match[0].length)};
}
export function references(body:string):Array<{target:string;kind:'wiki'|'markdown'}> {
  const plain=body.replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm,'').replace(/`[^`]*`/g,'');
  return [...plain.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]|\[[^\]]*\]\(([^)]+)\)/g)].map(m=>({target:m[1]??m[2],kind:(m[1]?'wiki':'markdown') as 'wiki'|'markdown'})).filter(s=>!/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(s.target));
}
export function links(body:string):string[]{return references(body).map(r=>r.target);}
export function managed(text:string,body:string):string {
  const start='<!-- kg:links:start -->',end='<!-- kg:links:end -->';
  const starts=text.split(start).length-1,ends=text.split(end).length-1;
  if(starts!==1||ends!==1||text.indexOf(start)>text.indexOf(end))fail('HASH_CONFLICT','Damaged managed block');
  return text.slice(0,text.indexOf(start))+start+'\n'+body+'\n'+end+text.slice(text.indexOf(end)+end.length);
}
