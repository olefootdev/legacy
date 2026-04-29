/**
 * Admin Coach Agents Panel
 *
 * Gerenciamento completo dos Coach Agents (Treinadores IA):
 * - Criar/editar coaches com personalidades diferentes
 * - Ver memória e histórico de decisões
 * - Testar conversas com o coach
 * - Gerenciar instruções do manager
 */

import { useState } from 'react';
import { motion } from 'motion/react';
import {
  Brain,
  Plus,
  Trash2,
  MessageSquare,
  TrendingUp,
  Shield,
  Target,
  Zap,
  Users,
  BookOpen,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import { useGameStore, useGameDispatch } from '@/game/store';
import { cn } from '@/lib/utils';
import type { CoachAgent, CoachPersonality, CoachSpecialty } from '@/coach/types';

const PERSONALITY_OPTIONS: { id: CoachPersonality; label: string; description: string; icon: typeof Shield }[] = [
  {
    id: 'Pragmatic',
    label: 'Pragmático',
    description: 'Foca em resultados, defesa sólida e disciplina. Estilo Mourinho.',
    icon: Shield,
  },
  {
    id: 'Visionary',
    label: 'Visionário',
    description: 'Jogo de posse, padrões ofensivos e desenvolvimento. Estilo Guardiola.',
    icon: Brain,
  },
  {
    id: 'Motivator',
    label: 'Motivador',
    description: 'Intensidade, pressing e energia do grupo. Estilo Klopp.',
    icon: Zap,
  },
  {
    id: 'Tactician',
    label: 'Tático',
    description: 'Adaptação tática e equilíbrio entre setores. Estilo Ancelotti.',
    icon: Target,
  },
  {
    id: 'Developer',
    label: 'Desenvolvedor',
    description: 'Desenvolvimento de jovens e construção de longo prazo.',
    icon: TrendingUp,
  },
];

const SPECIALTY_OPTIONS: { id: CoachSpecialty; label: string }[] = [
  { id: 'defense', label: 'Defesa' },
  { id: 'attack', label: 'Ataque' },
  { id: 'midfield', label: 'Meio-campo' },
  { id: 'setpieces', label: 'Bolas paradas' },
  { id: 'youth', label: 'Jovens' },
  { id: 'fitness', label: 'Físico' },
  { id: 'mentality', label: 'Mental' },
];

function createDefaultCoach(): CoachAgent {
  return {
    id: `coach_${Date.now()}`,
    name: 'Novo Treinador',
    personality: 'Tactician',
    specialties: ['defense', 'attack'],
    tactical: 15,
    motivation: 15,
    discipline: 15,
    attacking: 15,
    defending: 15,
    autonomyLevel: 50,
    reputation: 50,
    memory: {
      managerInstructions: [],
      trainingKnowledge: {
        preferredIndividualTypes: [],
        preferredCollectiveTypes: [],
        preferredGroups: [],
        typicalDurationHours: 24,
      },
      staffKnowledge: {
        priorityRoles: [],
        playerAssignmentStrategy: 'Distribuir uniformemente',
      },
      decisionHistory: [],
    },
    conversationContext: [],
    pendingActions: [],
  };
}

export function AdminCoachAgentsPanel() {
  const dispatch = useGameDispatch();
  const coach = useGameStore((s) => s.manager.coach);
  const [editingCoach, setEditingCoach] = useState<CoachAgent | null>(null);
  const [showChat, setShowChat] = useState(false);

  const handleCreateCoach = () => {
    const newCoach = createDefaultCoach();
    setEditingCoach(newCoach);
  };

  const handleSaveCoach = () => {
    if (!editingCoach) return;

    dispatch({ type: 'ADMIN_SET_COACH', coach: editingCoach });
    setEditingCoach(null);
  };

  const handleDeleteCoach = () => {
    if (!window.confirm('Remover o treinador assistente?')) return;

    dispatch({ type: 'ADMIN_REMOVE_COACH' });
  };

  const handleUpdateAttribute = (attr: keyof Pick<CoachAgent, 'tactical' | 'motivation' | 'discipline' | 'attacking' | 'defending'>, value: number) => {
    if (!editingCoach) return;
    setEditingCoach({
      ...editingCoach,
      [attr]: Math.max(0, Math.min(20, value)),
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-black uppercase tracking-wider text-white">
            Coach Agents
          </h2>
          <p className="mt-1 text-sm text-white/60">
            Treinadores assistentes com IA (Claude Haiku)
          </p>
        </div>

        {!coach && !editingCoach && (
          <button
            onClick={handleCreateCoach}
            className="flex items-center gap-2 rounded-lg bg-neon-yellow px-4 py-2 text-xs font-black uppercase text-black hover:bg-white"
          >
            <Plus className="h-4 w-4" />
            Criar Coach
          </button>
        )}
      </div>

      {/* Estado vazio */}
      {!coach && !editingCoach && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <Brain className="mx-auto h-12 w-12 text-white/40 mb-4" />
          <p className="text-white/60 mb-4">Nenhum treinador assistente configurado</p>
          <button
            onClick={handleCreateCoach}
            className="inline-flex items-center gap-2 rounded-lg bg-neon-yellow px-6 py-3 font-display text-sm font-black uppercase text-black hover:bg-white"
          >
            <Plus className="h-5 w-5" />
            Criar Coach Agent
          </button>
        </div>
      )}

      {/* Editor de Coach */}
      {editingCoach && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Informações Básicas */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/60 mb-4">
              Informações Básicas
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-white/60 mb-2">
                  Nome
                </label>
                <input
                  type="text"
                  value={editingCoach.name}
                  onChange={(e) => setEditingCoach({ ...editingCoach, name: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-white"
                  placeholder="Ex: Carlos Silva"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-white/60 mb-2">
                  Personalidade
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {PERSONALITY_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const isSelected = editingCoach.personality === option.id;
                    return (
                      <button
                        key={option.id}
                        onClick={() => setEditingCoach({ ...editingCoach, personality: option.id })}
                        className={cn(
                          'flex items-start gap-3 rounded-lg border p-4 text-left transition-all',
                          isSelected
                            ? 'border-neon-yellow bg-neon-yellow/10'
                            : 'border-white/10 bg-black/20 hover:border-white/20'
                        )}
                      >
                        <Icon className={cn('h-5 w-5 mt-0.5', isSelected ? 'text-neon-yellow' : 'text-white/40')} />
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-sm font-bold', isSelected ? 'text-neon-yellow' : 'text-white')}>
                            {option.label}
                          </p>
                          <p className="text-xs text-white/60 mt-1">{option.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-white/60 mb-2">
                  Especialidades (selecione até 3)
                </label>
                <div className="flex flex-wrap gap-2">
                  {SPECIALTY_OPTIONS.map((option) => {
                    const isSelected = editingCoach.specialties.includes(option.id);
                    return (
                      <button
                        key={option.id}
                        onClick={() => {
                          if (isSelected) {
                            setEditingCoach({
                              ...editingCoach,
                              specialties: editingCoach.specialties.filter((s) => s !== option.id),
                            });
                          } else if (editingCoach.specialties.length < 3) {
                            setEditingCoach({
                              ...editingCoach,
                              specialties: [...editingCoach.specialties, option.id],
                            });
                          }
                        }}
                        className={cn(
                          'rounded-lg px-3 py-1.5 text-xs font-bold uppercase transition-all',
                          isSelected
                            ? 'bg-neon-yellow text-black'
                            : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                        )}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Atributos */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/60 mb-4">
              Atributos (0-20)
            </h3>

            <div className="space-y-4">
              {[
                { key: 'tactical' as const, label: 'Tático', description: 'Leitura de jogo e ajustes táticos' },
                { key: 'motivation' as const, label: 'Motivação', description: 'Impacto em moral e recuperação' },
                { key: 'discipline' as const, label: 'Disciplina', description: 'Reduz cartões e melhora posicionamento' },
                { key: 'attacking' as const, label: 'Ataque', description: 'Coaching de finalizações e criação' },
                { key: 'defending' as const, label: 'Defesa', description: 'Coaching de marcação e posicionamento' },
              ].map((attr) => (
                <div key={attr.key}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <label className="text-sm font-bold text-white">{attr.label}</label>
                      <p className="text-xs text-white/40">{attr.description}</p>
                    </div>
                    <span className="font-mono text-lg font-bold text-neon-yellow">
                      {editingCoach[attr.key]}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    value={editingCoach[attr.key]}
                    onChange={(e) => handleUpdateAttribute(attr.key, Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Autonomia */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/60 mb-4">
              Autonomia
            </h3>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <label className="text-sm font-bold text-white">Nível de Autonomia</label>
                  <p className="text-xs text-white/40">
                    Quanto o coach age sem pedir permissão (0-100)
                  </p>
                </div>
                <span className="font-mono text-lg font-bold text-neon-yellow">
                  {editingCoach.autonomyLevel}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={editingCoach.autonomyLevel}
                onChange={(e) => setEditingCoach({ ...editingCoach, autonomyLevel: Number(e.target.value) })}
                className="w-full"
              />
            </div>
          </div>

          {/* Ações */}
          <div className="flex gap-3">
            <button
              onClick={handleSaveCoach}
              className="flex items-center gap-2 rounded-lg bg-neon-green px-6 py-3 text-sm font-bold uppercase text-black hover:bg-neon-green/80"
            >
              <CheckCircle className="h-5 w-5" />
              Salvar Coach
            </button>
            <button
              onClick={() => setEditingCoach(null)}
              className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-6 py-3 text-sm font-bold uppercase text-white hover:bg-white/10"
            >
              <XCircle className="h-5 w-5" />
              Cancelar
            </button>
          </div>
        </motion.div>
      )}

      {/* Coach Ativo */}
      {coach && !editingCoach && (
        <div className="space-y-6">
          {/* Card do Coach */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-2xl font-black text-white">{coach.name}</h3>
                <p className="text-sm text-white/60 mt-1">
                  {PERSONALITY_OPTIONS.find((p) => p.id === coach.personality)?.label} •{' '}
                  {coach.specialties.map((s) => SPECIALTY_OPTIONS.find((o) => o.id === s)?.label).join(', ')}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setEditingCoach(coach)}
                  className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-xs font-bold uppercase text-white hover:bg-white/10"
                >
                  Editar
                </button>
                <button
                  onClick={handleDeleteCoach}
                  className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-bold uppercase text-red-400 hover:bg-red-500/20"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Atributos */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { key: 'tactical', label: 'Tático', icon: Target },
                { key: 'motivation', label: 'Motivação', icon: Zap },
                { key: 'discipline', label: 'Disciplina', icon: Shield },
                { key: 'attacking', label: 'Ataque', icon: TrendingUp },
                { key: 'defending', label: 'Defesa', icon: Shield },
              ].map((attr) => {
                const Icon = attr.icon;
                const value = coach[attr.key as keyof typeof coach] as number;
                return (
                  <div key={attr.key} className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="h-4 w-4 text-white/40" />
                      <span className="text-xs font-bold uppercase text-white/60">{attr.label}</span>
                    </div>
                    <p className="font-mono text-2xl font-black text-neon-yellow">{value}</p>
                    <p className="text-xs text-white/40 mt-1">/20</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Instruções do Manager */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white/60">
                Instruções do Manager
              </h3>
              <span className="text-xs text-white/40">
                {coach.memory.managerInstructions.filter((i) => i.active).length} ativas
              </span>
            </div>

            {coach.memory.managerInstructions.length === 0 ? (
              <p className="text-sm text-white/40 text-center py-4">
                Nenhuma instrução registrada ainda
              </p>
            ) : (
              <div className="space-y-2">
                {coach.memory.managerInstructions.slice(0, 5).map((instruction, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'rounded-lg border p-3',
                      instruction.active
                        ? 'border-neon-green/30 bg-neon-green/5'
                        : 'border-white/10 bg-black/20 opacity-50'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white">{instruction.instruction}</p>
                        <p className="text-xs text-white/40 mt-1">
                          {instruction.category} • {instruction.priority} • {instruction.context}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'text-xs font-bold uppercase px-2 py-1 rounded',
                          instruction.active ? 'bg-neon-green/20 text-neon-green' : 'bg-white/5 text-white/40'
                        )}
                      >
                        {instruction.active ? 'Ativa' : 'Inativa'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ações Pendentes */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white/60">
                Ações Pendentes
              </h3>
              <span className="text-xs text-white/40">
                {coach.pendingActions.filter((a) => a.status === 'pending').length} aguardando aprovação
              </span>
            </div>

            {coach.pendingActions.length === 0 ? (
              <p className="text-sm text-white/40 text-center py-4">
                Nenhuma ação pendente
              </p>
            ) : (
              <div className="space-y-2">
                {coach.pendingActions.slice(0, 5).map((action) => (
                  <div
                    key={action.id}
                    className="rounded-lg border border-white/10 bg-black/20 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white">{action.title}</p>
                        <p className="text-xs text-white/60 mt-1">{action.description}</p>
                        <p className="text-xs text-white/40 mt-2">{action.reasoning}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span
                          className={cn(
                            'text-xs font-bold uppercase px-2 py-1 rounded',
                            action.urgency === 'high'
                              ? 'bg-red-500/20 text-red-400'
                              : action.urgency === 'medium'
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-white/10 text-white/60'
                          )}
                        >
                          {action.urgency}
                        </span>
                        <span className="text-xs text-white/40">
                          {action.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Treinar Coach — Instruções do Manager */}
          <CoachInstructionsSection />

          {/* Histórico de Decisões */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/60 mb-4">
              Histórico de Decisões
            </h3>

            {coach.memory.decisionHistory.length === 0 ? (
              <p className="text-sm text-white/40 text-center py-4">
                Nenhuma decisão registrada ainda
              </p>
            ) : (
              <div className="space-y-3">
                {coach.memory.decisionHistory.slice(0, 10).map((decision, idx) => (
                  <div key={idx} className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="flex items-start gap-3">
                      <Clock className="h-4 w-4 text-white/40 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white">{decision.action}</p>
                        <p className="text-xs text-white/60 mt-1">{decision.reasoning}</p>
                        {decision.outcome && (
                          <p className="text-xs text-neon-green mt-2">→ {decision.outcome}</p>
                        )}
                        <p className="text-xs text-white/40 mt-2">
                          {decision.type} • {new Date(decision.timestamp).toLocaleString('pt-BR')}
                        </p>
                      </div>
                      {decision.managerApproved ? (
                        <CheckCircle className="h-5 w-5 text-neon-green" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-400" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CoachInstructionsSection() {
  const dispatch = useGameDispatch();
  const instructions = useGameStore((s) => s.manager.coach?.memory.managerInstructions ?? []);
  const [text, setText] = useState('');
  const [category, setCategory] = useState<'training' | 'staff' | 'lineup' | 'tactics' | 'general'>('general');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');

  const handleAdd = () => {
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    dispatch({
      type: 'COACH_ADD_INSTRUCTION',
      instruction: trimmed,
      category,
      priority,
      context: 'Treinamento manual via Admin',
    });
    setText('');
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
      <h3 className="text-xs font-bold uppercase tracking-wider text-white/60 mb-4">
        Treinar Coach — Instruções do Manager
      </h3>

      <div className="space-y-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ex: Sempre priorize fadiga abaixo de 60% antes de treino tático"
          className="w-full rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-white placeholder:text-white/30 focus:border-neon-green focus:outline-none"
          rows={3}
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
            className="rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
          >
            <option value="general">Geral</option>
            <option value="training">Treino</option>
            <option value="staff">Staff</option>
            <option value="lineup">Escalação</option>
            <option value="tactics">Tática</option>
          </select>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as typeof priority)}
            className="rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
          >
            <option value="high">Alta</option>
            <option value="medium">Média</option>
            <option value="low">Baixa</option>
          </select>
          <button
            onClick={handleAdd}
            disabled={text.trim().length === 0}
            className="ml-auto rounded bg-neon-green px-3 py-1 text-xs font-bold text-black disabled:opacity-40"
          >
            + Adicionar instrução
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {instructions.length === 0 ? (
          <p className="py-2 text-center text-xs text-white/40">
            Nenhuma instrução registrada. O coach aprende com seus comandos.
          </p>
        ) : (
          instructions.map((it, idx) => (
            <div
              key={idx}
              className={cn(
                'flex items-start gap-3 rounded border border-white/10 p-3',
                it.active ? 'bg-black/30' : 'bg-black/10 opacity-50',
              )}
            >
              <input
                type="checkbox"
                checked={it.active}
                onChange={(e) =>
                  dispatch({
                    type: 'COACH_TOGGLE_INSTRUCTION',
                    index: idx,
                    active: e.target.checked,
                  })
                }
                className="mt-1"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white">{it.instruction}</p>
                <p className="mt-1 text-xs text-white/40">
                  {it.category} · {it.priority} · {new Date(it.timestamp).toLocaleString('pt-BR')}
                </p>
              </div>
              <button
                onClick={() => dispatch({ type: 'COACH_REMOVE_INSTRUCTION', index: idx })}
                className="text-xs text-red-400 hover:text-red-300"
                title="Remover"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
