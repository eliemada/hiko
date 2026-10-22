import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const engine = process.env.CONTAINER_ENGINE ?? "docker";
const image = process.argv[2] ?? "hiko-test";
const prefix = `hiko-smoke-${randomBytes(5).toString("hex")}`;
const volumes = [`${prefix}-data`, `${prefix}-restored`];
const containers = [`${prefix}-app`, `${prefix}-restore`];
function command(args, options = {}) {
  const result = spawnSync(engine, args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, timeout: 180_000, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${engine} ${args[0]} failed: ${result.stderr?.toString().slice(0, 2000)}`);
  return result.stdout;
}
function start(name, volume) {
  command(["run", "-d", "--name", name, "-p", "127.0.0.1::3000", "--mount", `type=volume,source=${volume},target=/data`,
    "-e", "BETTER_AUTH_SECRET=container-smoke-only-never-a-real-secret-0001", "-e", "BETTER_AUTH_URL=http://localhost:3000", image]);
  return containerUrl(name);
}
function containerUrl(name) {
  const mapping = command(["port", name, "3000/tcp"]).trim().split("\n")[0];
  return `http://127.0.0.1:${mapping.split(":").at(-1)}`;
}
async function ready(url) {
  let lastFailure = "No response";
  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(2000) });
      if (response.ok) return;
      lastFailure = `HTTP ${response.status}`;
    } catch (error) { lastFailure = error.message; }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Container readiness timed out at ${url}: ${lastFailure}`);
}
const verify = `const fs=require('node:fs');const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('/data/hiko.db');if(db.prepare('SELECT value FROM release_probe').get().value!==42)process.exit(1);if(fs.readFileSync('/data/logs/fictional.txt','utf8')!=='fictional backup probe')process.exit(2);if(fs.existsSync('/app/data/hiko.db'))process.exit(3);`;
try {
  if (engine === "docker") {
    const config = JSON.parse(command(["compose", "--env-file", ".env.example", "config", "--format", "json"], { env: { ...process.env, HIKO_ENV_FILE: ".env.example" } }));
    assert.equal(config.services.hiko.environment.DATABASE_URL, "file:/data/hiko.db");
    assert.equal(config.services.hiko.environment.DATA_DIR, "/data");
    assert.equal(config.services.hiko.volumes[0].target, "/data");
    console.log("PASS Compose storage paths override local-development defaults");
  }
  for (const volume of volumes) command(["volume", "create", volume]);
  const url = start(containers[0], volumes[0]);
  await ready(url);
  assert.equal(command(["exec", containers[0], "id", "-u"]).trim(), "10001");
  assert.equal((await fetch(`${url}/api/export/pdf?aircraft=missing`)).status, 401);
  command(["exec", containers[0], "node", "-e", `const fs=require('node:fs');const {DatabaseSync}=require('node:sqlite');fs.mkdirSync('/data/logs',{recursive:true});fs.writeFileSync('/data/logs/fictional.txt','fictional backup probe');const db=new DatabaseSync('/data/hiko.db');db.exec('CREATE TABLE release_probe(value INTEGER); INSERT INTO release_probe VALUES(42)');db.close();`]);
  command(["restart", containers[0]]);
  // Docker can assign a new ephemeral host port when a container restarts.
  await ready(containerUrl(containers[0]));
  command(["exec", containers[0], "node", "-e", verify]);
  console.log("PASS non-root startup, migrations, authentication, and restart persistence");
  command(["stop", containers[0]]);
  const backup = command(["run", "--rm", "--entrypoint", "tar", "--mount", `type=volume,source=${volumes[0]},target=/data,readonly`, image, "-czf", "-", "-C", "/data", "."], { encoding: null });
  command(["run", "--rm", "-i", "--entrypoint", "tar", "--mount", `type=volume,source=${volumes[1]},target=/data`, image, "-xzf", "-", "-C", "/data"], { input: backup });
  const restoredUrl = start(containers[1], volumes[1]);
  await ready(restoredUrl);
  command(["exec", containers[1], "node", "-e", verify]);
  console.log("PASS stopped-volume backup and restore to a fresh volume");
} catch (error) {
  for (const name of containers) {
    const state = spawnSync(engine, ["inspect", "--format", "{{json .State}}", name], { encoding: "utf8", timeout: 10_000 });
    if (state.status !== 0) continue;
    console.error(`Container diagnostics (${name}): ${state.stdout.trim()}`);
    spawnSync(engine, ["logs", "--tail", "100", name], { stdio: "inherit", timeout: 10_000 });
  }
  throw error;
} finally {
  for (const name of containers) spawnSync(engine, ["rm", "-f", name], { stdio: "ignore" });
  for (const name of volumes) spawnSync(engine, ["volume", "rm", name], { stdio: "ignore" });
}
