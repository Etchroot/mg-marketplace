import {test,expect} from 'vitest';
import {mkdir,writeFile,readFile,readdir,rm,symlink} from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHarness} from '../support/harness.js';
import {get,save} from '../../src/storage/journal.js';
import {writeAtomic} from '../../src/storage/atomic.js';

test('nested handwritten Inbox notes are counted, paged and reported as outside search coverage',async()=>{
  const h=await createHarness();try{await h.setup();
    await mkdir(path.join(h.vault,'00_Inbox/메모'),{recursive:true});
    await writeFile(path.join(h.vault,'00_Inbox/일기.md'),'오늘의 관찰');
    await writeFile(path.join(h.vault,'00_Inbox/메모/생각.md'),'특별 검색어');
    await writeFile(path.join(h.vault,'00_Inbox/.gitkeep'),'');
    const status=await h.invoke('kg_status');expect(status.inbox_count).toBe(2);expect(status.unregistered_inbox_count).toBe(2);
    const first=await h.invoke('kg_inbox_list',{limit:1});expect(first.items).toHaveLength(1);expect(first.items[0].status).toBe('unregistered');
    const second=await h.invoke('kg_inbox_list',{limit:1,cursor:first.next_cursor});expect(second.items).toHaveLength(1);expect(second.items[0].inbox_path).not.toBe(first.items[0].inbox_path);
    const result=await h.invoke('kg_search',{terms:['특별 검색어'],fallback:'raw_text'});expect(result.items).toEqual([]);expect(result.coverage.unregistered_inbox_count).toBe(2);
    const note=await h.invoke('kg_read',{inbox_path:'00_Inbox/메모/생각.md',view:'raw'});expect(note.text).toBe('특별 검색어');expect(note.registered).toBe(false);
  }finally{await h.dispose();}
});

test('in-place registration preserves bytes, survives repeat requests and moves the original exactly once',async()=>{
  const h=await createHarness();try{await h.setup();const inbox='00_Inbox/2026-10-14 일기.md';const text='관찰 기록\r\n한글 😀\r\n';
    await writeFile(path.join(h.vault,inbox),text);
    const args={inbox_path:inbox,title:'오늘 일기',type:'journal'};
    const p=await h.invoke('kg_capture_preview',args);expect(p.action).toBe('register_in_place');
    await h.invoke('kg_capture_commit',{preview_id:p.preview_id});
    expect((await h.record(p.record_id)).versions[0].raw_path).toBe(inbox);expect(await readdir(path.join(h.vault,'00_Inbox'))).toEqual(['2026-10-14 일기.md']);
    const repeat=await h.invoke('kg_capture_preview',args);expect(repeat.already_registered).toBe(true);expect(repeat.record_id).toBe(p.record_id);expect(repeat.revision).toBe(1);
    await h.organize(p.record_id,{category:'Journal'});expect(await readdir(path.join(h.vault,'00_Inbox'))).toEqual([]);
    expect((await h.rawBytes(p.record_id)).toString()).toBe(text);expect((await h.invoke('kg_validate')).errors).toEqual([]);
    // A subsequent note at the same original path is a revision of that record.
    await writeFile(path.join(h.vault,inbox),'다음 관찰');
    const next=await h.invoke('kg_capture_preview',args);expect(next.record_id).toBe(p.record_id);expect(next.revision).toBe(2);
    await h.invoke('kg_capture_commit',{preview_id:next.preview_id});expect((await h.rawBytes(p.record_id,1)).toString()).toBe(text);expect((await h.rawBytes(p.record_id,2)).toString()).toBe('다음 관찰');
  }finally{await h.dispose();}
});

test('handwritten source edits after preview cannot be overwritten by the registration commit',async()=>{
  const h=await createHarness();try{await h.setup();const inbox='00_Inbox/메모.md';await writeFile(path.join(h.vault,inbox),'이전');
    const p=await h.invoke('kg_capture_preview',{inbox_path:inbox,title:'메모',type:'other'});
    await writeFile(path.join(h.vault,inbox),'계속 작성 중');
    await expect(h.invoke('kg_capture_commit',{preview_id:p.preview_id})).rejects.toMatchObject({code:'HASH_CONFLICT'});
    expect(await readFile(path.join(h.vault,inbox),'utf8')).toBe('계속 작성 중');expect(await readdir(path.join(h.vault,'90_Records'))).toEqual([]);
  }finally{await h.dispose();}
});

test('edited registered Inbox source restores revision one and captures edited bytes as revision two',async()=>{
  const h=await createHarness();try{await h.setup();const a=await h.capture('원래 기록\r\n');const id=a.record_ids[0];const old=(await h.record(id)).versions[0].raw_path;
    await writeFile(path.join(h.vault,old),'수정한 기록\r\n');
    const listing=await h.invoke('kg_inbox_list');expect(listing.items[0].status).toBe('modified');expect(listing.modified_source_count).toBe(1);
    const p=await h.invoke('kg_capture_preview',{record_id:id,modified_revision:1,title:'AI 자소서',type:'essay'});
    expect(p.revision).toBe(2);await h.invoke('kg_capture_commit',{preview_id:p.preview_id});
    expect((await h.rawBytes(id,1)).toString()).toBe('원래 기록\r\n');expect((await h.rawBytes(id,2)).toString()).toBe('수정한 기록\r\n');
    await h.invoke('kg_capture_commit',{preview_id:p.preview_id});expect((await h.record(id)).versions).toHaveLength(2);
  }finally{await h.dispose();}
});

test('organized source edits preserve the old summary and recover old raw bytes from Git after local journals are gone',async()=>{
  const h=await createHarness();try{await h.setup();const a=await h.capture('원본 문장');const id=a.record_ids[0];await h.organize(id);
    const v=(await h.record(id)).versions[0];const summary=await readFile(path.join(h.vault,v.summary_path));
    const git=(args:string[])=>execFileSync('git',['-c','safe.directory='+h.vault,...args],{cwd:h.vault});
    git(['init']);git(['config','user.name','Test']);git(['config','user.email','test@example.invalid']);git(['add','.']);git(['commit','-m','Original']);
    await rm(path.join(h.vault,'.kg-runtime'),{recursive:true,force:true});await writeFile(path.join(h.vault,v.raw_path),'바뀐 문장');
    expect((await h.invoke('kg_inbox_list')).items).toEqual(expect.arrayContaining([expect.objectContaining({record_id:id,status:'modified',revision:1})]));
    const p=await h.invoke('kg_capture_preview',{record_id:id,modified_revision:1,title:'AI 자소서',type:'essay'});await h.invoke('kg_capture_commit',{preview_id:p.preview_id});
    expect((await h.rawBytes(id,1)).toString()).toBe('원본 문장');expect((await h.rawBytes(id,2)).toString()).toBe('바뀐 문장');
    expect(await readFile(path.join(h.vault,v.summary_path))).toEqual(summary);expect((await h.invoke('kg_validate')).errors).toEqual([]);
  }finally{await h.dispose();}
});

test('missing original history blocks revision recovery without changing the edited file or metadata',async()=>{
  const h=await createHarness();try{await h.setup();const a=await h.capture('없어진 원본');const id=a.record_ids[0];const r=await h.record(id);
    await rm(path.join(h.vault,'.kg-runtime'),{recursive:true,force:true});await writeFile(path.join(h.vault,r.versions[0].raw_path),'수정본만 있음');
    await expect(h.invoke('kg_capture_preview',{record_id:id,modified_revision:1,title:r.title,type:r.record_type})).rejects.toMatchObject({code:'ORIGINAL_UNAVAILABLE'});
    expect((await h.record(id)).latest_revision).toBe(1);expect((await h.rawBytes(id)).toString()).toBe('수정본만 있음');
  }finally{await h.dispose();}
});

test('direct Inbox access cannot reach other Vault paths, symlinks or excluded registered content',async()=>{
  const h=await createHarness();try{await h.setup();
    await expect(h.invoke('kg_read',{inbox_path:'00_Inbox/../AGENTS.md',view:'raw'})).rejects.toMatchObject({code:'OUTSIDE_ROOT'});
    await expect(h.invoke('kg_capture_preview',{inbox_path:'99_System/schema-version.json',title:'escape',type:'other'})).rejects.toMatchObject({code:'OUTSIDE_ROOT'});
    const a=await h.capture('비공개 원문','개인', 'journal',{policy:{agent_access:'excluded',github:false,notion:false}});const v=(await h.record(a.record_ids[0])).versions[0];
    expect((await h.invoke('kg_inbox_list')).items).toEqual([]);
    await expect(h.invoke('kg_read',{inbox_path:v.raw_path,view:'raw'})).rejects.toMatchObject({code:'POLICY_BLOCKED'});
    await expect(h.invoke('kg_capture_preview',{inbox_path:v.raw_path,title:'개인',type:'journal'})).rejects.toMatchObject({code:'POLICY_BLOCKED'});
    // Junctions do not require Windows symlink privileges.
    await symlink(h.inputs,path.join(h.vault,'00_Inbox/링크'),process.platform==='win32'?'junction':'dir');
    await h.writeInput('secret.md','외부');expect((await h.invoke('kg_inbox_list')).items).toEqual([]);
    await expect(h.invoke('kg_read',{inbox_path:'00_Inbox/링크/secret.md',view:'raw'})).rejects.toMatchObject({code:'OUTSIDE_ROOT'});
  }finally{await h.dispose();}
});

test('restoration interrupted after restoring revision one can resume without losing the edited revision',async()=>{
  const h=await createHarness();try{await h.setup();const a=await h.capture('원본');const id=a.record_ids[0];const raw=(await h.record(id)).versions[0].raw_path;
    await writeFile(path.join(h.vault,raw),'수정본');const p=await h.invoke('kg_capture_preview',{record_id:id,modified_revision:1,title:'AI 자소서',type:'essay'});
    const op=await get(h.vault,p.preview_id);op.state='applying';await save(h.vault,op);
    const restore=op.changes.find(ch=>ch.path===raw)!;await writeAtomic(h.vault,raw,Buffer.from(restore.content!,'base64'),restore.expected);
    await h.invoke('kg_recover',{operation_id:p.preview_id,mode:'resume'});
    expect((await h.rawBytes(id,1)).toString()).toBe('원본');expect((await h.rawBytes(id,2)).toString()).toBe('수정본');
  }finally{await h.dispose();}
});

test('a changed Inbox listing invalidates its cursor instead of skipping a new note',async()=>{
  const h=await createHarness();try{await h.setup();for(const name of ['a','b'])await writeFile(path.join(h.vault,'00_Inbox/'+name+'.md'),name);
    const page=await h.invoke('kg_inbox_list',{limit:1});await writeFile(path.join(h.vault,'00_Inbox/0.md'),'new');
    await expect(h.invoke('kg_inbox_list',{cursor:page.next_cursor})).rejects.toMatchObject({code:'HASH_CONFLICT'});
    expect((await h.invoke('kg_inbox_list')).items).toHaveLength(3);
  }finally{await h.dispose();}
});

test('an identical note recreated after organization is removed through preview without a duplicate revision',async()=>{
  const h=await createHarness();try{await h.setup();const inbox='00_Inbox/메모.md';await writeFile(path.join(h.vault,inbox),'원문');
    const args={inbox_path:inbox,title:'메모',type:'other'};const p=await h.invoke('kg_capture_preview',args);await h.invoke('kg_capture_commit',{preview_id:p.preview_id});await h.organize(p.record_id);
    await writeFile(path.join(h.vault,inbox),'원문');const duplicate=await h.invoke('kg_capture_preview',args);expect(duplicate.action).toBe('remove_duplicate');
    await h.invoke('kg_capture_commit',{preview_id:duplicate.preview_id});await h.invoke('kg_capture_commit',{preview_id:duplicate.preview_id});
    expect((await h.record(p.record_id)).versions).toHaveLength(1);expect(await readdir(path.join(h.vault,'00_Inbox'))).toEqual([]);expect((await h.rawBytes(p.record_id)).toString()).toBe('원문');
  }finally{await h.dispose();}
});

test('explicit submission status on unchanged handwritten bytes creates a new revision instead of silently ignoring it',async()=>{
  const h=await createHarness();try{await h.setup();const inbox='00_Inbox/지원서.md';await writeFile(path.join(h.vault,inbox),'제출할 본문');
    const args={inbox_path:inbox,title:'지원서',type:'essay',document_status:'final'};const p=await h.invoke('kg_capture_preview',args);await h.invoke('kg_capture_commit',{preview_id:p.preview_id});
    const submitted=await h.invoke('kg_capture_preview',{...args,document_status:'submitted'});expect(submitted.already_registered).not.toBe(true);expect(submitted.revision).toBe(2);
    await h.invoke('kg_capture_commit',{preview_id:submitted.preview_id});const r=await h.record(p.record_id);expect(r.versions[0].document_status).toBe('final');expect(r.versions[1].document_status).toBe('submitted');
    expect(await h.rawBytes(p.record_id,1)).toEqual(await h.rawBytes(p.record_id,2));
    const repeat=await h.invoke('kg_capture_preview',{...args,document_status:'submitted'});expect(repeat.already_registered).toBe(true);expect(repeat.revision).toBe(2);
  }finally{await h.dispose();}
});

test.skipIf(process.platform!=='win32')('Windows casing aliases cannot bypass excluded records or duplicate an in-place registration',async()=>{
  const h=await createHarness();try{await h.setup();const excluded=await h.capture('PRIVATE CONTENT','Secret','journal',{policy:{agent_access:'excluded',github:false,notion:false}});
    const raw=(await h.record(excluded.record_ids[0])).versions[0].raw_path;const alias=raw.replace('Secret.md','sECRET.md');
    await expect(h.invoke('kg_read',{inbox_path:alias,view:'raw'})).rejects.toMatchObject({code:'POLICY_BLOCKED'});
    await expect(h.invoke('kg_capture_preview',{inbox_path:alias,title:'secret',type:'journal'})).rejects.toMatchObject({code:'POLICY_BLOCKED'});
    await writeFile(path.join(h.vault,'00_Inbox/Note.md'),'메모');const p=await h.invoke('kg_capture_preview',{inbox_path:'00_Inbox/Note.md',title:'메모',type:'other'});await h.invoke('kg_capture_commit',{preview_id:p.preview_id});
    const repeat=await h.invoke('kg_capture_preview',{inbox_path:'00_Inbox/nOTE.md',title:'메모',type:'other'});expect(repeat.already_registered).toBe(true);expect(repeat.record_id).toBe(p.record_id);
  }finally{await h.dispose();}
});

test('repeating modified_revision with identical body and submitted status reuses its existing child revision',async()=>{
  const h=await createHarness();try{await h.setup();const a=await h.capture('제출할 본문');const id=a.record_ids[0];
    const args={record_id:id,modified_revision:1,title:'AI 자소서',type:'essay',document_status:'submitted'};
    const submitted=await h.invoke('kg_capture_preview',args);await h.invoke('kg_capture_commit',{preview_id:submitted.preview_id});
    const repeated=await h.invoke('kg_capture_preview',args);expect(repeated.already_registered).toBe(true);expect(repeated.revision).toBe(2);expect((await h.record(id)).versions).toHaveLength(2);
  }finally{await h.dispose();}
});
