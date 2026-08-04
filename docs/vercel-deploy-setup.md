# Vercel Account Setup — Gathering Deploy Credentials

This guide explains how to gather the three values that Pit Lane's GitHub Actions
deploy workflow needs. You do **not** need any prior Vercel experience beyond having
an account.

## What you are gathering

| Secret              | What it is                                                                             | Looks like          |
| ------------------- | -------------------------------------------------------------------------------------- | ------------------- |
| `VERCEL_TOKEN`      | An access token that lets the CI deploy for you                                        | long random string  |
| `VERCEL_ORG_ID`     | Your team's ID (also called Team ID). On a personal account (no team): your account ID | starts with `team_` |
| `VERCEL_PROJECT_ID` | The Pit Lane project's ID                                                              | starts with `prj_`  |

These three values go into **GitHub repo secrets** (Settings → Secrets and variables →
Actions) as `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. The production deploy
workflow (`.github/workflows/deploy-production.yml`) reads them when you cut a release
tag; the on-demand preview script (`pnpm deploy:preview`) uses them too. Never commit
these values to the repo.

There are two ways to gather them. Use whichever you prefer; Option 2 (CLI) is faster
and auto-captures the IDs, but the token itself comes from the website either way.

## Ways to run and deploy

Three ways to test Pit Lane, from most local to production:

| #   | Channel                                | When to use it                            | Command                                    |
| --- | -------------------------------------- | ----------------------------------------- | ------------------------------------------ |
| 1   | Local dev                              | Day-to-day iteration                      | `vp dev`                                   |
| 2   | Local, as Vercel would run it          | Validate routing/functions before pushing | `vercel dev`                               |
| 3   | Personal preview (your Vercel account) | Look at the deployed site on demand       | `pnpm deploy:preview`                      |
| 4   | Production (the repo's Vercel account) | Ship a version                            | `git tag v0.1.0 && git push origin v0.1.0` |

- Channels 1–3 need **no repo secrets** — they use your machine and your Vercel account.
- Channel 4 is gated: only a `v*` tag pointing to a commit on `main` triggers it, and it
  needs the repo's `VERCEL_*` secrets (configured by whoever manages the repo).

## Free (Hobby) plan notes

Read this if your Vercel account is on the free **Hobby** plan:

- **No team members on Hobby.** Adding a second member to a team requires Pro.
  Recommendation: skip the team and use your personal account.
  This does **not** break "both partners deploy": deploys run through the CI token
  inside GitHub Actions, so a partner deploys by pushing to GitHub — they never need
  to log into Vercel. Direct Vercel dashboard access for a partner (env vars, logs)
  is the only thing that would require Pro.
- **No team, no `team_` ID.** Without a team, `VERCEL_ORG_ID` is your account ID.
  Easiest way to capture it: `vercel link` (Option 2) writes it into `.vercel/project.json`.
- **No password protection on Hobby** (Pro/Enterprise feature). Once deployed, the
  site is public to anyone with the URL. Fine for a demo; upgrade if you need to hide it.
- **Limits that apply**: 200 projects, 100 deployments/day, 45-minute build cap,
  120-second request timeout. None of these block Pit Lane.

---

## Option 1 — Website (dashboard)

No installs. All clicks.

### 1. Create (or confirm) a Team

**On the Hobby plan: skip this step — use your personal account (see plan notes).**

1. Go to <https://vercel.com> and sign in.
2. Click your avatar (top-right) → **Teams** → **Create Team**.
3. Name it (e.g. `pit-lane`) and create it.
   - Why a team: deploys belong to the team, so a partner can be added later
     (Team → Members → Invite) and both of you can deploy the same project.
     Note: adding members requires the Pro plan.

### 2. Get the Team ID (`VERCEL_ORG_ID`)

1. Click your avatar → **Teams** → open your team.
2. Go to **Settings → General**.
3. Scroll to the **Team ID** section and copy it (`team_...`).

### 3. Get the Project ID (`VERCEL_PROJECT_ID`)

Needs the project to exist. If it does:

1. From the team dashboard, open the **pit-lane** project.
2. Go to **Settings → General**.
3. Find **Project ID** (starts with `prj_`) and copy it.

If the project doesn't exist yet, creating one for CI-only deploys is easiest from the
CLI (`vercel link`, Option 2 step 4) — the website's "Add New Project" flow is built
around importing a git repository, which this setup doesn't use.

### 4. Create the token (`VERCEL_TOKEN`)

1. Click your avatar → **Account Settings → Tokens** (or <https://vercel.com/account/tokens>).
2. **Create Token**.
3. Name it something clear (e.g. `GitHub Actions deploy`).
4. If asked for a scope, choose your team. (For a team-scoped token, create it under
   Team → Settings → Tokens instead.) On a personal (Hobby) account there is no team
   scope — leave it account-wide.
5. Create it, then **copy the token immediately** — it is shown exactly once.

### 5. Done

You now have all three values. Add them as GitHub Actions secrets (see "Next steps").

---

## Option 2 — Vercel CLI

Recommended if you're comfortable in a terminal. Most of it is read-only.

### 1. Install the CLI

```bash
npm install -g vercel
```

(Inside the Pit Lane repo you can also use the bundled version: `pnpm exec vercel`.)

### 2. Log in

```bash
vercel login
```

A browser window opens; approve it. Then confirm:

```bash
vercel whoami
```

Prints your account name.

### 3. Check / create the team

**On the Hobby plan: skip this step — use your personal account (see plan notes).**

```bash
vercel teams ls
```

If there's no team yet (or you want a new one):

```bash
vercel teams create pit-lane
```

### 4. Link the project — captures both IDs automatically

Run this **inside the Pit Lane repo directory**:

```bash
vercel link
```

- It prompts: which team? → pick yours.
- It prompts: link to an existing project or create a new one? → answer as needed
  (type `n` to create a new one if none exists).
- This writes `.vercel/project.json` locally (already gitignored in this repo).

Read the IDs:

```bash
cat .vercel/project.json
```

```json
{
  "projectId": "prj_...",
  "orgId": "team_..."
}
```

`orgId` → `VERCEL_ORG_ID`, `projectId` → `VERCEL_PROJECT_ID`.

### 5. Create the token (`VERCEL_TOKEN`)

The token has to come from the website — a fresh `vercel login` session cannot mint
tokens. One dashboard visit:

1. Go to <https://vercel.com/account/tokens>.
2. **Create Token**, name it (e.g. `GitHub Actions deploy`). Scope it to your team
   if you have one; leave account-wide on a personal (Hobby) account.
3. Copy it immediately (shown once).

(If you already have an account-scoped token, you can instead use
`vercel tokens add "GitHub Actions deploy"` and copy the printed value.)

### 6. Verify everything works

```bash
VERCEL_TOKEN="<paste token>" vercel whoami
```

If it prints your account, the token is valid. You're done.

---

## Next steps

1. Add the three values as GitHub repo secrets (repository → **Settings → Secrets and
   variables → Actions**):

   ```bash
   gh secret set VERCEL_TOKEN
   gh secret set VERCEL_ORG_ID      # team_...
   gh secret set VERCEL_PROJECT_ID  # prj_...
   ```

2. After the first deploy succeeds, add the app's runtime environment variables in the
   Vercel project: **Project → Settings → Environment Variables** — `TURSO_DATABASE_URL`
   and `TURSO_AUTH_TOKEN` (Production + Preview). Those are read by the server at
   runtime and are separate from the CI secrets above.

3. To run or deploy, see the "Ways to run and deploy" table at the top of this doc
   (local dev, local Vercel-style, personal preview, production tag).

## Notes

- Team IDs start with `team_`; project IDs with `prj_`. On a personal account (no
  team) the org ID is your account ID instead — don't expect a `team_` prefix.
- Tokens are shown once — store them in a password manager.
- The deploy workflow validates that all three secrets are set and fails fast with a
  clear message if any are missing.
