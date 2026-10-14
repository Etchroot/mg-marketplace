#!/usr/bin/env node
// 플러그인 버전 올리기. 버전 파일들, 루트 README 버전 표, releases.json(실행 파일 지문)을 한 번에 바꾼다.
// 사용: node tools/bump.mjs <플러그인> [patch|minor|major|record]   (기본 patch)
//   예) node tools/bump.mjs jev-model-harness          0.2.1 → 0.2.2
//       node tools/bump.mjs music-director minor      0.2.1 → 0.3.0
//       node tools/bump.mjs new-plugin record         새 플러그인: 버전은 그대로, 첫 기록만 남김
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ROOT, listPlugins, nextVersion, pluginVersion, readReleases, readmeRow, releasesPath, runtimeHash, versionFiles,
} from './lib.mjs';

export function bump(name, kind = 'patch', root = ROOT) {
  if (!listPlugins(root).includes(name)) {
    throw new Error(`플러그인을 찾을 수 없습니다: ${name} (있는 것: ${listPlugins(root).join(', ')})`);
  }
  if (!['patch', 'minor', 'major', 'record'].includes(kind)) {
    throw new Error(`알 수 없는 종류: ${kind} (patch / minor / major, 새 플러그인 첫 기록은 record)`);
  }

  const current = pluginVersion(name, root);
  const releases = readReleases(root);

  // 새 플러그인: 버전은 그대로 두고 지금 상태를 첫 기록으로 남긴다. 이미 기록된 플러그인에는 쓸 수 없다.
  if (kind === 'record') {
    if (releases[name]) throw new Error(`${name} 은 이미 기록돼 있습니다. 변경 후에는 patch / minor / major 로 올리세요.`);
    releases[name] = { version: current, runtimeHash: runtimeHash(name, root) };
    writeReleases(releases, root);
    return { current, next: current, changed: ['releases.json'] };
  }

  const next = nextVersion(current, kind);
  const dir = join(root, 'plugins', name);

  // 들여쓰기 등 파일 모양은 그대로 두고 첫 "version" 값만 바꾼다
  const changed = [];
  for (const file of versionFiles(name, root)) {
    const raw = readFileSync(join(dir, file), 'utf8');
    writeFileSync(join(dir, file), raw.replace(/("version"\s*:\s*")[^"]+(")/, `$1${next}$2`));
    changed.push(`plugins/${name}/${file}`);
  }

  const readmePath = join(root, 'README.md');
  const readme = readFileSync(readmePath, 'utf8');
  if (readmeRow(name).test(readme)) {
    writeFileSync(readmePath, readme.replace(readmeRow(name), `$1${next}$3`));
    changed.push('README.md');
  }

  releases[name] = { version: next, runtimeHash: runtimeHash(name, root) };
  writeReleases(releases, root);
  changed.push('releases.json');

  return { current, next, changed };
}

function writeReleases(releases, root) {
  const sorted = Object.fromEntries(Object.keys(releases).sort().map((k) => [k, releases[k]]));
  writeFileSync(releasesPath(root), JSON.stringify(sorted, null, 2) + '\n');
}

// 직접 실행했을 때만 동작한다 (테스트에서 import 할 때는 실행하지 않음)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [name, kind = 'patch'] = process.argv.slice(2);
  if (!name) {
    console.error('사용: node tools/bump.mjs <플러그인> [patch|minor|major]');
    process.exit(1);
  }
  try {
    const { current, next, changed } = bump(name, kind);
    console.log(`${name}: ${current} → ${next}`);
    for (const f of changed) console.log(`  바꿈: ${f}`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
