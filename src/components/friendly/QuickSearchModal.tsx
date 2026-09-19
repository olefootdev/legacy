import { motion, AnimatePresence } from 'motion/react';
import { Search, UserPlus, X, Zap, Trophy, Shield, Star, Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Hashtag } from '@/components/ui';
import { useGameStore } from '@/game/store';
import { quickFindOpponent, type OpponentMatch, opponentMatchToStub } from '@/match/friendlyMatchmaking';
import { overallFromAttributes } from '@/entities/player';
import { formatExp } from '@/systems/economy';
import { MatchPreviewModal } from '@/components/match/MatchPreviewModal';

type OpponentStub = ReturnType<typeof opponentMatchToStub>;

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
  // Pré-jogo da Partida Rápida: escalação/gestão antes do apito.
  const [previewStub, setPreviewStub] = useState<OpponentStub | null>(null);

  // Calcular OVR médio do time
  const myOverall = Math.round(
    Object.values(players).reduce((sum, p) => sum + overallFromAttributes(p.attrs, p.pos), 0) /
      Math.max(1, Object.keys(players).length),
  );

  const handleSearch = async () => {
    setSearching(true);
    setOpponent(null);

    // Simular delay de busca (UX)
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Busca sessão para passar userId + email ao matchmaking (o email é o
    // manager_id da Liga Global — sem ele o anti-auto-sorteio não funciona).
    const { getSupabase } = await import('@/supabase/client');
    const sb = getSupabase();
    const session = sb ? (await sb.auth.getSession()).data.session : null;
    const userId = session?.user?.id;
    const userEmail = session?.user?.email;

    const result = await quickFindOpponent(club.id, myOverall, userId, userEmail);
    setOpponent(result);
    setSearching(false);
  };

  const handleConfirm = () => {
    if (!opponent) return;
    // Passa SEMPRE um stub no navigate state (manager, online ou bot). Isso
    // garante que MatchQuick nunca caia no DEFAULT_OPPONENT placeholder.
    const stub = opponentMatchToStub(opponent, myOverall);

    // Disputa de pênaltis não precisa de pré-jogo de escalação → vai direto.
    if (mode === 'penalty') {
      navigate('/match/penalty', { state: { pvpOpponentStub: stub } });
      onClose();
      return;
    }

    // Partida Rápida: abre o pré-jogo (escalação + gestão de cansados) por cima.
    setPreviewStub(stub);
  };

  const startQuickMatch = () => {
    if (!previewStub) return;
    navigate('/match/quick', { state: { pvpOpponentStub: previewStub } });
    setPreviewStub(null);
    onClose();
  };

  const betBroCents = Math.max(1, Math.round(parseFloat(betInput.replace(',', '.')) * 100));
  const betExp = Math.max(1, Math.round(parseFloat(betInput.replace(',', '.'))));

  return (
    <>
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto overscroll-y-contain bg-black/90 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:items-center sm:p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            className="relative my-auto flex max-h-[min(90dvh,calc(100dvh-6rem))] w-full max-w-lg flex-col overflow-hidden border-neon-yellow/40 sports-panel p-0 sm:max-h-[min(92dvh,720px)]"
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 z-10 border border-white/16 bg-black p-2 text-cimento hover:border-white/30 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="shrink-0 border-b border-white/10 bg-deep-black p-6">
              <h3 className="font-impact text-2xl uppercase leading-[1.1] text-white">
                Buscar Partida
              </h3>
              <Hashtag className="mt-1.5">#pvp · adversário automático</Hashtag>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain p-6">
              {/* Tipo de partida: Competitivo / Amistoso */}
              <div>
                <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-cimento block mb-2">
                  Tipo de partida
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMatchType('competitive')}
                    className={cn(
                      'ole-num py-3 text-[12px] uppercase border transition-colors',
                      matchType === 'competitive'
                        ? 'bg-neon-yellow text-black border-neon-yellow'
                        : 'border-white/16 text-cimento hover:border-white/30 hover:text-white',
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
                      'ole-num py-3 text-[12px] uppercase border transition-colors',
                      matchType === 'friendly'
                        ? 'bg-neon-yellow text-black border-neon-yellow'
                        : 'border-white/16 text-cimento hover:border-white/30 hover:text-white',
                    )}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>Amistoso</span>
                    </div>
                  </button>
                </div>
                {matchType === 'competitive' && (
                  <p className="mt-2 font-mono text-[10.5px] text-neon-yellow leading-snug">
                    Conta pontos no ranking contra time humano
                  </p>
                )}
              </div>

              {/* Modo de partida */}
              <div>
                <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-cimento block mb-2">
                  Modo de partida
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('quick')}
                    className={cn(
                      'ole-num py-2.5 px-1 whitespace-nowrap text-[10px] uppercase border transition-colors',
                      mode === 'quick'
                        ? 'bg-neon-yellow text-black border-neon-yellow'
                        : 'border-white/16 text-cimento hover:border-white/30 hover:text-white',
                    )}
                  >
                    Partida Rápida
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('penalty')}
                    className={cn(
                      'ole-num py-2.5 px-1 whitespace-nowrap text-[10px] uppercase border transition-colors',
                      mode === 'penalty'
                        ? 'bg-neon-yellow text-black border-neon-yellow'
                        : 'border-white/16 text-cimento hover:border-white/30 hover:text-white',
                    )}
                  >
                    Disputa Pênaltis
                  </button>
                </div>
              </div>

              {/* Aposta */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-cimento">
                    Prêmio (vencedor leva)
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setBetCurrency('BRO')}
                      className={cn(
                        'ole-num px-2 py-1 text-[10px] uppercase',
                        betCurrency === 'BRO' ? 'bg-white text-black' : 'border border-white/16 text-cimento',
                      )}
                    >
                      BRO
                    </button>
                    <button
                      type="button"
                      onClick={() => setBetCurrency('EXP')}
                      className={cn(
                        'ole-num px-2 py-1 text-[10px] uppercase',
                        betCurrency === 'EXP' ? 'bg-neon-yellow text-black' : 'border border-white/16 text-cimento',
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
                  className="w-full bg-deep-black border border-white/16 px-3 py-2 text-sm text-white placeholder:text-poeira focus:border-neon-yellow/60 focus:outline-none"
                />
                <p className="font-mono text-[10.5px] text-cimento mt-2">
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
                  className="border border-neon-yellow/40 bg-deep-black p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="truncate font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-neon-yellow">
                      Adversário encontrado
                    </h4>
                    {opponent.type === 'bot' ? (
                      <span className="shrink-0 bg-card-hi px-[5px] py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-cimento">
                        BOT
                      </span>
                    ) : opponent.type === 'real_manager' ? (
                      <span className="shrink-0 bg-neon-yellow px-[5px] py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-black">
                        MANAGER REAL
                      </span>
                    ) : (
                      <span className="shrink-0 border border-alta/50 px-[5px] py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-alta">
                        ONLINE
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full border-2 border-neon-yellow/40 bg-panel grid place-items-center shrink-0">
                      <Shield className="w-8 h-8 text-neon-yellow" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="font-impact text-xl uppercase leading-[1.1] text-white truncate">
                        {opponent.type === 'bot'
                          ? opponent.bot.name
                          : opponent.type === 'real_manager'
                            ? opponent.stub.name
                            : '—'}
                      </h5>
                      <p className="font-mono text-[11.5px] text-cimento">
                        {opponent.type === 'bot'
                          ? `OVR ${opponent.bot.avgOverall} · ${opponent.bot.country}`
                          : opponent.type === 'real_manager'
                            ? `OVR ${opponent.stub.strength} · Manager`
                            : '—'}
                      </p>
                      {opponent.type === 'bot' && (
                        <p className="font-mono text-[10.5px] text-poeira mt-1">
                          {opponent.bot.formation} · {opponent.bot.style}
                        </p>
                      )}
                      {opponent.type === 'real_manager' && (
                        <p className="font-mono text-[10.5px] text-neon-yellow mt-1">
                          Elenco real · EXP conta para o ranking
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-white/10 pt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-cimento">Tipo</span>
                      <span className={cn(
                        "ole-num text-[11px] uppercase px-2 py-0.5",
                        matchType === 'competitive'
                          ? 'bg-neon-yellow text-black'
                          : 'border border-white/16 text-cimento'
                      )}>
                        {matchType === 'competitive' ? 'Competitivo' : 'Amistoso'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-cimento">Prêmio</span>
                      <span className="ole-num text-sm text-neon-yellow">
                        {betCurrency === 'BRO'
                          ? `${(betBroCents / 100).toFixed(2)} BRO`
                          : `${betExp} EXP`}
                      </span>
                    </div>
                    {(matchType === 'competitive' && opponent.type !== 'bot') || opponent.type === 'real_manager' ? (
                      <div className="flex items-center gap-1.5 border border-neon-yellow/40 px-2 py-1.5 font-mono text-[10.5px] text-neon-yellow">
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
                    className="ole-num w-full h-11 border border-white/30 text-[12px] uppercase text-white transition-colors hover:border-white hover:bg-white/5"
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

    {previewStub && (
      <MatchPreviewModal
        opponentName={previewStub.name}
        opponentShort={previewStub.shortName ?? previewStub.name}
        opponentOverall={previewStub.strength}
        onConfirm={startQuickMatch}
        onCancel={() => setPreviewStub(null)}
        onGoToMarket={() => {
          setPreviewStub(null);
          onClose();
          navigate('/mercado/transfer');
        }}
      />
    )}
    </>
  );
}
