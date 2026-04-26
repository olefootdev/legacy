# Wallet Security System — Olefoot

Sistema completo de segurança para operações financeiras no Olefoot, implementado sem blockchain.

## 🔒 Funcionalidades Implementadas

### 1. Autenticação de Dois Fatores (2FA)
- **TOTP** compatível com Google Authenticator
- **Códigos de backup** (10 códigos de 8 dígitos)
- **Operações sensíveis protegidas**:
  - Saques de BRO (> 1000 BRO)
  - SWAP OLEXP → SPOT
  - Transferências entre usuários
  - Mudanças de KYC
  - Desabilitar 2FA

**Uso:**
```typescript
import { useSecureWallet } from '@/wallet/useSecureWallet';

function WalletComponent() {
  const { enable2FA, disable2FA, executeSecureOperation } = useSecureWallet(
    wallet,
    userId,
    onWalletUpdate
  );

  // Habilitar 2FA
  const handleEnable2FA = async () => {
    const result = await enable2FA();
    if (result.ok) {
      console.log('Secret:', result.secret);
      console.log('QR Code URL:', result.qrCodeUrl);
      console.log('Backup Codes:', result.backupCodes);
    }
  };

  // Executar operação sensível
  const handleWithdraw = async (amount: number, code: string) => {
    const result = await executeSecureOperation('WITHDRAW_BRO', amount, code);
    if (result.requires2FA) {
      // Mostrar modal pedindo código 2FA
    }
  };
}
```

### 2. Detecção de Fraude
Sistema automático que analisa transações em tempo real:

**Verificações:**
- ✅ Valores anormalmente altos (> 10k BRO = bloqueio, > 5k BRO = revisão)
- ✅ Velocity check (10+ transações em 5 min = bloqueio)
- ✅ Saldo insuficiente (tentativa de double-spend)
- ✅ Padrão de round-trip (depósito + saque em 24h = suspeito)
- ✅ Cooldown automático (3+ alertas em 10 min = 30 min de cooldown)

**Níveis de risco:**
- `low` — Transação normal
- `medium` — Atividade elevada, monitorar
- `high` — Requer revisão manual
- `critical` — Bloqueio automático

**Uso:**
```typescript
import { analyzeTransactionRisk, checkCooldown } from '@/wallet/fraudDetection';

// Antes de executar transação
const riskAnalysis = analyzeTransactionRisk(wallet, {
  type: 'WITHDRAW_BRO',
  amountCents: 500_000, // 5k BRO
});

if (riskAnalysis.shouldBlock) {
  console.error('Transação bloqueada:', riskAnalysis.alerts);
  return;
}

// Verificar cooldown
const cooldown = checkCooldown(wallet);
if (cooldown.inCooldown) {
  console.log(`Aguarde ${cooldown.remainingSeconds}s`);
}
```

### 3. Backup Automático
Backups periódicos do wallet no Supabase para recuperação de desastres.

**Características:**
- ✅ Backup automático a cada 5 minutos (se houver mudanças)
- ✅ Backup imediato após transações > 100 BRO
- ✅ Mantém últimos 10 backups por usuário
- ✅ Checksum para validar integridade
- ✅ Restauração com validação

**Uso:**
```typescript
import { backupWalletToSupabase, restoreWalletFromSupabase } from '@/wallet/walletBackup';

// Backup manual
const result = await backupWalletToSupabase(wallet, userId);
if (result.ok) {
  console.log('Backup ID:', result.backupId);
}

// Restaurar último backup
const restore = await restoreWalletFromSupabase(userId);
if (restore.ok) {
  console.log('Wallet restaurado:', restore.wallet);
}
```

## 📊 Tabelas Supabase

### `user_2fa_config`
```sql
user_id UUID PRIMARY KEY
enabled BOOLEAN
secret TEXT -- TOTP secret
backup_codes TEXT[] -- Códigos de backup
enabled_at TIMESTAMPTZ
last_used_at TIMESTAMPTZ
```

### `wallet_backups`
```sql
id UUID PRIMARY KEY
user_id UUID
wallet_snapshot JSONB -- Estado completo do wallet
checksum TEXT -- Validação de integridade
created_at TIMESTAMPTZ
```

### `fraud_alerts`
```sql
id UUID PRIMARY KEY
user_id UUID
risk_level TEXT -- low, medium, high, critical
reason TEXT
blocked BOOLEAN
operation_type TEXT
amount_cents BIGINT
metadata JSONB
created_at TIMESTAMPTZ
```

## 🔐 Segurança vs Crypto Wallets

| Aspecto | Sistema Atual (Off-Chain) | Crypto Wallets |
|---------|---------------------------|----------------|
| **Segurança** | ✅ Controlada pelo servidor | ❌ Risco de private key leak |
| **UX** | ✅ 2 cliques | ❌ 12+ cliques |
| **Custo/tx** | ✅ $0.001 | ❌ $2-50 (gas) |
| **Reversibilidade** | ✅ Pode reverter fraudes | ❌ Irreversível |
| **Regulação** | ✅ Mais simples | ❌ Complexa |
| **Suporte** | ✅ Fácil | ❌ Seed phrases perdidas |

## 🚀 Roadmap Futuro

### Fase 1 (Atual) ✅
- [x] 2FA com TOTP
- [x] Detecção de fraude
- [x] Backup automático
- [x] Rate limiting
- [x] Auditoria de transações

### Fase 2 (Pós-Launch)
- [ ] Notificações de transações suspeitas (email/SMS)
- [ ] Dashboard de segurança para usuários
- [ ] Análise de geolocalização (IP)
- [ ] Machine learning para detecção de fraude
- [ ] Whitelist de endereços confiáveis

### Fase 3 (Futuro — 12+ meses)
- [ ] Modo híbrido (custodial + self-custody)
- [ ] Layer 2 (Polygon/Arbitrum) para power users
- [ ] Account Abstraction (ERC-4337)
- [ ] Gasless transactions

## 📝 Notas de Implementação

### Produção
Para deploy em produção, implementar:

1. **Criptografia de secrets 2FA**
   ```typescript
   // Usar crypto.subtle ou biblioteca segura
   const encrypted = await encrypt(secret, masterKey);
   ```

2. **Hash de backup codes**
   ```typescript
   // Nunca armazenar códigos em plain text
   const hashed = await bcrypt.hash(code, 10);
   ```

3. **TOTP real**
   ```typescript
   // Instalar: npm install speakeasy
   import speakeasy from 'speakeasy';
   
   const verified = speakeasy.totp.verify({
     secret: userSecret,
     encoding: 'base32',
     token: userCode,
     window: 1, // Aceita ±30s
   });
   ```

4. **Rate limiting no Supabase**
   ```sql
   -- Adicionar em RLS policies
   CREATE POLICY "Rate limit 2FA attempts"
   ON user_2fa_config
   FOR UPDATE
   USING (
     (SELECT COUNT(*) FROM fraud_alerts 
      WHERE user_id = auth.uid() 
      AND created_at > NOW() - INTERVAL '10 minutes') < 5
   );
   ```

## 🛡️ Checklist de Segurança

Antes do launch:
- [ ] Aplicar migration `20260425000001_wallet_security.sql`
- [ ] Testar 2FA com Google Authenticator
- [ ] Testar detecção de fraude com valores altos
- [ ] Testar backup/restore de wallet
- [ ] Configurar alertas de fraude para admin
- [ ] Documentar processo de recuperação de conta
- [ ] Treinar suporte sobre 2FA e backups

## 📞 Suporte

Para problemas de segurança:
1. Verificar logs em `fraud_alerts`
2. Verificar backups em `wallet_backups`
3. Restaurar wallet do último backup válido
4. Resetar 2FA se necessário (requer verificação de identidade)
