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
-- IDEMPOTENTE: pode rodar em base vazia OU re-rodar sobre schema existente.
-- O bundle prefixa DROP POLICY/TRIGGER IF EXISTS automaticamente antes de cada
-- CREATE POLICY/TRIGGER, então não tropeça em "policy already exists".
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
} | perl -0777 -pe '
  # Torna o bundle RE-RODÁVEL: antes de cada CREATE POLICY/TRIGGER (no início de
  # linha, nunca em comentário "--"), injeta o DROP ... IF EXISTS correspondente.
  s{(?im)^([ \t]*)(create[ \t]+policy[ \t]+("(?:[^"]*)"|[A-Za-z0-9_]+)[ \t]+on[ \t]+([A-Za-z0-9_."]+))}
   {$1."DROP POLICY IF EXISTS $3 ON $4;\n".$1.$2}ge;
  s{(?im)^([ \t]*)(create[ \t]+trigger[ \t]+([A-Za-z0-9_]+)\b[\s\S]*?\bon[ \t]+([A-Za-z0-9_."]+))}
   {$1."DROP TRIGGER IF EXISTS $3 ON $4;\n".$1.$2}ge;
' > "$OUT"
echo "Wrote $OUT"
