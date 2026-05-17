import { createPlayer, overallFromAttributes } from './player';
import { applyScoutBonusToNpcAttrs } from '@/systems/staffBenefits';
import type { ManagerProspectContractGames } from '@/playerContracts/playerContracts';
import { contractFieldsForManagerProspectTier } from '@/playerContracts/playerContracts';
import type { PlayerAttributes, PlayerBehavior, PlayerEntity, PlayerStrongFoot } from './types';

/** OVR máximo na criação (Academia OLE + prospects NPC). */
export const MANAGER_PROSPECT_CREATE_MAX_OVR = 70;
/**
 * OVR máximo após evolução (treinos, jogos) para `managerCreated`.
 * Cap baixo (75) é intencional: evita que a Academia OLE infle o mercado
 * com prospects que rivalizam com cartas Genesis premium. Janela de evolução
 * útil = 5 pontos (70 criação → 75 cap).
 */
export const MANAGER_PROSPECT_EVOLVED_MAX_OVR = 75;

/**
 * Slots simultâneos da Academia OLE: até 5 prospects criados/ativos no
 * plantel ao mesmo tempo. Para criar o 6º, o manager precisa primeiro
 * vender um existente (ao Market Maker ou outro manager), liberando o slot.
 */
export const MAX_ACTIVE_ACADEMY_PROSPECTS = 5;

/**
 * Conta os prospects da Academia que ocupam slot. Considera tanto o prefixo
 * de id `mgr_` quanto a flag `managerCreated` para ser defensivo contra saves
 * antigos / dados parciais.
 */
export function countActiveAcademyProspects(
  players: Record<string, { id: string; managerCreated?: boolean }>,
): number {
  let n = 0;
  for (const p of Object.values(players)) {
    if (p.id.startsWith('mgr_') || p.managerCreated === true) n += 1;
  }
  return n;
}
/** @deprecated Usa CREATE vs EVOLVED; mantido para texto “máx. evoluído” em alguns ecrãs. */
export const MANAGER_PROSPECT_MAX_OVR = MANAGER_PROSPECT_EVOLVED_MAX_OVR;
/** Idade no cartão / ficha (Academia OLE e prospects geridos). */
export const MANAGER_PROSPECT_MIN_AGE = 18;
export const MANAGER_PROSPECT_MAX_AGE = 40;
/** Valor inicial / fallback quando o save ainda não tem `managerProspectConfig`. */
export const DEFAULT_MANAGER_PROSPECT_CREATE_COST_EXP = 1000;

const ATTR_KEYS = [
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
] as const satisfies readonly (keyof PlayerAttributes)[];

function clampAttr(n: number): number {
  return Math.min(99, Math.max(35, Math.round(n)));
}

/** Garante OVR ≤ `maxOvr` (mesma fórmula que `overallFromAttributes`). */
export function scaleAttrsToMaxOvr(attrs: PlayerAttributes, maxOvr: number): PlayerAttributes {
  let a: PlayerAttributes = { ...attrs };
  for (const k of ATTR_KEYS) {
    a[k] = clampAttr(a[k]);
  }
  let ovr = overallFromAttributes(a);
  let guard = 0;
  while (ovr > maxOvr && guard++ < 240) {
    const keysSorted = [...ATTR_KEYS].sort((k1, k2) => a[k2] - a[k1]);
    for (let i = 0; i < 4 && ovr > maxOvr; i++) {
      const key = keysSorted[i]!;
      a[key] = clampAttr(a[key] - 1);
      ovr = overallFromAttributes(a);
    }
  }
  return a;
}

export function baseAttrsForPosition(pos: string): PlayerAttributes {
  const mid = 58;
  const base: PlayerAttributes = {
    passe: mid,
    marcacao: mid,
    velocidade: mid,
    drible: mid,
    finalizacao: mid,
    fisico: mid,
    tatico: mid,
    mentalidade: mid,
    confianca: mid,
    fairPlay: 78,
  };
  const p = pos.toUpperCase();
  if (p === 'GOL') {
    return {
      ...base,
      mentalidade: 72,
      confianca: 74,
      tatico: 70,
      marcacao: 62,
      finalizacao: 42,
      velocidade: 48,
      drible: 45,
      passe: 55,
      fisico: 68,
    };
  }
  if (p === 'ZAG') {
    return {
      ...base,
      marcacao: 68,
      fisico: 70,
      tatico: 64,
      finalizacao: 48,
      velocidade: 52,
      drible: 52,
      passe: 60,
    };
  }
  if (p === 'LE' || p === 'LD') {
    return {
      ...base,
      marcacao: 64,
      fisico: 68,
      tatico: 62,
      velocidade: 72,
      drible: 68,
      passe: 64,
      finalizacao: 52,
    };
  }
  if (p === 'VOL' || p === 'MC') {
    return {
      ...base,
      passe: 70,
      marcacao: 66,
      tatico: 70,
      fisico: 68,
      finalizacao: 58,
      velocidade: 64,
      drible: 62,
    };
  }
  if (p === 'PE' || p === 'PD') {
    return {
      ...base,
      velocidade: 72,
      drible: 70,
      passe: 66,
      finalizacao: 62,
      marcacao: 58,
      tatico: 60,
      fisico: 66,
    };
  }
  if (p === 'ATA') {
    return {
      ...base,
      finalizacao: 70,
      velocidade: 70,
      drible: 66,
      passe: 60,
      marcacao: 45,
      fisico: 66,
      mentalidade: 64,
    };
  }
  return base;
}

export function applyBehaviorToAttrs(a: PlayerAttributes, behavior: PlayerBehavior): PlayerAttributes {
  const o = { ...a };
  const bump = 5;
  if (behavior === 'ofensivo') {
    o.finalizacao += bump;
    o.drible += bump;
    o.velocidade += bump - 1;
    o.marcacao = Math.max(35, o.marcacao - 4);
  } else if (behavior === 'defensivo') {
    o.marcacao += bump;
    o.fisico += bump;
    o.tatico += 3;
    o.drible = Math.max(35, o.drible - 4);
  } else if (behavior === 'criativo') {
    o.passe += bump;
    o.drible += bump;
    o.tatico += bump;
    o.fisico = Math.max(35, o.fisico - 4);
  } else {
    o.passe += 2;
    o.tatico += 2;
    o.mentalidade += 2;
  }
  for (const k of ATTR_KEYS) o[k] = clampAttr(o[k]);
  return o;
}

export function applyAgeToAttrs(a: PlayerAttributes, age: number): PlayerAttributes {
  const o = { ...a };
  if (age <= 19) {
    o.velocidade += 3;
    o.confianca += 2;
    o.mentalidade -= 1;
    o.tatico -= 1;
  } else if (age >= 31) {
    o.velocidade -= 3;
    o.mentalidade += 3;
    o.tatico += 2;
    o.confianca += 1;
  }
  for (const k of ATTR_KEYS) o[k] = clampAttr(o[k]);
  return o;
}

/** 0 = mais defensivo, 50 neutro, 100 = mais ofensivo/veloz. */
export function applyDevelopmentBias(a: PlayerAttributes, bias: number): PlayerAttributes {
  const o = { ...a };
  const t = (Math.max(0, Math.min(100, bias)) - 50) / 50;
  o.finalizacao += Math.round(4 * t);
  o.marcacao += Math.round(-4 * t);
  o.velocidade += Math.round(2 * t);
  o.passe += Math.round(1 * t);
  for (const k of ATTR_KEYS) o[k] = clampAttr(o[k]);
  return o;
}

/** Referência visual opcional (Academia OLE → fila de arte no Admin). */
export type ManagerProspectVisualBrief = {
  skinTone?: string;
  eyeColor?: string;
  hairStyle?: string;
  extraDetails?: string;
};

/** Referência cultural / estética do cartão (retrato fictício), separada da nacionalidade da ficha. */
export type ManagerProspectPortraitStyleRegion =
  | 'europa'
  | 'africa_subsariana'
  | 'americas_sul'
  | 'americas_outras'
  | 'mena'
  | 'asia'
  | 'oceania';

export const PORTRAIT_STYLE_REGION_LABELS: Record<ManagerProspectPortraitStyleRegion, string> = {
  europa: 'Europa',
  africa_subsariana: 'África (subsaariana)',
  americas_sul: 'América do Sul',
  americas_outras: 'América Central, Norte e Caraíbas',
  mena: 'Médio Oriente e Norte de África',
  asia: 'Ásia',
  oceania: 'Oceania',
};

export interface ManagerProspectHeritageBrief {
  portraitStyleRegion: ManagerProspectPortraitStyleRegion;
  /** Marcadores rápidos (ex.: indígena, ascendência asiática). */
  originTags: string[];
  /** Texto obrigatório: origem no cartão (ex.: brasileiro com raízes japonesas). */
  originText: string;
}

export const MANAGER_HERITAGE_ORIGIN_TEXT_MIN_LEN = 8;

/**
 * Heritage funcional (P5 do audit) — cada região da Academia OLE biaseia
 * um atributo do prospect na criação. O bias é pré-scaling (antes do cap
 * OVR 70), então o efeito final é uma "assinatura" de perfil: o atributo
 * da região fica visivelmente mais alto, os outros caem proporcionalmente
 * pra manter o cap. Sem inflate de OVR total — só shift de perfil.
 */
export const HERITAGE_ATTR_BIAS: Record<ManagerProspectPortraitStyleRegion, keyof PlayerAttributes> = {
  europa: 'tatico',              // disciplina tática
  africa_subsariana: 'velocidade', // atletismo
  americas_sul: 'drible',         // técnica/samba
  americas_outras: 'finalizacao', // pragmatismo go-getter
  mena: 'mentalidade',            // resiliência
  asia: 'passe',                  // precisão
  oceania: 'fisico',              // físico/rugby
};

/** Quanto soma no atributo bias da região (visível no perfil final). */
const HERITAGE_BIAS_BOOST = 3;
/** Quanto se desconta de um attr menor pra compensar e manter OVR estável. */
const HERITAGE_BIAS_COUNTER = 2;

/**
 * Aplica a "assinatura" do heritage: soma `HERITAGE_BIAS_BOOST` no attr da
 * região e desconta `HERITAGE_BIAS_COUNTER` do attr mais baixo (não-bias)
 * pra balancear. Net é um shift de perfil com efeito quase nulo no OVR
 * (~+0.3 round → 0).
 *
 * Aplicado DEPOIS do scaling pra não ser comido por `scaleAttrsToMaxOvr`
 * (que reduz os attrs mais altos primeiro — exatamente onde o bias estaria).
 */
export function applyHeritageBias(
  attrs: PlayerAttributes,
  region: ManagerProspectPortraitStyleRegion | undefined,
): PlayerAttributes {
  if (!region) return attrs;
  const biasAttr = HERITAGE_ATTR_BIAS[region];
  if (!biasAttr) return attrs;
  // Encontra attr mais baixo entre os não-bias pra contrabalanço.
  let counterAttr: keyof PlayerAttributes | null = null;
  let counterVal = Infinity;
  for (const k of ATTR_KEYS) {
    if (k === biasAttr) continue;
    const v = attrs[k] ?? 0;
    if (v < counterVal) { counterVal = v; counterAttr = k; }
  }
  const next = { ...attrs };
  next[biasAttr] = Math.min(99, (next[biasAttr] ?? 0) + HERITAGE_BIAS_BOOST);
  if (counterAttr) next[counterAttr] = Math.max(35, (next[counterAttr] ?? 0) - HERITAGE_BIAS_COUNTER);
  return next;
}

export function isValidManagerHeritage(h: ManagerProspectHeritageBrief | undefined): boolean {
  if (!h) return false;
  if (!PORTRAIT_STYLE_REGION_LABELS[h.portraitStyleRegion]) return false;
  const t = h.originText?.trim() ?? '';
  if (t.length < MANAGER_HERITAGE_ORIGIN_TEXT_MIN_LEN) return false;
  return true;
}

export type ManagerProspectCreatePayload = {
  name: string;
  age: number;
  country: string;
  strongFoot: PlayerStrongFoot;
  pos: string;
  behavior: PlayerBehavior;
  /** Só usado no pipeline automático (ex.: NPC). No fluxo Academia com `attrs`, ignorado. */
  developmentBias?: number;
  /** Se definido (fluxo com ecrã «Afinar»), substitui o pipeline automático de atributos. */
  attrs?: PlayerAttributes;
  /** Origem / referência cultural do cartão (obrigatório no fluxo Academia com attrs). */
  heritage?: ManagerProspectHeritageBrief;
  visualBrief?: ManagerProspectVisualBrief;
  /** Duração do contrato em jogos (10 / 70 / 150 / 250); omissão = 10. */
  contractMatches?: ManagerProspectContractGames;
};

function strongFootPt(f: PlayerStrongFoot): string {
  if (f === 'right') return 'Direito';
  if (f === 'left') return 'Esquerdo';
  return 'Ambidestro';
}

function behaviorPt(b: PlayerBehavior): string {
  if (b === 'ofensivo') return 'Ofensivo';
  if (b === 'defensivo') return 'Defensivo';
  if (b === 'criativo') return 'Criativo';
  return 'Equilibrado';
}

const ATTR_PROMPT_LINES: { key: keyof PlayerAttributes; label: string }[] = [
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

/**
 * Texto longo para gerar retrato fora da app (IA / pipeline de imagem).
 * Personagem fictício; branding OLEFOOT apenas.
 */
export function buildProspectAdminArtPrompt(args: {
  name: string;
  pos: string;
  age: number;
  country: string;
  strongFoot: PlayerStrongFoot;
  behavior: PlayerBehavior;
  attrs: PlayerAttributes;
  heritage?: ManagerProspectHeritageBrief;
  visual?: ManagerProspectVisualBrief;
}): string {
  const v = args.visual;
  const h = args.heritage;
  const lines: string[] = [
    'OLEFOOT — Retrato de carta desportiva digital (personagem fictício, adulto jovem).',
    'Equipamento com identidade OLE FOOT / OLEFOOT (marca fictícia do jogo); não usar logótipos de clubes reais nem rostos de pessoas reais.',
    '',
    `Nome no cartão: ${args.name}`,
    `Posição: ${args.pos} | Idade (ficha): ${args.age} | País (código ficha): ${args.country}`,
    `Pé bom: ${strongFootPt(args.strongFoot)} | Perfil de jogo: ${behaviorPt(args.behavior)}`,
    `OVR (fórmula jogo, referência): ${overallFromAttributes(args.attrs)}`,
    '',
    'Atributos numéricos (referência de intensidade corporal/treino, não texto na camisola):',
    ...ATTR_PROMPT_LINES.map(({ key, label }) => `- ${label}: ${Math.round(args.attrs[key])}`),
    '',
  ];
  if (h && isValidManagerHeritage(h)) {
    const tags = (h.originTags ?? []).map((t) => t.trim()).filter(Boolean);
    lines.push(
      'Identidade cultural do cartão (referência para retrato — não confundir com nacionalidade legal da ficha):',
      `- Referência de estilo / região: ${PORTRAIT_STYLE_REGION_LABELS[h.portraitStyleRegion]}`,
      tags.length ? `- Marcadores de origem: ${tags.join(', ')}` : '- Marcadores de origem: (nenhum selecionado)',
      `- Origem no cartão (texto do manager): ${h.originText.trim()}`,
      '',
    );
  } else {
    lines.push(
      'Identidade cultural do cartão: (não preenchida — completar no fluxo Academia OLE)',
      '',
    );
  }
  lines.push('Aparência física do retrato (opcional — omitir linhas vazias na geração visual):');
  const skin = v?.skinTone?.trim();
  const eyes = v?.eyeColor?.trim();
  const hair = v?.hairStyle?.trim();
  const extra = v?.extraDetails?.trim();
  lines.push(skin ? `- Tom de pele: ${skin}` : '- Tom de pele: (não indicado — usar neutro coerente com o cartão)');
  lines.push(eyes ? `- Cor dos olhos: ${eyes}` : '- Cor dos olhos: (não indicado)');
  lines.push(hair ? `- Estilo de cabelo: ${hair}` : '- Estilo de cabelo: (não indicado)');
  lines.push(extra ? `- Detalhe específico: ${extra}` : '- Detalhe específico: (nenhum)');
  lines.push(
    '',
    'Estilo de imagem: ilustração ou render 3D estilizado de carta de equipa desportiva; fundo escuro ou gradiente premium; iluminação de estúdio; foco no busto/ombros.',
  );
  return lines.join('\n');
}

export function buildManagerCreatedPlayerEntity(
  payload: ManagerProspectCreatePayload,
  id: string,
  num: number,
  /** Talentos da “rede” no mercado não marcam `managerCreated` (só o teu plantel). */
  markAsManagerCreated = true,
): PlayerEntity {
  const name = payload.name.trim().toUpperCase().slice(0, 24) || 'NOVO';
  const age = Math.max(MANAGER_PROSPECT_MIN_AGE, Math.min(MANAGER_PROSPECT_MAX_AGE, Math.round(payload.age)));
  const country = payload.country.trim().slice(0, 3).toUpperCase() || '—';
  let attrs: PlayerAttributes;
  if (payload.attrs) {
    attrs = scaleAttrsToMaxOvr({ ...payload.attrs }, MANAGER_PROSPECT_CREATE_MAX_OVR);
  } else {
    attrs = baseAttrsForPosition(payload.pos);
    attrs = applyBehaviorToAttrs(attrs, payload.behavior);
    attrs = applyAgeToAttrs(attrs, age);
    attrs = applyDevelopmentBias(attrs, payload.developmentBias ?? 50);
    attrs = scaleAttrsToMaxOvr(attrs, MANAGER_PROSPECT_CREATE_MAX_OVR);
  }
  // P5 — heritage bias: shift de perfil aplicado DEPOIS do scaling.
  // applyHeritageBias usa contrabalanço (+3 bias, -2 attr mais baixo)
  // pra manter OVR quase estável. Aplicar antes do scaling seria comido
  // pelo scaling top-heavy (que reduz os maiores attrs primeiro).
  attrs = applyHeritageBias(attrs, payload.heritage?.portraitStyleRegion);

  const mintOvr = overallFromAttributes(attrs);
  const tier = (payload.contractMatches ?? 10) as ManagerProspectContractGames;
  return createPlayer({
    id,
    num,
    name,
    pos: payload.pos.toUpperCase(),
    attrs,
    behavior: payload.behavior,
    country,
    strongFoot: payload.strongFoot,
    creatorType: 'amador',
    ...(markAsManagerCreated ? { managerCreated: true } : {}),
    mintOverall: mintOvr,
    evolutionRate: 1,
    age,
    bio: markAsManagerCreated ? `Academia OLE · ${age} anos` : `Rede OLE · ${age} anos`,
    listedOnMarket: false,
    fatigue: 12,
    ...contractFieldsForManagerProspectTier(tier),
  });
}

const NPC_FIRST_NAMES = ['LUCAS', 'TIAGO', 'RAFA', 'MIGUEL', 'GABRI', 'DANIEL', 'PEDRO', 'ANDRE', 'BRUNO', 'IVO'];
const NPC_LAST = ['MOREIRA', 'NUNES', 'SOUSA', 'FREITAS', 'CASTRO', 'MELO', 'AZEVEDO', 'CORREIA', 'ANTUNES', 'PINTO'];
const NPC_POS: string[] = ['MC', 'ATA', 'ZAG', 'LE', 'VOL', 'PD', 'GOL'];
const NPC_NAT = ['PT', 'BR', 'ES', 'AO', 'MZ'];

function hash32(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Prospect NPC (outro manager) para compra no mercado — OVR já limitado. */
export function buildNpcManagerProspectSnapshot(seed: string, index: number, olheiroLevel?: number): PlayerEntity {
  const h = hash32(`${seed}:${index}`);
  const name = `${NPC_FIRST_NAMES[h % NPC_FIRST_NAMES.length]} ${NPC_LAST[(h >> 3) % NPC_LAST.length]}`;
  const pos = NPC_POS[(h >> 5) % NPC_POS.length]!;
  const nat = NPC_NAT[(h >> 7) % NPC_NAT.length]!;
  const ageSpan = MANAGER_PROSPECT_MAX_AGE - MANAGER_PROSPECT_MIN_AGE + 1;
  const age = MANAGER_PROSPECT_MIN_AGE + (h % ageSpan);
  const behaviors: PlayerBehavior[] = ['equilibrado', 'ofensivo', 'defensivo', 'criativo'];
  const behavior = behaviors[(h >> 9) % behaviors.length]!;
  const foot: PlayerStrongFoot[] = ['right', 'left', 'both'];
  const strongFoot = foot[(h >> 11) % foot.length]!;
  const bias = 30 + (h % 41);
  const base = buildManagerCreatedPlayerEntity(
    {
      name,
      age,
      country: nat,
      strongFoot,
      pos,
      behavior,
      developmentBias: bias,
    },
    `npc_mgr_${seed}_${index}`,
    0,
    false,
  );
  if (olheiroLevel === undefined) return base;
  let t = (h + index * 17) >>> 0;
  const rng = () => {
    t = (Math.imul(1664525, t) + 1013904223) >>> 0;
    return t / 0x1_0000_0000;
  };
  const boosted = applyScoutBonusToNpcAttrs(base.attrs, olheiroLevel, rng);
  return { ...base, attrs: scaleAttrsToMaxOvr(boosted, MANAGER_PROSPECT_CREATE_MAX_OVR) };
}
