import { create } from 'zustand';
import { MISSION_BY_ID, MISSION_CATALOG } from './missions/catalog';
import { getDailyResetKey, getWeeklyResetKey } from './missions/resetKeys';
import { getManagerLevel, expToNextLevel } from './levelSystem';
import type { MissionDef, MissionEvent, MissionRuntimeState } from './types';

function emptyMissionState(): MissionRuntimeState {
  return { progress: 0, claimed: false, distinctDone: [] };
}

function initialMissions(): Record<string, MissionRuntimeState> {
  const o: Record<string, MissionRuntimeState> = {};
  for (const m of MISSION_CATALOG) {
    o[m.id] = emptyMissionState();
  }
  return o;
}

function applyResets(
  state: Pick<ProgressionSlice, 'dailyResetKey' | 'weeklyResetKey' | 'missions'>
): Pick<ProgressionSlice, 'dailyResetKey' | 'weeklyResetKey' | 'missions'> {
  const today = getDailyResetKey();
  const week = getWeeklyResetKey();
  let { missions } = state;
  const next = { ...missions };

  if (state.dailyResetKey !== today) {
    for (const def of MISSION_CATALOG) {
      if (def.kind !== 'daily') continue;
      next[def.id] = emptyMissionState();
    }
  }

  if (state.weeklyResetKey !== week) {
    for (const def of MISSION_CATALOG) {
      if (def.kind !== 'weekly') continue;
      next[def.id] = emptyMissionState();
    }
  }

  return { dailyResetKey: today, weeklyResetKey: week, missions: next };
}

function canTrack(def: MissionDef, ms: MissionRuntimeState): boolean {
  if (ms.claimed) return false;
  return ms.progress < def.targetCount;
}

function applyEventToMission(def: MissionDef, ms: MissionRuntimeState, event: MissionEvent, amount: number): MissionRuntimeState {
  if (!def.trackEvents.includes(event)) return ms;

  const mode = def.progressMode ?? 'sum';
  if (mode === 'distinct') {
    const done = new Set(ms.distinctDone ?? []);
    if (!done.has(event)) {
      done.add(event);
      const progress = Math.min(def.targetCount, done.size);
      return { ...ms, progress, distinctDone: [...done] };
    }
    return ms;
  }

  const progress = Math.min(def.targetCount, ms.progress + amount);
  return { ...ms, progress };
}

export interface ProgressionSlice {
  expBalance: number;
  expLifetimeEarned: number;
  dailyResetKey: string;
  weeklyResetKey: string;
  missions: Record<string, MissionRuntimeState>;
}

interface ProgressionActions {
  /** Chame no mount do app / ao focar o app para aplicar resets de dia/semana. */
  ensureResets: () => void;
  /** Chame ao abrir app, mudar de tela relevante, fim de partida, etc. */
  trackMissionEvent: (event: MissionEvent, amount?: number) => void;
  /** Resgata EXP se a missão estiver completa e não resgatada */
  claimMission: (missionId: string) => boolean;
  /** Gastar EXP (loja, estrutura) — só altera balance, não lifetime nem nível */
  spendExp: (amount: number) => boolean;
  /** Conceder EXP fora de missões (ex.: fim de partida) */
  grantExp: (amount: number) => void;
  /** Para testes / admin */
  resetProgression: () => void;
}

type Store = ProgressionSlice & ProgressionActions;

export const useProgressionStore = create<Store>((set, get) => ({
  expBalance: 0,
  expLifetimeEarned: 0,
  dailyResetKey: '',
  weeklyResetKey: '',
  missions: initialMissions(),

  ensureResets: () => {
    set((s) => {
      const today = getDailyResetKey();
      const week = getWeeklyResetKey();
      if (s.dailyResetKey === today && s.weeklyResetKey === week) return s;
      return { ...s, ...applyResets(s) };
    });
  },

  trackMissionEvent: (event, amount = 1) => {
    set((s) => {
      const r = applyResets(s);
      const missions = { ...r.missions };
      for (const def of MISSION_CATALOG) {
        const ms = missions[def.id] ?? emptyMissionState();
        if (!canTrack(def, ms)) continue;
        missions[def.id] = applyEventToMission(def, ms, event, amount);
      }
      return { ...s, ...r, missions };
    });
  },

  claimMission: (missionId) => {
    const def = MISSION_BY_ID.get(missionId);
    if (!def) return false;
    let claimedOk = false;
    set((s) => {
      const r = applyResets(s);
      const ms = r.missions[missionId];
      if (!ms || ms.claimed || ms.progress < def.targetCount) {
        return { ...s, ...r };
      }
      claimedOk = true;
      const reward = def.rewardExp;
      return {
        ...s,
        ...r,
        expBalance: s.expBalance + reward,
        expLifetimeEarned: s.expLifetimeEarned + reward,
        missions: {
          ...r.missions,
          [missionId]: { ...ms, claimed: true },
        },
      };
    });
    if (claimedOk) {
      get().trackMissionEvent('mission_claimed', 1);
    }
    return claimedOk;
  },

  spendExp: (amount) => {
    if (amount <= 0) return true;
    const s = get();
    if (s.expBalance < amount) return false;
    set({ expBalance: s.expBalance - amount });
    return true;
  },

  grantExp: (amount) => {
    if (amount <= 0) return;
    set((s) => ({
      expBalance: s.expBalance + amount,
      expLifetimeEarned: s.expLifetimeEarned + amount,
    }));
  },

  resetProgression: () => {
    set({
      expBalance: 0,
      expLifetimeEarned: 0,
      dailyResetKey: '',
      weeklyResetKey: '',
      missions: initialMissions(),
    });
  },
}));

/** Seletores para UI */
export function selectManagerLevel(): number {
  return getManagerLevel(useProgressionStore.getState().expLifetimeEarned);
}

export function selectLevelProgress() {
  return expToNextLevel(useProgressionStore.getState().expLifetimeEarned);
}

export function selectMissionsForUI(): Array<{
  def: MissionDef;
  state: MissionRuntimeState;
  complete: boolean;
}> {
  const missions = useProgressionStore.getState().missions;
  return MISSION_CATALOG.map((def) => {
    const state = missions[def.id] ?? emptyMissionState();
    return {
      def,
      state,
      complete: state.progress >= def.targetCount && !state.claimed,
    };
  });
}
