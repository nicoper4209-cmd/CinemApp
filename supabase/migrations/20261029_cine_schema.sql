-- =====================================================================
-- CINE · Migración completa (Supabase / PostgreSQL)
-- Parte de tu esquema actual: movies, showtimes, favorites, bookings, booking_seats.
-- Es re-ejecutable (idempotente) en la medida de lo posible.
-- Formato de butaca: 'FILA-SECCION-NUMERO'  ej: 'A-0-1', 'J-1-10', 'T-2-4'
-- =====================================================================
begin;

create extension if not exists btree_gist with schema extensions;

-- =====================================================================
-- 1. CONFIGURACIÓN EDITABLE (RNF-08)
-- =====================================================================
create table if not exists public.app_settings (
  key         text primary key,
  value       text not null,
  description text not null default '',
  updated_at  timestamptz not null default now()
);

insert into public.app_settings (key, value, description) values
  ('hold_minutes',                 '10', 'Minutos que se bloquea una butaca durante la compra'),
  ('presale_days',                 '7',  'Días previos al estreno con precio de preventa'),
  ('cancel_hours',                 '2',  'Horas antes de la función hasta las que se puede cancelar'),
  ('min_gap_minutes',              '30', 'Minutos mínimos entre funciones en una misma sala'),
  ('points_per_currency',          '1',  'Puntos por cada $1 (1 $ = 1 punto)'),
  ('top_window_days',              '30', 'Ventana en días para el Top 3 de películas'),
  ('validation_window_before_min', '60', 'Minutos antes del inicio desde los que se puede validar una entrada'),
  ('max_seats_per_purchase',       '10', 'Máximo de butacas por compra')
on conflict (key) do nothing;

create or replace function public.setting_int(p_key text, p_default integer)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce((select value::int from public.app_settings where key = p_key), p_default)
$$;

-- =====================================================================
-- 2. PERFILES Y ROLES (RF-17, RF-20)
-- =====================================================================
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text,
  full_name     text,
  birth_date    date,
  blood_type    text,
  eye_color     text,
  vacation_days integer,
  avatar_url    text,
  role          text not null default 'cliente',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint profiles_role_check check (role in ('cliente','empleado','admin')),
  constraint profiles_blood_type_check check (blood_type is null or blood_type in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  constraint profiles_vacation_days_check check (vacation_days is null or vacation_days between 0 and 365),
  constraint profiles_birth_date_check check (birth_date is null or birth_date >= date '1900-01-01')
);

-- Helpers de rol (security definer para evitar recursión de RLS)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('empleado','admin'))
$$;

create or replace function public.is_anonymous_user() returns boolean
language sql stable as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
$$;

-- Crear perfil automáticamente al registrarse (incluye anónimos y OAuth)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_meta  jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_birth date;
  v_vac   integer;
begin
  begin v_birth := nullif(v_meta ->> 'birth_date','')::date; exception when others then v_birth := null; end;
  begin v_vac   := nullif(v_meta ->> 'vacation_days','')::int; exception when others then v_vac := null; end;
  if v_vac is not null and (v_vac < 0 or v_vac > 365) then v_vac := null; end if;

  insert into public.profiles (id, email, full_name, birth_date, blood_type, eye_color, vacation_days, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(v_meta ->> 'full_name', v_meta ->> 'name'),
    v_birth,
    case when v_meta ->> 'blood_type' in ('A+','A-','B+','B-','AB+','AB-','O+','O-') then v_meta ->> 'blood_type' end,
    nullif(v_meta ->> 'eye_color',''),
    v_vac,
    coalesce(v_meta ->> 'avatar_url', v_meta ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Perfiles para usuarios ya existentes
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Un usuario no puede cambiarse el rol a sí mismo
create or replace function public.protect_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'No tenés permiso para cambiar el rol';
  end if;
  return new;
end $$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_profile_role();

-- Para crear tu primer admin (ejecutalo a mano con tu email):
-- update public.profiles set role = 'admin' where email = 'tu@email.com';

-- =====================================================================
-- 3. SALAS, FORMATOS Y PRECIOS (RF-04, RF-06, RNF-08)
-- =====================================================================
create table if not exists public.rooms (
  code       text primary key,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.rooms (code) values ('A'),('B'),('C'),('D') on conflict do nothing;
-- Incorpora cualquier sala que ya exista en showtimes
insert into public.rooms (code) select distinct room from public.showtimes on conflict do nothing;

create table if not exists public.formats (
  id               integer generated by default as identity primary key,
  name             text not null unique,
  price_multiplier numeric(4,2) not null default 1 check (price_multiplier > 0),
  active           boolean not null default true
);

insert into public.formats (name, price_multiplier) values ('2D',1.00),('3D',1.25),('4D',1.50)
on conflict (name) do nothing;

create table if not exists public.pricing_config (
  seat_type      text primary key check (seat_type in ('standard','accessible','vip')),
  base_price     numeric(10,2) not null check (base_price > 0),
  presale_price  numeric(10,2) not null check (presale_price > 0),
  updated_at     timestamptz not null default now()
);

insert into public.pricing_config (seat_type, base_price, presale_price) values
  ('standard',   8000, 6500),
  ('accessible', 8000, 6500),
  ('vip',       12000, 10000)
on conflict (seat_type) do nothing;

create or replace function public.seat_type_of(p_label text) returns text
language sql immutable as $$
  select case split_part(p_label, '-', 1)
           when 'J' then 'accessible' when 'K' then 'accessible'
           when 'R' then 'vip' when 'S' then 'vip' when 'T' then 'vip'
           else 'standard' end
$$;

create or replace function public.is_valid_seat_label(p text) returns boolean
language sql immutable as $$
  select p ~ '^[A-IL-T]-(0-[1-4]|1-(1[0-9]|20|[1-9])|2-[1-4])$'
      or p ~ '^[JK]-(0-[1-2]|1-(10|[1-9])|2-[1-2])$'
$$;

create or replace function public.ticket_price(p_seat_type text, p_presale boolean, p_mult numeric)
returns numeric language sql stable security definer set search_path = public as $$
  select round((case when p_presale then c.presale_price else c.base_price end) * coalesce(p_mult, 1), 2)
  from public.pricing_config c where c.seat_type = p_seat_type
$$;

-- =====================================================================
-- 4. PELÍCULAS (RF-01, RF-02, RF-10, RF-15)
-- =====================================================================
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='movies' and column_name='id'
               and is_identity='NO' and column_default is null) then
    execute 'alter table public.movies alter column id add generated by default as identity';
    perform setval(pg_get_serial_sequence('public.movies','id'),
                   greatest((select coalesce(max(id),0) from public.movies),1),
                   (select coalesce(max(id),0) from public.movies) > 0);
  end if;
end $$;

alter table public.movies add column if not exists release_date date;
alter table public.movies add column if not exists is_featured boolean not null default false;

update public.movies set release_date = make_date(year,1,1) where release_date is null;

-- Normaliza clasificaciones existentes (REVISÁ el resultado)
update public.movies
set age_rating = case when age_rating ~ '18' then '+18'
                      when age_rating ~ '1[2-6]' then '+13'
                      else 'ATP' end
where age_rating not in ('ATP','+13','+18');

alter table public.movies alter column age_rating set default 'ATP';
alter table public.movies drop constraint if exists movies_age_rating_check;
alter table public.movies add constraint movies_age_rating_check check (age_rating in ('ATP','+13','+18'));

create index if not exists movies_status_idx   on public.movies (status);
create index if not exists movies_genre_idx    on public.movies (genre);
create index if not exists movies_release_idx  on public.movies (release_date);

-- =====================================================================
-- 5. FUNCIONES (RF-06, RF-21, RN-01, RN-02)
-- =====================================================================
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='showtimes' and column_name='id'
               and is_identity='NO' and column_default is null) then
    execute 'alter table public.showtimes alter column id add generated by default as identity';
    perform setval(pg_get_serial_sequence('public.showtimes','id'),
                   greatest((select coalesce(max(id),0) from public.showtimes),1),
                   (select coalesce(max(id),0) from public.showtimes) > 0);
  end if;
end $$;

alter table public.showtimes add column if not exists starts_at     timestamptz;
alter table public.showtimes add column if not exists ends_at       timestamptz;
alter table public.showtimes add column if not exists blocked_until timestamptz; -- fin + 30 min de recambio
alter table public.showtimes add column if not exists format_id     integer references public.formats (id);

-- El precio ahora sale de pricing_config; la columna queda opcional/deprecada
alter table public.showtimes alter column price drop not null;
alter table public.showtimes drop constraint if exists showtimes_room_date_time_key;
alter table public.showtimes drop constraint if exists showtimes_room_fkey;
alter table public.showtimes add constraint showtimes_room_fkey
  foreign key (room) references public.rooms (code) on update cascade;

-- Asignación automática de sala
create or replace function public.assign_room(p_start timestamptz, p_until timestamptz, p_exclude integer default null)
returns text language plpgsql stable security definer set search_path = public as $$
declare v text;
begin
  select r.code into v
  from public.rooms r
  where r.active
    and not exists (
      select 1 from public.showtimes s
      where s.room = r.code
        and (p_exclude is null or s.id <> p_exclude)
        and tstzrange(s.starts_at, s.blocked_until) && tstzrange(p_start, p_until)
    )
  order by r.code limit 1;
  if v is null then
    raise exception 'No hay salas disponibles en ese horario';
  end if;
  return v;
end $$;

-- Calcula starts_at / ends_at / blocked_until y asigna sala si falta
create or replace function public.showtimes_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_dur integer;
begin
  select duration into v_dur from public.movies where id = new.movie_id;
  if v_dur is null then raise exception 'Película inexistente'; end if;

  new.starts_at     := (new.date + new."time") at time zone 'America/Argentina/Buenos_Aires';
  new.ends_at       := new.starts_at + make_interval(mins => v_dur);
  new.blocked_until := new.ends_at + make_interval(mins => public.setting_int('min_gap_minutes', 30));

  if new.format_id is null then
    select id into new.format_id from public.formats where name = '2D';
  end if;
  if new.room is null then
    new.room := public.assign_room(new.starts_at, new.blocked_until, new.id);
  end if;
  return new;
end $$;

drop trigger if exists showtimes_before_write on public.showtimes;
create trigger showtimes_before_write
  before insert or update of movie_id, room, date, "time" on public.showtimes
  for each row execute function public.showtimes_before_write();

-- Backfill de funciones existentes (si falla por solapamientos, corregí esos datos)
update public.showtimes set date = date;

alter table public.showtimes alter column starts_at     set not null;
alter table public.showtimes alter column ends_at       set not null;
alter table public.showtimes alter column blocked_until set not null;

alter table public.showtimes drop constraint if exists showtimes_no_overlap;
alter table public.showtimes add constraint showtimes_no_overlap
  exclude using gist (room with =, tstzrange(starts_at, blocked_until) with &&);

create index if not exists showtimes_starts_at_idx on public.showtimes (starts_at);

-- Programación recurrente (RF-21): ej. lunes, miércoles y jueves a las 15:00
-- p_weekdays usa ISO: 1=lunes ... 7=domingo
create or replace function public.schedule_showtimes(
  p_movie_id integer, p_from date, p_to date, p_weekdays integer[], p_time time,
  p_format_id integer default null)
returns jsonb language plpgsql set search_path = public as $$
declare
  d date; i integer;
  v_ok integer := 0; v_skip integer := 0; v_dates jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then raise exception 'Solo administradores'; end if;
  if p_to < p_from or (p_to - p_from) > 366 then raise exception 'Rango de fechas inválido'; end if;

  for i in 0 .. (p_to - p_from) loop
    d := p_from + i;
    if extract(isodow from d)::int = any (p_weekdays) then
      begin
        insert into public.showtimes (movie_id, date, "time", format_id)
        values (p_movie_id, d, p_time, p_format_id);
        v_ok := v_ok + 1;
      exception when raise_exception or exclusion_violation or unique_violation then
        v_skip := v_skip + 1;
        v_dates := v_dates || to_jsonb(d);
      end;
    end if;
  end loop;
  return jsonb_build_object('created', v_ok, 'skipped', v_skip, 'skipped_dates', v_dates);
end $$;

-- =====================================================================
-- 6. FAVORITOS, RESEÑAS, AVISOS DE ESTRENO (RF-13, RF-15)
-- =====================================================================
delete from public.favorites where movie_id not in (select id from public.movies);
alter table public.favorites drop constraint if exists favorites_movie_id_fkey;
alter table public.favorites add constraint favorites_movie_id_fkey
  foreign key (movie_id) references public.movies (id) on delete cascade;

create table if not exists public.reviews (
  id         bigint generated by default as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  movie_id   integer not null references public.movies (id) on delete cascade,
  stars      smallint not null check (stars between 1 and 5),
  comment    text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, movie_id)
);
create index if not exists reviews_movie_idx on public.reviews (movie_id);
drop trigger if exists reviews_touch on public.reviews;
create trigger reviews_touch before update on public.reviews
  for each row execute function public.touch_updated_at();

create table if not exists public.movie_alerts (
  user_id    uuid not null references auth.users (id) on delete cascade,
  movie_id   integer not null references public.movies (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, movie_id)
);

-- =====================================================================
-- 7. CUPONES, PUNTOS Y CRÉDITOS (RF-09, RF-11, RF-14, RF-28)
-- =====================================================================
create table if not exists public.coupons (
  id          bigint generated by default as identity primary key,
  code        text not null unique,
  type        text not null check (type in ('primera_compra','mayor_50','general')),
  percentage  numeric(5,2) not null check (percentage > 0 and percentage <= 100),
  min_age     integer,
  active      boolean not null default true,
  valid_from  timestamptz,
  valid_until timestamptz,
  description text not null default '',
  created_at  timestamptz not null default now()
);

insert into public.coupons (code, type, percentage, description) values
  ('PRIMERA',  'primera_compra', 20, 'Descuento en la primera compra de usuarios registrados'),
  ('MAYOR50',  'mayor_50',       10, 'Descuento para mayores de 50 años')
on conflict (code) do nothing;
update public.coupons set min_age = 50 where type = 'mayor_50' and min_age is null;

create table if not exists public.points_ledger (
  id         bigint generated by default as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  delta      integer not null,
  reason     text not null,
  booking_id uuid,
  note       text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists points_ledger_user_idx on public.points_ledger (user_id, created_at desc);

create table if not exists public.credit_ledger (
  id         bigint generated by default as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  delta      numeric(10,2) not null,
  reason     text not null,
  booking_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists credit_ledger_user_idx on public.credit_ledger (user_id, created_at desc);

create table if not exists public.rewards (
  id           integer generated by default as identity primary key,
  name         text not null,
  description  text not null default '',
  points_cost  integer not null check (points_cost > 0),
  reward_type  text not null default 'credit' check (reward_type in ('credit','candy','ticket','other')),
  reward_value numeric(10,2) not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists public.reward_redemptions (
  id           bigint generated by default as identity primary key,
  reward_id    integer not null references public.rewards (id),
  user_id      uuid not null references auth.users (id) on delete cascade,
  points_spent integer not null,
  status       text not null default 'pending' check (status in ('pending','completed')),
  code         text not null,
  created_at   timestamptz not null default now()
);

create or replace function public._points_balance(p_user uuid) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(delta), 0)::int from public.points_ledger where user_id = p_user
$$;

create or replace function public._credit_balance(p_user uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(delta), 0)::numeric from public.credit_ledger where user_id = p_user
$$;

create or replace function public.my_points_balance() returns integer
language sql stable security definer set search_path = public as $$
  select public._points_balance(auth.uid())
$$;

create or replace function public.my_credit_balance() returns numeric
language sql stable security definer set search_path = public as $$
  select public._credit_balance(auth.uid())
$$;

-- =====================================================================
-- 8. CANDY (RF-12, RF-16)
-- =====================================================================
create table if not exists public.candy_categories (
  id         integer generated by default as identity primary key,
  name       text not null unique,
  sort_order integer not null default 0,
  active     boolean not null default true
);

insert into public.candy_categories (name, sort_order) values ('Pochoclos',1),('Bebidas',2),('Combos',3)
on conflict (name) do nothing;

create table if not exists public.candy_products (
  id          integer generated by default as identity primary key,
  category_id integer not null references public.candy_categories (id),
  name        text not null,
  description text not null default '',
  price       numeric(10,2) not null check (price >= 0),
  image_url   text not null default '',
  is_combo    boolean not null default false,
  is_featured boolean not null default false,  -- ofertas y combos destacados
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- =====================================================================
-- 9. RESERVAS / ENTRADAS (RF-07, RF-26)
-- =====================================================================
-- bookings = orden general (entradas y/o candy)
alter table public.bookings add column if not exists subtotal          numeric(10,2) not null default 0;
alter table public.bookings add column if not exists discount          numeric(10,2) not null default 0;
alter table public.bookings add column if not exists coupon_id         bigint references public.coupons (id);
alter table public.bookings add column if not exists credit_used       numeric(10,2) not null default 0;
alter table public.bookings add column if not exists points_earned     integer not null default 0;
alter table public.bookings add column if not exists contact_email     text;
alter table public.bookings add column if not exists payment_method    text;
alter table public.bookings add column if not exists cancelled_at      timestamptz;
alter table public.bookings add column if not exists candy_qr          uuid;
alter table public.bookings add column if not exists candy_code        text;
alter table public.bookings add column if not exists candy_delivered_at timestamptz;
alter table public.bookings add column if not exists candy_delivered_by uuid references auth.users (id);

update public.bookings set subtotal = total where subtotal = 0 and total > 0;

-- Permite compras solo de candy (sin función)
alter table public.bookings alter column showtime_id drop not null;
alter table public.bookings alter column movie_id drop not null;

alter table public.bookings drop constraint if exists bookings_showtime_id_fkey;
alter table public.bookings add constraint bookings_showtime_id_fkey
  foreign key (showtime_id) references public.showtimes (id) not valid;
alter table public.bookings drop constraint if exists bookings_movie_id_fkey;
alter table public.bookings add constraint bookings_movie_id_fkey
  foreign key (movie_id) references public.movies (id) not valid;

create index if not exists bookings_showtime_idx on public.bookings (showtime_id);
create index if not exists bookings_created_idx  on public.bookings (created_at);
create unique index if not exists bookings_candy_qr_key   on public.bookings (candy_qr)   where candy_qr is not null;
create unique index if not exists bookings_candy_code_key on public.bookings (candy_code) where candy_code is not null;

-- booking_seats = entradas individuales (butaca + QR + validación)
alter table public.booking_seats add column if not exists seat_type    text          not null default 'standard';
alter table public.booking_seats add column if not exists price        numeric(10,2) not null default 0;
alter table public.booking_seats add column if not exists status       text          not null default 'active';
alter table public.booking_seats add column if not exists qr_code      uuid          not null default gen_random_uuid();
alter table public.booking_seats add column if not exists manual_code  text          not null default upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
alter table public.booking_seats add column if not exists used_at      timestamptz;
alter table public.booking_seats add column if not exists validated_by uuid references auth.users (id);

update public.booking_seats set seat_type = public.seat_type_of(seat_label);

alter table public.booking_seats drop constraint if exists booking_seats_status_check;
alter table public.booking_seats add constraint booking_seats_status_check check (status in ('active','cancelled'));
alter table public.booking_seats drop constraint if exists booking_seats_seat_type_check;
alter table public.booking_seats add constraint booking_seats_seat_type_check check (seat_type in ('standard','accessible','vip'));

alter table public.booking_seats drop constraint if exists booking_seats_showtime_id_fkey;
alter table public.booking_seats add constraint booking_seats_showtime_id_fkey
  foreign key (showtime_id) references public.showtimes (id) not valid;

-- Una butaca no puede estar activa dos veces; las canceladas quedan como historial (RNF-03)
alter table public.booking_seats drop constraint if exists unique_seat_per_showtime;
create unique index if not exists booking_seats_active_unique
  on public.booking_seats (showtime_id, seat_label) where status = 'active';
create unique index if not exists booking_seats_qr_key     on public.booking_seats (qr_code);
create unique index if not exists booking_seats_manual_key on public.booking_seats (manual_code);

create table if not exists public.booking_candy_items (
  id         bigint generated by default as identity primary key,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  product_id integer not null references public.candy_products (id),
  quantity   integer not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0)
);
create index if not exists booking_candy_items_booking_idx on public.booking_candy_items (booking_id);

create table if not exists public.coupon_redemptions (
  id              bigint generated by default as identity primary key,
  coupon_id       bigint not null references public.coupons (id),
  user_id         uuid not null references auth.users (id) on delete cascade,
  booking_id      uuid not null references public.bookings (id) on delete cascade,
  discount_amount numeric(10,2) not null,
  created_at      timestamptz not null default now()
);

-- =====================================================================
-- 10. BLOQUEO TEMPORAL Y TIEMPO REAL DE BUTACAS (RF-03, RNF-03, RNF-10)
-- =====================================================================
create table if not exists public.seat_holds (
  showtime_id integer not null references public.showtimes (id) on delete cascade,
  seat_label  text not null check (public.is_valid_seat_label(seat_label)),
  user_id     uuid not null references auth.users (id) on delete cascade,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now(),
  primary key (showtime_id, seat_label)
);
create index if not exists seat_holds_expires_idx on public.seat_holds (expires_at);

-- Estado público de butacas (sin datos de usuarios). Es la tabla que se suscribe en Realtime.
create table if not exists public.seat_occupancy (
  showtime_id integer not null references public.showtimes (id) on delete cascade,
  seat_label  text not null,
  state       text not null check (state in ('held','sold')),
  held_until  timestamptz,
  updated_at  timestamptz not null default now(),
  primary key (showtime_id, seat_label)
);

-- Rellena ocupación con ventas ya existentes
insert into public.seat_occupancy (showtime_id, seat_label, state)
select showtime_id, seat_label, 'sold' from public.booking_seats where status = 'active'
on conflict do nothing;

create or replace function public.sync_seat_occupancy_booking() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'active' then
      insert into public.seat_occupancy (showtime_id, seat_label, state, held_until)
      values (new.showtime_id, new.seat_label, 'sold', null)
      on conflict (showtime_id, seat_label)
      do update set state = 'sold', held_until = null, updated_at = now();
    end if;
  elsif tg_op = 'UPDATE' then
    if old.status = 'active' and new.status <> 'active' then
      delete from public.seat_occupancy
      where showtime_id = new.showtime_id and seat_label = new.seat_label and state = 'sold';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists booking_seats_sync_occupancy on public.booking_seats;
create trigger booking_seats_sync_occupancy
  after insert or update of status on public.booking_seats
  for each row execute function public.sync_seat_occupancy_booking();

create or replace function public.sync_seat_occupancy_hold() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    delete from public.seat_occupancy
    where showtime_id = old.showtime_id and seat_label = old.seat_label and state = 'held';
    return old;
  end if;
  insert into public.seat_occupancy (showtime_id, seat_label, state, held_until)
  values (new.showtime_id, new.seat_label, 'held', new.expires_at)
  on conflict (showtime_id, seat_label)
  do update set state = 'held', held_until = excluded.held_until, updated_at = now()
  where public.seat_occupancy.state <> 'sold';
  return new;
end $$;

drop trigger if exists seat_holds_sync_occupancy on public.seat_holds;
create trigger seat_holds_sync_occupancy
  after insert or update or delete on public.seat_holds
  for each row execute function public.sync_seat_occupancy_hold();

create or replace function public.cleanup_expired_holds() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from public.seat_holds where expires_at <= now();
  get diagnostics n = row_count;
  return n;
end $$;
-- Opcional (si activás pg_cron):
-- select cron.schedule('cleanup-seat-holds', '* * * * *', 'select public.cleanup_expired_holds()');

create or replace function public.hold_seats(p_showtime_id integer, p_seats text[])
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_exp timestamptz;
  v_n   integer := coalesce(cardinality(p_seats), 0);
  s     text;
  r     integer;
begin
  if v_uid is null then raise exception 'Sesión requerida'; end if;
  if not exists (select 1 from public.showtimes where id = p_showtime_id and starts_at > now()) then
    raise exception 'La función no existe o ya comenzó';
  end if;
  if v_n < 1 or v_n > public.setting_int('max_seats_per_purchase', 10) then
    raise exception 'Cantidad de butacas inválida';
  end if;

  delete from public.seat_holds where expires_at <= now();
  -- libera lo que este usuario tenía y ya no seleccionó
  delete from public.seat_holds
  where showtime_id = p_showtime_id and user_id = v_uid and not (seat_label = any (p_seats));

  v_exp := now() + make_interval(mins => public.setting_int('hold_minutes', 10));

  foreach s in array p_seats loop
    if not public.is_valid_seat_label(s) then raise exception 'Butaca inválida: %', s; end if;
    if exists (select 1 from public.booking_seats
               where showtime_id = p_showtime_id and seat_label = s and status = 'active') then
      raise exception 'La butaca % ya está ocupada', s;
    end if;
    insert into public.seat_holds (showtime_id, seat_label, user_id, expires_at)
    values (p_showtime_id, s, v_uid, v_exp)
    on conflict (showtime_id, seat_label)
    do update set expires_at = excluded.expires_at
    where public.seat_holds.user_id = excluded.user_id;
    get diagnostics r = row_count;
    if r = 0 then raise exception 'La butaca % está siendo comprada por otra persona', s; end if;
  end loop;
  return v_exp;
end $$;

create or replace function public.release_seats(p_showtime_id integer, p_seats text[] default null)
returns void language sql security definer set search_path = public as $$
  delete from public.seat_holds
  where showtime_id = p_showtime_id and user_id = auth.uid()
    and (p_seats is null or seat_label = any (p_seats))
$$;

-- =====================================================================
-- 11. NOTIFICACIONES Y PUSH (RF-22, RF-23, RF-24, RNF-19)
-- =====================================================================
create table if not exists public.push_subscriptions (
  id         bigint generated by default as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

-- Cola de notificaciones: una Edge Function (service_role) envía las pendientes cuyo send_at <= now()
create table if not exists public.notification_queue (
  id         bigint generated by default as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text not null default '',
  payload    jsonb not null default '{}'::jsonb,
  send_at    timestamptz not null default now(),
  sent_at    timestamptz,
  booking_id uuid references public.bookings (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists notification_queue_pending_idx on public.notification_queue (send_at) where sent_at is null;
create index if not exists notification_queue_user_idx    on public.notification_queue (user_id, created_at desc);

-- Alertas de estreno (admin)
create or replace function public.send_premiere_alerts(p_movie_id integer, p_title text, p_body text)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.is_admin() then raise exception 'Solo administradores'; end if;
  insert into public.notification_queue (user_id, type, title, body, payload)
  select a.user_id, 'premiere_alert', p_title, p_body, jsonb_build_object('movie_id', p_movie_id)
  from public.movie_alerts a where a.movie_id = p_movie_id;
  get diagnostics n = row_count;
  return n;
end $$;

-- =====================================================================
-- 12. AUDITORÍA INMUTABLE (RF-19, RNF-07)
-- =====================================================================
create table if not exists public.audit_log (
  id         bigint generated by default as identity primary key,
  actor_id   uuid,
  action     text not null,
  entity     text not null,
  entity_id  text,
  details    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

create or replace function public.audit_block_mutation() returns trigger
language plpgsql as $$
begin raise exception 'audit_log es de solo inserción'; end $$;

drop trigger if exists audit_log_no_update on public.audit_log;
create trigger audit_log_no_update before update or delete on public.audit_log
  for each row execute function public.audit_block_mutation();
drop trigger if exists audit_log_no_truncate on public.audit_log;
create trigger audit_log_no_truncate before truncate on public.audit_log
  for each statement execute function public.audit_block_mutation();

create or replace function public.audit_row_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_row jsonb;
begin
  if tg_op = 'DELETE' then v_row := to_jsonb(old); else v_row := to_jsonb(new); end if;
  if auth.uid() is not null and public.is_admin() then
    insert into public.audit_log (actor_id, action, entity, entity_id, details)
    values (
      auth.uid(), tg_op, tg_table_name,
      coalesce(v_row ->> 'id', v_row ->> 'code', v_row ->> 'key', v_row ->> 'seat_type'),
      jsonb_build_object(
        'old', case when tg_op <> 'INSERT' then to_jsonb(old) end,
        'new', case when tg_op <> 'DELETE' then to_jsonb(new) end)
    );
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array['movies','showtimes','rooms','formats','pricing_config','app_settings',
                           'coupons','rewards','candy_categories','candy_products'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format('create trigger %I after insert or update or delete on public.%I
                    for each row execute function public.audit_row_change()', t || '_audit', t);
  end loop;
end $$;

drop trigger if exists profiles_role_audit on public.profiles;
create trigger profiles_role_audit
  after update on public.profiles
  for each row when (old.role is distinct from new.role)
  execute function public.audit_row_change();

-- =====================================================================
-- 13. COMPRA ATÓMICA (RF-26, RNF-20)
-- =====================================================================
-- p_candy: [{"product_id": 1, "qty": 2}, ...]
-- Devuelve el id de la reserva. Cualquier error revierte TODO.
create or replace function public.purchase_tickets(
  p_showtime_id    integer,
  p_seats          text[]  default '{}',
  p_candy          jsonb   default '[]'::jsonb,
  p_coupon_code    text    default null,
  p_use_credit     numeric default 0,
  p_payment_method text    default 'mock',
  p_contact_email  text    default null,
  p_birth_date     date    default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid      uuid := auth.uid();
  v_anon     boolean := public.is_anonymous_user();
  v_profile  public.profiles%rowtype;
  v_birth    date;
  v_age      integer;
  v_today    date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_st       public.showtimes%rowtype;
  v_movie    public.movies%rowtype;
  v_mult     numeric := 1;
  v_presale  boolean := false;
  v_n        integer := coalesce(cardinality(p_seats), 0);
  v_has_candy boolean := false;
  v_tickets  numeric := 0;
  v_candy    numeric := 0;
  v_subtotal numeric;
  v_discount numeric := 0;
  v_coupon   public.coupons%rowtype;
  v_credit   numeric := 0;
  v_total    numeric;
  v_points   integer := 0;
  v_booking  uuid := gen_random_uuid();
  v_email    text;
  v_item     jsonb;
  v_prod     public.candy_products%rowtype;
  v_qty      integer;
  v_pid      integer;
begin
  if v_uid is null then raise exception 'Sesión requerida (puede ser anónima)'; end if;

  select * into v_profile from public.profiles where id = v_uid;

  -- Edad: perfil o autodeclaración (usuarios anónimos)
  v_birth := coalesce(v_profile.birth_date, p_birth_date);
  if p_birth_date is not null and (p_birth_date > v_today or p_birth_date < date '1900-01-01') then
    raise exception 'Fecha de nacimiento inválida';
  end if;
  if v_profile.birth_date is null and p_birth_date is not null then
    update public.profiles set birth_date = p_birth_date where id = v_uid;
  end if;
  if v_birth is not null then v_age := date_part('year', age(v_today, v_birth))::int; end if;

  -- Candy
  if p_candy is null or jsonb_typeof(p_candy) <> 'array' then raise exception 'Formato de candy inválido'; end if;
  v_has_candy := jsonb_array_length(p_candy) > 0;

  if p_showtime_id is null then
    if v_n > 0 then raise exception 'Hay butacas sin función'; end if;
    if not v_has_candy then raise exception 'No hay nada para comprar'; end if;
  else
    if v_n = 0 then raise exception 'Seleccioná al menos una butaca'; end if;

    select * into v_st from public.showtimes where id = p_showtime_id;
    if not found then raise exception 'Función inexistente'; end if;
    select * into v_movie from public.movies where id = v_st.movie_id;
    if v_movie.status = 'unavailable' then raise exception 'Película no disponible'; end if;
    if v_st.starts_at <= now() then raise exception 'La función ya comenzó'; end if;

    if v_n > public.setting_int('max_seats_per_purchase', 10) then raise exception 'Demasiadas butacas'; end if;
    if (select count(distinct s) from unnest(p_seats) s) <> v_n then raise exception 'Butacas repetidas'; end if;
    if exists (select 1 from unnest(p_seats) s where not public.is_valid_seat_label(s)) then
      raise exception 'Butaca inválida';
    end if;

    -- RN-03: restricción por edad
    if v_movie.age_rating = '+13' and (v_age is null or v_age < 13) then
      raise exception 'No podés comprar entradas para películas +13 (edad mínima 13 o sin fecha de nacimiento informada)';
    end if;
    if v_movie.age_rating = '+18' and (v_age is null or v_age < 18) then
      raise exception 'No podés comprar entradas para películas +18 (edad mínima 18 o sin fecha de nacimiento informada)';
    end if;

    -- Bloqueos vigentes del usuario sobre todas las butacas (RNF-03)
    if (select count(*) from public.seat_holds h
        where h.showtime_id = p_showtime_id and h.user_id = v_uid
          and h.expires_at > now() and h.seat_label = any (p_seats)) <> v_n then
      raise exception 'Tu reserva temporal de butacas expiró. Volvé a seleccionarlas';
    end if;
    if exists (select 1 from public.booking_seats
               where showtime_id = p_showtime_id and seat_label = any (p_seats) and status = 'active') then
      raise exception 'Alguna butaca ya fue vendida';
    end if;

    -- RF-25: contiguidad (misma fila, misma sección, números consecutivos)
    if v_n > 1 then
      if (select count(distinct split_part(s,'-',1) || '-' || split_part(s,'-',2)) from unnest(p_seats) s) <> 1 then
        raise exception 'Las butacas deben estar en la misma fila y sección';
      end if;
      if (select max(split_part(s,'-',3)::int) - min(split_part(s,'-',3)::int) from unnest(p_seats) s) <> v_n - 1 then
        raise exception 'Las butacas deben ser contiguas';
      end if;
    end if;

    -- Precio: tipo de butaca x preventa x formato
    select coalesce(price_multiplier, 1) into v_mult from public.formats where id = v_st.format_id;
    v_mult := coalesce(v_mult, 1);
    v_presale := v_movie.release_date is not null
                 and v_movie.release_date > v_today
                 and (v_movie.release_date - v_today) <= public.setting_int('presale_days', 7);

    select coalesce(sum(public.ticket_price(public.seat_type_of(s), v_presale, v_mult)), 0)
      into v_tickets from unnest(p_seats) s;
    if v_tickets <= 0 then raise exception 'Falta configurar los precios'; end if;
  end if;

  -- Precio de candy
  if v_has_candy then
    for v_item in select * from jsonb_array_elements(p_candy) loop
      v_pid := (v_item ->> 'product_id')::int;
      v_qty := coalesce((v_item ->> 'qty')::int, 0);
      if v_qty < 1 or v_qty > 50 then raise exception 'Cantidad de candy inválida'; end if;
      select * into v_prod from public.candy_products where id = v_pid and active;
      if not found then raise exception 'Producto de candy no disponible'; end if;
      v_candy := v_candy + v_prod.price * v_qty;
    end loop;
  end if;

  v_subtotal := v_tickets + v_candy;
  if v_subtotal <= 0 then raise exception 'El total debe ser mayor a cero'; end if;

  -- Cupón
  if p_coupon_code is not null and trim(p_coupon_code) <> '' then
    if v_anon then raise exception 'Los cupones requieren una cuenta registrada'; end if;
    select * into v_coupon from public.coupons c
    where upper(c.code) = upper(trim(p_coupon_code)) and c.active
      and (c.valid_from  is null or c.valid_from  <= now())
      and (c.valid_until is null or c.valid_until >= now());
    if not found then raise exception 'Cupón inválido o vencido'; end if;
    if v_coupon.type = 'primera_compra'
       and exists (select 1 from public.bookings where user_id = v_uid) then
      raise exception 'El cupón es válido solo para la primera compra';
    end if;
    if v_coupon.min_age is not null and (v_age is null or v_age < v_coupon.min_age) then
      raise exception 'No cumplís el requisito de edad del cupón';
    end if;
    v_discount := round(v_subtotal * v_coupon.percentage / 100, 2);
  end if;

  -- Crédito de cuenta (combinable con otros medios de pago)
  if p_use_credit is null or p_use_credit < 0 then raise exception 'Crédito inválido'; end if;
  if p_use_credit > 0 then
    if v_anon then raise exception 'El crédito requiere una cuenta registrada'; end if;
    if p_use_credit > public._credit_balance(v_uid) then raise exception 'Crédito insuficiente'; end if;
    v_credit := least(p_use_credit, v_subtotal - v_discount);
  end if;

  v_total := v_subtotal - v_discount - v_credit;

  -- Puntos: 1 $ = 1 punto sobre el monto con descuento (no para anónimos)
  if not v_anon then
    v_points := floor(v_subtotal - v_discount)::int * public.setting_int('points_per_currency', 1);
  end if;

  v_email := coalesce(nullif(trim(p_contact_email), ''), v_profile.email);
  if v_email is null then raise exception 'Ingresá un email de contacto'; end if;

  -- ----- Registro atómico -----
  insert into public.bookings (id, user_id, movie_id, showtime_id, subtotal, discount, coupon_id,
                               credit_used, total, points_earned, contact_email, payment_method,
                               status, candy_qr, candy_code)
  values (v_booking, v_uid, v_st.movie_id, p_showtime_id, v_subtotal, v_discount, v_coupon.id,
          v_credit, v_total, v_points, v_email, p_payment_method, 'confirmed',
          case when v_has_candy then gen_random_uuid() end,
          case when v_has_candy then upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)) end);

  if p_showtime_id is not null then
    insert into public.booking_seats (booking_id, showtime_id, seat_label, seat_type, price, status)
    select v_booking, p_showtime_id, s, public.seat_type_of(s),
           public.ticket_price(public.seat_type_of(s), v_presale, v_mult), 'active'
    from unnest(p_seats) s;

    delete from public.seat_holds
    where showtime_id = p_showtime_id and user_id = v_uid and seat_label = any (p_seats);

    -- Recordatorios 24 h y 2 h antes (RF-22)
    insert into public.notification_queue (user_id, type, title, body, payload, send_at, booking_id)
    select v_uid,
           'reminder_' || h::text || 'h',
           'Tu función empieza pronto',
           format('%s · Sala %s · %s', v_movie.title, v_st.room,
                  to_char(v_st.starts_at at time zone 'America/Argentina/Buenos_Aires', 'DD/MM HH24:MI')),
           jsonb_build_object(
             'booking_id', v_booking, 'movie', v_movie.title, 'room', v_st.room,
             'starts_at', v_st.starts_at,
             'seats', to_jsonb(p_seats),
             'qr_codes', (select jsonb_agg(qr_code) from public.booking_seats where booking_id = v_booking)),
           v_st.starts_at - make_interval(hours => h),
           v_booking
    from unnest(array[24, 2]) h
    where v_st.starts_at - make_interval(hours => h) > now();
  end if;

  if v_has_candy then
    for v_item in select * from jsonb_array_elements(p_candy) loop
      select * into v_prod from public.candy_products where id = (v_item ->> 'product_id')::int;
      insert into public.booking_candy_items (booking_id, product_id, quantity, unit_price)
      values (v_booking, v_prod.id, (v_item ->> 'qty')::int, v_prod.price);
    end loop;
  end if;

  if v_credit > 0 then
    insert into public.credit_ledger (user_id, delta, reason, booking_id)
    values (v_uid, -v_credit, 'purchase', v_booking);
  end if;
  if v_points > 0 then
    insert into public.points_ledger (user_id, delta, reason, booking_id)
    values (v_uid, v_points, 'purchase', v_booking);
  end if;
  if v_coupon.id is not null then
    insert into public.coupon_redemptions (coupon_id, user_id, booking_id, discount_amount)
    values (v_coupon.id, v_uid, v_booking, v_discount);
  end if;

  return v_booking;
end $$;

-- =====================================================================
-- 14. CANCELACIÓN CON CRÉDITO (RF-09, RN-06)
-- =====================================================================
create or replace function public.cancel_booking(p_booking_id uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  b        public.bookings%rowtype;
  st       public.showtimes%rowtype;
  v_hours  integer := public.setting_int('cancel_hours', 2);
  v_refund numeric;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Reserva inexistente'; end if;
  if b.user_id <> auth.uid() and not public.is_admin() then raise exception 'No autorizado'; end if;
  if b.status <> 'confirmed' then raise exception 'La reserva ya fue cancelada'; end if;

  if b.showtime_id is not null then
    select * into st from public.showtimes where id = b.showtime_id;
    if st.starts_at - make_interval(hours => v_hours) < now() then
      raise exception 'Solo se puede cancelar hasta % horas antes de la función', v_hours;
    end if;
  end if;
  if exists (select 1 from public.booking_seats where booking_id = b.id and used_at is not null) then
    raise exception 'Hay entradas ya utilizadas';
  end if;
  if b.candy_delivered_at is not null then raise exception 'El pedido de candy ya fue retirado'; end if;

  update public.bookings set status = 'cancelled', cancelled_at = now() where id = b.id;
  update public.booking_seats set status = 'cancelled' where booking_id = b.id;

  -- El importe se convierte en crédito (incluye el crédito que se había usado)
  v_refund := b.total + b.credit_used;
  if v_refund > 0 then
    insert into public.credit_ledger (user_id, delta, reason, booking_id)
    values (b.user_id, v_refund, 'cancellation', b.id);
  end if;
  if b.points_earned > 0 then
    insert into public.points_ledger (user_id, delta, reason, booking_id, note)
    values (b.user_id, -b.points_earned, 'cancellation', b.id, 'Reversión por cancelación');
  end if;

  delete from public.notification_queue where booking_id = b.id and sent_at is null;
  return v_refund;
end $$;

-- =====================================================================
-- 15. VALIDACIÓN DE ENTRADAS Y ENTREGA DE CANDY (RF-08, RF-23)
-- =====================================================================
create or replace function public.validate_ticket(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t  public.booking_seats%rowtype;
  b  public.bookings%rowtype;
  st public.showtimes%rowtype;
  m  public.movies%rowtype;
begin
  if not public.is_staff() then raise exception 'No autorizado'; end if;

  select * into t from public.booking_seats
  where manual_code = upper(trim(p_code)) or qr_code::text = lower(trim(p_code))
  for update;
  if not found then raise exception 'La entrada no existe'; end if;
  if t.status <> 'active' then raise exception 'La entrada fue cancelada'; end if;
  if t.used_at is not null then
    raise exception 'Entrada ya utilizada (%)',
      to_char(t.used_at at time zone 'America/Argentina/Buenos_Aires', 'DD/MM HH24:MI');
  end if;

  select * into b  from public.bookings  where id = t.booking_id;
  select * into st from public.showtimes where id = t.showtime_id;
  select * into m  from public.movies    where id = st.movie_id;
  if b.status <> 'confirmed' then raise exception 'La reserva no está vigente'; end if;
  if now() < st.starts_at - make_interval(mins => public.setting_int('validation_window_before_min', 60)) then
    raise exception 'Todavía no es horario de ingreso para esta función';
  end if;
  if now() > st.ends_at then raise exception 'La función ya finalizó'; end if;

  update public.booking_seats set used_at = now(), validated_by = auth.uid() where id = t.id;

  insert into public.notification_queue (user_id, type, title, body, payload)
  values (b.user_id, 'ticket_validated', 'Entrada validada',
          format('Tu entrada para %s (butaca %s) fue validada', m.title, t.seat_label),
          jsonb_build_object('booking_id', b.id, 'seat', t.seat_label));

  return jsonb_build_object(
    'ok', true, 'movie', m.title, 'room', st.room, 'starts_at', st.starts_at,
    'seat', t.seat_label, 'seat_type', t.seat_type, 'age_rating', m.age_rating,
    'minor_notice', m.age_rating in ('+13','+18'));
end $$;

create or replace function public.deliver_candy(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b public.bookings%rowtype;
begin
  if not public.is_staff() then raise exception 'No autorizado'; end if;
  select * into b from public.bookings
  where candy_code = upper(trim(p_code)) or candy_qr::text = lower(trim(p_code))
  for update;
  if not found then raise exception 'Pedido inexistente'; end if;
  if b.status <> 'confirmed' then raise exception 'El pedido fue cancelado'; end if;
  if b.candy_delivered_at is not null then raise exception 'El pedido ya fue entregado'; end if;

  update public.bookings set candy_delivered_at = now(), candy_delivered_by = auth.uid() where id = b.id;

  return jsonb_build_object('ok', true, 'items', (
    select coalesce(jsonb_agg(jsonb_build_object('name', p.name, 'qty', i.quantity)), '[]'::jsonb)
    from public.booking_candy_items i join public.candy_products p on p.id = i.product_id
    where i.booking_id = b.id));
end $$;

-- =====================================================================
-- 16. CUPONES ELEGIBLES Y CANJE DE PUNTOS
-- =====================================================================
create or replace function public.eligible_coupons()
returns table (id bigint, code text, type text, percentage numeric, description text)
language sql stable security definer set search_path = public as $$
  with me as (
    select p.id,
           case when p.birth_date is null then null
                else date_part('year', age(current_date, p.birth_date))::int end as age
    from public.profiles p where p.id = auth.uid()
  )
  select c.id, c.code, c.type, c.percentage, c.description
  from public.coupons c, me
  where not public.is_anonymous_user()
    and c.active
    and (c.valid_from  is null or c.valid_from  <= now())
    and (c.valid_until is null or c.valid_until >= now())
    and (c.min_age is null or (me.age is not null and me.age >= c.min_age))
    and (c.type <> 'primera_compra' or not exists (select 1 from public.bookings b where b.user_id = me.id))
$$;

create or replace function public.redeem_reward(p_reward_id integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  r     public.rewards%rowtype;
  v_code text := upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
begin
  if v_uid is null or public.is_anonymous_user() then raise exception 'Requiere cuenta registrada'; end if;
  select * into r from public.rewards where id = p_reward_id and active;
  if not found then raise exception 'Premio no disponible'; end if;
  if public._points_balance(v_uid) < r.points_cost then raise exception 'Puntos insuficientes'; end if;

  insert into public.reward_redemptions (reward_id, user_id, points_spent, status, code)
  values (r.id, v_uid, r.points_cost, case when r.reward_type = 'credit' then 'completed' else 'pending' end, v_code);

  insert into public.points_ledger (user_id, delta, reason, note)
  values (v_uid, -r.points_cost, 'reward_redemption', 'Canje: ' || r.name);

  if r.reward_type = 'credit' and r.reward_value > 0 then
    insert into public.credit_ledger (user_id, delta, reason)
    values (v_uid, r.reward_value, 'reward');
  end if;
  return jsonb_build_object('ok', true, 'reward', r.name, 'code', v_code);
end $$;

-- =====================================================================
-- 17. VISTAS Y REPORTES (RF-13, RF-15, RF-18)
-- =====================================================================
create or replace view public.movie_ratings as
select movie_id, round(avg(stars)::numeric, 1) as avg_stars, count(*) as review_count
from public.reviews group by movie_id;

create or replace view public.movie_reviews as
select r.id, r.movie_id, r.stars, r.comment, r.created_at,
       coalesce(nullif(split_part(coalesce(p.full_name, ''), ' ', 1), ''), 'Usuario') as author,
       (r.user_id = auth.uid()) as is_mine
from public.reviews r left join public.profiles p on p.id = r.user_id;

create or replace view public.top_movies_30d as
select m.id as movie_id, m.title, m.poster, count(bs.id) as tickets_sold
from public.booking_seats bs
join public.bookings b on b.id = bs.booking_id and b.status = 'confirmed'
join public.showtimes s on s.id = bs.showtime_id
join public.movies m on m.id = s.movie_id
where bs.status = 'active'
  and b.created_at >= now() - make_interval(days => public.setting_int('top_window_days', 30))
group by m.id, m.title, m.poster
order by tickets_sold desc, m.title
limit 3;

create or replace function public.daily_billing_report(p_date date default null)
returns table (report_date date, bookings_count bigint, tickets_count bigint,
               tickets_amount numeric, candy_amount numeric, discounts numeric,
               credit_used numeric, cash_total numeric)
language sql stable security definer set search_path = public as $$
  with p as (
    select coalesce(p_date, (now() at time zone 'America/Argentina/Buenos_Aires')::date) as d
  ), bk as (
    select b.* from public.bookings b, p
    where b.status = 'confirmed'
      and (b.created_at at time zone 'America/Argentina/Buenos_Aires')::date = p.d
  )
  select (select d from p),
         (select count(*) from bk),
         (select count(*) from public.booking_seats bs where bs.booking_id in (select id from bk) and bs.status = 'active'),
         coalesce((select sum(bs.price) from public.booking_seats bs where bs.booking_id in (select id from bk) and bs.status = 'active'), 0),
         coalesce((select sum(i.quantity * i.unit_price) from public.booking_candy_items i where i.booking_id in (select id from bk)), 0),
         coalesce((select sum(discount) from bk), 0),
         coalesce((select sum(credit_used) from bk), 0),
         coalesce((select sum(total) from bk), 0)
  where public.is_admin()
$$;

create or replace function public.movie_sales_report(p_from date, p_to date, p_movie_ids integer[] default null)
returns table (sale_date date, movie_id integer, title text, tickets bigint, revenue numeric)
language sql stable security definer set search_path = public as $$
  select (b.created_at at time zone 'America/Argentina/Buenos_Aires')::date,
         m.id, m.title, count(bs.id), coalesce(sum(bs.price), 0)
  from public.booking_seats bs
  join public.bookings b on b.id = bs.booking_id and b.status = 'confirmed'
  join public.showtimes s on s.id = bs.showtime_id
  join public.movies m on m.id = s.movie_id
  where bs.status = 'active'
    and (b.created_at at time zone 'America/Argentina/Buenos_Aires')::date between p_from and p_to
    and (p_movie_ids is null or m.id = any (p_movie_ids))
    and public.is_admin()
  group by 1, m.id, m.title
  order by 1, m.title
$$;

-- =====================================================================
-- 18. ROW LEVEL SECURITY (RNF-04, RNF-05, RNF-12)
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'app_settings','profiles','rooms','formats','pricing_config','movies','showtimes','favorites',
    'reviews','movie_alerts','coupons','points_ledger','credit_ledger','rewards','reward_redemptions',
    'candy_categories','candy_products','bookings','booking_seats','booking_candy_items',
    'coupon_redemptions','seat_holds','seat_occupancy','push_subscriptions','notification_queue','audit_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Catálogo / configuración pública: lectura abierta, escritura admin
do $$
declare t text;
begin
  foreach t in array array['app_settings','rooms','formats','pricing_config','movies','showtimes','candy_categories'] loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('create policy %I on public.%I for select using (true)', t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin', t);
    execute format('create policy %I on public.%I for all using (public.is_admin()) with check (public.is_admin())', t || '_admin', t);
  end loop;
end $$;

drop policy if exists candy_products_read on public.candy_products;
create policy candy_products_read on public.candy_products for select using (active or public.is_admin());
drop policy if exists candy_products_admin on public.candy_products;
create policy candy_products_admin on public.candy_products for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists rewards_read on public.rewards;
create policy rewards_read on public.rewards for select using (active or public.is_admin());
drop policy if exists rewards_admin on public.rewards;
create policy rewards_admin on public.rewards for all using (public.is_admin()) with check (public.is_admin());

-- Cupones: solo admin (los usuarios los consultan con eligible_coupons())
drop policy if exists coupons_admin on public.coupons;
create policy coupons_admin on public.coupons for all using (public.is_admin()) with check (public.is_admin());

-- Perfiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

-- Favoritos y avisos: solo usuarios registrados, solo los propios
drop policy if exists favorites_own on public.favorites;
create policy favorites_own on public.favorites for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and not public.is_anonymous_user());

drop policy if exists movie_alerts_own on public.movie_alerts;
create policy movie_alerts_own on public.movie_alerts for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and not public.is_anonymous_user());

-- Reseñas: lectura pública, escritura solo registrados sobre lo propio
drop policy if exists reviews_read on public.reviews;
create policy reviews_read on public.reviews for select using (true);
drop policy if exists reviews_insert on public.reviews;
create policy reviews_insert on public.reviews for insert
  with check (user_id = auth.uid() and not public.is_anonymous_user());
drop policy if exists reviews_update on public.reviews;
create policy reviews_update on public.reviews for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists reviews_delete on public.reviews;
create policy reviews_delete on public.reviews for delete
  using (user_id = auth.uid() or public.is_admin());

-- Puntos, créditos, canjes: solo lectura de lo propio (escritura únicamente vía RPC)
drop policy if exists points_ledger_read on public.points_ledger;
create policy points_ledger_read on public.points_ledger for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists credit_ledger_read on public.credit_ledger;
create policy credit_ledger_read on public.credit_ledger for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists reward_redemptions_read on public.reward_redemptions;
create policy reward_redemptions_read on public.reward_redemptions for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists coupon_redemptions_read on public.coupon_redemptions;
create policy coupon_redemptions_read on public.coupon_redemptions for select using (user_id = auth.uid() or public.is_admin());

-- Reservas y entradas: lectura propia (o admin); escritura solo vía RPC
drop policy if exists bookings_read on public.bookings;
create policy bookings_read on public.bookings for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists booking_seats_read on public.booking_seats;
create policy booking_seats_read on public.booking_seats for select using (
  exists (select 1 from public.bookings b
          where b.id = booking_seats.booking_id and (b.user_id = auth.uid() or public.is_admin())));

drop policy if exists booking_candy_items_read on public.booking_candy_items;
create policy booking_candy_items_read on public.booking_candy_items for select using (
  exists (select 1 from public.bookings b
          where b.id = booking_candy_items.booking_id and (b.user_id = auth.uid() or public.is_admin())));

-- Butacas: ocupación pública (Realtime), bloqueos solo propios
drop policy if exists seat_occupancy_read on public.seat_occupancy;
create policy seat_occupancy_read on public.seat_occupancy for select using (true);
drop policy if exists seat_holds_read on public.seat_holds;
create policy seat_holds_read on public.seat_holds for select using (user_id = auth.uid());

-- Push y notificaciones
drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists notification_queue_read on public.notification_queue;
create policy notification_queue_read on public.notification_queue for select
  using (user_id = auth.uid() or public.is_admin());

-- Auditoría: solo lectura para admin (sin UPDATE/DELETE para nadie)
drop policy if exists audit_log_read on public.audit_log;
create policy audit_log_read on public.audit_log for select using (public.is_admin());
revoke insert, update, delete, truncate on public.audit_log from anon, authenticated;

-- Funciones internas: no expuestas como RPC
revoke execute on function public.handle_new_user()                          from public, anon, authenticated;
revoke execute on function public.touch_updated_at()                         from public, anon, authenticated;
revoke execute on function public.protect_profile_role()                     from public, anon, authenticated;
revoke execute on function public.showtimes_before_write()                   from public, anon, authenticated;
revoke execute on function public.assign_room(timestamptz, timestamptz, integer) from public, anon, authenticated;
revoke execute on function public.sync_seat_occupancy_booking()              from public, anon, authenticated;
revoke execute on function public.sync_seat_occupancy_hold()                 from public, anon, authenticated;
revoke execute on function public.cleanup_expired_holds()                    from public, anon, authenticated;
revoke execute on function public.audit_block_mutation()                     from public, anon, authenticated;
revoke execute on function public.audit_row_change()                         from public, anon, authenticated;
revoke execute on function public._points_balance(uuid)                      from public, anon, authenticated;
revoke execute on function public._credit_balance(uuid)                      from public, anon, authenticated;

-- =====================================================================
-- 19. REALTIME
-- =====================================================================
do $$ begin
  alter publication supabase_realtime add table public.seat_occupancy;
exception when duplicate_object then null; when undefined_object then null;
end $$;

-- =====================================================================
-- 20. STORAGE (RNF-11)
-- =====================================================================
insert into storage.buckets (id, name, public) values
  ('posters','posters',true), ('avatars','avatars',true), ('candy','candy',true)
on conflict (id) do nothing;

drop policy if exists "cine_public_read" on storage.objects;
create policy "cine_public_read" on storage.objects for select
  using (bucket_id in ('posters','avatars','candy'));

drop policy if exists "cine_admin_write" on storage.objects;
create policy "cine_admin_write" on storage.objects for all
  using (bucket_id in ('posters','candy') and public.is_admin())
  with check (bucket_id in ('posters','candy') and public.is_admin());

drop policy if exists "cine_avatar_insert" on storage.objects;
create policy "cine_avatar_insert" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "cine_avatar_update" on storage.objects;
create policy "cine_avatar_update" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "cine_avatar_delete" on storage.objects;
create policy "cine_avatar_delete" on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

commit;

-- =====================================================================
-- CHECKLIST POST-MIGRACIÓN
-- 1) Auth > Providers: habilitar Email, Google, GitHub y "Anonymous sign-ins".
-- 2) Promover tu usuario: update public.profiles set role='admin' where email='tu@email.com';
-- 3) Revisar movies.age_rating normalizado y cargar release_date reales.
-- 4) Ajustar precios (pricing_config), salas (rooms) y multiplicadores (formats).
-- 5) Edge Function + cron que envíe notification_queue (send_at <= now(), sent_at is null)
--    por Web Push usando push_subscriptions, y marque sent_at.
-- 6) Opcional: pg_cron para public.cleanup_expired_holds().
--
-- RPCs para el frontend (supabase.rpc):
--   hold_seats, release_seats, purchase_tickets, cancel_booking, validate_ticket,
--   deliver_candy, eligible_coupons, redeem_reward, my_points_balance, my_credit_balance,
--   schedule_showtimes, send_premiere_alerts, daily_billing_report, movie_sales_report
-- Vistas: movie_ratings, movie_reviews, top_movies_30d
-- Realtime: suscribirse a public.seat_occupancy filtrando por showtime_id
-- =====================================================================
