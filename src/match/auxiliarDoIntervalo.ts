/**
 * O auxiliar no intervalo (docs/PARTIDA-VIVA-PLANO.md §7 — Partida Viva, Fase 9).
 *
 * Aponta UM problema do 1º tempo, tirado dos lances que o manager VIU (já com
 * estilo, momento decisivo e comandos aplicados), e sugere a estratégia do 2º
 * tempo. Regra + modelo de texto: sem LLM, determinístico.
 *
 * A sugestão é uma das 3 estratégias do painel do intervalo — que vai pro
 * replan do 2º tempo de verdade (intensidade no motor). Seguir ou não é do manager.
 */
import type { MatchPlanEvent, MatchupChannel } from './quickPlanTypes';
import { L } from '@/i18n/L';

export type Estrategia = 'defensive' | 'balanced' | 'offensive';

export interface LeituraDoIntervalo {
  /** O problema (ou a oportunidade) em uma frase. */
  texto: string;
  /** Estratégia sugerida pro 2º tempo (null = mantém). */
  sugestao: Estrategia | null;
  /** Por quê da sugestão, curto. */
  porque: string;
}

const PERIGO = new Set(['goal', 'shot', 'save', 'chance', 'woodwork', 'penalty']);

const CANAL: Record<MatchupChannel, string> = {
  corredor_esquerdo: L('pela esquerda', 'down the left'),
  corredor_direito: L('pela direita', 'down the right'),
  ataque_central: L('pelo meio', 'through the middle'),
  criacao: L('na criação do meio-campo', 'through midfield build-up'),
  bola_parada: L('em bola parada', 'from set pieces'),
  finalizacao_vs_gk: L('em finalização de frente pro goleiro', 'in one-on-ones with the keeper'),
  pressao: L('na pressão', 'from pressing'),
};

function contar(eventos: readonly MatchPlanEvent[], lado: 'home' | 'away') {
  const porCanal = new Map<MatchupChannel, number>();
  let perigos = 0, gols = 0;
  for (const e of eventos) {
    if (e.actor_side !== lado) continue;
    const base = e.kind.replace(/_(home|away)$/, '');
    if (!PERIGO.has(base)) continue;
    perigos++;
    if (base === 'goal') gols++;
    if (e.channel) porCanal.set(e.channel, (porCanal.get(e.channel) ?? 0) + 1);
  }
  const [canal, vezes] = [...porCanal].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  return { perigos, gols, canal, vezes };
}

/** Lê o 1º tempo. `eventos`: os lances já mostrados (minuto ≤ 45). */
export function leituraDoIntervalo(eventos: readonly MatchPlanEvent[], placar: { casa: number; fora: number }): LeituraDoIntervalo {
  const primeiro = eventos.filter((e) => e.minute <= 45);
  const deles = contar(primeiro, 'away');
  const nossos = contar(primeiro, 'home');

  // 1) O perigo deles concentrado num lugar — o problema nº 1.
  if (deles.canal && deles.vezes >= 3) {
    return {
      texto: L(`Eles chegaram ${deles.vezes} vezes ${CANAL[deles.canal]}.`, `They got in ${deles.vezes} times ${CANAL[deles.canal]}.`),
      sugestao: placar.casa > placar.fora ? 'defensive' : 'balanced',
      porque: placar.casa > placar.fora
        ? L('Fecha esse lado e segura o resultado.', 'Shut that side and hold the lead.')
        : L('Equilibra: menos espaço atrás sem largar o ataque.', 'Balance it: less space behind without dropping the attack.'),
    };
  }
  // 2) A gente cria por um lado e não converte — insiste.
  if (nossos.canal && nossos.vezes >= 3 && placar.casa <= placar.fora) {
    return {
      texto: L(`A gente chegou ${nossos.vezes} vezes ${CANAL[nossos.canal]} e não resolveu.`, `We got in ${nossos.vezes} times ${CANAL[nossos.canal]} and didn't finish it.`),
      sugestao: 'offensive',
      porque: L('O caminho existe — mais gente na frente.', 'The way in is there — more bodies forward.'),
    };
  }
  // 3) Pouca chegada.
  if (nossos.perigos <= 1 && placar.casa <= placar.fora) {
    return {
      texto: L('Quase não chegamos no gol deles.', 'We barely got near their goal.'),
      sugestao: 'offensive',
      porque: L('Precisa arriscar mais no 2º tempo.', 'We need to take more risks after the break.'),
    };
  }
  // 4) Ganhando com folga ou jogo controlado.
  if (placar.casa > placar.fora) {
    return {
      texto: L(`Jogo na mão: ${nossos.perigos} chegadas nossas, ${deles.perigos} deles.`, `Game in hand: ${nossos.perigos} chances for us, ${deles.perigos} for them.`),
      sugestao: null,
      porque: L('Mantém o que está dando certo.', 'Keep doing what works.'),
    };
  }
  return {
    texto: L(`Jogo parelho: ${nossos.perigos} chegadas nossas, ${deles.perigos} deles.`, `Even game: ${nossos.perigos} chances for us, ${deles.perigos} for them.`),
    sugestao: 'balanced',
    porque: L('Sem pressa — o detalhe decide.', 'No rush — details will decide it.'),
  };
}
