# ===============================================================
# auth_bridge.py — FastAPI → TCP auth server bridge
#
# Browser talks HTTPS to FastAPI; FastAPI forwards register/login
# over raw TCP to the private auth service (UserManager + JWT there).
# No user-management logic in this module — transport only.
# ===============================================================

import os

from app.auth_socket_client import AuthClientError, AuthSocketClient


class AuthBridgeError(Exception):
    """Auth server rejected the request (validation, wrong password, etc.)."""


class AuthBridgeUnavailable(Exception):
    """Cannot reach the TCP auth server."""


def _client() -> AuthSocketClient:
    host = os.getenv("AUTH_SOCKET_HOST", "127.0.0.1")
    port = int(os.getenv("AUTH_SOCKET_PORT", "9000"))
    timeout = float(os.getenv("AUTH_SOCKET_TIMEOUT", "10"))
    return AuthSocketClient(host=host, port=port, timeout=timeout)


def register_user(name: str, email: str, phone: str, password: str) -> dict:
    try:
        with _client() as client:
            return client.register(name, email, phone, password)
    except AuthClientError as exc:
        raise AuthBridgeError(str(exc)) from exc
    except OSError as exc:
        raise AuthBridgeUnavailable(str(exc)) from exc


def login_user(email: str, password: str) -> dict:
    try:
        with _client() as client:
            return client.login(email, password)
    except AuthClientError as exc:
        raise AuthBridgeError(str(exc)) from exc
    except OSError as exc:
        raise AuthBridgeUnavailable(str(exc)) from exc
