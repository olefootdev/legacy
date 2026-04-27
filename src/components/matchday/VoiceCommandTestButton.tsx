/**
 * BOTÃO PROVISÓRIO de teste do sistema de voz — Dia 1 checkpoint.
 *
 * Dispara comandos fixos via clique + mostra feedback visual imediato.
 */

import { useState } from 'react';
import { Megaphone, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useGameDispatch, useGameStore } from '@/game/store';
import { parseVoiceCommand } from '@/voiceCommand/intentMatcher';
import { rollObedience } from '@/voiceCommand/obedienceRoll';
import { scanProfanity } from '@/voiceCommand/profanityFilter';
import {
  OBEDIENCE_TIER_BUBBLE,
  OBEDIENCE_TIER_COLOR,
  type ObedienceTier,
} from '@/voiceCommand/types';
import { cn } from '@/lib/utils';
import type { MatchPlayerAttributes } from '@/match/playerInMatch';

const TEST_PHRASES = [
  'Adrien invade a área',
  'Tenta o drible',
  'Atacantes, quebra a linha',
  'Pressiona alto',
  'Recua',
  'Segura a bola',
  'Sobe o lateral',
  'Muda pra 4-3-3',
  'Sai Adrien entra Gui',
  'Caralho que falta ridícula',
];

type FeedbackEntry = {
  id: string;
  kind: 'sent' | 'accepted' | 'refused' | 'warning' | 'error';
  playerName?: string;
  tier?: ObedienceTier;
  message: string;
  /** Linha secundária (opcional): detalhes dos scores. */
  detail?: string;
};

export function VoiceCommandTestButton() {
  const dispatch = useGameDispatch();
  const live = useGameStore((s) => s.liveMatch);
  const teamObedience = useGameStore((s) => s.tacticalObedience ?? 30);
  const [open, setOpen] = useState(false);
  const [feedbacks, setFeedbacks] = useState<FeedbackEntry[]>([]);
  const [pulseColor, setPulseColor] = useState<string | null>(null);

  const addFeedback = (f: Omit<FeedbackEntry, 'id'>) => {
    const id = `fb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setFeedbacks((prev) => [...prev, { ...f, id }]);
    window.setTimeout(() => {
      setFeedbacks((prev) => prev.filter((x) => x.id !== id));
    }, 3500);

    // flash na cor principal
    const color =
      f.kind === 'accepted' ? 'bg-emerald-500' :
      f.kind === 'refused' ? 'bg-rose-500' :
      f.kind === 'warning' ? 'bg-amber-500' :
      f.kind === 'error' ? 'bg-rose-600' :
      'bg-cyan-500';
    setPulseColor(color);
    window.setTimeout(() => setPulseColor(null), 600);
  };

  if (!live || live.phase !== 'playing') return null;

  const ctx = {
    homePlayers: live.homePlayers.map((p) => ({
      playerId: p.playerId,
      name: p.name,
      num: p.num,
      slotId: p.slotId,
      role: p.role,
    })),
    ballCarrierPlayerId: live.onBallPlayerId,
  };

  const issue = (phrase: string) => {
    // 0. CONFIRMAÇÃO DE ENVIO — sempre aparece primeiro, independente do resultado.
    addFeedback({
      kind: 'sent',
      message: `📨 ENVIADO: "${phrase}"`,
      detail: `Obediência coletiva: ${Math.round(teamObedience)}%`,
    });

    // 1. profanity scan
    const hits = scanProfanity(phrase);
    if (hits.length > 0) {
      const warnings = live.refereeLanguageWarnings ?? 0;
      if (warnings === 0) {
        dispatch({ type: 'REFEREE_WARNING_LANGUAGE', minute: live.minute });
        addFeedback({
          kind: 'warning',
          message: `⚠ Árbitro adverte: linguagem imprópria! (1ª vez)`,
        });
      } else {
        const best = [...live.homePlayers].sort(
          (a, b) => (live.homeStats?.[b.playerId]?.rating ?? 0) - (live.homeStats?.[a.playerId]?.rating ?? 0),
        )[0];
        if (best) {
          dispatch({
            type: 'REFEREE_RED_FOR_LANGUAGE',
            minute: live.minute,
            expelledPlayerId: best.playerId,
            expelledPlayerName: best.name,
          });
          addFeedback({
            kind: 'error',
            message: `🟥 VERMELHO em ${best.name} por conduta do treinador!`,
          });
        }
      }
      return;
    }

    // 2. parse intents
    const parsed = parseVoiceCommand(phrase, ctx);
    if (parsed.length === 0) {
      addFeedback({ kind: 'error', message: 'Comando não reconhecido' });
      return;
    }

    let dispatched = 0;

    for (const cmd of parsed) {
      // Substituição
      if (cmd.intent === 'player_substitution' && cmd.substitutionInfo) {
        const outT = cmd.substitutionInfo.out;
        const inT = cmd.substitutionInfo.in;
        const outId = outT.kind === 'player_id' ? outT.playerId : null;
        const inId = inT.kind === 'player_id' ? inT.playerId : null;
        if (outId && inId) {
          dispatch({ type: 'MATCH_SUBSTITUTE', outPlayerId: outId, inPlayerId: inId });
          const outName = live.homePlayers.find((p) => p.playerId === outId)?.name ?? 'jogador';
          const inName = outName; // estado pode não ter ainda
          addFeedback({
            kind: 'accepted',
            message: `🔄 Substituição: ${outName} → ${inName}`,
          });
          dispatched++;
        } else {
          addFeedback({ kind: 'error', message: 'Substituição falhou — jogador não reconhecido' });
        }
        continue;
      }

      // Formação
      if (cmd.intent === 'formation_change' && cmd.formationTarget) {
        dispatch({ type: 'LIVE_MATCH_SET_FORMATION', formationScheme: cmd.formationTarget });
        addFeedback({
          kind: 'accepted',
          message: `📐 Formação: ${cmd.formationTarget}`,
        });
        dispatched++;
        continue;
      }

      // Resolve alvo
      let targetPlayerId: string | null = null;
      const tgt = cmd.target;
      if (tgt.kind === 'player_id') targetPlayerId = tgt.playerId;
      else if (tgt.kind === 'ball_carrier' && live.onBallPlayerId) {
        targetPlayerId = live.onBallPlayerId;
      } else if (tgt.kind === 'role') {
        const first = live.homePlayers.find((p) => p.role === tgt.role);
        targetPlayerId = first?.playerId ?? null;
      } else if (tgt.kind === 'slot') {
        const match = live.homePlayers.find((p) => p.slotId === tgt.slotId);
        targetPlayerId = match?.playerId ?? null;
      } else if (tgt.kind === 'shirt_number') {
        const match = live.homePlayers.find((p) => p.num === tgt.number);
        targetPlayerId = match?.playerId ?? null;
      } else if (tgt.kind === 'team') {
        // Aplica a todos; feedback agregado por tier predominante
        const tiers: Record<ObedienceTier, number> = {
          critical_accept: 0,
          accept: 0,
          weak_accept: 0,
          refuse: 0,
          protest: 0,
        };
        for (const p of live.homePlayers) {
          const r = rollObedience({
            intent: cmd.intent,
            teamObedience,
            player: {
              attributes: p.attributes as MatchPlayerAttributes | undefined,
              role: p.role,
              slotId: p.slotId,
              fatigue: p.fatigue,
            },
          });
          tiers[r.tier]++;
          dispatch({
            type: 'VOICE_COMMAND_ISSUED',
            playerId: p.playerId,
            intent: cmd.intent,
            effectiveObedience: r.effectiveScore,
            tier: r.tier,
            rawText: cmd.rawText,
          });
        }
        const dominant = (Object.entries(tiers).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'accept') as ObedienceTier;
        const acceptedCount = tiers.critical_accept + tiers.accept + tiers.weak_accept;
        const refusedCount = tiers.refuse + tiers.protest;
        addFeedback({
          kind: acceptedCount > refusedCount ? 'accepted' : 'refused',
          message: `👥 Time: ${acceptedCount}/${live.homePlayers.length} aceitaram · ${OBEDIENCE_TIER_BUBBLE[dominant]}`,
          detail: `Coletiva ${Math.round(teamObedience)}% · ${tiers.critical_accept} críticos · ${tiers.accept} normais · ${refusedCount} recusaram`,
          tier: dominant,
        });
        dispatched++;
        continue;
      }

      if (!targetPlayerId) {
        addFeedback({ kind: 'error', message: `Alvo não resolvido para "${cmd.rawText}"` });
        continue;
      }
      const player = live.homePlayers.find((p) => p.playerId === targetPlayerId);
      if (!player) continue;

      const r = rollObedience({
        intent: cmd.intent,
        teamObedience,
        player: {
          attributes: player.attributes as MatchPlayerAttributes | undefined,
          role: player.role,
          slotId: player.slotId,
          fatigue: player.fatigue,
        },
      });
      dispatch({
        type: 'VOICE_COMMAND_ISSUED',
        playerId: targetPlayerId,
        intent: cmd.intent,
        effectiveObedience: r.effectiveScore,
        tier: r.tier,
        rawText: cmd.rawText,
      });

      const acceptedKinds = new Set<ObedienceTier>(['critical_accept', 'accept', 'weak_accept']);
      const accepted = acceptedKinds.has(r.tier);
      addFeedback({
        kind: accepted ? 'accepted' : 'refused',
        playerName: player.name,
        tier: r.tier,
        message: `${accepted ? '✅' : '❌'} ${player.name}: ${OBEDIENCE_TIER_BUBBLE[r.tier]}`,
        detail: `Individual ${Math.round(r.individualScore)}% × Coletiva ${Math.round(teamObedience)}% = Efetiva ${Math.round(r.effectiveScore)}%`,
      });
      dispatched++;
    }

    if (dispatched === 0) {
      addFeedback({ kind: 'error', message: 'Nenhum comando foi aplicado' });
    }
  };

  return (
    <>
      {/* Stack de feedbacks — aparece empilhado acima do botão */}
      <div className="fixed bottom-32 right-4 z-[9991] flex w-[280px] flex-col-reverse gap-2 pointer-events-none">
        <AnimatePresence>
          {feedbacks.map((f) => {
            const Icon =
              f.kind === 'sent' ? Megaphone :
              f.kind === 'accepted' ? CheckCircle2 :
              f.kind === 'refused' ? XCircle :
              f.kind === 'warning' ? AlertTriangle :
              f.kind === 'error' ? XCircle :
              CheckCircle2;
            const bg =
              f.kind === 'sent' ? 'bg-sky-500/25 border-sky-400/60 text-sky-50' :
              f.kind === 'accepted' ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-100' :
              f.kind === 'refused' ? 'bg-rose-500/20 border-rose-400/50 text-rose-100' :
              f.kind === 'warning' ? 'bg-amber-500/20 border-amber-400/50 text-amber-100' :
              f.kind === 'error' ? 'bg-rose-600/25 border-rose-500/60 text-rose-100' :
              'bg-cyan-500/20 border-cyan-400/50 text-cyan-100';
            return (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, y: 16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.9 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className={cn(
                  'rounded-xl border px-3 py-2 text-[11px] font-bold shadow-xl backdrop-blur',
                  bg,
                )}
              >
                <div className="flex items-start gap-2">
                  <Icon className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{f.message}</span>
                </div>
                {f.detail ? (
                  <div className="mt-1 text-[9px] uppercase tracking-wider opacity-80">
                    {f.detail}
                  </div>
                ) : null}
                {f.tier ? (
                  <div className="mt-0.5 text-[9px] uppercase tracking-wider opacity-60">
                    tier: {f.tier} · {OBEDIENCE_TIER_COLOR[f.tier]}
                  </div>
                ) : null}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Botão principal com pulse de cor ao disparar */}
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        animate={pulseColor ? { scale: [1, 1.12, 1] } : { scale: 1 }}
        transition={{ duration: 0.35 }}
        className={cn(
          'fixed bottom-20 right-4 z-[9990] inline-flex items-center gap-2 rounded-full border px-4 py-2 font-display text-[10px] font-black uppercase tracking-wider shadow-xl backdrop-blur transition-colors',
          pulseColor
            ? `${pulseColor} border-white/40 text-white`
            : 'border-cyan-400/60 bg-cyan-950/90 text-cyan-100',
        )}
        title="Teste do sistema de voz"
      >
        <Megaphone className="h-4 w-4" />
        Voice · Obed {Math.round(teamObedience)}%
      </motion.button>

      {/* Popup de comandos */}
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-36 right-4 z-[9990] w-72 space-y-1 rounded-xl border border-cyan-400/40 bg-black/90 p-3 shadow-xl backdrop-blur"
          >
            <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-cyan-300">Comandos teste</p>
            {TEST_PHRASES.map((phrase) => (
              <button
                key={phrase}
                type="button"
                onClick={() => { issue(phrase); setOpen(false); }}
                className="block w-full truncate rounded-md px-2 py-1.5 text-left text-[11px] text-white hover:bg-white/10"
              >
                {phrase}
              </button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
