# jev-model-harness 작업 규칙

이 폴더가 jev-model-harness 플러그인의 개발 원본입니다.
- 마켓플레이스 공통 규칙은 [루트 AGENTS.md](../../AGENTS.md)에 있고, 이 파일은 이 플러그인에만 해당하는 내용입니다.
- 설계, 결정 기록, 측정 결과는 [SPEC.md](SPEC.md)에 있으니 기능을 바꾸기 전에 먼저 읽습니다.

## 작업 순서

1. 수정합니다.
2. 이 폴더에서 `npm test`를 실행합니다.
3. 실행 파일을 바꿨다면 버전을 올립니다.
   - 이 폴더에서는 `npm run bump`로 실행합니다. 루트의 `node tools/bump.mjs jev-model-harness`와 같습니다.
   - `npm run bump`: 버그 수정, 문구 조정 (patch)
   - `npm run bump -- minor`: 기능 추가, 판단 기준 변경 (minor)
   - `npm run bump -- major`: 기존 사용자가 설정을 다시 해야 하는 변경 (major)
4. 마켓플레이스 루트에서 `node tools/check.mjs`를 실행해 통과하는지 확인합니다.
5. 커밋합니다. 예: `feat(jev-model-harness): ...`, `fix(jev-model-harness): ...`
   - 푸시는 사용자가 요청할 때만 합니다.

이 플러그인의 실행 파일은 `hooks/`, `scripts/`, `agents/`, `codex/`, 매니페스트예요.
`README.md`, `SPEC.md`, `AGENTS.md`, `test/`, `bench/`만 바꿨다면 버전을 올리지 않습니다.

## 지켜야 할 것

- **판단 기준값**(`scripts/lib/decide.mjs`의 0.8 / 0.5)이나 **Jev 질문 문구**(`scripts/lib/jev.mjs`)를 바꿀 때는 두 가지를 같이 합니다.
  - `node bench/measure.mjs holdout`으로 바꾸기 전과 후를 비교합니다.
  - 결과를 SPEC.md 9장(결정 기록)과 8.3장에 남깁니다. 측정에는 이 폴더 `.env`의 Jev 키가 필요합니다.
- **`.env`는 커밋하지 않습니다.** API 키는 코드, 문서, 커밋 메시지 어디에도 적지 않습니다.
- **플러그인 이름(`jev-model-harness`)은 바꾸지 않습니다.** 설치한 사람의 설정이 깨집니다.
- Codex 쪽 동작은 실제 Codex에서 아직 검증하지 않았습니다 (SPEC 11.3). Codex 관련 수정은 그 점을 커밋 메시지에 밝힙니다.
