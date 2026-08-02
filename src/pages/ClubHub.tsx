import { motion } from 'motion/react';
import { TrendingUp } from 'lucide-react';
import { useGameStore } from '@/game/store';
import { useTrackScreen } from '@/progression/trackEvent';
import { HubSectionCard } from '@/components/ui/HubSectionCard';
import { StatTile } from '@/components/ui/StatTile';
import { managerScoreToday } from '@/systems/managerScore/managerScore';

/** Ações do clube. O trilho amarelo é do HubSectionCard — nada de cor por categoria. */
const quickActions: Array<{
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  href: string;
}> = [
  {
    eyebrow: 'Plantel',
    title: 'Elenco',
    description: 'Gerir jogadores, formação tática e escalação titular.',
    cta: 'Abrir elenco',
    href: '/clube/elenco',
  },
  {
    eyebrow: 'Desenvolvimento',
    title: 'Treino',
    description: 'Sessões individuais e coletivas. Evoluir físico, técnico e tático.',
    cta: 'Programar treino',
    href: '/clube/treino',
  },
  {
    eyebrow: 'Comissão',
    title: 'Staff',
    description: 'Profissionais, coach assistente e atribuições.',
    cta: 'Gerir staff',
    href: '/clube/staff',
  },
  {
    eyebrow: 'Categorias de base',
    title: 'Academia',
    description: 'Jovens promessas, scouting e desenvolvimento de longo prazo.',
    cta: 'Ver promessas',
    href: '/clube/academia',
  },
  {
    eyebrow: 'Infraestrutura',
    title: 'Estruturas',
    description: 'Instalações do clube, upgrades e impacto no rendimento.',
    cta: 'Visitar estruturas',
    href: '/clube/estruturas',
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
      {/* ── HERO — bloco amarelo sangrado, no layer final ──────────────────
          A versão anterior era centralizada, com um watermark gigante do nome
          do clube atrás do título (que virava um fantasma cinza sobre o
          amarelo) e uma frase de efeito em serifa itálica. Saíram os três:
          serifa itálica aqui é assinatura de NOME DE LENDA, e o watermark
          competia com a própria manchete. Agora é o que o layer final pede —
          alinhado à esquerda, eyebrow com risco, nome do clube em Anton. */}
      <section
        aria-label="Clube"
        className="relative w-full overflow-hidden bg-neon-yellow -mx-3 sm:-mx-4 lg:-mx-8"
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 px-5 sm:px-8"
          style={{ paddingBlock: 'clamp(28px, 6vw, 52px)' }}
        >
          <span className="ole-eyebrow-poster" data-on="yellow" style={{ fontSize: '12px' }}>
            Teu clube
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
            {club.name}
          </h1>
          <p
            className="mt-3"
            style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'rgba(13,13,13,0.62)' }}
          >
            {playerCount} {playerCount === 1 ? 'jogador' : 'jogadores'} no plantel ·{' '}
            {club.shortName ?? club.name.slice(0, 3).toUpperCase()}
          </p>
        </motion.div>
      </section>

      {/* Pontuação do Manager — destaque do core-engagement no topo do hub */}
      <section aria-label="Pontuação do manager">
        <div
          className="ole-poster ole-rail relative flex items-center justify-between gap-4 overflow-hidden px-5 py-4 sm:px-6 sm:py-5"
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

      {/* Ações do clube — o primeiro card vem em destaque amarelo. */}
      <section>
        <h2 className="ole-eyebrow-poster mb-4" style={{ fontSize: '13px' }}>
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
              // Elenco é a porta de entrada do clube — é ele que fica amarelo.
              destaque={i === 0}
              delay={i * 0.08}
            />
          ))}
        </div>
      </section>

      {/* Visão geral — StatTiles editoriais */}
      <section>
        <h2 className="ole-eyebrow-poster mb-4" style={{ fontSize: '13px' }}>
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
