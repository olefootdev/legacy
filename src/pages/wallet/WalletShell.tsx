import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';

import { WalletSpotToggle } from './WalletSpotToggle';
import { Sparkline } from './Sparkline';
import { L } from '@/i18n/L';

export function WalletShell({
  title,
  subtitle,
  heroStats,
  heroVariant = 'cinematic',
  hashtag = L('#carteira', '#wallet'),
  voltar = false,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Categoria em mono acima do título. */
  hashtag?: string;
  /**
   * Tela de DENTRO da carteira (Coleção, Network): troca o toggle SPOT | DEX
   * por um voltar. O toggle só escolhe entre as duas contas — numa tela que não
   * é nenhuma das duas ele aparecia sem nada aceso, prometendo uma troca que
   * não existia.
   */
  voltar?: boolean;
  heroStats?: {
    label: string;
    value: string;
    subValue?: string;
    highlight?: boolean;
    spark?: number[];
    sparkPositive?: boolean;
  }[];
  /** 'cinematic' = hero alto (88vh). 'compact' = hero menor (~50vh) quando o conteúdo abaixo é rico. */
  heroVariant?: 'cinematic' | 'compact';
  children: ReactNode;
}) {
  // DS 2027 · peça "Carteira": título na voz, régua de ouro, o saldo que
  // manda em Anton ouro (degrau RESPEITO: valor que já existe), o resto em linha.
  const principal = heroStats?.find((st) => st.highlight) ?? heroStats?.[0] ?? null;
  const demais = (heroStats ?? []).filter((st) => st !== principal);
  return (
    <div className="min-h-screen">
      <section className="relative w-full">
        <div className="relative mx-auto flex max-w-3xl flex-col gap-6 px-4 pb-2 pt-1 sm:px-8 sm:pt-3">
          <div className="flex items-center justify-between gap-3">
            {voltar ? (
              <Link
                to="/wallet"
                className="inline-flex min-h-[44px] items-center gap-2 font-prova text-[12px] font-bold uppercase tracking-[0.16em] text-mudo transition-colors hover:text-papel"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={2.4} /> {L('Carteira', 'Wallet')}
              </Link>
            ) : (
              <WalletSpotToggle />
            )}
            <span className="inline-flex shrink-0 items-center gap-1.5 font-prova text-[11.5px] font-bold uppercase tracking-[0.2em] text-mudo">
              Solana <span aria-hidden className="text-ouro-27">●</span>
            </span>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="flex min-w-0 flex-col gap-1.5 border-b-[3px] border-ouro-27 pb-5"
          >
            <p className="font-prova text-[12px] font-bold uppercase tracking-[0.22em] text-mudo">— {hashtag}</p>
            <h1
              className="font-voz leading-[0.92] text-papel [overflow-wrap:anywhere]"
              style={{ fontSize: heroVariant === 'compact' ? 'clamp(52px, 14vw, 92px)' : 'clamp(60px, 16vw, 112px)' }}
            >
              {title}
            </h1>
            {subtitle && <p className="max-w-md text-[14px] leading-relaxed text-suave">{subtitle}</p>}
          </motion.div>

          {principal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="flex flex-col gap-5 border-b-[3px] border-ouro-27 pb-6"
            >
              <div className="flex min-w-0 flex-col gap-1.5">
                <p className="font-prova text-[12px] font-bold uppercase tracking-[0.22em] text-mudo">— {principal.label}</p>
                <p
                  // Ouro é valor que EXISTE: saldo zerado fica em papel.
                  className={`font-impact leading-[0.88] tabular-nums [overflow-wrap:anywhere] ${
                    /^[^1-9]*$/.test(principal.value) ? 'text-papel' : 'text-ouro-27'
                  }`}
                  style={{ fontSize: 'clamp(48px, 15vw, 96px)' }}
                >
                  {principal.value}
                </p>
                {principal.subValue && <p className="font-prova text-[12px] text-suave tabular-nums">{principal.subValue}</p>}
                {principal.spark && principal.spark.length > 1 ? (
                  <Sparkline data={principal.spark} positive={principal.sparkPositive ?? true} width={220} height={30} />
                ) : null}
              </div>
              {demais.length > 0 && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
                  {demais.map((stat, i) => (
                    <div key={i} className="flex min-w-0 flex-col gap-1 border-l-[3px] border-linha pl-3">
                      <p className="truncate font-prova text-[11px] font-bold uppercase tracking-[0.18em] text-mudo">{stat.label}</p>
                      <p className="font-impact text-[clamp(26px,7vw,34px)] leading-none text-papel tabular-nums [overflow-wrap:anywhere]">
                        {stat.value}
                      </p>
                      {stat.subValue ? <p className="truncate font-prova text-[11px] text-mudo tabular-nums">{stat.subValue}</p> : null}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </section>

      {/* ── CONTEÚDO PRINCIPAL ────────────────────────────────────── */}
      <div id="wallet-content" className="mx-auto min-w-0 w-full max-w-3xl space-y-10 px-4 sm:px-8 py-6 sm:py-10 pb-28 md:pb-12">
        {children}
      </div>
    </div>
  );
}
