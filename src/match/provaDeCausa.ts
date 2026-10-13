/**
 * PROVA DE CAUSA (Partida Viva, Fase 3; docs/MOTOR-DE-POSSES.md §3).
 *
 * O servidor simulou as 10 posses seguintes a um comando DUAS vezes — com e
 * sem ele, com os mesmos dados (server/smartfield/prova_de_causa.py). Aqui só
 * se escreve a frase, no idioma do jogo, a partir dos números. Nada é
 * sorteado nem decidido no aparelho.
 */
import { L } from '@/i18n/L';

export interface NumerosDaJanela {
  posses_casa: number;
  posses: number;
  chutes_casa: number;
  chutes_fora: number;
  xg_casa: number;
  xg_fora: number;
  roubadas_casa: number;
  faltas_casa: number;
  cartoes_casa: number;
  por_jogador: Record<string, Record<string, number>>;
}

export interface MomentoDaJanela { m: number; k: string; lado: 'home' | 'away'; a: string | null }

export interface ProvaDeCausa {
  janela: [number, number];
  causa: { tipo: 'comando' | 'decisao'; jogador?: string; alvo?: string; ordem?: string; grito?: string; estilo?: string };
  com: NumerosDaJanela;
  sem: NumerosDaJanela;
  so_com: MomentoDaJanela[];
  so_sem: MomentoDaJanela[];
  divergiu_em: number | null;
  /** Mundo Paralelo: o que teria acontecido sem a causa. */
  jogadas_sem?: unknown[];
  eventos_sem?: unknown[];
}

/** O pedido de prova que vai junto com o replan. */
export type CausaDoReplan = ProvaDeCausa['causa'];

const KIND: Record<string, string> = {
  goal: L('chegava ao gol', 'got to goal'), chance: L('tinha a chance clara', 'had the clear chance'),
  save: L('obrigava o goleiro', 'forced a save'), woodwork: L('acertava a trave', 'hit the woodwork'),
  shot: L('finalizava', 'had a shot'), penalty: L('sofria o pênalti', 'won the penalty'),
};
const KIND_COM: Record<string, string> = {
  goal: L('chegou ao gol', 'got to goal'), chance: L('teve a chance clara', 'had the clear chance'),
  save: L('obrigou o goleiro', 'forced a save'), woodwork: L('acertou a trave', 'hit the woodwork'),
  shot: L('finalizou', 'had a shot'), penalty: L('sofreu o pênalti', 'won the penalty'),
};

/**
 * A frase da prova. `rotulo` = o que o manager fez ("o grito Cobrar", "a ordem pra Caio").
 * `nome(id)` = o nome curto do jogador.
 */
export function fraseDaProva(p: ProvaDeCausa, rotulo: string, nome: (id: string) => string): string {
  const [ini, fim] = p.janela;
  const partes: string[] = [];
  const c = p.com, s = p.sem;
  const { jogador, alvo } = p.causa;

  // O sujeito primeiro: "marcar o 10" fala do alvo; uma ordem fala de quem recebeu.
  if (alvo && c.por_jogador[alvo] && s.por_jogador[alvo]) {
    const tc = c.por_jogador[alvo]!.toques ?? 0, ts = s.por_jogador[alvo]!.toques ?? 0;
    partes.push(L(`${nome(alvo)} tocou ${tc}× na bola (sem a marcação: ${ts})`, `${nome(alvo)} touched the ball ${tc}× (unmarked: ${ts})`));
    if (jogador && c.por_jogador[jogador]) {
      const dc = c.por_jogador[jogador]!.desarme ?? 0, ds = s.por_jogador[jogador]?.desarme ?? 0;
      if (dc !== ds) partes.push(L(`${nome(jogador)} desarmou ${dc} (sem: ${ds})`, `${nome(jogador)} won it back ${dc}× (without: ${ds})`));
    }
  } else if (jogador && c.por_jogador[jogador] && s.por_jogador[jogador]) {
    const tc = c.por_jogador[jogador]!.toques ?? 0, ts = s.por_jogador[jogador]!.toques ?? 0;
    if (tc !== ts) partes.push(L(`${nome(jogador)}: ${tc} toques (sem a ordem: ${ts})`, `${nome(jogador)}: ${tc} touches (without the order: ${ts})`));
  }
  // O time.
  if (c.chutes_casa !== s.chutes_casa || c.chutes_fora !== s.chutes_fora) {
    partes.push(L(`chutes ${c.chutes_casa}×${c.chutes_fora} (sem: ${s.chutes_casa}×${s.chutes_fora})`, `shots ${c.chutes_casa}–${c.chutes_fora} (without: ${s.chutes_casa}–${s.chutes_fora})`));
  }
  if (c.roubadas_casa !== s.roubadas_casa) partes.push(L(`${c.roubadas_casa} roubadas (sem: ${s.roubadas_casa})`, `${c.roubadas_casa} balls won (without: ${s.roubadas_casa})`));
  if (c.posses && s.posses && c.posses_casa !== s.posses_casa) {
    partes.push(L(`posse ${Math.round((100 * c.posses_casa) / c.posses)}% (sem: ${Math.round((100 * s.posses_casa) / s.posses)}%)`,
      `${Math.round((100 * c.posses_casa) / c.posses)}% possession (without: ${Math.round((100 * s.posses_casa) / s.posses)}%)`));
  }
  if (c.faltas_casa > s.faltas_casa) partes.push(L(`${c.faltas_casa} faltas (sem: ${s.faltas_casa})`, `${c.faltas_casa} fouls (without: ${s.faltas_casa})`));
  // Os momentos que só existiram de um lado.
  const semFrases = p.so_sem.slice(0, 2).map((x) => L(`${x.a ? nome(x.a) : 'eles'} ${KIND[x.k] ?? 'finalizava'} no ${x.m}'`, `${x.a ? nome(x.a) : 'they'} ${KIND[x.k] ?? 'had a shot'} on ${x.m}'`));
  const comFrases = p.so_com.slice(0, 2).map((x) => L(`${x.a ? nome(x.a) : 'eles'} ${KIND_COM[x.k] ?? 'finalizou'} no ${x.m}'`, `${x.a ? nome(x.a) : 'they'} ${KIND_COM[x.k] ?? 'had a shot'} on ${x.m}'`));

  const cabeca = L(`🔬 Prova — ${rotulo} (${ini}'–${fim}'): `, `🔬 Proof — ${rotulo} (${ini}'–${fim}'): `);
  if (!partes.length && !semFrases.length && !comFrases.length) {
    return cabeca + L('nas 10 posses, nada mudou — o comando não pesou ali.', 'over 10 possessions, nothing changed — the call made no difference there.');
  }
  let frase = cabeca + partes.join(' · ');
  if (comFrases.length) frase += (partes.length ? '. ' : '') + L(`Com o comando: ${comFrases.join(', ')}`, `With the call: ${comFrases.join(', ')}`);
  if (semFrases.length) frase += (partes.length || comFrases.length ? '. ' : '') + L(`Sem o comando: ${semFrases.join(', ')}`, `Without the call: ${semFrases.join(', ')}`);
  return frase + '.';
}

/**
 * O ANALISTA LÊ AS DIFERENÇAS (Fase 3): de todas as provas fechadas, qual comando
 * mais mudou o jogo — em chutes, roubadas e lances que só existiram de um lado.
 * Null se nenhum comando foi provado ainda.
 */
export function leituraDasProvas(provas: readonly { rotulo: string; prova: ProvaDeCausa }[]): string | null {
  if (!provas.length) return null;
  const peso = (p: ProvaDeCausa) => {
    const ganhoNosso = p.com.chutes_casa - p.sem.chutes_casa;
    const ganhoDeles = p.com.chutes_fora - p.sem.chutes_fora;
    return { ganhoNosso, ganhoDeles, roubadas: p.com.roubadas_casa - p.sem.roubadas_casa,
      total: Math.abs(ganhoNosso) + Math.abs(ganhoDeles) + Math.abs(p.com.roubadas_casa - p.sem.roubadas_casa) * 0.5 + (p.so_com.length + p.so_sem.length) * 0.5 };
  };
  const melhor = [...provas].map((x) => ({ ...x, w: peso(x.prova) })).sort((a, b) => b.w.total - a.w.total)[0]!;
  if (melhor.w.total === 0) return L('Nenhum comando do 1º tempo mudou as 10 posses seguintes — o jogo seguiu o mesmo.', 'No first-half call changed the next 10 possessions — the game stayed the same.');
  const partes: string[] = [];
  if (melhor.w.ganhoNosso) partes.push(L(`${melhor.w.ganhoNosso > 0 ? '+' : ''}${melhor.w.ganhoNosso} chute${Math.abs(melhor.w.ganhoNosso) === 1 ? '' : 's'} nosso${Math.abs(melhor.w.ganhoNosso) === 1 ? '' : 's'}`, `${melhor.w.ganhoNosso > 0 ? '+' : ''}${melhor.w.ganhoNosso} shot${Math.abs(melhor.w.ganhoNosso) === 1 ? '' : 's'} for us`));
  if (melhor.w.ganhoDeles) partes.push(L(`${melhor.w.ganhoDeles > 0 ? '+' : ''}${melhor.w.ganhoDeles} deles`, `${melhor.w.ganhoDeles > 0 ? '+' : ''}${melhor.w.ganhoDeles} for them`));
  if (melhor.w.roubadas) partes.push(L(`${melhor.w.roubadas > 0 ? '+' : ''}${melhor.w.roubadas} roubada${Math.abs(melhor.w.roubadas) === 1 ? '' : 's'}`, `${melhor.w.roubadas > 0 ? '+' : ''}${melhor.w.roubadas} ball${Math.abs(melhor.w.roubadas) === 1 ? '' : 's'} won`));
  const resumo = partes.length ? partes.join(', ') : L('o jogo tomou outro rumo', 'the game took another path');
  return L(`O comando que mais mudou o jogo: ${melhor.rotulo} (${resumo}, contra o mesmo jogo sem ele).`, `The call that changed the game most: ${melhor.rotulo} (${resumo}, against the same game without it).`);
}
