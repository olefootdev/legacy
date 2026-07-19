import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Trophy, Users, Plus, Copy, Check, Share2, Swords, Crown, Star } from 'lucide-react';
import { useGameStore } from '@/game/store';
import { overallFromAttributes } from '@/entities/player';
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
const RANK_MEDALS = ['🏆', '🥈', '🥉', '4º'];
const RANK_COLORS = ['text-[#FFD700]', 'text-[#C0C0C0]', 'text-[#CD7F32]', 'text-white/50'];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    open: { label: 'Inscrições Abertas', cls: 'border-neon-green/50 text-neon-green bg-neon-green/10' },
    live: { label: 'Ao Vivo', cls: 'border-red-400/50 text-red-400 bg-red-400/10' },
    finished: { label: 'Encerrada', cls: 'border-white/20 text-white/40 bg-white/5' },
    cancelled: { label: 'Cancelada', cls: 'border-white/10 text-white/30 bg-white/5' },
  };
  const s = map[status] ?? map.cancelled!;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] ${s.cls}`}>
      {status === 'live' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />}
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
      <button onClick={() => void onShare()} className="flex items-center gap-1.5 rounded-full border border-neon-yellow/30 bg-neon-yellow/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-neon-yellow hover:bg-neon-yellow/20 transition">
        {copied ? <Check className="h-3 w-3" /> : <Share2 className="h-3 w-3" />}
        {copied ? 'Copiado!' : 'Convidar'}
      </button>
    );
  }
  return (
    <button onClick={() => void onShare()}
      className="flex items-center justify-center gap-2 w-full rounded-md border border-neon-yellow/30 bg-neon-yellow/10 px-4 py-3 font-display text-[12px] font-bold uppercase tracking-[0.15em] text-neon-yellow hover:bg-neon-yellow/20 transition">
      {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      {copied ? 'Link Copiado!' : 'Compartilhar Liga'}
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
      className="w-full text-left sports-panel panel-accent overflow-hidden p-0 hover:-translate-y-0.5 transition-transform"
      style={{ borderRadius: 'var(--radius-card)' }}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neon-yellow/30 bg-neon-yellow/10">
                <Trophy className="h-4 w-4 text-neon-yellow" />
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-[15px] font-black uppercase tracking-tight text-white truncate">
                  {league.name}
                </h3>
                <p className="text-[10px] text-white/40 font-display uppercase tracking-[0.12em]">
                  por {league.creator_club_name}
                </p>
              </div>
            </div>
          </div>
          <StatusBadge status={league.status} />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div>
            <p className="font-display text-[9px] font-bold uppercase tracking-[0.2em] text-white/35">Inscrição</p>
            <p className="mt-0.5 font-display text-[18px] font-black tabular-nums text-neon-yellow leading-none">
              {formatPool(league.entry_fee)}
            </p>
            <p className="text-[9px] text-neon-yellow/50">{league.currency}</p>
          </div>
          <div>
            <p className="font-display text-[9px] font-bold uppercase tracking-[0.2em] text-white/35">Pote</p>
            <p className="mt-0.5 font-display text-[18px] font-black tabular-nums text-white leading-none">
              {formatPool(league.total_pool)}
            </p>
            <p className="text-[9px] text-white/40">{league.currency}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-[9px] font-bold uppercase tracking-[0.2em] text-white/35">Times</p>
            <p className="mt-0.5 font-display text-[18px] font-black tabular-nums text-white leading-none">
              {league.current_teams}<span className="text-white/30">/{league.max_teams}</span>
            </p>
            {league.status === 'live' && league.current_round && (
              <p className="text-[9px] text-red-400/80">R{league.current_round}/{league.total_rounds}</p>
            )}
          </div>
        </div>

        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-neon-yellow/80 to-neon-yellow"
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
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-neon-yellow/20 bg-[#0c0c0c] shadow-[0_0_60px_rgba(253,225,0,0.08)]"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-neon-yellow" />
            <h2 className="font-display text-lg font-black uppercase tracking-tight text-white">Criar Liga</h2>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white text-2xl leading-none">×</button>
        </div>
        <form onSubmit={(e) => void onSubmit(e)} className="p-6 space-y-5">
          <label className="block">
            <span className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">Nome da Liga</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required minLength={3} maxLength={40}
              placeholder="Ex: Copa dos Campeões"
              className="mt-1.5 w-full rounded-md border border-white/10 bg-deep-black px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-neon-yellow/40 focus:outline-none" />
          </label>
          <div>
            <span className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">Quantidade de Times</span>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {SIZE_OPTIONS.map((n) => (
                <button key={n} type="button" onClick={() => setMaxTeams(n)}
                  className={`rounded-md border py-3 font-display text-[16px] font-black transition ${
                    maxTeams === n
                      ? 'border-neon-yellow bg-neon-yellow/15 text-neon-yellow shadow-[0_0_20px_rgba(253,225,0,0.1)]'
                      : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'
                  }`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">Valor de Inscrição (EXP)</span>
            <input type="number" value={entryFee} onChange={(e) => setEntryFee(e.target.value)} required min={100} max={10000000}
              className="mt-1.5 w-full rounded-md border border-white/10 bg-deep-black px-4 py-3 text-sm text-white tabular-nums focus:border-neon-yellow/40 focus:outline-none" />
          </label>

          <div className="rounded-md border border-neon-yellow/20 bg-neon-yellow/[0.03] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-display text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">Pote Estimado</span>
              <span className="font-display text-[20px] font-black tabular-nums text-neon-yellow">{formatPool(estimatedPool)} EXP</span>
            </div>
            <div className="h-px bg-white/[0.06]" />
            <div className="grid grid-cols-3 gap-2 text-[10px]">
              <div><span className="text-[#FFD700]">🏆 40%</span><br/><span className="text-white/40">{formatPool(estimatedPool * 0.4)}</span></div>
              <div><span className="text-[#C0C0C0]">🥈 20%</span><br/><span className="text-white/40">{formatPool(estimatedPool * 0.2)}</span></div>
              <div><span className="text-[#CD7F32]">🥉 12%</span><br/><span className="text-white/40">{formatPool(estimatedPool * 0.12)}</span></div>
            </div>
            <p className="text-[10px] text-neon-yellow/60">
              Você ganha <strong className="text-neon-yellow">10%</strong> do pote como criador ({formatPool(estimatedPool * 0.1)} EXP)
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-[12px] text-rose-200">
              <span className="text-rose-400">✗</span> {error}
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

  if (!league) return <div className="py-16 text-center text-white/30 text-sm">Carregando…</div>;

  const onJoin = async () => {
    setJoining(true); setError(null);
    const r = await joinLeague({ leagueId, clubName: club?.name ?? 'Clube', clubShort: club?.shortName, overall: clubOverall });
    setJoining(false);
    if (!r.ok) { setError('error' in r ? r.error : 'Erro'); return; }
    void load();
  };

  const roundLabel = (r: number) => {
    if (!league.total_rounds) return `Round ${r}`;
    const remaining = league.total_rounds - r + 1;
    if (remaining === 1) return 'Final';
    if (remaining === 2) return 'Semifinal';
    if (remaining === 3) return 'Quartas de Final';
    if (remaining === 4) return 'Oitavas de Final';
    return `Round ${r}`;
  };

  const rounds = [...new Set(fixtures.map((f) => f.round))].sort((a, b) => a - b);

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="font-display text-[11px] font-bold uppercase tracking-[0.18em] text-white/40 hover:text-neon-yellow transition">
        ← Todas as Ligas
      </button>

      {showCreatedBanner && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className="rounded-md border border-neon-green/30 bg-neon-green/10 px-4 py-3 text-[12px] text-neon-green font-bold text-center">
          Liga criada com sucesso! Compartilhe o link para convidar adversários.
        </motion.div>
      )}

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden sports-panel"
        style={{ borderRadius: 'var(--radius-card-lg)', boxShadow: 'var(--shadow-glow-yellow)' }}
      >
        <div className="absolute left-0 top-0 h-full w-1 bg-neon-yellow" />
        <div className="absolute inset-0 bg-gradient-to-br from-neon-yellow/[0.05] via-transparent to-transparent" />
        <div className="relative p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Crown className="h-5 w-5 text-neon-yellow" />
                <StatusBadge status={league.status} />
              </div>
              <h2
                className="font-display font-black uppercase text-white leading-none"
                style={{ fontSize: 'clamp(1.5rem, 5vw, 2.2rem)', letterSpacing: '-0.01em' }}
              >
                {league.name}
              </h2>
              <p className="mt-1 text-[11px] text-white/40">
                <span className="text-neon-yellow/60">por {league.creator_club_name}</span> · {league.max_teams} times · Mata-mata
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-deep-black/60 border border-white/[0.06] p-4 text-center">
              <p
                className="tabular-nums text-neon-yellow leading-none"
                style={{ fontFamily: 'var(--font-serif-hero)', fontStyle: 'italic', fontSize: 'clamp(28px, 6vw, 42px)' }}
              >
                {formatPool(league.total_pool)}
              </p>
              <p className="mt-1 font-display text-[9px] font-bold uppercase tracking-[0.25em] text-white/35">
                Pote Total · {league.currency}
              </p>
            </div>
            <div className="rounded-lg bg-deep-black/60 border border-white/[0.06] p-4 text-center">
              <p
                className="tabular-nums text-white leading-none"
                style={{ fontFamily: 'var(--font-serif-hero)', fontStyle: 'italic', fontSize: 'clamp(28px, 6vw, 42px)' }}
              >
                {league.current_teams}<span className="text-white/25">/{league.max_teams}</span>
              </p>
              <p className="mt-1 font-display text-[9px] font-bold uppercase tracking-[0.25em] text-white/35">
                {league.status === 'open' ? 'Inscritos' : league.current_round ? `Round ${league.current_round}/${league.total_rounds}` : 'Times'}
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
                  {joining ? 'Entrando…' : `Inscrever-se · ${formatPool(league.entry_fee)} ${league.currency}`}
                </span>
              </button>
            )}
            {league.status === 'open' && myEntry && (
              <div className="rounded-md border border-neon-green/30 bg-neon-green/10 px-4 py-3 text-center font-display text-[12px] font-bold uppercase tracking-wider text-neon-green">
                Inscrito · Aguardando {league.max_teams - league.current_teams} times
              </div>
            )}
            <ShareButton slug={league.slug} />
          </div>

          {error && <p className="mt-2 text-[12px] text-rose-300">{error}</p>}
        </div>
      </motion.div>

      {/* Premiação */}
      {champions.length > 0 && (
        <section className="space-y-2">
          <div className="font-display text-[10px] font-bold uppercase tracking-[0.28em] text-neon-yellow/70">
            Premiação Final
          </div>
          {champions.map((c, i) => (
            <motion.div
              key={c.rank}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center justify-between sports-panel px-4 py-3"
              style={{ borderRadius: 'var(--radius-md)' }}
            >
              <div className="flex items-center gap-3">
                <span className={`text-lg ${RANK_COLORS[c.rank - 1]}`}>{RANK_MEDALS[c.rank - 1]}</span>
                <span className="font-display text-[13px] font-bold uppercase tracking-tight text-white">{c.club_name}</span>
              </div>
              <span className="font-display text-[15px] font-black tabular-nums text-neon-yellow">
                {formatPool(c.prize_amount)} <span className="text-[10px] text-neon-yellow/50">{c.currency}</span>
              </span>
            </motion.div>
          ))}
        </section>
      )}

      {/* Participantes (quando liga está open) */}
      {league.status === 'open' && entries.length > 0 && (
        <section className="space-y-2">
          <div className="font-display text-[10px] font-bold uppercase tracking-[0.28em] text-white/40">
            Inscritos ({entries.length}/{league.max_teams})
          </div>
          <div className="grid grid-cols-2 gap-2">
            {entries.map((e, i) => (
              <div key={e.id} className="flex items-center gap-2 rounded-md border border-white/[0.06] bg-[#0b0b0b] px-3 py-2">
                <span className="font-display text-[10px] font-bold text-white/25 tabular-nums">{i + 1}</span>
                <span className="text-[11px] font-bold text-white truncate flex-1">{e.club_name}</span>
                {e.user_id === league.creator_id && (
                  <Star className="h-3 w-3 text-neon-yellow/60 shrink-0" />
                )}
                <span className="text-[9px] font-bold text-white/25 tabular-nums shrink-0">{e.overall}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Bracket */}
      {rounds.length > 0 && (
        <section className="space-y-4">
          <div className="font-display text-[10px] font-bold uppercase tracking-[0.28em] text-white/40">
            Bracket Mata-Mata
          </div>
          {rounds.map((r) => (
            <div key={r} className="space-y-2">
              <div className="flex items-center gap-2">
                <Swords className="h-3.5 w-3.5 text-neon-yellow/50" />
                <p className="font-display text-[11px] font-bold uppercase tracking-[0.15em] text-neon-yellow/70">
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
                    className="overflow-hidden border border-white/[0.06] bg-[#0b0b0b]"
                    style={{ borderRadius: 'var(--radius-md)' }}
                  >
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center">
                      <div className={`px-3 py-2.5 text-[12px] font-bold truncate ${homeWon ? 'text-white bg-neon-yellow/[0.06]' : 'text-white/40'}`}>
                        {fx.home_club_name ?? 'A definir'}
                      </div>
                      <div className="px-3 py-2.5 text-center border-x border-white/[0.04]">
                        {fx.status === 'finished' ? (
                          <div>
                            <span className="font-display text-[16px] font-black tabular-nums text-white">
                              {fx.score_home} - {fx.score_away}
                            </span>
                            {fx.went_to_penalties && (
                              <p className="text-[9px] text-neon-yellow/60">pen {fx.penalty_home}-{fx.penalty_away}</p>
                            )}
                          </div>
                        ) : (
                          <span className="font-display text-[11px] font-bold text-white/20 uppercase">vs</span>
                        )}
                      </div>
                      <div className={`px-3 py-2.5 text-[12px] font-bold truncate text-right ${awayWon ? 'text-white bg-neon-yellow/[0.06]' : 'text-white/40'}`}>
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
      <div className="sports-panel p-4 space-y-2" style={{ borderRadius: 'var(--radius-md)' }}>
        <p className="font-display text-[9px] font-bold uppercase tracking-[0.22em] text-white/30">Distribuição do Pote</p>
        <div className="grid grid-cols-6 gap-1 text-center text-[10px]">
          {[
            { label: '🏆', pct: league.pct_champion },
            { label: '🥈', pct: league.pct_vice },
            { label: '🥉', pct: league.pct_third },
            { label: '4º', pct: league.pct_fourth },
            { label: 'Criador', pct: league.pct_creator },
            { label: 'Casa', pct: league.pct_house },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-[12px]">{s.label}</p>
              <p className="font-bold text-white/50 tabular-nums">{s.pct}%</p>
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
            <p className="font-display text-[10px] font-bold uppercase tracking-[0.35em] text-neon-yellow/70">
              Competição Premium
            </p>
            <h1
              className="mt-1 font-display font-black uppercase text-white leading-none"
              style={{ fontSize: 'clamp(1.8rem, 6vw, 2.5rem)', letterSpacing: '-0.01em' }}
            >
              Ligas Premiadas
            </h1>
            <p className="mt-1 text-[11px] text-white/40">Mata-mata · Pote em EXP · Top 4 premiados</p>
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
          className="rounded-md border border-rose-500/20 bg-rose-500/[0.06] px-4 py-3 text-[12px] text-rose-200">
          <span className="font-bold">Liga não encontrada.</span>{' '}
          O link pode estar incorreto. Veja as ligas abertas abaixo:
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-md bg-white/[0.03] border border-white/[0.06] p-1">
        {(['open', 'mine'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 rounded-sm py-2.5 font-display text-[11px] font-bold uppercase tracking-[0.18em] transition ${
              tab === t
                ? 'bg-neon-yellow/15 text-neon-yellow border border-neon-yellow/20'
                : 'text-white/30 hover:text-white/50 border border-transparent'
            }`}>
            {t === 'open' ? `Abertas (${leagues.length})` : `Minhas (${myLeagues.length})`}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-neon-yellow/20 border-t-neon-yellow" />
          <p className="mt-3 text-[11px] text-white/30">Carregando ligas…</p>
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
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
            <Trophy className="h-7 w-7 text-white/15" />
          </div>
          <div>
            <p className="font-display text-[14px] font-bold uppercase tracking-tight text-white/40">
              {tab === 'open' ? 'Nenhuma liga aberta' : 'Você ainda não entrou'}
            </p>
            <p className="mt-1 text-[11px] text-white/25">
              {tab === 'open' ? 'Crie a primeira liga premiada' : 'Entre em uma liga aberta ou crie a sua'}
            </p>
          </div>
          {tab === 'open' && (
            <button onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 font-display text-[11px] font-bold uppercase tracking-wider text-neon-yellow hover:text-white transition">
              <Plus className="h-3.5 w-3.5" /> Criar Liga Premiada
            </button>
          )}
        </motion.div>
      )}

      <CreateLeagueModal open={createOpen} onClose={() => setCreateOpen(false)} clubOverall={clubOverall} onCreated={(id) => { setJustCreated(true); void load(); if (id) setSelectedId(id); }} />
    </div>
  );
}
