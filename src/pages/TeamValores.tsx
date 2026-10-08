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
import { ehEdicaoFundacao } from '@/onboarding/sorteioFundacao';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BadgeDollarSign, RotateCcw, Tag, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameDispatch, useGameStore } from '@/game/store';
import { useTrackScreen } from '@/progression/trackEvent';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SecaoRua, SeloRua } from '@/components/ui/Rua';
import { OvrSelo, VazioRua } from '@/components/clube/escada';
import { overallFromAttributes } from '@/entities/player';
import { previewMarketValue } from '@/economy/marketValue';
import type { PlayerEntity } from '@/entities/types';
import { fetchMyOlefootBalance } from '@/wallet/olefoot';
import {
  alugarAnuncio,
  anunciarEmprestimo,
  anunciarJogador,
  anunciarTime,
  cancelarAnuncio,
  comprarAnuncio,
  confirmarDevolucoesAplicadas,
  confirmarVendasAplicadas,
  fetchMeusAnuncios,
  fetchVitrine,
  type MeuAnuncio,
  type MeuEmprestimo,
  type SquadListing,
} from '@/market/squadMarketClient';
import { exercerOpcaoDeCompra, pushValueSnapshots, reivindicarSalario } from '@/market/marketLiveClient';
import { SociedadeSection } from '@/market/SociedadeSection';
import { L, LOCALE, emIngles } from '@/i18n/L';
import { rotuloPosicao } from '@/transfer/marketFilters';

/**
 * OLEFOOT por centavo de BRO (≈USD): $0,000125/token ⇒ 80 tokens/centavo.
 * Espelho de TOKENS_POR_CENTAVO_USD (server/src/lib/presale/packs.ts) — o
 * preço REAL da pré-venda, não um número de fantasia.
 */
const TOKENS_POR_CENTAVO = 80;

const tok = (n: number) => Math.round(n).toLocaleString(LOCALE);
const dolar = (cents: number) => {
  const d = cents / 100;
  return `$${d.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

  const [saldoOlefoot, setSaldoOlefoot] = useState<number | null>(null);
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

  const [emprestimos, setEmprestimos] = useState<MeuEmprestimo[]>([]);
  const [emprestar, setEmprestar] = useState<PlayerEntity | null>(null);
  const [dias, setDias] = useState('7');
  const [buyout, setBuyout] = useState('');
  const [salario, setSalario] = useState<{ pago: number; atuacoes: number } | null>(null);
  const [coletando, setColetando] = useState(false);

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
    for (const a of meusAnuncios) {
      if ((a.kind === 'player' || a.kind === 'loan') && a.gamePlayerId) m.set(a.gamePlayerId, a);
    }
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
      setEmprestimos(meus.emprestimos);
      setSaldoOlefoot(saldo);

      // Fim de empréstimo (sou locatário): tira o devolvido do estado local e
      // dá o ack — sem isso o persist ressuscitaria o jogador no plantel errado.
      if (meus.devolucoesNaoAplicadas.length > 0) {
        for (const dev of meus.devolucoesNaoAplicadas) {
          const nome = playersRef.current[dev.gamePlayerId]?.name ?? L('um jogador emprestado', 'a loaned player');
          dispatch({ type: 'APPLY_LOAN_RETURNED_AS_BORROWER', playerIds: [dev.gamePlayerId], titulo: nome });
        }
        await confirmarDevolucoesAplicadas(meus.devolucoesNaoAplicadas.map((x) => x.id));
      }

      // Checkpoint do preço no servidor (ticker/OLE-100), no máximo 1×/hora.
      try {
        const marca = localStorage.getItem('olefoot-pvs-checkpoint');
        if (!marca || Date.now() - Number(marca) > 3_600_000) {
          const atuais = Object.values(playersRef.current)
            .filter((p) => p.marketValueBroCents != null && p.marketValueBroCents > 0)
            .slice(0, 40)
            .map((p) => ({
              gamePlayerId: p.id,
              name: p.name,
              pos: p.pos,
              ovr: overallFromAttributes(p.attrs, p.pos),
              marketBroCents: p.marketValueBroCents!,
              rating: null,
              source: 'checkpoint' as const,
            }));
          if (atuais.length > 0) {
            void pushValueSnapshots(atuais);
            localStorage.setItem('olefoot-pvs-checkpoint', String(Date.now()));
          }
        }
      } catch { /* localStorage indisponível — sem checkpoint */ }

      // ── O CONTRATO DO VENDEDOR: aplica vendas liquidadas e dá o ack. ─────
      if (meus.vendidosNaoAplicados.length > 0) {
        for (const venda of meus.vendidosNaoAplicados) {
          const ids = venda.kind === 'player' && venda.gamePlayerId
            ? [venda.gamePlayerId]
            : Object.keys(playersRef.current);
          dispatch({
            type: 'APPLY_SQUAD_SALE_AS_SELLER',
            playerIds: ids,
            titulo: venda.kind === 'team' ? L('o time inteiro', 'the whole team') : (venda.player?.name ?? L('um jogador', 'a player')),
            priceOlefoot: Number(venda.priceOlefoot),
            buyerClubName: venda.buyerClub,
          });
        }
        await confirmarVendasAplicadas(meus.vendidosNaoAplicados.map((x) => x.id));
        setAviso(
          meus.vendidosNaoAplicados.length === 1
            ? L('Uma venda foi concluída enquanto estavas fora — OLEFOOT já na carteira.', 'A sale went through while you were away — OLEFOOT is in your wallet.')
            : L(`${meus.vendidosNaoAplicados.length} vendas concluídas enquanto estavas fora — OLEFOOT já na carteira.`, `${meus.vendidosNaoAplicados.length} sales went through while you were away — OLEFOOT is in your wallet.`),
        );
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : L('Falha ao carregar o mercado.', 'Failed to load the market.'));
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
      setErro(e instanceof Error ? e.message : L('Falha ao anunciar.', 'Failed to list.'));
    } finally {
      setAgindo(false);
    }
  };

  const cancelar = async (listingId: string) => {
    if (agindo) return;
    setAgindo(true);
    setErro(null);
    try { await cancelarAnuncio(listingId); await carregar(); }
    catch (e) { setErro(e instanceof Error ? e.message : L('Falha ao cancelar.', 'Failed to cancel.')); }
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
          ? L(`Time comprado: ${r.players.length} jogadores entraram no teu plantel.`, `Team bought: ${r.players.length} players joined your squad.`)
          : L(`${r.players[0]?.name ?? 'Jogador'} é teu — já está no plantel.`, `${r.players[0]?.name ?? 'Player'} is yours — already in the squad.`),
      );
      setComprar(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : L('Falha na compra.', 'Purchase failed.'));
    } finally {
      setAgindo(false);
    }
  };

  const coletarSalario = async () => {
    if (coletando) return;
    setColetando(true);
    setErro(null);
    try {
      const r = await reivindicarSalario();
      setSalario({ pago: r.pago, atuacoes: r.atuacoesHoje });
      if (r.pago > 0) {
        setAviso(L(`Salário do elenco: +${r.pago} OLEFOOT (${r.atuacoesHoje} atuação(ões) nota ≥ 7 hoje).`, `Squad wages: +${r.pago} OLEFOOT (${r.atuacoesHoje} rating ≥ 7 appearance(s) today).`));
        setSaldoOlefoot(await fetchMyOlefootBalance().catch(() => saldoOlefoot));
      }
    } finally {
      setColetando(false);
    }
  };

  const confirmarEmprestimo = async () => {
    if (!emprestar || agindo) return;
    setAgindo(true);
    setErro(null);
    try {
      await anunciarEmprestimo(
        emprestar.id,
        Number(preco.replace(/\./g, '')),
        Number(dias),
        buyout.trim() ? Number(buyout.replace(/\./g, '')) : null,
      );
      setEmprestar(null);
      setPreco('');
      setBuyout('');
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : L('Falha ao anunciar o empréstimo.', 'Failed to list the loan.'));
    } finally {
      setAgindo(false);
    }
  };

  const alugar = async (l: SquadListing) => {
    if (agindo) return;
    setAgindo(true);
    setErro(null);
    try {
      const r = await alugarAnuncio(l.id);
      dispatch({ type: 'MERGE_PLAYERS', players: { [r.player.id]: r.player } });
      setAviso(L(`${r.player.name} é teu até ${new Date(r.endsAt).toLocaleDateString(LOCALE)} — a evolução fica nele.`, `${r.player.name} is yours until ${new Date(r.endsAt).toLocaleDateString(LOCALE)} — the progress stays with him.`));
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : L('Falha no aluguel.', 'Loan failed.'));
    } finally {
      setAgindo(false);
    }
  };

  const comprarAlugado = async (loan: MeuEmprestimo) => {
    if (agindo) return;
    setAgindo(true);
    setErro(null);
    try {
      const r = await exercerOpcaoDeCompra(loan.id);
      if (!r.ok) {
        const mapa: Record<string, string> = {
          saldo_insuficiente: L('Saldo OLEFOOT insuficiente.', 'Insufficient OLEFOOT balance.'),
          emprestimo_vencido: L('O empréstimo venceu — o jogador já voltou.', 'The loan expired — the player is already back.'),
          sem_opcao_de_compra: L('Este contrato não tem opção de compra.', 'This contract has no buy option.'),
        };
        setErro(mapa[r.motivo ?? ''] ?? L('Falha na opção de compra.', 'Buy option failed.'));
        return;
      }
      setAviso(L(`Opção exercida por ${tok(r.price ?? 0)} OLEFOOT — o jogador agora é TEU.`, `Option exercised for ${tok(r.price ?? 0)} OLEFOOT — the player is now YOURS.`));
      await carregar();
    } finally {
      setAgindo(false);
    }
  };

  const alugadoPorMim = useMemo(() => {
    const m = new Map<string, MeuEmprestimo>();
    for (const e of emprestimos) if (e.papel === 'locatario') m.set(e.gamePlayerId, e);
    return m;
  }, [emprestimos]);
  const emprestadosFora = useMemo(
    () => emprestimos.filter((e) => e.papel === 'dono'),
    [emprestimos],
  );

  const precoNum = Number(preco.replace(/\./g, ''));
  const campo = 'w-full border-2 border-linha bg-concreto px-3 py-2.5 font-prova text-[14px] text-papel placeholder:text-mudo focus:border-rua focus:outline-none';
  const rotuloCampo = 'font-prova text-[10px] font-bold uppercase tracking-[0.14em] text-mudo';

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-10 px-3 sm:px-4">
      {/* ── HERO: o time como ativo — degrau RESPEITO (valor que já existe) ── */}
      <section aria-label={L('Valor do time', 'Team value')} className="flex min-w-0 flex-col gap-4">
        <div className="relative flex min-w-0 flex-col gap-2 border-[3px] border-ouro-27 bg-asfalto-27 px-5 py-5 sm:px-6">
          {/* Lambe colado no canto — o momento "rua" da tela. */}
          <span aria-hidden className="absolute -top-3 right-3 rotate-[4deg] bg-cal px-2.5 py-1 font-voz text-[18px] leading-none text-asfalto-27 shadow-[3px_3px_0_rgba(0,0,0,0.55)]">
            {L('#preçovivo', '#liveprice')}
          </span>
          <span className="block min-w-0 truncate pr-24 font-prova text-[12px] font-bold uppercase tracking-[0.22em] text-mudo">
            — {L('Valor do time', 'Team value')} · {clubName}
          </span>
          <p className="font-spray text-[clamp(44px,13vw,80px)] font-black leading-[0.88] text-ouro-27 tabular-nums [overflow-wrap:anywhere]">
            {tok(totalCents * TOKENS_POR_CENTAVO)}
          </p>
          <p className="font-prova text-[12px] font-bold uppercase tracking-[0.14em] text-papel">
            OLEFOOT · ≈ {dolar(totalCents)}
          </p>
          <p className="font-voz text-[20px] leading-tight text-suave">
            {L(`${lista.length} jogadores. Cada jogo e cada treino mexe nesse número.`, `${lista.length} players. Every match and training session moves this number.`)}
          </p>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-3 pr-2">
          {anuncioDoTime ? (
            <button
              type="button"
              onClick={() => void cancelar(anuncioDoTime.id)}
              disabled={agindo}
              className="inline-flex min-h-[48px] items-center justify-center border-2 border-baixa px-4 font-impact text-[16px] uppercase leading-none text-papel hover:bg-baixa hover:text-asfalto-27 disabled:opacity-50"
            >
              {L(`Time à venda por ${tok(Number(anuncioDoTime.priceOlefoot))} — cancelar`, `Team for sale at ${tok(Number(anuncioDoTime.priceOlefoot))} — cancel`)}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { setVenderTime(true); setPreco(String(totalCents * TOKENS_POR_CENTAVO)); }}
              disabled={lista.length < 11}
              title={lista.length < 11 ? L('Time pronto tem pelo menos 11 jogadores', 'A full team needs at least 11 players') : undefined}
              className="inline-flex min-h-[52px] items-center justify-center gap-2 bg-rua px-5 font-impact text-[19px] uppercase leading-none text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_var(--color-papel)] disabled:pointer-events-none disabled:opacity-40"
            >
              {L('Vender o time inteiro', 'Sell the whole team')} <span aria-hidden>→</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => void coletarSalario()}
            disabled={coletando}
            title={L('Atuação com nota ≥ 7 hoje rende 1 OLEFOOT (teto 30/dia). Contado pelo servidor.', 'Each appearance rated ≥ 7 today earns 1 OLEFOOT (cap 30/day). Counted by the server.')}
            className="inline-flex min-h-[48px] items-center justify-center border-2 border-papel px-4 font-impact text-[16px] uppercase leading-none text-papel hover:bg-papel hover:text-asfalto-27 disabled:opacity-50"
          >
            {coletando ? L('Coletando…', 'Collecting…') : salario ? L(`Salário: ${salario.atuacoes} atuação(ões) hoje`, `Wages: ${salario.atuacoes} appearance(s) today`) : L('Coletar salário do elenco', 'Collect squad wages')}
          </button>
          <span className="font-prova text-[12px] font-bold uppercase tracking-[0.1em] text-mudo">
            {L('Teu saldo', 'Your balance')}: <span className="text-papel">{saldoOlefoot == null ? '—' : `${saldoOlefoot.toLocaleString(LOCALE)} OLEFOOT`}</span>
          </span>
        </div>
      </section>

      {erro ? <p role="alert" className="border-l-[3px] border-baixa bg-concreto px-3 py-2.5 text-[13px] text-papel">{erro}</p> : null}
      {aviso ? <p role="status" className="border-l-[3px] border-rua bg-concreto px-3 py-2.5 text-[13px] text-papel">{aviso}</p> : null}

      {/* ── MEU ELENCO: valor, valorização, evolução ─────────────────────── */}
      <section className="flex min-w-0 flex-col gap-3">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <SecaoRua label={L('Meu elenco · valor vivo', 'My squad · live value')} className="min-w-0 flex-1" />
          <button type="button" onClick={() => void carregar()} disabled={carregando}
            className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 border-2 border-linha px-3 font-prova text-[11px] font-bold uppercase tracking-[0.1em] text-suave hover:border-papel hover:text-papel disabled:opacity-50">
            <RotateCcw className={cn('h-3.5 w-3.5', carregando && 'animate-spin')} /> {L('Atualizar', 'Refresh')}
          </button>
        </div>

        {lista.length === 0 ? (
          <VazioRua
            frase={L('Plantel vazio. Bora montar o teu.', 'Empty squad. Go build yours.')}
            acao={{ label: L('Vai ao mercado', 'Go to the market'), to: '/mercado' }}
          />
        ) : (
          <ul className="flex min-w-0 flex-col gap-px bg-linha">
            {lista.map(({ p, ovr, cents, olefoot, crescimento, treinos, jogos, valorizacao }) => {
              const anuncio = anuncioPorJogador.get(p.id);
              const alugado = alugadoPorMim.get(p.id);
              return (
                <li key={p.id} className="flex min-w-0 flex-col gap-3 bg-asfalto-27 px-3 py-3.5 sm:px-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <OvrSelo ovr={ovr} className="h-12 w-12 text-[26px]" />
                    <div className="flex min-w-0 grow flex-col gap-1">
                      <span className="block min-w-0 truncate font-voz text-[24px] leading-none text-papel">{p.name}</span>
                      <span className="block min-w-0 truncate font-prova text-[11px] font-bold uppercase tracking-[0.1em] text-mudo">
                        {rotuloPosicao(p.pos)}{p.age ? L(` · ${p.age}a`, ` · ${p.age}y`) : ''}{p.rarity && p.rarity !== 'normal' ? ` · ${p.rarity}` : ''}
                      </span>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      <span className="font-impact text-[22px] leading-none text-papel tabular-nums">{tok(olefoot)}</span>
                      <span className="font-prova text-[10px] font-bold text-mudo">OLEFOOT · {dolar(cents)}</span>
                    </div>
                  </div>

                  <dl className="flex min-w-0 flex-wrap gap-x-5 gap-y-1 font-prova text-[11px] font-bold uppercase tracking-[0.08em]">
                    <div className="flex gap-1.5" title={L('OVR atual − OVR de criação', 'Current OVR − OVR at creation')}>
                      <dt className="text-mudo">{L('Evoluiu', 'Growth')}</dt>
                      <dd className={crescimento != null && crescimento > 0 ? 'text-alta' : 'text-suave'}>
                        {crescimento == null ? '—' : crescimento > 0 ? `+${crescimento}` : crescimento}
                      </dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="text-mudo">{L('Treinos', 'Training')}</dt>
                      <dd className="text-suave">{treinos}</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="text-mudo">{L('Jogos', 'Matches')}</dt>
                      <dd className="text-suave">{jogos}</dd>
                    </div>
                    <div className="flex gap-1.5" title={L('Variação do valor na temporada (performance move o preço)', 'Value change this season (performance moves the price)')}>
                      <dt className="text-mudo">{L('Valorização', 'Value change')}</dt>
                      {valorizacao == null ? (
                        <dd className="text-suave" title={L('Entra em campo que o preço começa a andar', 'Play a match and the price starts moving')}>—</dd>
                      ) : (
                        <dd className={cn('inline-flex items-center gap-1', valorizacao >= 0 ? 'text-alta' : 'text-baixa')}>
                          {valorizacao >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                          {valorizacao >= 0 ? '+' : ''}{valorizacao.toFixed(1)}%
                        </dd>
                      )}
                    </div>
                  </dl>

                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {alugado ? (
                      <>
                        <SeloRua tom="cal">
                          {L('Alugado até', 'On loan until')} {new Date(alugado.endsAt).toLocaleDateString(LOCALE)}
                        </SeloRua>
                        {alugado.buyoutOlefoot ? (
                          <button type="button" onClick={() => void comprarAlugado(alugado)} disabled={agindo}
                            className="inline-flex min-h-[40px] items-center gap-1.5 border-2 border-rua px-3 font-impact text-[15px] uppercase leading-none text-rua hover:bg-rua hover:text-asfalto-27 disabled:opacity-50">
                            {L('Comprar por', 'Buy for')} {tok(Number(alugado.buyoutOlefoot))} <span aria-hidden>→</span>
                          </button>
                        ) : null}
                      </>
                    ) : anuncio ? (
                      <button type="button" onClick={() => void cancelar(anuncio.id)} disabled={agindo}
                        className="inline-flex min-h-[40px] items-center border-2 border-dashed border-fio px-3 font-prova text-[11px] font-bold uppercase tracking-[0.06em] text-suave hover:border-baixa hover:text-papel disabled:opacity-50">
                        {anuncio.kind === 'loan' ? L('Pra alugar', 'For loan') : L('À venda', 'For sale')} {L('por', 'at')} {tok(Number(anuncio.priceOlefoot))} · {L('tirar', 'remove')}
                      </button>
                    ) : ehEdicaoFundacao(p) ? (
                      // Lenda do sorteio da Fundação: joga, mas não sai do clube (o servidor também recusa).
                      <SeloRua tom="ouro-contorno">{L('Edição Fundação · fica no clube', 'Founding Edition · stays at the club')}</SeloRua>
                    ) : (
                      <>
                        <button type="button"
                          onClick={() => { setVender(p); setPreco(String(olefoot)); }}
                          className="inline-flex min-h-[40px] items-center gap-1.5 border-2 border-rua px-3 font-impact text-[15px] uppercase leading-none text-rua hover:bg-rua hover:text-asfalto-27">
                          {L('Vender', 'Sell')} <span aria-hidden>→</span>
                        </button>
                        <button type="button"
                          onClick={() => { setEmprestar(p); setPreco(String(Math.max(1, Math.round(olefoot / 20)))); setBuyout(String(olefoot)); }}
                          className="inline-flex min-h-[40px] items-center border-2 border-linha px-3 font-impact text-[15px] uppercase leading-none text-papel hover:border-papel">
                          {L('Emprestar', 'Loan out')}
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-[12px] leading-relaxed text-mudo">
          {L('O valor é o preço dinâmico do jogo (OVR, forma, idade, raridade, escassez), convertido a OLEFOOT pelo preço real da pré-venda ($0,000125). Quem tu vendes sai TREINADO — é esse o negócio.', 'Value is the game\'s dynamic price (OVR, form, age, rarity, scarcity), converted to OLEFOOT at the real presale price ($0.000125). Whoever you sell leaves TRAINED — that\'s the deal.')}
        </p>
        {emprestadosFora.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {emprestadosFora.map((e) => (
              <span key={e.id} className="border-2 border-dashed border-fio px-2.5 py-1.5 text-[12px] text-suave">
                {L('Emprestado', 'On loan')}: <span className="font-prova text-[11px] text-mudo">{e.gamePlayerId.slice(0, 12)}</span>{' '}
                {L(`volta ${new Date(e.endsAt).toLocaleDateString(LOCALE)} · aluguel ${tok(Number(e.rentOlefoot))} já na carteira`, `returns ${new Date(e.endsAt).toLocaleDateString(LOCALE)} · fee ${tok(Number(e.rentOlefoot))} already in wallet`)}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      {/* ── VITRINE DA COMUNIDADE — cartas na escada ────────────────────── */}
      <section className="flex min-w-0 flex-col gap-3">
        <SecaoRua label={L('À venda na comunidade', 'For sale in the community')} aside={vitrine.length > 0 ? vitrine.length : undefined} />
        {vitrine.length === 0 ? (
          carregando ? (
            <p className="border-2 border-dashed border-fio p-6 font-prova text-[12px] uppercase tracking-[0.14em] text-mudo">{L('Carregando…', 'Loading…')}</p>
          ) : (
            <VazioRua
              frase={L('Ninguém anunciou ainda. Sê o primeiro.', 'No listings yet. Be the first.')}
              detalhe={L('Anuncia um jogador treinado — o botão Vender tá na lista acima.', 'List a trained player — the Sell button is in the list above.')}
            />
          )
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vitrine.map((l) => {
              const precoL = Number(l.priceOlefoot);
              const ref = l.refOlefoot != null ? Number(l.refOlefoot) : null;
              const agio = ref != null && ref > 0 ? ((precoL - ref) / ref) * 100 : null;
              const ovrSnap = l.player
                ? overallFromAttributes(l.player.attrs as unknown as PlayerEntity['attrs'], l.player.pos)
                : null;
              return (
                <div key={l.id} className="flex min-w-0 flex-col gap-3 bg-concreto p-4">
                  {(l.kind === 'player' || l.kind === 'loan') && l.player ? (
                    <div className="flex min-w-0 items-start gap-3">
                      {ovrSnap != null ? <OvrSelo ovr={ovrSnap} className="h-12 w-12 text-[26px]" /> : null}
                      <div className="flex min-w-0 grow flex-col gap-1">
                        <span className="block min-w-0 truncate font-voz text-[24px] leading-none text-papel">{l.player.name}</span>
                        <p className="font-prova text-[11px] leading-snug text-mudo">
                          {rotuloPosicao(l.player.pos)}{l.player.age ? L(` · ${l.player.age} anos`, ` · ${l.player.age} yrs`) : ''}
                          {l.player.mintOverall != null && ovrSnap != null && ovrSnap > l.player.mintOverall
                            ? <span className="text-alta">{L(` · evoluiu +${ovrSnap - Math.round(l.player.mintOverall)} OVR`, ` · grew +${ovrSnap - Math.round(l.player.mintOverall)} OVR`)}</span> : ''}
                          {' · '}{L('de', 'from')} {l.seller.club ?? (l.seller.username ? `@${l.seller.username}` : L('outro clube', 'another club'))}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <BadgeDollarSign className="h-4 w-4 shrink-0 text-rua" />
                        <span className="font-impact text-[22px] uppercase leading-none text-papel">{L('Time pronto', 'Full team')} · {l.team?.jogadores ?? '?'} {L('jogadores', 'players')}</span>
                      </div>
                      <p className="font-prova text-[11px] leading-snug text-mudo">
                        {(l.team?.destaques ?? []).map((d) => d.name).filter(Boolean).slice(0, 4).join(' · ') || L('Elenco completo', 'Full squad')}
                        {' · '}{L('de', 'from')} {l.seller.club ?? (l.seller.username ? `@${l.seller.username}` : L('outro clube', 'another club'))}
                      </p>
                    </div>
                  )}
                  <div className="mt-auto flex min-w-0 items-end justify-between gap-2 border-t-2 border-dashed border-linha pt-3">
                    <div className="min-w-0">
                      <p className="font-impact text-[24px] leading-none text-papel tabular-nums">
                        {tok(precoL)} <span className="font-prova text-[10px] font-bold text-mudo">OLEFOOT{l.kind === 'loan' ? ` · ${l.loanDays}d` : ''}</span>
                      </p>
                      <p className="mt-1 font-prova text-[10px] text-mudo">
                        {l.kind === 'loan' ? (
                          <>{L('aluguel', 'loan')} · {l.buyoutOlefoot ? L(`opção de compra: ${tok(Number(l.buyoutOlefoot))}`, `buy option: ${tok(Number(l.buyoutOlefoot))}`) : L('sem opção de compra', 'no buy option')}</>
                        ) : (
                          <>
                            ≈ {dolar(precoL / TOKENS_POR_CENTAVO * 1)}{' '}
                            {agio != null ? (
                              <span className={agio > 0 ? 'text-baixa' : 'text-alta'}>
                                · {agio > 0 ? '+' : ''}{agio.toFixed(0)}% {L('vs referência', 'vs reference')}
                              </span>
                            ) : null}
                          </>
                        )}
                      </p>
                    </div>
                    {l.kind === 'loan' ? (
                      <button type="button" onClick={() => void alugar(l)} disabled={agindo}
                        className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 border-2 border-rua px-3 font-impact text-[16px] uppercase leading-none text-rua hover:bg-rua hover:text-asfalto-27 disabled:opacity-50">
                        {L('Alugar', 'Loan')} <span aria-hidden>→</span>
                      </button>
                    ) : (
                      <button type="button" onClick={() => setComprar(l)}
                        className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 bg-rua px-3 font-impact text-[16px] uppercase leading-none text-asfalto-27 shadow-[3px_3px_0_var(--color-papel)] transition-[transform,box-shadow] hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_var(--color-papel)]">
                        {L('Comprar', 'Buy')} <span aria-hidden>→</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── SOCIEDADE: cotas do clube ────────────────────────────────────── */}
      <SociedadeSection />

      {/* ── EMPRESTAR ────────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={emprestar != null}
        onClose={() => (agindo ? null : setEmprestar(null))}
        onConfirm={() => void confirmarEmprestimo()}
        eyebrow={L('Empréstimo', 'Loan')}
        title={L(`Emprestar ${emprestar?.name ?? ''}?`, `Loan out ${emprestar?.name ?? ''}?`)}
        confirmLabel={agindo ? L('Anunciando…', 'Listing…') : L('Anunciar empréstimo', 'List loan')}
        confirmDisabled={agindo || !Number.isInteger(precoNum) || precoNum < 1 || !Number(dias)}
        accent="var(--color-rua)"
      >
        <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-suave">
          <p>
            {emIngles()
              ? <>He plays for the borrower and <strong className="text-papel">comes back on his own</strong> when the term ends — with
              all the progress he makes there (you profit from the fee AND their training).</>
              : <>Ele joga no time do locatário e <strong className="text-papel">volta sozinho</strong> no fim do prazo — com
              toda a evolução que ganhar lá (tu lucras o aluguel E o treino alheio).</>}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className={rotuloCampo}>{L('Aluguel (OLEFOOT)', 'Loan fee (OLEFOOT)')}</span>
              <input className={campo} value={preco} inputMode="numeric"
                onChange={(e) => setPreco(e.target.value.replace(/[^\d]/g, ''))} />
            </label>
            <label className="flex flex-col gap-1">
              <span className={rotuloCampo}>{L('Dias (1–30)', 'Days (1–30)')}</span>
              <input className={campo} value={dias} inputMode="numeric"
                onChange={(e) => setDias(e.target.value.replace(/[^\d]/g, ''))} />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className={rotuloCampo}>{L('Opção de compra (OLEFOOT · em branco = sem opção)', 'Buy option (OLEFOOT · blank = none)')}</span>
            <input className={campo} value={buyout} inputMode="numeric"
              onChange={(e) => setBuyout(e.target.value.replace(/[^\d]/g, ''))} placeholder={L('preço travado pro locatário ficar com ele', 'locked price for the borrower to keep him')} />
          </label>
        </div>
      </ConfirmDialog>

      {/* ── VENDER (jogador ou time) ─────────────────────────────────────── */}
      <ConfirmDialog
        open={vender != null || venderTime}
        onClose={() => (agindo ? null : (setVender(null), setVenderTime(false)))}
        onConfirm={() => void confirmarVenda()}
        eyebrow={L('Mercado de elenco', 'Squad market')}
        title={venderTime ? L('Vender o time inteiro?', 'Sell the whole team?') : L(`Vender ${vender?.name ?? ''}?`, `Sell ${vender?.name ?? ''}?`)}
        confirmLabel={agindo ? L('Anunciando…', 'Listing…') : L('Anunciar', 'List')}
        confirmDisabled={agindo || !Number.isInteger(precoNum) || precoNum < 1}
        accent="var(--color-rua)"
      >
        <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-suave">
          {venderTime ? (
            emIngles() ? (
              <p>
                The buyer takes <strong className="text-papel">all {lista.length} players</strong>, as they are — trained.
                You keep the club, the structures and the OLEFOOT from the sale. Squad reference:{' '}
                <strong className="text-ouro-27">{tok(totalCents * TOKENS_POR_CENTAVO)} OLEFOOT</strong>.
              </p>
            ) : (
            <p>
              O comprador leva <strong className="text-papel">todos os {lista.length} jogadores</strong>, do jeito que estão — treinados.
              Tu ficas com o clube, as estruturas e o OLEFOOT da venda. Referência do elenco:{' '}
              <strong className="text-ouro-27">{tok(totalCents * TOKENS_POR_CENTAVO)} OLEFOOT</strong>.
            </p>
            )
          ) : vender ? (
            emIngles() ? (
              <p>
                He leaves the squad as he is today (OVR {overallFromAttributes(vender.attrs, vender.pos)}
                {vender.mintOverall != null ? `, created at ${Math.round(vender.mintOverall)}` : ''}). Live reference:{' '}
                <strong className="text-ouro-27">{tok(valorCents(vender) * TOKENS_POR_CENTAVO)} OLEFOOT</strong>{' '}
                ({dolar(valorCents(vender))}). The price is yours — you raised his value, charge the premium.
              </p>
            ) : (
            <p>
              Ele sai do plantel como está hoje (OVR {overallFromAttributes(vender.attrs, vender.pos)}
              {vender.mintOverall != null ? `, criado com ${Math.round(vender.mintOverall)}` : ''}). Referência viva:{' '}
              <strong className="text-ouro-27">{tok(valorCents(vender) * TOKENS_POR_CENTAVO)} OLEFOOT</strong>{' '}
              ({dolar(valorCents(vender))}). O preço é teu — valorizaste, cobra o ágio.
            </p>
            )
          ) : null}
          <label className="flex flex-col gap-1">
            <span className={rotuloCampo}>{L('Preço em OLEFOOT', 'Price in OLEFOOT')}</span>
            <input className={campo} value={preco} inputMode="numeric"
              onChange={(e) => setPreco(e.target.value.replace(/[^\d]/g, ''))} placeholder={L('ex.: 24000', 'e.g. 24000')} />
          </label>
          {Number.isInteger(precoNum) && precoNum >= 1 ? (
            <p className="flex items-center gap-1.5 font-prova text-[11px] text-mudo">
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
        eyebrow={L('Mercado de elenco', 'Squad market')}
        title={comprar?.kind === 'team' ? L('Comprar o time inteiro?', 'Buy the whole team?') : L(`Comprar ${comprar?.player?.name ?? ''}?`, `Buy ${comprar?.player?.name ?? ''}?`)}
        confirmLabel={agindo ? L('Comprando…', 'Buying…') : L(`Pagar ${tok(Number(comprar?.priceOlefoot ?? 0))} OLEFOOT`, `Pay ${tok(Number(comprar?.priceOlefoot ?? 0))} OLEFOOT`)}
        confirmDisabled={agindo || (saldoOlefoot != null && comprar != null && saldoOlefoot < Number(comprar.priceOlefoot))}
        accent="var(--color-rua)"
      >
        {comprar ? (
          <div className="mt-3 space-y-2 text-[14px] leading-relaxed text-suave">
            <p>
              {comprar.kind === 'team'
                ? L(`Levas os ${comprar.team?.jogadores ?? ''} jogadores do ${comprar.seller.club ?? 'vendedor'}, treinados, direto pro teu plantel.`, `You get all ${comprar.team?.jogadores ?? ''} players from ${comprar.seller.club ?? 'the seller'}, trained, straight into your squad.`)
                : L('Ele entra no teu plantel como está hoje — com toda a evolução que o vendedor pagou pra construir.', 'He joins your squad as he is today — with all the progress the seller paid to build.')}
            </p>
            <p className="font-prova text-[11px] text-mudo">
              {L(`Débito de ${tok(Number(comprar.priceOlefoot))} OLEFOOT na tua carteira`, `${tok(Number(comprar.priceOlefoot))} OLEFOOT charged to your wallet`)}
              {saldoOlefoot != null ? L(` (saldo: ${saldoOlefoot.toLocaleString(LOCALE)})`, ` (balance: ${saldoOlefoot.toLocaleString(LOCALE)})`) : ''}{L('. Sem estorno — mercado é mercado.', '. No refunds — a market is a market.')}
            </p>
            {saldoOlefoot != null && saldoOlefoot < Number(comprar.priceOlefoot) ? (
              <p className="font-prova text-[12px] font-bold text-baixa">{L('Saldo OLEFOOT insuficiente.', 'Insufficient OLEFOOT balance.')}</p>
            ) : null}
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
