/**
 * /src/tactical/slotToTacticalRole.ts
 *
 * Mapeamento slotId canônico → TacticalRoleId padrão.
 *
 * Usado pelo TacticalSimLoop para determinar as zonas permitidas/proibidas
 * de cada agente sem precisar de dados do jogador.
 *
 * Extensível: quando o manager puder escolher a role de cada jogador,
 * basta passar o override via `slotToTacticalRoleId(slotId, overrideRoleId)`.
 */

import type { TacticalRoleId } from './roleTypes';
import { TACTICAL_ROLE_BY_ID } from './roles';
import type { TacticalRole } from './roleTypes';

// ── Mapeamento padrão slotId → TacticalRoleId ─────────────────────────────────
// Baseado na formação 4-3-3 canônica. Slots que aparecem em outras formações
// com função diferente (ex: 'vol' em 4-4-2 = meia esquerdo) mantêm o padrão
// até o manager fazer override.

const DEFAULT_SLOT_ROLE: Record<string, TacticalRoleId> = {
  // Goleiro
  gol:  'GK_CLASSIC',

  // Zagueiros
  zag1: 'CB_LEFT',
  zag2: 'CB_RIGHT',

  // Laterais
  le:   'LB_CLASSIC',
  ld:   'RB_CLASSIC',

  // Volante / CDM
  vol:  'CDM_ANCHOR',

  // Meias centrais
  mc1:  'CM_CLASSIC',
  mc2:  'CM_CLASSIC',

  // Pontas
  pe:   'LW_CLASSIC',
  pd:   'RW_CLASSIC',

  // Atacante
  ata:  'ST_CLASSIC',
};

/**
 * Retorna o TacticalRoleId para um slot.
 * @param slotId  — slot canônico ('gol', 'zag1', 'vol', 'mc1', 'pe', 'ata', etc.)
 * @param override — role escolhida pelo manager para este jogador (futuro)
 */
export function slotToTacticalRoleId(
  slotId: string | undefined,
  override?: TacticalRoleId,
): TacticalRoleId {
  if (override && TACTICAL_ROLE_BY_ID[override]) return override;
  const safe = slotId ?? 'mc1';
  return DEFAULT_SLOT_ROLE[safe] ?? 'CM_CLASSIC';
}

/**
 * Retorna o objeto TacticalRole completo para um slot.
 * Inclui allowedZones, forbiddenZones, attackShape, defenseShape, behaviorProfile.
 */
export function slotToTacticalRole(
  slotId: string | undefined,
  override?: TacticalRoleId,
): TacticalRole {
  const roleId = slotToTacticalRoleId(slotId, override);
  return TACTICAL_ROLE_BY_ID[roleId];
}
