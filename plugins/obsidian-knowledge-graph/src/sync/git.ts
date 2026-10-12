import {fail,type Config,type Operation,type OperationResult} from '../contracts.js';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {realpath} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {bytes,hashAt,sha256,json,writeAtomic} from '../storage/atomic.js';
import {resolveInside} from '../storage/paths.js';
import {get,list,save} from '../storage/journal.js';
import {records} from '../records/repository.js';
import {buildCatalog,catalogFiles} from '../catalog/build.js';
import {rebuild} from '../catalog/build.js';
import {validateReferences} from '../notes/validate.js';
const exec=promisify(execFile);
export interface GitTransport {assertPrivate(root:string,remote:string):Promise<void>;run(root:string,...args:string[]):Promise<string>}
async function run(root:string,...args:string[]):Promise<string>{
  try{return (await exec('git',['-c','safe.directory='+root,...args],{cwd:root,timeout:30000,maxBuffer:2*1024*1024,windowsHide:true,env:{...process.env,GIT_TERMINAL_PROMPT:'0'}})).stdout.trim();}
  catch{ return fail('GIT_COMMAND_FAILED'); }
}
export const gitTransport:GitTransport={run,assertPrivate:async(root,remote)=>{
  const url=await run(root,'remote','get-url',remote);const m=/^(?:https:\/\/github\.com\/|git@github\.com:)([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?$/.exec(url);
  if(!m)fail('REMOTE_NOT_PRIVATE','Only verified GitHub private repositories are supported');
  try{const r=await exec('gh',['repo','view',m[1]+'/'+m[2],'--json','isPrivate','--jq','.isPrivate'],{cwd:root,timeout:30000,windowsHide:true,maxBuffer:100000});if(r.stdout.trim()!=='true')fail('REMOTE_NOT_PRIVATE');}
  catch{fail('REMOTE_NOT_PRIVATE','GitHub private visibility could not be verified');}
}};
interface SyncPlan {preview_id:string;operation_id:string;destinations:string[];expires_at:number;files:Array<{path:string;hash:string|null}>}
const allowedPath=(p:string)=>/^(00_Inbox|10_Raw|20_Summaries|30_Topics|40_Collections|80_Extracted|90_Records|99_System)\//.test(p)||['README.md','AGENTS.md','.gitignore','.gitattributes','.obsidian/graph.json'].includes(p);
const bootstrap=['README.md','AGENTS.md','.gitignore','.gitattributes','.obsidian/graph.json','99_System/schema-version.json','99_System/vocabulary.yaml','99_System/templates/summary.md','99_System/templates/topic.md'];
async function ownedPaths(root:string,op:Operation):Promise<string[]>{
  const pending=(await list(root)).filter(o=>o.result&&o.result.github_state!=='succeeded'&&['capture','organize'].includes(o.kind));
  return [...new Set([...op.changes.map(c=>c.path),...pending.flatMap(o=>o.changes.map(c=>c.path)),...bootstrap])].sort();
}
async function destination(root:string,remote:string,transport:GitTransport){
  const fetch=await transport.run(root,'remote','get-url',remote);
  const push=(await transport.run(root,'remote','get-url','--push','--all',remote)).split(/\r?\n/).filter(Boolean);
  // One destination prevents a verified private fetch URL from masking a different push URL.
  if(push.length!==1||push[0]!==fetch)fail('REMOTE_NOT_PRIVATE','Separate or multiple push URLs are not supported');
  await transport.assertPrivate(root,remote);return push[0];
}
async function auditOutgoing(root:string,remoteSha:string|null,head:string|null,transport:GitTransport){
  if(!head||head===remoteSha)return;
  const commits=(await transport.run(root,'rev-list',remoteSha?remoteSha+'..'+head:head)).split(/\r?\n/).filter(Boolean);
  const known=(await list(root)).filter(o=>o.result?.commit&&o.result.committed_files);
  for(const commit of commits){
    const owner=known.find(o=>o.result!.commit===commit);if(!owner)fail('GIT_UNOWNED_COMMITS');
    const paths=(await transport.run(root,'diff-tree','--root','--no-commit-id','--name-only','-r','-z',commit)).split('\0').filter(Boolean);
    if(paths.some(p=>!allowedPath(p)||!owner.result!.committed_files!.some(f=>f.path===p)))fail('GIT_UNOWNED_COMMITS');
  }
}
export async function syncPreview(root:string,id:string,destinations:string[]):Promise<any>{
  const op=await get(root,id);if(!op.result||!['capture','organize'].includes(op.kind))fail('INVALID_INPUT','Operation has not committed locally');
  const files=[];for(const p of await ownedPaths(root,op)){if(!allowedPath(p))fail('POLICY_BLOCKED');files.push({path:p,hash:await hashAt(root,p)});}
  const plan:SyncPlan={preview_id:randomUUID(),operation_id:id,destinations:[...new Set(destinations)],expires_at:Date.now()+600000,files};
  await writeAtomic(root,'.kg-runtime/sync-previews/'+plan.preview_id+'.json',json(plan));
  return {preview_id:plan.preview_id,operation_id:id,destinations:plan.destinations,changed_paths:files.map(f=>f.path),warnings:['Git synchronization includes prior completed, unsynchronized registrations required by the shared catalog.','Notion is not supported by version 0.1.2.']};
}
export async function pushOperation(config:Config,op:Operation,transport:GitTransport=gitTransport):Promise<OperationResult>{
  if(!op.result)fail('INVALID_INPUT');
  const result={...op.result,errors:op.result.errors.filter(e=>e.code==='CONFIG_REQUIRED')};const root=config.vault_path;
  try{
    if(!config.git.enabled)fail('CONFIG_REQUIRED','Git is disabled');
    const all=await records(root);
    // Fail closed until an independent remote projection exists; private titles must not leak through shared catalogs.
    if(all.some(r=>!r.policy.github||r.policy.agent_access!=='allowed'))fail('POLICY_BLOCKED','Mixed local-only records require a separate Vault for remote sync');
    for(const r of all)for(const v of r.versions)if(await hashAt(root,v.raw_path)!==v.sha256)fail('HASH_CONFLICT');
    const snap=await buildCatalog(root);for(const [p,c] of catalogFiles(snap))if(await hashAt(root,p)!==sha256(c))fail('HASH_CONFLICT','Catalog must be rebuilt before sync');
    const validation=await validateReferences(root);if(validation.errors.length)fail(validation.errors[0].code);
    const top=await transport.run(root,'rev-parse','--show-toplevel');if(await realpath(top)!==await realpath(root))fail('POLICY_BLOCKED','Git root must be the Vault');
    if(await transport.run(root,'branch','--show-current')!==config.git.branch)fail('GIT_DIVERGED','Unexpected current branch');
    const pushUrl=await destination(root,config.git.remote,transport);
    if(result.push_destination&&result.push_destination!==pushUrl)fail('REMOTE_NOT_PRIVATE','Saved commit destination differs');
    if(await transport.run(root,'diff','--cached','--name-only'))fail('GIT_DIRTY_INDEX');
    const remote=await transport.run(root,'ls-remote','--heads',pushUrl,'refs/heads/'+config.git.branch);const remoteSha=remote.split(/\s+/)[0]||null;
    let head:string|null=null;try{head=await transport.run(root,'rev-parse','--verify','HEAD');}catch{}
    if(remoteSha){await transport.run(root,'fetch','--no-tags',pushUrl,config.git.branch);if(!head)fail('GIT_DIVERGED');
      if(remoteSha!==head){let ahead=false,behind=false;try{await transport.run(root,'merge-base','--is-ancestor',remoteSha,head);ahead=true;}catch{}
        if(!ahead){try{await transport.run(root,'merge-base','--is-ancestor',head,remoteSha);behind=true;}catch{}
          if(!behind)fail('GIT_DIVERGED');if(await transport.run(root,'status','--porcelain'))fail('GIT_BEHIND_DIRTY');
          await transport.run(root,'merge','--ff-only',remoteSha);await rebuild(root);
          const refreshed=await validateReferences(root);if(refreshed.errors.length)fail(refreshed.errors[0].code);
          fail('SYNC_PREVIEW_REQUIRED','Fast-forward completed; inspect the updated Vault and request a new sync preview');
        }
      }
    }
    await auditOutgoing(root,remoteSha,head,transport);
    if(result.github_state==='succeeded')return result;
    let commit=result.commit;
    if(!commit){
      const covered=(await list(root)).filter(o=>o.result&&o.result.github_state!=='succeeded'&&['capture','organize'].includes(o.kind)).map(o=>o.operation_id);if(!covered.includes(op.operation_id))covered.push(op.operation_id);
      const paths=await ownedPaths(root,op);for(const p of paths){if(!allowedPath(p))fail('POLICY_BLOCKED');await resolveInside(root,p);}
      const existing=[];for(const p of paths){if(await hashAt(root,p)!==null||(await transport.run(root,'ls-files','--',p)))existing.push(p);}
      if(!existing.length)fail('INVALID_INPUT');
      await transport.run(root,'add','--',...existing);
      const staged=(await transport.run(root,'diff','--cached','--name-only','-z')).split('\0').filter(Boolean);
      if(staged.some(p=>!paths.includes(p)))fail('POLICY_BLOCKED');
      if(staged.length)await transport.run(root,'commit','-m','knowledge: '+op.kind+' '+op.operation_id);
      commit=await transport.run(root,'rev-parse','HEAD');result.commit=commit;result.covered_operation_ids=covered;result.committed_files=await Promise.all(paths.map(async p=>({path:p,hash:await hashAt(root,p)})));result.push_destination=pushUrl;result.github_state='pending';op.result=result;await save(root,op);
    }
    if(!/^[a-f0-9]{40,64}$/.test(commit))fail('INVALID_INPUT');
    await auditOutgoing(root,remoteSha,commit,transport);
    if(remoteSha!==commit){try{await transport.run(root,'push',pushUrl,commit+':refs/heads/'+config.git.branch);}catch{
      let confirmed=false;try{confirmed=(await transport.run(root,'ls-remote','--heads',pushUrl,'refs/heads/'+config.git.branch)).startsWith(commit+'\t');}catch{}
      if(!confirmed){result.github_state='uncertain';result.errors.push({code:'REMOTE_UNCERTAIN',retryable:true});op.result=result;await save(root,op);return result;}
    }}
    result.github_state='succeeded';result.errors=[];op.result=result;await save(root,op);
    const pending=(await list(root)).filter(o=>o.result&&o.operation_id!==op.operation_id&&result.covered_operation_ids?.includes(o.operation_id));
    for(const other of pending){other.result!.github_state='succeeded';other.result!.commit=commit;other.result!.covered_operation_ids=result.covered_operation_ids;other.result!.committed_files=result.committed_files;other.result!.push_destination=pushUrl;other.result!.errors=[];await save(root,other);}
  }catch(e){result.github_state='failed';result.errors.push({code:(e as {code?:string}).code??'GIT_COMMAND_FAILED',retryable:false});op.result=result;await save(root,op);}
  return result;
}
export async function syncCommit(config:Config,id:string):Promise<OperationResult>{
  const root=config.vault_path;const plan:SyncPlan=JSON.parse((await bytes(root,'.kg-runtime/sync-previews/'+id+'.json')).toString());if(plan.preview_id!==id||plan.expires_at<Date.now())fail('INVALID_INPUT');
  for(const file of plan.files)if(await hashAt(root,file.path)!==file.hash)fail('HASH_CONFLICT');
  const op=await get(root,plan.operation_id);let result=op.result??fail('INVALID_INPUT');
  if(plan.destinations.includes('github'))result=await pushOperation(config,op);
  if(plan.destinations.includes('notion')){result.notion_state='failed';result.errors.push({code:'CONFIG_REQUIRED',retryable:false});op.result=result;await save(root,op);}
  return result;
}
