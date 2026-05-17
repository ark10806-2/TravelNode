#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${TRAVEL_NODE_ENV_FILE:-${JAPAN_TRIP_ENV_FILE:-$HOME/.config/travel-node/.env.production}}"
DOCKER_CONFIG_DIR="${DOCKER_CONFIG:-$HOME/.config/travel-node/docker}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing production env file: $ENV_FILE" >&2
  echo "Create it from .env.production.example and keep secrets out of git." >&2
  exit 1
fi

mkdir -p "$DOCKER_CONFIG_DIR"
cat > "$DOCKER_CONFIG_DIR/config.json" <<'JSON'
{
  "auths": {},
  "cliPluginsExtraDirs": [
    "/Applications/Docker.app/Contents/Resources/cli-plugins",
    "/usr/local/lib/docker/cli-plugins",
    "/usr/local/libexec/docker/cli-plugins",
    "/usr/local/cli-plugins",
    "/opt/homebrew/lib/docker/cli-plugins",
    "/opt/homebrew/libexec/docker/cli-plugins"
  ]
}
JSON
export DOCKER_CONFIG="$DOCKER_CONFIG_DIR"

cd "$ROOT_DIR"

docker compose \
  --env-file "$ENV_FILE" \
  -f docker-compose.prod.yml \
  up -d --build --remove-orphans

docker compose \
  --env-file "$ENV_FILE" \
  -f docker-compose.prod.yml \
  ps
