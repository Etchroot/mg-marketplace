# MG Marketplace 작업 규칙

이 저장소는 여러 플러그인을 담은 마켓플레이스입니다. 다른 PC와 에이전트가 자동 업데이트로 받아 쓰므로, 아래 규칙을 지켜야 변경이 빠짐없이 전달됩니다.

## 작업 순서 (모든 플러그인 공통)

1. 수정합니다. 플러그인 폴더(`plugins/<이름>/`)에 `AGENTS.md`가 있으면 먼저 읽고 따릅니다.
   - 지금 규칙 파일이 있는 플러그인: [jev-model-harness](plugins/jev-model-harness/AGENTS.md)
2. 그 플러그인에 테스트가 있으면 실행합니다. 예: `plugins/jev-model-harness`에서 `npm test`
3. **실행 파일을 바꿨다면** 루트에서 버전을 올립니다.
   ```bash
   node tools/bump.mjs <플러그인> [patch|minor|major]
   ```
   - 버전 숫자는 직접 고치지 않습니다. 스크립트가 아래를 한 번에 바꿉니다.
     - 그 플러그인의 버전 파일 (`plugin.json`, `.claude-plugin/`, `.codex-plugin/`, `package.json`)
     - 루트 README의 버전 표
     - `releases.json`
4. 루트에서 `node tools/check.mjs`를 실행해 통과하는지 확인합니다. 실패 메시지가 할 일을 알려줍니다.
5. 커밋합니다. 메시지 형식은 `feat(<플러그인>): ...`, `fix(<플러그인>): ...`, `docs(...)`, `chore(...)`입니다.
   - 푸시는 사용자가 요청할 때만 합니다.
   - 푸시하면 GitHub Actions(`.github/workflows/check.yml`)가 같은 검사를 다시 실행합니다.

## 실행 파일과 버전

설치한 사람이 새 버전을 받는 조건은 `plugin.json`의 `version`이 바뀌는 것입니다. 실행 파일을 바꾸고 버전을 그대로 두면 아무에게도 전달되지 않습니다.

| 구분 | 해당 파일 (플러그인 폴더 기준) | 버전 |
|---|---|---|
| 실행 파일 | 아래 "문서·개발용"이 아닌 **모든 파일** (`skills/`, `scripts/`, `hooks/`, `agents/`, `dist/`, 매니페스트 등) | **올림** |
| 문서·개발용 | `README.md`, `SPEC.md`, `AGENTS.md`, `CLAUDE.md`, `CHANGELOG.md`, `LICENSE*`, `docs/`, `examples/`, `test/`, `tests/`, `bench/`, `eval/`, `tools/`, `.env.example`, `package.json`의 `scripts`·`devDependencies` | 올리지 않음 |

이 구분은 `tools/lib.mjs`의 `NON_RUNTIME`에 정의돼 있습니다. 애매하면 실행 파일로 봅니다.

버전 종류는 다음과 같이 정합니다.
- `patch`: 버그 수정, 문구 조정
- `minor`: 기능 추가, 동작 기준 변경
- `major`: 기존 사용자가 설정이나 이름을 다시 맞춰야 하는 변경

## 플러그인 추가·이름 변경

- 플러그인을 추가할 때는 아래를 함께 합니다. 그다음 `node tools/check.mjs`로 확인합니다.
  - `plugins/<이름>/` 폴더 만들기
  - 두 카탈로그에 등록하기: `.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json`
  - 루트 README 표에 행 추가하기
  - `node tools/bump.mjs <이름> record`로 첫 기록 남기기 (버전은 그대로)
- 이름 변경은 설치한 사람의 설정을 깨뜨립니다. 카탈로그의 `renames`를 쓰고 major로 올립니다.

## 그 밖에

- **이 저장소에는 플러그인·스킬과 관리 도구만 둡니다.** 플러그인으로 만든 결과물과 개인 데이터는 넣지 않습니다.
  - 결과물 예: 자소서, 경험 기록, 곡, 지식베이스 자료
  - 사용자가 공개를 원하더라도 이 저장소가 아닌 다른 곳에 둡니다.
- `.env`와 API 키는 커밋하지 않습니다.
- 마무리 전에 `claude plugin validate .`와 `claude plugin validate ./plugins/<이름>`을 실행합니다. CLI가 있을 때만 해당합니다.
