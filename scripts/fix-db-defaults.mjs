// Re-apply DB-level defaults that Prisma does not emit.
//
//   node scripts/fix-db-defaults.mjs      (run after EVERY `prisma db push`)
//
// Why this exists: Prisma's `@updatedAt` is enforced by the Prisma *client*,
// not by Postgres — the generated column is NOT NULL with no default. This app
// writes through PostgREST rather than the Prisma client, so inserts never
// supply `updatedAt` and fail with a 23502 not-null violation. `db push` also
// resets these, so this has to be re-run after every schema change.
//
// It also enables RLS on any table missing it, so a newly pushed table is
// never left publicly readable by the anon key.

import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const url = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split("\n")
  .find((l) => l.startsWith("DATABASE_URL="))
  ?.split("=")
  .slice(1)
  .join("=")
  .trim()
  .replace(/^"|"$/g, "");

if (!url) {
  console.error("✗ DATABASE_URL not found in .env.local");
  process.exit(1);
}

const py = new URL("../orchestrator/.venv/bin/python", import.meta.url).pathname;
const script = `
import psycopg, sys
conn = psycopg.connect(${JSON.stringify(url)}, autocommit=True)
cur = conn.cursor()

cur.execute("""
    select table_name from information_schema.columns
    where table_schema='public' and column_name='updatedAt'
    order by table_name
""")
tables = [r[0] for r in cur.fetchall()]
for t in tables:
    cur.execute(f'ALTER TABLE public."{t}" ALTER COLUMN "updatedAt" SET DEFAULT now()')
print(f"updatedAt default set on {len(tables)} table(s)")

cur.execute("select tablename from pg_tables where schemaname='public' and not rowsecurity")
missing = [r[0] for r in cur.fetchall()]
for t in missing:
    cur.execute(f'ALTER TABLE public."{t}" ENABLE ROW LEVEL SECURITY')
print(f"RLS enabled on {len(missing)} previously-unprotected table(s)" if missing else "RLS already on every table")

# Prisma maps DateTime to "timestamp WITHOUT time zone". PostgREST then returns
# those values with no timezone designator ("2026-07-25T20:14:44.731"), and
# JavaScript's Date parses a designator-less string as LOCAL time — silently
# shifting every timestamp by the viewer's UTC offset. The app has always
# written ISO-UTC strings, so reinterpreting the stored values AT TIME ZONE
# 'UTC' is loss-free and makes reads round-trip correctly.
cur.execute("""
    select table_name, column_name from information_schema.columns
    where table_schema='public' and data_type='timestamp without time zone'
    order by table_name, column_name
""")
naive = cur.fetchall()
for t, c in naive:
    cur.execute(
        f'ALTER TABLE public."{t}" ALTER COLUMN "{c}" TYPE timestamptz USING "{c}" AT TIME ZONE \\'UTC\\''
    )
print(f"converted {len(naive)} column(s) to timestamptz" if naive else "all timestamp columns already timestamptz")
conn.close()
`;

// Via a temp file rather than `python -c`: shell-quoting a multi-line script
// turns real newlines into literal \n and Python rejects it.
const scriptPath = join(tmpdir(), `meetpilot-fix-defaults-${process.pid}.py`);
writeFileSync(scriptPath, script);
try {
  console.log(execSync(`${py} ${scriptPath}`, { encoding: "utf8" }).trim());
} catch (err) {
  console.error("✗ failed:", err.stdout || err.message);
  process.exit(1);
} finally {
  unlinkSync(scriptPath);
}
