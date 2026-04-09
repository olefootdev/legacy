import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';
import { defaultSlotOrder, getDynamicTargetsForLineup, type FormationContext } from '@/formation/layout433';
import { ZONE_CATALOG_V1 } from './sampleZones.v1';
import { validateTacticalPatternAgainstCatalog } from './validatePattern';
import { DEFAULT_TACTICAL_PATTERN_V1 } from './defaultTacticalPattern.v1';
import { zonesContainingWorldPoint } from './zoneQuery';

/**
 * Smoke: slots dinâmicos dentro do retângulo do campo + padrão default valida contra catálogo.
 * Rodar: `npm run test:field-smoke`
 */
export function runFieldSmoke(): void {
  const v = validateTacticalPatternAgainstCatalog(DEFAULT_TACTICAL_PATTERN_V1, ZONE_CATALOG_V1);
  if (v.ok === false) {
    throw new Error(`TacticalPattern validation failed:\n${v.errors.join('\n')}`);
  }

  const ctx: FormationContext = {
    scheme: '4-3-3',
    side: 'home',
    ballX: FIELD_LENGTH * 0.5,
    ballZ: FIELD_WIDTH * 0.5,
    mentality: 50,
    defensiveLine: 50,
    pressing: 50,
  };
  const map = getDynamicTargetsForLineup(defaultSlotOrder(), ctx);
  for (const [slot, w] of map) {
    if (w.x < 0 || w.x > FIELD_LENGTH || w.z < 0 || w.z > FIELD_WIDTH) {
      throw new Error(`slot ${slot} out of bounds: ${w.x}, ${w.z}`);
    }
    zonesContainingWorldPoint(ZONE_CATALOG_V1, 'home', w.x, w.z);
  }
}
