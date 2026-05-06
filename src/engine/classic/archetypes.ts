import type { ArchetypeId } from './types';

export interface ArchetypeConfig {
  shotFreq: number;
  passFreq: number;
  risk: number;
  pressureFreq: number;
  interceptionFreq: number;
  tackleFreq: number;
  foulFreq: number;
  aerialFreq: number;
  stamina: number;
  positionBonus: number;
  slowsRhythm: boolean;
  stressImmune: boolean;
  unpredictable: boolean;
}

export const ARCHETYPES: Record<ArchetypeId, ArchetypeConfig> = {
  FINISHER:    { shotFreq:0.9, passFreq:0.3, risk:0.8, pressureFreq:0.2, interceptionFreq:0.1, tackleFreq:0.1, foulFreq:0.05, aerialFreq:0.4, stamina:0.7, positionBonus:0.5, slowsRhythm:false, stressImmune:false, unpredictable:false },
  MAESTRO:     { shotFreq:0.3, passFreq:0.95, risk:0.4, pressureFreq:0.3, interceptionFreq:0.3, tackleFreq:0.1, foulFreq:0.05, aerialFreq:0.1, stamina:0.8, positionBonus:0.2, slowsRhythm:true, stressImmune:false, unpredictable:false },
  HUNTER:      { shotFreq:0.4, passFreq:0.5, risk:0.5, pressureFreq:0.9, interceptionFreq:0.8, tackleFreq:0.6, foulFreq:0.15, aerialFreq:0.3, stamina:0.9, positionBonus:0.1, slowsRhythm:false, stressImmune:false, unpredictable:false },
  ENGINE:      { shotFreq:0.3, passFreq:0.8, risk:0.4, pressureFreq:0.5, interceptionFreq:0.4, tackleFreq:0.4, foulFreq:0.1, aerialFreq:0.2, stamina:0.95, positionBonus:0.1, slowsRhythm:false, stressImmune:false, unpredictable:false },
  COLD_BLOOD:  { shotFreq:0.8, passFreq:0.5, risk:0.3, pressureFreq:0.2, interceptionFreq:0.2, tackleFreq:0.2, foulFreq:0.05, aerialFreq:0.3, stamina:0.7, positionBonus:0.3, slowsRhythm:false, stressImmune:true, unpredictable:false },
  DESTROYER:   { shotFreq:0.2, passFreq:0.4, risk:0.5, pressureFreq:0.7, interceptionFreq:0.5, tackleFreq:0.9, foulFreq:0.3, aerialFreq:0.5, stamina:0.8, positionBonus:0.0, slowsRhythm:false, stressImmune:false, unpredictable:false },
  VETERAN:     { shotFreq:0.3, passFreq:0.85, risk:0.2, pressureFreq:0.3, interceptionFreq:0.5, tackleFreq:0.3, foulFreq:0.05, aerialFreq:0.2, stamina:0.6, positionBonus:0.2, slowsRhythm:true, stressImmune:false, unpredictable:false },
  WILD:        { shotFreq:0.7, passFreq:0.4, risk:1.0, pressureFreq:0.4, interceptionFreq:0.2, tackleFreq:0.4, foulFreq:0.2, aerialFreq:0.4, stamina:0.8, positionBonus:0.1, slowsRhythm:false, stressImmune:false, unpredictable:true },
  BOX_INVADER: { shotFreq:0.7, passFreq:0.4, risk:0.6, pressureFreq:0.3, interceptionFreq:0.2, tackleFreq:0.2, foulFreq:0.1, aerialFreq:0.8, stamina:0.75, positionBonus:0.3, slowsRhythm:false, stressImmune:false, unpredictable:false },
};
