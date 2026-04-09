/** Limita frequência de serialização / envio (ex.: RN ↔ WebView). Aqui: referência para futura ponte. */
export function throttleMs<T>(fn: () => T, minIntervalMs: number): () => T | undefined {
  let last = 0;
  let lastVal: T | undefined;
  return () => {
    const now = performance.now();
    if (now - last < minIntervalMs) return undefined;
    last = now;
    lastVal = fn();
    return lastVal;
  };
}
