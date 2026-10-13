// 라우팅 판단 로직 (SPEC 5장, 6장). 부수효과 없는 순수 함수만 둔다.
// 결과는 플랫폼과 무관한 단계(tier)로 낸다: light / mid / main. 실제 워커는 platforms.mjs 가 정한다.

export const THRESHOLDS = {
  noulYes: 0.8, // R2, R3: 이 값 이상일 때만 yes로 본다
  levelConfidence: 0.5, // R4
};

const TIER_BY_LEVEL = ['light', 'mid', 'main'];

// R7: 수동 명령. Claude Code와 Codex 모델 이름을 모두 받는다.
const MANUAL_TIERS = { opus: 'main', sol: 'main', sonnet: 'mid', haiku: 'light', luna: 'light' };
const MANUAL_RE = /^\s*!(opus|sonnet|haiku|sol|luna|auto)\b/i;

export function parseManual(prompt) {
  const m = MANUAL_RE.exec(prompt ?? '');
  return m ? m[1].toLowerCase() : null;
}

export function stripManual(prompt) {
  return (prompt ?? '').replace(MANUAL_RE, '').trim();
}

// R2 → R3 → R4 → R5 순서. 값이 없거나 이상하면 !(x >= t) 가 참이 되어 메인으로 간다.
export function decide(answers, t = THRESHOLDS) {
  const standalone = answers?.standalone?.noul;
  const bulk = answers?.bulk?.noul;
  const level = answers?.level;

  if (!(standalone >= t.noulYes)) return { tier: 'main', rule: 'R2' };
  if (!(bulk >= t.noulYes)) return { tier: 'main', rule: 'R3' };
  if (!(level?.confidence >= t.levelConfidence)) return { tier: 'main', rule: 'R4' };

  const lv = Math.round(level.score);
  return { tier: TIER_BY_LEVEL[lv] ?? 'main', rule: 'R5', level: lv };
}

export function decideManual(mode) {
  return { tier: MANUAL_TIERS[mode] ?? 'main', rule: 'R7' };
}

// R6: 마지막으로 같은 워커를 쓴 요청의 시작 시각에서 캐시 수명이 지나지 않았는가
export function shouldReuse(lastUsedMs, nowMs, ttlSec) {
  return typeof lastUsedMs === 'number' && nowMs - lastUsedMs < ttlSec * 1000;
}
