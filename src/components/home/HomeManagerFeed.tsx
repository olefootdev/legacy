/**
 * HomeManagerFeed — Sprint C Fase B (Apr/2026).
 *
 * Mini-painel inteligente do manager com 3 cards contextuais:
 *  - DECISÃO DO DIA (sugestão de coach assistant baseada em estado)
 *  - MERCADO QUENTE (carta sugerida que combina com tática atual)
 *  - CARREIRA (progresso de tier + EXP até próximo nível)
 *
 * Heurísticas locais (sem IA pesada):
 *  - Decisão = olha plantel (fadiga, lesão, vazio) + jogador destaque
 *  - Mercado = OVR XI alvo ou plantel incompleto
 *  - Carreira = computeCareerTier + tierProgress01 (motivação intrínseca)
 *
 * (Próximo jogo foi removido em favor de Carreira — banner abaixo da Home
 * já mostra a próxima partida, evita duplicação.)
 *
 * Usa HubSectionCard pattern (rail lateral colorido + título + CTA).
 */

import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import type { PlayerEntity } from '@/entities/types';
import { overallFromAttributes } from '@/entities/player';
import { computeCareerTier, nextCareerTier, tierProgress01 } from '@/systems/careerTiers';
import { formatExp } from '@/systems/economy';

interface HomeManagerFeedProps {
  /** Plantel atual (state.players). */
  players: Record<string, PlayerEntity>;
  /** Jogador destaque já calculado pelo Home. */
  highlightId: string;
  highlightName: string;
  highlightPosition?: string;
  /** EXP acumulado vitalício (state.finance.expLifetimeEarned ?? state.finance.ole). */
  expLifetimeEarned: number;
}

type FeedCard = {
  rail: string;
  eyebrow: string;
  title: string;
  description: string;
  cta: { label: string; href: string };
};

function buildDecisionCard(
  players: Record<string, PlayerEntity>,
  highlightId: string,
  highlightName: string,
  highlightPosition: string | undefined,
): FeedCard {
  const squadSize = Object.keys(players).length;

  if (squadSize === 0) {
    return {
      rail: 'bg-rose-400',
      eyebrow: 'Antes de tudo',
      title: 'Monta o teu plantel',
      description:
        'O elenco está vazio. Recebe o welcome pack ou cria jogadores no painel do clube.',
      cta: { label: 'Ir ao Elenco', href: '/clube/elenco' },
    };
  }

  // Detecta jogadores com fadiga alta
  const fadigados = Object.values(players).filter((p) => (p.fatigue ?? 0) >= 70);
  if (fadigados.length >= 3) {
    return {
      rail: 'bg-emerald-400',
      eyebrow: 'Coach assistente',
      title: `${fadigados.length} jogadores fadigados`,
      description:
        'Sessão coletiva de recuperação física agora rende +30%. Programa antes da próxima rodada.',
      cta: { label: 'Programar Treino', href: '/clube/treino' },
    };
  }

  // Detecta jogadores em risco de lesão alto
  const arriscados = Object.values(players).filter((p) => (p.injuryRisk ?? 0) >= 70);
  if (arriscados.length >= 2) {
    return {
      rail: 'bg-amber-400',
      eyebrow: 'Atenção · Lesão',
      title: `${arriscados.length} em risco alto`,
      description:
        'Considera contratar profissional Médico ou rotacionar a escalação na próxima partida.',
      cta: { label: 'Gerir Staff', href: '/clube/staff' },
    };
  }

  // Default: sugestão de treino para o destaque
  return {
    rail: 'bg-neon-yellow',
    eyebrow: 'Decisão do dia',
    title: highlightName !== '—' ? `Treina ${highlightName.split(' ')[0]}` : 'Treino tático',
    description: highlightPosition
      ? `Em forma — sessão tática de ${highlightPosition} agora rende +25% nos atributos chave.`
      : 'Programa uma sessão tática para o teu jogador destaque ganhar evolução acelerada.',
    cta: { label: 'Programar Treino', href: '/clube/treino' },
  };
}

function buildMarketCard(players: Record<string, PlayerEntity>): FeedCard {
  const squadSize = Object.keys(players).length;
  const ovrXi = (() => {
    const ovrs = Object.values(players)
      .map((p) => overallFromAttributes(p.attrs))
      .sort((a, b) => b - a)
      .slice(0, 11);
    if (!ovrs.length) return 0;
    return Math.round(ovrs.reduce((s, o) => s + o, 0) / ovrs.length);
  })();

  if (squadSize < 11) {
    return {
      rail: 'bg-cyan-300',
      eyebrow: 'Mercado · Urgente',
      title: 'Plantel incompleto',
      description: `Te faltam ${11 - squadSize} jogadores pra fechar o XI titular. Confere o catálogo Genesis.`,
      cta: { label: 'Ver Mercado', href: '/mercado/transfer' },
    };
  }

  return {
    rail: 'bg-cyan-300',
    eyebrow: 'Mercado quente',
    title: `Reforço pra OVR ${ovrXi}`,
    description:
      'Cartas Genesis com OVR igual ou superior ao teu XI estão em leilão. Lance baixo, prazo curto.',
    cta: { label: 'Explorar', href: '/mercado/transfer' },
  };
}

function buildProgressCard(expLifetimeEarned: number): FeedCard {
  const tier = computeCareerTier(expLifetimeEarned);
  const next = nextCareerTier(tier.id);
  const progress01 = tierProgress01(expLifetimeEarned);
  const progressPct = Math.round(progress01 * 100);

  if (!next) {
    return {
      rail: 'bg-neon-yellow',
      eyebrow: 'Carreira',
      title: 'Lenda Viva',
      description: `Tier máximo atingido. ${formatExp(expLifetimeEarned)} EXP acumulado — entra para o panteão Olefoot.`,
      cta: { label: 'Ver Carreira', href: '/manager' },
    };
  }

  const expRemaining = Math.max(0, next.minExp - expLifetimeEarned);

  return {
    rail: 'bg-neon-yellow',
    eyebrow: `Tier ${tier.id} · ${tier.name}`,
    title: `${progressPct}% rumo a ${next.name}`,
    description: `Faltam ${formatExp(expRemaining)} EXP para subir de tier.`,
    cta: { label: 'Ver Carreira', href: '/manager' },
  };
}

export function HomeManagerFeed(props: HomeManagerFeedProps) {
  const decision = buildDecisionCard(
    props.players,
    props.highlightId,
    props.highlightName,
    props.highlightPosition,
  );
  const market = buildMarketCard(props.players);
  const progress = buildProgressCard(props.expLifetimeEarned);

  const cards: FeedCard[] = [decision, market, progress];

  return (
    <section
      aria-label="Painel inteligente do manager"
      className="grid grid-cols-1 sm:grid-cols-3 gap-4"
    >
      {cards.map((card, i) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08 }}
        >
          <Link
            to={card.cta.href}
            className="group relative isolate block h-full overflow-hidden border border-white/[0.05] transition-all duration-300 hover:border-white/15 hover:-translate-y-1"
            style={{
              borderRadius: 'var(--radius-card)',
              background: 'var(--color-panel-elevated)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <span aria-hidden className={`absolute left-0 top-0 h-full w-[3px] ${card.rail}`} />
            <div className="relative flex h-full flex-col gap-3 p-5 pl-6 sm:p-6 sm:pl-7">
              <span
                className="font-display text-[10px] font-bold uppercase tracking-[0.28em] text-neon-yellow/80"
                style={{ fontFamily: 'var(--font-ui)' }}
              >
                {card.eyebrow}
              </span>
              <h3
                className="font-display text-[20px] font-black uppercase leading-[0.98] tracking-tight text-white transition-colors group-hover:text-neon-yellow"
                style={{ letterSpacing: '0.005em' }}
              >
                {card.title}
              </h3>
              <p className="text-[12px] leading-relaxed text-white/55">{card.description}</p>
              <div className="mt-auto pt-2 border-t border-[var(--color-divider-yellow)]">
                <span
                  className="inline-flex items-center bg-neon-yellow px-5 py-2.5 font-display text-[10px] font-black uppercase tracking-[0.22em] text-black shadow-[0_4px_14px_rgba(253,225,0,0.18)] transition-all group-hover:bg-white group-hover:scale-[1.02]"
                  style={{
                    fontFamily: 'var(--font-display)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  {card.cta.label}
                </span>
              </div>
            </div>
          </Link>
        </motion.div>
      ))}
    </section>
  );
}
