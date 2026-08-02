import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Sparkles, PlayCircle, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTrackScreen } from '@/progression/trackEvent';
import { OlefootAssistant } from '@/components/assistant/OlefootAssistant';
import { OlefootAIAssistant } from '@/components/assistant/OlefootAIAssistant';
import { HubSectionCard } from '@/components/ui/HubSectionCard';

const quickActions: Array<{
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  href: string;
}> = [
  {
    eyebrow: 'Onboarding',
    title: 'Como jogar',
    description: 'Guia completo do jogo. Do cadastro à primeira vitória.',
    cta: 'Ler guia',
    href: '/how-to-play',
  },
  {
    eyebrow: 'Aprendizado',
    title: 'Tutoriais',
    description: 'Sequência de tutoriais visuais para dominar cada sistema.',
    cta: 'Começar tutorial',
    href: '/how-to-play',
  },
];

export function HelpHub() {
  useTrackScreen('screen_help_hub');
  const [showAssistant, setShowAssistant] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 sm:space-y-10 px-3 sm:px-4 lg:px-8 pb-24 sm:pb-32">
      {/* ── HERO BVB — amarelo + watermark + tipografia épica ── */}
      <section
        aria-label="Ajuda"
        className="relative w-full overflow-hidden bg-neon-yellow -mx-3 sm:-mx-4 lg:-mx-8 rounded-sm"
      >
        <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 px-5 sm:px-8"
        style={{ paddingBlock: 'clamp(28px, 6vw, 52px)' }}
      >
        <span className="ole-eyebrow-poster" data-on="yellow" style={{ fontSize: '12px' }}>
          Central de ajuda
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
          Ajuda
        </h1>
        <p
          className="mt-3"
          style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'rgba(13,13,13,0.62)' }}
        >
          Guias, tutoriais e perguntas frequentes
        </p>
        </motion.div>
      </section>

      {/* Tutorial Interativo CTA */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="relative overflow-hidden rounded-lg border-2 border-neon-yellow/40 bg-gradient-to-br from-neon-yellow/10 via-black to-black p-6 sm:p-8"
      >
        {/* Diagonal accent */}
        <div
          className="absolute -right-12 -top-12 h-48 w-48 bg-neon-yellow opacity-[0.08]"
          style={{ transform: 'rotate(34deg) skewX(-12deg)' }}
          aria-hidden
        />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-neon-yellow/20 border-2 border-neon-yellow/40 shadow-[0_0_20px_rgba(253,225,0,0.3)]">
            <Sparkles className="h-8 w-8 text-neon-yellow" strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-xl sm:text-2xl font-black uppercase tracking-wide text-neon-yellow mb-2">
              Tutorial Interativo
            </h2>
            <p className="text-sm sm:text-base text-white/70 leading-relaxed">
              Aprenda a dominar o Olefoot com nosso assistente passo a passo.
              Guias visuais, dicas práticas e acesso direto às funcionalidades.
            </p>
          </div>
          <button
            onClick={() => setShowAssistant(true)}
            className="shrink-0 flex items-center gap-2 rounded-sm bg-neon-yellow px-5 py-3 font-display text-sm font-bold uppercase tracking-wider text-black transition-all hover:bg-white hover:scale-105 shadow-[0_0_20px_rgba(253,225,0,0.4)]"
          >
            <PlayCircle className="h-5 w-5" />
            Iniciar tutorial
          </button>
        </div>
      </motion.section>

      {/* Assistente IA CTA */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="ole-poster ole-rail relative overflow-hidden p-6 sm:p-8"
      >
        <div
          className="absolute -right-12 -top-12 h-48 w-48 bg-neon-yellow opacity-[0.06]"
          style={{ transform: 'rotate(34deg) skewX(-12deg)' }}
          aria-hidden
        />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-neon-yellow/40 bg-neon-yellow/12">
            <MessageCircle className="h-7 w-7 text-neon-yellow" strokeWidth={2.2} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="mb-2 font-impact uppercase text-white" style={{ fontSize: 'clamp(22px,5vw,30px)', lineHeight: 0.9 }}>
              Assistente IA
            </h2>
            <p className="text-sm sm:text-base text-white/70 leading-relaxed">
              Tire dúvidas sobre o jogo.
            </p>
          </div>
          <button
            onClick={() => setShowAIAssistant(true)}
            className="shrink-0 inline-flex items-center gap-2 rounded-md bg-neon-yellow px-5 py-3 font-display text-[11px] font-black uppercase tracking-[0.14em] text-black transition-transform hover:scale-[1.02]" style={{ boxShadow: '5px 5px 0 rgba(237,235,228,0.14)' }}
          >
            <MessageCircle className="h-5 w-5" />
            Perguntar
          </button>
        </div>
      </motion.section>

      {/* Quick Actions — Sprint B Legacy Tech */}
      <section>
        <h2 className="text-sm font-display font-bold uppercase tracking-[0.22em] text-white/70 mb-4 px-1">
          Acesso rápido
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickActions.map((action, i) => (
            <HubSectionCard
              key={action.href}
              to={action.href}
              eyebrow={action.eyebrow}
              title={action.title}
              description={action.description}
              cta={action.cta}
              destaque={i === 0}
              delay={i * 0.08}
            />
          ))}
        </div>
      </section>

      {/* Help Topics */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-[var(--color-card)] border border-white/8 rounded-sm p-6 mb-8"
      >
        <h2 className="text-sm font-display font-bold uppercase tracking-wider text-white/70 mb-6">
          Tópicos populares
        </h2>
        <div className="space-y-4">
          <Link to="/how-to-play" className="block p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-neon-yellow/40 rounded transition-all">
            <div className="flex items-center justify-between">
              <span className="text-white font-display font-bold">Como começar no Olefoot?</span>
              <ChevronRight className="w-5 h-5 text-white/30" />
            </div>
          </Link>
          <Link to="/wallet" className="block p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-neon-yellow/40 rounded transition-all">
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

      {/* Assistente flutuante */}
      <AnimatePresence>
        {showAssistant && (
          <OlefootAssistant
            autoOpen
            onComplete={() => {
              setShowAssistant(false);
              // Opcional: mostrar toast de conclusão
            }}
          />
        )}
      </AnimatePresence>

      {/* Assistente IA (chat flutuante) */}
      {showAIAssistant && <OlefootAIAssistant autoOpen />}
    </div>
  );
}
