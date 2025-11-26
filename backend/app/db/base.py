# /home/korasad/Analis/webapp/backend/app/db/base.py
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import DB_URL

engine = create_engine(
    DB_URL,
    connect_args={"check_same_thread": False},  # нужно для sqlite в однопоточном режиме
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)

Base = declarative_base()
