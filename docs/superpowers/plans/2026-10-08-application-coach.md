# Application Coach Implementation Plan

**Goal:** 질문 50개를 보관하고 대화로 경험을 발굴해 자소서 답변과 경험 기록을 저장하는 플러그인을 추가한다.
**Architecture:** 호스트가 웹 조사·대화를 수행하고 Python 표준 라이브러리 CLI가 검증·배치·상태·저장을 관리한다. catalog.json을 상태의 기준으로 삼고 인터뷰·답변·경험 파일을 저장한 뒤에만 완료 상태를 기록한다.
**Tech Stack:** Markdown, JSON, Python 3.10+, unittest.
**Spec:** ../../designs/2026-10-08-application-coach.md
**Execution:** 사용자가 구현을 승인했다. 현재 세션에서 직접 실행하며 별도 에이전트는 사용하지 않는다.

## Constraints

- 한 배치는 질문 최대 50개. 공고 수가 아니다.
- 공고 날짜가 요청일 기준 최근 달력상 2년 안에 있고 기업·직무·문항·출처 연결이 확인된 자료만 채택.
- 기존 배치를 우선 사용하고 새 검색은 소진 또는 사용자의 새 배치 요청 때 수행.
- 개인 데이터는 Git 저장소 밖에 둔다. 실서비스 연동이나 실제 공고 수집을 구현 완료로 주장하지 않는다.

## Review focus

날짜 경계와 윤년, 여러 사이트의 같은 공고, 기업이 다른 같은 문항, 완료 항목 재수집, 잘못된 상태·경로와 저장 실패를 각각 테스트한다.

## Tasks

- [x] 1. tests/test_application_coach.py에 실제 저장·재개·중복·날짜·실패 불변조건 테스트를 작성하고 없는 모듈로 실패 확인.
- [x] 2. scripts/career_store.py에 import-batch, next, status, checkpoint, save-answer, summary CLI 구현. JSON 원자 교체, 작업 잠금, 안정적인 ID와 파생 문서 저장을 제공.
- [x] 3. SKILL.md, 출처·배치 규칙, 인터뷰 지침, 데이터 형식 및 허구 사용 예시 작성. 완료 기준·중단·재개·출처 부족 처리를 연결.
- [x] 4. 기존 형식과 일치하는 세 manifest 작성. 두 카탈로그와 루트 README에 application-coach 등록.
- [x] 5. unittest, 스킬 frontmatter 검사, Claude Code validate, 내부 링크·JSON·Git diff 검증. 실제 호스트 행동 검수와 웹 수집은 미실행으로 명시.

## Verification commands

```sh
python -B -m unittest discover -s tests -p test_application_coach.py -v
claude plugin validate .
claude plugin validate ./plugins/application-coach
git diff --check
```
