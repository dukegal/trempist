#!/bin/sh
# Render private service entrypoint — repo root is the build context.
set -e
cd "$(dirname "$0")/../.."
export AUTH_SOCKET_HOST="${AUTH_SOCKET_HOST:-0.0.0.0}"
export AUTH_SOCKET_PORT="${AUTH_SOCKET_PORT:-${PORT:-9000}}"
exec python -m app.auth_socket_server
