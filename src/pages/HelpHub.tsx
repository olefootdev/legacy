import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Sparkles, PlayCircle, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTrackScreen } from '@/progression/trackEvent';
import { OlefootAssistant } from '@/components/assistant/OlefootAssistant';
import { OlefootAIAssistant } from '@/components/assistant/OlefootAIAssistant';
import { HubSectionCard } from '@/components/ui/HubSectionCard';
import { FitaRua, Hashtag, SecaoRua } from '@/components/ui';
import { L } from '@/i18n/L';

const quickActions: Array<{
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  href: string;
}> = [
  {
    eyebrow: 'Onboarding',
    title: L('Como jogar', 'How to play'),
    description: L('Do cadastro à primeira vitória.', 'From sign-up to your first win.'),
    cta: L('Ler guia', 'Read guide'),
    href: '/how-to-play',
  },
  {
    eyebrow: L('Aprendizado', 'Learning'),
    title: L('Tutoriais', 'Tutorials'),
    description: L('Um sistema por vez.', 'One system at a time.'),
    cta: L('Começar tutorial', 'Start tutorial'),
    href: '/how-to-play',
  },
];

export function HelpHub() {
  useTrackScreen('screen_help_hub');
  const [showAssistant, setShowAssistant] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);

  const topicos = [
    { to: '/how-to-play', label: L('Como começar no Olefoot?', 'How to start on Olefoot?') },
    { to: '/wallet', label: L('Como funciona a Wallet?', 'How does the Wallet work?') },
    { to: '/how-to-play', label: L('Como melhorar meu time?', 'How to improve my team?') },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-3 pb-24 sm:px-4 sm:pb-32">
      {/* ── HERO — o grito em Anton + a fita das tags ── */}
      <section aria-label={L('Ajuda', 'Help')} className="relative flex flex-col gap-3 pt-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col gap-2"
        >
          <span className="font-prova text-[11.5px] font-bold uppercase tracking-[0.22em] text-mudo">
            — {L('Central de ajuda', 'Help center')}
          </span>
          <h1 className="font-impact uppercase leading-[0.84] text-papel" style={{ fontSize: 'clamp(64px, 20vw, 112px)' }}>
            {L('Ajuda', 'Help')}
          </h1>
          <p className="font-voz text-[clamp(24px,7vw,32px)] leading-[1.05] text-suave">
            {L('Pergunta não ofende.', 'Asking never hurts.')}
          </p>
        </motion.div>
        <FitaRua tags={[L('#guias', '#guides'), L('#tutoriais', '#tutorials'), '#faq']} inclinacao={-2} className="py-2" />
      </section>

      {/* Tutorial Interativo — peça amarela (ação) */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rua-alambrado flex flex-col gap-4 bg-rua p-5 text-asfalto-27 [--alambrado:rgba(13,13,12,.22)] sm:flex-row sm:items-center sm:p-6"
      >
        <Sparkles aria-hidden className="h-8 w-8 shrink-0" strokeWidth={2.5} />
        <div className="min-w-0 flex-1">
          <h2 className="font-impact uppercase leading-[0.95]" style={{ fontSize: 'clamp(30px,8vw,40px)' }}>
            {L('Tutorial Interativo', 'Interactive Tutorial')}
          </h2>
          <span className="mt-1 block font-prova text-[12px] font-bold">{L('#passoapasso', '#stepbystep')}</span>
        </div>
        <button
          type="button"
          onClick={() => setShowAssistant(true)}
          className="inline-flex min-h-[52px] shrink-0 items-center justify-center gap-2 self-start bg-asfalto-27 px-5 font-impact text-[19px] uppercase leading-none text-rua transition-colors hover:bg-concreto sm:self-auto"
        >
          <PlayCircle className="h-5 w-5" aria-hidden />
          {L('Iniciar tutorial', 'Start tutorial')}
        </button>
      </motion.section>

      {/* Assistente IA */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-col gap-4 border-l-[5px] border-rua bg-concreto p-5 sm:flex-row sm:items-center sm:p-6"
      >
        <MessageCircle aria-hidden className="h-8 w-8 shrink-0 text-rua" strokeWidth={2.2} />
        <div className="min-w-0 flex-1">
          <h2 className="font-impact uppercase leading-[0.95] text-papel" style={{ fontSize: 'clamp(28px,7.4vw,36px)' }}>
            {L('Assistente IA', 'AI Assistant')}
          </h2>
          <Hashtag className="mt-1">{L('#dúvidas #ia', '#questions #ai')}</Hashtag>
        </div>
        <button
          type="button"
          onClick={() => setShowAIAssistant(true)}
          className="btn-primary flex min-h-[52px] shrink-0 items-center justify-center gap-2 self-start sm:self-auto"
        >
          <MessageCircle className="h-5 w-5" aria-hidden />
          {L('Perguntar', 'Ask')} <span aria-hidden>→</span>
        </button>
      </motion.section>

      {/* Acesso rápido */}
      <section className="flex flex-col gap-3">
        <SecaoRua label={L('Acesso rápido', 'Quick access')} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {quickActions.map((action, i) => (
            <HubSectionCard
              key={action.title}
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

      {/* Tópicos populares */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex flex-col gap-2"
      >
        <SecaoRua label={L('Tópicos populares', 'Popular topics')} aside={topicos.length} />
        <ul className="flex flex-col">
          {topicos.map((t, i) => (
            <li key={t.label} className="border-b border-linha last:border-b-0">
              <Link to={t.to} className="group flex min-h-[60px] min-w-0 items-center gap-3.5 py-3">
                <span className="w-8 shrink-0 font-spray text-[24px] font-black leading-none text-rua">0{i + 1}</span>
                <span className="min-w-0 flex-1 font-voz text-[22px] leading-[1.05] text-papel">{t.label}</span>
                <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-mudo transition-colors group-hover:text-rua" />
              </Link>
            </li>
          ))}
        </ul>
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
