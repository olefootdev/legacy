import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User,
  Trophy,
  Activity,
  Star,
  TrendingUp,
  Calendar,
  Lock,
  Award,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useGameDispatch, useGameStore } from '@/game/store';
import { DISCOVERABLE_MANAGERS } from '@/social/catalog';
import { formatExp, formatBroDisplay } from '@/systems/economy';
import { useProgressionStore } from '@/progression/progressionStore';
import { MISSION_CATALOG } from '@/progression/missions/catalog';
import { COMPETITION_TROPHY_CATALOG } from '@/trophies/competitionCatalog';
import { MEMORABLE_TROPHY_SLOTS } from '@/trophies/memorableCatalog';

const MISSION_TROPHY_KINDS = new Set(['onboarding', 'achievement', 'special']);

export function Profile() {
  const club = useGameStore((s) => s.club);
  const finance = useGameStore((s) => s.finance);
  const form = useGameStore((s) => s.form);
  const results = useGameStore((s) => s.results);
  const players = useGameStore((s) => s.players);
  const leagueSeason = useGameStore((s) => s.leagueSeason);
  const memorableTrophyUnlockedIds = useGameStore((s) => s.memorableTrophyUnlockedIds);

  const ensureResets = useProgressionStore((s) => s.ensureResets);
  const missionRuntime = useProgressionStore((s) => s.missions);

  useEffect(() => {
    ensureResets();
  }, [ensureResets]);

  const competitionTrophies = useMemo(() => {
    const ctx = { leagueSeason, results, form };
    return COMPETITION_TROPHY_CATALOG.map((t) => ({
      ...t,
      earned: t.unlocked(ctx),
    }));
  }, [leagueSeason, results, form]);

  const missionTrophies = useMemo(() => {
    return MISSION_CATALOG.filter(
      (m) => m.trophy && MISSION_TROPHY_KINDS.has(m.kind),
    ).map((def) => ({
      def,
      trophy: def.trophy!,
      earned: Boolean(missionRuntime[def.id]?.claimed),
    }));
  }, [missionRuntime]);

  const wins = form.filter((f) => f === 'W').length;
  const draws = form.filter((f) => f === 'D').length;
  const losses = form.filter((f) => f === 'L').length;
  const squadSize = Object.keys(players).length;
  const broDisplay = formatBroDisplay(finance.broCents);

  return (
    <div className="mx-auto min-w-0 max-w-4xl space-y-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col items-center gap-6 border border-white/10 bg-[#111] p-4 sm:p-8 md:flex-row">
          <div className="w-20 h-20 bg-neon-yellow flex items-center justify-center -skew-x-6">
            <span className="skew-x-6 font-display font-black text-4xl text-black">O</span>
          </div>
          <div className="min-w-0 text-center md:text-left">
            <h2 className="text-3xl font-display font-black uppercase tracking-wider">{club.name}</h2>
            <p className="text-sm text-gray-500 font-medium mt-1">{club.city} — {club.stadium}</p>
            <div className="flex items-center gap-4 mt-3 justify-center md:justify-start">
              <div className="flex items-center gap-1.5">
                <Star className="w-4 h-4 text-neon-yellow" />
                <span className="text-sm font-display font-bold text-neon-yellow">{formatExp(finance.ole)} EXP</span>
              </div>
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-sm font-display font-bold text-green-400">{broDisplay.primary}</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="bg-[#111] border border-white/10 p-5">
          <div className="flex items-center gap-2 mb-3">
            <User className="w-4 h-4 text-neon-yellow" />
            <h3 className="text-xs font-display font-bold uppercase tracking-wider text-gray-400">Treinador</h3>
          </div>
          <p className="font-display font-bold text-xl text-white">Manager</p>
          <p className="text-xs text-gray-500 mt-1">Contrato ativo</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="bg-[#111] border border-white/10 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-neon-yellow" />
            <h3 className="text-xs font-display font-bold uppercase tracking-wider text-gray-400">Elenco</h3>
          </div>
          <p className="font-display font-bold text-xl text-white">{squadSize} jogadores</p>
          <p className="text-xs text-gray-500 mt-1">Plantel registrado</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="bg-[#111] border border-white/10 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-neon-yellow" />
            <h3 className="text-xs font-display font-bold uppercase tracking-wider text-gray-400">EXP Acumulado</h3>
          </div>
          <p className="font-display font-bold text-xl text-neon-yellow">{formatExp(finance.expLifetimeEarned ?? 0)}</p>
          <p className="text-xs text-gray-500 mt-1">Histórico de conquistas</p>
        </motion.div>
      </div>

      <ProfilePrivateSocialSection />

      {/* Sala de Troféus */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22 }}
        className="space-y-8"
        aria-labelledby="trophy-room-heading"
      >
        <div>
          <h2
            id="trophy-room-heading"
            className="text-xl md:text-2xl font-display font-black uppercase tracking-wider flex items-center gap-2 text-white"
          >
            <Trophy className="w-6 h-6 md:w-7 md:h-7 text-neon-yellow shrink-0" />
            Sala de Troféus
          </h2>
          <p className="text-sm text-gray-500 mt-2 max-w-2xl">
            <span className="text-gray-400 font-semibold">Memoráveis</span> são só títulos de liga e copas. Abaixo, marcos
            de temporada e troféus de{' '}
            <span className="text-gray-400 font-semibold">Missões</span>.
          </p>
        </div>

        {/* Memoráveis: 3 troféus de título (liga / copa / supercopa) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className={cn(
            'relative overflow-hidden rounded-xl border-2 border-neon-yellow bg-gradient-to-b from-[#1a1508] via-black/80 to-black/90',
            'p-5 md:p-6',
            'shadow-[0_0_28px_rgba(234,255,0,0.35),0_0_56px_rgba(250,204,21,0.18),inset_0_1px_0_rgba(255,255,255,0.06)]',
          )}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(234,255,0,0.5), transparent 55%)',
            }}
          />
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
              <span className="inline-flex self-start -skew-x-6 bg-neon-yellow text-black px-4 py-1.5 font-display font-black text-xs md:text-sm tracking-[0.25em] uppercase shadow-[0_0_20px_rgba(234,255,0,0.45)]">
                <span className="skew-x-6">MEMORÁVEIS</span>
              </span>
              <p className="text-[11px] md:text-xs text-amber-200/70 font-medium max-w-md leading-relaxed">
                Apenas troféus de <span className="text-amber-100/90">campeonato</span>: liga, copa e supercopa. Não
                inclui missões nem conquistas de temporada.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              {MEMORABLE_TROPHY_SLOTS.map((slot, i) => {
                const earned = memorableTrophyUnlockedIds.includes(slot.id);
                return (
                  <motion.div
                    key={slot.id}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.05 + i * 0.06 }}
                    className={cn(
                      'flex flex-col items-center text-center rounded-lg border p-3 sm:p-4 min-h-[132px] sm:min-h-[148px] justify-between',
                      earned
                        ? 'border-neon-yellow/80 bg-neon-yellow/10 shadow-[0_0_18px_rgba(234,255,0,0.2)]'
                        : 'border-white/15 bg-black/40',
                    )}
                  >
                    <div
                      className={cn(
                        'w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center border-2 -skew-x-6',
                        earned
                          ? 'border-neon-yellow bg-gradient-to-br from-neon-yellow to-amber-500 text-black shadow-[0_0_22px_rgba(250,204,21,0.45)]'
                          : 'border-white/20 bg-white/5 text-gray-600',
                      )}
                    >
                      {earned ? (
                        <Trophy className="w-7 h-7 sm:w-8 sm:h-8 skew-x-6" strokeWidth={2.2} />
                      ) : (
                        <Lock className="w-6 h-6 sm:w-7 sm:h-7 skew-x-6" />
                      )}
                    </div>
                    <div className="mt-2 space-y-0.5 w-full">
                      <p className="font-display font-bold text-[10px] sm:text-xs text-white leading-tight uppercase tracking-wide">
                        {slot.name}
                      </p>
                      <p className="text-[9px] sm:text-[10px] text-gray-500 leading-snug line-clamp-2">{slot.blurb}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.div>

        <div>
          <h3 className="text-xs font-display font-bold uppercase tracking-widest text-neon-yellow/90 mb-4 flex items-center gap-2">
            <Award className="w-4 h-4" />
            Competições
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {competitionTrophies.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * i }}
                className={cn(
                  'relative overflow-hidden rounded-lg border p-4 flex flex-col gap-2 min-h-[120px]',
                  item.earned
                    ? 'border-neon-yellow/40 bg-gradient-to-br from-neon-yellow/10 to-black/40'
                    : 'border-white/10 bg-[#111] opacity-75',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div
                    className={cn(
                      'w-12 h-12 rounded-lg flex items-center justify-center shrink-0 -skew-x-6',
                      item.earned ? 'bg-neon-yellow text-black' : 'bg-white/5 text-gray-600',
                    )}
                  >
                    {item.earned ? (
                      <Trophy className="w-6 h-6 skew-x-6" strokeWidth={2.2} />
                    ) : (
                      <Lock className="w-5 h-5 skew-x-6" />
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-[9px] font-display font-bold uppercase tracking-wider px-2 py-0.5 rounded',
                      item.earned ? 'bg-neon-yellow/20 text-neon-yellow' : 'bg-white/5 text-gray-500',
                    )}
                  >
                    {item.earned ? 'Conquistado' : 'Em aberto'}
                  </span>
                </div>
                <div>
                  <p className="font-display font-bold text-sm text-white tracking-wide">{item.name}</p>
                  <p className="text-xs text-gray-500 mt-1 leading-snug">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-display font-bold uppercase tracking-widest text-neon-yellow/90 mb-4 flex items-center gap-2">
            <Star className="w-4 h-4" />
            Missões especiais e marcos
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {missionTrophies.map(({ def, trophy, earned }, i) => (
              <motion.div
                key={def.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.03 * i }}
                className={cn(
                  'relative overflow-hidden rounded-lg border p-4 flex flex-col gap-2 min-h-[120px]',
                  earned
                    ? 'border-neon-yellow/40 bg-gradient-to-br from-neon-yellow/10 to-black/40'
                    : 'border-white/10 bg-[#111] opacity-75',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div
                    className={cn(
                      'w-12 h-12 rounded-lg flex items-center justify-center shrink-0 -skew-x-6',
                      earned ? 'bg-neon-yellow text-black' : 'bg-white/5 text-gray-600',
                    )}
                  >
                    {earned ? (
                      <Trophy className="w-6 h-6 skew-x-6" strokeWidth={2.2} />
                    ) : (
                      <Lock className="w-5 h-5 skew-x-6" />
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-[9px] font-display font-bold uppercase tracking-wider px-2 py-0.5 rounded',
                      earned ? 'bg-neon-yellow/20 text-neon-yellow' : 'bg-white/5 text-gray-500',
                    )}
                  >
                    {earned ? 'Resgatado' : 'Pendente'}
                  </span>
                </div>
                <div>
                  <p className="font-display font-bold text-sm text-white tracking-wide">{trophy.name}</p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">{def.title}</p>
                  {trophy.description ? (
                    <p className="text-xs text-gray-500 mt-1 leading-snug">{trophy.description}</p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1 leading-snug">{def.description}</p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}>
        <h3 className="text-lg font-display font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-neon-yellow" />
          Últimos resultados
        </h3>
        <div className="flex items-center gap-2 mb-6">
          {form.map((f, i) => (
            <span
              key={i}
              className={cn(
                'w-8 h-8 flex items-center justify-center font-display font-black text-sm',
                f === 'W' ? 'bg-neon-green text-black' : f === 'D' ? 'bg-gray-600 text-white' : 'bg-red-600 text-white',
              )}
            >
              {f}
            </span>
          ))}
          <span className="text-xs text-gray-500 font-bold ml-2">{wins}V {draws}E {losses}D</span>
        </div>

        <h3 className="text-lg font-display font-bold uppercase tracking-wider mb-4">Resultados</h3>
        <div className="space-y-2">
          {results.map((r, i) => (
            <div key={i} className="bg-[#111] border border-white/5 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={cn(
                  'text-[9px] font-display font-black uppercase px-1.5 py-0.5',
                  r.result === 'win' ? 'bg-neon-green text-black' : r.result === 'draw' ? 'bg-gray-600 text-white' : 'bg-red-600 text-white',
                )}>
                  {r.status}
                </span>
                <span className="text-sm font-display font-bold text-white tracking-wider">
                  {r.home} {r.scoreHome} – {r.scoreAway} {r.away}
                </span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

function ProfilePrivateSocialSection() {
  const dispatch = useGameDispatch();
  const club = useGameStore((s) => s.club);
  const social = useGameStore((s) => s.social);
  const location = useLocation();
  const [addOpen, setAddOpen] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (location.hash === '#rede-manager') {
      requestAnimationFrame(() => {
        document.getElementById('rede-manager')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [location.hash]);

  const blockedManagerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const f of social.friends) ids.add(f.managerId);
    for (const o of social.outgoing) ids.add(o.toManagerId);
    for (const i of social.incoming) ids.add(i.fromManagerId);
    return ids;
  }, [social]);

  const suggestions = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return DISCOVERABLE_MANAGERS.filter((m) => {
      if (blockedManagerIds.has(m.id)) return false;
      if (!qq) return true;
      return (
        m.clubName.toLowerCase().includes(qq) ||
        m.city.toLowerCase().includes(qq) ||
        m.id.toLowerCase().includes(qq)
      );
    });
  }, [q, blockedManagerIds]);

  const sendInvite = (managerId: string, clubName: string) => {
    dispatch({ type: 'SEND_FRIEND_REQUEST', managerId, clubName });
    setAddOpen(false);
    setQ('');
  };

  return (
    <>
      <motion.section
        id="rede-manager"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-xl border border-fuchsia-500/25 bg-gradient-to-b from-fuchsia-950/20 to-black/40 p-5 md:p-6 space-y-6"
        aria-labelledby="private-social-heading"
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h2
              id="private-social-heading"
              className="text-lg md:text-xl font-display font-black uppercase tracking-wider text-white flex items-center gap-2 flex-wrap"
            >
              <Lock className="w-5 h-5 text-fuchsia-400 shrink-0" />
              Minha rede
            </h2>
            <p className="text-xs text-fuchsia-200/60 mt-1.5 max-w-xl leading-relaxed">
              Área <span className="text-fuchsia-100/90 font-semibold">privada</span>: só você vê amigos, convites e
              solicitações. Construa sua rede de managers no jogo.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center justify-center gap-2 -skew-x-6 bg-fuchsia-500 text-white px-4 py-2.5 font-display font-bold text-xs uppercase tracking-wider hover:bg-fuchsia-400 transition-colors shrink-0"
          >
            <UserPlus className="w-4 h-4 skew-x-6" />
            <span className="skew-x-6">Adicionar</span>
          </button>
        </div>

        {social.incoming.length > 0 && (
          <div>
            <h3 className="text-[10px] font-display font-bold uppercase tracking-widest text-fuchsia-300/90 mb-3">
              Solicitações
            </h3>
            <ul className="space-y-2">
              {social.incoming.map((req) => (
                <li
                  key={req.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-black/50 border border-fuchsia-500/30 rounded-lg px-4 py-3"
                >
                  <div>
                    <p className="font-display font-bold text-white tracking-wide">{req.fromClubName}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Quer entrar na sua rede</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'ACCEPT_FRIEND_REQUEST', requestId: req.id })}
                      className="px-3 py-1.5 text-xs font-display font-bold uppercase bg-neon-green text-black hover:bg-white transition-colors"
                    >
                      Aceitar
                    </button>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'DECLINE_FRIEND_REQUEST', requestId: req.id })}
                      className="px-3 py-1.5 text-xs font-display font-bold uppercase border border-white/20 text-gray-300 hover:bg-white/10 transition-colors"
                    >
                      Recusar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <h3 className="text-[10px] font-display font-bold uppercase tracking-widest text-fuchsia-300/90 mb-3 flex items-center gap-2">
            <Users className="w-3.5 h-3.5" />
            Amigos ({social.friends.length})
          </h3>
          {social.friends.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum amigo ainda — use Adicionar para enviar convites.</p>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {social.friends.map((f) => (
                <li
                  key={f.managerId}
                  className="flex items-center justify-between gap-2 bg-black/40 border border-white/10 rounded-lg px-3 py-2.5"
                >
                  <span className="font-display font-bold text-white text-sm truncate">{f.clubName}</span>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'REMOVE_SOCIAL_FRIEND', managerId: f.managerId })}
                    className="text-[10px] font-bold uppercase text-gray-500 hover:text-red-400 shrink-0"
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {social.outgoing.length > 0 && (
          <div>
            <h3 className="text-[10px] font-display font-bold uppercase tracking-widest text-gray-500 mb-3">
              Convites enviados
            </h3>
            <ul className="space-y-2">
              {social.outgoing.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between gap-2 bg-black/30 border border-white/10 rounded-lg px-3 py-2"
                >
                  <span className="text-sm text-gray-300 font-display font-bold truncate">{o.toClubName}</span>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'CANCEL_OUTGOING_FRIEND_REQUEST', requestId: o.id })}
                    className="text-[10px] font-bold uppercase text-gray-500 hover:text-white shrink-0"
                  >
                    Cancelar
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-[10px] text-gray-600">
          Seu clube: <span className="text-gray-400 font-semibold">{club.name}</span> — convites de amizade também
          aparecem na caixa de entrada da home.
        </p>
      </motion.section>

      <AnimatePresence>
        {addOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end justify-center overflow-y-auto overscroll-y-contain bg-black/85 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] backdrop-blur-sm sm:items-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-friend-title"
            onClick={() => setAddOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 10 }}
              className="my-auto flex max-h-[min(88dvh,calc(100dvh-5rem))] w-full max-w-md flex-col overflow-hidden rounded-xl border border-fuchsia-500/40 bg-[#111] p-5 shadow-[0_0_40px_rgba(192,38,211,0.15)] sm:max-h-[min(90dvh,640px)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
                <div>
                  <h3 id="add-friend-title" className="font-display font-black text-lg uppercase tracking-wide text-white">
                    Adicionar amigo
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-1">Busque um clube e envie um convite.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/10"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nome do clube ou cidade..."
                className="mb-3 w-full shrink-0 rounded-lg border border-white/15 bg-black/50 px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-fuchsia-500/60 focus:outline-none"
              />
              <ul className="max-h-[min(40dvh,14rem)] min-h-0 flex-1 divide-y divide-white/10 overflow-y-auto overscroll-y-contain rounded-lg border border-white/10 sm:max-h-56">
                {suggestions.length === 0 ? (
                  <li className="px-3 py-6 text-center text-sm text-gray-500">Nenhum resultado ou todos já na rede.</li>
                ) : (
                  suggestions.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-white/5">
                      <div className="min-w-0">
                        <p className="font-display font-bold text-white text-sm truncate">{m.clubName}</p>
                        <p className="text-[10px] text-gray-500">{m.city}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => sendInvite(m.id, m.clubName)}
                        className="shrink-0 text-[10px] font-display font-bold uppercase px-2.5 py-1 bg-fuchsia-600 text-white hover:bg-fuchsia-500"
                      >
                        Convidar
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
