import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ClipboardCopy,
  Loader2,
  Save,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { useGameDispatch, useGameStore } from '@/game/store';
import { overallFromAttributes } from '@/entities/player';
import { canMintCardSupply, newCollectionId, remainingCollectionSupply } from '@/entities/cardCollectionUtils';
import type {
  CardCollection,
  PlayerArchetype,
  PlayerAttributes,
  PlayerBehavior,
  PlayerCreatorType,
  PlayerRarity,
  PlayerStrongFoot,
} from '@/entities/types';
import { playerPortraitSrc } from '@/lib/playerPortrait';
import { countryCodeToFlagEmoji } from '@/lib/flagEmoji';
import { cn } from '@/lib/utils';
import {
  buildPlayerEntityFromDraft,
  interpretPlayerPromptGameSpirit,
  type GameSpiritPlayerDraft,
} from '@/gamespirit/admin/playerFromPrompt';
import {
  CREATE_PLAYER_CREATOR_TYPES,
  CREATE_PLAYER_INTEGRATION_COPYPASTA,
  CREATE_PLAYER_RARITIES,
  CREATE_PLAYER_WIZARD_STEPS,
} from '@/gamespirit/admin/createPlayerIntegrationReference';

const POS_OPTS = ['GOL', 'ZAG', 'LE', 'LD', 'VOL', 'MC', 'PE', 'PD', 'ATA'] as const;

const FOOT_OPTS: { value: PlayerStrongFoot; label: string }[] = [
  { value: 'right', label: 'Direito' },
  { value: 'left', label: 'Esquerdo' },
  { value: 'both', label: 'Ambidestro' },
];

const CREATOR_TYPE_LABELS: Record<PlayerCreatorType, string> = {
  novo_talento: 'Novo talento',
  campeao: 'Campeão',
  amador: 'Amador',
  olefoot: 'Olefoot',
  lenda: 'Lenda',
};

const RARITY_LABELS: Record<PlayerRarity, string> = {
  normal: 'Normal',
  premium: 'Premium',
  bronze: 'Bronze',
  prata: 'Prata',
  ouro: 'Ouro',
  raro: 'Raro',
  ultra_raro: 'Ultra raro',
  epico: 'Épico',
};

const ARCH_OPTS: PlayerArchetype[] = ['profissional', 'novo_talento', 'lenda', 'meme', 'ai_plus'];

const BEH_OPTS: PlayerBehavior[] = ['equilibrado', 'ofensivo', 'defensivo', 'criativo'];

const ATTR_KEYS: (keyof PlayerAttributes)[] = [
  'passe',
  'marcacao',
  'velocidade',
  'drible',
  'finalizacao',
  'fisico',
  'tatico',
  'mentalidade',
  'confianca',
  'fairPlay',
];

const TOTAL_STEPS = 9;

const CREATE_PLAYER_STORAGE_KEY = 'olefoot-admin-create-player-v1';

type NftCollectionMode = 'off' | 'existing' | 'new';

type PersistedCreatePlayerV1 = {
  v: 1;
  step: number;
  nome: string;
  posicao: string;
  pais: string;
  tipoJogador: PlayerCreatorType;
  raridade: PlayerRarity;
  peBom: PlayerStrongFoot;
  nftMode: NftCollectionMode;
  selectedCollectionId: string;
  newColName: string;
  newColMaxSupply: string;
  cardSupplyInput: string;
  portraitDataUrl: string;
  promptAtributos: string;
  draft: GameSpiritPlayerDraft | null;
  savedPlayerId: string | null;
  marketBro: string;
  marketLaunchedOk: boolean;
};

function broInputToCents(s: string): number | null {
  const t = s.replace(',', '.').trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function nextFreeShirtNumber(players: Record<string, { num: number }>): number {
  const used = new Set(Object.values(players).map((p) => p.num));
  for (let n = 1; n <= 99; n++) {
    if (!used.has(n)) return n;
  }
  return 99;
}

function newAdminPlayerId(): string {
  return `p-admin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function clampNum(raw: string, min: number, max: number): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function normalizeArchetypeSelect(s: string | undefined): PlayerArchetype {
  const t = (s ?? '').toLowerCase().trim();
  return ARCH_OPTS.includes(t as PlayerArchetype) ? (t as PlayerArchetype) : 'novo_talento';
}

function normalizeBehaviorSelect(s: string | undefined): PlayerBehavior {
  const t = (s ?? '').toLowerCase().trim();
  return BEH_OPTS.includes(t as PlayerBehavior) ? (t as PlayerBehavior) : 'equilibrado';
}

/** Rascunho mínimo a partir do wizard (passos 1–4) para editar no preview sem ter corrido o GameSpirit. */
function buildDraftFromWizard(p: {
  nome: string;
  posicao: string;
  pais: string;
  tipoJogador: PlayerCreatorType;
  raridade: PlayerRarity;
  peBom: PlayerStrongFoot;
}): GameSpiritPlayerDraft {
  const name = p.nome.trim() || 'Jogador';
  return {
    name,
    pos: p.posicao,
    country: p.pais.trim() || undefined,
    creatorType: p.tipoJogador,
    rarity: p.raridade,
    strongFoot: p.peBom,
    archetype: 'novo_talento',
    behavior: 'equilibrado',
    bio: '',
    attrs: {},
  };
}

function draftAttrsComplete(attrs: Partial<PlayerAttributes> | undefined): boolean {
  if (!attrs) return false;
  return ATTR_KEYS.every((k) => {
    const v = attrs[k];
    return typeof v === 'number' && v >= 40 && v <= 99;
  });
}

function mergeDraftWithWizard(
  d: GameSpiritPlayerDraft,
  w: {
    nome: string;
    posicao: string;
    pais: string;
    tipoJogador: PlayerCreatorType;
    raridade: PlayerRarity;
    peBom: PlayerStrongFoot;
  },
): GameSpiritPlayerDraft {
  return {
    ...d,
    name: d.name.trim() || w.nome.trim() || d.name,
    pos: d.pos || w.posicao,
    country: d.country?.trim() ? d.country : w.pais.trim() || d.country,
    creatorType: d.creatorType ?? w.tipoJogador,
    rarity: d.rarity ?? w.raridade,
    strongFoot: d.strongFoot ?? w.peBom,
  };
}

export function AdminCreatePlayerPanel() {
  const dispatch = useGameDispatch();
  const players = useGameStore((s) => s.players);
  const cardCollections = useGameStore((s) => s.cardCollections);

  const [step, setStep] = useState(1);
  const [nome, setNome] = useState('');
  const [posicao, setPosicao] = useState<string>('MC');
  const [pais, setPais] = useState('');
  const [tipoJogador, setTipoJogador] = useState<PlayerCreatorType>('novo_talento');
  const [raridade, setRaridade] = useState<PlayerRarity>('normal');
  const [nftMode, setNftMode] = useState<NftCollectionMode>('off');
  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [newColName, setNewColName] = useState('');
  const [newColMaxSupply, setNewColMaxSupply] = useState('1000');
  const [cardSupplyInput, setCardSupplyInput] = useState('1');
  const [peBom, setPeBom] = useState<PlayerStrongFoot>('right');
  const [portraitDataUrl, setPortraitDataUrl] = useState('');
  const [promptAtributos, setPromptAtributos] = useState('');
  const [draft, setDraft] = useState<GameSpiritPlayerDraft | null>(null);
  const [savedPlayerId, setSavedPlayerId] = useState<string | null>(null);
  const [marketBro, setMarketBro] = useState('');
  const [marketLaunchedOk, setMarketLaunchedOk] = useState(false);

  const [spiritNotes, setSpiritNotes] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyOk, setCopyOk] = useState(false);
  const [profileSaveMsg, setProfileSaveMsg] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CREATE_PLAYER_STORAGE_KEY);
      if (!raw) {
        setHydrated(true);
        return;
      }
      const data = JSON.parse(raw) as PersistedCreatePlayerV1;
      if (data.v !== 1) {
        setHydrated(true);
        return;
      }
      setStep(Math.min(TOTAL_STEPS, Math.max(1, data.step)));
      setNome(data.nome ?? '');
      setPosicao(data.posicao ?? 'MC');
      setPais(data.pais ?? '');
      setTipoJogador(data.tipoJogador ?? 'novo_talento');
      setRaridade(data.raridade ?? 'normal');
      setNftMode(data.nftMode ?? 'off');
      setSelectedCollectionId(data.selectedCollectionId ?? '');
      setNewColName(data.newColName ?? '');
      setNewColMaxSupply(data.newColMaxSupply ?? '1000');
      setCardSupplyInput(data.cardSupplyInput ?? '1');
      setPeBom(data.peBom ?? 'right');
      setPortraitDataUrl(data.portraitDataUrl ?? '');
      setPromptAtributos(data.promptAtributos ?? '');
      setDraft(data.draft ?? null);
      setSavedPlayerId(data.savedPlayerId ?? null);
      setMarketBro(data.marketBro ?? '');
      setMarketLaunchedOk(data.marketLaunchedOk ?? false);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const saveProfileToStorage = useCallback(
    (patch?: Partial<PersistedCreatePlayerV1>) => {
      const payload: PersistedCreatePlayerV1 = {
        v: 1,
        step: patch?.step ?? step,
        nome: patch?.nome ?? nome,
        posicao: patch?.posicao ?? posicao,
        pais: patch?.pais ?? pais,
        tipoJogador: patch?.tipoJogador ?? tipoJogador,
        raridade: patch?.raridade ?? raridade,
        nftMode: patch?.nftMode ?? nftMode,
        selectedCollectionId: patch?.selectedCollectionId ?? selectedCollectionId,
        newColName: patch?.newColName ?? newColName,
        newColMaxSupply: patch?.newColMaxSupply ?? newColMaxSupply,
        cardSupplyInput: patch?.cardSupplyInput ?? cardSupplyInput,
        peBom: patch?.peBom ?? peBom,
        portraitDataUrl: patch?.portraitDataUrl ?? portraitDataUrl,
        promptAtributos: patch?.promptAtributos ?? promptAtributos,
        draft: patch?.draft !== undefined ? patch.draft : draft,
        savedPlayerId: patch?.savedPlayerId !== undefined ? patch.savedPlayerId : savedPlayerId,
        marketBro: patch?.marketBro ?? marketBro,
        marketLaunchedOk: patch?.marketLaunchedOk ?? marketLaunchedOk,
      };
      try {
        localStorage.setItem(CREATE_PLAYER_STORAGE_KEY, JSON.stringify(payload));
        setProfileSaveMsg('Perfil guardado neste dispositivo.');
        window.setTimeout(() => setProfileSaveMsg(null), 2500);
      } catch {
        setProfileSaveMsg('Não foi possível guardar (armazenamento cheio ou bloqueado).');
        window.setTimeout(() => setProfileSaveMsg(null), 3500);
      }
    },
    [
      step,
      nome,
      posicao,
      pais,
      tipoJogador,
      raridade,
      nftMode,
      selectedCollectionId,
      newColName,
      newColMaxSupply,
      cardSupplyInput,
      peBom,
      portraitDataUrl,
      promptAtributos,
      draft,
      savedPlayerId,
      marketBro,
      marketLaunchedOk,
    ],
  );

  const profileCompletion = useMemo(() => {
    const nameOk = (draft?.name ?? nome).trim().length > 0;
    const countryOk = (draft?.country ?? pais).trim().length > 0;
    const photoOk = portraitDataUrl.trim().length > 0;
    const draftOk = draft != null;
    const sheetOk =
      draft != null && draftAttrsComplete(draft.attrs) && (draft.bio?.trim() ?? '').length > 0;
    const savedOk = savedPlayerId != null;
    const segments = [nameOk, countryOk, photoOk, draftOk, sheetOk, savedOk];
    const done = segments.filter(Boolean).length;
    const pct = Math.round((done / segments.length) * 100);
    return { pct, segments: { nameOk, countryOk, photoOk, draftOk, sheetOk, savedOk }, done, total: segments.length };
  }, [draft, nome, pais, portraitDataUrl, savedPlayerId]);

  const isProfileComplete = profileCompletion.pct === 100;

  const collectionList = useMemo(
    () => Object.values(cardCollections).sort((a, b) => a.name.localeCompare(b.name)),
    [cardCollections],
  );

  const geminiCollectionSummary = useMemo(() => {
    if (nftMode === 'off') return undefined;
    const supply = cardSupplyInput.trim() || '—';
    if (nftMode === 'new') {
      const mx = newColMaxSupply.trim() || '—';
      const nm = newColName.trim() || '(sem nome)';
      return `Nova coleção «${nm}», max supply ${mx}; fornecimento desta carta: ${supply}`;
    }
    const c = selectedCollectionId ? cardCollections[selectedCollectionId] : undefined;
    if (!c) return `Coleção existente; fornecimento desta carta: ${supply}`;
    return `Coleção «${c.name}» (max ${c.maxSupply}); fornecimento desta carta: ${supply}`;
  }, [nftMode, newColName, newColMaxSupply, cardSupplyInput, selectedCollectionId, cardCollections]);

  const existingCollection = selectedCollectionId ? cardCollections[selectedCollectionId] : undefined;
  const remainingInExisting =
    existingCollection != null
      ? remainingCollectionSupply(existingCollection, players, savedPlayerId ?? undefined)
      : 0;

  useEffect(() => {
    if (!hydrated) return;
    if (step !== 7 && step !== 8) return;
    setDraft((d) => {
      if (d) return d;
      return buildDraftFromWizard({ nome, posicao, pais, tipoJogador, raridade, peBom });
    });
  }, [hydrated, step, nome, posicao, pais, tipoJogador, raridade, peBom]);

  const previewEntity = useMemo(() => {
    if (!draft) return null;
    const num = draft.num ?? nextFreeShirtNumber(players);
    const mint = Math.floor(Number(cardSupplyInput));
    const mintOk = Number.isFinite(mint) && mint >= 1;
    let collectionId: string | undefined;
    let cardSupply: number | undefined;
    if (nftMode === 'existing' && existingCollection && mintOk) {
      collectionId = existingCollection.id;
      cardSupply = mint;
    }
    return buildPlayerEntityFromDraft(draft, {
      id: 'preview',
      num,
      portraitUrl: portraitDataUrl || undefined,
      marketValueBroCents: broInputToCents(marketBro) ?? undefined,
      listedOnMarket: false,
      collectionId,
      cardSupply,
    });
  }, [
    draft,
    players,
    portraitDataUrl,
    marketBro,
    nftMode,
    existingCollection,
    cardSupplyInput,
  ]);

  const runGameSpirit = async () => {
    setError(null);
    setSpiritNotes(null);
    setLoading(true);
    try {
      const r = await interpretPlayerPromptGameSpirit(promptAtributos, {
        name: nome.trim(),
        pos: posicao,
        country: pais.trim(),
        creatorType: tipoJogador,
        rarity: raridade,
        strongFoot: peBom,
        collectionSummary: geminiCollectionSummary,
      });
      if (r.ok === true) {
        setDraft(r.draft);
        setSpiritNotes(r.draft.spiritNotes ?? null);
      } else {
        setError(r.error);
        setDraft(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const onPickPhoto = useCallback((file: File | null) => {
    if (!file || !file.type.startsWith('image/')) {
      setPortraitDataUrl('');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setPortraitDataUrl(reader.result);
    };
    reader.readAsDataURL(file);
  }, []);

  const updateDraft = (patch: Partial<GameSpiritPlayerDraft>) => {
    setDraft((f) => (f ? { ...f, ...patch } : f));
  };

  const patchCreatorMeta = (patch: Partial<{ creatorType: PlayerCreatorType; rarity: PlayerRarity }>) => {
    if (patch.creatorType !== undefined) setTipoJogador(patch.creatorType);
    if (patch.rarity !== undefined) setRaridade(patch.rarity);
    setDraft((f) => (f ? { ...f, ...patch } : f));
  };

  const setPeBomSync = (v: PlayerStrongFoot) => {
    setPeBom(v);
    setDraft((f) => (f ? { ...f, strongFoot: v } : f));
  };

  const updateAttr = (key: keyof PlayerAttributes, val: number) => {
    setDraft((f) => {
      if (!f) return f;
      const attrs = { ...f.attrs, [key]: val };
      return { ...f, attrs };
    });
  };

  const copyIntegrationScript = () => {
    void navigator.clipboard.writeText(CREATE_PLAYER_INTEGRATION_COPYPASTA);
    setCopyOk(true);
    window.setTimeout(() => setCopyOk(false), 2000);
  };

  const resetWizard = () => {
    try {
      localStorage.removeItem(CREATE_PLAYER_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setStep(1);
    setNome('');
    setPosicao('MC');
    setPais('');
    setTipoJogador('novo_talento');
    setRaridade('normal');
    setNftMode('off');
    setSelectedCollectionId('');
    setNewColName('');
    setNewColMaxSupply('1000');
    setCardSupplyInput('1');
    setPeBom('right');
    setPortraitDataUrl('');
    setPromptAtributos('');
    setDraft(null);
    setSavedPlayerId(null);
    setMarketBro('');
    setMarketLaunchedOk(false);
    setSpiritNotes(null);
    setError(null);
    setProfileSaveMsg(null);
  };

  const resolveShirtNum = (d: GameSpiritPlayerDraft): number => {
    const taken = new Set(Object.values(players).map((p) => p.num));
    let num = d.num ?? nextFreeShirtNumber(players);
    if (taken.has(num)) num = nextFreeShirtNumber(players);
    return num;
  };

  const handleSalvar = () => {
    if (!draft || !portraitDataUrl.trim()) return;
    setError(null);
    const merged = mergeDraftWithWizard(draft, {
      nome,
      posicao,
      pais,
      tipoJogador,
      raridade,
      peBom,
    });
    setDraft(merged);
    const id = savedPlayerId ?? newAdminPlayerId();
    const num = resolveShirtNum(merged);
    const excl = savedPlayerId ?? undefined;
    const mint = Math.floor(Number(cardSupplyInput));

    let upsertCollection: CardCollection | undefined;
    let collectionId: string | undefined;
    let cardSupply: number | undefined;

    if (nftMode === 'new') {
      const cn = newColName.trim();
      const maxS = Math.floor(Number(newColMaxSupply));
      if (!cn) {
        setError('Define o nome da nova coleção.');
        return;
      }
      if (!Number.isFinite(maxS) || maxS < 1) {
        setError('maxSupply da coleção tem de ser um inteiro ≥ 1.');
        return;
      }
      const col: CardCollection = {
        id: newCollectionId(),
        name: cn,
        maxSupply: maxS,
        createdAt: new Date().toISOString(),
      };
      const chk = canMintCardSupply({
        collection: col,
        players,
        requestedSupply: mint,
        excludePlayerId: excl,
      });
      if (chk.ok === false) {
        setError(chk.reason);
        return;
      }
      upsertCollection = col;
      collectionId = col.id;
      cardSupply = mint;
    } else if (nftMode === 'existing') {
      const col = cardCollections[selectedCollectionId];
      if (!col) {
        setError('Escolhe uma coleção existente ou cria uma nova.');
        return;
      }
      const chk = canMintCardSupply({
        collection: col,
        players,
        requestedSupply: mint,
        excludePlayerId: excl,
      });
      if (chk.ok === false) {
        setError(chk.reason);
        return;
      }
      collectionId = col.id;
      cardSupply = mint;
    }

    if (upsertCollection) {
      dispatch({ type: 'UPSERT_CARD_COLLECTION', collection: upsertCollection });
    }

    const entity = buildPlayerEntityFromDraft(merged, {
      id,
      num,
      portraitUrl: portraitDataUrl,
      listedOnMarket: false,
      collectionId,
      cardSupply,
    });
    dispatch({ type: 'MERGE_PLAYERS', players: { [id]: entity } });
    setSavedPlayerId(id);
    setStep(9);
    setMarketLaunchedOk(false);
    saveProfileToStorage({ draft: merged, savedPlayerId: id, step: 9, marketLaunchedOk: false });
  };

  const handleLancarMercado = () => {
    if (!savedPlayerId) return;
    setError(null);
    if (!isProfileComplete) {
      setError(
        'Só podes lançar no mercado com o perfil a 100%: nome, país, foto, ficha com todos os atributos e bio, e jogador já gravado no plantel.',
      );
      return;
    }
    const c = broInputToCents(marketBro);
    if (c == null) return;
    const p = players[savedPlayerId];
    if (!p) {
      setError('Jogador não encontrado no save. Volta a gravar.');
      return;
    }
    dispatch({
      type: 'MERGE_PLAYERS',
      players: {
        [savedPlayerId]: { ...p, marketValueBroCents: c, listedOnMarket: true },
      },
    });
    setMarketLaunchedOk(true);
    saveProfileToStorage({ marketLaunchedOk: true });
  };

  const goNext = () => {
    if (step < TOTAL_STEPS) setStep((s) => s + 1);
  };

  const goPrev = () => {
    if (step > 1) setStep((s) => s - 1);
  };

  /** Navegação sequencial «Seguinte»: não bloqueia — podes saltar etapas pelas tags. */
  const canAdvanceFromStep = (s: number): boolean => {
    if (s === 8) return false;
    if (s === 9) return false;
    return true;
  };

  const stepTagFilled = (n: number): boolean => {
    const { segments: segs } = profileCompletion;
    switch (n) {
      case 1:
        return segs.nameOk;
      case 2:
        return true;
      case 3:
        return segs.countryOk;
      case 4:
        return true;
      case 5:
        return segs.photoOk;
      case 6:
        return segs.draftOk;
      case 7:
        return segs.sheetOk;
      case 8:
        return segs.savedOk;
      case 9:
        return isProfileComplete;
      default:
        return false;
    }
  };

  const missingForMarket = useMemo(() => {
    const { segments: s } = profileCompletion;
    const out: string[] = [];
    if (!s.nameOk) out.push('Nome');
    if (!s.countryOk) out.push('País');
    if (!s.photoOk) out.push('Foto');
    if (!s.draftOk) out.push('Rascunho da ficha (passo 6 ou preview)');
    if (!s.sheetOk) out.push('Todos os atributos (40–99) e bio no preview');
    if (!s.savedOk) out.push('Gravar no plantel (passo 8)');
    return out;
  }, [profileCompletion]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-100/95">
        <div className="flex gap-3">
          <UserPlus className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" />
          <div>
            <p className="font-display font-bold text-white">CREATE PLAYER</p>
            <p className="mt-1 text-white/70">
              Podes abrir qualquer passo pelas tags. Usa «Salvar perfil» para guardar o rascunho neste browser. O mercado
              só fica disponível com o perfil a 100% (nome, país, foto, ficha completa e gravação no plantel).
            </p>
            {profileSaveMsg ? (
              <p className="mt-2 text-xs font-bold text-emerald-300/95">{profileSaveMsg}</p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => saveProfileToStorage()}
            disabled={!hydrated}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-[10px] font-bold uppercase text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-40"
          >
            <Save className="h-3.5 w-3.5" />
            Salvar perfil
          </button>
          <button
            type="button"
            onClick={resetWizard}
            className="rounded-lg border border-white/20 px-3 py-1.5 text-[10px] font-bold uppercase text-white/60 hover:bg-white/10"
          >
            Repor fluxo
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
        <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-bold uppercase text-white/50">
          <span>Perfil completo</span>
          <span className={isProfileComplete ? 'text-emerald-400' : 'text-neon-yellow/90'}>
            {profileCompletion.pct}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className={cn('h-full rounded-full transition-all', isProfileComplete ? 'bg-emerald-500' : 'bg-neon-yellow')}
            style={{ width: `${profileCompletion.pct}%` }}
          />
        </div>
        <p className="mt-1.5 text-[10px] text-white/40">
          {profileCompletion.done}/{profileCompletion.total}: nome · país · foto · rascunho · atributos+bio · gravado
        </p>
      </div>

      {/* Indicador de passos — clique em qualquer etapa */}
      <div className="flex flex-wrap gap-1.5">
        {CREATE_PLAYER_WIZARD_STEPS.map((label, i) => {
          const n = i + 1;
          const active = step === n;
          const filled = stepTagFilled(n);
          return (
            <button
              key={label}
              type="button"
              onClick={() => setStep(n)}
              title="Ir para este passo"
              className={cn(
                'rounded-lg border px-2 py-1 text-[9px] font-bold uppercase leading-tight transition-colors',
                active
                  ? 'border-neon-yellow bg-neon-yellow text-black'
                  : filled
                    ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-100/95'
                    : 'border-transparent bg-white/5 text-white/35 hover:bg-white/10 hover:text-white/60',
              )}
            >
              {n}. {label.replace(/^\d+\.\s*/, '')}
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        {step === 1 && (
          <StepBlock n={1} title="Nome" subtitle="Nome completo ou como aparece no plantel.">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: João Silva"
              className="w-full max-w-md rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
            />
          </StepBlock>
        )}

        {step === 2 && (
          <StepBlock n={2} title="Posição" subtitle="Código usado no motor e na UI.">
            <select
              value={posicao}
              onChange={(e) => setPosicao(e.target.value)}
              className="w-full max-w-xs rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
            >
              {POS_OPTS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </StepBlock>
        )}

        {step === 3 && (
          <StepBlock n={3} title="País" subtitle="Texto livre (bandeira / scouting / narrativa).">
            <input
              value={pais}
              onChange={(e) => setPais(e.target.value)}
              placeholder="Ex.: Brasil, Portugal…"
              className="w-full max-w-md rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
            />
          </StepBlock>
        )}

        {step === 4 && (
          <StepBlock
            n={4}
            title="Tipo, raridade, coleção e pé bom"
            subtitle="Raridade e coleção são metadados estilo carta/NFT (off-chain). maxSupply da coleção limita a soma dos fornecimentos por jogador."
          >
            <div className="grid max-w-xl gap-4">
              <label className="block text-[10px] font-bold uppercase text-white/45">
                Tipo de jogador
                <select
                  value={tipoJogador}
                  onChange={(e) => patchCreatorMeta({ creatorType: e.target.value as PlayerCreatorType })}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
                >
                  {CREATE_PLAYER_CREATOR_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {CREATOR_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[10px] font-bold uppercase text-white/45">
                Raridade
                <select
                  value={raridade}
                  onChange={(e) => patchCreatorMeta({ rarity: e.target.value as PlayerRarity })}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
                >
                  {CREATE_PLAYER_RARITIES.map((r) => (
                    <option key={r} value={r}>
                      {RARITY_LABELS[r]}
                    </option>
                  ))}
                </select>
              </label>
              <NftCollectionFields
                nftMode={nftMode}
                setNftMode={setNftMode}
                collectionList={collectionList}
                selectedCollectionId={selectedCollectionId}
                setSelectedCollectionId={setSelectedCollectionId}
                newColName={newColName}
                setNewColName={setNewColName}
                newColMaxSupply={newColMaxSupply}
                setNewColMaxSupply={setNewColMaxSupply}
                cardSupplyInput={cardSupplyInput}
                setCardSupplyInput={setCardSupplyInput}
                existingCollection={existingCollection}
                remainingInExisting={remainingInExisting}
              />
              <div>
                <p className="text-[10px] font-bold uppercase text-white/45">Pé bom</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {FOOT_OPTS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setPeBomSync(o.value)}
                      className={cn(
                        'rounded-lg px-4 py-2 text-xs font-bold uppercase',
                        peBom === o.value ? 'bg-neon-yellow text-black' : 'bg-white/10 text-white/70 hover:bg-white/15',
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </StepBlock>
        )}

        {step === 5 && (
          <StepBlock
            n={5}
            title="Foto"
            subtitle="Obrigatória antes de salvar. Fica em `portraitUrl` (data URL ou podes colar URL noutra versão)."
          >
            <input
              type="file"
              accept="image/*"
              onChange={(e) => onPickPhoto(e.target.files?.[0] ?? null)}
              className="block w-full max-w-lg text-xs text-white/70 file:mr-3 file:rounded file:border-0 file:bg-white/15 file:px-3 file:py-2 file:text-xs file:font-bold file:uppercase file:text-white"
            />
            {portraitDataUrl ? (
              <img
                src={portraitDataUrl}
                alt="Foto"
                className="mt-3 h-40 w-auto rounded-lg border border-white/10 object-cover object-top"
              />
            ) : null}
          </StepBlock>
        )}

        {step === 6 && (
          <StepBlock
            n={6}
            title="Prompt — atributos, estilo de jogo, quem sou eu"
            subtitle="O modelo não altera nome, posição, país nem pé. Usa o script abaixo para integrações externas."
          >
            <details className="mb-3 rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-white/60">
              <summary className="cursor-pointer font-bold text-neon-yellow/90">
                Script de integração (copiar tudo)
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-white/50">
                {CREATE_PLAYER_INTEGRATION_COPYPASTA}
              </pre>
              <button
                type="button"
                onClick={copyIntegrationScript}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-[10px] font-bold uppercase text-white/70 hover:bg-white/10"
              >
                <ClipboardCopy className="h-3.5 w-3.5" />
                {copyOk ? 'Copiado' : 'Copiar para área de transferência'}
              </button>
            </details>

            <textarea
              value={promptAtributos}
              onChange={(e) => setPromptAtributos(e.target.value)}
              rows={8}
              placeholder="Descreve força/fraquezas, estilo tático, personalidade, história curta (“quem sou eu”). O GameSpirit devolve JSON com attrs, archetype, behavior, quemSouEu…"
              className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30"
            />
            <button
              type="button"
              disabled={loading || !promptAtributos.trim()}
              onClick={() => void runGameSpirit()}
              className={cn(
                'mt-3 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-black uppercase',
                loading || !promptAtributos.trim()
                  ? 'cursor-not-allowed bg-white/10 text-white/40'
                  : 'bg-violet-600 text-white hover:bg-violet-500',
              )}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              GameSpirit: ler prompt e preencher ficha
            </button>
            {error ? (
              <p className="mt-3 flex items-center gap-2 text-sm text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </p>
            ) : null}
            {spiritNotes ? (
              <p className="mt-3 rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100/90">
                <span className="font-bold text-white">Notas do GameSpirit:</span> {spiritNotes}
              </p>
            ) : null}
            {draft ? (
              <p className="mt-3 text-xs text-emerald-300/90">
                Ficha preenchida. Avança para o Preview (passo 7) para rever e editar.
              </p>
            ) : null}
          </StepBlock>
        )}

        {step === 7 && !draft ? (
          <p className="text-sm text-white/50">A preparar rascunho para o preview…</p>
        ) : null}

        {step === 7 && draft ? (
          <StepBlock n={7} title="Preview" subtitle="Ajusta o que precisares antes de gravar.">
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Nome">
                <input
                  value={draft.name}
                  onChange={(e) => updateDraft({ name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
                />
              </Field>
              <Field label="Posição">
                <select
                  value={draft.pos}
                  onChange={(e) => updateDraft({ pos: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
                >
                  {POS_OPTS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="País">
                <input
                  value={draft.country ?? ''}
                  onChange={(e) => updateDraft({ country: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
                />
              </Field>
              <Field label="Tipo de jogador">
                <select
                  value={draft.creatorType ?? 'novo_talento'}
                  onChange={(e) => patchCreatorMeta({ creatorType: e.target.value as PlayerCreatorType })}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
                >
                  {CREATE_PLAYER_CREATOR_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {CREATOR_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Raridade">
                <select
                  value={draft.rarity ?? 'normal'}
                  onChange={(e) => patchCreatorMeta({ rarity: e.target.value as PlayerRarity })}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
                >
                  {CREATE_PLAYER_RARITIES.map((r) => (
                    <option key={r} value={r}>
                      {RARITY_LABELS[r]}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="col-span-full max-w-xl">
                <NftCollectionFields
                  nftMode={nftMode}
                  setNftMode={setNftMode}
                  collectionList={collectionList}
                  selectedCollectionId={selectedCollectionId}
                  setSelectedCollectionId={setSelectedCollectionId}
                  newColName={newColName}
                  setNewColName={setNewColName}
                  newColMaxSupply={newColMaxSupply}
                  setNewColMaxSupply={setNewColMaxSupply}
                  cardSupplyInput={cardSupplyInput}
                  setCardSupplyInput={setCardSupplyInput}
                  existingCollection={existingCollection}
                  remainingInExisting={remainingInExisting}
                />
              </div>
              <Field label="Pé bom">
                <select
                  value={draft.strongFoot ?? 'right'}
                  onChange={(e) => setPeBomSync(e.target.value as PlayerStrongFoot)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
                >
                  {FOOT_OPTS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Nº camisa">
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={draft.num ?? ''}
                  onChange={(e) =>
                    updateDraft({
                      num: e.target.value === '' ? undefined : clampNum(e.target.value, 1, 99),
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
                />
              </Field>
              <Field label="Arquétipo">
                <select
                  value={normalizeArchetypeSelect(draft.archetype)}
                  onChange={(e) => updateDraft({ archetype: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
                >
                  {ARCH_OPTS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Comportamento">
                <select
                  value={normalizeBehaviorSelect(draft.behavior)}
                  onChange={(e) => updateDraft({ behavior: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
                >
                  {BEH_OPTS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Quem sou eu (bio)">
              <textarea
                value={draft.bio ?? ''}
                onChange={(e) => updateDraft({ bio: e.target.value })}
                rows={4}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
              />
            </Field>

            <p className="mb-2 mt-4 text-[10px] font-bold uppercase text-white/40">Atributos (40–99)</p>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-5">
              {ATTR_KEYS.map((k) => (
                <label key={k} className="text-[9px] font-bold uppercase text-white/40">
                  {k}
                  <input
                    type="number"
                    min={40}
                    max={99}
                    value={draft.attrs?.[k] ?? ''}
                    onChange={(e) => {
                      const v = e.target.value === '' ? undefined : clampNum(e.target.value, 40, 99);
                      if (v == null) {
                        setDraft((f) => {
                          if (!f?.attrs) return f;
                          const { [k]: _, ...rest } = f.attrs;
                          return { ...f, attrs: Object.keys(rest).length ? rest : undefined };
                        });
                      } else updateAttr(k, v);
                    }}
                    className="mt-0.5 w-full rounded border border-white/15 bg-black/40 px-2 py-1.5 text-xs text-white"
                  />
                </label>
              ))}
            </div>

            {previewEntity ? (
              <div className="mt-6 flex flex-wrap items-start gap-6 rounded-xl border border-white/10 bg-black/30 p-4">
                <img
                  src={playerPortraitSrc(previewEntity, 200, 260)}
                  alt=""
                  className="h-52 w-40 rounded-lg object-cover object-top"
                />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-display text-xl font-black text-white">{previewEntity.name}</p>
                  <p className="text-white/50">
                    {previewEntity.pos} ·{' '}
                    {(() => {
                      const c = previewEntity.country?.trim();
                      if (!c) return '—';
                      return countryCodeToFlagEmoji(c) || '🌍';
                    })()}{' '}
                    ·{' '}
                    {previewEntity.creatorType
                      ? CREATOR_TYPE_LABELS[previewEntity.creatorType]
                      : '—'}{' '}
                    ·{' '}
                    {previewEntity.rarity ? RARITY_LABELS[previewEntity.rarity] : '—'} ·{' '}
                    {FOOT_OPTS.find((f) => f.value === previewEntity.strongFoot)?.label ?? '—'}
                  </p>
                  <p className="mt-2 text-xs text-white/45">
                    OVR {overallFromAttributes(previewEntity.attrs)} · #{previewEntity.num}
                  </p>
                  {nftMode === 'new' && newColName.trim() ? (
                    <p className="mt-1 text-xs text-cyan-300/90">
                      Coleção nova «{newColName.trim()}» · max supply {newColMaxSupply} · emitidas (esta carta):{' '}
                      {cardSupplyInput || '—'}
                    </p>
                  ) : null}
                  {nftMode === 'existing' && previewEntity.collectionId && previewEntity.cardSupply ? (
                    <p className="mt-1 text-xs text-cyan-300/90">
                      {cardCollections[previewEntity.collectionId]?.name ?? 'Coleção'} · emitidas (esta carta):{' '}
                      {previewEntity.cardSupply} · livres na coleção: {remainingInExisting}
                    </p>
                  ) : null}
                  {previewEntity.bio ? (
                    <p className="mt-3 text-xs leading-relaxed text-white/70">{previewEntity.bio}</p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </StepBlock>
        ) : null}

        {step === 8 && !draft ? (
          <p className="text-sm text-white/50">A preparar rascunho…</p>
        ) : null}

        {step === 8 && draft ? (
          <StepBlock
            n={8}
            title="Salvar"
            subtitle="Grava no save local com `listedOnMarket: false`. Depois avança automaticamente ao passo 9."
          >
            <p className="mb-4 text-sm text-white/60">
              O jogador será criado com ID <code className="text-neon-yellow/80">p-admin-…</code> e integrado no plantel
              via <code className="text-white/50">MERGE_PLAYERS</code>.
            </p>
            <button
              type="button"
              onClick={handleSalvar}
              disabled={!portraitDataUrl.trim()}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-6 py-3 text-xs font-black uppercase',
                !portraitDataUrl.trim()
                  ? 'cursor-not-allowed bg-white/10 text-white/40'
                  : 'bg-emerald-600 text-white hover:bg-emerald-500',
              )}
            >
              <CheckCircle2 className="h-4 w-4" />
              Salvar no plantel
            </button>
          </StepBlock>
        ) : null}

        {step === 9 && (
          <StepBlock
            n={9}
            title="Lançar no Mercado"
            subtitle="Só disponível com perfil a 100%. Define o preço em BRO e marca `listedOnMarket: true` no mesmo jogador."
          >
            {!savedPlayerId ? (
              <p className="text-sm text-amber-200/90">Primeiro completa o passo 8 (Salvar no plantel).</p>
            ) : (
              <>
                {!isProfileComplete ? (
                  <div className="mb-4 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/95">
                    <p className="font-bold text-white">Falta completar antes do mercado:</p>
                    <ul className="mt-2 list-inside list-disc text-xs text-amber-100/85">
                      {missingForMarket.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mb-3 text-xs text-emerald-300/90">Perfil a 100% — podes lançar no mercado.</p>
                )}
                <p className="mb-2 text-xs text-white/45">
                  ID guardado: <code className="text-neon-yellow/80">{savedPlayerId}</code>
                </p>
                <label className="text-[10px] font-bold uppercase text-white/45">
                  Preço pedido (BRO)
                  <input
                    value={marketBro}
                    onChange={(e) => setMarketBro(e.target.value)}
                    placeholder="ex: 15 ou 2,5"
                    className="mt-1 w-full max-w-xs rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleLancarMercado}
                  disabled={!isProfileComplete || broInputToCents(marketBro) == null}
                  className={cn(
                    'mt-4 inline-flex items-center gap-2 rounded-lg px-6 py-3 text-xs font-black uppercase',
                    !isProfileComplete || broInputToCents(marketBro) == null
                      ? 'cursor-not-allowed bg-white/10 text-white/40'
                      : 'bg-amber-600 text-black hover:bg-amber-500',
                  )}
                >
                  Lançar no mercado
                </button>
                {marketLaunchedOk ? (
                  <p className="mt-3 flex items-center gap-2 text-sm text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                    Jogador listado com preço {marketBro} BRO.
                  </p>
                ) : null}
              </>
            )}
          </StepBlock>
        )}

        {/* Navegação inferior */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={goPrev}
            disabled={step <= 1}
            className={cn(
              'inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold uppercase',
              step <= 1 ? 'text-white/25' : 'text-white/70 hover:bg-white/10',
            )}
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </button>
          <button
            type="button"
            onClick={() => saveProfileToStorage()}
            disabled={!hydrated}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/35 px-3 py-2 text-[10px] font-bold uppercase text-emerald-200/95 hover:bg-emerald-500/15 disabled:opacity-40"
          >
            <Save className="h-3.5 w-3.5" />
            Salvar perfil
          </button>
          {step < 9 && step !== 8 && (
            <button
              type="button"
              onClick={goNext}
              disabled={!canAdvanceFromStep(step)}
              className={cn(
                'inline-flex items-center gap-1 rounded-lg px-4 py-2 text-xs font-black uppercase',
                !canAdvanceFromStep(step)
                  ? 'cursor-not-allowed bg-white/10 text-white/40'
                  : 'bg-neon-yellow text-black hover:bg-white',
              )}
            >
              Seguinte
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
          {step === 8 && (
            <span className="text-[10px] text-white/35">Usa o botão «Salvar no plantel» acima.</span>
          )}
          {step === 9 && marketLaunchedOk && (
            <button
              type="button"
              onClick={resetWizard}
              className="rounded-lg border border-white/20 px-4 py-2 text-xs font-bold uppercase text-white/70 hover:bg-white/10"
            >
              Criar outro jogador
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

type NftCollectionFieldsProps = {
  nftMode: NftCollectionMode;
  setNftMode: (m: NftCollectionMode) => void;
  collectionList: CardCollection[];
  selectedCollectionId: string;
  setSelectedCollectionId: (id: string) => void;
  newColName: string;
  setNewColName: (s: string) => void;
  newColMaxSupply: string;
  setNewColMaxSupply: (s: string) => void;
  cardSupplyInput: string;
  setCardSupplyInput: (s: string) => void;
  existingCollection: CardCollection | undefined;
  remainingInExisting: number;
};

function NftCollectionFields({
  nftMode,
  setNftMode,
  collectionList,
  selectedCollectionId,
  setSelectedCollectionId,
  newColName,
  setNewColName,
  newColMaxSupply,
  setNewColMaxSupply,
  cardSupplyInput,
  setCardSupplyInput,
  existingCollection,
  remainingInExisting,
}: NftCollectionFieldsProps) {
  return (
    <div className="space-y-3 rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-4">
      <p className="text-[10px] font-bold uppercase tracking-wide text-cyan-200/70">
        Coleção e tiragem (off-chain)
      </p>
      <p className="text-xs text-white/50">
        O <span className="text-white/70">max supply</span> da coleção é o teto global; o{' '}
        <span className="text-white/70">fornecimento desta carta</span> é quantas unidades deste jogador existem
        nessa coleção.
      </p>
      <div className="flex flex-wrap gap-2">
        {(
          [
            { mode: 'off' as const, label: 'Sem coleção' },
            { mode: 'existing' as const, label: 'Coleção existente' },
            { mode: 'new' as const, label: 'Nova coleção' },
          ] as const
        ).map(({ mode, label }) => (
          <button
            key={mode}
            type="button"
            onClick={() => setNftMode(mode)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-wide',
              nftMode === mode
                ? 'bg-cyan-500 text-black'
                : 'bg-white/10 text-white/65 hover:bg-white/15',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {nftMode === 'off' ? (
        <p className="text-xs text-white/45">Este jogador não entra no controlo de tiragem nem em max supply.</p>
      ) : null}

      {nftMode === 'existing' ? (
        <div className="space-y-3">
          {collectionList.length === 0 ? (
            <p className="text-xs text-amber-200/90">
              Ainda não há coleções. Cria uma com «Nova coleção» ao gravar o primeiro jogador, ou muda o modo acima.
            </p>
          ) : (
            <label className="block text-[10px] font-bold uppercase text-white/45">
              Coleção
              <select
                value={selectedCollectionId}
                onChange={(e) => setSelectedCollectionId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
              >
                <option value="">— escolher —</option>
                {collectionList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (max {c.maxSupply})
                  </option>
                ))}
              </select>
            </label>
          )}
          {existingCollection ? (
            <p className="text-xs text-cyan-200/80">
              Max da coleção: <span className="font-mono text-white">{existingCollection.maxSupply}</span> · Livre
              para novas cartas:{' '}
              <span className="font-mono text-white">{remainingInExisting}</span>
            </p>
          ) : null}
          <label className="block text-[10px] font-bold uppercase text-white/45">
            Fornecimento desta carta (unidades)
            <input
              type="number"
              min={1}
              value={cardSupplyInput}
              onChange={(e) => setCardSupplyInput(e.target.value)}
              className="mt-1 w-full max-w-[12rem] rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
            />
          </label>
        </div>
      ) : null}

      {nftMode === 'new' ? (
        <div className="space-y-3">
          <label className="block text-[10px] font-bold uppercase text-white/45">
            Nome da coleção
            <input
              value={newColName}
              onChange={(e) => setNewColName(e.target.value)}
              placeholder="Ex.: Genesis 2026"
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-[10px] font-bold uppercase text-white/45">
            Max supply (teto global da coleção)
            <input
              type="number"
              min={1}
              value={newColMaxSupply}
              onChange={(e) => setNewColMaxSupply(e.target.value)}
              className="mt-1 w-full max-w-[12rem] rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-[10px] font-bold uppercase text-white/45">
            Fornecimento desta carta (unidades nesta coleção)
            <input
              type="number"
              min={1}
              value={cardSupplyInput}
              onChange={(e) => setCardSupplyInput(e.target.value)}
              className="mt-1 w-full max-w-[12rem] rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}

function StepBlock({ n, title, subtitle, children }: { n: number; title: string; subtitle: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="font-display text-sm font-bold uppercase tracking-widest text-neon-yellow/90">
        Passo {n} — {title}
      </h3>
      <p className="mt-1 text-xs text-white/45">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-[10px] font-bold uppercase text-white/45">
      {label}
      {children}
    </label>
  );
}
