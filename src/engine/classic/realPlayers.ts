/**
 * Adapter — converte `PlayerEntity` (game state) para `ClassicPlayer` (engine
 * do modo CLASSIC). Permite usar o plantel real do manager + adversário
 * (`OpponentStub.genesisAwayPlayers` ou geração sintética por `strength`).
 */

import type { PlayerEntity } from '@/entities/types';
import { overallFromAttributes } from '@/entities/player';
import type { ClassicPlayer, ArchetypeId } from './types';
import { FORMATION_SLOTS, FIELD_W_LOGIC, FIELD_H_LOGIC } from './formations';

/** Posição PT (atrs jogo) → role EN (engine CLASSIC). */
export function derivedRoleFromPos(posRaw: string): string {
  const pos = (posRaw ?? '').toUpperCase();
  switch (pos) {
    case 'GOL': case 'GK':           return 'GK';
    case 'ZAG': case 'CB':           return 'CB';
    case 'LE':  case 'LB':           return 'LB';
    case 'LD':  case 'RB':           return 'RB';
    case 'VOL': case 'DM':           return 'DM';
    case 'MC':  case 'MEI': case 'CM': return 'CM';
    case 'PE':  case 'LW':           return 'LW';
    case 'PD':  case 'RW':           return 'RW';
    case 'ATA': case 'ST':           return 'ST';
    default:                          return pos || 'CM';
  }
}

/**
 * Heurística que deriva o arquétipo do engine (FINISHER/MAESTRO/HUNTER…)
 * a partir da posição + atributos do PlayerEntity. Não usa o
 * `archetype` produto (profissional/lenda/meme) — esse é metadado de carta.
 */
export function derivedArchetype(p: PlayerEntity): ArchetypeId {
  const role = derivedRoleFromPos(p.pos);
  const a = p.attrs;

  if (role === 'GK') return 'COLD_BLOOD';

  if (role === 'CB') {
    return a.tatico >= 75 ? 'VETERAN' : 'DESTROYER';
  }
  if (role === 'LB' || role === 'RB') {
    return a.fisico >= 78 ? 'ENGINE' : 'HUNTER';
  }
  if (role === 'DM') {
    return a.marcacao >= 75 ? 'HUNTER' : 'DESTROYER';
  }
  if (role === 'CM') {
    if (a.passe >= 82) return 'MAESTRO';
    if (a.fisico >= 78) return 'ENGINE';
    return a.tatico >= 78 ? 'VETERAN' : 'MAESTRO';
  }
  if (role === 'LW' || role === 'RW') {
    if (a.drible >= 80) return 'WILD';
    return a.fisico >= 78 ? 'ENGINE' : 'BOX_INVADER';
  }
  if (role === 'ST') {
    if (a.finalizacao >= 85) return 'FINISHER';
    if (a.mentalidade >= 82) return 'COLD_BLOOD';
    return 'BOX_INVADER';
  }
  return 'ENGINE';
}

// Hash determinístico — gera id numérico estável para o ClassicPlayer
let _seq = 1;
const _seqMap = new Map<string, number>();
function stableNumericId(strId: string): number {
  if (_seqMap.has(strId)) return _seqMap.get(strId)!;
  const id = _seq++;
  _seqMap.set(strId, id);
  return id;
}

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].toUpperCase();
  // "Pedro Moraes" → "P. MORAES"
  return `${parts[0][0]}. ${parts[parts.length - 1]}`.toUpperCase();
}

/**
 * Ordem canônica do CLASSIC pra um 11-titular: GK, RB, CB, CB, LB, DM, CM, CM, RW, ST, LW.
 * Casa exatamente com `FORMATION_SLOTS['4-3-3']`. Para outras formações o
 * usuário pode trocar via modal e `repositionForFormation` reposiciona.
 */
const CLASSIC_SLOT_ORDER_BY_LINEUP_KEY = ['gol', 'ld', 'zag1', 'zag2', 'le', 'vol', 'mc1', 'mc2', 'pd', 'ata', 'pe'];

interface BuildOpts {
  team: 'home' | 'away';
  starterId?: string; // jogador que recebe `isStar = true`
  formation?: keyof typeof FORMATION_SLOTS;
}

/**
 * Converte um PlayerEntity em ClassicPlayer ancorado num slot da formação.
 * `slotIdx` se refere ao índice do array em FORMATION_SLOTS.
 */
function entityToClassicAt(
  p: PlayerEntity,
  slotIdx: number,
  formation: keyof typeof FORMATION_SLOTS,
  team: 'home' | 'away',
  isStar: boolean,
): ClassicPlayer {
  const slots = FORMATION_SLOTS[formation] ?? FORMATION_SLOTS['4-3-3'];
  let [xPct, yPct] = slots[slotIdx] ?? [0.5, 0.5];
  if (team === 'away') xPct = 1 - xPct;

  const ovr = overallFromAttributes(p.attrs);
  const fatigue = Math.max(20, Math.min(85, p.fatigue ?? 35));
  const confidence = Math.max(45, Math.min(95, p.attrs.confianca ?? 70));

  return {
    id: stableNumericId(p.id),
    name: p.name,
    shortName: shortName(p.name),
    number: p.num,
    ovr,
    position: { x: xPct * FIELD_W_LOGIC, y: yPct * FIELD_H_LOGIC },
    archetype: derivedArchetype(p),
    team,
    role: derivedRoleFromPos(p.pos),
    fatigue,
    confidence,
    isStar,
    onFire: confidence >= 88,
    portraitUrl:      p.portraitUrl,
    portraitTokenUrl: p.portraitTokenUrl,
  };
}

/**
 * Constrói os 11 titulares CLASSIC a partir do lineup do manager.
 * `lineup`: slotId → playerId (ex.: { gol: 'p_001', zag1: 'p_002', … }).
 */
export function buildClassicTeamFromLineup(
  playersById: Record<string, PlayerEntity>,
  lineup: Record<string, string>,
  opts: BuildOpts,
): ClassicPlayer[] {
  const formation = opts.formation ?? '4-3-3';
  const out: ClassicPlayer[] = [];
  CLASSIC_SLOT_ORDER_BY_LINEUP_KEY.forEach((slotKey, idx) => {
    const playerId = lineup[slotKey];
    if (!playerId) return;
    const entity = playersById[playerId];
    if (!entity) return;
    const isStar = !!opts.starterId && entity.id === opts.starterId;
    out.push(entityToClassicAt(entity, idx, formation, opts.team, isStar));
  });
  return out;
}

/**
 * Constrói os 11 titulares a partir de um squad arbitrário (caso AWAY com
 * `genesisAwayPlayers`). Usa `awayStartingElevenFromSquad` lógica simples.
 */
export function buildClassicTeamFromSquad(
  squad: PlayerEntity[],
  opts: BuildOpts,
): ClassicPlayer[] {
  const formation = opts.formation ?? '4-3-3';
  // Tenta agrupar por posição na ordem CLASSIC; preenche o que sobrar
  const byRole: Record<string, PlayerEntity[]> = {};
  squad.forEach(p => {
    const role = derivedRoleFromPos(p.pos);
    (byRole[role] = byRole[role] ?? []).push(p);
  });
  const orderedRoles = ['GK', 'RB', 'CB', 'CB', 'LB', 'DM', 'CM', 'CM', 'RW', 'ST', 'LW'];
  const used = new Set<string>();
  const out: ClassicPlayer[] = [];
  orderedRoles.forEach((role, idx) => {
    const candidates = byRole[role] ?? [];
    const pick = candidates.find(p => !used.has(p.id));
    const fallback = squad.find(p => !used.has(p.id));
    const entity = pick ?? fallback;
    if (!entity) return;
    used.add(entity.id);
    const isStar = !!opts.starterId && entity.id === opts.starterId;
    out.push(entityToClassicAt(entity, idx, formation, opts.team, isStar));
  });
  // Garantir 11
  while (out.length < 11) {
    const remaining = squad.find(p => !used.has(p.id));
    if (!remaining) break;
    used.add(remaining.id);
    out.push(entityToClassicAt(remaining, out.length, formation, opts.team, false));
  }
  return out;
}

/**
 * Gera um time AWAY sintético plausível a partir de um `OpponentStub` simples
 * (id + name + strength). Usado quando o adversário não traz `genesisAwayPlayers`.
 */
export function buildSyntheticAwayTeam(
  opponentName: string,
  strength: number,
  opts: BuildOpts,
): ClassicPlayer[] {
  const surnames = ['RIBEIRO','NUNES','CARVALHO','MENDES','TEIXEIRA','BARBOSA','CARDOSO','REIS','MOREIRA','CASTRO','FREITAS','DIAS','OLIVEIRA','COSTA'];
  const slotConfig: Array<{ role: string; num: number; archetype: ArchetypeId }> = [
    { role:'GK', num:1,  archetype:'COLD_BLOOD' },
    { role:'RB', num:2,  archetype:'ENGINE'      },
    { role:'CB', num:5,  archetype:'VETERAN'     },
    { role:'CB', num:4,  archetype:'DESTROYER'   },
    { role:'LB', num:3,  archetype:'ENGINE'      },
    { role:'DM', num:8,  archetype:'HUNTER'      },
    { role:'CM', num:10, archetype:'MAESTRO'     },
    { role:'CM', num:6,  archetype:'ENGINE'      },
    { role:'RW', num:7,  archetype:'WILD'        },
    { role:'ST', num:9,  archetype:'FINISHER'    },
    { role:'LW', num:11, archetype:'BOX_INVADER' },
  ];
  const formation = opts.formation ?? '4-3-3';
  const slots = FORMATION_SLOTS[formation] ?? FORMATION_SLOTS['4-3-3'];
  const baseConfidence = 50 + Math.floor((strength / 100) * 40);

  return slotConfig.map((cfg, idx) => {
    let [xPct, yPct] = slots[idx] ?? [0.5, 0.5];
    if (opts.team === 'away') xPct = 1 - xPct;
    const sur = surnames[(idx + opponentName.length) % surnames.length];
    return {
      id: stableNumericId(`syn-${opponentName}-${idx}`),
      name: sur,
      shortName: sur,
      number: cfg.num,
      ovr: Math.max(55, Math.min(92, strength + (idx === 9 ? 6 : idx === 6 ? 4 : 0))),
      position: { x: xPct * FIELD_W_LOGIC, y: yPct * FIELD_H_LOGIC },
      archetype: cfg.archetype,
      team: opts.team,
      role: cfg.role,
      fatigue: 20 + Math.floor(Math.random() * 25),
      confidence: baseConfidence + Math.floor(Math.random() * 20),
      isStar: idx === 9, // ST como destaque
    };
  });
}
