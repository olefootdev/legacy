import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { donoDaSessao } from '../lib/sessao.js';
import { rateLimit } from '../lib/rateLimit.js';
import { semTabela, sincronizarFichas } from '../lib/smartProfile/sincronizar.js';
import { compararPartida, lerRelato, type Comparacao, type CreditoJogador } from '../lib/smartProfile/sombra.js';
import { diferencaDeAtributos } from '../lib/smartProfile/ficha.js';
import { ovrDe } from '../lib/smartProfile/ovr.js';

/** A linha de `evolucao_sombra` não guarda o crédito — ele vai pra ficha. */
const semCredito = (c: Comparacao & { credito: CreditoJogador[] }): Comparacao => {
  const { credito: _credito, ...resto } = c;
  return resto;
};
import { validarRelato, type ResumoDoPlano } from '../lib/smartProfile/custodia.js';
import type { Ficha } from '../lib/smartProfile/tipos.js';

/**
 * SMART-PROFILE — as fichas do jogador (sessão do manager).
 *
 *   GET /api/player-profiles                     sincroniza com o elenco e devolve as fichas ativas
 *   GET /api/player-profiles/:playerId/memoria   o histórico (Memória) de um jogador
 *   POST /api/player-profiles/sombra/partida     modo sombra (Fase 2A): compara a evolução do celular com a do servidor
 *
 * O manager só vê as próprias fichas: o dono vem do JWT, nunca da URL.
 */
export const playerProfilesRoutes = new Hono();

playerProfilesRoutes.get('/api/player-profiles', rateLimit(30), async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false, erro: 'banco indisponível' }, 503);
  const dono = await donoDaSessao(c.req.header('Authorization'));
  if (!dono) return c.json({ ok: false, erro: 'sessão inválida' }, 401);
  try {
    const r = await sincronizarFichas(sb, dono);
    return c.json({
      ok: true,
      fichas: r.fichas,
      sync: { criadas: r.criadas, atualizadas: r.atualizadas, inativadas: r.inativadas, eventos: r.eventos },
    });
  } catch (e) {
    // Antes da migration rodar, o jogo segue normal: só não há ficha ainda.
    if (semTabela(e as { code?: string; message?: string })) return c.json({ ok: true, fichas: [], indisponivel: true });
    console.error('[player-profiles]', e instanceof Error ? e.message : e);
    return c.json({ ok: false, erro: 'falha ao montar as fichas' }, 500);
  }
});

playerProfilesRoutes.get('/api/player-profiles/:playerId/memoria', rateLimit(60), async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false, erro: 'banco indisponível' }, 503);
  const dono = await donoDaSessao(c.req.header('Authorization'));
  if (!dono) return c.json({ ok: false, erro: 'sessão inválida' }, 401);
  const playerId = c.req.param('playerId') ?? '';
  if (!/^[\w-]{1,120}$/.test(playerId)) return c.json({ ok: false, erro: 'jogador inválido' }, 400);
  const { data, error } = await sb.from('player_profile_events')
    .select('tipo, dados, criado_em').eq('owner_id', dono).eq('player_id', playerId)
    .order('criado_em', { ascending: false }).limit(100);
  if (error) {
    if (semTabela(error)) return c.json({ ok: true, memoria: [], indisponivel: true });
    return c.json({ ok: false, erro: 'falha ao ler a memória' }, 500);
  }
  return c.json({ ok: true, memoria: data ?? [] });
});

/**
 * CRÉDITO DA PARTIDA (Fase 2C) — era modo sombra, agora VALE.
 *
 * O celular relata o desempenho da Partida Rápida. O servidor refaz a conta
 * partindo da FICHA (não do "antes" que o celular manda), grava o resultado em
 * `player_profiles` com um evento `fonte: 'servidor'`, e DEVOLVE os números
 * para o celular aplicar no lugar dos dele.
 *
 * O que sustenta a autoridade: os atributos de partida saem da ficha; a NOTA,
 * que é o que move o swing, é conferida pela custódia contra os lances do plano
 * que o servidor emitiu; e passe/desarme/km — que o caminho vivo manda em zero —
 * têm teto em `limitarLinha`.
 *
 * O que o servidor ainda NÃO credita: economia, fadiga, moral, contratos e
 * nível/RPG. Isso continua no reducer do cliente. Aqui é a progressão de
 * ATRIBUTOS e XP do jogador.
 *
 * A comparação continua sendo gravada em `evolucao_sombra` — agora ela mede se
 * o palpite otimista do celular bateu com a verdade do servidor.
 */
playerProfilesRoutes.post('/api/player-profiles/sombra/partida', rateLimit(30), async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false }, 503);
  const dono = await donoDaSessao(c.req.header('Authorization'));
  if (!dono) return c.json({ ok: false, erro: 'sessão inválida' }, 401);
  const relato = lerRelato(await c.req.json().catch(() => null));
  if (!relato) return c.json({ ok: false, erro: 'relato inválido' }, 400);

  // Ficha INTEIRA: a Fase 2C regrava a linha, então precisa de todas as colunas
  // (a gênese selada inclusive — o trigger recusa update que a altere).
  const { data: fichas } = await sb.from('player_profiles').select('*')
    .eq('owner_id', dono).in('player_id', relato.jogadores.map((j) => j.id));
  const porId = new Map((fichas ?? []).map((f) => [f.player_id as string, f as unknown as Ficha]));
  const cmp = compararPartida(relato, porId);

  // CUSTÓDIA (2B): os planos citados são deste manager e ainda não foram usados?
  // O update é a trava: marca usado só o que estava livre — relato repetido não credita de novo.
  let custodia: 'valida' | 'suspeita' | 'sem_custodia' = 'sem_custodia';
  let custodia_motivos: string[] = [];
  if (relato.planos.length) {
    const { data: usados, error: eUso } = await sb.from('quick_plans_emitidos')
      .update({ usado_em: new Date().toISOString() })
      .eq('owner_id', dono).in('id', relato.planos).is('usado_em', null)
      .select('id, resumo');
    if (!eUso) {
      const resumos = (usados ?? []).map((u) => u.resumo as ResumoDoPlano);
      const v = validarRelato({ placar: relato.placar, jogadores: relato.jogadores.map((j) => ({
        id: j.id, pos: j.pos, attrsAntes: j.antes.attrs, nota: j.linha.rating, gols: j.gols, chutes: j.chutes })) }, resumos);
      custodia_motivos = v.motivos;
      if ((usados ?? []).length < relato.planos.length) custodia_motivos.unshift('plano já usado, inexistente ou de outro manager');
      custodia = custodia_motivos.length ? 'suspeita' : 'valida';
    }
  }

  // FASE 2C — GRAVA A VERDADE NA FICHA. Só os jogadores com ficha (daFicha):
  // sem ficha o servidor não tem base própria e não inventa autoridade.
  // `ignoreDuplicates` na linha de sombra é o que impede creditar duas vezes a
  // mesma seed; por isso a gravação da ficha vem DEPOIS dela ter entrado.
  const { error } = await sb.from('evolucao_sombra').upsert(
    { owner_id: dono, seed: relato.seed, ...semCredito(cmp), planos: relato.planos, custodia, custodia_motivos },
    { onConflict: 'owner_id,seed', ignoreDuplicates: true },
  );
  // A TRAVA DO CRÉDITO é a custódia valer, não o upsert acima ter dado erro:
  // com `ignoreDuplicates` um relato repetido NÃO dá erro, e creditaria duas
  // vezes. `custodia === 'valida'` exige que os planos citados fossem emitidos
  // para este manager E estivessem livres — o `update ... is('usado_em', null)`
  // é atômico, então o replay cai em 'suspeita' e não credita.
  //
  // Falso positivo da custódia falha pro lado seguro: sem crédito do servidor,
  // o número otimista do celular fica de pé e a linha de sombra registra o
  // motivo. O jogador não perde nada; nós ganhamos o caso para investigar.
  const aplicar: Array<{ id: string; attrs: Record<string, number>; xp: number }> = [];
  if (custodia === 'valida') {
    const doServidor = cmp.credito.filter((c) => c.daFicha);
    if (doServidor.length) {
      const agora = new Date().toISOString();
      const linhas = doServidor.map((c) => {
        const base = porId.get(c.id)!;
        return { ...(base as unknown as Record<string, unknown>), owner_id: dono, player_id: c.id,
          atributos: c.atributos, ovr: ovrDe(c.atributos, c.posicao), xp: c.xp, atualizado_em: agora };
      });
      const { error: eFicha } = await sb.from('player_profiles').upsert(linhas, { onConflict: 'owner_id,player_id' });
      if (eFicha) {
        console.error('[credito] gravar fichas', eFicha.message);
      } else {
        const eventos = doServidor
          .map((c) => ({ owner_id: dono, player_id: c.id, tipo: 'atributos' as const,
            dados: { mudancas: diferencaDeAtributos(porId.get(c.id)!.atributos, c.atributos),
              xp: c.xp, swing: c.swing, seed: relato.seed, fonte: 'servidor' } }))
          .filter((e) => Object.keys(e.dados.mudancas as object).length > 0 || e.dados.swing !== 0);
        if (eventos.length) await sb.from('player_profile_events').insert(eventos);
        for (const c of doServidor) aplicar.push({ id: c.id, attrs: c.atributos, xp: c.xp });
      }
    }
  }
  if (error && !semTabela(error) && !/evolucao_sombra/.test(error.message)) {
    console.error('[sombra]', error.message);
  }
  if (cmp.divergencias > 0) console.warn(`[sombra] ${cmp.divergencias}/${cmp.jogadores} divergência(s) seed=${relato.seed}`);
  if (custodia === 'suspeita') console.warn(`[custodia] suspeita seed=${relato.seed}: ${custodia_motivos.slice(0, 3).join('; ')}`);
  // `aplicar` é a ordem para o celular: estes são os números que valem.
  return c.json({ ok: true, divergencias: cmp.divergencias, jogadores: cmp.jogadores, custodia, aplicar });
});
