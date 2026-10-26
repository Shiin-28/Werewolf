# Werewolf GM Companion 人狼

A web app for running Werewolf (人狼ゲーム) with friends, in the same room or over a voice call such as
Discord. One person is the **Game Master (GM)**. Everyone else joins from their own device: a phone,
tablet or computer, any modern browser will do. The app handles the work a GM usually does on paper:
dealing secret roles, waking each role at night, collecting night actions, running the vote and checking
for a winner.

Built with Next.js, Supabase (Postgres, Realtime, Anonymous Auth) and Tailwind. Labels are shown in
English and Japanese.

---

## Contents

- [How to play](#how-to-play)
- [Roles](#roles)
- [Game flow in detail](#game-flow-in-detail)
- [Win conditions](#win-conditions)
- [GM tools](#gm-tools)
- [Setup](#setup)
- [Deploying](#deploying)
- [Testing alone](#testing-alone)
- [Project structure](#project-structure)
- [How it's secured](#how-its-secured)

---

## How to play

1. **The GM creates a game.** Open the app, enter a nickname and choose **Create game**. You get a
   6-letter game code.
2. **Players join.** Share the link, the QR code or the code itself. Each player opens it, picks a
   nickname and takes a seat.
3. **The GM sets up the table:** player count, roles, whether roles are revealed on death, and an
   optional discussion timer.
4. **Start.** Roles are dealt at random. Each player privately checks their role card. The GM can see
   who has looked.
5. **Play the rounds.** Night → Morning → Discussion → Vote → Result, repeated until one team wins.
   The GM moves the game from phase to phase. Players act on their own screens when it's their turn.
6. **Game over.** All roles are revealed. The GM can deal again with the same players or go back to
   the lobby.

The GM is the narrator and doesn't play a role. The GM's screen shows everything: every role, every
night action and a game log. Each player only sees what their own role allows.

---

## Roles

| Role | 日本語 | Team | Max | Ability |
|---|---|---|---|---|
| **Villager** | 村人 | Village | – | No night power. Discuss, find the wolves, vote them out. |
| **Fortune Teller** | 占い師 | Village | 1 | Each night, picks another living player and learns if they are **WHITE** (not a werewolf) or **BLACK** (werewolf). |
| **Shaman** | 霊媒師 | Village | 1 | Each night, automatically learns whether the **most recent person to die** (by vote or by attack) was WHITE or BLACK. |
| **Knight** | 騎士 | Village | 1 | Each night, protects one living player, themselves included. If the wolves attack that player, nobody dies. |
| **Werewolf** | 人狼 | Werewolves | – | The wolves know each other. Each night they agree on one victim and have a private pack chat. At least 1 is required. |
| **Madman** | 狂人 | Werewolves | – | A human on the wolves' side. Knows who the wolves are, but they don't know him. Shows as **WHITE** to the Fortune Teller and Shaman. Wins if the wolves win. |

**Player count:** 3–20. The role counts must add up to the player count before the game can start.

---

## Game flow in detail

### Night 夜

The GM steps through the night in this order:

**Knight → Fortune Teller → Shaman → Werewolves → Dawn**

- A role that isn't in this game is skipped.
- A role that **is** in the game but whose player is dead still gets its turn, and the GM skips it.
  This way nobody can tell who died from how long the GM waits.
- **Night 1 is for introductions only.** Each role wakes so it can see its screen, and the wolves see
  each other, but nobody inspects, protects or attacks.
- **Wolves:** any wolf can propose a target, and the whole pack sees it live. Any wolf can then
  **lock it in**. A wolf can't attack another wolf. If the pack makes a mistake, the GM can clear the
  choice so they can pick again.
- **Pack chat:** when at least 2 wolves are alive, they can message each other during their turn.

### Morning 朝

The GM reveals the night's result. Either one player was killed, or the night was quiet. **A Knight's
save looks exactly like a quiet night**, so nobody learns that the Knight protected someone.

If **Reveal role on death** is on, the dead player's role is shown to everyone.

### Day: discussion 議論

Players talk and accuse each other. If the GM set a discussion timer, they can start it, and every
screen counts down to the same moment.

### Voting 投票

- Each living player votes for another living player, or **Skips**. You can't vote for yourself.
- Votes can be changed until the GM closes voting. The GM sees how many players have voted, e.g. "5/8".
- **The player with the most votes is executed.** If there is a **tie**, or **Skip** gets the most
  votes, nobody is executed.
- The result screen shows the vote count.

Dead players can't vote or act. They watch the rest of the game as spectators and can also read the
wolves' chat.

---

## Win conditions

The server checks for a winner after every death. The GM then confirms it.

- **Village wins** when every Werewolf is dead.
- **Werewolves win** when living wolves **equal or outnumber** everyone else. The Madman counts as
  "everyone else" here, even though he wins with the wolves.
- **House rule: 3-player endgame.** Once the day's vote is over, if only 3 players are left, 1 of them
  is a wolf, and no Knight is alive, the wolves win right away. The next attack can't be stopped and
  would leave 1 vs 1. Before the vote, the village still has a chance to vote the wolf out, so the
  game goes on.

---

## GM tools

From the GM screen and its menu:

- **Pause / resume.** Freezes all player actions.
- **Eliminate / revive** any player, to fix mistakes. The win check runs again afterwards.
- **Kick** a player. In the lobby this frees the seat. Mid-game it counts as a death, and that device
  loses access to the game.
- **Reset the wolves' choice** if they locked in the wrong target.
- **End the game early.** Roles are revealed and no winner is declared.
- **Restart** with the same players and new roles, or go **back to the lobby** to change the setup.
- **Game log** of every night action, vote and death, visible only to the GM.

---

## Setup

### Requirements

- Node.js 20.9 or newer
- A free [Supabase](https://supabase.com) project

### Steps

1. **Create a Supabase project** at <https://supabase.com/dashboard>.
2. **Enable anonymous sign-ins:** Authentication → Sign In / Providers → **Allow anonymous sign-ins**
   → Save. Players never create accounts. Each device gets an anonymous identity.
3. **Run the SQL.** In the SQL Editor, open a new query, paste each file from `supabase/migrations/`
   **in order** (001 → 010) and click Run. Run one file at a time.
   - Every file is safe to re-run.
   - `006` **must** be run on its own, because it adds new role names that `007` uses.
   - Updating an existing database? Only run the files you haven't run yet.
4. **Environment variables.** Copy `.env.local.example` to `.env.local`. Fill it in from Project
   Settings → API (or the **Connect** button):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   # or NEXT_PUBLIC_SUPABASE_ANON_KEY (older projects)
   ```
   You never need the service-role key. All game logic runs inside Postgres functions.
5. **Install and run:**
   ```bash
   npm install
   npm run dev
   ```
   Then open <http://localhost:3000>.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run dev:lan` | Dev server reachable from other devices on your network |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run typecheck` | Type-check with TypeScript |

---

## Deploying

The app is a standard Next.js project with no server-side secrets, so it deploys to any Next.js host
(Vercel, Netlify, Cloudflare, …):

1. Import the repository into your host.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `..._ANON_KEY`).
3. Deploy. Share links and QR codes use the deployed URL automatically.

---

## Testing alone

- In `npm run dev`, **each browser tab is a separate player**, because the identity is stored in
  `sessionStorage`. Open the join link in new tabs. Don't use "Duplicate tab": it copies the identity.
  To share one identity across tabs (as in production), set `NEXT_PUBLIC_PER_TAB_IDENTITY=false`.
- To test on other devices on the same Wi-Fi, run `npm run dev:lan` and open
  `http://<your-PC-IP>:3000`.
- By default, Supabase allows 30 anonymous sign-ins per hour per IP. You can raise this under
  Authentication → Rate Limits.

---

## Project structure

```
src/
  app/
    page.tsx            Home: create or join a game
    join/[code]/        Join page (from the link / QR code)
    gm/[code]/          GM screen
    play/[code]/        Player screen
  components/
    gm/                 Lobby setup, night steps, day phases, player table, game log
    player/             Role card, night, day, vote, waiting and dead screens
  hooks/                Anonymous auth, live game state, RPC calls, server clock
  lib/                  Roles, phases, types, Supabase client
supabase/migrations/    Database schema, security rules and all game logic (run in order)
```

---

## How it's secured

- Clients can only `SELECT`. Row Level Security decides what each device sees: your own role, your
  fellow wolves (for wolves and the Madman), and your own night results.
- All writes go through `SECURITY DEFINER` Postgres functions, which check `auth.uid()`. Only the GM
  can change the phase.
- Realtime `postgres_changes` applies the same RLS, so secret rows are never pushed to devices that
  can't read them. The wolves' chat, for example, never reaches a living non-wolf, the Madman included.
