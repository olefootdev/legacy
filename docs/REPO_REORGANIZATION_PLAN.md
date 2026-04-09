# Plano de reorganização do repositório (Olefoot Legacy)

Documento de **arquitetura alvo** e **migração incremental**. Nada aqui obriga mudanças imediatas; cada fase deve ser uma PR pequena, com CI e `npm run lint` a passar.

---

## 1. Diagnóstico atual (objetivo)

| Área | Estado |
|------|--------|
| **App web principal** | Vite + React na **raiz** (`src/`, `index.html`, `vite.config.ts`). É o “coração” do manager e do estado do jogo. |
| **Viewer 3D** | Pacote Vite isolado em `web/match-pitch/`. |
| **Mobile** | Expo em `mobile/`. |
| **API** | Hono em `server/`. |
| **Infra DB** | `supabase/` (migrations + CLI). |
| **Documentação** | Maioria já em `docs/`; README na raiz é a entrada. |
| **`legacy/`** | **Não versionada** (`.gitignore`). É um **checkout local opcional** de outro repositório (histórico de “site/marketing” ou espelho). **Não é duplicação do código deste monorepo** — evita o antigo gitlink quebrado sem `.gitmodules`. |
| **`.agents/`** | Recursos para Cursor; não faz parte do runtime da aplicação. |

---

## 2. Problemas identificados

1. **Raiz “pesada”** — mistura config da app web (`package.json`, `vite.config.ts`, `src/`, `public/`) com pastas de outros produtos (`mobile/`, `server/`, `web/`). Novos contribuidores precisam de 1–2 minutos para mapear; não é errado, mas **não escala visualmente** como um monorepo com `apps/`.
2. **“Game engine” acoplado à UI** — `src/` contém páginas React, `src/game`, `src/match-engine`, `src/gamespirit`, etc. Isto é **responsabilidade misturada por decisão histórica**; extrair `/services/game-engine` exigiria fronteiras npm/workspace e muitos imports.
3. **Nome `STRUCTURAL_REORGANIZATION.md`** — no `docs/` refere-se a **parâmetros de simulação no campo**, não à estrutura do Git. Pode confundir; o índice em `docs/README.md` esclarece.
4. **Licença** — não há `LICENSE` na raiz do monorepo (apenas possível cópia dentro de `legacy/` local ignorada). Convém definir licença na raiz numa PR à parte.

---

## 3. Estrutura proposta (alvo)

Alinhada ao pedido, com **mapeamento do estado atual**:

```
apps/
  web/              ← hoje: raiz (Vite manager)
  mobile/           ← hoje: mobile/
  viewer/           ← hoje: web/match-pitch/

services/
  api/              ← hoje: server/
  game-engine/      ← futuro: fatiar de src/ (GameSpirit, match-engine, engine, simulation…)

infra/
  supabase/         ← hoje: supabase/

docs/               ← já existe
```

**Justificativa:** separa **entregáveis** (`apps/*`) de **backend** (`services/api`) e **dados** (`infra/supabase`). `game-engine` só faz sentido quando houver pacote com API estável e testes; até lá, manter código em `src/` evita refator massiva.

---

## 4. Plano de migração (passo a passo seguro)

| Fase | Ação | Risco |
|------|------|--------|
| **0** | Manter documentação e README alinhados (portas, scripts). **Sem mover pastas.** | Baixo |
| **1** | Introduzir **npm/pnpm workspaces** na raiz *sem* mover ficheiros: `packages: []` ou workspaces apontando para `.`, `server`, `mobile`, `web/match-pitch`. | Médio — validar `npm install` em CI |
| **2** | Mover `server/` → `services/api/` (ou `apps/api` se preferires BFF “app”): atualizar `dev:server`, documentação, paths em scripts. | Médio |
| **3** | Mover `web/match-pitch/` → `apps/viewer/`: atualizar `dev:pitch`, mobile `dev:pitch`, WebView docs. | Médio |
| **4** | Mover app da raiz → `apps/web/`: `vite.config`, `index.html`, `src/`, `public/`; ajustar CI, Storybook se existir, caminhos relativos. | **Alto** — fazer só com branch longa ou várias PRs |
| **5** | Mover `supabase/` → `infra/supabase/`: atualizar `supabase link`, docs, pipelines. | Médio |
| **6** | Extrair `services/game-engine` (TypeScript package): começar por módulos sem UI (`src/match-engine`, partes de `src/game`); consumir desde `apps/web`. | Alto, contínuo |

Entre cada fase: `npm run lint`, smoke manual (web + API + pitch), e um commit de “fix paths only” se necessário.

---

## 5. Limpeza da raiz — o que fica vs o que sai (alvo)

**Hoje (aceitável):** na raiz ficam ficheiros da **app web principal** + pastas irmãs. Isto é o padrão “Vite default”.

**Alvo maduro:** na raiz apenas:

- Metadados do monorepo: `package.json` (workspaces), `README.md`, `CONTRIBUTING.md`, `LICENSE`, `.gitignore`, `.env.example`
- Opcional: `turbo.json` / `pnpm-workspace.yaml`
- **Sem** `src/` nem `index.html` (passam para `apps/web/` na fase 4)

Até lá, **não remover** `src/` da raiz — é onde o produto principal vive.

---

## 6. `legacy/` — remoção, movimento ou integração

| Opção | Quando usar |
|-------|-------------|
| **Manter ignorada (atual)** | Tens um segundo repo (marketing/docs) e queres cloná-lo lado a lado como `legacy/` sem poluir o histórico. |
| **Apagar pasta local** | Se não precisares do outro repo; **não afeta** o Git do monorepo (já não é submódulo). |
| **Submódulo Git formal** | Só com `.gitmodules` + URL pública + instruções `git submodule update --init`. |

**Não integrar** o conteúdo de `legacy/` no código da app sem revisão explícita de licença e duplicação.

---

## 7. O que **não** alterar (sem necessidade forte)

- Lógica de negócio em `src/game`, motores de partida, ou contratos de bridge com o viewer.
- Migrations em `supabase/migrations` (exceto novas features).
- Nomes de variáveis de ambiente já documentadas, sem período de deprecação.
- `.agents/` (ferramenta local; pode permanecer ignorada parcialmente por política de equipa, mas hoje está versionada como skills do projeto).

---

## 8. Referências no repositório

- [README.md](../README.md) — porta de entrada.
- [ARCHITECTURE.md](./ARCHITECTURE.md) — camadas lógicas **hoje**.
- [README.md](./README.md) — índice de toda a documentação técnica.
