
-- Roles (Discord-style)
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#9ca3af',
  icon text not null default 'shield',
  position integer not null default 0,
  perms jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.roles enable row level security;
create policy "roles public read" on public.roles for select using (true);

create table if not exists public.role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role_id uuid not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, role_id)
);
alter table public.role_assignments enable row level security;
create policy "role_assignments public read" on public.role_assignments for select using (true);

-- Token drops (chat rain)
create table if not exists public.token_drops (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'rain', -- rain | drop
  created_by uuid,
  total_tokens numeric not null,
  per_claim numeric not null,
  max_claims integer not null,
  claims_count integer not null default 0,
  ends_at timestamptz not null,
  status text not null default 'active', -- active | finished | cancelled
  created_at timestamptz not null default now()
);
alter table public.token_drops enable row level security;
create policy "token_drops public read" on public.token_drops for select using (true);

create table if not exists public.event_claims (
  id uuid primary key default gen_random_uuid(),
  drop_id uuid not null references public.token_drops(id) on delete cascade,
  user_id uuid not null,
  amount numeric not null,
  created_at timestamptz not null default now(),
  unique(drop_id, user_id)
);
alter table public.event_claims enable row level security;
create policy "event_claims public read" on public.event_claims for select using (true);

-- XP / level on users
alter table public.users add column if not exists xp numeric not null default 0;
alter table public.users add column if not exists level integer not null default 0;
alter table public.users add column if not exists messages_count integer not null default 0;

-- Add tx_reason values used by new flows (idempotent)
do $$ begin
  alter type public.tx_reason add value if not exists 'token_drop';
exception when others then null; end $$;

-- Realtime
alter publication supabase_realtime add table public.token_drops;
alter publication supabase_realtime add table public.event_claims;
alter publication supabase_realtime add table public.role_assignments;
alter publication supabase_realtime add table public.roles;
