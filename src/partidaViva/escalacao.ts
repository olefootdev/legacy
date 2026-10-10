/**
 * PARTIDA VIVA — escalação → fichas em campo.
 *
 * Casa: o slot vem da escalação salva (`lineup`: slot → id), que usa os mesmos
 * 11 slots canônicos do catálogo de formações. Quem entrou por substituição (sem
 * slot salvo) cai no primeiro slot livre compatível com a posição.
 * Visitante: mesma regra, pela posição.
 *
 * Rosto: só retrato REAL (portraitTokenUrl → portraitUrl). Sem retrato, a ficha
 * mostra iniciais na cor do time — nunca foto aleatória.
 */
import type { PlayerEntity } from '@/entities/types';
import { playerTokenSrc } from '@/lib/playerPortrait';
import type { Ficha } from './tipos';

const SLOTS = ['gol', 'zag1', 'zag2', 'le', 'ld', 'vol', 'mc1', 'mc2', 'pe', 'ata', 'pd'] as const;

/** Slots preferidos por posição (pt-BR, como no elenco). */
function slotsPreferidos(pos: string): string[] {
  const p = pos.toUpperCase();
  if (p.includes('GOL') || p === 'GK') return ['gol'];
  if (p.includes('ZAG')) return ['zag1', 'zag2'];
  if (p === 'LE' || p === 'ALE') return ['le'];
  if (p === 'LD' || p === 'ALD') return ['ld'];
  if (p.includes('VOL')) return ['vol', 'mc1', 'mc2'];
  if (/(MC|MEI|ME|MD)/.test(p)) return ['mc1', 'mc2', 'vol'];
  if (p === 'PE') return ['pe'];
  if (p === 'PD') return ['pd'];
  return ['ata', 'pe', 'pd'];
}

export function iniciais(nome: string): string {
  const limpo = (nome.match(/"([^"]+)"/)?.[1] ?? nome.split(' — ')[0] ?? nome).trim();
  const partes = limpo.split(/\s+/).filter(Boolean);
  if (partes.length >= 2) return (partes[0]![0]! + partes[1]![0]!).toUpperCase();
  return limpo.slice(0, 2).toUpperCase();
}

/** Nome curto pra rótulo: apelido entre aspas ou o primeiro nome. */
export function nomeCurto(nome: string): string {
  const apelido = nome.match(/"([^"]+)"/)?.[1];
  if (apelido) return apelido.trim();
  return (nome.split(' — ')[0] ?? nome).trim().split(/\s+/)[0] ?? nome;
}

/** Retrato real ou null (nunca o picsum de fallback). */
export function rostoReal(p: Pick<PlayerEntity, 'name' | 'portraitUrl' | 'portraitTokenUrl' | 'id'> | undefined): string | null {
  if (!p) return null;
  if (!p.portraitTokenUrl?.trim() && !p.portraitUrl?.trim()) return null;
  return playerTokenSrc(p, 96);
}

export interface JogadorDeEntrada {
  id: string;
  nome: string;
  pos: string;
  fadiga: number;
  velocidade?: number;
  entidade?: PlayerEntity;
  classe?: string;
}

/** Distribui 11 jogadores nos slots; `fixos` (slot → id) tem prioridade. */
export function montarFichas(
  lado: 'home' | 'away',
  jogadores: JogadorDeEntrada[],
  fixos: Record<string, string> = {},
): Ficha[] {
  const livres = new Set<string>(SLOTS);
  const slotDe = new Map<string, string>();
  const idsEmCampo = new Set(jogadores.map((j) => j.id));
  for (const [slot, id] of Object.entries(fixos)) {
    if (livres.has(slot) && idsEmCampo.has(id) && !slotDe.has(id)) {
      slotDe.set(id, slot);
      livres.delete(slot);
    }
  }
  for (const j of jogadores) {
    if (slotDe.has(j.id)) continue;
    const s = slotsPreferidos(j.pos).find((x) => livres.has(x)) ?? [...livres][0];
    if (!s) continue;
    slotDe.set(j.id, s);
    livres.delete(s);
  }
  return jogadores
    .filter((j) => slotDe.has(j.id))
    .map((j) => ({
      id: j.id,
      nome: nomeCurto(j.nome),
      iniciais: iniciais(j.nome),
      lado,
      slot: slotDe.get(j.id)!,
      rosto: rostoReal(j.entidade),
      fadiga: Math.max(0, Math.min(100, j.fadiga)),
      velocidade: j.velocidade ?? j.entidade?.attrs.velocidade ?? 65,
      classe: j.classe,
    }));
}
