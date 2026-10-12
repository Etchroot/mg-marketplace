import {test,expect} from 'vitest';
import {readFile,writeFile} from 'node:fs/promises';import path from 'node:path';
import {createHarness} from '../support/harness.js';
test('a submitted older revision is not relabeled when a new final revision is captured',async()=>{
  const h=await createHarness();try{await h.setup();const a=await h.capture('AI 네이티브 제출본','지원서','essay',{document_status:'submitted'});const id=a.record_ids[0];await h.organize(id);await h.capture('AI 네이티브 수정 최종본','지원서','essay',{record_id:id,document_status:'final'});await h.organize(id);
    const submitted=await h.invoke('kg_search',{terms:['AI 네이티브'],versions:'all',document_status:'submitted'});expect(submitted.items.map((x:any)=>x.revision)).toEqual([1]);
    expect((await h.invoke('kg_search',{terms:['AI 네이티브'],document_status:'submitted'})).items).toHaveLength(0);
  }finally{await h.dispose();}
});
test('an excluded record supplied through cross-record evidence cannot leak through another summary',async()=>{
  const h=await createHarness();try{await h.setup();const secret=await h.capture('secret','secret','essay',{policy:{agent_access:'excluded',github:false,notion:false}});const a=await h.capture('public');const d=await h.draft(a.record_ids[0]);
    d.facts[0].evidence.push({record_id:secret.record_ids[0],revision:1,line_start:1,line_end:1,quote:'secret'});
    await expect(h.invoke('kg_organize_preview',{drafts:[d]})).rejects.toMatchObject({code:'POLICY_BLOCKED'});
  }finally{await h.dispose();}
});
test('manual topic prose survives adding a second linked summary',async()=>{
  const h=await createHarness();try{await h.setup();const a=await h.capture('AI 네이티브 one');await h.organize(a.record_ids[0]);const file=path.join(h.vault,'30_Topics/ai-native.md');await writeFile(file,(await readFile(file,'utf8'))+'\n내가 편집한 설명\n');const b=await h.capture('AI 네이티브 two');await h.organize(b.record_ids[0]);
    expect(await readFile(file,'utf8')).toContain('내가 편집한 설명');
  }finally{await h.dispose();}
});
test('existing human summary cannot be overwritten by another organize request',async()=>{
  const h=await createHarness();try{await h.setup();const a=await h.capture('source');const id=a.record_ids[0];await h.organize(id);const r=await h.record(id);const file=path.join(h.vault,r.versions[0].summary_path);await writeFile(file,(await readFile(file,'utf8'))+'\nHuman text\n');
    await expect(h.organize(id)).rejects.toMatchObject({code:'HASH_CONFLICT'});expect(await readFile(file,'utf8')).toContain('Human text');
  }finally{await h.dispose();}
});
test('manual extracted text is searchable while binary raw remains unreadable as text',async()=>{
  const h=await createHarness();try{await h.setup();const source=await h.writeInput('문서.pdf',Buffer.from([0,255,1]));const p=await h.invoke('kg_capture_preview',{source_path:source,title:'수동 추출 문서',type:'essay',extracted_text:'AI 네이티브 경험을 설명했다.'});const a=await h.invoke('kg_capture_commit',{preview_id:p.preview_id});const id=a.record_ids[0];
    const text=await h.invoke('kg_read',{record_id:id,view:'extracted'});expect(text.text).toBe('AI 네이티브 경험을 설명했다.');await h.organize(id);expect((await h.invoke('kg_search',{terms:['AI-native']})).items[0].record_id).toBe(id);
    await expect(h.invoke('kg_read',{record_id:id,view:'raw'})).rejects.toMatchObject({code:'UNSUPPORTED_MEDIA'});
  }finally{await h.dispose();}
});
