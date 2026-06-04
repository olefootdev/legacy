import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Trophy, Users, Plus, Copy, Check, ChevronRight } from 'lucide-react';
import { useGameStore } from '@/game/store';
import {
  fetchOpenLeagues,
  fetchMyLeagues,
  fetchLeagueDetail,
  createLeague,
  joinLeague,
  findLeagueByInvite,
  inviteLinkForLeague,
  type PremiumLeague,
  type PremiumLeagueFixture,
  type PremiumLeagueChampion,
} from '@/supabase/premiumLeagues';

function formatPool(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString('pt-BR');
}

const SIZE_OPTIONS = [16, 32, 64] as const;

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    open: { label: 'Aberta', cls: 'border-neon-green/40 text-neon-green bg-neon-green/10' },
    live: { label: 'Ao Vivo', cls: 'border-red-400/40 text-red-400 bg-red-400/10 animate-pulse' },
    finished: { label: 'Encerrada', cls: 'border-white/20 text-white/50 bg-white/5' },
    cancelled: { label: 'Cancelada', cls: 'border-white/10 text-white/30 bg-white/5' },
  };
  const s = map[status] ?? map.cancelled!;
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${s.cls}`}>
      {s.label}
    </span>
  );
}

function LeagueCard({ league, onClick }: { league: PremiumLeague; onClick: () => void }) {
  const progress = league.max_teams > 0 ? (league.current_teams / league.max_teams) * 100 : 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left border border-white/[0.08] bg-[#0b0b0b] p-4 transition hover:border-neon-yellow/30 hover:-translate-y-0.5"
      style={{ borderRadius: 'var(--radius-card)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-neon-yellow shrink-0" />
            <h3 className="font-display text-[13px] font-bold uppercase tracking-wide text-white truncate">
              {league.name}
            </h3>
          </div>
          <p className="mt-1 text-[11px] text-white/50">
            Criada por {league.creator_club_name} · {league.max_teams} times · Mata-mata
          </p>
        </div>
        <StatusBadge status={league.status} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div>
          <p className="font-display text-[18px] font-black tabular-nums text-neon-yellow">
            {formatPool(league.entry_fee)} <span className="text-[11px] text-neon-yellow/70">{league.currency}</span>
          </p>
          <p className="text-[10px] text-white/40">Inscrição</p>
        </div>
        <div className="text-right">
          <p className="font-display text-[18px] font-black tabular-nums text-white">
            {formatPool(league.total_pool)} <span className="text-[11px] text-white/50">{league.currency}</span>
          </p>
          <p className="text-[10px] text-white/40">Pote total</p>
        </div>
      </div>
      <div className="mt-2">
        <div className="flex items-center justify-between text-[10px] text-white/40 mb-1">
          <span>{league.current_teams}/{league.max_teams} times</span>
          {league.status === 'live' && league.current_round && league.total_rounds && (
            <span>Round {league.current_round}/{league.total_rounds}</span>
          )}
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full bg-neon-yellow/60 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </button>
  );
}

function CreateLeagueModal({ open, onClose, onCreated }: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const club = useGameStore((s) => s.club);
  const [name, setName] = useState('');
  const [maxTeams, setMaxTeams] = useState<16 | 32 | 64>(16);
  const [entryFee, setEntryFee] = useState('10000');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await createLeague({
      name: name.trim(),
      maxTeams,
      entryFee: Number(entryFee),
      clubName: club?.name ?? 'Clube',
      clubShort: club?.shortName,
    });
    setBusy(false);
    if (!r.ok) { setError('error' in r ? r.error : 'Erro desconhecido'); return; }
    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-white/15 bg-[#0c0c0c] shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="font-display font-bold text-lg text-white">Criar Liga Premiada</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl">×</button>
        </div>
        <form onSubmit={(e) => void onSubmit(e)} className="p-5 space-y-4">
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Nome da Liga</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required
              placeholder="Ex: Copa dos Campeões"
              className="mt-1 w-full rounded-md border border-white/15 bg-black/50 px-3 py-2.5 text-sm text-white focus:border-neon-yellow/50 focus:outline-none" />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Quantidade de Times</span>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {SIZE_OPTIONS.map((n) => (
                <button key={n} type="button" onClick={() => setMaxTeams(n)}
                  className={`rounded-md border py-2.5 font-display text-sm font-bold transition ${maxTeams === n ? 'border-neon-yellow bg-neon-yellow/10 text-neon-yellow' : 'border-white/10 text-white/50 hover:border-white/20'}`}>
                  {n}
                </button>
              ))}
            </div>
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Valor de Inscrição (EXP)</span>
            <input type="number" value={entryFee} onChange={(e) => setEntryFee(e.target.value)} required min={100}
              className="mt-1 w-full rounded-md border border-white/15 bg-black/50 px-3 py-2.5 text-sm text-white focus:border-neon-yellow/50 focus:outline-none" />
          </label>
          <div className="rounded-md border border-neon-yellow/20 bg-neon-yellow/[0.04] p-3 text-[11px] text-white/60 space-y-1">
            <p><strong className="text-white">Pote estimado:</strong> {formatPool(Number(entryFee) * maxTeams)} EXP</p>
            <p>Campeão 40% · Vice 20% · 3º 12% · 4º 8%</p>
            <p>Você (criador) ganha <strong className="text-neon-yellow">10%</strong> do total</p>
          </div>
          {error && (
            <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-200">{error}</p>
          )}
          <button type="submit" disabled={busy || !name.trim() || !entryFee}
            className="btn-primary w-full disabled:opacity-40 disabled:pointer-events-none">
            <span className="btn-primary-inner justify-center py-1">
              {busy ? 'Criando…' : 'Criar Liga'}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}

function LeagueDetailView({ leagueId, onBack }: { leagueId: string; onBack: () => void }) {
  const club = useGameStore((s) => s.club);
  const [league, setLeague] = useState<PremiumLeague | null>(null);
  const [fixtures, setFixtures] = useState<PremiumLeagueFixture[]>([]);
  const [champions, setChampions] = useState<PremiumLeagueChampion[]>([]);
  const [entryCount, setEntryCount] = useState(0);
  const [myEntry, setMyEntry] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const d = await fetchLeagueDetail(leagueId);
    if (!d) return;
    setLeague(d.league);
    setFixtures(d.fixtures);
    setChampions(d.champions);
    setEntryCount(d.entries.length);
    const sb = (await import('@/supabase/client')).getSupabase();
    const { data: { user } } = await sb!.auth.getUser();
    setMyEntry(d.entries.some((e) => e.user_id === user?.id));
  }, [leagueId]);

  useEffect(() => { void load(); const t = setInterval(() => void load(), 10000); return () => clearInterval(t); }, [load]);

  if (!league) return <div className="p-6 text-center text-white/40">Carregando…</div>;

  const onJoin = async () => {
    setJoining(true); setError(null);
    const r = await joinLeague({ leagueId, clubName: club?.name ?? 'Clube', clubShort: club?.shortName, overall: 50 });
    setJoining(false);
    if (!r.ok) { setError('error' in r ? r.error : 'Erro desconhecido'); return; }
    void load();
  };

  const onCopy = () => {
    void navigator.clipboard.writeText(inviteLinkForLeague(league.invite_code));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const roundLabel = (r: number) => {
    if (!league.total_rounds) return `Round ${r}`;
    const remaining = league.total_rounds - r + 1;
    if (remaining === 1) return 'Final';
    if (remaining === 2) return 'Semifinal';
    if (remaining === 3) return 'Quartas';
    if (remaining === 4) return 'Oitavas';
    return `Round ${r}`;
  };

  const rounds = [...new Set(fixtures.map((f) => f.round))].sort((a, b) => a - b);
  const rankEmoji = ['🏆', '🥈', '🥉', '4º'];

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-[11px] text-white/50 hover:text-white font-display uppercase tracking-wider">
        ← Voltar
      </button>

      <div className="border border-neon-yellow/20 bg-gradient-to-br from-neon-yellow/[0.04] to-transparent p-5" style={{ borderRadius: 'var(--radius-card)' }}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-black uppercase tracking-tight text-white">{league.name}</h2>
            <p className="mt-1 text-[11px] text-white/50">
              {league.max_teams} times · Mata-mata · {league.total_rounds} rodadas
            </p>
          </div>
          <StatusBadge status={league.status} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-md bg-black/40 border border-white/[0.06] p-3 text-center">
            <p className="font-display text-2xl font-black tabular-nums text-neon-yellow">{formatPool(league.total_pool)}</p>
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Pote {league.currency}</p>
          </div>
          <div className="rounded-md bg-black/40 border border-white/[0.06] p-3 text-center">
            <p className="font-display text-2xl font-black tabular-nums text-white">{league.current_teams}/{league.max_teams}</p>
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Times</p>
          </div>
        </div>

        {league.status === 'open' && (
          <div className="mt-4 flex gap-2">
            {!myEntry ? (
              <button onClick={() => void onJoin()} disabled={joining}
                className="btn-primary flex-1 disabled:opacity-40">
                <span className="btn-primary-inner justify-center py-1">
                  {joining ? 'Entrando…' : `Entrar · ${formatPool(league.entry_fee)} ${league.currency}`}
                </span>
              </button>
            ) : (
              <div className="flex-1 rounded-md border border-neon-green/30 bg-neon-green/10 px-4 py-3 text-center text-[12px] font-bold text-neon-green">
                Inscrito
              </div>
            )}
            <button onClick={onCopy}
              className="shrink-0 rounded-md border border-white/15 bg-black/40 px-4 py-3 text-white/60 hover:text-white transition">
              {copied ? <Check className="h-4 w-4 text-neon-green" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        )}

        {error && <p className="mt-2 text-[12px] text-rose-300">{error}</p>}
      </div>

      {champions.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-display text-[11px] font-bold uppercase tracking-[0.2em] text-neon-yellow/80">Premiação</h3>
          {champions.map((c) => (
            <div key={c.rank} className="flex items-center justify-between border border-white/[0.06] bg-[#0b0b0b] px-4 py-3" style={{ borderRadius: 'var(--radius-sm)' }}>
              <div className="flex items-center gap-3">
                <span className="text-lg">{rankEmoji[c.rank - 1]}</span>
                <span className="font-display text-[13px] font-bold text-white">{c.club_name}</span>
              </div>
              <span className="font-display text-[14px] font-black tabular-nums text-neon-yellow">
                {formatPool(c.prize_amount)} {c.currency}
              </span>
            </div>
          ))}
        </section>
      )}

      {rounds.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-display text-[11px] font-bold uppercase tracking-[0.2em] text-white/50">Bracket</h3>
          {rounds.map((r) => (
            <div key={r} className="space-y-2">
              <p className="font-display text-[10px] font-bold uppercase tracking-[0.15em] text-neon-yellow/60">
                {roundLabel(r)}
              </p>
              {fixtures.filter((f) => f.round === r).map((fx) => (
                <div key={fx.id}
                  className="flex items-center gap-2 border border-white/[0.06] bg-[#0b0b0b] px-3 py-2 text-[12px]"
                  style={{ borderRadius: 'var(--radius-sm)' }}>
                  <span className={`flex-1 truncate ${fx.winner_entry_id === fx.home_entry_id ? 'font-bold text-white' : 'text-white/50'}`}>
                    {fx.home_club_name ?? 'TBD'}
                  </span>
                  <span className="font-display text-[13px] font-black tabular-nums text-white/80 shrink-0">
                    {fx.status === 'finished'
                      ? `${fx.score_home} - ${fx.score_away}${fx.went_to_penalties ? ` (${fx.penalty_home}-${fx.penalty_away} pen)` : ''}`
                      : 'vs'}
                  </span>
                  <span className={`flex-1 truncate text-right ${fx.winner_entry_id === fx.away_entry_id ? 'font-bold text-white' : 'text-white/50'}`}>
                    {fx.away_club_name ?? 'TBD'}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

export function PremiumLeagues() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<'open' | 'mine'>('open');
  const [leagues, setLeagues] = useState<PremiumLeague[]>([]);
  const [myLeagues, setMyLeagues] = useState<PremiumLeague[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inviteResult, setInviteResult] = useState<PremiumLeague | null>(null);

  const load = useCallback(async () => {
    const [open, mine] = await Promise.all([fetchOpenLeagues(), fetchMyLeagues()]);
    setLeagues(open);
    setMyLeagues(mine);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const invite = searchParams.get('invite');
    if (!invite) return;
    void findLeagueByInvite(invite).then((l) => {
      if (l) { setSelectedId(l.id as string); }
    });
  }, [searchParams]);

  if (selectedId) {
    return (
      <div className="mx-auto max-w-lg px-4 py-6">
        <LeagueDetailView leagueId={selectedId} onBack={() => setSelectedId(null)} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-black uppercase tracking-tight text-white">Ligas Premiadas</h1>
          <p className="mt-1 text-[11px] text-white/50">Mata-mata · Pote em EXP · Top 4 premiados</p>
        </div>
        <button onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 rounded-md border border-neon-yellow/40 bg-neon-yellow/10 px-3 py-2 font-display text-[11px] font-bold uppercase tracking-wider text-neon-yellow hover:bg-neon-yellow/20 transition">
          <Plus className="h-3.5 w-3.5" /> Criar
        </button>
      </div>

      <div className="flex gap-1 rounded-md bg-white/[0.04] p-1">
        {(['open', 'mine'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 rounded-sm py-2 font-display text-[11px] font-bold uppercase tracking-wider transition ${tab === t ? 'bg-neon-yellow/15 text-neon-yellow' : 'text-white/40 hover:text-white/60'}`}>
            {t === 'open' ? 'Abertas' : 'Minhas'}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-8 text-center text-white/30 text-sm">Carregando ligas…</p>
      ) : (
        <div className="space-y-3">
          {(tab === 'open' ? leagues : myLeagues).map((l) => (
            <LeagueCard key={l.id} league={l} onClick={() => setSelectedId(l.id)} />
          ))}
          {(tab === 'open' ? leagues : myLeagues).length === 0 && (
            <div className="py-12 text-center space-y-3">
              <Trophy className="mx-auto h-10 w-10 text-white/15" />
              <p className="text-sm text-white/40">
                {tab === 'open' ? 'Nenhuma liga aberta no momento' : 'Você ainda não entrou em nenhuma liga'}
              </p>
              {tab === 'open' && (
                <button onClick={() => setCreateOpen(true)}
                  className="text-[12px] font-bold text-neon-yellow hover:underline">
                  Criar a primeira liga →
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <CreateLeagueModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => void load()} />
    </div>
  );
}
