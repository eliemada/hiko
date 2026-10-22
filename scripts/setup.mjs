import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const mode = process.argv[2] ?? "--local";
if (!["--local", "--docker"].includes(mode)) {
  console.error("Usage: node scripts/setup.mjs [--local|--docker]");
  process.exit(1);
}
const destination = mode === "--docker" ? ".env" : ".env.local";
const template = await readFile(new URL("../.env.example", import.meta.url), "utf8");
const contents = template
  .replace(/^BETTER_AUTH_SECRET=.*$/m, `BETTER_AUTH_SECRET=${randomBytes(48).toString("base64url")}`)
  .replace(/^INVITE_CODE=.*$/m, `INVITE_CODE=${randomBytes(24).toString("base64url")}`);
try {
  await writeFile(destination, contents, { flag: "wx", mode: 0o600 });
  console.log(`Created ${destination} with unique secrets. Set BETTER_AUTH_URL before remote use.`);
  console.log("DJI_API_KEY is optional for manual entries; encrypted log decoding needs your own key.");
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  console.log(`${destination} already exists; existing settings were preserved.`);
}
