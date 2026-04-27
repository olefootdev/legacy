import { Link } from 'react-router-dom';
import { Users, GraduationCap, Building2, Dumbbell, ChevronRight, UserCog } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useGameStore } from '@/game/store';
import { useTrackScreen } from '@/progression/trackEvent';

const quickActions = [
  {
    icon: Users,
    label: 'Elenco',
    description: 'Gerir jogadores e formação',
    href: '/team',
    color: 'neon-yellow',
  },
  {
    icon: Dumbbell,
    label: 'Treino',
    description: 'Desenvolver habilidades',
    href: '/team/treino',
    color: 'emerald-400',
  },
  {
    icon: UserCog,
    label: 'Staff',
    description: 'Profissionais e coach',
    href: '/team/staff',
    color: 'violet-400',
  },
  {
    icon: GraduationCap,
    label: 'Academia',
    description: 'Jovens promessas',
    href: '/city/youth-prospects',
    color: 'cyan-400',
  },
  {
    icon: Building2,
    label: 'Estruturas',
    description: 'Instalações do clube',
    href: '/city',
    color: 'fuchsia-400',
  },
];

export function ClubHub() {
  useTrackScreen('screen_club_hub');
  const club = useGameStore((s) => s.club);
  const players = useGameStore((s) => s.players);
  const playerCount = Object.keys(players).length;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 sm:space-y-10">
      {/* ── HERO BVB — amarelo + watermark + tipografia épica ── */}
      <section
        aria-label="Clube"
        className="relative w-full overflow-hidden bg-neon-yellow -mx-3 sm:-mx-4 lg:-mx-8 rounded-sm"
      >
        {/* Watermark gigante do nome do clube */}
        <div
          className="absolute inset-0 grid place-items-center pointer-events-none select-none overflow-hidden"
          aria-hidden
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={club.name}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.04 }}
              transition={{ duration: 0.4 }}
              className="font-display font-black uppercase whitespace-nowrap text-black/[0.04]"
              style={{
                fontSize: 'clamp(80px, 18vw, 280px)',
                lineHeight: '0.85',
                letterSpacing: '-0.02em',
              }}
            >
              {club.shortName ?? club.name.slice(0, 3).toUpperCase()}
            </motion.span>
          </AnimatePresence>
        </div>

        {/* Composição editorial */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 mx-auto max-w-3xl px-5 sm:px-8 py-10 sm:py-14 text-center"
        >
          <div className="ole-eyebrow !text-black mb-5 sm:mb-6" style={{ fontFamily: 'var(--font-ui)' }}>
            <span className="!text-black">Gestão do clube</span>
          </div>
          <h1 className="leading-[0.9]">
            <span
              className="block font-bold uppercase text-black"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(2.75rem, 8vw, 6rem)',
                letterSpacing: '0.005em',
              }}
            >
              Clube
            </span>
            <motion.span
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.1 }}
              className="block italic text-black"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontSize: 'clamp(2.25rem, 7vw, 5rem)',
                marginTop: '0.04em',
                letterSpacing: '-0.01em',
              }}
            >
              {club.name}
            </motion.span>
          </h1>
          <span aria-hidden className="mx-auto mt-6 block w-16 h-[3px] bg-black" />
          <motion.blockquote
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.15 }}
            className="ole-headline-italic mt-7 sm:mt-9 text-black/85 mx-auto max-w-xl leading-snug"
            style={{ fontSize: 'clamp(15px, 2vw, 19px)' }}
          >
            "gerir elenco, treinar jogadores, desenvolver estruturas."
          </motion.blockquote>
          <p
            className="mt-3 text-black/60 mx-auto max-w-md"
            style={{ fontFamily: 'var(--font-sans)', fontSize: 'clamp(0.85rem, 1vw, 0.95rem)', lineHeight: 1.55 }}
          >
            {playerCount} jogadores no plantel · {club.shortName ?? club.name.slice(0, 3).toUpperCase()}
          </p>
        </motion.div>
      </section>

      {/* Quick Actions Grid */}
      <section>
        <h2 className="text-sm font-display font-bold uppercase tracking-wider text-white/70 mb-4 px-1">
          Acesso rápido
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {quickActions.map((action, i) => (
            <motion.div
              key={action.href}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Link
                to={action.href}
                className="group block bg-[var(--color-card)] border border-white/8 hover:border-neon-yellow/40 rounded-sm p-6 transition-all hover:scale-[1.01]"
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded bg-${action.color}/10 border border-${action.color}/20`}>
                    <action.icon className={`w-6 h-6 text-${action.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-bold text-white text-lg mb-1 group-hover:text-neon-yellow transition-colors">
                      {action.label}
                    </h3>
                    <p className="text-sm text-white/55">{action.description}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-neon-yellow transition-colors" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Stats Overview */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-[var(--color-card)] border border-white/8 rounded-sm p-6"
      >
        <h2 className="text-sm font-display font-bold uppercase tracking-wider text-white/70 mb-4">
          Visão geral
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-3xl font-display font-black text-neon-yellow mb-1">{playerCount}</div>
            <div className="text-xs text-white/55 uppercase tracking-wider">Jogadores</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-display font-black text-white mb-1">—</div>
            <div className="text-xs text-white/55 uppercase tracking-wider">Staff</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-display font-black text-white mb-1">—</div>
            <div className="text-xs text-white/55 uppercase tracking-wider">Academia</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-display font-black text-white mb-1">—</div>
            <div className="text-xs text-white/55 uppercase tracking-wider">Estruturas</div>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
