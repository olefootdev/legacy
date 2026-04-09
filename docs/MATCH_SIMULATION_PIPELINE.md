# Pipeline: motor → eventos → YUKA → render

```
┌─────────────────────────────────────────────────────────────┐
│  Motor (ticks + `LiveMatchSnapshot.events`)                 │
│  • FSM bola parada / live                                   │
│  • `MatchTruthWorld` (bola + integração)                    │
└──────────────────────────┬──────────────────────────────────┘
                           │ syncLive / step
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  `MatchSimulationEventBus`                                  │
│  • `PhaseChanged`, `Goal`, `Whistle`, …                     │
│  • Narrativa: só `narrativeLineForSimulationEvent(e)`       │
└───────────────┬─────────────────────────┬───────────────────┘
                │                         │
                ▼                         ▼
┌───────────────────────┐   ┌───────────────────────────────┐
│  Narrativa / UI       │   │  `TacticalSimLoop`            │
│  (subscreve bus)      │   │  • fixed Δt = 1/60 s          │
│                       │   │  • YUKA: Arrive + Separation  │
│                       │   │    + Pursuit(bola) + Wander   │
│                       │   │    + ObstacleAvoidance        │
│                       │   │  • Interpolação renderBlend   │
└───────────────────────┘   └───────────────┬─────────────────┘
                                            │
                                            ▼
                              ┌─────────────────────────────┐
                              │  `MatchTruthSnapshot`       │
                              │  → Babylon (só desenha)      │
                              │  → web/match-pitch WebView   │
                              └─────────────────────────────┘
```

## Como rodar o demo de eventos

Na raiz do repo:

```bash
npm run demo:sim-pipeline
```

Imprime a narrativa derivada de 10 eventos scriptados (kickoff → passe → remate → escanteio).

## Princípios

- **Verdade**: fila de eventos do motor + simulação com timestep fixo.
- **Viewer**: não move a bola com `sin/cos`; só aplica snapshots recebidos.
- **YUKA**: alvos táticos vêm da formação/zonas; Pursuit segue a bola como `Vehicle` espelhada do `world`.
