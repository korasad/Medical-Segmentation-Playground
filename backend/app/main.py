# /home/korasad/Analis/webapp/backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import MEDIA_ROOT
from app.db.base import Base, engine
from app.routers import images
from app.routers import images, pr2  # <-- добавь pr2


# создаём таблицы (для простоты без Alembic)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Medical Segmentation API")

# CORS для фронта (потом фронт будет на 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(images.router)
app.include_router(pr2.router)  # <-- новый роутер

# раздача статических файлов (изображения, маски)
app.mount("/static", StaticFiles(directory=str(MEDIA_ROOT)), name="static")


@app.get("/health")
def health():
    return {"status": "ok"}





