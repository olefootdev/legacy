import { Link } from 'react-router-dom';
import { Trophy, Calendar, TrendingUp, Globe, Target, Medal, Flag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/game/store';
import { useTrackScreen } from '@/progression/trackEvent';
import { formatExp } from '@/systems/economy';

export function CompetitionHub() {
  useTrackScreen('screen_competition_hub');
  const results = useGameStore((s) => s.results);
  const fixture = useGameStore((s) => s.nextFixture);
  const club = useGameStore((s) => s.club);
  const finance = useGameStore((s) => s.finance);

  const wins = results.filter((r) => r.result === 'win').length;
  const draws = results.filter((r) => r.result === 'draw').length;
  const losses = results.filter((r) => r.result === 'loss').length;
  const totalMatches = results.length;

  // Forma recente (últimos 5)
  const last5 = results.slice(0, 5);
  const formStr = last5.length > 0
    ? last5.map((r) => r.result === 'win' ? 'V' : r.result === 'draw' ? 'E' : 'D').join(' ')
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

      {/* CARD HEROES — padrão /store: 4 cards com botões amarelos */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Card 1: Ligas */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Link
            to="/competicao/ligas"
            className="group block bg-[var(--color-card)] border border-white/8 hover:border-neon-yellow/40 rounded-sm overflow-hidden transition-all hover:scale-[1.01]"
          >
            <div className="p-6 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div className="p-3 rounded bg-neon-yellow/10 border border-neon-yellow/20">
                  <Trophy className="w-6 h-6 text-neon-yellow" />
                </div>
                <span
                  className="text-[10px] font-bold uppercase tracking-widest text-neon-yellow/70"
                  style={{ fontFamily: 'var(--font-ui)' }}
                >
                  Competições
                </span>
              </div>
              <div>
                <h3 className="font-display font-bold text-white text-xl mb-2 group-hover:text-neon-yellow transition-colors">
                  Ligas
                </h3>
                <p className="text-sm text-white/55 leading-relaxed">
                  Competições ativas e classificação. Acompanha a tua posição na tabela e os próximos adversários.
                </p>
              </div>
              <div className="mt-auto pt-2">
                <span
                  className="inline-flex items-center gap-2 bg-neon-yellow text-black px-5 py-2.5 font-bold uppercase tracking-[0.2em] text-[11px] group-hover:bg-white transition-colors shadow-[0_4px_12px_rgba(253,225,0,0.25)]"
                  style={{
                    fontFamily: 'var(--font-display)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  Ver ligas
                </span>
              </div>
            </div>
          </Link>
        </motion.div>

        {/* Card 2: Calendário */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Link
            to="/competicao/calendario"
            className="group block bg-[var(--color-card)] border border-white/8 hover:border-neon-yellow/40 rounded-sm overflow-hidden transition-all hover:scale-[1.01]"
          >
            <div className="p-6 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div className="p-3 rounded bg-blue-400/10 border border-blue-400/20">
                  <Calendar className="w-6 h-6 text-blue-400" />
                </div>
                <span
                  className="text-[10px] font-bold uppercase tracking-widest text-blue-400/70"
                  style={{ fontFamily: 'var(--font-ui)' }}
                >
                  Agenda
                </span>
              </div>
              <div>
                <h3 className="font-display font-bold text-white text-xl mb-2 group-hover:text-neon-yellow transition-colors">
                  Calendário
                </h3>
                <p className="text-sm text-white/55 leading-relaxed">
                  {fixture?.opponent ? `Próximo: ${fixture.opponent.name} · ${fixture.kickoffLabel}` : 'Sem partidas agendadas no momento.'}
                </p>
              </div>
              <div className="mt-auto pt-2">
                <span
                  className="inline-flex items-center gap-2 bg-neon-yellow text-black px-5 py-2.5 font-bold uppercase tracking-[0.2em] text-[11px] group-hover:bg-white transition-colors shadow-[0_4px_12px_rgba(253,225,0,0.25)]"
                  style={{
                    fontFamily: 'var(--font-display)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  Ver calendário
                </span>
              </div>
            </div>
          </Link>
        </motion.div>

        {/* Card 3: Ranking */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Link
            to="/competicao/ranking"
            className="group block bg-[var(--color-card)] border border-white/8 hover:border-neon-yellow/40 rounded-sm overflow-hidden transition-all hover:scale-[1.01]"
          >
            <div className="p-6 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div className="p-3 rounded bg-emerald-400/10 border border-emerald-400/20">
                  <TrendingUp className="w-6 h-6 text-emerald-400" />
                </div>
                <span
                  className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/70"
                  style={{ fontFamily: 'var(--font-ui)' }}
                >
                  Mundial
                </span>
              </div>
              <div>
                <h3 className="font-display font-bold text-white text-xl mb-2 group-hover:text-neon-yellow transition-colors">
                  Ranking
                </h3>
                <p className="text-sm text-white/55 leading-relaxed">
                  Posição mundial por EXP. Compara o teu desempenho com outros managers e clubes.
                </p>
              </div>
              <div className="mt-auto pt-2">
                <span
                  className="inline-flex items-center gap-2 bg-neon-yellow text-black px-5 py-2.5 font-bold uppercase tracking-[0.2em] text-[11px] group-hover:bg-white transition-colors shadow-[0_4px_12px_rgba(253,225,0,0.25)]"
                  style={{
                    fontFamily: 'var(--font-display)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  Ver ranking
                </span>
              </div>
            </div>
          </Link>
        </motion.div>

        {/* Card 4: Liga Global */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Link
            to="/liga-global/registro"
            className="group block bg-[var(--color-card)] border border-white/8 hover:border-neon-yellow/40 rounded-sm overflow-hidden transition-all hover:scale-[1.01]"
          >
            <div className="p-6 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div className="p-3 rounded bg-neon-yellow/10 border border-neon-yellow/20">
                  <Globe className="w-6 h-6 text-neon-yellow" />
                </div>
                <span
                  className="text-[10px] font-bold uppercase tracking-widest text-neon-yellow/70"
                  style={{ fontFamily: 'var(--font-ui)' }}
                >
                  Global
                </span>
              </div>
              <div>
                <h3 className="font-display font-bold text-white text-xl mb-2 group-hover:text-neon-yellow transition-colors">
                  Liga Global
                </h3>
                <p className="text-sm text-white/55 leading-relaxed">
                  Competição mundial com 32 times. Playoffs, divisões e promoção/rebaixamento.
                </p>
              </div>
              <div className="mt-auto pt-2">
                <span
                  className="inline-flex items-center gap-2 bg-neon-yellow text-black px-5 py-2.5 font-bold uppercase tracking-[0.2em] text-[11px] group-hover:bg-white transition-colors shadow-[0_4px_12px_rgba(253,225,0,0.25)]"
                  style={{
                    fontFamily: 'var(--font-display)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  Entrar na liga
                </span>
              </div>
            </div>
          </Link>
        </motion.div>
      </section>
    </div>
  );
}
