
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS creator_side text,
  ADD COLUMN IF NOT EXISTS joiner_id uuid,
  ADD COLUMN IF NOT EXISTS joiner_side text;

CREATE INDEX IF NOT EXISTS idx_games_open_coinflip ON public.games(game_type, status, created_at DESC);
