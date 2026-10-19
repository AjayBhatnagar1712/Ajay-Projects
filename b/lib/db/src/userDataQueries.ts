import { and, eq } from "drizzle-orm";
import { getDb } from "./client.js";
import { userDataTable } from "./schema/userData.js";

export async function queryAccountData(
  phone: string,
  role: string,
): Promise<Record<string, string>> {
  const db = getDb();
  if (!db) return {};

  const rows = await db
    .select()
    .from(userDataTable)
    .where(and(eq(userDataTable.phone, phone), eq(userDataTable.role, role)));

  const out: Record<string, string> = {};
  for (const row of rows) out[row.dataKey] = row.value;
  return out;
}

export async function upsertAccountDataKey(
  phone: string,
  role: string,
  dataKey: string,
  value: string,
): Promise<void> {
  const db = getDb();
  if (!db) return;

  await db
    .insert(userDataTable)
    .values({ phone, role, dataKey, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [userDataTable.phone, userDataTable.role, userDataTable.dataKey],
      set: { value, updatedAt: new Date() },
    });
}

export async function queryRolesWithProfileForPhone(phone: string): Promise<string[]> {
  const db = getDb();
  if (!db) return [];

  const rows = await db
    .select({ role: userDataTable.role })
    .from(userDataTable)
    .where(and(eq(userDataTable.phone, phone), eq(userDataTable.dataKey, "profile")));

  return [...new Set(rows.map((r) => r.role))];
}

export async function queryEntryByDataKey(
  dataKey: string,
): Promise<{ phone: string; role: string; value: string } | null> {
  const db = getDb();
  if (!db) return null;

  const rows = await db
    .select({
      phone: userDataTable.phone,
      role: userDataTable.role,
      value: userDataTable.value,
    })
    .from(userDataTable)
    .where(eq(userDataTable.dataKey, dataKey))
    .limit(1);

  return rows[0] ?? null;
}
