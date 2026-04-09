# Contribuir

1. **Clone** o repositório e instala dependências na raiz: `npm install`.
2. **Lint / typecheck:** `npm run lint` (inclui a app web e `web/match-pitch`).
3. **Subpastas** com o seu próprio `package.json` (`server/`, `mobile/`, `web/match-pitch/`): instala quando fores trabalhar nessa área (`npm install` dentro da pasta ou usa os scripts da raiz quando existirem).
4. **Variáveis:** copia os `.env.example` para `.env` apenas localmente; vê o [README](README.md) e [docs/SECURITY.md](docs/SECURITY.md).
5. **Pull requests:** descreve o problema ou feature; mantém o diff focado. Evita commits com segredos (o GitGuardian e revisão humana agradecem).

Documentação técnica detalhada: [docs/README.md](docs/README.md). Plano de evolução da estrutura de pastas: [docs/REPO_REORGANIZATION_PLAN.md](docs/REPO_REORGANIZATION_PLAN.md).
