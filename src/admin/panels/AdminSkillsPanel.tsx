/**
 * AdminSkillsPanel — atribui Coach Skills a jogadores.
 *
 * Permite equipar até 3 skills por jogador, respeitando:
 * - Role compatibility (lateral só pode equipar skills de lateral)
 * - Attr requirements (skill exige atributos mínimos)
 * - Unlock requirements (tier de carreira, preço, achievements)
 */

import { useMemo, useState } from 'react';
import { Zap, Check, Lock, AlertCircle } from 'lucide-react';
import { useGameDispatch, useGameStore } from '@/game/store';
import { FULL_SKILL_CATALOG, getSkillById } from '@/skills/index';
import type { CoachSkill } from '@/skills/playbookV1';
import type { PlayerEntity } from '@/entities/types';
import { cn } from '@/lib/utils';

const MAX_SKILLS_PER_PLAYER = 3;

const ROLE_MAP: Record<string, CoachSkill['role']> = {
  GOL: 'goleiro',
  ZAG: 'zagueiro',
  LD: 'lateral',
  LE: 'lateral',
  VOL: 'volante',
  MC: 'meia',
  MEI: 'meia',
  ATA: 'atacante',
  PE: 'ponta',
  PD: 'ponta',
};

function getRoleForPlayer(player: PlayerEntity): CoachSkill['role'] | null {
  return ROLE_MAP[player.pos] ?? null;
}

function canEquipSkill(player: PlayerEntity, skill: CoachSkill): { ok: boolean; reason?: string } {
  // Role compatibility
  const playerRole = getRoleForPlayer(player);
  if (!playerRole || playerRole !== skill.role) {
    return { ok: false, reason: `Posição incompatível (precisa: ${skill.role})` };
  }

  // Attr requirements
  if (skill.attrRequirements) {
    for (const [attr, minVal] of Object.entries(skill.attrRequirements)) {
      const playerVal = player.attrs[attr as keyof typeof player.attrs];
      if (playerVal < minVal) {
        return { ok: false, reason: `${attr} insuficiente (precisa: ${minVal}, tem: ${playerVal})` };
      }
    }
  }

  // Unlock requirements (simplificado — Fase 1 ignora achievements/dates)
  if (skill.unlock.minCareerTier && skill.unlock.minCareerTier > 1) {
    return { ok: false, reason: `Tier de carreira insuficiente (precisa: ${skill.unlock.minCareerTier})` };
  }

  return { ok: true };
}

export function AdminSkillsPanel() {
  const dispatch = useGameDispatch();
  const players = useGameStore((s) => s.players);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const playerList = useMemo(
    () => Object.values(players).sort((a, b) => a.name.localeCompare(b.name, 'pt')),
    [players],
  );

  const selectedPlayer = selectedPlayerId ? players[selectedPlayerId] : null;
  const equippedSkills = selectedPlayer?.skills ?? [];

  const availableSkills = useMemo(() => {
    if (!selectedPlayer) return [];
    const role = getRoleForPlayer(selectedPlayer);
    if (!role) return [];
    return FULL_SKILL_CATALOG.filter((s) => s.role === role);
  }, [selectedPlayer]);

  const equipSkill = (skillId: string) => {
    if (!selectedPlayerId || equippedSkills.length >= MAX_SKILLS_PER_PLAYER) return;
    if (equippedSkills.includes(skillId)) return;

    dispatch({
      type: 'ADMIN_PATCH_PLAYER',
      playerId: selectedPlayerId,
      partial: { skills: [...equippedSkills, skillId] },
    });
  };

  const unequipSkill = (skillId: string) => {
    if (!selectedPlayerId) return;
    dispatch({
      type: 'ADMIN_PATCH_PLAYER',
      playerId: selectedPlayerId,
      partial: { skills: equippedSkills.filter((id) => id !== skillId) },
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-100/90">
        <div className="flex items-start gap-3">
          <Zap className="mt-0.5 h-5 w-5 shrink-0 text-neon-yellow" />
          <div>
            <p className="font-display text-lg font-black text-white">COACH SKILLS</p>
            <p className="mt-1 text-white/75">
              Equipa até <strong className="text-neon-yellow">{MAX_SKILLS_PER_PLAYER} skills</strong> por jogador.
              Skills modificam comportamento tático em tempo real (sobreposição, cruzamento, pressão, etc.).
            </p>
            <p className="mt-2 text-xs text-white/60">
              Catálogo: {FULL_SKILL_CATALOG.length} skills · {availableSkills.length} compatíveis com jogador selecionado
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Lista de jogadores */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white/50">Jogadores</h3>
          <div className="ole-scroll-y max-h-[600px] space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-2">
            {playerList.map((p) => {
              const role = getRoleForPlayer(p);
              const skillCount = p.skills?.length ?? 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPlayerId(p.id)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors',
                    selectedPlayerId === p.id
                      ? 'bg-neon-yellow text-black'
                      : 'text-white/70 hover:bg-white/10 hover:text-white',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">{p.name}</div>
                    <div className="text-xs opacity-70">
                      {p.pos} · {role ?? 'sem role'}
                    </div>
                  </div>
                  <div className="ml-2 flex items-center gap-1">
                    <Zap className="h-3.5 w-3.5" />
                    <span className="font-mono text-xs font-bold">{skillCount}/{MAX_SKILLS_PER_PLAYER}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Skills do jogador selecionado */}
        <div className="space-y-4">
          {!selectedPlayer ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] text-white/40">
              Seleciona um jogador para equipar skills
            </div>
          ) : (
            <>
              {/* Skills equipadas */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white/50">
                  Skills Equipadas ({equippedSkills.length}/{MAX_SKILLS_PER_PLAYER})
                </h3>
                {equippedSkills.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-8 text-center text-sm text-white/40">
                    Nenhuma skill equipada
                  </div>
                ) : (
                  <div className="space-y-2">
                    {equippedSkills.map((skillId) => {
                      const skill = getSkillById(skillId);
                      if (!skill) return null;
                      return (
                        <div
                          key={skillId}
                          className="flex items-start gap-3 rounded-xl border border-neon-yellow/30 bg-neon-yellow/10 p-3"
                        >
                          <Zap className="mt-0.5 h-5 w-5 shrink-0 text-neon-yellow" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-display text-sm font-black text-white">{skill.name}</div>
                                <div className="mt-0.5 text-xs text-white/70">{skill.philosophy}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => unequipSkill(skillId)}
                                className="rounded border border-white/20 bg-black/30 px-2 py-1 text-[10px] font-bold uppercase text-white/80 hover:bg-white/10"
                              >
                                Remover
                              </button>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1">
                              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white/60">
                                {skill.tier}
                              </span>
                              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white/60">
                                Lv {skill.level}
                              </span>
                              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white/60">
                                {skill.behaviors.length} behaviors
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Skills disponíveis */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white/50">
                  Skills Disponíveis ({availableSkills.length})
                </h3>
                <div className="ole-scroll-y max-h-[500px] space-y-2 overflow-y-auto">
                  {availableSkills.map((skill) => {
                    const isEquipped = equippedSkills.includes(skill.id);
                    const canEquip = canEquipSkill(selectedPlayer, skill);
                    const isFull = equippedSkills.length >= MAX_SKILLS_PER_PLAYER;

                    return (
                      <div
                        key={skill.id}
                        className={cn(
                          'rounded-xl border p-3',
                          isEquipped
                            ? 'border-neon-yellow/30 bg-neon-yellow/5'
                            : 'border-white/10 bg-white/[0.02]',
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-display text-sm font-black text-white">{skill.name}</div>
                                <div className="mt-0.5 text-xs text-white/60">{skill.philosophy}</div>
                              </div>
                              {isEquipped ? (
                                <div className="flex items-center gap-1 rounded bg-neon-yellow/20 px-2 py-1 text-[10px] font-bold uppercase text-neon-yellow">
                                  <Check className="h-3 w-3" />
                                  Equipada
                                </div>
                              ) : !canEquip.ok ? (
                                <div className="flex items-center gap-1 rounded bg-red-500/20 px-2 py-1 text-[10px] font-bold uppercase text-red-300">
                                  <Lock className="h-3 w-3" />
                                  Bloqueada
                                </div>
                              ) : isFull ? (
                                <div className="flex items-center gap-1 rounded bg-amber-500/20 px-2 py-1 text-[10px] font-bold uppercase text-amber-300">
                                  <AlertCircle className="h-3 w-3" />
                                  Limite
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => equipSkill(skill.id)}
                                  className="rounded border border-neon-yellow/40 bg-neon-yellow/15 px-2 py-1 text-[10px] font-bold uppercase text-neon-yellow hover:bg-neon-yellow/25"
                                >
                                  Equipar
                                </button>
                              )}
                            </div>

                            {!canEquip.ok && (
                              <div className="mt-2 flex items-start gap-1.5 text-xs text-red-300/90">
                                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                {canEquip.reason}
                              </div>
                            )}

                            <div className="mt-2 flex flex-wrap gap-1">
                              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white/60">
                                {skill.tier}
                              </span>
                              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white/60">
                                Lv {skill.level}
                              </span>
                              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white/60">
                                {skill.behaviors.length} behaviors
                              </span>
                              {skill.attrRequirements && (
                                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white/60">
                                  {Object.keys(skill.attrRequirements).length} reqs
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
