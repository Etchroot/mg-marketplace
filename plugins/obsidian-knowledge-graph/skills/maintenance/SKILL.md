---
name: maintenance
description: 지식베이스의 깨진 링크·원본 변경·카탈로그 손상을 검사하거나 중단 작업을 복구하려 할 때 사용한다.
---

# 검사와 복구

`kg_validate`로 오류를 확인한다. 원본·요약이 정상이고 카탈로그만 오래됐으면 `kg_rebuild_catalog` 후 재검사한다. 이 도구는 원본·수동 본문을 고치지 않는다.

중단 작업은 `kg_status` → `kg_recover(mode=inspect)`로 단계와 경로를 확인한다. 사용자가 복구를 요청한 작업에 `mode=resume`을 사용한다. 실제 해시가 다르면 덮어쓰지 않고 보류한다.

writer.lock을 시간만 보고 지우지 않는다. owner.json의 프로세스 종료 여부와 applying 저널을 확인한 후 운영 문서의 복구 절차를 따른다. .kg-runtime은 Git에서 복구되지 않는다. 자동 삭제·새 원본 추정·종료 훅·예약 백업을 만들지 않는다.
