import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { PLATFORMS, detectPlatform, resolveTarget } from '../scripts/lib/platforms.mjs';
import { buildInstruction } from '../scripts/lib/instruction.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

test('플랫폼 감지: Codex 입력에는 turn_id 가 있다', () => {
  assert.equal(detectPlatform({ prompt: 'x' }, {}), 'claude-code');
  assert.equal(detectPlatform({ prompt: 'x', turn_id: 't1', model: 'gpt-6.1-sol' }, {}), 'codex');
  assert.equal(detectPlatform({ prompt: 'x' }, { MODEL_ROUTER_PLATFORM: 'codex' }), 'codex');
  assert.equal(detectPlatform({ turn_id: 't' }, { MODEL_ROUTER_PLATFORM: 'nope' }), 'codex');
});

test('단계 → 워커: Claude Code는 3단 워커, Codex는 Luna만 위임', () => {
  assert.equal(resolveTarget('claude-code', 'light'), 'haiku-worker');
  assert.equal(resolveTarget('claude-code', 'mid'), 'sonnet-worker');
  assert.equal(resolveTarget('claude-code', 'main'), 'main');
  assert.equal(resolveTarget('claude-code', 'high'), 'opus-worker');
  assert.equal(resolveTarget('codex', 'high'), 'main');
  assert.equal(resolveTarget('codex', 'light'), 'luna_worker');
  assert.equal(resolveTarget('codex', 'mid'), 'main');
  assert.equal(resolveTarget('codex', 'main'), 'main');
});

test('메인 모델 단계: Claude Code는 모델 이름으로, Codex는 항상 최고 단계', () => {
  const level = PLATFORMS['claude-code'].modelLevel;
  assert.deepEqual(['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5', 'something-else'].map(level), [0, 1, 2, null]);
  assert.equal(PLATFORMS.codex.modelLevel('gpt-6.1-sol'), 2);
  assert.equal(PLATFORMS['claude-code'].mainModel, undefined);
  assert.ok(PLATFORMS.codex.mainModel.pattern.test('gpt-6.1-sol'));
  assert.ok(!PLATFORMS.codex.mainModel.pattern.test('gpt-6-sol'));
  assert.ok(!PLATFORMS.codex.mainModel.pattern.test('gpt-6-astra'));
});

test('Codex 위임 지시는 자연어로, 이어 쓰기 안내 없이', () => {
  const s = buildInstruction({ platform: 'codex', target: 'luna_worker', reuse: true });
  assert.match(s, /Have the `luna_worker` subagent/);
  assert.doesNotMatch(s, /SendMessage|Agent tool|jev-model-harness:/);
});

test('Codex 서브에이전트 TOML에 필수 필드와 Luna 모델이 있다', async () => {
  const toml = await readFile(join(ROOT, 'codex', 'agents', 'luna_worker.toml'), 'utf8');
  for (const key of ['name', 'description', 'developer_instructions']) assert.match(toml, new RegExp(`^${key} = `, 'm'));
  assert.match(toml, /^name = "luna_worker"$/m);
  assert.match(toml, /^model = "gpt-6-luna"$/m);
  assert.match(toml, /^sandbox_mode = "read-only"$/m);
});

test('setup-codex: 설치, 같은 파일은 그대로, 다른 파일은 --force 없이 안 덮어씀', async () => {
  const home = await mkdtemp(join(tmpdir(), 'codex-'));
  const run = (...args) =>
    spawnSync(process.execPath, [join(ROOT, 'scripts', 'setup-codex.mjs'), ...args], {
      env: { ...process.env, CODEX_HOME: home },
      encoding: 'utf8',
    }).stdout;
  const target = join(home, 'agents', 'luna_worker.toml');

  assert.match(run(), /설치/);
  assert.match(run(), /그대로 둠/);

  await writeFile(target, 'name = "mine"\n');
  assert.match(run(), /건너뜀/);
  assert.equal(await readFile(target, 'utf8'), 'name = "mine"\n');

  assert.match(run('--force'), /덮어씀/);
  assert.match(await readFile(target, 'utf8'), /luna_worker/);
});

test('매니페스트 세 개와 package.json 의 이름·버전이 같고, 훅 경로가 맞다', async () => {
  const read = async (...p) => JSON.parse(await readFile(join(ROOT, ...p), 'utf8'));
  const root = await read('plugin.json');
  const claude = await read('.claude-plugin', 'plugin.json');
  const codex = await read('.codex-plugin', 'plugin.json');
  const pkg = await read('package.json');
  for (const m of [claude, codex, pkg]) {
    assert.equal(m.name, root.name);
    assert.equal(m.version, root.version);
  }
  assert.equal(root.extensions['com.openai'].hooks, './hooks/hooks.json');
  assert.equal(codex.hooks, './hooks/hooks.json');
  await readFile(join(ROOT, 'hooks', 'hooks.json'));
});
