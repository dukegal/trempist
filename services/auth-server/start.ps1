# Local / Windows — run TCP auth server from repo root
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..\..")
if (-not $env:AUTH_SOCKET_HOST) { $env:AUTH_SOCKET_HOST = "127.0.0.1" }
if (-not $env:AUTH_SOCKET_PORT) { $env:AUTH_SOCKET_PORT = "9000" }
Write-Host "Auth server ${env:AUTH_SOCKET_HOST}:${env:AUTH_SOCKET_PORT}" -ForegroundColor Cyan
py -m app.auth_socket_server
