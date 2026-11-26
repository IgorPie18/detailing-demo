-- Lumen Detailing demo: schemat bazy. Wklej całość w Supabase → SQL Editor → Run.
-- Można uruchomić ponownie (idempotentne), dane rezerwacji zostają.

create extension if not exists btree_gist;

-- Salon. catalog = usługi, ceny, dodatki i ustawienia (jsonb, edytowane z panelu).
create table if not exists public.studios (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  owner_id uuid references auth.users on delete set null,
  catalog jsonb not null default '{}'::jsonb
);

create table if not exists public.bookings (
  id bigint generated always as identity primary key,
  studio_id uuid not null references public.studios on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  svc text not null,
  pkg text not null,
  size text not null check (size in ('s','m','l','xl')),
  car text check (char_length(car) <= 80),
  name text not null check (char_length(name) between 2 and 80),
  phone text not null check (phone ~ '^\+48 [0-9]{9}$' or phone ~ '^\+48 [0-9*]{3} [0-9*]{3} [0-9*]{3}$'),
  email text check (char_length(email) <= 120),
  bay int not null check (bay in (1,2)),
  status text not null check (status in ('pending','confirmed','done','rejected','noshow','proposed')),
  src text not null default 'web',
  total int not null check (total >= 0),
  deposit int not null default 0,
  paid boolean not null default false,
  addons text[] not null default '{}',
  cond text check (char_length(cond) <= 1000),
  note text check (char_length(note) <= 1000),
  photo_paths text[] not null default '{}',
  seed boolean not null default false,
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);

-- Protokół przyjęcia auta: uszkodzenia na schemacie, zdjęcia, przebieg, podpis klienta.
alter table public.bookings add column if not exists intake jsonb;

-- Dwie potwierdzone wizyty nie mogą zająć tego samego stanowiska w tym samym czasie.
do $$ begin
  alter table public.bookings add constraint no_double_booking
    exclude using gist (studio_id with =, bay with =, tstzrange(start_at, end_at) with &&)
    where (status = 'confirmed');
exception when duplicate_object or duplicate_table then null; end $$;

alter table public.studios enable row level security;
alter table public.bookings enable row level security;

-- Katalog salonu jest publiczny (strona z cennikiem), zmienia go tylko właściciel.
drop policy if exists studios_read on public.studios;
create policy studios_read on public.studios for select to anon, authenticated using (true);
drop policy if exists studios_owner_update on public.studios;
create policy studios_owner_update on public.studios for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Klient strony może tylko DODAĆ rezerwację, nie widzi cudzych.
-- shortcut: status 'confirmed' przy usłudze „od ręki” ufa klientowi (płatność w demo jest udawana);
-- przy prawdziwych płatnościach status ustawia webhook operatora płatności.
drop policy if exists bookings_public_insert on public.bookings;
create policy bookings_public_insert on public.bookings for insert to anon, authenticated
  with check (status in ('pending','confirmed') and seed = false and src = 'web' and intake is null
    and start_at > now() and start_at < now() + interval '60 days');

drop policy if exists bookings_owner_all on public.bookings;
create policy bookings_owner_all on public.bookings for all to authenticated
  using (exists (select 1 from public.studios s where s.id = studio_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.studios s where s.id = studio_id and s.owner_id = auth.uid()));

-- Zajęte terminy dla kalendarza klienta: tylko czas i stanowisko, bez danych osobowych.
create or replace function public.busy_slots(p_studio uuid, p_from timestamptz, p_to timestamptz)
returns table (start_at timestamptz, end_at timestamptz, bay int)
language sql stable security definer set search_path = public as $$
  select b.start_at, b.end_at, b.bay from public.bookings b
  where b.studio_id = p_studio and b.status in ('pending','confirmed','proposed')
    and b.start_at < p_to and b.end_at > p_from
$$;
revoke all on function public.busy_slots(uuid, timestamptz, timestamptz) from public;
grant execute on function public.busy_slots(uuid, timestamptz, timestamptz) to anon, authenticated;

-- Panel dostaje nowe rezerwacje na żywo.
do $$ begin
  alter publication supabase_realtime add table public.bookings;
exception when duplicate_object then null; end $$;

-- Zdjęcia aut od klientów: prywatny bucket, ścieżka <studio_id>/<plik>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 8388608, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do nothing;

drop policy if exists photos_public_upload on storage.objects;
create policy photos_public_upload on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'photos'
    and (storage.foldername(name))[1] in (select id::text from public.studios));

drop policy if exists photos_owner_read on storage.objects;
create policy photos_owner_read on storage.objects for select to authenticated
  using (bucket_id = 'photos'
    and (storage.foldername(name))[1] in (select id::text from public.studios where owner_id = auth.uid()));

-- Salon demo przypisany do konta admina (katalog uzupełni panel przy pierwszym logowaniu).
insert into public.studios (slug, name, owner_id)
select 'lumen', 'Lumen Detailing', u.id from auth.users u where u.email = 'demo.panel@example.com'
on conflict (slug) do update set owner_id = excluded.owner_id;

select id, slug, owner_id is not null as ma_wlasciciela from public.studios;
