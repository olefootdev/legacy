import { motion } from 'framer-motion';
import { useGameStore } from '@/game/store';
import { useTrackScreen } from '@/progression/trackEvent';
import { formatExp } from '@/systems/economy';
import { HubSectionCard } from '@/components/ui/HubSectionCard';
import { FitaRua, SecaoRua } from '@/components/ui/Rua';
import { FormaRua } from '@/components/leagues/RuaTabela';
import { L } from '@/i18n/L';

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

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-8 overflow-x-hidden px-3 pb-6 sm:px-4 md:pb-8 lg:px-6">
      {/* ── HERO DS 2027 — o placar da temporada pichado no muro ─────────────
          Fita de hashtags no topo (o momento rua da tela), nome do clube na
          voz, título no grito e V/E/D em spray: é um placar, não um gráfico. */}
      <FitaRua tags={['#competição', '#respeitoéouro']} className="-mx-3 py-2 sm:-mx-4 lg:-mx-6" />

      <motion.section
        aria-label={L('Competições', 'Competitions')}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex min-w-0 flex-col gap-5"
      >
        <div className="flex min-w-0 flex-col gap-1.5">
          <SecaoRua
            label={`${club.name} · ${totalMatches} ${L(`partida${totalMatches !== 1 ? 's' : ''}`, `match${totalMatches !== 1 ? 'es' : ''}`)}`}
            aside={`${formatExp(finance.ole)} EXP`}
          />
          <h1 className="font-impact uppercase leading-[0.86] text-papel" style={{ fontSize: 'clamp(48px, 13vw, 96px)' }}>
            {L('Competição', 'Competition')}
          </h1>
          <p className="font-voz text-[clamp(22px,6vw,30px)] leading-[1.05] text-suave">
            {totalMatches > 0 ? L('Cada ponto é respeito na rua.', 'Every point is street respect.') : L('A temporada começa no primeiro apito.', 'The season starts at the first whistle.')}
          </p>
        </div>

        {/* V/E/D — placar em stencil sobre concreto. */}
        <div className="grid max-w-xl grid-cols-3 gap-1.5">
          {[
            { n: wins, l: L('Vitórias', 'Wins'), tone: 'text-rua' },
            { n: draws, l: L('Empates', 'Draws'), tone: 'text-papel' },
            { n: losses, l: L('Derrotas', 'Losses'), tone: 'text-mudo' },
          ].map((s) => (
            <div key={s.l} className="rua-grao flex min-w-0 flex-col gap-1 bg-concreto px-3 py-3 sm:px-4 sm:py-4">
              <span className={`font-spray font-black leading-[0.85] ${s.tone}`} style={{ fontSize: 'clamp(44px, 13vw, 72px)' }}>
                {s.n}
              </span>
              <span className="truncate font-prova text-[11px] font-bold uppercase tracking-[0.18em] text-mudo">{s.l}</span>
            </div>
          ))}
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <span className="font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">{L('Forma', 'Form')}</span>
          {form.length > 0 ? <FormaRua form={form.slice(0, 5)} /> : <span className="font-prova text-[12px] text-fio">—</span>}
        </div>
      </motion.section>

      {/* Seções da competição — a primeira vem em destaque amarelo. */}
      <section className="flex flex-col gap-3">
        <SecaoRua label={L('Onde se joga', 'Where you play')} aside="07" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <HubSectionCard
            to="/competicao/ligas"
            eyebrow="#ligas"
            title={L('Ligas', 'Leagues')}
            description={L('Tabela e adversários', 'Table and opponents')}
            cta={L('Ver ligas', 'View leagues')}
            destaque
            delay={0.1}
          />
          <HubSectionCard
            to="/competicao/calendario"
            eyebrow="#agenda"
            title={L('Calendário', 'Calendar')}
            description={
              fixture?.opponent
                ? L(`Próximo: ${fixture.opponent.name} · ${fixture.kickoffLabel}`, `Next: ${fixture.opponent.name} · ${fixture.kickoffLabel}`)
                : L('Sem partidas agendadas no momento.', 'No matches scheduled right now.')
            }
            cta={L('Ver calendário', 'View calendar')}
            delay={0.2}
          />
          <HubSectionCard
            to="/competicao/ranking"
            eyebrow="#mundial"
            title="Ranking"
            description={L('Posição mundial por EXP', 'World position by EXP')}
            cta={L('Ver ranking', 'View ranking')}
            delay={0.3}
          />
          <HubSectionCard
            to="/competicao/standings"
            eyebrow="#pvp"
            title={L('Liga Rápida & Clássica', 'Quick & Classic League')}
            description={L('Vitória 3 pts · empate 1 pt', 'Win 3 pts · draw 1 pt')}
            cta={L('Ver classificação', 'View standings')}
            delay={0.4}
          />
          <HubSectionCard
            to="/liga-global/registro"
            eyebrow="#ligaglobal"
            title={L('Liga Global', 'Global League')}
            description={L('Divisões · playoffs · acesso e queda', 'Divisions · playoffs · promotion and relegation')}
            cta={L('Entrar na liga', 'Join the league')}
            delay={0.5}
          />
          <HubSectionCard
            to="/liga-global/hoje"
            eyebrow="#coroadodia"
            title={L('Mata-Mata Diário', 'Daily Knockout')}
            description={L('Corte às 19h · 1 campeão por dia · coroas valem título', 'Cutoff 7pm · 1 champion a day · crowns count as titles')}
            cta={L('Ver a corrida de hoje', "View today's race")}
            delay={0.6}
          />
          <HubSectionCard
            to="/rewards"
            eyebrow="#premiada"
            title={L('Liga Premiada', 'Prize League')}
            description={L('Pote em EXP · top 4 premiados · criador leva 10%', 'EXP pot · top 4 rewarded · creator takes 10%')}
            cta={L('Ver ligas premiadas', 'View prize leagues')}
            delay={0.7}
          />
        </div>
      </section>
    </div>
  );
}
