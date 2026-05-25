# ===============================================================
# auth_socket_client.py — Raw TCP Auth Client (no HTTP, no WebSocket)
#
# Talks to AuthServer (app/auth_socket_server.py) using the same
# AuthProtocol (length-prefixed frames + AES-256-GCM session encryption).
#
# Protocol flow:
#   1) TCP connect to (host, port)
#   2) Server  → HELLO  { session_key }          (plaintext)
#   3) Client builds AuthProtocol.from_b64_key(session_key)
#   4) Client → REGISTER/LOGIN { ... }           (encrypted)
#   5) Server → RESPONSE { ok, token, ... }       (encrypted)
#   6) Client → BYE                               (encrypted, optional)
#
# Usage as a library:
#   with AuthSocketClient() as client:
#       result = client.register(name, email, phone, password)
#       # result = {"ok": True, "token": "...", "user_id": 1, "name": "..."}
#
# Usage as a CLI:
#   python -m app.auth_socket_client register
#   python -m app.auth_socket_client login
# ===============================================================

import argparse
import getpass
import json
import os
import socket
import sys

from app.socket_protocol import AuthProtocol, ProtocolError

DEFAULT_HOST: str = os.getenv("AUTH_SOCKET_HOST", "127.0.0.1")
DEFAULT_PORT: int = int(os.getenv("AUTH_SOCKET_PORT", "9000"))
DEFAULT_TIMEOUT: float = float(os.getenv("AUTH_SOCKET_TIMEOUT", "10"))


class AuthClientError(Exception):
    """Raised on protocol or server-side auth failures."""


class AuthSocketClient:
    """
    Synchronous TCP client for the TREMPIST auth server.

    Lifecycle:
        client = AuthSocketClient()
        client.connect()                       # TCP + HELLO handshake
        result = client.register(...)          # encrypted REGISTER
        client.bye()                           # optional graceful close
        client.close()                         # always close socket

    Or as a context manager (recommended):
        with AuthSocketClient() as client:
            result = client.login(email, password)
    """

    def __init__(
        self,
        host: str = DEFAULT_HOST,
        port: int = DEFAULT_PORT,
        timeout: float = DEFAULT_TIMEOUT,
    ):
        self._host = host
        self._port = port
        self._timeout = timeout
        self._sock: socket.socket | None = None
        self._protocol: AuthProtocol | None = None

    # ── Context manager ──────────────────────────────────────────

    def __enter__(self) -> "AuthSocketClient":
        self.connect()
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        try:
            if exc_type is None and self._sock is not None:
                try:
                    self.bye()
                except OSError:
                    pass
        finally:
            self.close()

    # ── Connection / handshake ───────────────────────────────────

    def connect(self) -> None:
        """Open TCP socket and complete the HELLO handshake."""
        if self._sock is not None:
            return
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(self._timeout)
        sock.connect((self._host, self._port))
        try:
            hello_bytes = AuthProtocol._read_frame(sock)
            hello = json.loads(hello_bytes)
            if hello.get("cmd") != "HELLO" or "session_key" not in hello:
                raise AuthClientError("Invalid HELLO from server")
            self._protocol = AuthProtocol.from_b64_key(hello["session_key"])
            self._sock = sock
        except (ProtocolError, ConnectionResetError, json.JSONDecodeError) as exc:
            sock.close()
            raise AuthClientError(f"Handshake failed: {exc}") from exc

    def close(self) -> None:
        """Close the underlying TCP socket. Safe to call multiple times."""
        if self._sock is not None:
            try:
                self._sock.close()
            except OSError:
                pass
        self._sock = None
        self._protocol = None

    # ── Commands ────────────────────────────────────────────────

    def register(self, name: str, email: str, phone: str, password: str) -> dict:
        """Send REGISTER and return the parsed RESPONSE dict."""
        return self._command("REGISTER", {
            "name": name,
            "email": email,
            "phone": phone,
            "password": password,
        })

    def login(self, email: str, password: str) -> dict:
        """Send LOGIN and return the parsed RESPONSE dict."""
        return self._command("LOGIN", {
            "email": email,
            "password": password,
        })

    def bye(self) -> None:
        """Send BYE so the server can close its side cleanly. Best-effort."""
        if self._sock is None or self._protocol is None:
            return
        try:
            self._protocol.send(self._sock, {"cmd": "BYE"})
        except OSError:
            pass

    # ── Internal ─────────────────────────────────────────────────

    def _command(self, cmd: str, data: dict) -> dict:
        if self._sock is None or self._protocol is None:
            raise AuthClientError("Not connected. Call connect() first.")
        try:
            self._protocol.send(self._sock, {"cmd": cmd, "data": data})
            response = self._protocol.receive(self._sock)
        except (ConnectionResetError, BrokenPipeError, ProtocolError) as exc:
            raise AuthClientError(f"Connection error: {exc}") from exc

        if response.get("cmd") != "RESPONSE":
            raise AuthClientError(f"Unexpected response: {response}")
        if not response.get("ok"):
            raise AuthClientError(response.get("error") or "Authentication failed")
        return response


# ── CLI ───────────────────────────────────────────────────────────────────────

def _prompt_register(args: argparse.Namespace) -> dict:
    name     = args.name     or input("שם: ").strip()
    email    = args.email    or input("אימייל: ").strip()
    phone    = args.phone    or input("טלפון: ").strip()
    password = args.password or getpass.getpass("סיסמה: ")
    return {"name": name, "email": email, "phone": phone, "password": password}


def _prompt_login(args: argparse.Namespace) -> dict:
    email    = args.email    or input("אימייל: ").strip()
    password = args.password or getpass.getpass("סיסמה: ")
    return {"email": email, "password": password}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="auth_socket_client",
        description="TREMPIST raw-TCP auth client (register/login over AES-GCM socket).",
    )
    parser.add_argument("--host", default=DEFAULT_HOST, help="server host (default: %(default)s)")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="server port (default: %(default)s)")

    sub = parser.add_subparsers(dest="cmd", required=True)

    p_reg = sub.add_parser("register", help="הרשמת משתמש חדש")
    p_reg.add_argument("--name")
    p_reg.add_argument("--email")
    p_reg.add_argument("--phone")
    p_reg.add_argument("--password")

    p_login = sub.add_parser("login", help="כניסת משתמש קיים")
    p_login.add_argument("--email")
    p_login.add_argument("--password")

    args = parser.parse_args(argv)

    try:
        with AuthSocketClient(host=args.host, port=args.port) as client:
            if args.cmd == "register":
                payload = _prompt_register(args)
                result = client.register(**payload)
            else:
                payload = _prompt_login(args)
                result = client.login(**payload)
    except AuthClientError as e:
        print(f"שגיאה: {e}", file=sys.stderr)
        return 1
    except (ConnectionRefusedError, socket.timeout, OSError) as e:
        print(f"לא ניתן להתחבר ל-{args.host}:{args.port} — {e}", file=sys.stderr)
        return 2

    print(json.dumps(
        {"ok": True, "token": result.get("token"), "user_id": result.get("user_id"), "name": result.get("name")},
        ensure_ascii=False,
        indent=2,
    ))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
