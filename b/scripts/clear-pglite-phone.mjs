import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(repoRoot, "lib", "db", "package.json"));
const { PGlite } = require("@electric-sql/pglite");

const phone = (process.argv[2] ?? "6369856040").replace(/\D/g, "").slice(-10);
const pgliteDir = path.join(repoRoot, ".data", "pglite");

const client = new PGlite(pgliteDir);
const before = await client.query("SELECT role, data_key FROM user_data WHERE phone = $1", [phone]);
console.log(`Found ${before.rows.length} row(s) for ${phone}`);
if (before.rows.length) {
  for (const row of before.rows) console.log(`  - ${row.role} / ${row.data_key}`);
}
await client.query("DELETE FROM user_data WHERE phone = $1", [phone]);
console.log("Deleted.");
await client.close();
