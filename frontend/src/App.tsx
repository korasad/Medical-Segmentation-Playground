// src/App.tsx
import React, { useCallback, useState } from "react";
import { API_BASE_URL, uploadImage, segmentAll, runPr2 } from "./api/client";
import type {
  ImageRead,
  SegmentationRead,
  SegmentAllRequest,
  Pr2Result,
} from "./api/types";

type Seed = { x: number; y: number } | null;
type TabId = "pr1" | "pr2";

const METHOD_INFO: Record<
  string,
  { title: string; description: string }
> = {
  manual_inv: {
    title: "Ручной порог (INV)",
    description:
      "Глобальная бинаризация с фиксированным порогом. Хорошо работает при однородном освещении, но чувствительна к выбору порога и перепадам яркости.",
  },
  otsu_inv: {
    title: "Оцу (INV)",
    description:
      "Автоматический подбор порога по гистограмме. Часто даёт лучший баланс между захватом объекта и фона без ручной настройки.",
  },
  adapt_mean: {
    title: "Адаптивный MEAN",
    description:
      "Порог вычисляется отдельно в каждом окне как среднее по локальному окну. Устойчив к неравномерному освещению, но сильно реагирует на шум и текстуру.",
  },
  adapt_gauss: {
    title: "Адаптивный GAUSSIAN",
    description:
      "Как адаптивный MEAN, но с гауссовыми весами в окне. Позволяет сильнее учитывать соседние пиксели, но может ещё активнее подхватывать шум.",
  },
  region_growing: {
    title: "Region Growing",
    description:
      "Рост области от seed-точки по близости яркости. Хорошо иллюстрирует, как влияет выбор начальной точки и порога diff_thresh. Часто даёт пересегментацию.",
  },
  watershed: {
    title: "Watershed",
    description:
      "Алгоритм водораздела на основе маркеров. Позволяет уточнить границы объекта, но чувствителен к шагам подготовки (порог, морфология, маркеры).",
  },
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>("pr1");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [image, setImage] = useState<ImageRead | null>(null);
  const [seed, setSeed] = useState<Seed>(null);
  const [results, setResults] = useState<SegmentationRead[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSegmenting, setIsSegmenting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Параметры ПР1
  const [manualThresh, setManualThresh] = useState(120);
  const [adaptiveBlockSize, setAdaptiveBlockSize] = useState(35);
  const [adaptiveC, setAdaptiveC] = useState(5);
  const [regionDiffThresh, setRegionDiffThresh] = useState(12);
  const [watershedFgFraction, setWatershedFgFraction] = useState(0.5);

  // ПР2 (YOLO)
  const [pr2Result, setPr2Result] = useState<Pr2Result | null>(null);
  const [isPr2Running, setIsPr2Running] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setImage(null);
    setSeed(null);
    setResults([]);
    setPr2Result(null);
    setError(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setError(null);
    try {
      const img = await uploadImage(selectedFile);
      setImage(img);
      setSeed(null);
      setResults([]);
      setPr2Result(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Ошибка загрузки");
    } finally {
      setIsUploading(false);
    }
  };

  const handleImageClick = useCallback(
    (e: React.MouseEvent<HTMLImageElement, MouseEvent>) => {
      if (!image) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const scaleX = rect.width / image.width;
      const scaleY = rect.height / image.height;

      const x = Math.round(clickX / scaleX);
      const y = Math.round(clickY / scaleY);

      setSeed({ x, y });
    },
    [image],
  );

  const handleResetSeed = () => {
    setSeed(null);
  };

  const handleRunSegmentation = async () => {
    if (!image) return;

    const blockSize =
      adaptiveBlockSize % 2 === 0 ? adaptiveBlockSize + 1 : adaptiveBlockSize;

    const seedToUse: { x: number; y: number } =
      seed ?? {
        x: Math.round(image.width / 2),
        y: Math.round(image.height / 2),
      };

    const payload: SegmentAllRequest = {
      manual_thresh: manualThresh,
      adaptive_block_size: blockSize,
      adaptive_C: adaptiveC,
      region_growing: {
        seed_x: seedToUse.x,
        seed_y: seedToUse.y,
        diff_thresh: regionDiffThresh,
      },
      watershed_fg_fraction: watershedFgFraction,
    };

    setIsSegmenting(true);
    setError(null);
    try {
      const resp = await segmentAll(image.id, payload);
      setResults(resp.results);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Ошибка сегментации");
    } finally {
      setIsSegmenting(false);
    }
  };

  // Сохранить одну маску
  const handleSaveMask = async (seg: SegmentationRead) => {
    try {
      setError(null);
      const url = `${API_BASE_URL}${seg.result_url}?v=${seg.id}&download=1`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const objectUrl = window.URL.createObjectURL(blob);

      const baseName = image?.original_filename
        ? image.original_filename.replace(/\.[^/.]+$/, "")
        : "image";
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${baseName}_${seg.method}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error(err);
      setError("Не удалось сохранить маску. Проверьте консоль браузера.");
    }
  };

  // Сохранить всё в одном PNG: оригинал + все маски (ПР1)
  const handleSaveAllMasks = async () => {
    if (!image || !results.length) return;

    try {
      setError(null);

      const baseName = image.original_filename
        ? image.original_filename.replace(/\.[^/.]+$/, "")
        : "image";

      const tiles = [
        {
          title: "Оригинал",
          url: `${API_BASE_URL}${image.preview_url}`,
        },
        ...results.map((r) => {
          const info = METHOD_INFO[r.method] ?? { title: r.method };
          return {
            title: info.title,
            url: `${API_BASE_URL}${r.result_url}?v=${r.id}`,
          };
        }),
      ];

      const images = await Promise.all(
        tiles.map(
          (tile) =>
            new Promise<HTMLImageElement>((resolve, reject) => {
              const imgEl = new Image();
              imgEl.crossOrigin = "anonymous";
              imgEl.onload = () => resolve(imgEl);
              imgEl.onerror = (err) => reject(err);
              imgEl.src = tile.url;
            }),
        ),
      );

      const cols = 2;
      const rows = Math.ceil(tiles.length / cols);
      const tileSize = 256;
      const headerHeight = 22;

      const canvas = document.createElement("canvas");
      canvas.width = cols * tileSize;
      canvas.height = rows * (tileSize + headerHeight);

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Canvas not supported");
      }

      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.textBaseline = "top";
      ctx.font =
        "12px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

      tiles.forEach((tile, index) => {
        const imgEl = images[index];
        const col = index % cols;
        const row = Math.floor(index / cols);

        const x = col * tileSize;
        const y = row * (tileSize + headerHeight);

        ctx.fillStyle = "#e5e7eb";
        ctx.fillText(tile.title, x + 4, y + 4);

        const availableWidth = tileSize;
        const availableHeight = tileSize;

        const imgAspect = imgEl.width / imgEl.height;
        const tileAspect = availableWidth / availableHeight;

        let drawWidth: number;
        let drawHeight: number;

        if (imgAspect > tileAspect) {
          drawWidth = availableWidth;
          drawHeight = availableWidth / imgAspect;
        } else {
          drawHeight = availableHeight;
          drawWidth = availableHeight * imgAspect;
        }

        const imgX = x + (availableWidth - drawWidth) / 2;
        const imgY = y + headerHeight + (availableHeight - drawHeight) / 2;

        ctx.drawImage(imgEl, imgX, imgY, drawWidth, drawHeight);
      });

      canvas.toBlob((blob) => {
        if (!blob) {
          setError("Не удалось сформировать PNG.");
          return;
        }
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${baseName}_all_methods.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      }, "image/png");
    } catch (err) {
      console.error(err);
      setError("Не удалось сохранить сводное изображение. Проверьте консоль.");
    }
  };

  // ПР2 — запуск YOLO
  const handleRunPr2 = async () => {
    if (!image) return;
    setIsPr2Running(true);
    setError(null);
    try {
      const res = await runPr2(image.id);
      setPr2Result(res);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Ошибка детекции YOLO");
    } finally {
      setIsPr2Running(false);
    }
  };

  const renderHelp = (text: string) => (
    <span className="relative inline-block group">
      <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-500 text-[10px] leading-none text-slate-300">
        ?
      </span>
      <span className="pointer-events-none absolute left-1/2 top-full z-20 hidden w-64 -translate-x-1/2 rounded-md border border-slate-700 bg-slate-900/95 px-2 py-1 text-[11px] text-slate-100 shadow-lg shadow-black/60 group-hover:block">
        {text}
      </span>
    </span>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <header className="flex flex-col gap-3">
          <div>
            <h1 className="text-2xl font-semibold">
              Medical Segmentation Playground
            </h1>
            <p className="text-sm text-slate-400">
              ПР1: классические методы (бинаризация, Region Growing, Watershed).
              ПР2: YOLO-детекция/сегментация (Ultralytics).
            </p>
          </div>

          {/* Переключатель вкладок ПР1/ПР2 */}
          <div className="inline-flex rounded-xl bg-slate-900 border border-slate-700 p-1 text-xs w-fit">
            <button
              onClick={() => setActiveTab("pr1")}
              className={`px-3 py-1 rounded-lg ${
                activeTab === "pr1"
                  ? "bg-slate-800 text-slate-100"
                  : "text-slate-400 hover:text-slate-100"
              }`}
            >
              ПР1 · Сегментация
            </button>
            <button
              onClick={() => setActiveTab("pr2")}
              className={`px-3 py-1 rounded-lg ${
                activeTab === "pr2"
                  ? "bg-slate-800 text-slate-100"
                  : "text-slate-400 hover:text-slate-100"
              }`}
            >
              ПР2 · YOLO
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-lg border border-red-500/50 bg-red-950/30 px-4 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Левая колонка: загрузка + параметры (под вкладку) */}
          <div className="space-y-4">
            {/* Загрузка */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-slate-900/50">
              <h2 className="text-lg font-medium mb-2">Загрузка изображения</h2>
              <p className="text-xs text-slate-400 mb-3">
                Поддерживаются PNG, JPEG и DICOM (.dcm). Одинаково
                используются во всех практиках.
              </p>

              <input
                type="file"
                accept="image/*,.dcm"
                onChange={handleFileChange}
                className="block w-full text-sm text-slate-200 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-500 cursor-pointer"
              />
              {selectedFile && (
                <p className="mt-2 text-xs text-slate-400 truncate">
                  Выбран файл:{" "}
                  <span className="font-mono">{selectedFile.name}</span>
                </p>
              )}

              <button
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
                className="mt-4 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-600/40 disabled:cursor-not-allowed disabled:bg-slate-700"
              >
                {isUploading ? "Загрузка..." : "Загрузить"}
              </button>
            </div>

            {/* Параметры / инфо в зависимости от вкладки */}
            {activeTab === "pr1" && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-slate-900/50">
                <h2 className="text-lg font-medium mb-3">
                  Параметры сегментации (ПР1)
                </h2>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-slate-300 flex items-center">
                      Ручной порог
                      {renderHelp(
                        "Порог яркости для глобальной бинаризации. При значении ниже порога пиксели относятся к фону, выше — к объекту (после инверсии наоборот).",
                      )}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={255}
                      value={manualThresh}
                      onChange={(e) =>
                        setManualThresh(Number(e.target.value))
                      }
                      className="w-20 rounded-md bg-slate-800 px-2 py-1 text-right text-sm text-slate-100 border border-slate-600"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <label className="text-slate-300 flex items-center">
                      Block size
                      {renderHelp(
                        "Размер локального окна для адаптивной бинаризации. Должен быть нечётным. Чем больше окно, тем более сглаженный локальный порог.",
                      )}
                    </label>
                    <input
                      type="number"
                      min={3}
                      step={2}
                      value={adaptiveBlockSize}
                      onChange={(e) =>
                        setAdaptiveBlockSize(Number(e.target.value))
                      }
                      className="w-20 rounded-md bg-slate-800 px-2 py-1 text-right text-sm text-slate-100 border border-slate-600"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <label className="text-slate-300 flex items-center">
                      C (адаптивный)
                      {renderHelp(
                        "Константа, которая вычитается из локального среднего/гауссового значения. Позволяет делать порог более строгим или мягким.",
                      )}
                    </label>
                    <input
                      type="number"
                      value={adaptiveC}
                      onChange={(e) => setAdaptiveC(Number(e.target.value))}
                      className="w-20 rounded-md bg-slate-800 px-2 py-1 text-right text-sm text-slate-100 border border-slate-600"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <label className="text-slate-300 flex items-center">
                      diff_thresh (RG)
                      {renderHelp(
                        "Максимально допустимое отличие яркости пикселя от средней яркости области при росте региона. Чем больше значение, тем быстрее область 'расползается'.",
                      )}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={255}
                      value={regionDiffThresh}
                      onChange={(e) =>
                        setRegionDiffThresh(Number(e.target.value))
                      }
                      className="w-20 rounded-md bg-slate-800 px-2 py-1 text-right text-sm text-slate-100 border border-slate-600"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <label className="text-slate-300 flex items-center">
                      Watershed fg fraction
                      {renderHelp(
                        "Коэффициент от 0.1 до 0.9, определяющий порог по distance transform при выделении foreground для Watershed. Меньше — агрессивнее, больше — консервативнее.",
                      )}
                    </label>
                    <input
                      type="number"
                      min={0.1}
                      max={0.9}
                      step={0.05}
                      value={watershedFgFraction}
                      onChange={(e) =>
                        setWatershedFgFraction(Number(e.target.value))
                      }
                      className="w-20 rounded-md bg-slate-800 px-2 py-1 text-right text-sm text-slate-100 border border-slate-600"
                    />
                  </div>

                  <div className="border-t border-slate-800 pt-3 mt-3 text-xs text-slate-400 space-y-1">
                    <p>
                      Seed для Region Growing можно выбрать кликом по
                      изображению. Если не кликать — используется центр.
                    </p>
                    {seed && (
                      <button
                        type="button"
                        onClick={handleResetSeed}
                        className="text-xs text-sky-300 hover:text-sky-200 underline underline-offset-2"
                      >
                        Сбросить seed и использовать центр изображения
                      </button>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleRunSegmentation}
                  disabled={!image || isSegmenting}
                  className="mt-4 inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-500/40 disabled:cursor-not-allowed disabled:bg-slate-700"
                >
                  {isSegmenting ? "Сегментация..." : "Запустить все методы"}
                </button>
              </div>
            )}

            {activeTab === "pr2" && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-slate-900/50">
                <h2 className="text-lg font-medium mb-3">
                  YOLO-детекция/сегментация (ПР2)
                </h2>
                <p className="text-xs text-slate-400 mb-2">
                  Используется обученная модель YOLO (Ultralytics) с весами из
                  ПР2. На вход подаётся то же загруженное изображение.
                </p>
                <p className="text-xs text-slate-500 mb-3">
                  Обучение, анализ датасета, метрики (Precision, Recall, mAP)
                  остаются в ноутбуке ПР2, здесь — интерактивный инференс и
                  визуализация результатов.
                </p>

                <button
                  onClick={handleRunPr2}
                  disabled={!image || isPr2Running}
                  className="inline-flex items-center justify-center rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-black shadow-md shadow-amber-500/40 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
                >
                  {isPr2Running ? "Запуск YOLO..." : "Запустить YOLO на изображении"}
                </button>
              </div>
            )}
          </div>

          {/* Центральная колонка: исходное изображение + seed */}
          <div className="lg:col-span-1 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-slate-900/50 flex flex-col">
            <h2 className="text-lg font-medium mb-3">Исходное изображение</h2>
            {!image && (
              <p className="text-sm text-slate-400">
                Загрузите изображение, чтобы увидеть превью. Для ПР1 можно
                выбирать seed кликом по картинке.
              </p>
            )}

            {image && (
              <div className="space-y-2">
                <p className="text-xs text-slate-400">
                  Файл:{" "}
                  <span className="font-mono">{image.original_filename}</span>{" "}
                  {image.is_dicom && (
                    <span className="ml-1 rounded bg-slate-800 px-2 py-0.5 text-[10px] uppercase">
                      DICOM
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-400">
                  Размер: {image.width}×{image.height}
                </p>
                {activeTab === "pr1" && (
                  <>
                    {seed ? (
                      <p className="text-xs text-emerald-300">
                        Выбран seed: (x={seed.x}, y={seed.y}). Нажмите по
                        другой точке, чтобы изменить.
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500">
                        Seed не выбран — по умолчанию используется центр.
                      </p>
                    )}
                  </>
                )}

                <div className="mt-2 relative border border-slate-700 rounded-xl overflow-hidden bg-black/60">
                  <img
                    src={`${API_BASE_URL}${image.preview_url}`}
                    alt="preview"
                    className={`w-full h-auto select-none ${
                      activeTab === "pr1" ? "cursor-crosshair" : "cursor-default"
                    }`}
                    onClick={activeTab === "pr1" ? handleImageClick : undefined}
                  />
                  {image && seed && activeTab === "pr1" && (
                    <div
                      className="pointer-events-none absolute z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-400 shadow shadow-red-500"
                      style={{
                        left: `${(seed.x / image.width) * 100}%`,
                        top: `${(seed.y / image.height) * 100}%`,
                      }}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Правая колонка: результаты — зависят от вкладки */}
          <div className="lg:col-span-1 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-slate-900/50 flex flex-col">
            {activeTab === "pr1" && (
              <>
                <div className="flex items-center justify-between mb-3 gap-3">
                  <h2 className="text-lg font-medium">Результаты сегментации</h2>
                  {results.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSaveAllMasks}
                      className="inline-flex items-center rounded-lg border border-slate-600 bg-slate-800 px-3 py-1 text-[11px] font-medium text-slate-100 hover:bg-slate-700"
                    >
                      Сохранить сводное PNG
                    </button>
                  )}
                </div>

                {!results.length && (
                  <p className="text-sm text-slate-400">
                    После запуска ПР1 здесь появятся маски для всех методов.
                    Можно менять параметры и запускать несколько раз — новые
                    результаты будут перезаписывать старые.
                  </p>
                )}

                {results.length > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    {results.map((r) => {
                      const info = METHOD_INFO[r.method] ?? {
                        title: r.method,
                        description: "",
                      };
                      return (
                        <div
                          key={r.id}
                          className="border border-slate-700 rounded-xl bg-black/50 flex flex-col relative"
                        >
                          <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-slate-300 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between gap-1">
                            <span className="truncate">{info.title}</span>
                            {info.description && (
                              <span className="relative inline-block group">
                                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-500 text-[10px] leading-none text-slate-300">
                                  ?
                                </span>
                                <span className="pointer-events-none absolute right-0 top-full z-30 hidden w-60 rounded-md border border-slate-700 bg-slate-900/95 px-2 py-1 text-[11px] text-slate-100 shadow-lg shadow-black/60 group-hover:block">
                                  {info.description}
                                </span>
                              </span>
                            )}
                          </div>

                          <div className="relative w-full aspect-square bg-black/80 flex items-center justify-center">
                            <img
                              src={`${API_BASE_URL}${r.result_url}?v=${r.id}`}
                              alt={r.method}
                              className="max-w-full max-h-full object-contain"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleSaveMask(r)}
                            className="m-2 mt-1 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-100 hover:bg-slate-700"
                          >
                            Сохранить PNG
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {activeTab === "pr2" && (
              <>
                <h2 className="text-lg font-medium mb-3">
                  Результаты YOLO (ПР2)
                </h2>

                {!pr2Result && (
                  <p className="text-sm text-slate-400">
                    После запуска YOLO здесь появится изображение с наложенными
                    bbox/масками и список детекций.
                  </p>
                )}

                {pr2Result && (
                  <div className="space-y-3">
                    <div className="border border-slate-700 rounded-xl overflow-hidden bg-black/60">
                      <img
                        src={`${API_BASE_URL}${pr2Result.overlay_url}`}
                        alt="YOLO overlay"
                        className="w-full h-auto object-contain"
                      />
                    </div>

                    <div>
                      <p className="text-xs text-slate-400 mb-1">
                        Найдено объектов:{" "}
                        <span className="font-semibold">
                          {pr2Result.detections.length}
                        </span>
                      </p>
                      {pr2Result.detections.length > 0 ? (
                        <ul className="divide-y divide-slate-800 text-xs">
                          {pr2Result.detections.map((d, idx) => (
                            <li
                              key={idx}
                              className="flex items-center justify-between py-1"
                            >
                              <div>
                                <span className="font-semibold">
                                  {d.class_name}
                                </span>{" "}
                                <span className="text-slate-500">
                                  (id {d.class_id})
                                </span>
                              </div>
                              <div className="text-right">
                                <div>
                                  conf{" "}
                                  {(d.confidence * 100).toFixed(1)}
                                  %
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-500">
                          Модель не нашла объектов на этом изображении.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <footer className="pt-4 border-t border-slate-800 text-xs text-slate-500">
            Создано для демонстрации классических методов сегментации изображений. Не предназначено для медицинского использования.
        </footer>
      </div>
    </div>
  );
};

export default App;
