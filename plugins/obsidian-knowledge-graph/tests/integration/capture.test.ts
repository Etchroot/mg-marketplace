import {test, expect} from 'vitest';
import {writeFile} from 'node:fs/promises';
import {createHarness} from '../support/harness.js';
test('capture preserves CRLF bytes and replays the receipt without duplicate records', async () => {
  const h = await createHarness(); try {
    await h.setup(); const source = await h.writeInput('최종본.md', '한글 😀\r\nAI 네이티브\r\n');
    const p = await h.invoke('kg_capture_preview', {source_path: source, title: '최종본', type: 'essay'});
    const a = await h.invoke('kg_capture_commit', {preview_id: p.preview_id});
    const b = await h.invoke('kg_capture_commit', {preview_id: p.preview_id});
    expect(a.record_ids).toEqual(b.record_ids);
    expect((await h.rawBytes(a.record_ids[0])).toString()).toBe('한글 😀\r\nAI 네이티브\r\n');
    expect((await h.invoke('kg_inbox_list')).items).toHaveLength(1);
  } finally {await h.dispose();}
});
test('changed source after preview is rejected before storing bytes', async () => {
  const h = await createHarness(); try {
    await h.setup(); const source = await h.writeInput('a.md', 'before');
    const p = await h.invoke('kg_capture_preview', {source_path: source, title: 'a', type: 'essay'});
    await writeFile(source, 'after');
    await expect(h.invoke('kg_capture_commit', {preview_id: p.preview_id})).rejects.toMatchObject({code: 'HASH_CONFLICT'});
    expect((await h.invoke('kg_inbox_list')).items).toHaveLength(0);
  } finally {await h.dispose();}
});
test('new revision keeps the old raw and excluded records never appear in reads', async () => {
  const h = await createHarness(); try {
    await h.setup(); const a = await h.capture('old'); const id = a.record_ids[0];
    await h.capture('new', 'AI 자소서', 'essay', {record_id: id});
    expect((await h.rawBytes(id, 1)).toString()).toBe('old'); expect((await h.rawBytes(id, 2)).toString()).toBe('new');
    const b = await h.capture('private', '숨김', 'essay', {policy: {agent_access: 'excluded', github: false, notion: false}});
    await expect(h.invoke('kg_read', {record_id: b.record_ids[0], view: 'raw'})).rejects.toMatchObject({code: 'POLICY_BLOCKED'});
  } finally {await h.dispose();}
});
