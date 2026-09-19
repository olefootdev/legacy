import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Trophy, Users, Plus, Copy, Check, Share2, Swords, Crown, Star, Medal, X } from 'lucide-react';
import { useGameStore } from '@/game/store';
import { overallFromAttributes } from '@/entities/player';
import { Hashtag } from '@/components/ui';
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
  return n.toLocaleString('pt-BR');
}

const SIZE_OPTIONS = [16, 32, 64] as const;
const RANK_COLORS = ['text-neon-yellow', 'text-giz', 'text-cimento', 'text-cimento'];

/** Ícone do posto: 1º troféu, 2º/3º medalha, 4º texto. `rank` é 1-indexado. */
function RankIcon({ rank, className }: { rank: number; className?: string }) {
  if (rank === 1) return <Trophy className={className} strokeWidth={2.2} />;
  if (rank === 2 || rank === 3) return <Medal className={className} strokeWidth={2.2} />;
  return <span className="ole-num text-sm">4º</span>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    open: { label: 'Inscrições abertas', cls: 'border-alta/50 text-alta' },
    live: { label: 'Ao vivo', cls: 'border-baixa/50 text-baixa' },
    finished: { label: 'Encerrada', cls: 'border-white/16 text-cimento' },
    cancelled: { label: 'Cancelada', cls: 'border-white/10 text-poeira' },
  };
  const s = map[status] ?? map.cancelled!;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${s.cls}`}>
      {status === 'live' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-baixa" />}
      {s.label}
    </span>
  );
}

function ShareButton({ slug, compact }: { slug: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const onShare = async () => {
    const url = inviteLinkForLeague(slug);
    const text = `Entre na minha Liga Premiada no Olefoot! Mata-mata com pote em EXP. ${url}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Liga Premiada Olefoot', text, url }); return; } catch {}
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };
  if (compact) {
    return (
      <button onClick={() => void onShare()} className="ole-num flex items-center gap-1.5 border border-neon-yellow/50 px-3 py-1.5 text-[10.5px] uppercase text-neon-yellow hover:border-neon-yellow transition-colors">
        {copied ? <Check className="h-3 w-3" /> : <Share2 className="h-3 w-3" />}
        {copied ? 'Copiado!' : 'Convidar'}
      </button>
    );
  }
  return (
    <button onClick={() => void onShare()}
      className="ole-num flex h-[50px] items-center justify-center gap-2 w-full whitespace-nowrap border border-neon-yellow/50 px-4 text-[13px] uppercase text-neon-yellow hover:border-neon-yellow transition-colors">
      {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      {copied ? 'Link copiado' : 'Compartilhar liga'}
    </button>
  );
}

function LeagueCard({ league, onClick, delay }: { league: PremiumLeague; onClick: () => void; delay: number }) {
  const progress = league.max_teams > 0 ? (league.current_teams / league.max_teams) * 100 : 0;
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="w-full text-left sports-panel panel-accent overflow-hidden p-0 hover:bg-card transition-colors"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-white/10 bg-card">
                <Trophy className="h-4 w-4 text-neon-yellow" />
              </div>
              <div className="min-w-0">
                <h3 className="font-impact text-[18px] uppercase leading-[1.1] text-white truncate">
                  {league.name}
                </h3>
                <p className="truncate font-mono text-[10.5px] text-cimento">
                  por {league.creator_club_name}
                </p>
              </div>
            </div>
          </div>
          <StatusBadge status={league.status} />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-cimento">Inscrição</p>
            <p className="ole-num mt-0.5 text-[17px] text-neon-yellow leading-none">
              {formatPool(league.entry_fee)}
            </p>
            <p className="font-mono text-[9.5px] text-cimento">{league.currency}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-cimento">Pote</p>
            <p className="ole-num mt-0.5 text-[17px] text-white leading-none">
              {formatPool(league.total_pool)}
            </p>
            <p className="font-mono text-[9.5px] text-cimento">{league.currency}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-cimento">Times</p>
            <p className="ole-num mt-0.5 text-[17px] text-white leading-none">
              {league.current_teams}<span className="text-poeira">/{league.max_teams}</span>
            </p>
            {league.status === 'live' && league.current_round && (
              <p className="font-mono text-[9.5px] text-baixa">R{league.current_round}/{league.total_rounds}</p>
            )}
          </div>
        </div>

        <div className="mt-3 h-1 w-full overflow-hidden bg-card-hi">
          <motion.div
            className="h-full bg-neon-yellow"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.6, delay: delay + 0.2 }}
          />
        </div>
      </div>
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
    if (!r.ok) { setError('error' in r ? r.error : 'Erro'); return; }
    onCreated(r.data?.id ?? '');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/85 p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-md border border-white/10 bg-panel"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-neon-yellow" />
            <h2 className="font-impact text-2xl uppercase leading-[1.1] text-white">Criar Liga</h2>
          </div>
          <button onClick={onClose} className="text-cimento hover:text-white text-2xl leading-none">×</button>
        </div>
        <form onSubmit={(e) => void onSubmit(e)} className="p-6 space-y-5">
          <label className="block">
            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-cimento">Nome da Liga</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required minLength={3} maxLength={40}
              placeholder="Ex: Copa dos Campeões"
              className="mt-1.5 w-full border border-white/10 bg-deep-black px-4 py-3 text-sm text-white placeholder:text-poeira focus:border-neon-yellow/50 focus:outline-none" />
          </label>
          <div>
            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-cimento">Quantidade de Times</span>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {SIZE_OPTIONS.map((n) => (
                <button key={n} type="button" onClick={() => setMaxTeams(n)}
                  className={`ole-num border py-3 text-[16px] transition-colors ${
                    maxTeams === n
                      ? 'border-neon-yellow bg-neon-yellow text-black'
                      : 'border-white/16 text-cimento hover:border-white/30 hover:text-white'
                  }`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-cimento">Valor de Inscrição (EXP)</span>
            <input type="number" value={entryFee} onChange={(e) => setEntryFee(e.target.value)} required min={100} max={10000000}
              className="mt-1.5 w-full border border-white/10 bg-deep-black px-4 py-3 text-sm text-white tabular-nums focus:border-neon-yellow/50 focus:outline-none" />
          </label>

          <div className="border border-white/10 bg-deep-black p-4 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-cimento">Pote Estimado</span>
              <span className="ole-num text-[18px] text-neon-yellow">{formatPool(estimatedPool)} EXP</span>
            </div>
            <div className="h-px bg-white/[0.06]" />
            <div className="grid grid-cols-3 gap-2 font-mono text-[10.5px]">
              <div><span className="inline-flex items-center gap-1 text-neon-yellow"><Trophy className="h-3 w-3" strokeWidth={2.2} /> 40%</span><br/><span className="text-cimento">{formatPool(estimatedPool * 0.4)}</span></div>
              <div><span className="inline-flex items-center gap-1 text-giz"><Medal className="h-3 w-3" strokeWidth={2.2} /> 20%</span><br/><span className="text-cimento">{formatPool(estimatedPool * 0.2)}</span></div>
              <div><span className="inline-flex items-center gap-1 text-cimento"><Medal className="h-3 w-3" strokeWidth={2.2} /> 12%</span><br/><span className="text-cimento">{formatPool(estimatedPool * 0.12)}</span></div>
            </div>
            <p className="font-mono text-[10.5px] text-cimento">
              Criador leva <strong className="text-neon-yellow">10%</strong> do pote ({formatPool(estimatedPool * 0.1)} EXP)
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 border border-baixa/50 bg-deep-black px-3 py-2.5 text-[12px] text-baixa">
              <X className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} /> {error}
            </div>
          )}
          <button type="submit" disabled={busy || name.trim().length < 3 || !entryFee || Number(entryFee) < 100}
            className="btn-primary w-full disabled:opacity-40 disabled:pointer-events-none">
            <span className="btn-primary-inner justify-center py-1.5">
              {busy ? 'Criando…' : 'Criar Liga Premiada'}
            </span>
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

  if (!league) return <div className="py-16 text-center font-mono text-cimento text-sm">Carregando…</div>;

  const onJoin = async () => {
    setJoining(true); setError(null);
    const r = await joinLeague({ leagueId, clubName: club?.name ?? 'Clube', clubShort: club?.shortName, overall: clubOverall });
    setJoining(false);
    if (!r.ok) { setError('error' in r ? r.error : 'Erro'); return; }
    void load();
  };

  const roundLabel = (r: number) => {
    if (!league.total_rounds) return `Rodada ${r}`;
    const remaining = league.total_rounds - r + 1;
    if (remaining === 1) return 'Final';
    if (remaining === 2) return 'Semifinal';
    if (remaining === 3) return 'Quartas de Final';
    if (remaining === 4) return 'Oitavas de Final';
    return `Rodada ${r}`;
  };

  const rounds = [...new Set(fixtures.map((f) => f.round))].sort((a, b) => a - b);

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="font-mono text-[11px] uppercase tracking-[0.14em] text-cimento hover:text-neon-yellow transition-colors">
        ← Todas as Ligas
      </button>

      {showCreatedBanner && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className="border border-alta/50 bg-panel px-4 py-3 text-[12.5px] text-alta font-bold text-center">
          Liga criada. Compartilhe o link.
        </motion.div>
      )}

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden sports-panel"
      >
        <div className="absolute left-0 top-0 h-full w-1 bg-neon-yellow" />
        <div className="relative p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Crown className="h-5 w-5 text-neon-yellow" />
                <StatusBadge status={league.status} />
              </div>
              <h2
                className="font-impact uppercase text-white leading-[1.1]"
                style={{ fontSize: 'clamp(1.6rem, 5.5vw, 2.4rem)', letterSpacing: '-0.005em' }}
              >
                {league.name}
              </h2>
              <p className="mt-1 font-mono text-[11px] text-cimento">
                <span className="text-neon-yellow">por {league.creator_club_name}</span> · {league.max_teams} times · mata-mata
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="bg-deep-black border border-white/[0.06] p-4 text-center">
              <p
                className="ole-num text-neon-yellow leading-none"
                style={{ fontSize: 'clamp(24px, 5.5vw, 36px)' }}
              >
                {formatPool(league.total_pool)}
              </p>
              <p className="mt-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-cimento">
                Pote Total · {league.currency}
              </p>
            </div>
            <div className="bg-deep-black border border-white/[0.06] p-4 text-center">
              <p
                className="ole-num text-white leading-none"
                style={{ fontSize: 'clamp(24px, 5.5vw, 36px)' }}
              >
                {league.current_teams}<span className="text-poeira">/{league.max_teams}</span>
              </p>
              <p className="mt-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-cimento">
                {league.status === 'open' ? 'Inscritos' : league.current_round ? `Rodada ${league.current_round}/${league.total_rounds}` : 'Times'}
              </p>
            </div>
          </div>

          {/* Actions — share ALWAYS visible for participants */}
          <div className="mt-4 space-y-2">
            {league.status === 'open' && !myEntry && (
              <button onClick={() => void onJoin()} disabled={joining}
                className="btn-primary w-full disabled:opacity-40">
                <span className="btn-primary-inner justify-center py-1.5">
                  <Swords className="h-4 w-4" />
                  {joining ? 'Entrando…' : `Inscrever −${formatPool(league.entry_fee)} ${league.currency}`}
                </span>
              </button>
            )}
            {league.status === 'open' && myEntry && (
              <div className="border border-alta/50 px-4 py-3 text-center font-mono text-[11.5px] uppercase tracking-[0.12em] text-alta">
                Inscrito · Aguardando {league.max_teams - league.current_teams} times
              </div>
            )}
            <ShareButton slug={league.slug} />
          </div>

          {error && <p className="mt-2 text-[12px] text-baixa">{error}</p>}
        </div>
      </motion.div>

      {/* Premiação */}
      {champions.length > 0 && (
        <section className="space-y-2">
          <div className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-neon-yellow">
            Premiação Final
          </div>
          {champions.map((c, i) => (
            <motion.div
              key={c.rank}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`flex items-center justify-between gap-3 px-4 py-3 ${c.rank === 1 ? 'bg-neon-yellow text-black' : 'sports-panel'}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className={`inline-flex shrink-0 items-center ${c.rank === 1 ? 'text-black' : RANK_COLORS[c.rank - 1]}`}><RankIcon rank={c.rank} className="h-5 w-5" /></span>
                <span className={c.rank === 1 ? 'truncate font-impact text-[22px] uppercase leading-[1.1] text-black' : 'truncate text-[14px] font-semibold text-giz'}>{c.club_name}</span>
              </div>
              <span className={`ole-num shrink-0 text-[15px] ${c.rank === 1 ? 'text-black' : 'text-white'}`}>
                {formatPool(c.prize_amount)} <span className={`font-mono text-[10px] ${c.rank === 1 ? 'text-black/70' : 'text-cimento'}`}>{c.currency}</span>
              </span>
            </motion.div>
          ))}
        </section>
      )}

      {/* Participantes (quando liga está open) */}
      {league.status === 'open' && entries.length > 0 && (
        <section className="space-y-2">
          <div className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-cimento">
            Inscritos ({entries.length}/{league.max_teams})
          </div>
          <div className="grid grid-cols-2 gap-2">
            {entries.map((e, i) => (
              <div key={e.id} className="flex min-w-0 items-center gap-2 border border-white/[0.06] bg-deep-black px-3 py-2">
                <span className="ole-num text-[10px] text-poeira">{i + 1}</span>
                <span className="text-[12px] font-semibold text-giz truncate flex-1">{e.club_name}</span>
                {e.user_id === league.creator_id && (
                  <Star className="h-3 w-3 text-neon-yellow shrink-0" />
                )}
                <span className="ole-num text-[10px] text-cimento shrink-0">{e.overall}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Bracket */}
      {rounds.length > 0 && (
        <section className="space-y-4">
          <div className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-cimento">
            Chave do mata-mata
          </div>
          {rounds.map((r) => (
            <div key={r} className="space-y-2">
              <div className="flex items-center gap-2">
                <Swords className="h-3.5 w-3.5 text-neon-yellow" />
                <p className="ole-num text-[11px] uppercase text-neon-yellow">
                  {roundLabel(r)}
                </p>
              </div>
              {fixtures.filter((f) => f.round === r).map((fx, fi) => {
                const homeWon = fx.winner_entry_id === fx.home_entry_id;
                const awayWon = fx.winner_entry_id === fx.away_entry_id;
                return (
                  <motion.div
                    key={fx.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: fi * 0.05 }}
                    className="overflow-hidden border border-white/[0.06] bg-deep-black"
                  >
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center">
                      <div className={`px-3 py-2.5 text-[12.5px] truncate ${homeWon ? 'font-bold text-white' : 'text-cimento'}`}>
                        {fx.home_club_name ?? 'A definir'}
                      </div>
                      <div className="px-3 py-2.5 text-center border-x border-white/[0.06]">
                        {fx.status === 'finished' ? (
                          <div>
                            <span className="ole-num text-[15px] text-white">
                              {fx.score_home} - {fx.score_away}
                            </span>
                            {fx.went_to_penalties && (
                              <p className="font-mono text-[9.5px] text-neon-yellow">pen {fx.penalty_home}-{fx.penalty_away}</p>
                            )}
                          </div>
                        ) : (
                          <span className="font-mono text-[10.5px] text-poeira uppercase">vs</span>
                        )}
                      </div>
                      <div className={`px-3 py-2.5 text-[12.5px] truncate text-right ${awayWon ? 'font-bold text-white' : 'text-cimento'}`}>
                        {fx.away_club_name ?? 'A definir'}
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
      <div className="sports-panel p-4 space-y-2">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-cimento">Distribuição do Pote</p>
        <div className="grid grid-cols-6 gap-1 text-center font-mono text-[10px] text-cimento">
          {[
            { label: <Trophy className="mx-auto h-3.5 w-3.5 text-neon-yellow" strokeWidth={2.2} />, pct: league.pct_champion },
            { label: <Medal className="mx-auto h-3.5 w-3.5 text-giz" strokeWidth={2.2} />, pct: league.pct_vice },
            { label: <Medal className="mx-auto h-3.5 w-3.5 text-cimento" strokeWidth={2.2} />, pct: league.pct_third },
            { label: '4º', pct: league.pct_fourth },
            { label: 'Criador', pct: league.pct_creator },
            { label: 'Casa', pct: league.pct_house },
          ].map((s, i) => (
            <div key={i}>
              <p className="text-[11px]">{s.label}</p>
              <p className="ole-num text-giz">{s.pct}%</p>
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
      <div className="mx-auto max-w-lg px-4 py-6">
        <LeagueDetailView leagueId={selectedId} onBack={() => { setSelectedId(null); setJustCreated(false); void load(); }} clubOverall={clubOverall} justCreated={justCreated} />
      </div>
    );
  }

  const displayLeagues = tab === 'open' ? leagues : myLeagues;

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div>
            <Hashtag className="text-neon-yellow">#premiada</Hashtag>
            <h1
              className="mt-1 font-impact uppercase text-white leading-[1.1]"
              style={{ fontSize: 'clamp(1.8rem, 6vw, 2.5rem)', letterSpacing: '-0.005em' }}
            >
              Ligas Premiadas
            </h1>
            <p className="mt-1 font-mono text-[11px] text-cimento">Mata-mata · pote em EXP · top 4 premiados</p>
          </div>
          <button onClick={() => setCreateOpen(true)}
            className="btn-primary disabled:opacity-40">
            <span className="btn-primary-inner gap-1.5 px-3 py-1">
              <Plus className="h-3.5 w-3.5" /> Criar
            </span>
          </button>
        </div>
      </motion.div>

      {slugNotFound && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="border border-baixa/50 bg-panel px-4 py-3 text-[12px] text-baixa">
          <span className="font-bold">Liga não encontrada.</span>{' '}
          Confira o link ou veja as abertas abaixo.
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-panel border border-white/10 p-1">
        {(['open', 'mine'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`ole-num flex-1 whitespace-nowrap py-2.5 text-[12px] uppercase transition-colors ${
              tab === t
                ? 'bg-neon-yellow text-black'
                : 'text-cimento hover:text-white'
            }`}>
            {t === 'open' ? `Abertas (${leagues.length})` : `Minhas (${myLeagues.length})`}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-neon-yellow/20 border-t-neon-yellow" />
          <p className="mt-3 font-mono text-[11px] text-cimento">Carregando ligas…</p>
        </div>
      ) : displayLeagues.length > 0 ? (
        <div className="space-y-3">
          {displayLeagues.map((l, i) => (
            <LeagueCard key={l.id} league={l} onClick={() => setSelectedId(l.id)} delay={i * 0.06} />
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="py-16 text-center space-y-4"
        >
          <Trophy className="mx-auto h-8 w-8 text-poeira" />
          <div>
            <p className="font-impact text-[20px] uppercase leading-[1.1] text-cimento">
              {tab === 'open' ? 'Nenhuma liga aberta' : 'Você ainda não entrou'}
            </p>
            <p className="mt-1 font-mono text-[11px] text-poeira">
              {tab === 'open' ? 'Crie a primeira liga premiada' : 'Entre em uma liga aberta ou crie a sua'}
            </p>
          </div>
          {tab === 'open' && (
            <button onClick={() => setCreateOpen(true)}
              className="ole-num inline-flex items-center gap-1.5 text-[12px] uppercase text-neon-yellow hover:text-white transition-colors">
              <Plus className="h-3.5 w-3.5" /> Criar Liga Premiada
            </button>
          )}
        </motion.div>
      )}

      <CreateLeagueModal open={createOpen} onClose={() => setCreateOpen(false)} clubOverall={clubOverall} onCreated={(id) => { setJustCreated(true); void load(); if (id) setSelectedId(id); }} />
    </div>
  );
}
