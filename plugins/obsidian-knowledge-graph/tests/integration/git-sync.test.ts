import {test,expect} from 'vitest';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {readFile,writeFile} from 'node:fs/promises';import path from 'node:path';
import {createHarness} from '../support/harness.js';
import {pushOperation,type GitTransport} from '../../src/sync/git.js';
import {get} from '../../src/storage/journal.js';
const exec=promisify(execFile);
async function git(cwd:string,...args:string[]){return (await exec('git',args,{cwd})).stdout.trim();}
async function remoteHarness(h:Awaited<ReturnType<typeof createHarness>>){
  const remote=path.join(h.dir,'remote.git');await git(h.dir,'init','--bare',remote);await git(h.vault,'init','-b','main');await git(h.vault,'config','user.name','Synthetic');await git(h.vault,'config','user.email','synthetic@example.invalid');await git(h.vault,'remote','add','origin',remote);return remote;
}
const privateTransport:GitTransport={assertPrivate:async()=>{},run:git};
test('push stages only operation and bootstrap files; unrelated files stay untracked',async()=>{
  const h=await createHarness();try{await h.setup();await remoteHarness(h);const a=await h.capture('AI 원문');await writeFile(path.join(h.vault,'personal-secret.txt'),'never upload');
    const op=await get(h.vault,a.operation_id);const c={...h.config,git:{enabled:true,remote:'origin',branch:'main',push_on_capture:true}};
    const r=await pushOperation(c,op,privateTransport);expect(r.github_state).toBe('succeeded');
    const tracked=await git(h.vault,'ls-files');expect(tracked).not.toContain('personal-secret');expect(tracked).not.toContain('.kg-runtime');expect(tracked).toContain('90_Records/');
    const remoteHead=await git(h.dir,'--git-dir',path.join(h.dir,'remote.git'),'rev-parse','refs/heads/main');expect(remoteHead).toBe(r.commit);
  }finally{await h.dispose();}
});
test('local-only records block sync before shared catalog can leak their titles',async()=>{
  const h=await createHarness();try{await h.setup();await remoteHarness(h);await h.capture('secret','PRIVATE TITLE','essay',{policy:{agent_access:'allowed',github:false,notion:false}});const a=await h.capture('public');
    const r=await pushOperation({...h.config,git:{enabled:true,remote:'origin',branch:'main',push_on_capture:true}},await get(h.vault,a.operation_id),privateTransport);
    expect(r.github_state).toBe('failed');expect(r.errors.some((e:any)=>e.code==='POLICY_BLOCKED')).toBe(true);expect(await git(h.vault,'ls-files')).toBe('');
  }finally{await h.dispose();}
});
test('already staged human changes block automatic commit',async()=>{
  const h=await createHarness();try{await h.setup();await remoteHarness(h);const a=await h.capture('public');await writeFile(path.join(h.vault,'human.md'),'human');await git(h.vault,'add','--','human.md');
    const r=await pushOperation({...h.config,git:{enabled:true,remote:'origin',branch:'main',push_on_capture:true}},await get(h.vault,a.operation_id),privateTransport);
    expect(r.github_state).toBe('failed');expect(r.errors.some((e:any)=>e.code==='GIT_DIRTY_INDEX')).toBe(true);
    expect(await git(h.vault,'diff','--cached','--name-only')).toBe('human.md');
  }finally{await h.dispose();}
});
test('private fetch remote with a separate push URL is blocked',async()=>{
  const h=await createHarness();try{await h.setup();const remote=await remoteHarness(h);const other=path.join(h.dir,'public.git');await git(h.dir,'init','--bare',other);await git(h.vault,'remote','set-url','--push','origin',other);const a=await h.capture('private raw');
    const r=await pushOperation({...h.config,git:{enabled:true,remote:'origin',branch:'main',push_on_capture:true}},await get(h.vault,a.operation_id),privateTransport);expect(r.github_state).toBe('failed');expect(r.errors.some(e=>e.code==='REMOTE_NOT_PRIVATE')).toBe(true);expect(await git(h.dir,'--git-dir',other,'for-each-ref')).toBe('');
  }finally{await h.dispose();}
});
test('retry of an uncertain earlier push leaves later captures pending',async()=>{
  const h=await createHarness();try{await h.setup();const remote=await remoteHarness(h);const a=await h.capture('first');const c={...h.config,git:{enabled:true,remote:'origin',branch:'main',push_on_capture:true}};
    const uncertain:GitTransport={assertPrivate:async()=>{},run:async(root,...args)=>{if(args[0]==='push')throw new Error('network unavailable');return git(root,...args);}};
    expect((await pushOperation(c,await get(h.vault,a.operation_id),uncertain)).github_state).toBe('uncertain');const b=await h.capture('second');
    expect((await pushOperation(c,await get(h.vault,a.operation_id),privateTransport)).github_state).toBe('succeeded');expect((await get(h.vault,b.operation_id)).result!.github_state).not.toBe('succeeded');
    const tree=await git(h.dir,'--git-dir',remote,'ls-tree','-r','--name-only','main');expect(tree).not.toContain(b.record_ids[0]);
  }finally{await h.dispose();}
});
test('an unrelated outgoing local commit blocks registration push',async()=>{
  const h=await createHarness();try{await h.setup();await remoteHarness(h);const a=await h.capture('first');const c={...h.config,git:{enabled:true,remote:'origin',branch:'main',push_on_capture:true}};await pushOperation(c,await get(h.vault,a.operation_id),privateTransport);
    await writeFile(path.join(h.vault,'personal-secret.txt'),'secret');await git(h.vault,'add','personal-secret.txt');await git(h.vault,'commit','-m','unrelated');const b=await h.capture('second');const r=await pushOperation(c,await get(h.vault,b.operation_id),privateTransport);expect(r.github_state).toBe('failed');expect(r.errors.some(e=>e.code==='GIT_UNOWNED_COMMITS')).toBe(true);
  }finally{await h.dispose();}
});
test('clean behind-only Vault fast-forwards and requires a refreshed sync preview',async()=>{
  const h=await createHarness();try{await h.setup();const remote=await remoteHarness(h);const a=await h.capture('first');const c={...h.config,git:{enabled:true,remote:'origin',branch:'main',push_on_capture:true}};const first=await pushOperation(c,await get(h.vault,a.operation_id),privateTransport);
    await git(h.vault,'config','core.autocrlf','false');const other=path.join(h.dir,'other');await git(h.dir,'clone',remote,other);await git(other,'checkout','main');await git(other,'config','user.name','Other');await git(other,'config','user.email','other@example.invalid');await writeFile(path.join(other,'README.md'),'Updated on another PC\n');await git(other,'add','README.md');await git(other,'commit','-m','remote update');await git(other,'push','origin','main');
    const op=await get(h.vault,a.operation_id);op.result!.github_state='pending';const r=await pushOperation(c,op,privateTransport);expect(r.errors.some(e=>e.code==='SYNC_PREVIEW_REQUIRED')).toBe(true);expect(await git(h.vault,'rev-parse','HEAD')).toBe(await git(other,'rev-parse','HEAD'));expect(await readFile(path.join(h.vault,'README.md'),'utf8')).toContain('another PC');
  }finally{await h.dispose();}
});
test('broken references block direct synchronization before staging',async()=>{
  const h=await createHarness();try{await h.setup();await remoteHarness(h);const a=await h.capture('source');const o=await h.organize(a.record_ids[0]);const r=await h.record(a.record_ids[0]);const file=path.join(h.vault,r.versions[0].summary_path);await writeFile(file,(await readFile(file,'utf8'))+'\n[broken](../../missing.md)\n');
    const result=await pushOperation({...h.config,git:{enabled:true,remote:'origin',branch:'main',push_on_capture:true}},await get(h.vault,o.operation_id),privateTransport);expect(result.github_state).toBe('failed');expect(result.errors.some(e=>e.code==='BROKEN_LINK')).toBe(true);expect(await git(h.vault,'ls-files')).toBe('');
  }finally{await h.dispose();}
});
