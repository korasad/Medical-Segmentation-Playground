# /home/korasad/Analis/webapp/backend/app/routers/images.py
import shutil
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config import (
    MEDIA_ROOT,
    RESULTS_DIR,
    RESULTS_SUBDIR,
    UPLOAD_DIR,
    UPLOAD_SUBDIR,
)
from app.db import crud, models, schemas
from app.db.deps import get_db
from app.segmentation.core import (
    dicom_to_rgb,
    load_rgb_image,
    save_mask,
    save_rgb_image,
    segment_all_methods,
)

router = APIRouter(prefix="/api/images", tags=["images"])


def _build_static_url(rel_path: str) -> str:
    return f"/static/{rel_path}"


@router.post("/upload", response_model=schemas.ImageRead)
async def upload_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    ext = Path(file.filename).suffix.lower()
    uid = uuid4().hex

    if not ext:
        ext = ".bin"

    stored_name = f"{uid}{ext}"
    stored_rel = f"{UPLOAD_SUBDIR}/{stored_name}"
    stored_path = UPLOAD_DIR / stored_name

    with stored_path.open("wb") as f:
        shutil.copyfileobj(file.file, f)

    is_dicom = ext == ".dcm"

    if is_dicom:
        img_rgb = dicom_to_rgb(stored_path)
    else:
        # читаем и конвертим все в PNG для унификации
        img_rgb = load_rgb_image(stored_path)

    h, w = img_rgb.shape[:2]

    preview_name = f"{uid}.png"
    preview_rel = f"{UPLOAD_SUBDIR}/{preview_name}"
    preview_path = UPLOAD_DIR / preview_name
    save_rgb_image(img_rgb, preview_path)

    image = crud.create_image(
        db,
        original_filename=file.filename,
        stored_path=stored_rel,
        preview_path=preview_rel,
        is_dicom=is_dicom,
        width=w,
        height=h,
    )

    return schemas.ImageRead(
        id=image.id,
        original_filename=image.original_filename,
        is_dicom=image.is_dicom,
        width=image.width,
        height=image.height,
        preview_url=_build_static_url(image.preview_path),
    )


@router.post("/{image_id}/segment/all", response_model=schemas.SegmentationBatchResponse)
async def segment_all(
    image_id: int,
    params: schemas.SegmentAllRequest,
    db: Session = Depends(get_db),
):
    image = crud.get_image(db, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    img_path = MEDIA_ROOT / image.preview_path
    img_rgb = load_rgb_image(img_path)

    # seed_y/seed_x -> (row, col)
    seed = (params.region_growing.seed_y, params.region_growing.seed_x)

    masks = segment_all_methods(
        img_rgb,
        manual_thresh=params.manual_thresh,
        adaptive_block_size=params.adaptive_block_size,
        adaptive_C=params.adaptive_C,
        region_seed=seed,
        region_diff_thresh=params.region_growing.diff_thresh,
        watershed_fg_fraction=params.watershed_fg_fraction,
    )


    results_out: list[schemas.SegmentationRead] = []

    # сохраняем маски и создаём записи в БД
    for method_name, mask in masks.items():
        out_name = f"{image.id}_{method_name}.png"
        rel_path = f"{RESULTS_SUBDIR}/{out_name}"
        full_path = RESULTS_DIR / out_name
        save_mask(mask, full_path)

        seg = crud.create_segmentation(
            db,
            image_id=image.id,
            method=method_name,
            result_path=rel_path,
            params=params.model_dump(),
        )

        results_out.append(
            schemas.SegmentationRead(
                id=seg.id,
                method=seg.method,
                result_url=_build_static_url(seg.result_path),
            )
        )

    return schemas.SegmentationBatchResponse(
        image_id=image.id,
        results=results_out,
    )
