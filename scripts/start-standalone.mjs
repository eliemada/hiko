import { spawn } from "node:child_process";
import { cp, access } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd());
const dist = process.env.HIKO_BUILD_DIR || ".next";
const root = path.resolve(dist, "standalone");
await access(path.join(root, "server.js"));
for (const [source, target] of [["public", "public"], ["drizzle", "drizzle"], ["src/assets", "src/assets"], [`${dist}/static`, `${dist}/static`]]) {
  await cp(source, path.join(root, target), { recursive: true });
}
// The standalone server changes cwd; keep local data paths relative to the checkout.
const env = { ...process.env, NODE_ENV: "production" };
if (!env.DATABASE_URL || env.DATABASE_URL.startsWith("file:")) env.DATABASE_URL = `file:${path.resolve((env.DATABASE_URL ?? "file:./data/hiko.db").slice(5))}`;
env.DATA_DIR = path.resolve(env.DATA_DIR ?? "./data");
const child = spawn(process.execPath, [path.join(root, "server.js")], { env, stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", (error) => { console.error(error); process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 0; });
