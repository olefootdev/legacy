# CREATE PLAYER — integração e contratos

Referência para copiar alinhada ao código. A fonte canónica em TypeScript (constantes + texto) está em:

`src/gamespirit/admin/createPlayerIntegrationReference.ts`

Exporta entre outros `CREATE_PLAYER_INTEGRATION_COPYPASTA` e `CREATE_PLAYER_GEMINI_RESPONSE_SHAPE`.

## Passo a passo (Admin UI)

1. Nome  
2. Posição (`GOL`, `ZAG`, `LE`, `LD`, `VOL`, `MC`, `PE`, `PD`, `ATA`)  
3. País (texto livre)  
4. **Tipo de jogador** (`creatorType`: novo_talento, campeao, amador, olefoot, lenda), **raridade** (`rarity`: normal, premium, bronze, prata, ouro, raro, ultra_raro, epico) e **pé bom** (`right` | `left` | `both`)  
5. Foto (ficheiro → `portraitUrl` data URL)  
6. Prompt → GameSpirit (Gemini) preenche atributos, `archetype`, `behavior`, `quemSouEu` / `bio`, opcionais `num`, fadiga, etc.  
7. Preview  
8. Salvar → `MERGE_PLAYERS` com `listedOnMarket: false`  
9. Lançar no mercado → `MERGE_PLAYERS` no mesmo `id` com `marketValueBroCents` e `listedOnMarket: true`  

## JSON devolvido pelo modelo (passo 6)

Não incluir `name`, `pos`, `country`, `strongFoot` — o cliente fixa-os antes do pedido.

Ver `CREATE_PLAYER_GEMINI_RESPONSE_SHAPE` no ficheiro TS.

## Campos extra em `PlayerEntity`

- `portraitUrl?: string`  
- `marketValueBroCents?: number`  
- `country?: string`  
- `strongFoot?: 'right' | 'left' | 'both'`  
- `bio?: string` (“quem sou eu”)  
- `listedOnMarket?: boolean`  

## Persistência

`dispatch({ type: 'MERGE_PLAYERS', players: { [id]: entity } })`
