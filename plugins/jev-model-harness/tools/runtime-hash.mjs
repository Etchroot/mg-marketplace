// 설치한 사람의 동작에 영향을 주는 파일들(실행 파일)의 지문을 계산한다.
// 문서(README, SPEC)·테스트·측정·개발 도구는 포함하지 않는다. 매니페스트의 version 값도 뺀다.
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const RUNTIME_DIRS = ['hooks', 'scripts', 'agents', 'codex'];
export const MANIFESTS = ['plugin.json', '.claude-plugin/plugin.json', '.codex-plugin/plugin.json'];
export const VERSION_FILES = [...MANIFESTS, 'package.json'];

async function listFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listFiles(p)));
    else out.push(p);
  }
  return out;
}

export async function runtimeHash(root = ROOT) {
  const hash = createHash('sha256');
  const files = [];
  for (const d of RUNTIME_DIRS) files.push(...(await listFiles(join(root, d))));

  for (const file of files.map((f) => relative(root, f).replace(/\\/g, '/')).sort()) {
    // Windows(CRLF)와 macOS/Linux(LF)에서 같은 지문이 나오도록 줄바꿈을 맞춘다
    const text = (await readFile(join(root, file), 'utf8')).replace(/\r\n/g, '\n');
    hash.update(`${file}\0${text}\0`);
  }
  for (const m of MANIFESTS) {
    const json = JSON.parse(await readFile(join(root, m), 'utf8'));
    delete json.version;
    hash.update(`${m}\0${JSON.stringify(json)}\0`);
  }
  return hash.digest('hex');
}
