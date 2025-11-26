# /home/korasad/Analis/webapp/backend/app/db/crud.py
from typing import Optional

from sqlalchemy.orm import Session

from app.db import models


def get_image(db: Session, image_id: int) -> Optional[models.Image]:
    return db.query(models.Image).filter(models.Image.id == image_id).first()


def create_image(
    db: Session,
    *,
    original_filename: str,
    stored_path: str,
    preview_path: str,
    is_dicom: bool,
    width: int,
    height: int,
) -> models.Image:
    image = models.Image(
        original_filename=original_filename,
        stored_path=stored_path,
        preview_path=preview_path,
        is_dicom=is_dicom,
        width=width,
        height=height,
    )
    db.add(image)
    db.commit()
    db.refresh(image)
    return image


def create_segmentation(
    db: Session,
    *,
    image_id: int,
    method: str,
    result_path: str,
    params: dict | None = None,
) -> models.Segmentation:
    seg = models.Segmentation(
        image_id=image_id,
        method=method,
        result_path=result_path,
        params=params or {},
    )
    db.add(seg)
    db.commit()
    db.refresh(seg)
    return seg
