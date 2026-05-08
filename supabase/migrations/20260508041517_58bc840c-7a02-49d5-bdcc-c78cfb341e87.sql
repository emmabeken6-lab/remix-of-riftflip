
-- Daily reward claims
create table if not exists public.daily_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  claimed_on date not null,
  streak_day int not null,
  amount numeric not null default 2,
  created_at timestamptz not null default now(),
  unique (user_id, claimed_on)
);
alter table public.daily_claims enable row level security;
create policy "daily_claims read own" on public.daily_claims for select using (true);

-- Wager rewards (milestones already redeemed)
create table if not exists public.wager_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  milestone numeric not null, -- e.g. 50000, 100000
  amount numeric not null,    -- token reward granted
  created_at timestamptz not null default now(),
  unique (user_id, milestone)
);
alter table public.wager_rewards enable row level security;
create policy "wager_rewards read" on public.wager_rewards for select using (true);

-- Crypto deposits via NOWPayments
create table if not exists public.crypto_deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  payment_id text not null unique,         -- NOWPayments payment id
  pay_currency text,
  pay_amount numeric,
  price_amount numeric not null,           -- USD value
  tokens_credited numeric not null default 0,
  status text not null default 'waiting',  -- waiting | confirming | confirmed | finished | failed | expired
  invoice_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.crypto_deposits enable row level security;
create policy "crypto_deposits read own" on public.crypto_deposits for select using (true);

-- Add tx_reason values used by new flows (idempotent)
do $$
begin
  begin
    alter type tx_reason add value if not exists 'daily_reward';
  exception when others then null; end;
  begin
    alter type tx_reason add value if not exists 'wager_reward';
  exception when others then null; end;
end $$;
