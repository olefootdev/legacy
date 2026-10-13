"""
plano_salvo.py — O ADVERSÁRIO AUSENTE JOGA PELO PLANO SALVO (Partida Viva, Fase 4).

Quando o time de fora é de outro manager real, ele não está ali pra comandar.
Antes, o time dele jogava "no automático" (só o DNA). Agora ele joga pelo
PLANO SALVO: as decisões que esse manager tomou de verdade na última partida
LEGACY dele, presas à SITUAÇÃO em que ele as tomou ("perdendo, depois dos 60',
foi pro ataque e cobrou o time"). O servidor monta as regras a partir da
custódia (server/src/lib/planoSalvo.ts); aqui o motor as cumpre.

Regra: { depois: minuto, quando: ganhando|empatando|perdendo|qualquer,
         estilo?: defend|counter|possession|press|attack, grito?: incentivar|cobrar|acalmar }

Cada regra dispara UMA vez, no primeiro minuto (>= `depois`) em que a situação
do placar — do ponto de vista DELE — bate. Vira comando do time de fora, com a
mesma régua dos comandos da casa (comandos_ao_vivo.py: teto no DNA, duração e
recarga do grito). Determinístico: depende só do minuto e do placar do motor.
"""
from typing import Any, Dict, List, Optional

from comandos_ao_vivo import ESTILOS, GRITOS, RECARGA_GRITO

SITUACOES = ("ganhando", "empatando", "perdendo", "qualquer")
MAX_REGRAS = 4


def limpar_plano(raw: Any) -> List[Dict[str, Any]]:
    """Só passa regra conhecida. No máximo MAX_REGRAS, na ordem do minuto."""
    if not isinstance(raw, list):
        return []
    out: List[Dict[str, Any]] = []
    for r in raw[:12]:
        if not isinstance(r, dict):
            continue
        try:
            depois = int(r.get("depois", -1))
        except (TypeError, ValueError):
            continue
        quando = r.get("quando")
        if not 1 <= depois <= 90 or quando not in SITUACOES:
            continue
        regra: Dict[str, Any] = {"depois": depois, "quando": quando}
        if r.get("estilo") in ESTILOS:
            regra["estilo"] = r["estilo"]
        if r.get("grito") in GRITOS:
            regra["grito"] = r["grito"]
        if "estilo" in regra or "grito" in regra:
            out.append(regra)
    out.sort(key=lambda x: x["depois"])
    return out[:MAX_REGRAS]


def situacao(gols_dele: int, gols_do_outro: int) -> str:
    return "ganhando" if gols_dele > gols_do_outro else "perdendo" if gols_dele < gols_do_outro else "empatando"


class PlanoDoAusente:
    """As regras do plano salvo + os comandos que já dispararam (pra dna_no_minuto)."""

    def __init__(self, regras: List[Dict[str, Any]]):
        self.regras = regras
        self.disparou = [False] * len(regras)
        self.comandos: List[Dict[str, Any]] = []

    def no_minuto(self, minuto: int, gols_dele: int, gols_do_outro: int) -> List[Dict[str, Any]]:
        """Dispara as regras que valem neste minuto. Devolve as que dispararam agora."""
        agora: List[Dict[str, Any]] = []
        sit = situacao(gols_dele, gols_do_outro)
        for i, r in enumerate(self.regras):
            if self.disparou[i] or minuto < r["depois"] or (r["quando"] != "qualquer" and r["quando"] != sit):
                continue
            self.disparou[i] = True
            if "estilo" in r:
                self.comandos.append({"minuto": minuto, "tipo": "estilo", "estilo": r["estilo"]})
            if "grito" in r:
                ultimo: Optional[Dict[str, Any]] = next((c for c in reversed(self.comandos) if c["tipo"] in GRITOS), None)
                if not ultimo or minuto - ultimo["minuto"] >= RECARGA_GRITO:
                    self.comandos.append({"minuto": minuto, "tipo": r["grito"]})
            agora.append(r)
        return agora
