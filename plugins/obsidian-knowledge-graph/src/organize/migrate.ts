import path from 'node:path';
import {readdir} from 'node:fs/promises';
import {stringify} from 'yaml';
import {parse,Category,fail} from '../contracts.js';
import {records} from '../records/repository.js';
import {bytes,hashAt,sha256,json} from '../storage/atomic.js';
import {change,prepare} from '../storage/journal.js';
import {note,managed,references} from '../notes/parser.js';
import {resolveInside} from '../storage/paths.js';
import {link,renderTopic,encodePath} from '../notes/render.js';
import {essayTopic,topicPath,rawName,summaryPath} from '../notes/names.js';
import {buildCatalog,catalogFiles,vocabulary} from '../catalog/build.js';

export const graphSearch='-path:00_Inbox -path:10_Raw -path:80_Extracted -path:90_Records -path:99_System -file:AGENTS -file:README';
export const defaultGraph={search:graphSearch,showOrphans:false};

// Explicit preview/apply migration. UUIDs, revisions, source bytes and manual prose are preserved.
export async function migrateReadable(root:string){
  const expected=new Map<string,string|null>();const all=await records(root,expected);
  const excluded=new Set(all.filter(r=>r.policy.agent_access==='excluded').flatMap(r=>r.versions.flatMap(v=>v.summary_path?[v.summary_path]:[])));
  const outputs=new Map<string,string|Buffer|null>();const overrides=new Map<string,string>();
  const vocabBytes=await bytes(root,'99_System/vocabulary.yaml');expected.set('99_System/vocabulary.yaml',sha256(vocabBytes));
  const topics=await vocabulary(root,vocabBytes.toString());
  const moves=new Map<string,string>();const summaries:Array<{old:string;next:string;text:string;essay:boolean}>=[];
  const reserved=new Set(all.flatMap(r=>r.versions.flatMap(v=>v.summary_path?[v.summary_path.normalize('NFC').toLowerCase()]:[])));
  for(const r of all.filter(r=>r.policy.agent_access==='allowed'))for(const v of r.versions){
    if(v.state!=='organized'||!v.summary_path)continue;
    const old=v.summary_path;const source=await bytes(root,old);expected.set(old,sha256(source));
    const parsed=note(source.toString());const category=parse(Category,parsed.meta.category);const title=String(parsed.meta.title??r.title);
    if(/^[a-f0-9-]{36}-r\d+\.md$/i.test(path.posix.basename(old)))v.summary_path=await summaryPath(root,category,title,r.record_id,v.revision,reserved);
    if(old!==v.summary_path){expected.set(v.summary_path,null);moves.set(old,v.summary_path);outputs.set(old,null);}
    const raw=await bytes(root,v.raw_path);if(sha256(raw)!==v.sha256)fail('HASH_CONFLICT');
    const oldRaw=v.raw_path;const nextRaw=path.posix.dirname(oldRaw)+'/'+rawName(title,v.original_name);
    if(oldRaw.normalize('NFC').toLowerCase()!==nextRaw.normalize('NFC').toLowerCase()){expected.set(oldRaw,v.sha256);expected.set(nextRaw,await hashAt(root,nextRaw));if(expected.get(nextRaw)!==null)fail('HASH_CONFLICT','Raw destination exists');moves.set(oldRaw,nextRaw);outputs.set(nextRaw,raw);outputs.set(oldRaw,null);v.raw_path=nextRaw;}
    summaries.push({old,next:v.summary_path,text:source.toString(),essay:r.record_type==='essay'});
    outputs.set('90_Records/'+r.record_id+'.json',json(r));
  }
  if(summaries.some(s=>s.essay)&&!topics.some(t=>t.id===essayTopic.id)){
    if(topics.some(t=>t.key===essayTopic.key))fail('INVALID_INPUT','Essay hub key is already in use');topics.push(essayTopic);
  }
  const rewriteLinks=(text:string,from:string,next:string)=>{
    text=text.replace(/\[\[([^\]|#]+)(#[^\]|]*)?(\|[^\]]*)?\]\]/g,(whole,target:string,anchor='',alias='')=>{
      let mapped=moves.get(target)??moves.get(target+'.md');
      if(!mapped&&!target.includes('/')){const matches=[...moves].filter(([old])=>path.posix.basename(old)===target||path.posix.basename(old,'.md')===target);if(matches.length===1)mapped=path.posix.basename(matches[0][1]);}
      if(!mapped)return whole;if(!target.endsWith('.md'))mapped=mapped.replace(/\.md$/,'');return '[['+mapped+anchor+alias+']]';
    });
    return text.replace(/(!?\[[^\]]*\]\()([^)]*)(\))/g,(whole,open:string,target:string,close:string)=>{
      if(/^[a-z][a-z0-9+.-]*:/i.test(target))return whole;
      const [file,...fragments]=target.split('#');let decoded:string;try{decoded=decodeURIComponent(file);}catch{return whole;}
      const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(from),decoded));const mapped=moves.get(resolved);if(!mapped)return whole;
      return open+encodePath(path.posix.relative(path.posix.dirname(next),mapped))+(fragments.length?'#'+fragments.join('#'):'')+close;
    });
  };
  const rewrite=(text:string,from:string,next:string)=>text.split(/(^```[^\n]*\r?\n[\s\S]*?^```[^\n]*(?:\r?\n|$)|^~~~[^\n]*\r?\n[\s\S]*?^~~~[^\n]*(?:\r?\n|$)|`[^`]*`)/gm).map((part,i)=>i%2?part:rewriteLinks(part,from,next)).join('');
  for(const s of summaries){
    const p=note(s.text);
    // Evidence quotations remain exact source text, even when they resemble links.
    const evidence=/^## 원문 근거\r?\n[\s\S]*?(?=^## |(?![\s\S]))/m.exec(p.body);
    let body=evidence?rewrite(p.body.slice(0,evidence.index),s.old,s.next)+evidence[0]+rewrite(p.body.slice(evidence.index+evidence[0].length),s.old,s.next):rewrite(p.body,s.old,s.next);
    if(s.essay){const ids=p.meta.topics as string[];if(!ids.includes(essayTopic.id))p.meta.topics=[...ids,essayTopic.id];}
    // Rebuild only the managed link block; prose and evidence outside it remain intact.
    const ids=p.meta.topics as string[];const topicLinks=ids.map(id=>{const t=topics.find(t=>t.id===id)??fail('BROKEN_LINK');return '- '+link(topicPath(t),t.title,s.next);});
    const relations=(p.meta.relations??[]) as Array<{target_id:string;kind:string}>;
    const targets=new Map(all.flatMap(r=>r.versions.flatMap(v=>v.summary_id&&v.summary_path?[[v.summary_id,{path:v.summary_path,title:r.title}] as const]:[])));
    for(const t of topics)targets.set(t.id,{path:topicPath(t),title:t.title});
    const other=relations.filter(r=>!(r.kind==='covers_topic'&&ids.includes(r.target_id))).map(r=>{const target=targets.get(r.target_id)??fail('BROKEN_LINK');return '- '+link(target.path,target.title,s.next)+' — '+r.kind;});
    body=managed(body,'## 관련 주제와 자료\n'+[...topicLinks,...other].join('\n'));
    const text='---\n'+stringify(p.meta)+'---\n'+body;outputs.set(s.next,text);overrides.set(s.next,text);
  }
  const snapshot=await buildCatalog(root,all,overrides,topics);
  for(const t of topics){const file=topicPath(t);let existing:string|undefined;const hash=await hashAt(root,file);expected.set(file,hash);if(hash!==null)existing=rewrite((await bytes(root,file)).toString(),file,file);outputs.set(file,renderTopic(t,snapshot.records,existing));}
  const markdown:string[]=[];
  const walk=async(dir:string)=>{for(const entry of await readdir(dir?await resolveInside(root,dir):root,{withFileTypes:true})){
    const file=dir?dir+'/'+entry.name:entry.name;
    if(entry.isSymbolicLink()||excluded.has(file)||/^(\.git|\.kg-runtime|\.obsidian|00_Inbox|10_Raw|80_Extracted|90_Records|99_System)(\/|$)/.test(file))continue;
    if(entry.isDirectory())await walk(file);else if(entry.isFile()&&file.endsWith('.md'))markdown.push(file);
  }};await walk('');
  for(const file of markdown){if(outputs.has(file))continue;const original=await bytes(root,file);const text=rewrite(original.toString(),file,file);if(text!==original.toString()){
    if(!/^(20_Summaries|30_Topics|40_Collections)\//.test(file)&&!['README.md','AGENTS.md'].includes(file))fail('POLICY_BLOCKED','Move handwritten backlink notes into 40_Collections before migrating');
    expected.set(file,sha256(original));outputs.set(file,text);
  }}
  outputs.set('99_System/vocabulary.yaml',stringify({schema_version:1,topics,categories:['Essays','Journal','Companies','Work','Projects','References']}));
  for(const [file,text] of catalogFiles(snapshot)){expected.set(file,await hashAt(root,file));outputs.set(file,text);}
  const graphFile='.obsidian/graph.json';const graphHash=await hashAt(root,graphFile);expected.set(graphFile,graphHash);
  const graph=graphHash===null?{}:JSON.parse((await bytes(root,graphFile)).toString());
  if(!String(graph.search??'').includes(graphSearch))graph.search=[graph.search,graphSearch].filter(Boolean).join(' ');graph.showOrphans=false;outputs.set(graphFile,json(graph));
  // Validate the projected links before any original path is removed.
  for(const file of [...outputs.keys()].filter(p=>p.endsWith('.md')&&!p.startsWith('10_Raw/'))){
    const content=outputs.has(file)?outputs.get(file):await bytes(root,file);if(content===null||content===undefined)continue;
    for(const ref of references(content.toString())){
      const decoded=ref.kind==='wiki'?ref.target.split('#')[0]:decodeURIComponent(ref.target.split('#')[0]);if(!decoded)continue;
      let target=ref.kind==='wiki'?decoded:path.posix.normalize(path.posix.join(path.posix.dirname(file),decoded));
      if(ref.kind==='wiki'&&!target.includes('/')){
        const matches=[...new Set([...markdown,...outputs.keys()])].filter(p=>outputs.get(p)!==null&&(path.posix.basename(p)===target||path.posix.basename(p,'.md')===target));if(matches.length===1)target=matches[0];
      }
      const exists=async(p:string)=>outputs.has(p)?outputs.get(p)!==null:await hashAt(root,p)!==null;
      if(!await exists(target)&&!await exists(target+'.md'))fail('BROKEN_LINK','Migration would leave a broken link');
    }
  }
  const changes=[];for(const [file,text] of outputs){const before=expected.get(file)??null;const after=text===null?null:sha256(text);if(before!==after)changes.push(await change(root,file,text,before));}
  return prepare(root,'organize',changes,summaries.map(s=>String(note(s.text).meta.record_id)));
}
