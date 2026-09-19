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
import { verifySolanaLinkProof } from '../lib/solanaLinkProof.js';

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
