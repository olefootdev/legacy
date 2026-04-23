#!/usr/bin/env bash
# Concatena migrations 00001–00005 num único ficheiro para colar no Supabase SQL Editor
# (projecto vazio / sem CLI). Preferido: `npx supabase db push` na raiz após `supabase link`.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/supabase/apply_full_public_schema.sql"
{
  cat <<'HDR'
-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — schema public completo (gerado por scripts/bundle-supabase-migrations.sh)
--
-- Executar UMA vez no Supabase → SQL → novo script, com a base vazia (ou só apagar
-- tabelas públicas se souberes o que fazes). Não reexecutar sobre o mesmo schema:
-- políticas CREATE POLICY podem falhar se já existirem.
--
-- Preferido em dev/prod: na raiz do repo
--   npx supabase login && npx supabase link --project-ref <REF> && npx supabase db push
-- ═══════════════════════════════════════════════════════════════════════════

HDR
  for n in 01 02 03 04 05; do
    f=$(ls "$ROOT/supabase/migrations/000${n}"_*.sql 2>/dev/null | head -1)
    if [[ -f "$f" ]]; then
      echo ""
      echo "-- ─── $(basename "$f") ───"
      cat "$f"
    fi
  done
} > "$OUT"
echo "Wrote $OUT"
