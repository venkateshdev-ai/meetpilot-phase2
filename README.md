# MeetPilot

Unified meeting copilot + workspace booking platform. Combines Google Meet-style
scheduling, Granola-style AI meeting memory, and WeWork/IndiQube-style room
booking into one product, per the accompanying PRD (`MeetPilot_PRD_Gap_Analysis.docx`).

## What's in this repo

- **Next.js 14 (App Router) + TypeScript + Tailwind** — full UI for the Phase 1 MVP:
  sign up / sign in / forgot password, dashboard, unified Create Meeting flow
  (online / offline / hybrid with room browser), Meeting Hub (Agenda, Summary,
  Action Items, Tickets Created, Analysis Report — with MoM recall for repeat
  participant groups), profile, admin console (members & roles, integrations,
  room inventory), and org-wide analytics.
- **`prisma/schema.prisma`** — the real, production data model: every table
  scoped by `orgId` for multi-tenancy, role stored on `OrgMembership` (not on
  `User`), a `participantSetHash` field for the MoM-recall lookup, and an
  `Integration` table for per-org OAuth connections to Jira/Asana/Linear.
- **`src/lib/rbac.ts`** — centralized permission table (Org Admin / Team Lead /
  Member / Guest).
- **`src/lib/auth.ts`** — NextAuth wired for Google SSO + email/password.
- **`src/lib/mock/*`** — an in-memory data layer implementing the exact same
  shapes as the Prisma models, so the app runs and is fully click-through
  without a live database. This is what today's pages import. Swapping to
  production is a data-layer change only (see "Going to production" below) —
  no page or component needs to change.

## Running it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 — the whole flow (login → dashboard → create a
meeting → meeting hub → push an action item → analytics) works immediately
against the seeded demo org ("Acme Industries").

## Going to production

1. **Database**: provision Postgres, set `DATABASE_URL` in `.env`, then:
   ```bash
   npx prisma migrate dev --name init
   npx prisma generate
   ```
2. **Swap the data layer**: replace the functions in `src/lib/mock/store.ts`
   with the equivalent `prisma.*` calls (each one already has the Prisma
   call commented above it as a 1:1 reference).
3. **Auth**: real NextAuth config already exists in `src/lib/auth.ts` — the
   login/signup pages just need their `onSubmit` handlers pointed at
   `signIn()` / a real registration API route instead of the demo-mode
   `router.push()`.
4. **Integrations**: implement the Jira/Asana/Linear OAuth callbacks referenced
   in `prisma/schema.prisma`'s `Integration` model and wire the "Connect"
   buttons in `/admin` to them.
5. **Deploy**: `Dockerfile` included (multi-stage, production-ready). Any
   platform that runs a container or a Next.js app (Vercel, Fly.io, ECS, etc.)
   works.

## Known limitations of this build

- Auth is in **demo mode** (any credentials log you in as the seeded user) —
  see step 3 above to wire it to the already-configured real NextAuth flow.
- PM-tool integrations are **mocked** — "Push to Jira/Linear/Asana" updates
  local state only, no real ticket is created yet.
- No test suite yet — recommended next addition: Playwright for the critical
  path (login → create meeting → push action item) and unit tests for
  `src/lib/rbac.ts` and the MoM-recall lookup.

## Pushing to GitHub

This repo is already git-initialized with an initial commit. To push:

```bash
git remote add origin <your-repo-url>
git push -u origin main
```
