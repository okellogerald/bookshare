#!/bin/sh
set -eu

target_file="${PGRST_JWT_SECRET_FILE:-/jwt/jwks.json}"
jwks_uri="${OIDC_JWKS_URI:-http://hydra:4444/.well-known/jwks.json}"

mkdir -p "$(dirname "$target_file")"

if [ -n "${OIDC_JWT_SECRET:-}" ]; then
  printf "%s" "$OIDC_JWT_SECRET" > "$target_file"
  echo "postgrest-jwt-init: wrote OIDC_JWT_SECRET to $target_file"
  exit 0
fi

echo "postgrest-jwt-init: fetching JWKS from $jwks_uri"

attempt=0
max_attempts=60

while [ "$attempt" -lt "$max_attempts" ]; do
  if jwks="$(curl -fsS "$jwks_uri")"; then
    printf "%s" "$jwks" > "$target_file"
    echo "postgrest-jwt-init: wrote fetched JWKS to $target_file"
    exit 0
  fi

  attempt=$((attempt + 1))
  sleep 2
done

echo "postgrest-jwt-init: failed to fetch JWKS from $jwks_uri" >&2
exit 1
