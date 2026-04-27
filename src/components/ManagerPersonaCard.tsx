/**
 * Card de Perfil do Treinador — resumo do estilo inferido dos comandos de voz.
 * Plugado no `/profile`.
 */

import { useEffect, useState } from 'react';
import { Megaphone, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchManagerPersona, fetchManagerCommandIntents } from '@/supabase/voiceCommandLog';
import { buildManagerPersona, type ManagerPersona } from '@/voiceCommand/persona';

const STYLE_COLOR: Record<ManagerPersona['style'], string> = {
  ofensivo_criativo: 'border-fuchsia-400/60 bg-fuchsia-500/10 text-fuchsia-100',
  ofensivo_direto: 'border-orange-400/60 bg-orange-500/10 text-orange-100',
  defensivo_tatico: 'border-sky-400/60 bg-sky-500/10 text-sky-100',
  gerencialista: 'border-violet-400/60 bg-violet-500/10 text-violet-100',
  agressivo: 'border-rose-500/60 bg-rose-500/15 text-rose-100',
  equilibrado: 'border-emerald-400/60 bg-emerald-500/10 text-emerald-100',
  iniciante: 'border-white/20 bg-white/5 text-white/80',
};

export function ManagerPersonaCard() {
  const [persona, setPersona] = useState<ManagerPersona | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [agg, intents] = await Promise.all([
        fetchManagerPersona(),
        fetchManagerCommandIntents(),
      ]);
      if (cancelled) return;
      if (!agg) {
        setLoading(false);
        return;
      }
      setPersona(buildManagerPersona(agg, intents));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/30 p-5">
        <div className="flex items-center gap-2 text-white/50">
          <Megaphone className="h-4 w-4" />
          <span className="text-xs font-bold uppercase tracking-wider">Perfil do treinador</span>
        </div>
        <p className="mt-3 text-sm text-white/40">Carregando...</p>
      </div>
    );
  }

  if (!persona || persona.total === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/30 p-5">
        <div className="flex items-center gap-2 text-white/60">
          <Megaphone className="h-4 w-4" />
          <span className="text-xs font-bold uppercase tracking-wider">Perfil do treinador</span>
        </div>
        <p className="mt-3 text-sm text-white/50">
          Use o comando técnico por voz durante a partida ao vivo pra começar a construir seu perfil.
        </p>
      </div>
    );
  }

  const acc = Math.round(persona.acceptanceRate * 100);
  const avgObed = Math.round(persona.avgObedience);

  return (
    <div className={cn('rounded-xl border p-5', STYLE_COLOR[persona.style])}>
      <div className="flex items-center gap-2">
        <Megaphone className="h-4 w-4" />
        <span className="text-xs font-bold uppercase tracking-wider opacity-80">Perfil do treinador</span>
      </div>
      <h3 className="mt-2 font-display text-2xl font-black uppercase tracking-wider">
        TREINADOR {persona.label.toUpperCase()}
      </h3>
      <p className="mt-1 text-[11px] leading-relaxed opacity-80">{persona.description}</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-white/10 bg-black/30 p-3">
          <p className="text-[9px] font-bold uppercase tracking-wider opacity-60">Comandos emitidos</p>
          <p className="mt-1 font-mono text-xl font-black">{persona.total}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/30 p-3">
          <p className="text-[9px] font-bold uppercase tracking-wider opacity-60">Taxa de aceitação</p>
          <p className="mt-1 font-mono text-xl font-black">{acc}%</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/30 p-3">
          <p className="text-[9px] font-bold uppercase tracking-wider opacity-60">Obediência média</p>
          <p className="mt-1 font-mono text-xl font-black">{avgObed}%</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/30 p-3">
          <p className="text-[9px] font-bold uppercase tracking-wider opacity-60">Assistente favorito</p>
          <p className="mt-1 text-sm font-black truncate">
            {persona.topAssistant ? assistantLabel(persona.topAssistant) : '—'}
          </p>
        </div>
      </div>

      {persona.topIntent ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2">
          <TrendingUp className="h-3.5 w-3.5 opacity-70" />
          <p className="text-[11px] font-semibold">
            Comando favorito: <strong>{intentLabel(persona.topIntent)}</strong> ({persona.topIntentCount}×)
          </p>
        </div>
      ) : null}
    </div>
  );
}

function assistantLabel(a: string): string {
  const m: Record<string, string> = {
    tatico: '🧠 Aux. Tático',
    ataque: '⚔️ Aux. Ataque',
    defesa: '🛡️ Aux. Defesa',
    fisico: '💪 Preparador Físico',
    mental: '🧘 Preparador Mental',
  };
  return m[a] ?? a;
}

function intentLabel(i: string): string {
  const m: Record<string, string> = {
    invade_box: 'Invade a área',
    dribble_attempt: 'Tenta o drible',
    take_shot: 'Chuta',
    cross_ball: 'Cruza a bola',
    pass_to_player: 'Passa pro jogador',
    hold_ball: 'Segura a bola',
    team_press_high: 'Pressiona alto',
    team_retreat: 'Recua',
    team_hold_possession: 'Segura a bola (time)',
    break_line: 'Quebra a linha',
    run_behind: 'Corre pelas costas',
    pedal_to_metal: 'Pisa no acelerador',
    player_substitution: 'Substituição',
    formation_change: 'Muda formação',
  };
  return m[i] ?? i;
}
