import { useEffect } from 'react';
import { useGameDispatch, useGameStore } from '@/game/store';
import type { UserSettings } from '@/game/types';
import { syncLegacyMentorships } from '@/legacy/runtime';
import { getMyStatus } from '@/supabase/adminCore';
import { loadPlatformConfigOnce } from '@/admin/platformConfigStore';
import { getSupabase } from '@/supabase/client';
import { syncAdminBroadcasts } from '@/notifications/broadcastConsumer';

function applyGraphicQuality(q: UserSettings['graphicQuality']) {
  document.documentElement.dataset.graphicQuality = q;
}

function applyReduceMotion(pref: UserSettings['reduceMotion']) {
  const root = document.documentElement;
  if (pref === 'reduce') {
    root.classList.add('olefoot-reduce-motion');
    return () => root.classList.remove('olefoot-reduce-motion');
  }
  if (pref === 'noReduce') {
    root.classList.remove('olefoot-reduce-motion');
    return () => {};
  }
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const sync = () => root.classList.toggle('olefoot-reduce-motion', mq.matches);
  sync();
  mq.addEventListener('change', sync);
  return () => mq.removeEventListener('change', sync);
}

/** Sincroniza preferências persistidas com o documento (motion, qualidade, idioma). */
export function UserSettingsEffects() {
  const userSettings = useGameStore((s) => s.userSettings);
  const dispatch = useGameDispatch();

  useEffect(() => {
    void syncLegacyMentorships(dispatch);
    void loadPlatformConfigOnce();
    void syncAdminBroadcasts();
    void getMyStatus().then((s) => {
      if (s === 'banned') {
        const sb = getSupabase();
        try { void sb?.auth.signOut(); } catch { /* noop */ }
        window.alert('A tua conta foi banida. Se acreditas que é um erro, contacta o suporte.');
        window.location.href = '/';
      }
    });
  }, [dispatch]);

  useEffect(() => {
    applyGraphicQuality(userSettings.graphicQuality);
    document.documentElement.lang = userSettings.language === 'pt-BR' ? 'pt-BR' : 'pt-BR';
  }, [userSettings.graphicQuality, userSettings.language]);

  useEffect(() => {
    return applyReduceMotion(userSettings.reduceMotion);
  }, [userSettings.reduceMotion]);

  return null;
}
