import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, X, Sparkles, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PlayerAttributes, PlayerBehavior, PlayerStrongFoot } from '@/entities/types';
import { overallFromAttributes } from '@/entities/player';
import {
  applyAgeToAttrs,
  applyBehaviorToAttrs,
  applyDevelopmentBias,
  baseAttrsForPosition,
  buildProspectAdminArtPrompt,
  countActiveAcademyProspects,
  DEFAULT_MANAGER_PROSPECT_CREATE_COST_EXP,
  MANAGER_HERITAGE_ORIGIN_TEXT_MIN_LEN,
  MANAGER_PROSPECT_CREATE_MAX_ATTR,
  MANAGER_PROSPECT_CREATE_MAX_OVR,
  MANAGER_PROSPECT_EVOLVED_MAX_OVR,
  MANAGER_PROSPECT_MAX_AGE,
  MANAGER_PROSPECT_MIN_AGE,
  MAX_ACTIVE_ACADEMY_PROSPECTS,
  PORTRAIT_STYLE_REGION_LABELS,
  clampAttrsToCreationCap,
  type ManagerProspectCreatePayload,
  type ManagerProspectPortraitStyleRegion,
  type ManagerProspectVisualBrief,
} from '@/entities/managerProspect';
import { AcademyPhotoCapture } from '@/components/AcademyPhotoCapture';
import {
  MANAGER_PROSPECT_CONTRACT_GAMES,
  managerProspectContractPremiumExp,
  type ManagerProspectContractGames,
} from '@/playerContracts/playerContracts';
import { validateAcademyProspectName } from '@/entities/managerProspectReservedNames';
import { useGameDispatch, useGameStore } from '@/game/store';
import { formatExp } from '@/systems/economy';
import { getSupabase } from '@/supabase/client';
import { olefootApiBase } from '@/gamespirit/admin/runtimeTruth';
import {
  hairStylePromptFromCatalogId,
  hairStyleSelectLabel,
  MANAGER_HAIR_STYLES,
} from '@/entities/managerProspectHairStyles';
import {
  MANAGER_SKIN_TONES,
  skinToneDisplayName,
  skinTonePromptFromCatalogId,
  skinToneSelectLabel,
} from '@/entities/managerProspectSkinTones';
import { APPEARANCE_PRESETS, getPresetById } from '@/entities/managerProspectAppearancePresets';
import { L, emIngles } from '@/i18n/L';
import { posLabel } from '@/components/matchquick/posLabel';

const POSITIONS = ['GOL', 'ZAG', 'LE', 'LD', 'VOL', 'MC', 'PE', 'PD', 'ATA'] as const;
const NATIONS = [
  { code: 'PT', label: 'Portugal' },
  { code: 'BR', label: L('Brasil', 'Brazil') },
  { code: 'ES', label: L('Espanha', 'Spain') },
  { code: 'AR', label: 'Argentina' },
  { code: 'FR', label: L('França', 'France') },
  { code: 'DE', label: L('Alemanha', 'Germany') },
  { code: 'AO', label: 'Angola' },
  { code: 'MZ', label: L('Moçambique', 'Mozambique') },
] as const;

const BEHAVIORS: { id: PlayerBehavior; label: string }[] = [
  { id: 'equilibrado', label: L('Equilibrado', 'Balanced') },
  { id: 'ofensivo', label: L('Ofensivo', 'Attacking') },
  { id: 'defensivo', label: L('Defensivo', 'Defensive') },
  { id: 'criativo', label: L('Criativo', 'Creative') },
];

const EYE_COLOR_CHOICES: { value: string; label: string }[] = [
  { value: '', label: L('Não especificar', 'Not specified') },
  { value: 'Olhos castanhos', label: L('Castanhos', 'Brown') },
  { value: 'Olhos castanho-claros, mel ou âmbar', label: L('Mel / castanho-claro / âmbar', 'Hazel / light brown / amber') },
  { value: 'Olhos verdes ou avelã', label: L('Verdes / avelã', 'Green / hazel') },
  { value: 'Olhos azuis, acinzentados ou gelo', label: L('Azuis / cinzentos / gelo', 'Blue / grey / ice') },
  { value: 'Olhos pretos ou muito escuros', label: L('Pretos / muito escuros', 'Black / very dark') },
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

/** Rótulo de TELA dos marcadores — o valor (PT) é o que vai pro servidor. */
const ORIGIN_TAG_LABEL: Record<string, string> = {
  Indígena: L('Indígena', 'Indigenous'),
  Afrodescendente: L('Afrodescendente', 'Afro-descendant'),
  Europeu: L('Europeu', 'European'),
  Asiático: L('Asiático', 'Asian'),
  Árabe: L('Árabe', 'Arab'),
  Misto: L('Misto', 'Mixed'),
};
const rotuloOrigem = (tag: string): string => ORIGIN_TAG_LABEL[tag] ?? tag;

const ATTR_SLIDERS: { key: keyof PlayerAttributes; label: string }[] = [
  { key: 'passe', label: L('Passe', 'Passing') },
  { key: 'marcacao', label: L('Marcação', 'Marking') },
  { key: 'velocidade', label: L('Velocidade', 'Pace') },
  { key: 'drible', label: L('Drible', 'Dribbling') },
  { key: 'finalizacao', label: L('Finalização', 'Finishing') },
  { key: 'fisico', label: L('Físico', 'Physical') },
  { key: 'tatico', label: L('Tático', 'Tactical') },
  { key: 'mentalidade', label: L('Mentalidade', 'Mentality') },
  { key: 'confianca', label: L('Confiança', 'Confidence') },
  { key: 'fairPlay', label: 'Fair play' },
];

type Step = 'identity' | 'tune' | 'review' | 'photo';

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
  return clampAttrsToCreationCap(attrs, pos);
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
  const academyUsed = useGameStore((s) => countActiveAcademyProspects(s.players));
  const academyCap = MAX_ACTIVE_ACADEMY_PROSPECTS;
  const academyFull = academyUsed >= academyCap;

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
  const [contractMatches, setContractMatches] = useState<ManagerProspectContractGames>(50);
  const [selectedPreset, setSelectedPreset] = useState('');
  /**
   * "Eu sou esse jogador" — marcado pede selfie e cai na fila admin pra gerar
   * arte premium; desmarcado = fictício, pula passo 4 e vai direto pro plantel
   * sem foto.
   */
  const [isSelfPlayer, setIsSelfPlayer] = useState(false);

  /** Corpo com scroll do modal — repõe-se ao topo no passo 2 (Afinar) para não saltar os sliders. */
  const modalBodyScrollRef = useRef<HTMLDivElement>(null);

  const applyAppearancePreset = useCallback((presetId: string) => {
    const preset = getPresetById(presetId);
    if (!preset) return;

    setPortraitStyleRegion(preset.region);
    setSkinTone(preset.skinToneId);
    setEyeColor(preset.eyeColor);
    setOriginTags(preset.originTags);
    setOriginText(preset.originTextTemplate);
    setSelectedPreset(presetId);

    // Aplicar cabelo
    if (preset.hairStyleId === 'careca') {
      setHairBald(true);
      setHairChoice('');
    } else {
      setHairBald(false);
      setHairChoice(preset.hairStyleId);
    }
  }, []);

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
    setContractMatches(50);
    setSelectedPreset('');
    setIsSelfPlayer(false);
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
    return overallFromAttributes(attrs, pos);
  }, [pos, behavior, age]);

  const previewOvrTune = useMemo(() => overallFromAttributes(tunedAttrs, pos), [tunedAttrs, pos]);

  const setAttrSlider = useCallback((key: keyof PlayerAttributes, raw: number) => {
    setTunedAttrs((prev) => {
      const next = {
        ...prev,
        [key]: Math.round(Math.min(MANAGER_PROSPECT_CREATE_MAX_ATTR, Math.max(35, raw))),
      };
      return clampAttrsToCreationCap(next, pos);
    });
  }, [pos]);

  const goTune = () => {
    setTunedAttrs(buildPresetAttrs(pos, behavior, age));
    setStep('tune');
  };

  const contractPremiumExp = managerProspectContractPremiumExp(contractMatches);
  const totalCreateCostExp = createCostExp + contractPremiumExp;
  const canAfford = oleBal >= totalCreateCostExp;
  const trimmed = name.trim();
  const namePolicy = useMemo(() => validateAcademyProspectName(trimmed), [trimmed]);
  const canAdvanceIdentity = trimmed.length >= 2 && namePolicy.ok;
  const heritageValid = originText.trim().length >= MANAGER_HERITAGE_ORIGIN_TEXT_MIN_LEN;
  const canSubmit = canAdvanceIdentity && canAfford && heritageValid && !academyFull;

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

  const [submitting, setSubmitting] = useState(false);
  const [generatingArt, setGeneratingArt] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  /** Constrói o payload final usado tanto na validação quanto no dispatch. */
  const buildPayload = (opts: { portraitUrl?: string; selfieUrl?: string }): ManagerProspectCreatePayload => ({
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
    contractMatches,
    ...(opts.portraitUrl ? { portraitUrl: opts.portraitUrl } : {}),
    ...(opts.selfieUrl ? { selfieUrl: opts.selfieUrl } : {}),
  });

  /**
   * Passo 3 → Passo 4 (foto). Valida server-side primeiro (P3); em sucesso
   * navega pra fase de captura de selfie. Sem server configurado (dev local
   * sem token), pula validação e segue direto pra foto.
   */
  const handleProceedToPhoto = async () => {
    if (!canSubmit || submitting) return;
    setServerError(null);
    setSubmitting(true);
    try {
      const sb = getSupabase();
      const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
      const base = olefootApiBase();
      const serverUrl = base && base !== 'http://localhost:4000' ? base : null;
      if (serverUrl && token) {
        const overall = overallFromAttributes(tunedAttrs, pos);
        let res: { ok: boolean; error?: string; cooldown_seconds?: number } | null = null;
        try {
          const r = await fetch(`${serverUrl}/api/academy/create`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              name: trimmed,
              pos,
              overall,
              contract_tier: contractMatches,
              heritage: {
                portraitStyleRegion,
                originText: originText.trim(),
                originTags: [...originTags],
              },
            }),
          });
          res = (await r.json()) as typeof res;
        } catch {
          setServerError(L('Falha de rede ao validar criação. Tenta novamente.', 'Network error while validating. Try again.'));
          return;
        }
        if (!res?.ok) {
          setServerError(res?.error ?? L('Não foi possível validar a criação.', 'Could not validate the player.'));
          return;
        }
      }
      // Validação ok.
      // Fictício → dispatch direto, pula passo 4. PlayerCard mostra iniciais.
      if (!isSelfPlayer) {
        dispatch({
          type: 'CREATE_MANAGER_PROSPECT',
          payload: { ...buildPayload({}), isFictional: true },
        });
        onClose();
        resetForm();
        return;
      }
      // "Sou esse jogador" → captura selfie no passo 4.
      setStep('photo');
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Modo CONCIERGE (default): faz upload da selfie no Pinata via
   * /api/academy/upload-selfie e dispatcha CREATE_MANAGER_PROSPECT com
   * selfieUrl. Prospect entra na fila do admin (não no plantel com foto
   * pronta) — admin gera a carta premium externamente e uploadeia depois
   * via AdminProspectArtPanel.
   *
   * Fluxo Freepik automatizado (/api/academy/generate-portrait) ainda está
   * deployado e funcional, mas não é chamado por aqui — qualidade premium
   * vence agilidade nesta fase.
   */
  const handleGeneratePortrait = async (selfieBlob: Blob) => {
    if (generatingArt) return;
    setServerError(null);
    setGeneratingArt(true);
    try {
      const sb = getSupabase();
      const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
      const base = olefootApiBase();
      const serverUrl = base && base !== 'http://localhost:4000' ? base : null;
      let selfieUrl: string | undefined;
      if (serverUrl && token) {
        const form = new FormData();
        form.append('selfie_image', selfieBlob, 'selfie.jpg');
        form.append('prospect_meta', JSON.stringify({ name: trimmed, pos }));
        let res: { ok: boolean; selfie_url?: string; error?: string; detail?: string } | null = null;
        let httpStatus: number | null = null;
        try {
          const r = await fetch(`${serverUrl}/api/academy/upload-selfie`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: form,
          });
          httpStatus = r.status;
          try {
            res = (await r.json()) as typeof res;
          } catch {
            const text = await r.text().catch(() => '');
            setServerError(
              L(`Servidor devolveu resposta inválida (HTTP ${r.status}). `, `Server returned an invalid response (HTTP ${r.status}). `) +
                (text.length > 0 ? text.slice(0, 200) : L('Endpoint pode não estar deployado ainda.', 'Endpoint may not be deployed yet.')),
            );
            return;
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : L('erro desconhecido', 'unknown error');
          setServerError(
            L(`Falha de rede ao enviar selfie: ${msg}. `, `Network error sending selfie: ${msg}. `) +
              L(`Verifica se o servidor está no ar (${serverUrl}/health).`, `Check if the server is up (${serverUrl}/health).`),
          );
          return;
        }
        if (!res?.ok || !res.selfie_url) {
          const httpInfo = httpStatus ? ` [HTTP ${httpStatus}]` : '';
          const detail = res?.detail ? ` (${res.detail})` : '';
          setServerError(`${res?.error ?? L('Falha no upload da selfie.', 'Selfie upload failed.')}${httpInfo}${detail}`);
          return;
        }
        selfieUrl = res.selfie_url;
      }
      // Dispatcha com selfieUrl (modo concierge — vai pra queue do admin).
      // Sem portraitUrl → reducer cria entry em managerProspectArtQueue.
      dispatch({ type: 'CREATE_MANAGER_PROSPECT', payload: buildPayload({ selfieUrl }) });
      onClose();
      resetForm();
    } finally {
      setGeneratingArt(false);
    }
  };

  const stepLabel =
    step === 'identity' ? L('1 · Ficha', '1 · Profile')
    : step === 'tune' ? L('2 · Atributos', '2 · Attributes')
    : step === 'review' ? L('3 · Revisão', '3 · Review')
    : L('4 · Foto', '4 · Photo');

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex min-h-0 flex-col justify-end bg-black/85 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-8 sm:items-center sm:justify-center sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="relative mx-auto flex max-h-[min(92dvh,920px)] w-full max-w-lg flex-col overflow-hidden border border-white/16 bg-panel sm:max-w-2xl"
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <Sparkles className="h-5 w-5 shrink-0 text-neon-yellow" aria-hidden />
                <div className="min-w-0">
                  <h3 className="font-impact text-[17px] uppercase leading-[1.1] text-white">
                    {L('Academia OLE', 'OLE Academy')}
                  </h3>
                  <p className="text-[10px] text-gray-500">
                    {stepLabel} · {L('criação OVR', 'creation OVR')} ≤ {MANAGER_PROSPECT_CREATE_MAX_OVR} · {L('evolução até', 'evolves up to')}{' '}
                    {MANAGER_PROSPECT_EVOLVED_MAX_OVR}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  title={
                    academyFull
                      ? L(`Academia cheia (${academyUsed}/${academyCap}). Vende um prospect ao Market Maker pra liberar slot.`, `Academy full (${academyUsed}/${academyCap}). Sell a prospect to the Market Maker to free a slot.`)
                      : L(`Slots da Academia: ${academyUsed}/${academyCap}`, `Academy slots: ${academyUsed}/${academyCap}`)
                  }
                  className={cn(
                    'inline-flex items-center gap-1 rounded border px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider',
                    academyFull
                      ? 'border-red-500/50 bg-red-900/30 text-red-300'
                      : 'border-neon-yellow/40 bg-neon-yellow/10 text-neon-yellow',
                  )}
                >
                  SLOT {academyUsed}/{academyCap}
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label={L('Fechar', 'Close')}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {academyFull && (
              <div className="border-b border-red-500/40 bg-red-950/40 px-4 py-3 text-[12px] text-red-200">
                {emIngles() ? (
                  <>
                    Academy full ({academyUsed}/{academyCap}). Sell a prospect to the{' '}
                    <span className="font-bold">Market Maker</span> ("List" button on the player card)
                    to free a slot and create another.
                  </>
                ) : (
                  <>
                    Academia cheia ({academyUsed}/{academyCap}). Vende um prospect ao{' '}
                    <span className="font-bold">Market Maker</span> (botão "Anunciar" no card do jogador)
                    para liberar slot e criar outro.
                  </>
                )}
              </div>
            )}

            <div
              ref={modalBodyScrollRef}
              className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain px-4 py-4"
            >
              {step === 'identity' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsSelfPlayer((v) => !v)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors',
                      isSelfPlayer
                        ? 'border-neon-yellow/60 bg-neon-yellow/10'
                        : 'border-white/15 bg-black/40 hover:border-white/30',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                        isSelfPlayer ? 'border-neon-yellow bg-neon-yellow' : 'border-white/40 bg-transparent',
                      )}
                      aria-hidden
                    >
                      {isSelfPlayer ? <span className="block h-2 w-2 rounded-sm bg-black" /> : null}
                    </span>
                    <span className="flex-1 space-y-0.5">
                      <span className="block font-display text-[12px] font-black uppercase tracking-wide text-white">
                        {L('Eu sou esse jogador', 'I am this player')}
                      </span>
                      <span className="block text-[10px] leading-relaxed text-gray-400">
                        {isSelfPlayer
                          ? L('No fim a gente pede tua selfie pra gerar um cartão premium com tua cara.', 'At the end we ask for your selfie to make a premium card with your face.')
                          : L('Jogador fictício — só atributos, sem foto. Pula a etapa de selfie e entra direto no plantel.', 'Fictional player — attributes only, no photo. Skips the selfie step and joins the squad right away.')}
                      </span>
                    </span>
                  </button>

                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{L('OVR estimado', 'Estimated OVR')}</span>
                    <span className="font-display text-2xl font-black text-neon-yellow">{previewOvrIdentity}</span>
                  </div>
                  <p className="text-[10px] leading-relaxed text-gray-500">
                    {L(
                      `A seguir afinas atributos; na criação o teto é OVR ${MANAGER_PROSPECT_CREATE_MAX_OVR} (treinos e jogos podem evoluir até ${MANAGER_PROSPECT_EVOLVED_MAX_OVR}).`,
                      `Next you fine-tune attributes; the creation cap is OVR ${MANAGER_PROSPECT_CREATE_MAX_OVR} (training and matches can raise it up to ${MANAGER_PROSPECT_EVOLVED_MAX_OVR}).`,
                    )}
                  </p>

                  <label className="block space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{L('Nome no cartão', 'Name on card')}</span>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value.toUpperCase())}
                      maxLength={24}
                      placeholder={L('EX.: COSTA', 'E.G.: COSTA')}
                      className={cn(
                        'w-full rounded-lg border bg-black/50 px-3 py-2 font-display text-sm font-bold uppercase text-white outline-none focus:border-neon-yellow',
                        trimmed.length >= 2 && !namePolicy.ok ? 'border-red-500/50' : 'border-white/15',
                      )}
                      aria-invalid={trimmed.length >= 2 && !namePolicy.ok}
                    />
                    {trimmed.length >= 2 && 'reason' in namePolicy ? (
                      <p className="text-[10px] leading-snug text-red-300/90">{namePolicy.reason}</p>
                    ) : null}
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{L('Idade', 'Age')}</span>
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
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{L('Nacionalidade', 'Nationality')}</span>
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
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{L('Pé bom', 'Strong foot')}</span>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          { id: 'right' as const, label: L('Direito', 'Right') },
                          { id: 'left' as const, label: L('Esquerdo', 'Left') },
                          { id: 'both' as const, label: L('Ambos', 'Both') },
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
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{L('Posição', 'Position')}</span>
                    <select
                      value={pos}
                      onChange={(e) => setPos(e.target.value as (typeof POSITIONS)[number])}
                      className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 font-display text-xs font-bold text-white outline-none focus:border-neon-yellow"
                    >
                      {POSITIONS.map((p) => (
                        <option key={p} value={p}>
                          {posLabel(p)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="space-y-2 rounded-lg border border-white/10 bg-black/30 p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      {L('Contrato (jogos)', 'Contract (matches)')}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {MANAGER_PROSPECT_CONTRACT_GAMES.map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setContractMatches(n)}
                          className={cn(
                            'rounded-lg border px-2 py-1 text-[10px] font-bold uppercase',
                            contractMatches === n
                              ? 'border-neon-yellow bg-neon-yellow/15 text-neon-yellow'
                              : 'border-white/15 text-gray-400 hover:border-white/30 hover:text-white',
                          )}
                        >
                          {n}
                          {managerProspectContractPremiumExp(n) > 0
                            ? ` (+${formatExp(managerProspectContractPremiumExp(n))})`
                            : ''}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] leading-relaxed text-gray-500">
                      {L(
                        'Amistosos e oficiais contam por jogo; ao fim do contrato o jogador fica indisponível para XI oficial.',
                        'Friendlies and official matches count per game; when the contract ends the player is unavailable for the official XI.',
                      )}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{L('Característica', 'Style')}</span>
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
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{L('OVR com estes valores', 'OVR with these values')}</span>
                    <span className="font-display text-2xl font-black text-neon-yellow">{previewOvrTune}</span>
                  </div>
                  <p className="text-[10px] leading-relaxed text-gray-500">
                    {L(
                      `Barras de 35 a ${MANAGER_PROSPECT_CREATE_MAX_ATTR}; o clube equilibra para não passar de OVR ${MANAGER_PROSPECT_CREATE_MAX_OVR} na ficha (evolução futura até ${MANAGER_PROSPECT_EVOLVED_MAX_OVR}).`,
                      `Bars from 35 to ${MANAGER_PROSPECT_CREATE_MAX_ATTR}; the club balances them so the profile stays at or below OVR ${MANAGER_PROSPECT_CREATE_MAX_OVR} (future growth up to ${MANAGER_PROSPECT_EVOLVED_MAX_OVR}).`,
                    )}
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
                          max={MANAGER_PROSPECT_CREATE_MAX_ATTR}
                          value={tunedAttrs[key]}
                          onChange={(e) => setAttrSlider(key, Number(e.target.value))}
                          className="h-2 w-full accent-neon-yellow"
                        />
                      </label>
                    ))}
                  </div>

                  <div className="space-y-3 rounded-lg border border-neon-yellow/25 bg-neon-yellow/[0.04] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-neon-yellow">
                          {L('Origem para o retrato (obrigatório)', 'Origin for the portrait (required)')}
                        </p>
                        <p className="text-[9px] leading-relaxed text-gray-500">
                          {L('Guia o desenho do rosto; não muda a nacionalidade da ficha.', 'Guides how the face is drawn; does not change the nationality.')}
                        </p>
                      </div>
                    </div>

                    {/* Presets de aparência */}
                    <div className="space-y-2 rounded-lg border border-white/10 bg-black/30 p-2">
                      <div className="flex items-center gap-1.5">
                        <Wand2 className="h-3 w-3 text-neon-yellow" />
                        <span className="text-[9px] font-bold uppercase text-white/80">{L('Presets rápidos', 'Quick presets')}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {APPEARANCE_PRESETS.slice(0, 6).map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => applyAppearancePreset(preset.id)}
                            className={cn(
                              'rounded border px-2 py-1.5 text-left text-[9px] font-bold transition-colors',
                              selectedPreset === preset.id
                                ? 'border-neon-yellow bg-neon-yellow/20 text-neon-yellow'
                                : 'border-white/15 text-white/70 hover:border-white/30 hover:bg-white/5',
                            )}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-[8px] text-gray-600">
                        {L('Aplica origem, aparência e região automaticamente', 'Applies origin, appearance and region automatically')}
                      </p>
                    </div>
                    <label className="block space-y-1">
                      <span className="text-[9px] font-bold uppercase text-gray-500">{L('Estilo do retrato', 'Portrait style')}</span>
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
                      <span className="text-[9px] font-bold uppercase text-gray-500">{L('Marcadores (opcional)', 'Tags (optional)')}</span>
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
                            {rotuloOrigem(tag)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="block space-y-1">
                      <span className="text-[9px] font-bold uppercase text-gray-500">{L('Descrição', 'Description')}</span>
                      <textarea
                        value={originText}
                        onChange={(e) => setOriginText(e.target.value)}
                        rows={3}
                        placeholder={L('Ex.: Brasil, ascendência cabo-verdiana.', 'E.g.: Brazil, Cape Verdean descent.')}
                        className={cn(
                          'w-full resize-none rounded-lg border bg-black/50 px-2 py-2 text-xs text-white outline-none focus:border-neon-yellow',
                          heritageValid ? 'border-white/15' : 'border-atencao/40',
                        )}
                      />
                      <span className="text-[9px] text-gray-600">
                        {L('Mín.', 'Min.')} {MANAGER_HERITAGE_ORIGIN_TEXT_MIN_LEN} {L('caracteres', 'characters')} · {originText.trim().length}/
                        {MANAGER_HERITAGE_ORIGIN_TEXT_MIN_LEN}
                      </span>
                    </label>
                  </div>

                  <div className="space-y-2 rounded-lg border border-white/10 bg-black/25 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      {L('Aparência (opcional)', 'Appearance (optional)')}
                    </p>
                    <p className="text-[9px] text-gray-600">
                      {L('Pele, olhos e cabelo ajudam o retrato. Em «Detalhe», tatuagem ou cicatriz, se quiseres.', 'Skin, eyes and hair help the portrait. Use «Detail» for a tattoo or scar, if you like.')}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="block space-y-1">
                        <span className="text-[9px] font-bold uppercase text-gray-500">{L('Tom de pele', 'Skin tone')}</span>
                        <select
                          value={skinTone}
                          onChange={(e) => setSkinTone(e.target.value)}
                          className="w-full rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-xs font-bold text-white outline-none focus:border-neon-yellow"
                        >
                          <option value="">{L('Não especificar', 'Not specified')}</option>
                          {MANAGER_SKIN_TONES.map((s) => (
                            <option key={s.id} value={s.id}>
                              {skinToneSelectLabel(s)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block space-y-1">
                        <span className="text-[9px] font-bold uppercase text-gray-500">{L('Cor dos olhos', 'Eye colour')}</span>
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
                        <span className="text-[9px] font-bold uppercase text-gray-500">{L('Estilo do cabelo', 'Hair style')}</span>
                        <select
                          value={hairChoice}
                          onChange={(e) => setHairChoice(e.target.value)}
                          disabled={hairBald}
                          className={cn(
                            'w-full rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-xs font-bold text-white outline-none focus:border-neon-yellow',
                            hairBald && 'cursor-not-allowed opacity-45',
                          )}
                        >
                          <option value="">{L('Não especificar', 'Not specified')}</option>
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
                        <span className="text-[11px] font-bold text-white/90">{L('Sem cabelo (careca)', 'No hair (bald)')}</span>
                      </label>
                      <label className="block space-y-1 sm:col-span-2">
                        <span className="text-[9px] font-bold uppercase text-gray-500">{L('Detalhe', 'Detail')}</span>
                        <input
                          value={extraDetails}
                          onChange={(e) => setExtraDetails(e.target.value)}
                          placeholder={L('Ex.: tatuagem de um cruz no pescoço', 'E.g.: cross tattoo on the neck')}
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
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{L('Antes de criar', 'Before creating')}</span>
                    <span className="font-display text-2xl font-black text-neon-yellow">{previewOvrTune}</span>
                  </div>
                  <dl className="space-y-2 rounded-lg border border-white/10 bg-black/30 p-3 text-xs">
                    <div className="flex justify-between gap-2">
                      <dt className="text-gray-500">{L('Nome', 'Name')}</dt>
                      <dd className="font-display font-bold text-white">{trimmed}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-gray-500">{L('Posição e idade', 'Position and age')}</dt>
                      <dd className="text-white">
                        {posLabel(pos)} · {age}{L('a', 'y')}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-gray-500">{L('País e pé', 'Country and foot')}</dt>
                      <dd className="text-white">
                        {country} · {strongFoot === 'right' ? L('Direito', 'Right') : strongFoot === 'left' ? L('Esquerdo', 'Left') : L('Ambos', 'Both')}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-gray-500">{L('Perfil', 'Profile')}</dt>
                      <dd className="text-white">{BEHAVIORS.find((b) => b.id === behavior)?.label}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-gray-500">{L('Contrato', 'Contract')}</dt>
                      <dd className="text-white">
                        {contractMatches} {L('jogos', 'matches')}
                        {contractPremiumExp > 0 ? ` · +${formatExp(contractPremiumExp)} EXP` : null}
                      </dd>
                    </div>
                    <div className="border-t border-white/10 pt-2 text-[10px] text-white/80">
                      <div className="font-bold uppercase text-neon-yellow/90">{L('Origem (retrato)', 'Origin (portrait)')}</div>
                      <div className="mt-1 text-gray-400">
                        {L('Estilo', 'Style')}: <span className="text-white">{PORTRAIT_STYLE_REGION_LABELS[portraitStyleRegion]}</span>
                      </div>
                      {originTags.length ? (
                        <div className="mt-1 text-gray-400">
                          {L('Marcadores', 'Tags')}: <span className="text-white">{originTags.map(rotuloOrigem).join(', ')}</span>
                        </div>
                      ) : null}
                      <p className="mt-1 leading-relaxed text-white/90">{originText.trim()}</p>
                    </div>
                    {visualBrief ? (
                      <div className="border-t border-white/10 pt-2 text-[10px] text-white/70">
                        <div className="font-bold uppercase text-gray-500">{L('Aparência', 'Appearance')}</div>
                        {skinTone ? (
                          <div>
                            {L('Tom de pele', 'Skin tone')}: {(() => { const t = MANAGER_SKIN_TONES.find((s) => s.id === skinTone); return t ? skinToneDisplayName(t) : skinTone; })()}
                          </div>
                        ) : null}
                        {visualBrief.eyeColor ? <div>{L('Olhos', 'Eyes')}: {EYE_COLOR_CHOICES.find((o) => o.value === visualBrief.eyeColor)?.label ?? visualBrief.eyeColor}</div> : null}
                        {hairBald ? (
                          <div>{L('Cabelo: careca', 'Hair: bald')}</div>
                        ) : hairChoice ? (
                          <div>{L('Cabelo', 'Hair')}: {hairDisplayLabel ?? hairChoice}</div>
                        ) : null}
                        {visualBrief.extraDetails ? <div>{L('Detalhe', 'Detail')}: {visualBrief.extraDetails}</div> : null}
                      </div>
                    ) : (
                      <div className="border-t border-white/10 pt-2 text-[10px] text-gray-500">{L('Sem extras de aparência', 'No appearance extras')}</div>
                    )}
                  </dl>
                  <p className="text-[10px] leading-relaxed text-gray-500">
                    {L('Próximo passo: tira uma foto pra IA estilizar a carta do teu jogador.', 'Next step: take a photo so the AI can style your player card.')}
                  </p>
                </>
              ) : null}

              {step === 'photo' ? (
                <>
                  {serverError ? (
                    <div className="rounded border border-red-500/40 bg-red-950/40 px-3 py-2 text-[12px] text-red-200">
                      {serverError}
                    </div>
                  ) : null}
                  {generatingArt ? (
                    <div className="flex flex-col items-center justify-center gap-3 rounded border border-neon-yellow/40 bg-neon-yellow/5 p-8 text-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-neon-yellow border-t-transparent" />
                      <p className="text-sm text-white/90">{L('Enviando selfie…', 'Sending selfie…')}</p>
                      <p className="text-[11px] text-white/60">
                        {L('Tua carta premium é feita à mão e entregue em breve no plantel.', 'Your premium card is handmade and will be delivered to your squad soon.')}
                      </p>
                    </div>
                  ) : (
                    <AcademyPhotoCapture
                      onCaptured={(blob) => void handleGeneratePortrait(blob)}
                      onCancel={() => setStep('review')}
                    />
                  )}
                </>
              ) : null}

              {step !== 'photo' ? (
                <div
                  className={cn(
                    'rounded-lg border px-3 py-2 text-[10px]',
                    canAfford ? 'border-white/10 bg-black/30 text-gray-400' : 'border-red-500/40 bg-red-950/30 text-red-200',
                  )}
                >
                  {L('Custo base:', 'Base cost:')}{' '}
                <span className="font-display font-black text-neon-yellow">{formatExp(createCostExp)} EXP</span>
                {contractPremiumExp > 0 ? (
                  <>
                    {' · '}
                    {L('prémio contrato:', 'contract premium:')}{' '}
                    <span className="font-display font-bold text-white/90">{formatExp(contractPremiumExp)} EXP</span>
                  </>
                ) : null}
                {' · '}
                {L('total:', 'total:')}{' '}
                <span className="font-display font-black text-neon-yellow">{formatExp(totalCreateCostExp)} EXP</span>
                {' · '}
                {L('Saldo:', 'Balance:')} <span className="text-white">{formatExp(oleBal)} EXP</span>
                {!canAfford ? <span className="mt-1 block">{L('EXP não chega.', 'Not enough EXP.')}</span> : null}
                </div>
              ) : null}
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
                  {L('Avançar', 'Next')}
                </button>
              ) : null}
              {step === 'tune' ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep('identity')}
                    className="flex shrink-0 items-center justify-center rounded-lg border border-white/20 px-3 py-3 text-white/80 hover:bg-white/10"
                    aria-label={L('Voltar', 'Back')}
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
                    {L('Rever', 'Review')}
                  </button>
                </div>
              ) : null}
              {step === 'review' ? (
                <div className="flex flex-col gap-2">
                  {serverError ? (
                    <div className="rounded border border-red-500/40 bg-red-950/40 px-3 py-2 text-[12px] text-red-200">
                      {serverError}
                    </div>
                  ) : null}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setStep('tune')}
                      disabled={submitting}
                      className="flex shrink-0 items-center justify-center rounded-lg border border-white/20 px-3 py-3 text-white/80 hover:bg-white/10 disabled:opacity-40"
                      aria-label={L('Voltar', 'Back')}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      disabled={!canSubmit || submitting}
                      onClick={handleProceedToPhoto}
                      className={cn(
                        'btn-primary flex-1 py-3 font-display text-sm font-black uppercase tracking-wide',
                        (!canSubmit || submitting) && 'pointer-events-none opacity-40',
                      )}
                    >
                      {submitting ? L('Validando…', 'Validating…') : L('Continuar pra foto →', 'Continue to photo →')}
                    </button>
                  </div>
                </div>
              ) : null}

              {/* step === 'photo': UI fica no body (AcademyPhotoCapture tem
                 controles próprios). Bottom dispensa botão extra. */}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
