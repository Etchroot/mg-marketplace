# 데이터 형식과 로컬 CLI

Python 3.10 이상, 표준 라이브러리만 사용한다. 네트워크·검색·모델 호출은 없다. 웹 조사와 인터뷰는 호스트의 스킬이 수행한다.

## 저장 위치

`--data-dir`는 필수다. 사용자 지정 개인 폴더를 우선하며 기본 제안은 마켓플레이스의 형제 `career-data` 폴더다. 도구는 `.git` 폴더/파일이 있는 Git checkout 안의 데이터 경로를 거부한다. 파일 쓰기 권한은 호스트에서 확인한다. 읽기·쓰기 시 사용자의 실제 현지 날짜를 `--today`로 전달한다.

명령의 `career_store.py`는 이 스킬의 `scripts/career_store.py` 실제 절대 경로로 바꿔 실행한다. 아래 PRIVATE_DIR은 개인 폴더, INPUT은 그 안에 저장한 입력 파일 경로이다.

```sh
python -B career_store.py --data-dir PRIVATE_DIR --today YYYY-MM-DD summary --scope "AI 엔지니어"
python -B career_store.py --data-dir PRIVATE_DIR --today YYYY-MM-DD next --scope "AI 엔지니어"
python -B career_store.py --data-dir PRIVATE_DIR --today YYYY-MM-DD import-batch --scope "AI 엔지니어" --input INPUT
python -B career_store.py --data-dir PRIVATE_DIR --today YYYY-MM-DD checkpoint --id QUESTION_ID --input INTERVIEW_JSON
python -B career_store.py --data-dir PRIVATE_DIR --today YYYY-MM-DD save-answer --id QUESTION_ID --answer ANSWER_TXT --experiences EXPERIENCES_JSON
python -B career_store.py --data-dir PRIVATE_DIR --today YYYY-MM-DD status --id QUESTION_ID --value on_hold
```

`--company`는 next의 선택 필터다. 기업별 작업 범위는 `"기업명 / 직무"`처럼 scope를 일관되게 정한다. 같은 직무의 기존 scope와 관련 자료가 있으면 먼저 확인하고 필요하면 해당 개인 catalog에서 경험을 참고한다. scope는 자유 텍스트이므로 직무 유사도나 회사 별칭은 에이전트가 판단한다.

## import-batch 입력

질문 객체 1~50개의 JSON 배열이다. 아래는 **허구 형식 예시**이며 실제 질문 풀로 수집하거나 추천하지 않는다. 날짜는 형식 설명용 고정 값이고 실행 시 실제 공고 날짜와 사용자 요청일을 사용한다.

```json
[
  {
    "company": "가상기업",
    "role": "AI 엔지니어",
    "recruitment_cycle": "2026 하반기",
    "posting_date": "2026-09-01",
    "posting_date_basis": "공식 공고 게시일",
    "posting_date_source_url": "https://example.invalid/jobs/123",
    "posting_summary": "허구 공고: 모델 평가 업무",
    "closing_date": null,
    "recruitment_status": "unknown",
    "source_site": "허구 사이트",
    "source_url": "https://example.invalid/jobs/123",
    "source_kind": "posting",
    "question_text": "문제를 해결한 경험을 설명하세요.",
    "length_limit": 500,
    "length_count_mode": "codepoints",
    "verification_status": "verified",
    "evidence_excerpt": "허구 예시의 날짜·기업·직무·문항 근거",
    "fetched_at": "2026-10-08",
    "verified_at": "2026-10-08"
  }
]
```

필수 문자열: company, role, posting_date, posting_date_basis, posting_date_source_url, posting_summary, source_site, source_url, question_text, evidence_excerpt, fetched_at, verified_at. 검증일·수집일은 YYYY-MM-DD로 적는다. 검증 상태는 `verified`여야 한다. 과거 합격 예시와 현재 채용공고의 연결을 확인하지 못했으면 입력에서 제외한다.

length_limit과 length_count_mode는 미확인이면 null. 계산법: codepoints, utf16, codepoints_no_spaces, utf16_no_spaces. no_spaces는 모든 유니코드 공백을 제외하므로 지원 UI가 다르게 계산하면 그 차이를 표시한다. 제한은 있는데 계산법만 미확인이면 UTF-16 포함 계산을 보수적으로 적용하며, UI와 동일하다고 하지 않는다.

scope의 기존 유효 pending/in_progress가 남아 있으면 새 import를 거부한다. 사용자가 나머지를 보류/폐기하고 새 자료를 원한 경우에만 `--replace-remaining on_hold` 또는 `discarded`를 추가한다. 새 고유 질문이 0개면 교체도 수행하지 않는다. 실제 문항이 50개 미만이면 actual과 target을 구분해 보고한다.

## checkpoint 입력

```json
{
  "summary": "현재까지 확인된 내용의 요약",
  "user_statements": ["사용자가 실제로 한 말"],
  "confirmed_facts": ["사용자 진술로 확인한 본인 역할"],
  "unknowns": ["아직 확인하지 못한 결과"],
  "hypotheses": ["대화 중 검토하는 해석"],
  "next_question": "다음에 이어서 물을 질문"
}
```

질문 상태가 pending/in_progress일 때만 checkpoint 가능하다. 보류·폐기·완료한 질문을 새로 인터뷰하려면 사용자 지시에 따라 status pending으로 명시적으로 재개한다. 완료 답변은 새 버전으로 수정할 수 있다.

## 답변과 경험

answer 파일은 코드 펜스나 해설 없는 **실제 본문**이다. UTF-8 BOM만 제거하며 공백·개행은 보존해 계산한다. 마지막 개행도 포함되므로 최종 저장할 정확한 본문을 입력한다.

experiences JSON은 배열이다. 각각 situation, role, actions, result, learning, evidence가 필요하며 reason, tags, period, unknowns를 추가할 수 있다. evidence에는 사용자의 진술이나 해당 개인 인터뷰 파일의 근거 위치를 기록한다. 기존 카드는 catalog의 실제 `e-...` ID를 전달하고, 새 카드는 id를 생략한다. 사용자 근거가 없는 가상의 성과를 채우지 않는다. 동기 중심 문항 등 사건 카드가 불필요하면 빈 배열을 쓸 수 있다.

`--draft`는 글자 수 초과나 부족한 사실을 표시한 초안을 저장하고 in_progress로 유지한다. 완성본은 확인된 제한을 넘으면 저장을 거부하며 성공 시 completed가 된다. 직접 status completed로 바꿀 수 없다.

## 저장 구조와 복구

```text
PRIVATE_DIR/
  catalog.json
  batches/<batch-id>.json
  interviews/<question-id>.md
  answers/<question-id>/answer-v001.md
  answers/<question-id>/draft-v002.md
  experiences/<experience-id>.json
  experiences/<experience-id>.md
```

catalog.json은 상태와 사용자 진술·답변·경험 버전을 모두 담는 **기준 파일**이다. 나머지는 사람이 읽을 문서다. 배치 JSON은 수집 목록의 스냅샷이며 최신 상태는 catalog에서 조회한다. question ID는 24자리 해시, experience ID는 e-로 시작하는 16자리 랜덤 ID다.

쓰기 작업은 .lock으로 동시 실행을 거부하고 임시 파일을 원자 교체한다. 전체 저장에 실패하면 기준 catalog를 완료 상태로 변경하지 않으며 이미 변경한 파생 문서도 이전 내용으로 복원한다. 보류·폐기한 문항은 명시적으로 재개하기 전 답변 저장을 거부한다. 오류가 났을 때 파생 파일만 보고 완료라고 하지 않고 catalog와 종료 코드를 먼저 확인한다. 전원 차단 같은 운영체제 장애에 대한 다중 파일 원자성은 보장하지 않는다. 기존 catalog를 보존·백업하고 기준 파일에서 다시 복구한다. 프로세스가 강제 종료되어 .lock이 남았으면 작업이 실제 끝났는지 확인한 후 잠금을 해제하며 자동으로 삭제하지 않는다.
