/**
 * Valida OPENAI_API_KEY (server/.env) com uma chamada mínima à API.
 * Uso: npm run verify-openai --prefix server
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import OpenAI from 'openai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const key = process.env.OPENAI_API_KEY?.trim();
if (!key) {
  console.error('Falta OPENAI_API_KEY em server/.env');
  process.exit(1);
}

const model =
  process.env.OPENAI_GAMESPIRIT_MODEL?.trim()
  || process.env.OPENAI_MODEL?.trim()
  || 'gpt-4.1-mini';

const openai = new OpenAI({ apiKey: key });

try {
  const res = await openai.responses.create({
    model,
    input: 'Responde apenas com a palavra: OK',
    max_output_tokens: 16,
    temperature: 0,
  });

  const text =
    typeof (res as { output_text?: string }).output_text === 'string'
      ? (res as { output_text: string }).output_text.trim()
      : '';

  console.log('Integração OpenAI: sucesso.');
  console.log('Modelo:', model);
  console.log('Resposta (trecho):', text.slice(0, 120) || '(vazio — verifica modelo / billing)');
  process.exit(0);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error('Falha na chamada OpenAI:', msg);
  process.exit(1);
}
