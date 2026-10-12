import {test,expect} from 'vitest';
import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHarness} from '../support/harness.js';

test('essay summaries have readable names and a direct essay hub that grows on subsequent organization',async()=>{
  const h=await createHarness();try{await h.setup();
    const a=await h.capture('서비스를 연결했다.','서비스 완성 경험');const id=a.record_ids[0];const before=await h.rawBytes(id);
    await h.organize(id);const r=await h.record(id);const v=r.versions[0];
    expect(v.summary_path).toBe('20_Summaries/Essays/서비스 완성 경험.md');
    expect(path.basename(v.raw_path)).toBe('서비스 완성 경험.md');expect(await h.rawBytes(id)).toEqual(before);
    const summary=await readFile(path.join(h.vault,v.summary_path),'utf8');
    expect(summary).toContain('[[30_Topics/자기소개서.md|자기소개서]]');
    const b=await h.capture('문제를 풀었다.','문제 해결 경험');await h.organize(b.record_ids[0]);
    const hub=await readFile(path.join(h.vault,'30_Topics/자기소개서.md'),'utf8');
    expect(hub).toContain('20_Summaries/Essays/서비스 완성 경험.md');expect(hub).toContain('20_Summaries/Essays/문제 해결 경험.md');
    expect((await h.invoke('kg_neighbors',{seed_ids:['topic-application-essays']})).nodes.filter((n:any)=>n.record_id)).toHaveLength(2);
    expect((await h.invoke('kg_validate')).errors).toEqual([]);
  }finally{await h.dispose();}
});

test('successful organization removes empty Inbox folders without removing unclassified revisions or foreign files',async()=>{
  const h=await createHarness();try{await h.setup();const a=await h.capture('첫 문서','첫 경험');const id=a.record_ids[0];
    await h.organize(id);expect(await readdir(path.join(h.vault,'00_Inbox'))).toEqual([]);
    const b=await h.capture('둘째 문서','둘째 경험');const bid=b.record_ids[0];const old=(await h.record(bid)).versions[0].raw_path;
    const foreign=path.join(h.vault,path.dirname(old),'메모.txt');await writeFile(foreign,'보존');
    const later=await h.invoke('kg_capture_preview',{text:'다음 revision',title:'둘째 경험',type:'essay',record_id:bid});await h.invoke('kg_capture_commit',{preview_id:later.preview_id});
    await h.organize(bid,{revision:1,facts:[{text:'둘째 문서',evidence:[{record_id:bid,revision:1,line_start:1,line_end:1,quote:'둘째 문서'}]}]});
    expect(await readFile(foreign,'utf8')).toBe('보존');expect((await h.invoke('kg_inbox_list')).items).toHaveLength(1);
    expect(await readdir(path.join(h.vault,'00_Inbox',bid))).toEqual(['r001','r002']);
  }finally{await h.dispose();}
});

test('duplicate and unsafe titles remain separate, preserve existing notes, and keep valid links',async()=>{
  const h=await createHarness();try{await h.setup();await mkdir(path.join(h.vault,'20_Summaries/Essays'),{recursive:true});
    await writeFile(path.join(h.vault,'20_Summaries/Essays/같은 제목.md'),'사람이 쓴 파일');
    const a=await h.capture('첫 경험','첫 입력');const b=await h.capture('둘째 경험','둘째 입력');
    const drafts=[await h.draft(a.record_ids[0],{title:'같은 제목'}),await h.draft(b.record_ids[0],{title:'같은 제목'})];
    const p=await h.invoke('kg_organize_preview',{drafts});await h.invoke('kg_organize_commit',{preview_id:p.preview_id});
    const av=(await h.record(a.record_ids[0])).versions[0],bv=(await h.record(b.record_ids[0])).versions[0];
    expect(av.summary_path).not.toBe(bv.summary_path);expect(await readFile(path.join(h.vault,'20_Summaries/Essays/같은 제목.md'),'utf8')).toBe('사람이 쓴 파일');
    const c=await h.capture('안전한 경험','세 번째 입력');await h.organize(c.record_ids[0],{title:'../CON: [경험] #1?'});
    expect((await h.invoke('kg_validate')).errors).toEqual([]);
  }finally{await h.dispose();}
});

test('failed classification retains the original Inbox file and its folders',async()=>{
  const h=await createHarness();try{await h.setup();const a=await h.capture('실제 원문','실패 경험');const id=a.record_ids[0];const r=await h.record(id);
    const d=await h.draft(id);d.facts[0].evidence[0].quote='없는 근거';await expect(h.invoke('kg_organize_preview',{drafts:[d]})).rejects.toMatchObject({code:'INVALID_INPUT'});
    expect(await readFile(path.join(h.vault,r.versions[0].raw_path),'utf8')).toBe('실제 원문');expect(await readdir(path.join(h.vault,'00_Inbox'))).toEqual([id]);
  }finally{await h.dispose();}
});

test('readable titles with literal percent signs and parentheses have valid links, and essay type always joins the hub',async()=>{
  const h=await createHarness();try{await h.setup();
    for(const title of ['효율 30% 개선','성과 (실험)']){const a=await h.capture('경험 본문',title);await h.organize(a.record_ids[0],{category:'Projects'});}
    expect((await h.invoke('kg_validate')).errors).toEqual([]);
    const hub=await readFile(path.join(h.vault,'30_Topics/자기소개서.md'),'utf8');expect(hub).toContain('효율 30% 개선');expect(hub).toContain('성과 (실험)');
  }finally{await h.dispose();}
});
