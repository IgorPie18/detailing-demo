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

-- Zespół salonu: właściciel (studios.owner_id), administratorzy i pracownicy z własnymi kontami.
create table if not exists public.team (
  id bigint generated always as identity primary key,
  studio_id uuid not null references public.studios on delete cascade,
  user_id uuid unique references auth.users on delete set null,
  email text check (char_length(email) <= 120),
  name text not null check (char_length(name) between 2 and 60),
  role text not null default 'worker' check (role in ('admin','worker')),
  color text not null default '#ea580c' check (color ~ '^#[0-9a-f]{6}$'),
  commission int not null default 0 check (commission between 0 and 50),
  active boolean not null default true,
  seed boolean not null default false,
  created_at timestamptz not null default now()
);
-- 'owner', 'admin', 'worker' albo null (brak dostępu). Używane w regułach RLS i przez panel.
create or replace function public.team_role(p_studio uuid) returns text
language sql stable security definer set search_path = public as $$
  select case when exists (select 1 from public.studios s where s.id = p_studio and s.owner_id = auth.uid()) then 'owner'
    else (select t.role from public.team t where t.studio_id = p_studio and t.user_id = auth.uid() and t.active limit 1) end
$$;
create or replace function public.is_member(p_studio uuid) returns boolean
language sql stable security definer set search_path = public as $$ select public.team_role(p_studio) is not null $$;
create or replace function public.is_admin(p_studio uuid) returns boolean
language sql stable security definer set search_path = public as $$ select coalesce(public.team_role(p_studio) in ('owner','admin'), false) $$;
revoke all on function public.team_role(uuid) from public;
grant execute on function public.team_role(uuid) to authenticated;
grant execute on function public.is_member(uuid), public.is_admin(uuid) to authenticated;

-- Protokół przyjęcia auta: uszkodzenia na schemacie, zdjęcia, przebieg, podpis klienta.
alter table public.bookings add column if not exists intake jsonb;
-- Protokół wydania, etap pracy, dopłaty do akceptacji, punkty lojalnościowe, link dla klienta.
alter table public.bookings add column if not exists handover jsonb;
alter table public.bookings add column if not exists stage text check (stage in ('przyjete','w_trakcie','gotowe','wydane'));
alter table public.bookings add column if not exists extras jsonb not null default '[]'::jsonb;
alter table public.bookings add column if not exists points_used int not null default 0 check (points_used >= 0);
alter table public.bookings add column if not exists token uuid not null default gen_random_uuid();
create unique index if not exists bookings_token on public.bookings(token);
-- Propozycja innego terminu od salonu; klient akceptuje albo odrzuca z linku.
alter table public.bookings add column if not exists proposal jsonb;
-- Kto wykonuje zlecenie, karta gwarancyjna powłoki/folii i link do paszportu auta (QR na certyfikacie).
alter table public.bookings add column if not exists worker_id bigint references public.team on delete set null;
alter table public.bookings add column if not exists warranty jsonb;
alter table public.bookings add column if not exists cert uuid;
create unique index if not exists bookings_cert on public.bookings(cert);
-- Link klienta zawsze losuje baza, nigdy przeglądarka klienta.
create or replace function public.bookings_force_token() returns trigger language plpgsql as $$
begin
  if new.src = 'web' then new.token := gen_random_uuid(); end if;
  return new;
end $$;
drop trigger if exists bookings_force_token on public.bookings;
create trigger bookings_force_token before insert on public.bookings for each row execute function public.bookings_force_token();

-- Stanowiska konfiguruje salon w panelu (1-20), nie tylko 1 i 2.
alter table public.bookings drop constraint if exists bookings_bay_check;
alter table public.bookings add constraint bookings_bay_check check (bay between 1 and 20);

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
  using (public.is_admin(id)) with check (public.is_admin(id));
-- Administrator zmienia katalog salonu, ale właściciela i adres (slug) zmienia tylko właściciel.
create or replace function public.studios_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if (new.owner_id is distinct from old.owner_id or new.slug is distinct from old.slug) and old.owner_id is distinct from auth.uid() then
    raise exception 'Właściciela salonu zmienia tylko właściciel';
  end if;
  return new;
end $$;
drop trigger if exists studios_guard on public.studios;
create trigger studios_guard before update on public.studios for each row execute function public.studios_guard();

-- Klient strony może tylko DODAĆ rezerwację, nie widzi cudzych.
-- shortcut: status 'confirmed' przy usłudze „od ręki” ufa klientowi (płatność w demo jest udawana);
-- przy prawdziwych płatnościach status ustawia webhook operatora płatności.
drop policy if exists bookings_public_insert on public.bookings;
create policy bookings_public_insert on public.bookings for insert to anon, authenticated
  with check (status in ('pending','confirmed') and seed = false and src = 'web' and intake is null
    and handover is null and stage is null and extras = '[]'::jsonb and points_used = 0 and proposal is null
    and worker_id is null and warranty is null and cert is null
    and start_at > now() and start_at < now() + interval '60 days');

drop policy if exists bookings_owner_all on public.bookings;
create policy bookings_owner_all on public.bookings for all to authenticated
  using (public.is_member(studio_id))
  with check (public.is_member(studio_id));

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
    'extras', b.extras, 'proposal', b.proposal, 'marks', coalesce(b.intake->'marks', '[]'::jsonb), 'km', b.intake->>'km', 'intake_at', b.intake->>'at',
    'intake_signed', b.intake->>'signedAt', 'handover_signed', b.handover->>'signedAt', 'points_used', b.points_used, 'cert', b.cert,
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

-- Klient odpowiada na propozycję innego terminu. Przy akceptacji wizyta sama się przenosi i potwierdza.
create or replace function public.proposal_respond(p_token uuid, p_accept boolean)
returns json language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  select * into b from public.bookings where token = p_token for update;
  if not found or b.status <> 'proposed' or b.proposal is null or coalesce(b.proposal->>'status', '') <> 'pending' then return public.booking_public(p_token); end if;
  if p_accept then
    begin
      update public.bookings set start_at = (b.proposal->>'start_at')::timestamptz, end_at = (b.proposal->>'end_at')::timestamptz,
        bay = coalesce((b.proposal->>'bay')::int, b.bay), status = 'confirmed',
        proposal = jsonb_set(jsonb_set(b.proposal, '{status}', '"accepted"'), '{at}', to_jsonb(now()))
      where id = b.id and status = 'proposed';
    exception when exclusion_violation then
      update public.bookings set proposal = jsonb_set(b.proposal, '{status}', '"taken"') where id = b.id;
    end;
  else
    update public.bookings set proposal = jsonb_set(jsonb_set(b.proposal, '{status}', '"declined"'), '{at}', to_jsonb(now())) where id = b.id;
  end if;
  return public.booking_public(p_token);
end $$;
revoke all on function public.proposal_respond(uuid, boolean) from public;
grant execute on function public.proposal_respond(uuid, boolean) to anon, authenticated;

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
-- Propozycja zwolnionego terminu: 'offer' czeka na akceptację salonu (Telegram), potem 'notified'.
alter table public.waitlist add column if not exists slot_at timestamptz;
alter table public.waitlist add column if not exists slot_bay int check (slot_bay between 1 and 20);
alter table public.waitlist drop constraint if exists waitlist_status_check;
alter table public.waitlist add constraint waitlist_status_check check (status in ('waiting','offer','notified','booked','closed'));
alter table public.waitlist enable row level security;
drop policy if exists waitlist_public_insert on public.waitlist;
create policy waitlist_public_insert on public.waitlist for insert to anon, authenticated
  with check (status = 'waiting' and seed = false and slot_at is null and slot_bay is null and day >= current_date and day < current_date + 60);
drop policy if exists waitlist_owner_all on public.waitlist;
create policy waitlist_owner_all on public.waitlist for all to authenticated
  using (public.is_member(studio_id))
  with check (public.is_member(studio_id));

-- Link klienta do jego miejsca na liście rezerwowej: pozycja w kolejce i wypisanie się.
alter table public.waitlist add column if not exists token uuid not null default gen_random_uuid();
create unique index if not exists waitlist_token on public.waitlist(token);
create or replace function public.waitlist_public(p_token uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('token', w.token, 'name', split_part(w.name, ' ', 1), 'day', w.day, 'svc', w.svc, 'status', w.status, 'slot_at', w.slot_at,
    'position', (select count(*) from public.waitlist x where x.studio_id = w.studio_id and x.day = w.day and x.status in ('waiting','offer','notified') and x.created_at <= w.created_at),
    'total', (select count(*) from public.waitlist x where x.studio_id = w.studio_id and x.day = w.day and x.status in ('waiting','offer','notified')))
  from public.waitlist w where w.token = p_token
$$;
create or replace function public.waitlist_join(p_studio uuid, p_day date, p_svc text, p_name text, p_phone text, p_note text default null)
returns json language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  if p_day < current_date or p_day >= current_date + 60 then raise exception 'Nieprawidłowy dzień'; end if;
  insert into public.waitlist (studio_id, day, svc, name, phone, note) values (p_studio, p_day, p_svc, p_name, p_phone, p_note) returning token into t;
  return public.waitlist_public(t);
end $$;
create or replace function public.waitlist_leave(p_token uuid)
returns json language plpgsql security definer set search_path = public as $$
begin
  update public.waitlist set status = 'closed' where token = p_token and status in ('waiting','offer','notified');
  return public.waitlist_public(p_token);
end $$;
revoke all on function public.waitlist_public(uuid) from public;
revoke all on function public.waitlist_join(uuid, date, text, text, text, text) from public;
revoke all on function public.waitlist_leave(uuid) from public;
grant execute on function public.waitlist_public(uuid) to anon, authenticated;
grant execute on function public.waitlist_join(uuid, date, text, text, text, text) to anon, authenticated;
grant execute on function public.waitlist_leave(uuid) to anon, authenticated;

-- Notatki w kalendarzu: widzi je tylko właściciel salonu (brak dostępu dla klientów strony).
create table if not exists public.cal_notes (
  id bigint generated always as identity primary key,
  studio_id uuid not null references public.studios on delete cascade,
  day date not null,
  at_time text check (at_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  body text not null check (char_length(body) between 1 and 500),
  author text check (char_length(author) <= 120),
  seed boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.cal_notes enable row level security;
drop policy if exists cal_notes_owner_all on public.cal_notes;
create policy cal_notes_owner_all on public.cal_notes for all to authenticated
  using (public.is_member(studio_id))
  with check (public.is_member(studio_id));

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
  using (public.is_admin(studio_id))
  with check (public.is_admin(studio_id));

-- ===== Zespół: reguły dostępu i konta =====
alter table public.team enable row level security;
drop policy if exists team_member_read on public.team;
create policy team_member_read on public.team for select to authenticated using (public.is_admin(studio_id) or user_id = auth.uid());
create or replace function public.team_list(p_studio uuid)
returns table (id bigint, name text, role text, color text, active boolean, user_id uuid, seed boolean)
language sql stable security definer set search_path = public as $$
  select t.id, t.name, t.role, t.color, t.active, case when t.user_id = auth.uid() then t.user_id end, t.seed
  from public.team t where t.studio_id = p_studio and public.is_member(p_studio) order by t.created_at
$$;
revoke all on function public.team_list(uuid) from public;
grant execute on function public.team_list(uuid) to authenticated;
drop policy if exists team_admin_write on public.team;
create policy team_admin_write on public.team for all to authenticated
  using (public.is_admin(studio_id)) with check (public.is_admin(studio_id));
-- Konto (user_id) podpina tylko funkcja team_login albo właściciel sam siebie; inaczej admin mógłby przejąć cudze konto.
create or replace function public.team_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if new.user_id is distinct from (case when tg_op = 'UPDATE' then old.user_id else null end)
     and coalesce(current_setting('app.team_rpc', true), '') <> '1'
     and not (new.user_id = auth.uid() and exists (select 1 from public.studios s where s.id = new.studio_id and s.owner_id = auth.uid())) then
    raise exception 'Konto pracownika zakłada się przyciskiem w panelu';
  end if;
  return new;
end $$;
drop trigger if exists team_guard on public.team;
create trigger team_guard before insert or update on public.team for each row execute function public.team_guard();

-- Admin zakłada pracownikowi konto (albo zmienia mu hasło). Bez maila z potwierdzeniem: konto działa od razu.
create or replace function public.team_login(p_member bigint, p_email text, p_password text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare m public.team; uid uuid; em text := lower(trim(p_email));
begin
  select * into m from public.team where id = p_member;
  if not found or not public.is_admin(m.studio_id) then raise exception 'Brak uprawnień'; end if;
  if char_length(coalesce(p_password, '')) < 8 then raise exception 'Hasło musi mieć co najmniej 8 znaków'; end if;
  if m.user_id is not null then
    if exists (select 1 from public.studios s where s.id = m.studio_id and s.owner_id = m.user_id) then raise exception 'Hasła właściciela nie zmienia się z panelu'; end if;
    update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now() where id = m.user_id;
    return m.email;
  end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Nieprawidłowy e-mail'; end if;
  if exists (select 1 from auth.users where lower(email) = em) then raise exception 'Ten e-mail ma już konto'; end if;
  uid := gen_random_uuid();
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', em, crypt(p_password, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('name', m.name), now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', em, 'email_verified', true), 'email', now(), now(), now());
  perform set_config('app.team_rpc', '1', true);
  update public.team set user_id = uid, email = em where id = m.id;
  return em;
end $$;
-- Usunięcie osoby z zespołu razem z jej kontem (właściciela nie da się usunąć).
create or replace function public.team_remove(p_member bigint)
returns void language plpgsql security definer set search_path = public as $$
declare m public.team;
begin
  select * into m from public.team where id = p_member;
  if not found or not public.is_admin(m.studio_id) then raise exception 'Brak uprawnień'; end if;
  if m.user_id is not null and exists (select 1 from public.studios s where s.id = m.studio_id and s.owner_id = m.user_id) then raise exception 'Nie można usunąć właściciela'; end if;
  delete from public.team where id = m.id;
  if m.user_id is not null then delete from auth.users where id = m.user_id; end if;
end $$;
revoke all on function public.team_login(bigint, text, text), public.team_remove(bigint) from public;
grant execute on function public.team_login(bigint, text, text), public.team_remove(bigint) to authenticated;

-- ===== Wyceny z wariantami: klient wybiera wariant i dodatki z linku =====
create table if not exists public.offers (
  id bigint generated always as identity primary key,
  studio_id uuid not null references public.studios on delete cascade,
  token uuid not null default gen_random_uuid(),
  booking_id bigint references public.bookings on delete set null,
  name text not null check (char_length(name) between 2 and 80),
  phone text not null check (phone ~ '^\+48 [0-9]{9}$' or phone ~ '^\+48 [0-9*]{3} [0-9*]{3} [0-9*]{3}$'),
  car text check (char_length(car) <= 80),
  size text not null default 'm' check (size in ('s','m','l','xl')),
  msg text check (char_length(msg) <= 500),
  options jsonb not null default '[]'::jsonb,
  addons jsonb not null default '[]'::jsonb,
  valid_until date not null default (current_date + 14),
  status text not null default 'sent' check (status in ('sent','accepted','declined','booked')),
  choice jsonb,
  author text check (char_length(author) <= 60),
  seed boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists offers_token on public.offers(token);
alter table public.offers enable row level security;
drop policy if exists offers_member_all on public.offers;
create policy offers_member_all on public.offers for all to authenticated
  using (public.is_member(studio_id)) with check (public.is_member(studio_id));
create or replace function public.offer_public(p_token uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('name', split_part(o.name, ' ', 1), 'car', o.car, 'size', o.size, 'msg', o.msg, 'options', o.options, 'addons', o.addons,
    'valid_until', o.valid_until, 'expired', o.valid_until < current_date, 'status', o.status, 'choice', o.choice, 'author', o.author, 'created_at', o.created_at)
  from public.offers o where o.token = p_token
$$;
-- Wybór klienta: kwotę liczy baza z cen zapisanych w wycenie, nie przeglądarka klienta.
create or replace function public.offer_respond(p_token uuid, p_option text, p_addons text[], p_accept boolean, p_note text default null)
returns json language plpgsql security definer set search_path = public as $$
declare o public.offers; opt jsonb; ad jsonb; tot int;
begin
  select * into o from public.offers where token = p_token for update;
  if not found or o.status <> 'sent' or o.valid_until < current_date then return public.offer_public(p_token); end if;
  if not p_accept then
    update public.offers set status = 'declined', choice = jsonb_build_object('note', left(p_note, 300), 'at', now()) where id = o.id;
    return public.offer_public(p_token);
  end if;
  select x into opt from jsonb_array_elements(o.options) x where x->>'id' = p_option;
  if opt is null then raise exception 'Nie ma takiego wariantu'; end if;
  select coalesce(jsonb_agg(x), '[]'::jsonb) into ad from jsonb_array_elements(o.addons) x where x->>'id' = any(coalesce(p_addons, '{}'));
  select coalesce((opt->>'price')::int, 0) + coalesce(sum((x->>'price')::int), 0) into tot from jsonb_array_elements(ad) x;
  update public.offers set status = 'accepted',
    choice = jsonb_build_object('option', p_option, 'addons', ad, 'total', tot, 'note', left(p_note, 300), 'at', now()) where id = o.id;
  return public.offer_public(p_token);
end $$;
revoke all on function public.offer_public(uuid), public.offer_respond(uuid, text, text[], boolean, text) from public;
grant execute on function public.offer_public(uuid), public.offer_respond(uuid, text, text[], boolean, text) to anon, authenticated;

-- ===== Paszport auta (link z kodu QR na certyfikacie): historia usług i gwarancje, bez danych osobowych =====
create or replace function public.car_passport(p_cert uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('studio', s.name, 'car', b0.car, 'size', b0.size, 'cert', b0.cert,
    'visits', (select coalesce(json_agg(json_build_object('svc', x.svc, 'pkg', x.pkg, 'at', coalesce(x.handover->>'at', x.end_at::text),
        'km', x.intake->>'km', 'warranty', x.warranty, 'cert', x.cert, 'marks', jsonb_array_length(coalesce(x.intake->'marks', '[]'::jsonb)),
        'note', x.handover->>'note') order by x.end_at desc), '[]'::json)
      from public.bookings x where x.studio_id = b0.studio_id and x.phone = b0.phone and x.status = 'done'
        and lower(coalesce(x.car, '')) = lower(coalesce(b0.car, ''))))
  from public.bookings b0 join public.studios s on s.id = b0.studio_id where b0.cert = p_cert
$$;
revoke all on function public.car_passport(uuid) from public;
grant execute on function public.car_passport(uuid) to anon, authenticated;

-- ===== Ochrona przed spamem ze strony: limit na numer telefonu i na salon =====
-- Dotyczy tylko rezerwacji ze strony (src = 'web'); panel i dane przykładowe bez limitu.
create or replace function public.bookings_rate_limit() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.src = 'web' and not new.seed then
    if (select count(*) from public.bookings where studio_id = new.studio_id and phone = new.phone and src = 'web' and created_at > now() - interval '24 hours') >= 3 then
      raise exception 'LIMIT: Z tego numeru są już 3 rezerwacje z ostatniej doby. Zadzwoń do salonu, chętnie pomożemy.';
    end if;
    if (select count(*) from public.bookings where studio_id = new.studio_id and src = 'web' and created_at > now() - interval '1 hour') >= 30 then
      raise exception 'LIMIT: Za dużo rezerwacji w krótkim czasie. Spróbuj za chwilę albo zadzwoń do salonu.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists bookings_rate_limit on public.bookings;
create trigger bookings_rate_limit before insert on public.bookings for each row execute function public.bookings_rate_limit();
-- Lista rezerwowa: najwyżej 3 zapisy z jednego numeru na dobę.
create or replace function public.waitlist_rate_limit() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not new.seed and (select count(*) from public.waitlist where studio_id = new.studio_id and phone = new.phone and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'LIMIT: Z tego numeru są już 3 zapisy na listę rezerwową z ostatniej doby.';
  end if;
  return new;
end $$;
drop trigger if exists waitlist_rate_limit on public.waitlist;
create trigger waitlist_rate_limit before insert on public.waitlist for each row execute function public.waitlist_rate_limit();

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
do $$ begin
  alter publication supabase_realtime add table public.offers;
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
    and (storage.foldername(name))[1] in (select id::text from public.studios where public.is_member(id)));

-- Zdjęcia usług na stronę: publiczny bucket, wgrywa tylko właściciel do folderu swojego salonu.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('public', 'public', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
drop policy if exists public_owner_upload on storage.objects;
create policy public_owner_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'public'
    and (storage.foldername(name))[1] in (select id::text from public.studios where public.is_admin(id)));

-- Rejestracja nowego salonu z kreatora (rejestracja.html): konto właściciela, salon, stanowiska, zespół i wybrane funkcje.
-- Konto działa od razu, bez maila z potwierdzeniem (jak konta zespołu). Dane z formularza są przycinane i filtrowane tutaj, nie w przeglądarce.
alter table public.studios add column if not exists created_at timestamptz not null default now();
create table if not exists public.feature_wishes (
  id bigint generated always as identity primary key,
  studio_id uuid not null references public.studios on delete cascade,
  wish text not null check (char_length(wish) between 3 and 1000),
  created_at timestamptz not null default now()
);
alter table public.feature_wishes enable row level security;
drop policy if exists feature_wishes_admin_read on public.feature_wishes;
create policy feature_wishes_admin_read on public.feature_wishes for select to authenticated using (public.is_admin(studio_id));

-- v2 (27.11): własne rodzaje pracy (p_cats) i usługi z kreatora (p_services); stara wersja bez nich usuwana, żeby nie było dwóch wersji funkcji
drop function if exists public.studio_register(text, text, text, jsonb, jsonb, jsonb, jsonb, text, boolean, text);
create or replace function public.studio_register(p_owner text, p_email text, p_password text, p_salon jsonb, p_bays jsonb,
  p_team jsonb, p_features jsonb, p_wish text default null, p_sample boolean default true, p_plan text default 'start',
  p_cats jsonb default null, p_services jsonb default null)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare em text := lower(trim(p_email)); own text := left(trim(coalesce(p_owner, '')), 60); sname text := left(trim(coalesce(p_salon->>'name', '')), 60);
  uid uuid := gen_random_uuid(); sid uuid; base text; sl text; n int := 1; bays jsonb := '[]'; feats jsonb := '{}'; k text; x jsonb; i int := 0;
  pal text[] := array['#1c1917','#c2410c','#0f766e','#4338ca','#a16207','#be185d']; cats jsonb := '[]'; catids text[] := '{}'; svcs jsonb := '[]';
begin
  if (select count(*) from public.studios where created_at > now() - interval '1 hour') >= 15 then
    raise exception 'LIMIT: Za dużo nowych salonów w ostatniej godzinie. Spróbuj za chwilę.'; end if;
  if char_length(own) < 2 then raise exception 'Wpisz imię i nazwisko'; end if;
  if char_length(sname) < 2 then raise exception 'Wpisz nazwę salonu'; end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(em) > 120 then raise exception 'Nieprawidłowy e-mail'; end if;
  if char_length(coalesce(p_password, '')) < 8 then raise exception 'Hasło musi mieć co najmniej 8 znaków'; end if;
  if exists (select 1 from auth.users where lower(email) = em) then raise exception 'EMAIL: Ten e-mail ma już konto. Zaloguj się albo użyj innego adresu.'; end if;

  base := trim(both '-' from regexp_replace(translate(lower(sname), 'ąćęłńóśźż', 'acelnoszz'), '[^a-z0-9]+', '-', 'g'));
  base := left(coalesce(nullif(base, ''), 'salon'), 30); sl := base;
  while sl = 'lumen' or exists (select 1 from public.studios where slug = sl) loop n := n + 1; sl := base || '-' || n; end loop;

  for x in select * from jsonb_array_elements(case when jsonb_typeof(p_cats) = 'array' then p_cats else '[]' end) limit 12 loop
    k := left(regexp_replace(lower(coalesce(x->>'id', '')), '[^a-z0-9-]', '', 'g'), 30);
    if k <> '' and char_length(trim(coalesce(x->>'name', ''))) between 2 and 30 and not k = any(catids) then
      catids := catids || k; cats := cats || jsonb_build_array(jsonb_build_object('id', k, 'name', trim(x->>'name')));
    end if;
  end loop;
  if cardinality(catids) = 0 then catids := array['mycie', 'lakier']; cats := '[{"id":"mycie","name":"Mycie i wnętrze"},{"id":"lakier","name":"Lakier i ochrona"}]'; end if;
  -- usługi z kreatora: tylko znane pola; panel zamienia je na pełne usługi przy pierwszym wejściu właściciela
  for x in select * from jsonb_array_elements(case when jsonb_typeof(p_services) = 'array' then p_services else '[]' end) limit 30 loop
    svcs := svcs || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'tpl', nullif(left(regexp_replace(coalesce(x->>'tpl', ''), '[^a-z0-9-]', '', 'g'), 30), ''),
      'name', nullif(left(trim(coalesce(x->>'name', '')), 60), ''),
      'cat', case when x->>'cat' = any(catids) then x->>'cat' else catids[1] end,
      'price', least(100000, greatest(0, coalesce(floor((x->>'price')::numeric), 0)::int)),
      'unit', case when x->>'unit' = 'd' then 'd' else 'h' end,
      'dur', least(30, greatest(0.5, coalesce((x->>'dur')::numeric, 1))),
      'staff', (select jsonb_agg(left(trim(v), 60)) from (select v from jsonb_array_elements_text(case when jsonb_typeof(x->'staff') = 'array' then x->'staff' else '[]' end) v limit 10) z))));
  end loop;
  for x in select * from jsonb_array_elements(case when jsonb_typeof(p_bays) = 'array' then p_bays else '[]' end) limit 10 loop
    i := i + 1;
    bays := bays || jsonb_build_array(jsonb_build_object('id', i, 'name', coalesce(nullif(left(trim(x->>'name'), 40), ''), 'Stanowisko ' || i), 'desc', '',
      'cats', coalesce((select jsonb_agg(c) from jsonb_array_elements_text(case when jsonb_typeof(x->'cats') = 'array' then x->'cats' else '[]' end) c
        where c = any(catids)), to_jsonb(catids))));
  end loop;
  if i = 0 then bays := jsonb_build_array(jsonb_build_object('id', 1, 'name', 'Stanowisko 1', 'desc', '', 'cats', to_jsonb(catids))); end if;
  foreach k in array array['wyc','gw','wl','bon','loy','dzis','google','zes','tg'] loop
    feats := feats || jsonb_build_object('f_' || k, coalesce((p_features->>k)::boolean, true));
  end loop;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', em, crypt(p_password, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('name', own), now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', em, 'email_verified', true), 'email', now(), now(), now());

  insert into public.studios (slug, name, owner_id, catalog) values (sl, sname, uid, jsonb_build_object('settings',
    jsonb_build_object('salon', jsonb_build_object('name', sname, 'phone', left(trim(coalesce(p_salon->>'phone', '')), 30),
        'addr', left(trim(coalesce(p_salon->>'addr', '')), 80), 'city', left(trim(coalesce(p_salon->>'city', '')), 80),
        'hours', left(trim(coalesce(p_salon->>'hours', '')), 80), 'nip', left(regexp_replace(coalesce(p_salon->>'nip', ''), '\D', '', 'g'), 10)),
      'bays', bays, 'cats', cats, 'svc_init', case when jsonb_array_length(svcs) > 0 then svcs end, 'seed_v11', true, 'no_seed', not coalesce(p_sample, true), 'tour_new', true,
      'plan', case when p_plan in ('start', 'salon', 'studio') then p_plan else 'start' end,
      'loy_on', (feats->>'f_loy')::boolean, 'tg_on', (feats->>'f_tg')::boolean, 'wl_auto', (feats->>'f_wl')::boolean) || feats))
  returning id into sid;

  perform set_config('app.team_rpc', '1', true);
  insert into public.team (studio_id, user_id, email, name, role, color, commission) values (sid, uid, em, own, 'admin', '#ea580c', 0);
  i := 0;
  for x in select * from jsonb_array_elements(case when jsonb_typeof(p_team) = 'array' then p_team else '[]' end) limit 15 loop
    if char_length(trim(coalesce(x->>'name', ''))) >= 2 then
      i := i + 1;
      insert into public.team (studio_id, name, role, color, commission)
      values (sid, left(trim(x->>'name'), 60), case when x->>'role' = 'admin' then 'admin' else 'worker' end, pal[1 + (i - 1) % 6],
        least(50, greatest(0, coalesce(floor((x->>'commission')::numeric), 0)::int)));
    end if;
  end loop;
  if char_length(trim(coalesce(p_wish, ''))) >= 3 then insert into public.feature_wishes (studio_id, wish) values (sid, left(trim(p_wish), 1000)); end if;
  return sl;
end $$;
revoke all on function public.studio_register(text, text, text, jsonb, jsonb, jsonb, jsonb, text, boolean, text, jsonb, jsonb) from public;
grant execute on function public.studio_register(text, text, text, jsonb, jsonb, jsonb, jsonb, text, boolean, text, jsonb, jsonb) to anon, authenticated;
-- czy e-mail jest wolny: podpowiedź w 1. kroku kreatora, zanim ktoś wypełni resztę
create or replace function public.email_free(p_email text) returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from auth.users where lower(email) = lower(trim(p_email))) $$;
grant execute on function public.email_free(text) to anon, authenticated;

-- Salon demo przypisany do konta admina (katalog uzupełni panel przy pierwszym logowaniu).
insert into public.studios (slug, name, owner_id)
select 'lumen', 'Lumen Detailing', u.id from auth.users u where u.email = 'demo.panel@example.com'
on conflict (slug) do update set owner_id = excluded.owner_id;

select id, slug, owner_id is not null as ma_wlasciciela from public.studios;
