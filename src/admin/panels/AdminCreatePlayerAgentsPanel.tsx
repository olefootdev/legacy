/**
 * Pipeline de 4 agentes para Create Player (novo fluxo).
 *
 * Etapa 1: Scout (pesquisa biográfica)
 * Etapa 2: Atributos (gera + admin ajusta)
 * Etapa 3: Bio (narrativa, GameSpirit)
 * Etapa 4: Valuation (precificação BRO/EXP)
 *
 * O admin pode editar o JSON após cada etapa antes de passar pra próxima.
 * No fim, exporta o payload consolidado pra mintar o player.
 */

import { useEffect, useState } from 'react';
import { getSupabase } from '@/supabase/client';
import { Sparkles, User, Target, BookOpen, DollarSign, Play, Check, Copy, Image as ImageIcon, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  runScoutAgent,
  runAttributesAgent,
  runBioAgent,
  runValuationAgent,
  type ScoutResearch,
  type AttributesResult,
  type BioResult,
  type ValuationResult,
} from '@/admin/createPlayerAgentsClient';
import { uploadImageToPinataViaServer } from '@/media/pinataUploadClient';
import { PlayerLinkEditor, DEFAULT_LINK_VALUE, type PlayerLinkEditorValue } from '@/admin/components/PlayerLinkEditor';

type Stage = 'scout' | 'attributes' | 'bio' | 'valuation';

const POSITION_OPTIONS = [
  { value: 'GOL', label: 'GOL — Goleiro' },
  { value: 'ZAG', label: 'ZAG — Zagueiro central' },
  { value: 'LE',  label: 'LE  — Lateral esquerdo' },
  { value: 'LD',  label: 'LD  — Lateral direito' },
  { value: 'VOL', label: 'VOL — Volante' },
  { value: 'MC',  label: 'MC  — Meio-campo' },
  { value: 'PE',  label: 'PE  — Ponta esquerda' },
  { value: 'PD',  label: 'PD  — Ponta direita' },
  { value: 'ATA', label: 'ATA — Atacante' },
];

export type AdminRarity = 'premium' | 'gol' | 'rare' | 'ultra_rare' | 'champion' | 'legend' | 'epic';

const RARITY_OPTIONS: { value: AdminRarity; label: string }[] = [
  { value: 'premium',     label: 'Premium (básico, overall 40-59)' },
  { value: 'gol',         label: 'Gol (overall 55-65)' },
  { value: 'rare',        label: 'Rare (65-74)' },
  { value: 'ultra_rare',  label: 'Ultra Rare (74-82)' },
  { value: 'champion',    label: 'Champion (82-88)' },
  { value: 'legend',      label: 'Legend (88-93)' },
  { value: 'epic',        label: 'Epic (93-99)' },
];

export function AdminCreatePlayerAgentsPanel() {
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [position, setPosition] = useState('');
  const [yearsActive, setYearsActive] = useState('');          // ex: "1994-2010"
  const [targetRarity, setTargetRarity] = useState<AdminRarity | ''>('');

  // Coleções — fetch do Supabase + opção "nova".
  const [collections, setCollections] = useState<string[]>(['genesis']);
  const [selectedCollection, setSelectedCollection] = useState('genesis');
  const [newCollection, setNewCollection] = useState('');

  // Fontes de pesquisa (até 3 links).
  const [link1, setLink1] = useState('');
  const [link2, setLink2] = useState('');
  const [link3, setLink3] = useState('');

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    void sb
      .from('genesis_market_players')
      .select('collection_id')
      .limit(500)
      .then(({ data }) => {
        if (!data) return;
        const uniq = Array.from(new Set(data.map((r) => (r as { collection_id: string | null }).collection_id).filter((x): x is string => !!x)));
        if (uniq.length > 0) setCollections(uniq);
      });
  }, []);

  const effectiveCollection = selectedCollection === '__new__' ? newCollection.trim() : selectedCollection;
  const collectionContext = `Coleção: ${effectiveCollection || '(indefinida)'}, ${RARITY_OPTIONS.find((r) => r.value === targetRarity)?.label ?? 'raridade a definir'}`;
  const sources = [link1, link2, link3].map((s) => s.trim()).filter((s) => s.length > 0);

  const [research, setResearch] = useState<ScoutResearch | null>(null);
  const [attrs, setAttrs] = useState<AttributesResult | null>(null);
  const [bio, setBio] = useState<BioResult | null>(null);
  const [valuation, setValuation] = useState<ValuationResult | null>(null);

  const [stage, setStage] = useState<Stage>('scout');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Upload de fotos (moldura + token).
  const [cardFile, setCardFile] = useState<File | null>(null);
  const [tokenFile, setTokenFile] = useState<File | null>(null);
  const [cardPreview, setCardPreview] = useState<string | null>(null);
  const [tokenPreview, setTokenPreview] = useState<string | null>(null);
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [tokenUrl, setTokenUrl] = useState<string | null>(null);
  const [uploadingKind, setUploadingKind] = useState<'card' | 'token' | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const runStage = async (which: Stage) => {
    setBusy(true);
    setError(null);
    try {
      if (which === 'scout') {
        const r = await runScoutAgent({
          name: name.trim(),
          nickname: nickname.trim() || undefined,
          hintPosition: position || undefined,
          hintEra: yearsActive.trim() || undefined,
          sources: sources.length > 0 ? sources : undefined,
        });
        setResearch(r);
        setStage('attributes');
      } else if (which === 'attributes') {
        if (!research) throw new Error('Rode o scout primeiro.');
        const r = await runAttributesAgent({
          research,
          targetRarity: targetRarity || undefined,
        });
        setAttrs(r);
        setStage('bio');
      } else if (which === 'bio') {
        if (!research) throw new Error('Rode o scout primeiro.');
        const r = await runBioAgent({ research, attrs: attrs ?? undefined });
        setBio(r);
        setStage('valuation');
      } else if (which === 'valuation') {
        if (!attrs) throw new Error('Rode attributes primeiro.');
        const r = await runValuationAgent({
          attrs,
          research: research ?? undefined,
          collectionContext: collectionContext.trim() || undefined,
        });
        setValuation(r);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha na chamada.');
    } finally {
      setBusy(false);
    }
  };

  const resetAll = () => {
    setResearch(null); setAttrs(null); setBio(null); setValuation(null);
    setStage('scout'); setError(null);
    setCardFile(null); setTokenFile(null);
    setCardPreview(null); setTokenPreview(null);
    setCardUrl(null); setTokenUrl(null); setUploadError(null);
  };

  const handlePick = (kind: 'card' | 'token', file: File) => {
    setUploadError(null);
    if (kind === 'card') {
      setCardFile(file);
      if (cardPreview) URL.revokeObjectURL(cardPreview);
      setCardPreview(URL.createObjectURL(file));
    } else {
      setTokenFile(file);
      if (tokenPreview) URL.revokeObjectURL(tokenPreview);
      setTokenPreview(URL.createObjectURL(file));
    }
  };

  const uploadKind = async (kind: 'card' | 'token') => {
    const file = kind === 'card' ? cardFile : tokenFile;
    if (!file || !research) return;
    setUploadingKind(kind);
    setUploadError(null);
    try {
      const safeName = research.full_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
      const r = await uploadImageToPinataViaServer(file, {
        entityType: 'player_portrait',
        originalName: `${safeName}-${kind}.${file.name.split('.').pop() ?? 'webp'}`,
        mimeType: file.type,
      });
      if (r.ok !== true) {
        setUploadError(r.error);
        return;
      }
      const url = r.media.publicUrl;
      if (!url) {
        setUploadError('Upload completo mas sem URL retornada.');
        return;
      }
      if (kind === 'card') setCardUrl(url);
      else setTokenUrl(url);
    } finally {
      setUploadingKind(null);
    }
  };

  const [linkDraft, setLinkDraft] = useState<PlayerLinkEditorValue>(DEFAULT_LINK_VALUE);

  const consolidatedPayload = {
    input: {
      name, nickname, position, yearsActive, targetRarity,
      collection: effectiveCollection, sources,
    },
    research, attrs, bio, valuation,
    portraits: { cardUrl, tokenUrl },
    beneficiary_user_id: linkDraft.beneficiaryUserId,
    payment_split: linkDraft.split,
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <Sparkles className="h-5 w-5 text-violet-300" />
        <div className="flex-1">
          <h2 className="text-lg font-black text-white">Create Player — Pipeline de Agentes</h2>
          <p className="text-[11px] text-gray-400">
            4 agentes Anthropic encadeados: scout → atributos → bio → valuation.
            Cada etapa você pode rodar novamente com ajustes.
          </p>
        </div>
      </header>

      {/* ─── Input inicial ──────────────────────── */}
      <section className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Entrada (nome obrigatório, resto é opcional)
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[10px] text-gray-500">Nome completo *</span>
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="ex: Ronaldinho Gaúcho"
              className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] text-gray-500">Apelido de jogo</span>
            <input
              value={nickname} onChange={(e) => setNickname(e.target.value)}
              placeholder="ex: R10"
              className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] text-gray-500">Posição *</span>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
            >
              <option value="">(selecione)</option>
              {POSITION_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] text-gray-500">Ano de atuação</span>
            <input
              value={yearsActive}
              onChange={(e) => setYearsActive(e.target.value)}
              placeholder="ex: 2000-2012"
              className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] text-gray-500">Raridade-alvo</span>
            <select
              value={targetRarity}
              onChange={(e) => setTargetRarity(e.target.value as typeof targetRarity)}
              className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
            >
              <option value="">(deixar o agente decidir)</option>
              {RARITY_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] text-gray-500">Coleção</span>
            <select
              value={selectedCollection}
              onChange={(e) => setSelectedCollection(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
            >
              {collections.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="__new__">+ Nova coleção…</option>
            </select>
            {selectedCollection === '__new__' ? (
              <input
                value={newCollection}
                onChange={(e) => setNewCollection(e.target.value.trim())}
                placeholder="id da coleção (ex: temporada2, lendas-br)"
                className="mt-1.5 w-full rounded-lg border border-cyan-400/40 bg-black/50 px-3 py-2 text-sm text-white"
              />
            ) : null}
          </label>
        </div>

        {/* Fontes de pesquisa */}
        <div className="border-t border-white/5 pt-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Fontes de pesquisa <span className="text-white/30 normal-case tracking-normal">(opcional — até 3 links pra o scout usar como referência)</span>
          </p>
          <div className="space-y-2">
            {[
              { label: 'Link 1', value: link1, set: setLink1, placeholder: 'ex: https://wikipedia.org/...' },
              { label: 'Link 2', value: link2, set: setLink2, placeholder: 'ex: https://transfermarkt.com/...' },
              { label: 'Link 3', value: link3, set: setLink3, placeholder: 'ex: artigo de site esportivo' },
            ].map((f) => (
              <label key={f.label} className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-[10px] text-gray-500">{f.label}</span>
                <input
                  value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                  placeholder={f.placeholder}
                  className="flex-1 rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-xs text-white"
                />
              </label>
            ))}
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
          ✗ {error}
        </div>
      ) : null}

      {/* ─── Etapa 1: Scout ──────────────────────────── */}
      <StageCard
        Icon={User}
        title="1 · Scout — Pesquisa biográfica"
        subtitle="Clubes, títulos, posição, estilo, era, traits de personalidade"
        active={stage === 'scout' || !research}
        done={!!research}
        onRun={() => runStage('scout')}
        busy={busy && stage === 'scout'}
        disabled={!name.trim() || busy}
        payload={research}
      />

      {/* ─── Etapa 2: Atributos ────────────────────── */}
      <StageCard
        Icon={Target}
        title="2 · Atributos — Calibração"
        subtitle="Passa/marca/vel/drible/fin/físico/tático/mental/confiança/fair play + OVR"
        active={stage === 'attributes' || (!!research && !attrs)}
        done={!!attrs}
        onRun={() => runStage('attributes')}
        busy={busy && stage === 'attributes'}
        disabled={!research || busy}
        payload={attrs}
      />

      {/* ─── Etapa 3: Bio ──────────────────────────── */}
      <StageCard
        Icon={BookOpen}
        title="3 · Bio — GameSpirit narrativa"
        subtitle="Quem sou eu (1ª pessoa), bio curta, signature move, personalidade"
        active={stage === 'bio' || (!!attrs && !bio)}
        done={!!bio}
        onRun={() => runStage('bio')}
        busy={busy && stage === 'bio'}
        disabled={!research || busy}
        payload={bio}
      />

      {/* ─── Etapa 4: Valuation ────────────────────── */}
      <StageCard
        Icon={DollarSign}
        title="4 · Valuation — Precificação"
        subtitle="Floor BRO, target BRO/EXP, raridade final, volatilidade"
        active={stage === 'valuation' || (!!bio && !valuation)}
        done={!!valuation}
        onRun={() => runStage('valuation')}
        busy={busy && stage === 'valuation'}
        disabled={!attrs || busy}
        payload={valuation}
      />

      {/* ─── Resultado consolidado ─────────────────── */}
      {valuation ? (
        <section className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-bold text-emerald-200">
              <Check className="h-4 w-4" /> Pipeline completa
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(consolidatedPayload, null, 2));
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/50 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-200 hover:bg-emerald-500/20"
              >
                <Copy className="h-3 w-3" /> Copiar payload JSON
              </button>
              <button
                type="button"
                onClick={resetAll}
                className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase text-gray-300 hover:bg-white/10"
              >
                Recomeçar
              </button>
            </div>
          </div>
          <pre className="max-h-96 overflow-auto rounded border border-white/10 bg-black/60 p-2 text-[10px] text-emerald-100">
{JSON.stringify(consolidatedPayload, null, 2)}
          </pre>
          <p className="text-[10px] text-emerald-300/80">
            Próximo passo: adicione foto de moldura e token abaixo antes de mintar.
          </p>
        </section>
      ) : null}

      {/* ─── Etapa 4.5: Vinculação & split de pagamento ───── */}
      {valuation ? (
        <section className="rounded-xl border border-neon-yellow/30 bg-neon-yellow/[0.03] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-neon-yellow" />
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-white">
              4.5 · Vinculação & Split
            </h3>
          </div>
          <p className="text-[10px] text-white/55">
            Define quem é o beneficiário do card (jogador real / manager que criou) e o split de cada venda. Entra no
            payload final.
          </p>
          <PlayerLinkEditor value={linkDraft} onChange={setLinkDraft} />
        </section>
      ) : null}

      {/* ─── Etapa 5: Preview + Upload de fotos ───────────── */}
      {valuation && research && attrs && bio ? (
        <section className="rounded-xl border border-cyan-500/40 bg-cyan-500/[0.04] p-4 space-y-4">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-cyan-300" />
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-white">
              5 · Preview + Foto
            </h3>
          </div>

          {/* Preview card visual */}
          <div className="grid gap-4 lg:grid-cols-[1fr,280px]">
            <div className="rounded-xl border border-white/10 bg-gradient-to-br from-black via-black/80 to-amber-950/30 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[10px] font-black uppercase tracking-widest text-neon-yellow">
                    Genesis · {valuation.rarity_tier.toUpperCase()}
                  </p>
                  <h4 className="mt-1 font-display text-xl font-black uppercase tracking-wider text-white">
                    {research.full_name}
                  </h4>
                  <p className="text-[10px] uppercase tracking-widest text-white/50">
                    {research.position} · {research.nationality} · {research.era}
                  </p>
                </div>
                <div className="shrink-0 rounded-lg border border-white/20 bg-black/60 px-3 py-1.5 text-center">
                  <p className="text-[9px] uppercase tracking-wider text-white/50">Overall</p>
                  <p className="font-mono text-2xl font-black text-white">{attrs.overall}</p>
                </div>
              </div>
              <p className="mt-3 text-[11px] italic leading-relaxed text-white/70">
                "{bio.bio_short}"
              </p>
              <div className="mt-3 grid grid-cols-5 gap-1 text-center">
                {(['passe', 'finalizacao', 'velocidade', 'drible', 'fisico'] as const).map((k) => (
                  <div key={k} className="rounded border border-white/5 bg-black/30 px-1 py-1.5">
                    <p className="text-[8px] uppercase tracking-wider text-white/40">{k.slice(0, 3)}</p>
                    <p className="font-mono text-[11px] font-bold text-white">{attrs.attrs[k]}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px]">
                <div>
                  <p className="text-white/40 uppercase tracking-wider">Floor</p>
                  <p className="font-mono text-cyan-300">
                    ¢{(valuation.floor_price_bro_cents / 100).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-white/40 uppercase tracking-wider">Target</p>
                  <p className="font-mono text-neon-yellow">
                    {valuation.target_price_exp.toLocaleString('pt-BR')} EXP
                  </p>
                </div>
              </div>
            </div>

            {/* Slot de upload */}
            <div className="space-y-3">
              <PhotoSlot
                label="Foto da moldura (card)"
                hint="Retrato vertical · aparece em /transfer e plantel"
                previewUrl={cardUrl ?? cardPreview}
                uploaded={!!cardUrl}
                circular={false}
                uploading={uploadingKind === 'card'}
                onPick={(f) => handlePick('card', f)}
                onUpload={() => void uploadKind('card')}
                hasFile={!!cardFile}
              />
              <PhotoSlot
                label="Foto do token"
                hint="Circular · aparece no pitch 2D"
                previewUrl={tokenUrl ?? tokenPreview}
                uploaded={!!tokenUrl}
                circular
                uploading={uploadingKind === 'token'}
                onPick={(f) => handlePick('token', f)}
                onUpload={() => void uploadKind('token')}
                hasFile={!!tokenFile}
              />
              {uploadError ? (
                <p className="rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[10px] text-rose-200">
                  ✗ {uploadError}
                </p>
              ) : null}
            </div>
          </div>

          {cardUrl && tokenUrl ? (
            <div className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-2">
              <p className="flex items-center gap-2 text-xs font-bold text-emerald-200">
                <Check className="h-3.5 w-3.5" /> Fotos enviadas — payload pronto pra mint
              </p>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function StageCard({
  Icon, title, subtitle, active, done, onRun, busy, disabled, payload,
}: {
  Icon: typeof User;
  title: string;
  subtitle: string;
  active: boolean;
  done: boolean;
  onRun: () => void;
  busy: boolean;
  disabled: boolean;
  payload: unknown;
}) {
  const [show, setShow] = useState(true);
  return (
    <section
      className={cn(
        'rounded-xl border p-4 space-y-2 transition-colors',
        done ? 'border-emerald-500/30 bg-emerald-500/[0.03]' :
        active ? 'border-violet-500/40 bg-violet-500/[0.04]' :
        'border-white/10 bg-black/30 opacity-60',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', done ? 'text-emerald-400' : 'text-violet-300')} />
          <div>
            <p className="text-sm font-bold text-white">{title}</p>
            <p className="text-[10px] text-gray-400">{subtitle}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {payload ? (
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-bold uppercase text-gray-300 hover:bg-white/10"
            >
              {show ? 'Ocultar' : 'Ver JSON'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onRun}
            disabled={disabled}
            className={cn(
              'inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors',
              disabled
                ? 'border-white/10 bg-white/5 text-white/30 cursor-not-allowed'
                : done
                  ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20'
                  : 'border-violet-400/60 bg-violet-500/15 text-violet-100 hover:bg-violet-500/25',
            )}
          >
            <Play className="h-3 w-3" />
            {busy ? 'Rodando…' : done ? 'Rodar novamente' : 'Rodar'}
          </button>
        </div>
      </div>
      {payload && show ? (
        <pre className="max-h-80 overflow-auto rounded border border-white/10 bg-black/50 p-2 text-[10px] text-white/80">
{JSON.stringify(payload, null, 2)}
        </pre>
      ) : null}
    </section>
  );
}

// ─── PhotoSlot (subcomponente) ─────────────────────────────────────────

function PhotoSlot({
  label, hint, previewUrl, uploaded, circular, uploading, hasFile, onPick, onUpload,
}: {
  label: string;
  hint: string;
  previewUrl: string | null;
  uploaded: boolean;
  circular: boolean;
  uploading: boolean;
  hasFile: boolean;
  onPick: (f: File) => void;
  onUpload: () => void;
}) {
  return (
    <div className={cn(
      'rounded-lg border p-3 transition-colors',
      uploaded ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-white/10 bg-black/30',
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          'relative flex shrink-0 items-center justify-center overflow-hidden border bg-black/50',
          circular ? 'h-16 w-16 rounded-full border-white/20' : 'h-24 w-16 rounded border-white/20',
        )}>
          {previewUrl ? (
            <img src={previewUrl} alt={label} className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-6 w-6 text-white/20" />
          )}
          {uploaded ? (
            <span className="absolute bottom-0 right-0 rounded-full bg-emerald-500 p-1 text-[8px] text-black">
              <Check className="h-2.5 w-2.5" />
            </span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-white">{label}</p>
          <p className="text-[9px] leading-snug text-white/50">{hint}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <label className="cursor-pointer inline-flex items-center gap-1 rounded border border-white/15 bg-white/5 px-2 py-1 text-[9px] font-bold uppercase text-gray-300 hover:bg-white/10">
              <Upload className="h-3 w-3" />
              Escolher
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPick(f);
                }}
              />
            </label>
            <button
              type="button"
              onClick={onUpload}
              disabled={!hasFile || uploading || uploaded}
              className={cn(
                'rounded border px-2 py-1 text-[9px] font-bold uppercase transition-colors',
                uploaded
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 cursor-default'
                  : !hasFile || uploading
                    ? 'border-white/5 bg-white/5 text-white/30 cursor-not-allowed'
                    : 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20',
              )}
            >
              {uploaded ? '✓ Enviado' : uploading ? 'Enviando…' : 'Upload Pinata'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
