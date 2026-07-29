# SolidStart

Everything you need to build a Solid project, powered by [`solid-start`](https://start.solidjs.com);

## Creating a project

```bash
# create a new project in the current directory
npm init solid@latest

# create a new project in my-app
npm init solid@latest my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

Solid apps are built with _presets_, which optimise your project for deployment to different environments.

By default, `npm run build` will generate a Node app that you can run with `npm start`. To use a different preset, add it to the `devDependencies` in `package.json` and specify in your `app.config.js`.

## This project was created with the [Solid CLI](https://github.com/solidjs-community/solid-cli)

## Deploying to Vercel

### Prerequisites

1. A [Vercel account](https://vercel.com)
2. The Vercel CLI installed (`npx vercel` — already in devDependencies)
3. A Turso database (for production)

### One-time project setup

Link your local checkout to your Vercel project:

```bash
npx vercel link --project <project-name>
```

This creates `.vercel/project.json` — it's gitignored, so each developer needs to run this once.

### Environment variables

Set these in your Vercel project dashboard (Settings → Environment Variables):

| Variable             | Required | Description                                         |
| -------------------- | -------- | --------------------------------------------------- |
| `TURSO_DATABASE_URL` | Yes      | Turso database URL (e.g. `libsql://my-db.turso.io`) |
| `TURSO_AUTH_TOKEN`   | Yes      | Turso database auth token                           |

See `.env.example` for the full list.

### Manual deployment

```bash
vp build                  # outputs to .vercel/output
npx vercel deploy --prebuilt --prod
```

The `--prebuilt` flag tells Vercel to use the existing output directory rather than building from source.

### CI/CD

Every push to `main` triggers an automatic deployment via `.github/workflows/deploy.yml`. It requires these GitHub repository secrets:

| Secret              | Description                                                   |
| ------------------- | ------------------------------------------------------------- |
| `VERCEL_TOKEN`      | Vercel access token (create at Dashboard → Settings → Tokens) |
| `VERCEL_ORG_ID`     | Your Vercel team/org ID                                       |
| `VERCEL_PROJECT_ID` | Your Vercel project ID                                        |

The workflow builds and deploys with `--prebuilt`, skipping Vercel's own build step.

**Note:** The production build currently has a pre-existing CSS import issue (`./form.css` path in `src/routes/cars/[id]/edit.tsx`). Once resolved, the deploy workflow will produce a complete `.vercel/output` and deploy successfully.

### Framework configuration

The Nitro Vercel preset is configured in `vite.config.ts` via `nitro({ preset: "vercel" })`. The `vercel.json` sets `framework: null` to prevent Vercel from running its own build step during `--prebuilt` deployments.

### What's NOT included (future scope)

- Custom domains — see SLOT-15
- Preview deployments per PR branch
