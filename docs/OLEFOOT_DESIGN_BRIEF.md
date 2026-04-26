# Olefoot — Design Brief de Repaginação Visual (v2)

**Designer:** Olefoot UI Designer (Nike × BVB × EA FC × Football Manager)
**Data:** 2026-04-24
**Filosofia:** Futebol-first. Dark. Bold. Refatoração cirúrgica — só CSS/tokens, sem mexer em JSX.

---

## Diagnóstico Rápido

### Já está bom (manter intocado)
- **Tokens em `src/index.css`** alinhados ao olefoot.com: `--color-neon-yellow #FDE100`, `--color-deep-black #0D0D0D`, `--color-card #242424`, `--color-card-hi #2E2E2E`, `--color-text-soft`, `--color-text-muted`.
- **Tipografia 4-camadas** declarada: `--font-display` (Agency FB), `--font-serif-hero` (Moret), `--font-ui` (SF Pro), `--font-sans` (Inter). Fallbacks corretos (Oswald/Impact/Montserrat).
- **Utilities de identidade** já criadas: `.ole-tag`, `.ole-tag-solid`, `.ole-eyebrow`, `.ole-headline`, `.ole-headline-italic`, `.ole-card`, `.ole-card-accent`, `.ole-card-hover`, `.btn-primary` com `-skew-x-6` (assinatura BVB).
- **Acessibilidade:** `html.olefoot-reduce-motion` e `data-graphic-quality` implementados.
- **Background hero** `radial-gradient(circle at 50% 0%, #1a1a1a 0%, #090909 70%)` — manter.
- **Goal flash** `momentum-goal-flash` — manter, mas complementar com takeover (COMP-04).

### Refatorar agora (alta prioridade)
1. **Token de placar dedicado** — `--text-score` faltando; placar de partida ao vivo precisa do tratamento Agency FB dominante.
2. **Cards de jogador "carta colecionável"** (EA FC) — overall + posição em pill + foto com gradiente bottom não estão padronizados.
3. **Threshold semântico Football Manager** — atributos sem `data-tier` (elite/good/avg/weak) consistente.
4. **Goal Takeover** de tela inteira (1.2s) — flash amarelo + "GOL." Agency FB + "*Olefoot.*" Moret italic. Hoje só temos flash sutil de barra.
5. **Headers de seção** das telas de jogo (MatchLive, Postgame, Team) sem o padrão `eyebrow + Agency FB caps + Moret italic` que já é a assinatura do site.

### Depois (baixa prioridade)
- Skeletons temáticos (silhueta de campo).
- Textura "Gelbe Wand" em fundos de modais (opacidade ≤ 4%).
- Dividers diagonais 34° (já parcialmente via `-skew-x-6`).

---

## Tokens — APENAS Aditivos

Adicionar ao `@theme` em `src/index.css` (não substituir nada existente):

```css
@theme {
  /* Escala tipográfica */
  --text-xs:    11px;
  --text-sm:    13px;
  --text-base:  15px;
  --text-lg:    18px;
  --text-xl:    22px;
  --text-2xl:   32px;
  --text-3xl:   48px;
  --text-hero:  80px;
  --text-score: 96px;
  --text-rating: 56px;

  /* Cores semânticas (não substituem --color-neon-green) */
  --color-success: #00C851;
  --color-warning: #FFB300;
  --color-danger:  #FF3D3D;
  --color-info:    #2979FF;

  /* Threshold de atributos (Football Manager) */
  --attr-elite: #00FF66;  /* 80+   */
  --attr-good:  #FDE100;  /* 65–79 */
  --attr-avg:   #FFB300;  /* 50–64 */
  --attr-weak:  #FF3D3D;  /* <50   */
}
```

---

## Componentes — Refatoração Cirúrgica

### [COMP-01] Placar (MatchLive / Live2dMatchShell / MatchAuto)
```css
.ole-scoreboard {
  font-family: var(--font-display);
  font-weight: 900;
  font-size: var(--text-score);
  line-height: 0.9;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: #fff;
}
.ole-scoreboard__separator { color: var(--color-text-muted); font-size: 0.5em; padding: 0 0.3em; }
.ole-scoreboard--live      { color: var(--color-neon-yellow); }
.ole-scoreboard__minute {
  font-family: var(--font-ui);
  font-size: var(--text-sm);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--color-neon-yellow);
}
```

### [COMP-02] Card de jogador (EA FC vibe)
```css
.ole-player-card {
  background: linear-gradient(180deg, var(--color-card-hi) 0%, var(--color-card) 100%);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  position: relative;
  overflow: hidden;
}
.ole-player-card__overall {
  font-family: var(--font-display);
  font-weight: 900;
  font-size: var(--text-rating);
  color: var(--color-neon-yellow);
  line-height: 1;
}
.ole-player-card__position {
  font-family: var(--font-ui);
  font-size: var(--text-xs);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--color-neon-yellow);
}
.ole-player-card__photo { aspect-ratio: 3/4; object-fit: cover; }
.ole-player-card__photo-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(180deg, transparent 50%, rgba(13,13,13,0.95) 100%);
  pointer-events: none;
}
```

### [COMP-03] Atributos com tier (Football Manager)
```css
.ole-attr { font-family: var(--font-display); font-weight: 900; font-variant-numeric: tabular-nums; }
.ole-attr[data-tier="elite"] { color: var(--attr-elite); }
.ole-attr[data-tier="good"]  { color: var(--attr-good); }
.ole-attr[data-tier="avg"]   { color: var(--attr-avg); }
.ole-attr[data-tier="weak"]  { color: var(--attr-weak); }
```
Helper único:
```ts
export const attrTier = (n: number) =>
  n >= 80 ? 'elite' : n >= 65 ? 'good' : n >= 50 ? 'avg' : 'weak';
```

### [COMP-04] Goal Takeover (full screen, 1.2s)
```css
@keyframes ole-goal-takeover {
  0%   { opacity: 0; transform: scale(0.96); }
  10%  { opacity: 1; transform: scale(1);    }
  85%  { opacity: 1; transform: scale(1);    }
  100% { opacity: 0; transform: scale(1.02); }
}
.ole-goal-takeover {
  position: fixed; inset: 0; z-index: 9999;
  background: var(--color-neon-yellow);
  display: grid; place-items: center;
  pointer-events: none;
  animation: ole-goal-takeover 1.2s ease-in-out forwards;
}
.ole-goal-takeover__text {
  font-family: var(--font-display);
  font-weight: 900;
  font-size: clamp(80px, 18vw, 240px);
  line-height: 0.85;
  text-transform: uppercase;
  color: #000;
}
.ole-goal-takeover__italic {
  font-family: var(--font-serif-hero);
  font-style: italic;
  font-size: 0.4em;
  font-weight: 400;
  display: block;
  margin-top: 0.1em;
  color: #000;
}
```
JSX:
```jsx
<div className="ole-goal-takeover">
  <div className="ole-goal-takeover__text">
    GOL.
    <span className="ole-goal-takeover__italic">Olefoot.</span>
  </div>
</div>
```
Mount/unmount via store quando `lastEvent.type === 'GOAL'`, timer 1200ms. Respeitar `html.olefoot-reduce-motion` (skip).

### [COMP-05] Tabela (RankingFull / Leagues)
```css
.ole-table thead th {
  font-family: var(--font-ui);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--color-text-soft);
  background: var(--color-panel);
  position: sticky; top: 0;
}
.ole-table tbody tr:nth-child(odd)  { background: var(--color-deep-black); }
.ole-table tbody tr:nth-child(even) { background: var(--color-card); }
.ole-table tbody tr:hover           { background: var(--color-card-hi); }
.ole-table__pos[data-rank="1"] { color: #FFD700; font-weight: 900; }
.ole-table__pos[data-rank="2"] { color: #C0C0C0; font-weight: 900; }
.ole-table__pos[data-rank="3"] { color: #CD7F32; font-weight: 900; }
.ole-table__form-pill {
  width: 18px; height: 18px; border-radius: 9999px;
  display: inline-block; font-size: 10px; font-weight: 700;
  line-height: 18px; text-align: center;
}
.ole-table__form-pill[data-r="V"] { background: var(--attr-elite); color: #000; }
.ole-table__form-pill[data-r="E"] { background: var(--attr-avg);   color: #000; }
.ole-table__form-pill[data-r="D"] { background: var(--attr-weak);  color: #fff; }
```

### [COMP-06] Headers de seção (consistência com site)
```jsx
<div className="ole-eyebrow">PARTIDA AO VIVO</div>
<h1 className="ole-headline text-[var(--text-3xl)]">
  AO VIVO. <span className="ole-headline-italic">Agora.</span>
</h1>
```
Aplicar em: `Postgame.tsx`, `Team.tsx`, `Manager.tsx`, `Live2dMatchShell.tsx`, `RankingFull.tsx`.

---

## Plano de Implementação

### Etapa 1 — Tokens aditivos (zero risco)
- [ ] Adicionar bloco `@theme` aditivo em `src/index.css`.
- [ ] `npm run build` para validar.

### Etapa 2 — Partida (impacto máximo)
- [ ] `.ole-scoreboard*` em `MatchLive.tsx`, `Live2dMatchShell.tsx`, `MatchAuto.tsx`.
- [ ] `<GoalTakeover />` no shell de partida, montado por store em evento de gol.

### Etapa 3 — Cards e tabelas
- [ ] `.ole-player-card*` em `Team.tsx`, `TeamMeuTimeHeader.tsx`, lineup.
- [ ] `.ole-attr` + `attrTier()` em todos os displays numéricos de atributo.
- [ ] `.ole-table*` em `RankingFull.tsx`, `Leagues.tsx`, `Calendar.tsx`.

### Etapa 4 — Headers
- [ ] Padrão eyebrow + Agency FB + Moret italic em `Postgame`, `Team`, `Manager`, `Live2dMatchShell`, `RankingFull`.

### Etapa 5 — Refinamento (opcional)
- [ ] Skeletons temáticos.
- [ ] Padrão "Gelbe Wand" em modais grandes (≤ 4% opacidade).

---

## O Que NÃO Fazer

- Não mexer em JSX para resolver visual — só CSS / Tailwind / tokens.
- Não importar fontes novas (Inter + Oswald + Montserrat já estão; Agency FB / Moret / SF Pro são locais ou nativas).
- Não duplicar tokens. `--color-success` é semântico; `--color-neon-green` é da marca. Manter ambos.
- Não usar cores hardcoded.
- Não trocar libs de UI.
- Não remover classes existentes sem grep prévio.

---

## Síntese Final

> **Estádio à noite com placar elétrico.** Preto `#0D0D0D` como gramado escuro, amarelo `#FDE100` como holofote único. Agency FB grita o resultado, Moret italic sussurra a personalidade, SF Pro organiza a UI, Inter conta a história. Cada gol toma a tela. Cada atributo sabe seu tier. Sem ruído. Sem decoração. Só futebol.

- **Palavra-chave:** *Elétrico.*
- **Cor de acento:** `#FDE100` (confirmada — não mudar).
- **Referência principal:** BVB Rebrand (DesignStudio 2023) + EA FC (cards) + Football Manager (semântica de tier).
