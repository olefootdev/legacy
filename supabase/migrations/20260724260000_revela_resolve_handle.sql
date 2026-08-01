-- ════════════════════════════════════════════════════════════════════════════
-- REVELA — resolver do @ curto: revela.olefoot.com/<handle>
--
-- Traduz o handle escolhido pelo jogador em: (a) qual perfil abrir e (b) o
-- código de indicação a capturar — pra o link curto ser o endereço E a indicação
-- ao mesmo tempo.
--
-- refCode = o my_referral_code da CONTA do talento (se ele já é manager no jogo).
-- Null enquanto ele não onboardou no jogo — aí o link curto ainda abre o perfil,
-- só não credita rede ainda. Sem PII: devolve só slug + o código (que é público,
-- feito pra ser compartilhado).
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.revela_resolve_handle(p_handle text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  h      text := lower(trim(coalesce(p_handle, '')));
  v_slug text;
  v_uid  uuid;
  v_ref  text;
begin
  if h = '' then
    return jsonb_build_object('found', false);
  end if;

  -- Talento PÚBLICO (aprovado/carded) com esse handle.
  select rt.slug, rt.user_id into v_slug, v_uid
  from public.revela_talents rt
  where lower(rt.handle) = h and rt.status in ('approved', 'carded')
  limit 1;

  if found then
    if v_uid is not null then
      select p.my_referral_code into v_ref from public.profiles p where p.id = v_uid;
    end if;
    return jsonb_build_object('found', true, 'kind', 'talent', 'slug', v_slug, 'refCode', v_ref);
  end if;

  -- Lenda (endereço /playervip) com esse handle.
  if exists (select 1 from public.playervip_handles where lower(handle) = h) then
    return jsonb_build_object('found', true, 'kind', 'legend', 'slug', h, 'refCode', null);
  end if;

  return jsonb_build_object('found', false);
end;
$$;

grant execute on function public.revela_resolve_handle(text) to anon, authenticated;

comment on function public.revela_resolve_handle(text) is
  'Resolve revela.olefoot.com/<handle> → perfil (talento aprovado ou lenda) + o '
  'código de indicação do dono (my_referral_code). Sem PII. Grant anon.';
