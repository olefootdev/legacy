import { useEffect } from 'react';
import { useGameStore } from '@/game/store';
import type { UserSettings } from '@/game/types';

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

  useEffect(() => {
    applyGraphicQuality(userSettings.graphicQuality);
    document.documentElement.lang = userSettings.language === 'pt-BR' ? 'pt-BR' : 'pt-BR';
  }, [userSettings.graphicQuality, userSettings.language]);

  useEffect(() => {
    return applyReduceMotion(userSettings.reduceMotion);
  }, [userSettings.reduceMotion]);

  return null;
}
