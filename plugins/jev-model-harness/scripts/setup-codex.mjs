#!/usr/bin/env node
// Codex 플러그인은 서브에이전트를 포함할 수 없어서, codex/agents/*.toml 을 ~/.codex/agents/ 에 복사한다.
// 내용이 다른 같은 이름의 파일이 이미 있으면 덮어쓰지 않는다 (--force 로 덮어쓰기).
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../codex/agents/', import.meta.url));
const dest = join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'agents');
const force = process.argv.includes('--force');

await mkdir(dest, { recursive: true });
for (const file of (await readdir(src)).filter((f) => f.endsWith('.toml'))) {
  const content = await readFile(join(src, file), 'utf8');
  const target = join(dest, file);
  const existing = await readFile(target, 'utf8').catch(() => null);

  if (existing === content) {
    console.log(`그대로 둠 (이미 같음): ${target}`);
  } else if (existing !== null && !force) {
    console.log(`건너뜀 (내용이 다른 파일이 있음, 덮어쓰려면 --force): ${target}`);
  } else {
    await writeFile(target, content);
    console.log(`${existing === null ? '설치' : '덮어씀'}: ${target}`);
  }
}
