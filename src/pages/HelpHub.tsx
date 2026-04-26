import { Link } from 'react-router-dom';
import { GraduationCap, HelpCircle, BookOpen, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTrackScreen } from '@/progression/trackEvent';

const quickActions = [
  {
    icon: GraduationCap,
    label: 'Como jogar',
    description: 'Guia completo do jogo',
    href: '/how-to-play',
    color: 'neon-yellow',
  },
  {
    icon: HelpCircle,
    label: 'FAQ',
    description: 'Perguntas frequentes',
    href: '/wallet/faq',
    color: 'cyan-400',
  },
  {
    icon: BookOpen,
    label: 'Tutoriais',
    description: 'Aprenda passo a passo',
    href: '/how-to-play',
    color: 'emerald-400',
  },
];

export function HelpHub() {
  useTrackScreen('screen_help_hub');

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 sm:space-y-10">
      {/* ── HERO BVB — amarelo + watermark + tipografia épica ── */}
      <section
        aria-label="Ajuda"
        className="relative w-full overflow-hidden bg-neon-yellow -mx-3 sm:-mx-4 lg:-mx-8 rounded-sm"
      >
        {/* Watermark gigante */}
        <div
          className="absolute inset-0 grid place-items-center pointer-events-none select-none overflow-hidden"
          aria-hidden
        >
          <AnimatePresence mode="wait">
            <motion.span
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.04 }}
              transition={{ duration: 0.4 }}
              className="font-display font-black uppercase whitespace-nowrap text-black/[0.04]"
              style={{
                fontSize: 'clamp(120px, 22vw, 380px)',
                lineHeight: '0.85',
                letterSpacing: '-0.02em',
              }}
            >
              ?
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
            <span className="!text-black">Central de ajuda</span>
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
              Ajuda
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
              Olefoot
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
            "aprenda a dominar o jogo, passo a passo."
          </motion.blockquote>
          <p
            className="mt-3 text-black/60 mx-auto max-w-md"
            style={{ fontFamily: 'var(--font-sans)', fontSize: 'clamp(0.85rem, 1vw, 0.95rem)', lineHeight: 1.55 }}
          >
            Guias, tutoriais e perguntas frequentes
          </p>
        </motion.div>
      </section>

      {/* Quick Actions Grid */}
      <section>
        <h2 className="text-sm font-display font-bold uppercase tracking-wider text-white/70 mb-4 px-1">
          Acesso rápido
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

      {/* Help Topics */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-[var(--color-card)] border border-white/8 rounded-sm p-6"
      >
        <h2 className="text-sm font-display font-bold uppercase tracking-wider text-white/70 mb-4">
          Tópicos populares
        </h2>
        <div className="space-y-3">
          <Link to="/how-to-play" className="block p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-neon-yellow/40 rounded transition-all">
            <div className="flex items-center justify-between">
              <span className="text-white font-display font-bold">Como começar no Olefoot?</span>
              <ChevronRight className="w-5 h-5 text-white/30" />
            </div>
          </Link>
          <Link to="/wallet/faq" className="block p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-neon-yellow/40 rounded transition-all">
            <div className="flex items-center justify-between">
              <span className="text-white font-display font-bold">Como funciona a Wallet?</span>
              <ChevronRight className="w-5 h-5 text-white/30" />
            </div>
          </Link>
          <Link to="/how-to-play" className="block p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-neon-yellow/40 rounded transition-all">
            <div className="flex items-center justify-between">
              <span className="text-white font-display font-bold">Como melhorar meu time?</span>
              <ChevronRight className="w-5 h-5 text-white/30" />
            </div>
          </Link>
        </div>
      </motion.section>
    </div>
  );
}
