import { motion, AnimatePresence } from 'motion/react';
import { Search, UserPlus, X, Zap, Trophy, Shield, Star, Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useGameStore } from '@/game/store';
import { quickFindOpponent, type OpponentMatch, opponentMatchToStub } from '@/match/friendlyMatchmaking';
import { overallFromAttributes } from '@/entities/player';
import { formatExp } from '@/systems/economy';

type FriendlyMode = 'quick' | 'penalty';
type BetCurrency = 'BRO' | 'EXP';
type MatchType = 'competitive' | 'friendly';

interface QuickSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuickSearchModal({ isOpen, onClose }: QuickSearchModalProps) {
  const navigate = useNavigate();
  const club = useGameStore((s) => s.club);
  const players = useGameStore((s) => s.players);
  const finance = useGameStore((s) => s.finance);

  const [mode, setMode] = useState<FriendlyMode>('quick');
  const [matchType, setMatchType] = useState<MatchType>('friendly');
  const [betCurrency, setBetCurrency] = useState<BetCurrency>('BRO');
  const [betInput, setBetInput] = useState('10');
  const [searching, setSearching] = useState(false);
  const [opponent, setOpponent] = useState<OpponentMatch | null>(null);

  // Calcular OVR médio do time
  const myOverall = Math.round(
    Object.values(players).reduce((sum, p) => sum + overallFromAttributes(p.attrs), 0) /
      Math.max(1, Object.keys(players).length),
  );

  const handleSearch = async () => {
    setSearching(true);
    setOpponent(null);

    // Simular delay de busca (UX)
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Busca sessão para passar userId ao matchmaking
    const { getSupabase } = await import('@/supabase/client');
    const sb = getSupabase();
    const userId = sb ? (await sb.auth.getSession()).data.session?.user?.id : undefined;

    const result = await quickFindOpponent(club.id, myOverall, userId);
    setOpponent(result);
    setSearching(false);
  };

  const handleConfirm = () => {
    if (!opponent) return;

    const path = mode === 'penalty' ? '/match/penalty' : '/match/quick';
    // Passa SEMPRE um stub no navigate state (manager, online ou bot). Isso
    // garante que MatchQuick nunca caia no DEFAULT_OPPONENT placeholder.
    const stub = opponentMatchToStub(opponent, myOverall);
    navigate(path, { state: { pvpOpponentStub: stub } });
    onClose();
  };

  const betBroCents = Math.max(1, Math.round(parseFloat(betInput.replace(',', '.')) * 100));
  const betExp = Math.max(1, Math.round(parseFloat(betInput.replace(',', '.'))));

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto overscroll-y-contain bg-black/88 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] backdrop-blur-sm sm:items-center sm:p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            className="relative my-auto flex max-h-[min(90dvh,calc(100dvh-6rem))] w-full max-w-lg flex-col overflow-hidden border-neon-yellow/40 sports-panel p-0 sm:max-h-[min(92dvh,720px)]"
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 z-10 rounded-full bg-black/60 p-2 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="shrink-0 border-b border-white/10 bg-neon-yellow/5 p-6">
              <h3 className="text-xl font-display font-black uppercase tracking-wider text-white">
                Buscar Partida
              </h3>
              <p className="mt-2 text-sm leading-snug text-gray-300">
                Sistema encontra adversário automaticamente
              </p>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain p-6">
              {/* Tipo de partida: Competitivo / Amistoso */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block mb-2">
                  Tipo de partida
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMatchType('competitive')}
                    className={cn(
                      'py-3 rounded text-xs font-display font-bold uppercase border transition-all',
                      matchType === 'competitive'
                        ? 'bg-neon-yellow text-black border-neon-yellow shadow-[0_0_12px_rgba(253,224,71,0.3)]'
                        : 'border-white/15 text-gray-400 hover:border-white/30',
                    )}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <Star className="w-4 h-4" />
                      <span>Competitivo</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMatchType('friendly')}
                    className={cn(
                      'py-3 rounded text-xs font-display font-bold uppercase border transition-all',
                      matchType === 'friendly'
                        ? 'bg-neon-yellow text-black border-neon-yellow shadow-[0_0_12px_rgba(253,224,71,0.3)]'
                        : 'border-white/15 text-gray-400 hover:border-white/30',
                    )}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>Amistoso</span>
                    </div>
                  </button>
                </div>
                {matchType === 'competitive' && (
                  <p className="mt-2 text-[10px] text-neon-yellow/80 leading-snug">
                    ⭐ Partida competitiva conta pontos para o ranking quando jogada contra time humano
                  </p>
                )}
              </div>

              {/* Modo de partida */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block mb-2">
                  Modo de partida
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('quick')}
                    className={cn(
                      'py-2.5 rounded text-xs font-display font-bold uppercase border',
                      mode === 'quick'
                        ? 'bg-neon-yellow text-black border-neon-yellow'
                        : 'border-white/15 text-gray-400 hover:border-white/30',
                    )}
                  >
                    Partida Rápida
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('penalty')}
                    className={cn(
                      'py-2.5 rounded text-xs font-display font-bold uppercase border',
                      mode === 'penalty'
                        ? 'bg-neon-yellow text-black border-neon-yellow'
                        : 'border-white/15 text-gray-400 hover:border-white/30',
                    )}
                  >
                    Disputa Pênaltis
                  </button>
                </div>
              </div>

              {/* Aposta */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                    Prêmio (vencedor leva)
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setBetCurrency('BRO')}
                      className={cn(
                        'px-2 py-1 rounded text-[10px] font-bold uppercase',
                        betCurrency === 'BRO' ? 'bg-white text-black' : 'bg-white/5 text-gray-500',
                      )}
                    >
                      BRO
                    </button>
                    <button
                      type="button"
                      onClick={() => setBetCurrency('EXP')}
                      className={cn(
                        'px-2 py-1 rounded text-[10px] font-bold uppercase',
                        betCurrency === 'EXP' ? 'bg-neon-yellow text-black' : 'bg-white/5 text-gray-500',
                      )}
                    >
                      EXP
                    </button>
                  </div>
                </div>
                <input
                  value={betInput}
                  onChange={(e) => setBetInput(e.target.value)}
                  placeholder={betCurrency === 'BRO' ? 'Ex.: 10,50' : 'Ex.: 500'}
                  className="w-full bg-black/40 border border-white/15 rounded px-3 py-2 text-sm"
                />
                <p className="text-[10px] text-gray-600 mt-2">
                  Saldo: {betCurrency === 'BRO' ? `${(finance.broCents / 100).toFixed(2)} BRO` : `${formatExp(finance.ole)} EXP`}
                </p>
              </div>

              {/* Botão de busca */}
              {!opponent && (
                <button
                  type="button"
                  onClick={handleSearch}
                  disabled={searching}
                  className="w-full btn-primary py-3 disabled:opacity-50"
                >
                  <span className="btn-primary-inner flex items-center justify-center gap-2">
                    <Search className="w-4 h-4" />
                    {searching ? 'Procurando adversário...' : 'BUSCAR ADVERSÁRIO'}
                  </span>
                </button>
              )}

              {/* Card do adversário encontrado */}
              {opponent && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border border-neon-yellow/40 rounded bg-black/40 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-display font-bold uppercase tracking-wider text-neon-yellow">
                      Adversário encontrado
                    </h4>
                    {opponent.type === 'bot' ? (
                      <span className="px-2 py-1 rounded text-[9px] font-bold uppercase bg-gray-700 text-gray-300">
                        BOT
                      </span>
                    ) : opponent.type === 'real_manager' ? (
                      <span className="px-2 py-1 rounded text-[9px] font-bold uppercase bg-neon-yellow/20 text-neon-yellow">
                        MANAGER REAL
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded text-[9px] font-bold uppercase bg-emerald-500/20 text-emerald-300">
                        ONLINE
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full border-2 border-neon-yellow/40 bg-deep-black grid place-items-center shrink-0">
                      <Shield className="w-8 h-8 text-neon-yellow/70" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="text-lg font-display font-black text-white truncate">
                        {opponent.type === 'bot'
                          ? opponent.bot.name
                          : opponent.type === 'real_manager'
                            ? opponent.stub.name
                            : '—'}
                      </h5>
                      <p className="text-xs text-gray-400">
                        {opponent.type === 'bot'
                          ? `OVR ${opponent.bot.avgOverall} · ${opponent.bot.country}`
                          : opponent.type === 'real_manager'
                            ? `OVR ${opponent.stub.strength} · Manager`
                            : '—'}
                      </p>
                      {opponent.type === 'bot' && (
                        <p className="text-[10px] text-gray-500 mt-1">
                          {opponent.bot.formation} · {opponent.bot.style}
                        </p>
                      )}
                      {opponent.type === 'real_manager' && (
                        <p className="text-[10px] text-neon-yellow/60 mt-1">
                          Plantel real · EXP conta para o ranking
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-white/10 pt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-gray-500">Tipo</span>
                      <span className={cn(
                        "text-xs font-display font-bold uppercase px-2 py-0.5 rounded",
                        matchType === 'competitive'
                          ? 'bg-neon-yellow/20 text-neon-yellow'
                          : 'bg-white/5 text-gray-400'
                      )}>
                        {matchType === 'competitive' ? '⭐ Competitivo' : 'Amistoso'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-gray-500">Prêmio</span>
                      <span className="text-sm font-display font-bold text-neon-yellow">
                        {betCurrency === 'BRO'
                          ? `${(betBroCents / 100).toFixed(2)} BRO`
                          : `${betExp} EXP`}
                      </span>
                    </div>
                    {(matchType === 'competitive' && opponent.type !== 'bot') || opponent.type === 'real_manager' ? (
                      <div className="flex items-center gap-1.5 text-[10px] text-neon-yellow/70 bg-neon-yellow/5 px-2 py-1.5 rounded">
                        <Star className="w-3 h-3 shrink-0" />
                        <span>Partida vale pontos no ranking</span>
                      </div>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={handleConfirm}
                    className="w-full btn-primary py-3"
                  >
                    <span className="btn-primary-inner flex items-center justify-center gap-2">
                      <Trophy className="w-4 h-4" />
                      CONFIRMAR E JOGAR
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOpponent(null)}
                    className="w-full border border-white/15 py-2.5 text-xs font-bold uppercase text-gray-400 hover:bg-white/5"
                  >
                    Buscar outro adversário
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
