# MG Marketplace

차명근의 개인 플러그인 마켓플레이스입니다. 반복해서 쓰는 작업 방식을 플러그인으로 정리해 Claude Code와 Codex에서 함께 씁니다. 모든 플러그인을 이 저장소 안에서 개발하고 배포합니다.

## 플러그인

| 이름 | 버전 | 한 줄 설명 | 형태 |
| --- | --- | --- | --- |
| [music-director](plugins/music-director/README.md) | 0.2.1 | 레퍼런스 분석·곡 기획·가사 수정·Suno 프롬프트·작품 정리 | 스킬 |
| [application-coach](plugins/application-coach/README.md) | 0.1.1 | 실제 채용 문항 제안·경험 인터뷰·자소서 답변과 경험 기록 저장 | 스킬 |
| [obsidian-knowledge-graph](plugins/obsidian-knowledge-graph/README.md) | 0.2.0 | Obsidian Vault 기반 개인 지식베이스: 자료 등록·Inbox 정리·근거 요약·주제 연결·검색·Git 동기화 | 스킬 + MCP |
| [jev-model-harness](plugins/jev-model-harness/README.md) | 0.2.1 | 요청마다 Jev로 판단해 넘길 가치가 있는 작업만 더 싼 모델의 서브에이전트에 위임 | 훅 + 서브에이전트 |

자세한 사용법은 각 플러그인 README에 있습니다. 아래는 고를 때 알아두면 좋은 점입니다.

**music-director**
- 장르·보컬·언어·곡 구조를 곡마다 새로 정합니다.
- Suno에 직접 접속하지 않습니다. 만든 텍스트를 사용자가 Suno에 붙여 넣는 방식이라 API 키나 계정 연결이 필요 없습니다.
- 스킬: `lyric-direction`, `song-summary`

**application-coach**
- 최근 2년 공고에서 검증한 자소서 문항을 최대 50개 저장해 두고, 대화로 경험을 끌어내 답변과 경험 기록을 남깁니다.
- 경험이나 수치를 지어내지 않습니다.
- 개인 데이터는 이 저장소 밖에 보관합니다.
- 스킬: `experience-interview`, `experience-to-answer`

**obsidian-knowledge-graph**
- 로컬 MCP로 Markdown Vault를 다룹니다. Node 24가 필요하고, Obsidian 앱을 실행하지 않아도 됩니다.
- 사용자가 등록을 요청할 때만 수집합니다.
- 개인 Vault와 기기 설정은 이 저장소 밖에 둡니다.
- 설치 후 새 채팅에서 `setup` 스킬을 먼저 실행합니다.

**jev-model-harness**
- 메인 모델은 바꾸지 않아서 메인 대화의 프롬프트 캐시가 유지됩니다.
  - Claude Code: Opus 메인 → Haiku/Sonnet 워커
  - Codex: gpt-6.1-sol 메인 → Luna 워커
- Node 20 이상과 [Jev](https://docs.typesafe.ai) API 키가 필요합니다.
- 켜 둔 프로젝트에서는 **입력 내용이 Jev(외부 서비스)로 전송**되니, 쓸 프로젝트에서만 켭니다.
- Codex 동작은 아직 실제로 검증하지 않았습니다.
- 설계와 측정 근거는 [SPEC](plugins/jev-model-harness/SPEC.md)에 있습니다.

## 설치

### Claude Code: 프로젝트별로 켜기 (권장)

플러그인은 내 계정 전체가 아니라 **필요한 프로젝트에서만** 켭니다. 이 저장소를 받은 뒤 루트에서 실행합니다.

```sh
node tools/setup-project.mjs <프로젝트 폴더> <플러그인> [<플러그인> ...]
```

예: `node tools/setup-project.mjs C:\work\my-app music-director application-coach`

이 명령이 하는 일은 다음과 같습니다.
- 그 프로젝트의 `.claude/settings.local.json`에만 씁니다. 나만 쓰는 설정이고 git에 올라가지 않습니다.
  - 고른 플러그인을 켭니다.
  - MG Marketplace 자동 업데이트를 켭니다.
- `--shared`를 붙이면 `.claude/settings.json`에 씁니다. 그 프로젝트를 받는 사람 모두에게 적용됩니다.
- `claude` CLI가 있으면 바로 내려받고, 없으면 다음 세션을 시작할 때 내려받습니다.

설정은 새 세션부터 적용됩니다. API 키처럼 플러그인에 필요한 값은 세션에서 `/plugin configure <플러그인>@mg-marketplace`로 넣습니다.

저장소를 받지 않고 직접 설치할 때는 쓸 프로젝트 폴더에서 아래 명령을 실행합니다. 이 방법은 자동 업데이트를 켜지 않습니다.

```sh
claude plugin marketplace add Etchroot/mg-marketplace --scope local
claude plugin install <플러그인>@mg-marketplace --scope local
```

스킬은 세션에서 `/<플러그인>:<스킬>` 형식으로 부릅니다. 예: `/music-director:lyric-direction`

### Codex

마켓플레이스 명령을 지원하는 Codex에서 등록합니다.

```sh
codex plugin marketplace add Etchroot/mg-marketplace
```

지원되는 앱의 플러그인 목록에서 MG Marketplace를 선택해 설치합니다. 등록 명령 지원 여부와 설치 화면은 사용하는 Codex 버전에 따라 확인해야 합니다.
- 로컬 저장소로 쓸 때는 이 저장소를 프로젝트로 열고 앱을 재시작한 뒤 플러그인 목록을 확인합니다.
- 카탈로그 파일은 `.agents/plugins/marketplace.json`입니다.

### 자동 업데이트 (Claude Code)

- 대화형 세션에서 첫 메시지를 보낸 뒤 최대 10분 안에 새 버전을 확인합니다.
- 새 버전은 `/reload-plugins`를 실행하거나 다음에 실행할 때 적용됩니다.
- 플러그인의 `version`이 바뀐 경우에만 새로 받습니다. 그래서 이 저장소는 실행 파일이 바뀔 때마다 버전을 올립니다. 아래 "저장소 관리"를 참고하세요.
- 환경변수 `DISABLE_AUTOUPDATER=1`이 설정된 환경에서는 자동 업데이트가 꺼집니다. Claude 데스크톱 앱 세션이 여기에 해당할 수 있습니다.
  - `FORCE_AUTOUPDATE_PLUGINS=1`을 함께 설정하면 켜집니다.
  - 꺼져 있을 때는 `claude plugin marketplace update mg-marketplace`로 직접 받습니다.

공식 안내:
- [Claude Code 마켓플레이스](https://code.claude.com/docs/en/plugin-marketplaces)
- [OpenAI 플러그인 패키징 및 마켓플레이스](https://developers.openai.com/plugins/build/plugins)

## 저장소 관리

플러그인을 고치는 사람과 에이전트를 위한 내용입니다. 작업 규칙은 [AGENTS.md](AGENTS.md)에 있고, Claude Code와 Codex는 이 파일을 자동으로 읽습니다.

### 버전

설치한 사람은 `version`이 바뀌어야 새 버전을 받습니다. 그래서 **실행 파일**을 바꾸면 그 플러그인의 버전을 반드시 올립니다.
- 실행 파일: 문서·테스트·개발 도구를 뺀 모든 파일
- 버전 숫자는 직접 고치지 않고 스크립트로 올립니다.

```sh
node tools/bump.mjs <플러그인> [patch|minor|major]   # 버전 파일·이 README의 버전 표·releases.json을 함께 올림
node tools/check.mjs                                  # 전체 검사: 버전 누락·불일치, 카탈로그·README 누락
```

푸시하면 [GitHub Actions](.github/workflows/check.yml)가 같은 검사와 플러그인 테스트를 실행합니다. 결과는 저장소의 Actions 탭에서 볼 수 있습니다.

### 플러그인 추가

1. `plugins/<이름>/`에 플러그인을 넣습니다.
2. 두 카탈로그의 `plugins` 배열에 등록합니다.
   - Claude Code: `.claude-plugin/marketplace.json`
   - Codex: `.agents/plugins/marketplace.json`
   - 카탈로그의 이름은 플러그인 `plugin.json`의 이름과 같아야 하고, `source`는 저장소 루트 기준 경로를 씁니다.
3. 이 README의 플러그인 표에 행을 추가합니다.
4. `node tools/bump.mjs <이름> record`로 첫 기록을 남깁니다. 버전은 바뀌지 않습니다.
5. `node tools/check.mjs`로 확인합니다.

### 검증

```sh
node tools/check.mjs
claude plugin validate .
claude plugin validate ./plugins/<이름>
```

파일 검증을 통과해도 실제 설치나 실행이 보장되는 것은 아닙니다. 새 기능은 실제 Claude Code나 Codex에서 확인합니다. 공개 저장소에 올린다고 공식 플러그인 디렉터리에 등재되지는 않습니다.

## 저장소 구조

```text
mg-marketplace/
├── .claude-plugin/marketplace.json   # Claude Code 카탈로그
├── .agents/plugins/marketplace.json  # Codex 카탈로그
├── .github/workflows/check.yml       # 푸시마다 전체 검사
├── AGENTS.md, CLAUDE.md              # 에이전트 작업 규칙
├── releases.json                     # 플러그인별 마지막 버전과 실행 파일 지문
├── tools/                            # bump, check, setup-project
├── portfolio/                        # 공개 요청된 자소서·경험 기록
└── plugins/
    └── <플러그인>/
        ├── plugin.json               # 공통 매니페스트 (Codex)
        ├── .claude-plugin/plugin.json
        ├── .codex-plugin/plugin.json
        ├── README.md
        └── skills/ · hooks/ · agents/ · scripts/ …
```

## 공개 자료

[잔향·GIDDA 자료 모음](portfolio/application-essays/README.md)은 공개를 요청받은 자소서와 경험 기록입니다. 원본과 자소서 본문을 보존하고, 다섯 항목의 경험 기록을 따로 정리했습니다.
