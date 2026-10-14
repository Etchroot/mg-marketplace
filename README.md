# MG Marketplace

차명근의 개인 플러그인·스킬 마켓플레이스입니다. 반복해서 사용하는 작업 방식을 플러그인으로 정리하고, 이 저장소 안에서 함께 관리합니다.

## 플러그인

| 이름 | 버전 | 설명 |
| --- | --- | --- |
| [music-director](plugins/music-director/README.md) | 0.2.1 | Suno 작곡 플러그인, 레퍼런스 분석, 곡 기획·가사·Suno 프롬프트 구성, 작품 정리 |
| [application-coach](plugins/application-coach/README.md) | 0.1.1 | 자소서 작성 서치 및 작성 플러그인, 실제 채용 문항 제안, 경험 인터뷰, 자소서 답변과 경험 기록 저장 |
| [obsidian-knowledge-graph](plugins/obsidian-knowledge-graph/README.md) | 0.2.0 | 옵시디언 지식 그래프 플러그인, 직접 작성한 Inbox 등록, 중복 방지, 수정본 보존, 제목 기반 정리, 자기소개서 허브, 근거 요약과 Private Git 동기화 |
| [jev-model-harness](plugins/jev-model-harness/README.md) | 0.2.1 | Jev Model Classification Harness, 요청마다 Jev로 판단해 넘길 가치가 있는 작업만 싼 모델 서브에이전트에 위임 (Claude Code: Opus → Haiku/Sonnet, Codex: gpt-6.1-sol → Luna) |

music-director는 장르·보컬·언어·곡 구조를 곡별로 선택합니다. 특정 곡에서 사용한 설정을 모든 곡의 기본값으로 고정하지 않습니다. Suno에 직접 접속하거나 음악을 생성하지 않으며, API 키나 Suno 계정 연결이 필요하지 않습니다.

## Codex에서 등록

마켓플레이스 명령을 지원하는 Codex CLI에서 실행합니다.

```sh
codex plugin marketplace add Etchroot/mg-marketplace
```

지원되는 앱의 플러그인 목록에서 MG Marketplace를 선택해 music-director를 설치합니다. 등록 명령 지원 여부와 설치 화면은 사용하는 호스트 버전에 따라 확인해야 합니다.

로컬 저장소로 사용할 경우 이 저장소를 프로젝트로 열고 앱을 재시작한 뒤 플러그인 목록을 확인할 수 있습니다. 카탈로그는 `.agents/plugins/marketplace.json`입니다.

공식 안내: [OpenAI 플러그인 패키징 및 마켓플레이스](https://developers.openai.com/plugins/build/plugins)

## Claude Code에서 설치

```sh
claude plugin marketplace add Etchroot/mg-marketplace
claude plugin install music-director@mg-marketplace
```

세션에서 다음과 같이 사용합니다.

```text
/music-director:lyric-direction
```

공식 안내: [Claude Code 마켓플레이스](https://code.claude.com/docs/en/plugin-marketplaces)

### 프로젝트별로 켜고 자동 업데이트 받기

플러그인은 내 계정 전체(user)가 아니라 **필요한 프로젝트에서만** 켜는 것을 권장합니다. 이 저장소를 받은 뒤 루트에서 실행합니다.

```sh
node tools/setup-project.mjs <프로젝트 폴더> <플러그인> [<플러그인> ...]
```

예: `node tools/setup-project.mjs C:\work\my-app jev-model-harness music-director`

- 그 프로젝트의 `.claude/settings.local.json`에만 씁니다. 이 파일은 나만 쓰는 설정이고 git에 올라가지 않습니다.
  - 고른 플러그인을 켭니다.
  - `mg-marketplace`의 **자동 업데이트**를 켭니다.
- `--shared`를 붙이면 `.claude/settings.json`에 씁니다. 그 프로젝트를 받는 팀원 모두에게 적용됩니다.
- `claude` CLI가 있으면 플러그인을 바로 내려받고, 없으면 다음 세션을 시작할 때 내려받습니다.

**자동 업데이트 동작**
- 대화형 세션에서 첫 메시지를 보낸 뒤 최대 10분 안에 새 버전을 확인합니다.
- 새 버전은 `/reload-plugins`를 실행하거나 다음에 실행할 때 적용됩니다.
- 플러그인의 `version`이 바뀐 경우에만 새로 받습니다. 그래서 이 저장소는 버전 관리 도구로 이를 지킵니다. 아래 "버전 관리"를 참고하세요.
- 환경변수 `DISABLE_AUTOUPDATER=1`이 설정된 환경에서는 플러그인 자동 업데이트도 꺼집니다. Claude 데스크톱 앱 세션이 이 경우에 해당할 수 있습니다.
  - `FORCE_AUTOUPDATE_PLUGINS=1`을 함께 설정하면 켜집니다.
  - 꺼져 있을 때는 `claude plugin marketplace update mg-marketplace`로 직접 받습니다.

## 버전 관리

다른 PC와 에이전트에 변경이 빠짐없이 전달되도록, 실행 파일이 바뀌면 그 플러그인의 버전을 반드시 올립니다.
- 규칙: [AGENTS.md](AGENTS.md). Claude Code와 Codex는 이 파일을 자동으로 읽습니다.
- 푸시할 때마다 GitHub Actions가 검사합니다.

```sh
node tools/bump.mjs <플러그인> [patch|minor|major]   # 버전 파일·README 표·releases.json을 함께 올림
node tools/check.mjs                                  # 전체 검사: 버전 누락, 버전 불일치, 카탈로그·README 누락
```

## 사용 예시

> music-director의 lyric-direction 스킬로 곡을 기획해 줘. 한국어 중심의 전자 팝으로 가사부터 시작하고 싶어. 보컬과 코러스 구성은 아직 정하지 말자.

레퍼런스 곡을 주면 출처와 청취 가능 여부를 구분해 분석한 뒤, 반주부터 만들지 가사부터 정할지 선택합니다. 자세한 흐름과 검수 시나리오는 [사용 예시](plugins/music-director/examples/usage.md)를 참고하세요.

## 저장소 구조

```text
mg-marketplace/
├── .agents/plugins/marketplace.json        # Codex 카탈로그
├── .claude-plugin/marketplace.json         # Claude Code 카탈로그
├── .github/workflows/check.yml             # 푸시마다 전체 검사
├── AGENTS.md / CLAUDE.md                   # 에이전트 작업 규칙
├── releases.json                           # 플러그인별 마지막 버전과 실행 파일 지문
├── tools/                                  # bump, check, setup-project
├── README.md
└── plugins/
    ├── application-coach/                 # 경험 인터뷰·자소서 저장
    ├── jev-model-harness/                 # Jev 기반 모델 분류·위임 훅
    └── music-director/
        ├── plugin.json
        ├── .codex-plugin/plugin.json
        ├── .claude-plugin/plugin.json
        ├── README.md
        ├── examples/usage.md
        └── skills/lyric-direction/
            ├── SKILL.md
            ├── references/
            └── scripts/check_prompts.py
```

## 플러그인 추가

새 플러그인을 `plugins/<이름>/`에 넣고 두 마켓플레이스 카탈로그의 `plugins` 배열에 등록합니다. 카탈로그의 이름은 플러그인 manifest의 이름과 일치해야 하고, source는 저장소 루트 기준 경로를 사용합니다.

그다음 아래를 합니다.
- 루트 README 표에 행을 추가합니다.
- `node tools/bump.mjs <이름> record`로 첫 기록을 남깁니다. 버전은 바뀌지 않습니다.
- `node tools/check.mjs`로 확인합니다.

## 검증

```sh
claude plugin validate .
claude plugin validate ./plugins/music-director
```

JSON과 내부 경로, 프롬프트 글자 수 도구를 확인할 수 있습니다. 파일 검증과 실제 호스트 설치·스킬 실행은 별개이며, Suno 생성 결과의 품질을 보장하지 않습니다. 공개 저장소 업로드만으로 공식 플러그인 디렉터리에 등재되는 것은 아닙니다.

## 개인 지식베이스 플러그인

obsidian-knowledge-graph는 Codex와 Claude Code의 로컬 MCP에서 Markdown Vault를 사용합니다. Node 24가 필요하고 Obsidian 앱은 실행하지 않아도 됩니다. 사용자가 작업 완료 자료를 등록하라고 요청했을 때만 수집하며 종료 훅은 없습니다. 개인 원본과 기기 설정은 이 공개 마켓플레이스 밖에 둡니다. Notion 복사는 후속 버전 기능입니다. 설치 후 새 채팅에서 setup을 실행하고 실제 호스트별 연결 상태를 확인하세요.

자세한 내용은 [지식베이스 플러그인 안내](plugins/obsidian-knowledge-graph/README.md)를 참고하세요.

## 자소서 플러그인

application-coach는 최근 2년의 검증된 자소서 질문 최대 50개를 저장하고, 대화로 경험을 끌어내 답변과 경험 기록을 남깁니다. 개인 데이터는 공개 저장소 바깥에 보관합니다. 자세한 사용법과 도구의 범위는 [플러그인 README](plugins/application-coach/README.md)를 참고하세요.

공개 요청된 자소서와 경험 기록: [잔향·GIDDA 자료 모음](portfolio/application-essays/README.md). 원본과 자소서 본문을 보존하고 다섯 항목의 경험 기록을 별도로 정리했습니다.

## 모델 분류 하네스 플러그인

jev-model-harness는 사용자 입력마다 `UserPromptSubmit` 훅으로 [Jev](https://docs.typesafe.ai)를 한 번 호출해 요청의 성격을 판단합니다. 메인 모델은 바꾸지 않고, 이전 대화 없이 처리할 수 있고 직접 작업이 필요한 요청만 더 싼 모델의 서브에이전트에 넘기도록 안내합니다. 그래서 메인 대화의 프롬프트 캐시가 유지됩니다.

```sh
claude plugin install jev-model-harness@mg-marketplace
```

- Node 20 이상과 Jev API 키가 필요합니다. 키는 Claude Code 플러그인 설정(보안 저장소) 또는 환경변수 `TYPESAFE_API_KEY`로 넣습니다.
- 메인 모델은 Claude Code에서 Opus, Codex에서 gpt-6.1-sol을 권장합니다. 다른 모델이면 세션당 한 번 경고합니다.
- Codex에서는 서브에이전트를 플러그인에 넣을 수 없어 `npm run setup:codex`로 따로 설치하고, `/hooks`에서 훅을 신뢰 승인해야 합니다. 실제 Codex 동작은 아직 검증하지 않았습니다.
- 위임 지시는 권고이며, Jev 오류나 키가 없을 때는 메인이 그대로 처리합니다.

설계와 측정 근거는 [플러그인 README](plugins/jev-model-harness/README.md)와 [SPEC](plugins/jev-model-harness/SPEC.md)을 참고하세요.
