/**
 * Vínculo de carteira Solana COM prova de posse (A VIRADA · C1).
 *
 * Substitui a RPC `link_my_solana_wallet`, que aceitava qualquer endereço bem
 * formado (verified = false). Agora o cliente só consegue vincular mandando uma
 * assinatura da própria carteira; quem grava é este servidor, com service role.
 *
 * Este vínculo é a ponte com olefoot.com/wallet e o cadastro do airdrop da v1:
 * o endereço que sai daqui é onde o saldo novo cai. Por isso nada entra sem
 * assinatura. Ver lib/solanaLinkProof.ts.
 */
import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { rateLimit } from '../lib/rateLimit.js';
import { solanaAddressToPublicKey, verifySolanaLinkProof } from '../lib/solanaLinkProof.js';

export const solanaWalletRoutes = new Hono();

async function resolveUser(authHeader: string | undefined): Promise<string | null> {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

/**
 * POST /api/wallet/solana/link
 * Auth: Bearer (sessão Supabase do jogo).
 * Body: { address, issuedAt, signature (base64), signedMessage? (base64) }
 */
solanaWalletRoutes.post('/api/wallet/solana/link', rateLimit(10), async (c) => {
  const uid = await resolveUser(c.req.header('authorization'));
  if (!uid) return c.json({ ok: false, error: 'Entre na sua conta pra vincular a carteira.' }, 401);

  const body = await c.req.json().catch(() => null) as {
    address?: unknown; issuedAt?: unknown; signature?: unknown; signedMessage?: unknown;
  } | null;
  if (!body || typeof body.address !== 'string' || typeof body.issuedAt !== 'string' || typeof body.signature !== 'string') {
    return c.json({ ok: false, error: 'campos obrigatórios: address, issuedAt, signature' }, 400);
  }
  if (body.signature.length > 200 || (typeof body.signedMessage === 'string' && body.signedMessage.length > 2000)) {
    return c.json({ ok: false, error: 'assinatura malformada' }, 400);
  }

  const proof = verifySolanaLinkProof({
    uid,
    address: body.address,
    issuedAt: body.issuedAt,
    signatureB64: body.signature,
    signedMessageB64: typeof body.signedMessage === 'string' ? body.signedMessage : null,
  });
  if (!proof.ok) return c.json({ ok: false, error: proof.reason }, 400);

  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false, error: 'Servidor sem acesso ao banco.' }, 503);

  const now = new Date().toISOString();
  const { data, error } = await sb
    .from('solana_wallet_links')
    .upsert(
      {
        user_id: uid,
        wallet_address: body.address,
        verified: true,
        verified_at: now,
        proof_message: proof.message,
        proof_signature: body.signature,
        updated_at: now,
      },
      { onConflict: 'user_id' },
    )
    .select('wallet_address, verified, linked_at, verified_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      return c.json({ ok: false, error: 'Essa carteira já está vinculada a outra conta.' }, 409);
    }
    console.error('[solanaWallet] upsert falhou:', error.message);
    return c.json({ ok: false, error: 'Não foi possível salvar o vínculo.' }, 500);
  }

  return c.json({ ok: true, link: data });
});

/**
 * GET /api/wallet/solana/saldo/:endereco
 *
 * O saldo passa por aqui, e não pelo navegador falando direto com um RPC, por
 * dois motivos concretos: o cliente não carrega chave de RPC nenhuma, e a CSP
 * do jogo não precisa abrir `connect-src` pra um domínio de terceiro — que é
 * exatamente o tipo de exceção que enfraquece a política justo na tela onde a
 * frase de 12 palavras aparece.
 *
 * Público: endereço Solana não é segredo, e o saldo dele é leitura pública na
 * blockchain de qualquer jeito. Mas o endereço é VALIDADO antes de virar
 * requisição — senão isto vira um proxy aberto pra qualquer string.
 */
solanaWalletRoutes.get('/api/wallet/solana/saldo/:endereco', rateLimit(30), async (c) => {
  const endereco = c.req.param('endereco') ?? '';
  const pub = endereco ? solanaAddressToPublicKey(endereco) : null;
  if (!pub) return c.json({ ok: false, error: 'endereço Solana inválido' }, 400);

  const rpc = process.env.SOLANA_RPC_URL?.trim() || 'https://api.mainnet-beta.solana.com';
  try {
    const r = await fetch(rpc, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [endereco] }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return c.json({ ok: false, error: `RPC respondeu ${r.status}` }, 502);
    const j = await r.json() as { result?: { value?: number }; error?: { message?: string } };
    if (j.error) return c.json({ ok: false, error: j.error.message ?? 'RPC recusou' }, 502);

    const lamports = j.result?.value ?? 0;
    return c.json(
      { ok: true, endereco, lamports: String(lamports), sol: lamports / 1e9 },
      200,
      // Endereço novo tem saldo 0 e vai ser consultado toda hora; 15s de cache
      // segura a enxurrada sem a pessoa achar que o saldo travou.
      { 'Cache-Control': 'public, max-age=15' },
    );
  } catch (e) {
    const msg = e instanceof Error && e.name === 'TimeoutError' ? 'o RPC demorou demais' : 'não consegui falar com a Solana';
    return c.json({ ok: false, error: msg }, 504);
  }
});
