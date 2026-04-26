import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/game/store';
import type { PlayerEntity } from '@/entities/types';
import { overallFromAttributes } from '@/entities/player';

type Phase = 'setup' | 'pre_kick' | 'aiming' | 'black' | 'result' | 'summary';

interface Attempt {
  distance: number;
  slot: number | null;
  result: 'goal' | 'save' | 'miss' | null;
}

const DISTANCES = [18, 20, 22, 25, 28, 30, 32, 35, 35, 35];

const FREE_KICK_GOAL_PROB: Record<number, number> = {
  1: 0.15, 2: 0.22, 3: 0.18,
  4: 0.12, 5: 0.08, 6: 0.14,
  7: 0.20, 8: 0.28, 9: 0.24,
};

export default function TrainingFreeKicks() {
  const navigate = useNavigate();
  const { state, dispatch } = useGameStore();
  const [phase, setPhase] = useState<Phase>('setup');
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerEntity | null>(null);
  const [currentAttempt, setCurrentAttempt] = useState(0);
  const [attempts, setAttempts] = useState<Attempt[]>(
    DISTANCES.map((d) => ({ distance: d, slot: null, result: null }))
  );
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(5);

  const eligiblePlayers = state.roster.filter((p) => p.outForMatches === 0);

  useEffect(() => {
    if (phase === 'pre_kick' && countdown > 0) {
      const t = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(t);
    }
    if (phase === 'pre_kick' && countdown === 0) {
      setPhase('aiming');
      setCountdown(8);
    }
  }, [phase, countdown]);

  useEffect(() => {
    if (phase === 'aiming' && countdown > 0) {
      const t = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(t);
    }
    if (phase === 'aiming' && countdown === 0) {
      handleAutoShoot();
    }
  }, [phase, countdown]);

  const handleSelectPlayer = (p: PlayerEntity) => {
    setSelectedPlayer(p);
  };

  const handleStartTraining = () => {
    if (!selectedPlayer) return;
    setPhase('pre_kick');
    setCountdown(3);
  };

  const handleSlotClick = (slot: number) => {
    if (phase !== 'aiming') return;
    setSelectedSlot(slot);
    resolveKick(slot);
  };

  const handleAutoShoot = () => {
    const randomSlot = Math.floor(Math.random() * 9) + 1;
    setSelectedSlot(randomSlot);
    resolveKick(randomSlot);
  };

  const resolveKick = (slot: number) => {
    if (!selectedPlayer) return;
    setPhase('black');
    const distance = attempts[currentAttempt]!.distance;
    const baseProb = FREE_KICK_GOAL_PROB[slot] ?? 0.15;
    const distanceFactor = Math.max(0.5, 1 - (distance - 18) / 50);
    const attrBonus = (selectedPlayer.attrs.finalizacao + selectedPlayer.attrs.passe) / 200;
    const finalProb = baseProb * distanceFactor * (1 + attrBonus);
    const roll = Math.random();
    let result: 'goal' | 'save' | 'miss';
    if (roll < finalProb) {
      result = 'goal';
    } else if (roll < finalProb + 0.3) {
      result = 'save';
    } else {
      result = 'miss';
    }
    const updated = [...attempts];
    updated[currentAttempt] = { distance, slot, result };
    setAttempts(updated);
    setTimeout(() => {
      setPhase('result');
      setTimeout(() => {
        if (currentAttempt < DISTANCES.length - 1) {
          setCurrentAttempt(currentAttempt + 1);
          setSelectedSlot(null);
          setPhase('pre_kick');
          setCountdown(3);
        } else {
          finishTraining(updated);
        }
      }, 2000);
    }, 800);
  };

  const finishTraining = (finalAttempts: Attempt[]) => {
    const goals = finalAttempts.filter((a) => a.result === 'goal').length;
    const xpGain = goals * 50;
    if (selectedPlayer) {
      dispatch({
        type: 'PLAYER_GAIN_XP',
        playerId: selectedPlayer.id,
        xp: xpGain,
      });
      if (goals >= 7) {
        dispatch({
          type: 'PLAYER_BOOST_ATTRIBUTE',
          playerId: selectedPlayer.id,
          attribute: 'finalizacao',
          amount: 1,
        });
        dispatch({
          type: 'PLAYER_BOOST_ATTRIBUTE',
          playerId: selectedPlayer.id,
          attribute: 'passe',
          amount: 1,
        });
        dispatch({
          type: 'PLAYER_BOOST_ATTRIBUTE',
          playerId: selectedPlayer.id,
          attribute: 'confianca',
          amount: 1,
        });
      }
    }
    setPhase('summary');
  };

  const goals = attempts.filter((a) => a.result === 'goal').length;

  if (phase === 'setup') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white p-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate('/manager')}
            className="mb-6 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
          >
            ← Voltar
          </button>
          <h1 className="text-4xl font-bold mb-2 text-yellow-400">Treino de Faltas</h1>
          <p className="text-gray-300 mb-8">
            Escolha um jogador para praticar 10 cobranças de falta. Distâncias variam de 18m a 35m.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {eligiblePlayers.map((p) => {
              const ovr = overallFromAttributes(p.attrs);
              const isSelected = selectedPlayer?.id === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => handleSelectPlayer(p)}
                  className={`p-4 rounded-lg cursor-pointer transition ${
                    isSelected
                      ? 'bg-yellow-500 text-black'
                      : 'bg-gray-800 hover:bg-gray-700 text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {p.portraitTokenUrl && (
                      <img
                        src={p.portraitTokenUrl}
                        alt={p.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    )}
                    <div>
                      <div className="font-bold">{p.name}</div>
                      <div className="text-sm opacity-80">
                        {p.pos} • OVR {ovr}
                      </div>
                      <div className="text-xs opacity-70">
                        FIN {p.attrs.finalizacao} • PAS {p.attrs.passe}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {selectedPlayer && (
            <button
              onClick={handleStartTraining}
              className="mt-8 w-full py-4 bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-xl rounded-lg transition"
            >
              Iniciar Treino
            </button>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'summary') {
    const xpGain = goals * 50;
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white flex items-center justify-center p-6">
        <div className="max-w-2xl w-full bg-gray-800 rounded-xl p-8 text-center">
          <h1 className="text-4xl font-bold mb-4 text-yellow-400">Treino Concluído!</h1>
          <div className="text-6xl font-bold mb-6">{goals}/10</div>
          <p className="text-xl mb-4">Gols marcados</p>
          <div className="bg-gray-700 rounded-lg p-4 mb-6">
            <div className="text-lg mb-2">Recompensas</div>
            <div className="text-yellow-400 font-bold text-2xl">+{xpGain} XP</div>
            {goals >= 7 && (
              <div className="mt-4 text-green-400">
                <div className="font-bold">Bônus de Desempenho!</div>
                <div className="text-sm">Finalização +1 • Passe +1 • Confiança +1</div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-5 gap-2 mb-6">
            {attempts.map((a, i) => (
              <div
                key={i}
                className={`p-2 rounded text-sm ${
                  a.result === 'goal'
                    ? 'bg-green-600'
                    : a.result === 'save'
                      ? 'bg-orange-600'
                      : 'bg-red-600'
                }`}
              >
                {a.distance}m
                <br />
                {a.result === 'goal' ? '⚽' : a.result === 'save' ? '🧤' : '❌'}
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate('/manager')}
            className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg transition"
          >
            Voltar ao Manager
          </button>
        </div>
      </div>
    );
  }

  const currentDistance = attempts[currentAttempt]?.distance ?? 18;
  const ballX = 50;
  const ballY = 100 - (currentDistance / 105) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-5xl">
        <div className="mb-4 flex justify-between items-center">
          <div className="text-xl font-bold">
            Tentativa {currentAttempt + 1}/10 • {currentDistance}m
          </div>
          <div className="text-xl font-bold text-yellow-400">
            {goals} gols
          </div>
        </div>

        <div className="relative w-full aspect-[105/68] bg-green-700 rounded-lg overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-b from-green-600 to-green-800 opacity-50"></div>

          {/* Goal area */}
          <div
            className="absolute bg-white/10 border-2 border-white/30"
            style={{
              left: '40%',
              top: '2%',
              width: '20%',
              height: '8%',
            }}
          ></div>

          {/* Ball */}
          {(phase === 'pre_kick' || phase === 'aiming') && (
            <div
              className="absolute w-4 h-4 bg-white rounded-full shadow-lg"
              style={{
                left: `${ballX}%`,
                top: `${ballY}%`,
                transform: 'translate(-50%, -50%)',
              }}
            ></div>
          )}

          {/* Wall (4 defenders) */}
          {(phase === 'pre_kick' || phase === 'aiming') && (
            <>
              {[45, 48, 52, 55].map((x, i) => (
                <div
                  key={i}
                  className="absolute w-6 h-6 bg-red-500 rounded-full border-2 border-white"
                  style={{
                    left: `${x}%`,
                    top: `${ballY - 8}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                ></div>
              ))}
            </>
          )}

          {/* Goalkeeper */}
          {(phase === 'pre_kick' || phase === 'aiming') && (
            <div
              className="absolute w-6 h-6 bg-yellow-500 rounded-full border-2 border-white"
              style={{
                left: '50%',
                top: '5%',
                transform: 'translate(-50%, -50%)',
              }}
            ></div>
          )}

          {phase === 'aiming' && (
            <div className="absolute inset-0 flex items-start justify-center pt-4">
              <div className="bg-black/80 rounded-lg p-4">
                <div className="text-center mb-2 text-yellow-400 font-bold">
                  Escolha o canto ({countdown}s)
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((slot) => (
                    <button
                      key={slot}
                      onClick={() => handleSlotClick(slot)}
                      className="w-12 h-12 bg-gray-700 hover:bg-yellow-500 rounded border-2 border-white/30 transition font-bold"
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {phase === 'black' && (
            <div className="absolute inset-0 bg-black flex items-center justify-center">
              <div className="text-4xl font-bold animate-pulse">...</div>
            </div>
          )}

          {phase === 'result' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <img
                src={
                  attempts[currentAttempt]?.result === 'goal'
                    ? '/test-pitch/jogador-ganhou.png'
                    : '/test-pitch/jogador-perdeu.png'
                }
                alt="result"
                className="max-w-md w-full"
              />
            </div>
          )}
        </div>

        {phase === 'pre_kick' && (
          <div className="mt-4 text-center text-2xl font-bold text-yellow-400">
            Preparando... {countdown}
          </div>
        )}
      </div>
    </div>
  );
}
