# A TRAJETÓRIA — campanha de divulgação do REVELA

> Plano de carreira simulado do **atleta**. Ele divulga, acumula **OLEKO**, sobe de divisão,
> ganha medalhas e troféus — e cada divisão libera um prêmio em **EXP do game** que só é sacado
> com clube criado.
>
> Aprovado pelo fundador em 2026-08-02. Este arquivo é a fonte de verdade do plano; o artifact
> (`claude.ai/code/artifact/f40acbd4`) é a versão de leitura.

---

## 0. Placar de execução

| # | Peça | Estado |
|---|---|---|
| 1 | Motor do OLEKO no banco (`revela_oleko_events`, `revela_my_trajetoria`, `revela_oleko_grant`) | ✅ escrito · ⏳ **migration não aplicada** |
| 2 | Catálogo no cliente (`revela/src/data/trajetoria.ts`) | ✅ |
| 3 | COMO FUNCIONA — 5 passos no painel | ✅ |
| 4 | Tasks — comece por aqui · esta semana · suas metas | ✅ |
| 5 | Card "X EXP esperando por você → criar meu clube" | ✅ |
| 6 | Renomear **apoiador → FÃ** | ✅ |
| 7 | Prateleira de **medalhas e troféus** no painel | ✅ |
| 8 | **Ranking público por chave** (`revela_trajetoria_ranking` + seção na home) | ✅ escrito · ⏳ migration |
| 9 | Cadastro leve de **FÃ** dentro do REVELA (AuthSheet cria conta + retoma a ação) | ✅ |
| 10 | **Gerador de story 9:16** (canvas, com share nativo no celular) | ✅ |
| 11 | Ponte do scout pra creditar OLEKO (`POST /api/revela-admin/oleko`) | ✅ |
| 12 | Card em tempo real (como o manager o vê) | ⏳ |
| 13 | Notificações (apoio novo, ultrapassagem no ranking) | ⏳ |
| 14 | Tela de admin com os botões de crédito do Instagram | ⏳ — hoje a rota existe, falta a UI |
| 15 | App Review na Meta pra automatizar a marcação | ⏳ — temporada 2 |

**Decisões ainda abertas do fundador:** data da largada · teto de contas premiadas por divisão.

---

## 1. Por que OLEKO, e não EXP

Se a escada medisse EXP vitalício, quem já joga há meses largaria com milhões acumulados e
**nasceria Campeão sem disputar nada**. A campanha viraria um retrato do passado.

OLEKO é moeda nova: **zerada pra todo mundo na largada**, **acumula e não se gasta**. É placar,
não carteira. O que se gasta é o EXP que cada divisão libera.

O nome também resolve a colisão com `src/systems/careerTiers.ts`, onde *Fraldinha* e *Campeão*
já são degraus da carreira do **manager**.

---

## 2. Quem corre — e em qual chave

**Só atleta do REVELA.** Manager do game não compete: ele é o outro lado do mercado.

Quatro chaves separadas, pela `game_situation` que o atleta já declara no cadastro:

| Chave | `game_situation` | Por quê |
|---|---|---|
| Novos talentos | `escolinha` | A chave que mais precisa de proteção — e onde o produto se prova |
| Amadores | `junior` | Base, juniores, várzea forte |
| Pro | `profissional` | Traz credibilidade e imprensa |
| Lendas | `lenda` | Audiência pronta — por isso correm entre si |

**Motivo das chaves:** uma lenda com 40 mil seguidores junta mil fãs numa tarde; um moleque de
14 anos de uma peneira junta trinta em duas semanas. No mesmo ranking o segundo desiste na
primeira olhada — e ele é exatamente quem a campanha existe pra atrair.

---

## 3. As cinco divisões

| Divisão | OLEKO | Prêmio no game | Como se chega |
|---|---:|---:|---|
| Fraldinha | 0 | — | Todo mundo entra aqui |
| **Junior** | 2.500 | **250.000 EXP** | Ficha + @ + clube criado. 20 minutos, dia 1 |
| **Sub 17** | 10.000 | 500.000 EXP | Só quem trouxe alguém: 1 talento aprovado ou 1.000 fãs |
| **Pro** | 30.000 | 2.000.000 EXP | Rede montada — 2.500 fãs ou uma leva de talentos |
| **Campeão** | 75.000 | 8.000.000 EXP | Puxou uma geração. Troféu permanente |

Os prêmios de Sub 17, Pro e Campeão batem exatamente com os degraus de `careerTiers.ts`
(Amador 500k, Profissional 2M, Campeão 8M): **vencer a Trajetória te instala no degrau
equivalente da carreira do manager**. O de Junior é número do fundador.

### O gancho que converte atleta em jogador

O prêmio **exige clube criado**. Quem não tem, não perde — o valor fica retido e o painel mostra
*"Você tem 250.000 EXP esperando por você. Cria teu clube pra sacar."* É a razão de a campanha
existir.

### A conta a olhar antes da largada

500 atletas em Junior = **125 milhões de EXP emitidos**. Não vira dinheiro (Exchange fora do ar
desde 2026-08-01), mas é volume. Recomendação: **teto de contas premiadas por divisão** na
temporada 1, anunciado desde o dia zero.

---

## 4. Catálogo de missões

Régua de origem: **criar um jogador custa 1.000 EXP** — o único preço de referência escrito no
jogo (`src/systems/network/milestones.ts`).

### A · Sua ficha (uma vez)
| Missão | OLEKO |
|---|---:|
| Suba sua foto de perfil | 500 |
| Suba um vídeo de 15 segundos jogando | 500 |
| Escolha seu @username | 500 |
| Ficha avaliada pelo OLE SCOUT | 2.000 |
| Crie seu clube no game | 2.500 |

### B · Torcida (fãs)
| Marco | OLEKO |
|---|---:|
| 10 fãs | 100 |
| 100 fãs | 2.500 |
| 1.000 fãs | 7.500 |
| 2.500 fãs | 15.000 |
| 5.000 fãs | 30.000 |
| 10.000 fãs | 60.000 |

Os degraus baixos (10, 100) existem pra dar sinal de progresso na primeira semana. Sem eles o
primeiro marco fica a mil de distância e ninguém vê a barra andar.
10.000 fãs sozinho **não** fecha Campeão — de propósito: o topo exige mais de uma frente.

### C · Chamar gente
| Missão | OLEKO |
|---|---:|
| Cada atleta seu aprovado pelo scout | 1.250 |
| **Lenda** aprovada (ex-atleta) | 2.500 — o dobro, traz a audiência junto |
| Bônus: 5 aprovados na sua rede | 10.000 |
| Seu card jogável foi lançado | 10.000 |

### D · Instagram (semanal)
| Missão | OLEKO | Verificação |
|---|---:|---|
| Marcou @olefootgame em post/reels | 1.000 | webhook `mentions` (ver §5) |
| Marcou no story | 500 | manual |
| Seguiu o perfil | 300 | na confiança |

### E · Vitrine viva (semanal)
| Missão | OLEKO |
|---|---:|
| Alta da Semana — 1º / 2º / 3º da chave | 3.000 / 2.000 / 1.000 |
| Highlight novo publicado | 300 |

---

## 5. Instagram — o que dá e o que não dá

Verificado na documentação da Meta em 2026-08-02.

- **Marcação em post, reels, legenda ou comentário: dá pra verificar sozinho.** Webhook
  `mentions`, escopos `instagram_business_basic` + `instagram_business_manage_comments`.
- **Story: a doc não confirma.** As páginas de webhook listam `comments`, `mentions`,
  `story_insights` e `messages`, e citam story mention só como canal que *inicia conversa*, sem
  documentar o evento.
- **Follow: impossível.** Nenhum escopo da Instagram Platform toca em seguir ou verificar
  seguidor (verificado em 2026-08-02, ver `project_revela_lancamento`).
- **O webhook exige App Review + verificação de negócio da Meta** — dias ou semanas.
  → **A temporada 1 roda em conferência manual**, pelo mesmo olheiro que já aprova talento.

---

## 6. ✅ O funil do FÃ — resolvido em 2026-08-02

**Era assim:** `AuthSheet.tsx` só fazia login, e "Não tenho conta" apontava pra
`game.olefoot.com/cadastro`. Ou seja, **pra virar fã de um amigo a pessoa tinha que ir criar um
clube num jogo de gerenciamento de futebol.** Com meta de 10.000 fãs, esse funil não fechava.

**Agora:** a folha abre em **CRIAR CONTA** (e-mail + senha, ali mesmo), usando `signUpRevela()`,
que já carregava o `referred_by_code` guardado por `captureReferralFromUrl()` — a mesma via do
cadastro do jogo. Conta criada aqui nasce com indicador quando existe indicador; o medo original
de "usuário órfão" não procedia.

Duas decisões que vieram junto:

- **A ação pendente é retomada.** Quem clica em "SOU FÃ", cria a conta e volta, encontrava o
  mesmo botão intocado e precisava lembrar de clicar de novo — no ponto de maior atrito do funil.
  `App.tsx` guarda a ação em `pendente` e a executa quando a sessão aparece.
- **E-mail já cadastrado não vira texto vermelho:** a folha troca sozinha para o modo "entrar".

O caminho pro jogo continua na folha, mas com o rótulo honesto: *"Quero criar meu clube no game"*
— pra quem quer o clube, não pra quem quer apoiar.

---

## 7. Travas

| Trava | Regra |
|---|---|
| **Indicação** | OLEKO só na **aprovação do OLE SCOUT**, nunca no cadastro. Cadastrar é automatizável; ser aprovado exige um olheiro assistindo ao vídeo |
| **Crédito** | Sempre no servidor, `unique(conta, missão)`. Crédito nascido no cliente é replicável no console do navegador |
| **`revela_oleko_grant`** | Sem grant pra anon/authenticated — só service role, via o bridge do servidor |

### Uma trava que foi DERRUBADA, e por quê

A primeira versão exigia que **apoio só contasse de conta com clube** (`exp_lifetime_earned > 0`),
espelhando os marcos de rede. **Cortada** depois que o fundador confirmou que EXP é dinheiro
fictício e nunca vira dinheiro real: a regra mataria o funil do fã, e sem lastro financeiro o
custo do abuso é ranking sujo, não prejuízo. Fica: Turnstile no cadastro, par único por conta e
talento, e auditoria manual do topo de cada chave antes de pagar prêmio.

---

## 8. Arquitetura

```
revela_supports ─┐
revela_talents ──┼─► revela_my_trajetoria()  ─►  painel /meu-perfil
profiles ────────┤        (deriva tudo)          ranking público
revela_oleko_events ┘   (+ soma o creditado)
```

- **O cálculo mora no banco.** `revela/src/data/trajetoria.ts` espelha os valores e serve só pra
  desenhar a tela. Se os dois divergirem, painel e ranking pagariam prêmios diferentes.
- **Duas fontes de OLEKO:** *derivado* (foto? vídeo? quantos fãs? quantos indicados aprovados?)
  não guarda linha nenhuma — se o dado muda, o OLEKO muda junto. *Creditado* (Instagram, pódio)
  vira linha em `revela_oleko_events`.
- **A Trajetória some inteira** se a RPC não existir. É camada, não alicerce: o painel continua
  de pé sem ela.

### Arquivos

| Arquivo | Papel |
|---|---|
| `supabase/migrations/20260803120000_revela_trajetoria_oleko.sql` | Motor. ⏳ pendente |
| `supabase/migrations/20260802140000_revela_expoe_situacao.sql` | Expõe `game_situation` (a chave). ⏳ pendente — **aplicar ANTES** |
| `revela/src/data/trajetoria.ts` | Divisões, chaves, missões semanais |
| `revela/src/components/Trajetoria.tsx` | COMO FUNCIONA + os 3 blocos de task |
| `revela/src/pages/MeuPerfilPage.tsx` | Onde a Trajetória entra |

---

## 9. Regra de honestidade da UI

**Task que a pessoa não pode cumprir hoje não aparece como task — vira meta com barra.**
"Chegue a 10.000 fãs" num perfil com 12 fãs não é missão, é deboche. Toda meta mostra o número
real ao lado do alvo: *"112 de 1.000 — faltam 888"*.

---

## 10. A temporada

- **6 semanas.** Curto o bastante pra gerar pressa, longo pra caber uma rede.
- **Placar público por chave**, atualizando ao vivo.
- **Corte semanal:** toda segunda sai o pódio — sete largadas em vez de uma.
- **Prêmios:** 1º de cada chave leva carta de lenda do acervo (`legacy_players`); 2º e 3º, pacote
  de EXP; top 10, selo permanente de Fundador da Temporada 1.
- **Zera e recomeça.** A divisão conquistada vira histórico no perfil.

---

## 11. Leitura do documento de referência (Sorare / Playerhunter)

**Puxar:** card em tempo real no painel · gerador de mídia kit · narrativa
*"assinou o 1º contrato"* quando o card é vendido (evento que já existe no banco).

**Segurar:**

- **Item pago que dá bônus de atributo** — é pay-to-win dentro de ligas onde as pessoas competem
  entre si: o card rende mais porque alguém pagou, não porque o atleta cresceu. Item cosmético
  sim; item que mexe em atributo, não. Se o bônus tiver que existir, que venha de OLEKO ganho.
- **Saque de comissão em dinheiro por marco de divulgação** — recria, dias depois do expurgo de
  rentabilidade (2026-08-01), a leitura de que a OLEFOOT paga por indicação, agora com público
  menor de idade. Vale como **repasse de venda de card** (o atleta vendeu algo), nunca como
  prêmio por recrutar.
