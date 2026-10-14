// 마켓플레이스 공용 도구: 플러그인 목록, 버전 파일, 실행 파일 지문.
// "실행 파일"은 설치한 사람의 동작에 영향을 주는 파일이다. 아래 NON_RUNTIME 에 해당하지 않으면
// 모두 실행 파일로 본다. 애매하면 버전을 올리는 쪽이 안전하기 때문이다.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const MARKETPLACE = 'mg-marketplace';
export const REPO = 'Etchroot/mg-marketplace';
export const VERSION_FILES = ['plugin.json', '.claude-plugin/plugin.json', '.codex-plugin/plugin.json', 'package.json'];
export const CATALOGS = ['.claude-plugin/marketplace.json', '.agents/plugins/marketplace.json'];

// 문서·테스트·개발 도구처럼 설치한 사람의 동작과 무관한 파일 (플러그인 폴더 기준 경로)
const NON_RUNTIME = [
  /^(README|SPEC|AGENTS|CLAUDE|CHANGELOG|THIRD_PARTY_NOTICES)\.md$/i,
  /^LICENSE/i,
  /^\.git(ignore|attributes)$/,
  /^\.env\.example$/,
  /^release\.json$/,
  /^(docs|examples|test|tests|bench|eval|tools)\//,
];

export const isRuntime = (rel) => !NON_RUNTIME.some((re) => re.test(rel));

export function listPlugins(root = ROOT) {
  return readdirSync(join(root, 'plugins'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

export const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

export function pluginVersion(name, root = ROOT) {
  return readJson(join(root, 'plugins', name, 'plugin.json')).version;
}

// 플러그인 폴더에 있고 version 을 가진 파일들
export function versionFiles(name, root = ROOT) {
  const dir = join(root, 'plugins', name);
  return VERSION_FILES.filter((f) => existsSync(join(dir, f)) && readJson(join(dir, f)).version !== undefined);
}

// git 이 추적하는 파일 + 아직 추적하지 않지만 무시 대상도 아닌 새 파일
export function pluginFiles(name, root = ROOT) {
  const prefix = `plugins/${name}/`;
  const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', prefix], {
    cwd: root,
    encoding: 'utf8',
  });
  return [...new Set(out.split('\n').filter(Boolean))]
    .map((p) => p.slice(prefix.length))
    .filter((rel) => !rel.split('/').includes('node_modules') && existsSync(join(root, prefix, rel)))
    .sort();
}

export function runtimeHash(name, root = ROOT) {
  const dir = join(root, 'plugins', name);
  const hash = createHash('sha256');
  for (const rel of pluginFiles(name, root).filter(isRuntime)) {
    let text = readFileSync(join(dir, rel), 'utf8').replace(/\r\n/g, '\n'); // Windows/macOS 지문을 맞춘다
    if (VERSION_FILES.includes(rel)) {
      // 버전 값 자체와, 개발용 항목(package.json 의 scripts / devDependencies)은 지문에서 뺀다
      const json = JSON.parse(text);
      delete json.version;
      if (rel === 'package.json') {
        delete json.scripts;
        delete json.devDependencies;
      }
      text = JSON.stringify(json);
    }
    hash.update(`${rel}\0${text}\0`);
  }
  return hash.digest('hex');
}

export const releasesPath = (root = ROOT) => join(root, 'releases.json');

export function readReleases(root = ROOT) {
  return existsSync(releasesPath(root)) ? readJson(releasesPath(root)) : {};
}

export function nextVersion(current, kind) {
  const [major, minor, patch] = current.split('.').map(Number);
  if (kind === 'major') return `${major + 1}.0.0`;
  if (kind === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

// 루트 README 플러그인 표의 버전 칸: | [이름](...) | 0.1.2 | 설명 |
export const readmeRow = (name) => new RegExp(`(\\| \\[${name}\\]\\([^)]*\\) \\| )([^ |]+)( \\|)`);
