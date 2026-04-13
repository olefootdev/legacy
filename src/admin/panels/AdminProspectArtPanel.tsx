import { useCallback, useEffect, useMemo, useState } from 'react';
import { Brush, CheckCircle2, ClipboardCopy, ExternalLink } from 'lucide-react';
import { useGameDispatch, useGameStore } from '@/game/store';
import { DEFAULT_MANAGER_PROSPECT_CREATE_COST_EXP } from '@/entities/managerProspect';
import { PORTRAIT_STYLE_REGION_LABELS } from '@/entities/managerProspect';
import type { PlayerEntity } from '@/entities/types';
import type { ManagerProspectArtRequest } from '@/game/types';
import { formatExp } from '@/systems/economy';
import { cn } from '@/lib/utils';

function stepLabel(step: ManagerProspectArtRequest['playerCreationStep']): string {
  switch (step) {
    case 'awaiting_photo':
      return 'Aguarda foto';
    case 'photo_uploaded':
      return 'Rascunho';
    case 'validated':
      return 'Validado';
    case 'approved':
      return 'Aprovado';
    case 'launched':
      return 'No jogo';
    default:
      return step;
  }
}

function ArtQueueRow({ r, pl }: { r: ManagerProspectArtRequest; pl?: PlayerEntity | undefined }) {
  const dispatch = useGameDispatch();
  const [draft, setDraft] = useState(r.draftPortraitUrl ?? '');
  useEffect(() => {
    setDraft(r.draftPortraitUrl ?? '');
  }, [r.id, r.draftPortraitUrl]);

  const canSavePhoto =
    (r.playerCreationStep === 'awaiting_photo' || r.playerCreationStep === 'photo_uploaded') &&
    (draft.trim().startsWith('data:image/') || /^https?:\/\//i.test(draft.trim()));

  return (
    <li
      className={cn(
        'rounded-xl border p-4',
        r.playerCreationStep === 'launched' ? 'border-emerald-500/25 bg-emerald-950/15' : 'border-neon-yellow/20 bg-black/35',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-sm font-black text-white">{pl?.name ?? '—'}</span>
            <span
              className={cn(
                'rounded-full border px-2 py-0.5 font-display text-[9px] font-bold uppercase',
                r.playerCreationStep === 'launched'
                  ? 'border-emerald-500/40 text-emerald-200'
                  : 'border-amber-500/35 text-amber-200',
              )}
            >
              {stepLabel(r.playerCreationStep)}
            </span>
          </div>
          <div className="mt-1 font-mono text-[11px] text-white/45">
            playerId: <span className="text-neon-yellow/90">{r.playerId}</span>
            <span className="mx-2 text-white/20">·</span>
            {r.createdAtIso}
          </div>
          <div className="mt-2 rounded-lg border border-white/10 bg-black/40 p-2 text-[10px] leading-relaxed text-white/70">
            <span className="font-bold text-neon-yellow/90">Origem no cartão</span>
            <div className="mt-0.5">
              Estilo: {PORTRAIT_STYLE_REGION_LABELS[r.heritage.portraitStyleRegion]}
            </div>
            {r.heritage.originTags?.length ? (
              <div>Marcadores: {r.heritage.originTags.join(', ')}</div>
            ) : null}
            <div className="mt-1 text-white/85">{r.heritage.originText}</div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(r.adminArtPrompt)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white/80 hover:bg-white/10"
          >
            <ClipboardCopy className="h-3.5 w-3.5" />
            Copiar prompt
          </button>
        </div>
      </div>

      {r.playerCreationStep !== 'launched' ? (
        <div className="mt-3 space-y-2 rounded-lg border border-white/10 bg-black/30 p-3">
          <label className="block space-y-1">
            <span className="text-[10px] font-bold uppercase text-gray-500">URL do retrato (data URL ou https)</span>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-white/15 bg-black/50 px-2 py-2 font-mono text-[10px] text-white outline-none focus:border-neon-yellow"
              placeholder="data:image/jpeg;base64,... ou https://..."
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!canSavePhoto}
              onClick={() =>
                dispatch({ type: 'ADMIN_PLAYER_CREATION_SET_PHOTO', requestId: r.id, portraitUrl: draft.trim() })
              }
              className={cn(
                'rounded-lg border border-cyan-500/40 px-3 py-1.5 text-[10px] font-bold uppercase text-cyan-200 hover:bg-cyan-500/10',
                !canSavePhoto && 'pointer-events-none opacity-40',
              )}
            >
              Guardar foto
            </button>
            <button
              type="button"
              disabled={r.playerCreationStep !== 'photo_uploaded'}
              onClick={() => dispatch({ type: 'ADMIN_PLAYER_CREATION_VALIDATE', requestId: r.id })}
              className={cn(
                'rounded-lg border border-white/25 px-3 py-1.5 text-[10px] font-bold uppercase text-white/85 hover:bg-white/10',
                r.playerCreationStep !== 'photo_uploaded' && 'pointer-events-none opacity-40',
              )}
            >
              Validar
            </button>
            <button
              type="button"
              disabled={r.playerCreationStep !== 'validated'}
              onClick={() => dispatch({ type: 'ADMIN_PLAYER_CREATION_APPROVE', requestId: r.id })}
              className={cn(
                'rounded-lg border border-amber-500/40 px-3 py-1.5 text-[10px] font-bold uppercase text-amber-200 hover:bg-amber-500/10',
                r.playerCreationStep !== 'validated' && 'pointer-events-none opacity-40',
              )}
            >
              Aprovar
            </button>
            <button
              type="button"
              disabled={r.playerCreationStep !== 'approved'}
              onClick={() => dispatch({ type: 'ADMIN_PLAYER_CREATION_LAUNCH', requestId: r.id })}
              className={cn(
                'rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-3 py-1.5 text-[10px] font-bold uppercase text-emerald-200 hover:bg-emerald-500/25',
                r.playerCreationStep !== 'approved' && 'pointer-events-none opacity-40',
              )}
            >
              Lançar no jogo
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-emerald-300/90">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Retrato aplicado ao jogador no save.
        </div>
      )}

      <pre className="ole-scroll-x mt-3 max-h-40 overflow-auto rounded-lg border border-white/10 bg-black/50 p-3 text-[10px] leading-relaxed text-white/60 whitespace-pre-wrap">
        {r.adminArtPrompt}
      </pre>
    </li>
  );
}

export function AdminProspectArtPanel() {
  const dispatch = useGameDispatch();
  const createCostExp = useGameStore(
    (s) => s.managerProspectConfig?.createCostExp ?? DEFAULT_MANAGER_PROSPECT_CREATE_COST_EXP,
  );
  const queue = useGameStore((s) => s.managerProspectArtQueue ?? []);
  const players = useGameStore((s) => s.players);

  const [costDraft, setCostDraft] = useState(String(createCostExp));
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    setCostDraft(String(createCostExp));
  }, [createCostExp]);

  const pending = useMemo(() => queue.filter((r) => r.playerCreationStep !== 'launched'), [queue]);
  const done = useMemo(() => queue.filter((r) => r.playerCreationStep === 'launched'), [queue]);
  const rows = showDone ? [...pending, ...done] : pending;

  const applyCost = useCallback(() => {
    const n = Math.round(Number(costDraft.replace(/\s/g, '')));
    if (!Number.isFinite(n)) return;
    dispatch({ type: 'ADMIN_SET_MANAGER_PROSPECT_CONFIG', createCostExp: n });
  }, [costDraft, dispatch]);

  return (
    <div className="space-y-6 text-white">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-black uppercase tracking-tight text-neon-yellow">
            Player Creation (Academia OLE)
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-white/55">
            Demandas geradas quando o manager cria um jogador na Academia: o atleta já existe no plantel com
            atributos; aqui tratas só do retrato e do fluxo de validação.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-black/40 p-3">
          <Brush className="h-5 w-5 shrink-0 text-neon-yellow" aria-hidden />
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/70 md:grid-cols-2">
        <div>
          <p className="font-display text-[10px] font-black uppercase tracking-wide text-neon-yellow">
            Player Creation (esta tab)
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-[11px] leading-relaxed">
            <li>Pedido automático após criar na Academia OLE.</li>
            <li>Origem + aparência já vão no prompt; tu colas a imagem, validas, aprovas e lanças no save.</li>
            <li>«Lançar no jogo» grava o retrato no jogador existente (não cria carta nova).</li>
          </ul>
        </div>
        <div>
          <p className="font-display text-[10px] font-black uppercase tracking-wide text-cyan-300">
            Create player (tab separada, #create-player)
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-[11px] leading-relaxed">
            <li>Wizard completo: GameSpirit, raridade, coleção, mercado, etc.</li>
            <li>Minta um jogador novo a partir de prompt — não é fila da Academia.</li>
            <li>
              <a href="#create-player" className="text-neon-yellow underline hover:text-white">
                Abrir Create player
              </a>{' '}
              <ExternalLink className="inline h-3 w-3 align-middle opacity-60" aria-hidden />
            </li>
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/30 p-4">
        <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">Custo EXP (Academia OLE)</div>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-white/35">Valor debitado ao manager ao criar</span>
            <input
              value={costDraft}
              onChange={(e) => setCostDraft(e.target.value)}
              className="w-40 rounded-lg border border-white/15 bg-black/50 px-3 py-2 font-mono text-sm text-white outline-none focus:border-neon-yellow"
            />
          </label>
          <button
            type="button"
            onClick={applyCost}
            className="rounded-lg border border-neon-yellow/50 bg-neon-yellow/10 px-4 py-2 text-xs font-bold uppercase tracking-wide text-neon-yellow hover:bg-neon-yellow/20"
          >
            Guardar
          </button>
          <span className="pb-2 text-xs text-white/45">
            Atual: <span className="font-mono text-white">{formatExp(createCostExp)}</span> EXP
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-bold text-white/70">
          Fila ativa: <span className="text-neon-yellow">{pending.length}</span>
          {done.length ? (
            <span className="ml-2 text-white/40">
              · {done.length} concluído(s)
            </span>
          ) : null}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-white/50">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="accent-neon-yellow" />
          Mostrar concluídos
        </label>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-white/10 bg-black/20 px-4 py-6 text-center text-sm text-white/45">
          Nenhum pedido {showDone ? '' : 'pendente'}.
        </p>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => (
            <ArtQueueRow key={r.id} r={r} pl={players[r.playerId]} />
          ))}
        </ul>
      )}
    </div>
  );
}
