# app/routers/pr2.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import MEDIA_ROOT
from app.db import crud, schemas
from app.db.deps import get_db
from app.yolo.pr2_yolo import run_pr2_inference

router = APIRouter(prefix="/api/pr2", tags=["pr2"])


def _build_static_url(rel_path: str) -> str:
    # такой же, как в images.py
    return f"/static/{rel_path}"


@router.post("/predict/{image_id}", response_model=schemas.Pr2Result)
def pr2_predict(image_id: int, db: Session = Depends(get_db)):
    """
    Запуск YOLO-модели ПР2 на загруженном изображении.
    """
    image = crud.get_image(db, image_id=image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    # Берём исходное изображение (stored_path → uploads/uid.ext)
    img_path = MEDIA_ROOT / image.stored_path
    if not img_path.exists():
        raise HTTPException(
            status_code=404, detail="Stored image file not found on disk"
        )

    rel_result_path, detections = run_pr2_inference(img_path)

    return schemas.Pr2Result(
        image_id=image.id,
        overlay_url=_build_static_url(rel_result_path),
        detections=[schemas.Pr2Detection(**d) for d in detections],
    )
