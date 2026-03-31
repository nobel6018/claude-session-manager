import { useState, useEffect, useRef } from "react";

/** 값이 바뀔 때마다 durationMs 동안 true를 반환 */
export function useFlash(trigger: unknown, durationMs = 300): boolean {
  const [flash, setFlash] = useState(false);
  const prevRef = useRef(trigger);

  useEffect(() => {
    if (prevRef.current !== trigger) {
      prevRef.current = trigger;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), durationMs);
      return () => clearTimeout(t);
    }
  }, [trigger, durationMs]);

  return flash;
}
