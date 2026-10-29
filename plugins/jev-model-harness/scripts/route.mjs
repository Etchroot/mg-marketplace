#!/usr/bin/env node
// UserPromptSubmit 훅: Jev로 요청을 판단해서 메인 모델에게 위임 지시를 넣는다. (SPEC 3장, 11장)
// Claude Code와 Codex에서 같은 스크립트를 쓴다. 플랫폼별 차이는 lib/platforms.mjs 에 있다.
// 어떤 오류가 나도 입력을 막지 않는다(R9). 출력이 없으면 메인이 그대로 처리한다.
import { decide, decideManual, parseManual, stripManual, shouldReuse, TOP_LEVEL } from './lib/decide.mjs';
import { askJev, buildRequest } from './lib/jev.mjs';
import { readTranscriptInfo } from './lib/transcript.mjs';
import { loadState, saveState, appendLog } from './lib/store.mjs';
import { buildInstruction, modeNote, envWarning, mainModelWarning } from './lib/instruction.mjs';
import { PLATFORMS, detectPlatform, resolveTarget } from './lib/platforms.mjs';

// 로컬 개발용: 플러그인 폴더의 .env (커밋되지 않음). 이미 설정된 환경변수가 우선한다.
try {
  process.loadEnvFile(new URL('../.env', import.meta.url));
} catch {}

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  const startedMs = Date.now();
  const input = JSON.parse((await readStdin()) || '{}');
  const prompt = String(input.prompt ?? '');
  const sessionId = input.session_id;

  const platformId = detectPlatform(input);
  const platform = PLATFORMS[platformId];
  const state = await loadState(sessionId);
  const notes = [];
  const log = {
    ts: new Date(startedMs).toISOString(),
    platform: platformId,
    session_id: sessionId,
    prompt_excerpt: prompt.slice(0, 200),
  };

  const subagentModelEnv = process.env.CLAUDE_CODE_SUBAGENT_MODEL;
  if (platformId === 'claude-code' && subagentModelEnv && !state.warnedEnv) {
    notes.push(envWarning(subagentModelEnv));
    state.warnedEnv = true;
  }

  const transcript = await readTranscriptInfo(input.transcript_path);
  log.ttl = { sec: transcript.ttlSec, source: transcript.ttlSource };

  // Codex는 입력에 현재 모델이 있고, Claude Code는 대화 기록에서 읽는다 (첫 입력 때는 아직 없음)
  const mainModel = input.model ?? transcript.model;
  log.main_model = mainModel ?? null;
  // 메인 모델의 단계. 모르면(첫 입력 등) 최고 단계로 보고 올리지 않는다
  const mainLevel = (mainModel ? platform.modelLevel(mainModel) : null) ?? TOP_LEVEL;
  log.main_level = mainLevel;
  if (mainModel && platform.mainModel && !platform.mainModel.pattern.test(mainModel) && !state.warnedModel) {
    notes.push(mainModelWarning(mainModel, platform.mainModel.name));
    state.warnedModel = true;
  }

  const command = parseManual(prompt);
  if (command) {
    state.mode = command;
    notes.push(modeNote(command));
  }
  const request = command ? stripManual(prompt) : prompt;

  let decision;
  if (!request || request.startsWith('/')) {
    decision = { tier: 'main', rule: 'skip' };
  } else if (state.mode !== 'auto') {
    decision = decideManual(state.mode, mainLevel);
  } else {
    const apiKey = process.env.CLAUDE_PLUGIN_OPTION_TYPESAFE_API_KEY || process.env.TYPESAFE_API_KEY;
    if (!apiKey) {
      decision = { tier: 'main', rule: 'R9', error: 'no_api_key' };
    } else {
      const t0 = Date.now();
      try {
        const body = buildRequest(request, transcript.lastAssistantText, platform.environment);
        const res = await askJev(body, { apiKey });
        log.jev = { model: res.model, ms: Date.now() - t0, usage: res.usage, answers: res.answers };
        decision = decide(res.answers, mainLevel);
      } catch (e) {
        log.jev = { ms: Date.now() - t0 };
        decision = { tier: 'main', rule: 'R9', error: String(e?.message ?? e) };
      }
    }
  }
  decision.target = resolveTarget(platformId, decision.tier);

  let reuse = false;
  if (decision.target !== 'main') {
    reuse = platform.canResume && shouldReuse(state.lastUsed[decision.target], startedMs, transcript.ttlSec);
    state.lastUsed[decision.target] = startedMs;
  }

  const instruction = buildInstruction({
    platform: platformId,
    target: decision.target,
    reuse,
    manual: decision.rule === 'R7',
    escalate: decision.rule === 'R10',
  });
  const context = [...notes, instruction].filter(Boolean).join('\n');
  if (context) {
    process.stdout.write(
      JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: context } }),
    );
  }

  Object.assign(log, { mode: state.mode, decision, reuse, total_ms: Date.now() - startedMs });
  await saveState(sessionId, state);
  await appendLog(log);
}

main().catch(async (e) => {
  try {
    await appendLog({ ts: new Date().toISOString(), fatal: String(e?.stack ?? e) });
  } catch {}
});
