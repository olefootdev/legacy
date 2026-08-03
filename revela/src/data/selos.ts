/**
 * SELOS DE CRAQUE — as conquistas colecionáveis do talento.
 *
 * Gamificação simples: cada selo é um `true/false` derivado do dado que o perfil
 * JÁ tem (foto, vídeo, apoiadores, status). Sem tabela, sem sistema de pontos —
 * só a leitura do estado atual. Desbloqueado = prova social no perfil público;
 * bloqueado = uma meta clara ("faltam X apoiadores").
 *
 * A ordem é a da jornada: primeiro o que depende só dele (ficha), depois o aval
 * externo (scout), depois a torcida (dezena → centena), e no fim o card.
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
      id: 'ficha',
      label: 'Ficha completa',
      icon: '📋',
      unlocked: Boolean(t.portrait && t.video),
      hint: 'Adicione foto e vídeo à ficha',
    },
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

/** Quantos selos já foram conquistados (pro contador "4 de 6"). */
export function selosUnlocked(selos: Selo[]): number {
  return selos.filter((x) => x.unlocked).length;
}
