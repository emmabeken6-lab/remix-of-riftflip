# Riftflip — Auth, Wallet, Cloud & Admin

## 1. Enable Lovable Cloud
Turn on Cloud so we have a real database, server functions, and secret storage. Everything below depends on it.

## 2. Roblox login via bio verification
A custom auth flow (Roblox doesn't offer OAuth):

**Step A — Username entry**
- User types Roblox username on `/signin`.
- Server function calls `https://users.roblox.com/v1/usernames/users` to resolve the `userId` and display name.
- Fetch avatar headshot from `https://thumbnails.roblox.com/v1/users/avatar-headshot`.
- Show profile preview (avatar, display name, username) and a "This is me" confirm button.

**Step B — Verification code**
- Generate a code like `RIFT-KLYT-MMY2` (random 4+4 chars), store it server-side in a `verification_challenges` table tied to the Roblox userId, expires in 10 min.
- User pastes it into their Roblox profile "About" section.
- They click "Verify". Server function fetches `https://users.roblox.com/v1/users/{userId}` and checks `description` contains the code.
- On success: create/find a `users` row keyed by `roblox_id`, mint a session, return to client. Code is invalidated.

**Session model**
- Since this isn't Supabase Auth, we issue our own signed session token (HMAC with a server secret) stored in an httpOnly cookie. A `requireAuth` server middleware validates it on every protected call.

**Why not Supabase Auth**: Roblox has no OAuth provider; bio verification is the standard pattern in the MM2 community.

## 3. Wallet (replaces Sign In tab)
- Bottom nav item "Sign In" → "Wallet" (icon: Wallet).
- `/wallet` route shows: token balance, deposit instructions (placeholder — real MM2 trading flow is out of scope for this pass), withdraw request form, and transaction history.
- Currency name: **tokens** (plain text, no emoji/icon).
- Logged-out users on `/wallet` see the Roblox login flow inline.

## 4. Gating
- **Chat**: messages list visible to everyone, but composer hidden / replaced with "Sign in to chat" CTA when logged out.
- **Games**: viewing game pages OK, but "Create Game" / "Place Bet" buttons require login → CTA prompts sign in.
- Server functions for `createGame`, `placeBet`, `sendMessage`, `withdraw` all check session + re-validate wallet balance server-side before any state change (high-security: never trust client balance).

## 5. Admin panel (`/admin`)
- Role check via `user_roles` table (separate table, `app_role` enum: `admin`, `user`) and `has_role()` security-definer function. RLS uses the function — never queries the table directly to avoid recursion.
- First admin: seeded by Roblox username via SQL after Cloud is enabled (you'll tell me which username).
- Pages:
  - **Users** — search, view balance, adjust tokens (with audit log), ban/unban.
  - **Giveaways** — create/edit/end giveaways, pick winners, view entries.
  - **Events** — create "Current Event" shown on home, schedule, end.
  - **Word Crumbles** — manage the word puzzle game (word list CRUD, active round, payout).
  - **Audit log** — every admin action recorded with admin id, action, target, timestamp.

## 6. Database schema (high level)
- `users` — id, roblox_id (unique), roblox_username, display_name, avatar_url, balance_tokens (numeric, default 0), banned bool, created_at
- `user_roles` — user_id, role (enum)
- `verification_challenges` — roblox_id, code, expires_at
- `sessions` — token_hash, user_id, expires_at
- `transactions` — user_id, delta, reason, ref_id, created_at (immutable, append-only)
- `games` — id, type (coinflip/jackpot/minefield), creator_id, wager, status, result, created_at
- `game_bets` — game_id, user_id, amount, side
- `chat_messages` — user_id, body, created_at
- `events` — title, description, starts_at, ends_at, active
- `giveaways` — title, prize_tokens, ends_at, status; `giveaway_entries` — giveaway_id, user_id
- `word_crumbles_rounds` / `word_crumbles_words` / `word_crumbles_entries`
- `admin_audit_log` — admin_id, action, payload jsonb, created_at

All tables RLS-on. Reads scoped per-table (e.g. users see only their own balance and transactions; chat is public read). Writes go through server functions only.

## 7. Technical notes
- Roblox API calls happen server-side (`createServerFn`) to avoid CORS and to validate.
- Session cookie: `riftflip_session`, httpOnly, Secure, SameSite=Lax, 30-day expiry, stored hashed in DB.
- Balance changes always via a single `applyTransaction(userId, delta, reason)` server helper that wraps a SQL transaction with row-level lock to prevent races.
- `placeBet` flow: lock user row → check balance ≥ wager → debit → insert bet → unlock. Wins credited similarly when game resolves.

## 8. Out of scope for this pass
- Real MM2 item deposits/withdrawals (requires Roblox bot infrastructure) — wallet shows balance + manual admin top-up only for now.
- Actual game logic improvements beyond what already exists.
- Email/SMS/2FA.

---

**Before I build, two quick questions:**

1. **First admin username** — what's your Roblox username so I can seed you as the first admin?
2. **Word Crumbles** — you mentioned it as something to manage in admin. Does it already have rules in mind (e.g. unscramble a word, payout on first correct answer), or should I design a simple version? It's not currently in the games list — should I also add it as a 4th game card?
