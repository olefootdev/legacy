import { Link } from 'react-router-dom';
import { useGameStore } from '@/game/store';
import { useTrackScreen } from '@/progression/trackEvent';
import { managerScoreToday } from '@/systems/managerScore/managerScore';
import { FitaRua, MarcaRua, SecaoRua, SeloRua } from '@/components/ui';
import { cn } from '@/lib/utils';
import { L, LOCALE, emIngles } from '@/i18n/L';

/**
 * Hub do Clube — DS 2027 "Respeito é ouro".
 *
 * O nome do clube é o lambe do topo (Anton gigante + fita da casa). As portas do
 * clube viram uma lista de muro: Elenco é a única em rua (é onde se age primeiro),
 * o resto fica em concreto com "→". A pontuação do manager é valor que já existe:
 * asfalto com fio de ouro (degrau RESPEITO).
 */
const quickActions: Array<{
  tag: string;
  title: string;
  description: string;
  href: string;
}> = [
  {
    tag: L('#plantel', '#squad'),
    title: L('Elenco', 'Squad'),
    description: L('Escalação e formação', 'Lineup and formation'),
    href: '/clube/elenco',
  },
  {
    tag: L('#mercado', '#market'),
    title: L('Valores', 'Values'),
    description: L('Preço vivo e vendas', 'Live price and sales'),
    href: '/clube/valores',
  },
  {
    tag: L('#desenvolvimento', '#development'),
    title: L('Treino', 'Training'),
    description: L('Individual e coletivo', 'Individual and team'),
    href: '/clube/treino',
  },
  {
    tag: L('#comissao', '#staff'),
    title: 'Staff',
    description: L('Profissionais e coach', 'Professionals and coach'),
    href: '/clube/staff',
  },
  {
    tag: L('#base', '#youth'),
    title: L('Academia', 'Academy'),
    description: L('Jovens promessas', 'Young prospects'),
    href: '/clube/academia',
  },
  {
    tag: L('#infraestrutura', '#facilities'),
    title: L('Estruturas', 'Facilities'),
    description: L('Instalações e upgrades', 'Facilities and upgrades'),
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
  const sigla = club.shortName ?? club.name.slice(0, 3).toUpperCase();

  const overview: Array<{ value: number; label: string; hint?: string }> = [
    { value: playerCount, label: L('Jogadores', 'Players') },
    { value: staffLevel, label: 'Staff', hint: L('nível somado', 'total level') },
    { value: academyCount, label: L('Academia', 'Academy'), hint: L('crias reveladas', 'homegrown') },
    { value: structuresLevel, label: L('Estruturas', 'Facilities'), hint: L('nível somado', 'total level') },
  ];

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-10 overflow-x-hidden pb-8 px-3 sm:px-4">
      {/* ── HERO — o nome do clube colado no muro ─────────────────────────── */}
      <section aria-label={L('Clube', 'Club')} className="flex min-w-0 flex-col gap-4">
        <FitaRua tags={[L('#teuclube', '#yourclub'), '#persista', '#correloko']} className="-mx-3 py-2 sm:-mx-4" />
        <div className="flex min-w-0 items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-2">
            <SecaoRua label={L('Teu clube', 'Your club')} />
            <h1 className="font-impact text-[clamp(46px,13vw,96px)] uppercase leading-[0.86] text-papel [overflow-wrap:anywhere]">
              {club.name}
            </h1>
            <span className="font-prova text-[12px] font-bold uppercase tracking-[0.18em] text-mudo">
              {sigla} ·{' '}
              {L(
                `${playerCount} ${playerCount === 1 ? 'jogador' : 'jogadores'} no plantel`,
                `${playerCount} ${playerCount === 1 ? 'player' : 'players'} in the squad`,
              )}
            </span>
          </div>
          <MarcaRua tipo="escudo" className="h-14 bg-rua sm:h-20" />
        </div>
      </section>

      {/* ── Pontuação do manager — degrau RESPEITO (valor que já existe) ──── */}
      <section
        aria-label={L('Pontuação do manager', 'Manager score')}
        className="flex min-w-0 items-center justify-between gap-4 border-[3px] border-ouro-27 bg-asfalto-27 px-5 py-4"
      >
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-prova text-[11px] font-bold uppercase tracking-[0.22em] text-mudo">
            — {L('Pontuação do manager', 'Manager score')}
          </span>
          <span className="font-spray text-[clamp(40px,11vw,60px)] font-black leading-[0.9] text-ouro-27 tabular-nums">
            {scoreTotal.toLocaleString(LOCALE)}
          </span>
        </div>
        {scoreToday > 0 ? (
          <SeloRua tom="ouro-contorno">+{scoreToday.toLocaleString(LOCALE)} {L('hoje', 'today')}</SeloRua>
        ) : (
          <span className="max-w-[9rem] text-right font-voz text-[18px] leading-tight text-suave">
            {L('Gerir o clube rende ponto hoje.', 'Running the club scores today.')}
          </span>
        )}
      </section>

      {/* IPO DE CLUBE: manager sem time completo pode ESTREAR comprando um
          pronto — a vitrine de times inteiros do mercado de elenco. */}
      {playerCount < 11 ? (
        <section
          aria-label={L('Comprar um time pronto', 'Buy a ready-made team')}
          className="flex min-w-0 flex-col gap-4 border-2 border-dashed border-fio p-5"
        >
          <SecaoRua label={L('Estreia de dono', 'Owner debut')} />
          <p className="font-voz text-[24px] leading-tight text-papel">
            {emIngles()
              ? `${playerCount} player(s) in the squad. Start from scratch — or buy a ready team.`
              : `${playerCount} jogador(es) no plantel. Começa do zero — ou compra um time pronto.`}
          </p>
          <p className="text-[14px] leading-relaxed text-suave">
            {L(
              'Times treinados por outro manager, na vitrine em OLEFOOT.',
              'Teams trained by another manager, in the OLEFOOT showcase.',
            )}
          </p>
          {/* Link nativo: mantém o comportamento original (<a href>). */}
          <a
            href="/clube/valores"
            className="inline-flex min-h-[52px] items-center justify-center gap-2 self-start bg-rua px-6 font-impact text-[20px] uppercase leading-none text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_var(--color-papel)]"
          >
            {L('Ver times à venda', 'See teams for sale')} <span aria-hidden>→</span>
          </a>
        </section>
      ) : null}

      {/* ── As portas do clube — lista de muro ───────────────────────────── */}
      <section className="flex min-w-0 flex-col gap-3">
        <SecaoRua label={L('Acesso rápido', 'Quick access')} aside={quickActions.length} />
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {quickActions.map((action, i) => {
            const destaque = i === 0;
            return (
              <li key={action.href} className="min-w-0">
                <Link
                  to={action.href}
                  className={cn(
                    'group relative flex min-h-[92px] min-w-0 items-center gap-4 overflow-hidden px-5 py-4 transition-[transform,box-shadow,background-color]',
                    destaque
                      ? 'bg-rua text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_var(--color-papel)]'
                      : 'bg-concreto text-papel hover:bg-linha',
                  )}
                >
                  {destaque && (
                    <span aria-hidden className="rua-alambrado pointer-events-none absolute inset-x-0 top-0 h-20 [--alambrado:rgba(13,13,12,0.22)]" />
                  )}
                  <div className="relative flex min-w-0 grow flex-col gap-1.5">
                    <span
                      className={cn(
                        'font-prova text-[11px] font-bold tracking-[0.08em]',
                        destaque ? 'text-asfalto-27/70' : 'text-mudo',
                      )}
                    >
                      {action.tag}
                    </span>
                    <span className="block min-w-0 truncate font-impact text-[30px] uppercase leading-[0.9]">{action.title}</span>
                    <span className={cn('block min-w-0 truncate text-[13px]', destaque ? 'text-asfalto-27/75' : 'text-suave')}>
                      {action.description}
                    </span>
                  </div>
                  <span
                    aria-hidden
                    className={cn(
                      'relative shrink-0 font-impact text-[30px] leading-none transition-transform group-hover:translate-x-1',
                      destaque ? 'text-asfalto-27' : 'text-rua',
                    )}
                  >
                    →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── Visão geral — números no grito ───────────────────────────────── */}
      <section className="flex min-w-0 flex-col gap-3">
        <SecaoRua label={L('Visão geral', 'Overview')} />
        <dl className="grid grid-cols-2 gap-px bg-linha sm:grid-cols-4">
          {overview.map((o) => (
            <div key={o.label} className="flex min-w-0 flex-col gap-1 bg-asfalto-27 px-4 py-4">
              <dt className="font-prova text-[11px] font-bold uppercase tracking-[0.18em] text-mudo">{o.label}</dt>
              <dd className="font-impact text-[40px] leading-none text-papel tabular-nums">{o.value.toLocaleString(LOCALE)}</dd>
              {o.hint && <dd className="font-prova text-[11px] text-mudo">{o.hint}</dd>}
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
