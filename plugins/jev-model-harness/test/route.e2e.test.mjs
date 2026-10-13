// 훅 스크립트를 실제 프로세스로 실행하고, Jev 대신 로컬 가짜 서버를 붙여서 끝까지 확인한다.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROUTE = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'route.mjs');

let server;
let baseUrl;
let nextAnswers;
let lastRequest;

before(async () => {
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      lastRequest = { url: req.url, auth: req.headers.authorization, body: JSON.parse(body) };
      if (nextAnswers === 'error') {
        res.writeHead(529).end('{"error":"overloaded"}');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ model: 'jev-test', answers: nextAnswers, usage: { input_tokens: 100, output_tokens: 3 } }));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

async function runHook(payload, env = {}) {
  const child = spawn(process.execPath, [ROUTE], {
    env: { ...process.env, CLAUDE_CODE_SUBAGENT_MODEL: '', TYPESAFE_BASE_URL: baseUrl, ...env },
  });
  let out = '';
  child.stdout.on('data', (c) => (out += c));
  child.stdin.end(JSON.stringify(payload));
  const code = await new Promise((r) => child.on('close', r));
  return { code, out, context: out ? JSON.parse(out).hookSpecificOutput.additionalContext : null };
}

const delegate = { standalone: { noul: 0.95 }, bulk: { noul: 0.9 }, level: { score: 0.2, confidence: 0.9 } };

test('위임 판단 → 지시 주입, 같은 워커 재호출 시 재사용 안내, 로그 기록', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'mr-'));
  const transcript = join(dataDir, 't.jsonl');
  await writeFile(
    transcript,
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: '다음 단계로 갈까요?' }], usage: { cache_creation: { ephemeral_1h_input_tokens: 10 } } } }),
  );
  const env = { CLAUDE_PLUGIN_DATA: dataDir, TYPESAFE_API_KEY: 'test-key' };
  const payload = { session_id: 's1', transcript_path: transcript, prompt: '이 프로젝트에서 lotto 들어간 파일 전부 찾아줘' };

  nextAnswers = delegate;
  const first = await runHook(payload, env);
  assert.equal(first.code, 0);
  assert.match(first.context, /jev-model-harness:haiku-worker/);
  assert.match(first.context, /Agent tool/);
  assert.equal(lastRequest.url, '/v1/systemone');
  assert.equal(lastRequest.auth, 'Bearer test-key');
  assert.equal(lastRequest.body.model, 'jev-latest');
  assert.equal(lastRequest.body.state.previous_assistant_message_tail, '다음 단계로 갈까요?');
  assert.deepEqual(Object.keys(lastRequest.body.questions), ['standalone', 'bulk', 'level']);

  const second = await runHook(payload, env);
  assert.match(second.context, /SendMessage/);

  const logs = (await readFile(join(dataDir, 'route-log.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(logs.length, 2);
  assert.equal(logs[0].decision.rule, 'R5');
  assert.equal(logs[0].ttl.sec, 3600);
  assert.equal(logs[1].reuse, true);
});

test('메인이 처리할 때는 아무것도 주입하지 않는다', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'mr-'));
  nextAnswers = { ...delegate, standalone: { noul: 0.3 } };
  const r = await runHook({ session_id: 's2', prompt: '응 그렇게 해줘' }, { CLAUDE_PLUGIN_DATA: dataDir, TYPESAFE_API_KEY: 'k' });
  assert.equal(r.code, 0);
  assert.equal(r.out, '');
});

test('R9: Jev 오류나 키 없음이면 조용히 메인으로', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'mr-'));
  nextAnswers = 'error';
  const r1 = await runHook({ session_id: 's3', prompt: '파일 다 찾아줘' }, { CLAUDE_PLUGIN_DATA: dataDir, TYPESAFE_API_KEY: 'k' });
  assert.equal(r1.code, 0);
  assert.equal(r1.out, '');

  const r2 = await runHook(
    { session_id: 's3', prompt: '파일 다 찾아줘' },
    { CLAUDE_PLUGIN_DATA: dataDir, TYPESAFE_API_KEY: '', CLAUDE_PLUGIN_OPTION_TYPESAFE_API_KEY: '' },
  );
  assert.equal(r2.out, '');

  const logs = (await readFile(join(dataDir, 'route-log.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
  assert.match(logs[0].decision.error, /529/);
  assert.equal(logs[1].decision.error, 'no_api_key');
});

test('R7: 수동 모드는 Jev 없이 유지되고 !auto로 돌아온다', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'mr-'));
  const env = { CLAUDE_PLUGIN_DATA: dataDir, TYPESAFE_API_KEY: 'k' };
  lastRequest = null;

  const set = await runHook({ session_id: 's4', prompt: '!sonnet' }, env);
  assert.match(set.context, /Routing mode is now "sonnet"/);
  assert.equal(lastRequest, null);

  const next = await runHook({ session_id: 's4', prompt: '버튼 색 바꿔줘' }, env);
  assert.match(next.context, /jev-model-harness:sonnet-worker/);
  assert.match(next.context, /user forced/);
  assert.equal(lastRequest, null);

  nextAnswers = { ...delegate, bulk: { noul: 0.1 } };
  const back = await runHook({ session_id: 's4', prompt: '!auto 이 용어 뜻이 뭐야?' }, env);
  assert.match(back.context, /Routing mode is now "auto"/);
  assert.doesNotMatch(back.context, /Delegate/);
  assert.equal(lastRequest.body.state.user_message, '이 용어 뜻이 뭐야?');
});

test('Codex: 조회는 luna_worker, 구현(mid)은 메인, 권장 모델이 아니면 한 번 경고', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'mr-'));
  const env = { CLAUDE_PLUGIN_DATA: dataDir, TYPESAFE_API_KEY: 'k' };
  const codex = (prompt, model = 'gpt-6.1-sol') => ({ session_id: 'c1', turn_id: 't', model, transcript_path: null, prompt });

  nextAnswers = delegate;
  const light = await runHook(codex('TODO 주석 달린 곳 찾아줘'), env);
  assert.match(light.context, /Have the `luna_worker` subagent/);
  assert.doesNotMatch(light.context, /Warning/);
  assert.match(lastRequest.body.state.environment, /Codex/);

  nextAnswers = { ...delegate, level: { score: 1, confidence: 0.95 } };
  const mid = await runHook(codex('버튼 추가해줘'), env);
  assert.equal(mid.out, '');

  nextAnswers = delegate;
  const warn = await runHook({ ...codex('파일 찾아줘', 'gpt-6-astra'), session_id: 'c2' }, env);
  assert.match(warn.context, /main model is "gpt-6-astra".*gpt-6\.1-sol/);
  const again = await runHook({ ...codex('파일 찾아줘', 'gpt-6-astra'), session_id: 'c2' }, env);
  assert.doesNotMatch(again.context, /Warning/);

  const logs = (await readFile(join(dataDir, 'route-log.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(logs[0].platform, 'codex');
  assert.deepEqual([logs[0].decision.tier, logs[0].decision.target], ['light', 'luna_worker']);
  assert.deepEqual([logs[1].decision.tier, logs[1].decision.target], ['mid', 'main']);
  assert.equal(logs[2].main_model, 'gpt-6-astra');
});

test('Claude Code: 대화 기록의 메인 모델이 Opus가 아니면 경고', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'mr-'));
  const transcript = join(dataDir, 't.jsonl');
  await writeFile(transcript, JSON.stringify({ type: 'assistant', message: { model: 'claude-sonnet-5-5', content: [] } }));
  const r = await runHook({ session_id: 's6', transcript_path: transcript, prompt: '!auto' }, { CLAUDE_PLUGIN_DATA: dataDir });
  assert.match(r.context, /main model is "claude-sonnet-5-5".*Opus/);
});

test('CLAUDE_CODE_SUBAGENT_MODEL 경고는 세션당 한 번', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'mr-'));
  const env = { CLAUDE_PLUGIN_DATA: dataDir, TYPESAFE_API_KEY: '', CLAUDE_CODE_SUBAGENT_MODEL: 'sonnet' };
  const a = await runHook({ session_id: 's5', prompt: 'hi' }, env);
  assert.match(a.context, /CLAUDE_CODE_SUBAGENT_MODEL=sonnet/);
  const b = await runHook({ session_id: 's5', prompt: 'hi' }, env);
  assert.equal(b.out, '');
});
