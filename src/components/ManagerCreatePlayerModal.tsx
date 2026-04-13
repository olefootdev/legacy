import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PlayerAttributes, PlayerBehavior, PlayerStrongFoot } from '@/entities/types';
import { overallFromAttributes } from '@/entities/player';
import {
  applyAgeToAttrs,
  applyBehaviorToAttrs,
  applyDevelopmentBias,
  baseAttrsForPosition,
  DEFAULT_MANAGER_PROSPECT_CREATE_COST_EXP,
  MANAGER_HERITAGE_ORIGIN_TEXT_MIN_LEN,
  MANAGER_PROSPECT_CREATE_MAX_OVR,
  MANAGER_PROSPECT_EVOLVED_MAX_OVR,
  MANAGER_PROSPECT_MAX_AGE,
  MANAGER_PROSPECT_MIN_AGE,
  PORTRAIT_STYLE_REGION_LABELS,
  scaleAttrsToMaxOvr,
  type ManagerProspectCreatePayload,
  type ManagerProspectPortraitStyleRegion,
  type ManagerProspectVisualBrief,
} from '@/entities/managerProspect';
import { validateAcademyProspectName } from '@/entities/managerProspectReservedNames';
import { useGameDispatch, useGameStore } from '@/game/store';
import { formatExp } from '@/systems/economy';
import {
  hairStylePromptFromCatalogId,
  hairStyleSelectLabel,
  MANAGER_HAIR_STYLES,
} from '@/entities/managerProspectHairStyles';
import {
  MANAGER_SKIN_TONES,
  skinTonePromptFromCatalogId,
  skinToneSelectLabel,
} from '@/entities/managerProspectSkinTones';

const POSITIONS = ['GOL', 'ZAG', 'LE', 'LD', 'VOL', 'MC', 'PE', 'PD', 'ATA'] as const;
const NATIONS = [
  { code: 'PT', label: 'Portugal' },
  { code: 'BR', label: 'Brasil' },
  { code: 'ES', label: 'Espanha' },
  { code: 'AR', label: 'Argentina' },
  { code: 'FR', label: 'França' },
  { code: 'DE', label: 'Alemanha' },
  { code: 'AO', label: 'Angola' },
  { code: 'MZ', label: 'Moçambique' },
] as const;

const BEHAVIORS: { id: PlayerBehavior; label: string }[] = [
  { id: 'equilibrado', label: 'Equilibrado' },
  { id: 'ofensivo', label: 'Ofensivo' },
  { id: 'defensivo', label: 'Defensivo' },
  { id: 'criativo', label: 'Criativo' },
];

const EYE_COLOR_CHOICES: { value: string; label: string }[] = [
  { value: '', label: 'Não especificar' },
  { value: 'Olhos castanhos', label: 'Castanhos' },
  { value: 'Olhos castanho-claros, mel ou âmbar', label: 'Mel / castanho-claro / âmbar' },
  { value: 'Olhos verdes ou avelã', label: 'Verdes / avelã' },
  { value: 'Olhos azuis, acinzentados ou gelo', label: 'Azuis / cinzentos / gelo' },
  { value: 'Olhos pretos ou muito escuros', label: 'Pretos / muito escuros' },
];

/** Careca: opção separada (checkbox); estilos com cabelo vêm do catálogo `MANAGER_HAIR_STYLES`. */
const HAIR_CARECA_PROMPT = 'Jogador careca / sem cabelo / cabeça rapada';

const PORTRAIT_STYLE_OPTIONS = (
  Object.entries(PORTRAIT_STYLE_REGION_LABELS) as [ManagerProspectPortraitStyleRegion, string][]
).map(([value, label]) => ({ value, label }));

const ORIGIN_QUICK_TAGS = [
  'Indígena',
  'Afrodescendente',
  'Europeu',
  'Asiático',
  'Árabe',
  'Misto',
] as const;

const ATTR_SLIDERS: { key: keyof PlayerAttributes; label: string }[] = [
  { key: 'passe', label: 'Passe' },
  { key: 'marcacao', label: 'Marcação' },
  { key: 'velocidade', label: 'Velocidade' },
  { key: 'drible', label: 'Drible' },
  { key: 'finalizacao', label: 'Finalização' },
  { key: 'fisico', label: 'Físico' },
  { key: 'tatico', label: 'Tático' },
  { key: 'mentalidade', label: 'Mentalidade' },
  { key: 'confianca', label: 'Confiança' },
  { key: 'fairPlay', label: 'Fair play' },
];

type Step = 'identity' | 'tune' | 'review';

type Props = {
  open: boolean;
  onClose: () => void;
};

/** Bias neutro só para o preset inicial; o afinamento fino fica no passo 2. */
const PRESET_DEVELOPMENT_BIAS = 50;

function buildPresetAttrs(pos: string, behavior: PlayerBehavior, age: number): PlayerAttributes {
  let attrs = baseAttrsForPosition(pos);
  attrs = applyBehaviorToAttrs(attrs, behavior);
  attrs = applyAgeToAttrs(attrs, age);
  attrs = applyDevelopmentBias(attrs, PRESET_DEVELOPMENT_BIAS);
  return scaleAttrsToMaxOvr(attrs, MANAGER_PROSPECT_CREATE_MAX_OVR);
}

function trimBrief(v: string): string | undefined {
  const t = v.trim();
  return t.length ? t : undefined;
}

export function ManagerCreatePlayerModal({ open, onClose }: Props) {
  const dispatch = useGameDispatch();
  const oleBal = useGameStore((s) => s.finance.ole);
  const createCostExp = useGameStore(
    (s) => s.managerProspectConfig?.createCostExp ?? DEFAULT_MANAGER_PROSPECT_CREATE_COST_EXP,
  );

  const [step, setStep] = useState<Step>('identity');
  const [name, setName] = useState('');
  const [age, setAge] = useState(18);
  const [country, setCountry] = useState<(typeof NATIONS)[number]['code']>('PT');
  const [strongFoot, setStrongFoot] = useState<PlayerStrongFoot>('right');
  const [pos, setPos] = useState<(typeof POSITIONS)[number]>('MC');
  const [behavior, setBehavior] = useState<PlayerBehavior>('equilibrado');

  const [tunedAttrs, setTunedAttrs] = useState<PlayerAttributes>(() => buildPresetAttrs('MC', 'equilibrado', 18));
  /** id do catálogo `MANAGER_SKIN_TONES`; vazio = não especificar */
  const [skinTone, setSkinTone] = useState('');
  const [eyeColor, setEyeColor] = useState('');
  const [hairChoice, setHairChoice] = useState('');
  const [hairBald, setHairBald] = useState(false);
  const [extraDetails, setExtraDetails] = useState('');
  const [portraitStyleRegion, setPortraitStyleRegion] = useState<ManagerProspectPortraitStyleRegion>('europa');
  const [originTags, setOriginTags] = useState<string[]>([]);
  const [originText, setOriginText] = useState('');

  /** Corpo com scroll do modal — repõe-se ao topo no passo 2 (Afinar) para não saltar os sliders. */
  const modalBodyScrollRef = useRef<HTMLDivElement>(null);

  const resetForm = useCallback(() => {
    setStep('identity');
    setName('');
    setAge(18);
    setCountry('PT');
    setStrongFoot('right');
    setPos('MC');
    setBehavior('equilibrado');
    setTunedAttrs(buildPresetAttrs('MC', 'equilibrado', 18));
    setSkinTone('');
    setEyeColor('');
    setHairChoice('');
    setHairBald(false);
    setExtraDetails('');
    setPortraitStyleRegion('europa');
    setOriginTags([]);
    setOriginText('');
  }, []);

  useEffect(() => {
    if (!open) return;
    resetForm();
  }, [open, resetForm]);

  useLayoutEffect(() => {
    if (!open || step !== 'tune') return;
    const el = modalBodyScrollRef.current;
    if (el) el.scrollTop = 0;
  }, [open, step]);

  const previewOvrIdentity = useMemo(() => {
    const attrs = buildPresetAttrs(pos, behavior, age);
    return overallFromAttributes(attrs);
  }, [pos, behavior, age]);

  const previewOvrTune = useMemo(() => overallFromAttributes(tunedAttrs), [tunedAttrs]);

  const setAttrSlider = useCallback((key: keyof PlayerAttributes, raw: number) => {
    setTunedAttrs((prev) => {
      const next = { ...prev, [key]: Math.round(Math.min(99, Math.max(35, raw))) };
      return scaleAttrsToMaxOvr(next, MANAGER_PROSPECT_CREATE_MAX_OVR);
    });
  }, []);

  const goTune = () => {
    setTunedAttrs(buildPresetAttrs(pos, behavior, age));
    setStep('tune');
  };

  const canAfford = oleBal >= createCostExp;
  const trimmed = name.trim();
  const namePolicy = useMemo(() => validateAcademyProspectName(trimmed), [trimmed]);
  const canAdvanceIdentity = trimmed.length >= 2 && namePolicy.ok;
  const heritageValid = originText.trim().length >= MANAGER_HERITAGE_ORIGIN_TEXT_MIN_LEN;
  const canSubmit = canAdvanceIdentity && canAfford && heritageValid;

  const toggleOriginTag = useCallback((tag: string) => {
    setOriginTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }, []);

  const visualBrief: ManagerProspectVisualBrief | undefined = useMemo(() => {
    const hairLine = hairBald
      ? HAIR_CARECA_PROMPT
      : hairChoice
        ? hairStylePromptFromCatalogId(hairChoice) ?? trimBrief(hairChoice)
        : undefined;
    const skinLine = skinTone ? skinTonePromptFromCatalogId(skinTone) ?? trimBrief(skinTone) : undefined;
    const vb: ManagerProspectVisualBrief = {
      skinTone: skinLine,
      eyeColor: eyeColor ? trimBrief(eyeColor) : undefined,
      hairStyle: hairLine,
      extraDetails: trimBrief(extraDetails),
    };
    if (!vb.skinTone && !vb.eyeColor && !vb.hairStyle && !vb.extraDetails) return undefined;
    return vb;
  }, [skinTone, eyeColor, hairChoice, hairBald, extraDetails]);

  const selectedHairCatalogEntry = useMemo(
    () => MANAGER_HAIR_STYLES.find((x) => x.id === hairChoice),
    [hairChoice],
  );
  const hairDisplayLabel =
    selectedHairCatalogEntry != null ? hairStyleSelectLabel(selectedHairCatalogEntry) : hairChoice || null;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const payload: ManagerProspectCreatePayload = {
      name: trimmed,
      age,
      country,
      strongFoot,
      pos,
      behavior,
      attrs: { ...tunedAttrs },
      heritage: {
        portraitStyleRegion,
        originTags: [...originTags],
        originText: originText.trim(),
      },
      visualBrief,
    };
    dispatch({ type: 'CREATE_MANAGER_PROSPECT', payload });
    onClose();
    resetForm();
  };

  const stepLabel =
    step === 'identity' ? '1 · Ficha' : step === 'tune' ? '2 · Atributos' : '3 · Revisão';

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex min-h-0 flex-col justify-end bg-black/80 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-8 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="relative mx-auto flex max-h-[min(92dvh,920px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-neon-yellow/30 bg-dark-gray shadow-[0_0_40px_rgba(234,255,0,0.12)] sm:max-w-2xl sm:rounded-2xl"
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <Sparkles className="h-5 w-5 shrink-0 text-neon-yellow" aria-hidden />
                <div className="min-w-0">
                  <h3 className="font-display text-sm font-black uppercase italic tracking-wide text-white">
                    Academia OLE
                  </h3>
                  <p className="text-[10px] text-gray-500">
                    {stepLabel} · criação OVR ≤ {MANAGER_PROSPECT_CREATE_MAX_OVR} · evolução até{' '}
                    {MANAGER_PROSPECT_EVOLVED_MAX_OVR}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div
              ref={modalBodyScrollRef}
              className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain px-4 py-4"
            >
              {step === 'identity' ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">OVR estimado</span>
                    <span className="font-display text-2xl font-black text-neon-yellow">{previewOvrIdentity}</span>
                  </div>
                  <p className="text-[10px] leading-relaxed text-gray-500">
                    A seguir afinas atributos; na criação o teto é OVR {MANAGER_PROSPECT_CREATE_MAX_OVR} (treinos e
                    jogos podem evoluir até {MANAGER_PROSPECT_EVOLVED_MAX_OVR}).
                  </p>

                  <label className="block space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Nome no cartão</span>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value.toUpperCase())}
                      maxLength={24}
                      placeholder="EX.: COSTA"
                      className={cn(
                        'w-full rounded-lg border bg-black/50 px-3 py-2 font-display text-sm font-bold uppercase text-white outline-none focus:border-neon-yellow',
                        trimmed.length >= 2 && !namePolicy.ok ? 'border-red-500/50' : 'border-white/15',
                      )}
                      aria-invalid={trimmed.length >= 2 && !namePolicy.ok}
                    />
                    {trimmed.length >= 2 && !namePolicy.ok ? (
                      <p className="text-[10px] leading-snug text-red-300/90">{namePolicy.reason}</p>
                    ) : null}
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Idade</span>
                      <input
                        type="number"
                        min={MANAGER_PROSPECT_MIN_AGE}
                        max={MANAGER_PROSPECT_MAX_AGE}
                        value={age}
                        onChange={(e) =>
                          setAge(
                            Math.max(
                              MANAGER_PROSPECT_MIN_AGE,
                              Math.min(MANAGER_PROSPECT_MAX_AGE, Number(e.target.value) || MANAGER_PROSPECT_MIN_AGE),
                            ),
                          )
                        }
                        className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 font-display text-sm font-bold text-white outline-none focus:border-neon-yellow"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Nacionalidade</span>
                      <select
                        value={country}
                        onChange={(e) => setCountry(e.target.value as (typeof NATIONS)[number]['code'])}
                        className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 font-display text-xs font-bold text-white outline-none focus:border-neon-yellow"
                      >
                        {NATIONS.map((n) => (
                          <option key={n.code} value={n.code}>
                            {n.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Pé bom</span>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          { id: 'right' as const, label: 'Direito' },
                          { id: 'left' as const, label: 'Esquerdo' },
                          { id: 'both' as const, label: 'Ambos' },
                        ] as const
                      ).map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setStrongFoot(f.id)}
                          className={cn(
                            'rounded-lg border px-3 py-1.5 font-display text-[10px] font-bold uppercase tracking-wide transition-colors',
                            strongFoot === f.id
                              ? 'border-neon-yellow bg-neon-yellow/15 text-neon-yellow'
                              : 'border-white/15 text-gray-400 hover:border-white/30 hover:text-white',
                          )}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="block space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Posição</span>
                    <select
                      value={pos}
                      onChange={(e) => setPos(e.target.value as (typeof POSITIONS)[number])}
                      className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 font-display text-xs font-bold text-white outline-none focus:border-neon-yellow"
                    >
                      {POSITIONS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Característica</span>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {BEHAVIORS.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setBehavior(b.id)}
                          className={cn(
                            'rounded-lg border py-2 font-display text-[9px] font-black uppercase tracking-wide transition-colors sm:text-[10px]',
                            behavior === b.id
                              ? 'border-neon-yellow bg-neon-yellow/15 text-neon-yellow'
                              : 'border-white/15 text-gray-400 hover:border-white/30 hover:text-white',
                          )}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}

              {step === 'tune' ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">OVR com estes valores</span>
                    <span className="font-display text-2xl font-black text-neon-yellow">{previewOvrTune}</span>
                  </div>
                  <p className="text-[10px] leading-relaxed text-gray-500">
                    Barras de 35 a 99; o clube equilibra para não passar de OVR {MANAGER_PROSPECT_CREATE_MAX_OVR} na
                    ficha (evolução futura até {MANAGER_PROSPECT_EVOLVED_MAX_OVR}).
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {ATTR_SLIDERS.map(({ key, label }) => (
                      <label key={key} className="block space-y-1">
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          <span>{label}</span>
                          <span className="text-white">{tunedAttrs[key]}</span>
                        </div>
                        <input
                          type="range"
                          min={35}
                          max={99}
                          value={tunedAttrs[key]}
                          onChange={(e) => setAttrSlider(key, Number(e.target.value))}
                          className="h-2 w-full accent-neon-yellow"
                        />
                      </label>
                    ))}
                  </div>

                  <div className="space-y-3 rounded-lg border border-neon-yellow/25 bg-neon-yellow/[0.04] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-neon-yellow">
                      Origem para o retrato (obrigatório)
                    </p>
                    <p className="text-[9px] leading-relaxed text-gray-500">
                      Guia o desenho do rosto; não muda a nacionalidade da ficha. Ex.: «Brasil, raízes japonesas».
                    </p>
                    <label className="block space-y-1">
                      <span className="text-[9px] font-bold uppercase text-gray-500">Estilo do retrato</span>
                      <select
                        value={portraitStyleRegion}
                        onChange={(e) => setPortraitStyleRegion(e.target.value as ManagerProspectPortraitStyleRegion)}
                        className="w-full rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-xs font-bold text-white outline-none focus:border-neon-yellow"
                      >
                        {PORTRAIT_STYLE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold uppercase text-gray-500">Marcadores (opcional)</span>
                      <div className="flex flex-wrap gap-1.5">
                        {ORIGIN_QUICK_TAGS.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleOriginTag(tag)}
                            className={cn(
                              'rounded-lg border px-2.5 py-1 font-display text-[9px] font-bold uppercase tracking-wide transition',
                              originTags.includes(tag)
                                ? 'border-neon-yellow bg-neon-yellow/20 text-neon-yellow'
                                : 'border-white/15 text-gray-400 hover:border-white/30 hover:text-white',
                            )}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="block space-y-1">
                      <span className="text-[9px] font-bold uppercase text-gray-500">Descrição</span>
                      <textarea
                        value={originText}
                        onChange={(e) => setOriginText(e.target.value)}
                        rows={3}
                        placeholder="Ex.: Brasil, ascendência cabo-verdiana."
                        className={cn(
                          'w-full resize-none rounded-lg border bg-black/50 px-2 py-2 text-xs text-white outline-none focus:border-neon-yellow',
                          heritageValid ? 'border-white/15' : 'border-amber-500/40',
                        )}
                      />
                      <span className="text-[9px] text-gray-600">
                        Mín. {MANAGER_HERITAGE_ORIGIN_TEXT_MIN_LEN} caracteres · {originText.trim().length}/
                        {MANAGER_HERITAGE_ORIGIN_TEXT_MIN_LEN}
                      </span>
                    </label>
                  </div>

                  <div className="space-y-2 rounded-lg border border-white/10 bg-black/25 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Aparência (opcional)
                    </p>
                    <p className="text-[9px] text-gray-600">
                      Pele, olhos e cabelo ajudam o retrato. Em «Detalhe», tatuagem ou cicatriz, se quiseres.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="block space-y-1">
                        <span className="text-[9px] font-bold uppercase text-gray-500">Tom de pele</span>
                        <select
                          value={skinTone}
                          onChange={(e) => setSkinTone(e.target.value)}
                          className="w-full rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-xs font-bold text-white outline-none focus:border-neon-yellow"
                        >
                          <option value="">Não especificar</option>
                          {MANAGER_SKIN_TONES.map((s) => (
                            <option key={s.id} value={s.id}>
                              {skinToneSelectLabel(s)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block space-y-1">
                        <span className="text-[9px] font-bold uppercase text-gray-500">Cor dos olhos</span>
                        <select
                          value={eyeColor}
                          onChange={(e) => setEyeColor(e.target.value)}
                          className="w-full rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-xs font-bold text-white outline-none focus:border-neon-yellow"
                        >
                          {EYE_COLOR_CHOICES.map((o) => (
                            <option key={o.value || 'eye-none'} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block space-y-1 sm:col-span-2">
                        <span className="text-[9px] font-bold uppercase text-gray-500">Estilo do cabelo</span>
                        <select
                          value={hairChoice}
                          onChange={(e) => setHairChoice(e.target.value)}
                          disabled={hairBald}
                          className={cn(
                            'w-full rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-xs font-bold text-white outline-none focus:border-neon-yellow',
                            hairBald && 'cursor-not-allowed opacity-45',
                          )}
                        >
                          <option value="">Não especificar</option>
                          {MANAGER_HAIR_STYLES.map((h) => (
                            <option key={h.id} value={h.id}>
                              {hairStyleSelectLabel(h)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 sm:col-span-2">
                        <input
                          type="checkbox"
                          checked={hairBald}
                          onChange={(e) => {
                            const on = e.target.checked;
                            setHairBald(on);
                            if (on) setHairChoice('');
                          }}
                          className="h-4 w-4 shrink-0 accent-neon-yellow"
                        />
                        <span className="text-[11px] font-bold text-white/90">Sem cabelo (careca)</span>
                      </label>
                      <label className="block space-y-1 sm:col-span-2">
                        <span className="text-[9px] font-bold uppercase text-gray-500">Detalhe</span>
                        <input
                          value={extraDetails}
                          onChange={(e) => setExtraDetails(e.target.value)}
                          placeholder="Ex.: tatuagem de um cruz no pescoço"
                          className="w-full rounded-lg border border-white/15 bg-black/50 px-2 py-1.5 text-xs text-white outline-none focus:border-neon-yellow"
                        />
                      </label>
                    </div>
                  </div>
                </>
              ) : null}

              {step === 'review' ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neon-yellow/25 bg-neon-yellow/5 px-3 py-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Antes de criar</span>
                    <span className="font-display text-2xl font-black text-neon-yellow">{previewOvrTune}</span>
                  </div>
                  <dl className="space-y-2 rounded-lg border border-white/10 bg-black/30 p-3 text-xs">
                    <div className="flex justify-between gap-2">
                      <dt className="text-gray-500">Nome</dt>
                      <dd className="font-display font-bold text-white">{trimmed}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-gray-500">Posição e idade</dt>
                      <dd className="text-white">
                        {pos} · {age}a
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-gray-500">País e pé</dt>
                      <dd className="text-white">
                        {country} · {strongFoot === 'right' ? 'Direito' : strongFoot === 'left' ? 'Esquerdo' : 'Ambos'}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-gray-500">Perfil</dt>
                      <dd className="text-white">{BEHAVIORS.find((b) => b.id === behavior)?.label}</dd>
                    </div>
                    <div className="border-t border-white/10 pt-2 text-[10px] text-white/80">
                      <div className="font-bold uppercase text-neon-yellow/90">Origem (retrato)</div>
                      <div className="mt-1 text-gray-400">
                        Estilo: <span className="text-white">{PORTRAIT_STYLE_REGION_LABELS[portraitStyleRegion]}</span>
                      </div>
                      {originTags.length ? (
                        <div className="mt-1 text-gray-400">
                          Marcadores: <span className="text-white">{originTags.join(', ')}</span>
                        </div>
                      ) : null}
                      <p className="mt-1 leading-relaxed text-white/90">{originText.trim()}</p>
                    </div>
                    {visualBrief ? (
                      <div className="border-t border-white/10 pt-2 text-[10px] text-white/70">
                        <div className="font-bold uppercase text-gray-500">Aparência</div>
                        {skinTone ? (
                          <div>
                            Tom de pele: {MANAGER_SKIN_TONES.find((s) => s.id === skinTone)?.name ?? skinTone}
                          </div>
                        ) : null}
                        {visualBrief.eyeColor ? <div>Olhos: {visualBrief.eyeColor}</div> : null}
                        {hairBald ? (
                          <div>Cabelo: careca</div>
                        ) : hairChoice ? (
                          <div>Cabelo: {hairDisplayLabel ?? hairChoice}</div>
                        ) : null}
                        {visualBrief.extraDetails ? <div>Detalhe: {visualBrief.extraDetails}</div> : null}
                      </div>
                    ) : (
                      <div className="border-t border-white/10 pt-2 text-[10px] text-gray-500">Sem extras de aparência</div>
                    )}
                  </dl>
                  <p className="text-[10px] leading-relaxed text-gray-500">
                    Entra no plantel assim; o retrato do cartão fica num pedido interno para colar e aprovar.
                  </p>
                </>
              ) : null}

              <div
                className={cn(
                  'rounded-lg border px-3 py-2 text-[10px]',
                  canAfford ? 'border-white/10 bg-black/30 text-gray-400' : 'border-red-500/40 bg-red-950/30 text-red-200',
                )}
              >
                Custo:{' '}
                <span className="font-display font-black text-neon-yellow">{formatExp(createCostExp)} EXP</span>
                {' · '}
                Saldo: <span className="text-white">{formatExp(oleBal)} EXP</span>
                {!canAfford ? <span className="mt-1 block">EXP não chega.</span> : null}
              </div>
            </div>

            <div className="shrink-0 space-y-2 border-t border-white/10 bg-black/40 px-4 py-3">
              {step === 'identity' ? (
                <button
                  type="button"
                  disabled={!canAdvanceIdentity}
                  onClick={goTune}
                  className={cn(
                    'btn-primary w-full py-3 font-display text-sm font-black uppercase tracking-wide',
                    !canAdvanceIdentity && 'pointer-events-none opacity-40',
                  )}
                >
                  Avançar
                </button>
              ) : null}
              {step === 'tune' ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep('identity')}
                    className="flex shrink-0 items-center justify-center rounded-lg border border-white/20 px-3 py-3 text-white/80 hover:bg-white/10"
                    aria-label="Voltar"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    disabled={!heritageValid}
                    onClick={() => setStep('review')}
                    className={cn(
                      'btn-primary flex-1 py-3 font-display text-sm font-black uppercase tracking-wide',
                      !heritageValid && 'pointer-events-none opacity-40',
                    )}
                  >
                    Rever
                  </button>
                </div>
              ) : null}
              {step === 'review' ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep('tune')}
                    className="flex shrink-0 items-center justify-center rounded-lg border border-white/20 px-3 py-3 text-white/80 hover:bg-white/10"
                    aria-label="Voltar"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    disabled={!canSubmit}
                    onClick={handleSubmit}
                    className={cn(
                      'btn-primary flex-1 py-3 font-display text-sm font-black uppercase tracking-wide',
                      !canSubmit && 'pointer-events-none opacity-40',
                    )}
                  >
                    Criar jogador
                  </button>
                </div>
              ) : null}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
