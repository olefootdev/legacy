import { useMemo, useState } from 'react';
import { Check, ChevronDown, Crosshair, Lightbulb, MessageCircle, Shield, TrendingUp, UserCog, Users, Zap, Bot } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { EditorialHero } from '@/components/EditorialHero';
import { useGameDispatch, useGameStore } from '@/game/store';
import { getStaffUpgradeCost, maxStaffSlotsByLevel, STAFF_LABELS, STAFF_ROLE_IDS } from '@/systems/staff';
import type { StaffRoleId } from '@/game/types';
import { cn } from '@/lib/utils';
import { overallFromAttributes } from '@/entities/player';
import { BackButton } from '@/components/BackButton';
import { useTrackScreen } from '@/progression/trackEvent';
import { BarraSegmentos, SecaoRua, SeloRua } from '@/components/ui/Rua';
import { OvrSelo, PlacarRua, VazioRua } from '@/components/clube/escada';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { rotuloPosicao } from '@/transfer/marketFilters';
import { L, LOCALE } from '@/i18n/L';

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
        <VazioRua className="mt-6" frase={L('Coach não disponível.', 'Coach unavailable.')} />
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
      <div className="w-full max-w-6xl min-w-0 mx-auto px-3 sm:px-4 lg:px-8 space-y-8">
        <BackButton to="/clube" label={L('Clube', 'Club')} />

        <EditorialHero
          eyebrow={L('Gestão do clube · Profissionais', 'Club management · Professionals')}
          title="Staff"
          subtitle={coach.name}
          stats={L(`${activeInstr} instruções ativas · reputação ${coach.reputation}/100`, `${activeInstr} active instructions · reputation ${coach.reputation}/100`)}
          icon={<Bot aria-hidden />}
          lambe={{ rotulo: L('Reputação', 'Reputation'), valor: coach.reputation }}
        />

        {/* ── Assistente IA (compacto) ── */}
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 bg-concreto p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-[3px] border-rua">
                <Bot className="h-6 w-6 text-rua" />
              </div>
              <div className="min-w-0">
                <h3 className="truncate font-voz text-[28px] leading-none text-papel">{coach.name}</h3>
                <p className="mt-1 font-prova text-[11px] font-bold uppercase tracking-[0.08em] text-mudo">{coach.personality} · {L('assistente técnico IA', 'AI assistant coach')} · rep {coach.reputation}/100</p>
              </div>
            </div>
            <button onClick={() => navigate('/coach/chat')}
              className="mb-1 mr-1 inline-flex min-h-[52px] items-center gap-2 bg-rua px-5 font-impact text-[19px] uppercase leading-none text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_var(--color-papel)]">
              <MessageCircle className="h-5 w-5" /> {L('Conversar', 'Chat')} <span aria-hidden>→</span>
            </button>
          </div>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 min-[420px]:grid-cols-2 md:grid-cols-5">
            {[
              [L('Tático', 'Tactical'), coach.tactical],
              [L('Motivação', 'Motivation'), coach.motivation],
              [L('Disciplina', 'Discipline'), coach.discipline],
              [L('Ataque', 'Attack'), coach.attacking],
              [L('Defesa', 'Defence'), coach.defending],
            ].map(([label, v]) => (
              <div key={label as string} className="min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="font-prova text-[11px] font-bold uppercase tracking-[0.14em] text-mudo">{label}</dt>
                  <dd className="font-impact text-[22px] leading-none text-papel tabular-nums">{v}<span className="font-prova text-[10px] text-mudo">/20</span></dd>
                </div>
                <BarraSegmentos valor={Number(v)} max={20} className="mt-1.5 h-2 gap-[3px]" />
              </div>
            ))}
          </dl>
        </motion.section>

        {/* ── Placar ── */}
        <PlacarRua
          className="sm:grid-cols-3"
          itens={[
            { label: L('Slots por role', 'Slots per role'), value: perRoleCap, hint: L(`Treinador nível ${treinadorLvl}`, `Head Coach level ${treinadorLvl}`) },
            { label: L('EXP disponível', 'EXP available'), value: Math.round(finance.ole).toLocaleString(LOCALE) },
            { label: L('BRO disponível', 'BRO available'), value: (finance.broCents / 100).toFixed(2) },
          ]}
        />

        {/* ── Profissionais — evoluir com confirmação ── */}
        <section className="flex flex-col gap-3">
          <SecaoRua label={L('Profissionais', 'Professionals')} aside={STAFF_ROLE_IDS.length} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {STAFF_ROLE_IDS.map((id) => {
              const level = manager.staff.roles[id] ?? 1;
              const cost = getStaffUpgradeCost(level);
              return (
                <div key={id} className="flex min-w-0 flex-col gap-3 bg-concreto p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-impact text-[22px] uppercase leading-none text-papel">{STAFF_LABELS[id]}</div>
                      <p className="mt-1.5 truncate text-[12px] leading-snug text-suave">{ROLE_ONELINER[id]}</p>
                    </div>
                    <div className="flex shrink-0 items-baseline gap-1">
                      <span className="font-prova text-[9px] font-bold uppercase tracking-[0.12em] text-mudo">{L('Nível', 'Level')}</span>
                      <span className="font-impact text-[30px] leading-none text-papel tabular-nums">{level}</span>
                      <span className="font-prova text-[11px] text-mudo">/5</span>
                    </div>
                  </div>
                  <BarraSegmentos valor={level} max={5} segmentos={5} className="h-2.5" />
                  <button
                    disabled={!cost}
                    onClick={() => cost && setConfirmRole(id)}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 border-2 border-rua font-impact text-[16px] uppercase leading-none text-rua transition-colors hover:bg-rua hover:text-asfalto-27 disabled:cursor-not-allowed disabled:border-dashed disabled:border-fio disabled:text-mudo disabled:hover:bg-transparent"
                  >
                    {cost ? <><TrendingUp className="h-4 w-4" /> {L('Evoluir', 'Upgrade')} · {formatCost(cost)} <span aria-hidden>→</span></> : L('Nível máximo', 'Max level')}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Buff de treino por jogador ── */}
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="flex items-center gap-2 font-impact text-[26px] uppercase leading-none text-papel">
              <UserCog className="h-5 w-5 text-rua" /> {L('Buff de treino por jogador', 'Training buff per player')}
            </h3>
            <span className="font-prova text-[11px] font-bold uppercase tracking-[0.1em] text-mudo">{L(`Só jogadores da academia · cada role aceita ${perRoleCap} atleta(s)`, `Academy players only · each role takes ${perRoleCap} player(s)`)}</span>
          </div>

          {academyRoster.length === 0 ? (
            <VazioRua
              frase={L('Nenhum jogador da academia.', 'No academy players.')}
              detalhe={L('Crie o primeiro na Academia.', 'Create the first one in the Academy.')}
              acao={{ label: L('Academia', 'Academy'), to: '/clube/academia' }}
            />
          ) : (
            <div className="flex flex-col gap-px bg-linha">
              {academyRoster.map((p) => {
                const savedAssigned = manager.staff.assignedByPlayer[p.id] ?? [];
                const pending = draftFor(p.id);
                const isOpen = expandedPlayerId === p.id;
                const dirty = JSON.stringify([...pending].sort()) !== JSON.stringify([...savedAssigned].sort());
                const showFlash = appliedFlash === p.id;
                const isGoalkeeper = p.pos === 'GK' || p.pos === 'GOL';
                const ovr = Math.round(overallFromAttributes(p.attrs, p.pos));
                return (
                  <div key={p.id} className="bg-asfalto-27">
                    <button type="button" onClick={() => { setExpandedPlayerId(isOpen ? null : p.id); setAppliedFlash(null); }}
                      aria-expanded={isOpen}
                      className="flex min-h-[64px] w-full items-center justify-between gap-3 px-3 py-2.5 hover:bg-concreto">
                      <div className="flex min-w-0 items-center gap-3">
                        <OvrSelo ovr={ovr} className="h-11 w-11 text-[22px]" />
                        <div className="min-w-0 text-left">
                          <div className="truncate font-voz text-[22px] leading-none text-papel">{p.name}</div>
                          <div className="mt-1 font-prova text-[10px] font-bold uppercase tracking-[0.1em] text-mudo">#{p.num} · {rotuloPosicao(p.pos)} · OVR {ovr}</div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <SeloRua tom={savedAssigned.length === 0 ? 'mudo' : 'corre-contorno'} className="text-[10px]">
                          {savedAssigned.length} {L('no treino', 'in training')}
                        </SeloRua>
                        <ChevronDown className={cn('h-4 w-4 text-mudo transition-transform', isOpen && 'rotate-180 text-papel')} />
                      </div>
                    </button>
                    {isOpen && (
                      <div className="space-y-3 border-t-2 border-linha bg-concreto p-3">
                        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                          {STAFF_ROLE_IDS.map((id) => {
                            const selected = pending.includes(id);
                            const gkLocked = id === 'preparador_goleiros' && !isGoalkeeper;
                            const otherUsers = roleUsage[id] - (savedAssigned.includes(id) ? 1 : 0);
                            const roleFull = !selected && otherUsers >= perRoleCap;
                            const disabled = gkLocked || roleFull;
                            return (
                              <button key={id} type="button" disabled={disabled} onClick={() => togglePending(p.id, id)}
                                aria-pressed={selected}
                                className={cn('min-w-0 px-2 py-2 text-left transition-colors',
                                  selected ? 'bg-rua text-asfalto-27' : 'border-2 border-linha bg-asfalto-27 text-papel hover:border-fio',
                                  disabled && 'pointer-events-none border-dashed opacity-35')}
                                title={gkLocked ? L('Só para goleiros', 'Goalkeepers only') : roleFull ? L('Slots da role cheios', 'Role slots full') : undefined}>
                                <div className="truncate font-impact text-[14px] uppercase leading-tight">{STAFF_LABELS[id]}</div>
                                <div className="mt-0.5 font-prova text-[9px] opacity-70">{roleUsage[id]}/{perRoleCap} slot(s){gkLocked ? ' · GK' : ''}</div>
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex items-center gap-3 pb-1 pr-1">
                          <button type="button" onClick={() => applyDraft(p.id)} disabled={!dirty}
                            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 bg-rua px-4 font-impact text-[16px] uppercase leading-none text-asfalto-27 shadow-[3px_3px_0_var(--color-papel)] disabled:opacity-40 disabled:shadow-none sm:flex-none">
                            <Zap className="h-3.5 w-3.5" aria-hidden /> {L('Aplicar', 'Apply')} <span aria-hidden>→</span>
                          </button>
                          {dirty && (
                            <button type="button" onClick={() => resetDraft(p.id)}
                              className="inline-flex min-h-[44px] items-center border-2 border-linha px-3 font-impact text-[15px] uppercase leading-none text-mudo hover:border-papel hover:text-papel">{L('Cancelar', 'Cancel')}</button>
                          )}
                        </div>
                        {showFlash && savedAssigned.length > 0 && (
                          <div className="border-l-[3px] border-rua bg-asfalto-27 p-3">
                            <div className="flex items-center gap-2 font-prova text-[11px] font-bold uppercase tracking-[0.1em] text-rua">
                              <Check className="h-3.5 w-3.5" /> {L('Buff de treino aplicado', 'Training buff applied')}
                            </div>
                            <ul className="mt-2 space-y-0.5 text-[12px] text-suave">
                              {savedAssigned.map((r) => (
                                <li key={r}><span className="font-bold text-papel">{STAFF_LABELS[r]}</span> — N{manager.staff.roles[r] ?? 1} {L(`reforça o treino de ${p.name}.`, `boosts ${p.name}'s training.`)}</li>
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
        </motion.section>

        {/* ── Orientação de treino coletivo ── */}
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
          <h3 className="flex items-center gap-2 font-impact text-[26px] uppercase leading-none text-papel">
            <Users className="h-5 w-5 text-rua" /> {L('Orientação de treino coletivo', 'Team training guidance')}
          </h3>
          <div className="flex flex-wrap gap-2">
            {COLLECTIVE_GROUPS.map((g) => {
              const GIcon = collectiveGroupIcon(g);
              return (
                <button key={g} type="button" onClick={() => setGroup(g)}
                  aria-pressed={group === g}
                  className={group === g
                    ? 'inline-flex min-h-[44px] items-center gap-1.5 bg-rua px-4 font-impact text-[16px] uppercase leading-none text-asfalto-27'
                    : 'inline-flex min-h-[44px] items-center gap-1.5 border-2 border-linha px-4 font-impact text-[16px] uppercase leading-none text-papel hover:border-fio'}>
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
                  aria-pressed={selected}
                  className={selected
                    ? 'min-h-[44px] px-2 text-left font-impact text-[14px] uppercase leading-tight text-asfalto-27 bg-rua'
                    : 'min-h-[44px] border-2 border-linha px-2 text-left font-impact text-[14px] uppercase leading-tight text-papel hover:border-fio'}>
                  {STAFF_LABELS[id]}
                </button>
              );
            })}
          </div>
        </motion.section>
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
              <span className="font-spray text-[40px] font-black leading-none text-transparent [-webkit-text-stroke:1.5px_var(--color-papel)] tabular-nums">{manager.staff.roles[confirmRole] ?? 1}</span>
              <span aria-hidden className="font-impact text-[28px] text-rua">→</span>
              <span className="font-spray text-[40px] font-black leading-none text-papel tabular-nums">{(manager.staff.roles[confirmRole] ?? 1) + 1}</span>
            </div>
            <div className="mt-4 space-y-1.5 font-prova text-[12px]">
              <div className="flex justify-between"><span className="text-mudo">{L('Custo', 'Cost')}</span><span className="font-bold text-papel">{formatCost(confirmCost)}</span></div>
              <div className="flex justify-between"><span className="text-mudo">{L('Teu saldo', 'Your balance')}</span><span className={confirmCanAfford ? 'text-papel' : 'text-baixa'}>{confirmCost.currency === 'exp' ? `${Math.round(finance.ole).toLocaleString(LOCALE)} EXP` : `${(finance.broCents / 100).toFixed(2)} BRO`}</span></div>
            </div>
            {!confirmCanAfford && <p className="mt-3 text-[12px] text-baixa">{L('Saldo insuficiente para esta evolução.', 'Insufficient balance for this upgrade.')}</p>}
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}
