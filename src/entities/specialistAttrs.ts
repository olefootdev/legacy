/**
 * Atributos ESPECIALISTAS do jogador — `cabeceio`, `bolaParada`, `penalti`.
 *
 * São situacionais: decidem QUEM marca cada tipo de lance, não o OVR. Ficam
 * FORA do cálculo de rating por construção (ver `CoreAttrKey` abaixo e
 * `OvrWeights` em ovrWeights.ts) — adicionar um deles nunca move o overall de
 * ninguém, nunca mexe em card.
 *
 * Como não existe atributo dedicado de porte/cabeceio/falta no modelo antigo,
 * o valor inicial é DERIVADO dos 10 atributos que já existem — ninguém começa
 * em zero e do dia 1 já faz sentido. É só o ponto de partida; a fidelidade fina
 * (batedor especialista de verdade) é evolução futura.
 */
import type { PlayerAttributes } from './types';

export const SPECIALIST_ATTR_KEYS = ['cabeceio', 'bolaParada', 'penalti'] as const;
export type SpecialistAttrKey = (typeof SPECIALIST_ATTR_KEYS)[number];

/** As chaves que ENTRAM no OVR: tudo em PlayerAttributes menos as especialistas. */
export type CoreAttrKey = Exclude<keyof PlayerAttributes, SpecialistAttrKey>;

function clamp(n: number, lo = 20, hi = 95): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

/**
 * Empurrãozinho de cabeceio por posição: quem sobe pra bola alta (zagueiro,
 * centroavante, goleiro) leva vantagem; ponta e meia baixinho, desconto.
 */
function headingPosNudge(pos?: string | null): number {
  switch ((pos ?? '').trim().toUpperCase()) {
    case 'ZAG':
      return 8;
    case 'ATA':
      return 6;
    case 'GOL':
      return 4;
    case 'VOL':
      return 2;
    case 'PE':
    case 'PD':
    case 'MEI':
      return -4;
    default:
      return 0;
  }
}

/**
 * Valor inicial dos 3 especialistas a partir dos atributos que já existem:
 * cabeceio vem do porte + faro de gol, bola parada da técnica (finalização +
 * passe), pênalti da frieza (confiança + finalização).
 */
export function deriveSpecialistAttrs(
  core: Pick<PlayerAttributes, 'passe' | 'drible' | 'finalizacao' | 'fisico' | 'confianca'>,
  pos?: string | null,
): Record<SpecialistAttrKey, number> {
  return {
    cabeceio: clamp(0.52 * core.fisico + 0.34 * core.finalizacao + headingPosNudge(pos)),
    bolaParada: clamp(0.45 * core.finalizacao + 0.4 * core.passe + 0.15 * core.drible),
    penalti: clamp(0.55 * core.confianca + 0.45 * core.finalizacao),
  };
}

/**
 * Garante os 3 campos especialistas num objeto de atributos.
 *
 * Se já vierem preenchidos (finitos), respeita; senão deriva. É o backfill das
 * fronteiras de carga (localStorage antigo, linhas do Supabase sem os campos) —
 * aceita um objeto CRU sem os 3 (por isso o parâmetro é frouxo).
 */
export function withSpecialistDefaults(
  attrs: Record<string, number>,
  pos?: string | null,
): PlayerAttributes {
  const d = deriveSpecialistAttrs(attrs as unknown as PlayerAttributes, pos);
  return {
    ...(attrs as unknown as PlayerAttributes),
    cabeceio: Number.isFinite(attrs.cabeceio) ? attrs.cabeceio : d.cabeceio,
    bolaParada: Number.isFinite(attrs.bolaParada) ? attrs.bolaParada : d.bolaParada,
    penalti: Number.isFinite(attrs.penalti) ? attrs.penalti : d.penalti,
  };
}
