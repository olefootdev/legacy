# RELATÓRIO DE IMPLEMENTAÇÃO — campanha de lançamento

> 2026-09-29. Auditoria feita contra **produção**, não contra o código.
> 284 testes automatizados, todos passando.

---

## 1. A rota da DEX — como está hoje

```
GAME  →  [DEX no menu]  →  CARTEIRA abre  →  card EXPANSÃO  →  painel
```

| Verificado em produção | |
|---|---|
| `olefoot.ai` · `game` · `dex` · `/expansao` | **200** nos quatro |
| Menu do jogo aponta pra carteira | ✅ no bundle publicado |
| **Card EXPANSÃO dentro da carteira** | 🔴 **NÃO está no ar** |

🔴 **`npm run deploy:dex` não foi executado.** O bundle publicado da carteira
(`index-B3JIgATK.js`) não tem a string `expansao`. Quem clicar em DEX hoje chega
na carteira e **não acha a expansão** — que é exatamente a reclamação original.

**É um comando, e é o item mais barato da lista.**

---

## 2. Bônus de equiparação — o que a tela mostra

Tudo lê dado real do Supabase, com RLS. Nada é mock.

| Bloco | Fonte | Estado |
|---|---|---|
| Primeiro passo / falta ativar | `expansao_ativacao` | ✅ |
| Equiparado (herói) | `expansao_perna`, trilho equiparação | ✅ |
| Barra espelhada + sobra | o mesmo | ✅ |
| Carreira | trilho **qualificação** (não consumido) | ✅ |
| Mapa de nós | `expansao_mapa` | ✅ corrigido hoje |
| Link de convite | `expansao_pode_convidar` | ✅ |

### 🐞 O mapa de nós estava meio implementado

Lia dado real, **e desenhava errado**: toda ligação saía da raiz `VOCÊ`,
ignorando o `paiId` que a consulta já trazia. No nível 3 virava leque, não
árvore — parecia funcionar e mentia sobre a forma da rede.

Corrigido: cada nó liga ao **pai de verdade**; pai fora da janela carregada
desenha pontilhado (dizendo que há caminho não mostrado); coluna com mais de 6
pessoas colapsa em `+N`. As duas margens (Time 1 acima, Time 2 abaixo) e a
distinção equipe × derramamento já estavam certas e vêm do banco.

---

## 3. A cadeia de compra — testada ponta a ponta

Simulação completa em produção, **com rollback**:

| # | Etapa | Resultado |
|---|---|---|
| 1 | Compra de \$10 creditada | ✅ |
| 2 | `pode_convidar` vira **true** | ✅ |
| 3 | Dois convidados entram | **Time 1 e Time 2** (balanceou) |
| 4 | Bônus **ativa** (1/1) | ✅ |
| 5 | Compra de \$250 de um deles | volume sobe pra mim **e** pra ORIGEM 7 |

Nada ficou gravado — conferido depois: 0 compras, 0 vendidos.

---

## 4. 🔴 DEVNET: não existe, e é bom saber agora

**Não há como comprar pacote em devnet.** Não existe:

- mint criado (nem devnet, nem mainnet)
- nenhuma linha de código de devnet, `clusterApiUrl`, `createMint` ou Token-2022
- nenhuma variável de ambiente com endereço de token

A pré-venda de hoje é **Pix em reais** → posição travada no banco. O OLEFOOT
on-chain é etapa posterior, e o roadmap que você definiu é: criar o mint →
testar no faucet → lançar.

⚠️ E lembrando o que trava essa etapa: a extensão `TransferFee` **tem que estar
na criação do mint**. Depois não se adiciona.

---

## 5. O que está pronto e o que não está

### Pronto e em produção
Domínios · CORS · Supabase Auth · banco da pré-venda · banco do bônus · motor
do bônus (150 testes) · packs · trava de 85% · convite com confirmação ·
ativação da casa · painel · estrutura ORIGEM com 9 contas · rota da pré-venda.

### 🔴 Não existe
| | Consequência |
|---|---|
| **Rotina horária do ciclo** | OLEXP acumula e **nunca vira bônus** |
| **Fluxo de claim** | ninguém saca, nem digitalmente |
| Mint / devnet | o token não existe |

O motor e o banco dos dois primeiros estão prontos (`fecharCiclo`,
`expansao_ciclo`, `expansao_liquidacao`, `auditarClaim` com teto de 1%/dia).
Falta a rota que os liga.

**Nenhum deles impede a pré-venda vender hoje.** Impedem o bônus **pagar** — o
que só importa depois que houver receita formando pool.

---

## 6. Para lançar a campanha hoje

| # | Ação | De quem |
|---|---|---|
| 1 | `npm run deploy:dex` | você — **sem isso a jornada não fecha** |
| 2 | `npm run deploy:cloudflare` | você — leva o mapa corrigido |
| 3 | Comprar 1 pack de \$10 com Pix real | você — único elo nunca percorrido |
| 4 | Verificar webhook + posição | eu, na hora |

### Ainda sem número
- **Teto mensal do marketing** (você disse: semana que vem)
- **Resend não verificado** no `olefoot.ai` → reset de senha não sai

### Decisão que continua aberta
As 9 contas-selo ficam no topo acumulando volume de toda a rede, e você disse
que vai negociá-las. Isso precisa estar no material da pré-venda junto dos
4,20% que a taxa de transferência retém — alguém vai calcular, e é melhor que o
número venha de nós.
