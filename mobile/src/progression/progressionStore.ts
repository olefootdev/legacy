import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { MISSION_CATALOG } from './missions/catalog';
import { getDailyResetKey, getWeeklyResetKey } from './missions/resetKeys';
import type { MissionEventType, MissionProgressState, ProgressionPersistSlice } from './types';

function emptyProgress(): Record<string, MissionProgressState> {
  const o: Record<string, MissionProgressState> = {};
  for (const m of MISSION_CATALOG) {
    o[m.id] = { progress: 0, claimed: false };
  }
  return o;
}

function ensureMissionKeys(mp: Record<string, MissionProgressState>): Record<string, MissionProgressState> {
  const next = { ...mp };
  for (const m of MISSION_CATALOG) {
    if (!next[m.id]) next[m.id] = { progress: 0, claimed: false };
  }
  return next;
}

type ProgressionActions = {
  ensureResets: () => void;
  claimMission: (id: string) => boolean;
  trackMissionEvent: (event: MissionEventType, meta?: Record<string, unknown>) => void;
  /** Gasto de EXP: só reduz exp_balance (ranking); não altera nível. */
  spendExp: (amount: number) => void;
};

export type ProgressionStore = ProgressionPersistSlice & ProgressionActions;

export const useProgressionStore = create<ProgressionStore>()(
  persist(
    (set, get) => ({
      expBalance: 0,
      expLifetimeEarned: 0,
      missionProgress: emptyProgress(),
      lastDailyResetKey: '',
      lastWeeklyResetKey: '',

      ensureResets: () => {
        const dailyKey = getDailyResetKey();
        const weeklyKey = getWeeklyResetKey();
        const state = get();
        let mp = ensureMissionKeys(state.missionProgress);
        const patch: Partial<ProgressionPersistSlice> = {};

        if (state.lastDailyResetKey !== dailyKey) {
          for (const m of MISSION_CATALOG) {
            if (m.kind === 'daily') {
              mp[m.id] = { progress: 0, claimed: false };
            }
          }
          patch.lastDailyResetKey = dailyKey;
        }

        if (state.lastWeeklyResetKey !== weeklyKey) {
          for (const m of MISSION_CATALOG) {
            if (m.kind === 'weekly') {
              mp[m.id] = { progress: 0, claimed: false };
            }
          }
          patch.lastWeeklyResetKey = weeklyKey;
        }

        set({ missionProgress: mp, ...patch });
      },

      claimMission: (id: string) => {
        const m = MISSION_CATALOG.find((x) => x.id === id);
        if (!m) return false;
        const st = get().missionProgress[id];
        if (!st || st.claimed || st.progress < m.targetCount) return false;

        set({
          expBalance: get().expBalance + m.rewardExp,
          expLifetimeEarned: get().expLifetimeEarned + m.rewardExp,
          missionProgress: {
            ...get().missionProgress,
            [id]: { ...st, claimed: true },
          },
        });

        get().trackMissionEvent('mission_claimed', { claimedMissionId: id });
        return true;
      },

      trackMissionEvent: (event: MissionEventType, meta?: Record<string, unknown>) => {
        const missionProgress = { ...get().missionProgress };
        for (const m of MISSION_CATALOG) {
          if (m.trackEvent !== event) continue;
          const st = missionProgress[m.id] ?? { progress: 0, claimed: false };
          if (st.claimed) continue;

          let delta = 1;
          if (event === 'goal_scored') {
            delta = Math.max(1, Math.floor(Number(meta?.count ?? 1)));
          }
          if (event === 'mission_claimed') {
            const claimedId = meta?.claimedMissionId as string | undefined;
            if (m.id === 'weekly_missions' && claimedId === 'weekly_missions') continue;
            delta = 1;
          }

          const nextProg = Math.min(m.targetCount, st.progress + delta);
          missionProgress[m.id] = { ...st, progress: nextProg };
        }
        set({ missionProgress });
      },

      spendExp: (amount: number) => {
        const n = Math.max(0, Math.round(amount));
        set({ expBalance: Math.max(0, get().expBalance - n) });
      },
    }),
    {
      name: 'olefoot-progression-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        expBalance: s.expBalance,
        expLifetimeEarned: s.expLifetimeEarned,
        missionProgress: s.missionProgress,
        lastDailyResetKey: s.lastDailyResetKey,
        lastWeeklyResetKey: s.lastWeeklyResetKey,
      }),
    },
  ),
);
