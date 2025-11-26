// src/api/client.ts
import type {
  ImageRead,
  SegmentAllRequest,
  SegmentationBatchResponse,
  Pr2Result,
} from "./types";

export const API_BASE_URL = "http://localhost:8000";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `API error ${res.status}: ${res.statusText}${text ? ` - ${text}` : ""}`,
    );
  }
  return (await res.json()) as T;
}

export async function uploadImage(file: File): Promise<ImageRead> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_BASE_URL}/api/images/upload`, {
    method: "POST",
    body: form,
  });

  return handleResponse<ImageRead>(res);
}

export async function segmentAll(
  imageId: number,
  payload: SegmentAllRequest,
): Promise<SegmentationBatchResponse> {
  const res = await fetch(
    `${API_BASE_URL}/api/images/${imageId}/segment/all`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  return handleResponse<SegmentationBatchResponse>(res);
}

// ПР2: YOLO
export async function runPr2(imageId: number): Promise<Pr2Result> {
  const res = await fetch(`${API_BASE_URL}/api/pr2/predict/${imageId}`, {
    method: "POST",
  });

  return handleResponse<Pr2Result>(res);
}
