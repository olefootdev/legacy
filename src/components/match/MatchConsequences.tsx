/**
 * MatchConsequences — A CONTA DA PARTIDA (Fase 3.2).
 *
 * O motor de consequências persistentes já rodava: cartão vermelho vira
 * suspensão + moral abalado + multa, hat-trick vira moral em alta + valor de
 * mercado, goleada sofrida vira pressão da diretoria — tudo com curva de decay
 * e tempo de vida em horas reais.
 *
 * E o manager nunca via nada disso acontecer. As consequências apareciam depois,
 * espalhadas por Elenco e Scouts, sem ligação visível com o jogo que as causou.
 *
 * Este bloco fecha a corrente causal na tela onde ela nasce: DECISÃO → PARTIDA →
 * CONSEQUÊNCIA, com o "por que isso aconteceu" que o `IMPACT_CATALOG` já trazia
 * escrito em pt-BR desde sempre.
 *
 * Nada é calculado aqui: só se lê o que o reducer acabou de gravar — e só o
 * LOTE mais novo, pra não misturar uma rodada da Liga Global com a partida que
 * o manager acabou de jogar (ver `selectRecentConsequences`).
 */

import { useMemo } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useGameStore } from '@/game/store';
import { EMPTY_CONSEQUENCE_STORE } from '@/systems/consequences/store';
import { templateForKind } from '@/systems/impactCatalog';
import { selectRecentConsequences } from '@/systems/consequences/recent';
import type { PersistentConsequence } from '@/systems/consequences/types';

const MAX_ROWS = 5;

export interface MatchConsequencesProps {
  /** Nome por playerId — pra dizer QUEM levou, não só o quê. */
  playerNames?: Record<string, string>;
  /** Instante de referência (default: agora). Injetável pra teste. */
  nowMs?: number;
}

export function MatchConsequences({ playerNames, nowMs }: MatchConsequencesProps) {
  const store = useGameStore((s) => s.consequenceStore ?? EMPTY_CONSEQUENCE_STORE);
  const clubId = useGameStore((s) => s.club.id);

  const rows = useMemo(() => {
    const now = nowMs ?? Date.now();
    return selectRecentConsequences(store.active, clubId, now)
      .map((c) => ({ consequence: c, template: templateForKind(c.kind) }))
      // Sem template não há texto honesto pra mostrar — some em vez de inventar.
      .filter((r): r is { consequence: PersistentConsequence; template: NonNullable<typeof r.template> } => !!r.template)
      .slice(0, MAX_ROWS);
  }, [store, clubId, nowMs]);

  if (rows.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.35 }}
      aria-label="O que esta partida causou"
      className="border"
      style={{
        borderRadius: 'var(--radius-md)',
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-dark-gray)',
        padding: '16px 18px',
      }}
    >
      <p
        className="mb-3 font-display font-black uppercase text-neon-yellow"
        style={{ fontSize: '10px', letterSpacing: '0.28em' }}
      >
        O que este jogo causou
      </p>

      <ul className="flex flex-col gap-2.5">
        {rows.map(({ consequence: c, template: t }) => {
          const good = c.magnitude > 0;
          const Icon = good ? TrendingUp : TrendingDown;
          const color = good ? 'var(--color-success)' : 'var(--color-danger)';
          const who = c.playerId ? playerNames?.[c.playerId] : null;
          return (
            <li key={c.id} className="flex items-start gap-2.5">
              <Icon
                aria-hidden
                className="mt-0.5 h-3.5 w-3.5 flex-none"
                style={{ color }}
                strokeWidth={2.6}
              />
              <div className="min-w-0">
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                  {who ? <span style={{ color }}>{who}</span> : null}
                  {who ? ' · ' : null}
                  {t.label}
                </p>
                {/* "Por que isso aconteceu" — texto que já existia no catálogo. */}
                <p className="mt-0.5 text-white/50" style={{ fontFamily: 'var(--font-sans)', fontSize: '11.5px', lineHeight: 1.45 }}>
                  {t.description}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </motion.section>
  );
}
