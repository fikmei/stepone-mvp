// ================================
// 🌿 StepOne 대화형 UI 메인 스크립트 (초보자용 설명 추가 버전)
// ================================
//
// 이 파일은 StepOne 앱의 "프론트엔드 두뇌" 역할을 합니다.
// 사용자가 입력한 말을 화면에 표시하고,
// FastAPI 백엔드(/api/plan)로 보낸 뒤,
// AI가 돌려준 문장을 화면에 보여줍니다.
//
// 📌 주요 흐름
// 1) 사용자가 입력창에 글을 씀 → Enter/버튼 클릭 시 handleSend() 실행
// 2) 메시지가 화면에 추가됨(addMessage)
// 3) FastAPI(/api/plan)에 보냄(fetchPlan)
// 4) AI 응답을 받아 다시 addMessage로 출력
// 5) 감정(emotion)에 맞게 배경색이 바뀜(applyEmotionTheme)
//
// localStorage를 이용해 대화가 새로고침 후에도 남습니다.
//

// ================================
// 🌱 HTML 요소 불러오기
// ================================
// index.html 안의 요소들을 JS에서 조작할 수 있게 연결
const chatContainer = document.getElementById("chatContainer"); // 대화 내용이 표시될 영역
const userInput = document.getElementById("userInput"); // 사용자가 입력하는 textarea
const btnSend = document.getElementById("btnSend"); // "전송" 버튼

// -------------------------------
// 🗂️ LocalStorage 설정
// -------------------------------
// 사용자의 대화를 브라우저에 저장해서, 새로고침해도 이전 기록이 남도록 함
const STORAGE_KEY = "messages"; // localStorage에 저장할 키 이름
const MAX_MESSAGES = 200; // 최대 저장 가능한 메시지 개수
let messages = []; // 지금까지 주고받은 메시지를 담는 배열

// -------------------------------
// ⚙️ 오토그로우(자동 높이 조절) 기준
// -------------------------------
// 사용자가 글을 많이 쓰면 입력창이 자동으로 커지도록 설정
const BASE_REM = 2.25; // 1줄 높이
const MAX_REM = 8; // 최대 8줄까지만 커짐
const EPS_REM = 0.35; // 약간의 여유, 작은 변화는 무시

// -------------------------------
// ① 초기 높이 설정 (처음 화면이 로드될 때 실행)
// -------------------------------
// textarea의 기본 높이를 1줄로 고정시키는 역할
function setBaselineHeight() {
  const base = BASE_REM;
  userInput.style.height = base + "rem";
  userInput.dataset.baseHeight = String(base); // 나중에 참고용으로 높이 저장
}

// HTML이 모두 불러와졌을 때 실행
document.addEventListener("DOMContentLoaded", () => {
  setBaselineHeight(); // 기본 높이 설정
  loadMessages(); // localStorage에서 기존 대화 불러오기

  // 처음 방문한 사용자에게 첫 인사 출력
  const visited = localStorage.getItem("visited");
  if (!visited && messages.length === 0) {
    addMessage(
      "ai",
      "여기는 마음을 내려놓는 조용한 자리예요.\n한 줄이면 충분해요."
    );
    localStorage.setItem("visited", "true");
  }
});

// -------------------------------
// ② 입력창 자동 높이 조절 기능
// -------------------------------
// 글자 수에 따라 textarea 높이를 자연스럽게 키우는 함수
let rafId = null;
function autoGrowToContent() {
  if (rafId) cancelAnimationFrame(rafId); // 중복 실행 방지
  rafId = requestAnimationFrame(() => {
    const base = parseFloat(userInput.dataset.baseHeight || String(BASE_REM));
    const needRawRem = userInput.scrollHeight / 16; // px → rem 단위 변환

    let need = base;
    // 일정 이상 입력해야 커지도록 설정 (작은 변화는 무시)
    if (needRawRem > base + EPS_REM) {
      need = Math.min(needRawRem, MAX_REM); // 최대 높이 제한
    }

    // 높이와 스크롤 표시 조정
    userInput.style.height = need + "rem";
    userInput.style.overflowY = need >= MAX_REM ? "auto" : "hidden";

    // 입력이 비면 다시 기본 높이로 되돌림
    if (userInput.value.trim() === "") {
      userInput.style.height = base + "rem";
      userInput.style.overflowY = "hidden";
    }

    rafId = null;
  });
}
userInput.addEventListener("input", autoGrowToContent); // 글자를 입력할 때마다 자동 조정

// -------------------------------
// ③ 전송 처리 (Enter 또는 버튼 클릭 시 실행)
// -------------------------------
// 사용자가 글을 입력하면 handleSend()가 실행되어
// ① 사용자 말 추가 → ② AI 응답 생성 → ③ 입력창 리셋
btnSend.addEventListener("click", handleSend);
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

// ===============================
// 🌿 빈 입력 안내 토스트 기능
// ===============================
// 사용자가 아무 말도 입력하지 않았을 때
// 화면 아래쪽에 짧게 안내 메시지를 띄워주는 함수입니다.
function showToast(msg) {
  // div 요소를 새로 만듭니다.
  const t = document.createElement("div");
  t.textContent = msg;         // 표시할 텍스트 설정
  t.className = "toast";       // CSS에서 스타일을 지정할 클래스 이름
  document.body.appendChild(t); // body 맨 아래에 추가 (화면에 표시됨)

  // 1.8초(1800ms) 뒤에 자동으로 사라지게 설정
  setTimeout(() => t.remove(), 2000);
}


// ===============================
// ✉️ 실제 전송 처리 함수 (Day6.5: UX 개선 — 입력창 즉시 리셋)
// ===============================
// 사용자가 Enter를 누르거나 "전송" 버튼을 눌렀을 때 실행됩니다.
// 흐름 요약:
// ① 입력값 확인 → ② 사용자 말 출력 → ③ 입력창 비움(즉시) → ④ Gemini 요청 → ⑤ AI 응답 출력 → ⑥ 버튼 복구
async function handleSend() {
  // 1️⃣ 입력값 가져오기 (앞뒤 공백 제거)
  const input = userInput.value.trim();

  // 2️⃣ 아무것도 입력하지 않았다면 안내 후 종료
  if (!input) {
    showToast("한 줄만 써도 괜찮아요."); // 화면 하단에 짧은 안내 메시지
    return; // 실행 중단
  }

  // 3️⃣ 사용자가 입력한 내용을 화면에 추가
  // → 사용자의 말이 바로 채팅창에 표시됩니다.
  addMessage("user", input);

  // 4️⃣ 감정(emotion)과 의도(intent)를 분석해서 백엔드로 함께 보냄
  const intent = getIntent(input);      // 예: "도와줘" → "help"
  const emotion = detectEmotion(input); // 예: "무기력" → "low"

  // 5️⃣ 전송 중에는 버튼을 잠시 비활성화해서 중복 클릭 방지
  btnSend.disabled = true;    // 클릭 잠금
  btnSend.textContent = "…";  // 로딩 느낌

  // 🪄 6️⃣ Gemini 요청 전 — 입력창 즉시 리셋 (ChatGPT/Gemini 스타일)
  // 사용자가 "전송"을 누른 순간 입력창이 바로 비워지고, AI 응답만 기다립니다.
  userInput.value = "";
  const base = parseFloat(userInput.dataset.baseHeight || String(BASE_REM));
  userInput.style.height = base + "rem";
  userInput.style.overflowY = "hidden";

  try {
    // 7️⃣ FastAPI → Gemini 연결을 통해 실제 AI 응답 받기
    const r = await fetchPlan(input, emotion, intent);

    // 8️⃣ AI 응답을 화면에 표시
    addMessage("ai", r.message, { emotion: r.emotion || emotion, intent });

    // 9️⃣ 감정 테마(배경색) 변경
    applyEmotionTheme(r.emotion || emotion);

  } finally {
    // 🔟 응답 완료 후 버튼 원상복구
    btnSend.disabled = false;
    btnSend.textContent = "전송";
  }
}

// -------------------------------
// ④ 메시지 추가 & 저장 기능
// -------------------------------
// 화면에 메시지를 추가하고 localStorage에 저장
function addMessage(role, text, meta = {}) {
  const el = document.createElement("div");
  el.className = `message ${role}`; // ai 또는 user 클래스 적용
  el.textContent = text;
  chatContainer.appendChild(el);

  // 자동으로 스크롤 맨 아래로 이동
  chatContainer.scrollTo({
    top: chatContainer.scrollHeight,
    behavior: "smooth",
  });

  // 대화 기록 배열에 추가하고 localStorage에도 저장
  messages.push({ role, text, ...meta, ts: Date.now() });
  if (messages.length > MAX_MESSAGES) messages.shift(); // 오래된 메시지 제거
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
}

// 저장된 메시지를 불러오는 함수
function loadMessages() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return;
  try {
    messages = JSON.parse(data);
    messages.forEach((m) => {
      const el = document.createElement("div");
      el.className = `message ${m.role}`;
      el.textContent = m.text;
      chatContainer.appendChild(el);
    });
    chatContainer.scrollTo({ top: chatContainer.scrollHeight });
  } catch {
    messages = [];
  }
}

// -------------------------------
// 🌿 Day4: 감정/의도 분석 및 템플릿 응답
// -------------------------------
// 사용자의 문장에서 감정(emotion)과 의도(intent)를 파악해
// 적절한 문장을 선택하는 간단한 로직

// 사용자의 '의도'를 분석 (예: 도움, 습관, 계획 등)
function getIntent(input) {
  const s = (input || "").toLowerCase();
  if (/불안|걱정|초조|답답|짜증/.test(s)) return "vent"; // 감정 토로
  if (/도와줘|방법|어떻게|해결|알려줘/.test(s)) return "help"; // 도움 요청
  if (/습관|루틴|매일|기록/.test(s)) return "habit"; // 습관 관련
  if (/계획|목표|달성|일정/.test(s)) return "plan"; // 목표 관련
  return "other"; // 기타
}

// 사용자의 '감정'을 감지 (예: 불안, 무기력, 희망 등)
function detectEmotion(input) {
  const s = (input || "").toLowerCase();
  if (/불안|걱정|초조/.test(s)) return "anxious";
  if (/무기력|피곤|지침|힘들/.test(s)) return "low";
  if (/괜찮|좋아|희망|감사/.test(s)) return "hopeful";
  return "healing"; // 기본값 (회복)
}

// 감정/의도 조합별로 미리 정해둔 문장 모음
const TEMPLATES = {
  anxious: {
    vent: [
      "🌧 불안을 털어놓는 건 용기예요.\n오늘은 30초만 숨에 집중해 볼까요?",
      "🌧 몸이 긴장되면 마음도 경직돼요.\n어깨를 살짝 푸는 것부터 시작해요.",
    ],
    help: [
      "🌧 통제 가능한 아주 작은 일부터요.\n‘책상 위 물컵 치우기’처럼요.",
      "🌧 불안을 적어보면 덜 막막해져요.\n세 줄만 메모해볼까요?",
    ],
  },
  healing: {
    habit: [
      "🌿 작은 습관은 가벼워야 이어져요.\n오늘은 ‘물 한 잔 + 한 줄 기록’만요.",
      "🌿 타이머 5분을 켜고 시작해요.\n끝나면 스스로에게 ‘잘했어’라고요.",
    ],
    plan: [
      "🌿 완벽한 해법보다 첫 걸음이 중요해요.\n오늘 한 줄만 기록해볼까요?",
      "🌿 아주 작은 목표 하나만요:\n‘물 한 잔 마시기’ ‘창문 열기’.",
    ],
    other: [
      "🌿 괜찮아요.\n당신의 속도도 충분히 아름답습니다.",
      "🌿 잠깐 멈춤도 성장의 일부예요.\n한 줄이면 충분합니다.",
    ],
  },
  low: {
    habit: [
      "🍂 5분 정리/5분 산책 중 하나를 골라요.\n짧을수록 시작이 쉬워요.",
      "🍂 물 한 잔과 창문 환기.\n그 다음에 한 줄 기록이면 넘칩니다.",
    ],
    other: [
      "🍂 지금은 에너지 보충이 먼저예요.\n‘아무것도 안 하기’도 선택입니다.",
      "🍂 90초만 창밖을 바라보며 호흡해요.\n그 다음엔 한 줄만 기록해요.",
    ],
  },
  hopeful: {
    other: [
      "☀️ 지금의 따뜻함, 소중해요.\n10초만 더 머물러보죠.",
      "☀️ 오늘의 작은 좋음을 적어두면\n내일의 힘이 됩니다.",
    ],
  },
};

// 배열에서 랜덤으로 문장 1개 뽑기
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 감정/의도에 맞는 문장 하나를 반환하는 함수
function generateResponse(input) {
  const intent = getIntent(input);
  const emotion = detectEmotion(input);
  const pool =
    (TEMPLATES[emotion] && TEMPLATES[emotion][intent]) ||
    (TEMPLATES.healing && TEMPLATES.healing.other);
  return {
    emotion,
    intent,
    message: pickRandom(pool) || "🌿 괜찮아요.\n한 줄이면 충분해요.",
  };
}

// 감정에 따라 배경 테마 변경
function applyEmotionTheme(emotion) {
  const el = document.body;
  el.classList.remove("anxious", "low", "healing", "hopeful");
  el.classList.add(emotion || "healing");
}

// ===============================
// 🌐 Day5: FastAPI 연결 (백엔드와 통신)
// ===============================
// 사용자의 입력을 FastAPI로 보내고 응답을 받아오는 역할
async function fetchPlan(input, emotion, intent) {
  // 실제 요청을 수행하는 함수
  const call = async (signal) => {
    const r = await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: input, emotion, intent }),
      signal,
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  };

  const ctrl = new AbortController(); // 타임아웃용
  const timer = setTimeout(() => ctrl.abort(), 5000); // 5초 제한

  try {
    const data = await call(ctrl.signal);
    return data;
  } catch (err) {
    // 실패 시 1회 재시도
    try {
      await new Promise((res) => setTimeout(res, 400));
      const ctrl2 = new AbortController();
      const timer2 = setTimeout(() => ctrl2.abort(), 5000);
      try {
        const retry = await call(ctrl2.signal);
        return retry;
      } finally {
        clearTimeout(timer2);
      }
    } catch (err2) {
      console.warn("⚠️ /api/plan 실패 → 템플릿 폴백:", err2);
      return generateResponse(input); // 백엔드 실패 시 기본 문장으로 대체
    }
  } finally {
    clearTimeout(timer);
  }
}


// ===============================
// 🌐 오프라인 상태 감지 배너 (Day6 UX 보강)
// ===============================
//
// 💡 이 기능은 사용자의 인터넷 연결 상태를 자동으로 감지해서
// 연결이 끊겼을 때 화면 상단에 “오프라인 상태예요” 배너를 표시하고,
// 다시 온라인이 되면 자동으로 사라지게 만드는 코드입니다.
//
// (1) window.addEventListener("offline") → 인터넷이 끊어질 때 실행
// (2) window.addEventListener("online")  → 다시 연결될 때 실행
// (3) showBanner() 함수는 배너를 만들고, hideBanner()는 제거합니다.
//

// 1️⃣ 브라우저가 "오프라인" 상태로 바뀔 때
window.addEventListener("offline", () => showBanner("📴 오프라인 상태예요"));

// 2️⃣ 브라우저가 "온라인" 상태로 돌아올 때
window.addEventListener("online", hideBanner);

// -------------------------------
// 📘 배너 표시 함수
// -------------------------------
// showBanner()는 배너가 아직 없을 때만 새로 만들어서 화면 맨 위에 추가합니다.
function showBanner(msg) {
  // id가 netBanner인 요소가 이미 존재하는지 확인
  let b = document.getElementById("netBanner");

  // 만약 없다면 새로 생성
  if (!b) {
    // ① <div> 요소 하나를 새로 만듭니다.
    b = document.createElement("div");

    // ② id와 텍스트, 스타일 클래스 지정
    b.id = "netBanner";
    b.textContent = msg; // 표시할 문장
    b.className = "banner"; // CSS에서 스타일 지정

    // ③ body 맨 위쪽(가장 첫 부분)에 삽입
    // prepend()는 appendChild()와 반대로 "맨 앞에 추가" 기능입니다.
    document.body.prepend(b);
  }
}

// -------------------------------
// 📘 배너 제거 함수
// -------------------------------
// hideBanner()는 배너가 화면에 있으면 제거합니다.
function hideBanner() {
  const b = document.getElementById("netBanner"); // 배너 찾기
  if (b) b.remove(); // 있으면 삭제
}