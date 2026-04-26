-- Migration: Wallet Security Features
-- Adiciona tabelas para 2FA, backups e auditoria de fraude

-- Tabela de configuração 2FA por usuário
CREATE TABLE IF NOT EXISTS public.user_2fa_config (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  secret TEXT, -- TOTP secret (encrypted em produção)
  backup_codes TEXT[], -- Códigos de backup (hashed em produção)
  enabled_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para 2FA
CREATE INDEX IF NOT EXISTS idx_user_2fa_enabled ON public.user_2fa_config(user_id) WHERE enabled = true;

-- RLS para 2FA (usuário só vê própria config)
ALTER TABLE public.user_2fa_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own 2FA config"
  ON public.user_2fa_config
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own 2FA config"
  ON public.user_2fa_config
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own 2FA config"
  ON public.user_2fa_config
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Tabela de backups de wallet
CREATE TABLE IF NOT EXISTS public.wallet_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_snapshot JSONB NOT NULL,
  checksum TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para backups
CREATE INDEX IF NOT EXISTS idx_wallet_backups_user_created ON public.wallet_backups(user_id, created_at DESC);

-- RLS para backups (usuário só vê próprios backups)
ALTER TABLE public.wallet_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallet backups"
  ON public.wallet_backups
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wallet backups"
  ON public.wallet_backups
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Tabela de alertas de fraude
CREATE TABLE IF NOT EXISTS public.fraud_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  reason TEXT NOT NULL,
  blocked BOOLEAN NOT NULL DEFAULT false,
  operation_type TEXT NOT NULL,
  amount_cents BIGINT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para fraud alerts
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_user_created ON public.fraud_alerts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_risk_level ON public.fraud_alerts(risk_level) WHERE blocked = true;

-- RLS para fraud alerts (usuário vê próprios alertas, admin vê todos)
ALTER TABLE public.fraud_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own fraud alerts"
  ON public.fraud_alerts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert fraud alerts"
  ON public.fraud_alerts
  FOR INSERT
  WITH CHECK (true); -- Backend insere via service role

-- Função para limpar backups antigos automaticamente
CREATE OR REPLACE FUNCTION cleanup_old_wallet_backups()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Mantém últimos 10 backups por usuário
  DELETE FROM public.wallet_backups
  WHERE id IN (
    SELECT id
    FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
      FROM public.wallet_backups
    ) t
    WHERE rn > 10
  );
END;
$$;

-- Trigger para atualizar updated_at em 2FA config
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_user_2fa_config_updated_at
  BEFORE UPDATE ON public.user_2fa_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comentários para documentação
COMMENT ON TABLE public.user_2fa_config IS 'Configuração de autenticação de dois fatores por usuário';
COMMENT ON TABLE public.wallet_backups IS 'Backups automáticos de wallets para recuperação de desastres';
COMMENT ON TABLE public.fraud_alerts IS 'Alertas de transações suspeitas e tentativas de fraude';
COMMENT ON FUNCTION cleanup_old_wallet_backups() IS 'Limpa backups antigos mantendo últimos 10 por usuário';
