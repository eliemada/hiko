import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const data = await mkdtemp(path.join(tmpdir(), "hiko-e2e-"));
const env = {
  ...process.env,
  HIKO_BUILD_DIR: ".next-test",
  DATABASE_URL: `file:${path.join(data, "hiko.db")}`,
  DATABASE_AUTH_TOKEN: "",
  DATA_DIR: data,
  BETTER_AUTH_SECRET: "isolated-e2e-only-secret-not-for-deployment-0001",
  BETTER_AUTH_URL: "http://localhost:3123",
  TRUSTED_ORIGINS: "http://localhost:3123,http://127.0.0.1:3123",
  INVITE_CODE: "fictional-e2e-fleet",
  DJI_API_KEY: "",
  NEXT_TELEMETRY_DISABLED: "1",
  PORT: "3123",
  HOSTNAME: "127.0.0.1",
};
let child;
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  if (child && child.exitCode === null) {
    child.kill("SIGTERM");
    await new Promise((resolve) => child.once("exit", resolve));
  }
  await rm(data, { recursive: true, force: true });
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => void stop().then(() => process.exit(0)));
function run(args, standalone = false) {
  return new Promise((resolve, reject) => {
    child = spawn(process.execPath, standalone ? ["scripts/start-standalone.mjs"] : ["node_modules/next/dist/bin/next", ...args], { env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 || stopping ? resolve() : reject(new Error(`Next.js exited with code ${code}`)));
  });
}
try {
  if (process.env.E2E_SKIP_BUILD !== "1") await run(["build"]);
  await run([], true);
} finally {
  await stop();
}
