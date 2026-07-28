-- ════════════════════════════════════════════════════════════════════════════
-- REVELA — OVR calculado no banco, com os pesos POR POSIÇÃO do jogo
--
-- O PROBLEMA QUE ISTO RESOLVE
-- `revela_admin_review_talent` aceitava o `overall` como parâmetro, o que
-- significa alguém digitando um número à mão na revisão. Se esse número não
-- bater com o que `overallFromAttributes()` calcula no jogo, a vitrine pública
-- mostra um OVR e a carta mostra outro.
--
-- Isso não é hipótese: já aconteceu. A vitrine do /playervip recalculava o OVR
-- com uma cópia local dos pesos, sem posição, e divergia do card. A nota está
-- em src/pages/PlayerVipLanding.tsx. A correção de lá foi parar de recalcular;
-- a correção daqui é nunca deixar ninguém digitar.
--
-- ⚠️ ESTES PESOS SÃO UMA CÓPIA de src/entities/ovrWeights.ts.
-- Cópia é dívida. Ela existe porque a aprovação hoje acontece no SQL Editor,
-- sem passar por TypeScript nenhum. Para a dívida não apodrecer em silêncio há
-- um teste que compara os dois lados, sem precisar de banco:
--
--     npm run test:revela-ovr
--
-- Ele lê ESTE arquivo, extrai a tabela de pesos e compara com o TS. Se você
-- mexer num lado e esquecer o outro, ele quebra. Quando existir a tela de admin
-- da fila do OLE SCOUT, ela deve chamar o TS e esta função vira redundante —
-- aí apague as duas coisas juntas.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Tabela de pesos ─────────────────────────────────────────────────────────
-- mentalidade (.08) + confiança (.08) + fairPlay (.06) são universais e somam
-- 0.22 em todo perfil; os 7 atributos de ofício somam 0.78. Cada linha soma 1.0
-- exatamente — se deixar de somar, a escala do OVR para de ser comparável entre
-- posições, que era o bug original.
create or replace function public.revela_ovr_weights(p_pos text)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    '{
      "GOL": {"passe":0.06,"marcacao":0.18,"velocidade":0.06,"drible":0.04,"finalizacao":0.02,"fisico":0.22,"tatico":0.20,"mentalidade":0.08,"confianca":0.08,"fairPlay":0.06},
      "ZAG": {"passe":0.08,"marcacao":0.24,"velocidade":0.07,"drible":0.02,"finalizacao":0.01,"fisico":0.18,"tatico":0.18,"mentalidade":0.08,"confianca":0.08,"fairPlay":0.06},
      "LE":  {"passe":0.10,"marcacao":0.17,"velocidade":0.18,"drible":0.10,"finalizacao":0.01,"fisico":0.14,"tatico":0.08,"mentalidade":0.08,"confianca":0.08,"fairPlay":0.06},
      "LD":  {"passe":0.10,"marcacao":0.17,"velocidade":0.18,"drible":0.10,"finalizacao":0.01,"fisico":0.14,"tatico":0.08,"mentalidade":0.08,"confianca":0.08,"fairPlay":0.06},
      "VOL": {"passe":0.16,"marcacao":0.22,"velocidade":0.05,"drible":0.02,"finalizacao":0.01,"fisico":0.14,"tatico":0.18,"mentalidade":0.08,"confianca":0.08,"fairPlay":0.06},
      "MC":  {"passe":0.20,"marcacao":0.13,"velocidade":0.08,"drible":0.05,"finalizacao":0.02,"fisico":0.11,"tatico":0.19,"mentalidade":0.08,"confianca":0.08,"fairPlay":0.06},
      "MEI": {"passe":0.24,"marcacao":0.02,"velocidade":0.08,"drible":0.15,"finalizacao":0.12,"fisico":0.03,"tatico":0.14,"mentalidade":0.08,"confianca":0.08,"fairPlay":0.06},
      "PE":  {"passe":0.13,"marcacao":0.01,"velocidade":0.22,"drible":0.20,"finalizacao":0.12,"fisico":0.06,"tatico":0.04,"mentalidade":0.08,"confianca":0.08,"fairPlay":0.06},
      "PD":  {"passe":0.13,"marcacao":0.01,"velocidade":0.22,"drible":0.20,"finalizacao":0.12,"fisico":0.06,"tatico":0.04,"mentalidade":0.08,"confianca":0.08,"fairPlay":0.06},
      "ATA": {"passe":0.05,"marcacao":0.01,"velocidade":0.16,"drible":0.13,"finalizacao":0.30,"fisico":0.09,"tatico":0.04,"mentalidade":0.08,"confianca":0.08,"fairPlay":0.06}
    }'::jsonb -> upper(trim(coalesce(p_pos, ''))),
    -- Perfil NEUTRO: é a fórmula antiga, sem posição. Vale pra posição
    -- desconhecida — assim ninguém muda de OVR por falta de rótulo.
    '{"passe":0.12,"marcacao":0.10,"velocidade":0.12,"drible":0.10,"finalizacao":0.12,"fisico":0.10,"tatico":0.12,"mentalidade":0.08,"confianca":0.08,"fairPlay":0.06}'::jsonb
  );
$$;

-- ── O cálculo ───────────────────────────────────────────────────────────────
-- Mesma conta de overallFromAttributes(): soma ponderada, teto 99, piso 40,
-- arredondamento pra cima no meio. Atributo ausente conta zero — igual ao TS,
-- que lê a chave e recebe undefined→NaN só se o objeto estiver incompleto; aqui
-- preferimos zero explícito a um erro silencioso.
create or replace function public.revela_ovr(p_pos text, p_attrs jsonb)
returns int
language sql
immutable
as $$
  select greatest(40, least(99, round(coalesce(sum(
    coalesce((p_attrs ->> k)::numeric, 0) * (w ->> k)::numeric
  ), 0))))::int
  from (select public.revela_ovr_weights(p_pos) as w) src,
       lateral jsonb_object_keys(src.w) as k;
$$;

comment on function public.revela_ovr(text, jsonb) is
  'OVR ponderado por posição. Cópia de src/entities/ovrWeights.ts guardada por '
  'npm run test:revela-ovr — não editar um lado sem o outro.';


-- ════════════════════════════════════════════════════════════════════════════
-- Revisão do OLE SCOUT: o `overall` deixa de ser digitado
--
-- Se p_overall vier null (o normal), o OVR é calculado dos atributos com o peso
-- da posição do próprio atleta. Passar um número continua possível, mas é
-- override consciente, não o caminho padrão.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.revela_admin_review_talent(
  p_id         uuid,
  p_status     text,
  p_attributes jsonb default null,
  p_overall    int  default null,
  p_note       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row_after public.revela_talents;
begin
  if p_status not in ('pending','in_review','approved','rejected','carded') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_status');
  end if;

  update public.revela_talents t
  set status      = p_status,
      attributes  = coalesce(p_attributes, t.attributes),
      overall     = coalesce(
                      p_overall,
                      case
                        when coalesce(p_attributes, t.attributes) <> '{}'::jsonb
                          then public.revela_ovr(t.pos, coalesce(p_attributes, t.attributes))
                        else t.overall
                      end
                    ),
      scout_note  = coalesce(p_note, t.scout_note),
      approved_at = case when p_status in ('approved','carded') then now() else t.approved_at end,
      updated_at  = now()
  where t.id = p_id
  returning t.* into row_after;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  -- Devolve o que gravou: sem isso a pessoa aprova às cegas e só descobre o
  -- OVR recarregando o site.
  return jsonb_build_object(
    'ok',      true,
    'slug',    row_after.slug,
    'name',    row_after.name,
    'pos',     row_after.pos,
    'status',  row_after.status,
    'overall', row_after.overall
  );
end;
$$;

revoke execute on function public.revela_admin_review_talent(uuid, text, jsonb, int, text)
  from anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- Fila do OLE SCOUT — a lista que falta uma tela pra ter
--
-- ⚠️ Devolve contact_phone e contact_email: é PII. Por isso NÃO tem grant pra
-- anon nem pra authenticated, e só roda no SQL Editor (postgres) ou com service
-- role. Se um dia isto for chamado pelo frontend, tem que ser atrás de um gate
-- de admin no servidor — nunca com a anon key.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.revela_admin_queue()
returns table (
  id            uuid,
  slug          text,
  name          text,
  pos           text,
  club          text,
  city          text,
  uf            text,
  birth_year    int,
  status        text,
  overall       int,
  video_url     text,
  contact_phone text,
  contact_email text,
  created_at    timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select t.id, t.slug, t.name, t.pos, t.club, t.city, t.uf, t.birth_year,
         t.status, t.overall, t.video_url, t.contact_phone, t.contact_email,
         t.created_at
  from public.revela_talents t
  order by
    -- Fila primeiro, e dentro dela o mais antigo na frente: quem esperou mais
    -- é atendido antes.
    case t.status when 'pending' then 0 when 'in_review' then 1 else 2 end,
    t.created_at;
$$;

revoke execute on function public.revela_admin_queue() from anon, authenticated;
