/**
 * VALORES & MERCADO DO ELENCO — o conceito RPG-PRICE-LIVE do fundador.
 *
 * "Compra um zagueiro por $1, treina, melhora os atributos e oferece por $3 —
 * quem compra leva um jogador MELHORADO." Esta tela fecha o ciclo: mostra o
 * valor de mercado VIVO de cada jogador (o preço dinâmico já responde a
 * performance/forma/idade — marketValue.ts), quanto ele cresceu desde a
 * criação, quanto treinou — e o botão de VENDER pelo preço que tu escolheres,
 * em OLEFOOT. No topo, o TIME inteiro como ativo: valor total em OLEFOOT e a
 * opção de vender o clube pronto, de uma vez.
 *
 * Dinheiro liquida no servidor (squad_market_liquidar, atômico); o estado
 * local só APLICA o que o servidor decidiu — compra entra via MERGE_PLAYERS,
 * venda sai via APPLY_SQUAD_SALE_AS_SELLER + ack (o plantel local é snapshot
 * e, sem o ack, o próximo persist ressuscitaria o vendido).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeDollarSign, RotateCcw, Tag, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameDispatch, useGameStore } from '@/game/store';
import { useTrackScreen } from '@/progression/trackEvent';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { overallFromAttributes } from '@/entities/player';
import { previewMarketValue } from '@/economy/marketValue';
import type { PlayerEntity } from '@/entities/types';
import { fetchMyOlefootBalance } from '@/wallet/olefoot';
import {
  anunciarJogador,
  anunciarTime,
  cancelarAnuncio,
  comprarAnuncio,
  confirmarVendasAplicadas,
  fetchMeusAnuncios,
  fetchVitrine,
  type MeuAnuncio,
  type SquadListing,
} from '@/market/squadMarketClient';

/**
 * OLEFOOT por centavo de BRO (≈USD): $0,000125/token ⇒ 80 tokens/centavo.
 * Espelho de TOKENS_POR_CENTAVO_USD (server/src/lib/presale/packs.ts) — o
 * preço REAL da pré-venda, não um número de fantasia.
 */
const TOKENS_POR_CENTAVO = 80;

const tok = (n: number) => Math.round(n).toLocaleString('pt-BR');
const dolar = (cents: number) => {
  const d = cents / 100;
  return `$${d.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/** Valor vivo do jogador em centavos de BRO (persistido ou preview determinístico). */
function valorCents(p: PlayerEntity): number {
  return p.marketValueBroCents != null && Number.isFinite(p.marketValueBroCents) && p.marketValueBroCents > 0
    ? p.marketValueBroCents
    : previewMarketValue(p);
}

export function TeamValores() {
  useTrackScreen('screen_team_valores');
  const players = useGameStore((s) => s.players);
  const ledger = useGameStore((s) => s.playerSeasonLedger);
  const clubName = useGameStore((s) => s.club.name);
  const dispatch = useGameDispatch();
  // Ids vivos pro sync de venda de TIME (a callback não pode depender de
  // `players`, senão cada dispatch re-dispara o carregar).
  const playersRef = useRef(players);
  useEffect(() => { playersRef.current = players; }, [players]);

  const [saldoOlefoot, setSaldoOlefoot] = useState<bigint | null>(null);
  const [vitrine, setVitrine] = useState<SquadListing[]>([]);
  const [meusAnuncios, setMeusAnuncios] = useState<MeuAnuncio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [vender, setVender] = useState<PlayerEntity | null>(null);
  const [venderTime, setVenderTime] = useState(false);
  const [preco, setPreco] = useState('');
  const [comprar, setComprar] = useState<SquadListing | null>(null);
  const [agindo, setAgindo] = useState(false);

  const lista = useMemo(() => {
    return Object.values(players)
      .map((p) => {
        const cents = valorCents(p);
        const ovr = overallFromAttributes(p.attrs, p.pos);
        const l = ledger[p.id];
        const baseline = l?.seasonBaselineMarketBroCents;
        return {
          p,
          ovr,
          cents,
          olefoot: cents * TOKENS_POR_CENTAVO,
          crescimento: p.mintOverall != null ? ovr - Math.round(p.mintOverall) : null,
          treinos: (l?.trainingPlansCompleted ?? 0) + (l?.trainingLightSessions ?? 0),
          jogos: l?.matchesPlayed ?? 0,
          valorizacao:
            baseline != null && baseline > 0 ? ((cents - baseline) / baseline) * 100 : null,
        };
      })
      .sort((a, b) => b.cents - a.cents);
  }, [players, ledger]);

  const totalCents = useMemo(() => lista.reduce((s, r) => s + r.cents, 0), [lista]);
  const anuncioPorJogador = useMemo(() => {
    const m = new Map<string, MeuAnuncio>();
    for (const a of meusAnuncios) if (a.kind === 'player' && a.gamePlayerId) m.set(a.gamePlayerId, a);
    return m;
  }, [meusAnuncios]);
  const anuncioDoTime = useMemo(() => meusAnuncios.find((a) => a.kind === 'team') ?? null, [meusAnuncios]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [v, meus, saldo] = await Promise.all([
        fetchVitrine(),
        fetchMeusAnuncios(),
        fetchMyOlefootBalance().catch(() => null),
      ]);
      setVitrine(v.filter((l) => !l.mine));
      setMeusAnuncios(meus.ativos);
      setSaldoOlefoot(saldo);

      // ── O CONTRATO DO VENDEDOR: aplica vendas liquidadas e dá o ack. ─────
      if (meus.vendidosNaoAplicados.length > 0) {
        for (const venda of meus.vendidosNaoAplicados) {
          const ids = venda.kind === 'player' && venda.gamePlayerId
            ? [venda.gamePlayerId]
            : Object.keys(playersRef.current);
          dispatch({
            type: 'APPLY_SQUAD_SALE_AS_SELLER',
            playerIds: ids,
            titulo: venda.kind === 'team' ? 'o time inteiro' : (venda.player?.name ?? 'um jogador'),
            priceOlefoot: Number(venda.priceOlefoot),
            buyerClubName: venda.buyerClub,
          });
        }
        await confirmarVendasAplicadas(meus.vendidosNaoAplicados.map((x) => x.id));
        setAviso(
          meus.vendidosNaoAplicados.length === 1
            ? 'Uma venda foi concluída enquanto estavas fora — OLEFOOT já na carteira.'
            : `${meus.vendidosNaoAplicados.length} vendas concluídas enquanto estavas fora — OLEFOOT já na carteira.`,
        );
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar o mercado.');
    } finally {
      setCarregando(false);
    }
  }, [dispatch]);
  useEffect(() => { void carregar(); }, [carregar]);

  const confirmarVenda = async () => {
    if (agindo) return;
    const valor = Number(preco.replace(/\./g, ''));
    setAgindo(true);
    setErro(null);
    try {
      if (venderTime) await anunciarTime(valor);
      else if (vender) await anunciarJogador(vender.id, valor);
      setVender(null);
      setVenderTime(false);
      setPreco('');
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao anunciar.');
    } finally {
      setAgindo(false);
    }
  };

  const cancelar = async (listingId: string) => {
    if (agindo) return;
    setAgindo(true);
    setErro(null);
    try { await cancelarAnuncio(listingId); await carregar(); }
    catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao cancelar.'); }
    finally { setAgindo(false); }
  };

  const confirmarCompra = async () => {
    if (!comprar || agindo) return;
    setAgindo(true);
    setErro(null);
    try {
      const r = await comprarAnuncio(comprar.id);
      const novos: Record<string, PlayerEntity> = {};
      for (const p of r.players) novos[p.id] = { ...p, listedOnMarket: false };
      dispatch({ type: 'MERGE_PLAYERS', players: novos });
      setAviso(
        r.kind === 'team'
          ? `Time comprado: ${r.players.length} jogadores entraram no teu plantel.`
          : `${r.players[0]?.name ?? 'Jogador'} é teu — já está no plantel.`,
      );
      setComprar(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha na compra.');
    } finally {
      setAgindo(false);
    }
  };

  const precoNum = Number(preco.replace(/\./g, ''));
  const campo = 'w-full border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30';

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      {/* ── HERO: o time como ativo ──────────────────────────────────────── */}
      <section aria-label="Valor do time" className="ole-poster ole-rail px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="ole-eyebrow-poster" style={{ fontSize: '12px' }}>Valor do time · {clubName}</span>
            <p className="mt-1 font-impact leading-none text-neon-yellow tabular-nums" style={{ fontSize: 'clamp(34px, 8vw, 58px)' }}>
              {tok(totalCents * TOKENS_POR_CENTAVO)} <span className="text-[0.45em] text-white/70">OLEFOOT</span>
            </p>
            <p className="mt-1 text-[12px] text-white/50">
              ≈ {dolar(totalCents)} · {lista.length} jogadores · preço vivo: cada partida e treino move este número
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {anuncioDoTime ? (
              <button
                type="button"
                onClick={() => void cancelar(anuncioDoTime.id)}
                disabled={agindo}
                className="border border-rose-500/40 bg-rose-500/5 px-4 py-2 font-display text-xs font-black uppercase tracking-wider text-rose-200 hover:bg-rose-500/15 disabled:opacity-50"
              >
                Time à venda por {tok(Number(anuncioDoTime.priceOlefoot))} — cancelar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { setVenderTime(true); setPreco(String(totalCents * TOKENS_POR_CENTAVO)); }}
                disabled={lista.length < 11}
                title={lista.length < 11 ? 'Time pronto tem pelo menos 11 jogadores' : undefined}
                className="bg-neon-yellow px-4 py-2 font-display text-xs font-black uppercase tracking-wider text-black hover:bg-white disabled:opacity-50"
              >
                Vender o time inteiro
              </button>
            )}
            <span className="text-[11px] text-white/45">
              Teu saldo: {saldoOlefoot == null ? '—' : `${saldoOlefoot.toLocaleString('pt-BR')} OLEFOOT`}
            </span>
          </div>
        </div>
      </section>

      {erro ? <p className="border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{erro}</p> : null}
      {aviso ? <p className="border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">{aviso}</p> : null}

      {/* ── MEU ELENCO: valor, valorização, evolução ─────────────────────── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="ole-eyebrow-poster" style={{ fontSize: '13px' }}>Meu elenco · valor vivo</h2>
          <button type="button" onClick={() => void carregar()} disabled={carregando}
            className="flex items-center gap-1.5 border border-white/15 px-3 py-1.5 font-display text-[10px] font-black uppercase tracking-wider text-white/70 hover:bg-white/10 disabled:opacity-50">
            <RotateCcw className={cn('h-3.5 w-3.5', carregando && 'animate-spin')} /> Atualizar
          </button>
        </div>
        <div className="ole-poster overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-white/10 text-[9px] uppercase tracking-wider text-white/45">
                <th className="px-3 py-2.5">Jogador</th>
                <th className="px-3 py-2.5">OVR</th>
                <th className="px-3 py-2.5" title="OVR atual − OVR de criação">Evoluiu</th>
                <th className="px-3 py-2.5">Treinos</th>
                <th className="px-3 py-2.5">Jogos</th>
                <th className="px-3 py-2.5" title="Variação do valor na temporada (performance move o preço)">Valorização</th>
                <th className="px-3 py-2.5">Valor</th>
                <th className="px-3 py-2.5 text-right">Mercado</th>
              </tr>
            </thead>
            <tbody>
              {lista.map(({ p, ovr, cents, olefoot, crescimento, treinos, jogos, valorizacao }) => {
                const anuncio = anuncioPorJogador.get(p.id);
                return (
                  <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                    <td className="px-3 py-2">
                      <span className="font-bold text-white">{p.name}</span>
                      <span className="ml-2 text-[10px] uppercase text-white/45">
                        {p.pos}{p.age ? ` · ${p.age}a` : ''}{p.rarity && p.rarity !== 'normal' ? ` · ${p.rarity}` : ''}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-impact text-[15px] text-white tabular-nums">{ovr}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {crescimento == null ? <span className="text-white/35">—</span> : crescimento > 0 ? (
                        <span className="text-emerald-300">+{crescimento}</span>
                      ) : (
                        <span className="text-white/45">{crescimento}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-white/60 tabular-nums">{treinos}</td>
                    <td className="px-3 py-2 text-white/60 tabular-nums">{jogos}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {valorizacao == null ? (
                        <span className="text-white/35" title="Entra em campo que o preço começa a andar">—</span>
                      ) : (
                        <span className={cn('inline-flex items-center gap-1', valorizacao >= 0 ? 'text-emerald-300' : 'text-rose-300')}>
                          {valorizacao >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                          {valorizacao >= 0 ? '+' : ''}{valorizacao.toFixed(1)}%
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <span className="font-mono font-bold text-neon-yellow tabular-nums">{tok(olefoot)}</span>
                      <span className="ml-1 text-[10px] text-white/40">OLEFOOT · {dolar(cents)}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      {anuncio ? (
                        <button type="button" onClick={() => void cancelar(anuncio.id)} disabled={agindo}
                          className="border border-rose-500/40 px-2.5 py-1 font-display text-[10px] font-black uppercase text-rose-200 hover:bg-rose-500/10 disabled:opacity-50">
                          À venda por {tok(Number(anuncio.priceOlefoot))} · tirar
                        </button>
                      ) : (
                        <button type="button"
                          onClick={() => { setVender(p); setPreco(String(olefoot)); }}
                          className="border border-neon-yellow/50 px-2.5 py-1 font-display text-[10px] font-black uppercase text-neon-yellow hover:bg-neon-yellow/10">
                          Vender
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {lista.length === 0 ? (
            <p className="p-8 text-center text-sm text-white/40">
              Plantel vazio. <Link to="/mercado" className="text-neon-yellow underline">Vai ao mercado</Link> montar o teu.
            </p>
          ) : null}
        </div>
        <p className="mt-2 text-[11px] text-white/40">
          O valor é o preço dinâmico do jogo (OVR, forma, idade, raridade, escassez), convertido a OLEFOOT pelo
          preço real da pré-venda ($0,000125). Quem tu vendes sai TREINADO — é esse o negócio.
        </p>
      </section>

      {/* ── VITRINE DA COMUNIDADE ────────────────────────────────────────── */}
      <section>
        <h2 className="ole-eyebrow-poster mb-3" style={{ fontSize: '13px' }}>À venda na comunidade</h2>
        {vitrine.length === 0 ? (
          <p className="ole-poster p-8 text-center text-sm text-white/40">
            {carregando ? 'Carregando…' : 'Ninguém anunciou ainda. Sê o primeiro — anuncia um jogador treinado.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {vitrine.map((l) => {
              const precoL = Number(l.priceOlefoot);
              const ref = l.refOlefoot != null ? Number(l.refOlefoot) : null;
              const agio = ref != null && ref > 0 ? ((precoL - ref) / ref) * 100 : null;
              const ovrSnap = l.player
                ? overallFromAttributes(l.player.attrs as unknown as PlayerEntity['attrs'], l.player.pos)
                : null;
              return (
                <div key={l.id} className="ole-poster ole-rail flex flex-col gap-2 p-4">
                  {l.kind === 'player' && l.player ? (
                    <>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-impact text-[18px] uppercase text-white">{l.player.name}</span>
                        <span className="font-impact text-[20px] text-neon-yellow tabular-nums">{ovrSnap ?? '—'}</span>
                      </div>
                      <p className="text-[11px] text-white/50">
                        {l.player.pos}{l.player.age ? ` · ${l.player.age} anos` : ''}
                        {l.player.mintOverall != null && ovrSnap != null && ovrSnap > l.player.mintOverall
                          ? ` · evoluiu +${ovrSnap - Math.round(l.player.mintOverall)} OVR` : ''}
                        {' · '}de {l.seller.club ?? (l.seller.username ? `@${l.seller.username}` : 'outro clube')}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <BadgeDollarSign className="h-4 w-4 text-neon-yellow" />
                        <span className="font-impact text-[18px] uppercase text-white">Time pronto · {l.team?.jogadores ?? '?'} jogadores</span>
                      </div>
                      <p className="text-[11px] text-white/50">
                        {(l.team?.destaques ?? []).map((d) => d.name).filter(Boolean).slice(0, 4).join(' · ') || 'Elenco completo'}
                        {' · '}de {l.seller.club ?? (l.seller.username ? `@${l.seller.username}` : 'outro clube')}
                      </p>
                    </>
                  )}
                  <div className="mt-auto flex items-end justify-between gap-2 border-t border-white/10 pt-2">
                    <div>
                      <p className="font-mono text-[16px] font-bold text-neon-yellow tabular-nums">{tok(precoL)} <span className="text-[10px] text-white/50">OLEFOOT</span></p>
                      <p className="text-[10px] text-white/40">
                        ≈ {dolar(precoL / TOKENS_POR_CENTAVO * 1)}{' '}
                        {agio != null ? (
                          <span className={agio > 0 ? 'text-amber-300' : 'text-emerald-300'}>
                            · {agio > 0 ? '+' : ''}{agio.toFixed(0)}% vs referência
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <button type="button" onClick={() => setComprar(l)}
                      className="bg-neon-yellow px-3 py-1.5 font-display text-[11px] font-black uppercase text-black hover:bg-white">
                      Comprar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── VENDER (jogador ou time) ─────────────────────────────────────── */}
      <ConfirmDialog
        open={vender != null || venderTime}
        onClose={() => (agindo ? null : (setVender(null), setVenderTime(false)))}
        onConfirm={() => void confirmarVenda()}
        eyebrow="Mercado de elenco"
        title={venderTime ? 'Vender o time inteiro?' : `Vender ${vender?.name ?? ''}?`}
        confirmLabel={agindo ? 'Anunciando…' : 'Anunciar'}
        confirmDisabled={agindo || !Number.isInteger(precoNum) || precoNum < 1}
        accent="#fde100"
      >
        <div className="mt-3 space-y-2 text-sm text-white/75">
          {venderTime ? (
            <p>
              O comprador leva <strong>todos os {lista.length} jogadores</strong>, do jeito que estão — treinados.
              Tu ficas com o clube, as estruturas e o OLEFOOT da venda. Referência do elenco:{' '}
              <strong className="text-neon-yellow">{tok(totalCents * TOKENS_POR_CENTAVO)} OLEFOOT</strong>.
            </p>
          ) : vender ? (
            <p>
              Ele sai do plantel como está hoje (OVR {overallFromAttributes(vender.attrs, vender.pos)}
              {vender.mintOverall != null ? `, criado com ${Math.round(vender.mintOverall)}` : ''}). Referência viva:{' '}
              <strong className="text-neon-yellow">{tok(valorCents(vender) * TOKENS_POR_CENTAVO)} OLEFOOT</strong>{' '}
              ({dolar(valorCents(vender))}). O preço é teu — valorizaste, cobra o ágio.
            </p>
          ) : null}
          <label className="block">
            <span className="text-[10px] uppercase text-white/45">Preço em OLEFOOT</span>
            <input className={campo} value={preco} inputMode="numeric"
              onChange={(e) => setPreco(e.target.value.replace(/[^\d]/g, ''))} placeholder="ex.: 24000" />
          </label>
          {Number.isInteger(precoNum) && precoNum >= 1 ? (
            <p className="flex items-center gap-1.5 text-[11px] text-white/50">
              <Tag className="h-3.5 w-3.5" /> {tok(precoNum)} OLEFOOT ≈ {dolar(precoNum / TOKENS_POR_CENTAVO)}
            </p>
          ) : null}
        </div>
      </ConfirmDialog>

      {/* ── COMPRAR ──────────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={comprar != null}
        onClose={() => (agindo ? null : setComprar(null))}
        onConfirm={() => void confirmarCompra()}
        eyebrow="Mercado de elenco"
        title={comprar?.kind === 'team' ? 'Comprar o time inteiro?' : `Comprar ${comprar?.player?.name ?? ''}?`}
        confirmLabel={agindo ? 'Comprando…' : `Pagar ${tok(Number(comprar?.priceOlefoot ?? 0))} OLEFOOT`}
        confirmDisabled={agindo || (saldoOlefoot != null && comprar != null && saldoOlefoot < BigInt(comprar.priceOlefoot))}
        accent="#fde100"
      >
        {comprar ? (
          <div className="mt-3 space-y-1.5 text-sm text-white/75">
            <p>
              {comprar.kind === 'team'
                ? `Levas os ${comprar.team?.jogadores ?? ''} jogadores do ${comprar.seller.club ?? 'vendedor'}, treinados, direto pro teu plantel.`
                : 'Ele entra no teu plantel como está hoje — com toda a evolução que o vendedor pagou pra construir.'}
            </p>
            <p className="text-[11px] text-white/50">
              Débito de {tok(Number(comprar.priceOlefoot))} OLEFOOT na tua carteira
              {saldoOlefoot != null ? ` (saldo: ${saldoOlefoot.toLocaleString('pt-BR')})` : ''}. Sem estorno — mercado é mercado.
            </p>
            {saldoOlefoot != null && saldoOlefoot < BigInt(comprar.priceOlefoot) ? (
              <p className="text-[11px] font-bold text-rose-300">Saldo OLEFOOT insuficiente.</p>
            ) : null}
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
