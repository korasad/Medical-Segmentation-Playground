# app/yolo/pr2_yolo.py
from functools import lru_cache
from pathlib import Path
from typing import List, Dict, Tuple

import cv2
from ultralytics import YOLO  # pip install ultralytics

from app.config import BASE_DIR, RESULTS_DIR, RESULTS_SUBDIR

# Путь к обученной модели ПР2 (ИЗМЕНИ под свой best.pt)
# Например: sm2/runs/segment/train/weights/best.pt
PR2_MODEL_PATH = BASE_DIR / "weights" / "pr2_yolo_isic_best.pt"


PR2_SUBDIR = "pr2"  # подпапка в static/results для ПР2


@lru_cache()
def get_pr2_model() -> YOLO:
    """
    Лениво загружаем YOLO-модель один раз.
    Если файл не найден — кидаем понятную ошибку.
    """
    if not PR2_MODEL_PATH.exists():
        raise RuntimeError(f"PR2 YOLO model weights not found: {PR2_MODEL_PATH}")
    return YOLO(str(PR2_MODEL_PATH))


def run_pr2_inference(image_path: Path) -> tuple[str, list[dict]]:
    """
    Запуск детекции/сегментации YOLO на исходном изображении.

    Возвращает:
    - относительный путь к PNG с оверлеем (результат+bbox+mask),
      относительно STATIC: "results/pr2/....png"
    - список детекций (class_id, class_name, confidence, bbox_xyxy)
    """
    model = get_pr2_model()

    # один прогон, без сохранения папок Ultralytics
    pred = model.predict(
        source=str(image_path),
        imgsz=640,
        conf=0.25,
        iou=0.5,
        verbose=False,
    )[0]

    # Оверлей с bbox+масками от Ultralytics (BGR)
    overlay_bgr = pred.plot()

    # Куда сохраняем
    rel_dir = Path(RESULTS_SUBDIR) / PR2_SUBDIR
    rel_path = rel_dir / f"{image_path.stem}_pr2_overlay.png"
    out_path = RESULTS_DIR / PR2_SUBDIR / f"{image_path.stem}_pr2_overlay.png"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(out_path), overlay_bgr)

    # Парсим боксы
    detections: list[dict] = []
    boxes = pred.boxes
    if boxes is not None:
        xyxy = boxes.xyxy.cpu().numpy()
        confs = boxes.conf.cpu().numpy()
        clses = boxes.cls.cpu().numpy().astype(int)

        for box, conf, cls in zip(xyxy, confs, clses):
            detections.append(
                {
                    "class_id": int(cls),
                    "class_name": str(pred.names.get(int(cls), str(cls))),
                    "confidence": float(conf),
                    "bbox_xyxy": [float(v) for v in box],
                }
            )

    return str(rel_path).replace("\\", "/"), detections
