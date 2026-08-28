/**
 * PlayerRequestCard — O JOGADOR BATE NA PORTA (Fase 4).
 *
 * A única superfície do jogo onde um atleta fala com o manager em nome próprio,
 * e a resposta muda alguma coisa de verdade:
 *
 *   escolha → managerRelationByPlayer → relacaoManager → obediência em campo
 *           → playerMoral            → lida por TODOS os modos de partida
 *
 * Três respostas, nenhuma "certa". Dar chance compra relação e moral, mas
 * compromete o manager. Mandar conquistar é honesto e áspero. Prometer agrada
 * agora, resolve pouco — e o pedido volta.
 *
 * Presentational puro: pedido e handler entram por prop.
 */

import { useEffect } from 'react';
import { motion } from 'motion/react';
import { MessageSquare } from 'lucide-react';
import {
  CHOICE_LABEL,
  type PlayerRequest,
  type PlayerRequestChoice,
} from '@/systems/playerPersonality';
import { track } from '@/analytics/track';

const CHOICES: readonly PlayerRequestChoice[] = ['grant', 'challenge', 'promise'] as const;

export function PlayerRequestCard({
  request,
  onChoose,
}: {
  request: PlayerRequest;
  onChoose: (choice: PlayerRequestChoice) => void;
}) {
  // Denominador da taxa de resposta: quantos pedidos aparecem e nunca são
  // respondidos? Se for a maioria, o card está no lugar errado da Home.
  useEffect(() => {
    track('request_shown', { kind: request.kind });
  }, [request.id, request.kind]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      aria-label={`${request.playerName} quer conversar`}
      className="border"
      style={{
        borderRadius: 'var(--radius-card)',
        borderColor: 'rgba(253,225,0,0.35)',
        background: 'var(--color-panel)',
        boxShadow: 'var(--shadow-card)',
        padding: '16px 16px 14px',
      }}
    >
      <p
        className="mb-2 inline-flex items-center gap-1.5 font-display font-black uppercase text-neon-yellow"
        style={{ fontSize: '9px', letterSpacing: '0.26em' }}
      >
        <MessageSquare aria-hidden className="h-3 w-3" strokeWidth={2.6} />
        No vestiário
      </p>

      <p
        className="text-white"
        style={{ fontFamily: 'var(--font-serif-hero)', fontStyle: 'italic', fontSize: 'clamp(17px, 4.5vw, 21px)', lineHeight: 1.2 }}
      >
        “{request.quote}”
      </p>
      <p
        className="mt-1.5 font-display font-bold uppercase text-white/50"
        style={{ fontSize: '10px', letterSpacing: '0.18em' }}
      >
        {request.playerName}
      </p>

      <div className="mt-3.5 grid grid-cols-3 gap-1.5">
        {CHOICES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              // A pergunta central da Fase 4: qual das três ganha? Se for
              // sempre "dar chance", as outras duas não estão custando nada.
              track('request_resolved', { kind: request.kind, choice: c });
              onChoose(c);
            }}
            className="min-h-[44px] border px-1 py-2 font-display text-[10px] font-black uppercase leading-tight tracking-[0.06em] text-white/70 transition-colors hover:border-neon-yellow hover:bg-neon-yellow hover:text-black"
            style={{ borderColor: 'var(--color-border)', borderRadius: 'var(--radius-sm)' }}
          >
            {CHOICE_LABEL[c]}
          </button>
        ))}
      </div>
    </motion.section>
  );
}
