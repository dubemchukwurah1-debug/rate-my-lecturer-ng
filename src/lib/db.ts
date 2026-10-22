import postgres from "postgres";

let client: postgres.Sql | undefined;

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

// One shared client per server process. `prepare: false` keeps it compatible with
// Supabase's transaction-mode connection pooler.
export function db(): postgres.Sql {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  client ??= postgres(process.env.DATABASE_URL, { prepare: false, max: 5 });
  return client;
}
