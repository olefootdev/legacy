-- ════════════════════════════════════════════════════════════════════════════
-- REVELA — a SEGUNDA CAMADA: facilitador ≠ indicador
--
-- Decisão do fundador: um talento pode ter sido INDICADO por um amigo (camada
-- viral) e, mesmo assim, ter um FACILITADOR OFICIAL diferente — um agente ou
-- representante — quando vira TOKEN/CARD. São dois eixos ORTOGONAIS, exatamente
-- como o jogo já trata:
--
--   • INDICADOR (viral) — `revela_talents.referral_code` → credita a REDE de
--     quem trouxe o atleta (affiliate_commissions), via o `/cadastro/<código>`
--     do jogo quando o atleta cria a conta. NÃO se mexe aqui.
--
--   • FACILITADOR (comercial) — quem recebe os 10% do `payment_split` do CARD.
--     Confirmado NA TOKENIZAÇÃO (aqui), pode ser um agente/representante oficial,
--     independente de quem indicou.
--
-- Este arquivo: (1) separa o facilitador no `revela_talents`; (2) cria a ponte
-- de tokenização que liga o card ao talento e injeta o facilitador no split.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. O facilitador oficial, separado do indicador ─────────────────────────
-- `referral_code` (indicador/viral) já existe. `facilitator_email` é o eixo
-- comercial — quem leva os 10% do card. Pode ser diferente do indicador.
alter table public.revela_talents
  add column if not exists facilitator_email text;

comment on column public.revela_talents.facilitator_email is
  'Facilitador OFICIAL (comercial) do card — leva os 10% do payment_split. Eixo '
  'separado do referral_code (indicador viral); confirmado na tokenização.';

-- ── 2. Ponte de tokenização (a "segunda camada") ────────────────────────────
-- Liga um card legacy JÁ CRIADO (pelo Legend Creator) ao talento aprovado, e
-- injeta o facilitador no split. O beneficiário é a CONTA DO ATLETA (user_id do
-- claim). Reproduz a injeção de split de `admin_link_legend_full` em vez de
-- chamá-la — aquela exige `is_admin()` (JWT), e esta roda por service role no
-- SQL Editor, sem JWT.
create or replace function public.revela_link_talent_card(
  p_talent_id        uuid,
  p_card_legacy_id   text,
  p_facilitator_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t          public.revela_talents;
  v_fac      uuid;
  v_split    jsonb;
  v_new      jsonb;
begin
  select * into t from public.revela_talents where id = p_talent_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'talent_not_found');
  end if;
  -- Precisa estar aprovado E já ter dono (claim feito) — o beneficiário do card
  -- é a conta do próprio atleta.
  if t.status not in ('approved', 'carded') then
    return jsonb_build_object('ok', false, 'reason', 'talent_not_approved');
  end if;
  if t.user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'talent_not_claimed');
  end if;

  select payment_split into v_split from public.legacy_players where id = p_card_legacy_id;
  if v_split is null then
    return jsonb_build_object('ok', false, 'reason', 'card_not_found_or_no_split');
  end if;

  -- Facilitador é OPCIONAL e INDEPENDENTE do indicador. Sem e-mail, ou e-mail
  -- sem conta, a entrada 'facilitator' fica sem user_id → 10% ficam com a
  -- plataforma (mesma convenção do split do jogo).
  if p_facilitator_email is not null and length(btrim(p_facilitator_email)) > 0 then
    select id into v_fac from auth.users where lower(email) = lower(btrim(p_facilitator_email)) limit 1;
  end if;

  -- Injeta: 'player' = conta do atleta; 'facilitator' = agente/representante.
  select jsonb_agg(
           case
             when (e->>'kind') = 'player'
               then jsonb_set(e, '{user_id}', to_jsonb(t.user_id::text))
             when (e->>'kind') = 'facilitator' and v_fac is not null
               then jsonb_set(jsonb_set(e, '{user_id}', to_jsonb(v_fac::text)),
                              '{label}', to_jsonb(btrim(p_facilitator_email)))
             else e
           end)
    into v_new
    from jsonb_array_elements(v_split) e;

  update public.legacy_players
     set beneficiary_user_id = t.user_id,
         payment_split       = coalesce(v_new, v_split),
         updated_at          = now()
   where id = p_card_legacy_id;

  update public.revela_talents
     set card_legacy_id    = p_card_legacy_id,
         facilitator_email = coalesce(nullif(btrim(p_facilitator_email), ''), facilitator_email),
         status            = 'carded',
         approved_at       = coalesce(approved_at, now()),
         updated_at        = now()
   where id = p_talent_id;

  return jsonb_build_object(
    'ok', true,
    'talentId', p_talent_id,
    'cardLegacyId', p_card_legacy_id,
    'beneficiaryUid', t.user_id,
    'facilitatorResolved', (v_fac is not null),
    'facilitatorEmail', nullif(btrim(p_facilitator_email), '')
  );
end;
$$;

-- Service role only (mesma regra de revela_admin_review_talent) — a tokenização
-- é operação de admin/OLE SCOUT, nunca da anon/authenticated.
revoke execute on function public.revela_link_talent_card(uuid, text, text) from anon, authenticated;

comment on function public.revela_link_talent_card(uuid, text, text) is
  'SEGUNDA CAMADA: liga card legacy ao talento aprovado+reivindicado, seta o '
  'atleta como beneficiário e injeta o FACILITADOR (independente do indicador) '
  'no payment_split. Service role only.';
