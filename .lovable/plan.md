You asked for a lot — here's how I'll deliver it cleanly. I'll do everything below, but breaking it into clear phases so nothing regresses.

## Phase 1 — Game smoothness (bugs you flagged)

**Coinflip**
- Stop showing "previous games" and stale results — the active overlay will only appear *after I've actually joined or been joined*, and clears the moment a new lobby opens.
- New flow: Create lobby → status "waiting for opponent" → opponent joins → both see a 3.5s smooth coin animation → result reveal. No result is rendered before the animation finishes.
- Real coin: 3D rotateY with two faces (gold heads / silver tails), spins ~10 turns then eases into the final side. Slow, weighted ease-out (matches your video).
- Resolved-feed list will be removed (you didn't want previous games on screen).

**Jackpot wheel**
- Replace the flat SVG with a layered "double ring" wheel: outer beveled chrome ring + inner colored slices + center hub with avatar of current leader.
- Slice colors come from a vivid 12-color palette (cycled per player), each slice gets the player's avatar pinned at its midpoint.
- Spin uses `cubic-bezier(.15,.85,.2,1)` over 8s, ~14 full turns, lands precisely on winner's slice midpoint, then a 1.5s "winner" reveal with their username + payout.

## Phase 2 — Splash + chat events styling

- Splash image goes truly fullscreen (`object-cover`, `inset-0`) with a brief 1.6s hold and fade.
- Chat gets new pinned event cards at the top (matches your screenshot): RAIN (cyan), GIVEAWAY (purple), TOKEN DROP (amber). Each card shows: title, amount, USD value, countdown timer, "Joined/Entered" pill once you click. Driven by the existing `events` + `giveaways` tables plus a new `token_drops` table.

## Phase 3 — Chat XP + levels

- New `user_xp` columns on users (`xp`, `level`, `messages_count`).
- +1 XP per chat message (rate-limited, 1/3s), level curve `level = floor(sqrt(xp/50))`.
- Each chat message renders the level pill (e.g. `[37]`) before the username, colored by tier (gray → green → blue → purple → gold), exactly like your screenshot.

## Phase 4 — Rewards leaderboard

- Add a "Leaderboard" section on `/rewards` with three tabs: **Top Wagered (7d)**, **Top Wins (7d)**, **Top XP (all-time)**. Avatars + rank medals for top 3.

## Phase 5 — In-app NOWPayments deposit (no redirect)

- Switch from invoice flow to `/v1/payment` endpoint — returns `pay_address` + `pay_amount` for the chosen crypto.
- New deposit modal stays on-site: pick currency (BTC/ETH/LTC/USDT-TRC20/SOL), enter USD amount, server creates the payment and shows the deposit address + QR code + countdown + live status (polled every 6s).
- **Token rate fixed to 1 token = $0.06** (so `tokens = usd / 0.06`). Update the IPN handler to match.

## Phase 6 — Admin: Discord-style roles

- New tables: `roles` (name, color hex, icon name, position, perms jsonb) and `role_assignments` (user_id, role_id).
- Admin panel gains a "Roles" tab: create/edit/delete roles with color picker, lucide icon picker, drag-to-reorder, permission checkboxes (manage_users, manage_roles, manage_economy, ban_users, mute_chat, view_logs). Assign roles to users with a search box.
- Chat usernames get colored by their highest role (matches Discord behavior).

## Phase 7 — Vercel-deployable

- Add `vercel.json` + verify the TanStack Start Vite build outputs an SSR bundle Vercel can host (preset switch in `vite.config.ts` if needed). Document the env vars you'll need to paste into Vercel.

## Technical notes (for me / you can skim)

- DB migrations grouped into one batch: `roles`, `role_assignments`, `token_drops`, `event_entries`, plus columns `users.xp`, `users.level`, `users.messages_count`.
- All chat/event/role data exposed read-only via RLS to public; writes go through server functions with role-permission checks.
- Coinflip "waiting" state is just a UI state — no schema change needed; I'll add a realtime subscription on `games` for the lobby creator so they get the join event instantly instead of polling every 2s.
- Splash already has `sessionStorage` gate; I'll just fix the sizing.

## What I will NOT change

- Mines (you said it's fine).
- Auth, transactions ledger, fair-system internals — only additive.

Confirm and I'll execute Phase 1–7 in order in the same loop. If you want me to cut anything (e.g. skip Vercel config, skip leaderboard for now), say which.