# discord-teamgen

A Discord bot for running CS2 scrim tournaments: players submit their ADR, the bot generates balanced teams, and admins record match results — all from slash commands.

Runs as a Cloudflare Worker with a D1 (SQLite) database. Built with [Hono](https://hono.dev/), [Drizzle ORM](https://orm.drizzle.team/), and [Zod](https://zod.dev/).

## Usage

The bot exposes two top-level slash commands:

- `/t` — player commands, visible to everyone
- `/ta` — admin commands, visible to everyone but only usable by configured admin roles

### Player commands (`/t`)

| Command | Description |
| --- | --- |
| `/t help` | Show in-Discord help with the full command list |
| `/t join` | Join the current tournament |
| `/t leave` | Leave the current tournament |
| `/t set_adr <adr>` | Submit your own ADR (0.01–999.99) |
| `/t show_adr` | Show all submitted and pending ADRs |
| `/t show_teams` | Show the current generated teams |

### Admin commands (`/ta`)

| Command | Description |
| --- | --- |
| `/ta open` | Open a new tournament |
| `/ta close` | Close the current tournament |
| `/ta set_adr <player> [adr] [lock/unlock]` | Submit, lock, or unlock another player's ADR |
| `/ta join <player>` | Add another player to the tournament |
| `/ta remove <player>` | Remove a player from the tournament |
| `/ta generate_teams [lock/unlock] [runs]` | Generate balanced teams, or lock/unlock the current set. `runs` controls optimization iterations (1–200, default 200) |
| `/ta add <player> <team_id>` | Add a player to a specific team (e.g. `TEAM1`) |
| `/ta exchange <player1> <player2>` | Swap two players between teams |
| `/ta result <match_string>` | Record a match result, e.g. `TEAM1-16-14-TEAM2` |

Admin permission is determined by Discord roles configured in the `TOURNAMENT_ADMIN_ROLES` env var (comma-separated role IDs).

### Typical flow

1. An admin runs `/ta open` to start a tournament.
2. Players run `/t join` and `/t set_adr <adr>`.
3. The admin runs `/ta generate_teams` once everyone has submitted.
4. Matches are played; the admin records each one with `/ta result TEAM1-16-14-TEAM2`.
5. The admin runs `/ta close` to wrap up.

## Build and develop

### Prerequisites

- Node.js 20+ and [pnpm](https://pnpm.io/)
- A Cloudflare account with Workers and D1 enabled
- A Discord application with a bot user

### Setup

```bash
pnpm install
```

Create a `.env` file in the repo root for the command-registration script:

```
DISCORD_TOKEN=your_bot_token
APPLICATION_ID=your_discord_application_id
```

The Worker itself reads its config from `wrangler.jsonc` (`vars` block) and Cloudflare secrets — not from `.env`.

Required Worker config:

- `DISCORD_PUBLIC_KEY` — Discord application public key (used to verify webhook signatures)
- `ALLOWED_GUILD_ID` — guild the bot is scoped to
- `TOURNAMENT_ADMIN_ROLES` — comma-separated Discord role IDs that grant admin permissions
- `TOURNAMENT_TIMEZONE` — IANA timezone, e.g. `Europe/Tallinn`
- `ENVIRONMENT` — `production` or anything else for development behavior
- D1 binding `DB` — the tournament database

### Common scripts

```bash
pnpm dev               # run the Worker locally with wrangler dev
pnpm test              # run the vitest suite
pnpm check             # biome lint + tsc --noEmit
pnpm lint              # biome check
pnpm lint:fix          # biome check --write
pnpm format            # biome format --write
pnpm cf-typegen        # regenerate worker-configuration.d.ts from wrangler.jsonc
```

### Database migrations

Schema lives in `src/db/schema.ts`; migrations are generated with drizzle-kit into `migrations/` and applied via Wrangler.

```bash
pnpm exec drizzle-kit generate            # generate a new migration from schema changes
pnpm exec wrangler d1 migrations apply discord-bot-db --local    # apply locally
pnpm exec wrangler d1 migrations apply discord-bot-db --remote   # apply to production D1
```

### Project layout

```
src/
  index.ts            # Hono app + webhook entry point
  handlers/           # Discord interaction handlers
  services/           # Tournament, team-generation, permission services
  db/                 # Drizzle schema, repositories, types
  validation/         # Zod schemas for Discord interactions and command params
  utils/              # Discord signature verification, response helpers
scripts/
  register-commands.js  # Registers /t and /ta with Discord
migrations/           # D1 SQL migrations
test/                 # Vitest suite
```

## Deployment

Two steps: deploy the Worker, then register the slash commands with Discord.

### 1. Deploy the Worker

```bash
pnpm deploy
```

This runs `wrangler deploy` and pushes the current `src/` to Cloudflare. First-time setup also needs:

- D1 database created and bound (see `d1_databases` in `wrangler.jsonc`)
- Migrations applied with `wrangler d1 migrations apply discord-bot-db --remote`
- The deployed Worker URL set as the **Interactions Endpoint URL** in the Discord application settings (path: `/discord/webhook`)

### 2. Register slash commands

```bash
pnpm register-commands
```

This is a `PUT` against Discord's commands API, so it replaces the full command set in one call — both `/t` and `/ta` are registered (or updated) together. Re-run this whenever `scripts/register-commands.js` changes. Global slash commands usually appear immediately but can take up to an hour to propagate.

### Health check

The deployed Worker exposes `GET /health` for a basic liveness probe. In non-production environments it also returns details about DB connectivity and required env vars.
