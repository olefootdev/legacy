/**
 * Painel de configuração de segurança do Admin.
 * Gerencia 2FA, IP whitelist e notificações.
 */

import { useState, useEffect } from 'react';
import { Shield, Key, Globe, Bell, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { useAdmin2FA } from '@/admin/useAdmin2FA';
import { loadAdminPanelSession } from '@/supabase/adminPanelAuth';
import { getSupabase } from '@/supabase/client';
import { cn } from '@/lib/utils';

export function AdminSecurityPanel() {
  const [adminEmail, setAdminEmail] = useState('');

  const { isEnabled: is2FAEnabled, isLoading, error, enable2FA, disable2FA } = useAdmin2FA(adminEmail);

  const [setup2FA, setSetup2FA] = useState<{ secret: string; backupCodes: string[]; qrCodeUrl: string } | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [allowedIPs, setAllowedIPs] = useState<Array<{ ip_cidr: string; note: string; active: boolean }>>([]);
  const [loginNotifications, setLoginNotifications] = useState<Array<{ login_at: string; ip_address: string }>>([]);

  useEffect(() => {
    const loadSession = async () => {
      const session = await loadAdminPanelSession();
      setAdminEmail(session?.email || '');
    };
    void loadSession();
    loadAllowedIPs();
    loadLoginNotifications();
  }, []);

  const loadAllowedIPs = async () => {
    const sb = getSupabase();
    if (!sb) return;

    const { data } = await sb.from('admin_allowed_ips').select('ip_cidr, note, active').eq('active', true);
    if (data) setAllowedIPs(data);
  };

  const loadLoginNotifications = async () => {
    const sb = getSupabase();
    if (!sb) return;

    const { data } = await sb
      .from('admin_login_notifications')
      .select('login_at, ip_address')
      .eq('admin_email', adminEmail)
      .order('login_at', { ascending: false })
      .limit(10);

    if (data) setLoginNotifications(data);
  };

  const handleEnable2FA = async () => {
    const result = await enable2FA();
    if (result.ok && result.setup) {
      setSetup2FA(result.setup);
    }
  };

  const handleDisable2FA = async () => {
    if (!verificationCode) return;
    const result = await disable2FA(verificationCode);
    if (result.ok) {
      setVerificationCode('');
      alert('2FA desabilitado com sucesso');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neon-yellow/10">
          <Shield className="h-5 w-5 text-neon-yellow" />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold uppercase text-white">Segurança Admin</h2>
          <p className="text-xs text-white/50">Configurações de autenticação e proteção</p>
        </div>
      </div>

      {/* 2FA Section */}
      <div className="sports-panel rounded-lg p-4">
        <div className="mb-4 flex items-center gap-2">
          <Key className="h-4 w-4 text-neon-yellow" />
          <h3 className="font-display text-sm font-bold uppercase text-white">Autenticação de Dois Fatores (2FA)</h3>
          {is2FAEnabled ? (
            <span className="ml-auto rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-medium text-green-400">
              Ativo
            </span>
          ) : (
            <span className="ml-auto rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-medium text-red-400">
              Inativo
            </span>
          )}
        </div>

        {!is2FAEnabled && !setup2FA && (
          <div className="space-y-3">
            <p className="text-xs text-white/60">
              Adicione uma camada extra de segurança ao seu painel admin. Requer Google Authenticator ou similar.
            </p>
            <button
              onClick={handleEnable2FA}
              disabled={isLoading}
              className="btn-primary w-full disabled:opacity-50"
            >
              <span className="btn-primary-inner justify-center">
                {isLoading ? 'Gerando...' : 'Habilitar 2FA'}
              </span>
            </button>
          </div>
        )}

        {setup2FA && (
          <div className="space-y-4">
            <div className="rounded-lg border border-neon-yellow/30 bg-neon-yellow/5 p-4">
              <p className="mb-3 text-xs font-medium text-white">1. Escaneie o QR Code no Google Authenticator:</p>
              <div className="mb-4 flex justify-center">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setup2FA.qrCodeUrl)}`}
                  alt="QR Code 2FA"
                  className="rounded-lg border border-white/10"
                />
              </div>
              <p className="mb-2 text-[10px] text-white/50">Ou digite manualmente:</p>
              <code className="block rounded bg-black/50 p-2 text-[10px] text-cyan-300">{setup2FA.secret}</code>
            </div>

            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <p className="mb-2 text-xs font-medium text-amber-200">2. Guarde os códigos de backup:</p>
              <div className="grid grid-cols-2 gap-2">
                {setup2FA.backupCodes.map((code, i) => (
                  <code key={i} className="rounded bg-black/50 p-1.5 text-center text-[10px] text-white/80">
                    {code}
                  </code>
                ))}
              </div>
              <p className="mt-2 text-[9px] text-amber-200/60">
                ⚠️ Salve estes códigos em local seguro. Cada um pode ser usado apenas uma vez.
              </p>
            </div>

            <button
              onClick={() => setSetup2FA(null)}
              className="btn-primary w-full"
            >
              <span className="btn-primary-inner justify-center">
                <CheckCircle2 className="h-4 w-4" />
                Concluir Configuração
              </span>
            </button>
          </div>
        )}

        {is2FAEnabled && (
          <div className="space-y-3">
            <p className="text-xs text-green-400">✓ 2FA está ativo e protegendo seu painel admin.</p>
            <div className="space-y-2">
              <label className="block text-xs text-white/60">Código de verificação para desabilitar:</label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="000000"
                maxLength={8}
                className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
              />
              <button
                onClick={handleDisable2FA}
                disabled={!verificationCode || isLoading}
                className="btn-secondary w-full disabled:opacity-50"
              >
                Desabilitar 2FA
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-200">
            {error}
          </div>
        )}
      </div>

      {/* IP Whitelist Section */}
      <div className="sports-panel rounded-lg p-4">
        <div className="mb-4 flex items-center gap-2">
          <Globe className="h-4 w-4 text-cyan-400" />
          <h3 className="font-display text-sm font-bold uppercase text-white">IPs Permitidos</h3>
          <span className="ml-auto text-[10px] text-white/40">{allowedIPs.length} ativos</span>
        </div>

        {allowedIPs.length === 0 ? (
          <p className="text-xs text-white/50">
            Nenhum IP na whitelist. Todos os IPs são permitidos (modo permissivo).
          </p>
        ) : (
          <div className="space-y-2">
            {allowedIPs.map((ip, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 p-2">
                <code className="flex-1 text-xs text-cyan-300">{ip.ip_cidr}</code>
                <span className="text-[10px] text-white/40">{ip.note}</span>
              </div>
            ))}
          </div>
        )}

        <p className="mt-3 text-[10px] text-white/40">
          💡 Para adicionar IPs, execute SQL no Supabase: <br />
          <code className="text-cyan-300/60">
            insert into admin_allowed_ips (ip_cidr, note) values ('192.168.1.0/24', 'Escritório');
          </code>
        </p>
      </div>

      {/* Login Notifications Section */}
      <div className="sports-panel rounded-lg p-4">
        <div className="mb-4 flex items-center gap-2">
          <Bell className="h-4 w-4 text-purple-400" />
          <h3 className="font-display text-sm font-bold uppercase text-white">Últimos Logins</h3>
        </div>

        {loginNotifications.length === 0 ? (
          <p className="text-xs text-white/50">Nenhum login registrado.</p>
        ) : (
          <div className="space-y-2">
            {loginNotifications.map((notif, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/30 p-2">
                <div className="flex-1">
                  <p className="text-xs text-white">
                    {new Date(notif.login_at).toLocaleString('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </p>
                  <p className="text-[10px] text-white/50">IP: {notif.ip_address || 'desconhecido'}</p>
                </div>
                {i === 0 && (
                  <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-[9px] font-medium text-green-400">
                    Atual
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="mt-3 text-[10px] text-white/40">
          💡 Notificações por email/SMS serão implementadas em breve.
        </p>
      </div>
    </div>
  );
}
