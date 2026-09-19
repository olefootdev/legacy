import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Sparkles, PlayCircle, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTrackScreen } from '@/progression/trackEvent';
import { OlefootAssistant } from '@/components/assistant/OlefootAssistant';
import { OlefootAIAssistant } from '@/components/assistant/OlefootAIAssistant';
import { HubSectionCard } from '@/components/ui/HubSectionCard';
import { Hashtag, SecaoVolt } from '@/components/ui';

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
    description: 'Do cadastro à primeira vitória.',
    cta: 'Ler guia',
    href: '/how-to-play',
  },
  {
    eyebrow: 'Aprendizado',
    title: 'Tutoriais',
    description: 'Um sistema por vez.',
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
      {/* ── HERO — volt chapado + título em Anton ── */}
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
        <Hashtag className="mt-3 text-[12px] text-deep-black">#guias #tutoriais #faq</Hashtag>
        </motion.div>
      </section>

      {/* Tutorial Interativo CTA */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="border border-white/10 bg-panel p-6 sm:p-8"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center bg-neon-yellow text-black">
            <Sparkles className="h-7 w-7" strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-impact uppercase leading-[1.05] text-white" style={{ fontSize: 'clamp(24px,5vw,32px)' }}>
              Tutorial Interativo
            </h2>
            <Hashtag className="mt-1.5">#passoapasso</Hashtag>
          </div>
          <button
            onClick={() => setShowAssistant(true)}
            className="btn-primary flex h-12 shrink-0 items-center gap-2"
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
        className="ole-poster p-6 sm:p-8"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center border border-white/16 bg-deep-black">
            <MessageCircle className="h-7 w-7 text-neon-yellow" strokeWidth={2.2} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-impact uppercase leading-[1.05] text-white" style={{ fontSize: 'clamp(24px,5vw,32px)' }}>
              Assistente IA
            </h2>
            <Hashtag className="mt-1.5">#dúvidas #ia</Hashtag>
          </div>
          <button
            onClick={() => setShowAIAssistant(true)}
            className="btn-primary flex h-12 shrink-0 items-center gap-2"
          >
            <MessageCircle className="h-5 w-5" />
            Perguntar
          </button>
        </div>
      </motion.section>

      {/* Quick Actions — Sprint B Legacy Tech */}
      <section>
        <SecaoVolt label="Acesso rápido" className="mb-4" />
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
        className="mb-8"
      >
        <SecaoVolt label="Tópicos populares" className="mb-4" />
        <div className="space-y-2.5">
          <Link to="/how-to-play" className="block border border-white/10 bg-panel p-4 transition-colors hover:border-white/30">
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate font-impact text-[17px] uppercase leading-[1.1] text-white">Como começar no Olefoot?</span>
              <ChevronRight className="h-5 w-5 shrink-0 text-cimento" />
            </div>
          </Link>
          <Link to="/wallet" className="block border border-white/10 bg-panel p-4 transition-colors hover:border-white/30">
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate font-impact text-[17px] uppercase leading-[1.1] text-white">Como funciona a Wallet?</span>
              <ChevronRight className="h-5 w-5 shrink-0 text-cimento" />
            </div>
          </Link>
          <Link to="/how-to-play" className="block border border-white/10 bg-panel p-4 transition-colors hover:border-white/30">
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate font-impact text-[17px] uppercase leading-[1.1] text-white">Como melhorar meu time?</span>
              <ChevronRight className="h-5 w-5 shrink-0 text-cimento" />
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
