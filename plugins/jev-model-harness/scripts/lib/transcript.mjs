// 대화 기록(JSONL)의 끝부분에서 캐시 수명(R6)과 직전 답변을 읽는다.
// 공식 문서에 없는 형식이라 읽기에 실패하면 기본값(5분)으로 대체한다. (SPEC 8.1)
import { open } from 'node:fs/promises';

const TAIL_BYTES = 512 * 1024;
const DEFAULT_TTL_SEC = 300;

export async function readTail(path, bytes = TAIL_BYTES) {
  if (!path) return '';
  const fh = await open(path, 'r');
  try {
    const { size } = await fh.stat();
    const start = Math.max(0, size - bytes);
    const buf = Buffer.alloc(size - start);
    await fh.read(buf, 0, buf.length, start);
    return buf.toString('utf8');
  } finally {
    await fh.close();
  }
}

// Claude Code 형식만 읽는다. Codex 기록은 형식이 공개되지 않아 기본값으로 대체된다.
export function parseTranscriptTail(text) {
  let ttlSec = null;
  let lastAssistantText = null;
  let model = null;
  const lines = (text ?? '').split('\n');

  // 뒤에서부터 읽는다. 잘린 첫 줄은 JSON 파싱에 실패해서 건너뛴다.
  for (let i = lines.length - 1; i >= 0 && (ttlSec === null || lastAssistantText === null || model === null); i--) {
    let entry;
    try {
      entry = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    if (entry?.type !== 'assistant' || entry.isSidechain || !entry.message) continue;

    // "<synthetic>" 같은 내부 메시지는 모델 이름이 아니다
    const m = entry.message.model;
    if (model === null && typeof m === 'string' && !m.startsWith('<')) model = m;

    const cc = entry.message.usage?.cache_creation;
    if (ttlSec === null && cc) {
      if (cc.ephemeral_1h_input_tokens > 0) ttlSec = 3600;
      else if (cc.ephemeral_5m_input_tokens > 0) ttlSec = 300;
    }

    if (lastAssistantText === null && Array.isArray(entry.message.content)) {
      const t = entry.message.content
        .filter((b) => b?.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      if (t) lastAssistantText = t;
    }
  }

  return {
    ttlSec: ttlSec ?? DEFAULT_TTL_SEC,
    ttlSource: ttlSec === null ? 'default' : 'transcript',
    lastAssistantText,
    model,
  };
}

export async function readTranscriptInfo(path) {
  try {
    return parseTranscriptTail(await readTail(path));
  } catch {
    return { ttlSec: DEFAULT_TTL_SEC, ttlSource: 'default', lastAssistantText: null, model: null };
  }
}
