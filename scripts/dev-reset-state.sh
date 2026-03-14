#!/bin/sh

set -eu

ROOT_DIR=$(
  CDPATH= cd -- "$(dirname "$0")/.." && pwd
)

COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.dev.yml}
DB_URL=${DB_URL:-postgresql://bookshare:bookshare_dev@localhost:5434/bookshare}
DELETE_MEMBER_EMAIL=${DELETE_MEMBER_EMAIL:-codex.auth.check@example.com}
COMPOSE_PROJECT=${COMPOSE_PROJECT_NAME:-$(basename "$ROOT_DIR")}

case "$COMPOSE_FILE" in
  /*) COMPOSE_PATH="$COMPOSE_FILE" ;;
  *) COMPOSE_PATH="$ROOT_DIR/$COMPOSE_FILE" ;;
esac

compose() {
  docker compose -f "$COMPOSE_PATH" "$@"
}

printf '%s\n' "[reset] ensuring postgres, minio, and workflows are running"
compose up -d postgres minio workflows workflows-console >/dev/null

printf '%s\n' "[reset] waiting for postgres"
until psql "$DB_URL" -c 'select 1' >/dev/null 2>&1; do
  sleep 1
done

printf '%s\n' "[reset] clearing database state"
psql "$DB_URL" \
  -v ON_ERROR_STOP=1 \
  -v delete_member_email="$DELETE_MEMBER_EMAIL" \
  -f "$ROOT_DIR/infra/postgres/reset-user-data.sql"

printf '%s\n' "[reset] removing copy and submission media from MinIO"
minio_cleanup_attempt=0
until compose run --rm --no-deps --entrypoint sh minio-init -lc '
  mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
  mc rm --recursive --force "local/$MINIO_BUCKET/copies" >/dev/null 2>&1 || true
  mc rm --recursive --force "local/$MINIO_BUCKET/submissions/copy-requests" >/dev/null 2>&1 || true
' >/dev/null; do
  minio_cleanup_attempt=$((minio_cleanup_attempt + 1))
  if [ "$minio_cleanup_attempt" -ge 10 ]; then
    printf '%s\n' "[reset] failed to reach MinIO for media cleanup" >&2
    exit 1
  fi
  sleep 1
done

printf '%s\n' "[reset] clearing workflows state volume"
compose stop workflows workflows-console >/dev/null 2>&1 || true
docker volume rm -f "${COMPOSE_PROJECT}_workflows_state" >/dev/null 2>&1 || true
compose up -d workflows workflows-console >/dev/null

printf '%s\n' "[reset] done"
printf '%s\n' "[reset] preserved catalog tables and member_profiles; deleted ${DELETE_MEMBER_EMAIL} if it existed"
