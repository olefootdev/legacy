# Migrations abandonadas

Estes arquivos foram movidos da pasta `supabase/migrations/` por conflitarem com o
schema real em produção.

Eles criavam/usavam uma tabela `learned_phrases` que **nunca foi aplicada** ao
banco. O sistema de vocabulário de voz em produção usa duas tabelas distintas:

- `manager_learned_phrases` — frases aprendidas por usuário (criada em `20260424000000_learned_phrases.sql`)
- `football_vocabulary` — biblioteca global de comandos PT-BR (criada em `20260426040400_create_football_vocabulary_table.sql`)

## Arquivos

- `20260425_football_vocabulary_library.sql` — INSERTs em `learned_phrases` (tabela inexistente)
- `20260425_language_categorization.sql` — ALTER TABLE `learned_phrases`
- `20260426_learned_phrases.sql` — CREATE TABLE `learned_phrases` com schema diferente do oficial
- `20260426_populate_football_vocabulary.sql` — population de `learned_phrases`

Mantidos como referência histórica caso o vocabulário precise ser migrado para
`football_vocabulary` no futuro (após adaptação dos INSERTs).
