#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${JAPAN_TRIP_ENV_FILE:-$HOME/.config/japan-trip/.env.production}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing production env file: $ENV_FILE" >&2
  echo "Create it from .env.production.example and keep secrets out of git." >&2
  exit 1
fi

cd "$ROOT_DIR"

docker compose \
  --env-file "$ENV_FILE" \
  -f docker-compose.prod.yml \
  up -d --build --remove-orphans

docker compose \
  --env-file "$ENV_FILE" \
  -f docker-compose.prod.yml \
  ps
