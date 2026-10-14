#!/usr/bin/env node
// 버전 올리기: 매니페스트 3개 + package.json + 마켓플레이스 README 버전 표 + release.json(실행 파일 지문)
// 사용: npm run bump               → 0.2.1 → 0.2.2 (patch, 기본값)
//       npm run bump -- minor      → 0.2.1 → 0.3.0
//       npm run bump -- major      → 0.2.1 → 1.0.0
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, VERSION_FILES, runtimeHash } from './runtime-hash.mjs';

export function nextVersion(current, kind) {
  const [major, minor, patch] = current.split('.').map(Number);
  if (kind === 'major') return `${major + 1}.0.0`;
  if (kind === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

export async function bump(kind = 'patch', root = ROOT) {
  if (!['patch', 'minor', 'major'].includes(kind)) {
    throw new Error(`알 수 없는 종류: ${kind} (patch / minor / major)`);
  }
  const current = JSON.parse(await readFile(join(root, 'plugin.json'), 'utf8')).version;
  const next = nextVersion(current, kind);

  // 들여쓰기 등 파일 모양은 그대로 두고 첫 "version" 값만 바꾼다
  for (const file of VERSION_FILES) {
    const raw = await readFile(join(root, file), 'utf8');
    const updated = raw.replace(/("version"\s*:\s*")[^"]+(")/, `$1${next}$2`);
    if (updated === raw) throw new Error(`${file} 에서 version 을 찾지 못했습니다`);
    await writeFile(join(root, file), updated);
  }

  // 마켓플레이스 루트 README의 플러그인 표 (마켓플레이스 밖에서 실행하면 건너뛴다)
  const readmePath = join(root, '..', '..', 'README.md');
  const readme = await readFile(readmePath, 'utf8').catch(() => null);
  const row = /(\| \[jev-model-harness\]\([^)]*\) \| )[^ |]+( \|)/;
  let readmeUpdated = false;
  if (readme && row.test(readme)) {
    await writeFile(readmePath, readme.replace(row, `$1${next}$2`));
    readmeUpdated = true;
  }

  const release = { version: next, runtimeHash: await runtimeHash(root) };
  await writeFile(join(root, 'release.json'), JSON.stringify(release, null, 2) + '\n');
  return { current, next, readmeUpdated };
}

// 직접 실행했을 때만 동작한다 (테스트에서 import 할 때는 실행하지 않음)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { current, next, readmeUpdated } = await bump(process.argv[2] ?? 'patch');
  console.log(`버전: ${current} → ${next}`);
  console.log(`바꾼 파일: ${VERSION_FILES.join(', ')}, release.json`);
  console.log(readmeUpdated ? '마켓플레이스 README 버전 표도 바꿨습니다.' : '마켓플레이스 README 버전 표를 찾지 못해 건너뛰었습니다.');
}
