/**
 * COMANDO DE VOZ (protótipo) — ouvir o manager.
 *
 * Usa o reconhecimento de fala do próprio navegador (Chrome no Android, Safari
 * no iPhone). Quem transcreve é o serviço de fala do navegador (Google no Chrome,
 * Apple no Safari — pode sair do aparelho pra isso); o JOGO não grava nem guarda
 * áudio: só recebe o texto e o passa ao entendedor (entender.ts). Uma frase por toque: o reconhecedor para sozinho
 * no silêncio. Sem suporte (alguns navegadores de computador), o botão de voz
 * oferece digitar o comando — o mesmo caminho.
 */
interface ResultadoDeFala { transcript: string }
interface EventoDeFala { results: ArrayLike<ArrayLike<ResultadoDeFala> & { isFinal: boolean }> }
interface Reconhecedor {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  onresult: ((e: EventoDeFala) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
type Construtor = new () => Reconhecedor;

function construtor(): Construtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: Construtor; webkitSpeechRecognition?: Construtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const vozDisponivel = (): boolean => construtor() !== null;

export interface Escuta {
  parar(): void;
}

/**
 * Ouve UMA frase. `parcial` mostra o que está sendo ouvido; `final` traz as
 * alternativas (a mais provável primeiro) — o entendedor tenta cada uma.
 */
export function ouvir(lang: 'pt' | 'en', cb: { parcial: (t: string) => void; final: (alternativas: string[]) => void; erro: (motivo: string) => void }): Escuta | null {
  const C = construtor();
  if (!C) return null;
  const r = new C();
  r.lang = lang === 'en' ? 'en-US' : 'pt-BR';
  r.continuous = false;
  r.interimResults = true;
  r.maxAlternatives = 3;
  let entregue = false;
  r.onresult = (e) => {
    const ult = e.results[e.results.length - 1];
    if (!ult) return;
    if (ult.isFinal) {
      entregue = true;
      cb.final(Array.from({ length: ult.length }, (_, i) => ult[i]!.transcript.trim()).filter(Boolean));
    } else cb.parcial(ult[0]?.transcript ?? '');
  };
  r.onerror = (e) => { if (!entregue) { entregue = true; cb.erro(e.error); } };
  r.onend = () => { if (!entregue) { entregue = true; cb.final([]); } };
  try { r.start(); } catch { return null; }
  return { parar: () => { try { r.stop(); } catch { /* já parou */ } } };
}

/** O capitão responde em voz (só com o som ligado). Curto, pra não atrapalhar o jogo. */
export function capitaoFala(texto: string, lang: 'pt' | 'en'): void {
  try {
    const s = window.speechSynthesis;
    if (!s) return;
    s.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = lang === 'en' ? 'en-US' : 'pt-BR';
    u.rate = 1.1;
    u.pitch = 0.9;
    s.speak(u);
  } catch { /* sem voz sintetizada: segue só no texto */ }
}
