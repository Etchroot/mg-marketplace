import {readdir,lstat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fail,type RecordData,type Version} from '../contracts.js';
import {records,allowed} from '../records/repository.js';
import {resolveInside} from '../storage/paths.js';
import {bytes,hashAt,sha256} from '../storage/atomic.js';
import {list} from '../storage/journal.js';
const exec=promisify(execFile);
const pathKey=(p:string)=>process.platform==='win32'?p.replace(/\\/g,'/').toLowerCase():p;
export const samePath=(a:string,b:string)=>pathKey(a)===pathKey(b);

// Direct authoring is limited to visible, regular files in Inbox, without junctions.
export async function inboxPath(root:string,relative:string,allowMissing=false):Promise<string>{
  const p=relative.replace(/\\/g,'/');
  if(!p.startsWith('00_Inbox/')||p.split('/').some(x=>!x||x.startsWith('.')))fail('OUTSIDE_ROOT');
  const target=await resolveInside(root,p);
  const parts=p.split('/');
  for(let i=1;i<=parts.length;i++){
    try{if((await lstat(await resolveInside(root,parts.slice(0,i).join('/')))).isSymbolicLink())fail('OUTSIDE_ROOT');}
    catch(e){if(allowMissing&&(e as NodeJS.ErrnoException).code==='ENOENT')return p;throw e;}
  }
  if(!(await lstat(target)).isFile())fail('INVALID_INPUT','Inbox source must be a regular file');
  return path.relative(await realpath(root),await realpath(target)).split(path.sep).join('/');
}

export function owner(all:RecordData[],p:string){
  const exact=all.flatMap(r=>r.versions.filter(v=>samePath(v.raw_path,p)).map(v=>({r,v})));
  const origins=all.flatMap(r=>r.versions.filter(v=>v.inbox_origin&&samePath(v.inbox_origin,p)).map(v=>({r,v})));
  const matches=exact.length?exact:origins;
  if(new Set(matches.map(x=>x.r.record_id)).size>1)fail('HASH_CONFLICT','Multiple records claim this Inbox path');
  const found=matches.sort((a,b)=>b.v.revision-a.v.revision)[0];
  if(found)allowed(found.r);
  return found;
}

export interface InboxItem {status:'registered'|'unregistered'|'modified'|'missing';record_id?:string;revision?:number;title:string;record_type?:string;extraction:string;raw_path?:string;inbox_path?:string;source_sha256?:string|null}
export async function scanInbox(root:string,all?:RecordData[],checkHashes=true){
  all??=await records(root);
  const items:InboxItem[]=[];let registered=0,modified=0;
  const claimed=new Set(all.flatMap(r=>r.versions.map(v=>pathKey(v.raw_path))));
  const excluded=new Set(all.filter(r=>r.policy.agent_access==='excluded').flatMap(r=>r.versions.flatMap(v=>[v.raw_path,...(v.inbox_origin?[v.inbox_origin]:[])]).map(pathKey)));
  for(const r of all.filter(r=>r.policy.agent_access==='allowed'))for(const v of r.versions){
    const current=checkHashes?await hashAt(root,v.raw_path):v.sha256;const changed=current!==null&&current!==v.sha256;
    if(v.state==='inbox')registered++;
    if(changed)modified++;
    if(v.state==='inbox'||changed)items.push({record_id:r.record_id,revision:v.revision,title:r.title,record_type:r.record_type,extraction:v.extraction,raw_path:v.raw_path,...(v.state==='inbox'?{inbox_path:v.raw_path}:{}),status:current===null?'missing':changed?'modified':'registered',source_sha256:current});
  }
  let visited=0;
  async function walk(dir:string,depth:number){
    if(depth>32)fail('INBOX_TOO_LARGE','Inbox nesting exceeds 32 levels');
    const absolute=await resolveInside(root,dir);
    try{if((await lstat(absolute)).isSymbolicLink())return;}
    catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return;throw e;}
    for(const entry of (await readdir(absolute,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
      if(++visited>10000)fail('INBOX_TOO_LARGE','Inbox exceeds 10000 entries');
      if(entry.name.startsWith('.')||entry.isSymbolicLink())continue;
      const p=dir+'/'+entry.name;
      if(entry.isDirectory())await walk(p,depth+1);
      else if(entry.isFile()&&!claimed.has(pathKey(p))&&!excluded.has(pathKey(p)))items.push({status:'unregistered',title:path.parse(entry.name).name,inbox_path:p,extraction:/\.(md|txt)$/i.test(p)?'text':'unsupported'});
    }
  }
  await walk('00_Inbox',0);
  items.sort((a,b)=>(a.inbox_path??a.raw_path??'').localeCompare(b.inbox_path??b.raw_path??'')||(a.revision??0)-(b.revision??0));
  const unregistered=items.filter(i=>i.status==='unregistered').length;
  return {items,inbox_count:registered+unregistered,registered_inbox_count:registered,unregistered_inbox_count:unregistered,modified_source_count:modified};
}

// Exact byte recovery only. This never contacts a remote or changes Git state.
export async function originalBytes(root:string,v:Version):Promise<Buffer>{
  const current=await hashAt(root,v.raw_path);
  if(current===v.sha256)return bytes(root,v.raw_path);
  for(const op of (await list(root)).filter(o=>o.state==='local_committed')){
    for(const ch of op.changes)if(ch.content&&(ch.path.startsWith('00_Inbox/')||ch.path.startsWith('10_Raw/'))){
      const b=Buffer.from(ch.content!,'base64');if(sha256(b)===v.sha256)return b;
    }
  }
  try{
    const args=['-c','safe.directory='+root];
    const {stdout}=await exec('git',[...args,'log','--all','-n','100','--format=%H','--',':(literal)'+v.raw_path],{cwd:root,maxBuffer:1024*1024,timeout:10000,windowsHide:true});
    for(const commit of stdout.trim().split(/\r?\n/).filter(c=>/^[a-f0-9]{40,64}$/.test(c))){
      try{const {stdout:b}=await exec('git',[...args,'show',commit+':'+v.raw_path],{cwd:root,encoding:'buffer',maxBuffer:50*1024*1024,timeout:10000,windowsHide:true});if(sha256(b)===v.sha256)return b;}catch{}
    }
  }catch{}
  return fail('ORIGINAL_UNAVAILABLE','No original with the recorded SHA-256 in local receipts or the last 100 Git path commits');
}
