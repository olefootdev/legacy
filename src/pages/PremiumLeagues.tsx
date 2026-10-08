import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Trophy, Plus, Check, Share2, Swords, Star, Medal, X } from 'lucide-react';
import { useGameStore } from '@/game/store';
import { overallFromAttributes } from '@/entities/player';
import { BarraSegmentos, BotaoRua, SecaoRua, SeloRua } from '@/components/ui/Rua';
import { AbasRua, CabecalhoRua, VazioRua, posRua } from '@/components/leagues/RuaTabela';
import { cn } from '@/lib/utils';
import { L, LOCALE, emIngles } from '@/i18n/L';
import {
  fetchOpenLeagues,
  fetchMyLeagues,
  fetchLeagueDetail,
  createLeague,
  joinLeague,
  findLeagueBySlug,
  inviteLinkForLeague,
  type PremiumLeague,
  type PremiumLeagueEntry,
  type PremiumLeagueFixture,
  type PremiumLeagueChampion,
} from '@/supabase/premiumLeagues';

function formatPool(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString(LOCALE);
}

const SIZE_OPTIONS = [16, 32, 64] as const;
const RANK_COLORS = ['text-ouro-27', 'text-papel', 'text-suave', 'text-mudo'];

/** Ícone do posto: 1º troféu, 2º/3º medalha, 4º texto. `rank` é 1-indexado. */
function RankIcon({ rank, className }: { rank: number; className?: string }) {
  if (rank === 1) return <Trophy className={className} strokeWidth={2.2} />;
  if (rank === 2 || rank === 3) return <Medal className={className} strokeWidth={2.2} />;
  return <span className="font-impact text-sm">{L('4º', '4th')}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; tom: 'corre' | 'corre-contorno' | 'mudo' | 'cal' }> = {
    open: { label: L('Inscrições abertas', 'Registration open'), tom: 'corre-contorno' },
    live: { label: L('● Ao vivo', '● Live'), tom: 'corre' },
    finished: { label: L('Encerrada', 'Finished'), tom: 'cal' },
    cancelled: { label: L('Cancelada', 'Cancelled'), tom: 'mudo' },
  };
  const s = map[status] ?? map.cancelled!;
  return <SeloRua tom={s.tom} className="text-[10.5px]">{s.label}</SeloRua>;
}

function ShareButton({ slug, compact }: { slug: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const onShare = async () => {
    const url = inviteLinkForLeague(slug);
    const text = L(`Entre na minha Liga Premiada no Olefoot! Mata-mata com pote em EXP. ${url}`, `Join my Prize League on Olefoot! Knockout with an EXP pot. ${url}`);
    if (navigator.share) {
      try { await navigator.share({ title: L('Liga Premiada Olefoot', 'Olefoot Prize League'), text, url }); return; } catch {}
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };
  if (compact) {
    return (
      <button onClick={() => void onShare()} className="flex items-center gap-1.5 border-2 border-rua px-3 py-1.5 font-impact text-[14px] uppercase text-rua transition-colors hover:bg-rua hover:text-asfalto-27">
        {copied ? <Check className="h-3 w-3" /> : <Share2 className="h-3 w-3" />}
        {copied ? L('Copiado!', 'Copied!') : L('Convidar', 'Invite')}
      </button>
    );
  }
  return (
    <button onClick={() => void onShare()}
      className="flex min-h-[52px] w-full items-center justify-center gap-2 whitespace-nowrap border-2 border-papel px-4 font-impact text-[19px] uppercase text-papel transition-colors hover:bg-papel hover:text-asfalto-27">
      {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      {copied ? L('Link copiado', 'Link copied') : L('Compartilhar liga', 'Share league')}
    </button>
  );
}

function LeagueCard({ league, onClick, delay }: { league: PremiumLeague; onClick: () => void; delay: number }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="flex w-full min-w-0 flex-col gap-4 bg-concreto p-5 text-left transition-colors hover:bg-linha"
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="truncate font-impact text-[24px] uppercase leading-none text-papel">{league.name}</h3>
          <p className="truncate font-prova text-[11px] uppercase tracking-[0.12em] text-mudo">
            {L('por', 'by')} {league.creator_club_name}
          </p>
        </div>
        <StatusBadge status={league.status} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="min-w-0">
          <p className="font-prova text-[10px] font-bold uppercase tracking-[0.14em] text-mudo">{L('Inscrição', 'Entry')}</p>
          <p className="mt-1 truncate font-spray text-[26px] font-black leading-none text-papel">{formatPool(league.entry_fee)}</p>
          <p className="font-prova text-[10px] text-mudo">{league.currency}</p>
        </div>
        <div className="min-w-0">
          <p className="font-prova text-[10px] font-bold uppercase tracking-[0.14em] text-mudo">{L('Pote', 'Pot')}</p>
          <p className="mt-1 truncate font-spray text-[26px] font-black leading-none text-ouro-27">{formatPool(league.total_pool)}</p>
          <p className="font-prova text-[10px] text-mudo">{league.currency}</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="font-prova text-[10px] font-bold uppercase tracking-[0.14em] text-mudo">{L('Times', 'Teams')}</p>
          <p className="mt-1 font-spray text-[26px] font-black leading-none text-papel">
            {league.current_teams}<span className="text-fio">/{league.max_teams}</span>
          </p>
          {league.status === 'live' && league.current_round && (
            <p className="font-prova text-[10px] font-bold text-rua">R{league.current_round}/{league.total_rounds}</p>
          )}
        </div>
      </div>

      <BarraSegmentos valor={league.current_teams} max={league.max_teams} className="h-2.5" />
    </motion.button>
  );
}

function CreateLeagueModal({ open, onClose, onCreated, clubOverall }: {
  open: boolean;
  onClose: () => void;
  onCreated: (leagueId: string) => void;
  clubOverall: number;
}) {
  const club = useGameStore((s) => s.club);
  const [name, setName] = useState('');
  const [maxTeams, setMaxTeams] = useState<16 | 32 | 64>(16);
  const [entryFee, setEntryFee] = useState('10000');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const estimatedPool = Number(entryFee) * maxTeams;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const r = await createLeague({
      name: name.trim(), maxTeams, entryFee: Number(entryFee),
      clubName: club?.name ?? 'Clube', clubShort: club?.shortName,
      overall: clubOverall,
    });
    setBusy(false);
    if (!r.ok) { setError('error' in r ? r.error : L('Erro', 'Error')); return; }
    onCreated(r.data?.id ?? '');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/85 p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="rua-grao w-full max-w-md bg-concreto"
      >
        <div className="flex items-center justify-between border-b-2 border-linha px-6 py-4">
          <h2 className="font-impact text-[30px] uppercase leading-none text-papel">{L('Criar Liga', 'Create League')}</h2>
          <button onClick={onClose} aria-label={L('Fechar', 'Close')} className="grid h-10 w-10 place-items-center text-mudo hover:text-papel">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={(e) => void onSubmit(e)} className="p-6 space-y-5">
          <label className="block">
            <span className="font-prova text-[11px] font-bold uppercase tracking-[0.16em] text-mudo">{L('Nome da Liga', 'League name')}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required minLength={3} maxLength={40}
              placeholder={L('Ex: Copa dos Campeões', 'e.g. Champions Cup')}
              className="mt-1.5 w-full border-2 border-linha bg-asfalto-27 px-4 py-3 text-sm text-papel placeholder:text-mudo focus:border-rua focus:outline-none" />
          </label>
          <div>
            <span className="font-prova text-[11px] font-bold uppercase tracking-[0.16em] text-mudo">{L('Quantidade de Times', 'Number of teams')}</span>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {SIZE_OPTIONS.map((n) => (
                <button key={n} type="button" onClick={() => setMaxTeams(n)}
                  className={`py-3 font-spray text-[26px] font-black leading-none transition-colors ${
                    maxTeams === n
                      ? 'bg-rua text-asfalto-27'
                      : 'border-2 border-linha text-suave hover:border-papel hover:text-papel'
                  }`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="font-prova text-[11px] font-bold uppercase tracking-[0.16em] text-mudo">{L('Valor de Inscrição (EXP)', 'Entry fee (EXP)')}</span>
            <input type="number" value={entryFee} onChange={(e) => setEntryFee(e.target.value)} required min={100} max={10000000}
              className="mt-1.5 w-full border-2 border-linha bg-asfalto-27 px-4 py-3 font-impact text-[20px] text-papel tabular-nums focus:border-rua focus:outline-none" />
          </label>

          <div className="space-y-2 border-[3px] border-ouro-27 bg-asfalto-27 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="font-prova text-[11px] font-bold uppercase tracking-[0.16em] text-mudo">{L('Pote Estimado', 'Estimated pot')}</span>
              <span className="font-spray text-[30px] font-black leading-none text-ouro-27">{formatPool(estimatedPool)} EXP</span>
            </div>
            <div className="h-0.5 bg-linha" />
            <div className="grid grid-cols-3 gap-2 font-prova text-[11px]">
              <div><span className="inline-flex items-center gap-1 text-ouro-27"><Trophy className="h-3 w-3" strokeWidth={2.2} /> 40%</span><br/><span className="text-mudo">{formatPool(estimatedPool * 0.4)}</span></div>
              <div><span className="inline-flex items-center gap-1 text-papel"><Medal className="h-3 w-3" strokeWidth={2.2} /> 20%</span><br/><span className="text-mudo">{formatPool(estimatedPool * 0.2)}</span></div>
              <div><span className="inline-flex items-center gap-1 text-suave"><Medal className="h-3 w-3" strokeWidth={2.2} /> 12%</span><br/><span className="text-mudo">{formatPool(estimatedPool * 0.12)}</span></div>
            </div>
            <p className="font-prova text-[11px] text-mudo">
              {emIngles()
                ? <>Creator takes <strong className="text-ouro-27">10%</strong> of the pot ({formatPool(estimatedPool * 0.1)} EXP)</>
                : <>Criador leva <strong className="text-ouro-27">10%</strong> do pote ({formatPool(estimatedPool * 0.1)} EXP)</>}
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 border-2 border-dashed border-baixa bg-asfalto-27 px-3 py-2.5 font-prova text-[12px] text-papel">
              <X className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} /> {error}
            </div>
          )}
          <button type="submit" disabled={busy || name.trim().length < 3 || !entryFee || Number(entryFee) < 100}
            className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 bg-rua px-6 font-impact text-[20px] uppercase leading-none text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-40">
            {busy ? L('Criando…', 'Creating…') : L('Criar Liga Premiada', 'Create Prize League')} {!busy && <span aria-hidden>→</span>}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function LeagueDetailView({ leagueId, onBack, clubOverall, justCreated }: { leagueId: string; onBack: () => void; clubOverall: number; justCreated?: boolean }) {
  const club = useGameStore((s) => s.club);
  const [league, setLeague] = useState<PremiumLeague | null>(null);
  const [entries, setEntries] = useState<PremiumLeagueEntry[]>([]);
  const [fixtures, setFixtures] = useState<PremiumLeagueFixture[]>([]);
  const [champions, setChampions] = useState<PremiumLeagueChampion[]>([]);
  const [myEntry, setMyEntry] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreatedBanner, setShowCreatedBanner] = useState(!!justCreated);

  const load = useCallback(async () => {
    const d = await fetchLeagueDetail(leagueId);
    if (!d) return;
    setLeague(d.league);
    setEntries(d.entries);
    setFixtures(d.fixtures);
    setChampions(d.champions);
    const sb = (await import('@/supabase/client')).getSupabase();
    const { data: { user } } = await sb!.auth.getUser();
    setMyEntry(d.entries.some((e) => e.user_id === user?.id));
  }, [leagueId]);

  useEffect(() => {
    void load();
    if (!league || league.status !== 'live') return;
    const t = setInterval(() => void load(), 8000);
    return () => clearInterval(t);
  }, [load, league?.status]);

  useEffect(() => {
    if (!showCreatedBanner) return;
    const t = setTimeout(() => setShowCreatedBanner(false), 5000);
    return () => clearTimeout(t);
  }, [showCreatedBanner]);

  if (!league) return <div className="py-16 text-center font-prova text-[12px] uppercase tracking-[0.14em] text-mudo">{L('Carregando…', 'Loading…')}</div>;

  const onJoin = async () => {
    setJoining(true); setError(null);
    const r = await joinLeague({ leagueId, clubName: club?.name ?? 'Clube', clubShort: club?.shortName, overall: clubOverall });
    setJoining(false);
    if (!r.ok) { setError('error' in r ? r.error : L('Erro', 'Error')); return; }
    void load();
  };

  const roundLabel = (r: number) => {
    if (!league.total_rounds) return L(`Rodada ${r}`, `Round ${r}`);
    const remaining = league.total_rounds - r + 1;
    if (remaining === 1) return L('Final', 'Final');
    if (remaining === 2) return L('Semifinal', 'Semi-final');
    if (remaining === 3) return L('Quartas de Final', 'Quarter-finals');
    if (remaining === 4) return L('Oitavas de Final', 'Round of 16');
    return L(`Rodada ${r}`, `Round ${r}`);
  };

  const rounds = [...new Set(fixtures.map((f) => f.round))].sort((a, b) => a - b);

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="font-prova text-[12px] font-bold uppercase tracking-[0.16em] text-mudo transition-colors hover:text-rua">
        ← {L('Todas as Ligas', 'All Leagues')}
      </button>

      {showCreatedBanner && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className="mx-1 -rotate-1 bg-cal px-4 py-3 text-center font-voz text-[22px] leading-none text-asfalto-27 shadow-[4px_4px_0_var(--color-rua)]">
          {L('Liga criada. Compartilhe o link.', 'League created. Share the link.')}
        </motion.div>
      )}

      {/* Hero — pote é valor que já existe: fio de ouro. */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rua-grao relative flex flex-col gap-5 bg-concreto p-5 sm:p-6">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={league.status} />
          </div>
          <h2 className="font-impact uppercase leading-[0.88] text-papel [overflow-wrap:anywhere]" style={{ fontSize: 'clamp(36px, 10vw, 56px)' }}>
            {league.name}
          </h2>
          <p className="font-prova text-[11px] uppercase tracking-[0.12em] text-mudo">
            <span className="text-papel">{L('por', 'by')} {league.creator_club_name}</span> · {league.max_teams} {L('times', 'teams')} · {L('mata-mata', 'knockout')}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <div className="flex flex-col gap-1 border-[3px] border-ouro-27 bg-asfalto-27 p-4">
            <p className="font-spray font-black leading-none text-ouro-27" style={{ fontSize: 'clamp(36px, 10vw, 52px)' }}>
              {formatPool(league.total_pool)}
            </p>
            <p className="font-prova text-[10.5px] font-bold uppercase tracking-[0.14em] text-mudo">
              {L('Pote Total', 'Total Pot')} · {league.currency}
            </p>
          </div>
          <div className="flex flex-col gap-1 bg-asfalto-27 p-4">
            <p className="font-spray font-black leading-none text-papel" style={{ fontSize: 'clamp(36px, 10vw, 52px)' }}>
              {league.current_teams}<span className="text-fio">/{league.max_teams}</span>
            </p>
            <p className="font-prova text-[10.5px] font-bold uppercase tracking-[0.14em] text-mudo">
              {league.status === 'open' ? L('Inscritos', 'Registered') : league.current_round ? L(`Rodada ${league.current_round}/${league.total_rounds}`, `Round ${league.current_round}/${league.total_rounds}`) : L('Times', 'Teams')}
            </p>
          </div>
        </div>

        {/* Ações — compartilhar SEMPRE visível pra quem participa */}
        <div className="flex flex-col gap-3">
          {league.status === 'open' && !myEntry && (
            <BotaoRua onClick={() => void onJoin()} disabled={joining} className="w-full">
              <Swords aria-hidden className="h-4 w-4" />
              {joining ? L('Entrando…', 'Joining…') : L(`Inscrever −${formatPool(league.entry_fee)} ${league.currency}`, `Join −${formatPool(league.entry_fee)} ${league.currency}`)}
              {!joining && <span aria-hidden>→</span>}
            </BotaoRua>
          )}
          {league.status === 'open' && myEntry && (
            <div className="border-2 border-dashed border-rua px-4 py-3 text-center font-prova text-[11.5px] font-bold uppercase tracking-[0.12em] text-rua">
              {L(`Inscrito · Faltam ${league.max_teams - league.current_teams} times`, `Registered · ${league.max_teams - league.current_teams} teams to go`)}
            </div>
          )}
          <ShareButton slug={league.slug} />
        </div>

        {error && <p className="font-prova text-[12px] text-baixa">{error}</p>}
      </motion.div>

      {/* Premiação — campeão em LENDA (ouro chapado). */}
      {champions.length > 0 && (
        <section className="flex flex-col gap-2">
          <SecaoRua label={L('Premiação final', 'Final prizes')} />
          {champions.map((c, i) => (
            <motion.div
              key={c.rank}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className={cn(
                'flex min-w-0 items-center justify-between gap-3 px-4',
                c.rank === 1 ? 'min-h-[72px] bg-ouro-27 text-asfalto-27' : 'min-h-[52px] bg-concreto',
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className={cn('inline-flex shrink-0 items-center', c.rank === 1 ? 'text-asfalto-27' : RANK_COLORS[c.rank - 1])}><RankIcon rank={c.rank} className="h-5 w-5" /></span>
                <span className={c.rank === 1 ? 'truncate font-impact text-[28px] uppercase leading-none' : 'truncate font-impact text-[19px] uppercase leading-none text-papel'}>{c.club_name}</span>
              </div>
              <span className={cn('shrink-0 font-spray font-black leading-none', c.rank === 1 ? 'text-[30px]' : 'text-[22px] text-papel')}>
                {formatPool(c.prize_amount)} <span className={cn('font-prova text-[10px] font-normal', c.rank === 1 ? 'text-asfalto-27/70' : 'text-mudo')}>{c.currency}</span>
              </span>
            </motion.div>
          ))}
        </section>
      )}

      {/* Participantes (quando liga está open) */}
      {league.status === 'open' && entries.length > 0 && (
        <section className="flex flex-col gap-2">
          <SecaoRua label={L('Inscritos', 'Registered')} aside={`${entries.length}/${league.max_teams}`} />
          <div className="grid grid-cols-1 gap-1.5 min-[400px]:grid-cols-2">
            {entries.map((e, i) => (
              <div key={e.id} className="flex min-w-0 items-center gap-2 bg-concreto px-3 py-2.5">
                <span className="font-impact text-[14px] text-mudo">{posRua(i + 1)}</span>
                <span className="min-w-0 flex-1 truncate font-impact text-[16px] uppercase leading-none text-papel">{e.club_name}</span>
                {e.user_id === league.creator_id && (
                  <Star aria-label={L('Criador', 'Creator')} className="h-3.5 w-3.5 shrink-0 fill-ouro-27 text-ouro-27" />
                )}
                <span className="shrink-0 font-impact text-[15px] text-rua">{e.overall}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Bracket */}
      {rounds.length > 0 && (
        <section className="flex flex-col gap-4">
          <SecaoRua label={L('Chave do mata-mata', 'Knockout bracket')} />
          {rounds.map((r) => (
            <div key={r} className="flex flex-col gap-1.5">
              <p className="font-impact text-[20px] uppercase leading-none text-papel">{roundLabel(r)}</p>
              {fixtures.filter((f) => f.round === r).map((fx, fi) => {
                const homeWon = fx.winner_entry_id === fx.home_entry_id;
                const awayWon = fx.winner_entry_id === fx.away_entry_id;
                return (
                  <motion.div
                    key={fx.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: fi * 0.05 }}
                    className="overflow-hidden bg-concreto"
                  >
                    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center">
                      <div className={`truncate px-3 py-3 font-impact text-[15px] uppercase leading-none ${homeWon ? 'text-rua' : 'text-suave'}`}>
                        {fx.home_club_name ?? L('A definir', 'TBD')}
                      </div>
                      <div className="px-3 py-2 text-center">
                        {fx.status === 'finished' ? (
                          <div>
                            <span className="font-spray text-[24px] font-black leading-none text-papel">
                              {fx.score_home}×{fx.score_away}
                            </span>
                            {fx.went_to_penalties && (
                              <p className="font-prova text-[10px] font-bold text-rua">{L('pen', 'pens')} {fx.penalty_home}-{fx.penalty_away}</p>
                            )}
                          </div>
                        ) : (
                          <span className="font-voz text-[20px] leading-none text-mudo">x</span>
                        )}
                      </div>
                      <div className={`truncate px-3 py-3 text-right font-impact text-[15px] uppercase leading-none ${awayWon ? 'text-rua' : 'text-suave'}`}>
                        {fx.away_club_name ?? L('A definir', 'TBD')}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ))}
        </section>
      )}

      {/* Split info (sempre visível) */}
      <div className="flex flex-col gap-3 border-t-2 border-linha pt-5">
        <SecaoRua label={L('Distribuição do pote', 'Pot split')} />
        <div className="grid grid-cols-6 gap-1 text-center font-prova text-[10px] text-mudo">
          {[
            { label: <Trophy className="mx-auto h-3.5 w-3.5 text-ouro-27" strokeWidth={2.2} />, pct: league.pct_champion },
            { label: <Medal className="mx-auto h-3.5 w-3.5 text-papel" strokeWidth={2.2} />, pct: league.pct_vice },
            { label: <Medal className="mx-auto h-3.5 w-3.5 text-suave" strokeWidth={2.2} />, pct: league.pct_third },
            { label: L('4º', '4th'), pct: league.pct_fourth },
            { label: L('Criador', 'Creator'), pct: league.pct_creator },
            { label: L('Casa', 'House'), pct: league.pct_house },
          ].map((s, i) => (
            <div key={i}>
              <p className="text-[11px]">{s.label}</p>
              <p className="font-impact text-[18px] text-papel">{s.pct}%</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function useClubOverall(): number {
  const players = useGameStore((s) => s.players);
  return useMemo(() => {
    const all = Object.values(players ?? {});
    if (all.length === 0) return 50;
    return Math.round(all.reduce((sum, p) => sum + overallFromAttributes(p.attrs, p.pos), 0) / all.length);
  }, [players]);
}

export function PremiumLeagues() {
  const { leagueSlug } = useParams<{ leagueSlug?: string }>();
  const [tab, setTab] = useState<'open' | 'mine'>('open');
  const [leagues, setLeagues] = useState<PremiumLeague[]>([]);
  const [myLeagues, setMyLeagues] = useState<PremiumLeague[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [slugNotFound, setSlugNotFound] = useState(false);
  const [justCreated, setJustCreated] = useState(false);
  const clubOverall = useClubOverall();

  const load = useCallback(async () => {
    const [open, mine] = await Promise.all([fetchOpenLeagues(), fetchMyLeagues()]);
    setLeagues(open);
    setMyLeagues(mine);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!leagueSlug) return;
    void findLeagueBySlug(leagueSlug).then((l) => {
      if (l) { setSelectedId(l.id); setSlugNotFound(false); }
      else setSlugNotFound(true);
    });
  }, [leagueSlug]);

  if (selectedId) {
    return (
      <div className="mx-auto w-full max-w-lg overflow-x-hidden px-3 py-6 sm:px-4">
        <LeagueDetailView leagueId={selectedId} onBack={() => { setSelectedId(null); setJustCreated(false); void load(); }} clubOverall={clubOverall} justCreated={justCreated} />
      </div>
    );
  }

  const displayLeagues = tab === 'open' ? leagues : myLeagues;

  return (
    <div className="mx-auto w-full max-w-lg space-y-8 overflow-x-hidden px-3 py-6 sm:px-4">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <CabecalhoRua
          rotulo="#premiada"
          titulo={L('Ligas Premiadas', 'Prize Leagues')}
          voz={L('Pote na mesa. Só quatro levam.', 'Pot on the table. Only four take it.')}
          aside={L('Mata-mata · EXP', 'Knockout · EXP')}
        >
          <BotaoRua onClick={() => setCreateOpen(true)} className="mt-2 self-start">
            <Plus aria-hidden className="h-4 w-4" /> {L('Criar liga', 'Create league')} <span aria-hidden>→</span>
          </BotaoRua>
        </CabecalhoRua>
      </motion.div>

      {slugNotFound && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-2 border-dashed border-fio px-4 py-3 font-prova text-[12px] text-suave">
          <span className="font-bold text-papel">{L('Liga não encontrada.', 'League not found.')}</span>{' '}
          {L('Confere o link ou vê as abertas abaixo.', 'Check the link or see the open ones below.')}
        </motion.div>
      )}

      <AbasRua
        ariaLabel={L('Ligas premiadas', 'Prize leagues')}
        ativa={tab}
        onChange={setTab}
        abas={[
          { id: 'open', label: L(`Abertas (${leagues.length})`, `Open (${leagues.length})`) },
          { id: 'mine', label: L(`Minhas (${myLeagues.length})`, `Mine (${myLeagues.length})`) },
        ]}
      />

      {loading ? (
        <p className="py-16 text-center font-prova text-[12px] uppercase tracking-[0.14em] text-mudo">{L('Carregando ligas…', 'Loading leagues…')}</p>
      ) : displayLeagues.length > 0 ? (
        <div className="flex flex-col gap-2">
          {displayLeagues.map((l, i) => (
            <LeagueCard key={l.id} league={l} onClick={() => setSelectedId(l.id)} delay={i * 0.06} />
          ))}
        </div>
      ) : (
        <VazioRua
          titulo={tab === 'open' ? L('Nenhuma liga aberta', 'No open leagues') : L('Tu ainda não entrou', "You haven't joined yet")}
          frase={tab === 'open' ? L('Cria a primeira e leva 10% do pote.', 'Create the first and take 10% of the pot.') : L('Entra numa aberta ou cria a tua.', 'Join an open one or create yours.')}
        >
          {tab === 'open' && (
            <BotaoRua onClick={() => setCreateOpen(true)} variante="contorno">
              <Plus aria-hidden className="h-4 w-4" /> {L('Criar Liga Premiada', 'Create Prize League')}
            </BotaoRua>
          )}
        </VazioRua>
      )}

      <CreateLeagueModal open={createOpen} onClose={() => setCreateOpen(false)} clubOverall={clubOverall} onCreated={(id) => { setJustCreated(true); void load(); if (id) setSelectedId(id); }} />
    </div>
  );
}
