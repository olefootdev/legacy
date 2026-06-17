import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Brush, CheckCircle2, ClipboardCopy, ExternalLink, Loader2, RefreshCw, Upload } from 'lucide-react';
import { getGameState, useGameDispatch, useGameStore } from '@/game/store';
import { getSupabase, isSupabaseConfigured } from '@/supabase/client';
import { registerAcademyManagerListing } from '@/supabase/academyManagers';
import { fetchAllManagerArtRequests, type GlobalArtRequest } from '@/supabase/managerGameState';
import { DEFAULT_MANAGER_PROSPECT_CREATE_COST_EXP } from '@/entities/managerProspect';
import { PORTRAIT_STYLE_REGION_LABELS } from '@/entities/managerProspect';
import { olefootApiBase } from '@/gamespirit/admin/runtimeTruth';
import type { PlayerEntity } from '@/entities/types';
import type { ManagerProspectArtRequest } from '@/game/types';
import { formatExp } from '@/systems/economy';
import { cn } from '@/lib/utils';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * Sobe arquivo de imagem pro Pinata via /api/academy/upload-admin-image.
 * Usado quando admin gerou arte fora (Freepik web, etc) e só quer hospedar.
 */
type UploadAdminImageResult =
  | { ok: true; url: string; error?: undefined }
  | { ok: false; error: string; url?: undefined };

async function uploadAdminImage(
  file: File,
  kind: 'portrait' | 'promo',
  requestId: string,
): Promise<UploadAdminImageResult> {
  const sb = getSupabase();
  const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
  if (!token) return { ok: false, error: 'Sem sessão Supabase. Faz login.' };
  const serverUrl = olefootApiBase();
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: `Ficheiro muito grande (máx. ${MAX_UPLOAD_BYTES / 1024 / 1024} MB).` };
  }
  if (!file.type.startsWith('image/')) {
    return { ok: false, error: 'Só imagens são aceites.' };
  }
  const form = new FormData();
  form.append('image', file, file.name || `${kind}.png`);
  form.append('kind', kind);
  if (requestId) form.append('request_id', requestId);
  try {
    const r = await fetch(`${serverUrl}/api/academy/upload-admin-image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const json = (await r.json().catch(() => null)) as { ok?: boolean; url?: string; error?: string } | null;
    if (!r.ok || !json?.ok || !json.url) {
      return { ok: false, error: json?.error ?? `HTTP ${r.status}` };
    }
    return { ok: true, url: json.url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Falha de rede.' };
  }
}

function ImageDropzone({
  kind,
  requestId,
  label,
  onUploaded,
}: {
  kind: 'portrait' | 'promo';
  requestId: string;
  label: string;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setBusy(true);
      const res = await uploadAdminImage(file, kind, requestId);
      setBusy(false);
      if (res.ok) {
        onUploaded(res.url);
        return;
      }
      setError(res.error);
    },
    [kind, requestId, onUploaded],
  );

  return (
    <div className="space-y-1">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void handleFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-3 text-[10px] font-bold uppercase tracking-wide transition-colors',
          dragOver
            ? 'border-neon-yellow bg-neon-yellow/10 text-neon-yellow'
            : 'border-white/20 bg-black/30 text-white/60 hover:border-neon-yellow/50 hover:text-white/85',
          busy && 'pointer-events-none opacity-60',
        )}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        <span>{busy ? 'A subir…' : label}</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = '';
          }}
        />
      </div>
      {error ? (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-[10px] text-red-300">{error}</div>
      ) : null}
    </div>
  );
}

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
  const [promo, setPromo] = useState(r.promotionalCardUrl ?? '');
  const [launchPriceExp, setLaunchPriceExp] = useState('500000');
  const [remoteError, setRemoteError] = useState<string | null>(null);
  useEffect(() => {
    setDraft(r.draftPortraitUrl ?? '');
  }, [r.id, r.draftPortraitUrl]);
  useEffect(() => {
    setPromo(r.promotionalCardUrl ?? '');
  }, [r.id, r.promotionalCardUrl]);

  const canSavePhoto =
    (r.playerCreationStep === 'awaiting_photo' || r.playerCreationStep === 'photo_uploaded') &&
    (draft.trim().startsWith('data:image/') || /^https?:\/\//i.test(draft.trim()));
  const canSavePromo =
    promo.trim() === '' || promo.trim().startsWith('data:image/') || /^https?:\/\//i.test(promo.trim());

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
          {remoteError ? (
            <div className="mt-1 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-[11px] text-red-300">
              <span className="font-bold text-red-200">Supabase:</span> {remoteError}
            </div>
          ) : null}
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
          {r.selfieUrl ? (
            <div className="mt-2 rounded-lg border border-neon-yellow/30 bg-neon-yellow/5 p-2">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neon-yellow/90">
                  Selfie do manager (referência)
                </span>
                <a
                  href={r.selfieUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[9px] uppercase tracking-wider text-neon-yellow/70 underline hover:text-neon-yellow"
                >
                  Abrir original
                </a>
              </div>
              <img
                src={r.selfieUrl}
                alt="Selfie do manager"
                className="block max-h-48 w-auto rounded border border-white/15"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : null}
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
            <span className="text-[10px] font-bold uppercase text-gray-500">URL do retrato do jogo (data URL ou https)</span>
            <ImageDropzone
              kind="portrait"
              requestId={r.id}
              label="Arrasta ou clica — sobe arte do jogador (auto-guarda)"
              onUploaded={(url) => {
                setDraft(url);
                dispatch({ type: 'ADMIN_PLAYER_CREATION_SET_PHOTO', requestId: r.id, portraitUrl: url });
              }}
            />
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-white/15 bg-black/50 px-2 py-2 font-mono text-[10px] text-white outline-none focus:border-neon-yellow"
              placeholder="data:image/jpeg;base64,... ou https://..."
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-bold uppercase text-gray-500">
              URL do card promocional <span className="text-white/40">(opcional — versão social media pro manager compartilhar)</span>
            </span>
            <ImageDropzone
              kind="promo"
              requestId={r.id}
              label="Arrasta ou clica — sobe card promocional (auto-guarda)"
              onUploaded={(url) => {
                setPromo(url);
                dispatch({
                  type: 'ADMIN_PLAYER_CREATION_SET_PROMOTIONAL',
                  requestId: r.id,
                  promotionalCardUrl: url,
                });
              }}
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={promo}
                onChange={(e) => setPromo(e.target.value)}
                className="flex-1 rounded-lg border border-white/15 bg-black/50 px-2 py-2 font-mono text-[10px] text-white outline-none focus:border-neon-yellow"
                placeholder="https://... (pode ficar vazio)"
              />
              <button
                type="button"
                disabled={!canSavePromo || promo.trim() === (r.promotionalCardUrl ?? '')}
                onClick={() =>
                  dispatch({
                    type: 'ADMIN_PLAYER_CREATION_SET_PROMOTIONAL',
                    requestId: r.id,
                    promotionalCardUrl: promo.trim(),
                  })
                }
                className={cn(
                  'rounded-lg border border-fuchsia-500/40 px-3 py-1.5 text-[10px] font-bold uppercase text-fuchsia-200 hover:bg-fuchsia-500/10',
                  (!canSavePromo || promo.trim() === (r.promotionalCardUrl ?? '')) && 'pointer-events-none opacity-40',
                )}
              >
                Guardar promo
              </button>
            </div>
            {r.promotionalCardUrl ? (
              <a
                href={r.promotionalCardUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-[9px] uppercase tracking-wider text-fuchsia-300/70 underline hover:text-fuchsia-200"
              >
                Ver card promocional atual
              </a>
            ) : null}
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
            <label className="flex min-w-[140px] flex-col gap-0.5 text-[9px] font-bold uppercase text-white/45">
              Preço EXP (mercado)
              <input
                type="text"
                inputMode="numeric"
                value={launchPriceExp}
                onChange={(e) => setLaunchPriceExp(e.target.value)}
                disabled={r.playerCreationStep !== 'approved'}
                className="rounded border border-white/15 bg-black/50 px-2 py-1 font-mono text-[11px] text-white outline-none focus:border-neon-yellow disabled:opacity-40"
              />
            </label>
            <button
              type="button"
              disabled={r.playerCreationStep !== 'approved'}
              onClick={() => {
                const pe = Math.round(Number(launchPriceExp.replace(/\s/g, '') || '500000'));
                dispatch({ type: 'ADMIN_PLAYER_CREATION_LAUNCH', requestId: r.id, priceExp: pe });
                const s = getGameState();
                const row = (s.managerProspectArtQueue ?? []).find((x) => x.id === r.id);
                if (!row?.marketListingId || !row.marketListedAtIso || row.marketPriceExp == null) return;
                const launched = s.players[r.playerId];
                if (!launched) return;
                if (isSupabaseConfigured()) {
                  setRemoteError(null);
                  void registerAcademyManagerListing({
                    localClubId: s.club.id,
                    listingId: row.marketListingId,
                    gamePlayerId: r.playerId,
                    artRequestId: r.id,
                    priceExp: row.marketPriceExp,
                    listedAtIso: row.marketListedAtIso,
                    player: launched,
                  })
                    .then((res) => {
                      if (!res.ok) {
                        console.error('[academy_managers] registo remoto falhou:', res);
                        const msg =
                          (res as { error?: string } | undefined)?.error ?? 'erro desconhecido';
                        setRemoteError(`Registo remoto falhou: ${msg}`);
                      }
                    })
                    .catch((err) => {
                      console.error('[academy_managers] registo remoto erro:', err);
                      setRemoteError(
                        err instanceof Error ? err.message : 'Falha de rede ao registar no Supabase.',
                      );
                    });
                }
              }}
              className={cn(
                'rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-3 py-1.5 text-[10px] font-bold uppercase text-emerald-200 hover:bg-emerald-500/25',
                r.playerCreationStep !== 'approved' && 'pointer-events-none opacity-40',
              )}
            >
              Lançar + mercado
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-1 text-[11px] text-emerald-300/90">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Retrato aplicado; jogador listado no mercado EXP (save).
          </div>
          {r.marketListingId ? (
            <div className="font-mono text-[10px] text-white/50">
              listing: {r.marketListingId}
              {r.marketPriceExp != null ? ` · ${formatExp(r.marketPriceExp)}` : null}
            </div>
          ) : null}
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

  // ── Global art requests (todos os managers) ──
  const [globalRequests, setGlobalRequests] = useState<GlobalArtRequest[]>([]);
  const [globalLoading, setGlobalLoading] = useState(false);

  const loadGlobalRequests = useCallback(async () => {
    setGlobalLoading(true);
    try {
      const all = await fetchAllManagerArtRequests();
      setGlobalRequests(all);
    } finally {
      setGlobalLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGlobalRequests();
  }, [loadGlobalRequests]);

  const globalPending = useMemo(
    () => globalRequests.filter((g) => g.request.playerCreationStep !== 'launched'),
    [globalRequests],
  );
  const globalDone = useMemo(
    () => globalRequests.filter((g) => g.request.playerCreationStep === 'launched'),
    [globalRequests],
  );

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
            Academy players (Academia OLE)
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-white/55">
            Demandas geradas quando o manager cria um jogador na Academia: o atleta já existe no plantel com
            atributos; aqui tratas do retrato, validação e lançamento no mercado EXP + registo em Supabase (
            <span className="font-mono text-white/70">academy_managers</span>).
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-black/40 p-3">
          <Brush className="h-5 w-5 shrink-0 text-neon-yellow" aria-hidden />
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/70 md:grid-cols-2">
        <div>
          <p className="font-display text-[10px] font-black uppercase tracking-wide text-neon-yellow">
            Academy players (esta tab)
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-[11px] leading-relaxed">
            <li>Pedido automático após criar na Academia OLE.</li>
            <li>Origem + aparência já vão no prompt; tu colas a imagem, validas, aprovas e lanças no save.</li>
            <li>
              «Lançar + mercado» aplica o retrato, lista no mercado EXP (como anunciar plantel) e envia snapshot do
              motor para a tabela remota.
            </li>
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
            <Fragment key={r.id}>
              <ArtQueueRow r={r} pl={players[r.playerId]} />
            </Fragment>
          ))}
        </ul>
      )}

      {/* ── Pedidos GLOBAIS de todos os managers (Supabase) ── */}
      <div className="mt-8 border-t border-white/10 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-black uppercase tracking-tight text-cyan-300">
              Pedidos de TODOS os managers
            </h3>
            <p className="mt-1 text-xs text-white/50">
              Dados do Supabase (manager_game_state.manager_prospect_art_queue). Mostra jogadores criados por qualquer manager que aguardam foto.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadGlobalRequests()}
            disabled={globalLoading}
            className="flex items-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-bold uppercase text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', globalLoading && 'animate-spin')} />
            Atualizar
          </button>
        </div>

        <div className="mt-3 text-sm text-white/70">
          Pendentes: <span className="font-bold text-cyan-300">{globalPending.length}</span>
          {globalDone.length > 0 && (
            <span className="ml-2 text-white/40">· {globalDone.length} concluído(s)</span>
          )}
        </div>

        {globalPending.length === 0 && !globalLoading ? (
          <p className="mt-3 rounded-lg border border-white/10 bg-black/20 px-4 py-6 text-center text-sm text-white/45">
            Nenhum pedido pendente de outros managers.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {globalPending.map((g) => (
              <li
                key={`${g.userId}-${g.request.id}`}
                className="rounded-xl border border-cyan-500/20 bg-black/35 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-sm font-black text-white">
                        {g.request.playerName ?? g.request.playerId}
                      </span>
                      <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-cyan-300">
                        {stepLabel(g.request.playerCreationStep)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-white/50">
                      <span>Manager: <span className="font-mono text-white/70">{g.userId.slice(0, 8)}…</span></span>
                      <span>Criado: {new Date(g.request.createdAtIso).toLocaleDateString('pt-BR')}</span>
                      {g.request.selfieUrl && (
                        <a href={g.request.selfieUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">
                          Ver selfie
                        </a>
                      )}
                    </div>
                  </div>
                  {g.request.draftPortraitUrl && /^https?:\/\//i.test(g.request.draftPortraitUrl) && (
                    <img
                      src={g.request.draftPortraitUrl}
                      alt="Rascunho"
                      className="h-16 w-16 rounded-lg border border-white/10 object-cover"
                    />
                  )}
                </div>
                <pre className="mt-3 max-h-32 overflow-auto rounded-lg border border-white/10 bg-black/50 p-3 text-[10px] leading-relaxed text-white/60 whitespace-pre-wrap">
                  {g.request.adminArtPrompt}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
