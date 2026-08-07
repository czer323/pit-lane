# Environment Strategy — Where We Test & Ship

**Purpose:** A plain-language map of where Pit Lane is developed, tested, and deployed, and why each stage exists. Technical details live in `vercel-deploy-setup.md`; this is the "what are we trying to accomplish" view.

## The principle

**Nothing reaches users until it has been proven at every stage before it.** Each environment is a gate, and work flows up the chain only after the previous stage is verified.

## The environments (in order)

### 1. Local — your machine

**What it is:** The app running on a developer's own computer, using an isolated local database.

**Why it exists:** Fastest feedback loop. No network, no shared state, no risk. This is where day-to-day development happens — write code, see it immediately, break things freely.

**When you're here:** Most of the time. Every feature starts here.

### 2. Dev (Preview) — Vercel, non-production

**What it is:** The app deployed to a temporary, private URL on Vercel. Uses the shared cloud database.

**Why it exists:** A real hosted environment that others (or a second device) can reach. This is where cross-device behavior gets checked — "does it work when someone else opens it?" It's the first place the app is truly _on the internet_, but nothing real is at risk.

**When you're here:** When local is working and you want to verify it in a hosted context before committing to production.

### 3. Production — the real thing

**What it is:** The live URL users actually see.

**Why it exists:** The final destination. Only reachable after everything above is verified.

**When you're here:** After the dev environment proves the feature works. This is gated — it's the last step, never the first.

## What happens where

| Activity                 | Local | Dev (Preview) | Production |
| ------------------------ | ----- | ------------- | ---------- |
| Build features           | ✅    |               |            |
| Run tests                | ✅    |               |            |
| Check Google sign-in     | ✅    | ✅            |            |
| Try it on another device |       | ✅            |            |
| Share with someone       |       | ✅            |            |
| Real users               |       |               | ✅         |

## The rules

1. **Local first, always.** If it doesn't work locally, it doesn't move up.
2. **Dev before production.** A feature must be verified on the dev URL before it ships.
3. **Production is gated.** Deploying to production is an intentional, deliberate act — not a way to test.
4. **One database per stage.** Local uses its own isolated database; dev and production use their own cloud databases. No stage shares another stage's data.

## Shortcuts (the "if you do this, that happens" map)

| Command                  | What it does                            | Use when                                |
| ------------------------ | --------------------------------------- | --------------------------------------- |
| `pnpm dev`               | Runs the app locally                    | Day-to-day development                  |
| `pnpm dev:host`          | Runs locally, reachable on your network | Testing from another device on your LAN |
| `pnpm test`              | Runs the unit test suite                | Before committing changes               |
| `pnpm check`             | Lints + type-checks                     | Before committing changes               |
| `pnpm db:migrate:local`  | Applies schema to your local database   | After schema changes                    |
| `pnpm db:migrate:remote` | Applies schema to the cloud database    | Before deploying                        |
| `pnpm deploy:dev`        | Deploys to a dev/preview URL on Vercel  | When local works and you want it hosted |
| `pnpm deploy:prod`       | Deploys to production (the real URL)    | ONLY after dev is verified              |

## How to know where you are

- **Local:** the app is on `localhost:3000` on your machine.
- **Dev:** the app is on a `*-vercel.app` URL that isn't the main one.
- **Production:** the app is on the main `*.vercel.app` URL.

If you're ever unsure which stage a deployment belongs to, the answer is: **it's dev unless it was deliberately promoted to production.**
