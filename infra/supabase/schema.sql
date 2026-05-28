-- ============================================================
-- SLARY — Supabase Schema
-- Colle ce fichier dans : Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── Profiles ──────────────────────────────────────────────────
create table if not exists profiles (
  id           uuid primary key references auth.users on delete cascade,
  country      text not null default 'CA',
  region       text not null default 'QC',
  worker_type  text not null default 'employee',
  sector       text not null default 'transport',
  saved_rate   numeric,
  checklist    jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── Shifts ────────────────────────────────────────────────────
create table if not exists shifts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  ts            bigint not null,
  date          text not null,
  hours         numeric not null,
  rate          numeric not null,
  ot15          numeric not null default 0,
  ot20          numeric not null default 0,
  tips_amt      numeric not null default 0,
  bonus         numeric not null default 0,
  vacation      numeric not null default 0,
  tax_benefit   numeric not null default 0,
  base          numeric not null,
  ot_pay        numeric not null default 0,
  gross         numeric not null,
  fed           numeric not null,
  prov          numeric not null,
  pension       numeric not null,
  ei            numeric not null,
  self_employed numeric not null default 0,
  total_tax     numeric not null,
  net           numeric not null,
  country       text not null,
  region        text not null,
  created_at    timestamptz not null default now()
);

-- ── Entries (revenus & dépenses déclaration) ──────────────────
create table if not exists entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  ts          bigint not null,
  cat         text not null,
  amount      numeric not null,
  description text not null default '',
  created_at  timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────
create index if not exists shifts_user_ts  on shifts  (user_id, ts desc);
create index if not exists entries_user_ts on entries (user_id, ts desc);

-- ── Row Level Security ────────────────────────────────────────
alter table profiles enable row level security;
alter table shifts   enable row level security;
alter table entries  enable row level security;

-- Chaque utilisateur ne voit et ne modifie que ses propres données
create policy "own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own shifts" on shifts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own entries" on entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Auto-update updated_at sur profiles ──────────────────────
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function touch_updated_at();

-- ── Grants explicites (requis depuis mai 2026 sur nouveaux projets) ──
-- Donne accès à PostgREST / supabase-js via le rôle anon et authenticated
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.shifts   to authenticated;
grant select, insert, update, delete on public.entries  to authenticated;
