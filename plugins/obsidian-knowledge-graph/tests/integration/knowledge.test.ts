import {test, expect} from 'vitest';
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHarness} from '../support/harness.js';
test('organize links topics, preserves raw, and alias search reads a bounded excerpt', async () => {
  const h = await createHarness(); try {
    await h.setup(); const a = await h.capture('AI 네이티브 자동화 경험을 자소서에 설명했다.\n두 번째 줄'); const id = a.record_ids[0];
    const before = await h.rawBytes(id); await h.organize(id);
    expect(await h.rawBytes(id)).toEqual(before);
    const r = await h.invoke('kg_search', {terms: ['AI-native'], record_types: ['essay']});
    expect(r.items[0].record_id).toBe(id); expect(r.items[0].snippet.length).toBeLessThanOrEqual(200);
    expect((await h.invoke('kg_inbox_list')).items).toHaveLength(0);
    const neighbors = await h.invoke('kg_neighbors', {seed_ids: ['topic-ai-native']});
    expect(neighbors.nodes.some((n: any) => n.record_id === id)).toBe(true);
    const raw = await h.invoke('kg_read', {record_id: id, view: 'raw', line_start: 2, line_end: 2});
    expect(raw.text).toBe('두 번째 줄');
    expect((await h.invoke('kg_validate')).errors).toEqual([]);
  } finally {await h.dispose();}
});
test('invented evidence and duplicate drafts fail before moving an Inbox record', async () => {
  const h = await createHarness(); try {
    await h.setup(); const a = await h.capture('원문'); const d = await h.draft(a.record_ids[0]);
    d.facts[0].evidence[0].quote = 'invented';
    await expect(h.invoke('kg_organize_preview', {drafts: [d]})).rejects.toMatchObject({code: 'INVALID_INPUT'});
    const good = await h.draft(a.record_ids[0]);
    await expect(h.invoke('kg_organize_preview', {drafts: [good, good]})).rejects.toMatchObject({code: 'INVALID_INPUT'});
    expect((await h.invoke('kg_inbox_list')).items).toHaveLength(1);
  } finally {await h.dispose();}
});
test('rebuilding catalogs is deterministic and detects externally edited raw', async () => {
  const h = await createHarness(); try {
    await h.setup(); const a = await h.capture('AI 네이티브 원문'); const id = a.record_ids[0]; await h.organize(id);
    await h.invoke('kg_rebuild_catalog'); const file = path.join(h.vault, '99_System/catalog/records.json'); const before = await readFile(file);
    await h.invoke('kg_rebuild_catalog'); expect(await readFile(file)).toEqual(before);
    const rec = await h.record(id); await writeFile(path.join(h.vault, rec.versions[0].raw_path), '변경된 원문');
    const r = await h.invoke('kg_search', {terms: ['AI 네이티브']});
    expect(r.coverage.stale_summary_count).toBe(1);
    expect((await h.invoke('kg_validate')).errors.some((e: any) => e.code === 'HASH_CONFLICT')).toBe(true);
  } finally {await h.dispose();}
});
test('binary raw is preserved and its missing extraction appears in coverage', async () => {
  const h = await createHarness(); try {
    await h.setup(); const bytes = Uint8Array.from([0, 255, 10, 2]); const a = await h.capture(bytes); const id = a.record_ids[0];
    expect(await h.rawBytes(id)).toEqual(Buffer.from(bytes));
    await expect(h.invoke('kg_read', {record_id: id, view: 'raw'})).rejects.toMatchObject({code: 'UNSUPPORTED_MEDIA'});
    expect((await h.invoke('kg_search', {terms: ['unknown']})).coverage.unsearchable_count).toBe(1);
  } finally {await h.dispose();}
});
test('read pagination caps responses at 8000 chars including one very long line', async () => {
  const h = await createHarness(); try {
    await h.setup(); const a = await h.capture('x'.repeat(20000)); const id = a.record_ids[0];
    const r = await h.invoke('kg_read', {record_id: id, view: 'raw', max_chars: 8000});
    expect(r.text.length).toBe(8000); expect(r.has_more).toBe(true);
    const next = await h.invoke('kg_read', {record_id: id, view: 'raw', max_chars: 8000, cursor: r.next_cursor});
    expect(next.text.length).toBe(8000);
  } finally {await h.dispose();}
});
