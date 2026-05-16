# ===============================================================
# socket_protocol.py — Custom Application-Level Protocol
#
# Handles two concerns:
#   1. MESSAGE FRAMING   — length-prefixed TCP frames so the
#      receiver always knows where one message ends and the next begins.
#   2. ENCRYPTION        — AES-256-GCM symmetric encryption using a
#      per-session key negotiated during the HELLO handshake.
#
# Frame layout (TCP wire format):
#   ┌──────────────────────┬──────────────────────────────────┐
#   │  4 bytes (big-endian)│  N bytes payload                 │
#   │  unsigned int length │  (encrypted or plaintext)        │
#   └──────────────────────┴──────────────────────────────────┘
#
# Encrypted payload layout:
#   ┌──────────────┬───────────────────────────────────────┐
#   │  12 bytes    │  N bytes  (ciphertext + 16-byte tag)  │
#   │  AES-GCM IV  │  produced by AESGCM.encrypt()         │
#   └──────────────┴───────────────────────────────────────┘
# ===============================================================

import json
import os
import struct

from base64 import b64decode, b64encode
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# Maximum allowed message size — protects against memory exhaustion attacks
_MAX_MESSAGE_BYTES = 1_048_576   # 1 MiB
_LENGTH_PREFIX_FMT = ">I"        # big-endian unsigned 32-bit int
_LENGTH_PREFIX_LEN = 4


class ProtocolError(Exception):
    """Raised when a malformed or oversized frame is received."""


class AuthProtocol:
    """
    Encapsulates framing + AES-256-GCM encryption for one socket session.

    Lifecycle:
        server = AuthProtocol()          # generates a fresh random 256-bit key
        server.send_hello(sock)          # sends HELLO with session key (plaintext)
        # client calls AuthProtocol.from_b64_key(hello["session_key"])
        server.send(sock, {"cmd": ...})  # encrypted from here on
        msg = server.receive(sock)       # decrypt + parse
    """

    # ── Construction ───────────────────────────────────────────

    def __init__(self, key: bytes | None = None):
        """
        :param key: 32-byte AES-256 key.  If None, a fresh random key is generated.
        """
        self._key: bytes = key if key is not None else os.urandom(32)
        self._aes = AESGCM(self._key)

    @classmethod
    def from_b64_key(cls, b64_key: str) -> "AuthProtocol":
        """Create a protocol instance from a base-64 encoded key (received in HELLO)."""
        return cls(b64decode(b64_key))

    @property
    def key_b64(self) -> str:
        """The session key encoded as base-64 — sent in the HELLO frame."""
        return b64encode(self._key).decode()

    # ── High-level send / receive ───────────────────────────────

    def send_hello(self, sock) -> None:
        """
        Send the HELLO handshake frame — plaintext (not encrypted).
        The session key is embedded so the client can set up its cipher.
        Transport is protected by TLS (WSS) in production.
        """
        hello_bytes = json.dumps({
            "cmd":         "HELLO",
            "session_key": self.key_b64,
        }).encode()
        sock.sendall(self._build_frame(hello_bytes))

    def send(self, sock, payload: dict) -> None:
        """Encrypt *payload* and write it as one length-prefixed frame."""
        encrypted = self._encrypt(payload)
        sock.sendall(self._build_frame(encrypted))

    def receive(self, sock) -> dict:
        """Read one frame from *sock*, decrypt it, and return the parsed dict."""
        raw = self._read_frame(sock)
        return self._decrypt(raw)

    # ── Encryption helpers ─────────────────────────────────────

    def _encrypt(self, payload: dict) -> bytes:
        """
        Serialize *payload* to JSON, then AES-256-GCM encrypt it.
        Returns:  IV (12 bytes) || ciphertext || GCM-tag (16 bytes)
        """
        plaintext = json.dumps(payload).encode()
        iv = os.urandom(12)                       # fresh random IV per message
        ciphertext = self._aes.encrypt(iv, plaintext, None)
        return iv + ciphertext

    def _decrypt(self, data: bytes) -> dict:
        """
        Expects:  IV (12 bytes) || ciphertext || GCM-tag (16 bytes)
        Raises cryptography.exceptions.InvalidTag if tampered.
        """
        if len(data) < 12 + 16:
            raise ProtocolError("Encrypted frame too short")
        iv         = data[:12]
        ciphertext = data[12:]
        plaintext  = self._aes.decrypt(iv, ciphertext, None)
        return json.loads(plaintext)

    # ── TCP framing helpers ────────────────────────────────────

    @staticmethod
    def _build_frame(payload: bytes) -> bytes:
        """Prepend a 4-byte big-endian length header to *payload*."""
        return struct.pack(_LENGTH_PREFIX_FMT, len(payload)) + payload

    @staticmethod
    def _read_frame(sock) -> bytes:
        """
        Blocking read of exactly one length-prefixed frame.
        Raises ConnectionResetError if the peer closes the connection.
        Raises ProtocolError if the declared length exceeds the safety limit.
        """
        raw_len = AuthProtocol._recv_exact(sock, _LENGTH_PREFIX_LEN)
        (length,) = struct.unpack(_LENGTH_PREFIX_FMT, raw_len)
        if length > _MAX_MESSAGE_BYTES:
            raise ProtocolError(f"Frame too large: {length} bytes")
        return AuthProtocol._recv_exact(sock, length)

    @staticmethod
    def _recv_exact(sock, n: int) -> bytes:
        """Read exactly *n* bytes from *sock*, blocking until all arrive."""
        buf = b""
        while len(buf) < n:
            chunk = sock.recv(n - len(buf))
            if not chunk:
                raise ConnectionResetError("Connection closed by peer")
            buf += chunk
        return buf
