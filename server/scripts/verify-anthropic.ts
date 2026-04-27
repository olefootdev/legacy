/**
 * Verifica que ANTHROPIC_API_KEY está configurada e modelos respondem.
 *
 * Uso: cd server && npx tsx scripts/verify-anthropic.ts
 *
 * Testa os 2 modelos que o projeto usa:
 *   - Haiku: chamadas frequentes, batch
 *   - Sonnet: on-demand de qualidade
 */

import 'dotenv/config';
import { callAnthropic, MODELS, hasAnthropicKey } from '../src/lib/anthropic.js';

async function main() {
  console.log('=== Verify Anthropic SDK ===\n');

  if (!hasAnthropicKey()) {
    console.error('✗ ANTHROPIC_API_KEY ausente em server/.env');
    process.exit(1);
  }
  console.log('✓ ANTHROPIC_API_KEY presente');
  console.log(`  Sonnet: ${MODELS.sonnet}`);
  console.log(`  Haiku:  ${MODELS.haiku}\n`);

  for (const key of ['haiku', 'sonnet'] as const) {
    const t0 = Date.now();
    const r = await callAnthropic({
      model: key,
      system: 'Responda apenas com a palavra OK, sem pontuação.',
      user: 'ping',
      maxTokens: 16,
      temperature: 0,
    });
    const ms = Date.now() - t0;

    if (!r.ok) {
      console.error(`✗ ${key}: ${r.error} (${ms}ms)`);
      process.exit(1);
    }
    const passed = r.text?.toUpperCase().includes('OK');
    console.log(
      `${passed ? '✓' : '△'} ${key}: "${r.text}" ` +
      `(${r.usage?.inputTokens} in / ${r.usage?.outputTokens} out, ${ms}ms)`,
    );
  }

  console.log('\n=== OK ===');
}

main().catch((err) => {
  console.error('✗ Falha:', err);
  process.exit(1);
});
