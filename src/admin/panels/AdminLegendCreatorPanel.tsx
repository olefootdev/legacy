/**
 * AdminLegendCreatorPanel — Wizard de tokenização de lendas.
 *
 * Fluxo:
 *  1. Upload do legend.json (ou começar vazio)
 *  2. Ajustar atributos / coleção / preço / split por fase
 *  3. Tokenizar → POST /api/admin/legend-import → cria 3 cards + 3 lotes
 */

import { useMemo, useState } from 'react';
import {
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Coins,
  RefreshCw,
  Search,
  Upload,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react';
import {
  adminFindUserByEmail,
  adminImportLegend,
  adminUploadLegendPortrait,
  DEFAULT_SPLIT,
  isSplitValid,
  slugify,
  TIER_DEFAULTS,
  type LegendCurrency,
  type LegendImportPayload,
  type LegendImportResponse,
  type LegendPhase,
  type LegendPhasePayload,
  type LegendSplitEntry,
  type LegendTier,
} from '../legendCreatorClient';

const PHASE_LABEL: Record<LegendPhase, string> = {
  revelacao: 'Revelação',
  consolidacao: 'Consolidação',
  expansao: 'Expansão',
};

const PHASE_ORDER: LegendPhase[] = ['revelacao', 'consolidacao', 'expansao'];

const ATTR_KEYS = [
  'passe', 'marcacao', 'velocidade', 'drible', 'finalizacao',
  'fisico', 'tatico', 'mentalidade', 'confianca', 'fairPlay',
] as const;

function emptyAttrs() {
  return {
    passe: 70, marcacao: 70, velocidade: 70, drible: 70, finalizacao: 70,
    fisico: 70, tatico: 70, mentalidade: 70, confianca: 70, fairPlay: 70,
  };
}

function emptyPhase(phase: LegendPhase, tier: LegendTier): LegendPhasePayload {
  const def = TIER_DEFAULTS[tier];
  return {
    phase,
    tier,
    collectionCode: '',
    collectionTitle: '',
    currency: 'USDT',
    priceUnitCents: def.usdtCents,
    initialSupply: def.supply,
    paymentSplit: [...DEFAULT_SPLIT],
    entity: {
      name: '',
      pos: 'ZAG',
      archetype: 'lenda',
      zone: 'def',
      behavior: 'defensivo',
      country: 'Brasil',
      strongFoot: 'direito',
      creatorType: 'lenda',
      age: 27,
      tagline: '',
      attrs: emptyAttrs(),
      mintOverall: 70,
      evolutionRate: 1.2,
      rarity: 'ultra_raro',
      isLegacy: true,
      agentProfileEnabled: true,
      legacyTaughtAttributes: [],
      legacyTeamBooster: {},
    },
  };
}

function emptyPayload(slug = ''): LegendImportPayload {
  return {
    collectionId: slug ? `mem-${slug}-2026` : '',
    collectionKind: 'memorable',
    phases: [
      emptyPhase('revelacao', 1),
      emptyPhase('consolidacao', 2),
      emptyPhase('expansao', 3),
    ],
  };
}

interface Props {
  defaultSlug?: string;
}

export function AdminLegendCreatorPanel({ defaultSlug = '' }: Props) {
  const [slug, setSlug] = useState(defaultSlug);
  const [payload, setPayload] = useState<LegendImportPayload>(() => emptyPayload(defaultSlug));
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<LegendImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<LegendPhase | null>('revelacao');
  /** URLs de portrait por fase (após upload bem-sucedido). */
  const [portraits, setPortraits] = useState<Record<LegendPhase, string | null>>({
    revelacao: null,
    consolidacao: null,
    expansao: null,
  });

  function handleFileUpload(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as LegendImportPayload;
        if (!parsed.collectionId || !Array.isArray(parsed.phases)) {
          throw new Error('JSON sem collectionId ou phases');
        }
        setPayload(parsed);
        // Auto-detect slug do nome do arquivo
        const fname = file.name.replace(/\.json$/, '');
        if (!slug && fname && /^[a-z0-9-]+$/.test(fname)) setSlug(fname);
        const baseName = parsed.phases[0]?.entity?.name;
        if (!slug && baseName) setSlug(slugify(baseName));
        setError(null);
      } catch (e) {
        setError(`Arquivo inválido: ${e instanceof Error ? e.message : String(e)}`);
      }
    };
    reader.readAsText(file);
  }

  function updatePhase(phase: LegendPhase, patch: Partial<LegendPhasePayload>) {
    setPayload((prev) => ({
      ...prev,
      phases: prev.phases.map((p) => (p.phase === phase ? { ...p, ...patch } : p)),
    }));
  }

  function updatePhaseEntity(phase: LegendPhase, patch: Partial<LegendPhasePayload['entity']>) {
    setPayload((prev) => ({
      ...prev,
      phases: prev.phases.map((p) =>
        p.phase === phase ? { ...p, entity: { ...p.entity, ...patch } } : p,
      ),
    }));
  }

  function updatePhaseAttr(phase: LegendPhase, key: (typeof ATTR_KEYS)[number], value: number) {
    setPayload((prev) => ({
      ...prev,
      phases: prev.phases.map((p) =>
        p.phase === phase
          ? { ...p, entity: { ...p.entity, attrs: { ...p.entity.attrs, [key]: value } } }
          : p,
      ),
    }));
  }

  function applyTierDefaults(phase: LegendPhase, tier: LegendTier) {
    const def = TIER_DEFAULTS[tier];
    updatePhase(phase, {
      tier,
      initialSupply: def.supply,
      priceUnitCents: payload.phases.find((p) => p.phase === phase)?.currency === 'USDT'
        ? def.usdtCents
        : def.oleUnits,
    });
  }

  async function tokenize() {
    setError(null);
    setResult(null);
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
      setError('Slug inválido (use kebab-case: ex. marcelo-goncalves)');
      return;
    }
    if (!payload.collectionId) {
      setError('collectionId vazio. Use ex.: mem-<slug>-2026');
      return;
    }
    for (const ph of payload.phases) {
      if (!ph.entity.name.trim()) {
        setError(`Fase ${PHASE_LABEL[ph.phase]}: nome vazio`);
        return;
      }
      if (!ph.collectionCode?.trim()) {
        setError(`Fase ${PHASE_LABEL[ph.phase]}: collection_code obrigatório (ex. BR-95)`);
        return;
      }
      if (!isSplitValid(ph.paymentSplit ?? [])) {
        setError(`Fase ${PHASE_LABEL[ph.phase]}: split inválido (soma 100, max 5 facilitadores)`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await adminImportLegend(slug, payload);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = useMemo(
    () => !submitting && slug.length > 0 && payload.phases.every((p) => p.entity.name.trim().length > 0),
    [submitting, slug, payload.phases],
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Legend Creator</h2>
          <p className="text-sm text-white/60">
            Tokeniza lendas reais: pesquisa (skill) → 3 fases → lotes Panini → split 4-way.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer rounded-md border-2 border-white bg-neon-yellow/10 px-3 py-2 text-sm font-semibold text-neon-yellow hover:bg-neon-yellow/20">
          <Upload size={16} className="text-neon-yellow" />
          Upload legend.json
          <input
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileUpload(f);
              e.target.value = '';
            }}
          />
        </label>
      </header>

      {/* Identidade */}
      <section className="rounded-lg border-2 border-white bg-deep-black/60 p-4 space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-white">Identidade</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <LabeledInput
            label="Slug (kebab-case)"
            placeholder="marcelo-goncalves"
            value={slug}
            onChange={setSlug}
          />
          <LabeledInput
            label="Collection ID"
            placeholder="mem-marcelo-goncalves-2026"
            value={payload.collectionId}
            onChange={(v) => setPayload((p) => ({ ...p, collectionId: v }))}
          />
        </div>
      </section>

      {/* Fases */}
      <section className="space-y-3">
        {payload.phases.map((ph) => (
          <PhaseEditor
            key={ph.phase}
            phase={ph}
            slug={slug}
            portraitUrl={portraits[ph.phase]}
            onPortraitUploaded={(url) =>
              setPortraits((prev) => ({ ...prev, [ph.phase]: url }))
            }
            expanded={expanded === ph.phase}
            onToggle={() => setExpanded(expanded === ph.phase ? null : ph.phase)}
            onChange={(patch) => updatePhase(ph.phase, patch)}
            onChangeEntity={(patch) => updatePhaseEntity(ph.phase, patch)}
            onChangeAttr={(k, v) => updatePhaseAttr(ph.phase, k, v)}
            onApplyTier={(t) => applyTierDefaults(ph.phase, t)}
          />
        ))}
      </section>

      {/* CTA */}
      <section className="sticky bottom-4 z-10 rounded-lg border-2 border-white bg-deep-black/95 p-4 backdrop-blur">
        {error && (
          <div className="mb-3 flex items-start gap-2 rounded border-2 border-white bg-red-400/15 p-3 text-sm text-red-200">
            <XCircle size={16} className="mt-0.5 shrink-0 text-neon-yellow" />
            <span>{error}</span>
          </div>
        )}
        {result && (
          <div className="mb-3 rounded border-2 border-white bg-emerald-400/15 p-3 text-sm text-emerald-100">
            <div className="flex items-center gap-2 font-semibold">
              <Check size={16} className="text-neon-yellow" />
              Importado: {result.inserted.length} cards · {result.lots.length} lotes
            </div>
            <ul className="mt-2 space-y-1 text-xs">
              {result.inserted.map((row) => (
                <li key={row.id}>
                  · <b>{row.id}</b> — tier {row.tier} · {row.collection_code} · {row.card_supply} ×{' '}
                  {row.price_unit_cents}¢ {row.currency}
                </li>
              ))}
            </ul>
          </div>
        )}
        <button
          type="button"
          onClick={tokenize}
          disabled={!canSubmit}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-neon-yellow px-4 py-3 font-bold text-deep-black transition hover:bg-neon-yellow/90 disabled:opacity-40"
        >
          <Coins size={20} className="text-deep-black" />
          {submitting ? 'Tokenizando...' : 'Tokenizar (cria 3 cards + 3 lotes)'}
        </button>
      </section>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function LabeledInput({
  label, value, onChange, placeholder, type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-semibold uppercase tracking-wider text-white/60">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border-2 border-white/70 bg-deep-black px-2 py-1.5 text-sm text-white placeholder-white/40 focus:border-neon-yellow focus:outline-none"
      />
    </label>
  );
}

function LabeledNumber({
  label, value, onChange, min, max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-semibold uppercase tracking-wider text-white/60">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) ? n : 0);
        }}
        className="rounded border-2 border-white/70 bg-deep-black px-2 py-1.5 text-sm text-white focus:border-neon-yellow focus:outline-none"
      />
    </label>
  );
}

function PhaseEditor({
  phase, slug, portraitUrl, onPortraitUploaded,
  expanded, onToggle, onChange, onChangeEntity, onChangeAttr, onApplyTier,
}: {
  phase: LegendPhasePayload;
  slug: string;
  portraitUrl: string | null;
  onPortraitUploaded: (url: string | null) => void;
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<LegendPhasePayload>) => void;
  onChangeEntity: (patch: Partial<LegendPhasePayload['entity']>) => void;
  onChangeAttr: (k: (typeof ATTR_KEYS)[number], v: number) => void;
  onApplyTier: (t: LegendTier) => void;
}) {
  const def = phase.tier ? TIER_DEFAULTS[phase.tier] : null;
  return (
    <div className="rounded-lg border-2 border-white bg-deep-black/40 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-white/5"
      >
        <div className="flex items-center gap-3">
          <span className="rounded border-2 border-white bg-neon-yellow/20 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-neon-yellow">
            {PHASE_LABEL[phase.phase]}
          </span>
          <span className="text-sm text-white">
            {phase.entity.name || <em className="text-white/50">(sem nome)</em>}
          </span>
          {phase.collectionCode && (
            <span className="text-xs text-white/70">· {phase.collectionCode}</span>
          )}
          {phase.tier && (
            <span className="text-xs text-white/70">
              · Tier {phase.tier} · {phase.initialSupply}×{phase.priceUnitCents}¢ {phase.currency}
            </span>
          )}
        </div>
        {expanded
          ? <ChevronDown size={18} className="text-neon-yellow" />
          : <ChevronRight size={18} className="text-neon-yellow" />}
      </button>
      {expanded && (
        <div className="border-t-2 border-white p-4 space-y-4">
          {/* Identidade da fase */}
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold uppercase tracking-wider text-white/60">
              Identidade do card
            </legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <LabeledInput
                label="Nome do jogador"
                value={phase.entity.name}
                onChange={(v) => onChangeEntity({ name: v })}
                placeholder="Ex: Marcelo Gonçalves Costa Lopes"
              />
              <LabeledInput
                label="Posição"
                value={phase.entity.pos}
                onChange={(v) => onChangeEntity({ pos: v.toUpperCase() })}
                placeholder="ZAG"
              />
              <LabeledNumber
                label="Idade na fase"
                value={phase.entity.age ?? 0}
                onChange={(v) => onChangeEntity({ age: v })}
              />
              <LabeledInput
                label="Pé bom"
                value={phase.entity.strongFoot ?? ''}
                onChange={(v) => onChangeEntity({ strongFoot: v })}
                placeholder="direito"
              />
            </div>
            <LabeledInput
              label="Bio (1-2 linhas)"
              value={phase.entity.bio ?? ''}
              onChange={(v) => onChangeEntity({ bio: v })}
              placeholder="Frase curta emocional."
            />
            <TaglineField
              value={phase.entity.tagline ?? ''}
              onChange={(v) => onChangeEntity({ tagline: v })}
            />
            <LabeledInput
              label="Narrative title"
              value={phase.narrativeTitle ?? ''}
              onChange={(v) => onChange({ narrativeTitle: v })}
              placeholder="O pilar da defesa que matou o jejum"
            />
            <PortraitUploader
              slug={slug}
              phase={phase.phase}
              currentUrl={portraitUrl}
              onUploaded={onPortraitUploaded}
            />
            <LabeledInput
              label="Main club"
              value={phase.mainClub ?? ''}
              onChange={(v) => onChange({ mainClub: v })}
              placeholder="Botafogo (RJ)"
            />
          </fieldset>

          {/* Atributos */}
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold uppercase tracking-wider text-white/60">
              Atributos (0-99) · OVR ≈ {Math.round(
                ATTR_KEYS.reduce((s, k) => s + (phase.entity.attrs[k] ?? 0), 0) / 10,
              )}
            </legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {ATTR_KEYS.map((k) => (
                <LabeledNumber
                  key={k}
                  label={k}
                  value={phase.entity.attrs[k] ?? 0}
                  onChange={(v) => onChangeAttr(k, Math.max(0, Math.min(99, v)))}
                  min={0}
                  max={99}
                />
              ))}
            </div>
            <LabeledNumber
              label="Mint OVR (cap natural = mint + 15)"
              value={phase.entity.mintOverall ?? 0}
              onChange={(v) => onChangeEntity({ mintOverall: v })}
              min={35}
              max={99}
            />
          </fieldset>

          {/* Coleção & preço */}
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold uppercase tracking-wider text-white/60">
              Coleção & preço
            </legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <LabeledInput
                label="Collection code (sigla, ex: BR-95)"
                value={phase.collectionCode ?? ''}
                onChange={(v) => onChange({ collectionCode: v.toUpperCase().trim() })}
                placeholder="BR-95"
              />
              <LabeledInput
                label="Collection title (texto)"
                value={phase.collectionTitle ?? ''}
                onChange={(v) => onChange({ collectionTitle: v })}
                placeholder="Campeão Brasileiro 1995"
              />
            </div>
            <div className="flex gap-2">
              {[1, 2, 3].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onApplyTier(t as LegendTier)}
                  className={`flex-1 rounded border-2 px-3 py-1.5 text-xs uppercase ${
                    phase.tier === t
                      ? 'border-neon-yellow bg-neon-yellow/20 text-neon-yellow font-bold'
                      : 'border-white text-white hover:bg-white/10'
                  }`}
                >
                  Tier {t} · {TIER_DEFAULTS[t as LegendTier].supply.toLocaleString()} cópias · $
                  {(TIER_DEFAULTS[t as LegendTier].usdtCents / 100).toFixed(2)}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-semibold uppercase tracking-wider text-white/60">Currency</span>
                <select
                  value={phase.currency ?? 'USDT'}
                  onChange={(e) => {
                    const c = e.target.value as LegendCurrency;
                    const tier = phase.tier ?? 1;
                    const newPrice = c === 'USDT' ? TIER_DEFAULTS[tier].usdtCents : TIER_DEFAULTS[tier].oleUnits;
                    onChange({ currency: c, priceUnitCents: newPrice });
                  }}
                  className="rounded border-2 border-white/70 bg-deep-black px-2 py-1.5 text-sm text-white focus:border-neon-yellow focus:outline-none"
                >
                  <option value="USDT">USDT (cents)</option>
                  <option value="OLEFOOT">OLEFOOT (unidades)</option>
                </select>
              </label>
              <LabeledNumber
                label="Preço unitário (cents)"
                value={phase.priceUnitCents ?? 0}
                onChange={(v) => onChange({ priceUnitCents: v })}
              />
              <LabeledNumber
                label="Supply inicial (lote 1)"
                value={phase.initialSupply ?? 0}
                onChange={(v) => onChange({ initialSupply: v })}
              />
            </div>
            {def && (
              <p className="text-[11px] text-white/40">
                Default tier {phase.tier}: {def.supply.toLocaleString()} cópias · ${(def.usdtCents / 100).toFixed(2)} ·
                lotes seguintes 50% supply +25% preço (automático)
              </p>
            )}
          </fieldset>

          {/* Split */}
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold uppercase tracking-wider text-white/60">
              Split de pagamento (soma 100, max 5 facilitadores)
            </legend>
            <SplitEditor
              split={phase.paymentSplit ?? []}
              onChange={(s) => onChange({ paymentSplit: s })}
            />
            <LabeledInput
              label="Beneficiary user id (uuid do atleta)"
              value={phase.beneficiaryUserId ?? ''}
              onChange={(v) => onChange({ beneficiaryUserId: v || undefined })}
              placeholder="(opcional) — uuid de auth.users"
            />
          </fieldset>
        </div>
      )}
    </div>
  );
}

function TaglineField({
  value, onChange, maxLen = 150,
}: {
  value: string;
  onChange: (v: string) => void;
  maxLen?: number;
}) {
  const len = value.length;
  const tone =
    len === 0 ? 'text-white/40'
    : len > maxLen ? 'text-red-300'
    : len > maxLen - 20 ? 'text-amber-300'
    : 'text-emerald-300';
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-semibold uppercase tracking-wider text-white/60">
        Tagline (mini-texto de apoio · até {maxLen} chars)
      </span>
      <textarea
        value={value}
        maxLength={200}
        rows={2}
        placeholder="Ex.: Pilar da linha de três que matou um jejum de 27 anos no Botafogo."
        onChange={(e) => onChange(e.target.value)}
        className="rounded border-2 border-white/70 bg-deep-black px-2 py-1.5 text-sm text-white placeholder-white/40 focus:border-neon-yellow focus:outline-none resize-none"
      />
      <span className={`self-end text-[10px] tabular-nums ${tone}`}>
        {len} / {maxLen}
      </span>
    </label>
  );
}

function PortraitUploader({
  slug, phase, currentUrl, onUploaded,
}: {
  slug: string;
  phase: LegendPhase;
  currentUrl: string | null;
  onUploaded: (url: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const legacyPlayerId = slug ? `legacy-${slug}-${phase}` : null;

  async function handleFile(file: File) {
    if (!legacyPlayerId) {
      setError('Defina o Slug antes de subir a imagem.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Imagem maior que 5MB.');
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const res = await adminUploadLegendPortrait(legacyPlayerId, file);
      onUploaded(res.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-end gap-3">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded border-2 border-white bg-deep-black flex items-center justify-center">
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${currentUrl}?v=${Date.now()}`}
            alt="portrait"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-[10px] uppercase tracking-wider text-white/40">sem foto</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 text-xs">
        <span className="font-semibold uppercase tracking-wider text-white/60">
          Imagem do card
        </span>
        <label
          className={`inline-flex items-center justify-center gap-2 cursor-pointer rounded border-2 border-white bg-neon-yellow/10 px-3 py-2 text-center font-semibold text-neon-yellow hover:bg-neon-yellow/20 ${
            uploading || !legacyPlayerId ? 'pointer-events-none opacity-40' : ''
          }`}
        >
          {uploading ? (
            <>
              <RefreshCw size={14} className="text-neon-yellow animate-spin" />
              Enviando...
            </>
          ) : !legacyPlayerId ? (
            <span className="text-white/50">(defina o slug primeiro)</span>
          ) : currentUrl ? (
            <>
              <RefreshCw size={14} className="text-neon-yellow" />
              Trocar imagem
            </>
          ) : (
            <>
              <Camera size={14} className="text-neon-yellow" />
              Subir imagem (jpeg/png/webp, ≤ 5MB)
            </>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={uploading || !legacyPlayerId}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = '';
            }}
          />
        </label>
        {error && (
          <span className="inline-flex items-center gap-1 text-red-200">
            <XCircle size={12} className="text-neon-yellow" />
            {error}
          </span>
        )}
        {currentUrl && !error && (
          <span className="truncate text-[10px] text-white/50" title={currentUrl}>
            {currentUrl.replace(/.*\/legacy-player-portraits\//, '')}
          </span>
        )}
      </div>
    </div>
  );
}

function SplitEditor({
  split, onChange,
}: {
  split: LegendSplitEntry[];
  onChange: (s: LegendSplitEntry[]) => void;
}) {
  const [emailQuery, setEmailQuery] = useState('');
  const [emailLookup, setEmailLookup] = useState<string | null>(null);
  const total = split.reduce((s, e) => s + (Number.isFinite(e.percent) ? e.percent : 0), 0);
  const facilitatorCount = split.filter((e) => e.kind === 'facilitator').length;

  function updateEntry(index: number, patch: Partial<LegendSplitEntry>) {
    onChange(split.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }
  function removeEntry(index: number) {
    onChange(split.filter((_, i) => i !== index));
  }
  function addFacilitator() {
    if (facilitatorCount >= 5) {
      setEmailLookup('Máximo de 5 facilitadores atingido.');
      return;
    }
    onChange([
      ...split,
      { kind: 'facilitator', user_id: null, label: 'Facilitador', percent: 0 },
    ]);
  }

  async function lookupEmail(email: string, targetIndex: number) {
    if (!email.includes('@')) {
      setEmailLookup('Email inválido.');
      return;
    }
    setEmailLookup('Buscando...');
    try {
      const res = await adminFindUserByEmail(email);
      if (res.found && res.id) {
        updateEntry(targetIndex, { user_id: res.id, label: email });
        setEmailLookup(`✓ Encontrado: ${res.email} (${res.id.slice(0, 8)}…)`);
      } else {
        setEmailLookup(`✗ Não cadastrado: ${email}`);
      }
    } catch (e) {
      setEmailLookup(`✗ Erro: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <div className="space-y-2">
      {split.map((e, i) => (
        <div key={i} className="flex flex-wrap items-end gap-2 rounded border-2 border-white bg-white/[0.04] p-2">
          <div className="flex flex-col gap-1 text-xs">
            <span className="font-semibold uppercase tracking-wider text-white/60">Kind</span>
            <span className="rounded border-2 border-white/40 bg-white/10 px-2 py-1 text-sm font-semibold text-white">{e.kind}</span>
          </div>
          <LabeledInput
            label="Label"
            value={e.label ?? ''}
            onChange={(v) => updateEntry(i, { label: v })}
          />
          <LabeledNumber
            label="%"
            value={e.percent}
            onChange={(v) => updateEntry(i, { percent: Math.max(0, Math.min(100, v)) })}
            min={0}
            max={100}
          />
          {(e.kind === 'player' || e.kind === 'facilitator') && (
            <div className="flex flex-col gap-1 text-xs">
              <span className="font-semibold uppercase tracking-wider text-white/60">User</span>
              <div className="flex items-center gap-1">
                <input
                  type="email"
                  placeholder="email@…"
                  value={emailQuery}
                  onChange={(ev) => setEmailQuery(ev.target.value)}
                  className="w-40 rounded border-2 border-white/70 bg-deep-black px-2 py-1 text-xs text-white placeholder-white/40 focus:border-neon-yellow focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => lookupEmail(emailQuery, i)}
                  className="inline-flex items-center justify-center rounded border-2 border-white px-2 py-1 text-neon-yellow hover:bg-neon-yellow/10"
                  title="Buscar usuário"
                >
                  <Search size={14} />
                </button>
              </div>
              {e.user_id && (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-200">
                  <Check size={10} className="text-neon-yellow" />
                  {e.user_id.slice(0, 8)}…
                </span>
              )}
            </div>
          )}
          {e.kind === 'facilitator' && (
            <button
              type="button"
              onClick={() => removeEntry(i)}
              className="self-end inline-flex items-center justify-center rounded border-2 border-white px-2 py-1 text-neon-yellow hover:bg-red-400/15"
              title="Remover facilitador"
            >
              <X size={14} />
            </button>
          )}
        </div>
      ))}
      <div className="flex items-center justify-between gap-2 text-xs">
        <button
          type="button"
          onClick={addFacilitator}
          disabled={facilitatorCount >= 5}
          className="inline-flex items-center gap-2 rounded border-2 border-white px-3 py-1 font-semibold text-neon-yellow hover:bg-neon-yellow/10 disabled:opacity-40"
        >
          <UserPlus size={14} className="text-neon-yellow" />
          Facilitador ({facilitatorCount}/5)
        </button>
        <span
          className={`inline-flex items-center gap-1 font-semibold ${
            total === 100 ? 'text-emerald-200' : 'text-red-200'
          }`}
        >
          Total: {total.toFixed(1)}%
          {total === 100 ? (
            <Check size={12} className="text-neon-yellow" />
          ) : (
            <XCircle size={12} className="text-neon-yellow" />
          )}
        </span>
      </div>
      {emailLookup && <p className="text-[11px] text-white/60">{emailLookup}</p>}
    </div>
  );
}
