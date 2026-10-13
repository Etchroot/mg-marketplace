// 세션별 상태(수동 모드, 워커 마지막 사용 시각)와 판단 로그(R8) 저장.
// 플러그인 업데이트에도 유지되는 CLAUDE_PLUGIN_DATA 를 쓴다.
import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function dataDir() {
  return process.env.CLAUDE_PLUGIN_DATA || join(homedir(), '.claude', 'jev-model-harness-data');
}

const safeId = (id) => String(id || 'unknown').replace(/[^\w-]/g, '_');
const statePath = (sessionId) => join(dataDir(), 'state', `${safeId(sessionId)}.json`);

export function emptyState() {
  return { mode: 'auto', lastUsed: {}, warnedEnv: false, warnedModel: false };
}

export async function loadState(sessionId) {
  try {
    return { ...emptyState(), ...JSON.parse(await readFile(statePath(sessionId), 'utf8')) };
  } catch {
    return emptyState();
  }
}

export async function saveState(sessionId, state) {
  await mkdir(join(dataDir(), 'state'), { recursive: true });
  await writeFile(statePath(sessionId), JSON.stringify(state));
}

export async function appendLog(entry) {
  await mkdir(dataDir(), { recursive: true });
  await appendFile(join(dataDir(), 'route-log.jsonl'), JSON.stringify(entry) + '\n');
}
