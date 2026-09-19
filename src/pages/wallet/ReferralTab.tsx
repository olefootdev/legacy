import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Users, Copy, CheckCircle, Link2, User, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/game/store';

import { referralSummary } from '@/wallet/referral';
import { queryLedger } from '@/wallet/ledger';
import { normalizeWalletState } from '@/wallet/initial';
import { inviteLinkForCode } from '@/wallet/referralCode';
import { fetchMyReferralCode, fetchMyReferrals, type ReferredProfile } from '@/supabase/referrals';

function formatRelative(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso.slice(0, 16);
  }
}

function formatLedgerDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  } catch {
    return iso.slice(0, 10);
  }
}

export function ReferralTab() {
  const navigate = useNavigate();
  const finance = useGameStore((s) => s.finance);
  const wallet = useMemo(
    () => normalizeWalletState(finance.wallet ?? undefined),
    [finance.wallet],
  );

  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const summary = referralSummary(wallet);
  // Servidor é autoritativo. Cache local (wallet.myReferralCode) usado só
  // como fallback enquanto o fetch não retornou.
  const [serverCode, setServerCode] = useState<string | null>(null);
  const [referrals, setReferrals] = useState<ReferredProfile[]>([]);
  const [loadingReferrals, setLoadingReferrals] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [code, list] = await Promise.all([fetchMyReferralCode(), fetchMyReferrals()]);
      if (cancelled) return;
      setServerCode(code);
      setReferrals(list);
      setLoadingReferrals(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const myCode = serverCode ?? wallet.myReferralCode ?? '';
  const shareUrl = myCode ? inviteLinkForCode(myCode) : '';

  const oleEntries = queryLedger(wallet, { type: 'REFERRAL_OLE_GAME' });
  const nftEntries = queryLedger(wallet, { type: 'REFERRAL_NFT' });
  const transferOut = queryLedger(wallet, { type: 'TRANSFER' }).filter(
    (e) => e.amount < 0 && e.source === 'peer_by_referral_code',
  );

  function handleCopyCode() {
    if (!myCode) return;
    navigator.clipboard.writeText(myCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCopyLink() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).catch(() => {});
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  return (
    <div className="mx-auto min-w-0 max-w-3xl space-y-6 pb-8">

      <button
        type="button"
        onClick={() => navigate('/wallet')}
        className="flex items-center gap-2 text-sm text-cimento hover:text-white transition-colors mb-2"
      >
        <ArrowLeft className="w-4 h-4" /> Carteira
      </button>

      <div className="flex items-center gap-3 mb-2">
        <Users className="w-6 h-6 text-white" />
        <h2 className="font-impact uppercase text-white" style={{ fontSize: '26px' }}>Indicações</h2>
      </div>
      <p className="text-sm text-cimento">
        Indique amigos e ganhe <span className="text-white">5% em BRO</span> sobre compras elegíveis (OLE Game / NFT), até 3 níveis.{' '}
Ao atingir cada degrau de indicados ativos, a rede paga <span className="text-white">marcos em EXP</span>.
      </p>

      {/* My referral code */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="ole-poster p-5 space-y-3"
      >
        <p className="text-xs text-cimento mb-2">Seu código de indicação (não muda)</p>
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-deep-black border border-white/16 px-4 py-3 text-white font-mono text-sm tracking-wider">
            {myCode || '—'}
          </div>
          <button
            type="button"
            onClick={handleCopyCode}
            disabled={!myCode}
            className="border border-white/30 text-white py-3 px-4 hover:border-white transition-colors disabled:opacity-30"
          >
            {copied ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>
        {shareUrl ? (
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between pt-1 border-t border-white/5">
            <p className="text-[10px] text-poeira break-all font-mono">{shareUrl}</p>
            <button
              type="button"
              onClick={handleCopyLink}
              className="ole-num shrink-0 text-[12px] uppercase text-neon-yellow hover:text-white flex items-center gap-1"
            >
              <Link2 className="w-3.5 h-3.5" />
              {copiedLink ? 'Copiado' : 'Copiar link'}
            </button>
          </div>
        ) : null}
      </motion.div>

      {/*
        Vínculo manual de patrocinador removido: o patrocinador real é gravado
        só no signup (profiles.referred_by_code, imutável). O WALLET_SET_SPONSOR
        era local/mock e nunca chegava ao servidor, então prometia comissão que
        não fluía. O display abaixo permanece para quem já tinha um vínculo local.
      */}
      {wallet.sponsorId && (
        <div className="border border-white/10 bg-panel p-3 text-xs text-cimento flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-cimento" />
          Patrocinador (fixo):{' '}
          <span className="text-white font-mono font-medium">{wallet.sponsorId}</span>
        </div>
      )}

      {/* Indicados diretos — servidor autoritativo */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel border border-white/10 bg-panel p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold flex items-center gap-2">
            <Trophy className="w-4 h-4 text-cimento" />
            Seus indicados
          </h3>
          <span className="ole-num text-2xl text-white tabular-nums">
            {loadingReferrals ? '…' : referrals.length}
          </span>
        </div>

        {loadingReferrals ? (
          <p className="text-xs text-poeira">Carregando sua rede…</p>
        ) : referrals.length === 0 ? (
          <p className="text-xs text-poeira">
            Ninguém entrou com seu código ainda. Compartilhe o link acima.
          </p>
        ) : (
          <div className="space-y-1.5">
            {referrals.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 px-3 py-2 bg-card border border-white/10"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-white font-medium truncate">
                    {r.displayName ?? r.clubName ?? 'Manager'}
                  </div>
                  <div className="text-[10px] text-poeira flex items-center gap-2">
                    {r.clubShort && (
                      <span className="font-mono uppercase tracking-widest">{r.clubShort}</span>
                    )}
                    {r.clubShort && <span>•</span>}
                    <span>{formatRelative(r.createdAt)}</span>
                  </div>
                </div>
                <div className="shrink-0 font-mono text-[10px] text-cimento uppercase tracking-wider">
                  Nível 1
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Comissões acumuladas por nível (carteira local) */}
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/5">
          {[1, 2, 3].map((level) => {
            const broEarn = summary.byLevelBroCents[level] ?? 0;
            return (
              <div
                key={level}
                className="bg-card p-3 text-center border border-white/10"
              >
                <div className="text-[10px] text-cimento mb-0.5 uppercase tracking-wider">Nv. {level}</div>
                <div className="font-mono text-[10.5px] text-white tabular-nums">
                  +{(broEarn / 100).toFixed(2)} BRO
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Peer transfers out */}
      {transferOut.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-bold flex items-center gap-2 text-sm">
            <span className="w-2 h-2 bg-cimento inline-block" />
            Envios BRO por código
          </h3>
          <div className="space-y-2">
            {transferOut.slice(0, 10).map((e) => (
              <div key={e.id} className="flex justify-between items-center p-3 border border-white/10 bg-panel text-sm">
                <div>
                  <div className="text-giz font-mono text-xs">
                    → {(e.metadata?.recipientReferralCode as string) ?? '—'}
                  </div>
                  <div className="text-[10px] text-poeira">{formatLedgerDate(e.createdAt)}</div>
                </div>
                <div className="font-mono font-medium tabular-nums text-baixa">{(e.amount / 100).toFixed(2)} BRO</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* OLE Game commissions */}
      <div className="space-y-3">
        <h3 className="font-bold flex items-center gap-2 text-sm">
          <span className="w-2 h-2 bg-cimento inline-block" />
          Comissões OLE Game
        </h3>
        {oleEntries.length === 0 ? (
          <p className="text-xs text-poeira">Nenhuma comissão OLE Game registrada.</p>
        ) : (
          <div className="space-y-2">
            {oleEntries.slice(0, 10).map((e) => (
              <div key={e.id} className="flex justify-between items-center p-3 border border-white/10 bg-panel text-sm">
                <div>
                  <div className="text-giz">{e.source}</div>
                  <div className="text-[10px] text-poeira">{formatLedgerDate(e.createdAt)}</div>
                </div>
                <div className="font-mono font-medium tabular-nums text-alta">+{(e.amount / 100).toFixed(2)} BRO</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* NFT commissions */}
      <div className="space-y-3">
        <h3 className="font-bold flex items-center gap-2 text-sm">
          <span className="w-2 h-2 bg-cimento inline-block" />
          Comissões NFT
        </h3>
        {nftEntries.length === 0 ? (
          <p className="text-xs text-poeira">Nenhuma comissão NFT registrada.</p>
        ) : (
          <div className="space-y-2">
            {nftEntries.slice(0, 10).map((e) => (
              <div key={e.id} className="flex justify-between items-center p-3 border border-white/10 bg-panel text-sm">
                <div>
                  <div className="text-giz">{e.source}</div>
                  <div className="text-[10px] text-poeira">{formatLedgerDate(e.createdAt)}</div>
                </div>
                <div className="font-mono font-medium tabular-nums text-alta">+{(e.amount / 100).toFixed(2)} BRO</div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
