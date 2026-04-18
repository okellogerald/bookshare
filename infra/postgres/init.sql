-- ═══════════════════════════════════════════════════════════════
-- BookShare Database Initialization
-- ═══════════════════════════════════════════════════════════════

-- Create databases
SELECT 'CREATE DATABASE bookshare'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'bookshare')\gexec

-- Switch to bookshare database for the rest of the setup
\c bookshare;

-- ─── PostgREST Roles ──────────────────────────────────────────

-- Legacy roles kept for migration compatibility with older PostgREST setup.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgrest_anon') THEN
    CREATE ROLE postgrest_anon NOLOGIN;
  END IF;
END
$$;

-- Legacy authenticated role kept for migration compatibility with the older
-- JWT-switched PostgREST setup.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgrest_auth') THEN
    CREATE ROLE postgrest_auth NOLOGIN;
  END IF;
END
$$;

-- Internal read-only service role: used for all PostgREST requests from NestJS.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgrest_read_service') THEN
    CREATE ROLE postgrest_read_service NOLOGIN;
  END IF;
END
$$;

-- PostgREST authenticator: connects as this, then switches to the fixed
-- internal read-only service role.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgrest_authenticator') THEN
    CREATE ROLE postgrest_authenticator NOINHERIT LOGIN PASSWORD 'postgrest_dev';
  END IF;
END
$$;
ALTER ROLE postgrest_authenticator WITH PASSWORD 'postgrest_dev';
GRANT postgrest_read_service TO postgrest_authenticator;

-- ─── Schema Setup ─────────────────────────────────────────────

-- Public schema permissions for PostgREST roles (SELECT only)
GRANT USAGE ON SCHEMA public TO postgrest_anon;
GRANT USAGE ON SCHEMA public TO postgrest_auth;
GRANT USAGE ON SCHEMA public TO postgrest_read_service;

-- Default SELECT privileges for the internal PostgREST read service only.
-- Anonymous and legacy JWT-switched roles do not get new table access by default.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM postgrest_auth;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO postgrest_read_service;

-- ─── RLS Helper Function ──────────────────────────────────────

-- Helper retained for legacy views/functions that still read JWT-style claims.
-- PostgREST sets request.jwt.claims as a JSON string when claims are present.
CREATE OR REPLACE FUNCTION current_user_id() RETURNS TEXT AS $$
  SELECT current_setting('request.jwt.claims', true)::json->>'sub';
$$ LANGUAGE sql STABLE;
