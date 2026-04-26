import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/game/store';
import type { PlayerEntity } from '@/entities/types';
import { overallFromAttributes } from '@/entities/player';

type Phase = 'setup' | 'positioning' | 'aiming' | 'black' | 'result' | 'summary';

interface ShootingPosition {
  x: number;
  y: number;
  distance: number;
  angle: number;
  label: string;
}

interface Attempt {
  position: ShootingPosition;
  slot: number | null;
  result: 'goal' | 'save' | 'miss' | null;
}

const SHOOTING_POSITIONS: ShootingPosition[] = [
  { x: 50, y: 82, distance: 18, angle: 0, label: 'Centro da área' },
  { x: 35, y: 82, distance: 20, angle: -25, label: 'Esquerda da área' },
  { x: 65, y: 82, distance: 20, angle: 25, label: 'Direita da área' },
  { x: 50, y: 75, distance: 25, angle: 0, label: 'Bico da área' },
  { x: 25, y: 80, distance: 28, angle: -40, label: 'Lateral esquerda' },
  { x: 75, y: 80, distance: 28, angle: 40, label: 'Lateral direita' },
  { x: 50, y: 70, distance: 30, angle: 0, label: 'Meia-lua' },
  { x: 40, y: 72, distance: 28, angle: -20, label: 'Diagonal esquerda' },
  { x: 60, y: 72, distance: 28, angle: 20, label: 'Diagonal direita' },
  { x: 20, y: 75, distance: 32, angle: -50, label: 'Extrema esquerda' },
  { x: 80, y: 75, distance: 32, angle: 50, label: 'Extrema direita' },
  { x: 50, y: 65, distance: 35, angle: 0, label: 'Fora da área centro' },
  { x: 35, y: 68, distance: 33, angle: -30, label: 'Fora da área esq' },
  { x: 65, y: 68, distance: 33, angle: 30, label: 'Fora da área dir' },
  { x: 50, y: 60, distance: 40, angle: 0, label: 'Longa distância' },
];

const SHOOTING_GOAL_PROB: Record<number, number> = {
  1: 0.25, 2: 0.18, 3: 0.28,
  4: 0.15, 5: 0.08, 6: 0.18,
  7: 0.30, 8: 0.22, 9: 0.32,
};

export default function TrainingShootingDrill() {
  const navigate = useNavigate();
  const { state, dispatch } = useGameStore();
  const [phase, setPhase] = useState<Phase>('setup');
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerEntity | null>(null);
  const [currentAttempt, setCurrentAttempt] = useState(0);
  const [attempts, setAttempts] = useState<Attempt[]>(
    SHOOTING_POSITIONS.map((pos) => ({ position: pos, slot: null, result: null }))
  );
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(5);

  const eligiblePlayers = state.roster.filter((p) => p.outForMatches === 0);

  useEffect(() => {
    if (phase === 'positioning' && countdown > 0) {
      const t = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(t);
    }
    if (phase === 'positioning' && countdown === 0) {
      setPhase('aiming');
      setCountdown(6);
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
    setPhase('positioning');
    setCountdown(2);
  };

  const handleSlotClick = (slot: number) => {
    if (phase !== 'aiming') return;
    setSelectedSlot(slot);
    resolveShot(slot);
  };

  const handleAutoShoot = () => {
    const randomSlot = Math.floor(Math.random() * 9) + 1;
    setSelectedSlot(randomSlot);
    resolveShot(randomSlot);
  };

  const resolveShot = (slot: number) => {
    if (!selectedPlayer) return;
    setPhase('black');
    const position = attempts[currentAttempt]!.position;
    const baseProb = SHOOTING_GOAL_PROB[slot] ?? 0.2;
    const distanceFactor = Math.max(0.4, 1 - (position.distance - 18) / 60);
    const angleFactor = Math.max(0.7, 1 - Math.abs(position.angle) / 100);
    const attrBonus =
      (selectedPlayer.attrs.finalizacao * 1.5 +
        selectedPlayer.attrs.velocidade * 0.5 +
        selectedPlayer.attrs.confianca * 0.5) /
      250;
    const finalProb = baseProb * distanceFactor * angleFactor * (1 + attrBonus);
    const roll = Math.random();
    let result: 'goal' | 'save' | 'miss';
    if (roll < finalProb) {
      result = 'goal';
    } else if (roll < finalProb + 0.25) {
      result = 'save';
    } else {
      result = 'miss';
    }
    const updated = [...attempts];
    updated[currentAttempt] = { position, slot, result };
    setAttempts(updated);
    setTimeout(() => {
      setPhase('result');
      setTimeout(() => {
        if (currentAttempt < SHOOTING_POSITIONS.length - 1) {
          setCurrentAttempt(currentAttempt + 1);
          setSelectedSlot(null);
          setPhase('positioning');
          setCountdown(2);
        } else {
          finishTraining(updated);
        }
      }, 2000);
    }, 800);
  };

  const finishTraining = (finalAttempts: Attempt[]) => {
    const goals = finalAttempts.filter((a) => a.result === 'goal').length;
    const xpGain = goals * 40;
    if (selectedPlayer) {
      dispatch({
        type: 'PLAYER_GAIN_XP',
        playerId: selectedPlayer.id,
        xp: xpGain,
      });
      if (goals >= 10) {
        dispatch({
          type: 'PLAYER_BOOST_ATTRIBUTE',
          playerId: selectedPlayer.id,
          attribute: 'finalizacao',
          amount: 2,
        });
        dispatch({
          type: 'PLAYER_BOOST_ATTRIBUTE',
          playerId: selectedPlayer.id,
          attribute: 'velocidade',
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
          <h1 className="text-4xl font-bold mb-2 text-yellow-400">Treino de Finalizações</h1>
          <p className="text-gray-300 mb-8">
            Escolha um jogador para praticar 15 finalizações de diferentes posições e ângulos.
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
                        FIN {p.attrs.finalizacao} • VEL {p.attrs.velocidade}
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
    const xpGain = goals * 40;
    const accuracy = ((goals / SHOOTING_POSITIONS.length) * 100).toFixed(1);
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white flex items-center justify-center p-6">
        <div className="max-w-2xl w-full bg-gray-800 rounded-xl p-8 text-center">
          <h1 className="text-4xl font-bold mb-4 text-yellow-400">Treino Concluído!</h1>
          <div className="text-6xl font-bold mb-6">{goals}/15</div>
          <p className="text-xl mb-2">Gols marcados</p>
          <p className="text-lg text-gray-400 mb-6">Precisão: {accuracy}%</p>
          <div className="bg-gray-700 rounded-lg p-4 mb-6">
            <div className="text-lg mb-2">Recompensas</div>
            <div className="text-yellow-400 font-bold text-2xl">+{xpGain} XP</div>
            {goals >= 10 && (
              <div className="mt-4 text-green-400">
                <div className="font-bold">Bônus de Desempenho!</div>
                <div className="text-sm">Finalização +2 • Velocidade +1 • Confiança +1</div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-5 gap-2 mb-6">
            {attempts.map((a, i) => (
              <div
                key={i}
                className={`p-2 rounded text-xs ${
                  a.result === 'goal'
                    ? 'bg-green-600'
                    : a.result === 'save'
                      ? 'bg-orange-600'
                      : 'bg-red-600'
                }`}
              >
                {a.position.distance}m
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

  const currentPosition = attempts[currentAttempt]?.position ?? SHOOTING_POSITIONS[0]!;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-5xl">
        <div className="mb-4 flex justify-between items-center">
          <div className="text-xl font-bold">
            Posição {currentAttempt + 1}/15 • {currentPosition.label}
          </div>
          <div className="text-xl font-bold text-yellow-400">{goals} gols</div>
        </div>

        <div className="relative w-full aspect-[105/68] bg-green-700 rounded-lg overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-b from-green-600 to-green-800 opacity-50"></div>

          {/* Field markings */}
          <div
            className="absolute bg-white/10 border-2 border-white/30"
            style={{
              left: '40%',
              top: '2%',
              width: '20%',
              height: '8%',
            }}
          ></div>
          <div
            className="absolute border-2 border-white/30 rounded-full"
            style={{
              left: '35%',
              top: '50%',
              width: '30%',
              height: '20%',
            }}
          ></div>

          {/* Player at shooting position */}
          {(phase === 'positioning' || phase === 'aiming') && (
            <div
              className="absolute w-8 h-8 bg-yellow-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center font-bold text-black"
              style={{
                left: `${currentPosition.x}%`,
                top: `${currentPosition.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              ⚽
            </div>
          )}

          {/* Goalkeeper */}
          {(phase === 'positioning' || phase === 'aiming') && (
            <div
              className="absolute w-6 h-6 bg-red-500 rounded-full border-2 border-white"
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

        {phase === 'positioning' && (
          <div className="mt-4 text-center">
            <div className="text-2xl font-bold text-yellow-400 mb-2">
              Posicionando... {countdown}
            </div>
            <div className="text-gray-400">
              {currentPosition.distance}m • Ângulo {currentPosition.angle}°
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
