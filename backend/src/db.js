const { Pool } = require("pg");
const dotenv = require("dotenv");
dotenv.config();

// ✅ Ensure DATABASE_URL exists
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("❌ DATABASE_URL not set");

// ✅ Create connection pool optimized for Supabase + Render
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }, // required for Supabase
  max: parseInt(process.env.DB_POOL_MAX || "5", 10), // PgBouncer safe limit
  idleTimeoutMillis: 30000, // close idle clients after 30s
  connectionTimeoutMillis: 20000, // wait max 20s for connection
  allowExitOnIdle: true, // ✅ important for Render + PgBouncer
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  statement_timeout: 30000,
  query_timeout: 30000,
});

const logDbEvent = (event, details = {}) => {
  /*console.log(
    `[db:${event}]`,
    JSON.stringify({
      timestamp: new Date().toISOString(),
      ...details,
    })
  );*/
};

const attachClientErrorHandlers = (client) => {
  client.on("error", (err) => {
    logDbEvent("client-error", {
      message: err?.message || String(err),
      stack: err?.stack,
    });
  });

  client.on("end", () => {
    logDbEvent("client-end", { message: "PostgreSQL client ended" });
  });
};

// ✅ Pool event listeners
pool.on("connect", (client) => {
  attachClientErrorHandlers(client);
  logDbEvent("connect", { message: "PostgreSQL connection established" });
});
pool.on("acquire", () => logDbEvent("acquire", { message: "Client acquired from pool" }));
pool.on("remove", () => logDbEvent("remove", { message: "Client removed from pool" }));
pool.on("error", (err) => {
  logDbEvent("pool-error", {
    message: err.message,
    stack: err.stack,
  });
});

// ✅ Safe query helper with retries for transient connection drops
async function query(text, params, retries = 2) {
  let client;
  const start = Date.now();

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      client = await pool.connect();
      attachClientErrorHandlers(client);

      const res = await client.query(text, params);
      const duration = Date.now() - start;
      logDbEvent("query-success", {
        durationMs: duration,
        query: text.slice(0, 180),
        paramCount: Array.isArray(params) ? params.length : 0,
        attempt: attempt + 1,
      });
      return res;
    } catch (err) {
      const isTransient =
        err?.message?.includes("Connection terminated unexpectedly") ||
        err?.message?.includes("Client has encountered a connection error") ||
        err?.message?.includes("terminated unexpectedly") ||
        err?.code === "ECONNRESET" ||
        err?.code === "57P01" ||
        err?.code === "57P02" ||
        err?.code === "08006";

      logDbEvent("query-error", {
        message: err.message,
        query: text.slice(0, 180),
        paramCount: Array.isArray(params) ? params.length : 0,
        stack: err.stack,
        code: err.code || null,
        attempt: attempt + 1,
        retriesRemaining: retries - attempt,
        transient: isTransient,
      });

      if (isTransient && attempt < retries) {
        logDbEvent("query-retry", {
          query: text.slice(0, 120),
          attempt: attempt + 1,
          nextAttemptInMs: 1500,
        });
        await new Promise((resolve) => setTimeout(resolve, 1500));
        continue;
      }

      if (isTransient) {
        logDbEvent("db-connection-dropped", {
          message: err.message,
          code: err.code || null,
        });
      }

      throw err;
    } finally {
      if (client) {
        client.release();
        client = null;
      }
    }
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
async function verifyConnection(retries = 3) {
  let attempt = 0;

  while (attempt < retries) {
    attempt += 1;

    try {
      const client = await pool.connect();
      try {
        const { rows } = await client.query("SELECT NOW() AS now");
        logDbEvent("verify-success", { now: rows[0].now, attempt });
        return true;
      } finally {
        client.release();
      }
    } catch (err) {
      logDbEvent("verify-failed", {
        attempt,
        maxRetries: retries,
        message: err.message,
        code: err.code || null,
      });

      if (attempt >= retries) {
        logDbEvent("verify-failed-final", {
          message: "Could not connect to Supabase DB after retries.",
        });
        return false;
      }

      await new Promise((res) => setTimeout(res, 3000));
    }
  }

  return false;
}

(async () => {
  const connected = await verifyConnection(3);
  if (!connected) {
    logDbEvent("startup-db-unavailable", {
      message: "Backend started without a verified database connection.",
    });
  }
})().catch((err) => {
  logDbEvent("verify-exception", {
    message: err.message,
    stack: err.stack,
  });
});

module.exports = { pool, query };
