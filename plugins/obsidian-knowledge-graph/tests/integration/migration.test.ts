import {test,expect} from 'vitest';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,rename,readdir,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHarness} from '../support/harness.js';
const exec=promisify(execFile);
test('readable migration preserves edited summary body and raw bytes, and updates references and the hub',async()=>{
  const h=await createHarness();try{await h.setup();const a=await h.capture('원문 보존','이전 경험');const id=a.record_ids[0];await h.organize(id);
    const rec=await h.record(id),v=rec.versions[0];const before=await h.rawBytes(id);const oldPath='20_Summaries/Essays/'+id+'-r001.md';
    await rename(path.join(h.vault,v.summary_path),path.join(h.vault,oldPath));v.summary_path=oldPath;await writeFile(path.join(h.vault,'90_Records',id+'.json'),JSON.stringify(rec));
    const literal='\n```md\n[['+oldPath+']]\n```\n`[['+oldPath+']]`\n';
    await writeFile(path.join(h.vault,oldPath),(await readFile(path.join(h.vault,oldPath),'utf8'))+'\n사람이 추가한 설명\n'+literal);await h.invoke('kg_rebuild_catalog');
    await mkdir(path.join(h.vault,'40_Collections'),{recursive:true});
    await writeFile(path.join(h.vault,'40_Collections/내 목차.md'),'---\n관련: "[['+oldPath+'#한눈에 보기]]"\n---\n! [['+id+'-r001#핵심 사실과 경험|내 경험]]\n[참조](../'+oldPath+'#section)\n');
    await writeFile(path.join(h.vault,'30_Topics/ai-native.md'),(await readFile(path.join(h.vault,'30_Topics/ai-native.md'),'utf8'))+'\n수동 링크 [['+oldPath+']]\n');
    const attempt=await exec(process.execPath,['dist/cli.cjs','migrate-readable','--config',h.configPath,'--apply']).then(r=>({ok:true,stdout:r.stdout}),(e)=>({ok:false,stdout:e.stderr}));
    expect(attempt.ok,attempt.stdout).toBe(true);
    const after=await h.record(id);expect(after.versions[0].summary_id).toBe(v.summary_id);expect(after.versions[0].summary_path).toBe('20_Summaries/Essays/이전 경험.md');
    expect(await h.rawBytes(id)).toEqual(before);expect(await readFile(path.join(h.vault,after.versions[0].summary_path),'utf8')).toContain('사람이 추가한 설명');
    expect(await readFile(path.join(h.vault,after.versions[0].summary_path),'utf8')).toContain(literal);
    expect(await readFile(path.join(h.vault,'30_Topics/자기소개서.md'),'utf8')).toContain('20_Summaries/Essays/이전 경험.md');
    const manual=await readFile(path.join(h.vault,'40_Collections/내 목차.md'),'utf8');expect(manual).not.toContain(oldPath);expect(manual).toContain('[[이전 경험#핵심 사실과 경험|내 경험]]');expect(manual).toContain('#section');
    expect(await readFile(path.join(h.vault,'30_Topics/ai-native.md'),'utf8')).toContain('수동 링크 [[20_Summaries/Essays/이전 경험.md]]');
    expect((await h.invoke('kg_validate')).errors).toEqual([]);expect(await readdir(path.join(h.vault,'00_Inbox'))).toEqual([]);
    const again=await exec(process.execPath,['dist/cli.cjs','migrate-readable','--config',h.configPath,'--apply']);expect(JSON.parse(again.stdout).changed_paths).toEqual([]);
  }finally{await h.dispose();}
});

test('untouched collection notes with external links and intentionally unresolved topics do not block migration',async()=>{
  const h=await createHarness();try{await h.setup();await mkdir(path.join(h.vault,'40_Collections'),{recursive:true});
    const text='[Contact](mailto:me@example.com)\n[Open](obsidian://open)\n[[미작성 주제]]\n';const file=path.join(h.vault,'40_Collections/메모.md');await writeFile(file,text);
    const result=await exec(process.execPath,['dist/cli.cjs','migrate-readable','--config',h.configPath,'--apply']).then(()=>({ok:true,error:''}),e=>({ok:false,error:e.stderr}));
    expect(result.ok,result.error).toBe(true);expect(await readFile(file,'utf8')).toBe(text);
  }finally{await h.dispose();}
});

test('migration preserves case-only source paths and does not read or rewrite excluded summaries',async()=>{
  const h=await createHarness();try{await h.setup();
    const a=await h.capture('원본','case');await h.organize(a.record_ids[0]);const rec=await h.record(a.record_ids[0]),v=rec.versions[0];
    const upper=path.posix.dirname(v.raw_path)+'/CASE.md';await rename(path.join(h.vault,v.raw_path),path.join(h.vault,upper));v.raw_path=upper;
    const old='20_Summaries/Essays/'+rec.record_id+'-r001.md';await rename(path.join(h.vault,v.summary_path),path.join(h.vault,old));v.summary_path=old;await writeFile(path.join(h.vault,'90_Records/'+rec.record_id+'.json'),JSON.stringify(rec));
    await writeFile(path.join(h.vault,old),(await readFile(path.join(h.vault,old),'utf8')).replaceAll('/case.md','/CASE.md'));
    const b=await h.capture('제외 본문','비공개 경험');await h.organize(b.record_ids[0]);const excluded=await h.record(b.record_ids[0]);excluded.policy.agent_access='excluded';
    await writeFile(path.join(h.vault,'90_Records/'+excluded.record_id+'.json'),JSON.stringify(excluded));
    const excludedPath=path.join(h.vault,excluded.versions[0].summary_path);await writeFile(excludedPath,(await readFile(excludedPath,'utf8'))+'\n[['+old+']]\n');const before=await readFile(excludedPath);
    const result=await exec(process.execPath,['dist/cli.cjs','migrate-readable','--config',h.configPath,'--apply']).then(()=>({ok:true,error:''}),e=>({ok:false,error:e.stderr}));
    expect(result.ok,result.error).toBe(true);expect(await readFile(excludedPath)).toEqual(before);expect(await h.rawBytes(rec.record_id)).toEqual(Buffer.from('원본'));
  }finally{await h.dispose();}
});
