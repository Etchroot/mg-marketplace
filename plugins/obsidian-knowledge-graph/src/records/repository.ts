import {readdir} from 'node:fs/promises';
import {RecordSchema,parse,UUID,fail,type RecordData,type Version} from '../contracts.js';
import {bytes,sha256} from '../storage/atomic.js';
import {resolveInside} from '../storage/paths.js';
export async function record(root:string,id:string,hashes?:Map<string,string|null>):Promise<RecordData>{parse(UUID,id);const p='90_Records/'+id+'.json';const raw=await bytes(root,p);hashes?.set(p,sha256(raw));const r=parse(RecordSchema,JSON.parse(raw.toString('utf8')));if(r.record_id!==id||new Set(r.versions.map(v=>v.revision)).size!==r.versions.length||Math.max(...r.versions.map(v=>v.revision))!==r.latest_revision)fail('INVALID_INPUT','Record identity or revisions mismatch');return r;}
export async function records(root:string,hashes?:Map<string,string|null>):Promise<RecordData[]>{
  let names:string[];try{names=await readdir(await resolveInside(root,'90_Records'));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return [];throw e;}
  const out:RecordData[]=[];for(const n of names.sort()){if(n.endsWith('.json'))out.push(await record(root,n.slice(0,-5),hashes));}return out;
}
export const version=(r:RecordData,n=r.latest_revision):Version=>r.versions.find(v=>v.revision===n)??fail('SOURCE_MISSING');
export function allowed(r:RecordData):void{if(r.policy.agent_access!=='allowed')fail('POLICY_BLOCKED');}
