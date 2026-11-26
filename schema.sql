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
-- Protokół wydania, etap pracy, dopłaty do akceptacji, punkty lojalnościowe, link dla klienta.
alter table public.bookings add column if not exists handover jsonb;
alter table public.bookings add column if not exists stage text check (stage in ('przyjete','w_trakcie','gotowe','wydane'));
alter table public.bookings add column if not exists extras jsonb not null default '[]'::jsonb;
alter table public.bookings add column if not exists points_used int not null default 0 check (points_used >= 0);
alter table public.bookings add column if not exists token uuid not null default gen_random_uuid();
create unique index if not exists bookings_token on public.bookings(token);
-- Link klienta zawsze losuje baza, nigdy przeglądarka klienta.
create or replace function public.bookings_force_token() returns trigger language plpgsql as $$
begin
  if new.src = 'web' then new.token := gen_random_uuid(); end if;
  return new;
end $$;
drop trigger if exists bookings_force_token on public.bookings;
create trigger bookings_force_token before insert on public.bookings for each row execute function public.bookings_force_token();

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
    and handover is null and stage is null and extras = '[]'::jsonb and points_used = 0
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

-- Strona statusu dla klienta (link z SMS-a): tylko jego wizyta, bez telefonu i zdjęć.
create or replace function public.booking_public(p_token uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('id', b.id, 'name', split_part(b.name, ' ', 1), 'car', b.car, 'svc', b.svc, 'pkg', b.pkg, 'size', b.size,
    'start_at', b.start_at, 'end_at', b.end_at, 'status', b.status, 'stage', b.stage, 'total', b.total, 'deposit', b.deposit, 'paid', b.paid,
    'extras', b.extras, 'marks', coalesce(b.intake->'marks', '[]'::jsonb), 'km', b.intake->>'km', 'intake_at', b.intake->>'at',
    'intake_signed', b.intake->>'signedAt', 'handover_signed', b.handover->>'signedAt', 'points_used', b.points_used,
    -- punkty tylko dla wizyty, którą salon fizycznie przyjął (sam numer telefonu z formularza niczego nie odblokowuje)
    'spent', case when b.stage is not null or b.status = 'done' then (select coalesce(sum(x.total), 0) from public.bookings x where x.studio_id = b.studio_id and x.phone = b.phone and x.status = 'done') else 0 end,
    'used', case when b.stage is not null or b.status = 'done' then (select coalesce(sum(x.points_used), 0) from public.bookings x where x.studio_id = b.studio_id and x.phone = b.phone) else 0 end)
  from public.bookings b where b.token = p_token
$$;
revoke all on function public.booking_public(uuid) from public;
grant execute on function public.booking_public(uuid) to anon, authenticated;

-- Klient akceptuje albo odrzuca dopłatę z linku. Kwota dolicza się tylko raz.
create or replace function public.extra_respond(p_token uuid, p_id text, p_accept boolean)
returns json language plpgsql security definer set search_path = public as $$
declare b public.bookings; e jsonb; i int; amt int;
begin
  select * into b from public.bookings where token = p_token for update;
  if not found then return null; end if;
  for i in 0 .. jsonb_array_length(b.extras) - 1 loop
    e := b.extras -> i;
    if e->>'id' = p_id and e->>'status' = 'pending' then
      amt := greatest(0, coalesce((e->>'amount')::int, 0));
      update public.bookings set
        extras = jsonb_set(jsonb_set(extras, array[i::text, 'status'], to_jsonb(case when p_accept then 'accepted' else 'declined' end)), array[i::text, 'at'], to_jsonb(now())),
        total = total + case when p_accept then amt else 0 end
      where id = b.id;
    end if;
  end loop;
  return public.booking_public(p_token);
end $$;
revoke all on function public.extra_respond(uuid, text, boolean) from public;
grant execute on function public.extra_respond(uuid, text, boolean) to anon, authenticated;

-- Lista rezerwowa: klient zapisuje się na pełny dzień, salon pisze, gdy coś się zwolni.
create table if not exists public.waitlist (
  id bigint generated always as identity primary key,
  studio_id uuid not null references public.studios on delete cascade,
  day date not null,
  svc text not null,
  name text not null check (char_length(name) between 2 and 80),
  phone text not null check (phone ~ '^\+48 [0-9]{9}$' or phone ~ '^\+48 [0-9*]{3} [0-9*]{3} [0-9*]{3}$'),
  note text check (char_length(note) <= 300),
  status text not null default 'waiting' check (status in ('waiting','notified','booked','closed')),
  seed boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.waitlist enable row level security;
drop policy if exists waitlist_public_insert on public.waitlist;
create policy waitlist_public_insert on public.waitlist for insert to anon, authenticated
  with check (status = 'waiting' and seed = false and day >= current_date and day < current_date + 60);
drop policy if exists waitlist_owner_all on public.waitlist;
create policy waitlist_owner_all on public.waitlist for all to authenticated
  using (exists (select 1 from public.studios s where s.id = studio_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.studios s where s.id = studio_id and s.owner_id = auth.uid()));

-- Bony prezentowe.
-- shortcut: bon ze strony jest od razu aktywny (płatność w demo udawana); przy prawdziwych płatnościach aktywuje go webhook.
create table if not exists public.vouchers (
  id bigint generated always as identity primary key,
  studio_id uuid not null references public.studios on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{4}-[A-Z0-9]{4}$'),
  amount int not null check (amount between 50 and 5000),
  buyer_name text not null check (char_length(buyer_name) between 2 and 80),
  buyer_phone text not null check (buyer_phone ~ '^\+48 [0-9]{9}$' or buyer_phone ~ '^\+48 [0-9*]{3} [0-9*]{3} [0-9*]{3}$'),
  recipient text check (char_length(recipient) <= 80),
  message text check (char_length(message) <= 200),
  status text not null default 'active' check (status in ('active','used','expired')),
  expires_at date not null default (current_date + 365),
  used_at timestamptz,
  src text not null default 'web',
  seed boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.vouchers enable row level security;
drop policy if exists vouchers_public_insert on public.vouchers;
create policy vouchers_public_insert on public.vouchers for insert to anon, authenticated
  with check (status = 'active' and used_at is null and seed = false and src = 'web' and expires_at <= current_date + 366);
drop policy if exists vouchers_owner_all on public.vouchers;
create policy vouchers_owner_all on public.vouchers for all to authenticated
  using (exists (select 1 from public.studios s where s.id = studio_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.studios s where s.id = studio_id and s.owner_id = auth.uid()));

-- Panel dostaje nowe rezerwacje na żywo.
do $$ begin
  alter publication supabase_realtime add table public.bookings;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.waitlist;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.vouchers;
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
