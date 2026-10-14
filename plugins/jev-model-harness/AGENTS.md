# jev-model-harness 작업 규칙

이 폴더가 jev-model-harness 플러그인의 개발 원본입니다. 설계, 결정 기록, 측정 결과는 [SPEC.md](SPEC.md)에 있으니 기능을 바꾸기 전에 먼저 읽습니다.

## 작업 순서

1. 수정합니다.
2. `npm test`를 실행합니다.
3. **실행 파일**(아래 표)을 바꿨다면 `npm run bump`로 버전을 올립니다.
   - 버전 숫자는 직접 고치지 않습니다. 스크립트가 아래를 한 번에 바꿉니다.
     - 매니페스트 3개와 `package.json`
     - 마켓플레이스 README의 버전 표
     - `release.json`
   - 실행 파일을 바꾸고 버전을 올리지 않으면 `npm test`가 실패합니다. 실패 메시지가 bump를 안내합니다.
4. `npm test`를 다시 실행해서 모두 통과하는지 확인합니다.
5. 커밋합니다. 메시지는 이 저장소 형식을 따릅니다.
   - 예: `feat(jev-model-harness): ...`, `fix(jev-model-harness): ...`, `docs(jev-model-harness): ...`
   - 푸시는 사용자가 요청할 때만 합니다.

## 버전을 올리는 경우

| 바꾼 것 | 버전 | 이유 |
|---|---|---|
| `hooks/`, `scripts/`, `agents/`, `codex/`, 매니페스트(`plugin.json`, `.claude-plugin/`, `.codex-plugin/`) | **올림** | 설치한 사람의 동작이 바뀝니다. 버전이 같으면 업데이트가 전달되지 않습니다 |
| `README.md`, `SPEC.md`, `AGENTS.md`, `test/`, `bench/`, `tools/` | 올리지 않음 | 설치한 사람의 동작과 관계없습니다 |

올리는 정도는 다음과 같이 정합니다.
- `npm run bump`: 버그 수정, 문구 조정 (patch, 0.2.1 → 0.2.2)
- `npm run bump -- minor`: 기능 추가, 판단 기준 변경 (minor, 0.2.1 → 0.3.0)
- `npm run bump -- major`: 설정이나 이름이 바뀌어 기존 사용자가 무언가를 다시 해야 하는 변경 (major)

## 지켜야 할 것

- **판단 기준값**(`scripts/lib/decide.mjs`의 0.8 / 0.5)이나 **Jev 질문 문구**(`scripts/lib/jev.mjs`)를 바꿀 때는 두 가지를 같이 합니다.
  - `node bench/measure.mjs holdout`으로 바꾸기 전과 후를 비교합니다.
  - 결과를 SPEC.md 9장(결정 기록)과 8.3장에 남깁니다. 측정에는 `.env`의 Jev 키가 필요합니다.
- **`.env`는 커밋하지 않습니다.** API 키는 코드, 문서, 커밋 메시지 어디에도 적지 않습니다.
- **플러그인 이름(`jev-model-harness`)은 바꾸지 않습니다.** 설치한 사람의 설정이 깨집니다.
  - 꼭 바꿔야 하면 마켓플레이스 카탈로그의 `renames`를 쓰고 major 버전을 올립니다.
- 이름이나 버전을 바꿀 때는 두 카탈로그를 함께 확인합니다.
  - `.claude-plugin/marketplace.json`
  - `.agents/plugins/marketplace.json`
- Codex 쪽 동작은 실제 Codex에서 아직 검증하지 않았습니다 (SPEC 11.3). Codex 관련 수정은 그 점을 커밋 메시지에 밝힙니다.
- 마무리 전에 마켓플레이스 루트에서 `claude plugin validate ./plugins/jev-model-harness`를 실행합니다.
