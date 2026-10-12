import {test,expect,vi} from 'vitest';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHarness} from '../support/harness.js';
import * as atomic from '../../src/storage/atomic.js';
import {links} from '../../src/notes/parser.js';

test('an external source edit during preview is preserved and commit conflicts',async()=>{
  const h=await createHarness();try{await h.setup();const a=await h.capture('ORIGINAL CONTENT');const id=a.record_ids[0];const r=await h.record(id);const p=r.versions[0].raw_path;const d=await h.draft(id);
    const original=atomic.bytes;let reads=0;const spy=vi.spyOn(atomic,'bytes').mockImplementation(async(root,rel)=>{const b=await original(root,rel);if(root===h.vault&&rel===p&&++reads===2)await writeFile(path.join(root,p),'EXTERNAL NEW CONTENT');return b;});
    let preview:any;try{preview=await h.invoke('kg_organize_preview',{drafts:[d]});}finally{spy.mockRestore();}
    await expect(h.invoke('kg_organize_commit',{preview_id:preview.preview_id})).rejects.toMatchObject({code:'HASH_CONFLICT'});
    expect(await readFile(path.join(h.vault,p),'utf8')).toBe('EXTERNAL NEW CONTENT');
  }finally{vi.restoreAllMocks();await h.dispose();}
});

test('manual topic edits during preview retain the original snapshot precondition',async()=>{
  const h=await createHarness();try{await h.setup();const a=await h.capture('first');await h.organize(a.record_ids[0]);const b=await h.capture('second');const d=await h.draft(b.record_ids[0]);const p='30_Topics/ai-native.md';
    const original=atomic.bytes;let changed=false;const spy=vi.spyOn(atomic,'bytes').mockImplementation(async(root,rel)=>{const text=await original(root,rel);if(root===h.vault&&rel===p&&!changed){changed=true;await writeFile(path.join(root,p),text.toString()+'\nEXTERNAL MANUAL EDIT\n');}return text;});
    let preview:any;try{preview=await h.invoke('kg_organize_preview',{drafts:[d]});}finally{spy.mockRestore();}
    await expect(h.invoke('kg_organize_commit',{preview_id:preview.preview_id})).rejects.toMatchObject({code:'HASH_CONFLICT'});expect(await readFile(path.join(h.vault,p),'utf8')).toContain('EXTERNAL MANUAL EDIT');
  }finally{vi.restoreAllMocks();await h.dispose();}
});

test('Markdown fallback links resolve relative to the summary and topic note',async()=>{
  const h=await createHarness();try{await h.setup();const a=await h.capture('AI source');await h.organize(a.record_ids[0]);const r=await h.record(a.record_ids[0]);
    for(const p of [r.versions[0].summary_path,'30_Topics/ai-native.md']){const body=await readFile(path.join(h.vault,p),'utf8');for(const m of body.matchAll(/\[파일\]\(([^)]+)\)/g))await expect(readFile(path.resolve(h.vault,path.dirname(p),decodeURIComponent(m[1])))).resolves.toBeDefined();}
    expect((await h.invoke('kg_validate')).errors).toEqual([]);
  }finally{await h.dispose();}
});

test('Inbox supplied extraction participates in fallback and changed extraction is reported',async()=>{
  const h=await createHarness();try{await h.setup();const file=await h.writeInput('scan.pdf',Buffer.from([0,255,1]));const p=await h.invoke('kg_capture_preview',{source_path:file,title:'scan',type:'reference',extracted_text:'UNIQUE EXTRACTED PHRASE'});const a=await h.invoke('kg_capture_commit',{preview_id:p.preview_id});
    const found=await h.invoke('kg_search',{terms:['UNIQUE EXTRACTED PHRASE'],fallback:'raw_text'});expect(found.items[0]?.record_id).toBe(a.record_ids[0]);
    const r=await h.record(a.record_ids[0]);await writeFile(path.join(h.vault,r.versions[0].extracted_path),'ALTERED');const invalid=await h.invoke('kg_search',{terms:['ALTERED'],fallback:'raw_text'});expect(invalid.items).toEqual([]);expect(invalid.coverage.unsearchable_count).toBe(1);
    await expect(h.invoke('kg_read',{record_id:a.record_ids[0],view:'extracted'})).rejects.toMatchObject({code:'HASH_CONFLICT'});
  }finally{await h.dispose();}
});

test('explicit recovery claims a dead writer while preserving live writer ownership',async()=>{
  const h=await createHarness();try{await h.setup();const p=await h.invoke('kg_capture_preview',{text:'recover',title:'recover',type:'essay'});const lock=path.join(h.vault,'.kg-runtime/writer.lock');await mkdir(lock);await writeFile(path.join(lock,'owner.json'),JSON.stringify({pid:2147483647,instance:'dead',created_at:new Date().toISOString()}));
    expect((await h.invoke('kg_recover',{operation_id:p.preview_id,mode:'resume'})).local_state).toBe('succeeded');
    await mkdir(lock);await writeFile(path.join(lock,'owner.json'),JSON.stringify({pid:process.pid,instance:'live',created_at:new Date().toISOString()}));await expect(h.invoke('kg_recover',{operation_id:p.preview_id,mode:'resume'})).rejects.toMatchObject({code:'VAULT_BUSY'});expect(JSON.parse(await readFile(path.join(lock,'owner.json'),'utf8')).instance).toBe('live');
  }finally{await h.dispose();}
});
