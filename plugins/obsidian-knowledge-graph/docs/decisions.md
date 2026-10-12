# 설계 결정

- GUI 자연어와 로컬 MCP를 인터페이스로 사용한다. 웹·벡터 DB·별도 LLM 호출은 없다.
- 의미 요약은 호스트 AI, 저장·검증·검색·동기화는 결정적 TypeScript 코드가 담당한다.
- Git 데이터 저장소와 플러그인 저장소·설치 캐시를 분리한다.
- JSON catalogs는 재생성 가능하고 원본·기록 IDs·수동 편집은 보존한다.
- 0.1은 단순 혼합 정책의 원격 공유를 차단한다. 안전한 원격 projection은 후속 개선이다.
- 같은 revision의 요약 덮어쓰기보다 새 revision을 사용한다.
- Git 동기화에는 이전 완료된 미동기화 작업을 함께 포함하여 카탈로그 참조의 원본 누락을 막는다.
- Notion은 0.2 별도 범위이며 초기 버전에 토큰 입력·API 호출을 만들지 않는다.

공식 계약 참고: [OpenAI 플러그인](https://developers.openai.com/plugins/build/plugins), [Claude Code manifest](https://code.claude.com/docs/en/plugins-reference), [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk).
