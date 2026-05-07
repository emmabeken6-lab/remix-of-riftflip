
-- Enums
create type public.app_role as enum ('admin', 'user');
create type public.tx_reason as enum ('admin_grant','admin_deduct','bet_placed','bet_won','bet_refund','giveaway_win','word_crumble_win','deposit','withdraw');
create type public.game_status as enum ('open','resolved','cancelled');
create type public.giveaway_status as enum ('active','ended','cancelled');

-- Users (Roblox-linked)
create table public.users (
  id uuid primary key default gen_random_uuid(),
  roblox_id bigint unique not null,
  roblox_username text not null,
  display_name text not null,
  avatar_url text,
  balance_tokens numeric(20,2) not null default 0 check (balance_tokens >= 0),
  banned boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index on public.users (lower(roblox_username));

-- Roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- Verification challenges
create table public.verification_challenges (
  id uuid primary key default gen_random_uuid(),
  roblox_id bigint not null,
  roblox_username text not null,
  code text not null,
  expires_at timestamptz not null,
  consumed boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.verification_challenges (roblox_id);

-- Sessions (token stored hashed)
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text unique not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index on public.sessions (user_id);

-- Transactions (immutable ledger)
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  delta numeric(20,2) not null,
  reason public.tx_reason not null,
  ref_id uuid,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index on public.transactions (user_id, created_at desc);

-- Games
create table public.games (
  id uuid primary key default gen_random_uuid(),
  game_type text not null check (game_type in ('coinflip','jackpot','minefield')),
  creator_id uuid not null references public.users(id) on delete cascade,
  wager numeric(20,2) not null check (wager > 0),
  status public.game_status not null default 'open',
  result jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.game_bets (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  amount numeric(20,2) not null check (amount > 0),
  side text,
  created_at timestamptz not null default now()
);

-- Chat
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  kind text not null default 'user' check (kind in ('user','system','word_crumble')),
  body text not null check (length(body) between 1 and 500),
  meta jsonb,
  created_at timestamptz not null default now()
);
create index on public.chat_messages (created_at desc);

-- Events (admin-managed home page event)
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

-- Giveaways
create table public.giveaways (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  prize_tokens numeric(20,2) not null check (prize_tokens > 0),
  status public.giveaway_status not null default 'active',
  ends_at timestamptz not null,
  winner_id uuid references public.users(id),
  created_at timestamptz not null default now()
);
create table public.giveaway_entries (
  id uuid primary key default gen_random_uuid(),
  giveaway_id uuid not null references public.giveaways(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (giveaway_id, user_id)
);

-- Word Crumbles (chat events)
create table public.word_crumbles (
  id uuid primary key default gen_random_uuid(),
  scrambled text not null,
  answer text not null,
  prize_tokens numeric(20,2) not null check (prize_tokens > 0),
  status text not null default 'active' check (status in ('active','won','cancelled')),
  winner_id uuid references public.users(id),
  created_by uuid references public.users(id),
  chat_message_id uuid references public.chat_messages(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- Admin audit log
create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.users(id),
  action text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

-- Enable RLS on every table; deny-all by default since all access is via server (service role bypasses).
alter table public.users enable row level security;
alter table public.user_roles enable row level security;
alter table public.verification_challenges enable row level security;
alter table public.sessions enable row level security;
alter table public.transactions enable row level security;
alter table public.games enable row level security;
alter table public.game_bets enable row level security;
alter table public.chat_messages enable row level security;
alter table public.events enable row level security;
alter table public.giveaways enable row level security;
alter table public.giveaway_entries enable row level security;
alter table public.word_crumbles enable row level security;
alter table public.admin_audit_log enable row level security;

-- Realtime: chat + games
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.games;

-- Atomic balance helper (server-only via service role)
create or replace function public.apply_transaction(
  _user_id uuid,
  _delta numeric,
  _reason public.tx_reason,
  _ref_id uuid default null,
  _meta jsonb default null
) returns numeric language plpgsql security definer set search_path = public as $$
declare
  _new_balance numeric;
begin
  update public.users
    set balance_tokens = balance_tokens + _delta
    where id = _user_id and (balance_tokens + _delta) >= 0
    returning balance_tokens into _new_balance;
  if _new_balance is null then
    raise exception 'INSUFFICIENT_FUNDS' using errcode = 'P0001';
  end if;
  insert into public.transactions(user_id, delta, reason, ref_id, meta)
    values (_user_id, _delta, _reason, _ref_id, _meta);
  return _new_balance;
end;
$$;

revoke all on function public.apply_transaction from public, anon, authenticated;
