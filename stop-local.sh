#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PID_DIR="$ROOT_DIR/.phrasex"

cd "$ROOT_DIR"

echo "Stopping PhraseX services..."

for service in api web; do
  pid_file="$PID_DIR/$service.pid"

  if [ -f "$pid_file" ]; then
    pid=$(cat "$pid_file")

    if kill -0 "$pid" 2>/dev/null; then
      echo "Stopping PhraseX $service (PID $pid)..."
      kill "$pid" || true

      # Give it a moment to exit gracefully.
      sleep 1

      # Force kill only if it is still alive.
      if kill -0 "$pid" 2>/dev/null; then
        echo "Force stopping PhraseX $service..."
        kill -9 "$pid" || true
      fi
    fi

    rm -f "$pid_file"
  fi
done

echo "Stopping local PostgreSQL..."
docker-compose down

echo "Checking for orphaned PhraseX processes..."

# Only kill processes whose command line belongs to PhraseX.
pkill -f "PhraseX.Api" 2>/dev/null || true
pkill -f "vite.*PhraseX" 2>/dev/null || true

echo "PhraseX local environment stopped."