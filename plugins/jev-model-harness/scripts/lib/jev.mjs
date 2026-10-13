// Jev REST API 호출 (SPEC 4장). https://docs.typesafe.ai/api
// 질문과 기준표는 영어로 쓰고(주 학습 언어), 예시와 state만 한국어로 둔다. 질문은 긍정문으로 쓴다.

export const QUESTIONS = {
  standalone: {
    type: 'noul',
    instructions:
      'Can a worker who can open the project files, but cannot see the chat history, complete this request?',
    criteria: {
      true: 'The request says what to do on its own. Mentions of "this project", "this repo", a folder, or a file path are fine, because the worker can open the project files. 예: "이 프로젝트에서 lotto 들어간 파일 다 찾아줘", "src/Login.tsx에 버튼 추가해줘"',
      false:
        'The request needs the chat history: it points to something said earlier ("that", "the rule we decided", "option 1"), answers a question the assistant asked ("yes, do it"), or continues earlier work. 예: "응 그렇게 해줘", "방금 그거 다시 설명해줘"',
    },
  },
  bulk: {
    type: 'noul',
    instructions: 'Does this request need hands-on work with files, code, or sources, rather than just a reply?',
    criteria: {
      true: 'Searching or reading files, researching documentation or the web, or writing or changing code such as a feature, a fix, or tests. 예: "lotto 들어간 파일 찾아줘", "비밀번호 표시 버튼 추가해줘", "공식 문서 찾아서 정리해줘"',
      false:
        'Can be answered directly in a few sentences, or is a one-line edit. 예: "SDD가 뭐야?", "변수 이름 하나만 바꿔줘"',
    },
  },
  level: {
    type: 'score',
    instructions: 'What level of AI model capability does this request need?',
    criteria: [
      {
        what: 'Lookup and reading: checking a fact, finding where something is, or reading and searching files or docs and reporting what is there, even across many files. No code is changed.',
        examples: ['이 함수 어디 있어?', 'src 폴더 파일들 읽고 각각 하는 일 요약해줘'],
      },
      {
        what: 'Routine implementation: writing or changing code with a clear scope, fixing a bug, adding tests.',
        examples: ['결과 화면에 날짜 표시 추가해줘', '이 에러 고쳐줘'],
      },
      {
        what: 'Design and planning: deciding structure, designing across many files, weighing trade-offs, defining requirements.',
        examples: ['플러그인 구조 설계하자', '이 기능을 어떻게 나눌지 기획해줘'],
      },
    ],
  },
};

const PREVIOUS_MAX_CHARS = 1200;
const DEFAULT_ENVIRONMENT = 'The user is chatting in a Claude Code session opened in their project folder.';

// state에는 판단에 필요한 최소한만 넣는다. 현재 모델 정보는 넣지 않는다. (SPEC 4장)
export function buildRequest(prompt, previousAssistantText, environment = DEFAULT_ENVIRONMENT) {
  const state = { environment, user_message: prompt };
  if (previousAssistantText) {
    // 직전 답변의 끝부분에 "~할까요?" 같은 질문이 오는 경우가 많아서 뒤쪽을 남긴다
    state.previous_assistant_message_tail = previousAssistantText.slice(-PREVIOUS_MAX_CHARS);
  }
  return { model: 'jev-latest', state, questions: QUESTIONS };
}

export async function askJev(body, { apiKey, timeoutMs = 2500, baseUrl } = {}) {
  const base = baseUrl ?? process.env.TYPESAFE_BASE_URL ?? 'https://api.typesafe.ai';
  const res = await fetch(`${base}/v1/systemone`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`Jev HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return res.json();
}
