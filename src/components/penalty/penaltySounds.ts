/**
 * Sons procedurais do pênalti via Web Audio API.
 * Sem libs externas — gerados em runtime, ~0kb de bundle.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  // Resume se foi suspenso (autoplay policy do browser)
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/** "Thock" — clique no slot escolhido. Curto, percussivo, baixo. */
export function playThock() {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(180, t0);
  osc.frequency.exponentialRampToValueAtTime(80, t0 + 0.08);
  gain.gain.setValueAtTime(0.001, t0);
  gain.gain.exponentialRampToValueAtTime(0.5, t0 + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + 0.15);
}

/** "Swoosh" — bola voando após o chute. Filtered noise rampa. */
export function playSwoosh(intensity = 1) {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime;
  const dur = 0.35 * intensity;

  // White noise
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.6;

  const src = c.createBufferSource();
  src.buffer = buf;

  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(800, t0);
  filter.frequency.exponentialRampToValueAtTime(2200, t0 + dur);
  filter.Q.value = 6;

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.001, t0);
  gain.gain.exponentialRampToValueAtTime(0.4 * intensity, t0 + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

  src.connect(filter).connect(gain).connect(c.destination);
  src.start(t0);
  src.stop(t0 + dur);
}

/** "Woosh+net" — bola na rede. Hit + textura de fios. */
export function playGoalNet() {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime;

  // Hit kick
  const osc = c.createOscillator();
  const oscGain = c.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(80, t0);
  osc.frequency.exponentialRampToValueAtTime(40, t0 + 0.15);
  oscGain.gain.setValueAtTime(0.001, t0);
  oscGain.gain.exponentialRampToValueAtTime(0.7, t0 + 0.005);
  oscGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2);
  osc.connect(oscGain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + 0.25);

  // Net texture (high noise burst)
  const buf = c.createBuffer(1, c.sampleRate * 0.4, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const decay = 1 - i / data.length;
    data[i] = (Math.random() * 2 - 1) * 0.5 * decay * decay;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 2000;
  const netGain = c.createGain();
  netGain.gain.value = 0.5;
  src.connect(filter).connect(netGain).connect(c.destination);
  src.start(t0 + 0.04);
}

/** "Smack" — defesa do goleiro (bola na luva). Soco abafado. */
export function playSave() {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(120, t0);
  osc.frequency.exponentialRampToValueAtTime(60, t0 + 0.08);
  gain.gain.setValueAtTime(0.001, t0);
  gain.gain.exponentialRampToValueAtTime(0.45, t0 + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 600;
  osc.connect(filter).connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + 0.18);
}

/** "Clang" — bola na trave. Metálico, ressonante. */
export function playPost() {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(640, t0);
  osc.frequency.exponentialRampToValueAtTime(380, t0 + 0.5);
  gain.gain.setValueAtTime(0.001, t0);
  gain.gain.exponentialRampToValueAtTime(0.55, t0 + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.6);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + 0.65);
}
