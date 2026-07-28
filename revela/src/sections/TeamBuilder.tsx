/**
 * CRIE O SEU TIME — o fluxo de 3 passos que converte visitante em manager.
 *
 * A tese: montar um XI misturando revelação com lenda é a demonstração mais
 * curta do que a Olefoot é. Quem monta, compartilha; quem compartilha, traz
 * gente. Por isso o passo 3 é um pôster exportável, não uma tela de "pronto".
 *
 * ⚠️ O protótipo original pedia NOME + TELEFONE no passo 1 e guardava em
 * localStorage. Aqui não. Telefone é dado pessoal, e este projeto já fechou dois
 * vazamentos de PII. A escalação é salva na CONTA (revela_lineups, atrelada a
 * auth.uid()) quando a pessoa entra — sem conta, o time vive só na sessão do
 * navegador e nada pessoal é gravado.
 */
import { useEffect, useMemo, useState } from 'react';
import { Eyebrow } from '../components/primitives';
import { Field } from '../components/AuthSheet';
import { saveLineup } from '../data/revelaApi';
import { GAME_URL, signupUrl } from '../data/session';
import type { Legend, Talent } from '../data/types';

/* ══ Formações ═════════════════════════════════════════════════════════════ */

interface Slot {
  label: string;
  top: number;
  left: number;
}

const FORMATIONS: Record<string, Slot[]> = {
  '4-3-3': [
    { label: 'GOL', top: 90, left: 50 },
    { label: 'LAT', top: 66, left: 12 },
    { label: 'ZAG', top: 68, left: 34 },
    { label: 'ZAG', top: 68, left: 66 },
    { label: 'LAT', top: 66, left: 88 },
    { label: 'MEI', top: 46, left: 28 },
    { label: 'MEI', top: 46, left: 50 },
    { label: 'MEI', top: 46, left: 72 },
    { label: 'ATA', top: 20, left: 25 },
    { label: 'ATA', top: 20, left: 50 },
    { label: 'ATA', top: 20, left: 75 },
  ],
  '4-4-2': [
    { label: 'GOL', top: 90, left: 50 },
    { label: 'LAT', top: 68, left: 12 },
    { label: 'ZAG', top: 68, left: 38 },
    { label: 'ZAG', top: 68, left: 62 },
    { label: 'LAT', top: 68, left: 88 },
    { label: 'MEI', top: 45, left: 14 },
    { label: 'MEI', top: 45, left: 38 },
    { label: 'MEI', top: 45, left: 62 },
    { label: 'MEI', top: 45, left: 86 },
    { label: 'ATA', top: 20, left: 36 },
    { label: 'ATA', top: 20, left: 64 },
  ],
  '3-5-2': [
    { label: 'GOL', top: 90, left: 50 },
    { label: 'ZAG', top: 70, left: 26 },
    { label: 'ZAG', top: 70, left: 50 },
    { label: 'ZAG', top: 70, left: 74 },
    { label: 'LAT', top: 47, left: 8 },
    { label: 'MEI', top: 47, left: 30 },
    { label: 'MEI', top: 47, left: 50 },
    { label: 'MEI', top: 47, left: 70 },
    { label: 'LAT', top: 47, left: 92 },
    { label: 'ATA', top: 20, left: 36 },
    { label: 'ATA', top: 20, left: 64 },
  ],
  '4-2-3-1': [
    { label: 'GOL', top: 90, left: 50 },
    { label: 'LAT', top: 72, left: 12 },
    { label: 'ZAG', top: 72, left: 38 },
    { label: 'ZAG', top: 72, left: 62 },
    { label: 'LAT', top: 72, left: 88 },
    { label: 'VOL', top: 54, left: 36 },
    { label: 'VOL', top: 54, left: 64 },
    { label: 'MEI', top: 33, left: 24 },
    { label: 'MEI', top: 33, left: 50 },
    { label: 'MEI', top: 33, left: 76 },
    { label: 'ATA', top: 14, left: 50 },
  ],
};

const FORMATION_IDS = Object.keys(FORMATIONS);

/* ══ Pool ══════════════════════════════════════════════════════════════════ */

type PoolKind = 'talent' | 'legend';

interface PoolPlayer {
  id: string;
  name: string;
  pos: string;
  overall: number;
  kind: PoolKind;
}

/** Grupos de posição do filtro — o vocabulário do jogo, não o do banco. */
const POS_GROUP: Record<string, string[]> = {
  GOL: ['GOL'],
  DEF: ['ZAG', 'LE', 'LD', 'LAT'],
  MEI: ['VOL', 'MC', 'MEI'],
  ATA: ['PE', 'PD', 'PON', 'ATA'],
};

/**
 * Qualquer jogador cabe em qualquer slot — de propósito. É um XI de vitrine,
 * não uma escalação válida de partida; barrar um zagueiro no ataque só
 * frustraria quem quer montar o time dos sonhos.
 */
function groupOf(pos: string): string {
  const p = pos.toUpperCase();
  for (const [g, list] of Object.entries(POS_GROUP)) if (list.includes(p)) return g;
  return 'MEI';
}

const FILTERS = ['TODOS', 'REVELAÇÕES', 'LENDAS', 'GOL', 'DEF', 'MEI', 'ATA'] as const;
type Filter = (typeof FILTERS)[number];

const LOCAL_KEY = 'olefoot-revela-xi';

type Step = 'register' | 'build' | 'share';

export function TeamBuilder({
  talents,
  legends,
  authed,
  onNeedAuth,
  onNote,
}: {
  talents: Talent[];
  legends: Legend[];
  authed: boolean;
  onNeedAuth: () => void;
  onNote: (title: string, body?: string, tone?: 'yellow' | 'green') => void;
}) {
  const pool = useMemo<PoolPlayer[]>(
    () => [
      ...talents
        .filter((t) => t.overall != null)
        .map((t) => ({ id: `t:${t.id}`, name: t.name, pos: t.pos, overall: t.overall as number, kind: 'talent' as const })),
      ...legends
        .filter((l) => l.overall != null)
        .map((l) => ({ id: `l:${l.id}`, name: l.name, pos: l.pos, overall: l.overall as number, kind: 'legend' as const })),
    ],
    [talents, legends],
  );

  const [step, setStep] = useState<Step>('register');
  const [coach, setCoach] = useState('');
  const [teamName, setTeamName] = useState('');
  const [formation, setFormation] = useState(FORMATION_IDS[0]);
  const [slots, setSlots] = useState<(string | null)[]>(Array(11).fill(null));
  const [selected, setSelected] = useState<number | null>(0);
  const [filter, setFilter] = useState<Filter>('TODOS');
  const [saved, setSaved] = useState(false);

  // Retoma de onde parou. Apelido e nome de time não são dado pessoal —
  // telefone e e-mail nunca chegam aqui.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as { coach?: string; teamName?: string; formation?: string };
      if (s.coach) setCoach(s.coach);
      if (s.teamName) setTeamName(s.teamName);
      if (s.formation && FORMATIONS[s.formation]) setFormation(s.formation);
      if (s.coach && s.coach.trim().length >= 2) setStep('build');
    } catch {
      /* storage bloqueado: começa do zero, sem drama */
    }
  }, []);

  function persist(next: Partial<{ coach: string; teamName: string; formation: string }>) {
    try {
      localStorage.setItem(
        LOCAL_KEY,
        JSON.stringify({ coach, teamName, formation, ...next }),
      );
    } catch {
      /* idem */
    }
  }

  const layout = FORMATIONS[formation];
  const filled = slots.filter(Boolean).length;
  const byId = useMemo(() => new Map(pool.map((p) => [p.id, p])), [pool]);

  function changeFormation(id: string) {
    // As coordenadas mudam: manter a escalação antiga colocaria zagueiro na
    // ponta. Resetar é a única leitura honesta.
    setFormation(id);
    setSlots(Array(11).fill(null));
    setSelected(0);
    persist({ formation: id });
  }

  function assign(playerId: string) {
    setSlots((prev) => {
      const next = [...prev];
      const already = next.indexOf(playerId);
      if (already >= 0) {
        next[already] = null;
        return next;
      }
      const target = selected ?? next.findIndex((s) => s === null);
      if (target < 0) return next;
      next[target] = playerId;
      const nextEmpty = next.findIndex((s) => s === null);
      setSelected(nextEmpty >= 0 ? nextEmpty : null);
      return next;
    });
  }

  function toggleSlot(i: number) {
    if (slots[i]) {
      setSlots((prev) => {
        const next = [...prev];
        next[i] = null;
        return next;
      });
      setSelected(i);
      return;
    }
    setSelected((prev) => (prev === i ? null : i));
  }

  const visiblePool = pool.filter((p) => {
    if (filter === 'TODOS') return true;
    if (filter === 'REVELAÇÕES') return p.kind === 'talent';
    if (filter === 'LENDAS') return p.kind === 'legend';
    return groupOf(p.pos) === filter;
  });

  async function confirm() {
    setStep('share');
    if (!authed) return;
    const res = await saveLineup({
      teamName: teamName.trim(),
      formation,
      coach: coach.trim(),
      slots,
    });
    if (res) {
      setSaved(true);
      onNote('Time salvo na tua conta', 'Ele te espera quando entrar no game.', 'green');
    }
  }

  const caption = `Montei meu XI na @olefootgame! ⚡ ${teamName || 'Meu time'} — ${formation}. Do novo talento à lenda no mesmo time. Vem revelar o próximo craque. #OlefootRevela`;

  return (
    <section
      id="meu-time"
      className="rev-section"
      style={{ background: 'var(--color-rev-yellow)', color: '#0D0D0D' }}
    >
      <div className="rev-container">
        <Eyebrow on="yellow">O game</Eyebrow>
        <h2 className="rev-display mt-4" style={{ fontSize: 'clamp(32px,5.4vw,68px)' }}>
          Crie o seu time
        </h2>
        <p className="rev-label mt-3 text-[11px]" style={{ color: 'rgba(13,13,13,.55)' }}>
          Revelação e lenda no mesmo XI. É assim que a Olefoot funciona.
        </p>

        <div
          className="mt-9 overflow-hidden"
          style={{
            background: 'var(--color-rev-black)',
            color: 'var(--color-rev-bone)',
            borderRadius: 'var(--radius-rev-card-lg)',
            boxShadow: 'var(--shadow-rev-lg)',
          }}
        >
          <StepBar step={step} />

          <div style={{ padding: 'clamp(20px,3.5vw,38px)' }}>
            {step === 'register' && (
              <Register
                coach={coach}
                setCoach={setCoach}
                onNext={() => {
                  persist({ coach });
                  setStep('build');
                }}
              />
            )}

            {step === 'build' && (
              <Build
                teamName={teamName}
                setTeamName={(v) => {
                  setTeamName(v);
                  persist({ teamName: v });
                }}
                formation={formation}
                onFormation={changeFormation}
                layout={layout}
                slots={slots}
                selected={selected}
                onSlot={toggleSlot}
                byId={byId}
                pool={visiblePool}
                filter={filter}
                setFilter={setFilter}
                onAssign={assign}
                coach={coach}
                filled={filled}
                onConfirm={confirm}
              />
            )}

            {step === 'share' && (
              <Share
                teamName={teamName}
                formation={formation}
                coach={coach}
                layout={layout}
                slots={slots}
                byId={byId}
                caption={caption}
                authed={authed}
                saved={saved}
                onNeedAuth={onNeedAuth}
                onNote={onNote}
                onBack={() => setStep('build')}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══ Barra de passos ═══════════════════════════════════════════════════════ */

const STEP_LABELS: Array<{ id: Step; n: number; label: string }> = [
  { id: 'register', n: 1, label: 'Cadastro' },
  { id: 'build', n: 2, label: 'Escalação' },
  { id: 'share', n: 3, label: 'Compartilhar' },
];

function StepBar({ step }: { step: Step }) {
  const idx = STEP_LABELS.findIndex((s) => s.id === step);
  return (
    <ol
      className="flex"
      style={{ borderBottom: '1px solid rgba(255,255,255,.1)' }}
    >
      {STEP_LABELS.map((s, i) => {
        const active = i === idx;
        const done = i < idx;
        return (
          <li
            key={s.id}
            className="flex flex-1 items-center justify-center gap-2 px-3 py-4"
            style={{
              background: active ? 'rgba(253,225,0,.1)' : 'transparent',
              borderBottom: active ? '2px solid var(--color-rev-yellow)' : '2px solid transparent',
            }}
          >
            <span
              className="rev-display grid place-items-center text-[11px]"
              style={{
                width: 22,
                height: 22,
                borderRadius: 999,
                background: done || active ? 'var(--color-rev-yellow)' : 'rgba(255,255,255,.14)',
                color: done || active ? '#0D0D0D' : 'rgba(237,235,228,.5)',
              }}
            >
              {done ? '✓' : s.n}
            </span>
            <span
              className="rev-label text-[10px]"
              style={{ color: active ? 'var(--color-rev-yellow)' : 'rgba(237,235,228,.42)' }}
            >
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ══ Passo 1 ═══════════════════════════════════════════════════════════════ */

function Register({
  coach,
  setCoach,
  onNext,
}: {
  coach: string;
  setCoach: (v: string) => void;
  onNext: () => void;
}) {
  const valid = coach.trim().length >= 2;
  return (
    <div className="mx-auto max-w-[420px]">
      <h3 className="rev-display text-[28px]">Como te chamamos?</h3>
      <p className="mt-2 text-[14px] leading-relaxed" style={{ color: 'rgba(237,235,228,.55)' }}>
        Só o nome do técnico. Nada de telefone — se quiser salvar o time de verdade,
        a gente pede a conta lá no final.
      </p>
      <div className="mt-5">
        <Field label="Nome do técnico" value={coach} onChange={setCoach} autoComplete="nickname" />
      </div>
      <button
        type="button"
        onClick={onNext}
        disabled={!valid}
        className="rev-btn rev-focus mt-5 w-full"
        data-variant="yellow"
        data-on="dark"
      >
        Começar a montar →
      </button>
    </div>
  );
}

/* ══ Passo 2 ═══════════════════════════════════════════════════════════════ */

function Build(props: {
  teamName: string;
  setTeamName: (v: string) => void;
  formation: string;
  onFormation: (v: string) => void;
  layout: Slot[];
  slots: (string | null)[];
  selected: number | null;
  onSlot: (i: number) => void;
  byId: Map<string, PoolPlayer>;
  pool: PoolPlayer[];
  filter: Filter;
  setFilter: (f: Filter) => void;
  onAssign: (id: string) => void;
  coach: string;
  filled: number;
  onConfirm: () => void;
}) {
  const {
    teamName, setTeamName, formation, onFormation, layout, slots, selected, onSlot,
    byId, pool, filter, setFilter, onAssign, coach, filled, onConfirm,
  } = props;

  const canConfirm = teamName.trim().length >= 2 && filled >= 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-5">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <span className="rev-label text-[10px]" style={{ color: 'rgba(237,235,228,.5)' }}>
            Nome do time
          </span>
          <input
            value={teamName}
            onChange={(e) => setTeamName(e.target.value.toUpperCase())}
            placeholder="MEU TIME"
            className="rev-display rev-focus"
            data-on="dark"
            style={{
              minHeight: 52,
              padding: '0 14px',
              fontSize: 26,
              borderRadius: 'var(--radius-rev-btn)',
              background: '#0f0f0f',
              border: '2px solid rgba(255,255,255,.1)',
              color: 'var(--color-rev-yellow)',
            }}
          />
        </label>

        <div className="flex flex-wrap gap-1.5">
          {FORMATION_IDS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onFormation(f)}
              className="rev-chip rev-focus"
              data-on="dark"
              style={{
                color: formation === f ? '#0D0D0D' : 'rgba(237,235,228,.6)',
                background: formation === f ? 'var(--color-rev-yellow)' : 'transparent',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
        {/* Campo */}
        <div>
          <Pitch layout={layout} slots={slots} selected={selected} onSlot={onSlot} byId={byId} />
          <p className="rev-label mt-3 text-[10px]" style={{ color: 'rgba(237,235,228,.42)' }}>
            {selected != null
              ? `Escolhendo o ${layout[selected].label} — toque num jogador ao lado`
              : 'Toque numa posição no campo pra escolher quem joga ali'}
          </p>
        </div>

        {/* Elenco */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className="rev-chip rev-focus"
                data-on="dark"
                style={{
                  color: filter === f ? '#0D0D0D' : 'rgba(237,235,228,.55)',
                  background: filter === f ? 'var(--color-rev-yellow)' : 'transparent',
                }}
              >
                {f}
              </button>
            ))}
          </div>

          {pool.length === 0 ? (
            <p
              className="px-4 py-6 text-[13px]"
              style={{
                color: 'rgba(237,235,228,.45)',
                border: '2px dashed rgba(237,235,228,.18)',
                borderRadius: 'var(--radius-rev-card)',
              }}
            >
              Nenhum jogador nesse filtro ainda.
            </p>
          ) : (
            <div
              className="grid gap-2 overflow-y-auto pr-1"
              style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', maxHeight: '52vh' }}
            >
              {pool.map((p) => {
                const assigned = slots.includes(p.id);
                const legend = p.kind === 'legend';
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onAssign(p.id)}
                    className="rev-focus flex items-center gap-2.5 p-2.5 text-left"
                    data-on="dark"
                    style={{
                      borderRadius: 10,
                      background: '#111',
                      border: assigned ? '2px solid var(--color-rev-yellow)' : '2px solid rgba(255,255,255,.08)',
                      transition: 'border-color var(--dur-rev-micro) var(--ease-rev)',
                    }}
                  >
                    <span
                      className="rev-display grid shrink-0 place-items-center text-[15px]"
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 7,
                        background: legend ? 'var(--color-rev-legend)' : 'var(--color-rev-talent)',
                        color: '#0D0D0D',
                      }}
                    >
                      {p.overall}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px]" style={{ color: 'var(--color-rev-bone)' }}>
                        {p.name}
                      </span>
                      <span
                        className="rev-label flex items-center gap-1.5 text-[9px]"
                        style={{ color: 'rgba(237,235,228,.45)' }}
                      >
                        <span
                          className="inline-block rounded-full"
                          style={{
                            width: 5,
                            height: 5,
                            background: legend ? 'var(--color-rev-legend)' : 'var(--color-rev-talent)',
                          }}
                        />
                        {p.pos} · {legend ? 'Lenda' : 'Revelação'}
                      </span>
                    </span>
                    {assigned && (
                      <span className="shrink-0 text-[13px]" style={{ color: 'var(--color-rev-yellow)' }}>
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div
        className="flex flex-wrap items-center justify-between gap-4 pt-4"
        style={{ borderTop: '1px solid rgba(255,255,255,.1)' }}
      >
        <p className="rev-label text-[11px]" style={{ color: 'rgba(237,235,228,.5)' }}>
          Técnico: {coach || '—'} · {filled}/11 escalados
        </p>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!canConfirm}
          className="rev-btn rev-focus"
          data-variant="yellow"
          data-on="dark"
        >
          Confirmar time →
        </button>
      </div>
    </div>
  );
}

/**
 * Campo. `aspect-ratio` e não altura fixa — no celular uma altura em px colapsa
 * o gramado e os tokens se empilham em cima uns dos outros.
 */
function Pitch({
  layout,
  slots,
  selected,
  onSlot,
  byId,
  readOnly = false,
}: {
  layout: Slot[];
  slots: (string | null)[];
  selected?: number | null;
  onSlot?: (i: number) => void;
  byId: Map<string, PoolPlayer>;
  readOnly?: boolean;
}) {
  return (
    <div
      className="relative w-full"
      style={{
        aspectRatio: '3 / 4',
        borderRadius: 'var(--radius-rev-card)',
        background: 'radial-gradient(ellipse at 50% 40%, #17301c 0%, #0e1b12 78%)',
        border: '2px solid rgba(253,225,0,.24)',
        overflow: 'hidden',
      }}
    >
      {/* Marcações */}
      <span style={line({ inset: '4% 5%', border: '2px solid rgba(253,225,0,.2)', borderRadius: 4 })} />
      <span style={line({ left: '5%', right: '5%', top: '50%', borderTop: '2px solid rgba(253,225,0,.2)' })} />
      <span
        style={line({
          left: '50%',
          top: '50%',
          width: '26%',
          aspectRatio: '1',
          transform: 'translate(-50%,-50%)',
          border: '2px solid rgba(253,225,0,.2)',
          borderRadius: '50%',
        })}
      />
      <span style={line({ left: '24%', right: '24%', top: '4%', height: '13%', border: '2px solid rgba(253,225,0,.2)' })} />
      <span style={line({ left: '24%', right: '24%', bottom: '4%', height: '13%', border: '2px solid rgba(253,225,0,.2)' })} />

      {layout.map((slot, i) => {
        const player = slots[i] ? byId.get(slots[i] as string) : undefined;
        const isSel = selected === i;
        const legend = player?.kind === 'legend';

        const token = (
          <>
            <span
              className="grid place-items-center"
              style={{
                width: '100%',
                aspectRatio: '1',
                borderRadius: '50%',
                background: player ? (legend ? '#0D0D0D' : 'var(--color-rev-yellow)') : 'transparent',
                border: player
                  ? `2px solid ${legend ? 'var(--color-rev-bone)' : '#0D0D0D'}`
                  : '2px dashed rgba(253,225,0,.5)',
                color: player ? (legend ? 'var(--color-rev-bone)' : '#0D0D0D') : 'rgba(253,225,0,.75)',
                fontFamily: player ? 'var(--font-label)' : 'var(--font-label)',
                fontWeight: 700,
                fontSize: player ? 15 : 9,
                letterSpacing: player ? 0 : '.1em',
                boxShadow: isSel ? '0 0 0 3px var(--color-rev-success)' : undefined,
                transition: 'box-shadow var(--dur-rev-micro) var(--ease-rev)',
              }}
            >
              {player ? player.overall : slot.label}
            </span>
            {player && (
              <span
                className="rev-label mt-1 block max-w-full truncate rounded-full px-1.5 text-[8px]"
                style={{ background: 'rgba(13,13,13,.82)', color: 'var(--color-rev-bone)' }}
              >
                {surname(player.name)}
              </span>
            )}
          </>
        );

        const style = {
          position: 'absolute' as const,
          top: `${slot.top}%`,
          left: `${slot.left}%`,
          transform: 'translate(-50%,-50%)',
          width: 'clamp(38px,11%,58px)',
          textAlign: 'center' as const,
        };

        if (readOnly || !onSlot) {
          return (
            <span key={i} style={style}>
              {token}
            </span>
          );
        }

        return (
          <button
            key={i}
            type="button"
            onClick={() => onSlot(i)}
            aria-label={player ? `${slot.label}: ${player.name}` : `${slot.label} vazio`}
            className="rev-focus"
            data-on="dark"
            style={{ ...style, cursor: 'pointer', background: 'transparent', border: 'none', padding: 0 }}
          >
            {token}
          </button>
        );
      })}
    </div>
  );
}

function line(style: Record<string, unknown>) {
  return { position: 'absolute' as const, pointerEvents: 'none' as const, ...style };
}

function surname(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[parts.length - 1] : parts[0]).slice(0, 10);
}

/* ══ Passo 3 ═══════════════════════════════════════════════════════════════ */

function Share(props: {
  teamName: string;
  formation: string;
  coach: string;
  layout: Slot[];
  slots: (string | null)[];
  byId: Map<string, PoolPlayer>;
  caption: string;
  authed: boolean;
  saved: boolean;
  onNeedAuth: () => void;
  onNote: (title: string, body?: string, tone?: 'yellow' | 'green') => void;
  onBack: () => void;
}) {
  const { teamName, formation, coach, layout, slots, byId, caption, authed, saved, onNeedAuth, onNote, onBack } = props;

  async function copy() {
    try {
      await navigator.clipboard.writeText(caption);
      onNote('Legenda copiada!', 'Marca a gente no post.', 'green');
    } catch {
      onNote('Não deu pra copiar', 'Seleciona o texto e copia na mão.');
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${teamName} — Olefoot Revela`, text: caption });
        return;
      } catch {
        /* usuário cancelou: cai no clipboard */
      }
    }
    void copy();
  }

  return (
    <div className="grid gap-8" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>
      {/* Pôster */}
      <article
        className="overflow-hidden"
        style={{ borderRadius: 'var(--radius-rev-card)', border: '2px solid rgba(255,255,255,.1)' }}
      >
        <div className="px-4 py-3" style={{ background: 'var(--color-rev-yellow)', color: '#0D0D0D' }}>
          <p className="rev-label text-[10px]">Olefoot Revela · Meu XI</p>
        </div>
        <div className="p-5">
          <p className="rev-display text-[32px] leading-none" style={{ color: 'var(--color-rev-yellow)' }}>
            {teamName || 'Meu time'}
          </p>
          <p className="rev-label mt-1.5 text-[10px]" style={{ color: 'rgba(237,235,228,.45)' }}>
            {formation} · Técnico {coach || '—'}
          </p>
          <div className="mt-4">
            <Pitch layout={layout} slots={slots} byId={byId} readOnly />
          </div>
        </div>
      </article>

      {/* Painel */}
      <div className="flex flex-col gap-4">
        <h3 className="rev-display text-[28px]">Mostra pra galera</h3>
        <p className="text-[14px] leading-relaxed" style={{ color: 'rgba(237,235,228,.55)' }}>
          Posta o teu XI e marca a Olefoot. É assim que um talento daqui chega em mais gente.
        </p>

        <a
          href="https://instagram.com/olefootgame"
          target="_blank"
          rel="noreferrer noopener"
          className="rev-focus flex items-center justify-between gap-3 p-4"
          data-on="dark"
          style={{ borderRadius: 10, background: '#111', border: '2px solid rgba(255,255,255,.08)' }}
        >
          <span>
            <span className="rev-label block text-[10px]" style={{ color: 'rgba(237,235,228,.45)' }}>
              Instagram
            </span>
            <span className="rev-display text-[19px]" style={{ color: 'var(--color-rev-yellow)' }}>
              @olefootgame
            </span>
          </span>
          <span style={{ color: 'var(--color-rev-yellow)' }}>→</span>
        </a>

        <div style={{ borderRadius: 10, background: '#111', border: '2px solid rgba(255,255,255,.08)', padding: 16 }}>
          <p className="rev-label text-[10px]" style={{ color: 'rgba(237,235,228,.45)' }}>
            Legenda pronta
          </p>
          <p className="mt-2 text-[13px] leading-relaxed" style={{ color: 'rgba(237,235,228,.7)' }}>
            {caption}
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button type="button" onClick={copy} className="rev-btn rev-focus" data-variant="yellow" data-on="dark">
            Copiar legenda
          </button>
          <button type="button" onClick={share} className="rev-btn rev-focus" data-variant="outline" data-on="dark">
            Compartilhar
          </button>
        </div>

        {saved ? (
          <p
            className="px-4 py-3 text-[13px]"
            style={{
              borderRadius: 8,
              background: 'rgba(34,197,94,.12)',
              border: '1px solid rgba(34,197,94,.4)',
              color: 'var(--color-rev-success)',
            }}
          >
            ✓ {coach}, o time “{teamName}” está salvo na tua conta. Ele te espera no game.
          </p>
        ) : authed ? null : (
          <div
            className="px-4 py-4"
            style={{ borderRadius: 8, border: '1px dashed rgba(253,225,0,.4)' }}
          >
            <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(237,235,228,.6)' }}>
              Quer que esse time te espere no game? Entra na tua conta que a gente salva.
            </p>
            <div className="mt-3 flex flex-wrap gap-2.5">
              <button type="button" onClick={onNeedAuth} className="rev-btn rev-focus" data-variant="yellow" data-on="dark">
                Entrar e salvar
              </button>
              <a href={signupUrl()} className="rev-btn rev-focus" data-variant="outline" data-on="dark">
                Criar conta
              </a>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4 pt-1">
          <button
            type="button"
            onClick={onBack}
            className="rev-label rev-focus text-[11px]"
            data-on="dark"
            style={{ color: 'rgba(237,235,228,.45)' }}
          >
            ← Editar time
          </button>
          <a
            href={GAME_URL}
            className="rev-label rev-focus text-[11px]"
            style={{ color: 'var(--color-rev-yellow)' }}
          >
            Ir pro game →
          </a>
        </div>
      </div>
    </div>
  );
}
