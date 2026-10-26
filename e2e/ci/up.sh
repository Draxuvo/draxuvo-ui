#!/usr/bin/env bash
# Levanta el stack de las pruebas e2e: base con los datos de demo, API en :3000 y UI construida en :4200.
# Lo usan los CI de draxuvo-ui y draxuvo-api. Requiere Postgres, Ruby y Node ya instalados, y las
# dependencias de ambos repos ya instaladas (bundle install, npm ci).
#
#   API_DIR=../api UI_DIR=. DATABASE_URL=postgres://postgres:postgres@localhost:5432 e2e/ci/up.sh
#
# Deja los registros en $E2E_LOG_DIR (por defecto /tmp/e2e-logs) y termina cuando ambos responden.
set -euo pipefail

API_DIR="${API_DIR:?Falta API_DIR (carpeta de draxuvo-api)}"
UI_DIR="${UI_DIR:?Falta UI_DIR (carpeta de draxuvo-ui)}"
LOG_DIR="${E2E_LOG_DIR:-/tmp/e2e-logs}"
API_URL="${E2E_API_URL:-http://localhost:3000}"
UI_URL="${E2E_UI_URL:-http://localhost:4200}"
mkdir -p "$LOG_DIR"

# Valores de prueba: no son secretos. Solo se usan contra este stack local.
export SECRET_KEY_BASE="${SECRET_KEY_BASE:-e2e-secret-key-base-0000000000000000000000000000000000000000000000000000}"
export SUPER_ADMIN_PASSWORD="${SUPER_ADMIN_PASSWORD:-E2eSuperAdmin123*}"
export STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET:-whsec_e2e_test}"
export FRONTEND_URL="$UI_URL"
export REGISTRATION_RATE_LIMIT="${REGISTRATION_RATE_LIMIT:-1000}"
# Spec 039: los e2e abren varias demos desde la misma IP y varias a la vez.
export DEMO_RATE_LIMIT="${DEMO_RATE_LIMIT:-1000}"
export DEMO_MAX_PROVISIONING="${DEMO_MAX_PROVISIONING:-10}"
export RAILS_ENV=development

wait_for() { # url, nombre, intentos
  local url="$1" name="$2" tries="${3:-60}"
  for _ in $(seq 1 "$tries"); do
    if curl -fsS -o /dev/null "$url"; then echo "[e2e] $name listo"; return 0; fi
    sleep 2
  done
  echo "[e2e] $name no respondió en $url" >&2
  tail -n 40 "$LOG_DIR"/*.log >&2 || true
  return 1
}

echo "[e2e] preparando la base (semillas y datos de demo)"
(cd "$API_DIR" && bin/rails db:prepare) >"$LOG_DIR/db-prepare.log" 2>&1

echo "[e2e] arrancando la API en $API_URL"
(cd "$API_DIR" && nohup bin/rails server -p 3000 -b 0.0.0.0 >"$LOG_DIR/api.log" 2>&1 & echo $! >"$LOG_DIR/api.pid")
wait_for "$API_URL/up" "API"

echo "[e2e] construyendo y arrancando la UI en $UI_URL"
export NEXT_PUBLIC_API_URL="$API_URL"
# Spec 039: con esta variable la demo pide el contacto (opcional); así el e2e cubre ese camino.
export NEXT_PUBLIC_PRIVACY_URL="${NEXT_PUBLIC_PRIVACY_URL:-https://example.test/aviso-de-privacidad}"
(cd "$UI_DIR" && npm run build) >"$LOG_DIR/ui-build.log" 2>&1
(cd "$UI_DIR" && nohup npx next start -p 4200 >"$LOG_DIR/ui.log" 2>&1 & echo $! >"$LOG_DIR/ui.pid")
wait_for "$UI_URL/es/login" "UI"

echo "[e2e] stack listo"
