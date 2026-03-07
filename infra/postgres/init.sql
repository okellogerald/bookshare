-- ═══════════════════════════════════════════════════════════════
-- BookShare Database Initialization
-- ═══════════════════════════════════════════════════════════════

-- Create databases
SELECT 'CREATE DATABASE bookshare'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'bookshare')\gexec
SELECT 'CREATE DATABASE zitadel'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'zitadel')\gexec

-- Switch to bookshare database for the rest of the setup
\c bookshare;

-- ─── PostgREST Roles ──────────────────────────────────────────

-- Anonymous role: used when no JWT is provided
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgrest_anon') THEN
    CREATE ROLE postgrest_anon NOLOGIN;
  END IF;
END
$$;

-- Authenticated role: used when a valid JWT is provided
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgrest_auth') THEN
    CREATE ROLE postgrest_auth NOLOGIN;
  END IF;
END
$$;

-- PostgREST authenticator: connects as this, then switches to anon/auth
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgrest_authenticator') THEN
    CREATE ROLE postgrest_authenticator NOINHERIT LOGIN PASSWORD 'postgrest_dev';
  END IF;
END
$$;
ALTER ROLE postgrest_authenticator WITH PASSWORD 'postgrest_dev';
GRANT postgrest_anon TO postgrest_authenticator;
GRANT postgrest_auth TO postgrest_authenticator;

-- ─── Schema Setup ─────────────────────────────────────────────

-- Public schema permissions for PostgREST roles (SELECT only)
GRANT USAGE ON SCHEMA public TO postgrest_anon;
GRANT USAGE ON SCHEMA public TO postgrest_auth;

-- Default SELECT privileges for authenticated users only.
-- Anonymous access is closed (no default grants for postgrest_anon).
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO postgrest_auth;

-- ─── RLS Helper Function ──────────────────────────────────────

-- Extract the Zitadel user ID (sub claim) from the JWT claims passed by PostgREST.
-- PostgREST sets request.jwt.claims as a JSON string.
CREATE OR REPLACE FUNCTION current_user_id() RETURNS TEXT AS $$
  SELECT current_setting('request.jwt.claims', true)::json->>'sub';
$$ LANGUAGE sql STABLE;
