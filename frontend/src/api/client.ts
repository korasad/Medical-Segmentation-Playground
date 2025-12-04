// src/api/client.ts
import type {
  ImageRead,
  SegmentAllRequest,
  SegmentationBatchResponse,
  Pr2Result,
} from "./types";

// Базовый URL для статики (preview_url, result_url).
// В продакшене (через nginx) пусть будет пустой — используем относительные пути.
// src/api/client.ts
// API_BASE_URL = домен + /api
export const API_BASE_URL =
  (window.location.origin ?? "") + "/api";

// хелпер для API: всегда /api/...
const api = (path: string) => `/api${path}`;

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `API error ${res.status}`;
    try {
      const text = await res.text();
      if (text) {
        msg += `: ${text}`;
      }
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

// ===== ПР1: загрузка изображения =====
export async function uploadImage(file: File): Promise<ImageRead> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(api("/images/upload"), {
    method: "POST",
    body: formData,
  });

  return handleResponse<ImageRead>(res);
}

// ===== ПР1: сегментация всеми методами =====
export async function segmentAll(
  imageId: number,
  payload: SegmentAllRequest,
): Promise<SegmentationBatchResponse> {
  const res = await fetch(api(`/images/${imageId}/segment/all`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleResponse<SegmentationBatchResponse>(res);
}

// ===== ПР2: YOLO =====
export async function runPr2(imageId: number): Promise<Pr2Result> {
  const res = await fetch(api(`/pr2/predict/${imageId}`), {
    method: "POST",
  });

  return handleResponse<Pr2Result>(res);
}
