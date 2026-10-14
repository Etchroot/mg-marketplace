#!/usr/bin/env node
// 마켓플레이스 전체 검사. 문제가 있으면 무엇을 하면 되는지와 함께 알려주고 실패 코드로 끝난다.
//  1) 플러그인마다 버전 파일들의 버전이 같은가
//  2) 실행 파일이 마지막 버전 이후 바뀌었는데 버전을 안 올리지 않았는가 (releases.json 지문 비교)
//  3) 두 카탈로그와 루트 README 표에 빠짐없이 등록돼 있고 이름·버전이 맞는가
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  CATALOGS, ROOT, listPlugins, pluginVersion, readJson, readReleases, readmeRow, runtimeHash, versionFiles,
} from './lib.mjs';

export function check(root = ROOT) {
  const problems = [];
  const plugins = listPlugins(root);
  const releases = readReleases(root);
  const readme = readFileSync(join(root, 'README.md'), 'utf8');
  const catalogs = CATALOGS.map((c) => [c, readJson(join(root, c)).plugins.map((p) => p.name)]);

  for (const name of plugins) {
    const dir = join(root, 'plugins', name);
    if (!existsSync(join(dir, 'plugin.json'))) {
      problems.push(`${name}: plugins/${name}/plugin.json 이 없습니다.`);
      continue;
    }
    const version = pluginVersion(name, root);

    for (const file of versionFiles(name, root)) {
      const json = readJson(join(dir, file));
      if (json.version !== version) {
        problems.push(`${name}: ${file} 의 버전(${json.version})이 plugin.json(${version})과 다릅니다. 버전은 직접 고치지 말고 node tools/bump.mjs ${name} 로 올리세요.`);
      }
      if (file !== 'package.json' && json.name !== name) {
        problems.push(`${name}: ${file} 의 name(${json.name})이 폴더 이름과 다릅니다.`);
      }
    }

    const release = releases[name];
    if (!release) {
      problems.push(`${name}: releases.json 에 기록이 없습니다. 새 플러그인이면 node tools/bump.mjs ${name} record 로 첫 기록을 남기세요.`);
    } else if (release.version !== version) {
      problems.push(`${name}: releases.json 버전(${release.version})과 plugin.json(${version})이 다릅니다. 버전은 node tools/bump.mjs ${name} 로만 올리세요.`);
    } else if (release.runtimeHash !== runtimeHash(name, root)) {
      problems.push(`${name}: 실행 파일이 ${version} 이후 바뀌었는데 버전이 그대로입니다. node tools/bump.mjs ${name} [patch|minor|major] 를 실행하세요.`);
    }

    for (const [catalog, names] of catalogs) {
      if (!names.includes(name)) problems.push(`${name}: ${catalog} 에 등록돼 있지 않습니다.`);
    }
    const row = readme.match(readmeRow(name));
    if (!row) problems.push(`${name}: 루트 README 플러그인 표에 없습니다.`);
    else if (row[2] !== version) problems.push(`${name}: 루트 README 표의 버전(${row[2]})이 ${version} 이 아닙니다.`);
  }

  for (const [catalog, names] of catalogs) {
    for (const n of names) if (!plugins.includes(n)) problems.push(`${catalog} 에 있는 ${n} 의 폴더(plugins/${n})가 없습니다.`);
  }
  for (const n of Object.keys(releases)) {
    if (!plugins.includes(n)) problems.push(`releases.json 에 없는 플러그인(${n})의 기록이 남아 있습니다.`);
  }
  return { plugins, problems };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { plugins, problems } = check();
  if (problems.length) {
    console.error(`검사 실패 (${problems.length}건)`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`검사 통과: 플러그인 ${plugins.length}개 (${plugins.join(', ')})`);
}
