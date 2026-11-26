-- Ilkwang Church Official Website — Supabase Cloud Persistence Schema

create table if not exists public.app_kv_store (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_kv_store enable row level security;

grant select, insert, update, delete on table public.app_kv_store to authenticated, service_role;

create policy "Church server read kv"
on public.app_kv_store
for select
to authenticated
using (
  coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'is_church_server')::boolean, false) = true
);

create policy "Church server insert kv"
on public.app_kv_store
for insert
to authenticated
with check (
  coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'is_church_server')::boolean, false) = true
);

create policy "Church server update kv"
on public.app_kv_store
for update
to authenticated
using (
  coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'is_church_server')::boolean, false) = true
)
with check (
  coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'is_church_server')::boolean, false) = true
);

create policy "Church server delete kv"
on public.app_kv_store
for delete
to authenticated
using (
  coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'is_church_server')::boolean, false) = true
);

insert into storage.buckets (id, name, public, file_size_limit)
values ('church-uploads', 'church-uploads', true, 52428800)
on conflict (id) do update
set public = true, file_size_limit = 52428800;

create policy "Public read access for church uploads"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'church-uploads');

create policy "Church server insert uploads"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'church-uploads'
  and coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'is_church_server')::boolean, false) = true
);

create policy "Church server update uploads"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'church-uploads'
  and coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'is_church_server')::boolean, false) = true
)
with check (
  bucket_id = 'church-uploads'
  and coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'is_church_server')::boolean, false) = true
);

create policy "Church server delete uploads"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'church-uploads'
  and coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'is_church_server')::boolean, false) = true
);

-- Admin header usage meter: database size and church-uploads storage usage.
-- Callable only by service_role or the church server account (is_church_server claim).
create or replace function public.church_usage_stats()
returns json
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  claims json := (select auth.jwt())::json;
begin
  if coalesce(claims ->> 'role', '') <> 'service_role'
     and coalesce((claims -> 'app_metadata' ->> 'is_church_server')::boolean, false) = false then
    raise exception 'church_usage_stats: forbidden' using errcode = '42501';
  end if;
  return json_build_object(
    'db_bytes', pg_catalog.pg_database_size(pg_catalog.current_database()),
    'storage_bytes', (select coalesce(sum((o.metadata ->> 'size')::bigint), 0) from storage.objects o where o.bucket_id = 'church-uploads'),
    'storage_objects', (select count(*) from storage.objects o where o.bucket_id = 'church-uploads')
  );
end;
$$;

revoke all on function public.church_usage_stats() from public, anon;
grant execute on function public.church_usage_stats() to authenticated, service_role;
