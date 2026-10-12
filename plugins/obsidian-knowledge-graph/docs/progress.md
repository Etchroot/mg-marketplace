# 구현 기록 — D:/Obsidian/옵시디언-지식그래프-플러그인-상세구현계획.md

2026-10-12. 0.1.1 로컬 구현 완료 단계. 테스트와 실제 앱 수용 시험은 구분한다.

## 사전 검토

- Task 0→1→2: 같은 설정·오류·경로 계약을 사용한다.
- Task 2→3→4→5: 영속 기록 ID와 revision이 카탈로그·근거·정리의 기준이다.
- Task 5→6: 정리 저널의 변경 파일만 Git stage한다. 정책 제외 자료가 공용 목차에 섞이는 경우 원격 전송을 차단해야 한다.
- Task 0→7→9: 공통 handlers를 stdio MCP·CLI에서 사용하며 설정은 설치 위치 밖에서 선택한다.
- Task 6→10: Notion은 0.2 선택 기능. 0.1에서 실행 불가능한 상태를 명확히 반환한다.

Ruling: 새로운 개발 폴더를 독립 Git 저장소의 구현 브랜치로 사용 — 현재 프로젝트는 저장소가 아닌 Obsidian 설치 폴더 — 기존 프로그램을 Git에 넣지 않는다.
Ruling: Windows에서는 스킬의 bash bookkeeping 대신 이 Markdown 기록을 유지 — 동일한 검증·진행 기록을 보존 — 자동 brief 스크립트 대신 작업 본문을 직접 확인한다.
Ruling: 이 배포는 0.1.0 기본 기능을 완성하고 Notion 0.2.0은 별도 버전으로 둔다 — 계획의 배포 의존성에 명시됨 — Notion 활성화는 차단하고 후속 구현 필요를 표시한다.

## 상태

- Task 0: Node 24.19.0·SDK 1.32.1·MCP 도구 17개·한글 설치경로 smoke 구현. Codex 실제 로컬 설치 성공. 두 GUI의 자연어 실행은 다음 채팅에서 수용 시험 필요.
- Task 1–5: 경로·잠금·저널·capture·근거·정리·카탈로그·검색 구현 및 합성 테스트 통과. 같은 revision 요약은 덮어쓰기 금지.
- Task 6: 허용 파일 Git sync·Private 확인·동기화 영수증 구현. 로컬 bare remote에서 검증.
- Task 7–9: 공통 스킬 6개·설정·수동 추출본·standalone bundle·재설치 보존 시험 구현. Codex 로컬 설치 성공, Claude Code 실제 GUI 시험 대기.
- Task 10: 0.2.0 후속 범위.
- Task 11–12: 40개 합성 검색 질문 통과, 별도 clone의 복원·해시·재검색 통과. MG 두 catalog와 신규 plugin 폴더를 로컬 구현 브랜치에 준비. 실제 자료는 아직 미지정.
- 실제 앱 GUI 자연어 수용 시험·MG 원격 게시: 미실행.

## 검증·결정 기록

- 초기 테스트: 9개 실패를 확인한 뒤 9개 통과. Git sync 3개 실패 → 통과. 수동 추출본 계약 실패 → 구현·통과. 제출본 revision 상태 회귀 실패 → revision별 보존·통과.
- 2026-10-12: 26개 테스트 통과, TypeScript 검사와 standalone 빌드 통과. 최종 리뷰 뒤 전체를 다시 검증한다.
- 실제 Private 데이터 저장소: https://github.com/Etchroot/Etchroot-knowledge-base. 사용자 요청에 따라 생성·Private 확인·빈 시스템 구조 push 완료. 개인 원본 업로드 없음.
- 실제 Vault: D:/Obsidian/Knowledge Base_CMG. 설정: D:/Obsidian/KnowledgeGraphConfig/config.json. 세션별 입력 폴더를 좁게 추가하며 text 등록을 위해 빈 입력 root 목록도 허용한다.
- Codex 설치: obsidian-knowledge-graph@knowledge-graph-local 0.1.0. 기존 MG 원격 등록은 유지.

Ruling: pnpm-lock.yaml로 재현 가능한 의존성을 기록 — 이 런타임에는 npm 실행 파일이 없고 번들된 pnpm이 제공됨 — npm용 lockfile이 필요하면 별도로 생성해야 한다.
Ruling: 공용 카탈로그에 local-only 자료가 섞인 경우 Git sync 전체 차단 — 0.1에서 우회 노출을 막기 위한 fail-closed 선택 — 혼합 정책의 원격 projection은 후속 개선 필요.
Ruling: Git sync에 이미 요청받아 로컬 완료한 이전 미동기화 작업도 포함 — 전체 카탈로그가 참조하는 원본을 같은 커밋으로 제공 — preview에 포함 범위를 표시하며 개별 작업만 고립된 전송은 지원하지 않는다.
Ruling: 실제 선택된 Vault에 한해서 명령 단위 safe.directory 지정 — Windows 샌드박스와 사용자 소유자 차이를 해결 — 전역 Git 보안 설정은 변경하지 않는다.
Ruling: 실제 앱 연결과 fresh-chat 자연어 시험은 SDK 시험과 분리 — 현재 채팅에서는 설치한 도구 목록이 즉시 재로딩되지 않을 수 있음 — GUI 수용을 통과했다고 주장하지 않는다.

## 최종 독립 리뷰와 한 번의 수정 단계

리뷰어: final_review. 기준: 빈 tree → 0637507 전체 구현. 10개 지적을 각각 실제 원본 보존·원격 쓰기·검색·설치 결과에 비추어 재평가했고 모두 수정 대상으로 유지했다. 별도 재리뷰는 요청하지 않았다.

- Final: fixed #1 읽은 원본/주제/기록의 snapshot 해시 유지 — external source edit / manual topic edit during preview RED→GREEN, suite 37/37.
- Final: fixed #2 실제 push URL 단일 대상 확인·고정 — private fetch with separate push URL RED→GREEN, suite 37/37.
- Final: fixed #3 저장된 커밋의 포함 작업만 완료 처리 — retry uncertain earlier push leaves later captures pending RED→GREEN, suite 37/37.
- Final: fixed #4 푸시하는 전체 과거 커밋 소유권 확인 — unrelated outgoing local commit blocks registration RED→GREEN, suite 37/37.
- Final: fixed #5 Markdown 링크를 note 기준 상대경로로 생성·검증 — fallback links resolve relative to note RED→GREEN, suite 37/37.
- Final: fixed #6 명시적 recovery가 종료 writer만 회수 — dead writer recovery preserves live ownership RED→GREEN, suite 37/37.
- Final: fixed #7 수동 추출 경로·해시 검색과 누락 표시 — Inbox supplied extraction fallback and changed extraction RED→GREEN, suite 37/37.
- Final: fixed #8 bridge generator를 패키지에 포함하고 자체 위치에서 리소스 로드 — shipped bridge from unrelated folder RED→GREEN, suite 37/37.
- Final: fixed #9 원격만 앞선 깨끗한 Vault fast-forward·새 미리보기 요구 — clean behind-only Vault fast-forwards RED→GREEN, suite 37/37.
- Final: fixed #10 공유 구조 검사로 sync 깨진 링크 차단 — broken references block direct synchronization RED→GREEN, suite 37/37.

Ruling: fetch/push가 동일한 단일 URL인 원격만 허용 — 여러 목적지 중 미확인 저장소로 전송되는 경로 제거 — 별도 Private pushurl 구성도 지원하지 않는다.
Ruling: fast-forward 뒤 새 sync preview 요구 — 새 자료와 카탈로그를 검사한 뒤 범위 재확인 — 원격이 앞선 경우 한 번 더 동기화를 요청해야 한다.
Ruling: 전체 구현 저장소와 기록을 보존 — 사용자가 프로젝트 폴더에 결과를 요청했고 별도 스킬 bookkeeping 디렉터리는 만들지 않음 — 실행 스킬의 임시 workspace 정리 지시를 프로젝트 삭제로 해석하지 않는다.

Deferred minors: 없음. 공개 MG 게시·Claude GUI 실행·fresh-chat 자연어 수용·공식 manifest schema 검증은 통과로 표기하지 않고 외부 수용 항목으로 남긴다. Notion 0.2는 초기 범위 결정대로 후속이다.

## 최종 확인 (2026-10-12)

- 0.1.1 최종 소스: TypeScript 검사 통과, standalone 빌드 통과, 배포본 일관성·파일 제외 검사 통과.
- 전체 테스트 37/37 통과 (14개 파일). 최종 실행 17:05 KST. 40개 합성 검색 질문도 40/40 통과.
- Codex 실제 설치: obsidian-knowledge-graph@knowledge-graph-local 0.1.1, installed/enabled 확인. 설치 cache의 MCP 번들을 SDK로 실행, 별도 --config 없이 실제 사용자 location.json을 통해 도구 17개·Vault 경로·git_enabled true 확인.
- GitHub CLI로 Etchroot/Etchroot-knowledge-base isPrivate=true 재확인. 실제 Vault는 변경 없음·Inbox 0·미완료 작업 0. 개인 원본은 업로드하지 않았다.
- D:/Obsidian/KnowledgeGraphBridge와 두 로컬 marketplace payload를 0.1.1로 갱신. MG 기존 plugin 항목은 보존. 공개 원격 push·PR·main merge는 실행하지 않았다.
- 일상 사용 예: 새 Codex 채팅에서 “지식베이스 상태 확인해줘” → 작업 세션에서 최종 파일 지정 후 “이 최종본을 지식베이스에 등록해줘” → 필요할 때 “인박스 정리해줘”.
