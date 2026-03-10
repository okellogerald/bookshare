#!/bin/sh
set -eu

curl -fsS --retry 30 --retry-delay 1 --retry-connrefused http://hydra:4445/health/ready >/dev/null

curl -fsS -X PUT "http://hydra:4445/admin/clients/bookshare-web" \
  -H "Content-Type: application/json" \
  -d '{"client_id":"bookshare-web","grant_types":["authorization_code","refresh_token"],"response_types":["code","id_token"],"scope":"openid profile email offline_access","token_endpoint_auth_method":"none","redirect_uris":["http://localhost:3334/api/auth/callback"],"post_logout_redirect_uris":["http://localhost:3334"]}' \
  >/dev/null
