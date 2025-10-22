import { Pool, QueryResult, QueryResultRow } from "pg";
import dotenv from "dotenv";

dotenv.config();

// ✅ Ensure connection string exists
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("❌ DATABASE_URL not set");

// ✅ Create a pooled connection for better performance
export const pool = new Pool({
  connectionString,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : undefined,
  // ⚙️ Performance tuning — adjust for your workload
  max: parseInt(process.env.DB_POOL_MAX || "10", 10), // max concurrent clients
  idleTimeoutMillis: 30000, // close idle clients after 30s
  connectionTimeoutMillis: 7000, // wait 7s max for new connection
});

// ✅ Graceful shutdown (avoids hanging connections)
process.on("SIGINT", async () => {
  console.log("🧹 Closing DB pool...");
  await pool.end();
  process.exit(0);
});

// ✅ Safe and timed query helper
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const client = await pool.connect();
  const start = Date.now();

  try {
    const res = await client.query<T>(text, params);
    const duration = Date.now() - start;

    // Optional performance log in dev mode
    if (process.env.NODE_ENV !== "production" && duration > 200) {
      console.log(`⚡ Slow Query (${duration}ms):`, text, params || []);
    }

    return res;
  } catch (err: any) {
    console.error("❌ SQL Error:", {
      query: text,
      params,
      error: err.message,
    });
    throw err;
  } finally {
    client.release();
  }
}

// ✅ Test DB connection on startup
(async () => {
  try {
    const res = await pool.query("SELECT NOW()");
    console.log("✅ Database connected:", res.rows[0].now);
  } catch (err: any) {
    console.error("❌ Failed to connect to DB:", err.message);
  }
})();

export default pool;

