import { useMemo, useState } from 'react';
import { Check, ChevronDown, Crosshair, Lightbulb, MessageCircle, Shield, Sparkles, TrendingUp, UserCog, Users, Zap, Bot } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { EditorialHero } from '@/components/EditorialHero';
import { useGameDispatch, useGameStore } from '@/game/store';
import { getStaffUpgradeCost, maxStaffSlotsByLevel, STAFF_LABELS, STAFF_ROLE_IDS } from '@/systems/staff';
import type { StaffRoleId } from '@/game/types';
import { cn } from '@/lib/utils';
import { overallFromAttributes } from '@/entities/player';
import { BackButton } from '@/components/BackButton';
import { useTrackScreen } from '@/progression/trackEvent';
import { StatTile } from '@/components/ui/StatTile';
import { RailStat } from '@/components/ui/RailStat';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { rotuloPosicao } from '@/transfer/marketFilters';
import { L, LOCALE } from '@/i18n/L';

/** Fonte de número do layer final: Anton. (Era serifa itálica.) */
const NUM = 'var(--font-impact)';
const COLLECTIVE_GROUPS = ['defensivo', 'criativo', 'ataque'] as const;
/** Rótulo de TELA do grupo — o valor continua o mesmo. */
const ROTULO_GRUPO: Record<(typeof COLLECTIVE_GROUPS)[number], string> = {
  defensivo: L('defensivo', 'defensive'),
  criativo: L('criativo', 'creative'),
  ataque: L('ataque', 'attack'),
};

function collectiveGroupIcon(g: (typeof COLLECTIVE_GROUPS)[number]) {
  if (g === 'defensivo') return Shield;
  if (g === 'criativo') return Lightbulb;
  return Crosshair;
}

/** Descrição HONESTA do que cada role faz HOJE (treino / scouting / fadiga). Efeito em partida ao vivo é wiring futuro. */
const ROLE_ONELINER: Record<StaffRoleId, string> = {
  preparador_fisico: L('Energia em jogo e fadiga', 'Match energy and fatigue'),
  mental: L('Reforça treino mental', 'Boosts mental training'),
  nutricao: L('Fadiga e risco de lesão', 'Fatigue and injury risk'),
  tatico: L('Reforça treino tático', 'Boosts tactical training'),
  treinador: L('Mais slots, todo treino', 'More slots, all training'),
  olheiro: L('Desconto no scouting', 'Scouting discount'),
  preparador_goleiros: L('Reforça treino de goleiros', 'Boosts goalkeeper training'),
};

function formatCost(cost: { currency: 'exp' | 'bro'; amount: number }): string {
  return cost.currency === 'bro'
    ? `${(cost.amount / 100).toFixed(2)} BRO`
    : `${cost.amount.toLocaleString(LOCALE)} EXP`;
}

export function TeamStaff() {
  useTrackScreen('screen_team');
  const dispatch = useGameDispatch();
  const navigate = useNavigate();
  const manager = useGameStore((s) => s.manager);
  const players = useGameStore((s) => s.players);
  const finance = useGameStore((s) => s.finance);
  const coach = manager?.coach;

  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, StaffRoleId[]>>({});
  const [appliedFlash, setAppliedFlash] = useState<string | null>(null);
  const [group, setGroup] = useState<(typeof COLLECTIVE_GROUPS)[number]>('defensivo');
  /** Item pedido pelo fundador: confirmação antes de gastar/evoluir. */
  const [confirmRole, setConfirmRole] = useState<StaffRoleId | null>(null);

  const treinadorLvl = manager?.staff.roles.treinador ?? 1;
  const perRoleCap = maxStaffSlotsByLevel(treinadorLvl);

  const academyRoster = useMemo(
    () => Object.values(players).filter((p) => p.managerCreated === true).sort((a, b) => a.num - b.num),
    [players],
  );

  const roleUsage = useMemo(() => {
    const out: Record<StaffRoleId, number> = {
      preparador_fisico: 0, mental: 0, nutricao: 0, tatico: 0, treinador: 0, olheiro: 0, preparador_goleiros: 0,
    };
    for (const roles of Object.values(manager?.staff.assignedByPlayer ?? {})) {
      for (const r of roles ?? []) out[r] = (out[r] ?? 0) + 1;
    }
    return out;
  }, [manager?.staff.assignedByPlayer]);

  if (!coach || !manager) {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 py-8">
        <BackButton to="/clube" label={L('Clube', 'Club')} />
        <div className="sports-panel p-6 text-center">
          <Bot className="w-12 h-12 mx-auto text-gray-500 mb-4" />
          <p className="text-gray-400">{L('Coach não disponível', 'Coach unavailable')}</p>
        </div>
      </div>
    );
  }

  const draftFor = (pid: string): StaffRoleId[] => {
    if (draft[pid] !== undefined) return draft[pid];
    return manager.staff.assignedByPlayer[pid] ?? [];
  };

  const togglePending = (pid: string, roleId: StaffRoleId) => {
    setAppliedFlash(null);
    const current = draftFor(pid);
    const next = current.includes(roleId) ? current.filter((x) => x !== roleId) : [...current, roleId];
    setDraft((d) => ({ ...d, [pid]: next }));
  };

  const resetDraft = (pid: string) => {
    setDraft((d) => {
      const { [pid]: _unused, ...rest } = d;
      void _unused;
      return rest;
    });
  };

  const applyDraft = (pid: string) => {
    dispatch({ type: 'ASSIGN_STAFF_TO_PLAYER', playerId: pid, roleIds: draftFor(pid) });
    setAppliedFlash(pid);
    resetDraft(pid);
    setTimeout(() => setAppliedFlash((v) => (v === pid ? null : v)), 4500);
  };

  const toggleCollectiveRole = (roleId: StaffRoleId) => {
    const current = manager.staff.assignedCollective[group] ?? [];
    const next = current.includes(roleId) ? current.filter((x) => x !== roleId) : [...current, roleId].slice(0, perRoleCap);
    dispatch({ type: 'ASSIGN_STAFF_TO_COLLECTIVE', group, roleIds: next });
  };

  const activeInstr = coach.memory.managerInstructions.filter((i) => i.active).length;

  // ── Dados do modal de confirmação ──
  const confirmCost = confirmRole ? getStaffUpgradeCost(manager.staff.roles[confirmRole] ?? 1) : null;
  const confirmCanAfford = confirmCost
    ? confirmCost.currency === 'exp'
      ? finance.ole >= confirmCost.amount
      : finance.broCents >= confirmCost.amount
    : false;

  const doUpgrade = () => {
    if (!confirmRole || !confirmCost || !confirmCanAfford) return;
    dispatch({ type: 'UPGRADE_STAFF_ROLE', roleId: confirmRole });
    setConfirmRole(null);
  };

  return (
    <div className="w-full max-w-[100vw] min-w-0 mx-auto overflow-x-hidden pb-8">
      <div className="w-full max-w-6xl min-w-0 mx-auto px-3 sm:px-4 lg:px-8 space-y-6">
        <BackButton to="/clube" label={L('Clube', 'Club')} />

        <EditorialHero
          watermark="STAFF"
          eyebrow={L('Gestão do clube · Profissionais', 'Club management · Professionals')}
          title="Staff"
          subtitle={coach.name}
          stats={L(`${activeInstr} instruções ativas · reputação ${coach.reputation}/100`, `${activeInstr} active instructions · reputation ${coach.reputation}/100`)}
          icon={
            <div className="relative h-24 w-24 overflow-hidden border-2 border-black/60 bg-black/60 sm:h-28 sm:w-28"
                 style={{ borderRadius: 'var(--radius-sm)' }}>
              <div className="flex h-full w-full items-center justify-center">
                <Bot className="h-12 w-12 sm:h-14 sm:w-14 text-neon-yellow/90" aria-hidden />
              </div>
            </div>
          }
        />

        {/* ── Assistente IA (compacto) ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden ole-poster p-5 pl-[18px]">
          <span className="absolute inset-y-0 left-0 w-[3px] bg-neon-yellow" aria-hidden />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-neon-yellow p-0.5">
                <div className="grid h-full w-full place-items-center rounded-full bg-deep-black"><Bot className="h-6 w-6 text-neon-yellow" /></div>
              </div>
              <div>
                <h3 className="font-display text-lg font-bold uppercase tracking-wider text-white">{coach.name}</h3>
                <p className="text-xs text-white/50">{coach.personality} · {L('assistente técnico IA', 'AI assistant coach')} · rep {coach.reputation}/100</p>
              </div>
            </div>
            <button onClick={() => navigate('/coach/chat')}
              className="inline-flex items-center gap-2 rounded-md bg-neon-yellow px-5 py-3 font-display text-sm font-bold uppercase tracking-wide text-black transition-colors hover:bg-white">
              <MessageCircle className="h-5 w-5" /> {L('Conversar', 'Chat')}
            </button>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 md:grid-cols-5">
            <StatTile value={coach.tactical} label={L('Tático', 'Tactical')} tone="accent" hint="0–20" />
            <StatTile value={coach.motivation} label={L('Motivação', 'Motivation')} tone="accent" hint="0–20" />
            <StatTile value={coach.discipline} label={L('Disciplina', 'Discipline')} tone="accent" hint="0–20" />
            <StatTile value={coach.attacking} label={L('Ataque', 'Attack')} tone="accent" hint="0–20" />
            <StatTile value={coach.defending} label={L('Defesa', 'Defence')} tone="accent" hint="0–20" />
          </div>
        </motion.div>

        {/* ── Stat cards (rail) ── */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          <RailStat label={L('Slots por role', 'Slots per role')} value={<>{perRoleCap}</>} hint={L(`Treinador nível ${treinadorLvl}`, `Head Coach level ${treinadorLvl}`)} />
          <RailStat label={L('EXP disponível', 'EXP available')} value={<>{Math.round(finance.ole).toLocaleString(LOCALE)}</>} />
          <RailStat label={L('BRO disponível', 'BRO available')} value={<>{(finance.broCents / 100).toFixed(2)}</>} />
        </div>

        {/* ── Profissionais — evoluir com confirmação ── */}
        <div>
          <StepHeader title={L('Profissionais', 'Professionals')} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {STAFF_ROLE_IDS.map((id) => {
              const level = manager.staff.roles[id] ?? 1;
              const cost = getStaffUpgradeCost(level);
              return (
                <div key={id} className="relative overflow-hidden ole-poster p-4 pl-[18px]">
                  <span className="absolute inset-y-0 left-0 w-[3px] bg-neon-yellow" aria-hidden />
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-display text-[15px] font-semibold uppercase tracking-[0.03em] text-white">{STAFF_LABELS[id]}</div>
                    <div className="flex items-baseline gap-1 shrink-0">
                      <span className="font-display text-[9px] uppercase tracking-[0.12em] text-white/40">{L('Nível', 'Level')}</span>
                      <span className="tabular-nums leading-none text-neon-yellow" style={{ fontFamily: NUM, fontSize: '24px' }}>{level}</span>
                      <span className="font-display text-[11px] text-white/35">/5</span>
                    </div>
                  </div>
                  <p className="mt-1.5 truncate text-[11.5px] leading-snug text-white/55">{ROLE_ONELINER[id]}</p>
                  <button
                    disabled={!cost}
                    onClick={() => cost && setConfirmRole(id)}
                    className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-neon-yellow py-2.5 font-display text-[12px] font-bold uppercase tracking-[0.06em] text-black transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
                  >
                    {cost ? <><TrendingUp className="h-3.5 w-3.5" /> {L('Evoluir', 'Upgrade')} · {formatCost(cost)}</> : L('Nível máximo', 'Max level')}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Buff de treino por jogador ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="sports-panel space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wider">
              <UserCog className="h-5 w-5" /> {L('Buff de treino por jogador', 'Training buff per player')}
            </h3>
            <span className="text-[10px] uppercase tracking-wider text-gray-500">{L(`Só jogadores da academia · cada role aceita ${perRoleCap} atleta(s)`, `Academy players only · each role takes ${perRoleCap} player(s)`)}</span>
          </div>

          {academyRoster.length === 0 ? (
            <div className="rounded border border-dashed border-white/15 bg-black/30 p-6 text-center">
              <Sparkles className="mx-auto h-6 w-6 text-neon-yellow/80" aria-hidden />
              <p className="mt-3 text-sm text-white/80">{L('Nenhum jogador da academia.', 'No academy players.')}</p>
              <p className="mt-1 text-xs text-gray-500">
                {L('Crie o primeiro na', 'Create the first one in the')}{' '}
                <Link to="/clube/academia" className="text-neon-yellow underline hover:text-white">{L('Academia', 'Academy')}</Link>.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {academyRoster.map((p) => {
                const savedAssigned = manager.staff.assignedByPlayer[p.id] ?? [];
                const pending = draftFor(p.id);
                const isOpen = expandedPlayerId === p.id;
                const dirty = JSON.stringify([...pending].sort()) !== JSON.stringify([...savedAssigned].sort());
                const showFlash = appliedFlash === p.id;
                const pillTone = savedAssigned.length === 0 ? 'bg-white/10 text-gray-400' : 'bg-neon-yellow/20 text-neon-yellow';
                const isGoalkeeper = p.pos === 'GK' || p.pos === 'GOL';
                return (
                  <div key={p.id} className="overflow-hidden rounded border border-white/10 bg-black/40">
                    <button type="button" onClick={() => { setExpandedPlayerId(isOpen ? null : p.id); setAppliedFlash(null); }}
                      className="flex w-full items-center justify-between gap-3 px-3 py-3 hover:bg-white/[0.03]">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded bg-neon-yellow/15 font-display text-sm font-black text-neon-yellow">{p.num}</div>
                        <div className="min-w-0 text-left">
                          <div className="truncate text-sm font-bold text-white">{p.name}</div>
                          <div className="text-[10px] uppercase tracking-wider text-gray-500">{rotuloPosicao(p.pos)} · OVR {Math.round(overallFromAttributes(p.attrs, p.pos))}</div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={cn('rounded px-2 py-0.5 text-[10px] font-bold', pillTone)}>{savedAssigned.length} {L('no treino', 'in training')}</span>
                        <ChevronDown className={cn('h-4 w-4 text-gray-500 transition-transform', isOpen && 'rotate-180 text-white')} />
                      </div>
                    </button>
                    {isOpen && (
                      <div className="space-y-3 border-t border-white/10 bg-black/60 p-3">
                        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                          {STAFF_ROLE_IDS.map((id) => {
                            const selected = pending.includes(id);
                            const gkLocked = id === 'preparador_goleiros' && !isGoalkeeper;
                            const otherUsers = roleUsage[id] - (savedAssigned.includes(id) ? 1 : 0);
                            const roleFull = !selected && otherUsers >= perRoleCap;
                            const disabled = gkLocked || roleFull;
                            return (
                              <button key={id} type="button" disabled={disabled} onClick={() => togglePending(p.id, id)}
                                className={cn('rounded px-2 py-2 font-display text-[11px] font-bold uppercase tracking-wide transition-colors',
                                  selected ? 'bg-neon-yellow text-black' : 'border border-white/10 bg-white/5 text-white hover:bg-white/10',
                                  disabled && 'pointer-events-none opacity-35')}
                                title={gkLocked ? L('Só para goleiros', 'Goalkeepers only') : roleFull ? L('Slots da role cheios', 'Role slots full') : undefined}>
                                <div>{STAFF_LABELS[id]}</div>
                                <div className="mt-0.5 text-[9px] font-normal opacity-70">{roleUsage[id]}/{perRoleCap} slot(s){gkLocked ? ' · GK' : ''}</div>
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => applyDraft(p.id)} disabled={!dirty}
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded bg-neon-yellow px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-black disabled:opacity-40 sm:flex-none">
                            <Zap className="h-3.5 w-3.5" aria-hidden /> {L('Aplicar', 'Apply')}
                          </button>
                          {dirty && (
                            <button type="button" onClick={() => resetDraft(p.id)}
                              className="rounded border border-white/15 px-3 py-2 font-display text-[11px] font-bold uppercase tracking-wider text-gray-300 hover:bg-white/5">{L('Cancelar', 'Cancel')}</button>
                          )}
                        </div>
                        {showFlash && savedAssigned.length > 0 && (
                          <div className="rounded border border-neon-green/35 bg-neon-green/10 p-3">
                            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-neon-green">
                              <Check className="h-3.5 w-3.5" /> {L('Buff de treino aplicado', 'Training buff applied')}
                            </div>
                            <ul className="mt-2 space-y-0.5 text-[11px] text-white/85">
                              {savedAssigned.map((r) => (
                                <li key={r}><span className="font-bold text-neon-yellow">{STAFF_LABELS[r]}</span> — N{manager.staff.roles[r] ?? 1} {L(`reforça o treino de ${p.name}.`, `boosts ${p.name}'s training.`)}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* ── Orientação de treino coletivo ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="sports-panel space-y-4 p-5">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wider">
            <Users className="h-5 w-5" /> {L('Orientação de treino coletivo', 'Team training guidance')}
          </h3>
          <div className="flex flex-wrap gap-2">
            {COLLECTIVE_GROUPS.map((g) => {
              const GIcon = collectiveGroupIcon(g);
              return (
                <button key={g} type="button" onClick={() => setGroup(g)}
                  className={group === g
                    ? 'inline-flex items-center gap-1.5 rounded bg-neon-yellow px-4 py-2 font-display text-xs font-bold uppercase text-black'
                    : 'inline-flex items-center gap-1.5 rounded border border-white/10 bg-white/5 px-4 py-2 font-display text-xs font-bold uppercase text-gray-200'}>
                  <GIcon className="h-3.5 w-3.5 shrink-0" aria-hidden /> {ROTULO_GRUPO[g]}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {STAFF_ROLE_IDS.map((id) => {
              const selected = (manager.staff.assignedCollective[group] ?? []).includes(id);
              return (
                <button key={id} onClick={() => toggleCollectiveRole(id)}
                  className={selected ? 'rounded bg-neon-yellow py-2 font-display text-xs font-bold text-black' : 'rounded border border-white/10 bg-white/5 py-2 font-display text-xs font-bold'}>
                  {STAFF_LABELS[id]}
                </button>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* ── MODAL DE CONFIRMAÇÃO (evoluir profissional) ── */}
      <ConfirmDialog
        open={!!(confirmRole && confirmCost)}
        onClose={() => setConfirmRole(null)}
        onConfirm={doUpgrade}
        eyebrow={L('Confirmar evolução', 'Confirm upgrade')}
        title={confirmRole ? STAFF_LABELS[confirmRole] : ''}
        confirmDisabled={!confirmCanAfford}
      >
        {confirmRole && confirmCost && (
          <>
            <div className="mt-4 flex items-center gap-3">
              <span className="tabular-nums text-white/70" style={{ fontFamily: NUM, fontSize: '30px' }}>{manager.staff.roles[confirmRole] ?? 1}</span>
              <TrendingUp className="h-5 w-5 text-neon-yellow" />
              <span className="tabular-nums text-neon-yellow" style={{ fontFamily: NUM, fontSize: '30px' }}>{(manager.staff.roles[confirmRole] ?? 1) + 1}</span>
            </div>
            <div className="mt-4 space-y-1.5 text-[12.5px]">
              <div className="flex justify-between"><span className="text-white/50">{L('Custo', 'Cost')}</span><span className="font-semibold text-white">{formatCost(confirmCost)}</span></div>
              <div className="flex justify-between"><span className="text-white/50">{L('Teu saldo', 'Your balance')}</span><span className={confirmCanAfford ? 'text-white' : 'text-[color:var(--color-danger)]'}>{confirmCost.currency === 'exp' ? `${Math.round(finance.ole).toLocaleString(LOCALE)} EXP` : `${(finance.broCents / 100).toFixed(2)} BRO`}</span></div>
            </div>
            {!confirmCanAfford && <p className="mt-3 text-[11.5px] text-[color:var(--color-danger)]">{L('Saldo insuficiente para esta evolução.', 'Insufficient balance for this upgrade.')}</p>}
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}

/* ---------------- Subcomponente local ---------------- */

function StepHeader({ title }: { title: string }) {
  return (
    <div className="mb-3">
      <h2 className="ole-eyebrow-poster" style={{ fontSize: '15px' }}>{title}</h2>
    </div>
  );
}
