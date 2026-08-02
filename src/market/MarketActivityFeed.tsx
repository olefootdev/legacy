/**
 * MarketActivityFeed — "A Resenha": o pulso do mercado na Home.
 *
 * ── Repaginado no layer final (2026-08-01) ─────────────────────────────────
 * A versão anterior era do padrão antigo: cada atividade virava um cartão com
 * fundo, borda e um trilho de cor DIFERENTE por tipo (verde/azul/laranja/roxo),
 * ícone dentro de um círculo, e o valor em serifa itálica.
 *
 * Isso brigava com a linguagem em três pontos:
 *   1. o trilho é AMARELO e significa pertencimento — não é um código de cores;
 *   2. hierarquia vem de UMA cor, não de um arco-íris que dá peso igual a tudo;
 *   3. serifa itálica é pra nome de LENDA, nunca pra número (Anton tabular).
 *
 * Agora cada atividade é uma LINHA: trilho amarelo, ícone de traço monocromático,
 * a frase em Inter e o valor em Anton amarelo. Lucro continua verde porque verde
 * ali é informação (ganhou dinheiro), não decoração.
 */
import { motion } from 'motion/react';
import { ArrowLeftRight, Gavel, Tag, TrendingUp } from 'lucide-react';
import { formatPrice, type MarketActivity } from '@/market/socialTrade';

interface MarketActivityFeedProps {
  activities: MarketActivity[];
  maxVisible?: number;
}

const ICONE: Record<MarketActivity['type'], typeof TrendingUp> = {
  purchase: TrendingUp,
  sale: ArrowLeftRight,
  auction_won: Gavel,
  auction_lost: Gavel,
  listing: Tag,
};

const VERBO: Record<MarketActivity['type'], string> = {
  purchase: 'comprou',
  sale: 'vendeu',
  auction_won: 'arrematou',
  auction_lost: 'disputou',
  listing: 'listou',
};

export function MarketActivityFeed({ activities, maxVisible = 5 }: MarketActivityFeedProps) {
  const visible = activities.slice(0, maxVisible);

  if (activities.length === 0) {
    return (
      <p className="py-6 text-center text-white/40" style={{ fontFamily: 'var(--font-sans)', fontSize: '13px' }}>
        Nenhuma movimentação no mercado ainda.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {visible.map((a, i) => {
        const Icon = ICONE[a.type];

        return (
          <motion.li
            key={a.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-start gap-2.5 pl-3"
            // Trilho amarelo: a assinatura do layer final. Mesma espessura em
            // todas as linhas — o feed não hierarquiza por cor de tipo.
            style={{ borderLeft: '2px solid rgba(253,225,0,0.4)' }}
          >
            <Icon
              className="mt-0.5 h-3.5 w-3.5 flex-none"
              strokeWidth={2}
              style={{ color: 'rgba(237,235,228,0.45)' }}
              aria-hidden
            />

            <div className="min-w-0 flex-1">
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'rgba(237,235,228,0.62)' }}>
                <span style={{ color: 'rgba(237,235,228,0.9)', fontWeight: 600 }}>{a.userName}</span>{' '}
                {VERBO[a.type]}{' '}
                <span style={{ color: '#fff', fontWeight: 600 }}>{a.playerName}</span>{' '}
                <span style={{ color: 'rgba(237,235,228,0.4)' }}>
                  ({a.playerPos} · {a.playerOvr} OVR)
                </span>
              </p>

              <div className="mt-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                <span
                  className="font-impact tabular-nums"
                  style={{ fontSize: '16px', lineHeight: 1, color: 'var(--color-neon-yellow)' }}
                >
                  {formatPrice(a.price, a.currency)}
                </span>

                {a.profit != null && a.profit > 0 && (
                  <span
                    className="font-display font-black uppercase"
                    style={{ fontSize: '9px', letterSpacing: '0.1em', color: 'var(--color-success)' }}
                  >
                    +{formatPrice(a.profit, a.currency)} de lucro
                  </span>
                )}

                <span
                  className="font-display font-bold uppercase"
                  style={{ fontSize: '9px', letterSpacing: '0.12em', color: 'rgba(237,235,228,0.3)' }}
                >
                  {formatRelativeTime(a.timestamp)}
                </span>
              </div>
            </div>
          </motion.li>
        );
      })}
    </ul>
  );
}

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `há ${days}d`;
  if (hours > 0) return `há ${hours}h`;
  if (minutes > 0) return `há ${minutes}min`;
  return 'agora';
}
