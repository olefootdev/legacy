import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Dumbbell, GraduationCap, Search, TrendingUp, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useGameStore, useGameDispatch } from '@/game/store';
import { overallFromAttributes } from '@/entities/player';
import { getEvolvedOverallCap } from '@/entities/playerEvolution';
import { cn } from '@/lib/utils';
import { youthAcademyProspectTrainingMultiplier } from '@/clubStructures/benefits';
import { getNextUpgradeCost } from '@/clubStructures/upgrade';
import { DEFAULT_BRO_PRICES_CENTS } from '@/clubStructures/broDefaults';
import { formatBroFromCents, formatExp } from '@/systems/economy';
import { BackButton } from '@/components/BackButton';
import { EditorialHero } from '@/components/EditorialHero';
import { RailStat } from '@/components/ui/RailStat';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { trackMissionEvent } from '@/progression/trackEvent';

const SERIF = 'var(--font-serif-hero)';

export function YouthProspects() {
  const players = useGameStore((s) => s.players);
  const finance = useGameStore((s) => s.finance);
  const youthLvl = useGameStore((s) => s.structures.youth_academy ?? 1);
  const dispatch = useGameDispatch();
  const prospectTrainMult = youthAcademyProspectTrainingMultiplier(youthLvl);
  const boosterPct = Math.round((prospectTrainMult - 1) * 100);

  const [query, setQuery] = useState('');
  const [pos, setPos] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmUpgrade, setConfirmUpgrade] = useState(false);

  const crias = useMemo(
    () =>
      Object.values(players)
        .filter((p) => p.archetype === 'novo_talento')
        .filter((p) => (pos ? p.pos === pos : true))
        .filter((p) => (query ? p.name.toLowerCase().includes(query.toLowerCase()) : true))
        .sort((a, b) => overallFromAttributes(b.attrs, b.pos) - overallFromAttributes(a.attrs, a.pos)),
    [players, pos, query],
  );
  const allCrias = useMemo(() => Object.values(players).filter((p) => p.archetype === 'novo_talento'), [players]);
  const positions = useMemo(() => Array.from(new Set(allCrias.map((p) => p.pos))).sort(), [allCrias]);
  const selected = crias.find((p) => p.id === selectedId) ?? null;

  // ── Evolução da academia (com confirmação) ──
  const upCost = getNextUpgradeCost('youth_academy', youthLvl, DEFAULT_BRO_PRICES_CENTS);
  const upCanAfford = upCost ? (upCost.currency === 'exp' ? finance.ole >= upCost.amount : finance.broCents >= upCost.amount) : false;
  const upLabel = upCost ? (upCost.currency === 'exp' ? `${formatExp(upCost.amount)} EXP` : formatBroFromCents(upCost.amount)) : null;
  const nextBoosterPct = Math.round((youthAcademyProspectTrainingMultiplier(youthLvl + 1) - 1) * 100);

  const doUpgrade = () => {
    if (!upCost || !upCanAfford) return;
    dispatch({ type: 'UPGRADE_STRUCTURE', structureId: 'youth_academy' });
    trackMissionEvent('structure_upgraded');
    setConfirmUpgrade(false);
  };

  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-6 px-3 pb-10 sm:px-4 lg:px-8">
      <BackButton to="/clube" label="Clube" />

      <EditorialHero
        watermark="BASE"
        eyebrow="Gestão do clube · Categoria de base"
        title="Academia"
        subtitle="Onde as crias viram craque."
        stats={`${allCrias.length} cria(s) no elenco · nível ${youthLvl}/5`}
        icon={
          <div className="relative h-24 w-24 overflow-hidden border-2 border-black/60 bg-black/60 sm:h-28 sm:w-28" style={{ borderRadius: 'var(--radius-sm)' }}>
            <div className="flex h-full w-full items-center justify-center">
              <GraduationCap className="h-12 w-12 text-neon-yellow/90 sm:h-14 sm:w-14" aria-hidden />
            </div>
          </div>
        }
      />

      {/* Stat cards (rail) */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        <RailStat label="Nível academia" value={<>{youthLvl}<small className="text-white/40">/5</small></>} />
        <RailStat label="Booster de treino" value={<>+{boosterPct}<small className="text-white/40">%</small></>} />
        <RailStat label="Crias no elenco" value={<>{allCrias.length}</>} />
      </div>

      {/* Como funciona + Evoluir academia */}
      <div className="relative overflow-hidden rounded-[var(--radius-md)] border border-white/10 bg-[#1c1c1c] p-5 pl-[18px]">
        <span className="absolute inset-y-0 left-0 w-[3px] bg-neon-yellow" aria-hidden />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-lg">
            <h3 className="font-display text-[16px] font-bold uppercase tracking-[0.04em]">Como a base evolui</h3>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-white/60">
              O nível da academia turbina o <span className="text-white">ganho de treino</span> das tuas crias (novo talento).
              Suba o nível aqui e desenvolva elas no{' '}
              <Link to="/team/treino" className="text-neon-yellow underline hover:text-white">Treino</Link>.
            </p>
          </div>
          <div className="shrink-0">
            {upCost ? (
              <button
                onClick={() => setConfirmUpgrade(true)}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-neon-yellow px-5 py-3 font-display text-[12px] font-bold uppercase tracking-[0.06em] text-black transition-transform hover:-translate-y-0.5"
              >
                <TrendingUp className="h-4 w-4" /> Evoluir · {upLabel}
              </button>
            ) : (
              <span className="inline-flex items-center rounded-[var(--radius-md)] border border-white/15 px-5 py-3 font-display text-[12px] font-bold uppercase tracking-[0.06em] text-white/40">
                Nível máximo
              </span>
            )}
          </div>
        </div>
      </div>

      {allCrias.length === 0 ? (
        <div className="sports-panel p-8 text-center">
          <GraduationCap className="mx-auto h-8 w-8 text-neon-yellow/70" aria-hidden />
          <p className="mt-3 text-sm text-white/80">Ainda não tens crias no elenco.</p>
          <p className="mt-1 text-xs text-gray-500">Jogadores criados como «novo talento» aparecem aqui e ganham o booster de treino da academia.</p>
        </div>
      ) : (
        <>
          {/* Filtros */}
          <div className="sports-panel grid grid-cols-1 gap-3 p-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome"
                className="w-full rounded border border-white/10 bg-black/40 px-9 py-2 text-sm" />
            </div>
            <select value={pos} onChange={(e) => setPos(e.target.value)} className="rounded border border-white/10 bg-black/40 px-3 py-2 text-sm">
              <option value="">Todas posições</option>
              {positions.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <div className="flex items-center justify-between rounded border border-white/10 bg-black/40 px-3 py-2 text-xs text-gray-400">
              <span>Crias encontradas</span><span className="font-bold text-neon-yellow">{crias.length}</span>
            </div>
          </div>

          {/* Grid de crias — view-player-card horizontal */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {crias.map((p) => {
              const ovr = overallFromAttributes(p.attrs, p.pos);
              const cap = getEvolvedOverallCap(p);
              const headroom = Math.max(0, cap - ovr);
              return (
                <button key={p.id} type="button" onClick={() => setSelectedId(p.id)}
                  className="group relative flex items-stretch overflow-hidden rounded-[var(--radius-md)] border border-white/10 bg-[#1c1c1c] text-left transition-colors hover:border-white/25">
                  <span className="absolute inset-y-0 left-0 z-10 w-[3px] bg-neon-yellow" aria-hidden />
                  <div className="relative flex w-[86px] shrink-0 flex-col justify-center overflow-hidden bg-black/60 py-3 pl-4">
                    <span className="pointer-events-none absolute -bottom-3 -right-1 italic leading-none text-white/[0.05]" style={{ fontFamily: SERIF, fontWeight: 700, fontSize: '72px' }} aria-hidden>{p.name.charAt(0)}</span>
                    <span className="italic leading-none text-neon-yellow" style={{ fontFamily: SERIF, fontWeight: 700, fontSize: '32px' }}>{ovr}</span>
                    <span className="mt-1 font-display text-[10px] uppercase tracking-[0.1em] text-white/45">{p.pos}</span>
                  </div>
                  <div className="flex flex-1 items-center px-4">
                    <div className="min-w-0">
                      <div className="truncate font-display text-[15px] font-bold uppercase tracking-[0.02em]"><span className="text-white/45">{p.num}</span> {p.name}</div>
                      <div className="mt-0.5 font-display text-[10.5px] uppercase tracking-[0.1em] text-white/45">
                        Teto {cap} · {headroom > 0 ? `+${headroom} p/ evoluir` : 'no teto'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center pr-4"><GraduationCap className="h-4 w-4 text-white/30" aria-hidden /></div>
                </button>
              );
            })}
          </div>

          {crias.length === 0 && (
            <div className="sports-panel p-8 text-center text-sm text-gray-500">Nenhuma cria com os filtros atuais.</div>
          )}
        </>
      )}

      {/* ── MODAL: detalhe da cria (sem compra — só desenvolvimento) ── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-sm" onClick={() => setSelectedId(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.96, y: 14 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative w-full max-w-3xl overflow-hidden rounded-[var(--radius-lg)] border border-neon-yellow/40 bg-[#161616]" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setSelectedId(null)} className="absolute right-4 top-4 z-10 rounded-full bg-black/60 p-2 text-gray-300 hover:text-white"><X className="h-5 w-5" /></button>
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="border-b border-white/10 bg-black/40 p-6 md:border-b-0 md:border-r">
                <div className="font-display text-[10px] uppercase tracking-widest text-neon-yellow">Novo talento</div>
                <h3 className="mt-1 font-display text-3xl font-black uppercase">{selected.name}</h3>
                <p className="mt-2 text-xs text-gray-400">Promessa da base com ritmo de evolução acelerado — desenvolve no treino pra puxar o overall até o teto.</p>
                <div className="mt-5 space-y-2">
                  <AttrRow label="Passe" value={selected.attrs.passe} />
                  <AttrRow label="Drible" value={selected.attrs.drible} />
                  <AttrRow label="Finalização" value={selected.attrs.finalizacao} />
                  <AttrRow label="Velocidade" value={selected.attrs.velocidade} />
                  <AttrRow label="Marcação" value={selected.attrs.marcacao} />
                  <AttrRow label="Físico" value={selected.attrs.fisico} />
                  <AttrRow label="Tático" value={selected.attrs.tatico} />
                </div>
              </div>
              <div className="flex flex-col p-6">
                <div className="grid grid-cols-2 gap-3">
                  <Info label="Posição" value={selected.pos} />
                  <Info label="Overall" value={String(overallFromAttributes(selected.attrs, selected.pos))} />
                  <Info label="Teto de OVR" value={String(getEvolvedOverallCap(selected))} />
                  <Info label="Ritmo de evolução" value={`×${(selected.evolutionRate ?? 1).toFixed(2)}`} />
                </div>
                <div className="mt-5 rounded-xl border border-neon-yellow/30 bg-neon-yellow/10 p-4">
                  <div className="font-display text-[10px] uppercase tracking-widest text-white/50">Booster da academia</div>
                  <div className="mt-1 italic text-neon-yellow" style={{ fontFamily: SERIF, fontWeight: 700, fontSize: '30px' }}>+{boosterPct}%</div>
                  <p className="mt-1 text-[11px] text-gray-400">de ganho extra no treino desta cria, pelo nível {youthLvl} da academia.</p>
                </div>
                <Link to="/team/treino"
                  className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-xl bg-neon-yellow py-3 font-display text-sm font-black uppercase tracking-wider text-black transition-colors hover:bg-white">
                  <Dumbbell className="h-4 w-4" /> Desenvolver no Treino
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── MODAL: confirmar evolução da academia ── */}
      <ConfirmDialog
        open={!!(confirmUpgrade && upCost)}
        onClose={() => setConfirmUpgrade(false)}
        onConfirm={doUpgrade}
        eyebrow="Confirmar evolução"
        title="Categoria de Base"
        confirmDisabled={!upCanAfford}
      >
        {confirmUpgrade && upCost && (
          <>
            <div className="mt-4 flex items-center gap-3">
              <span className="italic text-white/70" style={{ fontFamily: SERIF, fontWeight: 700, fontSize: '30px' }}>{youthLvl}</span>
              <TrendingUp className="h-5 w-5 text-neon-yellow" />
              <span className="italic text-neon-yellow" style={{ fontFamily: SERIF, fontWeight: 700, fontSize: '30px' }}>{youthLvl + 1}</span>
            </div>
            <div className="mt-4 space-y-1.5 text-[12.5px]">
              <div className="flex justify-between"><span className="text-white/50">Custo</span><span className="font-semibold text-white">{upLabel}</span></div>
              <div className="flex justify-between"><span className="text-white/50">Booster de treino</span><span className="text-white">+{boosterPct}% → <span className="text-neon-yellow">+{nextBoosterPct}%</span></span></div>
            </div>
            {!upCanAfford && <p className="mt-3 text-[11.5px] text-[color:var(--color-danger)]">Saldo insuficiente para esta evolução.</p>}
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}

function AttrRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded bg-black/50">
        <div className={cn('h-full', value >= 85 ? 'bg-neon-yellow' : value >= 72 ? 'bg-neon-green' : 'bg-blue-400')} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
      <span className="w-8 text-right text-xs font-bold text-white">{value}</span>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/10 bg-black/30 p-2.5">
      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</div>
      <div className="mt-0.5 text-sm font-bold text-white">{value}</div>
    </div>
  );
}
