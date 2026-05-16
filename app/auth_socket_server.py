# ===============================================================
# auth_socket_server.py — Multi-Threaded Raw TCP Auth Server
#
# Architecture (OOP):
#
#   AuthServer          — binds the TCP socket, runs the accept-loop,
#                         spawns one ClientHandler per connection.
#
#   ClientHandler       — a daemon Thread that owns one client socket.
#                         Performs the HELLO handshake, then enters a
#                         command loop until the client disconnects.
#
#   AuthProtocol        — (in socket_protocol.py) handles framing +
#                         AES-256-GCM encryption for one session.
#
#   UserManager         — (in user_manager.py) handles REGISTER / LOGIN
#                         with PBKDF2 + salt + pepper.
#
# Protocol command flow:
#
#   Client connects
#       Server  →  HELLO  { session_key }          (plaintext)
#       Client  →  REGISTER { name, email, … }     (encrypted)
#       Server  →  RESPONSE { ok, token, … }       (encrypted)
#       — or —
#       Client  →  LOGIN { email, password }        (encrypted)
#       Server  →  RESPONSE { ok, token, … }       (encrypted)
#       Client  →  BYE                              (encrypted, optional)
# ===============================================================

import os
import socket
import threading
import traceback

from app.database import SessionLocal
from app.socket_protocol import AuthProtocol, ProtocolError
from app.user_manager import LoginError, RegistrationError, UserManager

# Server bind address — use 127.0.0.1 so only the local WebSocket proxy
# can reach it; it is never exposed directly to the internet.
AUTH_HOST: str = os.getenv("AUTH_SOCKET_HOST", "127.0.0.1")
AUTH_PORT: int = int(os.getenv("AUTH_SOCKET_PORT", "9000"))


# ── ClientHandler ─────────────────────────────────────────────────────────────

class ClientHandler(threading.Thread):
    """
    One daemon thread per connected client.

    The thread lifecycle:
        __init__   — store socket + address
        run        — handshake → command loop → cleanup
        _handshake — send HELLO with session key
        _loop      — receive commands, dispatch, send responses
    """

    def __init__(self, conn: socket.socket, addr: tuple):
        super().__init__(daemon=True, name=f"auth-client-{addr[0]}:{addr[1]}")
        self._conn     = conn
        self._addr     = addr
        self._protocol = AuthProtocol()   # fresh random AES-256 key per session

    # ── Thread entry point ────────────────────────────────────────

    def run(self) -> None:
        try:
            self._handshake()
            self._loop()
        except (ConnectionResetError, BrokenPipeError, OSError):
            pass   # client disconnected — normal
        except ProtocolError as e:
            pass   # malformed frame — close silently
        except Exception:
            traceback.print_exc()
        finally:
            try:
                self._conn.close()
            except OSError:
                pass

    # ── Handshake ─────────────────────────────────────────────────

    def _handshake(self) -> None:
        """
        Send the HELLO frame (plaintext).
        The client reads the session_key and sets up its AES cipher for all
        subsequent messages in this session.
        """
        self._protocol.send_hello(self._conn)

    # ── Command loop ──────────────────────────────────────────────

    def _loop(self) -> None:
        """
        Process commands until the client sends BYE or disconnects.
        Each iteration: receive one encrypted message, dispatch, reply.
        """
        db = SessionLocal()
        try:
            manager = UserManager(db)
            while True:
                msg = self._protocol.receive(self._conn)
                cmd = msg.get("cmd", "")

                if cmd == "REGISTER":
                    self._handle_register(manager, msg.get("data", {}))
                elif cmd == "LOGIN":
                    self._handle_login(manager, msg.get("data", {}))
                elif cmd == "BYE":
                    break
                else:
                    self._send_error("פקודה לא מוכרת")
        finally:
            db.close()

    # ── Command handlers ──────────────────────────────────────────

    def _handle_register(self, manager: UserManager, data: dict) -> None:
        try:
            result = manager.register(
                name     = str(data.get("name",     "")),
                email    = str(data.get("email",    "")),
                phone    = str(data.get("phone",    "")),
                password = str(data.get("password", "")),
            )
            self._protocol.send(self._conn, {"cmd": "RESPONSE", "ok": True, **result})
        except RegistrationError as e:
            self._send_error(str(e))

    def _handle_login(self, manager: UserManager, data: dict) -> None:
        try:
            result = manager.login(
                email    = str(data.get("email",    "")),
                password = str(data.get("password", "")),
            )
            self._protocol.send(self._conn, {"cmd": "RESPONSE", "ok": True, **result})
        except LoginError as e:
            self._send_error(str(e))

    def _send_error(self, message: str) -> None:
        self._protocol.send(self._conn, {"cmd": "RESPONSE", "ok": False, "error": message})


# ── AuthServer ────────────────────────────────────────────────────────────────

class AuthServer:
    """
    Multi-client TCP authentication server.

    Binds a server socket, then enters an accept-loop in a background daemon
    thread.  For every incoming connection it spawns a new ClientHandler thread.

    Usage:
        server = AuthServer()
        server.start()          # non-blocking — returns immediately
        ...
        server.stop()           # graceful shutdown
    """

    def __init__(self, host: str = AUTH_HOST, port: int = AUTH_PORT):
        self._host        = host
        self._port        = port
        self._server_sock: socket.socket | None = None
        self._running     = False
        self._accept_thread: threading.Thread | None = None

    def start(self) -> None:
        """Bind, listen, and begin accepting clients in a daemon thread."""
        self._server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        # SO_REUSEADDR allows immediate restart after a crash
        self._server_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self._server_sock.bind((self._host, self._port))
        self._server_sock.listen(64)   # backlog of 64 pending connections
        self._running = True

        self._accept_thread = threading.Thread(
            target=self._accept_loop,
            daemon=True,
            name="auth-accept-loop",
        )
        self._accept_thread.start()
        print(f"[AuthServer] Listening on {self._host}:{self._port}")

    def stop(self) -> None:
        """Signal the accept-loop to exit and close the server socket."""
        self._running = False
        if self._server_sock:
            try:
                self._server_sock.close()
            except OSError:
                pass

    # ── Internal ──────────────────────────────────────────────────

    def _accept_loop(self) -> None:
        """
        Blocking loop: accept a connection, hand it off to a ClientHandler,
        repeat.  Exits cleanly when _running becomes False or the socket closes.
        """
        while self._running:
            try:
                conn, addr = self._server_sock.accept()
                handler = ClientHandler(conn, addr)
                handler.start()
            except OSError:
                break   # server socket closed — normal shutdown
