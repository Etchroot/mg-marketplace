# MG Marketplace 작업 규칙

- 플러그인을 수정할 때는 해당 폴더(`plugins/<이름>/`)에 `AGENTS.md`가 있으면 먼저 읽고 따릅니다.
  - 지금 규칙 파일이 있는 플러그인: [jev-model-harness](plugins/jev-model-harness/AGENTS.md)
- 플러그인을 추가하거나 이름을 바꿀 때는 두 카탈로그를 함께 고칩니다.
  - `.claude-plugin/marketplace.json`
  - `.agents/plugins/marketplace.json`
  - 루트 README의 플러그인 표도 함께 고칩니다.
- 마무리 전에 `claude plugin validate .`를 실행합니다.
