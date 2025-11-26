# /home/korasad/Analis/webapp/backend/app/db/schemas.py
from typing import List, Optional

from pydantic import BaseModel


class ImageRead(BaseModel):
    id: int
    original_filename: str
    is_dicom: bool
    width: int
    height: int
    preview_url: str

    class Config:
        orm_mode = True


class RegionGrowingParams(BaseModel):
    seed_x: int  # колонка (по ширине, X)
    seed_y: int  # строка (по высоте, Y)
    diff_thresh: int = 12


class SegmentAllRequest(BaseModel):
    manual_thresh: int = 120
    adaptive_block_size: int = 35
    adaptive_C: int = 5
    region_growing: RegionGrowingParams
    # новая ручка для Watershed:
    watershed_fg_fraction: float = 0.5  # доля от max(dist) для порога sure_fg


class SegmentationRead(BaseModel):
    id: int
    method: str
    result_url: str

    class Config:
        orm_mode = True


class SegmentationBatchResponse(BaseModel):
    image_id: int
    results: List[SegmentationRead]
    
class Pr2Detection(BaseModel):
    class_id: int
    class_name: str
    confidence: float
    bbox_xyxy: list[float]


class Pr2Result(BaseModel):
    image_id: int
    overlay_url: str
    detections: List[Pr2Detection]