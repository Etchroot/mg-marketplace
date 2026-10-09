# MG Marketplace

차명근의 개인 플러그인·스킬 마켓플레이스입니다. 반복해서 사용하는 작업 방식을 플러그인으로 정리하고, 이 저장소 안에서 함께 관리합니다.

## 플러그인

| 이름 | 버전 | 설명 |
| --- | --- | --- |
| [music-director](plugins/music-director/README.md) | 0.2.1 | 레퍼런스 분석, 곡 기획·가사·Suno 프롬프트 구성, 작품 정리 |
| [application-coach](plugins/application-coach/README.md) | 0.1.1 | 실제 채용 문항 제안, 경험 인터뷰, 자소서 답변과 경험 기록 저장 |

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

## 사용 예시

> music-director의 lyric-direction 스킬로 곡을 기획해 줘. 한국어 중심의 전자 팝으로 가사부터 시작하고 싶어. 보컬과 코러스 구성은 아직 정하지 말자.

레퍼런스 곡을 주면 출처와 청취 가능 여부를 구분해 분석한 뒤, 반주부터 만들지 가사부터 정할지 선택합니다. 자세한 흐름과 검수 시나리오는 [사용 예시](plugins/music-director/examples/usage.md)를 참고하세요.

## 저장소 구조

```text
mg-marketplace/
├── .agents/plugins/marketplace.json        # Codex 카탈로그
├── .claude-plugin/marketplace.json         # Claude Code 카탈로그
├── README.md
└── plugins/
    ├── application-coach/                 # 경험 인터뷰·자소서 저장
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

## 검증

```sh
claude plugin validate .
claude plugin validate ./plugins/music-director
```

JSON과 내부 경로, 프롬프트 글자 수 도구를 확인할 수 있습니다. 파일 검증과 실제 호스트 설치·스킬 실행은 별개이며, Suno 생성 결과의 품질을 보장하지 않습니다. 공개 저장소 업로드만으로 공식 플러그인 디렉터리에 등재되는 것은 아닙니다.

## 자소서 플러그인

application-coach는 최근 2년의 검증된 자소서 질문 최대 50개를 저장하고, 대화로 경험을 끌어내 답변과 경험 기록을 남깁니다. 개인 데이터는 공개 저장소 바깥에 보관합니다. 자세한 사용법과 도구의 범위는 [플러그인 README](plugins/application-coach/README.md)를 참고하세요.

공개 요청된 자소서와 경험 기록: [잔향·GIDDA 자료 모음](portfolio/application-essays/README.md). 원본과 자소서 본문을 보존하고 다섯 항목의 경험 기록을 별도로 정리했습니다.
