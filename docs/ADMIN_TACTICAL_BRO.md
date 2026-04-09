# Admin: padrões de jogador, BRO e padrões táticos

Complementa o motor visual (Babylon + Yuka) descrito no repositório. **O Admin não é o app de jogo do manager** (Vite/React deste pacote): é aplicação separada (subdomínio, deploy e auth de staff). O cliente de jogo só **consome** artefatos versionados via API/CDN.

## Princípio mestre

Um único sistema de coordenadas e zonas, identificado por `fieldSchemaVersion` (ex.: `olefoot-field-v1` em `src/field-schema/constants.ts`):

- Admin desenha/seleciona zonas nesse espaço (normalizado 0–1 `nx` × `nz` ou grade lógica derivada).
- `formation` + `tactics` + partida ao vivo resolvem os **mesmos** `zoneId` do catálogo.
- `MatchTruthSnapshot` pode incluir `fieldSchemaVersion` para alinhar debug, bridge e replay.

Arquivos de referência no monorepo (cliente):

| Área | Caminho |
|------|---------|
| Versão do gramado | `src/field-schema/constants.ts` |
| Tipos Admin → runtime | `src/field-schema/adminArtifacts.ts`, `catalogTypes.ts` |
| Catálogo mínimo v1 | `src/field-schema/sampleZones.v1.ts` |
| Padrão tático built-in | `src/field-schema/defaultTacticalPattern.v1.ts` |
| Validação padrão × catálogo | `src/field-schema/validatePattern.ts` |
| Query ponto → zonas | `src/field-schema/zoneQuery.ts` |
| Mescla pesos Yuka + viés manager | `src/field-schema/mergeRuntime.ts` |
| Contrato HTTP (paths) | `src/api/adminPublicContract.ts` |
| Smoke test | `npm run test:field-smoke` → `src/field-schema/smokeSlotsInField.ts` |

## Dados publicados (tipos)

- **`PlayerFieldProfile`**: `playerId`, `fieldSchemaVersion`, `zones` (`ZoneBinding`: preferida / proibida / pressão), `teachingRules`, `yukaWeights?`.
- **`TacticalPattern`**: `formationKey`, `slotTemplate`, `phasePresets`, `behavior` (`blockDepthBias`, `widePlayBias`, `pressTriggerZones`).
- **`FieldZoneCatalog`**: lista de `FieldZone` com `polygon` em coordenadas normalizadas.
- **`BroSpecialPlayerCreationLedger`**: `priceBro`, `facilitatorId`, `splitsSnapshot` imutável, `creationTx` / `paymentIntentId`, idempotência em webhook (backend).

Pipeline na partida (alvo de integração futura no `TacticalSimLoop`):

1. `formation` → slot primário.  
2. `tactics` + **zona atual** (`zonesContainingWorldPoint`) → ajuste do alvo.  
3. `teachingRules` → pesos Yuka / flags.  
4. Yuka → velocidade.  
5. Babylon → snapshot.

Os **sliders do manager** continuam como viés sobre o padrão do clube (`mergeRuntime.managerBiasFromSliders`), não substituem o artefato base.

## API interna (esboço)

Implementação no backend; o game só precisa dos tipos e URLs estáveis:

| Método | Caminho | Resposta |
|--------|---------|----------|
| GET | `/api/v1/field-schema/:version/catalog.json` | `FieldZoneCatalog` |
| GET | `/api/v1/tactical-patterns/:id` | `TacticalPattern` |
| GET | `/api/v1/players/:id/field-profile` | `PlayerFieldProfile \| null` |
| POST | `/internal/staff/bro/special-players` | staff only — corpo/retorno em `adminPublicContract.ts` |

Publicação: artefatos versionados (ex. `tactical-patterns@v7.json` ou row versionada no DB). Ao salvar no Admin, validar todo `zoneId` referenciado contra o catálogo da **mesma** `fieldSchemaVersion` (`validateTacticalPatternAgainstCatalog`).

## Jogador especial (BRO)

Mesmo `PlayerFieldProfile` que um jogador normal; a diferença é **onboarding econômico** (preço BRO, split, facilitador), persistido de forma auditável. Regras “premium” de ensino, se existirem, devem ser explícitas no produto.

Split de referência (percentuais do doc de produto): Olefoot 25%, Agente 10%, Pool jogador 50%, Comunidade 15% — armazenar em `BroSplitSnapshot` no mint.

## Critérios de aceite (checklist)

- [ ] Admin em app/deploy separado; auth staff; rotas de cadastro fora do build público do game.  
- [ ] Campo no Admin usa a mesma `fieldSchemaVersion` que a partida.  
- [ ] `TacticalPattern` salvo é carregável em partida de teste e altera slots/zonas observáveis.  
- [ ] `PlayerFieldProfile` altera comportamento mensurável em build de teste.  
- [ ] BRO: preço + split persistido + `facilitatorId` ligado a pagamento + idempotência de webhook.  
- [ ] Smoke: `npm run test:field-smoke` no CI.

## Compliance

Split BRO e facilitador exigem revisão jurídica local; este documento não é assessoria legal.
