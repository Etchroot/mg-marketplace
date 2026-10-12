import path from 'node:path';
import {records} from '../records/repository.js';
import {buildCatalog} from '../catalog/build.js';
import {vocabulary} from '../catalog/build.js';
import {bytes,hashAt} from '../storage/atomic.js';
import {note,references} from './parser.js';
import {topicPath} from './names.js';
export async function validateReferences(root:string){
  const errors:Array<{code:string;path?:string}>=[];let all;
  try{all=await records(root);}catch{return {errors:[{code:'INVALID_INPUT',path:'90_Records'}],record_count:0};}
  const notes:string[]=[];
  for(const r of all)for(const v of r.versions){
    if(r.policy.agent_access==='excluded')continue;
    if(await hashAt(root,v.raw_path)!==v.sha256)errors.push({code:'HASH_CONFLICT',path:v.raw_path});
    if(v.extraction==='provided'&&(!v.extracted_path||await hashAt(root,v.extracted_path)!==v.extracted_sha256))errors.push({code:'HASH_CONFLICT',path:v.extracted_path});
    if(v.summary_path)notes.push(v.summary_path);
  }
  try{for(const t of await vocabulary(root)){const p=topicPath(t);if(await hashAt(root,p)!==null)notes.push(p);}
    const snapshot=await buildCatalog(root);const ids=new Set([...snapshot.topics.map(t=>t.id),...snapshot.records.flatMap(r=>[r.record_id,r.summary_id]).filter(Boolean)]);
    for(const e of snapshot.edges)if(!ids.has(e.source)||!ids.has(e.target))errors.push({code:'BROKEN_LINK'});
  }catch(e){errors.push({code:(e as {code?:string}).code??'INVALID_INPUT'});}
  for(const p of notes)try{
    for(const ref of references(note((await bytes(root,p)).toString()).body)){
      const decoded=ref.kind==='wiki'?ref.target.split('#')[0]:decodeURIComponent(ref.target.split('#')[0]);if(!decoded)continue;
      const target=ref.kind==='wiki'?decoded:path.posix.normalize(path.posix.join(path.posix.dirname(p),decoded));
      if(await hashAt(root,target)===null&&await hashAt(root,target+'.md')===null)errors.push({code:'BROKEN_LINK',path:p});
    }
  }catch(e){errors.push({code:(e as {code?:string}).code??'INVALID_INPUT',path:p});}
  return {errors,record_count:all.length};
}
