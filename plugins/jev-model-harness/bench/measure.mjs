// 실제 Jev로 예시 요청들을 판단해서, 기대한 라우팅과 비교하고 응답 시간을 잰다.
// 실행: node bench/measure.mjs [tuning|holdout]   (키는 .env 또는 환경변수 TYPESAFE_API_KEY)
// MODEL_ROUTER_PLATFORM=codex 로 Jev에 알려주는 작업 환경을 바꿀 수 있다. 비교는 단계(tier)로 한다.
import { writeFile } from 'node:fs/promises';
import { askJev, buildRequest } from '../scripts/lib/jev.mjs';
import { decide } from '../scripts/lib/decide.mjs';
import { PLATFORMS } from '../scripts/lib/platforms.mjs';
import { tuning, holdout } from './cases.mjs';

try {
  process.loadEnvFile(new URL('../.env', import.meta.url));
} catch {}

const apiKey = process.env.TYPESAFE_API_KEY;
if (!apiKey) {
  console.error('TYPESAFE_API_KEY 가 없습니다 (.env 확인)');
  process.exit(1);
}

const SET = process.argv[2] === 'holdout' ? 'holdout' : 'tuning';
const CASES = SET === 'holdout' ? holdout : tuning;
const PLATFORM = PLATFORMS[process.env.MODEL_ROUTER_PLATFORM] ? process.env.MODEL_ROUTER_PLATFORM : 'claude-code';
console.log(`세트: ${SET} (${CASES.length}개), 플랫폼: ${PLATFORM}\n`);

const f2 = (x) => (typeof x === 'number' ? x.toFixed(2) : '-');
const rows = [];
let inputTokens = 0;

for (const c of CASES) {
  const t0 = performance.now();
  let res;
  let error;
  try {
    const body = buildRequest(c.prompt, c.previous, PLATFORMS[PLATFORM].environment);
    res = await askJev(body, { apiKey, timeoutMs: 15000 });
  } catch (e) {
    error = String(e?.message ?? e);
  }
  const ms = Math.round(performance.now() - t0);
  const a = res?.answers ?? {};
  const d = error ? { tier: 'main', rule: 'R9' } : decide(a);
  inputTokens += res?.usage?.input_tokens ?? 0;
  rows.push({ ...c, ms, error, answers: a, decision: d, ok: c.expect.includes(d.tier) });
}

console.log('ok | ms   | standalone | bulk | level(score/conf) | 결정 (규칙)            | 요청');
console.log('---|------|------------|------|-------------------|------------------------|-----');
for (const r of rows) {
  const lv = r.answers.level;
  console.log(
    [
      r.ok ? '✅' : '❌',
      String(r.ms).padStart(4),
      f2(r.answers.standalone?.noul).padStart(10),
      f2(r.answers.bulk?.noul).padStart(4),
      `${f2(lv?.score)} / ${f2(lv?.confidence)}`.padEnd(17),
      `${r.decision.tier} (${r.decision.rule})`.padEnd(22),
      r.prompt.slice(0, 40) + (r.error ? `  [오류: ${r.error}]` : ''),
    ].join(' | '),
  );
}

const ms = rows.filter((r) => !r.error).map((r) => r.ms).sort((x, y) => x - y);
const pct = (p) => ms[Math.min(ms.length - 1, Math.floor((p / 100) * ms.length))];
console.log(`\n일치 ${rows.filter((r) => r.ok).length}/${rows.length}`);
if (ms.length) console.log(`응답시간 중앙값 ${pct(50)}ms, p90 ${pct(90)}ms, 최대 ${ms.at(-1)}ms`);
console.log(`Jev 입력 토큰 합계 ${inputTokens} (≈ $${((inputTokens * 0.042) / 1e6).toFixed(6)})`);

await writeFile(new URL('./last-run.json', import.meta.url), JSON.stringify({ set: SET, platform: PLATFORM, rows }, null, 2));
