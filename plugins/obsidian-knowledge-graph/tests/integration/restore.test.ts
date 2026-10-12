import {test,expect} from 'vitest';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {mkdir,writeFile,readFile} from 'node:fs/promises';import path from 'node:path';
import {KnowledgeService} from '../../src/tools/handlers.js';import {createHarness} from '../support/harness.js';
const exec=promisify(execFile);
test('a clean clone rebuilds catalogs and returns the same evidence and source hash',async()=>{
  const h=await createHarness();try{await h.setup();const a=await h.capture('AI 네이티브 근거');const id=a.record_ids[0];await h.organize(id);const rawBefore=await h.rawBytes(id);
    await exec('git',['init','-b','main'],{cwd:h.vault});await exec('git',['config','user.name','Synthetic'],{cwd:h.vault});await exec('git',['config','user.email','test@example.invalid'],{cwd:h.vault});
    await exec('git',['add','--','README.md','AGENTS.md','.gitignore','.gitattributes','10_Raw','20_Summaries','30_Topics','90_Records','99_System'],{cwd:h.vault});await exec('git',['commit','-m','synthetic restore fixture'],{cwd:h.vault});
    const cloned=path.join(h.dir,'restored');await exec('git',['-c','core.autocrlf=true','clone',h.vault,cloned],{cwd:h.dir});const config=path.join(h.dir,'clone-settings','config.json');await mkdir(path.dirname(config));await writeFile(config,JSON.stringify({...h.config,vault_path:cloned}));
    const restored=new KnowledgeService(config);await restored.invoke('kg_rebuild_catalog');const r=await restored.invoke('kg_search',{terms:['AI-native']});expect(r.items.map((x:any)=>x.record_id)).toContain(id);
    const raw=await restored.invoke('kg_read',{record_id:id,view:'raw'});expect(raw.text).toBe('AI 네이티브 근거');expect(raw.source_sha256).toBe((await h.record(id)).versions[0].sha256);
    expect((await restored.invoke('kg_validate')).errors).toEqual([]);expect(await h.rawBytes(id)).toEqual(rawBefore);
  }finally{await h.dispose();}
});
