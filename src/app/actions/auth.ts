"use server";

import { timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { APIError } from "better-auth/api";
import { auth, SIGNUP_GATE_HEADER, signupGateToken } from "@/lib/auth";
import { isFirstUser } from "@/lib/server/users";
import { signUpSchema } from "@/lib/validation";
import { fail, UserError, type ActionResult } from "./result";

/** Failed invite attempts per client, to stop brute-forcing the code. */
const FAILED_LIMIT = 8;
const FAILED_WINDOW_MS = 15 * 60_000;
const failures = new Map<string, { count: number; resetAt: number }>();

function tooManyFailures(ip: string): boolean {
  const entry = failures.get(ip);
  return !!entry && entry.resetAt > Date.now() && entry.count >= FAILED_LIMIT;
}

function recordFailure(ip: string) {
  const now = Date.now();
  const entry = failures.get(ip);
  const fresh = !entry || entry.resetAt <= now;
  failures.set(ip, { count: fresh ? 1 : entry.count + 1, resetAt: fresh ? now + FAILED_WINDOW_MS : entry.resetAt });
}

function inviteMatches(code: string): boolean {
  const expected = process.env.INVITE_CODE?.trim();
  if (!expected) return false;
  const a = Buffer.from(code.trim());
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The first account needs no invite and becomes admin; later pilots need INVITE_CODE. */
export async function signUp(input: unknown): Promise<ActionResult> {
  try {
    const data = signUpSchema.parse(input);
    const h = new Headers(await headers());
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
    if (tooManyFailures(ip)) throw new UserError("Too many attempts — try again in 15 minutes");
    if (!(await isFirstUser()) && !inviteMatches(data.inviteCode)) {
      recordFailure(ip);
      throw new UserError("Invalid invite code — ask the fleet admin");
    }
    h.set(SIGNUP_GATE_HEADER, signupGateToken());
    await auth.api.signUpEmail({
      body: { name: data.name, email: data.email, password: data.password },
      headers: h,
    });
    return { success: true };
  } catch (error) {
    if (error instanceof APIError) return { success: false, error: error.message || "Sign up failed" };
    return fail(error);
  }
}
