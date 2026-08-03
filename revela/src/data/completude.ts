/**
 * PERFIL COMPLETO — só o que depende do próprio atleta.
 *
 * ── POR QUE ISSO SAIU DE DENTRO DOS SELOS ───────────────────────────────────
 * Os Selos de Craque misturavam duas naturezas no mesmo contador. "Ficha
 * completa" depende dele; "Primeira dezena" depende da torcida aparecer. Quem
 * tinha 3 fãs lia "2 de 6" e entendia que tinha falhado — quando na verdade
 * tinha feito a parte dele inteira e só faltava o mundo responder.
 *
 * Agora são duas coisas:
 *   • PERFIL COMPLETO  → o que ele controla. Sobe sozinho, hoje, de graça.
 *   • CONQUISTAS       → o que o mundo devolve. Aval do scout, fãs, card.
 *
 * ── NADA AQUI É OBRIGATÓRIO ─────────────────────────────────────────────────
 * Essa é a regra do produto e ela é deliberada: o cadastro não trava ninguém.
 * O que existe é recompensa por preencher — perfil mais forte, e OLEKO quando a
 * missão correspondente estiver ligada. Barra que cobra funciona; formulário
 * que obriga faz o moleque desistir na terceira pergunta.
 *
 * A ORDEM É A DO IMPACTO: o que mais muda a página de quem visita vem primeiro.
 */
import type { Talent } from './types';

export interface ItemPerfil {
  id: string;
  label: string;
  feito: boolean;
  /** O que ele faz pra completar — texto de ação, não de repreensão. */
  comoFazer: string;
}

export function computeCompletude(t: Talent): ItemPerfil[] {
  return [
    {
      id: 'foto',
      label: 'Foto',
      feito: Boolean(t.portrait),
      comoFazer: 'Manda um retrato teu — é a primeira coisa que a pessoa vê',
    },
    {
      id: 'video',
      label: 'Vídeo',
      feito: Boolean(t.video),
      comoFazer: 'Um link de YouTube com você jogando toca direto na página',
    },
    {
      id: 'historia',
      label: 'História',
      feito: Boolean(t.bio),
      comoFazer: 'Conta de onde você veio — é o que faz alguém lembrar de você',
    },
    {
      id: 'instagram',
      label: 'Instagram',
      feito: Boolean(t.instagram),
      comoFazer: 'Liga teu @ pra torcida te seguir sem sair da página',
    },
    {
      id: 'pe',
      label: 'Pé dominante',
      feito: Boolean(t.strongFoot),
      comoFazer: 'Direito, esquerdo ou os dois',
    },
    {
      id: 'idade',
      label: 'Idade',
      feito: Boolean(t.birthYear),
      comoFazer: 'O ano de nascimento — categoria é a primeira coisa que olheiro filtra',
    },
  ];
}

export function completudePct(itens: ItemPerfil[]): number {
  if (itens.length === 0) return 0;
  return Math.round((itens.filter((i) => i.feito).length / itens.length) * 100);
}
