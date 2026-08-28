/**
 * ClubFeed — O FEED VIVO DO CLUBE (Fase 1).
 *
 * Substitui a antiga `HomeManagerFeed` (que estava órfã: 226 linhas, zero
 * imports). O motivo de existir mudou: em vez de inventar 3 cards de heurística,
 * este componente EXPÕE o que o jogo já produz e escondia num dropdown do header.
 *
 * Fonte única: `state.inbox`, que já carrega 40+ tipos de mensagem tipada —
 * lesão, moral, treino concluído, contrato, staff, finanças, torcida. Cada item
 * já traz `tag`, `colorClass`, `timeLabel` e (às vezes) `deepLink`. Nada aqui é
 * inventado: é o clube contando o que fez enquanto o manager não olhava.
 *
 * O MUNDO (movimento de mercado de outros managers) fica na seção "A Resenha"
 * da Home — de propósito. Um feed pro clube, um pro mundo, sem repetir dado.
 *
 * Presentational puro — todo dado entra por props.
 */

import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InboxItem } from '@/game/inboxTypes';

/** Quantos itens cabem antes do feed virar rolagem disfarçada. */
const MAX_ITEMS = 5;

interface ClubFeedProps {
  /** `state.inbox` — mais recente PRIMEIRO (o reducer usa INBOX_PREPEND). */
  inbox: readonly InboxItem[];
}

/** Uma linha do fio. Vira link quando o item tem destino. */
function FeedRow({
  item,
  index,
}: {
  item: InboxItem;
  index: number;
}) {
  const body = (
    <>
      {/* Fio + marcador: é o que costura as linhas numa timeline só. */}
      <span aria-hidden className="relative flex w-3 flex-none justify-center self-stretch">
        <span className="absolute inset-y-0 w-px" style={{ background: 'var(--color-divider-soft)' }} />
        <span className={cn('relative mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-current', item.colorClass)} />
      </span>

      <span className="min-w-0 flex-1 pb-3">
        <span className="flex items-baseline gap-2">
          <span
            className={cn('font-display font-black uppercase', item.colorClass)}
            style={{ fontSize: '9px', letterSpacing: '0.16em' }}
          >
            {item.tag}
          </span>
          <span
            className="ml-auto flex-none tabular-nums text-white/35"
            style={{ fontFamily: 'var(--font-ui)', fontSize: '10px' }}
          >
            {item.timeLabel}
          </span>
        </span>
        <span
          className="mt-0.5 block truncate text-white"
          style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 600 }}
        >
          {item.title}
        </span>
        {item.body ? (
          <span
            className="mt-0.5 block truncate text-white/45"
            style={{ fontFamily: 'var(--font-sans)', fontSize: '12px' }}
          >
            {item.body}
          </span>
        ) : null}
      </span>

      {item.deepLink ? <ChevronRight aria-hidden className="mt-1 h-4 w-4 flex-none text-white/25" /> : null}
    </>
  );

  const className = cn(
    'flex w-full items-start gap-2 text-left',
    item.deepLink && 'transition-colors hover:bg-white/[0.03]',
  );

  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 6) * 0.04, duration: 0.22 }}
    >
      {item.deepLink ? (
        <Link to={item.deepLink} className={className}>{body}</Link>
      ) : (
        <div className={className}>{body}</div>
      )}
    </motion.li>
  );
}

export function ClubFeed({ inbox }: ClubFeedProps) {
  // O pós-jogo já marca `hideFromHomeFeed` — respeitar, senão o feed vira placar.
  const items = inbox.filter((i) => !i.hideFromHomeFeed).slice(0, MAX_ITEMS);
  if (items.length === 0) return null;

  return (
    <section
      aria-label="O que aconteceu no clube"
      style={{
        background: 'var(--color-panel)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-card)',
        padding: '14px 14px 4px',
      }}
    >
      <div className="mb-3 flex items-baseline gap-2">
        <span aria-hidden className="h-3 w-0.5 flex-none bg-neon-yellow" />
        <h2 className="font-impact uppercase text-white" style={{ fontSize: '15px', letterSpacing: '0.01em' }}>
          No clube
        </h2>
        <Link
          to="/manager/mensagens"
          className="ml-auto font-display font-black uppercase text-white/40 transition-colors hover:text-neon-yellow"
          style={{ fontSize: '9px', letterSpacing: '0.18em' }}
        >
          Tudo
        </Link>
      </div>

      <ul>
        {items.map((item, i) => (
          <FeedRow key={item.id} item={item} index={i} />
        ))}
      </ul>
    </section>
  );
}
