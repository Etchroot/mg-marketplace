import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, decideManual, parseManual, stripManual, shouldReuse } from '../scripts/lib/decide.mjs';

const answers = ({ s = 0.9, b = 0.9, score = 0, conf = 0.9 } = {}) => ({
  standalone: { type: 'noul', noul: s },
  bulk: { type: 'noul', noul: b },
  level: { type: 'score', score, confidence: conf, probabilities: {} },
});

test('R2: 맥락이 필요하면(standalone < 0.8) 메인', () => {
  assert.deepEqual(decide(answers({ s: 0.79 })), { tier: 'main', rule: 'R2' });
});

test('R2가 R3보다 먼저 적용된다', () => {
  assert.equal(decide(answers({ s: 0.1, b: 0.1 })).rule, 'R2');
});

test('R3: 분량이 작으면(bulk < 0.8) 메인', () => {
  assert.deepEqual(decide(answers({ b: 0.5 })), { tier: 'main', rule: 'R3' });
});

test('R4: level 신뢰도가 낮으면 메인', () => {
  assert.deepEqual(decide(answers({ conf: 0.49 })), { tier: 'main', rule: 'R4' });
});

test('R5: 반올림한 level로 단계 선택', () => {
  assert.equal(decide(answers({ score: 0.4 })).tier, 'light');
  assert.equal(decide(answers({ score: 0.5 })).tier, 'mid');
  assert.equal(decide(answers({ score: 1.4 })).tier, 'mid');
  assert.equal(decide(answers({ score: 1.5 })).tier, 'main');
  assert.equal(decide(answers({ score: 2 })).tier, 'main');
});

test('경계값 0.8은 yes로 본다', () => {
  assert.equal(decide(answers({ s: 0.8, b: 0.8 })).rule, 'R5');
});

test('응답이 비었거나 이상하면 메인', () => {
  assert.equal(decide(undefined).tier, 'main');
  assert.equal(decide({}).tier, 'main');
  assert.equal(decide({ standalone: { noul: 0.9 }, bulk: { noul: 0.9 } }).rule, 'R4');
  assert.equal(decide(answers({ s: NaN })).tier, 'main');
});

test('R7: 수동 명령 파싱 (Claude Code / Codex 이름 모두)', () => {
  assert.equal(parseManual('!opus 이거 설계해줘'), 'opus');
  assert.equal(parseManual('  !HAIKU'), 'haiku');
  assert.equal(parseManual('!luna 파일 찾아줘'), 'luna');
  assert.equal(parseManual('!sol'), 'sol');
  assert.equal(parseManual('!auto'), 'auto');
  assert.equal(parseManual('이건 !opus 아님'), null);
  assert.equal(parseManual('!opusx'), null);
  assert.equal(stripManual('!sonnet  버그 고쳐줘'), '버그 고쳐줘');
  assert.equal(decideManual('opus').tier, 'main');
  assert.equal(decideManual('sol').tier, 'main');
  assert.equal(decideManual('sonnet').tier, 'mid');
  assert.equal(decideManual('haiku').tier, 'light');
  assert.equal(decideManual('luna').tier, 'light');
});

test('R6: 캐시 수명 안이면 재사용', () => {
  const now = 1_000_000;
  assert.equal(shouldReuse(now - 299_000, now, 300), true);
  assert.equal(shouldReuse(now - 300_000, now, 300), false);
  assert.equal(shouldReuse(now - 3_000_000, now, 3600), true);
  assert.equal(shouldReuse(undefined, now, 3600), false);
});

test('R5: 메인보다 낮은 단계만 내려보낸다', () => {
  // Sonnet 메인(1): 조회는 haiku로, 구현은 메인이
  assert.equal(decide(answers({ score: 0 }), 1).tier, 'light');
  assert.equal(decide(answers({ score: 1 }), 1).tier, 'main');
  // Haiku 메인(0): 조회도 메인이
  assert.equal(decide(answers({ score: 0 }), 0).tier, 'main');
});

test('R10: 메인보다 높은 단계는 맥락·분량과 상관없이 올린다', () => {
  assert.deepEqual(decide(answers({ s: 0.1, b: 0.1, score: 2 }), 0), { tier: 'high', rule: 'R10', level: 2 });
  assert.deepEqual(decide(answers({ s: 0.1, b: 0.1, score: 1 }), 0), { tier: 'mid', rule: 'R10', level: 1 });
  assert.equal(decide(answers({ s: 0.1, score: 2 }), 1).tier, 'high');
  // 신뢰도가 낮으면 올리지 않는다
  assert.equal(decide(answers({ s: 0.1, score: 2, conf: 0.49 }), 0).rule, 'R2');
  // Opus 메인(기본값)에서는 걸리지 않는다
  assert.equal(decide(answers({ s: 0.1, score: 2 })).rule, 'R2');
});

test('R7: 수동 지정 단계가 메인과 같으면 메인, 다르면 워커', () => {
  assert.equal(decideManual('opus', 0).tier, 'high');
  assert.equal(decideManual('opus', 2).tier, 'main');
  assert.equal(decideManual('sonnet', 1).tier, 'main');
  assert.equal(decideManual('haiku', 1).tier, 'light');
  assert.equal(decideManual('auto', 0).tier, 'main');
});
