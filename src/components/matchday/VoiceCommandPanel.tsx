/**
 * COMANDO TÉCNICO — painel de voz + texto acima do Controlo ao vivo.
 *
 * Captura:
 *   • Push-to-talk (segura o mic pra falar; solta → transcreve).
 *   • Texto livre (Enter ou botão Enviar).
 *
 * Limites:
 *   • Máximo 5s por captura (auto-stop).
 *   • Cooldown de 25s entre comandos EFETIVOS (transcritos + enviados).
 *
 * Feedback:
 *   1. 📨 ENVIADO (azul) — sempre.
 *   2. ✅ Aceito / ❌ Recusado — após obediência.
 *   3. ⚠ Aviso árbitro / 🟥 Vermelho por linguagem.
 *   4. ⏱ Cooldown ativo visível na UI.
 */

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Megaphone, Mic, MicOff, Send, CheckCircle2, XCircle, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameDispatch, useGameStore } from '@/game/store';
import { parseVoiceCommand } from '@/voiceCommand/intentMatcher';
import { rollObedience } from '@/voiceCommand/obedienceRoll';
import { scanProfanity } from '@/voiceCommand/profanityFilter';
import {
  OBEDIENCE_TIER_BUBBLE,
  type ObedienceTier,
} from '@/voiceCommand/types';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';
import { useAudioWaveform } from '@/hooks/useAudioWaveform';
import { routeToAssistant } from '@/voiceCommand/assistantRouter';
import { relayCommand, getAssistantStaff } from '@/voiceCommand/assistantRelay';
import { AssistantsStrip } from './AssistantsStrip';
import { TacticalObedienceBadge } from './TacticalObedienceBadge';
import type { MatchPlayerAttributes } from '@/match/playerInMatch';
import type { AssistantRole } from '@/voiceCommand/types';
import { recordVoiceCommand } from '@/supabase/voiceCommandLog';
import { usePlatformConfig } from '@/admin/platformConfigStore';
import { applySubstitution } from '@/engine/substitution';
import { subscribeManagerCommand } from '@/voiceCommand/managerCommandBus';
import { guessCommand, intentLabelPt, type GuessResult } from '@/voiceCommand/intentGuess';
import { saveLearnedPhrase, lookupLearned, hydrateLearnedFromSupabase, syncLearnedPhraseToSupabase } from '@/voiceCommand/learnedPhrases';
import { extractMentions, detectMentionAtCursor, applyMentionCompletion, SECTOR_SUGGESTIONS, type MentionEditState } from '@/voiceCommand/mentions';
import { validateCommand } from '@/voiceCommand/commandValidation';
import { llmInterpretCommand } from '@/voiceCommand/llmInterpret';

type FeedbackEntry = {
  id: string;
  kind: 'sent' | 'accepted' | 'refused' | 'warning' | 'error';
  message: string;
  detail?: string;
  tier?: ObedienceTier;
};

const SUGGESTIONS = [
  '@adrien invade a área',
  'Pressiona alto',
  '#ataque cruza mais',
  'Muda pra 4-3-3',
];

const MAX_RECORDING_SECS = 5;
const INDIVIDUAL_COOLDOWN_MS = 8_000;  // 8s por jogador
const TEAM_COOLDOWN_MS = 25_000;       // 25s para comandos coletivos

export function VoiceCommandPanel() {
  const dispatch = useGameDispatch();
  const { flags } = usePlatformConfig();
  const voiceEnabled = (flags as Record<string, boolean>).VOICE_COMMANDS_ENABLED !== false;
  const live = useGameStore((s) => s.liveMatch);
  const playersById = useGameStore((s) => s.players);
  const teamObedience = useGameStore((s) => s.tacticalObedience ?? 30);
  const relationByPlayer = useGameStore((s) => s.managerRelationByPlayer);
  const [text, setText] = useState('');
  const [feedbacks, setFeedbacks] = useState<FeedbackEntry[]>([]);
  const [cooldownByPlayer, setCooldownByPlayer] = useState<Record<string, number>>({});
  const [cooldownTeam, setCooldownTeam] = useState<number>(0);
  const [now, setNow] = useState(Date.now());
  const [lastAssistant, setLastAssistant] = useState<AssistantRole | null>(null);
  const [pendingGuess, setPendingGuess] = useState<{ guess: GuessResult; originalPhrase: string } | null>(null);
  const [mentionEdit, setMentionEdit] = useState<MentionEditState | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isHoldingRef = useRef(false);

  // Tick pra atualizar contador de cooldown a cada segundo.
  useEffect(() => {
    const iv = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      dispatch({ type: 'VOICE_COMMANDS_SWEEP', nowMs: t });
    }, 500);
    return () => window.clearInterval(iv);
  }, [dispatch]);

  // Calcula cooldown ativo (individual ou coletivo)
  const getActiveCooldown = (targetPlayerId?: string) => {
    if (!targetPlayerId) {
      // Comando coletivo
      const teamCooldownLeft = Math.max(0, TEAM_COOLDOWN_MS - (now - cooldownTeam));
      return { active: teamCooldownLeft > 0, leftMs: teamCooldownLeft, type: 'team' as const };
    }
    // Comando individual
    const lastCmd = cooldownByPlayer[targetPlayerId] ?? 0;
    const individualCooldownLeft = Math.max(0, INDIVIDUAL_COOLDOWN_MS - (now - lastCmd));
    return { active: individualCooldownLeft > 0, leftMs: individualCooldownLeft, type: 'player' as const };
  };

  const addFeedback = (f: Omit<FeedbackEntry, 'id'>) => {
    const id = `fb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setFeedbacks((prev) => [...prev, { ...f, id }]);
    window.setTimeout(() => {
      setFeedbacks((prev) => prev.filter((x) => x.id !== id));
    }, 3500);
  };

  const voice = useVoiceRecognition({
    lang: 'pt-BR',
    maxSecs: MAX_RECORDING_SECS,
    onResult: (transcript) => {
      void submit(transcript, 'voice');
    },
    onError: (msg) => {
      addFeedback({ kind: 'error', message: `🎤 ${msg}` });
    },
  });

  const waveform = useAudioWaveform(voice.state === 'listening');

  // Hidrata dicionário aprendido do Supabase ao montar (cross-device).
  useEffect(() => { void hydrateLearnedFromSupabase(); }, []);

  // Bridge: Action Cards (LiveMatchManagerPanel) disparam phrases que processamos aqui.
  const submitRef = useRef<((phrase: string, source?: 'text' | 'voice') => void) | null>(null);
  useEffect(() => {
    return subscribeManagerCommand(({ phrase, source }) => {
      submitRef.current?.(phrase, source === 'voice' ? 'voice' : 'text');
    });
  }, []);

  const submit: (phrase: string, source?: 'text' | 'voice') => void = (phrase, source = 'text') => {
    const clean = phrase.trim();
    if (!clean || !live || live.phase !== 'playing') return;

    // 1. profanity — consome cooldown coletivo se houver hit (evita spamming).
    const hits = scanProfanity(clean);
    if (hits.length > 0) {
      setCooldownTeam(Date.now());
      const warnings = live.refereeLanguageWarnings ?? 0;
      if (warnings === 0) {
        dispatch({ type: 'REFEREE_WARNING_LANGUAGE', minute: live.minute });
        addFeedback({ kind: 'warning', message: '⚠ Árbitro adverte: linguagem imprópria! (1ª vez)' });
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
          addFeedback({ kind: 'error', message: `🟥 VERMELHO em ${best.name} por conduta do treinador!` });
        }
      }
      setText('');
      return;
    }

    // 2. parse
    const ctx = {
      homePlayers: live.homePlayers.map((p) => ({
        playerId: p.playerId, name: p.name, num: p.num, slotId: p.slotId, role: p.role,
      })),
      ballCarrierPlayerId: live.onBallPlayerId,
    };

    // 2a. mentions — `@nome` força target=jogador, `#setor` força target=role/slot/team.
    // Depois do strip, o parser recebe só a ação ("invade a area para finalizar").
    const mentions = extractMentions(clean, ctx);
    const phraseForParse = mentions.cleanedPhrase || clean;

    // 2b. atalho — frase aprendida num confirm anterior resolve direto.
    const normalizedPhrase = phraseForParse.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.,!?;:"']/g, ' ').replace(/\s+/g, ' ').trim();
    const learned = lookupLearned(normalizedPhrase, normalizedPhrase);
    let parsed = parseVoiceCommand(phraseForParse, ctx);
    let learnedHit = false;
    if (parsed.length === 0 && learned && learned.canonicalPhrase && learned.canonicalPhrase !== normalizedPhrase) {
      parsed = parseVoiceCommand(learned.canonicalPhrase, ctx);
      learnedHit = parsed.length > 0;
    }

    // Aplica override de mention nos comandos parseados (substituição/formação ignoradas).
    if (mentions.target && parsed.length > 0) {
      parsed = parsed.map((cmd) => {
        if (cmd.intent === 'player_substitution' || cmd.intent === 'formation_change') return cmd;
        return { ...cmd, target: mentions.target! };
      });
      addFeedback({
        kind: 'sent',
        message: mentions.playerName
          ? `🎯 Alvo: ${mentions.playerName}`
          : `🎯 Setor: ${mentions.sectorLabel ?? ''}`,
      });
    }

    if (learnedHit && learned) {
      addFeedback({
        kind: 'sent',
        message: `🧠 Aprendido: "${clean}" → ${intentLabelPt(learned.intent)}`,
        detail: `Confirmado ${learned.confirmCount}× antes.`,
      });
    }

    if (parsed.length === 0) {
      // 2b. Parser determinístico falhou — tenta Claude como intérprete semântico.
      setText('');
      addFeedback({ kind: 'sent', message: `Interpretando: "${clean}"…` });
      void (async () => {
        const llmResult = await llmInterpretCommand(clean, {
          players: live.homePlayers.map((p) => ({
            playerId: p.playerId,
            name: p.name,
            num: p.num,
            role: p.role,
          })),
          ballCarrier: live.onBallPlayerId
            ? live.homePlayers.find((p) => p.playerId === live.onBallPlayerId)?.name
            : undefined,
          minute: live.minute,
          homeScore: live.homeScore,
          awayScore: live.awayScore,
        });

        if (llmResult.commands.length > 0) {
          // Claude entendeu — executa direto como se fosse um parse normal.
          if (llmResult.narrative) {
            addFeedback({
              kind: 'sent',
              message: llmResult.narrative,
              detail: `Interpretado por IA · "${clean}"`,
            });
          }
          // Salva na biblioteca aprendida para próximas vezes (sem precisar do Claude).
          const firstIntent = llmResult.commands[0]?.intent;
          if (firstIntent) {
            const normalizedClean = clean.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.,!?;:"']/g, ' ').replace(/\s+/g, ' ').trim();
            const learnInput = { phrase: normalizedClean, stem: normalizedClean, intent: firstIntent, canonicalPhrase: clean };
            saveLearnedPhrase(learnInput);
            void syncLearnedPhraseToSupabase(learnInput);
          }
          submit(clean, source);
          return;
        }

        // Claude também não entendeu — cai no guess local como último recurso.
        const guess = guessCommand(clean, ctx);
        if (guess) {
          setPendingGuess({ guess, originalPhrase: clean });
        } else {
          addFeedback({
            kind: 'error',
            message: `Comando não reconhecido: "${clean}"`,
            detail: 'Tenta mais direto — ex: "chuta", "pressiona alto", "recua", "passa pro <nome>".',
          });
        }
      })();
      return;
    }

    // Comando efetivamente reconhecido — feedback ENVIADO.
    addFeedback({
      kind: 'sent',
      message: `📨 ENVIADO${source === 'voice' ? ' 🎤' : ''}: "${clean}"`,
      detail: `Obediência coletiva: ${Math.round(teamObedience)}%`,
    });

    // 3. relay por assistente (cada intent passa pelo assistente apropriado)
    const relayedList = parsed.map((cmd) => {
      const role = routeToAssistant(cmd);
      const staff = getAssistantStaff(role);
      const relayed = relayCommand(cmd, staff);
      return { role, staff, relayed };
    });

    // Pulsa o último assistente ativo + narra relay no feed
    const firstRelay = relayedList.find((r) => r.relayed !== null);
    if (firstRelay) {
      setLastAssistant(firstRelay.role);
      if (firstRelay.relayed) {
        addFeedback({
          kind: 'sent',
          message: firstRelay.relayed.relayNarrative,
          detail: `Eficácia ${Math.round(firstRelay.staff.effectiveness)}% · ${firstRelay.relayed.relayQuality}`,
        });
      }
    }

    // 4. executa cada comando relayed (distorted null = dropado)
    for (const { relayed } of relayedList) {
      if (!relayed) {
        addFeedback({ kind: 'refused', message: '🎧 O assistente não passou o recado. Tente de novo.' });
        continue;
      }
      const cmd = relayed;
      if (cmd.intent === 'player_substitution' && cmd.substitutionInfo) {
        const outT = cmd.substitutionInfo.out;
        const inT = cmd.substitutionInfo.in;
        const outId = outT.kind === 'player_id' ? outT.playerId : null;
        const inId = inT.kind === 'player_id' ? inT.playerId : null;
        if (outId && inId) {
          const dry = applySubstitution({
            snapshot: live, players: playersById,
            outPlayerId: outId, inPlayerId: inId, minute: live.minute,
          });
          if (dry.error) {
            addFeedback({ kind: 'error', message: `🔄 Substituição inválida: ${dry.error}` });
          } else {
            dispatch({ type: 'MATCH_SUBSTITUTE', outPlayerId: outId, inPlayerId: inId });
            const outName = live.homePlayers.find((p) => p.playerId === outId)?.name ?? 'jogador';
            addFeedback({ kind: 'accepted', message: `🔄 Substituição aceita: ${outName} sai` });
          }
        } else {
          addFeedback({ kind: 'error', message: 'Substituição falhou — jogador não reconhecido' });
        }
        continue;
      }

      if (cmd.intent === 'formation_change' && cmd.formationTarget) {
        dispatch({ type: 'LIVE_MATCH_SET_FORMATION', formationScheme: cmd.formationTarget });
        addFeedback({ kind: 'accepted', message: `📐 Formação: ${cmd.formationTarget}` });
        continue;
      }

      const tgt = cmd.target;
      if (tgt.kind === 'team') {
        // Comando coletivo — verifica cooldown team
        const teamCooldown = getActiveCooldown();
        if (teamCooldown.active) {
          addFeedback({
            kind: 'error',
            message: `⏱ Comando coletivo aguarda ${Math.ceil(teamCooldown.leftMs / 1000)}s`,
          });
          continue;
        }
        setCooldownTeam(Date.now());

        const tiers: Record<ObedienceTier, number> = { critical_accept: 0, accept: 0, weak_accept: 0, refuse: 0, protest: 0 };
        for (const p of live.homePlayers) {
          const r = rollObedience({
            intent: cmd.intent,
            teamObedience,
            assistantEffectiveness: relayed.assistantEffectiveness,
            player: {
              attributes: p.attributes as MatchPlayerAttributes | undefined,
              role: p.role, slotId: p.slotId, fatigue: p.fatigue,
              relacaoManager: relationByPlayer?.[p.playerId],
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
          void recordVoiceCommand({
            matchId: null,
            intent: cmd.intent,
            targetPlayerId: p.playerId,
            tier: r.tier,
            effectiveObedience: r.effectiveScore,
            individualObedience: r.individualScore,
            teamObedienceAtTime: teamObedience,
            rawText: cmd.rawText,
            assistant: routeToAssistant(cmd),
            minute: live.minute,
          });
        }
        const dominant = (Object.entries(tiers).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'accept') as ObedienceTier;
        const acceptedCount = tiers.critical_accept + tiers.accept + tiers.weak_accept;
        const refusedCount = tiers.refuse + tiers.protest;
        addFeedback({
          kind: acceptedCount > refusedCount ? 'accepted' : 'refused',
          message: `👥 Time: ${acceptedCount}/${live.homePlayers.length} aceitaram · ${OBEDIENCE_TIER_BUBBLE[dominant]}`,
          detail: `Coletiva ${Math.round(teamObedience)}% · ${refusedCount} recusaram`,
          tier: dominant,
        });
        continue;
      }

      let targetPlayerId: string | null = null;
      if (tgt.kind === 'player_id') targetPlayerId = tgt.playerId;
      else if (tgt.kind === 'ball_carrier' && live.onBallPlayerId) targetPlayerId = live.onBallPlayerId;
      else if (tgt.kind === 'role') targetPlayerId = live.homePlayers.find((p) => p.role === tgt.role)?.playerId ?? null;
      else if (tgt.kind === 'slot') targetPlayerId = live.homePlayers.find((p) => p.slotId === tgt.slotId)?.playerId ?? null;
      else if (tgt.kind === 'shirt_number') targetPlayerId = live.homePlayers.find((p) => p.num === tgt.number)?.playerId ?? null;

      if (!targetPlayerId) {
        addFeedback({ kind: 'error', message: `Alvo não resolvido para "${cmd.rawText}"` });
        continue;
      }

      // Redireciona pass_to_player pro carregador, carregando o receptor em payload.
      // Sem isto, só o receptor ficava com o PendingCommand e o portador nunca sabia pra quem passar.
      let effectivePlayerId = targetPlayerId;
      let commandPayload: Record<string, unknown> | undefined;
      if (cmd.intent === 'pass_to_player') {
        if (!live.onBallPlayerId) {
          addFeedback({ kind: 'error', message: '🎯 "Passa" só funciona com bola no pé da sua equipa' });
          continue;
        }
        if (live.onBallPlayerId === targetPlayerId) {
          addFeedback({ kind: 'error', message: '🎯 O jogador já está com a bola' });
          continue;
        }
        commandPayload = { preferredReceiverId: targetPlayerId };
        effectivePlayerId = live.onBallPlayerId;
      }

      const player = live.homePlayers.find((p) => p.playerId === effectivePlayerId);
      if (!player) continue;
      targetPlayerId = effectivePlayerId;

      // Validação pré-dispatch
      const validation = validateCommand(cmd.intent, {
        player: {
          playerId: player.playerId,
          name: player.name,
          x: player.x ?? 50,
          y: player.y ?? 50,
          role: player.role,
          slotId: player.slotId,
          attributes: player.attributes as MatchPlayerAttributes | undefined,
          hasBall: live.onBallPlayerId === player.playerId,
        },
        match: {
          side: 'home',
          ballCarrierPlayerId: live.onBallPlayerId,
          minute: live.minute,
        },
      });

      if (!validation.valid) {
        addFeedback({
          kind: 'error',
          message: `❌ ${validation.reason}`,
          detail: validation.suggestion,
        });
        continue;
      }

      if (validation.severity === 'warning') {
        addFeedback({
          kind: 'warning',
          message: `⚠ ${validation.reason}`,
          detail: validation.suggestion,
        });
      }

      // Cooldown individual
      const playerCooldown = getActiveCooldown(targetPlayerId);
      if (playerCooldown.active) {
        addFeedback({
          kind: 'error',
          message: `⏱ ${player.name} aguarda ${Math.ceil(playerCooldown.leftMs / 1000)}s`,
        });
        continue;
      }
      setCooldownByPlayer(prev => ({ ...prev, [targetPlayerId]: Date.now() }));

      const r = rollObedience({
        intent: cmd.intent,
        teamObedience,
        assistantEffectiveness: relayed.assistantEffectiveness,
        player: {
          attributes: player.attributes as MatchPlayerAttributes | undefined,
          role: player.role, slotId: player.slotId, fatigue: player.fatigue,
          relacaoManager: relationByPlayer?.[targetPlayerId],
        },
      });
      dispatch({
        type: 'VOICE_COMMAND_ISSUED',
        playerId: targetPlayerId,
        intent: cmd.intent,
        effectiveObedience: r.effectiveScore,
        tier: r.tier,
        rawText: cmd.rawText,
        assistantEffectiveness: relayed.assistantEffectiveness,
        payload: commandPayload,
      });
      void recordVoiceCommand({
        matchId: null,
        intent: cmd.intent,
        targetPlayerId,
        tier: r.tier,
        effectiveObedience: r.effectiveScore,
        individualObedience: r.individualScore,
        teamObedienceAtTime: teamObedience,
        rawText: cmd.rawText,
        assistant: routeToAssistant(cmd),
        minute: live.minute,
      });

      const acceptedKinds = new Set<ObedienceTier>(['critical_accept', 'accept', 'weak_accept']);
      const accepted = acceptedKinds.has(r.tier);
      addFeedback({
        kind: accepted ? 'accepted' : 'refused',
        message: `${accepted ? '✅' : '❌'} ${player.name}: ${OBEDIENCE_TIER_BUBBLE[r.tier]}`,
        detail: `Individual ${Math.round(r.individualScore)}% × Coletiva ${Math.round(teamObedience)}% = Efetiva ${Math.round(r.effectiveScore)}%`,
        tier: r.tier,
      });
    }

    setText('');
  };

  submitRef.current = submit;

  const confirmGuess = () => {
    if (!pendingGuess) return;
    const { guess, originalPhrase } = pendingGuess;
    const normalized = originalPhrase.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.,!?;:"']/g, ' ').replace(/\s+/g, ' ').trim();
    const record = {
      phrase: normalized,
      stem: guess.stem,
      intent: guess.intent,
      canonicalPhrase: guess.canonicalPhrase,
    };
    saveLearnedPhrase(record);
    void syncLearnedPhraseToSupabase(record);
    addFeedback({
      kind: 'sent',
      message: `🧠 Guardado — "${originalPhrase}" agora é reconhecido como ${intentLabelPt(guess.intent)}`,
      detail: 'Próxima vez resolve direto.',
    });
    setPendingGuess(null);
    // Reenvia pelo canal padrão — sem cooldown, pois ainda não houve comando efetivo.
    window.setTimeout(() => submit(guess.canonicalPhrase, 'text'), 80);
  };

  const dismissGuess = () => setPendingGuess(null);

  const onInputChange = (e: import('react').ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setText(value);
    const cursor = e.target.selectionStart ?? value.length;
    setMentionEdit(detectMentionAtCursor(value, cursor));
  };

  const onInputSelect = (e: import('react').SyntheticEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const cursor = el.selectionStart ?? el.value.length;
    setMentionEdit(detectMentionAtCursor(el.value, cursor));
  };

  const applyMention = (token: string) => {
    if (!mentionEdit || !inputRef.current) return;
    const cursor = inputRef.current.selectionStart ?? text.length;
    const { value, nextCursor } = applyMentionCompletion(text, cursor, mentionEdit, token);
    setText(value);
    setMentionEdit(null);
    // Re-foca no input e reposiciona cursor.
    window.requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(nextCursor, nextCursor);
    });
  };

  // Sugestões do dropdown — jogadores quando '@', setores quando '#'.
  const mentionSuggestions = (() => {
    if (!mentionEdit) return [] as { token: string; label: string; sub?: string }[];
    const q = mentionEdit.query.toLowerCase();
    if (mentionEdit.kind === '@') {
      const players = live?.homePlayers ?? [];
      const firstTokens = players.map((p) => ({
        token: (p.name.split(' ')[0] ?? p.name).toLowerCase(),
        label: p.name,
        sub: `#${p.num} · ${p.slotId?.toUpperCase() ?? p.role ?? ''}`,
      }));
      const filtered = q
        ? firstTokens.filter((t) => t.token.startsWith(q) || t.label.toLowerCase().includes(q))
        : firstTokens;
      return filtered.slice(0, 6);
    }
    const filtered = q
      ? SECTOR_SUGGESTIONS.filter((s) => s.token.startsWith(q) || s.label.toLowerCase().includes(q))
      : SECTOR_SUGGESTIONS;
    return filtered.map((s) => ({ token: s.token, label: s.label, sub: undefined })).slice(0, 6);
  })();

  const handleMicDown = () => {
    if (!voice.supported) {
      addFeedback({ kind: 'error', message: '🎤 Este browser não suporta reconhecimento de voz' });
      return;
    }
    if (cooldownActive) {
      addFeedback({
        kind: 'error',
        message: `⏱ Aguarde ${Math.ceil(cooldownLeftMs / 1000)}s`,
      });
      return;
    }
    if (voice.state === 'listening') return;
    isHoldingRef.current = true;
    voice.start();
  };

  const handleMicUp = () => {
    if (!isHoldingRef.current) return;
    isHoldingRef.current = false;
    if (voice.state === 'listening') {
      voice.stop();
    }
  };

  if (!live || live.phase !== 'playing' || !voiceEnabled) return null;

  const listening = voice.state === 'listening';
  const processing = voice.state === 'processing';
  const liveText = voice.transcript + voice.interim;

  // Calcula cooldown ativo para UI
  const cooldownStatus = getActiveCooldown();
  const cooldownActive = cooldownStatus.active;
  const cooldownLeftMs = cooldownStatus.leftMs;

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-violet-500/40 bg-violet-950/30 px-3 py-3 sm:px-4 sm:py-4 space-y-3">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-violet-200">
          <Megaphone className="h-3.5 w-3.5 text-violet-300" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Comando técnico</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono font-bold">
          <span className="text-white/50 uppercase">obediência</span>
          <span className="rounded-full border border-violet-400/50 bg-violet-500/20 px-2 py-0.5 text-violet-100">
            {Math.round(teamObedience)}%
          </span>
        </div>
      </header>

      {/* Dica de mentions — mostra nas primeiras vezes */}
      {!mentionEdit && (
        <div className="rounded-lg border border-cyan-400/30 bg-cyan-500/5 px-2.5 py-1.5 text-[10px] text-cyan-200/90">
          <span className="font-bold">💡 Dica:</span> Use <span className="font-mono font-bold text-cyan-100">@jogador</span> ou <span className="font-mono font-bold text-cyan-100">#setor</span> pra comandos precisos
          <span className="ml-1 text-cyan-300/60">— ex: "@adrien chuta" ou "#ataque pressiona"</span>
        </div>
      )}

      {/* Waveform + transcript ao vivo durante captura */}
      <AnimatePresence>
        {(listening || processing) ? (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={cn(
              'rounded-lg border px-3 py-2',
              listening ? 'border-rose-400/60 bg-rose-500/10' : 'border-violet-400/60 bg-violet-500/10',
            )}
          >
            <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
              <span className={listening ? 'text-rose-200' : 'text-violet-200'}>
                {listening ? '🎤 Ouvindo…' : '⏳ Processando…'}
              </span>
              {listening ? (
                <span className="text-rose-300/70">max {MAX_RECORDING_SECS}s</span>
              ) : null}
            </div>
            <div className="flex h-8 items-end justify-between gap-[2px]">
              {waveform.map((lv, i) => (
                <div
                  key={i}
                  className={cn(
                    'w-1.5 rounded-full transition-all',
                    listening ? 'bg-rose-400' : 'bg-violet-400',
                  )}
                  style={{
                    height: `${Math.max(6, Math.round(lv * 32))}px`,
                    opacity: listening ? 0.9 : 0.4,
                  }}
                />
              ))}
            </div>
            {liveText ? (
              <p className="mt-1 text-xs text-white/90 italic">"{liveText}"</p>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <form onSubmit={(e) => { e.preventDefault(); submit(text, 'text'); }} className="relative flex gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            value={text}
            onChange={onInputChange}
            onKeyUp={onInputSelect}
            onClick={onInputSelect}
            onBlur={() => window.setTimeout(() => setMentionEdit(null), 120)}
            placeholder='Digita @jogador, #setor ou comando — ex: "@ahmad invade a área"'
            className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-violet-400 focus:outline-none"
            maxLength={160}
            disabled={listening}
            autoComplete="off"
          />
          {mentionEdit && mentionSuggestions.length > 0 ? (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-violet-400/50 bg-black/95 shadow-[0_8px_24px_rgba(0,0,0,0.55)] backdrop-blur">
              <div className="border-b border-white/5 bg-white/[0.03] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-violet-200">
                {mentionEdit.kind === '@' ? 'Jogador' : 'Setor'}
                <span className="ml-1.5 text-white/30">
                  {mentionEdit.query ? `"${mentionEdit.query}"` : 'escolhe abaixo'}
                </span>
              </div>
              <ul className="max-h-56 overflow-y-auto">
                {mentionSuggestions.map((s) => (
                  <li key={s.token}>
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); applyMention(s.token); }}
                      className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs text-white transition-colors hover:bg-violet-500/20"
                    >
                      <span className="font-bold">{s.label}</span>
                      {s.sub ? <span className="text-[10px] text-white/40">{s.sub}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="border-t border-white/5 bg-white/[0.02] px-2.5 py-1 text-[9px] text-white/40">
                Enter / clique pra completar · Esc pra fechar
              </div>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onMouseDown={handleMicDown}
          onMouseUp={handleMicUp}
          onMouseLeave={handleMicUp}
          onTouchStart={(e) => { e.preventDefault(); handleMicDown(); }}
          onTouchEnd={(e) => { e.preventDefault(); handleMicUp(); }}
          disabled={!voice.supported || cooldownActive}
          title={
            !voice.supported ? 'Browser não suporta voz' :
            cooldownActive ? `Aguarde ${Math.ceil(cooldownLeftMs / 1000)}s` :
            'Segure pra falar (push-to-talk)'
          }
          className={cn(
            'shrink-0 rounded-lg border px-3 transition-colors select-none',
            !voice.supported || cooldownActive
              ? 'border-white/10 bg-white/5 text-white/30 cursor-not-allowed'
              : listening
                ? 'border-rose-400/70 bg-rose-500 text-white animate-pulse'
                : 'border-violet-400/60 bg-violet-500/20 text-violet-100 hover:bg-violet-500/30',
          )}
        >
          {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
        <button
          type="submit"
          disabled={!text.trim() || cooldownActive || listening}
          className={cn(
            'shrink-0 inline-flex items-center gap-1 rounded-lg px-3 py-2 font-display text-[10px] font-black uppercase tracking-wider transition-colors',
            text.trim() && !cooldownActive && !listening
              ? 'bg-violet-500 text-black hover:bg-violet-400'
              : 'bg-white/5 text-white/30 cursor-not-allowed',
          )}
        >
          <Send className="h-3.5 w-3.5" />
          Enviar
        </button>
      </form>

      {/* Sugestões rápidas */}
      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => submit(s, 'text')}
            disabled={cooldownActive || listening}
            className={cn(
              'rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] transition-colors',
              cooldownActive || listening
                ? 'text-white/20 cursor-not-allowed'
                : 'text-white/70 hover:border-violet-400/50 hover:text-white',
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Confirmação de guess — "Você quis dizer…?" */}
      <AnimatePresence>
        {pendingGuess ? (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="rounded-xl border border-cyan-400/60 bg-cyan-500/10 px-3 py-3 shadow-[0_0_18px_rgba(34,211,238,0.12)]"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-200">🤔 Você quis dizer…</p>
            <p className="mt-1 font-display text-sm font-black uppercase tracking-wider text-white">
              {intentLabelPt(pendingGuess.guess.intent)}
              {pendingGuess.guess.playerName ? (
                <span className="text-cyan-200"> pro {pendingGuess.guess.playerName.split(' ')[0]}</span>
              ) : null}
              ?
            </p>
            <p className="mt-1 text-[10px] italic leading-snug text-cyan-300/80">
              Original: "{pendingGuess.originalPhrase}" · Canônico: "{pendingGuess.guess.canonicalPhrase}"
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={confirmGuess}
                className="flex-1 rounded-lg bg-cyan-400 px-3 py-1.5 font-display text-[10px] font-black uppercase tracking-wider text-black transition-colors hover:bg-cyan-300"
              >
                ✓ Sim, é isso
              </button>
              <button
                type="button"
                onClick={dismissGuess}
                className="flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 font-display text-[10px] font-black uppercase tracking-wider text-gray-300 hover:bg-white/10"
              >
                ✗ Não
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Stack de feedbacks */}
      {feedbacks.length > 0 ? (
        <div className="space-y-1.5 pt-1">
          <AnimatePresence>
            {feedbacks.map((f) => {
              const Icon =
                f.kind === 'sent' ? Megaphone :
                f.kind === 'accepted' ? CheckCircle2 :
                f.kind === 'refused' ? XCircle :
                f.kind === 'warning' ? AlertTriangle :
                XCircle;
              const bg =
                f.kind === 'sent' ? 'bg-sky-500/25 border-sky-400/60 text-sky-50' :
                f.kind === 'accepted' ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-100' :
                f.kind === 'refused' ? 'bg-rose-500/20 border-rose-400/50 text-rose-100' :
                f.kind === 'warning' ? 'bg-amber-500/20 border-amber-400/50 text-amber-100' :
                'bg-rose-600/25 border-rose-500/60 text-rose-100';
              return (
                <motion.div
                  key={f.id}
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 30, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className={cn('rounded-lg border px-3 py-2 text-[11px] font-bold', bg)}
                >
                  <div className="flex items-start gap-2">
                    <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>{f.message}</span>
                  </div>
                  {f.detail ? (
                    <div className="mt-0.5 text-[9px] uppercase tracking-wider opacity-80">
                      {f.detail}
                    </div>
                  ) : null}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : null}
      </div>

      {/* Obediência tática — logo abaixo do comando técnico. */}
      <TacticalObedienceBadge />

      {/* Comissão técnica — por último, mostra quem está a relayar os comandos. */}
      <AssistantsStrip lastActive={lastAssistant} />
    </div>
  );
}
