// src/api/types.ts

export interface ImageRead {
  id: number;
  original_filename: string;
  is_dicom: boolean;
  width: number;
  height: number;
  preview_url: string;
}

export interface RegionGrowingParams {
  seed_x: number; // X (колонка)
  seed_y: number; // Y (строка)
  diff_thresh: number;
}

export interface SegmentAllRequest {
  manual_thresh: number;
  adaptive_block_size: number;
  adaptive_C: number;
  region_growing: RegionGrowingParams;
  watershed_fg_fraction: number;
}

export interface SegmentationRead {
  id: number;
  method: string;
  result_url: string;
}

export interface SegmentationBatchResponse {
  image_id: number;
  results: SegmentationRead[];
}

// ===== ПР2 (YOLO) =====

export interface Pr2Detection {
  class_id: number;
  class_name: string;
  confidence: number;
  bbox_xyxy: number[]; // [x1, y1, x2, y2]
}

export interface Pr2Result {
  image_id: number;
  overlay_url: string;
  detections: Pr2Detection[];
}
