import {mkdir,writeFile,rm,readFile,access} from 'node:fs/promises';
import {setTimeout} from 'node:timers/promises';
import {resolveInside} from './paths.js';
import {fail} from '../contracts.js';
import {randomUUID} from 'node:crypto';
export async function withVaultLock<T>(root:string,action:()=>Promise<T>,timeoutMs=5000):Promise<T>{
  const runtime=await resolveInside(root,'.kg-runtime');await mkdir(runtime,{recursive:true});
  const lock=await resolveInside(root,'.kg-runtime/writer.lock'); const start=Date.now();
  const recovering=await resolveInside(root,'.kg-runtime/recovery.lock');
  const guardExists=async()=>{try{await access(recovering);return true;}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return false;throw e;}};
  for(;;){try{if(await guardExists()){if(Date.now()-start>=timeoutMs)fail('VAULT_BUSY');await setTimeout(25);continue;}await mkdir(lock);if(await guardExists()){await rm(lock,{recursive:true,force:true});await setTimeout(25);continue;}break;}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;if(Date.now()-start>=timeoutMs)fail('VAULT_BUSY');await setTimeout(25);}}
  try{await writeFile(await resolveInside(root,'.kg-runtime/writer.lock/owner.json'),JSON.stringify({pid:process.pid,instance:randomUUID(),created_at:new Date().toISOString()}));return await action();}
  finally{await rm(lock,{recursive:true,force:true});}
}
export async function withRecoveryLock<T>(root:string,action:()=>Promise<T>):Promise<T>{
  await mkdir(await resolveInside(root,'.kg-runtime'),{recursive:true});const guard=await resolveInside(root,'.kg-runtime/recovery.lock');
  try{await mkdir(guard);}catch(e){if((e as NodeJS.ErrnoException).code==='EEXIST')fail('VAULT_BUSY');throw e;}
  const lock=await resolveInside(root,'.kg-runtime/writer.lock');let claimed=false;
  try{
    let owner: {pid:number;instance:string}|undefined;
    try{owner=JSON.parse(await readFile(await resolveInside(root,'.kg-runtime/writer.lock/owner.json'),'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')fail('VAULT_BUSY');try{await access(lock);fail('VAULT_BUSY');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}}
    if(owner){if(!Number.isSafeInteger(owner.pid)||owner.pid<=0||typeof owner.instance!=='string')fail('VAULT_BUSY');
      try{process.kill(owner.pid,0);fail('VAULT_BUSY');}catch(e){if((e as NodeJS.ErrnoException).code!=='ESRCH')fail('VAULT_BUSY');}
      await rm(lock,{recursive:true});
    }
    await mkdir(lock);claimed=true;await writeFile(await resolveInside(root,'.kg-runtime/writer.lock/owner.json'),JSON.stringify({pid:process.pid,instance:randomUUID(),created_at:new Date().toISOString()}));
    return await action();
  }finally{if(claimed)await rm(lock,{recursive:true,force:true});await rm(guard,{recursive:true,force:true});}
}
