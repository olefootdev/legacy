// deno-lint-ignore-file no-explicit-any
// Olefoot — hodl-daily-tick
//
// Edge function chamada pelo pg_cron (ou manualmente) 1x por dia.
// Processa rewards de todos os locks ativos + sorteio + maturação.
//
// Idempotente: chamar múltiplas vezes no mesmo dia não duplica nada
// (a função SQL process_hodl_daily_tick usa UNIQUE constraints).
//
// Schedule sugerido: 0 5 * * * (00:05 UTC todo dia).

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Permite passar ?date=YYYY-MM-DD pra reprocessar histórico (idempotente)
  const url = new URL(req.url);
  const targetDate = url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);

  const startedAt = Date.now();

  const { data, error } = await supabase.rpc('process_hodl_daily_tick', {
    p_target_date: targetDate,
  });

  if (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        step: 'process-daily-tick',
        targetDate,
        error: error.message,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const result = Array.isArray(data) && data.length > 0 ? data[0] : null;

  return new Response(
    JSON.stringify({
      ok: true,
      step: 'hodl-daily-tick',
      targetDate,
      rewardsPaid: result?.rewards_paid ?? 0,
      locksMatured: result?.locks_matured ?? 0,
      lotteryWinner: result?.lottery_winner ?? null,
      lotteryEligible: result?.lottery_eligible ?? 0,
      durationMs: Date.now() - startedAt,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
