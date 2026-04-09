import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Home, LogOut, Trophy, RotateCcw } from 'lucide-react';
import { getGameState, useGameDispatch, useGameStore } from '@/game/store';
import { mergeLineupWithDefaults } from '@/entities/lineup';
import { overallFromAttributes } from '@/entities/player';
import { MatchdayResultScores } from '@/components/matchday/MatchdayVersusTitle';

type UiPhase = 'analyzing' | 'result';

interface MatchSummary {
  homeShort: string;
  awayShort: string;
  homeName?: string;
  awayName?: string;
  homeScore: number;
  awayScore: number;
  events: { id: string; text: string }[];
  homeStats: Record<string, { passesOk: number; passesAttempt: number; tackles: number; km: number; rating: number }>;
}

/**
 * Partida automática: sem estádio; mesmo motor (`advanceMatchToPostgame` via START_LIVE_MATCH auto).
 * Finaliza na hora para persistir liga / elenco (lesões, cartões).
 */
export function MatchAuto() {
  const navigate = useNavigate();
  const dispatch = useGameDispatch();
  const fixture = useGameStore((s) => s.nextFixture);
  const playersById = useGameStore((s) => s.players);
  const lineupIds = useGameStore((s) => s.lineup);

  const [phase, setPhase] = useState<UiPhase>('analyzing');
  const [summary, setSummary] = useState<MatchSummary | null>(null);
  const [forfeitOpen, setForfeitOpen] = useState(false);

  const analysisTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runAnalysis = useCallback(() => {
    setPhase('analyzing');
    setSummary(null);
    if (analysisTimeoutRef.current) {
      clearTimeout(analysisTimeoutRef.current);
      analysisTimeoutRef.current = null;
    }
    analysisTimeoutRef.current = window.setTimeout(() => {
      analysisTimeoutRef.current = null;
      dispatch({ type: 'START_LIVE_MATCH', mode: 'auto' });
      const lm = getGameState().liveMatch;
      if (lm) {
        setSummary({
          homeShort: lm.homeShort,
          awayShort: lm.awayShort,
          homeName: lm.homeName,
          awayName: lm.awayName,
          homeScore: lm.homeScore,
          awayScore: lm.awayScore,
          events: lm.events.map((e) => ({ id: e.id, text: e.text })),
          homeStats: { ...lm.homeStats },
        });
      }
      dispatch({ type: 'FINALIZE_MATCH' });
      setPhase('result');
    }, 5000);
  }, [dispatch]);

  useEffect(() => {
    return () => {
      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current);
        analysisTimeoutRef.current = null;
      }
    };
  }, []);

  const confirmForfeitAuto = () => {
    if (analysisTimeoutRef.current) {
      clearTimeout(analysisTimeoutRef.current);
      analysisTimeoutRef.current = null;
    }
    dispatch({ type: 'FORFEIT_MATCH', mode: 'auto' });
    const lm = getGameState().liveMatch;
    if (lm) {
      setSummary({
        homeShort: lm.homeShort,
        awayShort: lm.awayShort,
        homeName: lm.homeName,
        awayName: lm.awayName,
        homeScore: lm.homeScore,
        awayScore: lm.awayScore,
        events: lm.events.map((e) => ({ id: e.id, text: e.text })),
        homeStats: { ...lm.homeStats },
      });
    }
    dispatch({ type: 'FINALIZE_MATCH' });
    setForfeitOpen(false);
    setPhase('result');
  };

  const bootRef = useRef(false);
  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    runAnalysis();
  }, [runAnalysis]);

  const lineupIdsResolved = mergeLineupWithDefaults(lineupIds, playersById);
  const starters = Object.entries(lineupIdsResolved)
    .map(([slot, id]) => {
      const p = playersById[id];
      return p ? { slot, p, ovr: overallFromAttributes(p.attrs) } : null;
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .sort((a, b) => b.ovr - a.ovr);

  const topStats = summary?.homeStats ?? {};

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-6 px-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Link
          to="/"
          className="text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-neon-yellow transition-colors"
        >
          ← Home
        </Link>
        <span className="text-[10px] font-display font-bold uppercase tracking-widest text-gray-600">
          Partida automática
        </span>
        {phase === 'analyzing' && (
          <button
            type="button"
            onClick={() => setForfeitOpen(true)}
            className="text-[10px] font-display font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-colors inline-flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair do jogo
          </button>
        )}
      </div>

      <AnimatePresence>
        {forfeitOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="forfeit-auto-title"
            onClick={() => setForfeitOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 8 }}
              className="glass-panel w-full max-w-md p-6 border border-red-500/40 shadow-[0_0_40px_rgba(239,68,68,0.12)]"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="forfeit-auto-title" className="font-display font-black text-xl text-white text-center uppercase tracking-wide">
                Sair do jogo?
              </h2>
              <p className="text-sm text-gray-400 text-center mt-4 leading-relaxed">
                Você perde por <span className="text-red-400 font-display font-black text-lg">5×0</span>. O resultado
                entra na liga e no histórico.
              </p>
              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="button"
                  className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-display font-black uppercase tracking-wider text-sm transition-colors"
                  onClick={confirmForfeitAuto}
                >
                  Confirmar desistência
                </button>
                <button
                  type="button"
                  className="w-full py-3 rounded-xl border border-white/20 text-gray-300 font-bold text-sm hover:bg-white/5 transition-colors"
                  onClick={() => setForfeitOpen(false)}
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {phase === 'analyzing' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-panel p-10 flex flex-col items-center justify-center gap-4 border border-neon-yellow/20"
        >
          <Loader2 className="w-10 h-10 text-neon-yellow animate-spin" />
          <p className="text-white font-display font-bold text-lg uppercase tracking-wide text-center">
            Analisando elenco e adversário…
          </p>
          <p className="text-xs text-gray-500 text-center max-w-sm">
            Casa vs fora, minuto a minuto no motor GameSpirit (sem visual de estádio).
          </p>
        </motion.div>
      )}

      {phase === 'result' && summary && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="glass-panel p-6 border border-white/10 text-center">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">Resultado</p>
            <MatchdayResultScores
              homeShort={summary.homeShort}
              awayShort={summary.awayShort}
              homeName={summary.homeName}
              awayName={summary.awayName}
              homeScore={summary.homeScore}
              awayScore={summary.awayScore}
              awaySeed={fixture.opponent.id}
              className="text-3xl sm:text-4xl"
            />
            <p className="text-xs text-gray-500 mt-2">
              vs {fixture.opponent.name} • Liga e elenco já atualizados
            </p>
          </div>

          <div className="glass-panel p-5 border border-white/10">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Titulares (OVR)</h3>
            <div className="flex flex-wrap gap-2">
              {starters.slice(0, 11).map(({ slot, p, ovr }) => (
                <span
                  key={slot}
                  className="text-[10px] font-bold px-2 py-1 rounded bg-white/5 border border-white/10 text-gray-300"
                >
                  {p.num} {p.name} <span className="text-neon-yellow">{ovr}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="glass-panel p-5 border border-white/10">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Destaques (stats)</h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {Object.entries(topStats)
                .sort((a, b) => (b[1]?.rating ?? 0) - (a[1]?.rating ?? 0))
                .slice(0, 8)
                .map(([id, st]) => {
                  const name = playersById[id]?.name ?? id;
                  return (
                    <div key={id} className="flex justify-between text-xs text-gray-300">
                      <span>{name}</span>
                      <span className="text-neon-yellow">
                        Nota {(st.rating ?? 6.4).toFixed(1)} • {st.passesOk}/{st.passesAttempt} pas • {st.tackles} des
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="glass-panel p-5 border border-white/10">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Eventos</h3>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {summary.events.slice(0, 18).map((e) => (
                <p key={e.id} className="text-[11px] text-gray-400 leading-snug">
                  {e.text}
                </p>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button type="button" className="btn-primary flex-1 flex justify-center" onClick={() => runAnalysis()}>
              <span className="btn-primary-inner flex items-center gap-2">
                <RotateCcw className="w-4 h-4" /> Jogar novamente
              </span>
            </button>
            <button
              type="button"
              className="flex-1 py-3 rounded-xl border border-white/20 font-bold text-sm hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
              onClick={() => navigate('/leagues')}
            >
              <Trophy className="w-4 h-4 text-neon-yellow" /> Ir para Liga
            </button>
            <button
              type="button"
              className="flex-1 py-3 rounded-xl border border-white/20 font-bold text-sm hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
              onClick={() => navigate('/')}
            >
              <Home className="w-4 h-4" /> Home
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
