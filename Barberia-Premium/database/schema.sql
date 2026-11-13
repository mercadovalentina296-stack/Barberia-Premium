-- Esquema inicial de Barbería Premium.
-- Ejecutar en Supabase SQL Editor después de revisar las políticas de acceso.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  role text not null default 'client' check (role in ('client','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(10,2) not null default 0 check (price >= 0),
  duration_minutes integer not null default 30 check (duration_minutes > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  service_id uuid not null references public.services(id),
  appointment_date date not null,
  appointment_time time not null,
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled','completed')),
  notes text,
  created_at timestamptz not null default now()
);

-- Evita dos turnos activos en el mismo horario. Los cancelados liberan el horario.
create unique index if not exists appointments_no_double_booking
on public.appointments (appointment_date, appointment_time)
where status in ('pending', 'confirmed');

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text not null,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  discount_percent numeric(5,2) check (discount_percent between 0 and 100),
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.appointments enable row level security;
alter table public.reviews enable row level security;
alter table public.promotions enable row level security;

-- Políticas iniciales conservadoras. No se permite cambiar el rol desde el cliente;
-- la creación/actualización de perfiles y las acciones administrativas se implementarán
-- mediante operaciones controladas en el backend.
create policy "profiles_read_own" on public.profiles
for select to authenticated using (auth.uid() = id);

create policy "services_read_active" on public.services
for select to anon, authenticated using (active = true);

create policy "appointments_read_own" on public.appointments
for select to authenticated using (auth.uid() = customer_id);

create policy "appointments_insert_own" on public.appointments
for insert to authenticated with check (auth.uid() = customer_id);

create policy "appointments_update_own" on public.appointments
for update to authenticated using (auth.uid() = customer_id) with check (auth.uid() = customer_id);

create policy "reviews_read_approved" on public.reviews
for select to anon, authenticated using (approved = true);

create policy "reviews_insert_own" on public.reviews
for insert to authenticated with check (auth.uid() = customer_id);

create policy "promotions_read_active" on public.promotions
for select to anon, authenticated using (active = true);
