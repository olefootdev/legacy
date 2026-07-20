/**
 * LEGENDS CUP — a trilha das fases e a antessala de cada partida.
 *
 * O manager vê onde está, quem vem pela frente e QUEM exatamente vai enfrentar:
 * os cards reais das lendas, com foto e OVR. É a tela que transforma "próxima
 * partida" em "agora é o Palhinha".
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Play, Trophy, RotateCcw, ArrowLeft } from 'lucide-react';
import { overallFromAttributes } from '@/entities/player';
import {
  LEGENDS_CUP_ROUNDS, LEGENDS_CUP_OPPONENT_NAME, GROUP_MATCHES,
  roundOf, isFinalRound, type LegendsCupState,
} from '@/match/legendsCup/legendsCupModel';
import { buildLegendsCupOpponent, type LegendsCupOpponent } from '@/match/legendsCup/legendsCupSquad';
import { loadCup, startCampaign, expMultiplier, type LegendsCupSave } from '@/match/legendsCup/legendsCupStorage';
import { coachPersonaFor, personaLine } from '@/match/ligaOle/coachPersona';

const YELLOW = 'var(--color-neon-yellow)';

/** Prêmio-base por avançar de fase. Multiplica pela campanha (com teto). */
const BASE_PHASE_EXP = 2_500_000;

export function LegendsCup() {
  const navigate = useNavigate();
  const [save, setSave] = useState<LegendsCupSave>(() => loadCup());
  const [opp, setOpp] = useState<LegendsCupOpponent | null>(null);
  const [loading, setLoading] = useState(false);

  const state: LegendsCupState | null = save.current;
  const round = state ? roundOf(state.roundIndex) : null;

  const loadOpponent = useCallback(async (s: LegendsCupState) => {
    setLoading(true);
    try {
      setOpp(await buildLegendsCupOpponent(s.roundIndex, s.seed));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (state && state.status === 'active') void loadOpponent(state);
    else setOpp(null);
  }, [state, loadOpponent]);

  const begin = () => setSave(startCampaign());

  const phaseExp = useMemo(
    () => BASE_PHASE_EXP * expMultiplier(state?.runNumber ?? 1),
    [state?.runNumber],
  );

  return (
    <div className="mx-auto min-w-0 max-w-4xl space-y-5 pb-16">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex h-9 w-9 shrink-0 items-center justify-center border border-white/10 bg-black text-white/70 hover:bg-white/10"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="font-display text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: YELLOW }}>
            Modo torneio
          </div>
          <h1 className="ole-headline-italic mt-1" style={{ fontSize: 'clamp(32px, 6vw, 48px)' }}>
            Legends Cup
          </h1>
        </div>
        {save.titles > 0 && (
          <div className="flex items-center gap-1.5 rounded-lg border border-white/12 px-3 py-2">
            <Trophy className="h-4 w-4" style={{ color: YELLOW }} />
            <span className="font-display text-sm font-black tabular-nums">{save.titles}</span>
          </div>
        )}
      </div>

      {!state ? (
        <StartCard onStart={begin} />
      ) : state.status === 'eliminated' ? (
        <EndCard
          title="Eliminado"
          desc={`Você chegou até ${state.reachedRound}. As lendas seguem invictas — por enquanto.`}
          onRestart={begin}
        />
      ) : state.status === 'champion' ? (
        <EndCard
          title="CAMPEÃO"
          desc="Você venceu Os Imortais. Está no histórico — e a próxima campanha paga em dobro."
          champion
          onRestart={begin}
        />
      ) : (
        <>
          <Trail roundIndex={state.roundIndex} groupWins={state.groupWins} groupPlayed={state.groupPlayed} />
          <NextMatch
            round={round!}
            state={state}
            opp={opp}
            loading={loading}
            phaseExp={phaseExp}
            onPlay={() => navigate('/match/quick')}
          />
        </>
      )}
    </div>
  );
}

function StartCard({ onStart }: { onStart: () => void }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#121214] p-7 text-center">
      <h2 className="ole-headline-italic text-2xl">Enfrente as lendas</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/60">
        Três jogos de classificatória e cinco fases de mata-mata. A cada degrau entra mais lenda do
        outro lado — até a final, onde estão todas.
      </p>
      <button
        onClick={onStart}
        className="mt-6 inline-flex items-center gap-2 rounded-xl px-8 py-4 font-display text-sm font-black uppercase tracking-wider text-black transition-transform hover:-translate-y-0.5"
        style={{ background: YELLOW }}
      >
        <Play className="h-4 w-4" /> Começar campanha
      </button>
    </div>
  );
}

function EndCard({
  title, desc, onRestart, champion,
}: { title: string; desc: string; onRestart: () => void; champion?: boolean }) {
  return (
    <div className={`rounded-2xl border p-7 text-center ${champion ? 'border-neon-yellow/40 bg-neon-yellow/[0.06]' : 'border-white/10 bg-[#121214]'}`}>
      {champion && <Trophy className="mx-auto mb-3 h-10 w-10" style={{ color: YELLOW }} />}
      <h2 className="ole-headline-italic text-3xl">{title}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/60">{desc}</p>
      <button
        onClick={onRestart}
        className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/15 px-6 py-3.5 text-sm font-bold uppercase tracking-wider text-white/80 hover:border-white/40"
      >
        <RotateCcw className="h-4 w-4" /> Nova campanha
      </button>
    </div>
  );
}

/** Trilha das fases — onde o manager está e o que falta. */
function Trail({ roundIndex, groupWins, groupPlayed }: { roundIndex: number; groupWins: number; groupPlayed: number }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {LEGENDS_CUP_ROUNDS.map((r, i) => {
        const done = i < roundIndex;
        const active = i === roundIndex;
        return (
          <div
            key={r}
            className={`rounded-lg border px-3 py-2 text-[11px] font-bold uppercase tracking-wider ${
              active ? 'text-black' : done ? 'border-white/20 text-white/50' : 'border-white/10 text-white/25'
            }`}
            style={active ? { background: YELLOW, borderColor: 'transparent' } : undefined}
          >
            {r}
            {active && i === 0 && <span className="ml-1.5 tabular-nums">{groupWins}/{groupPlayed}·{GROUP_MATCHES}</span>}
          </div>
        );
      })}
    </div>
  );
}

/** Antessala: quem você vai enfrentar agora. */
function NextMatch({
  round, state, opp, loading, phaseExp, onPlay,
}: {
  round: string; state: LegendsCupState; opp: LegendsCupOpponent | null;
  loading: boolean; phaseExp: number; onPlay: () => void;
}) {
  const teamId = opp?.stub.id ?? 'legendscup';
  const persona = coachPersonaFor(teamId);
  const line = personaLine(teamId, 'pre', round);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#121214] p-6">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <span className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
          {isFinalRound(state.roundIndex) ? 'A decisão' : 'Próximo desafio'}
        </span>
        <h2 className="ole-headline-italic text-2xl">{LEGENDS_CUP_OPPONENT_NAME[round as never]}</h2>
        {opp && (
          <span className="ml-auto font-display text-sm font-black tabular-nums" style={{ color: YELLOW }}>
            força {opp.stub.strength}
          </span>
        )}
      </div>

      <p className="mt-2 text-[13px] italic leading-snug text-white/45">
        {persona.icon} {persona.label}: “{line}”
      </p>

      {loading ? (
        <div className="grid place-items-center py-10 text-white/40"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : opp && opp.legends.length > 0 ? (
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {opp.legends.map((l) => (
            <div key={l.id} className="overflow-hidden rounded-xl border border-white/10 bg-[#0c0c0d]">
              <div className="relative aspect-[3/4] bg-black">
                {l.portraitUrl ? (
                  <img src={l.portraitUrl} alt={l.name} loading="lazy" referrerPolicy="no-referrer"
                    className="h-full w-full object-cover object-[50%_18%]" />
                ) : (
                  <div className="grid h-full place-items-center text-white/20">sem foto</div>
                )}
                <span className="absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 font-display text-xs font-black text-black" style={{ background: YELLOW }}>
                  {overallFromAttributes(l.attrs, l.pos)}
                </span>
              </div>
              <p className="truncate px-2 py-1.5 font-display text-[11px] font-black">{l.name}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-white/40">
          Seletiva Genesis — sem lendas nesta fase. Vença {GROUP_MATCHES - 1} dos {GROUP_MATCHES} jogos para avançar.
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          onClick={onPlay}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl py-4 font-display text-sm font-black uppercase tracking-wider text-black transition-transform hover:-translate-y-0.5"
          style={{ background: YELLOW }}
        >
          <Play className="h-4 w-4" /> Jogar
        </button>
        <div className="text-right">
          <div className="font-display text-base font-black tabular-nums" style={{ color: YELLOW }}>
            {phaseExp.toLocaleString('pt-BR')}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-white/35">EXP por avançar</div>
        </div>
      </div>
    </div>
  );
}

export default LegendsCup;
