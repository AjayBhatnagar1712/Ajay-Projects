/**
 * One-time backfill: migrate properties.images_legacy (base64) → Vercel Blob URLs in images_urls.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-blob-images.ts --dry-run
 *   pnpm tsx scripts/backfill-blob-images.ts              # staging (.env.local)
 *   pnpm tsx scripts/backfill-blob-images.ts --prod       # production (.env.production)
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { put } from "@vercel/blob";
import { closeDb, ensureDbReady, getDb, sql } from "@workspace/db";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type Args = {
  dryRun: boolean;
  prod: boolean;
};

type Summary = {
  migrated: number;
  failed: number;
  skipped: number;
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  return {
    dryRun: argv.includes("--dry-run"),
    prod: argv.includes("--prod"),
  };
}

function loadEnvFile(relativePath: string): void {
  const filePath = path.join(ROOT, relativePath);
  if (!existsSync(filePath)) {
    console.error(`Missing env file: ${relativePath}`);
    process.exit(1);
  }

  const content = readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function loadEnv(prod: boolean): void {
  const envFile = prod ? ".env.production" : ".env.local";
  const fallback = prod ? undefined : ".env";
  const envPath = path.join(ROOT, envFile);
  const fallbackPath = fallback ? path.join(ROOT, fallback) : undefined;

  if (!existsSync(envPath) && fallbackPath && existsSync(fallbackPath)) {
    loadEnvFile(fallback!);
    console.log(`Loaded ${fallback} (${prod ? "production" : "staging"})`);
    return;
  }

  loadEnvFile(envFile);
  console.log(`Loaded ${envFile} (${prod ? "production" : "staging"})`);
}

function parseLegacyImages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function parseDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } | null {
  const trimmed = dataUrl.trim();
  const match = /^data:([^;]+);base64,(.+)$/i.exec(trimmed);
  if (!match) return null;

  try {
    return {
      mimeType: match[1].toLowerCase(),
      buffer: Buffer.from(match[2], "base64"),
    };
  } catch {
    return null;
  }
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

async function uploadLegacyImage(
  propertyId: string,
  dataUrl: string,
  index: number,
  token: string,
  dryRun: boolean,
): Promise<string | null> {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    console.warn(`[property ${propertyId}] skipping non-base64 image at index ${index}`);
    return null;
  }

  const ext = extensionForMimeType(parsed.mimeType);
  const pathname = `property-images/${propertyId}/${Date.now()}-backfill-${String(index).padStart(2, "0")}.${ext}`;

  if (dryRun) {
    console.log(
      `[property ${propertyId}] [dry-run] would upload ${parsed.buffer.length} bytes (${parsed.mimeType}) → ${pathname}`,
    );
    return `https://dry-run.example/${pathname}`;
  }

  const result = await put(pathname, parsed.buffer, {
    access: "public",
    contentType: parsed.mimeType,
    token,
  });

  return result.url;
}

async function main(): Promise<void> {
  const args = parseArgs();
  loadEnv(args.prod);

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token && !args.dryRun) {
    console.error("BLOB_READ_WRITE_TOKEN is not set");
    process.exit(1);
  }

  if (args.dryRun) {
    console.log("DRY RUN — no Blob uploads or database writes will be performed\n");
  }

  await ensureDbReady();
  const db = getDb();
  if (!db) {
    console.error("Database client unavailable");
    process.exit(1);
  }

  const result = await db.execute(sql`
    SELECT id, images_legacy
    FROM properties
    WHERE images_legacy IS NOT NULL
      AND images_urls IS NULL
  `);

  const rows = result.rows as { id: string; images_legacy: unknown }[];
  console.log("Raw query result count:", rows.length);

  console.log(`Found ${rows.length} propert${rows.length === 1 ? "y" : "ies"} to process\n`);

  const summary: Summary = { migrated: 0, failed: 0, skipped: 0 };

  for (const row of rows) {
    const legacyImages = parseLegacyImages(row.images_legacy);
    if (legacyImages.length === 0) {
      console.log(`[property ${row.id}] skipped — images_legacy is empty`);
      summary.skipped += 1;
      continue;
    }

    try {
      const urls: string[] = [];
      let skippedImages = 0;

      for (let index = 0; index < legacyImages.length; index += 1) {
        const url = await uploadLegacyImage(
          row.id,
          legacyImages[index],
          index,
          token ?? "",
          args.dryRun,
        );
        if (url) {
          urls.push(url);
        } else {
          skippedImages += 1;
        }
      }

      if (urls.length === 0) {
        console.log(`[property ${row.id}] skipped — no migratable base64 images`);
        summary.skipped += 1;
        continue;
      }

      if (args.dryRun) {
        console.log(`[property ${row.id}] would migrate ${urls.length} image(s)`);
        if (skippedImages > 0) {
          console.log(`[property ${row.id}] ${skippedImages} image(s) skipped (non-base64)`);
        }
        summary.migrated += 1;
        continue;
      }

      await db.execute(sql`
        UPDATE properties
        SET images_urls = ${JSON.stringify(urls)}::jsonb,
            images_legacy = NULL,
            updated_at = NOW()
        WHERE id = ${row.id}
      `);

      console.log(`[property ${row.id}] migrated ${urls.length} images`);
      if (skippedImages > 0) {
        console.log(`[property ${row.id}] ${skippedImages} image(s) skipped (non-base64)`);
      }
      summary.migrated += 1;
    } catch (err) {
      console.error(`[property ${row.id}] failed:`, err);
      summary.failed += 1;
    }
  }

  await closeDb();

  console.log("\n--- Summary ---");
  if (args.dryRun) {
    console.log(`Would migrate: ${summary.migrated}`);
  } else {
    console.log(`Migrated: ${summary.migrated}`);
  }
  console.log(`Failed: ${summary.failed}`);
  console.log(`Skipped: ${summary.skipped}`);
}

main().catch((err) => {
  console.error("backfill-blob-images failed:", err);
  process.exit(1);
});
