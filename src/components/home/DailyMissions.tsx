/**
 * DailyMissions — os desafios diários do manager, na Home.
 *
 * POR QUE ELE EXISTE: os desafios já eram REAIS antes desta tela. A Home
 * inclusive já os reseta todo dia (`shouldResetDailyChallenges` em Home.tsx), o
 * reducer já credita EXP e Renome no `CLAIM_CHALLENGE_REWARD`, e a partida já
 * empurra progresso pelo `UPDATE_CHALLENGE_PROGRESS`. Faltava só o manager
 * conseguir VER — ele cumpria a missão e nunca ficava sabendo. Este componente
 * não inventa mecânica nenhuma: só abre a janela pro que já acontecia.
 *
 * Fica no par com o ReferralInvite no fim da Home (grid de 2 colunas no
 * desktop, empilhado no mobile), como no layer final.
 *
 * Ícone e cor por tipo de desafio vêm do DailyChallengesCard, que já os exporta
 * — o mesmo desafio tem a mesma cara aqui e na tela de partida.
 */
import { ChevronRight, Gift } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { DailyChallenge } from '@/game/dailyChallenges';
import { CHALLENGE_ICONS, CHALLENGE_COLORS } from '@/components/match/DailyChallengesCard';
import { formatExp } from '@/systems/economy';

export function DailyMissions({
  challenges,
  streak,
  onClaim,
}: {
  challenges: DailyChallenge[];
  streak?: number;
  onClaim: (challengeId: string) => void;
}) {
  // Sem desafio do dia não há o que mostrar — a seção some em vez de deixar
  // uma casca vazia na Home.
  if (challenges.length === 0) return null;

  const concluidos = challenges.filter((c) => c.completed).length;
  const pct = Math.round((concluidos / challenges.length) * 100);

  return (
    <section aria-label="Missões diárias" className="flex flex-col gap-2">
      <span className="ole-eyebrow-poster" style={{ fontSize: '12px' }}>
        Todo dia conta
      </span>

      <div className="ole-poster p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-impact uppercase text-white" style={{ fontSize: '15px' }}>
            Missões do dia
          </h3>
          {streak != null && streak > 1 && (
            <span
              className="font-display font-black uppercase"
              style={{ fontSize: '10px', letterSpacing: '0.12em', color: 'var(--color-neon-yellow)' }}
            >
              {streak} dias seguidos
            </span>
          )}
        </div>

        <ul className="mt-1">
          {challenges.map((c) => {
            const Icon = CHALLENGE_ICONS[c.type];
            const cor = CHALLENGE_COLORS[c.type];
            const podeResgatar = c.completed && !c.claimed;

            return (
              <li
                key={c.id}
                className="grid items-center gap-3 py-2.5"
                style={{
                  gridTemplateColumns: 'auto 1fr auto',
                  borderBottom: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <Icon
                  className="h-5 w-5 flex-none"
                  strokeWidth={2}
                  // Concluído vira verde: a cor conta o estado, não decora.
                  style={{ color: c.completed ? 'var(--color-success)' : cor }}
                  aria-hidden
                />

                <div className="min-w-0">
                  <p
                    className="truncate text-white/85"
                    style={{ fontFamily: 'var(--font-sans)', fontSize: '13px' }}
                  >
                    {c.title}
                  </p>
                  <p
                    className="truncate text-white/45"
                    style={{ fontFamily: 'var(--font-sans)', fontSize: '11px' }}
                  >
                    {c.description}
                  </p>
                </div>

                {podeResgatar ? (
                  <button
                    type="button"
                    onClick={() => onClaim(c.id)}
                    className="inline-flex flex-none items-center gap-1.5 rounded-md px-3 py-2 font-display font-black uppercase"
                    style={{
                      background: 'var(--color-neon-yellow)',
                      color: 'var(--color-deep-black)',
                      fontSize: '10px',
                      letterSpacing: '0.1em',
                      minHeight: 38,
                    }}
                  >
                    <Gift className="h-3.5 w-3.5" aria-hidden />
                    {formatExp(c.reward)} EXP
                  </button>
                ) : (
                  <div className="flex-none text-right">
                    <span
                      className="font-impact tabular-nums"
                      style={{
                        fontSize: '14px',
                        color: c.claimed ? 'var(--color-success)' : 'rgba(237,235,228,0.5)',
                      }}
                    >
                      {c.claimed ? 'Resgatado' : `${Math.min(c.progress, c.target)}/${c.target}`}
                    </span>
                    {!c.claimed && (
                      <span
                        className="block font-display font-bold uppercase"
                        style={{ fontSize: '9px', letterSpacing: '0.06em', color: 'var(--color-neon-yellow)' }}
                      >
                        +{formatExp(c.reward)} EXP
                      </span>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {/* Progresso do dia — quanto do conjunto já caiu. */}
        <div
          className="mt-4 overflow-hidden"
          style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.1)' }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progresso das missões do dia"
        >
          <i
            className="block h-full"
            style={{ width: `${pct}%`, background: 'var(--color-neon-yellow)', borderRadius: 999 }}
          />
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-3">
          <span className="text-white/55" style={{ fontFamily: 'var(--font-sans)', fontSize: '11px' }}>
            {concluidos} de {challenges.length} concluídas hoje
          </span>
          <Link
            to="/manager/missoes"
            className="inline-flex items-center gap-1 font-display font-black uppercase transition-colors hover:text-white"
            style={{ fontSize: '10px', letterSpacing: '0.12em', color: 'var(--color-neon-yellow)' }}
          >
            Todas as missões
            <ChevronRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
