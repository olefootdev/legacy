import { useCallback, useState } from 'react';
import { FolderOpen, Loader2, Wrench } from 'lucide-react';
import { getSupabase } from '@/supabase/client';
import type { GenesisMarketPlayerRow } from '@/supabase/genesisMarket';
import {
  DEFAULT_PINATA_IPFS_GATEWAY,
  normalizeIpfsGatewayBase,
  pinataFolderMediaRefs,
  portraitUrlsUnderFolderCid,
  repairPinataPortraitFromCardUrl,
} from '@/lib/genesisPinataFolderUrls';

type Props = {
  players: GenesisMarketPlayerRow[];
  onApplied: () => void;
};

export function GenesisPinataFolderCidBlock({ players, onApplied }: Props) {
  const [folderCid, setFolderCid] = useState('');
  const [gateway, setGateway] = useState(DEFAULT_PINATA_IPFS_GATEWAY);
  const [ext, setExt] = useState('webp');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [repairBusy, setRepairBusy] = useState(false);
  const [repairMsg, setRepairMsg] = useState<string | null>(null);
  const [repairDone, setRepairDone] = useState<number | null>(null);

  const playerIds = players.map((p) => p.id);

  const repairFromExistingCardUrls = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) {
      setRepairMsg('Supabase não configurado.');
      return;
    }
    setRepairBusy(true);
    setRepairMsg(null);
    setRepairDone(null);
    const nowIso = new Date().toISOString();
    let ok = 0;
    const errs: string[] = [];
    try {
      for (const p of players) {
        const card = p.portrait_public_url?.trim();
        if (!card) continue;
        const missingToken = !p.portrait_token_public_url?.trim();
        const missingRefs = p.portrait_media_refs == null;
        if (!missingToken && !missingRefs) continue;
        const r = repairPinataPortraitFromCardUrl(card);
        if (!r) {
          errs.push(`${p.id}: URL do card sem "-card." (não dá para derivar token).`);
          continue;
        }
        const { error } = await sb
          .from('genesis_market_players')
          .update({
            portrait_token_public_url: r.tokenUrl,
            portrait_media_refs: r.mediaRefs as unknown as Record<string, unknown>,
            updated_at: nowIso,
          })
          .eq('id', p.id);
        if (error) errs.push(`${p.id}: ${error.message}`);
        else ok++;
      }
      setRepairDone(ok);
      setRepairMsg(
        errs.length
          ? `${errs.length} aviso(s)/erro(s). ${errs.slice(0, 3).join(' · ')}${errs.length > 3 ? '…' : ''}`
          : ok
            ? `Reparadas ${ok} linha(s): token + portrait_media_refs a partir do URL do card.`
            : 'Nenhuma linha precisava de reparação (já tinham token e refs, ou falta portrait_public_url).',
      );
      onApplied();
    } finally {
      setRepairBusy(false);
    }
  }, [players, onApplied]);

  const apply = useCallback(async () => {
    const cid = folderCid.trim();
    if (!cid) {
      setMsg('Cola o CID da pasta (ex.: bafybei…).');
      setDone(null);
      return;
    }
    const sb = getSupabase();
    if (!sb) {
      setMsg('Supabase não configurado.');
      return;
    }
    if (!playerIds.length) {
      setMsg('Sem jogadores Genesis na lista.');
      return;
    }

    setBusy(true);
    setMsg(null);
    setDone(null);
    const gw = normalizeIpfsGatewayBase(gateway);
    const nowIso = new Date().toISOString();
    let ok = 0;
    const errs: string[] = [];

    try {
      for (const id of playerIds) {
        const { cardUrl, tokenUrl } = portraitUrlsUnderFolderCid({
          folderCid: cid,
          playerId: id,
          ext,
          gatewayBase: gw,
        });
        const refs = pinataFolderMediaRefs({
          folderCid: cid,
          playerId: id,
          ext,
          gatewayBase: gw,
          cardUrl,
          tokenUrl,
        });
        const { error } = await sb
          .from('genesis_market_players')
          .update({
            portrait_public_url: cardUrl,
            portrait_token_public_url: tokenUrl,
            portrait_storage_path: null,
            portrait_media_refs: refs,
            updated_at: nowIso,
          })
          .eq('id', id);
        if (error) errs.push(`${id}: ${error.message}`);
        else ok++;
      }
      setDone(ok);
      setMsg(
        errs.length
          ? `${errs.length} erro(s). ${errs.slice(0, 4).join(' · ')}${errs.length > 4 ? '…' : ''}`
          : `Atualizados ${ok} jogadores. Ficheiros na pasta: GEN-001-card.${ext}, GEN-001-token.${ext}, … por id.`,
      );
      onApplied();
    } finally {
      setBusy(false);
    }
  }, [folderCid, gateway, ext, playerIds, onApplied]);

  const sampleId = playerIds[0] ?? 'GEN-001';
  const needsRepairCount = players.filter((p) => {
    const card = p.portrait_public_url?.trim();
    if (!card) return false;
    return !p.portrait_token_public_url?.trim() || p.portrait_media_refs == null;
  }).length;
  const sample = portraitUrlsUnderFolderCid({
    folderCid: folderCid.trim() || 'SEU_CID_AQUI',
    playerId: sampleId,
    ext,
    gatewayBase: normalizeIpfsGatewayBase(gateway),
  });

  return (
    <details className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3">
      <summary className="cursor-pointer list-none font-display text-sm font-bold text-amber-100/95 [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-amber-300/90" />
          Pasta já no Pinata (só CID + Supabase)
        </span>
      </summary>
      <p className="mt-2 text-xs leading-relaxed text-white/50">
        Se subiste uma pasta no Pinata com ficheiros <code className="text-amber-200/90">GEN-001-card.webp</code> e{' '}
        <code className="text-amber-200/90">GEN-001-token.webp</code> (etc.), cola o CID da pasta (root do upload).
        O Admin grava no Supabase as URLs{' '}
        <code className="break-all text-[10px] text-white/45">{gateway}/&lt;CID&gt;/GEN-001-card.{ext}</code> — não
        volta a fazer upload; só associa o que já está no IPFS.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-[10px] font-bold uppercase text-white/35">
          CID da pasta
          <input
            value={folderCid}
            onChange={(e) => setFolderCid(e.target.value.trim())}
            placeholder="bafybei…"
            className="rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 font-mono text-xs text-white/90"
          />
        </label>
        <label className="flex min-w-[12rem] flex-1 flex-col gap-0.5 text-[10px] font-bold uppercase text-white/35">
          Gateway (base /ipfs)
          <input
            value={gateway}
            onChange={(e) => setGateway(e.target.value)}
            placeholder={DEFAULT_PINATA_IPFS_GATEWAY}
            className="rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 font-mono text-[11px] text-white/90"
          />
        </label>
        <label className="flex w-24 flex-col gap-0.5 text-[10px] font-bold uppercase text-white/35">
          Ext.
          <select
            value={ext}
            onChange={(e) => setExt(e.target.value)}
            className="rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-xs text-white/90"
          >
            <option value="webp">webp</option>
            <option value="png">png</option>
            <option value="jpg">jpg</option>
          </select>
        </label>
      </div>
      <p className="mt-2 break-all font-mono text-[10px] text-white/40">
        Exemplo ({sampleId}): {sample.cardUrl}
      </p>
      <button
        type="button"
        disabled={busy || !folderCid.trim()}
        onClick={() => void apply()}
        className="mt-3 rounded-lg bg-amber-600/85 px-4 py-2 text-xs font-bold text-black hover:bg-amber-500 disabled:opacity-40"
      >
        {busy ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> A gravar no Supabase…
          </span>
        ) : (
          'Ligar pasta ao Supabase (todos os jogadores da lista)'
        )}
      </button>
      {done !== null && !busy ? (
        <p className="mt-2 text-xs font-bold text-emerald-400">{done} linha(s) atualizada(s).</p>
      ) : null}
      {msg ? <p className="mt-1 text-xs text-white/55">{msg}</p> : null}

      <div className="mt-5 border-t border-white/10 pt-4">
        <p className="text-xs font-bold text-amber-200/90">Só tens URL do card no Supabase?</p>
        <p className="mt-1 text-[11px] leading-relaxed text-white/45">
          Se <code className="text-amber-200/80">portrait_public_url</code> já aponta para um ficheiro{' '}
          <code className="text-amber-200/80">…-card.webp</code> no Pinata e apagaste o Storage, preenche automaticamente{' '}
          <code className="text-amber-200/80">portrait_token_public_url</code> (…-token…) e{' '}
          <code className="text-amber-200/80">portrait_media_refs</code>.
          {needsRepairCount > 0 ? (
            <span className="text-white/55"> Agora: {needsRepairCount} jogador(es) nesta situação.</span>
          ) : null}
        </p>
        <button
          type="button"
          disabled={repairBusy || !players.length}
          onClick={() => void repairFromExistingCardUrls()}
          className="mt-2 inline-flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-100 hover:bg-amber-500/20 disabled:opacity-40"
        >
          {repairBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}
          Reparar token + refs a partir do URL do card
        </button>
        {repairDone !== null && !repairBusy ? (
          <p className="mt-2 text-xs font-bold text-emerald-400">{repairDone} linha(s) reparada(s).</p>
        ) : null}
        {repairMsg ? <p className="mt-1 text-xs text-white/55">{repairMsg}</p> : null}
      </div>
    </details>
  );
}
