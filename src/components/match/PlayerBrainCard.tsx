/**
 * PlayerBrainCard — card de inteligência ao clicar no jogador.
 * Mostra última ação do agente, fadiga, tier de obediência e tendência.
 */
import { useEffect, useState } from 'react';
import type { PitchPlayerState } from '@/engine/types';
import { getLastAttackingAction, getLastFullbackAction } from '@/playerDecision/agentActionMemory';
import { rollObedience } from '@/voiceCommand/obedienceRoll';
import { OBEDIENCE_TIER_BUBBLE } from '@/voiceCommand/types';

const NEON = '#FDE100';

const ACTION_LABELS: Record<string, string> = {
  striker_infiltrate_box:     'Infiltrou a área',
  winger_attack_depth:        'Atacou profundidade',
  fullback_overlap_box_entry: 'Overlap na área',
  mid_attack_depth:           'Entrou na meia-lua',
  anchor_to_slot:             'Manteve posição',
  structural_hold:            'Segurou estrutura',
  sq_create_width:            'Abriu amplitude',
  sq_attack_space:            'Atacou espaço',
  sq_recycle:                 'Reciclou a bola',
  sq_offer_line:              'Ofereceu linha',
  overlap_run:                'Fez o overlap',
  defensive_cover:            'Cobriu transição',
  offer_short_line:           'Ofereceu passe curto',
  open_width:                 'Manteve amplitude',
};

const TENDENCY_MAP: Record<string, Record<string, string>> = {
  attack: { striker_infiltrate_box: 'Infiltrador', winger_attack_depth: 'Atacante', anchor_to_slot: 'Disciplinado' },
  mid:    { anchor_to_slot: 'Organizador', sq_recycle: 'Construtor', sq_attack_space: 'Box-to-box' },
  def:    { defensive_cover: 'Disciplinado', overlap_run: 'Lateral Ofensivo', anchor_to_slot: 'Conservador' },
  gk:     {},
};

const TENDENCY_DEFAULT: Record<string, string> = {
  attack: 'Finalizador',
  mid:    'Equilibrado',
  def:    'Defensivo',
  gk:     'Goleiro',
};

function getTendency(role: string, lastAction: string | null): string {
  const roleMap = (TENDENCY_MAP as Record<string, Record<string, string>>)[role] ?? {};
  if (lastAction && roleMap[lastAction]) return roleMap[lastAction];
  return TENDENCY_DEFAULT[role] ?? 'Aguardando';
}

const TIER_COLOR: Record<string, string> = {
  critical_accept: NEON,
  accept:          NEON,
  weak_accept:     '#f97316',
  refuse:          '#ef4444',
  protest:         '#ef4444',
};

interface PlayerBrainCardProps {
  player: PitchPlayerState;
  onClose: () => void;
}

export function PlayerBrainCard({ player, onClose }: PlayerBrainCardProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t1 = window.setTimeout(() => setVisible(true), 30);
    const t2 = window.setTimeout(() => { setVisible(false); window.setTimeout(onClose, 300); }, 4000);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [onClose]);

  // Última ação do agente
  const lastAction = getLastAttackingAction(player.playerId)
    ?? getLastFullbackAction(player.playerId);
  const actionLabel = lastAction ? (ACTION_LABELS[lastAction] ?? lastAction) : 'Aguardando';

  // Obediência
  const roll = rollObedience({
    intent: 'free_play',
    teamObedience: 30,
    player: { role: player.role, fatigue: player.fatigue ?? 25 },
  });

  // Fadiga
  const fatigue = player.fatigue ?? 0;
  const energy = 100 - fatigue;
  const energyColor = energy > 65 ? '#10b981' : energy > 35 ? '#f97316' : '#ef4444';

  // Tendência
  const tendency = getTendency(player.role, lastAction);

  const firstName = player.name.split(' ')[0];

  return (
    <div
      className="absolute z-[350] pointer-events-none"
      style={{ top: 48, left: 12, width: 160 }}
    >
      <div style={{
        background: 'rgba(8,8,8,0.96)',
        border: '1px solid rgba(253,225,0,0.25)',
        borderLeft: `3px solid ${NEON}`,
        padding: '10px 12px',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(-12px)',
        transition: 'opacity 280ms ease, transform 280ms cubic-bezier(0.22,1.4,0.36,1)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: 8, fontWeight: 800,
            letterSpacing: '0.28em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase',
          }}>
            {player.pos} · {player.num}
          </span>
        </div>
        <div style={{
          fontFamily: 'var(--font-serif-hero)', fontStyle: 'italic',
          fontSize: 20, fontWeight: 700, color: '#fff', lineHeight: 1, marginBottom: 10,
        }}>
          {firstName}
        </div>

        {/* Energia */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 7, fontWeight: 700, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>ENERGIA</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 7, fontWeight: 800, color: energyColor }}>{Math.round(energy)}%</span>
          </div>
          <div style={{ height: 2, background: 'rgba(255,255,255,0.08)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${energy}%`, background: energyColor }} />
          </div>
        </div>

        {/* Última ação */}
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 7, fontWeight: 700, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>ÚLTIMA AÇÃO</span>
          <span style={{ fontFamily: 'var(--font-serif-hero)', fontStyle: 'italic', fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>
            {actionLabel}
          </span>
        </div>

        {/* Tendência + Obediência */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: 7, fontWeight: 800,
            letterSpacing: '0.16em', textTransform: 'uppercase',
            color: NEON, opacity: 0.8,
          }}>
            {tendency}
          </span>
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: 7, fontWeight: 800,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: TIER_COLOR[roll.tier] ?? 'rgba(255,255,255,0.4)',
            border: `1px solid ${TIER_COLOR[roll.tier] ?? 'rgba(255,255,255,0.15)'}`,
            padding: '1px 5px',
          }}>
            {OBEDIENCE_TIER_BUBBLE[roll.tier]}
          </span>
        </div>
      </div>
    </div>
  );
}
