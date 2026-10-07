import { Pool, type PoolClient } from "pg";
import type { HistoryEntry, Master, MasterRow, Values } from "./master";

let pool: Pool | undefined;

export function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL is not configured");
  pool ??= new Pool({ connectionString, max: 4, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 5_000 });
  return pool;
}

export async function transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listMasters(): Promise<Master[]> {
  const result = await getPool().query<Master>(`
    SELECT k.id, k.name, k.fields, COUNT(r.id)::integer AS count
    FROM master_kinds k LEFT JOIN master_rows r ON r.master_id = k.id
    GROUP BY k.id ORDER BY k.created_at, k.name
  `);
  return result.rows;
}

export async function listRows(masterId: string): Promise<MasterRow[]> {
  const result = await getPool().query<MasterRow>(`
    SELECT id, values, version, updated_at::text AS "updatedAt"
    FROM master_rows WHERE master_id = $1 ORDER BY created_at DESC, id
  `, [masterId]);
  return result.rows;
}

export async function listHistory(masterId: string): Promise<HistoryEntry[]> {
  const result = await getPool().query<HistoryEntry>(`
    SELECT id::text, action, actor, created_at::text AS at,
      before_values AS before, after_values AS after
    FROM master_history WHERE master_id = $1 ORDER BY id DESC LIMIT 100
  `, [masterId]);
  return result.rows;
}

export async function recordHistory(client: PoolClient, masterId: string, rowId: string | null, action: HistoryEntry["action"], actor: string, before: Values | null, after: Values | null) {
  await client.query(`
    INSERT INTO master_history (master_id, row_id, action, actor, before_values, after_values)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [masterId, rowId, action, actor, before === null ? null : JSON.stringify(before), after === null ? null : JSON.stringify(after)]);
}
