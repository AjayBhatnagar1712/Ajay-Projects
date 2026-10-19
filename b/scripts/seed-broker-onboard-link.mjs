/**
 * Seeds a broker tenant onboarding invite for local testing.
 * Usage: pnpm run seed:onboard-link
 */
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile() {
  const envPath = path.join(repoRoot, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile();

const require = createRequire(path.join(repoRoot, "lib/db/package.json"));
const { PGlite } = require("@electric-sql/pglite");

const dataDir = (() => {
  const defaultDir = path.join(repoRoot, ".data", "pglite");
  const raw = process.env.PGLITE_DATA_DIR;
  if (!raw) return defaultDir;
  const resolved = path.isAbsolute(raw) ? raw : path.resolve(repoRoot, raw);
  const withinRepo =
    resolved === repoRoot || resolved.startsWith(`${repoRoot}${path.sep}`);
  return withinRepo ? resolved : defaultDir;
})();

const BROKER_PHONE = "9876543211";
const BROKER_NAME = "Demo Broker";
const TENANT_NAME = "Meena Kumari";
const TENANT_PHONE = "+918367849588";
const TOKEN = `bt_local_${Date.now().toString(36)}`;
const now = Date.now();
const expiresAt = now + 14 * 24 * 60 * 60 * 1000;

const snapshot = {
  token: TOKEN,
  tenantName: TENANT_NAME,
  tenantPhone: TENANT_PHONE,
  brokerPhone: BROKER_PHONE,
  brokerName: BROKER_NAME,
  status: "pending",
  createdAt: now,
  expiresAt,
};

const invite = {
  id: `btoi_local_${now}`,
  ...snapshot,
};

const client = new PGlite(dataDir);

const upsert = async (dataKey, value) => {
  await client.query(
    `INSERT INTO user_data (phone, role, data_key, value, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (phone, role, data_key)
     DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [BROKER_PHONE, "broker", dataKey, value],
  );
};

await upsert(`broker_tenant_onboard_${TOKEN}`, JSON.stringify(snapshot));
await upsert("broker_tenant_onboarding_invites", JSON.stringify([invite]));

const verify = await client.query(
  `SELECT phone FROM user_data WHERE data_key = $1 LIMIT 1`,
  [`broker_tenant_onboard_${TOKEN}`],
);

await client.close();

if (!verify.rows.length) {
  console.error("Failed to seed onboarding token. Run: pnpm run db:push");
  process.exit(1);
}

const webPort = process.env.WEB_PORT ?? process.env.VITE_PORT ?? "5173";
const apiPort = process.env.API_PORT ?? process.env.PORT ?? "8080";
const webOrigin = process.env.VITE_DEV_WEB_ORIGIN ?? `http://localhost:${webPort}`;
const link = `${webOrigin.replace(/\/$/, "")}/onboard/tenant/${TOKEN}`;

console.log("");
console.log("Local broker tenant onboarding link:");
console.log(link);
console.log("");
console.log("Prefilled tenant:", TENANT_NAME, TENANT_PHONE);
console.log("Originating broker:", BROKER_NAME, `(phone ${BROKER_PHONE})`);
console.log("");
console.log("Start dev stack:  pnpm run dev:local");
console.log("  Web:  http://localhost:" + webPort);
console.log("  API:  http://localhost:" + apiPort);
console.log("Broker invite:    http://localhost:" + webPort + "/broker/tenants/invite");
console.log("API check:        curl http://localhost:" + apiPort + "/api/broker-tenant-onboard/" + TOKEN);
console.log("");
