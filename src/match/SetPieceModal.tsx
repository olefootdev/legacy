/**
 * Adapter Sprint L3 Fase 2 — encaixa <LiveSetPieceManager> no flow do live/quick.
 *
 * Quando o reducer dispara AWARD_SET_PIECE, este modal aparece, deixa o
 * manager escolher batedor + tipo + corredor, computa outcome baseado em
 * skills × tipo, e dispara RESOLVE_SET_PIECE com o resultado.
 */
import { useEffect, useMemo } from 'react';
import { useGameDispatch, useGameStore } from '@/game/store';
import {
  LiveSetPieceManager,
  type SetPieceChoice,
  type SetPieceContext,
  type SetPieceTaker,
  type SetPieceTarget,
} from '@/components/setpiece';

interface Props {
  /** Tempo limite pra escolher (multiplayer-safe). */
  pickTimeSeconds?: number;
}

export function SetPieceModal({ pickTimeSeconds = 10 }: Props) {
  const dispatch = useGameDispatch();
  const pendingSetPiece = useGameStore((s) => s.liveMatch?.pendingSetPiece);
  const minute = useGameStore((s) => s.liveMatch?.minute ?? 0);
  const playersById = useGameStore((s) => s.players);
  const lineupIds = useGameStore((s) => s.lineup);
  const pendingCorner = useGameStore((s) => s.liveMatch?.pendingCornerForSide);
  const pendingFreeKick = useGameStore((s) => s.liveMatch?.pendingFreeKickForSide);
  const liveMode = useGameStore((s) => s.liveMatch?.mode);

  // Auto-trigger: quando engine sinaliza set-piece pendente pra casa, abre o overlay
  // (consome a flag pra evitar dupla resolução pelo Spirit no próximo tick)
  useEffect(() => {
    if (pendingSetPiece) return; // já tem um aberto
    const isInteractive = liveMode === 'quick' || liveMode === 'test2d';
    if (!isInteractive) return;
    if (pendingCorner === 'home') {
      dispatch({
        type: 'AWARD_SET_PIECE',
        mode: 'corner',
        side: 'home',
        cornerSide: Math.random() < 0.5 ? 'left' : 'right',
      });
    } else if (pendingFreeKick === 'home') {
      dispatch({
        type: 'AWARD_SET_PIECE',
        mode: 'free_kick',
        side: 'home',
        // Distância e zona heurísticas (até spirit fornecer dados precisos)
        distance: 18 + Math.floor(Math.random() * 12),
        zone: ['center', 'left', 'right'][Math.floor(Math.random() * 3)] as 'center' | 'left' | 'right',
      });
    }
  }, [pendingCorner, pendingFreeKick, pendingSetPiece, liveMode, dispatch]);

  // Lista de jogadores titulares (em campo)
  const startersOnPitch = useMemo(() => {
    const ids = Object.values(lineupIds ?? {}).filter((id): id is string => typeof id === 'string');
    return ids
      .map((id) => playersById[id])
      .filter((p): p is NonNullable<typeof p> => p != null);
  }, [lineupIds, playersById]);

  if (!pendingSetPiece) return null;
  if (pendingSetPiece.side !== 'home') return null; // por agora só interativo pra casa

  // Skill relevante muda por tipo
  // Corner / cross: cruzamento (passeLongo + drible)
  // Free kick: passeLongo + finalizacao
  function takerSkill(p: NonNullable<typeof startersOnPitch[number]>): number {
    const a = p.attrs;
    if (pendingSetPiece!.mode === 'corner') {
      return Math.round((a.passe ?? 60) * 0.55 + (a.drible ?? 60) * 0.25 + (a.finalizacao ?? 60) * 0.20);
    }
    return Math.round((a.passe ?? 60) * 0.40 + (a.finalizacao ?? 60) * 0.50 + (a.drible ?? 60) * 0.10);
  }

  function targetSkill(p: NonNullable<typeof startersOnPitch[number]>): number {
    const a = p.attrs;
    return Math.round((a.fisico ?? 60) * 0.45 + (a.finalizacao ?? 60) * 0.40 + (a.marcacao ?? 60) * 0.15);
  }

  const takers: SetPieceTaker[] = [...startersOnPitch]
    .map((p) => ({ p, skill: takerSkill(p) }))
    .sort((a, b) => b.skill - a.skill)
    .slice(0, 3)
    .map(({ p, skill }) => ({
      id: p.id,
      displayName: p.name,
      shirtNumber: (p as any).shirtNumber ?? 9,
      skillRating: skill,
    }));

  const targets: SetPieceTarget[] = [...startersOnPitch]
    .filter(
      (p) =>
        p.pos === 'CB' ||
        p.pos === 'ST' ||
        p.pos === 'AM' ||
        (p.pos === 'CM' && p.attrs.fisico >= 70),
    )
    .map((p) => ({ p, skill: targetSkill(p) }))
    .sort((a, b) => b.skill - a.skill)
    .slice(0, 4)
    .map(({ p, skill }) => ({
      id: p.id,
      displayName: p.name,
      shirtNumber: (p as any).shirtNumber ?? 9,
      skillRating: skill,
      position: p.pos ?? 'CM',
    }));

  const ctx: SetPieceContext = {
    mode: pendingSetPiece.mode,
    side: pendingSetPiece.side,
    cornerSide: pendingSetPiece.cornerSide,
    distance: pendingSetPiece.distance,
    zone: pendingSetPiece.zone,
    takers,
    targets,
  };

  function handleResolve(choice: SetPieceChoice) {
    const taker = startersOnPitch.find((p) => p.id === choice.takerId);
    const target = choice.targetId
      ? startersOnPitch.find((p) => p.id === choice.targetId)
      : null;
    if (!taker) return;

    // Compute outcome baseado em skills × tipo × distância
    const takerS = takerSkill(taker);
    const targetS = target ? targetSkill(target) : 50;

    let goalP = 0.0;
    let saveP = 0.0;
    let clearP = 0.0;

    if (choice.type === 'direct_shot') {
      // Falta direta: depende de finalizacao + passeLongo + distance
      const distFactor = Math.max(0.05, 1 - ((choice.distance ?? 25) - 18) / 22);
      goalP = (takerS / 100) * 0.32 * distFactor;
      saveP = (1 - goalP) * 0.55;
      clearP = (1 - goalP) * 0.45;
    } else if (choice.type === 'cross' || choice.type === 'far_post' || choice.type === 'near_post') {
      // Cruzamento: chance combinada do batedor e cabeceador
      const combined = (takerS + targetS) / 2;
      goalP = (combined / 100) * 0.22;
      saveP = (1 - goalP) * 0.40;
      clearP = (1 - goalP) * 0.60;
    } else {
      // Curto/short_pass: foco em manter posse, baixa chance imediata de gol
      goalP = 0.04;
      saveP = 0.10;
      clearP = 0.20; // 66% recycled (bola mantida)
    }

    const r = Math.random();
    let outcome: 'goal' | 'shot_saved' | 'cleared' | 'recycled';
    if (r < goalP) outcome = 'goal';
    else if (r < goalP + saveP) outcome = 'shot_saved';
    else if (r < goalP + saveP + clearP) outcome = 'cleared';
    else outcome = 'recycled';

    dispatch({
      type: 'RESOLVE_SET_PIECE',
      takerId: choice.takerId,
      takerName: taker.name,
      deliveryType: choice.type,
      targetId: choice.targetId,
      targetName: target?.name,
      outcome,
    });
  }

  const headerLabel =
    pendingSetPiece.mode === 'corner'
      ? `${minute}' · Escanteio pra nós`
      : `${minute}' · Falta perigosa`;

  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto">
      <LiveSetPieceManager
        ctx={ctx}
        pickTimeSeconds={pickTimeSeconds}
        headerLabel={headerLabel}
        onResolve={handleResolve}
      />
    </div>
  );
}
