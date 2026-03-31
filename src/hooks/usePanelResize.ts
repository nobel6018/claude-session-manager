import { useState, useRef } from "react";

const SNAP_THRESHOLD = 8;

function snapToPoint(value: number, points: number[]): number {
  for (const p of points) {
    if (Math.abs(value - p) <= SNAP_THRESHOLD) return p;
  }
  return value;
}

export function usePanelResize(
  defaultWidth: number,
  storageKey: string,
  snapPoints: number[],
  min: number,
  max: number,
) {
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? parseInt(saved) : defaultWidth;
  });

  // 드래그 중 DOM 직접 조작용 ref (React 리렌더링 없이 업데이트)
  const elementRef = useRef<HTMLDivElement>(null);
  const currentWidthRef = useRef(width);

  const reset = () => {
    const w = defaultWidth;
    currentWidthRef.current = w;
    setWidth(w);
    localStorage.removeItem(storageKey);
    if (elementRef.current) elementRef.current.style.width = w + "px";
  };

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = currentWidthRef.current;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    // 드래그 중 CSS transition 제거 → 즉각 반응
    if (elementRef.current) elementRef.current.style.transition = "none";

    const onMove = (e: MouseEvent) => {
      const raw = Math.min(max, Math.max(min, startW + e.clientX - startX));
      const snapped = snapToPoint(raw, snapPoints);
      currentWidthRef.current = snapped;
      // React 거치지 않고 DOM 직접 업데이트 → 리렌더링 없음
      if (elementRef.current) elementRef.current.style.width = snapped + "px";
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      // transition 복원
      if (elementRef.current) elementRef.current.style.transition = "";

      // mouseup 시 단 1회 React 상태 동기화
      const finalWidth = currentWidthRef.current;
      setWidth(finalWidth);
      localStorage.setItem(storageKey, String(finalWidth));
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return { width, elementRef, startResize, reset };
}
