# OLEFOOT REVELA

Portal público de talentos — `revela.olefoot.com`.

Site **separado** do jogo, no mesmo repositório. Build próprio, deploy próprio,
domínio próprio; código compartilhado é **lido** de `src/` pelo alias `@`, nunca
copiado.

```bash
npm run dev:revela      # localhost:5273
npm run lint:revela     # tsc --noEmit
npm run build:revela
npm run deploy:revela   # build + wrangler deploy (worker olefoot-revela)
```

## O que o REVELA é — e o que ele não é

| | REVELA | /playervip (no jogo) |
|---|---|---|
| Público | Qualquer visitante | Atleta + facilitador + Olefoot |
| Papel | Divulgação, descoberta, aquisição | Cockpit interno da lenda |
| Conteúdo | Talentos novos + lendas + liga | Vendas, comissões, saque, suporte |

Os dois convivem. O REVELA **linka** para a vitrine `/playervip/<handle>` quando a
lenda tem uma, mas não absorve nem substitui aquele fluxo.

## Arquitetura

```
revela/
  index.html            entry próprio (SEO/OG do REVELA)
  vite.config.ts        root=revela/, publicDir=../public, alias @ → ../src
  wrangler.jsonc        worker olefoot-revela (assets-only, SPA fallback)
  tsconfig.json         paths @/* → ../src/*  (sem `strict`: ver nota no arquivo)
  src/
    revela.css          tokens do REVELA (dois universos: amarelo × preto)
    App.tsx             busca TODOS os dados uma vez e desce por props
    data/               tipos, RPCs, sessão
    components/         primitivos sem regra de negócio
    pages/              Home · LegendPage
    sections/           Top · Talents · Journey · Legends · League · TeamBuilder
```

## Rotas

| Rota | O quê |
|---|---|
| `/` | Home |
| `/lenda/:slug` | Vitrine do atleta — a segunda camada |
| `/playervip/:slug` | Alias da anterior, pra links já compartilhados |
| `/t/:slug` | Perfil do talento — o link que o atleta posta |
| `/comecar` | Onboarding do atleta — o passo 1 dos 7 |

**A casca não muda entre rotas.** Nav, rodapé, folha de login e toast vivem no
`App`, fora do `<Routes>`. É isso que faz a página da lenda não parecer outro
site: o topo não pisca, a identidade não troca, a sessão não some.

Antes, o card de lenda mandava pra `game.olefoot.com/playervip/<handle>` — outra
linguagem visual, outro domínio. A pessoa sentia que tinha caído em outro lugar
bem na hora de decidir comprar. A estrutura do /playervip (link por handle,
coleção, captura de indicação, CTA pro jogo) ficou inteira; só a casca mudou.

O `:slug` é o **atleta**, não a carta: vem de `athleteSlug()`, que usa o handle
do /playervip quando existe e o primeiro nome quando não. Por isso a página
cobre todo o acervo — o Gonçalves não tem handle e mesmo assim tem página.

## Onboarding (`/comecar`)

O formulário de criação de perfil **não fica na home**. Ele morava no rodapé, e
quem clicava em "criar perfil" caía no fim de tudo, num paredão de campos, sem
entender que aquilo abria uma jornada de 7 passos. Decisão do fundador
(2026-07-23): "deveria ser o primeiro passo do onboarding e não estar ao final da
página, ficou confuso".

Agora são três telas curtas, cada uma com uma pergunta só:

1. **Quem é você** — nome, posição, pé dominante, ano, altura
2. **Onde joga** — clube, cidade, UF (tudo opcional; ausência não trava)
3. **Tua história** — bio, vídeo, WhatsApp

**Posição é setor → posição por extenso**, não dez siglas soltas. "MC" e "MEI"
lado a lado é exatamente o tipo de coisa que faz alguém errar a própria ficha.
O código gravado continua sendo a sigla — é o que `ovrWeights.ts` pondera.

**Login é pedido só no envio.** Quem ainda não decidiu não deve topar com um
muro; quem preencheu três telas já se comprometeu. O rascunho vive no estado do
React e o `AuthSheet` é modal — não navega, então nada se perde, e o envio
dispara sozinho quando a sessão chega.

`strong_foot` e `bio` já eram aceitos pelo RPC desde a primeira migration e a
tela antiga jogava fora. `height_cm` existia na tabela mas faltava no RPC —
entrou em `20260723180000`.

## Sem palavra-fantasma

O layout **não usa** texto gigante de fundo atrás da composição (o `.rev-ghost`
que existia no protótipo). Decisão do fundador em 2026-07-23: "acho amador esse
negócio de usar palavra e deixa sujo o layout". A classe foi removida do CSS de
propósito — token morto é convite pra alguém usar de novo.

**Todo fetch acontece nas páginas, não nas seções.** Se cada seção buscasse o seu, o número de
apoiadores do mesmo jogador apareceria diferente em três lugares da mesma tela.

## Dados

Tudo vem dos RPCs criados em
`supabase/migrations/20260723120000_revela_public_portal.sql` e
`20260723140000_revela_ovr.sql`.

O **OVR nunca é digitado nem recalculado no cliente**. `revela_ovr(pos, attrs)`
faz a mesma conta de `overallFromAttributes()`, com os pesos por posição. Aqueles
pesos são uma cópia de `src/entities/ovrWeights.ts` — cópia é dívida, e ela é
guardada por `npm run test:revela-ovr`, que lê o .sql e compara com o TS sem
precisar de banco.

**Nunca ler tabela direto daqui.** Este site roda anônimo com a anon key no
bundle. As duas vezes em que este projeto leu tabela de um contexto público,
vazou e-mail (`/api/admin/profiles`, `global_league_teams`). Os RPCs têm lista
branca de colunas — é ali que a garantia mora, não na UI.

Em particular:

- `revela_talents` **não tem policy de select para anon**. `contact_phone` e
  `contact_email` existem na tabela e não saem por consulta pública nenhuma.
- O ranking **não** lê `global_league_teams`: naquela tabela `manager_id` e `id`
  são o e-mail do manager, e o select para anon foi revogado em
  `20260717170000`. `revela_top_clubs` devolve só clube, pontos e divisão.

## Sessão

REVELA e o jogo são **origens diferentes**, e o Supabase guarda a sessão em
`localStorage`, que é por origem. Estar logado em `game.olefoot.com` não loga
aqui — é a mesma conta, o que não viaja é o token.

Por isso aqui só existe **login**. Criar conta manda para
`game.olefoot.com/cadastro/<código>`, porque é lá que a árvore de indicação e o
perfil do manager são montados. Duplicar o cadastro aqui produziria usuário órfão
sem crédito de rede — que é justamente o que o banco bloqueia.

## Peso de imagem

Todo retrato passa por `data/images.ts`, que adiciona os parâmetros de
transformação do gateway **dedicado** do Pinata (`*.mypinata.cloud`). Medido na
home em 2026-07-23, mesmas 11 imagens:

| | Peso |
|---|---|
| PNG original (como estava) | 25,4 MB |
| `img-width` por contexto + `img-format=webp` | **257 KB** |

101× menor. O recurso já estava contratado no gateway — só não estava sendo
usado. **Não passe URL de retrato direto pro `<img>`**: use o `Portrait`, que
recebe a largura de LAYOUT e monta `src` + `srcSet` 1x/2x.

O gateway **público** do Pinata ignora esses parâmetros; por isso a função checa
o host e deixa passar intacto o que não reconhece.

## Fontes

`public/fonts/` só tem **anton-latin.woff2** de verdade. `src/styles/fonts.css`
declara mais 11 `@font-face` apontando para arquivos que nunca foram baixados; o
jogo só não quebra porque puxa as mesmas famílias do Google em paralelo.

`revela.css` **não importa** aquele arquivo: declara Anton local e busca Inter,
Oswald e Playfair do Google, uma vez.

## Pendências conhecidas

- **Fila do OLE SCOUT sem tela.** Ver é `select * from
  public.revela_admin_queue()`, aprovar é `select
  public.revela_admin_review_talent(id, 'approved', ficha_jsonb)` — sem passar
  `overall`, que o banco calcula. Falta o painel em `src/admin/`; quando ele
  existir, deve chamar `overallFromAttributes()` do TS e aí as funções
  `revela_ovr*` viram redundância — apagar as duas coisas juntas.
- **A Resenha não tem CMS.** A seção monta as histórias a partir de
  `narrative_title` / `tagline` / `bio` das lendas — conteúdo real, curado do
  catálogo. Quando existir um CMS, trocar a fonte e manter o layout.
- **Moret.** O handoff pede Playfair como substituta dela. O jogo declara
  `--font-serif-hero: "Moret"` mas o arquivo não existe e cai em Georgia. Decidir
  se compra a Moret ou adota Playfair como a serif oficial dos dois.
- **Card de compartilhamento composto.** Hoje o `og:image` é a foto do atleta
  recortada em 1200×630. Um card montado (foto + nome + OVR + apoiadores)
  circularia melhor. Precisa de geração de imagem no edge.

## Referência de design

`revela.olefoot/extracted/design_handoff_revela_home/` — protótipo HTML de alta
fidelidade e o README do handoff. É **referência**, não código para portar.


## Compartilhamento (worker.ts)

Crawler de WhatsApp, X e Instagram **não executa JavaScript**. Numa SPA o
`index.html` é o mesmo pra toda rota — sem intervenção, todo link do REVELA
mostraria o mesmo título e o mesmo ícone, inclusive o perfil de um atleta.

`revela/worker.ts` roda no edge, consulta os RPCs públicos e reescreve as meta
tags com `HTMLRewriter` antes de entregar o HTML. O visitante humano continua
recebendo a SPA normalmente — só o `<head>` chega personalizado.

### Duas armadilhas que já custaram tempo

**1. `run_worker_first` não é opcional.** Por padrão o Cloudflare serve o asset
direto quando o caminho casa com um arquivo, sem invocar o Worker. Como `/` casa
com o index.html, a home saía sem tags injetadas enquanto `/t/<slug>` — que não
casa com arquivo nenhum — funcionava. Dá um bug do tipo "funciona no perfil, não
funciona na home". A lista em `wrangler.jsonc` cobre só as rotas que precisam;
`true` faria cada imagem passar pelo Worker à toa.

**2. `og:image` tem que apontar pra arquivo que existe.** Com
`not_found_handling: single-page-application`, um caminho de imagem inexistente
devolve o index.html com **HTTP 200** — o crawler recebe HTML onde esperava PNG e
o preview quebra sem erro visível. Por isso `public/og-default.png` é gerado de
verdade por `node scripts/gen-revela-og.mjs`.

⚠️ Aquela imagem **não usa a Anton**: o rasterizador (librsvg, dentro do sharp)
lê fontes do sistema e ignora `@font-face` com data URI. Ela vale só pra home e
pro fallback — perfil de talento e de lenda usam a foto do atleta como og:image.

### A regra de slug está escrita duas vezes

O Worker não pode importar `src/data/legends.ts` (roda fora do bundle), então
`slugDoAtleta` é um espelho de `athleteSlug`. Se divergirem, o link que a página
gera deixa de casar com o que o crawler resolve — e o preview quebra justamente
no compartilhamento. `npm run test:revela-share` compara os dois, sem rede nem
banco, e ainda checa se toda rota `/:slug` do App tem tratamento no Worker.
