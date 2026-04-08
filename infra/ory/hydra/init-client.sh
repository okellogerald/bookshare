#!/bin/sh
# Bootstrap script for development:
# Ensures the `bookshare-web` OAuth client exists in Hydra.
# This is intentionally idempotent and safe to run on every compose up.
# Hydra v25 requires POST /admin/clients to create and PUT /admin/clients/{id}
# to update, so we create on first boot and update on subsequent boots.
set -eu

# Wait for Hydra admin API readiness before attempting client upsert.
curl -fsS --retry 30 --retry-delay 1 --retry-connrefused http://hydra:4445/health/ready >/dev/null

# Upsert OAuth client used by apps/web:
# - PKCE public client (`token_endpoint_auth_method: none`)
# - Authorization Code + Refresh Token
# - Redirect URI points to web callback route
payload='{"client_id":"bookshare-web","grant_types":["authorization_code","refresh_token"],"response_types":["code","id_token"],"scope":"openid profile email offline_access","token_endpoint_auth_method":"none","redirect_uris":["http://localhost:3334/api/auth/callback"],"post_logout_redirect_uris":["http://localhost:3334","http://localhost:3334/api/auth/post-logout"]}'
response_file="$(mktemp)"
trap 'rm -f "$response_file"' EXIT

request() {
  method="$1"
  url="$2"

  curl -sS -o "$response_file" -w "%{http_code}" -X "$method" "$url" \
    -H "Content-Type: application/json" \
    -d "$payload"
}

status="$(request POST "http://hydra:4445/admin/clients")"

case "$status" in
  201)
    echo "hydra-client-init: created OAuth client bookshare-web"
    ;;
  409)
    status="$(request PUT "http://hydra:4445/admin/clients/bookshare-web")"
    if [ "$status" != "200" ]; then
      echo "hydra-client-init: failed to update OAuth client bookshare-web (status $status)" >&2
      cat "$response_file" >&2
      exit 1
    fi
    echo "hydra-client-init: updated OAuth client bookshare-web"
    ;;
  *)
    echo "hydra-client-init: failed to create OAuth client bookshare-web (status $status)" >&2
    cat "$response_file" >&2
    exit 1
    ;;
esac
