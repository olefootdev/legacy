import { Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
      {/* ── HERO EDITORIAL — amarelo com watermark cinematográfico (padrão /manager) ── */}
      <section
        aria-label="Competições"
        className="relative w-full max-w-full min-w-0 overflow-hidden bg-neon-yellow -mx-3 sm:-mx-4 lg:-mx-6"
      >
        {/* Watermark gigante — número de vitórias */}
        <div
          className="absolute inset-0 grid place-items-center pointer-events-none select-none overflow-hidden"
          aria-hidden
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={wins}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.04 }}
              transition={{ duration: 0.4 }}
              className="font-serif-hero font-black tabular-nums whitespace-nowrap text-black/[0.04]"
              style={{
                fontSize: 'clamp(180px, 32vw, 460px)',
                lineHeight: '0.85',
                letterSpacing: '-0.05em',
              }}
            >
              {wins}
            </motion.span>
          </AnimatePresence>
        </div>

        {/* Composição editorial centrada vertical */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-14 text-center"
        >
          {/* Eyebrow */}
          <div
            className="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-black mb-4 sm:mb-6 truncate"
          >
            <span className="text-black">{club.name} · Performance</span>
          </div>

          {/* Headline duo: COMPETIÇÃO + vitórias dinâmico */}
          <h1 className="leading-[0.9]">
            <span
              className="block font-bold uppercase text-black"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(2.75rem, 8vw, 6rem)',
                letterSpacing: '0.005em',
              }}
            >
              Competição
            </span>
            <AnimatePresence mode="wait">
              <motion.span
                key={wins}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.35 }}
                className="block italic text-black"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontSize: 'clamp(2.25rem, 7vw, 5rem)',
                  marginTop: '0.04em',
                  letterSpacing: '-0.01em',
                }}
              >
                {wins} vitória{wins !== 1 ? 's' : ''}
              </motion.span>
            </AnimatePresence>
          </h1>

          {/* Régua decorativa */}
          <span aria-hidden className="mx-auto mt-6 block w-16 h-[3px] bg-black" />

          {/* Ícone troféu */}
          <div className="mt-8 flex justify-center">
            <div className="group/trophy relative h-24 w-24 overflow-hidden border-2 border-black/60 bg-black/60 sm:h-28 sm:w-28 transition-all hover:border-black/80 hover:shadow-[0_0_24px_rgba(0,0,0,0.4)]"
                 style={{ borderRadius: 'var(--radius-sm)' }}>
              <div className="flex h-full w-full items-center justify-center">
                <Trophy className="h-12 w-12 sm:h-14 sm:w-14 text-neon-yellow/90" aria-hidden />
              </div>
              <span className="absolute bottom-1 right-1 bg-black px-1.5 py-0.5 font-display text-[9px] font-black uppercase tracking-wider text-neon-yellow"
                    style={{ borderRadius: 'var(--radius-sm)' }}>
                Forma
              </span>
            </div>
          </div>

          {/* Quote italic — CENTERPIECE editorial */}
          <AnimatePresence mode="wait">
            <motion.blockquote
              key={`wins-${wins}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.35, delay: 0.05 }}
              className="ole-headline-italic mt-7 sm:mt-9 text-black/85 mx-auto max-w-xl leading-snug"
              style={{ fontSize: 'clamp(15px, 2vw, 19px)' }}
            >
              {wins === 0 && '"a primeira vitória está próxima — cada jogo é uma oportunidade."'}
              {wins >= 1 && wins < 5 && '"construindo momento — vitória por vitória."'}
              {wins >= 5 && wins < 15 && '"ritmo competitivo — o time está a crescer."'}
              {wins >= 15 && wins < 30 && '"performance sólida — resultados consistentes."'}
              {wins >= 30 && '"dominância absoluta — poucos chegam aqui."'}
            </motion.blockquote>
          </AnimatePresence>

          {/* Subtítulo — dados vivos */}
          <p
            className="mt-3 text-black/60 mx-auto max-w-md"
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'clamp(0.85rem, 1vw, 0.95rem)',
              lineHeight: 1.55,
            }}
          >
            {totalMatches} partida{totalMatches !== 1 ? 's' : ''} · forma {formStr} · {formatExp(finance.ole)} EXP
          </p>

          {/* Stats strip — 3 métricas principais */}
          <div className="mt-8 sm:mt-10 grid grid-cols-3 gap-2 sm:gap-3 max-w-lg mx-auto px-2">
            <div className="bg-black px-2 py-3 sm:px-4 sm:py-4 text-center min-w-0"
                 style={{ borderRadius: 'var(--radius-sm)' }}>
              <p
                className="font-serif-hero text-neon-yellow tabular-nums leading-none truncate"
                style={{
                  fontWeight: 700,
                  fontSize: 'clamp(20px, 4vw, 36px)',
                }}
              >
                {wins}
              </p>
              <p className="mt-1.5 text-white/65 uppercase tracking-[0.18em] text-[9px] sm:text-[10px] font-medium">
                Vitórias
              </p>
            </div>
            <div className="bg-black px-2 py-3 sm:px-4 sm:py-4 text-center min-w-0"
                 style={{ borderRadius: 'var(--radius-sm)' }}>
              <p
                className="font-serif-hero text-neon-yellow tabular-nums leading-none truncate"
                style={{
                  fontWeight: 700,
                  fontSize: 'clamp(20px, 4vw, 36px)',
                }}
              >
                {draws}
              </p>
              <p className="mt-1.5 text-white/65 uppercase tracking-[0.18em] text-[9px] sm:text-[10px] font-medium">
                Empates
              </p>
            </div>
            <div className="bg-black px-2 py-3 sm:px-4 sm:py-4 text-center min-w-0"
                 style={{ borderRadius: 'var(--radius-sm)' }}>
              <p
                className="font-serif-hero text-neon-yellow tabular-nums leading-none truncate"
                style={{
                  fontWeight: 700,
                  fontSize: 'clamp(20px, 4vw, 36px)',
                }}
              >
                {losses}
              </p>
              <p className="mt-1.5 text-white/65 uppercase tracking-[0.18em] text-[9px] sm:text-[10px] font-medium">
                Derrotas
              </p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Cards de seção — Sprint B Legacy Tech */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <HubSectionCard
          to="/competicao/ligas"
          eyebrow="Competições"
          title="Ligas"
          description="Competições ativas e classificação. Acompanha a tua posição na tabela e os próximos adversários."
          cta="Ver ligas"
          rail="bg-neon-yellow"
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
          rail="bg-cyan-300"
          delay={0.2}
        />
        <HubSectionCard
          to="/competicao/ranking"
          eyebrow="Mundial"
          title="Ranking"
          description="Posição mundial por EXP. Compara o teu desempenho com outros managers e clubes."
          cta="Ver ranking"
          rail="bg-emerald-400"
          delay={0.3}
        />
        <HubSectionCard
          to="/competicao/standings"
          eyebrow="PvP"
          title="Liga Rápida & Clássica"
          description="Tabela de pontos das partidas vs managers. Vitória 3 pts, empate 1 pt."
          cta="Ver classificação"
          rail="bg-neon-yellow"
          delay={0.4}
        />
        <HubSectionCard
          to="/liga-global/registro"
          eyebrow="Global"
          title="Liga Global"
          description="Competição mundial com 32 times. Playoffs, divisões e promoção/rebaixamento."
          cta="Entrar na liga"
          rail="bg-fuchsia-400"
          delay={0.5}
        />
        <HubSectionCard
          to="/liga-global/hoje"
          eyebrow="Coroa do Dia"
          title="Mata-Mata Diário"
          description="Classificação até as 19h, mata-mata com pênaltis e um campeão por dia. Mais coroas na temporada = título paralelo."
          cta="Ver a corrida de hoje"
          rail="bg-neon-yellow"
          delay={0.6}
        />
        <HubSectionCard
          to="/rewards"
          eyebrow="Premium"
          title="Liga Premiada"
          description="Crie ou entre em torneios mata-mata com pote em EXP. Top 4 premiados. Convide amigos e ganhe 10% do pote como criador."
          cta="Ver ligas premiadas"
          rail="bg-[#FFD700]"
          delay={0.7}
        />
      </section>
    </div>
  );
}
