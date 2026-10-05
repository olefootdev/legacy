/**
 * MERCADO AO VIVO — a bolsa do Olefoot (RPG-PRICE-LIVE nº 1 e nº 5).
 *
 * O preço de cada jogador muda a cada partida e treino; esta tela transforma
 * isso em espetáculo: o TICKER (últimas variações, com quem e por quê), o
 * OLE-100 (os 100 mais valiosos do mundo, com Δ24h), o ÍNDICE (a soma do
 * top-100, de hora em hora) e o LEILÃO-RELÂMPAGO DO MVP — o artilheiro real
 * das últimas 24h, cópia única, 15 minutos, lance em OLEFOOT com escrow no
 * banco. Tudo lido do servidor; nada aqui decide preço.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Crown, Gavel, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameDispatch } from '@/game/store';
import { useTrackScreen } from '@/progression/trackEvent';
import {
  darLanceMvp,
  lerIndiceHistorico,
  lerLeilaoMvp,
  lerOle100,
  lerTicker,
  type MvpAuction,
  type Ole100Item,
  type TickerItem,
} from '@/market/marketLiveClient';
import { retirarMvp } from '@/market/squadMarketClient';
import { L, LOCALE, emIngles } from '@/i18n/L';

const TOKENS_POR_CENTAVO = 80;
const tok = (n: number) => Math.round(n).toLocaleString(LOCALE);
const olefootDeCents = (cents: number) => tok(cents * TOKENS_POR_CENTAVO);

const FONTE: Record<string, string> = {
  match: L('partida', 'match'),
  training: L('treino', 'training'),
  checkpoint: 'checkpoint',
  sale: L('venda', 'sale'),
};

function Countdown({ ate }: { ate: string }) {
  const [resta, setResta] = useState(() => new Date(ate).getTime() - Date.now());
  useEffect(() => {
    const t = setInterval(() => setResta(new Date(ate).getTime() - Date.now()), 1000);
    return () => clearInterval(t);
  }, [ate]);
  if (resta <= 0) return <span className="text-rose-300">{L('ENCERRADO', 'ENDED')}</span>;
  const m = Math.floor(resta / 60000);
  const s = Math.floor((resta % 60000) / 1000);
  return <span className="tabular-nums">{m}:{String(s).padStart(2, '0')}</span>;
}

/** Sparkline inline do índice — sem lib, só polyline. */
function IndiceSparkline({ pontos }: { pontos: { indiceBroCents: number }[] }) {
  if (pontos.length < 2) return null;
  const vals = pontos.map((p) => p.indiceBroCents);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const pts = vals
    .map((v, i) => `${(i / (vals.length - 1)) * 300},${34 - ((v - min) / range) * 30}`)
    .join(' ');
  const subiu = vals[vals.length - 1]! >= vals[0]!;
  return (
    <svg viewBox="0 0 300 36" className="h-9 w-full" preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} fill="none" stroke={subiu ? '#34d399' : '#fb7185'} strokeWidth="2" />
    </svg>
  );
}

export function MercadoVivo() {
  useTrackScreen('screen_mercado_vivo');
  const dispatch = useGameDispatch();

  const [ticker, setTicker] = useState<TickerItem[]>([]);
  const [top, setTop] = useState<Ole100Item[]>([]);
  const [indice, setIndice] = useState<{ at: string; indiceBroCents: number }[]>([]);
  const [mvp, setMvp] = useState<MvpAuction | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [lance, setLance] = useState('');
  const [agindo, setAgindo] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [t, o, h, m] = await Promise.all([lerTicker(), lerOle100(), lerIndiceHistorico(), lerLeilaoMvp()]);
      setTicker(t);
      setTop(o);
      setIndice(h);
      setMvp(m);
    } finally {
      setCarregando(false);
    }
  }, []);
  useEffect(() => {
    void carregar();
    // Bolsa é bolsa: atualiza sozinha a cada 30s enquanto a tela está aberta.
    const id = setInterval(() => void carregar(), 30_000);
    return () => clearInterval(id);
  }, [carregar]);

  const darLance = async () => {
    if (!mvp || agindo) return;
    setAgindo(true);
    setErro(null);
    try {
      const r = await darLanceMvp(mvp.id, Number(lance.replace(/\./g, '')));
      if (!r.ok) {
        const mapa: Record<string, string> = {
          lance_baixo: L(`Lance mínimo agora: ${r.minimo != null ? tok(r.minimo) : '—'} OLEFOOT.`, `Minimum bid now: ${r.minimo != null ? tok(r.minimo) : '—'} OLEFOOT.`),
          saldo_insuficiente: L('Saldo OLEFOOT insuficiente (o lance fica em escrow até alguém te cobrir).', 'Insufficient OLEFOOT balance (the bid stays in escrow until someone outbids you).'),
          encerrado: L('O martelo já bateu.', 'The hammer has already fallen.'),
          ja_es_o_maior: L('Teu lance já é o maior.', 'Your bid is already the highest.'),
          indisponivel: L('Leilão indisponível.', 'Auction unavailable.'),
        };
        setErro(mapa[r.motivo ?? ''] ?? L('Falha no lance.', 'Bid failed.'));
      } else {
        setAviso(L('Lance registrado — o valor fica em escrow; se alguém cobrir, volta na hora.', 'Bid placed — the amount stays in escrow; if someone outbids you, it comes right back.'));
        setLance('');
      }
      await carregar();
    } finally {
      setAgindo(false);
    }
  };

  const retirar = async () => {
    if (!mvp || agindo) return;
    setAgindo(true);
    setErro(null);
    try {
      const r = await retirarMvp(mvp.id);
      dispatch({ type: 'MERGE_PLAYERS', players: { [r.player.id]: r.player } });
      setAviso(L(`${r.player.name} (cópia única do MVP) entrou no teu plantel!`, `${r.player.name} (unique MVP copy) joined your squad!`));
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : L('Falha ao retirar.', 'Failed to claim.'));
    } finally {
      setAgindo(false);
    }
  };

  const indiceAtual = indice.length > 0 ? indice[indice.length - 1]!.indiceBroCents : null;
  const indiceDelta = useMemo(() => {
    if (indice.length < 2) return null;
    const a = indice[0]!.indiceBroCents;
    const b = indice[indice.length - 1]!.indiceBroCents;
    return a > 0 ? ((b - a) / a) * 100 : null;
  }, [indice]);
  const encerrado = mvp != null && Date.now() >= new Date(mvp.endsAt).getTime();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <section aria-label={L('Mercado ao vivo', 'Live Market')} className="ole-poster ole-rail px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="ole-eyebrow-poster flex items-center gap-2" style={{ fontSize: '12px' }}>
              <Activity className="h-4 w-4" /> {L('Mercado ao vivo · índice OLE-100', 'Live Market · OLE-100 index')}
            </span>
            <p className="mt-1 font-impact leading-none text-neon-yellow tabular-nums" style={{ fontSize: 'clamp(30px, 7vw, 52px)' }}>
              {indiceAtual == null ? '—' : olefootDeCents(indiceAtual)} <span className="text-[0.45em] text-white/70">OLEFOOT</span>
            </p>
            <p className="mt-1 text-[12px] text-white/50">
              {L('A soma dos 100 jogadores mais valiosos do mundo, de hora em hora', 'The sum of the 100 most valuable players in the world, hourly')}
              {indiceDelta != null ? (
                <span className={indiceDelta >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                  {' '}· {indiceDelta >= 0 ? '+' : ''}{indiceDelta.toFixed(2)}% {L('na janela', 'in window')}
                </span>
              ) : null}
            </p>
          </div>
          <div className="w-full max-w-[300px]"><IndiceSparkline pontos={indice} /></div>
        </div>
      </section>

      {erro ? <p className="border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{erro}</p> : null}
      {aviso ? <p className="border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">{aviso}</p> : null}

      {/* ── LEILÃO DO MVP ────────────────────────────────────────────────── */}
      <section>
        <h2 className="ole-eyebrow-poster mb-3 flex items-center gap-2" style={{ fontSize: '13px' }}>
          <Gavel className="h-4 w-4" /> {L('Leilão-relâmpago do MVP · todo dia às 20h', 'MVP flash auction · daily at 8 PM')}
        </h2>
        {mvp == null ? (
          <p className="ole-poster p-6 text-sm text-white/45">
            {L('Nenhum leilão ainda — o artilheiro do dia sobe ao martelo às 20h (precisa ter gol nas últimas 24h).', 'No auction yet — the top scorer of the day goes under the hammer at 8 PM (needs a goal in the last 24h).')}
          </p>
        ) : (
          <div className="ole-poster ole-rail flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <p className="font-impact text-[24px] uppercase text-white">
                <Crown className="mr-2 inline h-5 w-5 text-neon-yellow" />
                {mvp.playerName}
                <span className="ml-2 text-[12px] font-normal normal-case text-white/45">{L('cópia única', 'unique copy')} · {mvp.dia}</span>
              </p>
              <p className="mt-1 text-[12px] text-white/55">
                {mvp.status === 'open' && !encerrado ? (
                  <>{L('Fecha em', 'Closes in')} <Countdown ate={mvp.endsAt} /> · {L('lance atual', 'current bid')}:{' '}
                    <strong className="text-neon-yellow">{mvp.bidOlefoot ? tok(Number(mvp.bidOlefoot)) : L(`mínimo ${tok(Number(mvp.minBidOlefoot))}`, `minimum ${tok(Number(mvp.minBidOlefoot))}`)} OLEFOOT</strong>
                    {mvp.souOMaior ? L(' · o maior é TEU', ' · highest is YOURS') : ''}</>
                ) : mvp.status === 'settled' ? (
                  <>{L(`Encerrado e retirado — por ${tok(Number(mvp.bidOlefoot ?? 0))} OLEFOOT.`, `Ended and claimed — for ${tok(Number(mvp.bidOlefoot ?? 0))} OLEFOOT.`)}</>
                ) : encerrado && mvp.souOMaior ? (
                  emIngles() ? (
                  <>Hammer down — <strong className="text-emerald-300">you won for {tok(Number(mvp.bidOlefoot ?? 0))} OLEFOOT</strong>. Claim the card.</>
                ) : (
                  <>Martelo batido — <strong className="text-emerald-300">tu venceste por {tok(Number(mvp.bidOlefoot ?? 0))} OLEFOOT</strong>. Retira o card.</>
                )
                ) : (
                  <>{L('Encerrado', 'Ended')}{mvp.bidOlefoot ? L(` — maior lance ${tok(Number(mvp.bidOlefoot))} OLEFOOT`, ` — top bid ${tok(Number(mvp.bidOlefoot))} OLEFOOT`) : L(' sem lances', ' with no bids')}.</>
                )}
                {' '}· {L('50% do martelo vai pro dono do MVP', '50% of the hammer price goes to the MVP owner')}
              </p>
            </div>
            {mvp.status === 'open' && !encerrado ? (
              <div className="flex gap-2">
                <input
                  className="w-36 border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30"
                  value={lance} inputMode="numeric"
                  onChange={(e) => setLance(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder={tok(mvp.bidOlefoot ? Math.ceil(Number(mvp.bidOlefoot) * 1.05) : Number(mvp.minBidOlefoot))}
                />
                <button type="button" onClick={() => void darLance()} disabled={agindo || !lance}
                  className="bg-neon-yellow px-4 py-2 font-display text-[11px] font-black uppercase text-black hover:bg-white disabled:opacity-50">
                  {L('Dar lance', 'Place bid')}
                </button>
              </div>
            ) : encerrado && mvp.status === 'open' && mvp.souOMaior ? (
              <button type="button" onClick={() => void retirar()} disabled={agindo}
                className="bg-emerald-400 px-4 py-2 font-display text-[11px] font-black uppercase text-black hover:bg-white disabled:opacity-50">
                {L('Retirar o card', 'Claim the card')}
              </button>
            ) : null}
          </div>
        )}
      </section>

      {/* ── TICKER ───────────────────────────────────────────────────────── */}
      <section>
        <h2 className="ole-eyebrow-poster mb-3" style={{ fontSize: '13px' }}>{L('Ticker · últimas variações', 'Ticker · latest moves')}</h2>
        <div className="ole-poster max-h-[380px] overflow-auto">
          {ticker.length === 0 ? (
            <p className="p-6 text-sm text-white/45">
              {carregando ? L('Carregando…', 'Loading…') : L('Sem variações nas últimas 48h — joga uma partida e vê o preço andar.', 'No moves in the last 48h — play a match and watch the price move.')}
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {ticker.map((t, i) => (
                <li key={`${t.gamePlayerId}-${t.at}-${i}`} className="flex items-center justify-between gap-3 px-4 py-2 text-[12px]">
                  <span className="min-w-0 truncate">
                    <strong className="text-white">{t.name}</strong>
                    <span className="ml-1.5 text-[10px] uppercase text-white/40">{t.pos} · OVR {t.ovr}{t.dono ? ` · ${t.dono}` : ''}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3 font-mono tabular-nums">
                    <span className="text-[10px] text-white/35">{FONTE[t.source] ?? t.source}</span>
                    <span className="text-white/70">{olefootDeCents(t.marketBroCents)}</span>
                    <span className={cn('flex w-20 items-center justify-end gap-1', t.deltaCents >= 0 ? 'text-emerald-300' : 'text-rose-300')}>
                      {t.deltaCents >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                      {t.deltaPct != null ? `${t.deltaPct > 0 ? '+' : ''}${t.deltaPct.toFixed(1)}%` : '—'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ── OLE-100 ──────────────────────────────────────────────────────── */}
      <section>
        <h2 className="ole-eyebrow-poster mb-3" style={{ fontSize: '13px' }}>{L('OLE-100 · os mais valiosos do mundo', 'OLE-100 · most valuable in the world')}</h2>
        <div className="ole-poster max-h-[460px] overflow-auto">
          {top.length === 0 ? (
            <p className="p-6 text-sm text-white/45">
              {carregando ? L('Carregando…', 'Loading…') : L('O ranking nasce com as primeiras partidas no ar.', 'The ranking starts with the first matches played.')}
            </p>
          ) : (
            <table className="w-full min-w-[520px] text-left text-[12px]">
              <thead className="sticky top-0 bg-black/90">
                <tr className="border-b border-white/10 text-[9px] uppercase tracking-wider text-white/45">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">{L('Jogador', 'Player')}</th>
                  <th className="px-3 py-2">{L('Clube', 'Club')}</th>
                  <th className="px-3 py-2">OVR</th>
                  <th className="px-3 py-2">{L('Valor (OLEFOOT)', 'Value (OLEFOOT)')}</th>
                  <th className="px-3 py-2">Δ 24h</th>
                </tr>
              </thead>
              <tbody>
                {top.map((o, i) => (
                  <tr key={o.gamePlayerId} className="border-b border-white/5">
                    <td className="px-3 py-1.5 font-mono text-white/40">{i + 1}</td>
                    <td className="px-3 py-1.5 font-bold text-white">{o.name} <span className="text-[10px] font-normal uppercase text-white/40">{o.pos}</span></td>
                    <td className="px-3 py-1.5 text-white/55">{o.dono ?? '—'}</td>
                    <td className="px-3 py-1.5 font-impact text-[14px] text-white tabular-nums">{o.ovr}</td>
                    <td className="px-3 py-1.5 font-mono font-bold text-neon-yellow tabular-nums">{olefootDeCents(o.marketBroCents)}</td>
                    <td className={cn('px-3 py-1.5 font-mono tabular-nums', o.delta24hCents >= 0 ? 'text-emerald-300' : 'text-rose-300')}>
                      {o.delta24hCents === 0 ? '—' : `${o.delta24hCents > 0 ? '+' : ''}${olefootDeCents(o.delta24hCents)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="mt-2 text-[11px] text-white/40">
          {emIngles() ? (
            <>Want to see yours here? The price lives in <Link to="/clube/valores" className="text-neon-yellow underline">Squad values</Link> —
            every match and training session moves the number.</>
          ) : (
            <>Quer ver os teus aqui? O preço vive em <Link to="/clube/valores" className="text-neon-yellow underline">Valores do elenco</Link> —
            cada partida e treino move o número.</>
          )}
        </p>
      </section>
    </div>
  );
}
