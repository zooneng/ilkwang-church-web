"use client";

import { useEffect, useRef, useState } from "react";
import type { GalleryPhoto } from "@/types/site-content";

const CUBE_SIZE = 210;
const CUBE_HALF = 105;
const CUBE_PERSPECTIVE = 588; // 2.8 * 210px — exact ilkwang.org optics
const EXPANDED_PHOTO_SIZE = 350; // exact ilkwang.org clicked-face card size (350x350)
const DRAG_CLICK_THRESHOLD_PX = 6;

// Calm 3-axis angular velocities (~20s per full Y revolution; 5x gentler than 90 deg/s)
const DEG_PER_SEC_X = 7.2;
const DEG_PER_SEC_Y = 18;
const DEG_PER_SEC_Z = 2.4;

const DRAG_SENSITIVITY_Y = 0.65;
const DRAG_SENSITIVITY_X = 0.4;

const FACE_TRANSFORMS = [
  `translateZ(${CUBE_HALF}px)`,
  `rotateY(180deg) translateZ(${CUBE_HALF}px)`,
  `rotateY(90deg) translateZ(${CUBE_HALF}px)`,
  `rotateY(-90deg) translateZ(${CUBE_HALF}px)`,
  `rotateX(-90deg) translateZ(${CUBE_HALF}px)`,
  `rotateX(90deg) translateZ(${CUBE_HALF}px)`,
] as const;

const FALLBACK_FACES: readonly GalleryPhoto[] = [
  {
    id: "f-1",
    title: "일광교회 가족수련회 공동체",
    category: "수련회와 탐방",
    date: "2014-02-21",
    imageUrl: "/c01/cube-1.png",
  },
  {
    id: "f-2",
    title: "일광교회 주일 예배",
    category: "예배와 절기",
    date: "2017-11-22",
    imageUrl: "/c01/cube-2.png",
  },
  {
    id: "f-3",
    title: "성도 애찬 및 식탁 교제",
    category: "교제와 봉사",
    date: "2017-11-22",
    imageUrl: "/c01/cube-3.png",
  },
  {
    id: "f-4",
    title: "여름 캠프 야외 활동",
    category: "다음세대",
    date: "2014-02-21",
    imageUrl: "/c01/cube-4.png",
  },
  {
    id: "f-5",
    title: "해외 비전트립 선교 현장",
    category: "전도와 선교",
    date: "2016-08-28",
    imageUrl: "/c01/cube-5.png",
  },
  {
    id: "f-6",
    title: "중고등부 여름수련회",
    category: "다음세대",
    date: "2014-02-21",
    imageUrl: "/c01/cube-6.png",
  },
];

interface HeroPhotoCubeProps {
  readonly photos?: readonly GalleryPhoto[];
}

export function HeroPhotoCube({ photos }: HeroPhotoCubeProps) {
  const cubeRef = useRef<HTMLDivElement | null>(null);
  const expandedCardRef = useRef<HTMLDivElement | null>(null);
  const anglesRef = useRef({ rx: 18, ry: 32, rz: 8 });
  const dragRef = useRef({
    active: false,
    captured: false,
    moved: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
  });
  const suppressClickUntilRef = useRef<number>(0);

  const [selectedFace, setSelectedFace] = useState<{
    readonly src: string;
    readonly alt: string;
  } | null>(null);

  const source = photos && photos.length > 0 ? photos : FALLBACK_FACES;
  const sixFaces = FACE_TRANSFORMS.map((transform, idx) => {
    const item = source[idx % source.length];
    return {
      key: `${item.id}-${idx}`,
      src: item.imageUrl,
      alt: item.title,
      transform,
    };
  });

  useEffect(() => {
    let rafId = 0;
    let prevTime = performance.now();

    const applyTransform = () => {
      const el = cubeRef.current;
      if (!el) return;
      const { rx, ry, rz } = anglesRef.current;
      el.style.transform = `rotateX(${rx.toFixed(4)}deg) rotateY(${ry.toFixed(4)}deg) rotateZ(${rz.toFixed(4)}deg)`;
    };

    const tick = (now: number) => {
      const rawDt = (now - prevTime) / 1000;
      prevTime = now;
      // Clamp dt to avoid jumps after background tab switch
      const dt = Math.min(Math.max(rawDt, 0), 0.05);

      if (!(dragRef.current.active && dragRef.current.moved)) {
        anglesRef.current.rx = (anglesRef.current.rx + DEG_PER_SEC_X * dt) % 360;
        anglesRef.current.ry = (anglesRef.current.ry + DEG_PER_SEC_Y * dt) % 360;
      }
      anglesRef.current.rz = (anglesRef.current.rz + DEG_PER_SEC_Z * dt) % 360;

      applyTransform();
      rafId = window.requestAnimationFrame(tick);
    };

    applyTransform();
    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    if (!selectedFace) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedFace(null);
      }
    };

    const handleOutsidePointerDown = (e: PointerEvent) => {
      const cardEl = expandedCardRef.current;
      if (cardEl && e.target instanceof Node && !cardEl.contains(e.target)) {
        setSelectedFace(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handleOutsidePointerDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handleOutsidePointerDown);
    };
  }, [selectedFace]);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) {
      return;
    }
    dragRef.current = {
      active: true,
      captured: false,
      moved: false,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
    };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current.active || dragRef.current.pointerId !== e.pointerId) {
      return;
    }

    if (!dragRef.current.moved) {
      const totalDistance = Math.hypot(
        e.clientX - dragRef.current.startX,
        e.clientY - dragRef.current.startY
      );
      if (totalDistance <= DRAG_CLICK_THRESHOLD_PX) {
        return;
      }
      dragRef.current.moved = true;
      dragRef.current.lastX = e.clientX;
      dragRef.current.lastY = e.clientY;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
        dragRef.current.captured = true;
      } catch {
        // Ignore capture errors on synthetic events
      }
    }

    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;

    anglesRef.current.ry =
      (anglesRef.current.ry + dx * DRAG_SENSITIVITY_Y) % 360;
    anglesRef.current.rx =
      (anglesRef.current.rx - dy * DRAG_SENSITIVITY_X) % 360;

    if (cubeRef.current) {
      const { rx, ry, rz } = anglesRef.current;
      cubeRef.current.style.transform = `rotateX(${rx.toFixed(4)}deg) rotateY(${ry.toFixed(4)}deg) rotateZ(${rz.toFixed(4)}deg)`;
    }
  }

  function handlePointerEnd(e: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current.pointerId === e.pointerId) {
      if (dragRef.current.moved) {
        suppressClickUntilRef.current = performance.now() + 250;
      }
      if (dragRef.current.captured) {
        try {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        } catch {
          // Ignore release errors
        }
      }
      dragRef.current.active = false;
      dragRef.current.captured = false;
      dragRef.current.moved = false;
      dragRef.current.pointerId = -1;
    }
  }

  return (
    <div
      aria-label="일광교회 3D 포토 큐브"
      style={{
        position: "relative",
        width: `${CUBE_SIZE}px`,
        height: `${CUBE_SIZE}px`,
        isolation: "isolate",
      }}
    >
      <div
        className="cursor-grab active:cursor-grabbing select-none touch-none"
        style={{
          width: `${CUBE_SIZE}px`,
          height: `${CUBE_SIZE}px`,
          perspective: `${CUBE_PERSPECTIVE}px`,
          pointerEvents: selectedFace ? "none" : "auto",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <div
          ref={cubeRef}
          style={{
            width: `${CUBE_SIZE}px`,
            height: `${CUBE_SIZE}px`,
            position: "relative",
            transformStyle: "preserve-3d",
            transform: "rotateX(18deg) rotateY(32deg) rotateZ(8deg)",
          }}
        >
          {sixFaces.map((face) => (
            <div
              key={face.key}
              role="button"
              tabIndex={selectedFace ? -1 : 0}
              aria-label={`${face.alt} 사진 보기`}
              onClick={(e) => {
                if (performance.now() < suppressClickUntilRef.current) {
                  e.stopPropagation();
                  return;
                }
                setSelectedFace({ src: face.src, alt: face.alt });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedFace({ src: face.src, alt: face.alt });
                }
              }}
              style={{
                position: "absolute",
                inset: 0,
                transform: face.transform,
                backfaceVisibility: "hidden",
                overflow: "hidden",
                borderRadius: "6px",
                border: "2px solid rgba(255, 255, 255, 0.2)",
                cursor: "pointer",
                background: "#1a2744",
              }}
            >
              <img
                src={face.src}
                alt={face.alt}
                draggable={false}
                className="w-full h-full object-cover object-center block pointer-events-none select-none"
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(0, 0, 0, 0.6)",
                  pointerEvents: "none",
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {selectedFace && (
        <div
          ref={expandedCardRef}
          role="button"
          tabIndex={0}
          aria-label="확대된 큐브 사진 닫기"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedFace(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
              e.preventDefault();
              setSelectedFace(null);
            }
          }}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 50,
            width: `${EXPANDED_PHOTO_SIZE}px`,
            height: `${EXPANDED_PHOTO_SIZE}px`,
            background: "transparent",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <img
            src={selectedFace.src}
            alt={selectedFace.alt}
            draggable={false}
            style={{
              width: `${EXPANDED_PHOTO_SIZE}px`,
              height: `${EXPANDED_PHOTO_SIZE}px`,
              maxWidth: "none",
              objectFit: "cover",
              objectPosition: "center center",
              border: "5px solid rgba(255, 255, 255, 0.18)",
              borderRadius: "4px",
              display: "block",
              userSelect: "none",
            }}
          />
        </div>
      )}
    </div>
  );
}
