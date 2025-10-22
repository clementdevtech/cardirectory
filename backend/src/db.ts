import { Pool, QueryResult, QueryResultRow } from "pg";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("❌ DATABASE_URL not set");

export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false, require: true },
  max: parseInt(process.env.DB_POOL_MAX || "10", 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000, // 20s for Supabase SSL handshake
});

process.on("SIGINT", async () => {
  console.log("🧹 Closing DB pool...");
  await pool.end();
  process.exit(0);
});

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const client = await pool.connect();
  const start = Date.now();

  try {
    const res = await client.query<T>(text, params);
    const duration = Date.now() - start;
    //console.log("✅ Query OK:", { text, duration: `${duration}ms` });
    return res;
  } catch (err: any) {
    console.error("❌ SQL Error:", { query: text, params, error: err.message });
    throw err;
  } finally {
    client.release();
  }
}

// ✅ Test DB connection on startup
(async () => {
  try {
    await pool.query("SELECT NOW()");
    console.log("✅ Connected to Supabase DB successfully");
  } catch (err: any) {
    console.error("❌ Failed to connect to DB:", err.message);
  }
})();

export default pool;
