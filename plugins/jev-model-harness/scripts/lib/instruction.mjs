// 메인 모델에게 넣을 위임 지시문. 매 턴 대화에 쌓이므로 짧게 유지한다.
// 메인이 직접 처리할 때는 아무것도 넣지 않는다.

const SELF_CONTAINED =
  'It cannot see this conversation, so give it a self-contained task: the goal, relevant file paths, and constraints.';
// R10: 맥락이 필요한 요청도 올려 보내므로, 메인이 대화에서 필요한 내용을 옮겨 적게 한다
const CARRY_CONTEXT =
  'This request needs a stronger model than you: include the decisions and context from this conversation that it needs.';
const RELAY = 'Relay its result concisely. Handle the request yourself only if delegating is clearly unsuitable.';

export function buildInstruction({ platform = 'claude-code', target, reuse, manual, escalate }) {
  if (target === 'main') return null;
  const forced = manual ? ' (the user forced this route)' : '';

  // Codex: 서브에이전트를 부르는 도구 이름이 문서에 없어서 자연어로 지시한다
  if (platform === 'codex') {
    return [`[jev-model-harness] Have the \`${target}\` subagent handle this request${forced}.`, SELF_CONTAINED, RELAY].join(' ');
  }

  const agent = `jev-model-harness:${target}`;
  return [
    `[jev-model-harness] Delegate this request to the \`${agent}\` subagent${forced}.`,
    reuse
      ? `A ${agent} agent from earlier in this session may still have a warm cache: if you have its agent ID, continue it with SendMessage instead of starting a new one.`
      : `Start it with the Agent tool (subagent_type: "${agent}").`,
    SELF_CONTAINED,
    escalate && CARRY_CONTEXT,
    RELAY,
  ]
    .filter(Boolean)
    .join(' ');
}

export function modeNote(mode) {
  return `[jev-model-harness] Routing mode is now "${mode}". The leading "!${mode}" is a router command, not part of the request; if nothing else was asked, just confirm the mode in one line.`;
}

export function envWarning(value) {
  return `[jev-model-harness] Warning: CLAUDE_CODE_SUBAGENT_MODEL=${value} is set, so worker model settings may be overridden. Mention this to the user once.`;
}

export function mainModelWarning(actual, expected) {
  return `[jev-model-harness] Warning: the main model is "${actual}", but this router is designed for ${expected} as the main model. Mention this to the user once.`;
}
