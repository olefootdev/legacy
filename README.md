<div align="center">

<img src="https://game.olefoot.com/olefoot-logo.png" alt="Olefoot" width="120" />

# ⚽ OLEFOOT

### *O primeiro simulador de gestão de futebol com IA generativa nativa — feito no Brasil, para o mundo.*

[![Deploy](https://img.shields.io/badge/deploy-Cloudflare%20Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white)](https://game.olefoot.com)
[![Backend](https://img.shields.io/badge/backend-Railway-0B0D0E?style=flat-square&logo=railway&logoColor=white)](https://railway.app)
[![Database](https://img.shields.io/badge/database-Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![AI](https://img.shields.io/badge/AI-Anthropic%20Claude-D97706?style=flat-square)](https://anthropic.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![License](https://img.shields.io/badge/license-Private-red?style=flat-square)](.)

---

**[🎮 Jogar Agora](https://game.olefoot.com)** · **[📋 Pitch Deck](./olefoot-pitch-onepager.md)** · **[🐛 Issues](../../issues)**

</div>

---

## O que é o Olefoot

Olefoot é um **simulador de gestão de futebol mobile-first** onde cada manager constrói um clube do zero, negocia jogadores em um mercado vivo com liquidez garantida, disputa partidas PvP assíncronas contra times reais e evolui numa jornada de carreira de 8 tiers — do **Fraldinha 🍼** à **Lenda 👑**.

Não é um card game. Não é um fantasy. É Football Manager com alma brasileira e IA no núcleo — rodando no browser, sem instalação.

---

## Jornada do Manager

```
CADASTRO → CERIMÔNIA GENESIS → PLANTEL INICIAL (11 titulares + reservas)
     ↓
MERCADO EXP ← Market Maker garante liquidez imediata (desconto 20–35%)
     ↓
TREINO + STAFF → atributos evoluem, moral sobe, contratos renovam
     ↓
PARTIDAS PvP ← matchmaking assíncrono contra times reais do banco
     ↓
RANKING MUNDIAL → EXP acumulado → Plano de Carreira
     ↓
🍼 Fraldinha → 🌱 Juvenil → ⚽ Amador → 🎽 Profissional
→ 🏆 Campeão → 🌍 Internacional → 💎 Raro → 👑 Lenda
```

---

## Stack Tecnológica

| Camada | Tecnologia | Função |
|---|---|---|
| **Frontend** | React 18 + TypeScript + Vite | SPA mobile-first |
| **Estado** | Zustand + localStorage | Save local offline-first |
| **UI** | Tailwind CSS + Motion | Animações e layout |
| **Deploy** | Cloudflare Workers | CDN global, zero cold start |
| **Backend** | Hono (Node.js) + Railway | API privilegiada, IA server-side |
| **Banco** | Supabase (Postgres + RLS) | Auth, squads, mercado, ranking |
| **IA** | Anthropic Claude | Coach, Assistant, Voice, Game Spirit |

---

## IA em Cada Camada

```
┌─────────────────────────────────────────────────────┐
│                  ANTHROPIC CLAUDE                    │
├──────────────┬──────────────┬───────────────────────┤
│  COACH AI    │  GAME SPIRIT │  ASSISTANT (ASSIST+)  │
│  Analisa     │  Narra a     │  Responde perguntas   │
│  plantel e   │  partida em  │  estratégicas sobre   │
│  sugere      │  tempo real  │  o clube em PT-BR     │
│  formação    │              │                       │
├──────────────┴──────────────┴───────────────────────┤
│  VOICE COMMANDS — comandos em linguagem natural      │
│  "Coloca o Rodrigo no lugar do atacante"             │
└─────────────────────────────────────────────────────┘
```

---

## Motor de Partida

O motor roda **100% no cliente** — sem latência, sem custo de servidor por partida.

- **Partida Rápida** — PvP assíncrono contra times reais (OVR ±10), fallback para bots calibrados
- **Partida Global** — liga com rodadas automáticas (ativa com 32 managers)
- **Pênaltis** — motor probabilístico por posição e força do adversário
- **Market Maker** — liquidez garantida: o sistema sempre compra seu jogador na hora

---

## Estrutura do Projeto

```
/
├── src/
│   ├── pages/          # Rotas principais (Home, Team, Transfer, Match*)
│   ├── game/           # Reducer, store Zustand, tipos, estado inicial
│   ├── engine/         # Motor de partida minuto a minuto
│   ├── match/          # Matchmaking, simulador global, consequências
│   ├── market/         # Market Maker (desconto dinâmico)
│   ├── systems/        # Economia, carreira, lesões, moral, logística
│   ├── supabase/       # Clientes e persistência (squads, mercado, auth)
│   ├── components/     # UI compartilhada (Layout, SmartHub, modais)
│   └── admin/          # Painel admin (usuários, mercado, config)
├── server/             # Hono API (Railway) — IA, admin, mercado
├── supabase/
│   └── migrations/     # SQL migrations versionadas
└── olefoot-pitch-onepager.md
```

---

## Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Variáveis de ambiente
cp .env.example .env
# Preencher VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_OLEFOOT_API_URL

# Rodar frontend
npm run dev

# Rodar servidor (Railway local)
cd server && npm run dev
```

---

## Deploy

```bash
# Frontend → Cloudflare Workers
npm run build && wrangler deploy

# Backend → Railway (auto-deploy via git push)
git push origin main
```

---

<div align="center">

**Olefoot** é um repositório privado.  
Acesso mediante NDA para investidores e parceiros estratégicos.

*Construído com ⚽ no Brasil.*

</div>
