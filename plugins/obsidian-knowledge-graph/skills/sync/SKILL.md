---
name: sync
description: 사용자가 등록·정리 작업을 GitHub에 반영하거나 실패한 동기화만 재시도하라고 요청할 때 사용한다.
---

# 작업 동기화

`kg_status`에서 pending_sync를 확인한다. `kg_recover(mode=inspect)`로 작업 ID·로컬 결과를 확인한 후 `kg_sync_preview` → `kg_sync_commit`, 또는 `kg_retry(destination=github)`를 사용한다.

카탈로그 일관성을 위해 이미 요청받고 완료된 이전 미동기화 등록도 함께 반영될 수 있다. preview의 changed_paths를 확인한다. 원본 파일 전체·다른 작업 폴더를 stage하지 않는다.

GIT_DIRTY_INDEX는 사람이 stage한 파일을 보존하고 멈춘다. GIT_DIVERGED는 이력을 보존한다. 자동 stash/rebase/reset/force-push를 하지 않는다. REMOTE_NOT_PRIVATE는 인증·Private 확인 전에는 전송하지 않는다. 원격 응답이 불명확하면 uncertain을 그대로 보고하고 재조회·retry한다.

0.1에서는 로컬 전용 기록이 공용 카탈로그에 섞인 Vault의 원격 sync를 POLICY_BLOCKED로 막는다. 조용히 정책을 완화하지 않는다. Notion은 후속 0.2 기능이며 현재 성공으로 보고하지 않는다.
