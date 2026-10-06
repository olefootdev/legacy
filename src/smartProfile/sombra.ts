/**
 * MODO SOMBRA (Fase 2A do SMART-PROFILE) — depois de cada Partida Rápida, o
 * jogo conta ao servidor a evolução que aplicou em cada titular (antes e
 * depois). O servidor refaz a conta com o motor dele e grava a comparação.
 *
 * Não muda nada para o jogador: é enviado em segundo plano, sem esperar
 * resposta, e qualquer falha é ignorada. Servidor: server/src/lib/smartProfile/sombra.ts.
 */
import type { OlefootGameState } from '@/game/types';
import { olefootApiBase } from '@/gamespirit/admin/runtimeTruth';
import { getSupabase } from '@/supabase/client';
import { styleAttrWeights } from '@/tactics/styleAttrWeights';

type Linha = { passesOk: number; passesAttempt: number; tackles: number; km: number; rating: number; shotsOn?: number; goals?: number };

export function relatarPartidaSombra(args: {
  seed: string;
  homeScore: number;
  awayScore: number;
  shootoutWin: 'home' | 'away' | null | undefined;
  readingGood: number;
  homeStats: Record<string, Linha>;
  /** Ids da custódia: plano do 1º tempo e, se houve, o replano do 2º (Fase 2B). */
  planos: (string | null | undefined)[];
  antes: OlefootGameState;
  depois: OlefootGameState;
  /** Fase 2C: os números que o servidor decidiu. Chamado só quando ele responde. */
  aoAplicar?: (jogadores: Array<{ id: string; attrs: Record<string, number>; xp: number }>) => void;
}): void {
  void (async () => {
    try {
      const sb = getSupabase();
      const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
      if (!token) return;
      const jogadores = Object.entries(args.homeStats).flatMap(([id, linha]) => {
        const a = args.antes.players[id];
        const d = args.depois.players[id];
        if (!a || !d) return [];
        return [{
          id,
          pos: a.pos,
          antes: { attrs: a.attrs, xp: a.evolutionXp ?? 0, ovrNascimento: a.mintOverall ?? null, taxa: a.evolutionRate ?? null, criadoPeloManager: !!a.managerCreated },
          linha: { rating: linha.rating, passesOk: linha.passesOk, passesAttempt: linha.passesAttempt, tackles: linha.tackles, km: linha.km },
          gols: linha.goals ?? 0,
          chutes: linha.shotsOn ?? 0,
          depois: { attrs: d.attrs, xp: d.evolutionXp ?? 0 },
        }];
      });
      if (!jogadores.length) return;
      const resposta = await fetch(`${olefootApiBase()}/api/player-profiles/sombra/partida`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          seed: args.seed,
          placar: [args.homeScore, args.awayScore],
          penaltis: args.shootoutWin ?? null,
          leitura: args.readingGood,
          estilo: styleAttrWeights(args.antes.manager?.tacticalStyle),
          planos: args.planos.filter((x): x is string => typeof x === 'string'),
          jogadores,
        }),
        keepalive: true,
      });
      if (!args.aoAplicar || !resposta.ok) return;
      const corpo = (await resposta.json().catch(() => null)) as
        { aplicar?: Array<{ id?: unknown; attrs?: unknown; xp?: unknown }> } | null;
      const aplicar = (corpo?.aplicar ?? []).flatMap((j) =>
        typeof j?.id === 'string' && j.attrs && typeof j.attrs === 'object' && typeof j.xp === 'number'
          ? [{ id: j.id, attrs: j.attrs as Record<string, number>, xp: j.xp }]
          : []);
      if (aplicar.length) args.aoAplicar(aplicar);
    } catch {
      // O crédito do servidor nunca atrapalha o jogo: sem rede, vale o otimista.
    }
  })();
}
