import {test,expect} from 'vitest';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {mkdir,cp,rm,readFile,writeFile} from 'node:fs/promises';import path from 'node:path';
import {createHarness} from '../support/harness.js';
import {sha256} from '../../src/storage/atomic.js';
const exec=promisify(execFile);
test('packaging copies only plugin payload; reinstall does not touch data or settings',async()=>{
  const h=await createHarness();try{await h.setup();const a=await h.capture('재설치 후 원문');const id=a.record_ids[0];
    const out=path.join(h.dir,'package');const packaged=await exec(process.execPath,['scripts/package.mjs','--output',out]);expect(packaged.stdout).toContain('Packaged');
    await exec(process.execPath,['scripts/check-package.mjs',out]);const cached=path.join(h.dir,'cache');await cp(out,cached,{recursive:true});await rm(cached,{recursive:true});await cp(out,cached,{recursive:true});
    expect((await h.rawBytes(id)).toString()).toBe('재설치 후 원문');expect((await h.invoke('kg_status')).configured).toBe(true);
    const result=await exec(process.execPath,[path.join(cached,'dist/cli.cjs'),'status','--config',h.configPath],{cwd:h.inputs});expect(JSON.parse(result.stdout).configured).toBe(true);
  }finally{await h.dispose();}
});
test('shipped bridge generator works from an unrelated session folder',async()=>{
  const h=await createHarness();try{await h.setup();const out=path.join(h.dir,'payload');await exec(process.execPath,['scripts/package.mjs','--output',out]);const bridge=path.join(h.dir,'bridge');
    await exec(process.execPath,[path.join(out,'scripts/bridge.mjs'),'--directory',bridge,'--config',h.configPath],{cwd:h.inputs});
    const r=await exec(process.execPath,[path.join(bridge,'cli.cjs'),'status','--config',h.configPath],{cwd:h.inputs});expect(JSON.parse(r.stdout).configured).toBe(true);
  }finally{await h.dispose();}
});
test('package validation accepts Windows CRLF skill frontmatter',async()=>{
  const h=await createHarness();try{const out=path.join(h.dir,'payload');await exec(process.execPath,['scripts/package.mjs','--output',out]);
    const skill=path.join(out,'skills/setup/SKILL.md');await writeFile(skill,(await readFile(skill,'utf8')).replace(/\r?\n/g,'\r\n'));
    await expect(exec(process.execPath,['scripts/check-package.mjs',out])).resolves.toBeDefined();
  }finally{await h.dispose();}
});
test('packaged Git attributes preserve bundle bytes through a Windows clone',async()=>{
  const h=await createHarness();try{const out=path.join(h.dir,'payload');await exec(process.execPath,['scripts/package.mjs','--output',out]);
    const repo=path.join(h.dir,'repo');await mkdir(repo);await cp(out,path.join(repo,'plugin'),{recursive:true});
    const git=(...args:string[])=>exec('git',args,{cwd:repo});await git('init','-b','main');await git('config','user.name','Synthetic');await git('config','user.email','synthetic@example.invalid');await git('-c','core.autocrlf=true','add','.');await git('commit','-m','payload');
    const restored=path.join(h.dir,'clone');await exec('git',['-c','core.autocrlf=true','clone','-b','main',repo,restored],{cwd:h.dir});
    const payload=path.join(restored,'plugin');for(const file of ['dist/mcp.cjs','dist/cli.cjs'])expect(sha256(await readFile(path.join(payload,file)))).toBe(sha256(await readFile(path.join(out,file))));
    await exec(process.execPath,['scripts/check-package.mjs',payload]);
  }finally{await h.dispose();}
});
