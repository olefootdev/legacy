import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Users, Copy, CheckCircle, Link2, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGameDispatch, useGameStore } from '@/game/store';
import { NavBalanceStrip } from '@/components/NavBalanceStrip';
import { referralSummary } from '@/wallet/referral';
import { queryLedger } from '@/wallet/ledger';
import { createInitialWalletState } from '@/wallet/initial';

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
  const wallet = finance.wallet ?? createInitialWalletState();

  const [sponsorInput, setSponsorInput] = useState('');
  const [copied, setCopied] = useState(false);

  const summary = referralSummary(wallet);
  const myCode = 'OLEFOOT-USER-SELF';

  const oleEntries = queryLedger(wallet, { type: 'REFERRAL_OLE_GAME' });
  const nftEntries = queryLedger(wallet, { type: 'REFERRAL_NFT' });

  function handleSetSponsor() {
    if (!sponsorInput.trim()) return;
    dispatch({ type: 'WALLET_SET_SPONSOR', sponsorId: sponsorInput.trim() });
    setSponsorInput('');
  }

  function handleCopy() {
    navigator.clipboard.writeText(myCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-8">
      <button
        type="button"
        onClick={() => navigate('/wallet')}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-2"
      >
        <ArrowLeft className="w-4 h-4" /> Carteira
      </button>

      <NavBalanceStrip />

      <div className="flex items-center gap-3 mb-2">
        <Users className="w-6 h-6 text-blue-400" />
        <h2 className="text-2xl font-bold text-white">Indicações</h2>
      </div>
      <p className="text-sm text-gray-400">
        Receba 5% de comissão por indicação, em até 3 níveis da sua rede, sobre compras de NFTs (Itens, Jogadores, Packs) realizadas com BRO.
      </p>

      {/* My referral code */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel p-5 border border-blue-400/20"
      >
        <p className="text-xs text-gray-400 mb-2">Seu código de indicação</p>
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm">
            {myCode}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="bg-blue-500/10 border border-blue-400/30 text-blue-300 py-3 px-4 rounded-xl hover:bg-blue-500/20 transition-colors"
          >
            {copied ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>
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
            <span>Insira o código do seu patrocinador</span>
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              value={sponsorInput}
              onChange={(e) => setSponsorInput(e.target.value)}
              placeholder="Código do patrocinador"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:border-blue-400 focus:outline-none transition-colors text-sm"
            />
            <button
              type="button"
              onClick={handleSetSponsor}
              disabled={!sponsorInput.trim()}
              className="bg-blue-500 hover:bg-blue-400 disabled:bg-white/5 disabled:text-gray-600 text-white py-3 px-6 rounded-xl font-bold text-sm transition-colors"
            >
              Vincular
            </button>
          </div>
        </motion.div>
      )}

      {wallet.sponsorId && (
        <div className="bg-white/5 rounded-xl p-3 text-xs text-gray-400 flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-blue-300" />
          Patrocinador: <span className="text-white font-medium">{wallet.sponsorId}</span>
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
            const earn = summary.byLevel[level] ?? 0;
            return (
              <div
                key={level}
                className="bg-white/5 rounded-xl p-4 text-center border border-white/5"
              >
                <div className="text-xs text-gray-400 mb-1">Nível {level}</div>
                <div className="text-lg font-bold text-white">{level === 1 ? count : '—'}</div>
                <div className="text-[10px] text-blue-300 mt-1">
                  +{(earn / 100).toFixed(2)} BRO
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-sm pt-3 border-t border-white/5">
          <span className="text-gray-400">Indicados diretos</span>
          <span className="text-white font-bold">{summary.directReferrals}</span>
        </div>
      </motion.div>

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
    </div>
  );
}
