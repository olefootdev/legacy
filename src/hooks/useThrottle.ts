/**
 * Hook de throttle para otimização de performance — Melhoria #10
 * Reduz frequência de atualizações de stats/momentum.
 */
import { useEffect, useRef, useState } from 'react';

export function useThrottle<T>(value: T, delayMs: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateRef.current;

    if (timeSinceLastUpdate >= delayMs) {
      setThrottledValue(value);
      lastUpdateRef.current = now;
    } else {
      const timeoutId = setTimeout(() => {
        setThrottledValue(value);
        lastUpdateRef.current = Date.now();
      }, delayMs - timeSinceLastUpdate);

      return () => clearTimeout(timeoutId);
    }
  }, [value, delayMs]);

  return throttledValue;
}
