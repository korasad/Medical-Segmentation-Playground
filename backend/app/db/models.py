# /home/korasad/Analis/webapp/backend/app/db/models.py
from datetime import datetime
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
)
from sqlalchemy.orm import relationship

from app.db.base import Base


class Image(Base):
    __tablename__ = "images"

    id = Column(Integer, primary_key=True, index=True)
    original_filename = Column(String, nullable=False)
    stored_path = Column(String, nullable=False)   # относительный путь, например "uploads/abc.dcm"
    preview_path = Column(String, nullable=False)  # PNG (используем для сегментации/отображения)
    is_dicom = Column(Boolean, default=False, nullable=False)
    width = Column(Integer, nullable=False)
    height = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    segmentations = relationship(
        "Segmentation",
        back_populates="image",
        cascade="all, delete-orphan",
    )


class Segmentation(Base):
    __tablename__ = "segmentations"

    id = Column(Integer, primary_key=True, index=True)
    image_id = Column(Integer, ForeignKey("images.id", ondelete="CASCADE"))
    method = Column(String, nullable=False)  # "manual_inv", "otsu_inv", "adapt_mean", ...
    params = Column(JSON, nullable=True)
    result_path = Column(String, nullable=False)  # относительный путь, например "results/1_otsu_inv.png"
    created_at = Column(DateTime, default=datetime.utcnow)

    image = relationship("Image", back_populates="segmentations")
