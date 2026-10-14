# Obsidian Knowledge Graph

## 직접 작성한 Inbox 자료

Obsidian에서 일기와 메모를 `00_Inbox`에 작성하고 이후 “Inbox 정리해줘”라고 요청할 수 있습니다. 미등록 파일을 하위 폴더까지 탐색하고 현재 위치에서 등록한 뒤 분류할 때 한 번만 이동합니다. 같은 경로의 반복 등록은 기록을 늘리지 않습니다.

이미 등록된 원문을 수정하면 이전 바이트를 복원해 보존하고 수정본을 새 revision으로 등록합니다. 이전 바이트를 확보할 수 없으면 보류합니다. [직접 작성 흐름과 제한](docs/inbox.md)을 확인하세요.

## 0.1.2: 옵시디언에서 읽기 쉬운 정리

원본과 요약은 제목 기반 파일명을 사용합니다. UUID·revision·원본 해시는 내부 메타데이터로 유지하며, 같은 제목은 짧은 구분자로 충돌을 피합니다. 모든 `essay` 요약은 `30_Topics/자기소개서.md` 허브에 직접 연결되고 다음 정리 때 목록이 자동으로 확장됩니다. 개별 주제 연결은 유지합니다.

정리 commit 전체가 성공한 뒤 비어 있는 Inbox revision·기록 폴더만 제거합니다. `00_Inbox`와 미분류 revision, 다른 메모가 남은 폴더는 보존합니다. 기본 그래프는 원본·시스템 문서와 고립 노드를 제외하여 요약·허브·주제를 중심으로 표시합니다.

기존 자료의 명시적 마이그레이션:

```sh
node dist/cli.cjs migrate-readable --config /absolute/path/config.json
node dist/cli.cjs migrate-readable --config /absolute/path/config.json --apply
```

첫 명령은 preview만 만들고 두 번째 명령은 최신 상태를 다시 확인하여 적용합니다. 원본 바이트·ID·수동 설명·코드 예시를 보존하고 기존 요약·주제·`40_Collections` 목차의 실제 링크와 카탈로그를 갱신합니다. 자동 실행하지 않습니다. 적용 결과의 operation_id로 Git sync preview/commit을 별도로 실행합니다. 지원 폴더 밖의 수동 노트에 수정할 링크가 있으면 적용 전에 POLICY_BLOCKED로 멈춥니다. 해당 노트를 `40_Collections`로 옮긴 뒤 다시 요청하세요.

Marketplace 패키지는 실행 번들과 함께 소스·합성 회귀 테스트를 포함합니다. 개인 Vault·기기 설정·자격 증명은 포함하지 않습니다.

Codex 앱과 Claude Code에서 개인 Markdown Vault를 지식 저장소로 사용하는 로컬 플러그인입니다. Obsidian 실행은 필요하지 않습니다.

## 사용하는 방법

- “이 최종본을 지식베이스에 등록해줘”: 선택한 원본을 Inbox에 저장합니다.
- “인박스 정리해줘”: AI가 원문 근거를 가진 요약을 만들고 주제·자료를 연결합니다.
- “AI 네이티브 관련 자소서를 작성한 적 있나?”: 짧은 후보 → 요약·주제 → 필요한 원문 순서로 찾습니다.
- “지난 등록을 GitHub에 반영해줘”: 작업 영수증을 기준으로 동기화합니다.

Node 24·Git이 필요합니다. GitHub 원격 쓰기에는 인증된 GitHub CLI와 Private 데이터 저장소가 필요합니다. MG Marketplace는 플러그인 배포용이며 개인 자료 저장소와 분리합니다.

[설치·초기 설정](docs/setup.md) · [운영과 제한](docs/operations.md) · [복원](docs/restore.md) · [검증 상태](docs/release.md).

현재 Notion 복사와 자동 PDF/DOCX/HWP 추출은 제공하지 않습니다. 바이너리는 보존하며 명시적으로 제공된 추출 텍스트를 연결할 수 있습니다. 기존 요약의 자동 재작성은 막아 사람의 편집을 보존합니다. GUI 설치·자연어 실행은 호스트별 수용 시험 결과를 확인하세요.

## 개발

설치 후 `npm run typecheck`, `npm test`, `npm run build`, `npm run check:package`, `npm run package`를 실행합니다. pnpm도 동일 scripts를 사용할 수 있습니다. 배포본은 JS 의존성을 번들링하므로 설치 시 npm 실행이 필요하지 않습니다.

등록·정리는 명시적인 지시에서만 시작합니다. 종료 훅·watcher·예약 업로드는 포함하지 않습니다. 설정·인증·원본은 설치 캐시 밖에 둡니다.
