#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PID_DIR="$ROOT_DIR/.phrasex"
cd "$ROOT_DIR"

PHRASEX_PEXELS_API_KEY="3GndEg2kex7dCCIRXEU0HuX08P0wkkitVGLrtqYTxEMvpcnPOwjYNJua"

if [ -z "${PHRASEX_PEXELS_API_KEY:-}" ]; then
  echo "Missing PHRASEX_PEXELS_API_KEY."
  echo "Get a key at https://www.pexels.com/api/ then run:"
  echo "export PHRASEX_PEXELS_API_KEY='your-pexels-key'"
  exit 1
fi

command -v docker-compose >/dev/null 2>&1 || { echo "docker-compose is required. Install Docker Desktop or the Docker Compose plugin."; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Docker Desktop is required."; exit 1; }
command -v dotnet >/dev/null 2>&1 || { echo ".NET 8 SDK is required."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "Node.js and npm are required."; exit 1; }

if ! docker info >/dev/null 2>&1; then
  echo "Docker Desktop is installed but its engine is not running."
  echo "Open Docker Desktop, wait until it reports 'Engine running', then run ./run-local.sh again."
  exit 1
fi

mkdir -p "$PID_DIR"

echo "Starting local PostgreSQL..."
docker-compose up -d db

echo "Waiting for PostgreSQL..."
ready=false
for _ in $(seq 1 20); do
  if docker-compose exec -T db pg_isready -U postgres -d phrasex >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 2
done
[ "$ready" = true ] || { echo "PostgreSQL did not become ready in time."; exit 1; }

if [ ! -d "$ROOT_DIR/web/node_modules" ]; then
  echo "Installing web dependencies..."
  npm --prefix "$ROOT_DIR/web" install
fi

if [ -f "$PID_DIR/api.pid" ] || [ -f "$PID_DIR/web.pid" ]; then
  echo "PhraseX may already be running. Run ./stop-local.sh first."
  exit 1
fi

# echo "Starting API at http://localhost:5000"
# (
#   cd "$ROOT_DIR/api"
#   ASPNETCORE_URLS=http://localhost:5000 Pexels__ApiKey="$PHRASEX_PEXELS_API_KEY" dotnet run
# ) >"$PID_DIR/api.log" 2>&1 &
# echo $! > "$PID_DIR/api.pid"

echo "Starting web app at http://localhost:5173"
(
  cd "$ROOT_DIR/web"
  VITE_API_URL=http://localhost:5000/api npm run dev -- --host localhost
) >"$PID_DIR/web.log" 2>&1 &
echo $! > "$PID_DIR/web.pid"

echo ""
echo "PhraseX is starting: http://localhost:5173"
echo "Local admin: admin@phrasex.local / ChangeMe123!"
echo "Logs: .phrasex/api.log and .phrasex/web.log"
echo "Run ./stop-local.sh when finished."
