import { z } from "zod";

export type ActionResult<T = undefined> = { success: true; data?: T } | { success: false; error: string };

/** Errors whose message is safe to show to the user. */
export class UserError extends Error {}

export function fail(error: unknown): { success: false; error: string } {
  if (error instanceof z.ZodError) return { success: false, error: error.issues.map((i) => i.message).join(", ") };
  if (error instanceof UserError) return { success: false, error: error.message };
  // redirect()/notFound() must propagate to Next.js.
  if (error instanceof Error && "digest" in error) throw error;
  console.error("[action] unexpected error", error);
  return { success: false, error: "Something went wrong — please try again" };
}
