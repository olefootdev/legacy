/**
 * O banco DESCARTÁVEL das validações de dinheiro: PGlite com as migrations
 * REAIS do repositório aplicadas em ordem, mais os stubs do que o Supabase dá
 * e o PGlite não tem (auth, roles, tabelas do jogo que o pagamento só encosta).
 *
 * Um lugar só, porque duas cópias deste setup divergem — e aí um teste passa
 * num banco que não é o de produção.
 *
 * `extras` são migrations aplicadas DEPOIS da base, na ordem dada.
 */
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';

export const M = 'supabase/migrations/';

export const MIGRATIONS_DA_FASE0 = [
  '20260929210000_expansao_leitura_so_do_dono.sql',
  '20260929220000_fase0_pix_credita_certo.sql',
  '20260930120000_cancela_plano_de_marketing.sql',
];

export async function montarBanco({ extras = [], antesDosExtras } = {}) {
  // pgcrypto no schema `extensions`, como no Supabase: função que chama
  // `crypt` sem o schema some sob `search_path = public` (já mordeu uma vez).
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`create schema if not exists extensions; create extension if not exists pgcrypto with schema extensions;`);

  await db.exec(`
    create schema if not exists auth;
    -- As colunas extras são as que expansao_criar_satelite preenche no molde
    -- do GoTrue (tokens '', instance_id zerado). No PGlite são só colunas.
    create table auth.users (id uuid primary key default gen_random_uuid(), email text,
      raw_user_meta_data jsonb, created_at timestamptz default now(),
      instance_id uuid, aud text, role text, encrypted_password text,
      email_confirmed_at timestamptz, raw_app_meta_data jsonb, updated_at timestamptz,
      confirmation_token text, email_change text, email_change_token_new text, recovery_token text);
    -- Igual ao Supabase: quem está logado sai do JWT que o PostgREST põe na sessão.
    create or replace function auth.jwt() returns jsonb language sql stable as $$
      select nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
    create or replace function auth.uid() returns uuid language sql stable as $$
      select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
    create or replace function auth.role() returns text language sql stable as $$
      select auth.jwt() ->> 'role' $$;
    do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    do $$ begin create role service_role; exception when duplicate_object then null; end $$;

    create table public.profiles (id uuid primary key, username text unique, display_name text,
      club_name text, club_short text, onboarding_data jsonb, referred_by_code text,
      my_referral_code text, email text, updated_at timestamptz default now());
    create table public.manager_friendships (requester_id uuid, addressee_id uuid,
      requester_club_name text, addressee_club_name text, status text, responded_at timestamptz,
      updated_at timestamptz, primary key (requester_id, addressee_id));
    create table public.expansao_pendente (user_id uuid primary key, patrocinador_id uuid,
      codigo text, motivo text, criado_em timestamptz default now(), resolvido_em timestamptz);

    create or replace function public.is_admin() returns boolean language sql stable as $$ select false $$;

    -- O ramo de CARD não muda na Fase 0, mas tem que continuar entregando.
    create table public.legacy_players (id text primary key, name text, payment_split jsonb);
    create table public.manager_squad (user_id uuid primary key, players jsonb, lineup jsonb,
      updated_at timestamptz default now());
    create table public.legacy_player_lots (legacy_player_id text, status text, sold integer default 0);
    create table public.market_activities (id uuid primary key default gen_random_uuid(), type text,
      manager_id uuid, manager_name text, club_name text, player_name text, player_ovr int,
      player_pos text, price_exp bigint, created_at timestamptz default now());
  `);

  const base = [
    ['20260421194739_wallet_credits.sql'],
    ['20260502030001_wallet_credits_exp.sql'],
    ['20260527000100_affiliate_commissions.sql'],
    // Só a tabela e `is_user_activated`: o resto do arquivo é carreira e HODL.
    ['20260527000400_activation_pack.sql', '-- Adiciona coluna lost_commissions_cents'],
    ['20260528100000_payment_intents.sql'],
    ['20260703130000_payment_refunds.sql'],
    ['20260704120000_legacy_pix_record_sale.sql'],
    ['20260918220000_wallet_credits_claim_rpc.sql'],
    ['20260928120000_presale_packs_e_travas.sql'],
    ['20260928130000_presale_pix_e_credito.sql'],
    ['20260928140000_expansao_arvore_e_ciclo.sql'],
    ['20260929120000_expansao_ponte_cadastro.sql', '-- ─── o gancho no cadastro'],
    ['20260929140000_expansao_convite_confirmado.sql'],
    ['20260929160000_expansao_ativacao_casa.sql'],
    ['20260929180000_carreira_por_equiparado_pago.sql'],
  ];

  for (const [arq, ate] of base) {
    let sql = readFileSync(M + arq, 'utf8');
    if (ate) sql = sql.slice(0, sql.indexOf(ate));
    try { await db.exec(sql); }
    catch (e) { console.log(`❌ base ${arq}: ${e.message}`); process.exit(1); }
  }
  console.log('✅ base: as migrations reais aplicam em sequência');

  if (antesDosExtras) await antesDosExtras(db);
  for (const arq of extras) {
    try { await db.exec(readFileSync(M + arq, 'utf8')); }
    catch (e) { console.log(`❌ ${arq}: ${e.message}`); process.exit(1); }
    console.log(`✅ ${arq} aplica — e a verificação de dentro passou`);
  }
  return db;
}
