import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Crown, Plus, Save, Trash2, X, ZoomIn, ZoomOut, RotateCcw, Move } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  fetchAllLegacyPlayerRows,
  upsertLegacyPlayer,
  deleteLegacyPlayer,
  legacyPortraitImageUrl,
  portraitFocusStyle,
  type LegacyPlayerRow,
} from '@/supabase/legacyPlayers';
import { adminSavePlayerLink, isSplitValid } from '@/admin/playerLinking';
import {
  PlayerLinkEditor,
  DEFAULT_LINK_VALUE,
  type PlayerLinkEditorValue,
} from '@/admin/components/PlayerLinkEditor';

const POSITIONS = ['GOL', 'ZAG', 'LE', 'LD', 'VOL', 'MC', 'PE', 'PD', 'ATA'] as const;

const ATTRIBUTE_KEYS = [
  'passe', 'marcacao', 'velocidade', 'drible', 'finalizacao',
  'fisico', 'tatico', 'mentalidade', 'confianca', 'fairPlay',
] as const;
type AttrKey = typeof ATTRIBUTE_KEYS[number];

/** Atributos-de-posição sugeridos por posto. Admin pode customizar no multi-select. */
const POS_TAUGHT_DEFAULTS: Record<string, AttrKey[]> = {
  GOL: ['marcacao', 'fisico', 'mentalidade', 'confianca'],
  ZAG: ['marcacao', 'fisico', 'tatico', 'mentalidade'],
  LE: ['marcacao', 'velocidade', 'passe', 'tatico'],
  LD: ['marcacao', 'velocidade', 'passe', 'tatico'],
  VOL: ['passe', 'marcacao', 'tatico', 'fisico'],
  MC: ['passe', 'drible', 'tatico', 'mentalidade'],
  PE: ['velocidade', 'drible', 'passe', 'finalizacao'],
  PD: ['velocidade', 'drible', 'passe', 'finalizacao'],
  ATA: ['finalizacao', 'drible', 'velocidade', 'fisico'],
};

const BOOSTER_KEYS = ['morale', 'possession_pct', 'defense_pct', 'attack_pct', 'stamina_pct'] as const;
type BoosterKey = typeof BOOSTER_KEYS[number];

type DraftRow = {
  id: string;
  name: string;
  pos: string;
  attributes: Record<string, number>;
  taught_attributes: string[];
  team_booster: Record<string, number>;
  price_bro_cents: number;
  listed_on_market: boolean;
  country: string;
  age: number | null;
  rarity_label: string;
  bio: string;
  portrait_public_url: string;
  portrait_focus_x: number;
  portrait_focus_y: number;
  portrait_zoom: number;
};

function emptyDraft(): DraftRow {
  return {
    id: `LEG-${Date.now().toString(36).toUpperCase()}`,
    name: '',
    pos: 'MC',
    attributes: Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, 70])),
    taught_attributes: POS_TAUGHT_DEFAULTS.MC,
    team_booster: { morale: 3 },
    price_bro_cents: 50_000,
    listed_on_market: false,
    country: '',
    age: 30,
    rarity_label: 'Legend',
    bio: '',
    portrait_public_url: '',
    portrait_focus_x: 0.5,
    portrait_focus_y: 0,
    portrait_zoom: 1,
  };
}

function draftFromRow(r: LegacyPlayerRow): DraftRow {
  return {
    id: r.id,
    name: r.name,
    pos: r.pos,
    attributes: { ...Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, 70])), ...(r.attributes ?? {}) },
    taught_attributes: Array.isArray(r.taught_attributes) ? r.taught_attributes : [],
    team_booster: (r.team_booster ?? {}) as Record<string, number>,
    price_bro_cents: r.price_bro_cents ?? 0,
    listed_on_market: !!r.listed_on_market,
    country: r.country ?? '',
    age: r.age ?? null,
    rarity_label: r.rarity_label ?? 'Legend',
    bio: r.bio ?? '',
    portrait_public_url: r.portrait_public_url ?? '',
    portrait_focus_x: typeof r.portrait_focus_x === 'number' ? r.portrait_focus_x : 0.5,
    portrait_focus_y: typeof r.portrait_focus_y === 'number' ? r.portrait_focus_y : 0,
    portrait_zoom: typeof r.portrait_zoom === 'number' ? r.portrait_zoom : 1,
  };
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Editor de enquadramento (ponto focal). Mantém a URL como fonte única —
 * arrasta no preview do card pra mover o foco, +/- pra zoom. Mostra card (3:4)
 * e token (1:1 circular) lado a lado, exatamente como vai renderizar no jogo.
 */
function PortraitFocusEditor({
  url,
  fx,
  fy,
  zoom,
  onChange,
}: {
  url: string;
  fx: number;
  fy: number;
  zoom: number;
  onChange: (fx: number, fy: number, zoom: number) => void;
}) {
  const dragging = useRef(false);
  const cur = useRef({ fx, fy, zoom });
  cur.current = { fx, fy, zoom };
  const boxRef = useRef<HTMLDivElement>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerUp = () => {
    dragging.current = false;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = e.movementX / rect.width;
    const dy = e.movementY / rect.height;
    // Arrastar pra baixo revela o topo → foco sobe (inverso do cursor).
    onChange(clamp01(cur.current.fx - dx), clamp01(cur.current.fy - dy), cur.current.zoom);
  };

  const style = portraitFocusStyle(fx, fy, zoom);

  if (!url.trim()) {
    return (
      <p className="rounded-lg border border-dashed border-white/15 bg-black/20 px-3 py-4 text-center text-xs text-white/40">
        Cola a URL do retrato acima pra ajustar o enquadramento.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-4">
        {/* Card 3:4 — arrastável */}
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wide text-white/40">Card</p>
          <div
            ref={boxRef}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerMove={onPointerMove}
            className="relative aspect-[3/4] w-28 cursor-move overflow-hidden rounded-lg ring-2 ring-amber-400/50 touch-none"
          >
            <img src={url} alt="card" draggable={false} className="h-full w-full select-none" style={style} />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100">
              <Move className="h-5 w-5 text-white/70 drop-shadow" />
            </div>
          </div>
        </div>
        {/* Token 1:1 circular */}
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wide text-white/40">Token</p>
          <div className="relative aspect-square w-20 overflow-hidden rounded-full ring-2 ring-amber-400/50">
            <img src={url} alt="token" draggable={false} className="h-full w-full select-none" style={style} />
          </div>
        </div>
      </div>

      {/* Controles */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(fx, fy, Math.min(3, +(zoom + 0.1).toFixed(2)))}
          className="rounded border border-white/15 p-1.5 text-white/70 hover:bg-white/10"
          title="Zoom +"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onChange(fx, fy, Math.max(0.5, +(zoom - 0.1).toFixed(2)))}
          className="rounded border border-white/15 p-1.5 text-white/70 hover:bg-white/10"
          title="Zoom −"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <span className="ml-1 text-[11px] font-mono text-white/50">
          {Math.round(fx * 100)}% / {Math.round(fy * 100)}% · {zoom.toFixed(2)}×
        </span>
        <button
          type="button"
          onClick={() => onChange(0.5, 0, 1)}
          className="ml-auto flex items-center gap-1 rounded border border-white/15 px-2 py-1 text-[11px] text-white/60 hover:bg-white/10"
        >
          <RotateCcw className="h-3 w-3" /> Reset
        </button>
      </div>
      <p className="text-[10px] text-white/35">Arrasta no card pra enquadrar. O token usa o mesmo foco.</p>
    </div>
  );
}

export function AdminLegacyPanel() {
  const [rows, setRows] = useState<LegacyPlayerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<DraftRow | null>(null);

  const refresh = async () => {
    setLoading(true);
    const data = await fetchAllLegacyPlayerRows();
    setRows(data);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const listedCount = useMemo(() => rows.filter((r) => r.listed_on_market).length, [rows]);

  const [linkDraft, setLinkDraft] = useState<PlayerLinkEditorValue>(DEFAULT_LINK_VALUE);

  const save = async () => {
    if (!editing) return;
    const payload = {
      id: editing.id,
      name: editing.name.trim(),
      pos: editing.pos,
      attributes: editing.attributes,
      taught_attributes: editing.taught_attributes,
      team_booster: editing.team_booster,
      price_bro_cents: editing.price_bro_cents,
      listed_on_market: editing.listed_on_market,
      country: editing.country.trim() || null,
      age: editing.age ?? null,
      rarity_label: editing.rarity_label.trim() || null,
      bio: editing.bio.trim() || null,
      portrait_public_url: editing.portrait_public_url.trim() || null,
      portrait_focus_x: editing.portrait_focus_x,
      portrait_focus_y: editing.portrait_focus_y,
      portrait_zoom: editing.portrait_zoom,
    };
    if (!payload.name) {
      window.alert('Nome é obrigatório');
      return;
    }
    if (!isSplitValid(linkDraft.split)) {
      window.alert('Split inválido — soma deve ser 100%.');
      return;
    }
    const saved = await upsertLegacyPlayer(payload);
    if (!saved) {
      window.alert('Falha ao salvar (ver console).');
      return;
    }
    const linkRes = await adminSavePlayerLink({
      table: 'legacy_players',
      playerId: editing.id,
      beneficiaryUserId: linkDraft.beneficiaryUserId,
      split: linkDraft.split,
    });
    if (!linkRes.ok) {
      window.alert(`Player salvo, mas falha ao gravar split: ${linkRes.error ?? 'erro desconhecido'}`);
    }
    setEditing(null);
    setLinkDraft(DEFAULT_LINK_VALUE);
    refresh();
  };

  const remove = async (id: string) => {
    if (!window.confirm(`Excluir legacy ${id}?`)) return;
    const ok = await deleteLegacyPlayer(id);
    if (ok) refresh();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Crown className="h-5 w-5 text-amber-400" />
        <div className="flex-1">
          <h2 className="text-lg font-black text-white">Legacy DNA</h2>
          <p className="text-[11px] text-gray-400">
            Jogadores lendários criados por você — ensinam atributos da posição aos companheiros e aplicam um booster ao time quando titulares.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(emptyDraft())}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold uppercase text-black hover:bg-amber-400"
        >
          <Plus className="h-3.5 w-3.5" />
          Novo Legacy
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
          <p className="text-lg font-black text-white">{rows.length}</p>
          <p className="text-[10px] uppercase tracking-wider text-gray-500">Total</p>
        </div>
        <div className="rounded-xl border border-green-500/20 bg-green-500/[0.05] p-3 text-center">
          <p className="text-lg font-black text-green-400">{listedCount}</p>
          <p className="text-[10px] uppercase tracking-wider text-gray-500">Listados</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
          <p className="text-lg font-black text-white">{rows.length - listedCount}</p>
          <p className="text-[10px] uppercase tracking-wider text-gray-500">Inativos</p>
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-gray-500">Carregando…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] py-12 text-center text-sm text-gray-500">
          Nenhum legacy cadastrado. Clique em <strong className="text-amber-400">Novo Legacy</strong>.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-gray-500">
                <th className="py-2 pl-3 pr-2">Legacy</th>
                <th className="px-2 py-2 text-center">Pos</th>
                <th className="px-2 py-2">Ensina</th>
                <th className="px-2 py-2">Booster</th>
                <th className="px-2 py-2 text-right">Preço</th>
                <th className="px-2 py-2 text-center">Listado</th>
                <th className="py-2 pr-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const portrait = legacyPortraitImageUrl(r);
                return (
                  <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="py-2 pl-3 pr-2">
                      <div className="flex items-center gap-2">
                        {portrait ? (
                          <img src={portrait} alt={r.name} className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          <div className="grid h-8 w-8 place-items-center rounded-full bg-amber-500/20 text-amber-400">
                            <Crown className="h-3.5 w-3.5" />
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-semibold text-white">{r.name}</p>
                          <p className="text-[10px] text-gray-500">{r.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-white">{r.pos}</span>
                    </td>
                    <td className="px-2 py-2">
                      <span className="text-[10px] text-gray-400">{(r.taught_attributes ?? []).join(', ') || '—'}</span>
                    </td>
                    <td className="px-2 py-2">
                      <span className="text-[10px] text-gray-400">
                        {Object.entries(r.team_booster ?? {})
                          .map(([k, v]) => `${k}:+${v}`)
                          .join(' · ') || '—'}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right text-[10px] text-gray-300">
                      {(r.price_bro_cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span
                        className={cn(
                          'inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                          r.listed_on_market ? 'bg-green-500/15 text-green-400' : 'bg-white/5 text-gray-500',
                        )}
                      >
                        {r.listed_on_market ? 'Sim' : 'Não'}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditing(draftFromRow(r))}
                          className="rounded-lg bg-white/5 px-2 py-1 text-[10px] font-bold uppercase text-white hover:bg-white/10"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(r.id)}
                          className="rounded-lg bg-red-500/10 px-2 py-1 text-[10px] font-bold uppercase text-red-400 hover:bg-red-500/20"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <EditorModal
          draft={editing}
          onChange={setEditing}
          onClose={() => {
            setEditing(null);
            setLinkDraft(DEFAULT_LINK_VALUE);
          }}
          onSave={save}
          linkValue={linkDraft}
          onLinkChange={setLinkDraft}
        />
      )}
    </div>
  );
}

function EditorModal({
  draft,
  onChange,
  onClose,
  onSave,
  linkValue,
  onLinkChange,
}: {
  draft: DraftRow;
  onChange: (d: DraftRow) => void;
  onClose: () => void;
  onSave: () => void;
  linkValue: PlayerLinkEditorValue;
  onLinkChange: (v: PlayerLinkEditorValue) => void;
}) {
  const update = <K extends keyof DraftRow>(k: K, v: DraftRow[K]) => onChange({ ...draft, [k]: v });

  const toggleTaught = (attr: string) => {
    const has = draft.taught_attributes.includes(attr);
    update(
      'taught_attributes',
      has ? draft.taught_attributes.filter((a) => a !== attr) : [...draft.taught_attributes, attr],
    );
  };

  const setBooster = (key: string, val: number) => {
    const next = { ...draft.team_booster };
    if (val === 0) delete next[key];
    else next[key] = val;
    update('team_booster', next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-amber-500/30 bg-gray-950 p-5 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <Crown className="h-5 w-5 text-amber-400" />
          <h3 className="flex-1 text-base font-black text-white">
            {draft.name ? `Editar ${draft.name}` : 'Novo Legacy'}
          </h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome">
              <input
                value={draft.name}
                onChange={(e) => update('name', e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-sm text-white focus:border-amber-500 focus:outline-none"
              />
            </Field>
            <Field label="Posição">
              <select
                value={draft.pos}
                onChange={(e) => {
                  const pos = e.target.value;
                  onChange({
                    ...draft,
                    pos,
                    taught_attributes: POS_TAUGHT_DEFAULTS[pos] ?? draft.taught_attributes,
                  });
                }}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-sm text-white focus:border-amber-500 focus:outline-none"
              >
                {POSITIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="País">
              <input
                value={draft.country}
                onChange={(e) => update('country', e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-sm text-white focus:border-amber-500 focus:outline-none"
              />
            </Field>
            <Field label="Idade">
              <input
                type="number"
                value={draft.age ?? ''}
                onChange={(e) => update('age', e.target.value ? Number(e.target.value) : null)}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-sm text-white focus:border-amber-500 focus:outline-none"
              />
            </Field>
            <Field label="Raridade">
              <input
                value={draft.rarity_label}
                onChange={(e) => update('rarity_label', e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-sm text-white focus:border-amber-500 focus:outline-none"
              />
            </Field>
            <Field label="Preço (BRO cents)">
              <input
                type="number"
                value={draft.price_bro_cents}
                onChange={(e) => update('price_bro_cents', Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-sm text-white focus:border-amber-500 focus:outline-none"
              />
            </Field>
            <Field label="URL do retrato (opcional)">
              <input
                value={draft.portrait_public_url}
                onChange={(e) => update('portrait_public_url', e.target.value)}
                placeholder="https://…"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-sm text-white focus:border-amber-500 focus:outline-none"
              />
            </Field>
            <Field label="Listado no mercado">
              <button
                type="button"
                onClick={() => update('listed_on_market', !draft.listed_on_market)}
                className={cn(
                  'w-full rounded-lg px-2.5 py-1.5 text-xs font-bold uppercase',
                  draft.listed_on_market ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-gray-500',
                )}
              >
                {draft.listed_on_market ? 'Sim' : 'Não'}
              </button>
            </Field>
          </div>

          <Field label="Enquadramento do retrato">
            <PortraitFocusEditor
              url={draft.portrait_public_url}
              fx={draft.portrait_focus_x}
              fy={draft.portrait_focus_y}
              zoom={draft.portrait_zoom}
              onChange={(fx, fy, zoom) =>
                onChange({ ...draft, portrait_focus_x: fx, portrait_focus_y: fy, portrait_zoom: zoom })
              }
            />
          </Field>

          <Field label="Bio">
            <textarea
              value={draft.bio}
              onChange={(e) => update('bio', e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-sm text-white focus:border-amber-500 focus:outline-none"
            />
          </Field>

          <Field label="Atributos (0–99)">
            <div className="grid grid-cols-5 gap-2">
              {ATTRIBUTE_KEYS.map((k) => (
                <label key={k} className="flex flex-col gap-0.5">
                  <span className="text-[9px] uppercase tracking-wider text-gray-500">{k}</span>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={draft.attributes[k] ?? 0}
                    onChange={(e) =>
                      update('attributes', { ...draft.attributes, [k]: Math.max(0, Math.min(99, Number(e.target.value) || 0)) })
                    }
                    className="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                </label>
              ))}
            </div>
          </Field>

          <Field label="Atributos ensinados (aos jogadores da mesma posição)">
            <div className="flex flex-wrap gap-1.5">
              {ATTRIBUTE_KEYS.map((k) => {
                const on = draft.taught_attributes.includes(k);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => toggleTaught(k)}
                    className={cn(
                      'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors',
                      on ? 'bg-amber-500 text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10',
                    )}
                  >
                    {k}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Booster de time (ativo quando titular)">
            <div className="grid grid-cols-5 gap-2">
              {BOOSTER_KEYS.map((k) => (
                <label key={k} className="flex flex-col gap-0.5">
                  <span className="text-[9px] uppercase tracking-wider text-gray-500">{k}</span>
                  <input
                    type="number"
                    value={draft.team_booster[k] ?? 0}
                    onChange={(e) => setBooster(k, Number(e.target.value) || 0)}
                    className="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                </label>
              ))}
            </div>
          </Field>
        </div>

        <div className="mt-5 rounded-lg border border-white/10 bg-black/40 p-4">
          <PlayerLinkEditor value={linkValue} onChange={onLinkChange} />
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-bold uppercase text-white hover:bg-white/10"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSave}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold uppercase text-black hover:bg-amber-400"
          >
            <Save className="h-3.5 w-3.5" />
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</span>
      {children}
    </label>
  );
}
