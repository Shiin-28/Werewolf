# Werewolf GM Companion 人狼

A phone-first web app for running face-to-face (or Discord) Werewolf. It handles secret roles, night
actions, voting and phase tracking. Built with Next.js, Supabase (Postgres, Realtime, Anonymous Auth)
and Tailwind.

## Setup

1. **Create a Supabase project** (free tier) at <https://supabase.com/dashboard>.
2. **Enable anonymous sign-ins:** Authentication → Sign In / Providers → **Allow anonymous sign-ins** → Save.
3. **Run the SQL:** SQL Editor → New query → paste each file from `supabase/migrations/`, in order
   (001 → 010), and click Run, one file per Run. Every file is safe to re-run. `006` must be its own Run
   because it adds new role names that `007` uses.
4. **Env vars:** copy `.env.local.example` to `.env.local` and fill in the values from
   Project Settings → API (or the **Connect** button):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   # or NEXT_PUBLIC_SUPABASE_ANON_KEY (older projects)
   ```
   You never need the service-role key. All game logic runs inside Postgres functions.
5. `npm install` then `npm run dev` → <http://localhost:3000>.

## Testing alone

- In `npm run dev`, **each browser tab is a separate player**: the identity is stored in
  `sessionStorage`. Open the join link in new tabs. Don't use "Duplicate tab", which copies the identity.
- To test on phones on the same Wi-Fi, run `npm run dev:lan` and open `http://<your-PC-IP>:3000`.
- Supabase allows 30 anonymous sign-ins per hour per IP by default. You can raise this under
  Authentication → Rate Limits.

## How it's secured

- Clients can only `SELECT`. Row Level Security decides what each device sees: your own role,
  fellow wolves (for wolves and the Madman), and your own night results.
- All writes go through `SECURITY DEFINER` Postgres functions, which check `auth.uid()`. Only
  the GM can change the phase.
- Realtime `postgres_changes` applies the same RLS, so secret rows are never pushed to devices
  that can't read them.
