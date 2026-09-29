# OLEFOOT — Como a expansão funciona, vista pelo Growth

Documento de trabalho para o time de aquisição e retenção. Descreve o mecanismo, o custo, os
gatilhos, o que medir e o que testar. Números vêm de `TOKENOMICS.md` (rev. 6) e do código em
`server/src/lib/expansao/`. Onde o número é hipótese, está marcado como hipótese.

---

## 1. Resumo em cinco linhas

1. O produto de entrada é o jogo (grátis, sem carteira). A expansão só começa quando a pessoa compra OLEFOOT pelo canal oficial (Pix ou USDT).
2. Cada compra soma OLEXP à rede de quem convidou, em cima até a raiz. OLEXP é contador, não tem preço.
3. A cada ciclo (de hora em hora) o sistema compara os dois times de cada pessoa e paga sobre o menor.
4. O pagamento sai de um pool: no máximo 25% da receita elegível do ciclo (percentual configurável). Sem receita, não há pagamento.
5. Para o Growth, isso é um canal de custo variável: o custo de aquisição só existe depois que a receita entrou, e tem teto.

---

## 2. Custo de aquisição: o que é fixo e o que é variável

| Item | Comportamento |
|---|---|
| Pool do ciclo | `percentual × receita elegível`, arredondado para baixo. Padrão: 25% (2.500 bps) |
| Ciclo sem receita | Não liquida. Equiparação fica retida e entra no próximo ciclo com pool. Nada é debitado |
| Valor por OLEXP | Não existe constante. É `pool ÷ OLEXP equiparado no ciclo`. Varia a cada ciclo |
| Tranche de tokens | Menor entre o degrau administrativo e o que a receita cobre (`trancheLiberavel`) |
| Saída para o mercado | Teto de 1% de impacto por dia no claim. Tranche de 20M sai em ~50 dias |
| Compra na DEX | Não gera OLEXP de equiparação nem de qualificação. Não entra na conta do pool |
| Crédito manual (admin) | Nunca gera equiparação. Trava fixa no código |

**Leitura para o planejamento:** o teto de repasse da rede é 25% da receita elegível. Esse é o
limite de CAC do canal. Ele não pode ser estourado por volume, porque o pool é função da receita.
Se entra mais gente equiparando na mesma hora, o valor por OLEXP daquela hora cai; o caixa não.

Exemplo do próprio documento de tokenomics: receita elegível de US$ 10.000 gera pool de
US$ 2.500. Se nessa hora forem equiparados 500.000 OLEXP, o valor de liquidação é
US$ 2.500 ÷ 500.000 = US$ 0,005 por OLEXP. Se forem equiparados 2.500.000, cai para US$ 0,001.
O mesmo pool, dividido por mais gente.

**Consequência de comunicação:** nunca publicar valor por OLEXP como referência. Um valor
publicado num ciclo bom vira expectativa nos seguintes.

---

## 3. O funil, etapa por etapa

| # | Etapa | Evento a medir | Observação |
|---|---|---|---|
| 1 | Visita | `landing_view` (com origem e código de convite) | Convite chega por `/cadastro/<código>` |
| 2 | Cadastro | `signup` | Conta criada, referência gravada |
| 3 | Time montado | `squad_created` | Só isso já é uso real do produto |
| 4 | Primeira partida concluída | `match_finished` | Marco de ativação do jogo |
| 5 | Retorno em 7 dias | `match_finished` na semana 2 | Marco de retenção do jogo |
| 6 | Carteira vinculada | `wallet_linked` | Vínculo por assinatura, não por sessão |
| 7 | Primeira compra de OLEFOOT | `purchase_olefoot` (canal, pack, valor) | Aqui nasce OLEXP e receita |
| 8 | Primeiro convite enviado | `invite_sent` | |
| 9 | Primeiro convidado com compra | `invitee_purchase` | |
| 10 | Ativação de rede | 1 indicado direto em cada time | Condição para equiparar |
| 11 | Primeiro pagamento de ciclo | `cycle_settled` | |
| 12 | Claim | `claim` | Sujeito ao teto diário |
| 13 | Recompra / uso em produto | `spend_olefoot` (card, lenda, vault) | Fecha o ciclo de reaproveitamento |

As etapas 1 a 5 medem o jogo. As 6 a 13 medem a expansão. Os dois blocos devem ser lidos em
painéis separados: uma queda na etapa 5 não deve ser mascarada por crescimento na etapa 9.

### Ponto de partida medido (2026-09-20, conferir antes de usar)
- 228 contas, 78 com time montado.
- 7 pessoas jogaram nos últimos 30 dias; 4 nos últimos 7.
- A telemetria de eventos (`track()`) capturou 6 dessas 7. O sinal confiável de atividade é `manager_squad.updated_at`.

Esses números definem o desenho da campanha: a base ativa é pequena, então o esforço inicial
é de ativação e retorno, não de volume de topo de funil.

---

## 4. Os ciclos de crescimento

### Ciclo A: convite com compra
1. Pessoa ativa no jogo compra OLEFOOT (canal oficial).
2. Convida por link; o convidado entra em um dos dois times, no lado escolhido por quem convidou.
3. Convidado compra. O OLEXP dele soma nas pernas dos ancestrais (a compra dele não conta para a própria perna).
4. No fechamento do ciclo, o menor lado é equiparado e vira pagamento.
5. O pagamento chega em OLEXP e converte para OLEFOOT no claim, ao valor registrado no ciclo.
6. Parte volta ao produto (card, lenda, Vault), o que gera nova receita elegível.

Alavancas: taxa de convite por comprador (etapa 8), conversão do convidado (9), tempo entre 7 e 9.

### Ciclo B: retorno dos credores da v1
Existem 69 credores no snapshot congelado (639.037.272 unidades, razão 1:1 para o token).
46 deles nunca logaram na v11 e concentram 76% do valor. Nenhum tem carteira Solana assinada.
O modelo é resgate: quem vincular, recebe; sem prazo. Faixas de liberação:

| Faixa | Pessoas | % do balde | Liberação |
|---|---|---|---|
| até 1M unidades | 22 | 1,3% | 100% no lançamento |
| 1M a 10M | 34 | ~19% | 24 meses, linear |
| acima de 10M | 13 | ~80% | 60 meses, linear diário |

Uso em Growth: é uma lista finita e conhecida, com motivo concreto para voltar. Contato direto
e individual, não campanha aberta. Métrica: credores com carteira vinculada / 69.

### Ciclo C: pré-venda com liberação por nova entrada
O token da pré-venda entra travado e libera por tempo ou por compra nova (Pix/USDT), com teto
de 85% pela porta de compra e paridade em token no preço atual. Efeito esperado: a trava
transforma vontade de sair em compra de produto. Compra em card, lenda ou pack do jogo conta
igual à compra de token.

---

## 5. Segmentos e o que cada um precisa ouvir

| Segmento | Situação | O que precisa saber | Ação principal |
|---|---|---|---|
| Jogador sem carteira | Joga, não tem interesse em token | Nada muda para ele | Nenhuma comunicação de token. Não interromper o jogo |
| Jogador com carteira | Vinculou a OLEWALLET | Como comprar, taxa de 5%, ATA | Guia de primeira compra |
| Comprador de pré-venda | Tem token travado | Calendário de liberação, como destravar | Extrato individual |
| Quem convida | Tem rede | Estado de cada time, o que falta para ativar | Painel de rede com falta por perna |
| Credor da v1 | Snapshot congelado | Quanto tem, como resgatar | Contato individual |
| Atleta do REVELA | Perfil no portal | Nada de token | Fora do escopo da expansão |

---

## 6. Métricas que governam o canal

**Saúde do canal**
- Receita elegível por ciclo e pool do ciclo.
- Valor por OLEXP equiparado, série por ciclo (uso interno).
- Ciclos retidos (sem pool) / ciclos totais.
- Custo de rede sobre receita: pagamentos liquidados ÷ receita elegível. Deve ficar abaixo do percentual configurado.

**Aquisição**
- Compradores novos por origem (convite, orgânico, credor v1).
- Convites enviados por comprador, e convites que viram compra.
- Tempo entre cadastro e primeira compra; entre primeira compra e primeiro convite.

**Ativação de rede**
- Percentual de compradores com 1 indicado nos dois times. Meta de acompanhamento: quanto tempo leva para ativar.
- Saldo retido por inatividade (OLEXP de gente que ainda não ativou) e sua idade.
- Desequilíbrio entre pernas: razão menor/maior por pessoa. Perna vazia é o gargalo principal de pagamento.

**Retenção**
- Retorno ao jogo em 7 e 30 dias, separado por quem comprou e quem não comprou.
- Compradores que gastaram OLEFOOT em produto em 30 dias.
- Claims por dia versus teto de 1%.

**Sinal de alerta**
- Queda do valor por OLEXP por vários ciclos seguidos com crescimento de gente: a base cresce, o repasse por pessoa cai. Precisa de comunicação antes de virar reclamação.
- Concentração: participação do maior comprador na pré-venda (teto por conta ainda a definir; o documento recomenda US$ 500 até metade vendido).

---

## 7. Experimentos, com critério de parada

| # | Hipótese | Como testar | Métrica | Critério |
|---|---|---|---|---|
| E1 | Mostrar "falta 1 indicado no Time 2" sobe a taxa de ativação | Painel com a perna faltante vs. sem | % ativado em 14 dias | Segue se ≥ +20% relativo |
| E2 | Guia de primeira compra reduz abandono no Pix | Passo a passo com valor em R$ e USD lado a lado | Compra concluída / compra iniciada | Segue se subir; para se aumentar suporte |
| E3 | O pack de US$ 10 é a porta de entrada mais usada | Ordem e destaque dos packs | Distribuição de packs e recompra | Ajustar ordem, não preço |
| E4 | Contato individual traz credores da v1 | Mensagem direta aos 22 da faixa livre primeiro | Carteiras vinculadas / 22 | Se < 3, revisar canal |
| E5 | Extrato de ciclo diário mantém retorno ao jogo | E-mail/notificação com estado dos times | Retorno em 7 dias | Segue se ≥ grupo controle |
| E6 | Explicar a taxa de 5% antes da compra reduz ticket de suporte | Aviso na tela de compra | Tickets sobre "recebi menos" | Segue se cair |
| E7 | Convite pelo lado mais fraco melhora pagamento | Sugestão automática de lado | Razão menor/maior | Segue se subir |

Regra geral: cada teste com grupo de controle e período fixo. Com base ativa de dezenas de
pessoas, muitos testes serão qualitativos. Registrar isso na conclusão.

---

## 8. Riscos operacionais do canal

| Risco | Por que ocorre | Mitigação |
|---|---|---|
| Expectativa de valor fixo | Um ciclo bom vira referência mental | Não publicar valor por OLEXP; extrato mostra o ciclo, não a média |
| Diluição em hora de pico | Muita equiparação com pool fixo | Explicar a regra antes; mostrar pool e total equiparado no extrato |
| Ciclos vazios | Receita baixa no início | Avisar no painel que ciclo sem pool retém, não perde |
| Perna vazia | Quem convida põe todos de um lado | Sugestão de lado; explicação de que o menor manda |
| Suporte por taxa | 5% em toda transferência, mais ATA (~0,002 SOL) | Comunicar os dois juntos na compra e no primeiro claim |
| Concentração na pré-venda | Pack de US$ 1.250 é 4% do total | Teto por conta com degrau |
| Saída em bloco no lançamento | Com a regra atual, 95% disponível no dia 0 | Decisão pendente (#12); toda entrada nova deve ir para liquidez |

---

## 9. O que a comunicação pode e não pode fazer

**Pode**
- Explicar o mecanismo com números e limites.
- Mostrar o estado do time de cada pessoa (quanto falta, o que está retido).
- Mostrar a tabela do token e as travas.
- Mostrar evolução de graduação (Campeão até Penta) como progresso de rede, sem valor associado.

**Não pode**
- Publicar ganhos de terceiros, prints de pagamento ou ranking por valor recebido.
- Escrever um valor por OLEXP, uma estimativa de retorno ou um prazo para "recuperar".
- Vincular a entrada na rede a promessa de valorização do token.
- Pedir convite como condição para usar o jogo.
- Omitir que a ativação exige convidar ao menos uma pessoa em cada time.

Essas restrições valem também para parceiros, líderes e qualquer conteúdo que use a marca.
Vale registrar um termo de conduta para quem divulga.

---

## 10. Ordem de execução sugerida

1. Instrumentar os eventos da seção 3 (etapas 6 a 13 ainda não existem em telemetria).
2. Painel de rede por pessoa: os dois times, saldo retido, o que falta para ativar.
3. Extrato de ciclo com pool, total equiparado e valor daquele ciclo.
4. Guia de primeira compra com taxa e ATA explicadas (E2, E6).
5. Contato individual com os 22 credores da faixa livre (E4).
6. Convite com sugestão de lado (E7).
7. Só depois: volume de topo de funil.

Pendências que bloqueiam texto público: teto por conta da pré-venda, teto mensal de marketing,
regra de 85% versus 95% no dia 0, revisão jurídica por país.
