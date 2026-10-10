"""
idioma.py — o idioma da narração do motor (PT/EN).

`simulate()` define `atual` no começo de cada partida a partir de
`input["lang"]` (a rota manda o idioma do jogador, header X-Olefoot-Idioma).
Português é o padrão e sai idêntico ao de sempre — o inglês é um caminho
paralelo, com as MESMAS escolhas determinísticas (mesmo índice, mesma seed).
"""

atual = "pt"


def definir(lang) -> None:
    global atual
    atual = "en" if lang == "en" else "pt"


def en() -> bool:
    return atual == "en"
