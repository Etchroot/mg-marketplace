---
name: setup
description: Obsidian 지식베이스 플러그인을 처음 설정하거나 Vault·입력 폴더·데이터 저장소 연결을 변경할 때 사용한다.
---

# 지식베이스 설정

1. `kg_status`로 현재 상태를 확인한다. 사용자는 Codex 앱 또는 Claude Code GUI에서 자연어로 작업한다.
2. 실제 Vault와 원본 입력 폴더의 절대경로를 사용자에게 확인한다. 기본 후보는 `D:/Obsidian/Knowledge Base_CMG`다. 데이터 GitHub 저장소는 MG Marketplace와 분리된 Private 저장소이며 이름을 추측하지 않는다.
3. `kg_setup_preview`에 `schema_version: 1`, `vault_path`, `allowed_input_roots`, `git: {enabled, remote, branch, push_on_capture: true}`, `notion: {enabled: false}`를 전달한다. 기존 설정이 있으면 유지한다. 새 Vault 폴더와 입력 폴더 준비는 사용자가 지정한 경로에서만 수행한다.
4. 결과가 요청 범위에 맞으면 `kg_setup_commit`에 preview ID를 전달한다. preview는 추가 승인 의례가 아니다. 기존 자료를 자동 분류하지 않는다.
5. `kg_status`와 `kg_validate`로 결과를 확인한다. 토큰은 도구 입력·대화·Vault·플러그인에 넣지 않는다.

Git을 켜려면 Vault 자체가 Git 저장소여야 하며 origin·브랜치·GitHub 인증·Private 여부를 확인해야 한다. 저장소 생성·원격 배포는 사용자가 요청한 경우에 수행한다. 연결 전까지 로컬 등록·검색은 사용할 수 있다. Notion 복사는 0.1.0에서 지원하지 않는다.

MCP 미연결이면 패키지의 `docs/setup.md`를 읽는다. 설치 root 변수 지원은 호스트별로 확인한다. 안정적인 bridge 등록을 사용할 수 있으며 동일 서버를 중복 연결하지 않는다.
