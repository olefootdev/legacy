# Olefoot — Auditoria de Performance Gráfica (Modo Live 2D)

> Pesquisa web ignorada nesta rodada por solicitação do usuário. Todas as conclusões abaixo vêm da leitura direta do código em `/Users/jonhnes/Projects/olefootv-11/src`.

## DIAGNÓSTICO

**Stack de render:** DOM + CSS + `framer-motion` (pacote `motion@12.38.0`). Sem Canvas, sem WebGL, sem Pixi. SVG é usado apenas no `TacticalPitchDevLayer` (overlay opcional).

**Loop:** `requestAnimationFrame` correto, com delta-time clampado (`Math.min(0.05, dt)`), em `src/pages/useLive2dTacticalSim.ts:71`. A simulação tática roda a 60fps; o "render React" é throttled para `LIVE2D_RENDER_INTERVAL_MS = 24ms` (~42 commits/s).

**Onde dói:** o throttle de 24ms dispara `setRenderTick(t => t+1)` no componente `useLive2dTacticalSim` (que é hook de `Live2dMatchShell`), e isso re-renderiza o shell inteiro (1741 linhas, dezenas de `useMemo`/seletores Zustand/`motion.div`) ~42 vezes por segundo. Os tokens dos jogadores são `memo`-zados com equality field-by-field (bom), mas todo o **resto** da árvore (overlays, painéis, scoreboard, narração) re-renderiza a cada frame.

**Tokens dos jogadores** (`Test2dHomePlayerToken`, `Test2dAwayPlayerToken` em `src/pages/Live2dMatchShell.tsx:235` e `:356`) são `<div>` com `style={{ left: '...%', top: '...%', transition: 'left ... ms, top ... ms' }}`. **Animar `left`/`top` faz reflow + paint a cada frame** — o oposto do que `willChange: 'left, top'` consegue otimizar (browser não promove esse par para a GPU). A correção canônica é animar `transform: translate3d(...)`.

**Bola** (`Test2dBallToken`, linha 447): mesmo padrão `left/top` em CSS transition. Além disso, mantém um `animation: olefoot-ball-pulse 0.4s infinite alternate` permanente em finalizações e um spin contínuo via `<img>` — ok, mas combina com 22 tokens DOM já caros.

**Pitch rig** (`:1413`): `motion.div` com `transformStyle: preserve-3d`, `rotateX` spring, e um filho com `transform: scale(...)` que muda a cada movimento da bola (`pitchCameraRig` é `useMemo([ballPos.x, ballPos.y, ...])` e essas coords mudam a cada tick). Isso é uma transformação 3D promovendo um layer enorme que se atualiza ~42×/s; pesa em mobile.

**Re-render pressure (causa #1 de jank):** `useGameStore` é consumido com seletores granulares em `Live2dMatchShell` (~12 seletores), em `LiveStatsPanel`, em `PitchNarrationOverlay`. Cada `dispatch SIM_SYNC` (throttled em `LIVE_SIM_SYNC_THROTTLE_MS`) reescreve `liveMatch` e força re-render desses três. Isso é separado dos 42 commits/s do `renderTick`.

**SmartField/Yuka:** computação fora da árvore React (loopRef + refs) — bom isolamento. Não é o gargalo gráfico.

**Asset strategy:** `<img src="/assets/soccer-ball-256.png" />` por instância da bola; portraits também via `<img>`. Sem spritesheet, mas como há 1 bola e 22 portraits estáveis isso é trivial.

**TacticalPitchDevLayer** (SVG, opcional, 774 linhas, ~50+ `<rect>`/`<circle>`): quando ativo, re-renderiza junto com o shell. Não é throttled.

---

## 🔴 Problemas Críticos

### C1. Animação por `left`/`top` em todos os 22 tokens + bola
Browser faz **layout + paint** a cada mudança. `willChange: 'left, top'` não promove a GPU (válido só para `transform`/`opacity`). Em desktop passa, em mobile é o principal motivo de jank.
Local: `src/pages/Live2dMatchShell.tsx:251-266` (home), `:370-386` (away), `:495-505` (bola).

### C2. `Live2dMatchShell` re-renderiza ~42×/s devido a `setRenderTick`
O hook força um setState em todo frame (`src/pages/useLive2dTacticalSim.ts:91-94`), e o shell consome 12+ seletores Zustand, fabrica 8+ `useMemo` derivados de `pitch`/`awayPitch`/`ballPos`, e desce para `<TacticalPitchDevLayer>`, `<LiveStatsPanel>`, `<PitchNarrationOverlay>`, `<LiveMatchManagerPanel>`, `<VoiceCommandPanel>`. Tudo re-renderiza ~42×/s mesmo nada tendo mudado para esses subcomponentes.

### C3. `PitchNarrationOverlay` e `LiveStatsPanel` dentro do board re-renderizam por SIM_SYNC + por renderTick
Eles assinam `liveMatch` e estão dentro do shell. A cada commit do shell, eles também commitam.
Locais: `src/components/matchday/PitchNarrationOverlay.tsx:124`, `src/components/matchday/LiveStatsPanel.tsx:94`, ambos invocados em `src/pages/Live2dMatchShell.tsx:1579,1670`.

---

## 🟡 Problemas Médios

### M1. `pitchCameraRig` recalculado a cada tick
`useMemo([ballPos.x, ballPos.y, ...])` em `:1055` muda toda hora porque `ballPos` muda — está correto, mas alimenta um `transform: scale(...)` em layer 3D promovido. Em modo "action" (zoom seguindo bola), a transformação é reanimada constantemente.
Local: `src/pages/Live2dMatchShell.tsx:1055-1059, 1432-1436`.

### M2. `tokenSeparation` reconstrói um `Map` novo a cada render
`computePitchTokenSeparation` retorna `Map` novo. Memo dos tokens olha `nudge.dx/dy` ponto-a-ponto (ok), mas o cálculo em si roda 42×/s para 22 jogadores.
Local: `src/pages/Live2dMatchShell.tsx:1061-1067`.

### M3. SVG pesado no `TacticalPitchDevLayer` sem throttle próprio
Quando o usuário ativa o overlay tático, o SVG (50+ shapes) é re-emitido a cada commit do shell.
Local: `src/components/matchday/TacticalPitchDevLayer.tsx:153+`.

### M4. `motion.div` do pitch faz spring 3D em cima de container que muda
`rotateX: 5.5 + pitchCameraRig.rotateXAdd` ativa nova animação de spring a cada frame em modo action (porque `rotateXAdd` muda).
Local: `src/pages/Live2dMatchShell.tsx:1413-1419`.

### M5. `nearestToPoint(awayPitch, ballPos)` chamado dentro do `.map` por token
Em `:1506` é avaliado por iteração do map (22 vezes por commit, 42 commits/s ≈ 924×/s). Trivial individualmente, mas é puro waste.

### M6. `distPlayerBallPct` calculado para cada token a cada frame
Idem M5: 22 cálculos × 42fps. Móvel sente.
Local: `:1510-1515`, `:1545-1550`.

---

## ✅ O que já está bom

- rAF + delta-time clampado (`useLive2dTacticalSim.ts:71-72`).
- Update lógico (`TacticalSimLoop.step`) separado do render React.
- Tokens com `React.memo` + função de igualdade explícita por campo (`homePlayerTokenPropsEqual`, `awayPlayerTokenPropsEqual`, `ballTokenPropsEqual`).
- `truthSnap` exposto via ref para evitar dispose/reattach do bridge (`:685`).
- Uso de `transform: translate3d(-50%, -50%, 0)` para centrar tokens (a translação 50% é GPU-amigável; só falta passar o **movimento** para `transform` também).
- `contain: layout` no `field-tokens-layer` (`:1500`).
- `prefers-reduced-motion` respeitado em todos os tokens.
- Throttle separado para `SIM_SYNC` (`LIVE_SIM_SYNC_THROTTLE_MS`).
- `LiveMatchClockDisplay` tem rAF próprio com `useState` local — isola bem.

---

## 🚀 Implementações Propostas

### P1. Migrar tokens (jogadores + bola) de `left/top` para `transform: translate3d`
- **Impacto:** ALTO (resolve C1; reflow→composite). Esperado +20–35 fps em mobile mid-tier.
- **Complexidade:** BAIXA.
- **Problema:** animar `left`/`top` em 23 elementos a 42fps causa layout + paint.
- **Onde integrar:** `src/pages/Live2dMatchShell.tsx:251-269` (home), `:370-388` (away), `:495-507` (bola).
- **Código (substitui o style do home token e equivalente para away/ball):**

```tsx
// Substitui o cálculo + style block do Test2dHomePlayerToken
const left = pitchPlanePercent(p.x) + nudge.dx;
const top = pitchPlanePercent(p.y) + nudge.dy;
const motionCss =
  reducedMotion || TOKEN_MOVE_MS <= 0
    ? undefined
    : (`transform ${TOKEN_MOVE_MS}ms ease-out` as const);
return (
  <div
    className="absolute left-0 top-0"
    style={{
      // Composite-only: nada de left/top animados.
      transform: `translate3d(${left}cqw, ${top}cqh, 0) translate(-50%, -50%)`,
      zIndex: onBall ? 4 : 3,
      transition: motionCss,
      willChange: reducedMotion ? undefined : ('transform' as const),
      backfaceVisibility: 'hidden',
      cursor: onSelect ? 'pointer' : undefined,
    }}
    /* ...resto igual... */
  >
```
> Se `cqw/cqh` (container queries) não forem suportados pelo alvo, usar `calc(${left}% * var(--pitch-w))` ou um wrapper com `position: relative; width:100%; height:100%` e setar `--pitch-w/--pitch-h` em px via ResizeObserver. O importante é mover **apenas** `transform`. Para a bola, animar também a "altura" via segundo `translate3d(0, ${-ballLiftPx}px, 0)` no filho — já está no código.

### P2. Quebrar o pitch da árvore React do shell (componente isolado com seu próprio rAF)
- **Impacto:** ALTO (resolve C2). Cortar ~85% dos commits do shell.
- **Complexidade:** MÉDIA.
- **Problema:** `setRenderTick` força commit de TODO o shell (1741 linhas) 42×/s.
- **Onde integrar:** extrair as linhas `1500-1580` (`field-tokens-layer` + tokens + bola) num componente `<Live2dPitchSurface />` que **lê** o `truthSnap` via ref/contexto e gerencia seu próprio rAF, escrevendo direto no DOM com `ref` (ou mantendo seu próprio `useState` interno). O shell deixa de receber `renderTick`.
- **Código (esqueleto):**

```tsx
// src/pages/Live2dPitchSurface.tsx (NOVO)
import { memo, useEffect, useRef } from 'react';
import type { MatchTruthSnapshot } from '@/bridge/matchTruthSchema';

interface Props {
  truthRef: React.MutableRefObject<MatchTruthSnapshot | null>;
  reducedMotion: boolean;
  onBallId: string | null;
  // ...
}

export const Live2dPitchSurface = memo(function Live2dPitchSurface({ truthRef, reducedMotion }: Props) {
  const homeLayerRef = useRef<HTMLDivElement>(null);
  const awayLayerRef = useRef<HTMLDivElement>(null);
  const ballRef = useRef<HTMLDivElement>(null);
  const tokenElsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const snap = truthRef.current;
      if (snap) {
        for (const p of snap.players) {
          const el = tokenElsRef.current.get(p.playerId);
          if (!el) continue;
          // Escrita direta no DOM — zero React reconciliation.
          el.style.transform = `translate3d(${p.uiX}%, ${p.uiY}%, 0) translate(-50%, -50%)`;
        }
        if (ballRef.current) {
          ballRef.current.style.transform = `translate3d(${snap.ball.uiX}%, ${snap.ball.uiY}%, 0) translate(-50%, -50%)`;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [truthRef]);

  // Render React apenas para criar/remover tokens (lineup change), nunca por movimento.
  // ...mount via callback ref que registra em tokenElsRef.
  return (/* ... */);
});
```
> Em `useLive2dTacticalSim`, **remover** `setRenderTick` (linhas 47, 91-94, 139). O shell só re-renderiza em eventos discretos (gols, fim de tempo, troca de câmara, lineup change). Tokens passam a ser atualizados diretamente no DOM. Esse é o ganho mais decisivo do projeto.

### P3. Mover overlays/painéis para fora do `liveMatch` global no caminho quente
- **Impacto:** ALTO (resolve C3).
- **Complexidade:** MÉDIA.
- **Problema:** `PitchNarrationOverlay` e `LiveStatsPanel` re-renderizam a cada `SIM_SYNC` (toda mudança de placar/stats/evento) E a cada commit do shell. Hoje o shell os força sempre.
- **Onde integrar:** `src/components/matchday/PitchNarrationOverlay.tsx:124`, `LiveStatsPanel.tsx:94`. Substituir o seletor amplo por seletores fatiados + `useShallow` (já que o store é Zustand) e envolver os componentes em `React.memo`.
- **Código:**

```tsx
import { useShallow } from 'zustand/react/shallow';
// LiveStatsPanel.tsx
const stats = useGameStore(useShallow((s) => ({
  shotsHome: s.liveMatch?.stats?.shotsHome ?? 0,
  shotsAway: s.liveMatch?.stats?.shotsAway ?? 0,
  possessionHome: s.liveMatch?.stats?.possessionHome ?? 50,
  // ...só os campos que o componente desenha
})));
```
> E exportar como `export default memo(LiveStatsPanel)`. Pelo lado do shell, mover esses componentes para irmãos do `<Live2dPitchSurface />` em vez de filhos da subárvore que receberá props instáveis.

### P4. Mover seleção de zoom (`pitchCameraRig`) para CSS variable + transform-only
- **Impacto:** MÉDIO (resolve M1, M4).
- **Complexidade:** BAIXA.
- **Problema:** spring de framer-motion + `rotateX` recompondo a cada frame de `ballPos`.
- **Onde integrar:** `src/pages/Live2dMatchShell.tsx:1413-1437`.
- **Código:** trocar o `motion.div` com `animate={{ rotateX: ... }}` por um `<div>` cru cuja `--rotateX` e `--scale` são gravadas via ref no mesmo rAF do P2, em vez de trafegar por React state.

```tsx
// dentro do rAF principal (P2):
pitchRigRef.current?.style.setProperty('--cam-rotate-x', `${5.5 + rig.rotateXAdd}deg`);
pitchRigRef.current?.style.setProperty('--cam-scale', String(rig.scale));
pitchRigRef.current?.style.setProperty('--cam-origin', `${rig.originXPct}% ${rig.originYPct}%`);

// JSX:
<div
  ref={pitchRigRef}
  className="origin-[50%_100%] transform-gpu will-change-transform"
  style={{
    transformStyle: 'preserve-3d',
    transform: 'rotateX(var(--cam-rotate-x, 5.5deg)) scale(var(--cam-scale, 1))',
    transformOrigin: 'var(--cam-origin, 50% 100%)',
    transition: 'transform 280ms cubic-bezier(.2,.7,.2,1)',
  }}
>
```
> Elimina remount da spring e remove framer-motion do hot path da câmara.

### P5. Throttle do `TacticalPitchDevLayer` para 8–10 fps
- **Impacto:** MÉDIO (resolve M3) quando overlay está ligado.
- **Complexidade:** BAIXA.
- **Onde integrar:** `src/components/matchday/TacticalPitchDevLayer.tsx`.
- **Código:** envolver as posições de jogador em estado interno atualizado via `setInterval(100ms)` lendo do mesmo `truthRef`, ou aplicar `useDeferredValue` nos `homePlayers`/`awayPlayers`.

```tsx
import { useDeferredValue } from 'react';
// dentro do componente:
const homeDeferred = useDeferredValue(homePlayers);
const awayDeferred = useDeferredValue(awayPlayers);
// usar homeDeferred/awayDeferred no resto do componente.
```
> Aceitável porque o overlay é pedagógico/diagnóstico, não precisa de 60fps.

### P6. Mover `tokenSeparation`, `nearestToPoint`, `distPlayerBallPct` para o `TacticalSimLoop`
- **Impacto:** MÉDIO (resolve M2, M5, M6).
- **Complexidade:** BAIXA.
- **Problema:** computar separação anti-bunching e nearest-to-ball **no render** força recompute em cada commit React. Esses dados já existem na simulação.
- **Onde integrar:** mover `computePitchTokenSeparation` chamada (linha 1066) para dentro do `step()` em `src/simulation/TacticalSimLoop.ts` e expô-lo no `getSnapshot()`. Idem para `onBallId` e distâncias.
- **Código (no shell):**

```tsx
// Substitui :1061-1067
const tokenSeparation = truthSnap?.tokenSeparation ?? EMPTY_SEPARATION;
// Substitui :1506
const awayOnBall = storeOnBallId === p.playerId; // já vem do snap
```

### P7. `useShallow` em `Live2dMatchShell` para todos os 12 seletores Zustand
- **Impacto:** BAIXO–MÉDIO (defensivo após P2).
- **Complexidade:** BAIXA.
- **Onde integrar:** `src/pages/Live2dMatchShell.tsx:574-582`.
- **Código:**

```tsx
import { useShallow } from 'zustand/react/shallow';
const { live, playersById, lineupIds, fixture, manager: mgr } = useGameStore(useShallow((s) => ({
  live: s.liveMatch,
  playersById: s.players,
  lineupIds: s.lineup,
  fixture: s.nextFixture,
  manager: s.manager,
})));
const { tacticalMentality, defensiveLine, tempo, tacticalStyle, staff } = mgr;
```
> Reduz N subscribers para 1 e elimina re-renders por mudança de campo não usado.

### P8. Pré-cachear portraits em `<link rel="preload">` + decoding="async"
- **Impacto:** BAIXO em fluidez sustentada, MÉDIO no primeiro minuto.
- **Complexidade:** BAIXA.
- **Onde integrar:** ao montar o shell (`src/pages/Live2dMatchShell.tsx:619+`), gerar 22 `<link rel="preload" as="image" href={...} />` no `document.head`. Adicionar `decoding="async"` e `loading="eager"` no `<img>` do token (`:303` e similar).

### P9. Remover `transition: width/height/opacity/filter` da sombra da bola
- **Impacto:** BAIXO mas barato.
- **Complexidade:** MUITO BAIXA.
- **Problema:** `:517` anima 4 propriedades simultâneas em CSS, todas geram paint. A bola já se move 42×/s.
- **Onde integrar:** `src/pages/Live2dMatchShell.tsx:490-518`.
- **Código:** remover o `transition: motionShadow` e deixar a sombra "snapar" a cada frame; a bola muda tão rápido que a transição visualmente não agrega.

```tsx
<div
  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
  style={{
    width: `${shadowW}px`,
    height: `${shadowH}px`,
    opacity: shadowOpacity,
    background: 'radial-gradient(ellipse at center, #000 0%, transparent 70%)',
    filter: `blur(${shadowBlur}px)`,
    // sem transition — sombra acompanha bola via reposição direta
  }}
/>
```

---

## 📋 Ordem de Implementação

1. **P1** (transform translate3d nos tokens + bola) — baixo risco, ganho imediato.
2. **P6** (mover cálculos derivados para o sim loop) — pré-requisito limpo para P2.
3. **P2** (extrair `Live2dPitchSurface` + DOM-direct rAF) — o salto qualitativo.
4. **P3** (memo + `useShallow` em painéis filhos do board).
5. **P4** (CSS vars na câmara) — alinha com P2.
6. **P7** (`useShallow` no shell) — efeito multiplicador depois de P2.
7. **P5** (throttle do TacticalPitchDevLayer).
8. **P9** (limpeza da sombra da bola).
9. **P8** (preload de portraits) — quality-of-life.

---

## 📊 Ganhos Esperados (FPS antes/depois)

Cenário de referência: Chrome desktop modesto + iPhone 12 / Android mid-tier rodando o board ao vivo com 22 tokens, sem overlay tático. Estimativas baseadas no impact-table do reference doc da skill (left/top→transform: +20–35fps; remover commits desnecessários: +10–20fps; eliminar reflow em câmara: +5–10fps).

| Implementação | Desktop (antes → depois) | Mobile mid (antes → depois) |
|---|---|---|
| Linha de base | 55–60 | 22–32 |
| + P1 (transform tokens) | 58–60 | 38–48 |
| + P6 (sim loop computa derivados) | 58–60 | 42–50 |
| + P2 (pitch fora do React) | 60 estável | 52–58 |
| + P3 + P7 (memo/seletores fatiados) | 60 estável | 56–60 |
| + P4 (câmara via CSS vars) | 60 estável | 58–60 |
| + P5/P8/P9 (qualidade) | 60 estável | 60 estável |

**Linha do tempo prática:** P1+P6+P2+P3 (1 dia de trabalho focado) já leva mobile mid-tier de ~28fps para ~55fps com sensação de fluidez. O resto é polimento.

---

## Observações finais

- O projeto está **estruturalmente são**: rAF, delta-time, separação update/render, memo nos tokens, `prefers-reduced-motion`, throttle de SIM_SYNC, refs em vez de state nas posições críticas. O problema é **execução** em três pontos: (a) animar `left/top` em vez de `transform`, (b) `setRenderTick` puxando o shell inteiro, (c) painéis ricos em seletores assinando `liveMatch` no caminho quente.
- Não é necessário migrar para Canvas/WebGL — DOM + transform-only consegue 60fps confortavelmente para 23 elementos.
- O SmartField (Python snapshot) e o `TacticalSimLoop` não são gargalo gráfico; deixar como está.
