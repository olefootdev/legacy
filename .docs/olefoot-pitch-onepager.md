# ⚽ OLEFOOT
### *O primeiro simulador de futebol com IA generativa nativa — feito no Brasil, para o mundo.*
> 🔒 **CONFIDENCIAL** — Documento restrito a investidores e parceiros estratégicos. Maio 2026.

---

## 🎯 O QUE É

**Olefoot é um simulador de gestão de futebol mobile-first** onde cada manager constrói um clube do zero, negocia jogadores em um mercado vivo, disputa partidas PvP assíncronas e evolui numa jornada de carreira de 8 tiers — do Fraldinha 🍼 à Lenda 👑.

Não é um card game. Não é um fantasy. É **Football Manager com alma brasileira e IA no núcleo** — rodando no browser, sem instalação, com economia real baseada em EXP e tokens OLEXP.

A diferença que importa: **cada decisão do manager é amplificada por IA**. O assistente técnico analisa o plantel, o Game Spirit narra a partida em tempo real e o motor tático aprende com o estilo de jogo de cada clube.

---

## 🗺️ JORNADA DO MANAGER

```
CADASTRO → CERIMÔNIA GENESIS → PLANTEL INICIAL
    ↓
MERCADO (compra/venda/leilão) ← Market Maker garante liquidez
    ↓
TREINO + STAFF → atributos evoluem, moral sobe
    ↓
PARTIDAS (Quick / Auto / Live 2D) → EXP acumulado
    ↓
RANKING MUNDIAL → desafios PvP, amistosos, missões
    ↓
TIERS: Fraldinha → Juvenil → Amador → Profissional → Campeão → Internacional → Raro → LENDA 👑
```

Cada etapa gera notificações inteligentes na **Caixa de Entrada do Clube** — lesões, contratos, humor da torcida, relatórios de scout, movimentações financeiras — tudo contextualizado, nada genérico.

---

## ⚙️ MOTOR DO JOGO

**PvP Assíncrono**
- Matchmaking por OVR (±10 pontos) contra times reais do banco de dados
- Fallback inteligente: times online → bots calibrados → nunca sem adversário
- Desafios de amistoso via inbox, com aceite automático configurável

**Market Maker**
- Liquidez garantida: o sistema sempre faz uma oferta de compra imediata
- Desconto dinâmico por posição e raridade: 20% (OVR ≥ 75) a 35% (OVR < 65)
- Goleiros e zagueiros têm desconto menor — o mercado reflete escassez real
- Feed público de atividades: cada transação aparece no social feed da Home

**Career Tiers (8 níveis)**
- Progressão por EXP vitalício acumulado — não resetável, não comprável
- Cada tier desbloqueia features, badges e status social no ranking
- De 0 EXP (Fraldinha) a 250 milhões de EXP (Lenda) — jornada de anos

---

## 🤖 IA EM CADA CAMADA

| Camada | Função | Tecnologia |
|---|---|---|
| **Game Spirit** | Narrador e árbitro da partida — resolve gols, cria narrativa minuto a minuto | Claude (Anthropic) |
| **Position Coach** | Analisa plantel e sugere formação, treino e reforços | Claude via Hono API |
| **Behavior AI** | Pressing trap, falta tática, DNA de lenda, erros de primeiro toque | Motor próprio + Claude |
| **Polish AI** | Refinamento de eventos e momentos dramáticos da partida | Claude integrado ao loop |
| **Staff Advisor** | Conselhos contextuais por papel (físico, mental, tático, GR) | Claude + regras de domínio |

A IA não é um chatbot colado na lateral. **Ela é o árbitro, o comentarista e o assistente técnico** — integrada ao loop de simulação frame a frame.

---

## 🛠️ STACK TECNOLÓGICA

```
FRONTEND          BACKEND           INFRA              IA
──────────        ──────────        ──────────         ──────────
React 18          Hono (Node)       Cloudflare Pages   Anthropic Claude
Zustand           REST + WS         Supabase (Postgres) OpenAI (fallback)
Vite              Railway           Supabase Auth
TypeScript        OpenAI SDK        Supabase Realtime
Yuka (agents)                       Pinata (IPFS/media)
```

Deploy em **Cloudflare Pages** — latência global, zero cold start. Backend em **Railway**. Banco em **Supabase** com RLS por usuário. Tokens OLEXP em cadeia (arquitetura preparada).

---

## 🏆 DIFERENCIAIS COMPETITIVOS

**vs Football Manager (Sports Interactive / SEGA)**
- FM custa R$ 250+, roda só em PC/console, sem PvP real, sem IA generativa
- Olefoot: **gratuito no browser**, PvP assíncrono nativo, IA que narra e decide em tempo real
- FM tem 40 anos de dados; Olefoot tem **arquitetura de IA que aprende com cada partida**

**vs FIFA / EA FC**
- EA FC é pay-to-win com cards aleatórios — economia opaca, sem progressão de manager
- Olefoot: **economia transparente baseada em EXP**, Market Maker com preço justo, sem loot box
- EA FC não tem simulação tática real; Olefoot tem **motor 2D com agentes Yuka e SmartField**

**Posicionamento único:** simulação profunda + economia justa + IA generativa + mobile-first + Brasil.

---

## 📈 OPORTUNIDADE

- **Mercado global de jogos de futebol mobile**: US$ 4,2 bi em 2024, crescimento de 12% a.a.
- **Brasil**: 2º maior mercado de mobile gaming da América Latina, 100M+ jogadores ativos
- **Futebol**: esporte nº 1 do país — 78% dos brasileiros se declaram fãs (Datafolha 2024)
- **Lacuna clara**: não existe simulador de gestão de futebol mobile-first com IA generativa em PT-BR
- **Modelo de receita**: EXP (moeda in-game), OLEXP (token), passes de temporada, marketplace de jogadores

O Olefoot não compete com FIFA pelo jogador casual. **Compete com Football Manager pelo manager apaixonado** — e chega onde o FM nunca chegou: no celular, em português, com IA.

---

## 📬 CALL TO ACTION

Buscamos **parceiro estratégico ou investidor-anjo** para:

1. **Escalar infraestrutura** — suportar 10k managers simultâneos (Supabase + Railway + Cloudflare)
2. **Acelerar o motor de IA** — mais chamadas Claude, cache de contexto, personalização por manager
3. **Lançamento público** — campanha de aquisição focada em comunidades de FM e FIFA no Brasil
4. **Tokenização OLEXP** — integração com carteira e marketplace on-chain

> **Ticket alvo:** R$ 500k – R$ 2M (seed) | Equity ou token allocation negociável

**Contato:** [founder@olefoot.gg](mailto:founder@olefoot.gg) | Repositório privado disponível sob NDA

---

*Olefoot — Construído com React, Supabase, Cloudflare e Claude. Jogado com paixão.*
