---
name: capture
description: 사용자가 작업이 끝났다고 판단하고 최종 자료를 지식베이스·옵시디언에 등록하거나 보관해 달라고 명시적으로 요청할 때 사용한다.
---

# 최종 자료 등록

사용자의 등록 요청이 시작 조건이다. 응답 종료·파일 저장·세션 종료를 완료로 판단하지 않는다. 전체 대화·작업 폴더를 수집하지 않는다.

1. `kg_status`로 설정을 확인한다. 사용자가 지정한 파일 또는 확정한 본문만 선택한다. 대상이 명확하면 재확인하지 않는다. 여러 버전 중 대상이 불명확할 때만 확인한다.
   세션마다 원본 폴더가 다르면 사용자가 지정한 최종 파일의 상위 폴더만 기존 allowed_input_roots에 추가하는 setup을 수행한다. 기존 Vault·Git 설정은 유지하고 홈 전체를 입력 폴더로 열지 않는다. 대화에서 선택한 최종 본문은 text 입력으로 등록할 수 있으므로 빈 입력 폴더 목록도 허용한다.
2. `kg_capture_preview`에 `source_path` 또는 `text` 중 하나, `title`, `type`을 전달한다. type은 essay/journal/company_research/work/project/experience/reference/other다. 수정본은 기존 record_id를 명시한다. 최종본과 실제 제출본은 document_status로 구분한다.
3. 보관 정책의 기본값은 agent_access=allowed, github=true, notion=false다. 사용자가 로컬만 보관하라고 하면 github=false다. 다른 정책을 임의로 추정하지 않는다. 기존 기록의 수정본은 같은 정책을 상속한다.
4. `kg_capture_commit`으로 preview를 적용한다. 이 단계에서는 요약·분류를 자동 수행하지 않는다.
5. Git이 켜져 있고 사용자가 원격 보관을 요청한 범위라면 `kg_sync_preview` → `kg_sync_commit`으로 GitHub에 반영한다. 최초의 설정된 등록 흐름은 그 저장·동기화 요청을 포함한다. 꺼져 있으면 로컬 성공과 연결 필요를 구분한다.
6. 기록 ID·revision·로컬 저장·GitHub 결과를 짧게 알린다. 실패한 원격 작업 때문에 로컬 성공을 실패로 덮지 않는다.

PDF/DOCX/HWP 등의 바이너리는 원본 그대로 보존한다. 자동 추출은 제공하지 않는다. 사용자나 신뢰한 도구가 원본에서 추출한 본문을 명시적으로 제공한 경우 extracted_text를 전달할 수 있다. 줄 번호는 추출본 기준이며 원본 페이지 번호를 만들지 않는다. 50 MiB 초과는 보류한다.

Notion 요청은 0.1.0에서 지원 불가라고 알려주고 성공으로 표시하지 않는다. 종료 훅이나 예약 등록을 만들지 않는다.
