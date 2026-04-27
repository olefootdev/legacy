#!/usr/bin/env bash
# Concatena TODAS as migrations em supabase/migrations/ num único ficheiro
# para colar no Supabase SQL Editor (projecto vazio / sem CLI).
# Preferido: `npx supabase db push` na raiz após `supabase link`.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/supabase/apply_full_public_schema.sql"
{
  cat <<'HDR'
-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — schema public completo (gerado por scripts/bundle-supabase-migrations.sh)
--
-- Executar UMA vez no Supabase → SQL → novo script, com a base vazia.
-- Não reexecutar sobre o mesmo schema: políticas CREATE POLICY podem falhar
-- se já existirem (use os DROP POLICY IF EXISTS quando disponíveis).
--
-- Preferido em dev/prod: na raiz do repo
--   npx supabase login && npx supabase link --project-ref <REF> && npx supabase db push
-- ═══════════════════════════════════════════════════════════════════════════

HDR
  # Ordena cronologicamente pelo nome do arquivo (timestamp prefix) e ignora
  # qualquer arquivo fora do padrão. find + sort para garantir ordem estável.
  while IFS= read -r f; do
    [[ -f "$f" ]] || continue
    echo ""
    echo "-- ─── $(basename "$f") ───"
    cat "$f"
  done < <(find "$ROOT/supabase/migrations" -maxdepth 1 -type f -name '*.sql' | sort)
} > "$OUT"
echo "Wrote $OUT"
