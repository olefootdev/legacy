/**
 * Prévia dos blocos da Home VOLT2 com dados de EXEMPLO — só em desenvolvimento
 * (rota /dev/home-volt2, montada atrás de `import.meta.env.DEV` no App).
 *
 * Existe porque a Home real exige sessão e save: sem isto não dá pra olhar o
 * layout localmente. Nada aqui chega à produção nem finge ser dado de alguém.
 */
import { useState } from 'react';
import { HeroJogo } from '@/components/home/volt/HeroJogo';
import { FaixaPontuacao } from '@/components/home/volt/FaixaPontuacao';
import { DecisaoDoDia, type RespostaDada } from '@/components/home/volt/DecisaoDoDia';
import { DivisaoTabela } from '@/components/home/volt/DivisaoTabela';
import { Mosaico } from '@/components/home/volt/Mosaico';
import { Resenha } from '@/components/home/volt/Resenha';
import { buildDivisionView } from '@/ranking/divisionStandings';
import { resolveRequest, type PlayerRequest } from '@/systems/playerPersonality';
import type { DailyChallenge } from '@/game/dailyChallenges';
import type { MarketActivity } from '@/market/socialTrade';

const NOW = Date.now();

const TEAMS = [
  ['Estrela do Norte', 55], ['Atlético Brisa', 53], ['Real Várzea', 49], ['Ole FC', 47],
  ['Tubarões FC', 46], ['Unidos da Vila', 44], ['Leões do Cerrado', 41], ['Ponte Alta', 38],
  ['Grêmio Litoral', 36], ['Borussia do Morro', 35], ['Aurora EC', 33], ['Cometa FC', 30],
  ['Sereno SC', 28], ['Operário Sul', 26], ['Vila Nova do Sertão', 24], ['Serrano', 22],
  ['Maré Alta', 20], ['Barra FC', 18], ['Pioneiros', 15],
].map(([clubName, points], i) => ({
  id: `ex-${i}`,
  managerId: clubName === 'Ole FC' ? 'eu@exemplo' : `m${i}@exemplo`,
  clubName: clubName as string,
  division: 3,
  points: points as number,
  wins: Math.round((points as number) / 3),
  goalDifference: 0,
  goalsFor: 0,
}));

const REQUEST: PlayerRequest = {
  id: 'req_ex',
  playerId: 'ex',
  playerName: 'Rafael Brito',
  kind: 'minutes',
  quote: 'Quero começar a próxima partida. Estou pronto.',
  createdAt: NOW,
};

const CHALLENGES: DailyChallenge[] = [
  { id: 'c1', type: 'win_matches', title: 'Vencedor', description: 'Vença 2 partidas', target: 2, progress: 2, reward: 200, completed: true, claimed: false },
  { id: 'c2', type: 'win_matches', title: 'Artilheiro', description: 'Marque 5 gols', target: 5, progress: 5, reward: 150, completed: true, claimed: true },
  { id: 'c3', type: 'win_matches', title: 'Escalação', description: 'Jogue 3 partidas', target: 3, progress: 1, reward: 150, completed: false, claimed: false },
] as DailyChallenge[];

const ACTIVITIES: MarketActivity[] = [
  { id: 'a1', type: 'purchase', userId: 'u', userName: 'Atlético Brisa', playerName: 'Palhinha', playerOvr: 78, playerPos: 'VOL', price: 0, currency: 'EXP', timestamp: new Date(NOW - 4 * 60_000) },
  { id: 'a2', type: 'listing', userId: 'u', userName: 'Real Várzea', playerName: 'Carlos Eduardo Nascimento Filho', playerOvr: 70, playerPos: 'ATA', price: 0, currency: 'EXP', timestamp: new Date(NOW - 38 * 60_000) },
  { id: 'a3', type: 'sale', userId: 'u', userName: 'Estrela do Norte', playerName: 'Juan', playerOvr: 53, playerPos: 'LD', price: 0, currency: 'EXP', timestamp: new Date(NOW - 2 * 3_600_000) },
];

export default function HomeVolt2Preview() {
  const [answered, setAnswered] = useState<RespostaDada | null>(null);
  const [comJogo, setComJogo] = useState(true);
  const view = buildDivisionView({ teams: TEAMS, managerId: 'eu@exemplo', myClubId: '', promotionPercentage: 0.1 })!;

  return (
    <div className="min-h-screen bg-deep-black pt-6 text-white">
      <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-7 px-3 pb-10 sm:px-4">
        <p className="-mt-4 font-mono text-[11px] text-atencao">
          PRÉVIA · dados de exemplo ·{' '}
          <button type="button" className="underline" onClick={() => setComJogo((v) => !v)}>
            {comJogo ? 'ver sem jogo marcado' : 'ver com jogo marcado'}
          </button>
        </p>
        <div className="flex flex-col gap-[18px]">
          <HeroJogo
            clubName="Ole FC"
            fixture={comJogo ? { opponentName: 'Tubarões FC', kickoffLabel: 'Hoje · 21:00', isLive: false, tag: '#ligaglobal #div3' } : null}
            heroImage="/hero-legacy-full.png"
            heroImgOk
            onHeroError={() => {}}
          />
          <FaixaPontuacao
            scoreTotal={128450}
            scoreToday={2300}
            rank={14}
            pulse={{ value: 72, band: 'high', label: 'Embalado', trend: 'up', drivers: [] }}
          />
        </div>
        <DecisaoDoDia
          request={answered ? null : REQUEST}
          player={{ pos: 'MEI', age: 21 }}
          answered={answered}
          onChoose={(choice) =>
            setAnswered({ playerName: REQUEST.playerName, choice, moralDelta: resolveRequest(REQUEST.kind, choice).moralDelta })
          }
          suspendedCount={1}
          expiredCount={0}
          offersCount={2}
        />
        <DivisaoTabela view={view} roundsLeft={12} nextOpponent={{ name: 'Tubarões FC', isToday: true }} />
        <Mosaico
          legend={{ id: 'ex', name: 'Adauto Evandro', pos: 'ATA', ovr: 85, isNew: true }}
          cupPhase="Oitavas"
          challenges={CHALLENGES}
          streak={3}
          onClaim={() => {}}
        />
        <Resenha activities={ACTIVITIES} nowMs={NOW} />
      </div>
    </div>
  );
}
