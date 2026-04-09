import { motion, AnimatePresence } from 'motion/react';
import { Play, Zap, ChevronRight, Activity, Search, Star, Trophy, X, UserPlus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useGameDispatch, useGameStore } from '@/game/store';
import { formatExp, FRIENDLY_CHALLENGE_BRO_FEE_RATE, friendlyChallengeBroFeeCents } from '@/systems/economy';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { PastResult, PlayerEntity } from '@/entities/types';
import { overallFromAttributes } from '@/entities/player';
import { isHiddenFromHomeInboxFeed, type InboxItem } from '@/game/inboxTypes';
import { buildHomeRankingPreview, getFullRankingEntries } from '@/ranking/worldRanking';
import { useRankingFavorites } from '@/ranking/useRankingFavorites';
import { MatchdayVersusTitle } from '@/components/matchday/MatchdayVersusTitle';

const HOME_NOTIF_VISIBLE_COUNT = 5;

/** Abas fixas da HOME — alinhadas ao pedido (não mostrar só categorias que já existem no inbox). */
type HomeNotifTab = 'ALL' | 'STAFF' | 'TORCIDA' | 'JOGADORES' | 'COMPETIÇÃO';

const HOME_NOTIF_TABS: { key: HomeNotifTab; label: string }[] = [
  { key: 'ALL', label: 'Todos' },
  { key: 'STAFF', label: 'Staff' },
  { key: 'TORCIDA', label: 'Torcida' },
  { key: 'JOGADORES', label: 'Jogadores' },
  { key: 'COMPETIÇÃO', label: 'Competição' },
];

function inboxMatchesHomeNotifTab(item: InboxItem, tab: HomeNotifTab): boolean {
  if (tab === 'ALL') return true;
  if (tab === 'STAFF') return item.category === 'STAFF';
  if (tab === 'TORCIDA') return item.category === 'TORCIDA';
  if (tab === 'JOGADORES') return item.category === 'PLANTEL' || item.category === 'TREINO';
  if (tab === 'COMPETIÇÃO') return item.category === 'COMPETIÇÃO';
  return true;
}

function InboxBodyText({ text }: { text: string }) {
  const parts = useMemo(() => {
    const nodes: ReactNode[] = [];
    const re = /\*\*(.+?)\*\*/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let k = 0;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) {
        nodes.push(<span key={`t-${k++}`}>{text.slice(last, m.index)}</span>);
      }
      nodes.push(
        <strong key={`b-${k++}`} className="font-semibold text-white">
          {m[1]}
        </strong>,
      );
      last = re.lastIndex;
    }
    if (last < text.length) {
      nodes.push(<span key={`t-${k++}`}>{text.slice(last)}</span>);
    }
    return nodes.length ? nodes : text;
  }, [text]);
  return <p className="text-xs text-gray-400 mt-1 leading-relaxed">{parts}</p>;
}

function pickHomeHighlight(players: Record<string, PlayerEntity>): {
  id: string;
  name: string;
  ovr: number;
} {
  const list = Object.values(players);
  const outfield = list.filter((p) => p.pos.toUpperCase() !== 'GOL');
  const candidates = outfield.length ? outfield : list;
  if (!candidates.length) return { id: '', name: '—', ovr: 70 };
  let best = candidates[0]!;
  let bestOvr = overallFromAttributes(best.attrs);
  for (const p of candidates) {
    const o = overallFromAttributes(p.attrs);
    if (o > bestOvr) {
      best = p;
      bestOvr = o;
    }
  }
  return { id: best.id, name: best.name, ovr: bestOvr };
}

function starsForOvr(ovr: number): number {
  return Math.max(1, Math.min(5, Math.round(ovr / 20)));
}

function resultOutcomeMeta(result: PastResult['result']) {
  switch (result) {
    case 'win':
      return {
        label: 'V',
        sub: 'Vitória',
        bar: 'bg-emerald-400',
        pill: 'text-emerald-300',
        side: 'bg-emerald-500/15 border-emerald-400/25',
      };
    case 'draw':
      return {
        label: 'E',
        sub: 'Empate',
        bar: 'bg-amber-400',
        pill: 'text-amber-200',
        side: 'bg-amber-500/12 border-amber-400/20',
      };
    case 'loss':
      return {
        label: 'D',
        sub: 'Derrota',
        bar: 'bg-red-500',
        pill: 'text-red-300',
        side: 'bg-red-500/12 border-red-500/25',
      };
  }
}

export function Home() {
  const dispatch = useGameDispatch();
  const navigate = useNavigate();
  const finance = useGameStore((s) => s.finance);
  const crowd = useGameStore((s) => s.crowd);
  const results = useGameStore((s) => s.results);
  const inbox = useGameStore((s) => s.inbox);
  const fixture = useGameStore((s) => s.nextFixture);
  const club = useGameStore((s) => s.club);
  const players = useGameStore((s) => s.players);

  const homeHighlight = useMemo(() => pickHomeHighlight(players), [players]);
  const awayHighlight = useMemo(() => {
    const h = fixture.opponent.highlightPlayer;
    if (h) return { name: h.name, ovr: h.ovr, imgSeed: `${fixture.opponent.id}-star` };
    return {
      name: 'DESTAQUE',
      ovr: fixture.opponent.strength,
      imgSeed: fixture.opponent.id,
    };
  }, [fixture.opponent]);
  const roundedSupport = Math.max(0, Math.min(100, Math.round(crowd.supportPercent * 2) / 2));
  const supportLabel = roundedSupport.toLocaleString('pt-BR', {
    minimumFractionDigits: Number.isInteger(roundedSupport) ? 0 : 1,
    maximumFractionDigits: 1,
  });
  const [searchTeam, setSearchTeam] = useState('');
  const { favorites, toggleFavorite } = useRankingFavorites();
  const [amistosoOpen, setAmistosoOpen] = useState(false);
  const [opponentName, setOpponentName] = useState('');
  const [opponentId, setOpponentId] = useState('');
  const [friendlyMode, setFriendlyMode] = useState<'auto' | 'quick'>('quick');
  const [betCurrency, setBetCurrency] = useState<'BRO' | 'EXP'>('BRO');
  const [betInput, setBetInput] = useState('10');
  const [notifTab, setNotifTab] = useState<HomeNotifTab>('ALL');
  const [notifShowAll, setNotifShowAll] = useState(false);
  const notificacoesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNotifShowAll(false);
  }, [notifTab]);

  const homeFeedInbox = useMemo(
    () => inbox.filter((i) => !isHiddenFromHomeInboxFeed(i)),
    [inbox],
  );

  const filteredInbox = useMemo(
    () => homeFeedInbox.filter((i) => inboxMatchesHomeNotifTab(i, notifTab)),
    [homeFeedInbox, notifTab],
  );

  const inboxPanelList = useMemo(
    () => (notifShowAll ? filteredInbox : filteredInbox.slice(0, HOME_NOTIF_VISIBLE_COUNT)),
    [filteredInbox, notifShowAll],
  );

  const scrollToNotificacoes = () => {
    notificacoesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const betBroCents = useMemo(() => {
    const n = parseFloat(betInput.replace(',', '.'));
    if (Number.isNaN(n) || n <= 0) return 0;
    return Math.max(1, Math.round(n * 100));
  }, [betInput]);
  const feeBroCents = betBroCents > 0 ? friendlyChallengeBroFeeCents(betBroCents) : 0;
  const totalBroCents = betBroCents + feeBroCents;

  const startFriendly = () => {
    const name = opponentName.trim();
    const oid = opponentId.trim();
    if (!name || !oid) {
      alert('Preencha o nome do time e o ID do adversário.');
      return;
    }
    if (betCurrency === 'BRO') {
      if (betBroCents < 1) {
        alert('Informe um valor de prêmio em BRO válido.');
        return;
      }
      if (finance.broCents < totalBroCents) {
        alert('Saldo BRO insuficiente para prêmio + taxa de 5% (feeChallenger).');
        return;
      }
      dispatch({
        type: 'START_FRIENDLY_CHALLENGE',
        opponentName: name,
        opponentId: oid,
        mode: friendlyMode,
        currency: 'BRO',
        prizeAmount: betBroCents / 100,
      });
    } else {
      const exp = Math.max(1, Math.round(parseFloat(betInput.replace(',', '.')) || 0));
      if (Number.isNaN(exp) || exp < 1) {
        alert('Informe um valor inteiro de EXP para o prêmio.');
        return;
      }
      if (finance.ole < exp) {
        alert('Saldo EXP insuficiente.');
        return;
      }
      dispatch({
        type: 'START_FRIENDLY_CHALLENGE',
        opponentName: name,
        opponentId: oid,
        mode: friendlyMode,
        currency: 'EXP',
        prizeAmount: exp,
      });
    }
    setAmistosoOpen(false);
    navigate(friendlyMode === 'auto' ? '/match/auto' : '/match/quick');
  };

  const fullSorted = useMemo(
    () => getFullRankingEntries(club.name, finance.ole),
    [club.name, finance.ole],
  );

  const ranking = useMemo(
    () => buildHomeRankingPreview(fullSorted, searchTeam, favorites),
    [fullSorted, searchTeam, favorites],
  );

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header Mobile */}
      <div className="md:hidden flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-neon-yellow flex items-center justify-center font-display font-bold text-xl text-black -skew-x-6">
            <span className="skew-x-6">O</span>
          </div>
          <h1 className="text-2xl font-display font-black tracking-widest italic">OLEFOOT</h1>
        </div>
        <Link to="/wallet" className="bg-[#111] border border-white/10 px-3 py-1.5 flex items-center gap-2">
          <span className="text-sm font-display font-bold text-neon-yellow tracking-wider">{formatExp(finance.ole)} EXP</span>
        </Link>
      </div>

      {/* Next Game Banner — duelo destaques + matchday */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative isolate overflow-hidden bg-[#111] border border-white/10"
      >
        <div
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(180deg, rgba(9,9,9,0.5) 0%, rgba(9,9,9,0.68) 50%, rgba(9,9,9,0.78) 100%), url(/banners/presets/fundo-div-home.jpg)',
          }}
        />
        <div
          className="absolute inset-0 z-[1] opacity-[0.18] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(#fff 1.5px, transparent 1.5px)', backgroundSize: '14px 14px' }}
        />
        <div className="absolute left-1/2 top-[42%] z-[1] -translate-x-1/2 -translate-y-1/2 w-[min(100%,28rem)] h-64 bg-neon-yellow/25 blur-[80px] rounded-full pointer-events-none" />

        <div className="relative z-10 px-5 py-5 sm:px-8 sm:py-6 md:px-10 md:py-8 flex flex-col gap-5 lg:gap-6">
          {/* Cabeçalho: matchday + horário + duelo (nomes completos + brasões) */}
          <div className="text-center space-y-2.5">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              <span className="bg-neon-yellow text-black font-display font-bold px-2.5 py-1 text-xs sm:text-sm tracking-widest -skew-x-6 uppercase">
                Matchday
              </span>
              <span className="text-gray-400 font-display tracking-widest text-xs sm:text-sm uppercase">
                {fixture.kickoffLabel}
              </span>
            </div>
            <MatchdayVersusTitle
              homeName={club.name}
              awayName={fixture.opponent.name}
              awaySeed={fixture.opponent.id}
              className="text-[clamp(0.75rem,2.85vw+0.35rem,1.125rem)] sm:text-[clamp(1.05rem,2.4vw+0.5rem,1.65rem)] md:text-[2rem] lg:text-[2.35rem]"
              vsClassName="text-[0.9em] sm:text-[0.95em] md:text-[1em]"
            />
            <p className="text-gray-400 text-sm font-medium tracking-wide">
              {fixture.venue} · {fixture.competition}
            </p>
          </div>

          {/* Duelo: destaque casa × destaque visitante — fotos centralizadas (largura explícita: evita colapso com flex + items-center) */}
          <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-6 sm:gap-8 md:gap-10 w-full">
            {/* Casa */}
            <div className="flex flex-col items-center shrink-0 w-[min(100%,200px)] sm:w-[200px]">
              <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden border border-white/15 shadow-lg bg-dark-gray">
                <img
                  src={`https://picsum.photos/seed/${encodeURIComponent(`${homeHighlight.id || homeHighlight.name}-home`)}/400/520`}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover object-top"
                  referrerPolicy="no-referrer"
                />
                <div
                  className="absolute left-2.5 top-2.5 z-20 flex h-9 w-[2.1rem] items-center justify-center bg-neon-yellow text-black font-display font-black text-sm shadow-[0_0_16px_rgba(234,255,0,0.4)]"
                  style={{
                    clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                  }}
                >
                  {homeHighlight.ovr}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-transparent pointer-events-none z-[1]" />
                <div className="absolute bottom-0 left-0 right-0 z-10 px-3 pb-3 pt-12 flex flex-col items-center text-center gap-0.5">
                  <span className="text-neon-yellow font-display font-bold text-[9px] sm:text-[10px] tracking-[0.2em] uppercase">
                    Destaque
                  </span>
                  <p className="text-white font-display font-black text-xs sm:text-sm uppercase tracking-wide truncate max-w-full w-full leading-tight">
                    {homeHighlight.name}
                  </p>
                  <div className="flex gap-0.5 justify-center mt-0.5">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          'w-3 h-3 sm:w-3.5 sm:h-3.5',
                          i < starsForOvr(homeHighlight.ovr) ? 'text-amber-400 fill-amber-400' : 'text-white/15',
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Visitante */}
            <div className="flex flex-col items-center shrink-0 w-[min(100%,200px)] sm:w-[200px]">
              <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden border border-white/15 shadow-lg bg-dark-gray">
                <img
                  src={`https://picsum.photos/seed/${encodeURIComponent(awayHighlight.imgSeed)}/400/520`}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover object-top"
                  referrerPolicy="no-referrer"
                />
                <div
                  className="absolute left-2.5 top-2.5 z-20 flex h-9 w-[2.1rem] items-center justify-center bg-neon-yellow text-black font-display font-black text-sm shadow-[0_0_16px_rgba(234,255,0,0.4)]"
                  style={{
                    clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                  }}
                >
                  {awayHighlight.ovr}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-transparent pointer-events-none z-[1]" />
                <div className="absolute bottom-0 left-0 right-0 z-10 px-3 pb-3 pt-12 flex flex-col items-center text-center gap-0.5">
                  <span className="text-neon-yellow font-display font-bold text-[9px] sm:text-[10px] tracking-[0.2em] uppercase">
                    Destaque
                  </span>
                  <p className="text-white font-display font-black text-xs sm:text-sm uppercase tracking-wide truncate max-w-full w-full leading-tight">
                    {awayHighlight.name}
                  </p>
                  <div className="flex gap-0.5 justify-center mt-0.5">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          'w-3 h-3 sm:w-3.5 sm:h-3.5',
                          i < starsForOvr(awayHighlight.ovr) ? 'text-amber-400 fill-amber-400' : 'text-white/15',
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Ações */}
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 pt-2 border-t border-white/10">
            <div className="flex flex-col gap-3 w-full lg:max-w-md">
              <Link to="/match" className="w-full">
                <button type="button" className="btn-primary w-full text-lg sm:text-xl py-3.5 sm:py-4">
                  <span className="btn-primary-inner">
                    <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-black shrink-0" />
                    IR PARA O JOGO
                  </span>
                </button>
              </Link>
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 sm:gap-3 text-[10px] font-display font-bold uppercase tracking-widest text-gray-500">
                <Link to="/match" className="text-neon-yellow hover:text-white transition-colors">
                  Ao vivo
                </Link>
                <span className="text-white/20">/</span>
                <Link to="/match/quick" className="hover:text-neon-yellow transition-colors">
                  Rápido
                </Link>
                <span className="text-white/20">/</span>
                <Link to="/match/auto" className="hover:text-neon-yellow transition-colors">
                  Automático
                </Link>
              </div>
            </div>
            <Link to="/team/tatica" className="w-full lg:w-auto lg:min-w-[200px]">
              <button type="button" className="btn-secondary w-full py-3">
                <span className="btn-secondary-inner">TÁTICAS</span>
              </button>
            </Link>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Torcidômetro - Industrial Style */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="sports-panel panel-accent p-6"
        >
          <div className="flex justify-between items-end mb-4">
            <div>
              <h3 className="font-display font-bold text-xl text-gray-400 uppercase tracking-wider">Apoio da Torcida</h3>
              <div className="text-4xl font-display font-black text-white mt-1">{supportLabel}<span className="text-2xl text-neon-yellow">%</span></div>
            </div>
            <Activity className="w-8 h-8 text-neon-yellow opacity-50 mb-1" />
          </div>
          <div className="h-2 bg-dark-gray overflow-hidden relative skew-x-[-10deg]">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${roundedSupport}%` }}
              transition={{ duration: 1, delay: 0.5 }}
              className="absolute top-0 left-0 h-full bg-neon-yellow"
            />
          </div>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-4">Status: {crowd.moodLabel}</p>
        </motion.div>

        {/* Últimos resultados — alinhado ao bloco industrial da grelha (Torcidômetro / Amistoso) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="sports-panel panel-accent p-0 overflow-hidden flex flex-col min-h-[300px]"
        >
          <div className="flex justify-between items-end gap-3 px-6 pt-6 pb-4 border-b border-white/10">
            <div className="min-w-0">
              <h3 className="font-display font-bold text-xl text-gray-400 uppercase tracking-wider">Últimos resultados</h3>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-1">
                {results.length > 0
                  ? `${Math.min(5, results.length)} últimos · o teu percurso`
                  : 'Histórico vazio'}
              </p>
            </div>
            <Trophy className="w-8 h-8 text-neon-yellow opacity-50 shrink-0 mb-0.5" />
          </div>

          <div className="px-6 py-4 flex-1 flex flex-col gap-2">
            {results.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-10 px-4 text-center border border-dashed border-white/10 bg-dark-gray/40">
                <p className="text-sm font-display font-bold text-gray-300 uppercase tracking-wider">Sem jogos ainda</p>
                <p className="text-[11px] text-gray-600 mt-2 max-w-[220px] leading-relaxed">
                  Entra em campo — os placares aparecem aqui com estilo de painel desportivo.
                </p>
              </div>
            ) : (
              results.slice(0, 5).map((match, i) => {
                const meta = resultOutcomeMeta(match.result);
                const isUsHome = match.home === club.name;
                const isUsAway = match.away === club.name;
                return (
                  <motion.div
                    key={`${match.home}-${match.away}-${match.scoreHome}-${match.scoreAway}-${i}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.06 + i * 0.05, type: 'spring', stiffness: 380, damping: 28 }}
                    className={cn(
                      'group relative flex overflow-hidden border border-white/10 bg-dark-gray',
                      'hover:border-neon-yellow/30 transition-colors duration-200',
                    )}
                  >
                    <div className={cn('w-1 shrink-0', meta.bar)} aria-hidden />
                    <div className="flex-1 flex items-stretch min-w-0">
                      <div className="flex-1 min-w-0 py-2.5 pl-3 pr-1 flex flex-col justify-center items-end text-right">
                        <span
                          className={cn(
                            'font-display font-bold text-[11px] sm:text-xs uppercase tracking-wide truncate w-full',
                            isUsHome ? 'text-neon-yellow' : 'text-gray-400 group-hover:text-gray-300',
                          )}
                        >
                          {match.home}
                        </span>
                        {isUsHome ? (
                          <span className="text-[9px] font-black text-neon-yellow/70 uppercase tracking-widest mt-0.5">
                            Casa
                          </span>
                        ) : null}
                      </div>
                      <div className="shrink-0 flex flex-col items-center justify-center px-2 sm:px-3 border-x border-white/10 bg-black/40">
                        <div className="flex items-center gap-1.5 font-display font-black tabular-nums leading-none">
                          <span className="text-lg sm:text-xl text-white">{match.scoreHome}</span>
                          <span className="text-neon-yellow text-sm sm:text-base pb-0.5">:</span>
                          <span className="text-lg sm:text-xl text-white">{match.scoreAway}</span>
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-600 mt-1">
                          {match.status}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0 py-2.5 pr-3 pl-1 flex flex-col justify-center items-start text-left">
                        <span
                          className={cn(
                            'font-display font-bold text-[11px] sm:text-xs uppercase tracking-wide truncate w-full',
                            isUsAway ? 'text-neon-yellow' : 'text-gray-400 group-hover:text-gray-300',
                          )}
                        >
                          {match.away}
                        </span>
                        {isUsAway ? (
                          <span className="text-[9px] font-black text-neon-yellow/70 uppercase tracking-widest mt-0.5">
                            Fora
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div
                      className={cn(
                        'shrink-0 w-[3.25rem] sm:w-14 flex flex-col items-center justify-center border-l border-white/10',
                        meta.side,
                      )}
                    >
                      <span className={cn('font-display font-black text-xl sm:text-2xl leading-none', meta.pill)}>
                        {meta.label}
                      </span>
                      <span className={cn('hidden sm:block text-[8px] font-bold uppercase tracking-wider mt-1 opacity-90', meta.pill)}>
                        {meta.sub}
                      </span>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

          <div className="px-6 pb-6 pt-2">
            <button
              type="button"
              onClick={scrollToNotificacoes}
              className="w-full py-2.5 border border-white/10 bg-dark-gray text-[10px] font-display font-bold uppercase tracking-widest text-gray-400 hover:text-neon-yellow hover:border-neon-yellow/25 transition-colors"
            >
              Ver notificações ↓
            </button>
          </div>
        </motion.div>

        {/* Create Game */}
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          onClick={() => setAmistosoOpen(true)}
          className="sports-panel p-6 flex flex-col justify-center items-center text-center cursor-pointer hover:border-neon-yellow transition-colors group w-full"
        >
          <div className="w-16 h-16 bg-dark-gray border border-white/10 flex items-center justify-center mb-4 -skew-x-6 group-hover:bg-neon-yellow transition-colors">
            <Zap className="w-8 h-8 text-white group-hover:text-black skew-x-6 transition-colors" />
          </div>
          <h3 className="font-display font-bold text-2xl uppercase tracking-wider">Amistoso</h3>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-1">Desafie Rivais</p>
        </motion.button>
      </div>

      <AnimatePresence>
        {amistosoOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/88 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="sports-panel w-full max-w-lg p-0 overflow-hidden border-neon-yellow/40 relative"
            >
              <button
                type="button"
                onClick={() => setAmistosoOpen(false)}
                className="absolute right-4 top-4 p-2 rounded-full bg-black/60 text-gray-400 hover:text-white z-10"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="p-6 border-b border-white/10 bg-neon-yellow/5">
                <h3 className="text-xl font-display font-black uppercase tracking-wider text-white">Amistoso</h3>
                <p className="text-sm text-gray-300 mt-2 leading-snug">Mostre que você é o melhor no jogo</p>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block mb-1.5">Buscar (Time, ID)</label>
                  <div className="grid grid-cols-1 gap-2">
                    <input
                      value={opponentName}
                      onChange={(e) => setOpponentName(e.target.value)}
                      placeholder="Nome do time"
                      className="w-full bg-black/40 border border-white/15 rounded px-3 py-2 text-sm"
                    />
                    <input
                      value={opponentId}
                      onChange={(e) => setOpponentId(e.target.value)}
                      placeholder="ID do adversário"
                      className="w-full bg-black/40 border border-white/15 rounded px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block mb-2">Modo de partida</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFriendlyMode('auto')}
                      className={cn(
                        'py-2.5 rounded text-xs font-display font-bold uppercase border',
                        friendlyMode === 'auto' ? 'bg-neon-yellow text-black border-neon-yellow' : 'border-white/15 text-gray-400',
                      )}
                    >
                      Partida Automática
                    </button>
                    <button
                      type="button"
                      onClick={() => setFriendlyMode('quick')}
                      className={cn(
                        'py-2.5 rounded text-xs font-display font-bold uppercase border',
                        friendlyMode === 'quick' ? 'bg-neon-yellow text-black border-neon-yellow' : 'border-white/15 text-gray-400',
                      )}
                    >
                      Partida Rápida
                    </button>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Bet (prêmio do vencedor)</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setBetCurrency('BRO')}
                        className={cn(
                          'px-2 py-1 rounded text-[10px] font-bold uppercase',
                          betCurrency === 'BRO' ? 'bg-white text-black' : 'bg-white/5 text-gray-500',
                        )}
                      >
                        BRO
                      </button>
                      <button
                        type="button"
                        onClick={() => setBetCurrency('EXP')}
                        className={cn(
                          'px-2 py-1 rounded text-[10px] font-bold uppercase',
                          betCurrency === 'EXP' ? 'bg-neon-yellow text-black' : 'bg-white/5 text-gray-500',
                        )}
                      >
                        EXP
                      </button>
                    </div>
                  </div>
                  <input
                    value={betInput}
                    onChange={(e) => setBetInput(e.target.value)}
                    placeholder={betCurrency === 'BRO' ? 'Ex.: 10,50' : 'Ex.: 500'}
                    className="w-full bg-black/40 border border-white/15 rounded px-3 py-2 text-sm"
                  />
                  {betCurrency === 'BRO' && betBroCents > 0 && (
                    <div className="mt-2 text-[11px] text-gray-500 space-y-1 border border-white/10 rounded p-2 bg-black/30">
                      <div className="flex justify-between">
                        <span>Prêmio ao vencedor</span>
                        <span className="text-white font-bold">{(betBroCents / 100).toFixed(2)} BRO</span>
                      </div>
                      <div className="flex justify-between text-neon-yellow/90">
                        <span>Taxa plataforma ({Math.round(FRIENDLY_CHALLENGE_BRO_FEE_RATE * 100)}% · feeChallenger)</span>
                        <span className="font-bold">{(feeBroCents / 100).toFixed(2)} BRO</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-white/10 font-bold text-white">
                        <span>Total debitado</span>
                        <span>{(totalBroCents / 100).toFixed(2)} BRO</span>
                      </div>
                      <p className="text-[10px] text-gray-600 pt-1">
                        A taxa credita a tesouraria da empresa (destino final configurável no Admin).
                      </p>
                    </div>
                  )}
                  {betCurrency === 'EXP' && (
                    <p className="text-[10px] text-gray-600 mt-2">Desafios em EXP não cobram taxa de plataforma neste fluxo.</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={startFriendly}
                  className="w-full btn-primary py-3"
                >
                  <span className="btn-primary-inner">Criar desafio e jogar</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Ranking + Notificações */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ranking OLE */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="sports-panel p-0"
        >
          <div className="bg-dark-gray p-4 border-b border-white/10 flex justify-between items-center">
            <h3 className="font-display font-bold text-xl uppercase tracking-wider">Ranking OLE</h3>
            <span className="text-neon-yellow text-xs font-bold uppercase tracking-wider">Top 10 por EXP</span>
          </div>
          <div className="p-3 border-b border-white/10">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={searchTeam}
                onChange={(e) => setSearchTeam(e.target.value)}
                placeholder="Buscar por nome do time"
                className="w-full bg-black/40 border border-white/10 rounded px-9 py-2 text-sm"
              />
            </div>
            <p className="text-[10px] text-gray-500 mt-2">Os 5 primeiros são sempre os líderes do ranking mundial.</p>
          </div>
          <div className="divide-y divide-white/5">
            {ranking.map((row) => (
              <div key={`${row.team}-${row.rank}`} className="flex items-center gap-3 p-3 hover:bg-white/5 transition-colors">
                <div className={cn(
                  'w-8 h-8 flex items-center justify-center text-xs font-display font-black rounded',
                  row.rank <= 3 ? 'bg-neon-yellow text-black' : 'bg-white/10 text-white',
                )}>
                  {row.rank <= 3 ? <Trophy className="w-4 h-4" /> : `#${row.rank}`}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={cn('text-sm font-display font-bold truncate', row.isMe ? 'text-neon-yellow' : 'text-white')}>
                    {row.team} {row.isMe ? '(Você)' : ''}
                  </div>
                  <div className="text-[10px] text-gray-500">{formatExp(row.exp)} EXP</div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleFavorite(row.team)}
                  className={cn(
                    'p-1.5 rounded border',
                    favorites.has(row.team) ? 'border-neon-yellow text-neon-yellow' : 'border-white/10 text-gray-500',
                  )}
                >
                  <Star className={cn('w-4 h-4', favorites.has(row.team) && 'fill-neon-yellow')} />
                </button>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-white/10 bg-black/20">
            <Link
              to="/ranking"
              className="flex w-full items-center justify-center gap-2 py-3 rounded-lg border border-neon-yellow/40 bg-neon-yellow/10 text-neon-yellow font-display font-black uppercase text-sm tracking-wider hover:bg-neon-yellow/20 transition-colors"
            >
              Ver ranking completo
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>

        {/* Notificações — inbox operacional (não placares) */}
        <motion.div
          ref={notificacoesRef}
          id="notificacoes"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="sports-panel p-0 scroll-mt-24"
        >
          <div className="bg-dark-gray p-4 border-b border-white/10 space-y-3">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
              <div>
                <h3 className="font-display font-bold text-xl uppercase tracking-wider">Notificações</h3>
                <p className="text-[10px] text-gray-500 mt-1 max-w-md">
                  Staff, torcida, jogadores e competição. Placares e histórico de jogos ficam na liga e no histórico de partidas.
                </p>
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {HOME_NOTIF_TABS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setNotifTab(key)}
                  className={cn(
                    'px-2.5 py-1 text-[10px] font-display font-bold uppercase tracking-wider border transition-colors',
                    notifTab === key
                      ? 'border-neon-yellow text-neon-yellow bg-neon-yellow/10'
                      : 'border-white/10 text-gray-400 hover:border-white/20',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-white/5">
            {filteredInbox.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500 space-y-2">
                <p>Nada nesta categoria na HOME.</p>
                <p className="text-[11px] text-gray-600 max-w-sm mx-auto leading-relaxed">
                  Recompensas de EXP e relatórios de staff após cada partida não aparecem aqui — ficam registados na carteira e no fluxo do plantel; o desfecho desportivo está no histórico de jogos.
                </p>
              </div>
            ) : (
              <>
                {inboxPanelList.map((news) => (
                  <div
                    key={news.id}
                    className={cn(
                      'flex items-start gap-4 p-4 hover:bg-white/5 transition-colors',
                      news.read && 'opacity-70',
                      news.kind === 'friend_invite' && 'border-l-2 border-fuchsia-500/70 bg-fuchsia-500/[0.06]',
                    )}
                  >
                    <div className="text-gray-500 font-display font-bold text-sm w-12 text-right shrink-0 pt-0.5">
                      {news.timeLabel}
                    </div>
                    <div className="w-1 min-h-[2.5rem] bg-dark-gray relative shrink-0 rounded-sm">
                      <div className={cn('absolute inset-0', news.colorClass.replace('text-', 'bg-'))} style={{ opacity: 0.5 }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className={cn('text-[10px] font-bold uppercase tracking-widest', news.colorClass)}>{news.tag}</span>
                        {news.advisorLabel ? (
                          <span className="text-[10px] text-gray-500 uppercase tracking-wider">{news.advisorLabel}</span>
                        ) : null}
                      </div>
                      <h4 className="font-bold text-md mt-0.5">{news.title}</h4>
                      {news.body ? <InboxBodyText text={news.body} /> : null}
                      {news.deepLink && news.kind !== 'friend_invite' ? (
                        <Link
                          to={news.deepLink}
                          className="inline-flex items-center gap-1 mt-2 text-[10px] font-display font-bold uppercase tracking-wider text-neon-yellow/90 hover:text-neon-yellow"
                        >
                          Abrir
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      ) : null}
                      {news.kind === 'friend_invite' && (
                        <Link
                          to="/profile#rede-manager"
                          className="inline-flex items-center gap-1 mt-2 text-[10px] font-display font-bold uppercase tracking-wider text-fuchsia-400 hover:text-fuchsia-300"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          Ver solicitações no perfil
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
                {filteredInbox.length > HOME_NOTIF_VISIBLE_COUNT && (
                  <div className="p-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-black/20">
                    <p className="text-[11px] text-gray-500">
                      A mostrar {notifShowAll ? filteredInbox.length : HOME_NOTIF_VISIBLE_COUNT} de {filteredInbox.length}{' '}
                      nesta categoria.
                    </p>
                    <button
                      type="button"
                      onClick={() => setNotifShowAll((v) => !v)}
                      className="text-[10px] font-display font-bold uppercase tracking-widest text-neon-yellow hover:text-white transition-colors inline-flex items-center gap-1"
                    >
                      {notifShowAll ? (
                        <>
                          Mostrar menos
                          <ChevronRight className="w-3.5 h-3.5 rotate-[-90deg]" />
                        </>
                      ) : (
                        <>
                          Ler tudo
                          <ChevronRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
