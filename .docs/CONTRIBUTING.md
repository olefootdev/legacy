# Contribuir

1. **Clone** o repositório e instala dependências na raiz: `npm install`.
2. **Lint / typecheck:** `npm run lint` (inclui a app web e `web/match-pitch`).
3. **Subpastas** com o seu próprio `package.json` (`server/`, `mobile/`, `web/match-pitch/`): instala quando fores trabalhar nessa área (`npm install` dentro da pasta ou usa os scripts da raiz quando existirem).
4. **Variáveis:** copia os `.env.example` para `.env` apenas localmente; vê o [README](README.md) e [docs/SECURITY.md](docs/SECURITY.md).
5. **Pull requests:** descreve o problema ou feature; mantém o diff focado. Evita commits com segredos (o GitGuardian e revisão humana agradecem).

## Mensagens de commit (parecer maduro, não “log de chat”)

O GitHub mostra a **última mensagem que tocou cada ficheiro**; não há coluna separada para “títulos bonitos”. O que transmite profissionalismo é **consistência** e **clareza** em cada commit.

**Sugestão (alinhada a [Conventional Commits](https://www.conventionalcommits.org/)):**

| Regra | Porquê |
|--------|--------|
| **Linha de assunto curta** (~50 caracteres, máx. ~72) | Evita truncatura `...` na lista de ficheiros e lê-se num relance. |
| **Imperativo em inglês** (`add`, `fix`, `remove`, não `added` / `adding`) | Padrão da indústria e das ferramentas (changelog, release). |
| **`tipo:` opcionalmente `tipo(âmbito):`** | `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `ci` — o âmbito é curto (`admin`, `api`, `pitch`). |
| **Corpo opcional** (linha em branco depois do assunto) | Para o “porquê” ou breaking changes; o assunto fica só o “o quê”. |
| **Evitar** slogans, emojis em excesso, “WIP”, texto de ferramenta (“Made with …”) | Parece rascunho, não histórico de produto. |

**Exemplos — antes (pesado) → depois (limpo):**

```
docs: mature OSS layout — README hub, repo plan, docs index, SECURITY
→ docs: add contributor docs and repository layout guide

chore: preparar repo público — .env.example sem segredo...
→ chore: redact env examples for public clone

docs: professional repo layout, remove broken legacy gitlink
→ chore: drop broken legacy submodule entry and expand gitignore
```

**Histórico antigo:** alterar commits já no `main` implica `git rebase` + `push --force` e atrapalha clones e PRs abertos — só faz sentido em repo **só teu** e com acordo da equipa. Para PRs novos, podes usar **Squash and merge** no GitHub e escrever **um** assunto limpo na caixa do merge.

Documentação técnica detalhada: [docs/README.md](docs/README.md). Plano de evolução da estrutura de pastas: [docs/REPO_REORGANIZATION_PLAN.md](docs/REPO_REORGANIZATION_PLAN.md).
