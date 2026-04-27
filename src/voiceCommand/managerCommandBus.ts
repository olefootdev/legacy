/**
 * Bridge de eventos entre UI táctil (Action Cards, substituição, formação)
 * e o `VoiceCommandPanel`, que é o único lugar que conhece a pipeline completa
 * (profanity → parser → relay por assistente → obediência → dispatch → log).
 *
 * Cards tátçeis chamam `issueManagerCommand('pressiona alto')` e o painel de
 * voz processa como se fosse uma transcrição — mesma obediência, mesma bolha
 * no jogador, mesmo cooldown, mesmo log Supabase.
 *
 * Usar CustomEvent em vez de store mantém o painel desacoplado: se amanhã
 * existir outro componente de comando (ex: watch/voice OS), basta escutar.
 */

const EVENT_NAME = 'olefoot:manager-command';

export interface ManagerCommandDetail {
  phrase: string;
  /** Origem pra feedback — "touch" mostra o ícone do card, "voice" o do mic. */
  source?: 'touch' | 'voice';
}

export function issueManagerCommand(phrase: string, source: 'touch' | 'voice' = 'touch'): void {
  if (typeof window === 'undefined') return;
  const ev = new CustomEvent<ManagerCommandDetail>(EVENT_NAME, {
    detail: { phrase, source },
  });
  window.dispatchEvent(ev);
}

export function subscribeManagerCommand(
  handler: (detail: ManagerCommandDetail) => void,
): () => void {
  if (typeof window === 'undefined') return () => { /* noop */ };
  const listener = (e: Event) => {
    const detail = (e as CustomEvent<ManagerCommandDetail>).detail;
    if (detail) handler(detail);
  };
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
