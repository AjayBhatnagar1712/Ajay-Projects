import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ALLOWED_PREFIX = path.join(ROOT, "lib", "db");
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  ".data",
  ".pnpm-store",
]);

const IMPORT_RE = /from\s+["']drizzle-orm(?:\/[^"']+)?["']/;

async function walk(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, files);
      continue;
    }
    if (/\.(ts|tsx|mts|cts)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const violations = [];
for (const file of await walk(ROOT)) {
  if (file.startsWith(ALLOWED_PREFIX)) continue;
  const text = await readFile(file, "utf8");
  if (IMPORT_RE.test(text)) violations.push(path.relative(ROOT, file));
}

if (violations.length > 0) {
  console.error(
    "drizzle-orm may only be imported under lib/db. Move queries into @workspace/db.\n",
  );
  for (const file of violations) console.error(`  - ${file}`);
  process.exit(1);
}

console.log("check:drizzle-singleton ok");
