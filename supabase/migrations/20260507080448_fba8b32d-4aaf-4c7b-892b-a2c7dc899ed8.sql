
-- Login logs (for admin panel + alt detection)
create table if not exists public.login_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  roblox_username text,
  ip text,
  user_agent text,
  success boolean not null default true,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists login_logs_user_idx on public.login_logs(user_id);
create index if not exists login_logs_ip_idx on public.login_logs(ip);
alter table public.login_logs enable row level security;

-- session metadata for alt detection
alter table public.sessions add column if not exists ip text;
alter table public.sessions add column if not exists user_agent text;

-- provably-fair fields on games
alter table public.games add column if not exists server_seed text;
alter table public.games add column if not exists server_seed_hash text;
alter table public.games add column if not exists client_seed text;
alter table public.games add column if not exists nonce bigint;

-- Jackpot rounds (pooled bets, weighted random winner)
create table if not exists public.jackpot_rounds (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'open',
  ends_at timestamptz not null,
  server_seed text not null,
  server_seed_hash text not null,
  total_tokens numeric not null default 0,
  winner_id uuid,
  winning_ticket numeric,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.jackpot_entries (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.jackpot_rounds(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  amount numeric not null check (amount > 0),
  created_at timestamptz not null default now()
);
alter table public.jackpot_rounds enable row level security;
alter table public.jackpot_entries enable row level security;
create policy "jackpot_rounds public read" on public.jackpot_rounds for select using (true);
create policy "jackpot_entries public read" on public.jackpot_entries for select using (true);

-- Mines games (per-user active session)
create table if not exists public.mines_games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  wager numeric not null,
  mines_count int not null,
  mine_positions int[] not null,
  revealed int[] not null default '{}',
  server_seed text not null,
  server_seed_hash text not null,
  client_seed text,
  status text not null default 'active', -- active, cashed, busted
  payout numeric,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists mines_user_idx on public.mines_games(user_id, status);
alter table public.mines_games enable row level security;
