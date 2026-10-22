import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { auth } from "../auth";
import { db } from "../db";
import { user } from "../db/schema";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "pilot";
  licenseNumber: string | null;
  hasSignature: boolean;
}

/** Session lookup, deduplicated per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  // Read profile fields from the DB, not the (cached) session cookie.
  const u = await db.query.user.findFirst({ where: eq(user.id, session.user.id) });
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role === "admin" ? "admin" : "pilot",
    licenseNumber: u.licenseNumber ?? null,
    hasSignature: Boolean(u.signature),
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}
