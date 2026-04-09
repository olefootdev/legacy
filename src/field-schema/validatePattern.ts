import type { FieldZoneCatalog } from './catalogTypes';
import type { TacticalPattern } from './adminArtifacts';

export function catalogHasZone(catalog: FieldZoneCatalog, zoneId: string): boolean {
  return catalog.zones.some((z) => z.id === zoneId);
}

/** Validação ao salvar no Admin: todo zoneId referenciado existe no catálogo da mesma versão. */
export function validateTacticalPatternAgainstCatalog(
  pattern: TacticalPattern,
  catalog: FieldZoneCatalog,
): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (pattern.fieldSchemaVersion !== catalog.fieldSchemaVersion) {
    errors.push(
      `fieldSchemaVersion mismatch: pattern=${pattern.fieldSchemaVersion} catalog=${catalog.fieldSchemaVersion}`,
    );
  }
  for (const zid of pattern.behavior.pressTriggerZones) {
    if (!catalogHasZone(catalog, zid)) errors.push(`pressTriggerZones: unknown zoneId "${zid}"`);
  }
  for (const [phase, prof] of Object.entries(pattern.phasePresets)) {
    if (!prof) continue;
    for (const zid of prof.targetZoneIds) {
      if (!catalogHasZone(catalog, zid)) {
        errors.push(`phasePresets.${phase}: unknown zoneId "${zid}"`);
      }
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}
