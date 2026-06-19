# Plano — Melhorias do Processo de Compra (Mercado de Legacies)

> Status: proposta para 1 sessão. Base já no ar: compra atômica server-side
> (`POST /api/market/buy-legacy`) + compra ciente de saldo OLEFOOT no modal
> (entregue em 2026-06-19).

## Contexto atual (como funciona hoje)

| Camada | Arquivo | Papel |
|---|---|---|
| Card → detalhe | `src/pages/TransferLegaciesTab.tsx` | grid/lista + estado de compra |
| Modal de detalhe | `src/components/legacy/LegacyPlayerDetailModal.tsx` | preço + CTA por saldo |
| Compra OLEFOOT | `src/pages/TransferLegaciesTab.tsx` → `buy()` | `POST /api/market/buy-legacy` |
| Compra PIX | `src/components/PixCheckoutModal.tsx` | AbacatePay + polling 3s |
| Débito atômico | `server/src/routes/market.ts` (`/buy-legacy`) | debita `legacy_olefoot_credits`, entrega player |
| Saldo real | `fetchMyOlexpBalance()` (`src/wallet/olexpSync.ts`) | RPC `get_my_olexp_balance` |

**3 moedas que confundem:** OLE (jogo, `finance.ole`) · OLEFOOT (`legacy_olefoot_credits`, paga legacy) · PIX (R$, top-up). O fix de 2026-06-19 já alinhou frontend↔servidor (checa OLEFOOT real).

## Problemas remanescentes (priorizados)

1. **Feedback por `window.alert`** — quebra imersão; sem recibo de compra.
2. **Sem trava de duplo-clique** — botão não desabilita durante o request → risco de compra dupla.
3. **Sem confirmação em compra de alto valor** — 1M OLEFOOT em 1 clique.
4. **PIX repete dados** (CPF/nome/email/telefone) a cada compra.
5. **Cotação R$ em `loading`/`error`** some o PIX silenciosamente.
6. **Saldo só recarrega ao montar a aba** — após PIX confirmado (webhook), o saldo na tela fica velho.

---

## Plano de implementação (1 sessão, ~4–5h)

### Fase 1 — Robustez da compra (must-have, ~1.5h)
**Objetivo:** zero compra dupla, feedback claro.

- [ ] `LegacyPlayerDetailModal`: adicionar prop `buying?: boolean`; desabilitar o botão e trocar label para "Comprando…" enquanto em voo.
- [ ] `TransferLegaciesTab`: estado `buyingId: string | null`; setar antes do `fetch`, limpar no `finally`. Ignorar clique se já `buying`.
- [ ] Guard de idempotência no servidor: `market.ts` já é atômico no débito, mas adicionar checagem "player já no squad → `already_owned`" como resposta amigável (já existe parcialmente; confirmar retorno e tratar no client sem `alert`).
- **Aceite:** clicar 2× rápido compra 1 vez; UI nunca trava.

### Fase 2 — Recibo no lugar do alert (must-have, ~1h)
**Objetivo:** confirmação visual de sucesso/erro.

- [ ] Novo `PurchaseReceiptModal` (ou reusar toast existente — checar `src/components/` por toast/Sonner): mostra foto + nome + "entrou no seu elenco" + novo saldo OLEFOOT.
- [ ] Erros (402 saldo, 409 owned, rede): mensagem inline no modal, sem `alert`.
- **Aceite:** sucesso e os 3 erros têm UI dedicada.

### Fase 3 — Confirmação por limiar + saldo vivo (~1h)
- [ ] Acima de um limiar (ex.: ≥ 100k OLEFOOT) inserir passo "Confirmar compra de X" antes do débito.
- [ ] Após PIX confirmado (`onSuccess` do `PixCheckoutModal`) e após compra OLEFOOT, chamar `refreshOlefootBalance()` (já existe) — garantir que o `PixCheckoutModal.onSuccess` também dispare o refresh.
- **Aceite:** saldo na tela bate com o servidor logo após qualquer compra.

### Fase 4 — PIX sem fricção (nice-to-have, ~1h)
- [ ] Pré-preencher CPF/nome/email/telefone do perfil Supabase (`profiles`/auth metadata).
- [ ] Estado explícito quando `quote.status !== 'ok'`: "Cotação indisponível, tente em instantes" em vez de sumir o botão.
- **Aceite:** segunda compra PIX não re-digita dados.

---

## Fora de escopo (registrar para depois)
- Unificar as 3 moedas numa "carteira" única na UI (projeto maior, decisão de produto).
- Histórico de compras / extrato no perfil.
- Carrinho multi-item (hoje é 1 player por vez).

## Riscos
- `PixCheckoutModal.onSuccess` hoje dá `window.alert` — trocar exige cuidado pra não perder o sinal de entrega do webhook.
- Limiar de confirmação: alinhar valor com fundador (produto).
