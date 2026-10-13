import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTranscriptTail } from '../scripts/lib/transcript.mjs';

const line = (o) => JSON.stringify(o);
const assistant = (content, cache_creation, extra = {}) =>
  line({ type: 'assistant', ...extra, message: { content, usage: { cache_creation } } });

test('1시간 캐시와 직전 답변 텍스트를 읽는다', () => {
  const text = [
    '{"broken": tru', // 잘린 첫 줄
    assistant([{ type: 'text', text: '예전 답변' }], { ephemeral_1h_input_tokens: 100, ephemeral_5m_input_tokens: 0 }),
    line({ type: 'user', message: { content: '질문' } }),
    assistant(
      [{ type: 'thinking', thinking: '' }, { type: 'text', text: '구현을 시작할까요?' }],
      { ephemeral_1h_input_tokens: 0, ephemeral_5m_input_tokens: 0 },
    ),
  ].join('\n');
  const r = parseTranscriptTail(text);
  assert.equal(r.lastAssistantText, '구현을 시작할까요?');
  assert.equal(r.ttlSec, 3600);
  assert.equal(r.ttlSource, 'transcript');
});

test('5분 캐시를 읽는다', () => {
  const r = parseTranscriptTail(assistant([{ type: 'text', text: 'x' }], { ephemeral_5m_input_tokens: 5 }));
  assert.equal(r.ttlSec, 300);
});

test('서브에이전트(sidechain) 기록은 건너뛴다', () => {
  const text = [
    assistant([{ type: 'text', text: '메인 답변' }], { ephemeral_1h_input_tokens: 1 }),
    assistant([{ type: 'text', text: '서브에이전트 답변' }], { ephemeral_5m_input_tokens: 1 }, { isSidechain: true }),
  ].join('\n');
  const r = parseTranscriptTail(text);
  assert.equal(r.lastAssistantText, '메인 답변');
  assert.equal(r.ttlSec, 3600);
});

test('정보가 없으면 기본 5분', () => {
  const r = parseTranscriptTail('');
  assert.deepEqual(r, { ttlSec: 300, ttlSource: 'default', lastAssistantText: null, model: null });
});

test('메인 모델 이름을 읽고, 내부 메시지와 서브에이전트 모델은 건너뛴다', () => {
  const entry = (model, extra = {}) =>
    line({ type: 'assistant', ...extra, message: { model, content: [{ type: 'text', text: 'x' }] } });
  const text = [
    entry('claude-opus-5-5'),
    entry('claude-haiku-5-5', { isSidechain: true }),
    entry('<synthetic>'),
  ].join('\n');
  assert.equal(parseTranscriptTail(text).model, 'claude-opus-5-5');
});
