import {readFile,writeFile,mkdir,rename,unlink,stat} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {resolveInside} from './paths.js';
import {fail} from '../contracts.js';
export const sha256=(b:Uint8Array|string)=>createHash('sha256').update(b).digest('hex');
export const json=(v:unknown)=>JSON.stringify(v,null,2)+'\n';
export async function bytes(root:string,rel:string):Promise<Buffer>{return readFile(await resolveInside(root,rel));}
export async function hashAt(root:string,rel:string):Promise<string|null>{try{return sha256(await bytes(root,rel));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e;}}
export async function writeAtomic(root:string,rel:string,data:string|Uint8Array,expected?:string|null):Promise<void>{
  const file=await resolveInside(root,rel); await mkdir(path.dirname(file),{recursive:true});
  await resolveInside(root,rel);
  const tmp=file+'.'+randomUUID()+'.tmp';
  await writeFile(tmp,data,{flag:'wx'});
  try {if(expected!==undefined && await hashAt(root,rel)!==expected)fail('HASH_CONFLICT');await rename(tmp,file);}finally{await unlink(tmp).catch(()=>{});}
}
export async function deleteExpected(root:string,rel:string,expected:string|null):Promise<void>{
  if(await hashAt(root,rel)!==expected) fail('HASH_CONFLICT');
  await unlink(await resolveInside(root,rel));
}
export function textBytes(b:Buffer, filename:string):string|null {
  if(!/\.(md|txt)$/i.test(filename)||b.includes(0))return null;
  try{return new TextDecoder('utf-8',{fatal:true}).decode(b);}catch{return null;}
}
export async function readBounded(root:string,rel:string,max=50*1024*1024):Promise<Buffer>{
  const file=await resolveInside(root,rel); const s=await stat(file); if(!s.isFile()||s.size>max)fail('INVALID_INPUT','File must be regular and at most 50 MiB');return readFile(file);
}
