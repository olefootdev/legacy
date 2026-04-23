import { useCallback, useState } from 'react';
import { Check, Link2, Loader2 } from 'lucide-react';
import { getSupabase } from '@/supabase/client';

type ManifestEntry = { id: string; card: string; token: string };

function parseManifestJson(raw: string): { ok: true; entries: ManifestEntry[] } | { ok: false; error: string } {
  let data: unknown;
  try {
    data = JSON.parse(raw) as unknown;
  } catch {
    return { ok: false, error: 'JSON inválido.' };
  }

  const entries: ManifestEntry[] = [];

  const push = (id: string, card: unknown, token: unknown) => {
    const idTrim = id.trim();
    if (!idTrim) return;
    if (typeof card !== 'string' || !card.trim()) return;
    if (typeof token !== 'string' || !token.trim()) return;
    const c = card.trim();
    const t = token.trim();
    try {
      const uc = new URL(c);
      const ut = new URL(t);
      if (uc.protocol !== 'http:' && uc.protocol !== 'https:') return;
      if (ut.protocol !== 'http:' && ut.protocol !== 'https:') return;
    } catch {
      return;
    }
    entries.push({ id: idTrim, card: c, token: t });
  };

  if (Array.isArray(data)) {
    for (const row of data) {
      if (!row || typeof row !== 'object') continue;
      const o = row as Record<string, unknown>;
      if (typeof o.id !== 'string') continue;
      push(o.id, o.card, o.token);
    }
  } else if (data && typeof data === 'object') {
    for (const [id, v] of Object.entries(data as Record<string, unknown>)) {
      if (!v || typeof v !== 'object') continue;
      const o = v as Record<string, unknown>;
      push(id, o.card, o.token);
    }
  } else {
    return { ok: false, error: 'O JSON tem de ser um array de objetos ou um objeto indexado por id.' };
  }

  if (!entries.length) {
    return {
      ok: false,
      error:
        'Nenhuma entrada válida. Cada item precisa de id, card e token (URLs http/https). Ex.: {"GEN-001":{"card":"https://…","token":"https://…"}}',
    };
  }

  return { ok: true, entries };
}

export function GenesisPinataManualUrlsBlock({ onApplied }: { onApplied: () => void }) {
  const [jsonDraft, setJsonDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [okCount, setOkCount] = useState<number | null>(null);

  const apply = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) {
      setMsg('Supabase não configurado.');
      setOkCount(null);
      return;
    }
    const parsed = parseManifestJson(jsonDraft);
    if (parsed.ok === false) {
      setMsg(parsed.error);
      setOkCount(null);
      return;
    }
    setBusy(true);
    setMsg(null);
    setOkCount(null);
    const nowIso = new Date().toISOString();
    let ok = 0;
    const errors: string[] = [];
    try {
      for (const e of parsed.entries) {
        const refs = {
          provider: 'pinata',
          source: 'manual_gateway_urls',
          recordedAt: nowIso,
          cardPublicUrl: e.card,
          tokenPublicUrl: e.token,
        };
        const { error } = await sb
          .from('genesis_market_players')
          .update({
            portrait_public_url: e.card,
            portrait_token_public_url: e.token,
            portrait_storage_path: null,
            portrait_media_refs: refs as unknown as Record<string, unknown>,
            updated_at: nowIso,
          })
          .eq('id', e.id);
        if (error) errors.push(`${e.id}: ${error.message}`);
        else ok++;
      }
      setOkCount(ok);
      if (errors.length) {
        setMsg(`${errors.length} falha(s). ${errors.slice(0, 5).join(' · ')}${errors.length > 5 ? '…' : ''}`);
      } else {
        setMsg(
          'Feito. As URLs ficam só na base; apaga os ficheiros antigos no Supabase Storage (bucket genesis-player-portraits) quando confirmares que o Pinata serve bem.',
        );
      }
      onApplied();
    } finally {
      setBusy(false);
    }
  }, [jsonDraft, onApplied]);

  return (
    <details className="mb-6 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <summary className="cursor-pointer list-none font-display text-sm font-bold text-white/90 [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          <Link2 className="h-4 w-4 text-cyan-300/90" />
          URLs já no Pinata (pasta hospedada manualmente)
        </span>
      </summary>
      <p className="mt-2 text-xs leading-relaxed text-white/45">
        Depois de subires os ficheiros no Pinata (ou gateway), cola aqui um JSON com URL pública do card e do token por
        jogador. Isto grava em <code className="text-neon-yellow/80">portrait_public_url</code> e{' '}
        <code className="text-neon-yellow/80">portrait_token_public_url</code>, limpa{' '}
        <code className="text-neon-yellow/80">portrait_storage_path</code> e regista metadados mínimos em{' '}
        <code className="text-neon-yellow/80">portrait_media_refs</code>. Podes apagar os blobs no Storage do Supabase
        quando validares as imagens.
      </p>
      <pre className="mt-2 overflow-x-auto rounded-lg bg-black/50 p-2 text-[10px] leading-snug text-white/55">
        {`{
  "GEN-001": { "card": "https://…/card.webp", "token": "https://…/token.webp" },
  "GEN-002": { "card": "https://…", "token": "https://…" }
}`}
      </pre>
      <textarea
        value={jsonDraft}
        onChange={(e) => setJsonDraft(e.target.value)}
        rows={8}
        placeholder='Cole o JSON aqui (object ou array com id, card, token).'
        className="mt-2 w-full resize-y rounded-lg border border-white/15 bg-black/40 px-3 py-2 font-mono text-[11px] text-white/90 placeholder:text-white/25"
        spellCheck={false}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || !jsonDraft.trim()}
          onClick={() => void apply()}
          className="rounded-lg bg-cyan-600/80 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-600 disabled:opacity-40"
        >
          {busy ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> A aplicar…
            </span>
          ) : (
            'Aplicar URLs no Supabase'
          )}
        </button>
        {okCount !== null && !busy ? (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
            <Check className="h-3.5 w-3.5" /> {okCount} linha(s) atualizada(s)
          </span>
        ) : null}
      </div>
      {msg ? <p className="mt-2 text-xs text-white/55">{msg}</p> : null}
    </details>
  );
}
