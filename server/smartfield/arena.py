"""
arena.py — O FILME COMO ARENA (Partida Viva, Fase 4; docs/raio-x-partida-viva.html).

"Assumir o lance": qualquer manager pega o filme de outro (ou da própria lenda),
escolhe uma posse e joga dali com as SUAS ordens e os MESMOS dados. O motor
simula o resto da partida duas vezes, a partir do mesmo estado:

  - `voce`:   com as ordens de quem assumiu (a partir do minuto delas);
  - `parado`: sem ordem nenhuma de quem assumiu (o banco calado).

As ordens que o dono do filme deu ANTES do minuto continuam valendo nas duas
(o estilo vigente, o grito que ainda soa, a marcação): quem assume herda o
jogo como ele estava. O que o dono fez DEPOIS do minuto é a régua "ele fez",
que o servidor conta pela custódia (server/src/lib/arena.ts) — não aqui.

Como a semente é por minuto (`seed|minuto`), `voce` e `parado` só se separam
pelo que as ordens mudaram; a diferença entre os dois é a prova de que foi
você (a mesma comparação da Prova de Causa, nas 10 posses seguintes).

Nada aqui sorteia: o mesmo pedido dá a mesma arena.
"""
from typing import Any, Dict, List

from comandos_ao_vivo import limpar_comandos
from prova_de_causa import comparar

# Quantas ordens quem assume pode dar (é uma prancheta, não outra partida).
MAX_ORDENS = 6
# Da posse escolhida até o fim: no mínimo 5 minutos de jogo pra valer.
MINUTO_MAX = 85


def _pedido_base(pedido: Dict[str, Any], minuto: int) -> Dict[str, Any]:
    base = {k: v for k, v in pedido.items() if k not in ("arena", "prova_de_causa", "first_half", "decisions")}
    base["mode"] = "from_minute"
    base["from_minute"] = minuto
    base["estado"] = (pedido.get("arena") or {}).get("estado") or {}
    return base


def ordens_de_quem_assume(raw: Any, minuto: int) -> List[Dict[str, Any]]:
    """As ordens válidas de quem assume: do minuto escolhido em diante, no máximo MAX_ORDENS."""
    return [c for c in limpar_comandos(raw) if minuto <= c["minuto"] <= 90][:MAX_ORDENS]


def assumir(pedido: Dict[str, Any]) -> Dict[str, Any]:
    from match_simulator import simulate

    arena = pedido.get("arena") or {}
    try:
        minuto = max(2, min(MINUTO_MAX, int(arena.get("minuto", 0))))
    except (TypeError, ValueError):
        return {"error": "arena: minuto inválido"}
    dele = [c for c in limpar_comandos(pedido.get("comandos")) if c["minuto"] < minuto]
    pedidas = ordens_de_quem_assume(arena.get("comandos"), minuto)
    # A régua dos comandos vale sobre a partida inteira (ex.: recarga de grito de 15'
    # desde o último grito do DONO): o que sobra é o que de fato entra.
    minhas = [c for c in limpar_comandos(dele + pedidas) if c["minuto"] >= minuto]
    base = _pedido_base(pedido, minuto)

    voce = simulate({**base, "comandos": dele + minhas})
    parado = simulate({**base, "comandos": dele})
    casa_ids = [p.get("id") for p in (pedido.get("home_team") or {}).get("lineup", []) if isinstance(p, dict)]
    primeira = minhas[0] if minhas else None
    causa = {"tipo": "comando", **({k: primeira[k] for k in ("jogador", "alvo", "ordem", "estilo") if k in primeira} if primeira else {})}
    if primeira and primeira["tipo"] not in ("ordem", "estilo", "lenda"):
        causa["grito"] = primeira["tipo"]
    prova = comparar(voce, parado, minuto, causa, [i for i in casa_ids if isinstance(i, str)])
    return {
        "minuto": minuto,
        "ordens": minhas,
        "voce": voce,
        # Só o que a conta e a comparação usam: o plano parado não vai pro campo.
        "parado": {"events": parado.get("events", []), "start_minute": parado.get("start_minute"), "mode": parado.get("mode"),
                   "momentum_curve": parado.get("momentum_curve", [])},
        "prova": prova,
    }
