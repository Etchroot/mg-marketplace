// 실행 파일이 바뀌었는데 버전을 올리지 않으면 실패한다. 실패하면 npm run bump 를 실행한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, VERSION_FILES, runtimeHash } from '../tools/runtime-hash.mjs';
import { bump, nextVersion } from '../tools/bump.mjs';

const readJson = async (root, file) => JSON.parse(await readFile(join(root, file), 'utf8'));

test('실행 파일이 마지막 버전 이후 바뀌었으면 버전도 올라가 있다', async () => {
  const release = await readJson(ROOT, 'release.json');
  const manifest = await readJson(ROOT, 'plugin.json');
  assert.equal(
    release.version,
    manifest.version,
    'release.json 과 매니페스트의 버전이 다릅니다. 버전은 직접 고치지 말고 npm run bump 로 올리세요.',
  );
  assert.equal(
    await runtimeHash(),
    release.runtimeHash,
    '실행 파일(hooks, scripts, agents, codex, 매니페스트)이 마지막 버전 이후 바뀌었습니다. npm run bump 를 실행하세요.',
  );
});

test('nextVersion: patch / minor / major', () => {
  assert.equal(nextVersion('0.2.1', 'patch'), '0.2.2');
  assert.equal(nextVersion('0.2.1', 'minor'), '0.3.0');
  assert.equal(nextVersion('0.2.1', 'major'), '1.0.0');
});

test('bump: 버전 파일 4개와 release.json 을 함께 바꾸고, 지문이 맞는다', async () => {
  const copy = join(await mkdtemp(join(tmpdir(), 'bump-')), 'plugin');
  await cp(ROOT, copy, { recursive: true, filter: (src) => !src.includes('node_modules') && !src.endsWith('.env') });
  const before = (await readJson(copy, 'plugin.json')).version;

  const { next, readmeUpdated } = await bump('minor', copy);
  assert.equal(next, nextVersion(before, 'minor'));
  assert.equal(readmeUpdated, false); // 임시 복사본 위에는 마켓플레이스 README가 없다
  for (const file of VERSION_FILES) assert.equal((await readJson(copy, file)).version, next, file);

  const release = await readJson(copy, 'release.json');
  assert.deepEqual(release, { version: next, runtimeHash: await runtimeHash(copy) });
  assert.equal(release.runtimeHash, await runtimeHash(), '버전 값만 바뀌면 지문은 같아야 한다');
});
