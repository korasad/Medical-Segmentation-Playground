# /home/korasad/Analis/webapp/backend/app/config.py
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

DB_PATH = BASE_DIR / "app.db"
DB_URL = f"sqlite:///{DB_PATH}"

MEDIA_ROOT = BASE_DIR / "static"
UPLOAD_SUBDIR = "uploads"
RESULTS_SUBDIR = "results"

UPLOAD_DIR = MEDIA_ROOT / UPLOAD_SUBDIR
RESULTS_DIR = MEDIA_ROOT / RESULTS_SUBDIR

# создаём каталоги, если их нет
for p in (MEDIA_ROOT, UPLOAD_DIR, RESULTS_DIR):
    p.mkdir(parents=True, exist_ok=True)
