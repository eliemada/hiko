import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

/** Apply pending SQL migrations from ./drizzle. */
export async function runMigrations() {
  const url = process.env.DATABASE_URL ?? "file:./data/hiko.db";
  if (url.startsWith("file:")) await mkdir(path.dirname(url.slice(5)), { recursive: true });
  const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
  try {
    await migrate(drizzle(client), { migrationsFolder: path.join(process.cwd(), "drizzle") });
  } finally {
    client.close();
  }
}
