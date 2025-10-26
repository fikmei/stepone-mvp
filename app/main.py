# ================================
# 🌿 StepOne 백엔드 (Day6: Gemini 연결 – 완전 안정화 버전)
# ================================
#
# ✅ 이 버전은 실제 Gemini 2.0 Flash API와 완벽히 호환됩니다.
# ✅ 코드블록(````json ... `````) 형태로 오는 응답도 자동 파싱합니다.
# ✅ 브라우저에서 입력한 감정·문장을 받아서 따뜻한 2문장 JSON으로 반환합니다.
#
# 전체 구조:
# 브라우저(프론트엔드) ↔ FastAPI(백엔드) ↔ Gemini(API)
# -------------------------------

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
import os, httpx, json
from dotenv import load_dotenv

# ================================
# ① 환경 변수 불러오기 (.env)
# ================================
# .env 파일 예시:
# GEMINI_API_KEY=AIzaSyXXXX...(Google Cloud Console에서 생성한 API 키)
load_dotenv()

# ================================
# ② FastAPI 앱 생성
# ================================
app = FastAPI()

# ================================
# ③ 정적 파일 연결 (public 폴더)
# ================================
app.mount("/public", StaticFiles(directory="public"), name="public")

@app.get("/")
async def root():
    """루트('/') 접근 시 index.html로 자동 이동"""
    return RedirectResponse(url="/public/index.html")

# ================================
# ④ 요청 데이터 구조 정의
# ================================
class PlanRequest(BaseModel):
    text: str
    emotion: str
    intent: str

# ================================
# ⑤ Gemini 모델 설정 (2.0 Flash)
# ================================
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
print("✅ GEMINI_URL =", GEMINI_URL)

# ================================
# ⑥ /api/plan 엔드포인트
# ================================
@app.post("/api/plan")
async def plan_endpoint(req: PlanRequest):
    """프론트엔드(app.js) → Gemini API 연결"""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return {
            "message": "⚠️ .env 파일에 GEMINI_API_KEY가 없습니다.",
            "emotion": "healing",
            "tags": ["error"]
        }

    # ✅ Gemini에 보낼 프롬프트 구성
    user_prompt = f"""
    사용자가 이렇게 말했습니다: "{req.text}"
    감정 상태: {req.emotion}, 의도: {req.intent}
    180~280자 이내의 따뜻한 2문장으로 대답해주세요.
    톤은 "이해 → 한 걸음", 죄책감 금지.
    JSON 형태로만 응답하세요.

    예시:
    {{
      "message": "🌿 오늘은 조금 쉬어가도 괜찮아요. 당신의 속도가 충분히 소중합니다.",
      "emotion": "healing",
      "tags": ["회복","안정"]
    }}
    """

    try:
        print("📡 Gemini API 요청 중...")

        # ✅ 실제 Gemini API 호출
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(
                GEMINI_URL,
                headers={
                    "Content-Type": "application/json",
                    "X-goog-api-key": api_key
                },
                json={
                    "contents": [
                        {
                            "parts": [{"text": user_prompt}]
                        }
                    ]
                },
            )

            # ✅ HTTP 오류 확인
            res.raise_for_status()

            # ✅ Gemini 응답 처리
            data = res.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            print("✅ Gemini 응답 원본:", text)

            # ✅ 코드블록(````json ... `````) 제거 처리
            clean_text = text.strip().replace("```json", "").replace("```", "").strip()

            # ✅ JSON 파싱
            j = json.loads(clean_text)
            return j

    except Exception as e:
        print("⚠️ Gemini 호출 실패:", e)
        return {
            "message": "🌿 서버가 잠시 응답하지 않아요. 잠시 후 다시 시도해주세요.",
            "emotion": "healing",
            "tags": ["fallback"]
        }

# ================================
# ✅ 실행 요약
# ================================
# 1️⃣ .env 파일 생성
#     GEMINI_API_KEY=AIzaSyXXXX...(Cloud Console 키)
#
# 2️⃣ FastAPI 실행 (루트 폴더에서)
#     uvicorn app.main:app --reload
#
# 3️⃣ 브라우저 접속
#     http://127.0.0.1:8000
#
# 4️⃣ 입력 예시:
#     "요즘 너무 무기력해요"
#     → AI가 따뜻한 2문장과 emotion/tags JSON으로 응답
#
# 🌱 이제 StepOne MVP는 진짜 감정 기반 Gemini 코치로 작동합니다.
# ================================
