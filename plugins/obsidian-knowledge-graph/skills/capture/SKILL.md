---
name: capture
description: 사용자가 작업이 끝났다고 판단하고 최종 자료를 지식베이스·옵시디언에 등록하거나 보관해 달라고 명시적으로 요청할 때 사용한다.
---

# 최종 자료 등록

사용자의 등록 요청이 시작 조건이다. 응답 종료·파일 저장·세션 종료를 완료로 판단하지 않는다. 전체 대화·작업 폴더를 수집하지 않는다.

1. `kg_status`로 설정을 확인한다. 사용자가 지정한 파일 또는 확정한 본문만 선택한다. 대상이 명확하면 재확인하지 않는다. 여러 버전 중 대상이 불명확할 때만 확인한다.
   세션마다 원본 폴더가 다르면 사용자가 지정한 최종 파일의 상위 폴더만 기존 allowed_input_roots에 추가하는 setup을 수행한다. 기존 Vault·Git 설정은 유지하고 홈 전체를 입력 폴더로 열지 않는다. 대화에서 선택한 최종 본문은 text 입력으로 등록할 수 있으므로 빈 입력 폴더 목록도 허용한다.
2. `kg_capture_preview`에 다음 입력 중 정확히 하나와 title, type을 전달한다. type은 essay/journal/company_research/work/project/experience/reference/other다. 최종본과 실제 제출본은 document_status로 구분한다.
   - 외부 최종 파일: 허용 입력 폴더 안의 source_path 절대경로.
   - 확정한 대화 본문: text.
   - Obsidian에서 직접 쓴 기존 파일: `inbox_path: "00_Inbox/일기.md"` 같은 Vault 상대경로. 현재 위치에서 등록하며 추가 복사본과 입력 폴더 확대가 필요 없다. 새 유형이 불명확하면 원문을 kg_read(inbox_path, view=raw)로 확인한다.
   - 이미 등록된 원문을 직접 수정한 경우: 기존 record_id와 `modified_revision` 번호. 이전 바이트를 복원하고 수정본을 새 revision으로 등록하는 사용자 승인 범위에서만 실행한다. ORIGINAL_UNAVAILABLE이면 수정 파일을 그대로 두고 보류한다. 원문 해시를 수정본 해시로 덮어쓰지 않는다.
   외부 수정본은 source_path 또는 text에 기존 record_id를 함께 전달한다. 기존 기록의 유형과 보관 정책을 유지한다. 같은 Inbox 경로는 기존 기록을 재사용하며 이후 다른 내용은 새 revision이 된다. 서로 다른 파일은 내용이 같아도 별개 기록일 수 있다.
3. 보관 정책의 기본값은 agent_access=allowed, github=true, notion=false다. 사용자가 로컬만 보관하라고 하면 github=false다. 다른 정책을 임의로 추정하지 않는다. 기존 기록의 수정본은 같은 정책을 상속한다.
4. already_registered=true이면 새 commit 없이 반환된 record_id와 revision을 재사용한다. 나머지는 changed_paths와 action을 확인하고 `kg_capture_commit`으로 적용한다. action=preserve_modified_revision은 이전 경로 복원과 새 Inbox 경로 생성을 포함한다. action=remove_duplicate는 보존된 기존 원문과 동일한 Inbox 파일만 제거한다. 이 단계에서는 요약과 분류를 자동 수행하지 않는다.
5. Git이 켜져 있고 사용자가 원격 보관을 요청한 범위라면 `kg_sync_preview` → `kg_sync_commit`으로 GitHub에 반영한다. 최초의 설정된 등록 흐름은 그 저장·동기화 요청을 포함한다. 꺼져 있으면 로컬 성공과 연결 필요를 구분한다.
6. 기록 ID·revision·로컬 저장·GitHub 결과를 짧게 알린다. 실패한 원격 작업 때문에 로컬 성공을 실패로 덮지 않는다.

PDF/DOCX/HWP 등의 바이너리는 원본 그대로 보존한다. 자동 추출은 제공하지 않는다. 사용자나 신뢰한 도구가 원본에서 추출한 본문을 명시적으로 제공한 경우 extracted_text를 전달할 수 있다. 줄 번호는 추출본 기준이며 원본 페이지 번호를 만들지 않는다. 50 MiB 초과는 보류한다.

현재 버전은 Notion을 지원하지 않는다. 요청을 성공으로 표시하지 않고 종료 훅이나 예약 등록을 만들지 않는다.
