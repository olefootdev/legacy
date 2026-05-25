"""
Autenticação via JWT do Supabase.

Supabase emite tokens em DOIS regimes:

1. **Legacy (HS256)** — chave simétrica única (`SUPABASE_JWT_SECRET`).
   Usado pelas anon keys `eyJ...` clássicas.

2. **Moderno (ES256/RS256)** — chaves assimétricas servidas via JWKS
   em `{SUPABASE_URL}/auth/v1/.well-known/jwks.json`. Usado pelos novos
   `sb_publishable_*` clients (rotação independente, chave privada nunca
   sai do Supabase). É o sistema padrão hoje.

A gente detecta o algoritmo via header do JWT e valida no caminho certo.
Frontend (ou Hono proxy) envia o token no header Authorization.

Em dev sem JWT secret configurado, aceitamos header X-Manager-Id direto
(dev-only, NUNCA em produção).
"""
import logging
from functools import lru_cache
from typing import Annotated

import jwt
from fastapi import Depends, Header, HTTPException, status
from jwt import PyJWKClient

from .config import get_settings

logger = logging.getLogger(__name__)

# Algoritmos assimétricos suportados pelo Supabase Signing Keys.
ASYMMETRIC_ALGS = ("ES256", "RS256", "ES384", "RS384", "ES512", "RS512")


@lru_cache(maxsize=1)
def _jwks_client() -> PyJWKClient | None:
    """Cliente JWKS único — cacheia chaves públicas e refaz fetch quando o `kid` é novo."""
    s = get_settings()
    if not s.supabase_url:
        return None
    url = f"{s.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
    return PyJWKClient(url, cache_keys=True, lifespan=3600)


def _decode_jwt(token: str) -> dict:
    """
    Decodifica e valida o JWT. Detecta o algoritmo do header e roteia:
      - ES256/RS256/etc → busca chave pública via JWKS
      - HS256          → usa SUPABASE_JWT_SECRET (legacy)
    """
    try:
        header = jwt.get_unverified_header(token)
    except jwt.DecodeError as e:
        logger.info("JWT malformado: %s", e)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    alg = header.get("alg")

    try:
        if alg in ASYMMETRIC_ALGS:
            # Moderno: validação via JWKS público
            client = _jwks_client()
            if client is None:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="JWKS não disponível (SUPABASE_URL ausente)",
                )
            signing_key = client.get_signing_key_from_jwt(token).key
            return jwt.decode(
                token,
                signing_key,
                algorithms=[alg],
                audience="authenticated",
            )

        if alg == "HS256":
            # Legacy: chave simétrica
            s = get_settings()
            if not s.supabase_jwt_secret:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="JWT_SECRET não configurado pra tokens HS256",
                )
            return jwt.decode(
                token,
                s.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )

        logger.info("Algoritmo JWT não suportado: %s", alg)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Algoritmo {alg} não suportado",
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expirado")
    except jwt.InvalidTokenError as e:
        logger.info("JWT (%s) inválido: %s", alg, e)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")


async def require_manager_id(
    authorization: Annotated[str | None, Header()] = None,
    x_manager_id: Annotated[str | None, Header()] = None,
) -> str:
    """
    Resolve o manager_id (user.id do Supabase) a partir do JWT no header
    Authorization. Em dev, aceita X-Manager-Id direto se NEM JWT secret
    nem SUPABASE_URL estiverem configurados (impossível validar de outra forma).
    """
    s = get_settings()

    # Path 1: JWT — sempre tenta se vier no header
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
        if s.supabase_url or s.supabase_jwt_secret:
            payload = _decode_jwt(token)
            sub = payload.get("sub")
            if not sub:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token sem subject",
                )
            return sub

    # Path 2: dev fallback — só se NÃO temos como validar JWT
    if x_manager_id and not s.supabase_url and not s.supabase_jwt_secret:
        logger.warning("DEV MODE: usando X-Manager-Id sem JWT verification")
        return x_manager_id

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Autenticação requerida",
    )


ManagerId = Annotated[str, Depends(require_manager_id)]
