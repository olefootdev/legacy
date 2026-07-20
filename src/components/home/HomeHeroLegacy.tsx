import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Loader2 } from 'lucide-react';
import { getGameState, useGameStore, dispatchGame } from '@/game/store';
import { overallFromAttributes } from '@/entities/player';
import { formatExp } from '@/systems/economy';
import { computeCareerTier } from '@/systems/careerTiers';

const HERO_IMAGE = '/hero-legacy-full.png';

function buildTickerItems(opts: {
  clubName: string;
  managerFirstName: string | null;
  lastMatch:
    | {
        result: 'win' | 'draw' | 'loss';
        scoreHome: number;
        scoreAway: number;
        home: string;
        away: string;
      }
    | undefined;
  nextOpponentName: string | null;
  nextKickoffLabel: string | null;
  competition: string | null;
  recentForm: ReadonlyArray<'W' | 'D' | 'L'> | null;
  expCompact: string;
  tierLabel: string;
}): string[] {
  const items: string[] = [];
  const {
    clubName,
    managerFirstName,
    lastMatch,
    nextOpponentName,
    nextKickoffLabel,
    competition,
    recentForm,
    expCompact,
    tierLabel,
  } = opts;

  if (managerFirstName) {
    items.push(`OLEFOOT · ${clubName.toUpperCase()} · COMANDO DE ${managerFirstName.toUpperCase()}`);
  } else {
    items.push(`OLEFOOT · ${clubName.toUpperCase()}`);
  }

  if (lastMatch) {
    const verb =
      lastMatch.result === 'win' ? 'VITÓRIA' : lastMatch.result === 'loss' ? 'DERROTA' : 'EMPATE';
    items.push(
      `ÚLTIMO JOGO · ${verb} ${lastMatch.scoreHome}–${lastMatch.scoreAway} CONTRA ${lastMatch.away.toUpperCase()}`,
    );
  } else {
    items.push('ESTREIA OFICIAL · O PRIMEIRO JOGO ESTÁ POR VIR');
  }

  if (nextOpponentName) {
    const when = nextKickoffLabel ? ` · ${nextKickoffLabel.toUpperCase()}` : '';
    items.push(`PRÓXIMO · OLE FC vs ${nextOpponentName.toUpperCase()}${when}`);
  }

  if (recentForm && recentForm.length > 0) {
    items.push(`FORMA · ${recentForm.slice(0, 5).join(' ')}`);
  }

  items.push(`TIER ${tierLabel} · ${expCompact} EXP DISPONÍVEIS`);

  if (competition) {
    items.push(competition.toUpperCase());
  }

  return items;
}

function NewsTicker({ items }: { items: ReadonlyArray<string> }) {
  // Duplicamos o conteúdo pra fazer o loop sem corte (CSS translate -50%).
  const duplicated = useMemo(() => [...items, ...items], [items]);
  // Velocidade: 56px/s = ~1 char por 35ms. Lento, leitura tranquila.
  const totalChars = items.reduce((acc, t) => acc + t.length + 6, 0);
  const durationSec = Math.max(28, Math.round(totalChars * 0.32));

  const style: CSSProperties = {
    animation: `home-hero-ticker ${durationSec}s linear infinite`,
  };

  return (
    <div
      className="relative w-full overflow-hidden border-y border-white/10"
      style={{
        background: 'linear-gradient(90deg, #0D0D0D 0%, #1A1A1A 50%, #0D0D0D 100%)',
      }}
      role="marquee"
      aria-label="Notícias do clube"
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12"
        style={{ background: 'linear-gradient(90deg, #0D0D0D 0%, transparent 100%)' }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12"
        style={{ background: 'linear-gradient(270deg, #0D0D0D 0%, transparent 100%)' }}
      />
      <div className="flex w-max items-center py-2.5" style={style}>
        {duplicated.map((text, idx) => (
          <span
            key={`${text}-${idx}`}
            className="font-display uppercase whitespace-nowrap px-6 flex items-center gap-3"
            style={{
              fontSize: 11,
              letterSpacing: '0.32em',
              color: 'rgba(255,255,255,0.78)',
            }}
          >
            <span
              aria-hidden
              style={{
                display: 'inline-block',
                width: 6,
                height: 6,
                borderRadius: 9999,
                background: 'var(--color-neon-yellow)',
                boxShadow: '0 0 12px rgba(253,225,0,0.7)',
              }}
            />
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}

export function HomeHeroLegacy(props: {
  scrollCueTargetId?: string;
}) {
  const club = useGameStore((s) => s.club);
  const finance = useGameStore((s) => s.finance);
  const results = useGameStore((s) => s.results);
  const formGlobal = useGameStore((s) => s.form);
  const fixture = useGameStore((s) => s.nextFixture);
  const managerProfile = useGameStore((s) => s.userSettings?.managerProfile);
  const players = useGameStore((s) => s.players);

  const managerFirstName = managerProfile?.firstName?.trim() || null;
  const greetingName = managerFirstName ?? 'Manager';

  const lastMatch = results[0];
  const rawOpponentName = fixture?.opponent?.name ?? null;
  const nextOpponentName = rawOpponentName && rawOpponentName !== 'Buscando…' ? rawOpponentName : null;
  const nextKickoffLabel = fixture?.kickoffLabel ?? null;
  const competition = fixture?.competition ?? null;

  const tier = useMemo(
    () => computeCareerTier(finance.expLifetimeEarned ?? finance.ole ?? 0),
    [finance.expLifetimeEarned, finance.ole],
  );
  const tierLabel = `${tier.id} ${tier.name.toUpperCase()}`;
  const expCompact = formatExp(finance.ole);

  const recentForm = useMemo<ReadonlyArray<'W' | 'D' | 'L'> | null>(
    () => (formGlobal && formGlobal.length > 0 ? formGlobal.slice(0, 5) : null),
    [formGlobal],
  );

  const tickerItems = useMemo(
    () =>
      buildTickerItems({
        clubName: club?.name ?? 'OLE FC',
        managerFirstName,
        lastMatch,
        nextOpponentName,
        nextKickoffLabel,
        competition,
        recentForm,
        expCompact,
        tierLabel,
      }),
    [
      club?.name,
      managerFirstName,
      lastMatch,
      nextOpponentName,
      nextKickoffLabel,
      competition,
      recentForm,
      expCompact,
      tierLabel,
    ],
  );

  const playersCount = Object.keys(players).length;
  const isDebut = !lastMatch;

  /**
   * Manchete dinâmica seguindo a hierarquia:
   *   1. Estreia · plantel pronto
   *   2. Streak forte (≥4V ou ≥3D) — mood do clube
   *   3. Recap do último jogo (≤24h) — fechado em manchete
   *   4. Preview do próximo (com adversário)
   *   5. Default — síntese de forma
   * Retorna headline em texto puro com placeholders já resolvidos.
   */
  const narrative = useMemo(() => {
    const last = lastMatch;
    const form = recentForm ?? [];
    const streakW = (() => {
      let n = 0;
      for (const r of form) {
        if (r === 'W') n += 1;
        else break;
      }
      return n;
    })();
    const streakL = (() => {
      let n = 0;
      for (const r of form) {
        if (r === 'L') n += 1;
        else break;
      }
      return n;
    })();

    if (isDebut) {
      const n = playersCount > 0 ? playersCount : 25;
      return `Teu plantel de ${n} está pronto. Hoje começa a história do ${club?.name ?? 'Olefoot FC'}.`;
    }

    if (streakW >= 4) {
      return `${streakW} vitórias seguidas. O ${club?.shortName ?? club?.name ?? 'Olé'} virou candidato.`;
    }
    if (streakL >= 3) {
      const next = nextOpponentName ? `contra ${nextOpponentName}` : 'no próximo jogo';
      return `Sequência ruim. Hora de virar a chave ${next}.`;
    }

    if (last) {
      const verb =
        last.result === 'win' ? 'Vitória' : last.result === 'loss' ? 'Tropeço' : 'Empate';
      const score = `${last.scoreHome} a ${last.scoreAway}`;
      const opp = last.away;
      if (last.result === 'win') {
        return `${verb} contra ${opp}. ${score} pra abrir caminho.`;
      }
      if (last.result === 'loss') {
        return `${verb} contra ${opp}. ${score} pesa, mas tem volta.`;
      }
      return `${verb} contra ${opp}. ${score} — agora é construir do zero.`;
    }

    if (nextOpponentName) {
      const when = nextKickoffLabel ? `${nextKickoffLabel}` : 'em breve';
      return `${when}, ${club?.shortName ?? 'OLE'} × ${nextOpponentName}. Resultado define o ranking.`;
    }

    if (form.length > 0) {
      return `Forma: ${form.join(' ')}. ${club?.name ?? 'O time'} segue construindo legado.`;
    }

    return `${club?.name ?? 'O time'} segue construindo legado.`;
  }, [
    isDebut,
    lastMatch,
    recentForm,
    nextOpponentName,
    nextKickoffLabel,
    club?.name,
    club?.shortName,
    playersCount,
  ]);

  // Estado scoreboard
  const homeScore = lastMatch?.scoreHome ?? 0;
  const awayScore = lastMatch?.scoreAway ?? 0;
  const awayName = lastMatch?.away ?? nextOpponentName ?? 'Adversário';
  const statusLabel = isDebut ? 'ESTREIA' : lastMatch?.result === 'win'
    ? 'VITÓRIA'
    : lastMatch?.result === 'loss'
      ? 'DERROTA'
      : 'EMPATE';

  const navigate = useNavigate();
  const [searching, setSearching] = useState(false);

  const handleSearchMatch = useCallback(async () => {
    if (searching) return;
    setSearching(true);
    try {
      const { quickFindOpponent, opponentMatchToStub } = await import('@/match/friendlyMatchmaking');
      const { getSupabase } = await import('@/supabase/client');
      const sb = getSupabase();
      const userId = sb ? (await sb.auth.getSession()).data.session?.user?.id : undefined;
      const snapshot = getGameState().players;
      const myOverall = Math.round(
        Object.values(snapshot).reduce((s, p) => s + overallFromAttributes(p.attrs, p.pos), 0) /
          Math.max(1, Object.keys(snapshot).length),
      ) || 70;
      const match = await quickFindOpponent(club!.id, myOverall, userId);
      const stub = opponentMatchToStub(match, myOverall);
      dispatchGame({ type: 'ADMIN_PATCH_NEXT_FIXTURE', partial: { opponent: stub, awayName: stub.name } });
      navigate('/match/quick', { state: { pvpOpponentStub: stub } });
    } catch {
      try {
        const { getMatchingBotTeam } = await import('@/match/botTeams');
        const { opponentMatchToStub } = await import('@/match/friendlyMatchmaking');
        const snapshot = getGameState().players;
        const myOverall = Math.round(
          Object.values(snapshot).reduce((s, p) => s + overallFromAttributes(p.attrs, p.pos), 0) /
            Math.max(1, Object.keys(snapshot).length),
        ) || 70;
        const bot = getMatchingBotTeam(myOverall, 15);
        const stub = opponentMatchToStub({ type: 'bot', bot }, myOverall);
        dispatchGame({ type: 'ADMIN_PATCH_NEXT_FIXTURE', partial: { opponent: stub, awayName: stub.name } });
        navigate('/match/quick', { state: { pvpOpponentStub: stub } });
      } catch {
        navigate('/match/quick');
      }
    }
  }, [searching, club, navigate]);

  return (
    <div className="relative w-full">
      <NewsTicker items={tickerItems} />

      <section
        aria-label="Hero do manager"
        className="relative w-full overflow-hidden bg-deep-black"
        style={{
          height: 'min(100svh, 720px)',
          minHeight: 560,
        }}
      >
        {/* Backdrop image */}
        <img
          src={HERO_IMAGE}
          alt=""
          aria-hidden
          className="select-none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: '50% 30%',
            opacity: 0.95,
          }}
          draggable={false}
        />

        {/* Vinheta + gradiente pra texto respirar */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 50% 30%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.35) 60%, rgba(0,0,0,0.85) 100%)',
          }}
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-2/3"
          style={{
            background:
              'linear-gradient(180deg, rgba(13,13,13,0) 0%, rgba(13,13,13,0.55) 55%, rgba(13,13,13,0.95) 100%)',
          }}
        />

        {/* Conteúdo overlay */}
        <div className="relative z-10 flex h-full w-full flex-col justify-end">
          {/* Eyebrow superior — só desktop */}
          <div className="absolute top-0 inset-x-0 hidden lg:flex items-center justify-between px-8 pt-6">
            <div
              className="font-display uppercase text-white/60"
              style={{ fontSize: 11, letterSpacing: '0.42em' }}
            >
              OLEFOOT · {(club?.name ?? 'OLE FC').toUpperCase()} · TIER {tierLabel}
            </div>
            <div
              className="font-display uppercase text-neon-yellow"
              style={{ fontSize: 11, letterSpacing: '0.42em' }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: 9999,
                  background: 'var(--color-neon-yellow)',
                  boxShadow: '0 0 14px rgba(253,225,0,0.85)',
                  marginRight: 10,
                  verticalAlign: 'middle',
                }}
              />
              {statusLabel} {isDebut ? '— AGUARDA 1º JOGO' : ''}
            </div>
          </div>

          {/* Saudação + scoreboard + CTA ancorados ao bottom */}
          <div className="flex flex-col items-center px-5 sm:px-8 pb-7 sm:pb-9 lg:pb-12 text-center">
            <div
              className="font-display uppercase text-neon-yellow mb-2 sm:mb-3"
              style={{ fontSize: 11, letterSpacing: '0.45em' }}
            >
              Olá, manager
            </div>
            <h1
              className="font-serif-hero italic text-white"
              style={{
                fontSize: 'clamp(40px, 8vw, 84px)',
                lineHeight: 0.95,
                letterSpacing: '-0.01em',
                textShadow: '0 4px 28px rgba(0,0,0,0.55)',
              }}
            >
              {greetingName}
            </h1>
            <p
              className="text-white/70 mt-3 sm:mt-4 max-w-[520px]"
              style={{
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {narrative}
            </p>

            <div className="mt-5 sm:mt-6 mx-auto max-w-3xl flex flex-col items-center gap-4">
              {/* Scoreboard chip */}
              <div
                className="w-auto flex items-center justify-center gap-3 sm:gap-5 px-4 sm:px-7 py-3 backdrop-blur-md"
                style={{
                  background: 'rgba(13,13,13,0.6)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderTop: '1px solid rgba(253,225,0,0.35)',
                }}
              >
                <div className="flex flex-col items-end text-right">
                  <div
                    className="font-display uppercase text-white/60"
                    style={{ fontSize: 9, letterSpacing: '0.32em' }}
                  >
                    Casa
                  </div>
                  <div
                    className="font-display uppercase text-white"
                    style={{ fontSize: 14, letterSpacing: '0.18em' }}
                  >
                    {(club?.shortName ?? club?.name ?? 'OLE FC').slice(0, 12).toUpperCase()}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className="font-serif-hero italic text-white"
                    style={{ fontSize: 36, lineHeight: 1 }}
                  >
                    {homeScore}
                  </div>
                  <div
                    className="font-display uppercase text-neon-yellow"
                    style={{ fontSize: 11, letterSpacing: '0.32em' }}
                  >
                    {statusLabel}
                  </div>
                  <div
                    className="font-serif-hero italic text-white"
                    style={{ fontSize: 36, lineHeight: 1 }}
                  >
                    {awayScore}
                  </div>
                </div>
                <div className="flex flex-col items-start text-left">
                  <div
                    className="font-display uppercase text-white/60"
                    style={{ fontSize: 9, letterSpacing: '0.32em' }}
                  >
                    Fora
                  </div>
                  <div
                    className="font-display uppercase text-white"
                    style={{ fontSize: 14, letterSpacing: '0.18em' }}
                  >
                    {awayName.slice(0, 12).toUpperCase()}
                  </div>
                </div>
              </div>

              {/* CTA PRINCIPAL — a chamada da home é o Legends Cup. */}
              <button
                onClick={() => navigate('/legends-cup')}
                className="bg-neon-yellow text-deep-black border-2 border-neon-yellow font-display font-bold uppercase px-10 sm:px-14 py-4 -skew-x-6 hover:bg-neon-yellow/90 hover:-translate-y-0.5 transition-all"
                style={{ fontSize: 'clamp(14px, 2.2vw, 18px)', letterSpacing: '0.2em' }}
              >
                <span className="inline-block skew-x-6">Desafie as lendas</span>
              </button>

              {/*
                Amistoso continua existindo, mas em segundo plano: o fundador quis
                a home apontando pro Cup, não pro matchmaking.
              */}
              <button
                onClick={handleSearchMatch}
                disabled={searching}
                className="flex items-center gap-2 font-display uppercase text-white/45 hover:text-white/80 transition-colors disabled:opacity-60"
                style={{ fontSize: 10, letterSpacing: '0.28em' }}
              >
                {searching ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Buscando adversário...
                  </>
                ) : (
                  'ou buscar partida amistosa'
                )}
              </button>

              {/* Scroll cue */}
              {props.scrollCueTargetId && (
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById(props.scrollCueTargetId!);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="mt-2 flex flex-col items-center gap-1 text-white/50 hover:text-white transition-colors"
                  aria-label="Ver mais"
                >
                  <span
                    className="font-display uppercase"
                    style={{ fontSize: 10, letterSpacing: '0.32em' }}
                  >
                    Continuar
                  </span>
                  <ChevronDown size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
