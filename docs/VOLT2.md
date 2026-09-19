# VOLT2 — a régua de design do OLEFOOT

Aprovado pelo fundador em 2026-09-19. Canvas de referência:
https://claude.ai/artifact/1LtGLTjcbqDNumMtHJMVmA (Home, Dia de Jogo, Carteira, Regras).

> "Design de altíssimo nível, minimalista de rua, conceito urbano forte conectado
> a um jogo moderno, porém de respeito." — o impacto vem de **tipo grande, cor
> chapada e grid**. Nunca de enfeite que só funciona no mockup.

A camada central já está aplicada (commit `bc6cd38`): tokens, fontes, raio,
sombra, fundo, `.btn-primary`, `.ole-poster`, `.ole-eyebrow-poster`, header e
menu de baixo. **Toda tela nova ou revisada segue esta régua.**

---

## 1. Paleta (use o token, nunca o hex solto)

| Papel | Classe Tailwind | Hex |
|---|---|---|
| Fundo (asfalto) | `bg-deep-black` / `bg-asfalto` | #0D0D0D |
| Barra/nav | `bg-nav` | #08090A |
| Card | `bg-panel` | #141516 |
| Elevado | `bg-card` | #1B1D1F |
| Gaveta/sheet, trilho de barra | `bg-card-hi` / `bg-sheet` | #25282B |
| Voz (título, número) | `text-white` | #FFFFFF |
| Giz (texto corrido, placa de papel) | `text-giz` / `bg-giz` | #ECECE7 |
| Cimento (secundário) | `text-cimento` | #9A9C9F |
| Poeira (terciário, inativo) | `text-poeira` | #7E8185 |
| **Volt = AÇÃO** | `bg-neon-yellow` / `text-neon-yellow` | #FDE100 |
| **Ouro = SÓ ativo na rede, só na Carteira** | `text-ouro` | #E8B331 |
| Lenda | `bg-lenda` / `text-lenda` | #8B5CF6 |
| Alta / sucesso | `text-alta` | #22C55E |
| Baixa / erro | `text-baixa` | #FF4D4D |
| Atenção | `text-atencao` | #FF9F1C |

Bordas: `border-white/10` (card), `border-white/16` (botão ícone),
`border-white/30` (botão secundário).

EXP e OLEFOOT **do jogo** são fictícios: nunca em ouro, nunca com o selo da rede.

## 2. Tipografia

| Papel | Classe |
|---|---|
| Título, nome, manchete (Anton) | `font-impact` ou `font-display` |
| Número, placar, OVR, preço, rótulo de botão novo (Archivo 125%) | `ole-num` |
| Interface, texto corrido (Inter Tight) | `font-sans` (padrão) |
| #hashtag, dinheiro, rótulo de seção (IBM Plex Mono) | `font-mono` |

- **Sem serifa e sem itálico.** Já neutralizados globalmente — ao mexer numa
  linha, tire `italic`, `fontStyle: 'italic'` e `font-serif-hero`.
- ⚠️ A Archivo expandida é LARGA. Em botão de meia largura use `text-[12px]`–
  `text-[13px]`, `whitespace-nowrap`, e confira em 320px.
- ⚠️ Anton + `truncate` + `leading-none` corta o til (MISSÕES). Use `leading-[1.1]`+.

## 3. Proibido (o fundador cortou tudo isto)

- **Gradiente em superfície**: `bg-gradient-*`, `linear/radial/conic-gradient`
  em card, botão, banner, faixa, texto (`bg-clip-text`). Troque pelo token chapado.
- **Sombra e brilho**: `shadow-[...]`, `boxShadow`, `textShadow`,
  `drop-shadow-[...]`, halo desfocado (div com `blur-*` servindo de brilho → apague o elemento).
- **Vidro fosco**: `backdrop-blur-*` → fundo sólido (`bg-nav`, `bg-panel`).
- **Torto**: `skew-*`, `-skew-*`, `rotate-*`/`skewX()` em faixa, etiqueta,
  adesivo, banner. **Pode** girar ícone funcional (chevron que abre, spinner, anel svg `-90`).
- **Pular/crescer no hover**: `hover:-translate-y-*`, `hover:scale-*` → troque por
  `hover:border-white/30` ou cor.
- **Número vazado**: `WebkitTextStroke` / `text-stroke` → texto sólido.
- **Raio grande**: `rounded-[14px]`, `rounded-[20px]` etc. → tire (o token já é 2px).
  `rounded-full` fica em avatar, pílula, ponto e anel.
- **Hex solto fora da paleta** (ex.: `#C7A64E`, `#F2ECDC`, dourado genérico) →
  token mais próximo (`text-neon-yellow`, `text-giz`, `bg-giz`).

**Pode ter gradiente** (só estes): sombra de foto (scrim sobre `<img>` pra
legibilidade), visualização de dado (barra, anel, gráfico, mapa de calor,
gramado), o `SeloRede` e a linha que se apaga do `SecaoVolt`.

## 4. Uma linha só

- **Categoria vira `#hashtag`** — use `<Hashtag>` (`@/components/ui`).
  "Mercado de Lendas" → `#mercado`; "Liga Global · Divisão 3" → `#ligaglobal #div3`.
- **A consequência mora no botão** — `<BotaoConsequencia label="Renovar" delta={-50} />`
  ou o texto no próprio botão ("Resgatar +200 EXP"). Nada de parágrafo explicando acima.
- **Texto que quebraria em duas linhas sai** ou vira `<UmaLinha>` (corta com "…").
- **Copy mínima**: título + 2–3 palavras; header é só título. Corte frase
  explicativa decorativa. **Nunca** corte: dado, instrução necessária pra operar,
  texto legal/consentimento, mensagem de erro.
- Nunca invente número: se o dado não existe, o elemento sai.

## 5. Peças prontas

`@/components/ui`: `UmaLinha`, `Hashtag`, `SecaoVolt` (título de seção com risco
volt), `BotaoConsequencia`, `Placa` (papel #ECECE7), `SeloRede`.
Classes: `.btn-primary` (volt chapado + corte do escudo), `.btn-secondary`
(contorno), `.ole-eyebrow-poster` (risco + mono), `.ole-num`,
`[clip-path:var(--clip-corte)]` com `[--corte:12px]`.

## 6. Armadilhas de CSS já conhecidas

- `src/styles/mobile-responsive.css` tem `img { height: auto }` **fora de camada**:
  vence `h-full` do Tailwind. Imagem que precisa preencher → `style={{ width: '100%', height: '100%' }}`.
- `@layer base * { max-width: 100% }`: sangria com `-mx-*` precisa de `max-w-none`.
- Seletor do store: nunca `?? []`, `.map()` ou `Object.values()` DENTRO de `useGameStore(...)`.

## 7. Como conferir

- `npx tsc --noEmit -p .` limpo.
- Em DEV, `http://localhost:5173/<rota>?semsessao=1` abre tela interna sem login.
- Olhe em **320px, 375px e desktop**: nenhum rótulo quebra linha nem corta fora do previsto,
  sem rolagem lateral.
