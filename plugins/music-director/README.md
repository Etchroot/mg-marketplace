# music-director

레퍼런스 곡의 조사·분석에서 곡 기획, 가사 디렉팅, 수정 이력, Suno에 붙여 넣을 프롬프트와 작품 정리 Markdown까지 만드는 스킬 전용 플러그인입니다.

## 범위

- 곡 제목·아티스트·링크를 주면 메타데이터와 음악적 특징을 조사해 분석 파일 작성
- 가수·작사·작곡·편곡, 장르, 스타일, 훅, 구조, 감정 흐름, 도입·엔딩 정리
- 실제 청취, 출처 확인, 사용자 설명, 추정·미확인 정보 구분
- 분석 후 반주 우선 / 가사 우선 선택 질문
- 곡별 설정을 바탕으로 새 가사와 가사·스타일·제외 프롬프트 작성
- 피드백에 따른 수정 및 확정본 기록
- 기존 프로젝트를 읽어 보컬곡·연주곡·출품용 작품 정리 파일 작성 및 갱신

**Suno 직접 실행 기능은 없습니다.** API 키, 계정 연결, MCP 서버, 생성·결제·샘플 업로드·공개 게시를 포함하지 않습니다. 만든 텍스트를 사용자가 Suno에 붙여 넣고 결과를 돌려주는 방식입니다.

## 빠른 시작

플러그인을 로드한 환경에서 다음처럼 요청하세요.

> music-director의 lyric-direction 스킬로 이 곡을 분석해 줘: [제목 + 아티스트 또는 URL]

먼저 reference-analysis.md를 작성하고 “반주부터 만들까요, 가사부터 정할까요?”라고 묻습니다. 순서를 이미 말한 경우에는 다시 묻지 않습니다.

> 가사부터. 한국어 중심의 성장 이야기로, 보컬은 아직 미정. 코러스 줄 수는 반주를 듣고 결정하자.

> 반주부터. 이후 가사를 얹을 예정이니 전주·간주와 보컬 공간을 구분해 줘.

완성된 프롬프트를 사용자가 Suno에 입력하고, 실제 결과나 피드백을 보내 다음 버전을 만듭니다.

## 선택 가능한 설정

장르·시대, 템포와 체감 박자, 악기, 보컬, 언어, 화자, 감정선, 문장 밀도, 코러스 그룹, 반복·쉼, 도입, 엔딩, 길이·시간표, UI 설정과 글자 수 제한은 모두 곡별로 선택합니다.
특정 프로젝트의 “영어 보컬 훅”, “160 BPM 하프타임”, “1/2/2/2/1”, “콜드 엔딩”을 기본값으로 고정하지 않습니다.

설정 목록: [options.md](skills/lyric-direction/references/options.md)
사용 예시·수동 검수: [usage.md](examples/usage.md)

## 파일 구조

```text
music-director/
├── plugin.json
├── .codex-plugin/plugin.json
├── README.md
├── examples/usage.md
├── skills/song-summary/
│   ├── SKILL.md
│   └── references/summary-template.md
└── skills/lyric-direction/
    ├── SKILL.md
    ├── references/
    │   ├── options.md
    │   ├── reference-analysis.md
    │   └── session-lessons.md
    └── scripts/check_prompts.py
```

root plugin.json은 Agent Plugins 형식입니다. .codex-plugin/plugin.json은 Codex 호환 manifest입니다. 스킬은 skills/ 아래에 있습니다.
공식 형식: [OpenAI 플러그인 패키징 문서](https://developers.openai.com/plugins/build/plugins)

마켓플레이스 등록·설치는 호스트의 로컬 플러그인 절차를 따릅니다. 이 작업에서는 기존 marketplace.json이나 전역 설정을 변경하지 않았으며 설치·게시도 수행하지 않았습니다. 등록할 source는 이 music-director 디렉터리를 가리키도록 설정하세요.
실제 호스트에서의 로딩·자동 스킬 선택은 설치 후 확인해야 합니다.

## 생성하는 프로젝트 문서

- reference-analysis.md: 레퍼런스 사실·관찰·추정 및 기법
- song-brief.md: 선택 설정·감정선·곡 구조
- 버전별 가사/스타일/제외 프롬프트
- revision-log.md: 사용자 관찰 → 가설 → 변경 → 결과 → 적용 범위
- 작품 정리: [song-summary](skills/song-summary/SKILL.md)로 현재 확정 정보·짧은 소개·음악 방향·채택 파일을 기록. 보컬곡에는 가사·가창 방향, 연주곡에는 악기 전개, 출품용에는 제출 규격과 AI 제작 정보를 선택적으로 추가

사용자가 요청한 범위에 맞춰 파일 수를 줄일 수 있습니다. 분석 결과는 음악적 해석이며, 오디오 청취가 불가능하면 그 한계를 파일에 명시합니다.

## 글자 수 검사

Python 3, 표준 라이브러리만 사용합니다. Suno와 통신하지 않습니다.

```text
python skills/lyric-direction/scripts/check_prompts.py --style /path/to/style.txt --limit 1000
```

선택한 limit은 사용자 UI에서 확인한 값입니다. 1000은 예시이며 플랫폼 전체의 영구 제한이 아닙니다.
공백·문장부호·줄바꿈을 포함해 코드포인트와 UTF-16 단위를 모두 출력합니다. 기본 비교는 UTF-16이며 --count-mode codepoints로 바꿀 수 있습니다. 상한 이내이면 종료 코드 0, 초과하면 1입니다. BOM만 제외하며 실제 본문을 자동으로 줄이거나 수정하지 않습니다.

## 검증 범위와 한계

- 스킬 frontmatter, manifest JSON, 내부 경로와 글자 수 검사 도구는 정적·실행 검증 대상입니다.
- 사용 예시는 행동 검수 시나리오입니다. 실제 Suno 생성 결과를 시험하거나 성공을 보증하지 않습니다.
- 프롬프트의 시간·음색·쉼·콜드 엔딩 등은 생성 방향을 유도합니다. 정확한 결과는 사용자가 확인해야 합니다.
- 이 채팅에서 관찰된 수정 결과는 session-lessons.md에 조건부 사례로 정리했습니다. 개인 취향이나 한 곡의 성공을 보편 규칙으로 삼지 않습니다.
- 레퍼런스 조사에는 웹 도구, 실제 오디오 분석에는 해당 기능이 있는 호스트가 필요합니다. 레퍼런스 음성·멜로디를 복제하지 않습니다.

### 로컬 검증 기록 — 2026-10-08

- skill-creator 공식 quick_validate.py: 통과
- 두 manifest의 JSON·이름·버전·스킬 경로 기본 검사: 통과
- Markdown 내부 링크 8개: 존재 및 패키지 내부 경로 확인
- 글자 수 도구 CLI 8개 사례: 상한 경계, 초과, 한글·이모지, UTF-16/코드포인트, 공백·줄바꿈, BOM, 없는 파일 처리 통과
- 호스트 설치·마켓플레이스 등록·자동 스킬 선택·Suno 생성: 미실행

이 검증은 파일 형식과 검사 도구의 동작을 확인한 것이며, 실제 음악 생성의 품질이나 모든 호스트에서의 설치 성공을 보증하지 않습니다.
## 작품 정리 스킬 — song-summary

> music-director의 song-summary로 이 프로젝트의 작품 정리 파일을 만들어 줘. 기존 파일이 있으면 최신 확정본으로 수정해 줘.

> 가사는 붙이지 않고 연주곡으로 확정했어. 작품명은 경계의 너머야. 이전 보컬 초안은 최종본에서 빼고, 음원과 커버 파일 위치도 정리해 줘.

기본 양식은 작품 정보 → 짧은 소개 → 음악 방향·구조 → 제작 파일입니다. 가사·가창, 레퍼런스, 커버, 출품 정보는 해당하는 경우에만 붙입니다. 알려지지 않은 정보는 임의 확정하지 않습니다.
기획 BPM·목표 길이와 실측값을 구분하며, 존재하는 파일을 채택된 최종본으로 자동 간주하지 않습니다. 정리만 요청하면 음원 생성·변환·커버 생성·제출을 수행하지 않습니다.

양식과 기존 문서에서 추출한 기준: [summary-template.md](skills/song-summary/references/summary-template.md)

### 작품 정리 스킬 검증 — 2026-10-09

- lyric-direction 및 song-summary의 공식 quick_validate.py: 통과
- 두 manifest의 JSON·이름·버전(0.2.0)·스킬 경로: 확인
- Markdown 내부 링크 12개: 파일 존재 및 패키지 내부 경로 확인
- 보컬곡 갱신·연주곡 전환·공모전·폴더 이동 예시 4개 추가
- 호스트 설치·자동 스킬 선택 및 실제 요청 실행 검증: 미실행
