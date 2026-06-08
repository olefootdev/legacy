/**
 * Painel de predição V/E/D — UI de Fase 1 PR-B.
 *
 * Consome `MonteCarloResult` (de `simulateMatchN`) e renderiza:
 *   - Barra V/E/D segmentada com animação
 *   - xG por time
 *   - Top 3 placares prováveis
 *   - "Possível herói" (top scorer mandante)
 *   - Drama Index (% jogos fechados) com label semântica
 *   - Callout de ZEBRA quando aplicável
 *
 * 100% design tokens, sem hex hardcode.
 */

import { motion } from 'motion/react';
import { Sparkles, TrendingUp, Activity, Zap, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MonteCarloResult } from '@/match/matchMonteCarlo';

interface Props {
  result: MonteCarloResult;
  /** Nome curto pra mostrar no resultado (default "Casa" / "Visitante"). */
  homeName?: string;
  awayName?: string;
  /** Modo compacto pra cards pequenos. */
  compact?: boolean;
}

function pctLabel(p: number): string {
  return `${Math.round(p * 100)}%`;
}

function dramaLabel(idx: number): { label: string; tone: 'success' | 'warning' | 'neutral' } {
  if (idx >= 0.8) return { label: 'Equilíbrio extremo', tone: 'success' };
  if (idx >= 0.65) return { label: 'Jogo aberto', tone: 'success' };
  if (idx >= 0.45) return { label: 'Equilibrado', tone: 'neutral' };
  return { label: 'Favorito claro', tone: 'warning' };
}

export function MatchPredictionPanel({
  result,
  homeName = 'Casa',
  awayName = 'Visitante',
  compact = false,
}: Props) {
  const { winHome, draw, winAway, xgHome, xgAway, scoreDist, topHomeScorers, dramaIndex, zebra, zebraSide } = result;
  const drama = dramaLabel(dramaIndex);

  // Segmentos da barra — % em pixels relativos. Garante mínimo de 4% visualmente.
  const minVisible = 0.04;
  const segH = Math.max(minVisible, winHome);
  const segD = Math.max(minVisible, draw);
  const segA = Math.max(minVisible, winAway);
  const segTotal = segH + segD + segA;

  return (
    <section
      className="border border-white/10 bg-black/30 p-4"
      style={{ borderRadius: 'var(--radius-md)' }}
    >
      {/* Header */}
      <div className="mb-3 flex items-center gap-2.5">
        <span aria-hidden className="shrink-0 w-[3px] h-5 bg-neon-yellow" />
        <h3
          className="text-neon-yellow uppercase"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.18em',
          }}
        >
          Leitura da Partida
        </h3>
        <span
          className="ml-auto text-white/40"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.18em',
          }}
        >
          {result.samples.toLocaleString('pt-BR')} sims
        </span>
      </div>

      {/* Probabilidade V/E/D — barra segmentada animada */}
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p
              className="text-[var(--color-success)]"
              style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 800 }}
            >
              {pctLabel(winHome)}
            </p>
            <p
              className="uppercase text-white/55"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '9px',
                fontWeight: 700,
                letterSpacing: '0.22em',
              }}
            >
              Vitória {homeName}
            </p>
          </div>
          <div>
            <p
              className="text-white"
              style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 800 }}
            >
              {pctLabel(draw)}
            </p>
            <p
              className="uppercase text-white/55"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '9px',
                fontWeight: 700,
                letterSpacing: '0.22em',
              }}
            >
              Empate
            </p>
          </div>
          <div>
            <p
              className="text-[var(--color-danger)]"
              style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 800 }}
            >
              {pctLabel(winAway)}
            </p>
            <p
              className="uppercase text-white/55"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '9px',
                fontWeight: 700,
                letterSpacing: '0.22em',
              }}
            >
              Vitória {awayName}
            </p>
          </div>
        </div>

        <div
          className="relative flex h-2.5 w-full overflow-hidden bg-white/8"
          style={{ borderRadius: 'var(--radius-sm)' }}
        >
          <motion.div
            className="h-full bg-[var(--color-success)]"
            initial={{ width: 0 }}
            animate={{ width: `${(segH / segTotal) * 100}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
          <motion.div
            className="h-full bg-white/40"
            initial={{ width: 0 }}
            animate={{ width: `${(segD / segTotal) * 100}%` }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
          />
          <motion.div
            className="h-full bg-[var(--color-danger)]"
            initial={{ width: 0 }}
            animate={{ width: `${(segA / segTotal) * 100}%` }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
          />
        </div>
      </div>

      {/* Callout ZEBRA — surge só quando aplicável */}
      {zebra ? (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 flex items-center gap-2 border border-[var(--color-neon-yellow)]/40 bg-[var(--color-neon-yellow)]/8 px-3 py-2"
          style={{ borderRadius: 'var(--radius-sm)' }}
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--color-neon-yellow)]" aria-hidden />
          <span
            className="uppercase text-[var(--color-neon-yellow)]"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '10px',
              fontWeight: 800,
              letterSpacing: '0.22em',
            }}
          >
            Zebra possível
          </span>
          <span
            className="text-white/70"
            style={{ fontFamily: 'var(--font-ui)', fontSize: '11px' }}
          >
            {zebraSide === 'home' ? homeName : awayName} pode surpreender
          </span>
        </motion.div>
      ) : null}

      {/* Bloco compacto encerra aqui — modo lista de cards */}
      {compact ? null : (
        <>
          {/* xG + Drama row */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div
              className="border border-white/10 bg-white/[0.02] p-3"
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              <div className="mb-1.5 flex items-center gap-1.5">
                <Target className="h-3 w-3 shrink-0 text-white/70" aria-hidden />
                <span
                  className="uppercase text-white/55"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '9px',
                    fontWeight: 700,
                    letterSpacing: '0.22em',
                  }}
                >
                  Gols esperados
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <p
                    className="text-[var(--color-success)] tabular-nums"
                    style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 800 }}
                  >
                    {xgHome.toFixed(2)}
                  </p>
                  <p
                    className="uppercase text-white/45"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '8px',
                      fontWeight: 700,
                      letterSpacing: '0.18em',
                    }}
                  >
                    {homeName}
                  </p>
                </div>
                <span className="text-white/30">×</span>
                <div className="text-right">
                  <p
                    className="text-[var(--color-danger)] tabular-nums"
                    style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 800 }}
                  >
                    {xgAway.toFixed(2)}
                  </p>
                  <p
                    className="uppercase text-white/45"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '8px',
                      fontWeight: 700,
                      letterSpacing: '0.18em',
                    }}
                  >
                    {awayName}
                  </p>
                </div>
              </div>
            </div>

            <div
              className={cn(
                'border p-3',
                drama.tone === 'success' && 'border-[var(--color-success)]/30 bg-[var(--color-success)]/8',
                drama.tone === 'warning' && 'border-[var(--color-warning)]/30 bg-[var(--color-warning)]/8',
                drama.tone === 'neutral' && 'border-white/10 bg-white/[0.02]',
              )}
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              <div className="mb-1.5 flex items-center gap-1.5">
                <Activity className="h-3 w-3 shrink-0 text-white/70" aria-hidden />
                <span
                  className="uppercase text-white/55"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '9px',
                    fontWeight: 700,
                    letterSpacing: '0.22em',
                  }}
                >
                  Drama
                </span>
              </div>
              <p
                className={cn(
                  drama.tone === 'success' && 'text-[var(--color-success)]',
                  drama.tone === 'warning' && 'text-[var(--color-warning)]',
                  drama.tone === 'neutral' && 'text-white',
                )}
                style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 800 }}
              >
                {pctLabel(dramaIndex)}
              </p>
              <p
                className="uppercase text-white/55"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '9px',
                  fontWeight: 700,
                  letterSpacing: '0.18em',
                }}
              >
                {drama.label}
              </p>
            </div>
          </div>

          {/* Top placares + herói */}
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div
              className="border border-white/10 bg-white/[0.02] p-3"
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              <div className="mb-2 flex items-center gap-1.5">
                <TrendingUp className="h-3 w-3 shrink-0 text-white/70" aria-hidden />
                <span
                  className="uppercase text-white/55"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '9px',
                    fontWeight: 700,
                    letterSpacing: '0.22em',
                  }}
                >
                  Placares prováveis
                </span>
              </div>
              <ul className="space-y-1">
                {scoreDist.slice(0, 3).map((s, i) => (
                  <li
                    key={s.score}
                    className="flex items-baseline justify-between gap-2"
                  >
                    <span
                      className={cn(
                        'tabular-nums',
                        i === 0 ? 'text-white' : 'text-white/65',
                      )}
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: i === 0 ? '14px' : '12px',
                        fontWeight: i === 0 ? 800 : 700,
                      }}
                    >
                      {s.score}
                    </span>
                    <span
                      className="tabular-nums text-white/55"
                      style={{ fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 700 }}
                    >
                      {pctLabel(s.prob)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div
              className="border border-white/10 bg-white/[0.02] p-3"
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              <div className="mb-2 flex items-center gap-1.5">
                <Zap className="h-3 w-3 shrink-0 text-white/70" aria-hidden />
                <span
                  className="uppercase text-white/55"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '9px',
                    fontWeight: 700,
                    letterSpacing: '0.22em',
                  }}
                >
                  Possível herói
                </span>
              </div>
              {topHomeScorers.length > 0 ? (
                <ul className="space-y-1">
                  {topHomeScorers.slice(0, 3).map((s, i) => (
                    <li
                      key={s.playerId}
                      className="flex items-baseline justify-between gap-2"
                    >
                      <span
                        className={cn(
                          'truncate uppercase',
                          i === 0 ? 'text-neon-yellow' : 'text-white/65',
                        )}
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: i === 0 ? '12px' : '11px',
                          fontWeight: 800,
                          letterSpacing: '0.08em',
                        }}
                      >
                        {s.playerName}
                      </span>
                      <span
                        className="shrink-0 tabular-nums text-white/55"
                        style={{ fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 700 }}
                      >
                        {s.goalsPerMatch.toFixed(2)}/p
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-white/45" style={{ fontFamily: 'var(--font-ui)', fontSize: '11px' }}>
                  Sem dados de elenco.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
