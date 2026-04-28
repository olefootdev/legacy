---
title: "Olefoot · Legacy Tech Design System"
subtitle: "Manual de Identidade Visual e Componentes — Abr/2026"
author: "Olefoot Game"
date: "2026-04-28"
---

# Olefoot · Legacy Tech

**Manual de Identidade Visual e Componentes**
v1.0 — Abr/2026

---

## Sumário

1. [Filosofia](#1-filosofia)
2. [Voz da marca](#2-voz-da-marca)
3. [Cores e tokens](#3-cores-e-tokens)
4. [Tipografia](#4-tipografia)
5. [Espaçamento, raio e elevação](#5-espaçamento-raio-e-elevação)
6. [Iconografia e ilustração](#6-iconografia-e-ilustração)
7. [Componentes-base](#7-componentes-base)
8. [Padrões editoriais](#8-padrões-editoriais)
9. [Page archetypes](#9-page-archetypes)
10. [Movimento e micro-interações](#10-movimento-e-micro-interações)
11. [Acessibilidade](#11-acessibilidade)
12. [Anti-patterns (o que não fazer)](#12-anti-patterns)

---

## 1. Filosofia

**Legacy Tech** é o nome do sistema visual do Olefoot. Ele combina três correntes:

- **BVB Rebrand 2023 (DesignStudio)** — preto + amarelo neon, divisores afiados, tipografia editorial.
- **Sorare** — cards de jogador como protagonistas, raridade como linguagem, OVR Moret italic em destaque.
- **Editorial esportivo (FourFourTwo, The Athletic)** — texto serif para emoção, sans-serif display para identidade, tabelas tabulares para dados.

A síntese entrega um produto que **respeita o jogador**: hierarquia clara, tipografia poderosa, dados legíveis e momentos cinematográficos sem ruído visual.

Princípios:

1. **Preto absoluto é o palco**, amarelo neon é a luz.
2. **Moret italic** sempre que houver número, nome próprio ou citação.
3. **Agency uppercase tracking-wide** sempre que houver chamada ou label.
4. **Inter regular** sempre que houver leitura corrida.
5. **Régua amarela 12×3px** abre seções editoriais; **rail amarelo 3px à esquerda** marca cards-âncora.
6. **Não se inventa cor** — se não está nos tokens, não vai pro UI.

---

## 2. Voz da marca

Tom: direto, brasileiro, com peso editorial. Tutela como técnico que confia no jogador.

| Faça | Não faça |
|---|---|
| "Treina com Pelé" | "Clique aqui para treinar com Pelé" |
| "Bom jogo." | "Boa partida! Volte sempre 😊" |
| "Garante o teu Legacy" | "Compre seu pacote agora" |
| "A bola está rolando" | "O sistema está processando..." |

- Sempre **2ª pessoa do singular** ("treinas", "vês", "queres") — soa coach.
- Frases curtas, peso de manchete.
- Emoji só quando carregar significado funcional (🔥 streak, ⚠ aviso, 🏆 troféu). Nunca enfeite.
- Números sempre tabular-nums, separador `1.247` (pt-BR).

---

## 3. Cores e tokens

### Tokens primitivos (CSS variables)

```css
/* Identidade */
--color-neon-yellow: #FDE100;
--color-deep-black:  #0D0D0D;
--color-dark-gray:   #1A1A1A;

/* Estados */
--color-success:  #22C55E;  /* "entra" / vitória / saldo positivo */
--color-warning:  #F59E0B;  /* fadiga 60-79% / 2º amarelo */
--color-danger:   #EF4444;  /* lesão / expulsão / derrota */

/* Estrutura */
--color-card:           rgba(26,26,26,0.95);
--color-panel-elevated: rgba(20,20,20,0.92);
--color-border:         rgba(255,255,255,0.08);
--color-divider-yellow: rgba(253,225,0,0.18);
```

### Hierarquia de superfícies

```
deep-black (#0D0D0D)   ← fundo da página
   └── dark-gray       ← card / painel
         └── deep-black/60  ← header interno
               └── deep-black/40  ← input ativo
```

### Texto sobre fundo escuro

| Função | Cor |
|---|---|
| Headline primário | `#fff` |
| Texto corrido | `text-white/85` |
| Subtítulo | `text-white/65` |
| Metadata | `text-white/55` |
| Helper / disabled | `text-white/45` |
| Watermark | `text-white/15` |

### Texto sobre fundo amarelo (hero)

| Função | Cor |
|---|---|
| Headline | `text-black` |
| Subtítulo | `text-black/85` |
| Metadata | `text-black/65` |
| Link discreto | `text-black/55` |

### Estados acentuados

- **Selecionado / ativo:** `bg-neon-yellow/[0.05-0.08]` + rail amarelo 3px à esquerda.
- **Hover:** sobe 0.5px (`hover:-translate-y-0.5`) + borda neon-yellow/40.
- **Press mobile:** `active:scale-[0.94-0.98]` (sem ripple).

---

## 4. Tipografia

### Famílias

| Token | Família | Uso |
|---|---|---|
| `var(--font-display)` | Agency FB (fallback Impact) | Headlines, labels, CTAs, eyebrows |
| `var(--font-serif-hero)` | Moret Italic | Números (OVR, score, rating), nomes próprios, citações, headlines emocionais |
| `var(--font-sans)` | Inter | Texto corrido, helper, descrições |
| `var(--font-ui)` | Inter | Metadata curta, selo, taxa, contador |

### Escalas

**Display (Agency uppercase, tracking-wide):**

| Uso | Tamanho | Tracking | Weight |
|---|---|---|---|
| Hero CTA | `clamp(13-14px)` | 0.22-0.32em | 900 |
| Headline section | `clamp(11-12px)` | 0.22-0.28em | 800 |
| Eyebrow | `10px` | 0.28-0.32em | 800 |
| Nav label | `10-11px` | 0.22em | 800 |
| Tag/badge | `9-10px` | 0.22em | 900 |
| Helper count | `9-10px` | 0.16em | 700 |

**Moret italic editorial:**

| Uso | Tamanho |
|---|---|
| Score postgame / OVR hero | `clamp(48-72px)` |
| OVR card (foto) | `clamp(28-40px)` |
| Rating MVP | `clamp(28-40px)` |
| Stat editorial | `clamp(20-28px)` |
| Headline section (Legend) | `clamp(28-40px)` |
| Quote / blockquote | `clamp(15-22px)` |

Todas com `letter-spacing: -0.02 a -0.04em` e `tabular-nums` quando numérico.

**Inter (corrido):**

| Uso | Tamanho | Weight |
|---|---|---|
| Texto card | 13px | 400-500 |
| Texto descrição | 12-13px | 400 |
| Helper / metadata | 10-11px | 500-600 |

### Regras de aplicação

1. **Nunca uppercase Moret** — Moret italic vive em proper-case ou minúsculas.
2. **Nunca italic Agency** — Agency é uppercase tracking-wide, sempre reto.
3. **Nunca tracking em Inter** — Inter respira no normal.
4. **Headlines compostas (duo)** alternam:
   `EYEBROW Agency` → `Nome` Moret italic → régua amarela.
5. **Números sempre `tabular-nums`** para evitar pulinhos.

---

## 5. Espaçamento, raio e elevação

### Raios

```css
--radius-sm:   4px;   /* botões, tags, inputs */
--radius-md:   8px;   /* cards, painéis */
--radius-pill: 9999px; /* pílulas, FABs */
```

### Espaçamentos

Sistema 4-base. Padrões mais usados:

| Contexto | Padding | Gap |
|---|---|---|
| Card editorial | `p-4 sm:p-5` | `gap-3 sm:gap-4` |
| Hero principal | `px-5 sm:px-8 py-8 sm:py-12` | — |
| Lista de items | `gap-2 sm:gap-3` | — |
| Form field | `px-3 py-2 / py-2.5` | `gap-2.5` |
| CTA primário | `px-6-10 py-3-4` | `gap-2` |

### Elevação (sombras)

| Nível | Shadow |
|---|---|
| Card editorial | `0_8px_24px_rgba(0,0,0,0.18)` |
| Hero panel | `0_24px_48px_rgba(0,0,0,0.18)` |
| CTA dominante (amarelo) | `0_8px_24px_rgba(253,225,0,0.18)` |
| FAB | `0_4px_18px_rgba(0,0,0,0.18)` |
| Modal full | `0_20px_60px_rgba(0,0,0,0.7)` |
| Glow neon ativo | `0_0_12px_rgba(253,225,0,0.55)` |

---

## 6. Iconografia e ilustração

- Biblioteca única: `lucide-react`. Nada de mistura.
- Stroke padrão: `2`. Em estados ativos/destaque: `2.5`.
- Tamanho default: `w-4 h-4` (inline) ou `w-5 h-5` (nav).
- Cor segue o contexto do texto (`currentColor`). Acento neon-yellow só nos itens active/accent.

**Ícones canônicos do sistema:**

| Função | Ícone |
|---|---|
| Home | `Home` |
| Plantel | `Users` |
| Competição | `Trophy` |
| Memoráveis (Legend) | `Crown` |
| Mercado | `ArrowRightLeft` |
| Manager | `User` |
| Wallet | `Wallet` |
| Ajuda | `GraduationCap` |
| Sair | `LogOut` |
| Buscar | `Search` |
| Curtir | `Heart` |
| Compartilhar | `Share2` |
| Voltar | `ArrowLeft` |
| Avançar | `ChevronRight` |

**Fotografia de jogador:**
- Aspecto **4/5 portrait**.
- Filtro padrão: `grayscale(1) contrast(1.05)` (classe `.ole-player-photo-bw`).
- Hover/foco: remove grayscale (transição 300-500ms) — assinatura do view-player-card.
- OVR sempre como overlay top-left em Moret italic + drop-shadow forte.

---

## 7. Componentes-base

### 7.1 Botões

#### Primário (amarelo dominante)
```tsx
<button
  className="bg-neon-yellow text-black px-6 py-3 font-display font-black uppercase
             hover:bg-white active:scale-[0.99] transition-all"
  style={{
    fontSize: '13px',
    letterSpacing: '0.24em',
    borderRadius: 'var(--radius-sm)',
    boxShadow: '0 8px 24px rgba(253,225,0,0.18)',
  }}
>
  Ação dominante
</button>
```

#### Secundário (outline)
```tsx
className="border border-white/20 bg-deep-black/60 text-white/85
           hover:border-neon-yellow/50 hover:text-neon-yellow"
```

#### Ghost / link discreto
```tsx
className="text-white/55 hover:text-neon-yellow transition-colors
           font-display font-bold uppercase tracking-[0.22em] text-[11px]"
```

#### Pílula social (curtir / share)
```tsx
className="border-2 border-black/30 bg-black/10 px-4 py-2
           hover:bg-black hover:text-neon-yellow"
style={{ borderRadius: 'var(--radius-pill)' }}
```

### 7.2 Cards

**Card padrão Legacy Tech:**

```tsx
<div
  className="border border-l-[3px] border-[var(--color-border)] border-l-neon-yellow
             bg-dark-gray transition-all
             hover:border-neon-yellow/40 hover:-translate-y-0.5"
  style={{ borderRadius: 'var(--radius-md)' }}
>
  ...
</div>
```

Variações por intenção:
- **Destaque/MVP/ouro:** `border-l-neon-yellow`
- **Aviso (fadiga, lesão):** `border-l-[var(--color-warning)]`
- **Crítico (expulso, derrota):** `border-l-[var(--color-danger)]`
- **Sucesso (vitória, entra):** `border-l-[var(--color-success)]`
- **Neutro:** `border-l-white/15`

### 7.3 Inputs

```tsx
<input
  className="border border-white/15 bg-deep-black/60 px-3 py-2.5
             text-sm text-white placeholder:text-white/35
             focus:border-neon-yellow/55 focus:outline-none"
  style={{ borderRadius: 'var(--radius-sm)' }}
/>
```

### 7.4 Eyebrow + Headline duo (assinatura)

```tsx
<div>
  <span aria-hidden className="block h-px w-8 bg-neon-yellow/55" />
  <span className="font-display font-black uppercase text-neon-yellow"
        style={{ fontSize: '10px', letterSpacing: '0.32em' }}>
    Olefoot · Hall of Fame
  </span>
  <h1 className="italic text-neon-yellow leading-[0.95]"
      style={{ fontFamily: 'var(--font-serif-hero)',
               fontSize: 'clamp(28px, 4.5vw, 40px)',
               fontWeight: 700,
               letterSpacing: '-0.02em' }}>
    Mural dos Managers
  </h1>
  <span aria-hidden className="block w-12 h-[3px] bg-neon-yellow mt-2" />
</div>
```

### 7.5 Section header (rail amarelo 3px + headline Moret)

```tsx
<header className="flex items-center gap-3 mb-6">
  <span aria-hidden className="w-1 h-8 bg-neon-yellow" />
  <h2 className="italic text-neon-yellow leading-none"
      style={{ fontFamily: 'var(--font-serif-hero)', fontWeight: 700,
               fontSize: 'clamp(28px, 4.5vw, 40px)', letterSpacing: '-0.02em' }}>
    DNA do Campeão
  </h2>
</header>
```

### 7.6 Badge / Tag

```tsx
<span className="inline-flex items-center bg-neon-yellow text-black px-2 py-0.5
                 font-display font-black uppercase shadow-[0_0_14px_rgba(253,225,0,0.45)]"
      style={{ fontSize: '9px', letterSpacing: '0.22em',
               borderRadius: 'var(--radius-sm)' }}>
  MVP
</span>
```

### 7.7 Bottom Nav (mobile)

- `fixed bottom-0` + `bg-deep-black/95 backdrop-blur` + `pb-safe`.
- Régua amarela top: `gradient from-transparent via-neon-yellow/55 to-transparent`.
- Item ativo: bg `neon-yellow/[0.05]` + rail top 3px + glow.
- Label Agency 800 10px tracking 0.22em.
- Item editorial (Memoráveis): Moret italic + ícone amarelo permanente.

---

## 8. Padrões editoriais

### 8.1 view-player-card (horizontal)

Estrutura canônica para qualquer card de jogador horizontal:

```
┌──────────────┬──────────────────────────────────────┐
│ Foto (B&W→cor)│  HEADER  ┊  TAG (moeda/raridade)  │
│ OVR Moret    │  Nome (Agency 800 uppercase)       │
│ POS chip     │  meta (nação · homonym)            │
│ Ouro? badge  ├──────────────────────────────────────┤
│              │  STATS grid 3 cols                  │
│              │  PAC 78  SHO 81  PAS 74           │
│              ├──────────────────────────────────────┤
│              │  Encerra em 2h  ┊  CTA AMARELO   │
│              │  💰 1.2M EXP                        │
└──────────────┴──────────────────────────────────────┘
```

Implementações: `TransferRowCard`, `QuickPlayerRowCard`, `LegendSearchModal` cards.

### 8.2 Hero Matchday / Postgame (cinematográfico)

```
[Eyebrow Agency tracking-wide]
[Nome Moret italic clamp(72-144px)]
[Régua amarela 12×3px]
[Metadata data textual em Agency tracking 0.28em]
[Foto 4/5 + OVR badge top-left + tag top-right]
[Quote Moret italic]
[CTA dominante amarelo]
[Linha social: like + share]
```

Implementações: `Legend`, `MatchdayHero` (highlight do MVP), `Postgame`.

### 8.3 Modal full-screen Legacy Tech

```tsx
<motion.div
  className="fixed inset-0 z-[200] bg-deep-black/95 backdrop-blur"
  onClick={onClose}
>
  <motion.div
    onClick={(e) => e.stopPropagation()}
    className="border border-l-[3px] border-l-neon-yellow bg-dark-gray"
    style={{ borderRadius: 'var(--radius-md)' }}
  >
    {/* Header amarelo + título Moret + botão X */}
    {/* Body com lista/conteúdo */}
    {/* Footer hint "ESC pra fechar" */}
  </motion.div>
</motion.div>
```

Sempre clicável no backdrop + ESC + foco automático no input quando houver.

### 8.4 Chat scriptado (intervalo / assistente)

Mensagens com `choices` clicáveis em pilha vertical:

```tsx
{
  role: 'assistant',
  text: 'Chegamos no intervalo, queres mudar algo?',
  choices: [
    { label: '1) Mudar formação', value: 'ht:menu:formation' },
    { label: '2) Estilo de jogo', value: 'ht:menu:style' },
    { label: '3) Substituir jogador', value: 'ht:menu:sub' },
  ],
  onChoice: (value, label) => { ... },
}
```

Botões de escolha: borda neon-yellow/45, bg `neon-yellow/[0.06]`, hover preenche amarelo sólido.

### 8.5 Banner social (mensagens)

- Avatar de iniciais em bloco amarelo (radius-sm).
- Nome do manager em Agency 800 uppercase.
- Timestamp relativo Inter ("há 5m", "há 2d").
- Texto da mensagem em Inter 13px white/85.
- Card com border-l white/15 → hover border-l neon-yellow.

---

## 9. Page archetypes

### Tipo A — Hero editorial (Hero Pages)
Use quando: página apresenta uma entidade individual (jogador, lenda, partida).
Exemplos: `/legend/:slug`, `/match/result`, `/manager/profile`.

Estrutura:
1. Hero amarelo ou preto profundo
2. Eyebrow + Nome Moret + régua + metadata textual
3. Foto / visual principal
4. CTA dominante
5. Sub-blocos (timeline, stats, social)
6. CTA comercial (rodapé)

### Tipo B — Lista densa (Catalog Pages)
Use quando: galeria, mercado, transferências.
Exemplos: `/transfer`, `/mercado/loja`, `/legend` (busca modal).

Estrutura:
1. Header editorial + filtros pílula
2. Toggle Grid/List (assinatura)
3. Cards `view-player-card` em coluna ou grid

### Tipo C — Hub navegacional (Hub Pages)
Use quando: página agrega múltiplas surfaces relacionadas.
Exemplos: `/clube`, `/competicao`, `/manager`.

Estrutura:
1. Header com escudo/foto do clube
2. Tiles de navegação (DashboardGrid)
3. Cards com rail amarelo no destaque

### Tipo D — Live/Realtime (Match Pages)
Use quando: dado mudando em tempo real.
Exemplos: `/match/quick`, `/match/live`.

Estrutura:
1. Scoreboard + clock no topo
2. Feed minute-by-minute
3. Listas Home/Away horizontais com QuickPlayerRowCard
4. Overlays (gol, substituição, intervalo) full-screen clicáveis

---

## 10. Movimento e micro-interações

### Princípios

- **Velocidade média:** 200-300ms (entrada), 150-200ms (saída).
- **Curva padrão:** spring stiffness 280-380 damping 26-32.
- **Press mobile:** `active:scale-[0.94-0.98]` em todos os items tocáveis.
- **Hover desktop:** sobe 0.5-1px + borda neon-yellow.

### Padrões reusados

```tsx
// Card row de lista
<motion.div
  layout="position"
  initial={false}
  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
/>

// Overlay full-screen
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  transition={{ duration: 0.25 }}
/>

// Modal interno
<motion.div
  initial={{ y: -16, opacity: 0 }}
  animate={{ y: 0, opacity: 1 }}
  transition={{ duration: 0.22 }}
/>

// Banner cinematográfico
<motion.div
  initial={{ scale: 0.94, y: 18 }}
  animate={{ scale: 1, y: 0 }}
  transition={{ type: 'spring', stiffness: 280, damping: 26 }}
/>
```

### Interações com som

- **Apito de gol** (`/test-pitch/quick-match-sound.mp3`): só toca se o usuário aceitou via botão "Tocar Som" pré-kickoff.
- Sem áudio sem consent.

---

## 11. Acessibilidade

Mínimos não-negociáveis:

- **Contraste:** texto sobre fundo escuro mínimo `text-white/55` (WCAG AA).
- **Focus visível:** sempre que houver `:focus-visible`, mostrar `ring-2 ring-neon-yellow/50`.
- **`aria-current="page"`** em items de nav ativos.
- **`aria-label`** em todos os botões só com ícone.
- **`role="dialog" aria-modal="true"`** em modais full-screen + ESC fecha.
- **`aria-live="polite"`** em avisos inline (limite de caracteres, ⚠ alertas).
- **Touch target mínimo:** 44×44px (`min-h-14` no bottom nav).
- **`prefers-reduced-motion`:** quando o usuário pedir, desabilitar springs (TODO sistemicamente).
- **`tabular-nums`** em qualquer número que possa mudar (placar, contadores).
- **Imagens decorativas** sempre `aria-hidden`.

Mobile-first: ESC não existe no mobile. Toda interação dismissível tem que ser **tocável** (backdrop, botão X, ou hint visual).

---

## 12. Anti-patterns (o que não fazer)

| ❌ | ✅ |
|---|---|
| `bg-gradient-to-br from-purple-500 to-purple-700` (rainbow) | `bg-neon-yellow` ou `bg-dark-gray` |
| `text-gray-500` em texto inativo | `text-white/45` |
| `bg-[#0a0a0a]` hardcoded | `bg-deep-black` (token) |
| `rounded-2xl` arbitrário | `var(--radius-md)` |
| Emojis em CTAs/respostas formais (`🚑 Substituição`) | Ícone Lucide + label limpo |
| Moret em UPPERCASE | Moret italic em proper-case |
| Agency em italic | Agency reto + tracking-wide |
| Borda colorida (purple/cyan/orange) | Apenas tokens (neon-yellow / danger / warning / success) |
| Texto pequeno demais (`text-[8px]`) | Mínimo `text-[10px]` em UI labels |
| `onClick` em `<div>` sem `role` | `<button>` ou `<a>` semântico |
| Cores de marca **misturadas** (verde do MercadoPago, azul Twitter, etc.) | Sempre amarelo + estado (success/warning/danger) |
| Animação > 500ms na entrada | Máx 350ms; usuário precisa ver rápido |

---

## Glossário rápido

- **Eyebrow:** linha curta uppercase Agency acima do headline (ex.: "OLEFOOT · HALL OF FAME").
- **Headline duo:** combinação de Agency uppercase + Moret italic na sequência.
- **Régua amarela:** divisor `bg-neon-yellow w-12 h-[3px]` editorial.
- **Rail amarelo:** borda esquerda `border-l-[3px] border-l-neon-yellow` em cards-âncora.
- **OVR badge:** número Moret italic no canto superior esquerdo da foto do jogador.
- **CTA dominante:** botão amarelo sólido — uma única ação primária por surface.
- **view-player-card:** pattern horizontal Foto+Info reutilizado em listas de jogador.
- **Legacy Tech:** este sistema. Curto, direto, identificável.

---

## Versionamento

| Versão | Data | Notas |
|---|---|---|
| v1.0 | 2026-04-28 | Sprint A→D consolidada. Tokens, componentes-base, padrões editoriais, page archetypes, museu vivo (Legend) e nav redesign. |

**Mantenedor:** Olefoot Game · Time de Design Tech.
**Repositório:** `src/` (componentes), `src/data/` (dados), `src/hooks/` (interações), `docs/DESIGN_SYSTEM.md` (este).

---

*"Eu nasci para jogar futebol, da mesma forma que Beethoven nasceu para escrever música e Michelangelo nasceu para pintar."* — **Edson Arantes do Nascimento**
