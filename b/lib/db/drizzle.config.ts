import { defineConfig } from "drizzle-kit";
import path from "path";
import { fileURLToPath } from "node:url";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const embeddedPath = path.resolve(configDir, "../../.data/pglite");
const dockerPostgres =
  "postgresql://trustkeyper:trustkeyper@localhost:5432/trustkeyper_dev";

function resolveDbUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw || raw === "local" || raw === "pglite") {
    return process.env.PGLITE_DATA_DIR ?? embeddedPath;
  }
  return raw;
}

const schemaDir = path.join(configDir, "./src/schema");

export default defineConfig({
  schema: [
    path.join(schemaDir, "userData.ts"),
    path.join(schemaDir, "profiles.ts"),
    path.join(schemaDir, "properties.ts"),
    path.join(schemaDir, "agreements.ts"),
    path.join(schemaDir, "operations.ts"),
    path.join(schemaDir, "payments.ts"),
    path.join(schemaDir, "brokers.ts"),
  ],
  dialect: "postgresql",
  dbCredentials: {
    url: resolveDbUrl(),
  },
});
