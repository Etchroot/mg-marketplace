# Obsidian Knowledge Graph

Codex 앱과 Claude Code에서 개인 Markdown Vault를 지식 저장소로 사용하는 **로컬 플러그인 0.1.1**입니다. Obsidian 실행은 필요하지 않습니다.

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
