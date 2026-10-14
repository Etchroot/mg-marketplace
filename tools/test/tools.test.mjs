// 임시 폴더에 작은 마켓플레이스를 만들어서 bump / check / setup-project 를 확인한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { bump } from '../bump.mjs';
import { check } from '../check.mjs';
import { applySettings } from '../setup-project.mjs';
import { isRuntime, nextVersion, readJson, runtimeHash } from '../lib.mjs';

function write(root, rel, content) {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), typeof content === 'string' ? content : JSON.stringify(content, null, 2) + '\n');
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'mkt-'));
  const manifest = { name: 'foo', version: '1.2.3', description: 'x' };
  write(root, 'plugins/foo/plugin.json', manifest);
  write(root, 'plugins/foo/.claude-plugin/plugin.json', manifest);
  write(root, 'plugins/foo/package.json', { name: 'foo', version: '1.2.3', scripts: { test: 'x' } });
  write(root, 'plugins/foo/skills/hello/SKILL.md', 'say hello\n');
  write(root, 'plugins/foo/README.md', 'docs\n');
  write(root, '.claude-plugin/marketplace.json', { name: 'mkt', plugins: [{ name: 'foo', source: './plugins/foo' }] });
  write(root, '.agents/plugins/marketplace.json', { name: 'mkt', plugins: [{ name: 'foo' }] });
  write(root, 'README.md', '| 이름 | 버전 | 설명 |\n| --- | --- | --- |\n| [foo](plugins/foo/README.md) | 1.2.3 | 예시 |\n');
  execFileSync('git', ['init', '-q'], { cwd: root });
  write(root, 'releases.json', { foo: { version: '1.2.3', runtimeHash: runtimeHash('foo', root) } });
  return root;
}

test('실행 파일 구분: 문서·테스트·개발 도구는 제외, 나머지는 실행 파일', () => {
  for (const f of ['README.md', 'SPEC.md', 'AGENTS.md', 'test/a.test.mjs', 'bench/x.mjs', 'docs/a.md', '.env.example', 'LICENSE']) {
    assert.equal(isRuntime(f), false, f);
  }
  for (const f of ['plugin.json', 'scripts/route.mjs', 'skills/a/SKILL.md', 'hooks/hooks.json', 'dist/cli.cjs', 'package.json']) {
    assert.equal(isRuntime(f), true, f);
  }
  assert.equal(nextVersion('1.2.3', 'patch'), '1.2.4');
  assert.equal(nextVersion('1.2.3', 'minor'), '1.3.0');
  assert.equal(nextVersion('1.2.3', 'major'), '2.0.0');
});

test('check: 깨끗한 상태는 통과', () => {
  assert.deepEqual(check(fixture()).problems, []);
});

test('check: 문서만 바꾸면 통과, 실행 파일을 바꾸면 bump 안내와 함께 실패', () => {
  const root = fixture();
  write(root, 'plugins/foo/README.md', 'docs changed\n');
  write(root, 'plugins/foo/package.json', { name: 'foo', version: '1.2.3', scripts: { test: 'changed' } });
  assert.deepEqual(check(root).problems, [], '문서와 package.json scripts 는 실행 파일 변경이 아니다');

  write(root, 'plugins/foo/skills/hello/SKILL.md', 'say hi\n');
  const [problem] = check(root).problems;
  assert.match(problem, /실행 파일이 1\.2\.3 이후 바뀌었는데.*node tools\/bump\.mjs foo/);
});

test('check: 새로 만든(아직 커밋 안 한) 실행 파일도 잡는다', () => {
  const root = fixture();
  write(root, 'plugins/foo/skills/new/SKILL.md', 'new\n');
  assert.equal(check(root).problems.length, 1);
});

test('check: 줄바꿈(CRLF/LF) 차이만으로는 실패하지 않는다', () => {
  const root = fixture();
  write(root, 'plugins/foo/skills/hello/SKILL.md', 'say hello\r\n');
  assert.deepEqual(check(root).problems, []);
});

test('check: 버전 불일치, 카탈로그 누락, README 표 버전 불일치를 잡는다', () => {
  const root = fixture();
  write(root, 'plugins/foo/.claude-plugin/plugin.json', { name: 'foo', version: '9.9.9' });
  write(root, '.agents/plugins/marketplace.json', { name: 'mkt', plugins: [] });
  write(root, 'README.md', '| [foo](plugins/foo/README.md) | 0.0.1 | 예시 |\n');
  const problems = check(root).problems.join('\n');
  assert.match(problems, /\.claude-plugin\/plugin\.json 의 버전\(9\.9\.9\)/);
  assert.match(problems, /\.agents\/plugins\/marketplace\.json 에 등록돼 있지 않습니다/);
  assert.match(problems, /README 표의 버전\(0\.0\.1\)/);
});

test('bump: 버전 파일, README 표, releases.json 을 함께 바꾸고 검사를 통과한다', () => {
  const root = fixture();
  write(root, 'plugins/foo/skills/hello/SKILL.md', 'say hi\n');
  const { current, next } = bump('foo', 'minor', root);
  assert.deepEqual([current, next], ['1.2.3', '1.3.0']);
  for (const f of ['plugin.json', '.claude-plugin/plugin.json', 'package.json']) {
    assert.equal(readJson(join(root, 'plugins/foo', f)).version, '1.3.0', f);
  }
  assert.match(readFileSync(join(root, 'README.md'), 'utf8'), /\| \[foo\]\(plugins\/foo\/README\.md\) \| 1\.3\.0 \|/);
  assert.equal(readJson(join(root, 'releases.json')).foo.version, '1.3.0');
  assert.deepEqual(check(root).problems, []);
  assert.throws(() => bump('nope', 'patch', root), /플러그인을 찾을 수 없습니다/);
  assert.throws(() => bump('foo', 'huge', root), /알 수 없는 종류/);
});

test('bump record: 새 플러그인은 버전을 그대로 두고 첫 기록만, 이미 기록된 플러그인에는 거부', () => {
  const root = fixture();
  write(root, 'releases.json', {});
  assert.match(check(root).problems.join('\n'), /node tools\/bump\.mjs foo record/);
  assert.deepEqual(bump('foo', 'record', root), { current: '1.2.3', next: '1.2.3', changed: ['releases.json'] });
  assert.equal(readJson(join(root, 'plugins/foo/plugin.json')).version, '1.2.3');
  assert.deepEqual(check(root).problems, []);

  write(root, 'plugins/foo/skills/hello/SKILL.md', 'changed\n');
  assert.throws(() => bump('foo', 'record', root), /이미 기록돼 있습니다/);
});

test('setup-project: 기존 설정을 지우지 않고 플러그인과 자동 업데이트를 켠다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'proj-'));
  const path = join(dir, '.claude', 'settings.local.json');
  write(dir, '.claude/settings.local.json', {
    permissions: { allow: ['Bash(ls:*)'] },
    enabledPlugins: { 'other@x': true },
    extraKnownMarketplaces: { 'mg-marketplace': { source: { source: 'github', repo: 'Etchroot/mg-marketplace' } } },
  });
  applySettings(path, ['jev-model-harness']);
  const s = readJson(path);
  assert.deepEqual(s.permissions, { allow: ['Bash(ls:*)'] });
  assert.equal(s.enabledPlugins['other@x'], true);
  assert.equal(s.enabledPlugins['jev-model-harness@mg-marketplace'], true);
  assert.equal(s.extraKnownMarketplaces['mg-marketplace'].autoUpdate, true);
  assert.deepEqual(s.extraKnownMarketplaces['mg-marketplace'].source, { source: 'github', repo: 'Etchroot/mg-marketplace' });
});
