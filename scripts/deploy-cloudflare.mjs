// Deploy do app web pro Cloudflare — cross-platform (Windows / macOS / Linux).
// Substitui o antigo script shell, que usava sintaxe Unix (VAR=valor, grep,
// cut, tr) e quebrava no PowerShell / cmd.
//
// VITE_OLEFOOT_API_URL é uma URL pública (não é segredo) e não vive no .env,
// então é injetada aqui. VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY o Vite
// carrega sozinho do .env durante o build — não precisa extrair na mão.
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

if (!existsSync('.env')) {
  console.warn('[deploy] .env não encontrado na raiz — o build pode sair sem as chaves do Supabase.');
}

const env = {
  ...process.env,
  VITE_OLEFOOT_API_URL: 'https://legacy-production-de1e.up.railway.app',
};

execSync('npm run build', { stdio: 'inherit', env });
execSync('npx wrangler deploy', { stdio: 'inherit', env });
