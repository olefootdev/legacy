import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Users, Copy, CheckCircle, Link2, User, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGameDispatch, useGameStore } from '@/game/store';

import { referralSummary } from '@/wallet/referral';
import { queryLedger } from '@/wallet/ledger';
import { normalizeWalletState } from '@/wallet/initial';
import { inviteLinkForCode, normalizeReferralCode } from '@/wallet/referralCode';
import { PeerBroSendModal } from './PeerBroSendModal';

function formatLedgerDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  } catch {
    return iso.slice(0, 10);
  }
}

export function ReferralTab() {
  const navigate = useNavigate();
  const dispatch = useGameDispatch();
  const finance = useGameStore((s) => s.finance);
  const wallet = useMemo(
    () => normalizeWalletState(finance.wallet ?? undefined),
    [finance.wallet],
  );

  const [sponsorInput, setSponsorInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [sponsorError, setSponsorError] = useState<string | null>(null);
  const [peerOpen, setPeerOpen] = useState(false);

  const summary = referralSummary(wallet);
  const myCode = wallet.myReferralCode ?? '';
  const shareUrl = myCode ? inviteLinkForCode(myCode) : '';

  const oleEntries = queryLedger(wallet, { type: 'REFERRAL_OLE_GAME' });
  const nftEntries = queryLedger(wallet, { type: 'REFERRAL_NFT' });
  const gatRefEntries = queryLedger(wallet, { type: 'REFERRAL_GAT_EXP' }).filter((e) => {
    const my = wallet.myReferralCode ? normalizeReferralCode(wallet.myReferralCode) : null;
    const uid = normalizeReferralCode(e.userId) || e.userId;
    return my && uid === my;
  });
  const transferOut = queryLedger(wallet, { type: 'TRANSFER' }).filter(
    (e) => e.amount < 0 && e.source === 'peer_by_referral_code',
  );

  function handleSetSponsor() {
    setSponsorError(null);
    const norm = normalizeReferralCode(sponsorInput);
    if (!norm) {
      setSponsorError('Código inválido: usa 3 a 5 letras ou números (sem caracteres especiais).');
      return;
    }
    dispatch({ type: 'WALLET_SET_SPONSOR', sponsorId: norm });
    setSponsorInput('');
  }

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
      <PeerBroSendModal open={peerOpen} onClose={() => setPeerOpen(false)} myReferralCode={wallet.myReferralCode} />

      <button
        type="button"
        onClick={() => navigate('/wallet')}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-2"
      >
        <ArrowLeft className="w-4 h-4" /> Carteira
      </button>

      <div className="flex items-center gap-3 mb-2">
        <Users className="w-6 h-6 text-blue-400" />
        <h2 className="text-2xl font-bold text-white">Indicações</h2>
      </div>
      <p className="text-sm text-gray-400">
        Indique amigos e ganhe <span className="text-white">5% em BRO</span> sobre compras elegíveis (OLE Game / NFT), até 3 níveis. Além disso, sobre o{' '}
        <span className="text-white">Game Assets Treasury</span> da rede:{' '}
        <span className="text-violet-200">1% da base em BRO por nível em EXP</span> por dia (automático quando a rede está ligada ao teu código).
      </p>

      {/* My referral code */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel p-5 border border-blue-400/20 space-y-3"
      >
        <p className="text-xs text-gray-400 mb-2">O teu código de indicação (não muda)</p>
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm tracking-wider">
            {myCode || '—'}
          </div>
          <button
            type="button"
            onClick={handleCopyCode}
            disabled={!myCode}
            className="bg-blue-500/10 border border-blue-400/30 text-blue-300 py-3 px-4 rounded-xl hover:bg-blue-500/20 transition-colors disabled:opacity-30"
          >
            {copied ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>
        {shareUrl ? (
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between pt-1 border-t border-white/5">
            <p className="text-[10px] text-gray-500 break-all font-mono">{shareUrl}</p>
            <button
              type="button"
              onClick={handleCopyLink}
              className="shrink-0 text-xs font-bold uppercase tracking-wide text-blue-300 hover:text-white flex items-center gap-1"
            >
              <Link2 className="w-3.5 h-3.5" />
              {copiedLink ? 'Copiado' : 'Copiar link'}
            </button>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setPeerOpen(true)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-2.5 px-4 text-sm font-medium text-white hover:bg-white/10 transition-colors"
        >
          <Send className="w-4 h-4 text-neon-yellow" />
          Enviar BRO para um código OLEFOOT
        </button>
      </motion.div>

      {/* Set sponsor */}
      {!wallet.sponsorId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-panel p-5 border border-blue-400/10 space-y-3"
        >
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Link2 className="w-4 h-4" />
            <span>Vincular o código do teu patrocinador (uma vez, não podes mudar depois)</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={sponsorInput}
              onChange={(e) => {
                setSponsorInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5));
                setSponsorError(null);
              }}
              placeholder="Código (3–5 caracteres)"
              maxLength={5}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:border-blue-400 focus:outline-none transition-colors text-sm font-mono"
            />
            <button
              type="button"
              onClick={handleSetSponsor}
              disabled={sponsorInput.trim().length < 3}
              className="bg-blue-500 hover:bg-blue-400 disabled:bg-white/5 disabled:text-gray-600 text-white py-3 px-6 rounded-xl font-bold text-sm transition-colors"
            >
              Vincular
            </button>
          </div>
          {sponsorError && <p className="text-xs text-red-400">{sponsorError}</p>}
        </motion.div>
      )}

      {wallet.sponsorId && (
        <div className="bg-white/5 rounded-xl p-3 text-xs text-gray-400 flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-blue-300" />
          Patrocinador (fixo):{' '}
          <span className="text-white font-mono font-medium">{wallet.sponsorId}</span>
        </div>
      )}

      {/* Summary tree */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel p-5 space-y-4"
      >
        <h3 className="font-bold">Rede — 3 Níveis</h3>
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((level) => {
            const count = wallet.referralTree.filter((n) => {
              if (level === 1) return n.sponsorId === 'self';
              return false;
            }).length;
            const broEarn = summary.byLevelBroCents[level] ?? 0;
            const gatExp = summary.gatByLevelExp[level] ?? 0;
            return (
              <div
                key={level}
                className="bg-white/5 rounded-xl p-4 text-center border border-white/5"
              >
                <div className="text-xs text-gray-400 mb-1">Nível {level}</div>
                <div className="text-lg font-bold text-white">{level === 1 ? count : '—'}</div>
                <div className="text-[10px] text-blue-300 mt-1">
                  +{(broEarn / 100).toFixed(2)} BRO
                </div>
                {gatExp > 0 ? (
                  <div className="text-[10px] text-violet-300 mt-0.5">+{gatExp.toLocaleString('pt-BR')} EXP GAT</div>
                ) : (
                  <div className="text-[10px] text-gray-600 mt-0.5">GAT: —</div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-sm pt-3 border-t border-white/5">
          <span className="text-gray-400">Indicados diretos</span>
          <span className="text-white font-bold">{summary.directReferrals}</span>
        </div>
      </motion.div>

      {/* Peer transfers out */}
      {transferOut.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-bold flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-neon-yellow inline-block" />
            Envios BRO por código
          </h3>
          <div className="space-y-2">
            {transferOut.slice(0, 10).map((e) => (
              <div key={e.id} className="flex justify-between items-center p-3 rounded-lg bg-white/5 text-sm">
                <div>
                  <div className="text-gray-300 font-mono text-xs">
                    → {(e.metadata?.recipientReferralCode as string) ?? '—'}
                  </div>
                  <div className="text-[10px] text-gray-500">{formatLedgerDate(e.createdAt)}</div>
                </div>
                <div className="font-bold text-red-300">{(e.amount / 100).toFixed(2)} BRO</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* OLE Game commissions */}
      <div className="space-y-3">
        <h3 className="font-bold flex items-center gap-2 text-sm">
          <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
          Comissões OLE Game
        </h3>
        {oleEntries.length === 0 ? (
          <p className="text-xs text-gray-500">Nenhuma comissão OLE Game registrada.</p>
        ) : (
          <div className="space-y-2">
            {oleEntries.slice(0, 10).map((e) => (
              <div key={e.id} className="flex justify-between items-center p-3 rounded-lg bg-white/5 text-sm">
                <div>
                  <div className="text-gray-300">{e.source}</div>
                  <div className="text-[10px] text-gray-500">{formatLedgerDate(e.createdAt)}</div>
                </div>
                <div className="font-bold text-neon-green">+{(e.amount / 100).toFixed(2)} BRO</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* NFT commissions */}
      <div className="space-y-3">
        <h3 className="font-bold flex items-center gap-2 text-sm">
          <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
          Comissões NFT
        </h3>
        {nftEntries.length === 0 ? (
          <p className="text-xs text-gray-500">Nenhuma comissão NFT registrada.</p>
        ) : (
          <div className="space-y-2">
            {nftEntries.slice(0, 10).map((e) => (
              <div key={e.id} className="flex justify-between items-center p-3 rounded-lg bg-white/5 text-sm">
                <div>
                  <div className="text-gray-300">{e.source}</div>
                  <div className="text-[10px] text-gray-500">{formatLedgerDate(e.createdAt)}</div>
                </div>
                <div className="font-bold text-purple-300">+{(e.amount / 100).toFixed(2)} BRO</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* GAT referral EXP */}
      <div className="space-y-3">
        <h3 className="font-bold flex items-center gap-2 text-sm">
          <span className="w-2 h-2 rounded-full bg-violet-400 inline-block" />
          Referral GAT (EXP)
        </h3>
        {gatRefEntries.length === 0 ? (
          <p className="text-xs text-gray-500">
            Sem créditos GAT no teu código ainda. Quando um indicado na tua rede tiver treasury ativo, 1% da base (por
            nível) credita em EXP no teu saldo.
          </p>
        ) : (
          <div className="space-y-2">
            {gatRefEntries.slice(-10).reverse().map((e) => (
              <div key={e.id} className="flex justify-between items-center p-3 rounded-lg bg-white/5 text-sm">
                <div>
                  <div className="text-gray-300">{e.source}</div>
                  <div className="text-[10px] text-gray-500">{formatLedgerDate(e.createdAt)}</div>
                </div>
                <div className="font-bold text-violet-300">+{e.amount.toLocaleString('pt-BR')} EXP</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
