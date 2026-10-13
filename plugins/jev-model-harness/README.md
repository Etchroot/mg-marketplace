# jev-model-harness (Jev Model Classification Harness)

Claude Code 플러그인 (Codex도 지원). 사용자 입력마다 [Jev](https://docs.typesafe.ai)로 요청의 성격을 판단해서,
메인(Opus)이 **넘길 가치가 있는 작업만** Haiku / Sonnet 서브에이전트에 위임하도록 안내합니다.
설계와 근거는 [SPEC.md](SPEC.md)에 있습니다.

## 동작

```
입력 → [UserPromptSubmit 훅] Jev 1회 호출 (standalone / bulk / level)
     → 맥락 필요하거나, 분량이 작거나, 애매하면  → 메인(Opus)이 처리 (아무것도 주입하지 않음)
     → 그 외 level 0 → jev-model-harness:haiku-worker
             level 1 → jev-model-harness:sonnet-worker
             level 2 → 메인(Opus)
```

- 위임 지시는 **권고**입니다. 메인 모델이 따르지 않을 수 있습니다.
- Jev 오류, 키 없음, 시간 초과일 때는 조용히 메인이 처리합니다. 입력은 막히지 않습니다.

## 준비

- Node.js 20 이상 (외부 패키지 없음)
- 메인 모델을 Opus로 설정: `/model opus`
- Jev API 키 (console.typesafe.ai/keys)

## 설치 (Claude Code)

[MG Marketplace](https://github.com/Etchroot/mg-marketplace)에서 설치합니다.

```bash
claude plugin marketplace add Etchroot/mg-marketplace
claude plugin install jev-model-harness@mg-marketplace
```

로컬 폴더로 테스트할 때는 `claude --plugin-dir <이 폴더 경로>`로 실행합니다.

API 키는 플러그인 설정(`typesafe_api_key`, OS 보안 저장소에 보관)으로 넣는 것이 기본입니다.
설정 화면이 뜨지 않는 경우에는 환경변수 `TYPESAFE_API_KEY`로도 읽습니다.

## Codex에서 쓰기 (v0.2, 실제 Codex에서는 아직 미검증)

Codex에서는 메인을 `gpt-6.1-sol`로 두고, 조회·읽기 작업만 `luna_worker`(gpt-6-luna)에 위임합니다.
구현 작업은 메인이 처리합니다. Sol 워커는 메인과 가격이 같아서 두지 않았습니다. (SPEC 11장)

1. 메인 모델을 `gpt-6.1-sol`로 설정합니다.
2. Codex 플러그인은 서브에이전트를 포함할 수 없어서, 서브에이전트를 따로 설치합니다.
   이 명령은 `~/.codex/agents/`에 복사합니다.
   ```bash
   npm run setup:codex
   ```
3. `codex plugin marketplace add Etchroot/mg-marketplace`로 마켓플레이스를 추가하고, Codex 데스크톱 앱에서 설치합니다.
   문서상 플러그인 훅은 Codex 데스크톱에 직접 설치한 경우에 지원됩니다.
4. Codex에서 `/hooks`로 이 훅을 한 번 신뢰 승인합니다.
5. API 키는 환경변수 `TYPESAFE_API_KEY` 또는 플러그인 폴더의 `.env`로 넣습니다. Codex는 `userConfig`를 지원하지 않습니다.

## 수동 명령

| 입력 | 동작 |
|---|---|
| `!opus` / `!sol` | 이 세션은 항상 메인이 처리 |
| `!sonnet` | 이 세션은 항상 sonnet-worker에 위임 (Codex에서는 메인이 처리) |
| `!haiku` / `!luna` | 이 세션은 항상 가장 작은 워커에 위임 |
| `!auto` | 자동 판단으로 복귀 |

명령 뒤에 요청을 이어 쓸 수 있습니다. 예: `!opus 이 구조 다시 설계해줘`

## 로그

판단 기록은 `CLAUDE_PLUGIN_DATA/route-log.jsonl`에 남습니다.
이 변수가 없으면 `~/.claude/jev-model-harness-data/`에 남습니다.
Jev의 세 답, 결정, 적용 규칙, 캐시 수명, 응답 시간이 한 줄씩 들어갑니다.
기준값(SPEC 6장)을 조정할 때 이 로그를 씁니다.

## 개발

```bash
npm test
```

단위 테스트와, 가짜 Jev 서버를 붙여 훅을 실제 프로세스로 실행하는 통합 테스트가 있습니다.
