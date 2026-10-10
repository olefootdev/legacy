"""Gera partidas reais do motor pro teste de estresse do campo (Partida Viva).

    python3 scripts/gerar-planos-estresse.py <saida.json> [n=40]
"""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "server", "smartfield"))
from match_simulator import simulate  # noqa: E402
from test_cadeia_lances import entrada  # noqa: E402

saida = sys.argv[1]
n = int(sys.argv[2]) if len(sys.argv) > 2 else 40
partidas = []
for i in range(n):
    e = entrada(i)
    partidas.append({
        "plan": simulate(e),
        "home": [{"id": p["id"], "pos": p["pos"]} for p in e["home_team"]["lineup"]],
        "away": [{"id": p["id"], "pos": p["pos"]} for p in e["away_team"]["lineup"]],
    })
with open(saida, "w") as f:
    json.dump(partidas, f)
print(f"{n} partidas em {saida}")
