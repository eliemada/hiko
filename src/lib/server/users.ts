import "server-only";
import { count } from "drizzle-orm";
import { db } from "../db";
import { user } from "../db/schema";

export async function isFirstUser(): Promise<boolean> {
  const [{ n }] = await db.select({ n: count() }).from(user);
  return n === 0;
}
