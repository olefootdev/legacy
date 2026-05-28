/**
 * Rota de preview do MatchPlan condensado.
 *
 * Acessar /match/quick-plan-preview pra testar o pipeline Python end-to-end:
 *   1. Lê o squad do usuário
 *   2. Monta payload pra `fetchQuickPlan` (backend → Python)
 *   3. Renderiza o resultado no `QuickPlanPlayer` em ~25s
 *
 * Esta página é debug/preview — a integração no MatchQuick acontece em
 * uma sessão futura via flag VITE_QUICK_PLAN_ENABLED=1.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useGameStore } from '@/game/store';
import {
  fetchQuickPlan,
  playerToQuickPlanPayload,
  type QuickPlanPlayerPayload,
} from '@/match/quickPlanClient';
import { QuickPlanPlayer } from '@/match/QuickPlanPlayer';
import type { MatchPlan } from '@/match/quickPlanTypes';
import { buildFatigueByIdMap, getEffectiveFatigue } from '@/systems/fatigue';
import { mergeLineupWithDefaults } from '@/entities/lineup';
import { roleFromPos } from '@/engine/pitchFromLineup';

export default function QuickPlanPreview() {
  const players = useGameStore((s) => s.players);
  const playerHealth = useGameStore((s) => s.playerHealth);
  const lineup = useGameStore((s) => s.lineup);
  const club = useGameStore((s) => s.club);
  const nextFixture = useGameStore((s) => s.nextFixture);

  const [plan, setPlan] = useState<MatchPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSim = async () => {
    setLoading(true);
    setError(null);
    setPlan(null);
    try {
      const fatigueById = buildFatigueByIdMap(players, playerHealth);
      const lu = mergeLineupWithDefaults(lineup, players, { fatigueById });
      const homeLineup: QuickPlanPlayerPayload[] = [];
      for (const pid of Object.values(lu)) {
        const p = players[pid];
        if (!p) continue;
        const fat = getEffectiveFatigue(pid, p, playerHealth);
        homeLineup.push(playerToQuickPlanPayload(p, fat, roleFromPos(p.pos)));
      }
      // Lineup adversário sintético baseado no opponentStrength
      const oppStrength = nextFixture?.opponent?.strength ?? 70;
      const awayLineup: QuickPlanPlayerPayload[] = Array.from({ length: 11 }).map((_, i) => ({
        id: `away-${i}`,
        name: `Adversário ${i + 1}`,
        pos: 'MC',
        role: (i < 1 ? 'gk' : i < 5 ? 'def' : i < 9 ? 'mid' : 'attack') as
          | 'gk' | 'def' | 'mid' | 'attack',
        finalizacao: oppStrength - 5 + (i % 3),
        passe: oppStrength + (i % 3),
        marcacao: oppStrength + (i % 4),
        velocidade: oppStrength - 2 + (i % 3),
        fisico: oppStrength + (i % 5),
        confianca: oppStrength,
        fatigue: 0,
      }));

      const seed = `${club.shortName}-${nextFixture?.opponent?.shortName ?? 'TST'}-${Date.now()}`;
      const result = await fetchQuickPlan({
        seed,
        homeShort: club.shortName,
        awayShort: nextFixture?.opponent?.shortName ?? 'OPP',
        homeStrength: 75,
        awayStrength: oppStrength,
        intensity: 'balanced',
        homeLineup,
        awayLineup,
      });
      if (!result) {
        setError('Backend retornou null. Verifique se o servidor Hono está rodando + python3 disponível.');
        return;
      }
      setPlan(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Não roda automaticamente — usuário clica no botão. Evita request no mount.
  }, []);

  return (
    <main className="min-h-screen bg-black px-4 py-8 sm:px-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1
            className="font-display uppercase tracking-[0.18em] text-white text-lg font-black"
          >
            Quick Plan · Preview
          </h1>
          <Link
            to="/"
            className="text-[11px] font-display uppercase tracking-[0.2em] text-white/50 hover:text-white"
          >
            ← Home
          </Link>
        </div>

        <p className="text-[12px] text-white/60 mb-5 leading-relaxed">
          Pré-computa uma Partida Rápida via Python (smartfield/match_simulator.py) e renderiza condensado em ~25s.
          O backend precisa estar rodando ({String(import.meta.env.VITE_OLEFOOT_API_URL ?? 'localhost:4000')}) e ter python3 no PATH.
        </p>

        <button
          type="button"
          onClick={runSim}
          disabled={loading}
          className="mb-6 px-5 py-2.5 bg-amber-400 hover:bg-white text-black font-display uppercase tracking-[0.18em] text-[11px] font-black transition-colors disabled:opacity-50"
        >
          {loading ? 'Simulando...' : plan ? 'Simular outra' : 'Gerar Match Plan'}
        </button>

        {error && (
          <div className="mb-6 border border-rose-500/40 border-l-[3px] border-l-rose-400 bg-rose-500/10 px-4 py-3">
            <p className="text-[10px] text-rose-300 font-display uppercase tracking-[0.2em] font-black mb-1">
              Erro
            </p>
            <p className="text-[12px] text-white/80">{error}</p>
          </div>
        )}

        {plan && (
          <>
            <div className="mb-3 text-[11px] text-white/50 tabular-nums">
              Gerado em {plan.duration_ms}ms · {plan.events.length} eventos · arco {plan.narrative_arc}
            </div>
            <QuickPlanPlayer plan={plan} />
          </>
        )}
      </div>
    </main>
  );
}
