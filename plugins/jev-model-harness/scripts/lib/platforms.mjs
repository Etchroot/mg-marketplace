// 플랫폼별로 다른 것만 모아 둔다: 단계(tier)별 워커, 권장 메인 모델, Jev에 알려줄 작업 환경. (SPEC 11장)
// 워커가 없는 단계는 메인이 처리한다.

export const PLATFORMS = {
  'claude-code': {
    label: 'Claude Code',
    workers: { light: 'haiku-worker', mid: 'sonnet-worker' },
    mainModel: { pattern: /opus/i, name: 'Opus' },
    environment: 'The user is chatting in a Claude Code session opened in their project folder.',
    canResume: true, // SendMessage 로 서브에이전트를 이어 쓸 수 있다 (R6)
  },
  codex: {
    label: 'Codex',
    // 메인 6.1 Sol과 Sol 워커는 가격이 같아서 mid 워커를 두지 않는다. mid는 메인이 처리한다.
    workers: { light: 'luna_worker' },
    mainModel: { pattern: /^gpt-6\.1-sol/i, name: 'gpt-6.1-sol' },
    environment: 'The user is chatting in a Codex session opened in their project folder.',
    canResume: false, // 서브에이전트를 이어 쓰는 방법이 문서에 없다
  },
};

// Codex의 UserPromptSubmit 입력에는 turn_id 가 있다. MODEL_ROUTER_PLATFORM 으로 강제할 수 있다.
export function detectPlatform(input, env = process.env) {
  const forced = env.MODEL_ROUTER_PLATFORM;
  if (forced && PLATFORMS[forced]) return forced;
  return input?.turn_id !== undefined ? 'codex' : 'claude-code';
}

export function resolveTarget(platformId, tier) {
  return PLATFORMS[platformId]?.workers[tier] ?? 'main';
}
