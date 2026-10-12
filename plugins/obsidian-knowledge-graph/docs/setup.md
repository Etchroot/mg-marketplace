# 설치와 초기 설정

1. MG Marketplace에서 Obsidian Knowledge Graph를 설치합니다. 새 플러그인은 목록 업데이트 후 별도 설치가 필요합니다. 로컬 검증용 패키지도 같은 구조입니다.
2. 새 채팅에서 “지식베이스를 설정해줘”라고 합니다. `kg_status`가 보이면 MCP 연결이 된 것입니다. Node 24가 없으면 에이전트에게 준비를 요청합니다.
3. Vault·원본 입력 폴더를 지정합니다. 기본 후보 Vault는 `D:/Obsidian/Knowledge Base_CMG`입니다. 설정은 설치 위치 밖에 두며 기본 경로는 `~/.config/obsidian-knowledge-graph/config.json`입니다. `--config` 또는 KG_CONFIG_PATH로 별도 경로를 사용할 수 있습니다.
   `~/.config/obsidian-knowledge-graph/location.json`에 config_path를 기록하면 두 호스트의 배포본이 설치 위치·작업 폴더와 무관하게 같은 외부 설정을 사용합니다. 명시적인 --config와 환경변수가 우선합니다. 이 기기에서는 `D:/Obsidian/KnowledgeGraphConfig/config.json`을 참조합니다. 실제 자료는 `D:/Obsidian/Knowledge Base_CMG`에만 저장합니다.
   원본 폴더는 세션별로 지정한 최종 파일의 부모만 연결합니다. 빈 allowed_input_roots는 대화의 선택한 text 등록을 허용하지만 파일 경로 접근은 허용하지 않습니다.
4. 초기 설정 도구가 시스템 폴더와 읽기 안내를 생성합니다. 기존 자료는 자동 이동하지 않습니다.
5. 데이터 원격은 별도 Private GitHub 저장소입니다. Vault 자체에 Git init·origin·브랜치·Git identity·GitHub CLI 인증을 준비한 후 git.enabled를 켭니다. `kg_sync_commit`이 매번 Private 여부를 재검사합니다. Git을 꺼도 로컬 등록·정리·검색은 동작합니다.

플러그인 root 변수 치환이 호스트에서 실패하면 안정적인 bridge를 사용합니다. 구현 에이전트가 배포본의 `scripts/bridge.mjs`를 절대경로로 지정하고 `node <설치된 플러그인 절대경로>/scripts/bridge.mjs --directory D:/Obsidian/KnowledgeGraphBridge --config D:/Obsidian/KnowledgeGraphConfig/config.json`을 실행하면 절대경로 연결 정보가 생성됩니다. 어느 프로젝트 폴더에서 실행해도 배포본의 번들을 사용합니다. 사용자의 일상 CLI 조작은 필요하지 않습니다. Codex는 MCP 설정, Claude Code는 로컬 MCP 등록 기능에서 연결합니다. Claude 일반 채팅의 claude_desktop_config.json과 Code 모드의 설정은 서로 다릅니다. 정확한 현재 Code 설정 위치는 호스트 지원 절차로 확인합니다.

bridge를 연결할 때 기존 bundled MCP를 중복 활성화하지 않습니다. 업데이트 시 bridge JS도 같은 버전으로 교체하며 config와 Vault는 유지합니다. 생성된 등록 파일은 설정 조각이며 기존 앱 설정 전체를 덮어쓰는 파일이 아닙니다.

토큰을 대화나 설정 JSON에 넣지 않습니다. GitHub CLI의 OS 자격 증명 연결을 사용합니다. Notion은 0.1.1에서 비활성입니다.

개발용 로컬 마켓플레이스는 Codex CLI `plugin marketplace add <로컬 경로>`와 `plugin add obsidian-knowledge-graph@<marketplace>`로 검증할 수 있습니다. 실제 사용자 설치는 앱의 Plugins 화면을 사용합니다.
