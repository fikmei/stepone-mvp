# ================================
# 🌿 StepOne 백엔드 (Day6: Gemini 연결)
# ================================
#
# 이 파일은 StepOne 앱의 "서버(백엔드)" 코드입니다.
# 즉, 사용자가 웹사이트(프론트엔드)에서 글을 쓰면,
# 그 내용을 FastAPI가 받아서 → Gemini AI에 전달하고 → 다시 응답을 돌려주는 역할을 합니다.
#
# -------------------------------
# 🌍 전체 흐름 이해하기
# -------------------------------
# [1] 사용자가 index.html(웹 페이지)에서 글을 입력
# [2] app.js(JavaScript)가 그 글을 /api/plan 주소로 보냄
# [3] main.py(FastAPI)가 그 데이터를 받아 Gemini API에 요청
# [4] Gemini가 대답(JSON)을 보내면 FastAPI가 그대로 전달
# [5] 다시 JS가 화면(chatContainer)에 표시
#
# 💡 즉, 이 main.py는 "중간 전달자" 역할이에요.
# 브라우저(프론트엔드) ↔ FastAPI(백엔드) ↔ Gemini(API)
# -------------------------------


# ================================
# ① 필요한 라이브러리 불러오기
# ================================
# FastAPI: 웹 서버를 쉽게 만들 수 있는 Python 프레임워크
# StaticFiles: HTML, CSS, JS 같은 정적 파일(화면 코드) 제공용
# RedirectResponse: 특정 주소로 자동 이동시킬 때 사용
# BaseModel: API 요청 데이터의 형식을 정의할 때 사용
# os, httpx, json: 외부 API 호출 및 데이터 처리용
# dotenv: .env 파일에 있는 비밀키(API Key)를 불러올 때 사용
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
import os, httpx, json
from dotenv import load_dotenv


# ================================
# ② 환경변수(.env) 불러오기
# ================================
# .env 파일에는 GEMINI_API_KEY가 저장되어 있음
# (보안을 위해 GitHub에는 절대 올리지 않음)
load_dotenv()  # .env 파일 읽기


# ================================
# ③ FastAPI 앱 생성
# ================================
# FastAPI는 Flask와 비슷하지만 훨씬 빠르고, 타입 지원이 좋아요.
app = FastAPI()


# ================================
# ④ 정적 파일(public 폴더) 연결
# ================================
# 브라우저에서 HTML, CSS, JS를 볼 수 있게 하는 부분입니다.
# 예: /public/index.html → 실제 public 폴더의 index.html 파일을 전달
app.mount("/public", StaticFiles(directory="public"), name="public")


# ================================
# ⑤ 루트("/") 접속 시 index.html로 자동 이동
# ================================
# 사용자가 그냥 http://localhost:8000 으로 접속하면
# 자동으로 public/index.html 로 리다이렉트됩니다.
@app.get("/")
async def root():
    return RedirectResponse(url="/public/index.html")


# ================================
# ⑥ 요청 데이터 모델 정의 (클래스)
# ================================
# 프론트엔드(JS)에서 보낼 데이터의 형태를 지정합니다.
# 예: {"text": "요즘 너무 무기력해요", "emotion": "low", "intent": "habit"}
class PlanRequest(BaseModel):
    text: str
    emotion: str
    intent: str


# ================================
# ⑦ Gemini API 설정
# ================================
# 실제 AI 서버에 요청을 보내기 위한 URL입니다.
# Google의 Gemini 1.5 Pro 모델을 사용합니다.
GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-1.5-pro-latest:generateContent"
)


# ================================
# ⑧ /api/plan API 엔드포인트
# ================================
# 프론트엔드에서 사용자가 문장을 입력하면
# /api/plan 으로 POST 요청이 들어옵니다.
# → FastAPI가 그 데이터를 받아 Gemini에 전달하고,
# → Gemini의 대답(JSON)을 그대로 브라우저로 돌려줍니다.
@app.post("/api/plan")
async def plan_endpoint(req: PlanRequest):
    # -------------------------------
    # ⑧-1) API Key 확인
    # -------------------------------
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return {
            "message": "⚠️ Gemini API 키가 설정되지 않았어요. .env 파일을 확인해주세요.",
            "emotion": "healing",
            "tags": ["error"]
        }

    # -------------------------------
    # ⑧-2) Gemini에게 보낼 프롬프트 만들기
    # -------------------------------
    # Gemini는 단순히 텍스트를 받는 것이 아니라,
    # 우리가 원하는 "형식"과 "톤"을 정확히 알려줘야 올바르게 응답합니다.
    prompt = f"""
    당신은 저에너지 사용자를 위한 감정 코치입니다.
    다음 정보를 참고해 180~280자 이내의 따뜻한 2문장으로 대답하세요.
    톤은 "이해 → 한 걸음", 죄책감 금지.
    JSON 형태로만 응답하세요.

    입력 문장: {req.text}
    감정 상태: {req.emotion}
    의도: {req.intent}

    예시 출력:
    {{
      "message": "🌿 마음이 지쳤을 땐 천천히 숨을 고르세요. 오늘은 자신에게 다정하게 대해주세요.",
      "emotion": "healing",
      "tags": ["회복","안정"]
    }}
    """

    # -------------------------------
    # ⑧-3) Gemini API 요청 보내기
    # -------------------------------
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(
                f"{GEMINI_URL}?key={api_key}",
                json={"contents": [{"parts": [{"text": prompt}]}]},
            )
            res.raise_for_status()  # 에러 코드(4xx, 5xx) 발생 시 예외 처리
            data = res.json()

            # Gemini가 준 응답은 JSON 안에 또 문자열(JSON)이 들어있어요.
            # 그래서 한 번 더 json.loads()로 파싱해야 함.
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            j = json.loads(text)
            return j  # {"message": "...", "emotion": "...", "tags": [...]}

    # -------------------------------
    # ⑧-4) 실패 시 폴백(fallback) 응답
    # -------------------------------
    except Exception as e:
        print("⚠️ Gemini 호출 실패:", e)
        return {
            "message": "🌿 서버 연결이 잠시 불안정해요. 잠시 후 다시 시도해주세요.",
            "emotion": "healing",
            "tags": ["폴백"]
        }


# ================================
# ✅ 실행 방법 요약
# ================================
# 1️⃣ .env 파일 만들기 (main.py와 같은 폴더에 생성)
#     GEMINI_API_KEY=AIzaSyXXX...(본인 키)
#
# 2️⃣ 실행하기
#     uvicorn main:app --reload
#
# 3️⃣ 브라우저 접속
#     http://127.0.0.1:8000
#     → 자동으로 /public/index.html로 이동
#
# 4️⃣ 입력 테스트
#     문장 입력 → FastAPI → Gemini → AI 응답 표시
#
# ================================
# 📘 전체 구조 복습 (정리)
# ================================
# [Frontend: public/]
#   ├─ index.html   → 화면 구성
#   ├─ style.css    → 스타일(디자인)
#   ├─ app.js       → 사용자 입력 처리 + /api 연결
# [Backend: app/ or root/]
#   └─ main.py      → FastAPI 서버 + Gemini 연결
#
# 🌱 당신이 만든 앱은 이제 "진짜 AI 코치"로 작동합니다!
# ================================
