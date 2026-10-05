/**
 * EVOLUÇÃO POR PARTIDA — o servidor aprendendo a fazer a conta (Fase 2A).
 *
 * ⚠️ Cópia fiel de `applyMatchPerformanceEvolution` + `clampPlayerToEvolutionCap`
 * (src/entities/playerEvolution.ts, src/entities/managerProspect.ts). Na Fase
 * 2A o servidor calcula EM PARALELO ao celular e só compara ("modo sombra");
 * `runEvolucaoSelfTest.mts` prova que as duas contas são iguais em milhares de
 * casos. Quando a sombra passar no portão (20 partidas reais sem diferença), a
 * Fase 2C inverte: o servidor passa a ser quem grava.
 *
 * Fica de fora de propósito: `positionKnowledge` (só o motor antigo lê; vira
 * Versatilidade na ficha) e o valor de mercado (vai junto com a Fase 2C).
 */
import { atributosCompletos } from './derivar.js';
import { ovrDe } from './ovr.js';
import { ATRIBUTOS_NUCLEO, type Atributos, type AtributoNucleo } from './tipos.js';

export const CRESCIMENTO_MAXIMO_OVR = 15;
export const TETO_PROSPECTO_ACADEMIA = 75;

export type Resultado = 'win' | 'draw' | 'loss';
export interface LinhaDaPartida { rating: number; passesOk: number; passesAttempt: number; tackles: number; km: number }
export type PesosDeEstilo = Partial<Record<AtributoNucleo, number>>;

export interface EntradaJogador {
  posicao: string;
  atributos: Atributos;
  xp: number;
  taxaEvolucao: number | null;
  ovrNascimento: number | null;
  criadoPeloManager: boolean;
}

const limitarAtributo = (n: number) => Math.min(99, Math.max(35, Math.round(n)));
const limitarTaxa = (n: number) => Math.min(3, Math.max(0.25, n));
const taxaDe = (t: number | null) => (t != null && Number.isFinite(t) ? limitarTaxa(t) : 1);

/** Pesos do estilo vindos do celular: só valores finitos e ≥ 0 entram. */
export function pesosValidos(bruto: unknown): PesosDeEstilo | undefined {
  if (!bruto || typeof bruto !== 'object') return undefined;
  const out: PesosDeEstilo = {};
  for (const k of ATRIBUTOS_NUCLEO) {
    const v = (bruto as Record<string, unknown>)[k];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1) out[k] = v;
  }
  return out;
}

function subirOuDescer(a: Atributos, swing: number, pesos?: PesosDeEstilo): Atributos {
  if (swing === 0) return { ...a };
  const out = { ...a };
  const chaves = [...ATRIBUTOS_NUCLEO] as AtributoNucleo[];
  const temEstilo = !!pesos && ATRIBUTOS_NUCLEO.some((k) => (pesos[k] ?? 0) > 0);
  for (let i = 0; i < Math.abs(swing); i++) {
    if (swing > 0) {
      let k: AtributoNucleo;
      if (temEstilo) {
        // Maior (peso do estilo × 3 − nível/99): no estilo e com margem primeiro.
        k = chaves.reduce((melhor, atual) => {
          const nota = (pesos![atual] ?? 0) * 3 - out[atual] / 99;
          const notaMelhor = (pesos![melhor] ?? 0) * 3 - out[melhor] / 99;
          return nota > notaMelhor ? atual : melhor;
        }, chaves[0]!);
      } else {
        chaves.sort((x, y) => out[x] - out[y]);
        k = chaves[0]!;
      }
      out[k] = limitarAtributo(out[k] + 1);
    } else {
      chaves.sort((x, y) => out[y] - out[x]);
      const k = chaves[0]!;
      out[k] = limitarAtributo(out[k] - 1);
    }
  }
  return out;
}

/** Teto de OVR: prospecto da Academia 75; com OVR de nascimento, nascimento + 15; senão 99. */
export function tetoDeOvr(j: Pick<EntradaJogador, 'criadoPeloManager' | 'ovrNascimento'>): number {
  if (j.criadoPeloManager) return TETO_PROSPECTO_ACADEMIA;
  if (j.ovrNascimento != null && Number.isFinite(j.ovrNascimento)) return Math.min(99, Math.round(j.ovrNascimento) + CRESCIMENTO_MAXIMO_OVR);
  return 99;
}

/** Baixa os 4 maiores atributos, um ponto de cada vez, até o OVR caber no teto. */
export function caberNoTeto(a: Atributos, teto: number, posicao: string): Atributos {
  const out = { ...a };
  for (const k of ATRIBUTOS_NUCLEO) out[k] = limitarAtributo(out[k]);
  let ovr = ovrDe(out, posicao);
  let guarda = 0;
  while (ovr > teto && guarda++ < 240) {
    const ordem = [...ATRIBUTOS_NUCLEO].sort((x, y) => out[y] - out[x]);
    for (let i = 0; i < 4 && ovr > teto; i++) {
      const k = ordem[i]!;
      out[k] = limitarAtributo(out[k] - 1);
      ovr = ovrDe(out, posicao);
    }
  }
  return out;
}

export interface SaidaEvolucao { atributos: Atributos; xp: number; swing: number }

/**
 * Uma partida: swing pela nota, passe, desarme, distância e resultado; sobe ou
 * desce atributos; soma XP (+ XP de leitura do jogo); e encaixa no teto.
 * Mesma ordem de operações do celular (creditQuickPlan → applyMatchPerformanceEvolution
 * → evolutionXp += leitura → clampPlayerToEvolutionCap(ensureMintOverall)).
 */
export function evoluirPorPartida(
  j: EntradaJogador,
  linha: LinhaDaPartida | undefined,
  resultado: Resultado,
  pesos?: PesosDeEstilo,
  xpDeLeitura = 0,
): SaidaEvolucao {
  const taxa = taxaDe(j.taxaEvolucao);
  let swing = 0;
  if (linha) {
    swing += Math.round(((linha.rating ?? 6.5) - 6.5) * taxa * 2);
    const tentativas = linha.passesAttempt ?? 0;
    if (tentativas > 4) {
      const acerto = linha.passesOk / tentativas;
      if (acerto >= 0.78) swing += 1;
      if (acerto <= 0.45) swing -= 1;
    }
    if ((linha.tackles ?? 0) >= 5) swing += 1;
    if ((linha.km ?? 0) >= 10) swing += 1;
  }
  if (resultado === 'win') swing += 1;
  if (resultado === 'loss') swing -= 1;
  swing = Math.max(-5, Math.min(6, swing));
  const ganhoXp = Math.max(0, Math.round((4 + Math.max(0, swing)) * taxa));

  const depois = subirOuDescer(atributosCompletos(j.atributos, j.posicao), swing, pesos);
  // ensureMintOverall: sem OVR de nascimento, o de AGORA (depois da partida) vira o teto-base.
  const nascimento = j.ovrNascimento ?? ovrDe(depois, j.posicao);
  const teto = tetoDeOvr({ criadoPeloManager: j.criadoPeloManager, ovrNascimento: nascimento });
  const atributos = ovrDe(depois, j.posicao) > teto ? caberNoTeto(depois, teto, j.posicao) : depois;
  return { atributos, xp: Math.max(0, j.xp + ganhoXp) + xpDeLeitura, swing };
}
