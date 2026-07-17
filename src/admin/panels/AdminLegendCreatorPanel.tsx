/**
 * AdminLegendCreatorPanel — Wizard de tokenização de lendas.
 *
 * Fluxo:
 *  1. Upload do legend.json (ou começar vazio)
 *  2. Ajustar atributos / coleção / preço / split por fase
 *  3. Tokenizar → POST /api/admin/legend-import → cria 3 cards + 3 lotes
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Coins,
  Database,
  Link2,
  RefreshCw,
  Save,
  Search,
  Upload,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react';
import {
  adminExportLegend,
  adminFindUserByEmail,
  adminGenerateAccessLink,
  adminSaveLegendLinks,
  adminImportLegend,
  adminSetLegacyPortrait,
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
  type PortraitFocus,
} from '../legendCreatorClient';
import { uploadImageToPinataViaServer } from '@/media/pinataUploadClient';
import { portraitFocusStyle } from '@/supabase/legacyPlayers';
import { PortraitFocusEditor } from '@/admin/components/PortraitFocusEditor';
import { GACHA_POSITIONS, positionLabelPt } from '@/entities/positionLabels';
import { calibrateLegendAttrs, weightedOverall, keyAttrsForPosition } from '@/admin/legendAttrCalibration';

const PHASE_LABEL: Record<LegendPhase, string> = {
  revelacao: 'Revelação',
  consolidacao: 'Consolidação',
  expansao: 'Expansão',
};

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
  const [showPreview, setShowPreview] = useState(false);
  const [savingLinks, setSavingLinks] = useState(false);
  const [saveLinksMsg, setSaveLinksMsg] = useState<string | null>(null);
  const [result, setResult] = useState<LegendImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<LegendPhase | null>('revelacao');
  /** URLs de portrait por fase (após upload bem-sucedido). */
  const [portraits, setPortraits] = useState<Record<LegendPhase, string | null>>({
    revelacao: null,
    consolidacao: null,
    expansao: null,
  });
  /** Enquadramento (ponto focal) por fase, carregado do banco. */
  const [portraitFocus, setPortraitFocus] = useState<Record<LegendPhase, PortraitFocus>>({
    revelacao: { x: 0.5, y: 0, zoom: 1 },
    consolidacao: { x: 0.5, y: 0, zoom: 1 },
    expansao: { x: 0.5, y: 0, zoom: 1 },
  });
  /** Split de pagamento ÚNICO da lenda (aplicado a todas as fases no envio). */
  const [sharedSplit, setSharedSplit] = useState<LegendSplitEntry[]>(() => [...DEFAULT_SPLIT]);
  /** Beneficiário (uuid do atleta) ÚNICO da lenda. */
  const [sharedBeneficiary, setSharedBeneficiary] = useState<string>('');
  /** True quando o payload veio do banco (modo edição) — muda CTA pra "Salvar". */
  const [isEditing, setIsEditing] = useState(false);
  const [loadingFromDb, setLoadingFromDb] = useState(false);
  const [loadSlugInput, setLoadSlugInput] = useState('');

  async function handleLoadFromDb() {
    const trimmed = loadSlugInput.trim();
    if (!trimmed || !/^[a-z0-9-]+$/.test(trimmed)) {
      setError('Slug inválido pra carregar (use kebab-case)');
      return;
    }
    setError(null);
    setResult(null);
    setLoadingFromDb(true);
    try {
      const res = await adminExportLegend(trimmed);
      setSlug(res.slug);
      setPayload(res.payload);
      setPortraits({
        revelacao: res.portraits.revelacao ?? null,
        consolidacao: res.portraits.consolidacao ?? null,
        expansao: res.portraits.expansao ?? null,
      });
      const dfFocus = { x: 0.5, y: 0, zoom: 1 };
      setPortraitFocus({
        revelacao: res.portraitFocus?.revelacao ?? dfFocus,
        consolidacao: res.portraitFocus?.consolidacao ?? dfFocus,
        expansao: res.portraitFocus?.expansao ?? dfFocus,
      });
      // Split e beneficiário são únicos: pega os da 1ª fase (todas iguais).
      const loadedSplit = res.payload.phases.find((p) => (p.paymentSplit?.length ?? 0) > 0)?.paymentSplit;
      setSharedSplit(loadedSplit && loadedSplit.length > 0 ? loadedSplit : [...DEFAULT_SPLIT]);
      setSharedBeneficiary(res.payload.phases.find((p) => p.beneficiaryUserId)?.beneficiaryUserId ?? '');
      setIsEditing(true);
    } catch (e) {
      setError(`Falha ao carregar: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoadingFromDb(false);
    }
  }

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
        setIsEditing(false); // upload de JSON = modo criação nova (mesmo que upsert)
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


  async function tokenize(): Promise<boolean> {
    setError(null);
    setResult(null);
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
      setError('Slug inválido (use kebab-case: ex. marcelo-goncalves)');
      return false;
    }
    if (!payload.collectionId) {
      setError('collectionId vazio. Use ex.: mem-<slug>-2026');
      return false;
    }
    for (const ph of payload.phases) {
      if (!ph.entity.name.trim()) {
        setError(`Fase ${PHASE_LABEL[ph.phase]}: nome vazio`);
        return false;
      }
      if (!ph.collectionCode?.trim()) {
        setError(`Fase ${PHASE_LABEL[ph.phase]}: collection_code obrigatório (ex. BR-95)`);
        return false;
      }
    }
    // Split é ÚNICO pra lenda inteira — valida uma vez e aplica em todas as fases.
    if (!isSplitValid(sharedSplit)) {
      setError('Split de pagamento inválido (soma deve ser 100%, máx 5 facilitadores)');
      return false;
    }
    setSubmitting(true);
    try {
      // O beneficiário (beneficiary_user_id, que o playervip filtra) DEVE ser o
      // mesmo jogador vinculado no split. Se o campo dedicado estiver vazio, puxa
      // do slot player — senão o card não aparece pro atleta (bug do Marcelo).
      const playerUid = sharedSplit.find((e) => e.kind === 'player' && e.user_id)?.user_id ?? null;
      const beneficiary = sharedBeneficiary.trim() || playerUid || undefined;
      const payloadToSend: LegendImportPayload = {
        ...payload,
        phases: payload.phases.map((ph) => ({
          ...ph,
          paymentSplit: sharedSplit,
          beneficiaryUserId: beneficiary,
        })),
      };
      const res = await adminImportLegend(slug, payloadToSend);
      // Persiste os retratos (colados/enviados) agora que os cards EXISTEM. O
      // import cria o card sem foto — salvar retrato é UPDATE por id e falha em
      // silêncio se o card não existir ainda (era o bug: colar antes de tokenizar
      // não salvava nada). Best-effort: não derruba o tokenize.
      for (const ph of payload.phases) {
        const url = portraits[ph.phase];
        if (!url) continue;
        try {
          await adminSetLegacyPortrait(`legacy-${slug}-${ph.phase}`, url, undefined, portraitFocus[ph.phase]);
        } catch (err) {
          console.warn('[legend] retrato não salvo:', ph.phase, err);
        }
      }
      setResult(res);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  /** Salva SÓ o vínculo (split + beneficiário) nos cards já criados. */
  async function saveLinks() {
    setSaveLinksMsg(null);
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
      setSaveLinksMsg('Slug inválido.');
      return;
    }
    setSavingLinks(true);
    try {
      const res = await adminSaveLegendLinks(slug, sharedSplit, sharedBeneficiary.trim() || undefined);
      setSaveLinksMsg(`✓ vínculo salvo em ${res.updated} card(s)${res.beneficiary ? '' : ' — sem beneficiário'}`);
    } catch (e) {
      setSaveLinksMsg(`✗ ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSavingLinks(false);
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
        <div className="flex flex-wrap items-end gap-2">
          {/* Carregar do banco (edição) */}
          <div className="flex items-end gap-1">
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-semibold uppercase tracking-wider text-white/60">
                Carregar slug do banco
              </span>
              <input
                type="text"
                placeholder="marcelo-goncalves"
                value={loadSlugInput}
                onChange={(e) => setLoadSlugInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleLoadFromDb();
                }}
                className="w-44 rounded border border-white/25 bg-deep-black px-2 py-1.5 text-sm text-white placeholder-white/40 focus:border-neon-yellow focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => void handleLoadFromDb()}
              disabled={loadingFromDb || !loadSlugInput.trim()}
              className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-neon-yellow/10 px-3 py-1.5 text-sm font-semibold text-neon-yellow hover:bg-neon-yellow/20 disabled:opacity-40"
            >
              {loadingFromDb ? (
                <RefreshCw size={14} className="text-neon-yellow animate-spin" />
              ) : (
                <Database size={14} className="text-neon-yellow" />
              )}
              Carregar
            </button>
          </div>

          <label className="inline-flex items-center gap-2 cursor-pointer rounded-md border border-white/20 bg-neon-yellow/10 px-3 py-2 text-sm font-semibold text-neon-yellow hover:bg-neon-yellow/20">
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
        </div>
      </header>

      {isEditing && (
        <div className="flex items-center gap-2 rounded border border-neon-yellow/40 bg-neon-yellow/10 p-3 text-sm text-neon-yellow">
          <Database size={16} className="text-neon-yellow" />
          <span>
            Editando <b>{slug}</b> do banco. As alterações serão salvas como UPSERT no card e no
            lote 1 inicial. <span className="text-white/70">Lotes em andamento (≥ 2) não são afetados.</span>
          </span>
        </div>
      )}

      {/* Identidade */}
      <section className="rounded-lg border border-white/20 bg-deep-black/60 p-4 space-y-3">
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

      {/* Split de pagamento — ÚNICO pra lenda inteira (vale pras 3 coleções) */}
      <section className="rounded-lg border border-amber-400/30 bg-amber-500/[0.04] p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-200">
            Split de pagamento (vale pra todas as coleções)
          </h3>
          <p className="text-[11px] text-white/45">
            Preenche uma vez — aplica nas 3 fases no envio. Soma 100%, até 5 facilitadores.
          </p>
        </div>
        <SplitEditor split={sharedSplit} onChange={setSharedSplit} />
        <LabeledInput
          label="Beneficiary user id (uuid do atleta — opcional; sai do split se vazio)"
          value={sharedBeneficiary}
          onChange={setSharedBeneficiary}
          placeholder="uuid de auth.users (vale pras 3 fases)"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={saveLinks}
            disabled={savingLinks || !slug}
            className="inline-flex items-center gap-2 rounded border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-40"
            title="Grava só o vínculo (split + beneficiário) nos cards já criados"
          >
            <Save size={13} />
            {savingLinks ? 'Salvando vínculo…' : 'Salvar vínculo'}
          </button>
          {saveLinksMsg && <span className="text-[11px] text-white/60">{saveLinksMsg}</span>}
        </div>
        <p className="text-[10px] text-white/35">
          Salva só o split/beneficiário nos cards já importados — sem re-tokenizar.
          Ao carregar o slug depois, os e-mails voltam preenchidos.
        </p>
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
            portraitFocus={portraitFocus[ph.phase]}
            onPortraitFocusChange={(f) =>
              setPortraitFocus((prev) => ({ ...prev, [ph.phase]: f }))
            }
            expanded={expanded === ph.phase}
            onToggle={() => setExpanded(expanded === ph.phase ? null : ph.phase)}
            onChange={(patch) => updatePhase(ph.phase, patch)}
            onChangeEntity={(patch) => updatePhaseEntity(ph.phase, patch)}
            onChangeAttr={(k, v) => updatePhaseAttr(ph.phase, k, v)}
          />
        ))}
      </section>

      {/* CTA */}
      <section className="sticky bottom-4 z-10 rounded-lg border border-white/20 bg-deep-black/95 p-4 backdrop-blur">
        {error && (
          <div className="mb-3 flex items-start gap-2 rounded border border-white/20 bg-red-400/15 p-3 text-sm text-red-200">
            <XCircle size={16} className="mt-0.5 shrink-0 text-neon-yellow" />
            <span>{error}</span>
          </div>
        )}
        {result && (
          <div className="mb-3 rounded border border-white/20 bg-emerald-400/15 p-3 text-sm text-emerald-100">
            <div className="flex items-center gap-2 font-semibold">
              <Check size={16} className="text-neon-yellow" />
              Importado: {result.inserted.length} cards · {result.lots.length} lotes
            </div>
            <ul className="mt-2 space-y-1 text-xs">
              {result.inserted.map((row) => (
                <li key={row.id}>
                  · <b>{row.id}</b> — tier {row.tier} · {row.collection_code} · {row.card_supply} ×{' '}
                  {fmtPrice(row.price_unit_cents, row.currency)}
                </li>
              ))}
            </ul>
          </div>
        )}
        <button
          type="button"
          onClick={() => { setError(null); setResult(null); if (canSubmit) setShowPreview(true); }}
          disabled={!canSubmit}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-neon-yellow px-4 py-3 font-bold text-deep-black transition hover:bg-neon-yellow/90 disabled:opacity-40"
        >
          {isEditing ? <Save size={20} className="text-deep-black" /> : <Coins size={20} className="text-deep-black" />}
          {isEditing ? 'Revisar e salvar' : 'Revisar e tokenizar'}
        </button>
      </section>

      {showPreview && (
        <TokenizePreview
          slug={slug}
          phases={payload.phases}
          split={sharedSplit}
          beneficiary={sharedBeneficiary.trim()}
          isEditing={isEditing}
          submitting={submitting}
          error={error}
          onClose={() => setShowPreview(false)}
          onConfirm={async () => { const ok = await tokenize(); if (ok) setShowPreview(false); }}
        />
      )}
    </div>
  );
}

/**
 * Preview antes de tokenizar: os 3 cards como vão pro banco, com alertas do que
 * estiver faltando. Confirmar só cria depois de você conferir.
 */
function TokenizePreview({
  slug, phases, split, beneficiary, isEditing, submitting, error, onClose, onConfirm,
}: {
  slug: string;
  phases: LegendPhasePayload[];
  split: LegendSplitEntry[];
  beneficiary: string;
  isEditing: boolean;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const splitSum = split.reduce((a, e) => a + (Number(e.percent) || 0), 0);
  const playerEntry = split.find((e) => e.kind === 'player');
  // Beneficiário efetivo = o que vale no import: campo dedicado OU o jogador do split.
  const effectiveBeneficiary = beneficiary || playerEntry?.user_id || '';
  // Quem está em cada fatia. olefoot/community são preenchidos pela plataforma no
  // banco (trigger), então mesmo com user_id null aqui, quem recebe é a Olefoot.
  const splitWho = (e: LegendSplitEntry): { txt: string; ok: boolean } => {
    if (e.kind === 'olefoot' || e.kind === 'community') return { txt: 'Olefoot (plataforma)', ok: true };
    if (e.user_id) return { txt: e.label?.includes('@') ? e.label : `${e.user_id.slice(0, 8)}…`, ok: true };
    return { txt: 'não vinculado', ok: false };
  };
  const warnings: string[] = [];
  if (splitSum !== 100) warnings.push(`Split soma ${splitSum}% (precisa 100%)`);
  if (!effectiveBeneficiary) warnings.push('Jogador não vinculado — o atleta não recebe nem vê o card no playervip. Vincule o e-mail dele no split.');
  for (const e of split) {
    if (e.kind === 'facilitator' && !e.user_id) warnings.push('Facilitador sem conta vinculada — os 10% dele não caem. Vincule o e-mail no split.');
  }
  for (const ph of phases) {
    if (!ph.collectionCode?.trim()) warnings.push(`${PHASE_LABEL[ph.phase]}: sem collection_code`);
    if (!(ph.priceUnitCents ?? 0)) warnings.push(`${PHASE_LABEL[ph.phase]}: preço zerado`);
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4" onClick={onClose}>
      <div
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-white/15 bg-[#111] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-sm font-black uppercase tracking-wider text-neon-yellow">
            Preview — {phases.length} cards de "{slug}"
          </h3>
          <button type="button" onClick={onClose} className="text-white/50 hover:text-white"><X size={18} /></button>
        </div>

        <div className="space-y-2">
          {phases.map((ph) => (
            <div key={ph.phase} className="rounded border border-white/10 bg-black/40 p-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-display text-xs font-black uppercase tracking-wider text-white">
                  {PHASE_LABEL[ph.phase]} · {ph.entity.name || <em className="text-red-400">sem nome</em>}
                </span>
                <span className="font-display text-sm font-black text-neon-yellow tabular-nums">
                  {fmtPrice(ph.priceUnitCents, ph.currency)}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-white/50">
                id: <code>legacy-{slug}-{ph.phase}</code> · {ph.collectionTitle || '(sem título)'}
                {ph.collectionCode ? ` · ${ph.collectionCode}` : ''} · {(ph.initialSupply ?? 0).toLocaleString('pt-BR')} cópias
                {' · '}OVR {ph.entity.mintOverall ?? '?'} · {ph.entity.rarity ?? '?'}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded border border-white/10 bg-black/40 p-3 text-[11px] text-white/60">
          <div className="mb-1.5 font-semibold uppercase tracking-wider text-white/50">Split (todas as fases)</div>
          <div className="space-y-1">
            {split.map((e, i) => {
              const who = splitWho(e);
              return (
                <div key={i} className="flex items-center justify-between gap-3">
                  <span className="text-white/70">{e.label || e.kind} · {e.percent}%</span>
                  <span className={who.ok ? 'text-emerald-300' : 'text-amber-300'}>
                    {who.ok ? '✓ ' : '⚠ '}{who.txt}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-2 border-t border-white/10 pt-1.5">
            Beneficiário (quem vê no playervip):{' '}
            {effectiveBeneficiary
              ? <span className="text-emerald-300">{playerEntry?.label?.includes('@') ? playerEntry.label : `${effectiveBeneficiary.slice(0, 12)}…`}</span>
              : <span className="text-amber-300">não definido</span>}
          </div>
        </div>

        {warnings.length > 0 && (
          <div className="mt-3 rounded border border-amber-500/40 bg-amber-500/10 p-3 text-[11px] text-amber-200">
            <div className="mb-1 font-bold uppercase tracking-wider">Confira antes de criar</div>
            <ul className="list-disc pl-4">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </div>
        )}
        {error && <p className="mt-3 rounded border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onClose} disabled={submitting}
            className="flex-1 rounded border border-white/25 px-4 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/10 disabled:opacity-40">
            Voltar e corrigir
          </button>
          <button type="button" onClick={onConfirm} disabled={submitting}
            className="flex-[2] rounded bg-neon-yellow px-4 py-2.5 text-sm font-black uppercase tracking-wider text-deep-black hover:bg-neon-yellow/90 disabled:opacity-40">
            {submitting ? (isEditing ? 'Salvando…' : 'Criando…') : isEditing ? 'Confirmar e salvar' : 'Confirmar e criar os 3 cards'}
          </button>
        </div>
      </div>
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
        className="rounded border border-white/25 bg-deep-black px-2 py-1.5 text-sm text-white placeholder-white/40 focus:border-neon-yellow focus:outline-none"
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
        className="rounded border border-white/25 bg-deep-black px-2 py-1.5 text-sm text-white focus:border-neon-yellow focus:outline-none"
      />
    </label>
  );
}

/** Preço legível: USDT em dólar ($X.XX), OLEFOOT em unidades inteiras. */
function fmtPrice(cents: number | null | undefined, currency?: string | null): string {
  const n = cents ?? 0;
  if (currency === 'OLEFOOT') return `${n.toLocaleString('pt-BR')} OLEFOOT`;
  return `$${(n / 100).toFixed(2)}`;
}

/**
 * Campo de preço em DÓLAR (pra USDT) / unidades (pra OLEFOOT).
 *
 * Guarda o valor como texto local pra permitir digitação livre (apagar, decimais,
 * estado intermediário vazio) — o `type="number"` controlado antigo saltava pra 0
 * ao esvaziar e travava a edição. Só ressincroniza a partir do prop quando NÃO
 * está focado (ex.: troca de moeda reseta o default), pra não atropelar quem digita.
 */
function PriceField({
  currency, priceUnitCents, onChange,
}: {
  currency: LegendCurrency;
  priceUnitCents: number;
  onChange: (cents: number) => void;
}) {
  const isUsd = currency !== 'OLEFOOT';
  const canonical = isUsd ? (priceUnitCents ?? 0) / 100 : (priceUnitCents ?? 0);
  const [txt, setTxt] = useState(String(canonical));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setTxt(String(canonical));
  }, [canonical, focused]);

  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-semibold uppercase tracking-wider text-white/60">
        {isUsd ? 'Preço unitário (US$)' : 'Preço unitário (OLEFOOT)'}
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={txt}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          setTxt(e.target.value);
          const raw = e.target.value.replace(',', '.').trim();
          if (raw === '') return;
          const n = Number(raw);
          if (!Number.isFinite(n) || n < 0) return;
          onChange(isUsd ? Math.round(n * 100) : Math.round(n));
        }}
        className="rounded border border-white/25 bg-deep-black px-2 py-1.5 text-sm text-white focus:border-neon-yellow focus:outline-none"
      />
      <span className="text-[10px] text-white/35">
        {isUsd ? `= ${priceUnitCents ?? 0}¢ salvos` : 'unidades inteiras de OLEFOOT'}
      </span>
    </label>
  );
}

const ATTR_PT: Record<string, string> = {
  passe: 'Passe', marcacao: 'Marcação', velocidade: 'Velocidade', drible: 'Drible',
  finalizacao: 'Finalização', fisico: 'Físico', tatico: 'Tático', mentalidade: 'Mentalidade',
  confianca: 'Confiança', fairPlay: 'Fair Play',
};

/** Barras dos 10 atributos, com ★ nos que definem a posição. Só leitura. */
function AttrBars({ attrs, pos }: { attrs: Record<string, number>; pos: string }) {
  const key = new Set<string>(keyAttrsForPosition(pos));
  const rows = ATTR_KEYS.slice().sort((a, b) => {
    const ka = key.has(a) ? 1 : 0;
    const kb = key.has(b) ? 1 : 0;
    if (ka !== kb) return kb - ka;
    return (attrs[b] ?? 0) - (attrs[a] ?? 0);
  });
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
      {rows.map((k) => {
        const v = attrs[k] ?? 0;
        const isKey = key.has(k);
        return (
          <div key={k} className="flex items-center gap-2">
            <span className={`w-24 shrink-0 text-[10px] ${isKey ? 'font-bold text-neon-yellow' : 'text-white/50'}`}>
              {isKey ? '★ ' : ''}{ATTR_PT[k] ?? k}
            </span>
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-black/50">
              <div className={`h-full rounded-full ${isKey ? 'bg-neon-yellow' : 'bg-white/30'}`} style={{ width: `${Math.max(0, Math.min(100, v))}%` }} />
            </div>
            <span className="w-6 shrink-0 text-right text-[11px] font-bold tabular-nums text-white/80">{v}</span>
          </div>
        );
      })}
    </div>
  );
}

function PhaseEditor({
  phase, slug, portraitUrl, onPortraitUploaded, portraitFocus, onPortraitFocusChange,
  expanded, onToggle, onChange, onChangeEntity, onChangeAttr,
}: {
  phase: LegendPhasePayload;
  slug: string;
  portraitUrl: string | null;
  onPortraitUploaded: (url: string | null) => void;
  portraitFocus: PortraitFocus;
  onPortraitFocusChange: (f: PortraitFocus) => void;
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<LegendPhasePayload>) => void;
  onChangeEntity: (patch: Partial<LegendPhasePayload['entity']>) => void;
  onChangeAttr: (k: (typeof ATTR_KEYS)[number], v: number) => void;
}) {
  return (
    <div className="rounded-lg border border-white/20 bg-deep-black/40 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-white/5"
      >
        <div className="flex items-center gap-3">
          <span className="rounded border border-white/20 bg-neon-yellow/20 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-neon-yellow">
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
              · Tier {phase.tier} · {phase.initialSupply}× {fmtPrice(phase.priceUnitCents, phase.currency)}
            </span>
          )}
        </div>
        {expanded
          ? <ChevronDown size={18} className="text-neon-yellow" />
          : <ChevronRight size={18} className="text-neon-yellow" />}
      </button>
      {expanded && (
        <div className="border-t border-white/20 p-4 space-y-4">
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
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-semibold uppercase tracking-wider text-white/60">Posição</span>
                <select
                  value={phase.entity.pos}
                  onChange={(e) => onChangeEntity({ pos: e.target.value })}
                  className="rounded border border-white/25 bg-deep-black px-2 py-1.5 text-sm text-white focus:border-neon-yellow focus:outline-none"
                >
                  {!GACHA_POSITIONS.includes(phase.entity.pos as (typeof GACHA_POSITIONS)[number]) && (
                    <option value={phase.entity.pos}>{phase.entity.pos || '—'}</option>
                  )}
                  {GACHA_POSITIONS.map((p) => (
                    <option key={p} value={p}>{positionLabelPt(p)} ({p})</option>
                  ))}
                </select>
              </label>
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
              currentFocus={portraitFocus}
              onUploaded={onPortraitUploaded}
              onFocusChange={onPortraitFocusChange}
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
            <legend className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/60">
              Atributos (0-99)
              {/* OVR PONDERADO — o mesmo que o game mostra (era média simples aqui). */}
              <span className="rounded bg-neon-yellow/15 px-2 py-0.5 font-display text-sm font-black text-neon-yellow tabular-nums">
                OVR {weightedOverall(phase.entity.attrs)}
              </span>
            </legend>

            {/* Calibrar: OVR alvo → distribui os 10 attrs pela posição + fase. */}
            <div className="flex flex-wrap items-end gap-2 rounded border border-cyan-400/25 bg-cyan-500/[0.05] p-2">
              <LabeledNumber
                label="OVR alvo"
                value={phase.entity.mintOverall ?? 70}
                onChange={(v) => onChangeEntity({ mintOverall: Math.max(40, Math.min(99, v)) })}
                min={40}
                max={99}
              />
              <button
                type="button"
                onClick={() => onChangeEntity({
                  attrs: calibrateLegendAttrs(phase.entity.pos, phase.phase, phase.entity.mintOverall ?? 70),
                })}
                className="inline-flex items-center gap-1.5 rounded bg-cyan-500 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-black hover:bg-cyan-400"
                title="Distribui os atributos pela posição e fase de vida pra bater o OVR alvo"
              >
                <RefreshCw size={13} /> Calibrar ({positionLabelPt(phase.entity.pos) || phase.entity.pos} · {PHASE_LABEL[phase.phase]})
              </button>
              <span className="text-[10px] text-white/40">
                Perfil da posição + curva jovem→maduro. Depois dá pra afinar à mão.
              </span>
            </div>

            {/* Barras: * = atributo-chave da posição (o que define o jogador). */}
            <AttrBars attrs={phase.entity.attrs} pos={phase.entity.pos} />

            <details className="text-xs">
              <summary className="cursor-pointer text-white/45 hover:text-white/70">Editar números à mão</summary>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
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
            </details>
          </fieldset>

          {/* Coleção & preço */}
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold uppercase tracking-wider text-white/60">
              Coleção (time/temporada desta fase) & preço
            </legend>
            <p className="text-[11px] text-white/40">
              A coleção é o TIME/TEMPORADA desta fase — vários jogadores podem compartilhar (ex: FOGAO95
              junta todos do Botafogo 1995). Por isso é por fase: cada época do craque é uma coleção diferente.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <LabeledInput
                label="Código da coleção (ex: FOGAO95)"
                value={phase.collectionCode ?? ''}
                onChange={(v) => onChange({ collectionCode: v.toUpperCase().trim() })}
                placeholder="FOGAO95"
              />
              <LabeledInput
                label="Nome da coleção (ex: Botafogo 1995)"
                value={phase.collectionTitle ?? ''}
                onChange={(v) => onChange({ collectionTitle: v })}
                placeholder="Botafogo 1995"
              />
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
                  className="rounded border border-white/25 bg-deep-black px-2 py-1.5 text-sm text-white focus:border-neon-yellow focus:outline-none"
                >
                  <option value="USDT">USDT (US$)</option>
                  <option value="OLEFOOT">OLEFOOT (unidades)</option>
                </select>
              </label>
              <PriceField
                currency={(phase.currency ?? 'USDT') as LegendCurrency}
                priceUnitCents={phase.priceUnitCents ?? 0}
                onChange={(v) => onChange({ priceUnitCents: v })}
              />
              <LabeledNumber
                label="Supply inicial (lote 1)"
                value={phase.initialSupply ?? 0}
                onChange={(v) => onChange({ initialSupply: v })}
              />
            </div>
            <p className="text-[11px] text-white/40">
              Lotes seguintes: 50% do supply e +25% no preço, automático.
            </p>
          </fieldset>

          {/* Split de pagamento e beneficiário são ÚNICOS por lenda — editados
              no topo do wizard, não por fase. */}
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
        className="rounded border border-white/25 bg-deep-black px-2 py-1.5 text-sm text-white placeholder-white/40 focus:border-neon-yellow focus:outline-none resize-none"
      />
      <span className={`self-end text-[10px] tabular-nums ${tone}`}>
        {len} / {maxLen}
      </span>
    </label>
  );
}

function PortraitUploader({
  slug, phase, currentUrl, currentFocus, onUploaded, onFocusChange,
}: {
  slug: string;
  phase: LegendPhase;
  currentUrl: string | null;
  currentFocus: PortraitFocus;
  onUploaded: (url: string | null) => void;
  onFocusChange: (f: PortraitFocus) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [savingFocus, setSavingFocus] = useState(false);
  const [focusSaved, setFocusSaved] = useState(false);
  const legacyPlayerId = slug ? `legacy-${slug}-${phase}` : null;

  // URL de trabalho: a já salva OU a colada (se válida) — alimenta o preview
  // imediatamente, ANTES de salvar (enquadrar é client-side, não precisa do server).
  const typedUrl = /^https?:\/\//i.test(urlInput.trim()) ? urlInput.trim() : null;
  // URL colada tem precedência: assim dá pra TROCAR uma imagem já salva colando
  // outra. Antes era `currentUrl ?? typedUrl`, e a colada era ignorada.
  const workingUrl = typedUrl ?? currentUrl;

  // Salva foto + enquadramento juntos. Usa a workingUrl (salva ou colada).
  async function handleSaveFocus() {
    if (!legacyPlayerId) {
      setError('Defina o Slug antes de salvar.');
      return;
    }
    if (!workingUrl) return;
    setError(null);
    setSavingFocus(true);
    setFocusSaved(false);
    try {
      await adminSetLegacyPortrait(legacyPlayerId, workingUrl, undefined, currentFocus);
      onUploaded(workingUrl);
      setUrlInput('');
      setFocusSaved(true);
      setTimeout(() => setFocusSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingFocus(false);
    }
  }

  async function handleFile(file: File) {
    if (!legacyPlayerId) {
      setError('Defina o Slug antes de subir a imagem.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Imagem maior que 10MB.');
      return;
    }
    setError(null);
    setUploading(true);
    try {
      // 1) Upload via Pinata (mesmo fluxo do AdminGenesisPortraitsPanel).
      const ext = (file.name.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? '').toLowerCase() || '.png';
      const upload = await uploadImageToPinataViaServer(file, {
        entityType: 'legacy_player_card',
        entityId: legacyPlayerId,
        originalName: `${legacyPlayerId}-card${ext}`,
        mimeType: file.type || undefined,
      });
      if (upload.ok === true) {
        // 2) Persiste a URL pública no row de legacy_players.
        await adminSetLegacyPortrait(legacyPlayerId, upload.media.publicUrl, undefined, currentFocus);
        onUploaded(upload.media.publicUrl);
      } else {
        const failMsg = (upload as { error: string }).error || 'Falha no upload';
        setError(failMsg);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
    <div className="flex items-end gap-3">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded border border-white/20 bg-deep-black flex items-center justify-center">
        {workingUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={workingUrl}
            alt="portrait"
            className="h-full w-full object-cover"
            // Mesmo enquadramento do card real (PlayerPortrait): aplica o ponto
            // focal. Sem isto era object-cover CENTRALIZADO e cortava a cabeça
            // em toda foto vertical. Foco padrão (y=0) = topo. Atualiza ao vivo
            // conforme você arrasta o PortraitFocusEditor abaixo.
            style={portraitFocusStyle(currentFocus.x, currentFocus.y, currentFocus.zoom)}
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
          className={`inline-flex items-center justify-center gap-2 cursor-pointer rounded border border-white/20 bg-neon-yellow/10 px-3 py-2 text-center font-semibold text-neon-yellow hover:bg-neon-yellow/20 ${
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
              Trocar imagem (Pinata/IPFS)
            </>
          ) : (
            <>
              <Camera size={14} className="text-neon-yellow" />
              Subir imagem (Pinata/IPFS · jpeg/png/webp · ≤ 10MB)
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
            {currentUrl.length > 48 ? `${currentUrl.slice(0, 48)}…` : currentUrl}
          </span>
        )}
      </div>
    </div>

      {/* Colar URL já hospedada (Pinata/IPFS) — sem upload da máquina.
          O preview aparece assim que a URL é válida (não precisa salvar primeiro). */}
      <div className="flex items-center gap-2">
        <Link2 size={14} className="shrink-0 text-cyan-300" />
        <input
          type="url"
          value={urlInput}
          onChange={(e) => {
            const v = e.target.value;
            setUrlInput(v);
            // "Sobe" a URL colada pro estado do wizard: assim o Tokenizar salva o
            // retrato junto (o import cria o card sem foto — salvar é ação à
            // parte). Sem isso, colar + tokenizar deixava a imagem NULL.
            const t = v.trim();
            if (/^https?:\/\//i.test(t)) onUploaded(t);
          }}
          placeholder="Cola a URL do Pinata/IPFS…"
          className="min-w-0 flex-1 rounded border border-white/15 bg-black/40 px-2.5 py-1.5 font-mono text-xs text-white/90 placeholder:text-white/30 focus:border-cyan-400 focus:outline-none"
        />
      </div>

      {/* Enquadramento (ponto focal) — card + token. Aparece com a URL colada. */}
      {workingUrl && (
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <PortraitFocusEditor
            url={workingUrl}
            fx={currentFocus.x}
            fy={currentFocus.y}
            zoom={currentFocus.zoom}
            onChange={(x, y, zoom) => onFocusChange({ x, y, zoom })}
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleSaveFocus()}
              disabled={savingFocus || !legacyPlayerId}
              className="inline-flex items-center gap-1.5 rounded bg-neon-yellow px-3 py-1.5 text-xs font-black uppercase text-black hover:brightness-110 disabled:opacity-50"
            >
              <Save size={13} /> {savingFocus ? 'Salvando…' : 'Salvar foto + enquadramento'}
            </button>
            {!legacyPlayerId && (
              <span className="text-[11px] text-amber-300">defina o slug pra salvar</span>
            )}
            {focusSaved && (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300">
                <Check size={12} /> salvo
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SplitEditor({
  split, onChange,
}: {
  split: LegendSplitEntry[];
  onChange: (s: LegendSplitEntry[]) => void;
}) {
  // Estado de e-mail/resultado POR LINHA (índice) — antes era compartilhado,
  // o que quebrava com 2+ facilitadores (todos os campos linkados ao mesmo texto).
  const [emailQueries, setEmailQueries] = useState<Record<number, string>>({});
  const [emailLookups, setEmailLookups] = useState<Record<number, string>>({});
  /** Índices onde a busca deu "não cadastrado" → oferece criar conta playervip. */
  const [notFound, setNotFound] = useState<Record<number, string>>({});
  /** Magic link gerado por linha (após criar a conta). */
  const [magicLinks, setMagicLinks] = useState<Record<number, string>>({});
  const [creating, setCreating] = useState<number | null>(null);
  const total = split.reduce((s, e) => s + (Number.isFinite(e.percent) ? e.percent : 0), 0);
  const facilitatorCount = split.filter((e) => e.kind === 'facilitator').length;
  const beneficiaryCount = split.filter((e) => e.kind === 'player').length;

  function setQuery(i: number, v: string) {
    setEmailQueries((prev) => ({ ...prev, [i]: v }));
  }
  function setLookup(i: number, v: string) {
    setEmailLookups((prev) => ({ ...prev, [i]: v }));
  }
  function updateEntry(index: number, patch: Partial<LegendSplitEntry>) {
    onChange(split.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }
  function removeEntry(index: number) {
    onChange(split.filter((_, i) => i !== index));
  }
  function addFacilitator() {
    if (facilitatorCount >= 5) return;
    onChange([...split, { kind: 'facilitator', user_id: null, label: 'Facilitador', percent: 0 }]);
  }
  function addBeneficiary() {
    onChange([...split, { kind: 'player', user_id: null, label: 'Beneficiário', percent: 0 }]);
  }

  async function lookupEmail(targetIndex: number) {
    const email = (emailQueries[targetIndex] ?? '').trim().toLowerCase();
    setNotFound((p) => ({ ...p, [targetIndex]: '' }));
    if (!email.includes('@')) {
      setLookup(targetIndex, 'Email inválido.');
      return;
    }
    setLookup(targetIndex, 'Buscando...');
    try {
      const res = await adminFindUserByEmail(email);
      if (res.found && res.id) {
        updateEntry(targetIndex, { user_id: res.id, label: email });
        setLookup(targetIndex, `✓ ${res.email} (${res.id.slice(0, 8)}…)`);
      } else {
        // Conta não existe ainda — oferece criar a do playervip aqui mesmo.
        setLookup(targetIndex, '');
        setNotFound((p) => ({ ...p, [targetIndex]: email }));
      }
    } catch (e) {
      setLookup(targetIndex, `✗ Erro: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /**
   * Garante a conta do PLAYERVIP (passwordless — idempotente), grava o uid no
   * split e gera o magic link. Serve pros DOIS casos: conta nova (beneficiário
   * como o Adauto) OU conta que já existe mas precisa do link pra entrar
   * (facilitador como o afiger). O playervip só loga por magic link, então TODO
   * beneficiário — jogador e facilitador — precisa do seu.
   */
  async function createAndLink(targetIndex: number) {
    const email = ((notFound[targetIndex] || emailQueries[targetIndex]) ?? '').trim().toLowerCase();
    if (!email.includes('@')) {
      setLookup(targetIndex, 'Digite o e-mail primeiro.');
      return;
    }
    setCreating(targetIndex);
    try {
      const res = await adminGenerateAccessLink(email);
      if (res.userId) {
        updateEntry(targetIndex, { user_id: res.userId, label: email });
        setLookup(targetIndex, `✓ conta pronta (${res.userId.slice(0, 8)}…) · link abaixo`);
      } else {
        setLookup(targetIndex, '✓ conta pronta — clique buscar pra puxar o uid');
      }
      setNotFound((p) => ({ ...p, [targetIndex]: '' }));
      if (res.link) setMagicLinks((p) => ({ ...p, [targetIndex]: res.link }));
    } catch (e) {
      setLookup(targetIndex, `✗ Erro: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCreating(null);
    }
  }

  return (
    <div className="space-y-2">
      {split.map((e, i) => (
        <div key={i} className="flex flex-wrap items-end gap-2 rounded border border-white/20 bg-white/[0.04] p-2">
          <div className="flex flex-col gap-1 text-xs">
            <span className="font-semibold uppercase tracking-wider text-white/60">Kind</span>
            <span className="rounded border border-white/30 bg-white/10 px-2 py-1 text-sm font-semibold text-white">{e.kind}</span>
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
                  // Sem texto digitado, mostra o e-mail salvo (label). Assim, ao
                  // carregar o slug, o e-mail do jogador/facilitador reaparece.
                  value={emailQueries[i] !== undefined ? emailQueries[i] : (e.label?.includes('@') ? e.label : '')}
                  onChange={(ev) => setQuery(i, ev.target.value)}
                  className="w-40 rounded border border-white/25 bg-deep-black px-2 py-1 text-xs text-white placeholder-white/40 focus:border-neon-yellow focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => lookupEmail(i)}
                  className="inline-flex items-center justify-center rounded border border-white/20 px-2 py-1 text-neon-yellow hover:bg-neon-yellow/10"
                  title="Buscar usuário"
                >
                  <Search size={14} />
                </button>
              </div>
              {e.user_id && (
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-200">
                    <Check size={10} className="text-neon-yellow" />
                    {e.user_id.slice(0, 8)}…
                  </span>
                  {/* Conta já vinculada — mas o playervip só entra por magic link,
                      então gera o link mesmo pra quem já tem conta (ex.: facilitador). */}
                  <button
                    type="button"
                    onClick={() => createAndLink(i)}
                    disabled={creating === i}
                    className="rounded border border-white/20 px-1.5 py-0.5 text-[9px] font-semibold text-neon-yellow hover:bg-neon-yellow/10 disabled:opacity-40"
                    title="Gerar magic link de acesso pra este e-mail"
                  >
                    {creating === i ? '…' : 'Gerar link'}
                  </button>
                </div>
              )}
              {emailLookups[i] && <span className="text-[10px] text-white/55">{emailLookups[i]}</span>}
              {notFound[i] && (
                <div className="flex flex-col gap-1 rounded border border-amber-500/30 bg-amber-500/10 p-1.5">
                  <span className="text-[10px] text-amber-200">Sem conta ainda. Criar a do playervip?</span>
                  <button
                    type="button"
                    onClick={() => createAndLink(i)}
                    disabled={creating === i}
                    className="inline-flex items-center justify-center gap-1.5 rounded bg-neon-yellow px-2 py-1 text-[10px] font-black uppercase tracking-wider text-deep-black hover:bg-neon-yellow/90 disabled:opacity-40"
                  >
                    <UserPlus size={11} />
                    {creating === i ? 'Criando…' : 'Criar conta + vincular'}
                  </button>
                </div>
              )}
              {magicLinks[i] && (
                <div className="flex items-center gap-1">
                  <input
                    readOnly
                    value={magicLinks[i]}
                    onFocus={(ev) => ev.currentTarget.select()}
                    className="w-40 rounded border border-emerald-500/30 bg-black/40 px-1.5 py-1 text-[9px] text-emerald-200"
                  />
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(magicLinks[i])}
                    className="rounded border border-white/20 px-1.5 py-1 text-[9px] text-neon-yellow hover:bg-neon-yellow/10"
                    title="Copiar magic link pra mandar pro atleta"
                  >
                    Copiar link
                  </button>
                </div>
              )}
            </div>
          )}
          {(e.kind === 'facilitator' || (e.kind === 'player' && beneficiaryCount > 1)) && (
            <button
              type="button"
              onClick={() => removeEntry(i)}
              className="self-end inline-flex items-center justify-center rounded border border-white/20 px-2 py-1 text-neon-yellow hover:bg-red-400/15"
              title="Remover"
            >
              <X size={14} />
            </button>
          )}
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={addBeneficiary}
            className="inline-flex items-center gap-2 rounded border border-white/20 px-3 py-1 font-semibold text-neon-yellow hover:bg-neon-yellow/10"
          >
            <UserPlus size={14} className="text-neon-yellow" />
            Beneficiário ({beneficiaryCount})
          </button>
          <button
            type="button"
            onClick={addFacilitator}
            disabled={facilitatorCount >= 5}
            className="inline-flex items-center gap-2 rounded border border-white/20 px-3 py-1 font-semibold text-neon-yellow hover:bg-neon-yellow/10 disabled:opacity-40"
          >
            <UserPlus size={14} className="text-neon-yellow" />
            Facilitador ({facilitatorCount}/5)
          </button>
        </div>
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
    </div>
  );
}
