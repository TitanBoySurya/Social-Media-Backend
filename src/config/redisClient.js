const { createClient } = require("redis");

let redis = null;

if (!process.env.REDIS_URL) {
  console.warn("⚠️ REDIS_URL missing - Redis disabled");
} else {
  redis = createClient({
    url: process.env.REDIS_URL,
    socket: {
      tls: true,
      reconnectStrategy: (retries) => {
        if (retries > 100) return new Error("Redis retry limit reached");
        return Math.min(retries * 1000, 30000);
      }
    }
  });

  redis.on("error", (err) => {
    console.error("❌ Redis Error:", err.message);
  });

  redis.on("connect", () => {
    console.log("🔌 Redis Connecting...");
  });

  redis.on("ready", () => {
    console.log("✅ Redis Ready");
  });

  (async () => {
    try {
      await redis.connect();
    } catch (err) {
      console.error("❌ Redis Connection Failed:", err.message);
    }
  })();
}

// ✅ Safe wrapper (IMPORTANT)
const safeRedis = {
  get: async (key) => redis ? redis.get(key) : null,
  setEx: async (key, ttl, value) => redis ? redis.setEx(key, ttl, value) : null,
  del: async (keys) => redis ? redis.del(keys) : null,
  scan: async (cursor, options) => redis ? redis.scan(cursor, options) : { cursor: 0, keys: [] }
};

module.exports = safeRedis;