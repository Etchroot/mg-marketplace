// 라우팅 판단 로직 (SPEC 5장, 6장). 부수효과 없는 순수 함수만 둔다.
// 결과는 플랫폼과 무관한 단계(tier)로 낸다: light / mid / high / main. 실제 워커는 platforms.mjs 가 정한다.
// main은 "메인 모델이 그대로 처리"라는 뜻이다. 메인 모델이 몇 단계인지(mainLevel)는 호출하는 쪽이 넘긴다.

export const THRESHOLDS = {
  noulYes: 0.8, // R2, R3: 이 값 이상일 때만 yes로 본다
  levelConfidence: 0.5, // R4, R10
};

// 단계 0, 1, 2. 메인 모델도 같은 눈금으로 잰다 (Haiku 0, Sonnet 1, Opus 2)
export const TIERS = ['light', 'mid', 'high'];
export const TOP_LEVEL = TIERS.length - 1;

// R7: 수동 명령. Claude Code와 Codex 모델 이름을 모두 받는다.
const MANUAL_TIERS = { opus: 'high', sol: 'high', sonnet: 'mid', haiku: 'light', luna: 'light' };
const MANUAL_RE = /^\s*!(opus|sonnet|haiku|sol|luna|auto)\b/i;

export function parseManual(prompt) {
  const m = MANUAL_RE.exec(prompt ?? '');
  return m ? m[1].toLowerCase() : null;
}

export function stripManual(prompt) {
  return (prompt ?? '').replace(MANUAL_RE, '').trim();
}

// R10 → R2 → R3 → R4 → R5 순서. 값이 없거나 이상하면 !(x >= t) 가 참이 되어 메인으로 간다.
// mainLevel 기본값은 최고 단계(Opus)다. 이때 R10은 걸리지 않아 예전 동작과 같다.
export function decide(answers, mainLevel = TOP_LEVEL, t = THRESHOLDS) {
  const standalone = answers?.standalone?.noul;
  const bulk = answers?.bulk?.noul;
  const level = answers?.level;
  const confident = level?.confidence >= t.levelConfidence;
  const lv = Math.round(level?.score);

  // R10: 메인보다 높은 단계가 필요하면 맥락·분량과 상관없이 올린다. 품질을 지키는 쪽이라 R2, R3을 거치지 않는다
  if (confident && lv > mainLevel && TIERS[lv]) return { tier: TIERS[lv], rule: 'R10', level: lv };

  if (!(standalone >= t.noulYes)) return { tier: 'main', rule: 'R2' };
  if (!(bulk >= t.noulYes)) return { tier: 'main', rule: 'R3' };
  if (!confident) return { tier: 'main', rule: 'R4' };

  return { tier: lv < mainLevel && TIERS[lv] ? TIERS[lv] : 'main', rule: 'R5', level: lv };
}

// 지정한 단계가 메인 모델과 같으면 메인이 처리한다 (!opus 를 Opus 메인에서 쓰는 경우 등)
export function decideManual(mode, mainLevel = TOP_LEVEL) {
  const tier = MANUAL_TIERS[mode];
  return { tier: tier && TIERS.indexOf(tier) !== mainLevel ? tier : 'main', rule: 'R7' };
}

// R6: 마지막으로 같은 워커를 쓴 요청의 시작 시각에서 캐시 수명이 지나지 않았는가
export function shouldReuse(lastUsedMs, nowMs, ttlSec) {
  return typeof lastUsedMs === 'number' && nowMs - lastUsedMs < ttlSec * 1000;
}
