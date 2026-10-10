/**
 * PARTIDA VIVA — som que reage ao jogo (Fase 5). Tudo SINTETIZADO (Web Audio),
 * sem arquivo de áudio: torcida (ruído filtrado), chute seco, apito com
 * vibrato, explosão no gol, "uuuh" na trave.
 *
 * O cinematográfico é o SILÊNCIO: a torcida sobe com o perigo e cala no chute.
 * O navegador só libera áudio depois de um toque — `ligar()` é chamado no
 * botão "Ver em campo" ou no "Som" do trilho. Tudo aqui nunca lança.
 */

export type EventoDeSom = 'chute' | 'gol' | 'trave' | 'defesa' | 'roubada' | 'apito' | 'passe';

interface Motor {
  ctx: AudioContext;
  mestre: GainNode;
  torcida: GainNode;
  filtro: BiquadFilterNode;
}

let motor: Motor | null = null;
let ligado = false;
/** Explosão (gol/trave) decaindo: 0–1. */
let explosao = 0;

function criar(): Motor | null {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx();
    const mestre = ctx.createGain();
    mestre.gain.value = 0;
    mestre.connect(ctx.destination);
    // Torcida: 2 s de ruído branco em laço, passa-faixa ~850 Hz.
    const n = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const dados = buf.getChannelData(0);
    let semente = 12345;
    for (let i = 0; i < n; i++) { semente = (semente * 1103515245 + 12345) & 0x7fffffff; dados[i] = (semente / 0x7fffffff) * 2 - 1; }
    const fonte = ctx.createBufferSource();
    fonte.buffer = buf;
    fonte.loop = true;
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'bandpass';
    filtro.frequency.value = 850;
    filtro.Q.value = 0.5;
    const torcida = ctx.createGain();
    torcida.gain.value = 0;
    fonte.connect(filtro).connect(torcida).connect(mestre);
    fonte.start();
    return { ctx, mestre, torcida, filtro };
  } catch {
    return null;
  }
}

/** Chamar DENTRO de um toque do usuário. */
export function ligarSom(): boolean {
  if (!motor) motor = criar();
  if (!motor) return false;
  void motor.ctx.resume().catch(() => undefined);
  ligado = true;
  motor.mestre.gain.setTargetAtTime(0.9, motor.ctx.currentTime, 0.2);
  return true;
}

export function desligarSom(): void {
  ligado = false;
  if (motor) motor.mestre.gain.setTargetAtTime(0, motor.ctx.currentTime, 0.1);
}

export const somLigado = () => ligado && !!motor;

/**
 * A cada quadro: `tensao` 0–1 (bola perto do gol, lance grande), `silencio`
 * quando a câmera está lenta no chute.
 */
export function tiqueDoSom(tensao: number, silencio: boolean, dt: number): void {
  if (!ligado || !motor) return;
  explosao = Math.max(0, explosao - dt * 0.22);
  const t = motor.ctx.currentTime;
  let alvo: number, tc = 0.25;
  if (explosao > 0) { alvo = 0.1 + 0.4 * explosao; tc = 0.06; }
  else if (silencio) { alvo = 0.012; tc = 0.06; }
  else alvo = 0.04 + 0.14 * Math.max(0, Math.min(1, tensao));
  motor.torcida.gain.setTargetAtTime(alvo, t, tc);
  motor.filtro.frequency.setTargetAtTime(explosao > 0 ? 1100 : 850, t, 0.2);
}

function batida(forte: boolean): void {
  if (!motor) return;
  const { ctx, mestre } = motor, t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(forte ? 150 : 110, t);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
  g.gain.setValueAtTime(forte ? 0.55 : 0.18, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  o.connect(g).connect(mestre);
  o.start(t); o.stop(t + 0.16);
}

function apito(longo: boolean): void {
  if (!motor) return;
  const { ctx, mestre } = motor, t = ctx.currentTime, d = longo ? 0.9 : 0.45;
  const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain();
  o.frequency.value = 2900; lfo.frequency.value = 28; lg.gain.value = 150;
  lfo.connect(lg).connect(o.frequency);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.06, t + 0.03);
  g.gain.setValueAtTime(0.06, t + d);
  g.gain.linearRampToValueAtTime(0, t + d + 0.1);
  o.connect(g).connect(mestre);
  o.start(t); lfo.start(t); o.stop(t + d + 0.15); lfo.stop(t + d + 0.15);
}

function vibrar(padrao: number[]): void {
  try { navigator.vibrate?.(padrao); } catch { /* iPhone não vibra pela web */ }
}

export function tocar(e: EventoDeSom): void {
  // Vibração vale mesmo com o som desligado (é tato, não som).
  if (e === 'gol') vibrar([60, 40, 140]);
  else if (e === 'trave') vibrar([40, 30, 40]);
  else if (e === 'roubada') vibrar([25]);
  if (!ligado || !motor) return;
  switch (e) {
    case 'chute': batida(true); break;
    case 'passe': batida(false); break;
    case 'gol': explosao = 1; break;
    case 'trave': batida(true); explosao = Math.max(explosao, 0.45); break;
    case 'defesa': explosao = Math.max(explosao, 0.35); break;
    case 'apito': apito(true); break;
    case 'roubada': break;
  }
}
