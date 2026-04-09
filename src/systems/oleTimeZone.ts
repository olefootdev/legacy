/**
 * OLE Time Zone (OTZ) — tempo oficial do ecossistema Olefoot.
 * Usa UTC para todos os managers verem o mesmo relógio de liga / janelas globais.
 * O `WorldClock` continua a sincronizar o estado com `WORLD_CATCH_UP` em tempo real;
 * o relógio OTZ na UI segue o relógio do dispositivo formatado em UTC (sempre atual).
 */

export const OTZ_IANA = 'UTC';
export const OTZ_SHORT_LABEL = 'OTZ';

export function formatOtzTime(d: Date): string {
  return d.toLocaleTimeString('pt-BR', {
    timeZone: OTZ_IANA,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function formatOtzDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', {
    timeZone: OTZ_IANA,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export type SyntheticOnlineSnapshot = {
  /** Total aproximado na rede Olefoot (sintético, estável por janela). */
  online: number;
  /** Em partida (quick/auto ou live). */
  inMatch: number;
  /** No hub de scouting / mercado. */
  scouting: number;
};

/**
 * Números sintéticos para dar contexto de “mundo vivo”, sem backend.
 * Mudam a cada `windowMs` (~45s) para não piscar a cada render.
 */
export function syntheticOnlineStats(epochMs: number, windowMs = 45_000): SyntheticOnlineSnapshot {
  const windowId = Math.floor(epochMs / windowMs);
  let s = windowId * 1103515245 + 12345;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  const online = 11_000 + Math.floor(rnd() * 9_500);
  const inMatch = Math.max(800, Math.floor(online * (0.11 + rnd() * 0.09)));
  const scouting = Math.max(400, Math.floor(online * (0.05 + rnd() * 0.06)));
  return { online, inMatch, scouting };
}

export function formatOnlineCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1).replace('.', ',')}k`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.', ',')}k`;
  return `${n}`;
}
