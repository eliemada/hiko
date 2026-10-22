import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

await mkdir(".release", { recursive: true });
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const name = `hiko-${pkg.version}`;
const temp = await mkdtemp(path.join(tmpdir(), "hiko-release-"));
try {
  const root = path.join(temp, name);
  await mkdir(path.join(root, "scripts"), { recursive: true });
  for (const file of ["compose.yaml", ".env.example", "LICENSE", "THIRD_PARTY_NOTICES.md"]) await cp(file, path.join(root, file));
  await cp("scripts/setup.mjs", path.join(root, "scripts/setup.mjs"));
  await writeFile(path.join(root, "README.md"), `# Hikō ${pkg.version}\n\nThis bundle runs the published image. With Node.js 24 and Docker Compose installed:\n\n\`\`\`bash\nnode scripts/setup.mjs --docker\ndocker compose pull\ndocker compose up -d --wait\n\`\`\`\n\nOpen http://localhost:3000 and create your administrator locally. Configure HTTPS and BETTER_AUTH_URL before remote access. For Docker-only setup, source builds, backups, and upgrades see https://github.com/eliemada/hiko/blob/main/docs/self-hosting.md.\n`);
  const result = spawnSync("tar", ["-czf", path.resolve(`.release/${name}.tar.gz`), "-C", temp, name], { stdio: "inherit" });
  if (result.status !== 0) throw new Error("Release archive failed");
} finally { await rm(temp, { recursive: true, force: true }); }
for (const file of ["sample-signed.pdf", "sample-signed.xlsx", "sample-draft.pdf"]) await cp(`demo/assets/${file}`, `.release/${file}`);
const sums = [];
for (const file of (await readdir(".release")).sort()) {
  if (file === "SHA256SUMS.txt") continue;
  sums.push(`${createHash("sha256").update(await readFile(`.release/${file}`)).digest("hex")}  ${file}`);
}
await writeFile(".release/SHA256SUMS.txt", sums.join("\n") + "\n");
