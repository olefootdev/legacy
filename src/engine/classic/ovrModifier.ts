/**
 * OVR → multiplicador de efetividade.
 *
 * O arquétipo define COMPORTAMENTO (FINISHER chuta, MAESTRO passa).
 * O OVR modula EFETIVIDADE — um 88 OVR converte mais, completa mais passes.
 *
 * Range: 0.85 (OVR 60) → 1.00 (OVR 75) → 1.15 (OVR 95)
 * Curva linear simples — sutil por design.
 */

const OVR_MIN = 60;
const OVR_MID = 75;
const OVR_MAX = 95;
const MOD_MIN = 0.92;   // suavizado — jogo arcade não pune times fracos demais
const MOD_MID = 1.00;
const MOD_MAX = 1.18;   // top players um pouco mais letais

export function ovrModifier(ovr: number): number {
  const clamped = Math.max(OVR_MIN, Math.min(OVR_MAX, ovr));
  if (clamped <= OVR_MID) {
    return MOD_MIN + (MOD_MID - MOD_MIN) * ((clamped - OVR_MIN) / (OVR_MID - OVR_MIN));
  }
  return MOD_MID + (MOD_MAX - MOD_MID) * ((clamped - OVR_MID) / (OVR_MAX - OVR_MID));
}
