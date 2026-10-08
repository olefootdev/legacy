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
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { BarraSegmentos, DEGRAU_CLASSES, MarcaRua } from '@/components/ui/Rua';
import { DEGRAU_INFO, OvrSelo, PlacarRua, VazioRua, degrauDe, ovrNumeroClasses } from '@/components/clube/escada';
import { playerPortraitSrc } from '@/lib/playerPortrait';
import { trackMissionEvent } from '@/progression/trackEvent';
import { rotuloPosicao } from '@/transfer/marketFilters';
import { L, emIngles } from '@/i18n/L';

/** Inclinações de lambe colado — alternam pra não parecer grade (até 6°). */
const TORTO = [-2, 1.5, -1, 2, -1.5, 1];

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
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-8 px-3 pb-10 sm:px-4 lg:px-8">
      <BackButton to="/clube" label={L('Clube', 'Club')} />

      <EditorialHero
        eyebrow={L('Gestão do clube · Categoria de base', 'Club management · Youth academy')}
        title={L('Academia', 'Academy')}
        subtitle={L('Cria da casa não se compra.', "Homegrown can't be bought.")}
        stats={L(`${allCrias.length} cria(s) no elenco · nível ${youthLvl}/5`, `${allCrias.length} homegrown player(s) in squad · level ${youthLvl}/5`)}
        icon={<GraduationCap aria-hidden />}
        lambe={{ rotulo: L('Nível', 'Level'), valor: `${youthLvl}/5` }}
      />

      {/* Placar */}
      <PlacarRua
        className="grid-cols-3 sm:grid-cols-3"
        itens={[
          { label: L('Nível academia', 'Academy level'), value: <>{youthLvl}<small className="text-[0.5em] text-mudo">/5</small></> },
          { label: L('Booster de treino', 'Training booster'), value: <>+{boosterPct}<small className="text-[0.5em] text-mudo">%</small></> },
          { label: L('Crias no elenco', 'Homegrown in squad'), value: allCrias.length },
        ]}
      />

      {/* Como funciona + Evoluir academia */}
      <section className="flex flex-col gap-4 bg-concreto p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-lg">
          <h3 className="font-impact text-[24px] uppercase leading-none text-papel">{L('Como a base evolui', 'How the academy grows')}</h3>
          <BarraSegmentos valor={youthLvl} max={5} segmentos={5} className="mt-3 h-2.5 max-w-[220px]" />
          <p className="mt-3 text-[13px] leading-relaxed text-suave">
            {emIngles() ? <>Level boosts the <span className="text-papel">training gains</span> of homegrown players ·{' '}</> : <>Nível turbina o <span className="text-papel">ganho de treino</span> das crias ·{' '}</>}
            <Link to="/team/treino" className="font-impact uppercase text-rua hover:text-papel">{L('Treino', 'Training')} →</Link>
          </p>
        </div>
        <div className="shrink-0 pb-1 pr-1">
          {upCost ? (
            <button
              onClick={() => setConfirmUpgrade(true)}
              className="inline-flex min-h-[52px] items-center gap-2 bg-rua px-5 font-impact text-[19px] uppercase leading-none text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_var(--color-papel)]"
            >
              <TrendingUp className="h-4 w-4" /> {L('Evoluir', 'Upgrade')} · {upLabel} <span aria-hidden>→</span>
            </button>
          ) : (
            <span className="inline-flex min-h-[52px] items-center bg-ouro-27 px-5 font-impact text-[19px] uppercase leading-none text-asfalto-27">
              {L('Nível máximo', 'Max level')}
            </span>
          )}
        </div>
      </section>

      {allCrias.length === 0 ? (
        <VazioRua
          frase={L('Nenhuma cria no elenco. A base começa contigo.', 'No homegrown players yet. The academy starts with you.')}
          detalhe={L('Jogadores «novo talento» aparecem aqui.', '“New talent” players show up here.')}
          acao={{ label: L('Criar jogador', 'Create player'), to: '/clube/elenco' }}
        />
      ) : (
        <>
          {/* Filtros */}
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mudo" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={L('Buscar por nome', 'Search by name')}
                className="w-full border-2 border-linha bg-concreto px-9 py-2.5 font-prova text-[13px] text-papel placeholder:text-mudo focus:border-rua focus:outline-none" />
            </div>
            <select value={pos} onChange={(e) => setPos(e.target.value)} className="border-2 border-linha bg-concreto px-3 py-2.5 font-prova text-[13px] text-papel focus:border-rua focus:outline-none">
              <option value="">{L('Todas posições', 'All positions')}</option>
              {positions.map((p) => <option key={p} value={p}>{rotuloPosicao(p)}</option>)}
            </select>
            <div className="flex items-center justify-between border-2 border-linha px-3 py-2.5 font-prova text-[12px] uppercase tracking-[0.08em] text-mudo">
              <span>{L('Crias encontradas', 'Players found')}</span><span className="font-impact text-[18px] text-papel">{crias.length}</span>
            </div>
          </div>

          {/* Crias — cartas na escada por OVR, coladas tortas como lambe */}
          <ul className="grid grid-cols-2 gap-x-3 gap-y-5 py-2 sm:grid-cols-3 lg:grid-cols-4">
            {crias.map((p, i) => {
              const ovr = overallFromAttributes(p.attrs, p.pos);
              const cap = getEvolvedOverallCap(p);
              const headroom = Math.max(0, cap - ovr);
              const d = degrauDe(ovr);
              return (
                <li key={p.id} className="min-w-0">
                  <button type="button" onClick={() => setSelectedId(p.id)}
                    aria-label={L(`${p.name}, OVR ${ovr}, ${DEGRAU_INFO[d].nome}`, `${p.name}, OVR ${ovr}, ${DEGRAU_INFO[d].nome}`)}
                    className={cn(
                      'flex w-full min-w-0 flex-col gap-2 p-2.5 text-left shadow-[5px_6px_0_rgba(0,0,0,0.55)] transition-transform duration-200 hover:!rotate-0 hover:-translate-y-1',
                      DEGRAU_CLASSES[d],
                    )}
                    style={{ transform: `rotate(${TORTO[i % TORTO.length]}deg)` }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col">
                        <span className={cn('font-impact text-[42px] leading-[0.85] tabular-nums', ovrNumeroClasses(d))}>{ovr}</span>
                        <span className={cn('mt-1 font-impact text-[13px] uppercase leading-none', d === 'respeito' && 'text-ouro-27')}>{rotuloPosicao(p.pos)}</span>
                      </div>
                      <MarcaRua tipo="escudo" className={cn('h-7', d === 'respeito' ? 'bg-ouro-27' : 'bg-asfalto-27')} />
                    </div>
                    <div className={cn('relative aspect-[4/5] w-full overflow-hidden', d === 'respeito' ? 'bg-concreto' : 'bg-asfalto-27/10')}>
                      <img
                        src={playerPortraitSrc({ id: p.id, name: p.name, portraitUrl: p.portraitUrl }, 200, 250)}
                        alt=""
                        loading="lazy"
                        className="absolute inset-0 object-cover object-top"
                        style={{ width: '100%', height: '100%', maxWidth: 'none' }}
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <span className="block min-w-0 truncate font-voz text-[21px] leading-none">{p.name}</span>
                    <span className="font-prova text-[10px] font-bold uppercase tracking-[0.06em] opacity-80">
                      {L('Teto', 'Cap')} {cap} · {headroom > 0 ? L(`+${headroom} p/ evoluir`, `+${headroom} to grow`) : L('no teto', 'at cap')}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {crias.length === 0 && (
            <p className="border-2 border-dashed border-fio p-5 font-voz text-[21px] leading-tight text-suave">{L('Nenhuma cria com os filtros atuais.', 'No players match the current filters.')}</p>
          )}
        </>
      )}

      {/* ── MODAL: detalhe da cria (sem compra — só desenvolvimento) ── */}
      {selected && (() => {
        const selOvr = overallFromAttributes(selected.attrs, selected.pos);
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/85 p-4" onClick={() => setSelectedId(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.96, y: 14 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative my-auto w-full max-w-3xl overflow-hidden border-2 border-linha bg-asfalto-27" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setSelectedId(null)} aria-label={L('Fechar', 'Close')} className="absolute right-3 top-3 z-10 inline-flex h-11 w-11 items-center justify-center border-2 border-linha bg-asfalto-27 text-mudo hover:border-papel hover:text-papel"><X className="h-5 w-5" /></button>
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="border-b-2 border-linha p-6 md:border-b-0 md:border-r-2">
                <span className="font-prova text-[11px] font-bold text-mudo">{L('#novotalento #base', '#newtalent #academy')}</span>
                <div className="mt-2 flex min-w-0 items-center gap-3 pr-12">
                  <OvrSelo ovr={selOvr} className="h-14 w-14 text-[30px]" />
                  <h3 className="min-w-0 font-voz text-[34px] leading-none text-papel [overflow-wrap:anywhere]">{selected.name}</h3>
                </div>
                <div className="mt-6 space-y-2.5">
                  <AttrRow label={L('Passe', 'Passing')} value={selected.attrs.passe} />
                  <AttrRow label={L('Drible', 'Dribbling')} value={selected.attrs.drible} />
                  <AttrRow label={L('Finalização', 'Finishing')} value={selected.attrs.finalizacao} />
                  <AttrRow label={L('Velocidade', 'Pace')} value={selected.attrs.velocidade} />
                  <AttrRow label={L('Marcação', 'Marking')} value={selected.attrs.marcacao} />
                  <AttrRow label={L('Físico', 'Physical')} value={selected.attrs.fisico} />
                  <AttrRow label={L('Tático', 'Tactical')} value={selected.attrs.tatico} />
                </div>
              </div>
              <div className="flex flex-col gap-5 p-6">
                <dl className="grid grid-cols-2 gap-px bg-linha">
                  <Info label={L('Posição', 'Position')} value={rotuloPosicao(selected.pos)} />
                  <Info label="Overall" value={String(selOvr)} />
                  <Info label={L('Teto de OVR', 'OVR cap')} value={String(getEvolvedOverallCap(selected))} />
                  <Info label={L('Ritmo de evolução', 'Growth rate')} value={`×${(selected.evolutionRate ?? 1).toFixed(2)}`} />
                </dl>
                <div className="border-[3px] border-ouro-27 p-4">
                  <div className="font-prova text-[10px] font-bold uppercase tracking-[0.2em] text-mudo">— {L('Booster da academia', 'Academy booster')}</div>
                  <div className="mt-1 font-spray text-[40px] font-black leading-none text-ouro-27 tabular-nums">+{boosterPct}%</div>
                  <p className="mt-1 font-prova text-[11px] text-mudo">{L('ganho extra de treino · academia nível', 'extra training gain · academy level')} {youthLvl}</p>
                </div>
                <Link to="/team/treino"
                  className="mb-1 mr-1 mt-auto inline-flex min-h-[52px] w-[calc(100%-0.25rem)] items-center justify-center gap-2 bg-rua font-impact text-[19px] uppercase leading-none text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_var(--color-papel)]">
                  <Dumbbell className="h-4 w-4" /> {L('Desenvolver no Treino', 'Develop in Training')} <span aria-hidden>→</span>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
        );
      })()}

      {/* ── MODAL: confirmar evolução da academia ── */}
      <ConfirmDialog
        open={!!(confirmUpgrade && upCost)}
        onClose={() => setConfirmUpgrade(false)}
        onConfirm={doUpgrade}
        eyebrow={L('Confirmar evolução', 'Confirm upgrade')}
        title={L('Categoria de Base', 'Youth Academy')}
        confirmDisabled={!upCanAfford}
      >
        {confirmUpgrade && upCost && (
          <>
            <div className="mt-4 flex items-center gap-3">
              <span className="font-spray text-[40px] font-black leading-none text-transparent [-webkit-text-stroke:1.5px_var(--color-papel)] tabular-nums">{youthLvl}</span>
              <span aria-hidden className="font-impact text-[28px] text-rua">→</span>
              <span className="font-spray text-[40px] font-black leading-none text-papel tabular-nums">{youthLvl + 1}</span>
            </div>
            <div className="mt-4 space-y-1.5 font-prova text-[12px]">
              <div className="flex justify-between"><span className="text-mudo">{L('Custo', 'Cost')}</span><span className="font-bold text-papel">{upLabel}</span></div>
              <div className="flex justify-between"><span className="text-mudo">{L('Booster de treino', 'Training booster')}</span><span className="text-papel">+{boosterPct}% → <span className="text-alta">+{nextBoosterPct}%</span></span></div>
            </div>
            {!upCanAfford && <p className="mt-3 text-[12px] text-baixa">{L('Saldo insuficiente para esta evolução.', 'Insufficient balance for this upgrade.')}</p>}
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}

function AttrRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 truncate font-prova text-[10px] font-bold uppercase tracking-[0.12em] text-mudo">{label}</span>
      <BarraSegmentos valor={Math.max(0, Math.min(100, value))} max={100} className="h-2.5 flex-1 gap-[3px]" />
      <span className="w-8 text-right font-impact text-[17px] leading-none text-papel tabular-nums">{value}</span>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-concreto p-3">
      <dt className="font-prova text-[10px] font-bold uppercase tracking-[0.14em] text-mudo">{label}</dt>
      <dd className="mt-1 font-impact text-[22px] leading-none text-papel">{value}</dd>
    </div>
  );
}
