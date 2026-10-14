#!/usr/bin/env node
// 프로젝트 하나에 mg-marketplace 플러그인을 켜고, 마켓플레이스 자동 업데이트를 켠다 (Claude Code).
// 내 계정 전체(user) 설정은 건드리지 않고, 그 프로젝트의 설정 파일에만 쓴다.
//
// 사용: node tools/setup-project.mjs <프로젝트 폴더> <플러그인> [<플러그인> ...] [--shared] [--no-install]
//   기본       .claude/settings.local.json  (나만, git 에 올라가지 않음)
//   --shared   .claude/settings.json        (팀과 공유, git 에 올림)
//   --no-install  설정 파일만 쓰고 claude CLI 로 내려받지는 않음
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { MARKETPLACE, REPO, ROOT, readJson } from './lib.mjs';

export function applySettings(settingsPath, plugins) {
  const settings = existsSync(settingsPath) ? readJson(settingsPath) : {};
  settings.extraKnownMarketplaces ??= {};
  settings.extraKnownMarketplaces[MARKETPLACE] = {
    ...settings.extraKnownMarketplaces[MARKETPLACE],
    source: { source: 'github', repo: REPO },
    autoUpdate: true,
  };
  settings.enabledPlugins ??= {};
  for (const p of plugins) settings.enabledPlugins[`${p}@${MARKETPLACE}`] = true;
  mkdirSync(join(settingsPath, '..'), { recursive: true });
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  return settings;
}

function findClaude() {
  for (const candidate of ['claude', join(homedir(), '.local', 'bin', process.platform === 'win32' ? 'claude.exe' : 'claude')]) {
    try {
      execFileSync(candidate, ['--version'], { stdio: 'ignore' });
      return candidate;
    } catch {}
  }
  return null;
}

function knownMarketplace() {
  const file = join(homedir(), '.claude', 'plugins', 'known_marketplaces.json');
  return existsSync(file) && MARKETPLACE in readJson(file);
}

function main(argv) {
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  const [projectArg, ...plugins] = argv.filter((a) => !a.startsWith('--'));
  if (!projectArg || plugins.length === 0) {
    console.error('사용: node tools/setup-project.mjs <프로젝트 폴더> <플러그인> [<플러그인> ...] [--shared] [--no-install]');
    process.exit(1);
  }
  const project = resolve(projectArg);
  if (!existsSync(project)) throw new Error(`프로젝트 폴더가 없습니다: ${project}`);

  const available = readJson(join(ROOT, '.claude-plugin', 'marketplace.json')).plugins.map((p) => p.name);
  const unknown = plugins.filter((p) => !available.includes(p));
  if (unknown.length) throw new Error(`마켓플레이스에 없는 플러그인: ${unknown.join(', ')} (있는 것: ${available.join(', ')})`);

  const shared = flags.has('--shared');
  const scope = shared ? 'project' : 'local';
  const settingsPath = join(project, '.claude', shared ? 'settings.json' : 'settings.local.json');

  const claude = flags.has('--no-install') ? null : findClaude();
  if (claude) {
    const run = (...args) => execFileSync(claude, args, { cwd: project, stdio: 'inherit' });
    if (!knownMarketplace()) run('plugin', 'marketplace', 'add', REPO, '--scope', scope);
    for (const p of plugins) run('plugin', 'install', `${p}@${MARKETPLACE}`, '--scope', scope);
  }
  // CLI가 설정 파일을 다시 쓰므로, 자동 업데이트와 활성화는 마지막에 확실히 기록한다
  applySettings(settingsPath, plugins);

  console.log(`\n설정 완료: ${settingsPath}`);
  console.log(`  켠 플러그인: ${plugins.join(', ')}`);
  console.log(`  ${MARKETPLACE} 자동 업데이트: 켜짐`);
  if (!claude) console.log('  claude CLI를 쓰지 않아 내려받기는 다음 세션 시작 때 진행됩니다.');

  if (!shared) {
    try {
      execFileSync('git', ['check-ignore', '-q', settingsPath], { cwd: project, stdio: 'ignore' });
    } catch (e) {
      if (e.status === 1) console.log('  ⚠ settings.local.json 이 git 무시 대상이 아닙니다. .gitignore 에 추가하세요.');
    }
  }
  console.log('\n새 세션에서 적용됩니다. 플러그인에 필요한 값(예: API 키)은 /plugin configure <플러그인>@mg-marketplace 로 넣습니다.');
  console.log('데스크톱 앱 세션에서는 자동 업데이트가 꺼져 있을 수 있습니다 (DISABLE_AUTOUPDATER). 루트 README 참고.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
