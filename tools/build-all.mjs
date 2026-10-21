// Rebuilds every lesson page: node tools/build-all.mjs [slug ...]
import { readdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const LESSONS = fileURLToPath(new URL("../lessons/", import.meta.url));
const only = process.argv.slice(2);
let failed = 0;
for (const slug of readdirSync(LESSONS).sort()) {
  if (only.length && !only.includes(slug)) continue;
  const dir = LESSONS + slug;
  if (!existsSync(dir + "/build.mjs")) continue;
  try { process.stdout.write(`${slug}: ${execFileSync(process.execPath, ["build.mjs"], { cwd: dir, encoding: "utf8" }).trim().split("\n").pop()}\n`); }
  catch (e) { failed++; console.error(`${slug}: FAILED\n${e.stderr || e.message}`); }
}
process.exit(failed ? 1 : 0);
