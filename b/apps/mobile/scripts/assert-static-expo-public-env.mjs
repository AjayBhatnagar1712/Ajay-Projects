/**
 * Fails CI/local typecheck if apps/mobile uses dynamic process.env access.
 *
 * Metro inlines only static `process.env.EXPO_PUBLIC_*` members into release
 * bundles. `process.env[name]` / `process.env[\`...\`]` stay unresolved and
 * are always undefined at runtime in production APKs/IPAs.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  ".expo",
  "android",
  "ios",
  "coverage",
]);

/** Matches process.env[…] including whitespace / computed keys / templates. */
const DYNAMIC_ENV_ACCESS =
  /process\.env\s*(?:\[[^\]]+\]|\?\.\s*\[)/;

async function collectSourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".env.example") {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) {
        continue;
      }
      files.push(...(await collectSourceFiles(full)));
      continue;
    }
    if (SOURCE_EXT.has(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

function findViolations(filePath, source) {
  const violations = [];
  const lines = source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.includes("process.env") && DYNAMIC_ENV_ACCESS.test(line)) {
      violations.push({
        file: path.relative(ROOT, filePath),
        line: i + 1,
        text: line.trim(),
      });
    }
  }
  return violations;
}

const files = await collectSourceFiles(ROOT);
const violations = [];
for (const file of files) {
  // Allow this guard script itself to mention the forbidden pattern in comments/docs.
  if (file.endsWith(`${path.sep}scripts${path.sep}assert-static-expo-public-env.mjs`)) {
    continue;
  }
  const source = await readFile(file, "utf8");
  violations.push(...findViolations(file, source));
}

if (violations.length > 0) {
  console.error(
    "Dynamic process.env access found. Metro will not inline EXPO_PUBLIC_* vars — use process.env.EXPO_PUBLIC_FOO literally:\n",
  );
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}: ${v.text}`);
  }
  process.exit(1);
}

console.log(
  `assert-static-expo-public-env: ok (${files.length} files, no dynamic process.env access)`,
);
