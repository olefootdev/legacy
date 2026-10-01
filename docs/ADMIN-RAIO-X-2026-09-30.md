# RAIO-X DO ADMIN — 2026-09-30

O produto ganhou em um dia: licenças de ativação, ciclo horário com ponto fixo e teto diário,
prêmio de carreira, Ativação 3× com contas-satélite, PIN no servidor e o card creditando em BRO.
Este raio-x compara tudo isso com a estrutura administrativa que existe — quem entra, o que cada
painel realmente faz, o que é simulação, e o plano pra fechar a diferença.

Números: **36** painéis/sub-abas · **2** features novas cobertas · **7** sem painel · **13** riscos.
Fontes: `src/admin` (36 superfícies), `server/src` (31 rotas admin), `supabase/migrations`
(210 arquivos) e o banco de produção, medido em 30/09 ~20h.

---

## 1. Acesso — e o que foi consertado nesta auditoria

O admin tem **três planos de acesso que não se conversam**:

| Plano | O que é | Estado medido em produção |
|---|---|---|
| **A · Servidor Hono** (rotas `/api/admin/*`) | Sessão do jogo com e-mail na lista (`olefootdev@` e `trader4.tfxpro@`, hardcoded em `server/src/lib/adminAuth.ts:26-27`) ou header `X-Admin-Token` | **Funciona — só pelo e-mail.** Nenhuma das 3 envs de token (`GLOBAL_LEAGUE_ADMIN_TOKEN`/`ADMIN_API_TOKEN`/`OLEFOOT_ADMIN_TOKEN`) está configurada; o `X-Admin-Token` é ignorado em silêncio |
| **B · SQL `is_admin()`** (~30 RPCs + RLS: Auditoria, Broadcast, Ligas, KYC, banimento, vocabulário, beta…) | Lê a tabela `admin_users` | **Estava MORTO**: a tabela estava vazia — nenhuma migration a semeia. `is_admin()` = false pra todo mundo |
| **C · Login do painel** (`/admin/login`, `admin_panel_users`) | E-mail + senha próprios, sessão em localStorage | **Entra mas não opera**: a sessão do painel não autoriza nenhuma rota nem RPC — quem manda é o plano A ou B |

**✓ Feito em 30/09:** as duas contas do fundador foram semeadas em `admin_users` —
`jonhnes_bsc` (trader4.tfxpro@gmail.com, `cc5d5342…`) e `olefoot_ole` (olefootdev@gmail.com,
`a81a83c5…`), com `note` de auditoria. O plano B inteiro rearmou só com isso.

**Como entrar hoje:** login **no jogo** com qualquer das duas contas → `game.olefoot.ai/admin`.
O guard (`RequireAdmin`, `src/App.tsx:209-234`) aceita a sessão do jogo com e-mail da lista;
agora o `is_admin()` também reconhece. O `/admin/login` com senha própria segue existindo, mas
é o plano mais fraco (ver Riscos 1, 4 e 6).

---

## 2. Feature nova × cobertura do admin

| Feature | Cobertura | Detalhe |
|---|---|---|
| **Licenças** (`expansao_licenca`) | ✅ **COMPLETO** | Economia → Licenças: gerar lote (1–500, patrocinador, validade), código visível uma vez (Copiar/CSV), lista com situação e filtro, revogar com motivo. `AdminLicencasPanel` → `/api/admin/licencas` |
| **Estorno de Pix** | ✅ Existe | Financeiro → Estornos (lista intents, estorna com confirmação, `needs_manual`). Falta o campo de **motivo** (a UI não coleta; `AdminRefundsSection.tsx:78`) |
| **Expansão: ciclos/teto/liquidações** | 🔴 ZERO | Nenhuma visão de `expansao_ciclo`/`expansao_liquidacao` (pago, cortado, teto). Sem botão de reprocessar — hoje é SQL Editor |
| **Expansão: árvore** | 🔴 ZERO | Admin não abre a rede de ninguém; não vê nem corrige posição/perna/patrocinador |
| **Saque do bônus (claims)** | 🔴 **NÃO EXISTE NEM NO BANCO** | `expansao_claim` é inerte: não há função de pedir, aprovar, recusar nem pagar — nem SQL, nem rota, nem tela |
| **Prêmio de carreira** | 🔴 ZERO | Sem visão agregada de `expansao_premio_carreira` |
| **Ativação 3× (satélites)** | 🔴 ZERO | `expansao_satelite` sem listagem/auditoria; no mapa do jogador satélites = indicados reais |
| **Pré-venda** | 🔴 ZERO | Abrir/fechar, teto por conta e degrau = UPDATE manual. Sem lista de compras/posições/vendidos. Hoje: **ABERTA, sem teto por conta** |
| **Vault** | 🟡 Rotas sem tela | 6 rotas prontas (`criar/aportar/sacar/marcar/colher/reconciliar` em `vault.ts:161-296`) e **nenhuma tela chama** — operação via curl, sem trilha de autor (não chamam `adminQuemAge`) |
| **PIN da carteira** | 🔴 ZERO | Sem destravar, sem ver quem está travado. Suporte sem ferramenta |
| **Card em BRO** | 🔴 ZERO | Nenhuma lista de `card_sales`/receita por card no admin (só a vista do atleta no PLAYERVIP) |

---

## 3. O painel atual: o que é real e o que é cenografia

- **Resumo e Growth** — KPIs somam `localStorage` do admin (`platformStore`); Σ BRO/SPOT **sempre 0**
  (`AdminUsuariosPanel.tsx:46-63` zera tudo). Nada lê produção.
- **Financeiro → visão/depósitos/extrato** — simulação local. Único write real: **Creditar**
  (`insert wallet_credits`, `AdminFinanceiroPanel.tsx:198`).
- **Usuários → editar/remover** — só o store local. O banimento real (`admin_set_user_status` 5-arg)
  está **quebrado**: o CSRF nunca valida (ninguém emite token em `admin_csrf_tokens`).
- **Sistema → Segurança** — 2FA mock em dois níveis (`useAdmin2FA.ts:107-115` aceita qualquer 6
  dígitos e nem é chamado; o badge não lê `two_factor_enabled` do banco) e o login manda
  `p_two_factor_code: null` fixo.

**Peso morto confirmado**: `AdminVocabularyPanel.tsx` e `AdminVoiceLibraryPanel.tsx` (~960 linhas,
zero imports); 4 atalhos do `AdminTestesHub` apontando pra abas inexistentes (caem em overview);
toda a infra de rate-limit/IP/auditoria do login do painel — criada em 25/04 e **desligada pela
migration `20260426030409`**, que reescreveu `admin_panel_login` sem ela (e devolve
`two_factor_enabled=false` fixo).

---

## 4. Riscos, do mais caro ao mais barato

1. 🔴 **Brute-force público da senha do painel** — a overload `admin_panel_login(text,text)`
   (`20260425000100:6-39`) segue viva com `execute` pra `anon`, sem rate-limit e sem registro.
   Nenhuma migration a dropou.
2. 🔴 **Seis rotas `/api/admin/*` de IA sem guarda** — `player-from-prompt`, `player/scout`,
   `player/attributes`, `player/bio`, `player/valuation`, `growth-analyst`
   (`gameSpirit.ts:42-141`): só rate-limit + Origin. Queima crédito Anthropic de quem quiser.
3. 🔴 **Sessão do jogo = chave do reino** — o JWT das contas admin dá estorno, licenças, Vault,
   PII do REVELA e magic link de lenda, sem 2FA/step-up/IP. É o mesmo token do navegador de jogar.
4. 🟡 **Sessão do painel forjável** — `VITE_ADMIN_ENCRYPTION_KEY` com fallback público
   (`'olefoot-default-key-change-in-production'`, `adminPanelAuth.ts:22`) e leitor que aceita
   plaintext (`:98-104`).
5. 🟡 **Banir quebrado + desvio aberto** — a 5-arg falha sempre (CSRF); a 2-arg antiga
   (`20260422000000:59`) segue executável por `authenticated`, protegida só pelo `is_admin()`.
6. 🟡 **Senha do painel enfraquecida** — mínimo caiu de 12+complexidade pra 8 sem regra
   (`20260425000100:59`).
7. ⚪ **Guardas por rota, não por router** — Vault/Academy/Legend/Liga Global: rota nova nasce
   desprotegida. `POST /api/academy/upload-admin-image` se chama admin e aceita qualquer jogador
   logado (`academyArt.ts:404`).
8. ⚪ **Env fantasma** — `VITE_ADMIN_EMAIL` (singular) existe no `.env`/`.env.example` e nenhum
   código lê (o código lê `VITE_ADMIN_EMAILS`).
9. ⚪ Infra morta sem cron: `check_admin_login_rate_limit`, `check_admin_ip_allowed`,
   `log_admin_action`, `cleanup_*`, `validate_admin_csrf_token` — sem nenhum chamador vivo.

(+ os já citados: 2FA mock, admin_users vazia [corrigida], login do painel não autoriza nada.)

---

## 5. Plano de atualização

### P0 — agora (segurança)
- ✅ Semear `admin_users` (feito 30/09 — as 2 contas do fundador).
- Fechar as 6 rotas de IA com `requireAdminToken` (1 linha por rota).
- **Dropar a overload anônima** `admin_panel_login(text,text)` e religar o rate-limit —
  ou aposentar o plano C de vez (só sessão do jogo + `is_admin()`).
- Guarda no router inteiro (`use('*')`) em Vault, Academy, Legend, Liga Global.
- Step-up nas rotas de dinheiro (estorno, licenças, Vault): exigir login recente —
  o mesmo relógio `amr` que o PIN da carteira já usa.

### P1 — operar as features novas
- **Painel EXPANSÃO**: ciclos por hora (pool/equiparado/pago/cortado), liquidações por pessoa com
  teto do dia, botão "fechar horas pendentes", árvore read-only de qualquer conta, satélites com
  dono, prêmios de carreira.
- **Fluxo de CLAIM do zero**: função de pedir (jogador) + aprovar/recusar/pagar (admin) + painel
  de fila. Decisão de produto embutida: o que destrava o saque.
- **Painel PRÉ-VENDA**: abrir/fechar, teto por conta, degrau, vendidos×alocação, compras, posições.
- **Suporte**: destravar PIN / ver tentativas; relatório de `card_sales` em BRO.

### P2 — honestidade do painel
- Financeiro real (Σ `wallet_credits`, receita por produto, OLEXP/OLEFOOT emitidos) no lugar da
  simulação local.
- Tela do Vault pras 6 rotas prontas, com trilha de autor.
- 2FA de verdade ou badge fora (mock de segurança é pior que ausência dita).
- Faxina: 2 painéis órfãos, 4 atalhos mortos, env fantasma, motivo no estorno, banimento religado.

### Decisões do fundador
- O login próprio do painel (plano C) **fica ou morre**? Duas portas = duas vigílias.
- Setar token de API de admin no Railway (automações) ou **abolir o `X-Admin-Token`** —
  hoje existe no código e não funciona em ambiente nenhum.
- Quem mais vira admin — `admin_users` agora é o lugar único e auditável (`added_by`, `note`).

---

*Medições de produção (30/09 ~20h): árvore com 10 nós · 0 licenças geradas · 0 claims ·
0 ciclos pagos · pré-venda aberta sem teto por conta · 2FA do painel desligado ·
`admin_users` vazia até esta noite.*
