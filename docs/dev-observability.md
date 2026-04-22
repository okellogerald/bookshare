# Development observability

The dev stack has three layers for understanding auth and application flows.

## 1. Logs

Start the stack normally:

```sh
docker compose -f docker-compose.dev.yml up --build --remove-orphans
```

Browse logs in Dozzle:

```text
http://localhost:8080
```

Or stream them in a terminal:

```sh
docker compose -f docker-compose.dev.yml logs -f --timestamps --tail=0 \
  web admin bookstores auth auth-api api hydra kratos
```

Hydra and Kratos emit JSON debug logs in dev. Sensitive values remain redacted.

## 2. Distributed traces

Jaeger starts with the normal dev stack:

```text
http://localhost:16686
```

Use the `hydra` and `kratos` services in the Jaeger search UI to see request
spans, status codes, timing, and database spans produced by Ory.

## 3. Full HTTP capture

mitmproxy starts with the normal dev stack and owns the usual localhost service
ports. Keep using the normal URLs; the traffic is routed through the capture
proxy automatically.

```sh
docker compose -f docker-compose.dev.yml up --build --remove-orphans
```

Open mitmproxy:

```text
http://localhost:8090
```

Password:

```text
bookshare
```

Captured localhost ports:

```text
Hydra public   http://localhost:4444
Hydra admin    http://localhost:4445
Kratos public  http://localhost:4433
Kratos admin   http://localhost:4434
Auth portal    http://localhost:3337
Web            http://localhost:3334
Admin          http://localhost:3338
Bookstores     http://localhost:3339
API            http://localhost:3333
Auth API       http://localhost:3340
Workflows      http://localhost:3335
PostgREST      http://localhost:9300
MinIO API      http://localhost:9002
Mailpit UI     http://localhost:4436
```

This layer captures cookies, OAuth codes, CSRF tokens, and other secrets. Keep
captures local and clear them when they are no longer needed.

Use the mitmproxy UI export controls if you need to save a focused capture.
