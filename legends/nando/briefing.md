# Nando — Briefing

> ⚠️ **Jogador fictício.** Criação original do fundador, não é atleta real. Não há `beneficiary_user_id` (por isso o split não tem a cota `player`).

## Identidade

| Campo | Valor |
|---|---|
| Nome | Nando |
| Nº | 10 |
| Posição | MEI (meia armador / camisa 10) |
| País | Brasil (São Paulo) |
| Pé bom | Esquerdo |
| Idade | 24 |
| Ídolo | Diego Maradona (se espelha) |
| Arquétipo | Lenda / criador |
| Estilo | "Da vila" — driblador, corajoso, não foge de dividida |

## Conceito

Meio-campista nato da várzea paulistana. Canhoto, cria e conduz, tem o Maradona como espelho: bola no pé esquerdo, gente pra cima e a coragem de encarar qualquer dividida. Não é o mais alto nem o mais veloz, mas é quem pede a bola no aperto — resolve com drible ou briga pela camisa. Perfil de camisa 10 clássico com raça de várzea.

## Ficha de atributos (OVR 85)

| Atributo | Nota | Leitura |
|---|---|---|
| passe | 89 | Maestro — distribui e abre a defesa |
| drible | 90 | **Traço icônico** (Maradona) — 1v1, ginga |
| mentalidade | 90 | "Não foge" — decide jogo grande, raça |
| confiança | 88 | Aparece sempre, regular |
| tático | 87 | Leitura de meio nato |
| finalização | 86 | Faz gols decisivos |
| velocidade | 86 | Explosão curta, arrancada |
| físico | 82 | Baixo centro de gravidade, encara o ombro a ombro |
| marcação | 78 | Raça da vila o faz voltar, mas não vive disso |
| fair play | 74 | Se envolve, pega junto — respeitável, mas fervido |

**Média = 850 / 10 = OVR 85.** Atributos principais de meio de campo todos ≥ 85 (passe, drible, tático, mentalidade, finalização, velocidade, confiança).

## AgentProfile (resumo)

Perfil **Maestro/Criador** com apetite de risco alto (`baseRisk 70`, `dribbleVsPass 72`, sobe risco quando perde). Criatividade 92, técnica 90, visão 88. Disciplina tática mais baixa (68) — faz o que o jogo pede, no melhor estilo várzea. Zonas preferidas: terço ofensivo + meio central.

## Economia

| Campo | Valor |
|---|---|
| Trilho | **PIX** (`currency: USDT`) |
| Preço | `priceUnitCents: 100` ($1) → **~R$5** na cotação (flutua com o dólar) |
| Tier / supply | 1 / 10.000 (card democrático) |
| Rarity (visual) | épico |
| Ensina quando titular | drible + mentalidade |
| Booster de time | moral +5, ataque +6%, posse +4% |

> **Nota sobre o R$5:** o card USDT converte para R$ via `price_unit_cents × cotação`. Não dá pra travar exatamente R$5,00 — hoje `$1 ≈ R$5`. Se quiser ancorar mais perto de R$5 num dólar mais caro, baixe `priceUnitCents` (ex.: 92) ou aceite a flutuação.

## Como importar

**Opção A — painel admin (o que você pediu):**
1. Admin → GameSpirit / Legend Creator (`AdminLegendCreatorPanel`).
2. Carregar arquivo → selecione `legends/nando/legend.json`.
3. Confirme slug `nando` e importe.

**Opção B — CLI:**
```bash
npm run legend:import nando
```

**Foto:** existe `public/newplayers-olefoot/nando-nft.png` no repo. A imagem NÃO vai no JSON — depois de importar, suba o retrato pelo admin (endpoint `legend-portrait` / `legacy-player-set-portrait`) apontando pro `legacyPlayerId = legacy-nando-revelacao`.

Depois de importar, liste no mercado (`listed_on_market`) para ele aparecer pra compra.
