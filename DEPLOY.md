# Deployment guide

The app runs on **SQLite** for local development. For production, switch to
**PostgreSQL (Supabase)** and deploy on **Vercel**. Everything below needs
credentials from *your* accounts, so it's documented rather than pre-run.

## 1. Create a Postgres database (Supabase)

1. Create a project at [supabase.com](https://supabase.com).
2. In **Project Settings → Database → Connection string**, copy both:
   - the **Transaction pooler** URL (port `6543`) → use for `DATABASE_URL`
   - the **Direct connection** URL (port `5432`) → use for `DIRECT_URL`

## 2. Point Prisma at Postgres

In `prisma/schema.prisma`, change the datasource:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // pooled (6543) — used at runtime
  directUrl = env("DIRECT_URL")     // direct (5432) — used for migrations
}
```

The models need **no other changes** — they use only Postgres-compatible types.

## 3. Environment variables

Local `.env` already has `AUTH_SECRET`. For production set:

```bash
DATABASE_URL="postgres://...:6543/postgres?pgbouncer=true"
DIRECT_URL="postgres://...:5432/postgres"
AUTH_SECRET="<generate a NEW one: openssl rand -base64 32>"
```

`AUTH_SECRET` and `.env` are already git-ignored — never commit real secrets.

## 4. Migrations (replace `db push`)

Dev uses `prisma db push`. Production should use versioned migrations:

```bash
# Remove the stale SQLite migration left from early setup:
rm -rf prisma/migrations

# Create the first Postgres migration (run against the new DB):
NODE_OPTIONS=--use-system-ca pnpm exec prisma migrate dev --name init

# In CI/production, apply migrations with:
pnpm exec prisma migrate deploy
```

## 5. Seed production data

Run the seed scripts once against the new database (they're in `prisma/`):

```bash
pnpm exec tsx prisma/seed-users.ts          # login accounts (CHANGE the demo password!)
pnpm exec tsx prisma/seed-departments.ts
pnpm exec tsx prisma/seed.ts                # employees
pnpm exec tsx prisma/seed-recent-hires.ts
# optional demo data:
pnpm exec tsx prisma/seed-leave.ts
pnpm exec tsx prisma/seed-attendance.ts
pnpm exec tsx prisma/seed-performance.ts
pnpm exec tsx prisma/seed-recruitment.ts
pnpm exec tsx prisma/seed-payroll.ts
```

> ⚠️ **Change `DEMO_PASSWORD` in `prisma/seed-users.ts`** before seeding a real
> environment. The login page only pre-fills demo credentials in development
> (`NODE_ENV !== "production"`), but the seeded accounts are real.

## 6. Deploy to Vercel

1. Push the repo to GitHub and import it in Vercel.
2. Add env vars `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET` in the Vercel project.
3. Ensure Prisma Client is generated during build. In `package.json`:

   ```json
   "scripts": {
     "build": "prisma generate && next build"
   }
   ```

4. (Optional) Run `prisma migrate deploy` as a build/release step so schema
   changes apply on deploy.

## Pre-launch checklist

- [ ] Switched datasource to `postgresql` + `directUrl`
- [ ] `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET` set in Vercel
- [ ] Ran `prisma migrate deploy`
- [ ] Seeded accounts with a **strong** password (not `password123`)
- [ ] `build` runs `prisma generate`
- [ ] Verified login, RBAC, and that non-admins can't reach `/users`, `/recruitment`, `/payroll`
