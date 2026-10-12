import {randomUUID} from 'node:crypto';
import {stringify} from 'yaml';
import {fail,type SummaryDraft,type Topic} from '../contracts.js';
import {record,records,version,allowed} from '../records/repository.js';
import {bytes,json,sha256,hashAt} from '../storage/atomic.js';
import {change,prepare} from '../storage/journal.js';
import {validateEvidence} from '../notes/evidence.js';
import {renderSummary,renderTopic} from '../notes/render.js';
import {buildCatalog,catalogFiles,vocabulary} from '../catalog/build.js';
import {essayTopic,topicPath,rawName,summaryPath} from '../notes/names.js';
export async function organize(root:string,drafts:SummaryDraft[],definitions:Topic[]=[]){
  drafts=drafts.map(d=>({...d,topics:[...d.topics]}));
  if(new Set(drafts.map(d=>d.record_id+':'+d.revision)).size!==drafts.length)fail('INVALID_INPUT','Duplicate drafts');
  const expected=new Map<string,string|null>();const all=await records(root,expected);const cache=new Map(all.map(r=>[r.record_id,r]));
  const vocabularyBytes=await bytes(root,'99_System/vocabulary.yaml');expected.set('99_System/vocabulary.yaml',sha256(vocabularyBytes));const topics=await vocabulary(root,vocabularyBytes.toString());
  for(const p of ['records','topics','edges','manifest']){const rel='99_System/catalog/'+p+'.json';expected.set(rel,await hashAt(root,rel));}
  for(const t of definitions){if(topics.some(x=>x.id===t.id||x.key===t.key))fail('INVALID_INPUT','Topic already exists');topics.push(t);}
  let vocabularyChanged=definitions.length>0;
  if(drafts.some(d=>cache.get(d.record_id)?.record_type==='essay')){
    if(!topics.some(t=>t.id===essayTopic.id)){if(topics.some(t=>t.key===essayTopic.key))fail('INVALID_INPUT','Essay hub key is already in use');topics.push(essayTopic);vocabularyChanged=true;}
    for(const d of drafts)if(cache.get(d.record_id)?.record_type==='essay'&&!d.topics.includes(essayTopic.id))d.topics.push(essayTopic.id);
  }
  const outputs=new Map<string,string|Buffer|null>();const overrides=new Map<string,string>();
  const targets=new Map<string,{path:string;title:string}>();for(const r of all)if(r.policy.agent_access==='allowed')for(const v of r.versions)if(v.summary_id&&v.summary_path)targets.set(v.summary_id,{path:v.summary_path,title:r.title});
  for(const t of topics)targets.set(t.id,{path:topicPath(t),title:t.title});
  const reserved=new Set(all.flatMap(r=>r.versions.flatMap(v=>v.summary_path?[v.summary_path.normalize('NFC').toLowerCase()]:[])));
  for(const d of drafts){
    const r=cache.get(d.record_id)??fail('SOURCE_MISSING');allowed(r);const v=version(r,d.revision);
    if(v.state!=='inbox'||v.summary_path)fail('HASH_CONFLICT','Existing summary is preserved; use a new source revision');
    for(const tid of d.topics)if(!topics.some(t=>t.id===tid))fail('INVALID_INPUT','Unknown topic; provide topic_definitions');
    const raw=await bytes(root,v.raw_path);if(sha256(raw)!==v.sha256)fail('HASH_CONFLICT');if(v.extraction==='unsupported')fail('UNSUPPORTED_MEDIA');
    for(const f of d.facts){if(!f.evidence.some(e=>e.record_id===r.record_id&&e.revision===v.revision))fail('INVALID_INPUT','Facts require evidence in the summarized source');for(const e of f.evidence)await validateEvidence(root,e,cache);}
    for(const rel of d.relations)for(const e of rel.evidence)await validateEvidence(root,e,cache);
    const old=v.raw_path;expected.set(old,v.sha256);v.raw_path=`10_Raw/${d.category}/${r.record_id}/r${String(v.revision).padStart(3,'0')}/${rawName(d.title,v.original_name)}`;
    if(await hashAt(root,v.raw_path)!==null)fail('HASH_CONFLICT','Raw destination exists');
    expected.set(v.raw_path,null);outputs.set(v.raw_path,raw);outputs.set(old,null);v.state='organized';v.summary_id=randomUUID();v.summary_path=await summaryPath(root,d.category,d.title,r.record_id,v.revision,reserved);expected.set(v.summary_path,null);
    targets.set(v.summary_id,{path:v.summary_path,title:d.title});
  }
  for(const d of drafts){const r=cache.get(d.record_id)!;const v=version(r,d.revision);for(const rel of d.relations)if(!targets.has(rel.target_id))fail('BROKEN_LINK');const summary=renderSummary(r,v,d,topics,targets);outputs.set(v.summary_path!,summary);overrides.set(v.summary_path!,summary);outputs.set('90_Records/'+r.record_id+'.json',json(r));}
  const snapshot=await buildCatalog(root,all,overrides,topics);
  for(const t of topics){const p=topicPath(t);let existing:string|undefined;try{const b=await bytes(root,p);expected.set(p,sha256(b));existing=b.toString();}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;expected.set(p,null);}outputs.set(p,renderTopic(t,snapshot.records,existing));}
  if(vocabularyChanged)outputs.set('99_System/vocabulary.yaml',stringify({schema_version:1,topics,categories:['Essays','Journal','Companies','Work','Projects','References']}));
  for(const [p,c] of catalogFiles(snapshot))outputs.set(p,c);
  const changes=[];for(const [p,c] of outputs){const proposed=c===null?null:sha256(c);const before=expected.get(p);if(before===undefined)fail('INVALID_INPUT','Missing snapshot precondition');if(before!==proposed)changes.push(await change(root,p,c,before));}
  return prepare(root,'organize',changes,drafts.map(d=>d.record_id));
}
