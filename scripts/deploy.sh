#!/usr/bin/env bash
# TGFlow local Compose helper. Does not discover or change other Compose projects.
set -euo pipefail
cd "$(dirname "$0")/.."
case "${1:-status}" in
  start) docker compose config --quiet; docker compose up -d ;;
  stop) docker compose stop ;;
  update) docker compose pull; docker compose up -d ;;
  restart) docker compose restart ;;
  status) docker compose ps ;;
  logs) docker compose logs -f tgflow ;;
  config) docker compose config --quiet ;;
  *) echo 'Usage: scripts/deploy.sh {start|stop|update|restart|status|logs|config}' >&2; exit 2 ;;
esac
