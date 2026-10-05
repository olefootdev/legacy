-- ═══════════════════════════════════════════════════════════════════════════
-- TELEGRAM — o registro das postagens automáticas do bot
--
-- O bot posta no grupo oficial (mercado 12h, MVP 20h05, ranking 21h30). O
-- servidor tenta a cada minuto; esta tabela é a trava: cada (tipo, dia) entra
-- UMA vez. Reinício do Railway ou duas instâncias → a segunda bate na chave
-- primária e não posta de novo. Ver server/src/lib/telegram/agenda.ts.
--
-- Só o servidor (service role) lê e escreve: RLS ligada e nenhuma policy.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.telegram_postagens (
  tipo      text not null check (tipo in ('mercado', 'mvp', 'ranking')),
  dia       date not null,
  criado_em timestamptz not null default now(),
  primary key (tipo, dia)
);
alter table public.telegram_postagens enable row level security;
revoke all on public.telegram_postagens from anon, authenticated;

do $$
begin
  if has_table_privilege('anon', 'public.telegram_postagens', 'select')
     or has_table_privilege('authenticated', 'public.telegram_postagens', 'insert') then
    raise exception 'telegram_postagens ficou aberta ao cliente';
  end if;
end $$;
