import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp } from 'lucide-react';
import { useGameStore } from '@/game/store';
import { useTrackScreen } from '@/progression/trackEvent';
import { HubSectionCard } from '@/components/ui/HubSectionCard';
import { StatTile } from '@/components/ui/StatTile';
import { managerScoreToday } from '@/systems/managerScore/managerScore';

/** Sprint B Legacy Tech: rail colorido por categoria, sem ícones soltos. */
const quickActions: Array<{
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  href: string;
  rail: string;
}> = [
  {
    eyebrow: 'Plantel',
    title: 'Elenco',
    description: 'Gerir jogadores, formação tática e escalação titular.',
    cta: 'Abrir elenco',
    href: '/clube/elenco',
    rail: 'bg-neon-yellow',
  },
  {
    eyebrow: 'Desenvolvimento',
    title: 'Treino',
    description: 'Sessões individuais e coletivas. Evoluir físico, técnico e tático.',
    cta: 'Programar treino',
    href: '/clube/treino',
    rail: 'bg-emerald-400',
  },
  {
    eyebrow: 'Comissão',
    title: 'Staff',
    description: 'Profissionais, coach assistente e atribuições.',
    cta: 'Gerir staff',
    href: '/clube/staff',
    rail: 'bg-violet-400',
  },
  {
    eyebrow: 'Categorias de base',
    title: 'Academia',
    description: 'Jovens promessas, scouting e desenvolvimento de longo prazo.',
    cta: 'Ver promessas',
    href: '/clube/academia',
    rail: 'bg-cyan-400',
  },
  {
    eyebrow: 'Infraestrutura',
    title: 'Estruturas',
    description: 'Instalações do clube, upgrades e impacto no rendimento.',
    cta: 'Visitar estruturas',
    href: '/clube/estruturas',
    rail: 'bg-fuchsia-400',
  },
];

export function ClubHub() {
  useTrackScreen('screen_club_hub');
  const club = useGameStore((s) => s.club);
  const players = useGameStore((s) => s.players);
  const staffRoles = useGameStore((s) => s.manager.staff.roles);
  const structures = useGameStore((s) => s.structures);
  const managerScore = useGameStore((s) => s.managerScore);
  const playerCount = Object.keys(players).length;

  // Visão geral — dados reais do estado do jogo.
  const staffLevel = Object.values(staffRoles).reduce((a, b) => a + (b || 0), 0);
  const academyCount = Object.values(players).filter((p) => p.archetype === 'novo_talento').length;
  const structuresLevel = Object.values(structures).reduce((a, b) => a + (b || 1), 0);

  // Pontuação do manager — liga o Clube ao core-engagement.
  const scoreTotal = managerScore?.total ?? 0;
  const scoreToday = managerScoreToday(managerScore, Date.now());

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

      {/* Pontuação do Manager — destaque do core-engagement no topo do hub */}
      <section aria-label="Pontuação do manager">
        <div
          className="relative flex items-center justify-between gap-4 overflow-hidden border border-neon-yellow/30 bg-deep-black px-5 py-4 sm:px-6 sm:py-5"
          style={{ borderRadius: 'var(--radius-card)' }}
        >
          <div className="flex items-center gap-4 min-w-0">
            <span
              aria-hidden
              className="grid h-11 w-11 flex-none place-items-center"
              style={{ borderRadius: 'var(--radius-sm)', background: 'rgba(253,225,0,0.12)' }}
            >
              <TrendingUp className="h-5 w-5 text-neon-yellow" strokeWidth={2.4} />
            </span>
            <div className="min-w-0">
              <p className="font-display text-[10px] font-bold uppercase tracking-[0.24em] text-white/60">
                Pontuação do manager
              </p>
              <p className="font-impact leading-none text-neon-yellow tabular-nums" style={{ fontSize: 'clamp(30px, 7vw, 46px)' }}>
                {scoreTotal.toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
          <div className="flex-none text-right">
            {scoreToday > 0 ? (
              <span
                className="inline-flex items-center gap-1 border border-neon-yellow/40 bg-neon-yellow/10 px-3 py-1.5 font-display text-xs font-black uppercase tracking-wider text-neon-yellow tabular-nums"
                style={{ borderRadius: 'var(--radius-sm)' }}
              >
                +{scoreToday.toLocaleString('pt-BR')} hoje
              </span>
            ) : (
              <span className="block max-w-[9rem] text-[11px] leading-snug text-white/45">
                Gerir o clube rende pontos hoje.
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Quick Actions — Sprint B Legacy Tech: rail colorido + título grande + CTA texto-claro */}
      <section>
        <h2 className="text-sm font-display font-bold uppercase tracking-[0.22em] text-white/70 mb-4 px-1">
          Acesso rápido
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {quickActions.map((action, i) => (
            <HubSectionCard
              key={action.href}
              to={action.href}
              eyebrow={action.eyebrow}
              title={action.title}
              description={action.description}
              cta={action.cta}
              rail={action.rail}
              delay={i * 0.08}
            />
          ))}
        </div>
      </section>

      {/* Visão geral — StatTiles editoriais */}
      <section>
        <h2 className="text-sm font-display font-bold uppercase tracking-[0.22em] text-white/70 mb-4 px-1">
          Visão geral
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatTile value={playerCount} label="Jogadores" tone="accent" />
          <StatTile value={staffLevel} label="Staff" hint="nível somado" />
          <StatTile value={academyCount} label="Academia" hint="crias reveladas" />
          <StatTile value={structuresLevel} label="Estruturas" hint="nível somado" />
        </div>
      </section>
    </div>
  );
}
