/**
 * PARTIDA VIVA — som que reage ao jogo (Fase 5). Tudo SINTETIZADO (Web Audio),
 * sem arquivo de áudio: torcida (ruído filtrado), chute seco, apito com
 * vibrato, explosão no gol, "uuuh" na trave.
 *
 * O cinematográfico é o SILÊNCIO: a torcida sobe com o perigo e cala no chute.
 * O navegador só libera áudio depois de um toque — `ligarSom()` é chamado no
 * botão "Ver em campo", no LEGACY do menu ou no "Som" do trilho.
 *
 * REGRA (bug de 09/10: a torcida ficava tocando depois da partida): o som
 * SEMPRE para — `pararSom()` ao sair do campo / fim de jogo / troca de página,
 * pausa sozinho com a aba em segundo plano, e cala nas telas da Rápida.
 * Tudo aqui nunca lança.
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
    // Torcida: 3 s de ruído MARROM (grave, sem chiado) em laço, entre ~110 e
    // ~520 Hz, com uma ondulação lenta — murmúrio de arquibancada.
    const n = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const dados = buf.getChannelData(0);
    let semente = 12345, ultimo = 0;
    for (let i = 0; i < n; i++) {
      semente = (semente * 1103515245 + 12345) & 0x7fffffff;
      const branco = (semente / 0x7fffffff) * 2 - 1;
      ultimo = (ultimo + 0.02 * branco) / 1.02;
      dados[i] = ultimo * 3.2;
    }
    const fonte = ctx.createBufferSource();
    fonte.buffer = buf;
    fonte.loop = true;
    const graves = ctx.createBiquadFilter();
    graves.type = 'highpass';
    graves.frequency.value = 110;
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = 520;
    const murmurio = ctx.createGain();
    murmurio.gain.value = 0.85;
    const onda = ctx.createOscillator(), profundidade = ctx.createGain();
    onda.frequency.value = 0.23;
    profundidade.gain.value = 0.15;
    onda.connect(profundidade).connect(murmurio.gain);
    onda.start();
    const torcida = ctx.createGain();
    torcida.gain.value = 0;
    fonte.connect(graves).connect(filtro).connect(murmurio).connect(torcida).connect(mestre);
    fonte.start();
    // Aba/app em segundo plano: pausa. Volta só se o som estiver ligado.
    document.addEventListener('visibilitychange', () => {
      if (!motor) return;
      if (document.hidden) void motor.ctx.suspend().catch(() => undefined);
      else if (ligado) void motor.ctx.resume().catch(() => undefined);
    });
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
  explosao = 0;
  if (!motor) return;
  const { ctx, mestre, torcida } = motor;
  mestre.gain.cancelScheduledValues(ctx.currentTime);
  mestre.gain.setValueAtTime(0, ctx.currentTime);
  torcida.gain.cancelScheduledValues(ctx.currentTime);
  torcida.gain.setValueAtTime(0, ctx.currentTime);
  // Suspende o motor: nada mais sai do alto-falante (nem um fio de ruído).
  void ctx.suspend().catch(() => undefined);
}

/** Saiu do campo / acabou a partida / trocou de página: o som PARA. */
export const pararSom = desligarSom;

export const somLigado = () => ligado && !!motor;

/**
 * A cada quadro: `tensao` 0–1 (bola perto do gol, lance grande), `silencio`
 * quando a câmera está lenta no chute.
 */
export function tiqueDoSom(tensao: number, silencio: boolean, dt: number, mudo = false): void {
  if (!ligado || !motor) return;
  explosao = Math.max(0, explosao - dt * 0.22);
  const t = motor.ctx.currentTime;
  let alvo: number, tc = 0.3;
  if (mudo) { alvo = 0; tc = 0.15; }
  else if (explosao > 0) { alvo = 0.06 + 0.24 * explosao; tc = 0.06; }
  else if (silencio) { alvo = 0.006; tc = 0.06; }
  else alvo = 0.025 + 0.075 * Math.max(0, Math.min(1, tensao));
  motor.torcida.gain.setTargetAtTime(alvo, t, tc);
  // No gol a arquibancada "abre" (mais agudo); no resto, murmúrio grave.
  motor.filtro.frequency.setTargetAtTime(explosao > 0 ? 900 : 520, t, 0.2);
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
