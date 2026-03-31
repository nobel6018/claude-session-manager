import { useState, useEffect } from "react";

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

  useEffect(() => {
    localStorage.setItem(storageKey, String(width));
  }, [width, storageKey]);

  const reset = () => {
    setWidth(defaultWidth);
    localStorage.removeItem(storageKey);
  };

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (e: MouseEvent) => {
      const raw = Math.min(max, Math.max(min, startW + e.clientX - startX));
      setWidth(snapToPoint(raw, snapPoints));
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return { width, startResize, reset };
}
