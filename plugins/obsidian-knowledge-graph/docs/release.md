# 0.1.1 검증 상태

작성일: 2026-10-12. Node 24.19.0, MCP SDK 1.32.1, Zod 4.6.5, YAML 2.9.1. Codex CLI 0.162.0-alpha.17.2 확인. 빌드·테스트 결과는 docs/progress.md에 기록합니다.

합성 자료로 원본 보존·근거·검색·로컬 Git 원격·복원을 시험합니다. 전체 37개 테스트와 검색 질문 40개를 통과했습니다. Private 데이터 원격은 사용자 요청으로 Etchroot/Etchroot-knowledge-base에 생성하고 빈 시스템 구조를 push했습니다. 실제 개인 원본 등록과 Notion page는 아직 없습니다. 두 앱의 실제 GUI 수용 시험은 별도이며 SDK 클라이언트 시험과 동일하다고 주장하지 않습니다.

최종 독립 리뷰의 10개 지적은 재현 테스트 11개를 추가해 수정했습니다. 원본·주제 편집의 snapshot 해시, 단일 Private push 대상, 커밋에 포함된 작업만 성공 처리, 미승인 로컬 커밋 차단, 상대 링크, 종료한 writer 복구, 수동 추출 검색, 배포본 bridge, 깨끗한 Vault의 fast-forward, 동기화 전 구조 검증을 포함합니다. 호스트 manifest 공식 JSON Schema 검증은 수행하지 않았으며 로컬 일관성 검사와 Codex 실제 설치 결과만 확인했습니다.

MG Marketplace 등록 파일과 패키지를 로컬에서 준비합니다. 원격 main에 push한 뒤에야 사용자의 원격 marketplace 업데이트에 나타납니다. 현재 원격 게시 여부는 구현 기록을 확인하세요.

업데이트 → 신규 플러그인 설치 → 새 채팅 → setup → status/validate 순서입니다. 이후 버전은 설치한 플러그인의 update/reload도 확인합니다. Vault·config·credentials는 패키지에 포함하지 않습니다.
