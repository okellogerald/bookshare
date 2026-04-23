#!/bin/sh
# Bootstrap script for development:
# Ensures the BookShare OAuth clients exist in Hydra.
# This is intentionally idempotent and safe to run on every compose up.
# Hydra v25 requires POST /admin/clients to create and PUT /admin/clients/{id}
# to update, so we create on first boot and update on subsequent boots.
set -eu

hydra_admin_url="${HYDRA_ADMIN_URL:-http://hydra:4445}"

# Wait for Hydra admin API readiness before attempting client upsert.
curl -fsS --retry 30 --retry-delay 1 --retry-connrefused "$hydra_admin_url/health/ready" >/dev/null

response_file="$(mktemp)"
trap 'rm -f "$response_file"' EXIT

build_payload() {
  client_id="$1"
  client_name="$2"
  base_url="$3"
  default_return_to="$4"

  printf '{"client_id":"%s","client_name":"%s","grant_types":["authorization_code","refresh_token"],"response_types":["code","id_token"],"scope":"openid profile email offline_access","token_endpoint_auth_method":"none","redirect_uris":["%s/api/auth/callback"],"post_logout_redirect_uris":["%s","%s/api/auth/post-logout"],"skip_consent":true,"skip_logout_consent":true,"metadata":{"default_return_to":"%s","app_base_url":"%s"}}' \
    "$client_id" "$client_name" "$base_url" "$base_url" "$base_url" "$default_return_to" "$base_url"
}

request() {
  method="$1"
  url="$2"
  payload="$3"

  curl -sS -o "$response_file" -w "%{http_code}" -X "$method" "$url" \
    -H "Content-Type: application/json" \
    -d "$payload"
}

upsert_client() {
  client_id="$1"
  client_name="$2"
  base_url="$3"
  default_return_to="$4"
  payload="$(build_payload "$client_id" "$client_name" "$base_url" "$default_return_to")"
  status="$(request POST "$hydra_admin_url/admin/clients" "$payload")"

  case "$status" in
    201)
      echo "hydra-client-init: created OAuth client $client_id"
      ;;
    409)
      status="$(request PUT "$hydra_admin_url/admin/clients/$client_id" "$payload")"
      if [ "$status" != "200" ]; then
        echo "hydra-client-init: failed to update OAuth client $client_id (status $status)" >&2
        cat "$response_file" >&2
        exit 1
      fi
      echo "hydra-client-init: updated OAuth client $client_id"
      ;;
    *)
      echo "hydra-client-init: failed to create OAuth client $client_id (status $status)" >&2
      cat "$response_file" >&2
      exit 1
      ;;
  esac
}

upsert_client "bookshare-web" "BookShare Web" "http://localhost:3334" "/browse"
upsert_client "bookshare-auth" "BookShare Auth" "http://localhost:3337" "/organizations"
upsert_client "bookshare-admin" "BookShare Admin" "http://localhost:3338" "/catalog"
upsert_client "bookshare-bookstores" "BookShare Bookstores" "http://localhost:3339" "/"
