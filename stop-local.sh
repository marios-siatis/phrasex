#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PID_DIR="$ROOT_DIR/.phrasex"
cd "$ROOT_DIR"

for service in api web; do
  pid_file="$PID_DIR/$service.pid"
  if [ -f "$pid_file" ]; then
    pid=$(cat "$pid_file")
    if kill -0 "$pid" 2>/dev/null; then
      echo "Stopping PhraseX $service..."
      kill "$pid" || true
    fi
    rm -f "$pid_file"
  fi
done

echo "Stopping local PostgreSQL..."
docker-compose down
