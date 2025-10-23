import { Pool, QueryResult, QueryResultRow } from "pg";
import dotenv from "dotenv";

dotenv.config();

// ✅ Ensure DATABASE_URL exists
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("❌ DATABASE_URL not set");

// ✅ Create connection pool optimized for Supabase + Render
export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }, // required for Supabase
  max: parseInt(process.env.DB_POOL_MAX || "5", 10), // PgBouncer safe limit
  idleTimeoutMillis: 30000, // close idle clients after 30s
  connectionTimeoutMillis: 20000, // wait max 20s for connection
  allowExitOnIdle: true, // ✅ important for Render + PgBouncer
});

// ✅ Pool event listeners
pool.on("connect", () => console.log("✅ PostgreSQL connection established"));
pool.on("error", (err) => console.error("❌ PostgreSQL pool error:", err.message));

// ✅ Safe query helper
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const client = await pool.connect();
  const start = Date.now();

  try {
    const res = await client.query<T>(text, params);
    const duration = Date.now() - start;
    // console.log(`✅ Query executed in ${duration}ms`);
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

// ✅ Graceful shutdown for Render
process.on("SIGINT", async () => {
  console.log("🧹 Closing DB pool...");
  await pool.end();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("🧹 Render shutting down gracefully...");
  await pool.end();
  process.exit(0);
});

// ✅ Connection verification with retry
(async function verifyConnection(retries = 3) {
  while (retries) {
    try {
      const { rows } = await pool.query("SELECT NOW()");
      console.log("✅ Connected to Supabase DB successfully:", rows[0].now);
      break;
    } catch (err: any) {
      retries -= 1;
      console.error(`❌ DB connection failed (${3 - retries}/3):`, err.message);
      if (retries === 0) {
        console.error("❌ Could not connect to Supabase DB after retries.");
      } else {
        console.log("⏳ Retrying connection in 3s...");
        await new Promise((res) => setTimeout(res, 3000));
      }
    }
  }
})();

export default pool;
