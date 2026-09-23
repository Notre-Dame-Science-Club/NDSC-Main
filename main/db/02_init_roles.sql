-- Bootstrap the roles PostgREST expects. Mounted into the postgres:15
-- container at /docker-entrypoint-initdb.d/00-init-roles.sql so it runs
-- once on first boot of a fresh volume. Idempotent: every CREATE uses
-- IF NOT EXISTS semantics.
--
-- Why these roles exist:
--   - anon       — role PostgREST uses for unauthenticated (no
--                  Authorization header or invalid JWT) requests.
--                  PostgREST's PGRST_DB_ANON_ROLE points here.
--   - service_role — role PostgREST uses for requests with a JWT
--                    whose `role` claim is `service_role`. The
--                    Supabase JS client sends the service-role JWT
--                    from the @supabase/supabase-js admin client.
--   - authenticator — login role PostgREST uses to switch into anon
--                     / service_role for each request. Required by
--                     PostgREST; can be a no-op role.
--
-- We grant the two real roles broad access to public; the dev stack
-- doesn't run RLS, so this is fine. In prod Supabase, RLS would
-- restrict the actual reads.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator with login password 'postgres' noinherit;
  end if;
end $$;

grant usage on schema public to anon, service_role, authenticator;
grant all on all tables in schema public to anon, service_role, authenticator;
grant all on all sequences in schema public to anon, service_role, authenticator;
grant all on all functions in schema public to anon, service_role, authenticator;

-- Re-grant on future tables too, so the dev experience stays consistent
-- after running new migrations.
alter default privileges in schema public
  grant all on tables to anon, service_role, authenticator;
alter default privileges in schema public
  grant all on sequences to anon, service_role, authenticator;
alter default privileges in schema public
  grant all on functions to anon, service_role, authenticator;

-- authenticator is allowed to assume anon and service_role.
grant anon to authenticator;
grant service_role to authenticator;
