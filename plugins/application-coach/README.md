# Application Coach

기업·직무에 맞는 실제 자소서 질문을 제안하고 대화로 경험을 끌어내 답변과 경험 기록을 저장하는 스킬 중심 플러그인입니다.

## 사용

> application-coach의 experience-interview 스킬로 오늘은 AI 엔지니어 직무의 자소서 하나를 쓰고 싶어.

처음에는 최근 2년 안의 공고에서 검증된 문항 최대 50개를 개인 폴더에 저장합니다. 다음부터는 저장 목록을 먼저 읽고 문항 하나를 제안합니다. 기업·직무·공고 날짜·출처를 보여 준 뒤, 본인의 역할과 행동·결과·배운 점을 대화로 찾고 충분한 근거가 모이면 작성·저장합니다.

질문은 고정 설문이나 무한 인터뷰가 아닙니다. 기억이 나지 않으면 다른 경험이나 보류를 제안하고, 사용자가 질문 중단을 요청하면 따릅니다. 경험·역할·성과 수치를 지어내지 않습니다.

## 설치

Codex의 마켓플레이스 목록에서 MG Marketplace를 선택해 Application Coach를 설치합니다. 마켓플레이스 등록은 [루트 README](../../README.md)를 참고하세요.

Claude Code:

```sh
claude plugin marketplace add Etchroot/mg-marketplace
claude plugin install application-coach@mg-marketplace
```

세션에서 `/application-coach:experience-interview`로 사용합니다. 현재 호스트의 스킬 호출 이름을 확인하세요.

## 개인 자료와 질문 풀

- 질문 50개가 한 배치입니다. 공고 50개가 아니며 한 공고의 문항을 각각 관리합니다.
- 문항 상태: pending / in_progress / completed / on_hold / discarded.
- 최근 2년은 요청일에서 달력상 2년입니다. 실제 공고 날짜를 확인하지 못하면 유효 목록에서 제외합니다.
- 실제 확보 자료가 50개보다 적으면 부족한 수를 보고합니다. 종료된 공고는 연습용입니다.
- 같은 범위의 저장 자료를 우선 사용하고 소진 또는 사용자의 명시적 교체 요청 때만 다음 배치를 수집합니다.
- 실제 질문·대화·자소서·경험은 공개 저장소 밖의 별도 개인 폴더에 보관합니다. CLI는 Git 저장소 내부 저장을 거부합니다.

## 구성과 한계

[스킬](skills/experience-interview/SKILL.md)이 호스트의 웹 도구로 조사하고 인터뷰합니다. [career_store.py](skills/experience-interview/scripts/career_store.py)는 날짜·중복·배치·진행 상태·버전 파일을 관리합니다. Python 3.10 이상과 표준 라이브러리만 필요합니다.

스크립트 자체가 채용 사이트를 검색하거나 웹 증거의 진위를 확인하지는 않습니다. 로그인·유료 API·MCP 연결·지원서 제출은 포함하지 않습니다. 사이트 접근과 자료 확보는 호스트의 도구 및 공개 원문에 따라 달라집니다.

데이터 형식과 명령: [data-format.md](skills/experience-interview/references/data-format.md)
사용·검수 사례: [usage.md](examples/usage.md)

## 검증

저장소 루트에서:

```sh
python -B -m unittest discover -s tests -p test_application_coach.py -v
claude plugin validate ./plugins/application-coach
claude plugin validate .
```

테스트에는 허구 자료만 사용합니다. 실제 공고 50개 확보, 호스트 설치 후 자동 스킬 선택·실제 인터뷰 품질은 별도 실행 검수가 필요합니다. 파일 검증 통과를 실제 웹 조사나 자소서 품질 검증으로 표시하지 않습니다.

### 2026-10-08 검증 기록

- 로컬 데이터 도구 테스트 12개 통과: 날짜·윤년, 중복, 상태·배치 순환, CLI 재개, 초안·길이, 동시 작업 잠금, 저장 실패 복원.
- skill-creator quick_validate, Claude Code 플러그인·마켓플레이스 validate 통과.
- manifest JSON과 Markdown 내부 링크 확인.
- 실제 채용 사이트 자료 수집과 호스트 설치 후 인터뷰는 미실행.
