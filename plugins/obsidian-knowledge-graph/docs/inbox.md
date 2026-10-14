# Obsidian에서 직접 쓴 자료

일기와 메모, 스크랩은 `00_Inbox` 안에 작성한다. 하위 폴더도 사용할 수 있다. 본문만으로 시작할 수 있으며 UUID나 YAML 메타데이터를 직접 작성할 필요는 없다.

Obsidian Git의 commit-and-sync는 파일을 GitHub에 올린다. 지식그래프 기록, 요약과 분류는 이후 Codex 또는 Claude Code에서 “Inbox 정리해줘”라고 요청할 때 생성한다. 자동 등록이나 자동 분류는 하지 않는다.

| 목록 상태 | 처리 |
| --- | --- |
| unregistered | 기존 Inbox 경로에서 기록을 등록하고 분류할 때 원본을 한 번 이동 |
| registered | 원문 근거를 확인해 분류와 요약 생성 |
| modified | 이전 원문을 복원해 보존하고 수정본을 새 revision으로 등록 |
| missing | 원본 경로를 찾을 수 없으므로 보류 |

`kg_status`는 registered_inbox_count와 unregistered_inbox_count를 합한 inbox_count를 보여준다. modified_source_count에는 이미 분류한 원문을 직접 수정한 경우도 포함한다. `kg_inbox_list`는 위 상태를 함께 최대 10개씩 반환한다. 본문 전체를 목록에 싣지 않는다. 등록이나 이동 뒤 목록이 바뀌면 cursor를 다시 시작한다.

미등록 자료는 `kg_read(inbox_path="00_Inbox/메모.md", view="raw")`로 읽고 `kg_capture_preview(inbox_path=..., title=..., type=...)`와 commit으로 등록한다. 원문은 같은 경로에 남고 기록과 검색용 카탈로그가 생긴다. 별도 복사본은 만들지 않는다. 같은 경로를 반복 등록하면 기존 ID와 revision을 돌려준다. 원문이 그대로여도 document_status를 final에서 submitted로 명시적으로 바꾸면 새 revision으로 보존한다.

정리 후 같은 Inbox 경로에 다른 내용이 생기면 기존 기록의 새 revision으로 등록한다. 경로 자체가 기록의 이어지는 출처라는 기준이다. 독립적인 일기는 날짜별 파일명을 사용한다. 내용이 같은 별개 경로를 해시만으로 하나의 기록으로 합치지 않는다. 기존 위치와 동일한 바이트의 파일을 다시 넣었다면 미리보기에서 중복 Inbox 파일 제거를 확인할 수 있다.

등록된 원문을 직접 수정하면 `kg_capture_preview(record_id=..., modified_revision=..., title=..., type=...)`로 새 버전을 만든다. 로컬의 완료된 작업 기록 또는 해당 경로의 최근 Git 커밋 최대 100개에서 기존 SHA-256과 일치하는 바이트를 찾는다. 네트워크 요청은 하지 않는다. 이전 원문을 원래 경로로 복원하고 수정 바이트를 새 Inbox revision에 저장한다. 기존 요약과 링크는 유지한다. Obsidian에서 열어 둔 이전 원문 탭은 복원된 내용으로 바뀌므로 이후 작업은 새 revision을 사용한다.

기존 바이트를 확보할 수 없으면 ORIGINAL_UNAVAILABLE로 보류한다. 수정 파일을 덮어쓰거나 과거 원문을 추정하지 않는다. 미리보기 후 다시 편집한 원문은 HASH_CONFLICT로 적용을 막는다. 중단된 적용은 기존 recover 절차로 이어갈 수 있다.

검색은 등록된 카탈로그를 대상으로 한다. 미등록 파일은 fallback=raw_text에도 포함하지 않고 coverage.unregistered_inbox_count로 누락을 알린다. status와 Inbox 목록의 변경 수는 Vault 전체 기준이며 검색 coverage의 변경 수는 조회 조건 안의 등록 원문 기준이다.

직접 작성한 파일은 최대 50 MiB의 일반 파일이어야 한다. Markdown과 UTF-8 텍스트를 읽을 수 있다. 바이너리는 보관할 수 있지만 별도 추출 텍스트 없이 요약하지 않는다. 숨김 파일과 폴더, 심볼릭 링크와 Windows junction은 직접 탐색 대상에서 제외한다. 등록된 agent_access=excluded 자료는 직접 Inbox 경로로 우회해 읽거나 재등록할 수 없다. 한 번의 탐색은 최대 10000개 항목과 32단계 하위 폴더로 제한하며 초과하면 보류한다.

Obsidian에서 만든 수동 커밋은 먼저 Obsidian Git으로 푸시한 뒤 에이전트 정리를 진행한다. 아직 푸시하지 않은 수동 커밋은 기존 GIT_UNOWNED_COMMITS 검사에 걸릴 수 있다. 에이전트 동기화는 자신이 등록하고 정리한 경로만 대상으로 하며, 나머지 미등록 초안을 함께 올리지 않는다. 데이터 저장소는 계속 Private이어야 한다. Notion 연결과 자동 문서 추출은 현재 지원하지 않는다.
