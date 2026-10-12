import {test, expect} from 'vitest';
import {mkdir, symlink} from 'node:fs/promises';
import path from 'node:path';
import {resolveInside} from '../../src/storage/paths.js';
import {createHarness} from '../support/harness.js';
test('paths reject traversal and junction escapes but allow new files inside a Korean root', async () => {
  const h = await createHarness(); try {
    await expect(resolveInside(h.vault, '../outside.md')).rejects.toMatchObject({code: 'OUTSIDE_ROOT'});
    const target = path.join(h.dir, 'outside'); await mkdir(target);
    await symlink(target, path.join(h.vault, 'escape'), 'junction');
    await expect(resolveInside(h.vault, 'escape/stolen.md')).rejects.toMatchObject({code: 'OUTSIDE_ROOT'});
    expect(await resolveInside(h.vault, '새 폴더/원본.md')).toBe(path.join(h.vault, '새 폴더', '원본.md'));
  } finally {await h.dispose();}
});
