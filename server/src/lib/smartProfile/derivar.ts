/**
 * Derivações puras do SMART-PROFILE: origem, raridade, atributos completos,
 * classe e temperamento. Sem banco, sem rede — testável em
 * `runSmartProfileSelfTest.mts`.
 */
import { CLASSES, grupoDaPosicao } from './classes.js';
import type { Atributos, ClasseId, Origem, Raridade, Temperamento } from './tipos.js';

const limitar = (n: number, min = 1, max = 99) => Math.round(Math.min(max, Math.max(min, n)));
const num = (v: unknown, padrao: number) => (typeof v === 'number' && Number.isFinite(v) ? v : padrao);

/** Ajuste de cabeceio por posição — cópia de `headingPosNudge` (src/entities/specialistAttrs.ts). */
function ajusteCabeceio(posicao?: string | null): number {
  const p = (posicao ?? '').trim().toUpperCase();
  if (p === 'ZAG') return 8;
  if (p === 'ATA') return 6;
  if (p === 'GOL') return 4;
  if (p === 'VOL') return 2;
  if (p === 'PE' || p === 'PD' || p === 'MEI') return -4;
  return 0;
}
const limitarEspecialista = (n: number) => Math.max(20, Math.min(95, Math.round(n)));

/**
 * Atributos completos e saneados. Especialista ausente nasce pela MESMA fórmula
 * do jogo (`deriveSpecialistAttrs`, src/entities/specialistAttrs.ts) — senão a
 * ficha mostraria um cabeceio diferente do que o manager vê na tela.
 */
export function atributosCompletos(bruto: Record<string, unknown> | null | undefined, posicao?: string | null): Atributos {
  const a = bruto ?? {};
  // Sem arredondar: o elenco pode guardar decimais, e o OVR tem que bater com o da tela.
  const n = (k: string) => Math.min(100, Math.max(0, num(a[k], 50)));
  const nucleo = {
    passe: n('passe'), marcacao: n('marcacao'), velocidade: n('velocidade'), drible: n('drible'),
    finalizacao: n('finalizacao'), fisico: n('fisico'), tatico: n('tatico'), mentalidade: n('mentalidade'),
    confianca: n('confianca'), fairPlay: n('fairPlay'),
  };
  return {
    ...nucleo,
    cabeceio: num(a.cabeceio, limitarEspecialista(0.52 * nucleo.fisico + 0.34 * nucleo.finalizacao + ajusteCabeceio(posicao))),
    bolaParada: num(a.bolaParada, limitarEspecialista(0.45 * nucleo.finalizacao + 0.4 * nucleo.passe + 0.15 * nucleo.drible)),
    penalti: num(a.penalti, limitarEspecialista(0.55 * nucleo.confianca + 0.45 * nucleo.finalizacao)),
  };
}

/** De onde o jogador veio, pelo id e pelas marcas do elenco salvo. */
export function origemDe(playerId: string, entidade: Record<string, unknown>): Origem {
  if (playerId.startsWith('genesis-')) return 'genesis';
  if (playerId.startsWith('legacy-') || entidade.isLegacy === true) return 'legacy';
  if (playerId.startsWith('mgr')) return 'academia';
  if (entidade.gachaProvenance) return 'gacha';
  if (playerId.startsWith('revela-')) return 'revela';
  return 'bot';
}

/**
 * As cinco raridades do SMART-PROFILE a partir das escalas antigas.
 * Genesis: rótulo do catálogo (Basic…Legend). Legacy: lenda real = Lendário;
 * Revelação (início de carreira) = Épico; AI+ (sem atleta real) = Raro.
 */
export function raridadeDe(origem: Origem, rotulo: string | null | undefined, gacha?: string | null): Raridade {
  const r = (rotulo ?? '').toLowerCase().trim();
  if (origem === 'legacy') {
    if (r.startsWith('ai')) return 'raro';
    if (r.includes('revela')) return 'epico';
    return 'lendario';
  }
  if (origem === 'genesis') {
    if (r === 'legend') return 'lendario';
    if (r === 'gold' || r.includes('ultra')) return 'epico';
    if (r === 'basic' || r === 'academy' || r === '') return 'comum';
    return 'raro'; // Silver, Rare, Retro, Classic, Next
  }
  if (origem === 'gacha') {
    const g = (gacha ?? '').toLowerCase();
    if (g === 'legend') return 'lendario';
    if (g === 'gold' || g === 'rare') return 'epico';
    if (g === 'premium') return 'raro';
    return 'comum';
  }
  return 'comum';
}

/** Espaços do cérebro (MANAGER-IDEAS) ao nascer, por raridade. */
export function espacosDoCerebro(raridade: Raridade): number {
  return { comum: 1, raro: 2, epico: 3, lendario: 3, unico: 3 }[raridade];
}

export interface ResultadoClasse {
  classe: ClasseId;
  afinidade: ClasseId | null;
  notas: Partial<Record<ClasseId, number>>;
}

/** A classe é a de maior nota entre as permitidas para a posição; a afinidade é a segunda. */
export function classeDe(posicao: string, a: Atributos): ResultadoClasse {
  const grupo = grupoDaPosicao(posicao);
  const candidatas = CLASSES.filter((c) => c.grupos.includes(grupo));
  const notas: Partial<Record<ClasseId, number>> = {};
  const ranking = candidatas
    .map((c) => {
      let nota = 0;
      for (const [k, w] of Object.entries(c.perfil)) nota += a[k as keyof Atributos] * (w as number);
      notas[c.id] = Math.round(nota * 10) / 10;
      return { id: c.id, nota };
    })
    // Empate decide pela ordem do catálogo — estável, nunca aleatório.
    .sort((x, y) => y.nota - x.nota);
  return { classe: ranking[0]!.id, afinidade: ranking[1]?.id ?? null, notas };
}

const OUSADIA_DO_COMPORTAMENTO: Record<string, number> = { ofensivo: 70, criativo: 62, equilibrado: 50, defensivo: 34 };

/** Temperamento de nascimento: comportamento antigo + atributos mentais. Lealdade nasce em 50. */
export function temperamentoDe(comportamento: string | null | undefined, a: Atributos, idade: number | null): Temperamento {
  const base = OUSADIA_DO_COMPORTAMENTO[(comportamento ?? '').toLowerCase()] ?? 50;
  const ofensivo = (a.drible + a.finalizacao + a.velocidade) / 3;
  const fase = idade == null ? 55 : idade < 24 ? 70 : idade > 31 ? 40 : 55;
  return {
    ousadia: limitar(0.6 * base + 0.4 * ofensivo),
    frieza: limitar(0.5 * a.mentalidade + 0.3 * a.confianca + 0.2 * a.penalti),
    ambicao: limitar(0.5 * a.confianca + 0.3 * a.mentalidade + 0.2 * fase),
    lealdade: 50,
  };
}
