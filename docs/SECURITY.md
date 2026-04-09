# Segurança — guia para contribuidores

## Segredos e ficheiros

- **Nunca** commits de `.env`, `.env.local`, chaves `.pem`, keystores Android/iOS, `google-services.json` / `GoogleService-Info.plist` com dados reais.
- Usar apenas ficheiros **`.env.example`** (valores vazios ou placeholders) para documentar nomes de variáveis.
- O `.gitignore` na raiz cobre os padrões habituais; ao adicionar novas ferramentas, atualiza o ignore **antes** do primeiro commit com credenciais locais.

## O que é público no bundle

- Prefixos **`VITE_`** (Vite) e **`EXPO_PUBLIC_`** (Expo) expõem valores no cliente. **Não** colocar service role, API keys privadas ou tokens de utilizador aí.
- **`GEMINI_API_KEY`** na raiz é lida pelo build Vite para alguns fluxos de Admin: em produção, o ideal é mover chamadas para o backend (`server/`) com rate limit e auth.

## Supabase

- Cliente web: **anon key** + RLS. Service role **só** em `server/.env` (nunca no browser).
- `supabase/config.toml`: usar placeholder de `project.id` em forks públicos; projeto real via `supabase link` local.

## Reportar problemas

- Abre um issue **privado** ou contacta os maintainers se descobrires exposição de credenciais no histórico Git; não coloques reproduções com chaves reais.
