# Cocito — Briefing de Tokenização

> Coleção memorável OLEFOOT · slug `cocito` · 3 fases

## Identificação canônica

| Campo | Valor | Fonte |
|---|---|---|
| Nome completo | **Thiago Marcelo Silveira Cocito** | ogol, Transfermarkt |
| Nascimento | 24/08/1977 — Bebedouro (SP) | ogol, Transfermarkt |
| Altura / Peso | 1,79 m · 82 kg | ogol |
| Posição | **Volante (VOL)** · secundária: meia central | Transfermarkt |
| Pé bom | Direito | ogol |
| Nacionalidade | Brasil e Itália | Transfermarkt |
| Carreira | **278 jogos · 3 gols** | ogol |
| Clube com mais jogos | Athletico-PR (117) | Transfermarkt |

---

## As 3 fases (clubes definidos pelo fundador)

### 1. Revelação — Botafogo-SP (1995–1998)
Vinte jogos no profissional em Ribeirão Preto. É onde o menino de Bebedouro aprende o ofício que seria dele a carreira inteira. As boas atuações aqui atraem o Atlético Paranaense, que o contrata em **1998** *(umdoisesportes)*.

### 2. Consolidação — Athletico-PR (1998–2003) ⭐ o auge
**117 jogos, cinco temporadas, e o título que define a carreira.** Marca um golaço no Coritiba pela Seletiva da Libertadores de 1999 e a partir dali vira titular e referência *(umdoisesportes)*.

Em 2001 é **titular do Athletico Paranaense campeão brasileiro** — o **primeiro título nacional da história do clube**. O time-base da conquista sai com ele: *"Flávio; Gustavo, Nem e Rogério Corrêa; Alessandro, **Cocito**, Kléberson, Adriano e Fabiano; Kléber e Alex Mineiro"* *(Imortais do Futebol)*. No mesmo ano, campeão paranaense.

> Foi *"um dos símbolos de raça e disposição em campo"* na campanha do título, e *"xodó da torcida do Atlético por seu espírito de entrega"* *(Imortais do Futebol)*.

### 3. Expansão — Grêmio (2004) + Espanha
**51 jogos numa só temporada** pelo Grêmio, com sete Grenais disputados *(umdoisesportes)*. Dali segue para a Europa: **Tenerife** (2005/06, 22 jogos) e **Real Murcia** (2006/07) *(ogol)*.

> ⚠️ A temporada 2004 do Grêmio terminou em rebaixamento. O card celebra **o jogador** — 51 jogos é de quem não se escondeu — e a travessia para a Europa. Não celebra a campanha do time. Cuidado com isso na comunicação.

---

## Estilo de jogo — e a contradição entre as fontes

**As duas fontes concordam no essencial e divergem na técnica:**

| | Imortais do Futebol | Centenário do Athletico (umdoisesportes) |
|---|---|---|
| Marcação | *"sabia marcar as estrelas dos adversários e anulava as jogadas"* | *"desarmava com precisão"* |
| Técnica | *"não tinha técnica alguma"* | *"não merecia a fama de volante-brucutu... categoria para controlar bolas difíceis sob pressão, repertório de dribles e passes curtos e médios"* |
| Assinatura | *"fama de mal e violento"* | *"o lançamento de letra"* |

**Leitura adotada:** marcação de elite é ponto pacífico (as duas afirmam). A técnica fica no meio — competente para sair jogando e segurar bola sob pressão, mas **não é armador**. O fair play fica baixo: a fama de duro aparece nas duas fontes.

**O que os números confirmam:** 3 gols em 278 jogos. Finalização é irrelevante no perfil dele — e é exatamente por isso que a fórmula antiga do OVR o penalizava.

---

## Nota sobre o OVR

Este é o primeiro card lançado depois da correção do **OVR ponderado por posição** (`src/entities/ovrWeights.ts`). Com a fórmula antiga — que dava a finalização o mesmo peso para qualquer posição — a fase do Athletico daria **79**, e chegar a 85 exigiria finalização 93 num jogador de 3 gols em 278 jogos.

Com o peso de volante (marcação 0,22 · tático 0,18 · passe 0,16), os mesmos atributos dão **85**. O número não foi forçado: a medição é que estava errada.

---

## Inconsistências sinalizadas

1. **Técnica** — contradição direta entre fontes (detalhada acima).
2. **terceirotempo.uol.com.br** bloqueou o fetch automatizado; os dados vieram das outras quatro fontes.
3. **Grêmio 2004** — 51 jogos numa temporada de rebaixamento. Tratado com honestidade no card.
4. **Transfermarkt** informa "fim de carreira desde 01/01/2010" e último clube Vila Nova (2008); o ogol registra ainda Bairro Alto em 2012. Sem impacto nas 3 fases escolhidas.

---

## Fontes

1. [ogol — ficha e cronologia de clubes](https://www.ogol.com.br/jogador/cocito/5409)
2. [Transfermarkt — perfil](https://www.transfermarkt.com.br/cocito/profil/spieler/39222)
3. [Imortais do Futebol — Esquadrão Imortal: Atlético-PR 2001](https://imortaisdofutebol.com/esquadrao-imortal-atletico-pr-2001/)
4. [umdoisesportes — Athletico 100 anos: Cocito, o volante raçudo](https://www.umdoisesportes.com.br/athletico100anos/personalidades/cocito-o-volante-racudo-athletico-100-anos/)
5. [Terceiro Tempo — Que fim levou](https://terceirotempo.uol.com.br/que-fim-levou/cocito-4471) *(não acessível por fetch automatizado)*

---

## Wiring comercial

| Papel | Pessoa | Conta |
|---|---|---|
| Jogador (50%) | Thiago Cocito | `cocitos@yahoo.com.br` — **conta a criar no PLAYERVIP** |
| Olefoot (25%) | OLEFOOT | `trader4.tfxpro@gmail.com` |
| Comunidade (15%) | OLEFOOT | `trader4.tfxpro@gmail.com` |
| Facilitador (10%) | **Adauto** | `adautogol@gmail.com` — uid `b0d913c8-…` ✅ conta já existe |
