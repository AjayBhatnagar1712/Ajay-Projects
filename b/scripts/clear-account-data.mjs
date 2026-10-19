/**
 * Remove local server-side account blobs and optional PGlite rows for a phone number.
 * Browser storage must be cleared separately (see clearLocalAccount.ts or DevTools).
 *
 * Usage: node scripts/clear-account-data.mjs [phoneDigits]
 * Default phone: 6369856040
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, writeFile, mkdir } from "node:fs/promises";

const phone = (process.argv[2] ?? "6369856040").replace(/\D/g, "").slice(-10);
if (phone.length !== 10) {
  console.error("Provide a 10-digit Indian mobile number.");
  process.exit(1);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(repoRoot, ".data");
const filePath = path.join(dataDir, "user_data.json");
const pgliteDir = path.join(dataDir, "pglite");
const roles = ["broker", "owner", "tenant", "manager"];

function accountId(p, role) {
  return `${p}:${role}`;
}

async function clearJsonFileStore() {
  let store = {};
  try {
    const raw = await readFile(filePath, "utf8");
    store = JSON.parse(raw);
  } catch {
    console.log("No .data/user_data.json (nothing to clear in file store).");
    return;
  }

  let removed = 0;
  for (const role of roles) {
    const id = accountId(phone, role);
    if (store[id]) {
      delete store[id];
      removed += 1;
      console.log(`Removed file store account: ${id}`);
    }
  }

  if (removed > 0) {
    await mkdir(dataDir, { recursive: true });
    await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
  } else {
    console.log(`No file-store entries for phone ${phone}.`);
  }
}

async function clearPglite() {
  try {
    const { PGlite } = await import(
      path.join(repoRoot, "lib", "db", "node_modules", "@electric-sql", "pglite", "dist", "index.js")
    ).catch(() => import("@electric-sql/pglite"));
    const client = new PGlite(pgliteDir);
    const res = await client.query(
      `DELETE FROM user_data WHERE phone = $1 RETURNING role, data_key`,
      [phone],
    );
    await client.close();
    const rows = res.rows ?? [];
    if (rows.length === 0) {
      console.log(`No PGlite user_data rows for phone ${phone}.`);
    } else {
      console.log(`Deleted ${rows.length} PGlite row(s) for phone ${phone}:`);
      for (const row of rows) {
        console.log(`  - ${row.role} / ${row.data_key}`);
      }
    }
  } catch (err) {
    console.warn("PGlite clear skipped:", err instanceof Error ? err.message : err);
  }
}

console.log(`Clearing local server data for phone ${phone}…\n`);
await clearJsonFileStore();
await clearPglite();
console.log("\nDone. Clear browser storage:");
console.log("  1. Open http://localhost:5173 and DevTools → Application → Clear site data, or");
console.log("  2. Run clearLocalAccountByPhone in the browser console (see artifacts/trustkeyper/src/lib/clearLocalAccount.ts).");
