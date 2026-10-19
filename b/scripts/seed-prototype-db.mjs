/**
 * Writes prototype seed JSON to local file store (.data/user_data.json).
 * Usage: node scripts/seed-prototype-db.mjs
 */
import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const seedSrc = path.join(root, "lib/sync-store/seed/prototype-seed.json");
const dataDir = path.join(root, ".data");
const dest = path.join(dataDir, "user_data.json");

mkdirSync(dataDir, { recursive: true });
copyFileSync(seedSrc, dest);
console.log(`Prototype data written to ${dest}`);
console.log("Demo accounts:");
console.log("  Owner  — phone 9876543210 (any 4-digit OTP on signup/login)");
console.log("  Broker — phone 9876543211 (any 4-digit OTP on signup/login)");
