/**
 * Hub do Mercado — DS 2027 "Respeito é ouro".
 *
 * O saldo é valor que já existe (degrau RESPEITO: asfalto + fio de ouro). O
 * drop de lendas é a vitrine: cartas reais do mercado coladas tortas como
 * lambe. As três portas são cartazes de rua — Transfer é a ação (rua), a Bolsa
 * é o "ao vivo" em concreto, a Loja é o papel de lambe (cal).
 */
import { Link } from 'react-router-dom';
import { useGameStore } from '@/game/store';
import { useTrackScreen } from '@/progression/trackEvent';
import { FitaRua, SecaoRua, SeloRua } from '@/components/ui/Rua';
import { CartaLenda, TORTO } from '@/components/home/rua/DropLenda';
import { useLegendDrops } from '@/components/home/rua/useLegendDrops';
import { L, LOCALE } from '@/i18n/L';

export function MarketHub() {
  useTrackScreen('screen_market_hub');
  const finance = useGameStore((s) => s.finance);
  const legends = useLegendDrops(8);

  const expDisplay = Math.floor(finance.ole ?? 0).toLocaleString(LOCALE);
  const broDisplay = (finance.broCents / 100).toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-10 px-3 pb-10 sm:px-4">
      <FitaRua tags={['#compra', '#vende', '#troca', '#correloko']} className="-mx-3 -mt-3 py-2 sm:-mx-4" />

      {/* ── Cabeçalho + saldo ─────────────────────────────────────────── */}
      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <SecaoRua label={L('Mercado · T2027', 'Market · S2027')} />
          <h1 className="font-impact text-[clamp(64px,19vw,140px)] uppercase leading-[0.84] text-papel">{L('Mercado', 'Market')}</h1>
          <p className="font-voz text-[clamp(26px,7vw,40px)] leading-none text-rua">
            {L('Respeito não se compra. Carta sim.', "Respect can't be bought. Cards can.")}
          </p>
        </div>

        <Link
          to="/wallet"
          aria-label={L('Teu saldo — abrir carteira', 'Your balance — open wallet')}
          className="group flex min-w-0 flex-col gap-3 border-[3px] border-ouro-27 bg-asfalto-27 p-4 transition-colors hover:bg-concreto md:min-w-[300px]"
        >
          <div className="flex items-center justify-between gap-3 font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-ouro-27">
            <span>— {L('Teu saldo', 'Your balance')}</span>
            <span aria-hidden className="text-papel transition-transform group-hover:translate-x-1">→</span>
          </div>
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="block min-w-0 truncate font-impact text-[clamp(36px,10vw,48px)] leading-none text-papel tabular-nums">{expDisplay}</span>
            <span className="shrink-0 font-prova text-[12px] font-bold text-mudo">EXP</span>
          </div>
          <div className="flex min-w-0 items-baseline gap-2 border-t-2 border-linha pt-2.5">
            <span className="font-impact text-[24px] leading-none text-ouro-27 tabular-nums">{broDisplay}</span>
            <span className="font-prova text-[12px] font-bold text-mudo">BRO</span>
          </div>
        </Link>
      </header>

      {/* ── Drop de lendas: a vitrine ─────────────────────────────────── */}
      {legends.length > 0 && (
        <section aria-label={L('Drop de lenda', 'Legend drop')} className="flex min-w-0 flex-col gap-1">
          <SecaoRua label={L('Drop de lenda · na vitrine', 'Legend drop · on display')} aside={legends.length} />
          <ul className="-mx-3 flex max-w-none snap-x snap-mandatory gap-4 overflow-x-auto px-5 py-6 [scrollbar-width:none] sm:-mx-4 sm:px-6 [&::-webkit-scrollbar]:hidden">
            {legends.map((lg, i) => (
              <li key={lg.id} className="shrink-0 snap-start">
                <CartaLenda legend={lg} torto={TORTO[i % TORTO.length]!} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── As três portas ────────────────────────────────────────────── */}
      <section aria-label={L('Seções do mercado', 'Market sections')} className="grid grid-cols-1 gap-5 md:grid-cols-[1.4fr_1fr]">
        {/* Transfer — a ação. Cartaz amarelo com alambrado e retícula. */}
        <Link
          to="/mercado/transfer"
          className="group relative flex min-h-[300px] flex-col justify-between gap-6 overflow-hidden bg-rua p-5 text-asfalto-27 sm:p-7 md:row-span-2"
        >
          <span aria-hidden className="rua-alambrado absolute inset-x-0 top-0 h-40 [--alambrado:rgba(13,13,12,0.28)]" />
          <span
            aria-hidden
            className="rua-reticula absolute -bottom-6 -right-6 h-56 w-64 [--reticula:rgba(13,13,12,0.55)]"
            style={{
              WebkitMaskImage: 'radial-gradient(circle at 100% 100%, #000 0%, transparent 72%)',
              maskImage: 'radial-gradient(circle at 100% 100%, #000 0%, transparent 72%)',
            }}
          />
          <div className="relative flex items-center justify-between font-prova text-[11.5px] font-bold uppercase tracking-[0.2em]">
            <span>{L('Jogadores · lendas', 'Players · legends')}</span>
            <span>01</span>
          </div>
          <div className="relative flex flex-col gap-3">
            <span className="font-impact text-[clamp(56px,15vw,104px)] uppercase leading-[0.9]">
              Transfer
              <br />
              Market
            </span>
            <span className="font-voz text-[clamp(24px,6vw,32px)] leading-none">
              {L('Compra, vende, monta o time.', 'Buy, sell, build the squad.')}
            </span>
          </div>
          <span className="relative inline-flex min-h-[54px] items-center gap-2 self-start bg-asfalto-27 px-6 font-impact text-[21px] uppercase leading-none text-rua transition-transform group-hover:-translate-y-0.5">
            {L('Explorar', 'Explore')} <span aria-hidden>→</span>
          </span>
        </Link>

        {/* Bolsa — o "ao vivo" em concreto. */}
        <Link
          to="/mercado/vivo"
          className="rua-grao group flex min-h-[200px] flex-col justify-between gap-5 bg-concreto p-5 text-papel transition-colors hover:bg-card sm:p-6"
        >
          <div className="flex items-center justify-between gap-3">
            <SeloRua tom="corre">● {L('Ao vivo', 'Live')}</SeloRua>
            <span className="font-prova text-[11.5px] font-bold tracking-[0.2em] text-mudo">02</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="font-spray text-[clamp(44px,12vw,64px)] font-black uppercase leading-[0.9] text-rua">OLE-100</span>
            <span className="font-impact text-[clamp(28px,7.5vw,38px)] uppercase leading-none">{L('Mercado ao vivo', 'Live market')}</span>
            <span className="font-prova text-[12px] text-mudo">{L('Ticker · índice · leilão do MVP', 'Ticker · index · MVP auction')}</span>
          </div>
          <span className="inline-flex items-center gap-2 self-start font-impact text-[18px] uppercase text-rua group-hover:text-papel">
            {L('Ver a bolsa', 'View exchange')} <span aria-hidden>→</span>
          </span>
        </Link>

        {/* Loja — papel de lambe colado torto. */}
        <Link
          to="/mercado/loja"
          className="group flex min-h-[200px] -rotate-1 flex-col justify-between gap-5 bg-cal p-5 text-asfalto-27 shadow-[6px_6px_0_rgba(0,0,0,0.6)] transition-transform hover:rotate-0 sm:p-6"
        >
          <div className="flex items-center justify-between gap-3 font-prova text-[11.5px] font-bold uppercase tracking-[0.2em]">
            <span>{L('Itens', 'Items')}</span>
            <span>03</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-impact text-[clamp(52px,14vw,76px)] uppercase leading-[0.86]">{L('Loja', 'Store')}</span>
            <span className="font-voz text-[clamp(22px,5.6vw,28px)] leading-none">{L('Packs, boosters e extras.', 'Packs, boosters and extras.')}</span>
          </div>
          <span className="inline-flex items-center gap-2 self-start border-b-[3px] border-asfalto-27 font-impact text-[18px] uppercase leading-tight">
            {L('Abrir loja', 'Open store')} <span aria-hidden>→</span>
          </span>
        </Link>
      </section>

      <Link
        to="/mercado/leiloes"
        className="flex min-h-[64px] items-center justify-between gap-3 border-2 border-dashed border-fio px-5 text-papel transition-colors hover:border-rua"
      >
        <span className="flex min-w-0 flex-col">
          <span className="font-impact text-[22px] uppercase leading-none">{L('Leilões', 'Auctions')}</span>
          <span className="truncate font-prova text-[12px] text-mudo">{L('Quem dá mais leva a carta', 'Highest bid takes the card')}</span>
        </span>
        <span aria-hidden className="font-impact text-[22px] text-rua">→</span>
      </Link>
    </div>
  );
}
