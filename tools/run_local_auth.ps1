# Start TCP auth server locally (port 9000) using .env from repo root.
# Requires DATABASE_URL + SECRET_KEY (match API service).
$ErrorActionPreference = "Stop"
& (Join-Path $PSScriptRoot "..\services\auth-server\start.ps1")
