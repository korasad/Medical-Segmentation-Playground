# app/main.py (или как он у тебя лежит внутри backend'а)
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse

from app.config import MEDIA_ROOT
from app.db.base import Base, engine
from app.routers import images, pr2

# создаём таблицы
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Medical Segmentation API")

# CORS: локальная разработка + твой домен
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://korasad.ru",
    "https://korasad.ru",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# роутеры
app.include_router(images.router)
app.include_router(pr2.router)

# статика (uploads/results)
app.mount("/static", StaticFiles(directory=str(MEDIA_ROOT)), name="static")


@app.get("/health")
def health():
    return {"status": "ok"}


# опционально: если зайти напрямую на backend по /
@app.get("/", include_in_schema=False)
def root():
    # можно редиректить на docs, но nginx всё равно будет отдавать фронт
    return RedirectResponse(url="/docs")
