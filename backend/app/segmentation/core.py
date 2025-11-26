# /home/korasad/Analis/webapp/backend/app/segmentation/core.py
from pathlib import Path
from collections import deque
from typing import Dict, Tuple

import cv2
import numpy as np
import pydicom


# ---------- утилиты работы с изображениями ----------

def load_rgb_image(path: Path) -> np.ndarray:
    """Загрузка PNG/JPEG -> RGB."""
    img_bgr = cv2.imread(str(path))
    if img_bgr is None:
        raise ValueError(f"Не удалось прочитать изображение: {path}")
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    return img_rgb


def dicom_to_rgb(path: Path) -> np.ndarray:
    """Загрузка DICOM и преобразование в RGB (через нормализацию до 0–255)."""
    ds = pydicom.dcmread(str(path))
    arr = ds.pixel_array.astype(np.float32)

    # простая нормализация
    arr = arr - np.min(arr)
    max_val = np.max(arr)
    if max_val > 0:
        arr = arr / max_val

    arr = (arr * 255.0).astype(np.uint8)

    # делаем 3-канальный RGB из градаций серого
    img_rgb = cv2.cvtColor(arr, cv2.COLOR_GRAY2RGB)
    return img_rgb


def save_rgb_image(img_rgb: np.ndarray, path: Path) -> None:
    """Сохранение RGB-картинки на диск как PNG."""
    path.parent.mkdir(parents=True, exist_ok=True)
    img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
    cv2.imwrite(str(path), img_bgr)


def save_mask(mask: np.ndarray, path: Path) -> None:
    """Сохранение бинарной маски (0/255) как PNG."""
    path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(path), mask)


# ---------- классические методы сегментации ----------

def rgb_to_gray(img_rgb: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)


def threshold_manual_inv(gray: np.ndarray, thresh: int) -> np.ndarray:
    _, mask = cv2.threshold(
        gray, thresh, 255, cv2.THRESH_BINARY_INV
    )
    return mask


def threshold_otsu_inv(gray: np.ndarray) -> Tuple[np.ndarray, float]:
    t, mask = cv2.threshold(
        gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
    )
    return mask, t


def adaptive_mean(gray: np.ndarray, block_size: int, C: int) -> np.ndarray:
    return cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_MEAN_C,
        cv2.THRESH_BINARY,
        block_size,
        C,
    )


def adaptive_gaussian(gray: np.ndarray, block_size: int, C: int) -> np.ndarray:
    return cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        block_size,
        C,
    )


def region_growing(gray: np.ndarray, seed: Tuple[int, int], diff_thresh: int = 12) -> np.ndarray:
    """Простой Region Growing (8-связность). seed = (row, col)."""
    h, w = gray.shape
    sr, sc = seed
    assert 0 <= sr < h and 0 <= sc < w, "Seed вне изображения"

    mask = np.zeros((h, w), dtype=bool)
    mean_val = float(gray[sr, sc])
    region_size = 1

    neighbors = [
        (-1, 0), (1, 0), (0, -1), (0, 1),
        (-1, -1), (-1, 1), (1, -1), (1, 1),
    ]

    q = deque()
    q.append((sr, sc))
    mask[sr, sc] = True

    while q:
        r, c = q.popleft()
        for dr, dc in neighbors:
            rr, cc = r + dr, c + dc
            if 0 <= rr < h and 0 <= cc < w and not mask[rr, cc]:
                val = float(gray[rr, cc])
                if abs(val - mean_val) <= diff_thresh:
                    mask[rr, cc] = True
                    q.append((rr, cc))
                    region_size += 1
                    mean_val = mean_val + (val - mean_val) / region_size

    return (mask.astype(np.uint8) * 255)


def watershed_segmentation(img_rgb: np.ndarray, fg_fraction: float = 0.5) -> np.ndarray:
    """Watershed по аналогии с тем, что ты делал в ноутбуке: возвращаем маску объекта.

    fg_fraction — доля от максимума distance transform, по которой режем foreground.
    """
    img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
    gray = rgb_to_gray(img_rgb)

    _, thresh_inv = cv2.threshold(
        gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
    )

    kernel = np.ones((3, 3), np.uint8)
    opening = cv2.morphologyEx(thresh_inv, cv2.MORPH_OPEN, kernel, iterations=2)
    sure_bg = cv2.dilate(opening, kernel, iterations=3)

    dist = cv2.distanceTransform(opening, cv2.DIST_L2, 5)

    # чуть подстрахуемся, чтобы не уйти в 0 или 1:
    fg_fraction = float(max(0.1, min(fg_fraction, 0.9)))

    _, sure_fg = cv2.threshold(dist, fg_fraction * dist.max(), 255, 0)
    sure_fg = np.uint8(sure_fg)

    unknown = cv2.subtract(sure_bg, sure_fg)

    num_labels, markers = cv2.connectedComponents(sure_fg)
    markers = markers + 1
    markers[unknown == 255] = 0

    markers_ws = cv2.watershed(img_bgr, markers)

    lesion_mask = np.zeros_like(gray, dtype=np.uint8)
    valid = markers_ws > 1
    if np.any(valid):
        uniq, counts = np.unique(markers_ws[valid], return_counts=True)
        lesion_label = uniq[np.argmax(counts)]
        lesion_mask[markers_ws == lesion_label] = 255

    return lesion_mask


def segment_all_methods(
    img_rgb: np.ndarray,
    *,
    manual_thresh: int,
    adaptive_block_size: int,
    adaptive_C: int,
    region_seed: Tuple[int, int],
    region_diff_thresh: int,
    watershed_fg_fraction: float,
) -> Dict[str, np.ndarray]:
    """Запуск всех методов сразу, возвращаем словарь масок."""
    gray = rgb_to_gray(img_rgb)

    manual_inv = threshold_manual_inv(gray, manual_thresh)
    otsu_inv, _ = threshold_otsu_inv(gray)
    adapt_mean = adaptive_mean(gray, adaptive_block_size, adaptive_C)
    adapt_gauss = adaptive_gaussian(gray, adaptive_block_size, adaptive_C)
    rg_mask = region_growing(gray, region_seed, diff_thresh=region_diff_thresh)
    ws_mask = watershed_segmentation(img_rgb, fg_fraction=watershed_fg_fraction)

    return {
        "manual_inv": manual_inv,
        "otsu_inv": otsu_inv,
        "adapt_mean": adapt_mean,
        "adapt_gauss": adapt_gauss,
        "region_growing": rg_mask,
        "watershed": ws_mask,
    }
