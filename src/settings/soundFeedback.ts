import { getGameState } from '@/game/store';

/** Bip curto de UI quando sons estão ativos (ex.: após ativar toggle em Config). */
export function playUiChime(): void {
  if (!getGameState().userSettings.soundEnabled) return;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = 0.04;
    osc.frequency.value = 660;
    osc.type = 'sine';
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
    osc.onended = () => void ctx.close();
  } catch {
    /* ignore */
  }
}
