/**
 * track.ts — telemetria de PRODUTO.
 *
 * Responde uma pergunta que o OLEFOOT não sabia responder: *o jogador usou?*
 *
 * Não confundir com `@/progression/trackEvent`, que TEM nome parecido e não é
 * isto: aquele é o contador de progresso das missões (enum fechado, estado
 * local, sem destino). Este escreve em `public.product_events` e é lido por
 * service_role no backend.
 *
 * ── Contrato ────────────────────────────────────────────────────────────────
 *  • NUNCA lança. Telemetria que quebra tela é pior que telemetria nenhuma.
 *  • NUNCA bloqueia. Tudo é enfileirado e enviado em lote, fora do caminho
 *    da interação.
 *  • Vira no-op silencioso sem Supabase configurado ou sem sessão — o jogo
 *    roda igual offline e em dev.
 *  • 🔴 NADA de PII em `props`. Nome, e-mail, telefone e código de indicação
 *    estão proibidos: a tabela guarda `user_id` (uuid) e mais nada que
 *    identifique alguém. Só escalar e booleano aqui dentro.
 */

import { getSupabase, isSupabaseConfigured } from '@/supabase/client';

/**
 * Eventos instrumentados. Cada um existe pra responder UMA pergunta aberta
 * sobre as 4 fases do Ultra-Concept — não há evento aqui "por garantia".
 */
export type ProductEvent =
  /** Abertura de sessão na Home: em que estado o clube está? (Fase 1) */
  | 'pulse_seen'
  /** Qual modo a Home escolheu pra essa abertura. (Fase 1) */
  | 'home_mode'
  /** Um momento compartilhável foi DETECTADO e mostrado. (Fase 2) */
  | 'moment_detected'
  /** O manager apertou compartilhar — e o que o Web Share respondeu. (Fase 2) */
  | 'moment_shared'
  /** O bloco "o que este jogo causou" apareceu no pós-jogo. (Fase 3) */
  | 'consequences_seen'
  /** O manager escolheu o FOCO antes da partida. (Fase 3) */
  | 'focus_chosen'
  /** Um jogador pediu alguma coisa e o card foi mostrado. (Fase 4) */
  | 'request_shown'
  /** O manager respondeu ao pedido — e com qual das três. (Fase 4) */
  | 'request_resolved';

/** Só escalar e booleano. Ver a proibição de PII no cabeçalho. */
export type EventProps = Record<string, string | number | boolean | null>;

interface QueuedEvent {
  event: ProductEvent;
  props: EventProps;
  /** ISO local do momento em que ACONTECEU (não do envio). */
  created_at: string;
}

/** Manda em lote a cada 10s, ou antes se encher. */
const FLUSH_INTERVAL_MS = 10_000;
const FLUSH_AT_SIZE = 12;
/** Teto duro: sessão longa e offline não pode virar vazamento de memória. */
const QUEUE_CAP = 60;

let queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let listenersAttached = false;
/** Desliga tudo depois de uma falha dura (tabela ausente, permissão negada). */
let disabled = false;

function attachLifecycleListeners(): void {
  if (listenersAttached || typeof document === 'undefined') return;
  listenersAttached = true;
  // `pagehide` e o visibilitychange pra hidden são os dois momentos em que o
  // navegador ainda deixa mandar. `beforeunload` não é confiável no mobile.
  const onLeave = () => { void flush(); };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') onLeave();
  });
  window.addEventListener('pagehide', onLeave);
}

function scheduleFlush(): void {
  if (timer !== null) return;
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, FLUSH_INTERVAL_MS);
}

/**
 * Enfileira um evento. Retorna na hora — o envio acontece depois, em lote.
 *
 * Chamar isto de qualquer lugar (componente, reducer, handler) é seguro: sem
 * sessão, sem Supabase ou com a tabela indisponível, vira no-op.
 */
export function track(event: ProductEvent, props: EventProps = {}): void {
  if (disabled || !isSupabaseConfigured()) return;
  try {
    if (queue.length >= QUEUE_CAP) return; // descarta silenciosamente
    queue.push({ event, props, created_at: new Date().toISOString() });
    attachLifecycleListeners();
    if (queue.length >= FLUSH_AT_SIZE) void flush();
    else scheduleFlush();
  } catch {
    /* telemetria nunca derruba quem a chamou */
  }
}

/**
 * Envia o que estiver na fila. Idempotente e seguro de chamar à toa.
 *
 * O `user_id` NÃO é enviado: o default `auth.uid()` da tabela resolve, e é
 * justamente isso que impede o cliente de forjar identidade.
 */
export async function flush(): Promise<void> {
  if (disabled || queue.length === 0) return;
  const batch = queue;
  queue = [];
  if (timer !== null) { clearTimeout(timer); timer = null; }

  try {
    const sb = getSupabase();
    if (!sb) return;
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return; // deslogado: descarta, não acumula

    const { error } = await sb.from('product_events').insert(
      batch.map((e) => ({ event: e.event, props: e.props, created_at: e.created_at })),
    );

    // 42P01 = tabela não existe (migration não aplicada); 42501 = sem permissão.
    // Nos dois casos insistir só gasta rede — desliga até o próximo reload.
    if (error && (error.code === '42P01' || error.code === '42501')) {
      disabled = true;
    }
  } catch {
    /* rede caiu, sessão expirou: o lote se perde e a vida continua */
  }
}

/** Só pra self-test: devolve e limpa o estado interno. */
export function __resetForTests(): { queued: number } {
  const queued = queue.length;
  queue = [];
  disabled = false;
  if (timer !== null) { clearTimeout(timer); timer = null; }
  return { queued };
}
