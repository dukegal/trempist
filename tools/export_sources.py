"""Concatenate Trempist source files into one TXT for easy copy/paste."""
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
FILES = [
    "requirements.txt",
    "runtime.txt",
    "render.yaml",
    "app/__init__.py",
    "app/auth.py",
    "app/database.py",
    "app/models.py",
    "app/schemas.py",
    "app/main.py",
    "app/socket_protocol.py",
    "app/auth_socket_server.py",
    "app/user_manager.py",
    "frontend/package.json",
    "frontend/vite.config.js",
    "frontend/index.html",
    "frontend/eslint.config.js",
    "frontend/src/main.jsx",
    "frontend/src/App.jsx",
    "frontend/src/App.css",
    "frontend/src/index.css",
]
OUT = BASE / "TREMPIST_CODE_EXPORT.txt"


def main() -> None:
    parts: list[str] = ["# TREMPIST — bundled source for copy/paste\n"]
    for rel in FILES:
        path = BASE / rel
        if not path.exists():
            parts.append(f"\n\n{'=' * 80}\nMISSING: {rel}\n{'=' * 80}\n")
            continue
        parts.append(f"\n\n{'=' * 80}\nFILE: {rel}\n{'=' * 80}\n\n")
        parts.append(path.read_text(encoding="utf-8", errors="replace"))
    OUT.write_text("".join(parts), encoding="utf-8")
    print(f"Wrote {OUT} ({OUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
