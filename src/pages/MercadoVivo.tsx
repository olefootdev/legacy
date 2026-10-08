/**
 * MERCADO AO VIVO — a bolsa do Olefoot (RPG-PRICE-LIVE nº 1 e nº 5).
 *
 * O preço de cada jogador muda a cada partida e treino; esta tela transforma
 * isso em espetáculo: o TICKER (últimas variações, com quem e por quê), o
 * OLE-100 (os 100 mais valiosos do mundo, com Δ24h), o ÍNDICE (a soma do
 * top-100, de hora em hora) e o LEILÃO-RELÂMPAGO DO MVP — o artilheiro real
 * das últimas 24h, cópia única, 15 minutos, lance em OLEFOOT com escrow no
 * banco. Tudo lido do servidor; nada aqui decide preço.
 *
 * DS 2027 · "Respeito é ouro": o ticker corre numa faixa de papel colada torta
 * (o momento rua), o leilão do MVP é o DROP — ouro chapado com a contagem em
 * blocos de spray — e o OLE-100 é ranking de muro: o #01 com fio de ouro.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { BotaoRua, MarcaRua, SecaoRua, SeloRua } from '@/components/ui/Rua';
import { AvisoRua, ContagemSpray, OvrSelo, useRestante } from '@/components/bolsa/Bolsa';
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

/** Sparkline inline do índice — sem lib, só polyline. Cor = delta (alta/baixa). */
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
    <svg viewBox="0 0 300 36" className="h-12 w-full" preserveAspectRatio="none" aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke={subiu ? 'var(--color-alta)' : 'var(--color-baixa)'}
        strokeWidth="2.5"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

function Delta({ positivo, children, className }: { positivo: boolean; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 tabular-nums', positivo ? 'text-alta' : 'text-baixa', className)}>
      <span aria-hidden className="text-[0.7em]">{positivo ? '▲' : '▼'}</span>
      {children}
    </span>
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

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-10 overflow-x-hidden px-3 pb-10 sm:px-4">
      {/* ── MOMENTO RUA: o ticker corre numa faixa de papel colada torta ── */}
      {ticker.length > 0 && <FaixaTicker itens={ticker} />}

      {/* ── ÍNDICE OLE-100 ─────────────────────────────────────────────── */}
      <section aria-label={L('Mercado ao vivo', 'Live Market')} className="flex min-w-0 flex-col gap-3">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <SecaoRua label={L('Mercado ao vivo · índice OLE-100', 'Live market · OLE-100 index')} />
          <SeloRua tom="corre" className="shrink-0">● {L('Ao vivo', 'Live')}</SeloRua>
        </div>
        <h1 className="flex flex-col font-impact uppercase leading-[0.88]">
          <span className="font-voz text-[clamp(44px,12vw,72px)] normal-case leading-[0.9] text-papel">{L('A bolsa', 'The market')}</span>
          <span className="text-[clamp(30px,8.5vw,52px)] text-transparent [-webkit-text-stroke:1.5px_var(--color-papel)]">
            {L('Preço é jogo.', 'Price is play.')}
          </span>
        </h1>

        <div className="rua-grao mt-2 flex min-w-0 flex-col gap-3 bg-concreto p-5 sm:p-6">
          <span className="font-prova text-[11px] font-bold uppercase tracking-[0.22em] text-mudo">
            {L('Índice · soma dos 100 mais valiosos', 'Index · sum of the top 100')}
          </span>
          <p className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-spray text-[clamp(44px,13vw,84px)] font-black leading-[0.85] tabular-nums text-papel [overflow-wrap:anywhere]">
              {indiceAtual == null ? '—' : olefootDeCents(indiceAtual)}
            </span>
            <span className="font-prova text-[12px] font-bold uppercase tracking-[0.18em] text-mudo">OLEFOOT</span>
          </p>
          {indiceDelta != null && (
            <Delta positivo={indiceDelta >= 0} className="font-impact text-[22px] leading-none">
              {indiceDelta >= 0 ? '+' : ''}
              {indiceDelta.toFixed(2)}%
              <span className="ml-1 font-prova text-[11px] font-bold uppercase tracking-[0.16em] text-mudo">{L('na janela', 'in window')}</span>
            </Delta>
          )}
          <IndiceSparkline pontos={indice} />
          <span className="font-prova text-[11px] uppercase tracking-[0.14em] text-mudo">{L('Atualiza de hora em hora', 'Updates hourly')}</span>
        </div>
      </section>

      {erro ? <AvisoRua tipo="erro">{erro}</AvisoRua> : null}
      {aviso ? <AvisoRua tipo="ok">{aviso}</AvisoRua> : null}

      {/* ── LEILÃO DO MVP — o drop ──────────────────────────────────────── */}
      <section aria-label={L('Leilão-relâmpago do MVP', 'MVP flash auction')} className="flex min-w-0 flex-col gap-3">
        <SecaoRua label={L('Leilão-relâmpago · todo dia às 20h', 'Flash auction · daily at 8 PM')} />
        {mvp == null ? (
          <div className="flex min-w-0 -rotate-1 flex-col gap-2 border-[3px] border-dashed border-asfalto-27 bg-cal p-5 text-asfalto-27">
            <span className="font-voz text-[clamp(30px,8vw,40px)] leading-[0.95]">{L('O martelo bate às 20h.', 'The hammer drops at 8 PM.')}</span>
            <p className="font-sans text-[13px] leading-snug">
              {L('Nenhum leilão ainda — o artilheiro do dia sobe ao martelo às 20h (precisa ter gol nas últimas 24h).', 'No auction yet — the top scorer of the day goes under the hammer at 8 PM (needs a goal in the last 24h).')}
            </p>
          </div>
        ) : (
          <LeilaoMvp mvp={mvp} lance={lance} setLance={setLance} agindo={agindo} onLance={() => void darLance()} onRetirar={() => void retirar()} />
        )}
      </section>

      {/* ── TICKER ─────────────────────────────────────────────────────── */}
      <section className="flex min-w-0 flex-col gap-3">
        <SecaoRua label={L('Ticker · últimas variações', 'Ticker · latest moves')} aside={ticker.length > 0 ? String(ticker.length) : undefined} />
        {ticker.length === 0 ? (
          <Vazio>
            {carregando ? L('Carregando…', 'Loading…') : L('Sem variações nas últimas 48h — joga uma partida e vê o preço andar.', 'No moves in the last 48h — play a match and watch the price move.')}
          </Vazio>
        ) : (
          <ul className="flex max-h-[420px] min-w-0 flex-col gap-1.5 overflow-y-auto">
            {ticker.map((t, i) => (
              <li key={`${t.gamePlayerId}-${t.at}-${i}`} className="flex min-h-[60px] min-w-0 items-center gap-3 bg-concreto px-3 py-2">
                <OvrSelo ovr={t.ovr} />
                <div className="flex min-w-0 grow flex-col gap-0.5">
                  <span className="block min-w-0 truncate font-voz text-[21px] leading-none text-papel">{t.name}</span>
                  <span className="block min-w-0 truncate font-prova text-[10.5px] font-bold uppercase tracking-[0.12em] text-mudo">
                    {t.pos}
                    {t.dono ? ` · ${t.dono}` : ''} · {FONTE[t.source] ?? t.source}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="font-impact text-[17px] leading-none tabular-nums text-papel">{olefootDeCents(t.marketBroCents)}</span>
                  {t.deltaPct != null ? (
                    <Delta positivo={t.deltaCents >= 0} className="font-impact text-[15px] leading-none">
                      {t.deltaPct > 0 ? '+' : ''}
                      {t.deltaPct.toFixed(1)}%
                    </Delta>
                  ) : (
                    <span className="font-impact text-[15px] leading-none text-mudo">—</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── OLE-100 ────────────────────────────────────────────────────── */}
      <section className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-col gap-1">
          <SecaoRua label={L('OLE-100 · os mais valiosos do mundo', 'OLE-100 · most valuable in the world')} />
          <h2 className="font-impact text-[clamp(30px,8.5vw,48px)] uppercase leading-[0.9] text-papel">
            {L('Os 100 do ', 'The top 100 ')}
            <span className="text-ouro-27">{L('muro', 'wall')}</span>
          </h2>
        </div>
        {top.length === 0 ? (
          <Vazio>
            {carregando ? L('Carregando…', 'Loading…') : L('O ranking nasce com as primeiras partidas no ar.', 'The ranking starts with the first matches played.')}
          </Vazio>
        ) : (
          <ol className="flex max-h-[520px] min-w-0 flex-col gap-1.5 overflow-y-auto">
            {top.map((o, i) => {
              const lider = i === 0;
              return (
                <li
                  key={o.gamePlayerId}
                  className={cn(
                    'flex min-h-[60px] min-w-0 items-center gap-3 px-3 py-2',
                    lider ? 'border-[3px] border-ouro-27 bg-asfalto-27' : 'bg-concreto',
                  )}
                >
                  <span className={cn('w-11 shrink-0 font-impact text-[20px] leading-none tabular-nums', lider ? 'text-ouro-27' : 'text-mudo')}>
                    #{String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="flex min-w-0 grow flex-col gap-0.5">
                    <span className={cn('block min-w-0 truncate font-voz text-[21px] leading-none', lider ? 'text-ouro-27' : 'text-papel')}>{o.name}</span>
                    <span className="block min-w-0 truncate font-prova text-[10.5px] font-bold uppercase tracking-[0.12em] text-mudo">
                      {o.pos} · OVR {o.ovr} · {o.dono ?? '—'}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className={cn('font-impact text-[17px] leading-none tabular-nums', lider ? 'text-ouro-27' : 'text-papel')}>
                      {olefootDeCents(o.marketBroCents)}
                    </span>
                    {o.delta24hCents === 0 ? (
                      <span className="font-prova text-[11px] font-bold text-mudo">Δ —</span>
                    ) : (
                      <Delta positivo={o.delta24hCents > 0} className="font-impact text-[14px] leading-none">
                        {o.delta24hCents > 0 ? '+' : ''}
                        {olefootDeCents(o.delta24hCents)}
                      </Delta>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        <p className="font-prova text-[11px] uppercase tracking-[0.12em] text-mudo">
          {L('Valor em OLEFOOT · Δ em 24h', 'Value in OLEFOOT · Δ over 24h')}
        </p>
      </section>

      <footer className="flex min-w-0 items-end justify-between gap-4 border-t-2 border-linha pt-6">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="font-voz text-[clamp(28px,8vw,40px)] leading-none text-papel">
            {L('Quer ver os teus aqui?', 'Want to see yours here?')}
          </span>
          <p className="font-sans text-[13px] leading-snug text-suave">
            {emIngles() ? (
              <>The price lives in Squad values — every match and training session moves the number.</>
            ) : (
              <>O preço vive em Valores do elenco — cada partida e treino move o número.</>
            )}
          </p>
          <Link
            to="/clube/valores"
            className="inline-flex min-h-[44px] items-center gap-2 self-start font-impact text-[18px] uppercase text-rua hover:text-papel"
          >
            {L('Valores do elenco', 'Squad values')} <span aria-hidden>→</span>
          </Link>
        </div>
        <MarcaRua tipo="escudo" className="h-14 bg-fio" />
      </footer>
    </div>
  );
}

/** Faixa de papel com o ticker andando — decorativa (a lista abaixo é a fonte acessível). */
function FaixaTicker({ itens }: { itens: TickerItem[] }) {
  const linha = itens.slice(0, 14);
  const repetida = linha.length < 7 ? [...linha, ...linha, ...linha] : linha;
  return (
    <div aria-hidden className="pointer-events-none relative max-w-none overflow-hidden py-3">
      <div className="-mx-8 flex h-12 w-[calc(100%+64px)] max-w-none items-center overflow-hidden bg-cal text-asfalto-27 shadow-[0_4px_0_var(--color-asfalto-27)]" style={{ transform: 'rotate(-1.5deg)' }}>
        <div className="rua-fita-trilho flex max-w-none shrink-0 items-center gap-8 whitespace-nowrap pl-6">
          {[...repetida, ...repetida].map((t, i) => (
            <span key={i} className="inline-flex items-baseline gap-2">
              <span className="font-voz text-[22px] leading-none">{t.name}</span>
              <span className="font-impact text-[17px] leading-none tabular-nums">{olefootDeCents(t.marketBroCents)}</span>
              {t.deltaPct != null && (
                <span className="font-impact text-[15px] leading-none tabular-nums">
                  <span className={t.deltaCents >= 0 ? 'text-alta' : 'text-baixa'}>{t.deltaCents >= 0 ? '▲' : '▼'}</span>
                  {Math.abs(t.deltaPct).toFixed(1)}%
                </span>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * O DROP do dia: ouro chapado (degrau LENDA — cópia única), retícula no canto,
 * nome na voz e a contagem em blocos de spray.
 */
function LeilaoMvp({
  mvp,
  lance,
  setLance,
  agindo,
  onLance,
  onRetirar,
}: {
  mvp: MvpAuction;
  lance: string;
  setLance: (v: string) => void;
  agindo: boolean;
  onLance: () => void;
  onRetirar: () => void;
}) {
  const resta = useRestante(mvp.endsAt);
  const encerrado = resta <= 0;
  const aberto = mvp.status === 'open' && !encerrado;
  const lanceAtual = mvp.bidOlefoot ? tok(Number(mvp.bidOlefoot)) : null;

  return (
    <div className="relative flex min-w-0 flex-col gap-5 overflow-hidden bg-ouro-27 p-5 text-asfalto-27 sm:p-7">
      <span
        aria-hidden
        className="rua-reticula absolute -right-4 -top-4 h-48 w-56 [--reticula:rgba(13,13,12,0.45)]"
        style={{
          WebkitMaskImage: 'radial-gradient(circle at 100% 0%, #000 0%, transparent 70%)',
          maskImage: 'radial-gradient(circle at 100% 0%, #000 0%, transparent 70%)',
        }}
      />

      <div className="relative flex min-w-0 items-center justify-between gap-3 border-b-2 border-asfalto-27 pb-2 font-prova text-[11.5px] font-bold uppercase tracking-[0.2em]">
        <span className="min-w-0 truncate">{L('Drop · MVP do dia', 'Drop · MVP of the day')} · {mvp.dia}</span>
        <span className="shrink-0">{L('Cópia única', 'Unique copy')}</span>
      </div>

      <div className="relative flex min-w-0 items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="font-impact text-[clamp(30px,8.5vw,52px)] uppercase leading-[0.88]">{L('Martelo do MVP', 'MVP hammer')}</span>
          <span className="block min-w-0 font-voz text-[clamp(38px,11vw,68px)] leading-[0.95] [overflow-wrap:anywhere]">{mvp.playerName}</span>
        </div>
        <MarcaRua tipo="nove" className="hidden h-24 bg-asfalto-27 sm:block" />
      </div>

      {aberto ? (
        <>
          <div className="relative flex min-w-0 flex-col gap-1.5">
            <span className="font-prova text-[11px] font-bold uppercase tracking-[0.2em]">{L('Fecha em', 'Closes in')}</span>
            <ContagemSpray ms={resta} bloco="bg-asfalto-27 text-ouro-27" />
          </div>

          <div className="relative flex min-w-0 flex-wrap items-end justify-between gap-x-4 gap-y-1 border-t-2 border-asfalto-27 pt-3">
            <div className="flex min-w-0 flex-col">
              <span className="font-prova text-[11px] font-bold uppercase tracking-[0.2em]">
                {lanceAtual ? L('Lance atual', 'Current bid') : L('Lance mínimo', 'Minimum bid')}
              </span>
              <span className="font-impact text-[clamp(30px,9vw,44px)] leading-none tabular-nums [overflow-wrap:anywhere]">
                {lanceAtual ?? tok(Number(mvp.minBidOlefoot))} <span className="font-prova text-[12px] font-bold tracking-[0.16em]">OLEFOOT</span>
              </span>
            </div>
            {mvp.souOMaior && (
              <SeloRua tom="corre" className="bg-asfalto-27 text-ouro-27">
                {L('O maior é teu', 'Highest is yours')}
              </SeloRua>
            )}
          </div>

          <div className="relative flex min-w-0 gap-2">
            <input
              className="h-[52px] w-full min-w-0 grow border-2 border-asfalto-27 bg-cal px-3 font-impact text-[20px] tabular-nums text-asfalto-27 outline-none placeholder:text-asfalto-27/40 focus:bg-papel"
              value={lance}
              inputMode="numeric"
              aria-label={L('Valor do lance em OLEFOOT', 'Bid amount in OLEFOOT')}
              onChange={(e) => setLance(e.target.value.replace(/[^\d]/g, ''))}
              placeholder={tok(mvp.bidOlefoot ? Math.ceil(Number(mvp.bidOlefoot) * 1.05) : Number(mvp.minBidOlefoot))}
            />
            <BotaoRua variante="asfalto" onClick={onLance} disabled={agindo || !lance} className="shrink-0 px-4 text-[18px] text-ouro-27">
              {L('Dar lance', 'Bid')} <span aria-hidden>→</span>
            </BotaoRua>
          </div>
        </>
      ) : (
        <div className="relative flex min-w-0 flex-col gap-3 border-t-2 border-asfalto-27 pt-3">
          <span className="font-spray text-[clamp(40px,12vw,64px)] font-black uppercase leading-[0.85]">
            {mvp.status === 'settled' ? L('Retirado', 'Claimed') : L('Martelo batido', 'Hammer down')}
          </span>
          <p className="font-sans text-[14px] font-medium leading-snug">
            {mvp.status === 'settled' ? (
              <>{L(`Encerrado e retirado — por ${tok(Number(mvp.bidOlefoot ?? 0))} OLEFOOT.`, `Ended and claimed — for ${tok(Number(mvp.bidOlefoot ?? 0))} OLEFOOT.`)}</>
            ) : encerrado && mvp.souOMaior ? (
              emIngles() ? (
                <>
                  <strong>You won for {tok(Number(mvp.bidOlefoot ?? 0))} OLEFOOT</strong>. Claim the card.
                </>
              ) : (
                <>
                  <strong>Tu venceste por {tok(Number(mvp.bidOlefoot ?? 0))} OLEFOOT</strong>. Retira o card.
                </>
              )
            ) : (
              <>
                {L('Encerrado', 'Ended')}
                {mvp.bidOlefoot ? L(` — maior lance ${tok(Number(mvp.bidOlefoot))} OLEFOOT`, ` — top bid ${tok(Number(mvp.bidOlefoot))} OLEFOOT`) : L(' sem lances', ' with no bids')}.
              </>
            )}
          </p>
          {encerrado && mvp.status === 'open' && mvp.souOMaior ? (
            <BotaoRua variante="asfalto" onClick={onRetirar} disabled={agindo} className="self-start text-ouro-27">
              {L('Retirar o card', 'Claim the card')} <span aria-hidden>→</span>
            </BotaoRua>
          ) : null}
        </div>
      )}

      <span className="relative font-prova text-[11px] font-bold uppercase tracking-[0.16em]">
        {L('50% do martelo vai pro dono do MVP', '50% of the hammer price goes to the MVP owner')}
      </span>
    </div>
  );
}

function Vazio({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-2 border-dashed border-fio px-5 py-6 font-sans text-[14px] leading-snug text-suave">{children}</p>
  );
}
