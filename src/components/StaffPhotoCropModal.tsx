"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface StaffPhotoCropModalProps {
  readonly imageSrc: string;
  readonly sourceFileName: string;
  readonly staffName: string;
  readonly isSubmitting: boolean;
  readonly onCancel: () => void;
  readonly onApply: (croppedFile: File) => Promise<void> | void;
}

const STAGE_WIDTH = 270;
const STAGE_HEIGHT = 360;
const PREVIEW_DPR = 2;
const EXPORT_WIDTH = 600;
const EXPORT_HEIGHT = 800;
const MAX_ZOOM = 3.0;

const STUDIO_BACKGROUNDS = [
  { label: "밝은 회색", value: "#F4F6F8" },
  { label: "순백색", value: "#FFFFFF" },
  { label: "연한 네이비톤", value: "#E8EEF5" },
] as const;

function sanitizeStem(rawName: string): string {
  const withoutExt = rawName.replace(/\.[^.]+$/u, "");
  const cleaned = withoutExt
    .normalize("NFC")
    .replace(/[^A-Za-z0-9가-힣_-]+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "");
  return cleaned.slice(0, 40) || "staff-portrait";
}

function clampOffsets(
  rawX: number,
  rawY: number,
  natW: number,
  natH: number,
  zoom: number
): { readonly x: number; readonly y: number } {
  const coverScale = Math.max(STAGE_WIDTH / natW, STAGE_HEIGHT / natH);
  const drawW = natW * coverScale * zoom;
  const drawH = natH * coverScale * zoom;
  const maxX = Math.abs(drawW - STAGE_WIDTH) / 2;
  const maxY = Math.abs(drawH - STAGE_HEIGHT) / 2;

  return {
    x: Math.max(-maxX, Math.min(maxX, rawX)),
    y: Math.max(-maxY, Math.min(maxY, rawY)),
  };
}

function computeInitialFraming(
  natW: number,
  natH: number,
  imageSrc: string
): { readonly zoom: number; readonly x: number; readonly y: number } {
  const coverScale = Math.max(STAGE_WIDTH / natW, STAGE_HEIGHT / natH);
  const drawW = natW * coverScale;
  const drawH = natH * coverScale;

  if (imageSrc === "/pastor.png" && drawW > STAGE_WIDTH) {
    const shiftLeftForRightSubject = -((drawW - STAGE_WIDTH) * 0.36);
    const clamped = clampOffsets(shiftLeftForRightSubject, 0, natW, natH, 1);
    return { zoom: 1, x: clamped.x, y: clamped.y };
  }

  if (drawH > STAGE_HEIGHT) {
    // Bias slightly toward upper head/shoulders for tall portraits
    const topBias = ((drawH - STAGE_HEIGHT) / 2) * 0.3;
    const clamped = clampOffsets(0, topBias, natW, natH, 1);
    return { zoom: 1, x: clamped.x, y: clamped.y };
  }

  return { zoom: 1, x: 0, y: 0 };
}

function renderPortraitCanvas(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  targetW: number,
  targetH: number,
  zoom: number,
  offsetX: number,
  offsetY: number,
  bgColor: string
): void {
  const scaleRatio = targetW / STAGE_WIDTH;
  const natW = img.naturalWidth || 1;
  const natH = img.naturalHeight || 1;
  const coverScale = Math.max(STAGE_WIDTH / natW, STAGE_HEIGHT / natH);

  const drawW = natW * coverScale * zoom;
  const drawH = natH * coverScale * zoom;
  const drawX = (STAGE_WIDTH - drawW) / 2 + offsetX;
  const drawY = (STAGE_HEIGHT - drawH) / 2 + offsetY;

  ctx.save();
  ctx.clearRect(0, 0, targetW, targetH);
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    img,
    drawX * scaleRatio,
    drawY * scaleRatio,
    drawW * scaleRatio,
    drawH * scaleRatio
  );
  ctx.restore();
}

export function StaffPhotoCropModal({
  imageSrc,
  sourceFileName,
  staffName,
  isSubmitting,
  onCancel,
  onApply,
}: StaffPhotoCropModalProps) {
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const [loadedImg, setLoadedImg] = useState<HTMLImageElement | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [offset, setOffset] = useState<{ readonly x: number; readonly y: number }>({
    x: 0,
    y: 0,
  });
  const [bgColor, setBgColor] = useState<string>(STUDIO_BACKGROUNDS[0].value);
  const [showGuide, setShowGuide] = useState<boolean>(true);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const img = new window.Image();
    if (imageSrc.startsWith("http://") || imageSrc.startsWith("https://")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => {
      if (cancelled) return;
      const natW = img.naturalWidth || 1;
      const natH = img.naturalHeight || 1;
      const initial = computeInitialFraming(natW, natH, imageSrc);
      setLoadedImg(img);
      setZoom(initial.zoom);
      setOffset({ x: initial.x, y: initial.y });
      setLoadError(null);
    };
    img.onerror = () => {
      if (cancelled) return;
      setLoadError("이미지를 불러올 수 없습니다. 다른 사진 파일을 선택해 주세요.");
    };
    img.src = imageSrc;

    return () => {
      cancelled = true;
    };
  }, [imageSrc]);

  const natW = loadedImg?.naturalWidth ?? 300;
  const natH = loadedImg?.naturalHeight ?? 400;
  const coverScale = Math.max(STAGE_WIDTH / natW, STAGE_HEIGHT / natH);
  const containScale = Math.min(STAGE_WIDTH / natW, STAGE_HEIGHT / natH);
  const containZoom = Number((containScale / coverScale).toFixed(3));
  const minZoom = Math.min(0.65, Number((containZoom * 0.92).toFixed(2)));

  const applyZoom = useCallback(
    (nextRawZoom: number) => {
      const clampedZoom = Math.max(
        minZoom,
        Math.min(MAX_ZOOM, Number(nextRawZoom.toFixed(3)))
      );
      setZoom(clampedZoom);
      setOffset((prev) => clampOffsets(prev.x, prev.y, natW, natH, clampedZoom));
    },
    [minZoom, natH, natW]
  );

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !loadedImg) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    renderPortraitCanvas(
      ctx,
      loadedImg,
      STAGE_WIDTH * PREVIEW_DPR,
      STAGE_HEIGHT * PREVIEW_DPR,
      zoom,
      offset.x,
      offset.y,
      bgColor
    );
  }, [bgColor, loadedImg, offset.x, offset.y, zoom]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSubmitting, onCancel]);

  async function handleConfirmCrop() {
    if (!loadedImg || isSubmitting) return;
    setExportError(null);

    try {
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = EXPORT_WIDTH;
      exportCanvas.height = EXPORT_HEIGHT;
      const ctx = exportCanvas.getContext("2d");
      if (!ctx) {
        throw new Error("브라우저 캔버스 초기화에 실패했습니다.");
      }

      renderPortraitCanvas(
        ctx,
        loadedImg,
        EXPORT_WIDTH,
        EXPORT_HEIGHT,
        zoom,
        offset.x,
        offset.y,
        bgColor
      );

      const blob = await new Promise<Blob | null>((resolve) => {
        exportCanvas.toBlob((result) => resolve(result), "image/png");
      });

      if (!blob) {
        throw new Error("증명사진 이미지 변환에 실패했습니다.");
      }

      const fileName = `${sanitizeStem(sourceFileName || staffName)}-3x4.png`;
      const croppedFile = new File([blob], fileName, { type: "image/png" });
      await onApply(croppedFile);
    } catch (err: unknown) {
      setExportError(
        err instanceof Error
          ? err.message
          : "사진 비율 적용 중 오류가 발생했습니다."
      );
    }
  }

  return (
    <div
      className="fixed inset-0 z-[120] bg-[#0b1320]/70 backdrop-blur-xs overflow-y-auto p-3 sm:p-4 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="staff-photo-crop-title"
    >
      <div className="my-auto bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-[520px] max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-hidden flex flex-col">
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-gray-100 flex items-center justify-between gap-3 shrink-0">
          <div>
            <span className="text-[11px] font-bold text-[#2E7D32]">
              증명사진 규격 (3:4 비율)
            </span>
            <h3
              id="staff-photo-crop-title"
              className="text-sm sm:text-base font-black text-[#1a2744]"
            >
              {staffName} 사진 위치 및 크기 조절
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            aria-label="사진 편집 닫기"
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 inline-flex items-center justify-center text-sm font-bold transition-colors disabled:opacity-50 shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {loadError ? (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs font-semibold text-red-700 text-center">
              {loadError}
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center">
                <div
                  className="relative w-[270px] h-[360px] rounded-xl overflow-hidden border-2 border-[#2E7D32] shadow-md bg-[#F4F6F8] select-none touch-none cursor-grab active:cursor-grabbing"
                  onPointerDown={(e) => {
                    if (!loadedImg) return;
                    e.currentTarget.setPointerCapture(e.pointerId);
                    dragRef.current = {
                      pointerId: e.pointerId,
                      startClientX: e.clientX,
                      startClientY: e.clientY,
                      originX: offset.x,
                      originY: offset.y,
                    };
                  }}
                  onPointerMove={(e) => {
                    const active = dragRef.current;
                    if (!active || active.pointerId !== e.pointerId) return;
                    const dx = e.clientX - active.startClientX;
                    const dy = e.clientY - active.startClientY;
                    setOffset(
                      clampOffsets(
                        active.originX + dx,
                        active.originY + dy,
                        natW,
                        natH,
                        zoom
                      )
                    );
                  }}
                  onPointerUp={(e) => {
                    if (dragRef.current?.pointerId === e.pointerId) {
                      dragRef.current = null;
                    }
                  }}
                  onPointerCancel={() => {
                    dragRef.current = null;
                  }}
                  onWheel={(e) => {
                    e.preventDefault();
                    const step = e.deltaY < 0 ? 0.06 : -0.06;
                    applyZoom(zoom + step);
                  }}
                >
                  <canvas
                    ref={previewCanvasRef}
                    width={STAGE_WIDTH * PREVIEW_DPR}
                    height={STAGE_HEIGHT * PREVIEW_DPR}
                    className="w-[270px] h-[360px] block pointer-events-none"
                  />

                  {showGuide && (
                    <div
                      className="absolute inset-0 pointer-events-none"
                      aria-hidden="true"
                    >
                      <div className="absolute inset-x-0 top-1/3 border-t border-white/40 border-dashed" />
                      <div className="absolute inset-x-0 top-2/3 border-t border-white/40 border-dashed" />
                      <div className="absolute inset-y-0 left-1/3 border-l border-white/40 border-dashed" />
                      <div className="absolute inset-y-0 left-2/3 border-l border-white/40 border-dashed" />
                      <div className="absolute left-1/2 top-[15%] -translate-x-1/2 w-[112px] h-[142px] rounded-full border border-white/55 border-dashed" />
                    </div>
                  )}

                  <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-[#0b1320]/65 text-white text-[10px] font-bold pointer-events-none">
                    드래그하여 위치 이동
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 mt-2 text-center">
                  손가락이나 마우스로 사진을 움직여 얼굴 위치를 맞추고 슬라이더로 크기를 조절하세요.
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 border border-gray-200/80 p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const initial = computeInitialFraming(
                          natW,
                          natH,
                          imageSrc
                        );
                        setZoom(initial.zoom);
                        setOffset({ x: initial.x, y: initial.y });
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                        Math.abs(zoom - 1) < 0.02
                          ? "bg-[#2E7D32] text-white"
                          : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      3:4 꽉 채우기 (크롭)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setZoom(containZoom);
                        setOffset({ x: 0, y: 0 });
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                        Math.abs(zoom - containZoom) < 0.02 && containZoom < 0.98
                          ? "bg-[#2E7D32] text-white"
                          : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      원본 전체 맞춤 (축소)
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowGuide((prev) => !prev)}
                    className="px-2 py-1 rounded-lg text-[11px] font-semibold text-gray-600 hover:bg-gray-200/70 transition-colors"
                  >
                    {showGuide ? "가이드 숨기기" : "가이드 보기"}
                  </button>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-bold text-gray-600 shrink-0">
                    크기 조절
                  </span>
                  <button
                    type="button"
                    onClick={() => applyZoom(zoom - 0.08)}
                    aria-label="사진 축소"
                    className="w-7 h-7 rounded-lg bg-white border border-gray-300 hover:bg-gray-100 text-sm font-black text-gray-700 shrink-0"
                  >
                    −
                  </button>
                  <input
                    type="range"
                    min={minZoom}
                    max={MAX_ZOOM}
                    step={0.01}
                    value={zoom}
                    aria-label="사진 확대 및 축소 비율"
                    onChange={(e) => applyZoom(Number(e.target.value))}
                    className="flex-1 accent-[#2E7D32] cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => applyZoom(zoom + 0.08)}
                    aria-label="사진 확대"
                    className="w-7 h-7 rounded-lg bg-white border border-gray-300 hover:bg-gray-100 text-sm font-black text-gray-700 shrink-0"
                  >
                    +
                  </button>
                  <span className="w-12 text-right text-xs font-bold text-[#1a2744] tabular-nums shrink-0">
                    {Math.round(zoom * 100)}%
                  </span>
                </div>

                {zoom < 0.99 && (
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-200/70">
                    <span className="text-[11px] font-bold text-gray-500">
                      축소 여백 배경색
                    </span>
                    <div className="flex items-center gap-1.5">
                      {STUDIO_BACKGROUNDS.map((bg) => (
                        <button
                          key={bg.value}
                          type="button"
                          onClick={() => setBgColor(bg.value)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-colors ${
                            bgColor === bg.value
                              ? "border-[#2E7D32] bg-[#E8F5E9] text-[#1B5E20]"
                              : "border-gray-300 bg-white text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full border border-gray-300"
                            style={{ backgroundColor: bg.value }}
                          />
                          {bg.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {exportError && (
            <p className="text-xs font-semibold text-red-600 text-center">
              {exportError}
            </p>
          )}
        </div>

        <div className="px-4 sm:px-5 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-100 text-xs font-bold text-gray-700 transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirmCrop}
            disabled={!loadedImg || Boolean(loadError) || isSubmitting}
            className="px-4 py-2 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "사진 반영 중..." : "증명사진 비율로 적용하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
