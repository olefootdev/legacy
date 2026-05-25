"""
Autenticação via JWT do Supabase.

Frontend (ou Hono proxy) envia o token JWT no header Authorization.
Verificamos a assinatura usando SUPABASE_JWT_SECRET e extraímos o `sub`
(user_id) — esse é o manager_id usado pra filtrar queries.

Em dev sem JWT secret configurado, aceitamos header X-Manager-Id direto
(dev-only, NUNCA em produção).
"""
import logging
from typing import Annotated

import jwt
from fastapi import Depends, Header, HTTPException, status

from .config import get_settings

logger = logging.getLogger(__name__)


def _decode_jwt(token: str) -> dict:
    s = get_settings()
    if not s.supabase_jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="JWT secret não configurado",
        )
    try:
        payload = jwt.decode(
            token,
            s.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expirado")
    except jwt.InvalidTokenError as e:
        logger.info("JWT inválido: %s", e)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")


async def require_manager_id(
    authorization: Annotated[str | None, Header()] = None,
    x_manager_id: Annotated[str | None, Header()] = None,
) -> str:
    """
    Resolve o manager_id (user.id do Supabase) a partir do JWT no header
    Authorization. Em dev, aceita X-Manager-Id direto se JWT secret não
    estiver configurado.
    """
    s = get_settings()

    # Path 1: JWT
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
        if s.supabase_jwt_secret:
            payload = _decode_jwt(token)
            sub = payload.get("sub")
            if not sub:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token sem subject",
                )
            return sub

    # Path 2: dev fallback (X-Manager-Id direto)
    if x_manager_id and not s.supabase_jwt_secret:
        logger.warning("DEV MODE: usando X-Manager-Id sem JWT verification")
        return x_manager_id

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Autenticação requerida",
    )


ManagerId = Annotated[str, Depends(require_manager_id)]
