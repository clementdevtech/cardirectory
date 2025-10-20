import { Pool, QueryResult, QueryResultRow } from "pg";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL not set");

export const pool = new Pool({ connectionString });

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const client = await pool.connect();
  try {
    const res = await client.query<T>(text, params);
    return res;
  } catch (err) {
    console.error("❌ SQL Error:", { text, params, error: (err as any).message });
    throw err;
  } finally {
    client.release();
  }
}

export default pool;
