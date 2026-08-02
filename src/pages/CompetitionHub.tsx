import { motion } from 'framer-motion';
import { useGameStore } from '@/game/store';
import { useTrackScreen } from '@/progression/trackEvent';
import { formatExp } from '@/systems/economy';
import { HubSectionCard } from '@/components/ui/HubSectionCard';

export function CompetitionHub() {
  useTrackScreen('screen_competition_hub');
  const fixture = useGameStore((s) => s.nextFixture);
  const club = useGameStore((s) => s.club);
  const finance = useGameStore((s) => s.finance);
  const globalLeagueMVP = useGameStore((s) => s.globalLeagueMVP);
  const managerId = useGameStore((s) => s.userSettings?.managerProfile?.email);
  const myTeam = globalLeagueMVP?.teams.find((t) => t.managerId === managerId);

  const wins = (myTeam?.wins ?? 0) + (myTeam?.playoffWins ?? 0);
  const draws = (myTeam?.draws ?? 0) + (myTeam?.playoffDraws ?? 0);
  const losses = (myTeam?.losses ?? 0) + (myTeam?.playoffLosses ?? 0);
  const totalMatches = (myTeam?.matchesPlayed ?? 0) + (myTeam?.playoffMatchesPlayed ?? 0);

  const form = myTeam?.recentForm ?? [];
  const formStr = form.length > 0
    ? form.slice(0, 5).map((r) => r === 'W' ? 'V' : r === 'D' ? 'E' : 'D').join(' ')
    : '—';

  return (
    <div className="mx-auto min-w-0 w-full max-w-6xl space-y-6 overflow-x-hidden px-3 sm:px-4 lg:px-6 pb-6 md:pb-8">
      {/* ── HERO — bloco amarelo no layer final ────────────────────────────
          A versão anterior empilhava watermark gigante, régua decorativa,
          troféu numa caixa, uma frase motivacional que trocava por faixa de
          vitórias e um subtítulo — tudo antes do primeiro dado útil. Sobrou o
          que informa: quem é o clube e como ele está indo. V/E/D em Anton
          tabular; a serifa itálica saiu (é assinatura de nome de lenda). */}
      <section
        aria-label="Competições"
        className="relative w-full max-w-full min-w-0 overflow-hidden bg-neon-yellow -mx-3 sm:-mx-4 lg:-mx-6"
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 px-4 sm:px-6 lg:px-8"
          style={{ paddingBlock: 'clamp(28px, 6vw, 52px)' }}
        >
          <span className="ole-eyebrow-poster" data-on="yellow" style={{ fontSize: '12px' }}>
            {club.name}
          </span>

          <h1
            className="mt-2 font-impact uppercase"
            style={{
              color: 'var(--color-deep-black)',
              fontSize: 'clamp(44px, 12vw, 92px)',
              lineHeight: 0.84,
              letterSpacing: '-0.01em',
            }}
          >
            Competição
          </h1>

          <p
            className="mt-3"
            style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'rgba(13,13,13,0.62)' }}
          >
            {totalMatches} partida{totalMatches !== 1 ? 's' : ''} · forma {formStr} · {formatExp(finance.ole)} EXP
          </p>

          {/* V/E/D — o placar da temporada. Blocos pretos sobre o amarelo. */}
          <div className="mt-6 grid max-w-lg grid-cols-3 gap-2 sm:gap-3">
            {[
              { n: wins, l: 'Vitórias' },
              { n: draws, l: 'Empates' },
              { n: losses, l: 'Derrotas' },
            ].map((s) => (
              <div
                key={s.l}
                className="min-w-0 bg-black px-3 py-3 sm:px-4 sm:py-4"
                style={{ borderRadius: 'var(--radius-sm)' }}
              >
                <p
                  className="font-impact tabular-nums leading-none text-neon-yellow"
                  style={{ fontSize: 'clamp(24px, 5vw, 38px)' }}
                >
                  {s.n}
                </p>
                <p
                  className="mt-1.5 font-display font-bold uppercase text-white/65"
                  style={{ fontSize: '9px', letterSpacing: '0.18em' }}
                >
                  {s.l}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Seções da competição — a primeira vem em destaque amarelo. */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <HubSectionCard
          to="/competicao/ligas"
          eyebrow="Competições"
          title="Ligas"
          description="Competições ativas e classificação. Acompanha a tua posição na tabela e os próximos adversários."
          cta="Ver ligas"
          destaque
          delay={0.1}
        />
        <HubSectionCard
          to="/competicao/calendario"
          eyebrow="Agenda"
          title="Calendário"
          description={
            fixture?.opponent
              ? `Próximo: ${fixture.opponent.name} · ${fixture.kickoffLabel}`
              : 'Sem partidas agendadas no momento.'
          }
          cta="Ver calendário"
          delay={0.2}
        />
        <HubSectionCard
          to="/competicao/ranking"
          eyebrow="Mundial"
          title="Ranking"
          description="Posição mundial por EXP. Compara o teu desempenho com outros managers e clubes."
          cta="Ver ranking"
          delay={0.3}
        />
        <HubSectionCard
          to="/competicao/standings"
          eyebrow="PvP"
          title="Liga Rápida & Clássica"
          description="Tabela de pontos das partidas vs managers. Vitória 3 pts, empate 1 pt."
          cta="Ver classificação"
          delay={0.4}
        />
        <HubSectionCard
          to="/liga-global/registro"
          eyebrow="Global"
          title="Liga Global"
          description="Competição mundial com 32 times. Playoffs, divisões e promoção/rebaixamento."
          cta="Entrar na liga"
          delay={0.5}
        />
        <HubSectionCard
          to="/liga-global/hoje"
          eyebrow="Coroa do Dia"
          title="Mata-Mata Diário"
          description="Classificação até as 19h, mata-mata com pênaltis e um campeão por dia. Mais coroas na temporada = título paralelo."
          cta="Ver a corrida de hoje"
          delay={0.6}
        />
        <HubSectionCard
          to="/rewards"
          eyebrow="Premium"
          title="Liga Premiada"
          description="Crie ou entre em torneios mata-mata com pote em EXP. Top 4 premiados. Convide amigos e ganhe 10% do pote como criador."
          cta="Ver ligas premiadas"
          delay={0.7}
        />
      </section>
    </div>
  );
}
