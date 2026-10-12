import {mkdir,readdir,rmdir} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {UUID,parse,fail,type Change,type Operation,type OperationResult} from '../contracts.js';
import {bytes,hashAt,json,sha256,writeAtomic,deleteExpected} from './atomic.js';
import {resolveInside} from './paths.js';
export const opPath=(id:string)=>'.kg-runtime/operations/'+parse(UUID,id)+'.json';
export async function save(root:string,op:Operation):Promise<void>{await writeAtomic(root,opPath(op.operation_id),json(op));}
export async function get(root:string,id:string):Promise<Operation>{
  const op=JSON.parse((await bytes(root,opPath(id))).toString());
  if(op.schema_version!==1||op.operation_id!==id||!Array.isArray(op.changes))fail('INVALID_INPUT');return op;
}
export async function list(root:string):Promise<Operation[]>{
  let names:string[];try{names=await readdir(await resolveInside(root,'.kg-runtime/operations'));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return [];throw e;}
  const out:Operation[]=[];for(const n of names.filter(n=>n.endsWith('.json')).sort())out.push(await get(root,n.slice(0,-5)));return out;
}
export async function change(root:string,p:string,data:string|Buffer|null,expected?:string|null):Promise<Change>{return {path:p,expected:expected===undefined?await hashAt(root,p):expected,content:data===null?null:Buffer.from(data).toString('base64')};}
export async function prepare(root:string,kind:string,changes:Change[],recordIds:string[],source?:Operation['source']):Promise<Operation>{
  if(new Set(changes.map(c=>c.path)).size!==changes.length)fail('INVALID_INPUT','Duplicate target paths');
  const op:Operation={schema_version:1,operation_id:randomUUID(),kind,created_at:new Date().toISOString(),expires_at:new Date(Date.now()+600000).toISOString(),changes,record_ids:recordIds,source,state:'prepared',applied:0};
  await save(root,op);return op;
}
export const preview=(op:Operation)=>({preview_id:op.operation_id,operation_id:op.operation_id,changed_paths:op.changes.map(c=>c.path),expected_files:op.changes.map(c=>({path:c.path,sha256:c.expected})),warnings:[],expires_at:op.expires_at});
export async function cleanInbox(root:string,deleted:string[]):Promise<void>{
  for(const file of deleted.filter(p=>p.startsWith('00_Inbox/'))){
    let dir=path.posix.dirname(file);
    while(dir!=='00_Inbox'&&dir.startsWith('00_Inbox/')){
      try{await rmdir(await resolveInside(root,dir));}catch(e){const code=(e as NodeJS.ErrnoException).code;if(code==='ENOTEMPTY'||code==='EEXIST')break;if(code!=='ENOENT')throw e;}
      dir=path.posix.dirname(dir);
    }
  }
}
export async function apply(root:string,op:Operation,recover=false):Promise<OperationResult>{
  if(op.result)return op.result;
  if(op.state==='prepared'&& !recover && Date.now()>Date.parse(op.expires_at))fail('INVALID_INPUT','Preview expired');
  if(op.source && sha256(await import('node:fs/promises').then(m=>m.readFile(op.source!.path)))!==op.source.sha256)fail('HASH_CONFLICT');
  if(op.state==='prepared') {
    for(const c of op.changes)if(await hashAt(root,c.path)!==c.expected)fail('HASH_CONFLICT');
    for(const c of op.changes)if(c.expected!==null)await writeAtomic(root,'.kg-runtime/backups/'+op.operation_id+'/'+c.path,await bytes(root,c.path));
    op.state='applying';await save(root,op);
  }
  for(let i=op.applied;i<op.changes.length;i++){
    const c=op.changes[i];const now=await hashAt(root,c.path);const wanted=c.content===null?null:sha256(Buffer.from(c.content,'base64'));
    if(now!==wanted){if(now!==c.expected)fail('HASH_CONFLICT');if(c.content===null){if(now!==null)await deleteExpected(root,c.path,now);}else await writeAtomic(root,c.path,Buffer.from(c.content,'base64'),c.expected);}
    op.applied=i+1;await save(root,op);
  }
  if(op.kind==='organize')await cleanInbox(root,op.changes.filter(c=>c.content===null).map(c=>c.path));
  op.state='local_committed';op.result={operation_id:op.operation_id,record_ids:op.record_ids,local_state:'succeeded',github_state:'not_requested',notion_state:'not_requested',changed_paths:op.changes.map(c=>c.path),errors:[]};await save(root,op);return op.result;
}
