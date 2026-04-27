# GLOBAL LEAGUE MVP - Implementação Completa

## Status: ✅ Estrutura Base Criada

## Arquivos Criados

### 1. `/src/match/globalLeagueMVP.ts` ✅
Sistema completo de liga global com:
- Registro de times (aguarda 32 times)
- Sistema de playoffs (3 rodadas ida/volta = 6 jogos)
- Distribuição automática em 3 divisões baseada em pontos
- Sistema de promoção/rebaixamento (10% dos times)
- Geração automática de rodadas
- Atualização de classificação

## Fluxo Implementado

### Fase 1: Registro (waiting_teams)
```typescript
- Aguarda 32 times se cadastrarem
- Cada time registra: managerId, clubName, clubShort, overall
- Quando atingir 32 → inicia playoffs automaticamente
```

### Fase 2: Playoffs (playoffs)
```typescript
- 3 rodadas de turno (ida)
- 3 rodadas de returno (volta)
- Total: 6 jogos por time
- Todos jogam contra todos (round-robin)
- Acumula pontos, vitórias, saldo de gols
```

### Fase 3: Distribuição em Divisões
```typescript
- Após 6ª rodada de playoff
- Ordena times por:
  1. Pontos dos playoffs
  2. Vitórias
  3. Saldo de gols
  4. Gols marcados
  5. Nome (desempate)
- Distribui em 3 divisões (~11 times cada):
  - Divisão 1: Top 11 (posições 1-11)
  - Divisão 2: Meio 11 (posições 12-22)
  - Divisão 3: Bottom 10 (posições 23-32)
```

### Fase 4: Liga Oficial (active)
```typescript
- Cada divisão joga turno e returno
- Sistema de pontos corridos
- Atualização automática de classificação
- Forma recente (últimos 5 jogos)
```

### Fase 5: Promoção/Rebaixamento
```typescript
- Ao final da temporada
- Top 10% de cada divisão → promovido
- Bottom 10% de cada divisão → rebaixado
- Divisão 1: ~1 time promovido/rebaixado
- Divisão 2: ~1 time promovido/rebaixado
- Divisão 3: ~1 time promovido/rebaixado
```

## Tipos Principais

### GlobalTeam
```typescript
{
  id: string;
  managerId: string;
  clubName: string;
  clubShort: string;
  overall: number;
  
  // Stats playoffs
  playoffPoints: number;
  playoffMatchesPlayed: number;
  playoffWins: number;
  playoffDraws: number;
  playoffLosses: number;
  playoffGoalsFor: number;
  playoffGoalsAgainst: number;
  
  // Stats liga oficial
  division?: number;
  points: number;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  position?: number;
  previousPosition?: number;
  recentForm: Array<'W' | 'D' | 'L'>;
}
```

### GlobalLeagueMVPState
```typescript
{
  seasonId: string;
  status: 'waiting_teams' | 'playoffs' | 'active' | 'season_ended';
  teams: GlobalTeam[];
  minTeamsRequired: 32;
  playoffRounds: PlayoffRound[];
  currentPlayoffRound?: number;
  leagueRounds: LeagueRound[];
  currentLeagueRound?: number;
  teamsPerDivision: number;
  promotionPercentage: 0.1;
  relegationPercentage: 0.1;
}
```

## Funções Principais

### Registro
- `createGlobalTeam()` - Cria novo time
- `registerTeam()` - Registra time na liga
- Trigger automático de playoffs ao atingir 32 times

### Playoffs
- `generatePlayoffRounds()` - Gera 6 rodadas (3 ida + 3 volta)
- `updatePlayoffStats()` - Atualiza stats após cada jogo
- `finalizePlayoffRound()` - Finaliza rodada e verifica se deve iniciar liga

### Divisões
- `distributeIntoDivisions()` - Distribui times em 3 divisões
- `generateLeagueRounds()` - Gera rodadas da liga oficial
- `updateDivisionPositions()` - Atualiza posições dentro de cada divisão

### Liga Oficial
- `updateLeagueStats()` - Atualiza stats após cada jogo
- `finalizeLeagueRound()` - Finaliza rodada e atualiza classificação

### Promoção/Rebaixamento
- `applyPromotionRelegation()` - Aplica promoção/rebaixamento ao final

## Constantes

```typescript
GLOBAL_LEAGUE_MVP_CONSTANTS = {
  MIN_TEAMS: 32,
  PLAYOFF_ROUNDS: 6,
  DIVISIONS: 3,
  PROMOTION_PERCENTAGE: 0.1,
  RELEGATION_PERCENTAGE: 0.1,
  ROUND_INTERVAL_MS: 3600000, // 1 hora
}
```

## Próximos Passos (TODO)

### 1. Integração com Reducer ⏳
```typescript
// Adicionar actions ao reducer:
- REGISTER_GLOBAL_TEAM
- START_GLOBAL_PLAYOFF_ROUND
- FINISH_GLOBAL_PLAYOFF_ROUND
- START_GLOBAL_LEAGUE_ROUND
- FINISH_GLOBAL_LEAGUE_ROUND
- APPLY_PROMOTION_RELEGATION
```

### 2. UI de Registro ⏳
```typescript
// Criar tela de registro na liga
- Botão "Entrar na Liga Global"
- Mostra contador: X/32 times cadastrados
- Lista de times já cadastrados
- Aguarda 32 times para iniciar playoffs
```

### 3. UI de Playoffs ⏳
```typescript
// Tela de acompanhamento dos playoffs
- Tabela de classificação dos playoffs
- Próximas rodadas
- Resultados das rodadas anteriores
- Countdown para próxima rodada
```

### 4. UI da Liga Oficial ⏳
```typescript
// Adaptar /match/global para nova estrutura
- Mostrar 3 divisões separadas
- Tabela de classificação por divisão
- Indicadores de promoção/rebaixamento
- Zona verde (promoção)
- Zona vermelha (rebaixamento)
```

### 5. Simulador de Partidas ⏳
```typescript
// Integrar com globalMatchSimulator.ts
- Simular jogos dos playoffs
- Simular jogos da liga oficial
- Gerar eventos realistas
- Atualizar placares em tempo real
```

### 6. Limpeza de Dados Mockados ⏳
```typescript
// Remover dados de teste:
- Limpar olefootLeague (times mockados)
- Limpar globalLeague (rodadas de teste)
- Reset de pontos e estatísticas
- Manter apenas estrutura vazia
```

### 7. Persistência ⏳
```typescript
// Salvar estado no Supabase
- Tabela: global_league_teams
- Tabela: global_league_rounds
- Tabela: global_league_fixtures
- Sincronização automática
```

### 8. Notificações ⏳
```typescript
// Avisar managers sobre:
- Início dos playoffs
- Resultado de cada rodada
- Distribuição em divisões
- Promoção/rebaixamento
```

## Exemplo de Uso

```typescript
// 1. Criar liga
const league = createGlobalLeagueMVP();

// 2. Registrar times (até 32)
let updatedLeague = registerTeam(
  league,
  'manager_123',
  'Flamengo',
  'FLA',
  85
);

// 3. Quando atingir 32 times, playoffs iniciam automaticamente
// league.status === 'playoffs'
// league.playoffRounds.length === 6

// 4. Finalizar rodada de playoff
updatedLeague = finalizePlayoffRound(
  updatedLeague,
  1,
  finishedFixtures
);

// 5. Após 6ª rodada, times são distribuídos em divisões
// league.status === 'active'
// league.teams[0].division === 1 (top 11)

// 6. Finalizar rodada da liga
updatedLeague = finalizeLeagueRound(
  updatedLeague,
  1,
  finishedFixtures
);

// 7. Ao final da temporada, aplicar promoção/rebaixamento
updatedLeague = applyPromotionRelegation(updatedLeague);
```

## Notas Importantes

1. **Sem dados mockados**: Sistema começa vazio, aguardando cadastros reais
2. **Automático**: Playoffs iniciam automaticamente ao atingir 32 times
3. **Justo**: Distribuição baseada em desempenho nos playoffs
4. **Dinâmico**: Promoção/rebaixamento mantém competitividade
5. **Escalável**: Fácil ajustar número de times, divisões, percentuais

## Status de Implementação

- ✅ Estrutura de dados completa
- ✅ Lógica de playoffs
- ✅ Distribuição em divisões
- ✅ Sistema de promoção/rebaixamento
- ✅ Geração de rodadas
- ✅ Atualização de classificação
- ⏳ Integração com reducer
- ⏳ UI de registro
- ⏳ UI de playoffs
- ⏳ UI da liga oficial
- ⏳ Simulador de partidas
- ⏳ Limpeza de dados mockados
- ⏳ Persistência Supabase
- ⏳ Sistema de notificações
