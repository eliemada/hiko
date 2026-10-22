import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { count } from "drizzle-orm";
import { db } from "./db";
import * as schema from "./db/schema";

/** Header the sign-up server action adds so the public endpoint cannot be called directly. */
export const SIGNUP_GATE_HEADER = "x-hiko-signup-gate";

export function signupGateToken(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not configured");
  return createHash("sha256").update(`signup-gate:${secret}`).digest("hex");
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Extra origins allowed to sign in (e.g. LAN IP, Tailscale name), comma-separated. */
const trustedOrigins = (process.env.TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export const auth = betterAuth({
  trustedOrigins,
  database: drizzleAdapter(db, { provider: "sqlite", schema }),
  emailAndPassword: { enabled: true, minPasswordLength: 10 },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "pilot", input: false },
      licenseNumber: { type: "string", required: false },
      // Large PNG data URL: never put it in the session/cookie cache (→ HTTP 431).
      signature: { type: "string", required: false, input: false, returned: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // The first account becomes the fleet admin.
        before: async (user) => {
          const [{ n }] = await db.select({ n: count() }).from(schema.user);
          return { data: { ...user, role: n === 0 ? "admin" : "pilot" } };
        },
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") return;
      const gate = ctx.headers?.get(SIGNUP_GATE_HEADER) ?? "";
      if (!safeEqual(gate, signupGateToken())) {
        throw new APIError("FORBIDDEN", { message: "Sign up through the app with an invite code." });
      }
    }),
  },
  rateLimit: { enabled: true, window: 60, max: 30 },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
