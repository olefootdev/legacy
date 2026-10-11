#!/usr/bin/env python3
"""
Motor RESIDENTE pra testes e estudos (UMA VERDADE SÓ, Fase 0).

Lê uma linha JSON por pedido no stdin e escreve uma linha JSON com o plano no
stdout — sem subir um processo Python por partida. Usado por
scripts/test-uma-verdade.ts e scripts/estudo-fase0-equilibrio.ts.

    python3 scripts/fase0/motor-residente.py [caminho/do/simulador.py]

Sem argumento, usa server/smartfield/match_simulator.py (o motor atual). Com
argumento, carrega outro simulador (ex.: o de um commit antigo, pro "antes").
Pedidos especiais: {"entrada": i} devolve a entrada sintética i
(test_cadeia_lances.entrada), pra o TS não precisar reproduzi-la.
"""
import importlib.util
import json
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
SMARTFIELD = os.path.join(AQUI, "..", "..", "server", "smartfield")
sys.path.insert(0, SMARTFIELD)
from test_cadeia_lances import entrada  # noqa: E402

caminho = sys.argv[1] if len(sys.argv) > 1 else os.path.join(SMARTFIELD, "match_simulator.py")
if os.path.abspath(caminho) == os.path.abspath(os.path.join(SMARTFIELD, "match_simulator.py")):
    from match_simulator import simulate
else:
    # Simulador de outro lugar (ex.: extraído do git): os módulos irmãos dele primeiro.
    sys.path.insert(0, os.path.dirname(os.path.abspath(caminho)))
    for mod in [m for m in list(sys.modules) if m in ("match_simulator", "xg_model", "narrative_weighter", "matchup_matrix", "cadeia_lances", "idioma", "comandos_ao_vivo", "analyst_beats", "decisivo")]:
        del sys.modules[mod]
    spec = importlib.util.spec_from_file_location("simulador_externo", caminho)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore
    simulate = mod.simulate

for linha in sys.stdin:
    linha = linha.strip()
    if not linha:
        continue
    try:
        pedido = json.loads(linha)
        if isinstance(pedido, dict) and "entrada" in pedido and len(pedido) == 1:
            saida = entrada(int(pedido["entrada"]))
        else:
            saida = simulate(pedido)
        sys.stdout.write(json.dumps(saida, ensure_ascii=False) + "\n")
    except Exception as e:  # noqa: BLE001
        sys.stdout.write(json.dumps({"error": str(e)}) + "\n")
    sys.stdout.flush()
