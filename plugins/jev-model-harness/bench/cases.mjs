// 측정용 요청 모음. expect: 허용되는 결과들 ('light' / 'mid' / 'main' 단계. 플랫폼과 무관)
// tuning: 질문 문구를 고칠 때 본 요청들. holdout: 문구를 고칠 때 보지 않은 검증용 요청들.

export const tuning = [
  { prompt: '이 프로젝트에서 lotto라는 단어가 들어간 파일 전부 찾아줘', expect: ['light'] },
  { prompt: 'src 폴더 구조 전체를 읽고 각 파일이 하는 일을 요약해줘', expect: ['light'] },
  { prompt: 'Node.js에서 fetch에 타임아웃 거는 방법을 공식 문서에서 찾아서 정리해줘', expect: ['light'] },
  { prompt: 'git log 최근 20개 커밋을 읽고 변경 내용을 카테고리별로 정리해줘', expect: ['light'] },
  { prompt: 'scripts/lib/decide.mjs의 임계값을 환경변수로 바꿀 수 있게 기능을 추가하고 테스트도 작성해줘', expect: ['mid'] },
  { prompt: '로그인 화면에 비밀번호 표시/숨기기 버튼을 추가해줘. 파일은 src/Login.tsx야', expect: ['mid'] },
  { prompt: 'README.md의 설치 섹션에 macOS 설치 방법을 추가해줘', expect: ['mid', 'main'] },
  { prompt: '테스트가 실패하는데 원인 찾아서 고쳐줘', expect: ['mid', 'main'] },
  { prompt: '결제 모듈 전체 아키텍처를 다시 설계하고 마이그레이션 계획까지 세워줘', expect: ['main'] },
  {
    prompt: '응 그렇게 해줘',
    previous: '측정 스크립트를 만들어 두었어요. 다음 단계로 실제 Jev 키로 돌려볼까요?',
    expect: ['main'],
  },
  { prompt: '방금 정한 R4 규칙에서 숫자 뭐였지?', expect: ['main'] },
  { prompt: '그거 다시 한 번 설명해줘', previous: '캐시 수명은 요청 시작 시각부터 셉니다.', expect: ['main'] },
  { prompt: 'SDD가 뭐야?', expect: ['main'] },
  { prompt: '이 변수 이름 하나만 userCount로 바꿔줘', expect: ['main'] },
  {
    prompt: '1번이랑 3번 중에 뭐가 나아?',
    previous: '방법은 세 가지예요. 1) .env 파일 2) Windows 환경변수 3) 플러그인 설정',
    expect: ['main'],
  },
  { prompt: '앞에서 만든 플러그인에 Slack 알림 기능을 붙이려면 구조를 어떻게 바꿔야 할지 같이 고민해보자', expect: ['main'] },
];

export const holdout = [
  { prompt: '프로젝트 전체에서 TODO 주석 달린 곳을 목록으로 뽑아줘', expect: ['light'] },
  { prompt: 'tests 폴더에 있는 테스트 케이스 이름을 전부 정리해줘', expect: ['light'] },
  { prompt: 'MDN에서 AbortSignal.timeout의 브라우저 지원 범위 확인해줘', expect: ['light'] },
  { prompt: 'package.json에 어떤 스크립트들이 있는지 알려줘', expect: ['light', 'main'] },
  { prompt: 'store.mjs에 30일 지난 세션 상태 파일을 지우는 기능을 추가해줘', expect: ['mid'] },
  { prompt: '회원가입 폼에 이메일 형식 검사를 넣어줘. 파일은 src/Signup.tsx', expect: ['mid'] },
  { prompt: 'decide.mjs 테스트를 경계값 위주로 더 추가해줘', expect: ['mid'] },
  { prompt: 'hooks.json의 timeout을 3초로 바꾸고 README에도 반영해줘', expect: ['mid', 'main'] },
  { prompt: '좋아 그걸로 가자', previous: 'A안과 B안이 있는데, 저는 A안을 추천해요.', expect: ['main'] },
  { prompt: '아까 말한 두 번째 방법으로 바꿔줘', expect: ['main'] },
  { prompt: '왜 그렇게 생각해?', previous: '이 구조에서는 메인 모델을 Opus로 두는 게 낫다고 봐요.', expect: ['main'] },
  { prompt: '프롬프트 캐시가 뭐야?', expect: ['main'] },
  { prompt: '우리 서비스를 멀티테넌트로 바꾸려면 데이터베이스 설계를 어떻게 해야 할까?', expect: ['main'] },
  { prompt: '플러그인 전체 구조를 다시 검토하고 v2 로드맵을 짜줘', expect: ['main'] },
];
