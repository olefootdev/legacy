"""
comandos_ao_vivo.py — PARTIDA VIVA / LEGACY, Fase 4b (docs/PARTIDA-VIVA-PLANO.md §5).

Os comandos do manager que mudam o RESULTADO, dados no campo do Legacy:

- GRITOS (10 minutos): viram um ajuste TEMPORÁRIO no DNA da casa — a mesma
  alavanca já calibrada da Fundação (posse, pressão, verticalidade,
  criatividade, solidez, disciplina, intensidade). Nada de mecânica nova: o
  grito só empurra eixos que o motor já sabe usar, com custo embutido
  (intensidade cansa; cobrar derruba a disciplina → mais falta e cartão).
- ORDENS INDIVIDUAIS (até nova ordem): ±4 no máximo em atributos do jogador,
  sempre a partir da base dele (trocar de ordem não acumula).

Tudo é validado aqui: comando adulterado vira nada, nunca multiplicador.
"""

from typing import Any, Dict, List, Optional

DURACAO_GRITO = 10
# Recarga: o celular só deixa gritar de novo depois de 15' (calibrado no
# estudo_comandos.py — sem recarga, gritar o jogo todo virava atalho).
RECARGA_GRITO = 15
TETO_DELTA_DNA = 0.15

GRITOS: Dict[str, Dict[str, float]] = {
    # Moral lá em cima: mais ímpeto e jogo pra frente — cansa mais.
    "incentivar": {"intensidade": 0.10, "vertical": 0.06},
    # Cobrança: aperta a saída deles — e o time fica nervoso (mais falta).
    "cobrar": {"pressao": 0.12, "intensidade": 0.08, "disciplina": -0.15},
    # Calma: segura a bola, erra menos, faz menos falta — e acelera menos.
    "acalmar": {"disciplina": 0.12, "posse": 0.08, "intensidade": -0.08},
}

# UMA VERDADE SÓ (Fase 0): o ESTILO do dock da Partida Rápida deixa de virar
# gol por sorteio no aparelho e vira um empurrão PERSISTENTE nos eixos do DNA
# (vale até o próximo estilo). Cada estilo tem custo: fechar segura e cria
# menos; abrir cria e expõe. Teto por eixo: o mesmo ±0,15 dos gritos.
ESTILOS: Dict[str, Dict[str, float]] = {
    "defend": {"solidez": 0.12, "posse": -0.06, "vertical": -0.06, "intensidade": -0.04},
    "counter": {"solidez": 0.08, "vertical": 0.10, "posse": -0.10},
    "possession": {"posse": 0.12, "criatividade": 0.04, "vertical": -0.06},
    "press": {"pressao": 0.12, "intensidade": 0.06},
    "attack": {"vertical": 0.12, "intensidade": 0.06, "solidez": -0.10},
}

# A LENDA ativada (buff do LEGACY): por 15 minutos o time joga com mais ímpeto
# e criação. Uma ativação por lenda, no máximo 3 por partida, e só jogador
# com id de lenda (`legacy-…`). Antes isto virava gol por sorteio no aparelho.
LENDA: Dict[str, float] = {"intensidade": 0.08, "criatividade": 0.06, "vertical": 0.04}
DURACAO_LENDA = 15
MAX_LENDAS = 3

ORDENS: Dict[str, Dict[str, int]] = {
    # Segura a posição: lê melhor o jogo, marca mais, aparece menos na frente.
    "segurar": {"tatico": 4, "marcacao": 3, "finalizacao": -4},
    # Ataca o espaço: mais arranque e finalização — abre a defesa.
    "atacar_espaco": {"velocidade": 3, "finalizacao": 4, "marcacao": -4, "tatico": -3},
    # Marca de perto: mais desarme e corpo — constrói menos.
    "marcar": {"marcacao": 4, "fisico": 2, "passe": -3},
}

ATRIBUTOS_ORDEM = ("tatico", "marcacao", "finalizacao", "velocidade", "fisico", "passe")


def limpar_comandos(raw: Any) -> List[Dict[str, Any]]:
    """Só passa comando conhecido, com minuto válido. No máximo 40, em ordem."""
    if not isinstance(raw, list):
        return []
    out: List[Dict[str, Any]] = []
    for c in raw[:40]:
        if not isinstance(c, dict):
            continue
        try:
            minuto = int(c.get("minuto", -1))
        except (TypeError, ValueError):
            continue
        if not 1 <= minuto <= 90:
            continue
        tipo = c.get("tipo")
        if tipo in GRITOS:
            # Recarga também no servidor: grito antes de 15' do anterior não vale.
            ultimo = next((g for g in reversed(out) if g["tipo"] in GRITOS), None)
            if ultimo and minuto - ultimo["minuto"] < RECARGA_GRITO:
                continue
            out.append({"minuto": minuto, "tipo": tipo})
        elif tipo == "ordem" and c.get("ordem") in ORDENS and isinstance(c.get("jogador"), str):
            ordem = {"minuto": minuto, "tipo": "ordem", "ordem": c["ordem"], "jogador": c["jogador"][:80]}
            # FASE 3: "marcar" tem ALVO — o rival que o jogador passa a marcar (ocupante prioritário das células dele).
            if c["ordem"] == "marcar" and isinstance(c.get("alvo"), str) and c["alvo"]:
                ordem["alvo"] = c["alvo"][:80]
            out.append(ordem)
        elif tipo == "estilo" and c.get("estilo") in ESTILOS:
            out.append({"minuto": minuto, "tipo": "estilo", "estilo": c["estilo"]})
        elif tipo == "lenda" and isinstance(c.get("jogador"), str) and c["jogador"].startswith("legacy-"):
            lendas = [l for l in out if l["tipo"] == "lenda"]
            if len(lendas) >= MAX_LENDAS or any(l["jogador"] == c["jogador"][:80] for l in lendas):
                continue
            out.append({"minuto": minuto, "tipo": "lenda", "jogador": c["jogador"][:80]})
    out.sort(key=lambda c: c["minuto"])
    return out


def marcacoes(cmds: List[Dict[str, Any]], minuto: int) -> Dict[str, str]:
    """Marcação individual vigente: jogador da casa → rival que ele marca (a última ordem de cada um vale)."""
    vigente: Dict[str, Optional[str]] = {}
    for c in cmds:
        if c["tipo"] == "ordem" and c["minuto"] <= minuto:
            vigente[c["jogador"]] = c.get("alvo") if c["ordem"] == "marcar" else None
    return {j: a for j, a in vigente.items() if a}


def impressao(cmds: List[Dict[str, Any]]) -> str:
    return ";".join(
        f"{c['minuto']}:{c['tipo']}" + (f":{c['jogador']}:{c['ordem']}:{c.get('alvo', '')}" if c["tipo"] == "ordem" else "")
        for c in cmds
    )


def dna_no_minuto(base: Optional[Dict[str, float]], cmds: List[Dict[str, Any]], minuto: int) -> Optional[Dict[str, float]]:
    """DNA da casa neste minuto: a base + gritos ativos + o estilo vigente + lendas ativas (cada eixo com teto)."""
    ativos = [c for c in cmds if c["tipo"] in GRITOS and c["minuto"] <= minuto < c["minuto"] + DURACAO_GRITO]
    estilo = next((c for c in reversed(cmds) if c["tipo"] == "estilo" and c["minuto"] <= minuto), None)
    lendas = [c for c in cmds if c["tipo"] == "lenda" and c["minuto"] <= minuto < c["minuto"] + DURACAO_LENDA]
    if not ativos and not estilo and not lendas:
        return base
    delta: Dict[str, float] = {}
    for c in ativos:
        for eixo, v in GRITOS[c["tipo"]].items():
            delta[eixo] = delta.get(eixo, 0.0) + v
    if estilo:
        for eixo, v in ESTILOS[estilo["estilo"]].items():
            delta[eixo] = delta.get(eixo, 0.0) + v
    for _ in lendas:
        for eixo, v in LENDA.items():
            delta[eixo] = delta.get(eixo, 0.0) + v
    neutro = base or {k: 0.5 for k in ("posse", "pressao", "vertical", "criatividade", "solidez", "disciplina", "intensidade")}
    return {
        k: max(0.12, min(0.88, v + max(-TETO_DELTA_DNA, min(TETO_DELTA_DNA, delta.get(k, 0.0)))))
        for k, v in neutro.items()
    }


def aplicar_ordens(lineup: List[Dict[str, Any]], cmds: List[Dict[str, Any]], minuto: int) -> int:
    """Aplica a ordem vigente de cada jogador (a última com minuto <= agora). Devolve quantas valem."""
    vigente: Dict[str, str] = {}
    for c in cmds:
        if c["tipo"] == "ordem" and c["minuto"] <= minuto:
            vigente[c["jogador"]] = c["ordem"]
    n = 0
    for p in lineup:
        if "_base_ordem" not in p:
            p["_base_ordem"] = {k: p[k] for k in ATRIBUTOS_ORDEM}
        base = p["_base_ordem"]
        ordem = vigente.get(p["id"])
        efeito = ORDENS.get(ordem, {}) if ordem else {}
        for k in ATRIBUTOS_ORDEM:
            p[k] = max(1, min(99, base[k] + efeito.get(k, 0)))
        n += 1 if ordem else 0
    return n
