/**
 * SELOS DE CRAQUE — o que o MUNDO devolve pro atleta.
 *
 * Gamificação simples: cada selo é um `true/false` derivado do estado atual. Sem
 * tabela, sem sistema de pontos. Desbloqueado = prova social no perfil público;
 * bloqueado = uma meta clara ("faltam X fãs").
 *
 * ── O QUE SAIU DAQUI, E POR QUÊ ─────────────────────────────────────────────
 * "Ficha completa" morava aqui e foi embora pra `completude.ts`. Ela era a única
 * que dependia SÓ DELE, e misturada com as outras estragava o contador: quem
 * tinha 3 fãs lia "2 de 6" e entendia que tinha falhado, quando tinha feito a
 * parte dele inteira e só faltava o mundo responder.
 *
 * A régua agora é: se o atleta consegue resolver hoje, sozinho, é COMPLETUDE.
 * Se depende de olheiro, de torcida ou de lançamento, é SELO.
 *
 * A ordem é a da jornada: o aval externo, a torcida (dezena → centena), o card.
 */
import type { Talent } from './types';

export interface Selo {
  id: string;
  label: string;
  icon: string;
  unlocked: boolean;
  /** O que falta pra desbloquear (mostrado quando bloqueado). */
  hint: string;
}

const faltam = (n: number, alvo: number) =>
  `Faltam ${Math.max(0, alvo - n)} fãs`;

export function computeSelos(t: Talent): Selo[] {
  const s = t.supporters ?? 0;
  return [
    {
      id: 'scout',
      label: 'Aval do OLE SCOUT',
      icon: '🔎',
      unlocked: t.overall != null,
      hint: 'Aguardando a avaliação do scout',
    },
    {
      id: 'dezena',
      label: 'Primeira dezena',
      icon: '🔟',
      unlocked: s >= 10,
      hint: faltam(s, 10),
    },
    {
      id: 'cinquenta',
      label: 'Meia-centena',
      icon: '⭐',
      unlocked: s >= 50,
      hint: faltam(s, 50),
    },
    {
      id: 'centena',
      label: 'Centena',
      icon: '🔥',
      unlocked: s >= 100,
      hint: faltam(s, 100),
    },
    {
      id: 'card',
      label: 'Card lançado',
      icon: '🏆',
      unlocked: Boolean(t.carded),
      hint: 'Atinja a meta de crescimento pra lançar o card',
    },
  ];
}

/** Quantos selos já foram conquistados (pro contador "3 de 5"). */
export function selosUnlocked(selos: Selo[]): number {
  return selos.filter((x) => x.unlocked).length;
}
