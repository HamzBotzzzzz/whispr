const { Redis } = require("@upstash/redis");

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { username } = req.query;
  if (!username) return res.status(400).json({ error: "Username wajib diisi" });

  const raw = await redis.lrange(`messages:${username.toLowerCase()}`, 0, 99);

  const messages = raw.map((item) => {
    try {
      return typeof item === "string" ? JSON.parse(item) : item;
    } catch {
      return null;
    }
  }).filter(Boolean);

  return res.status(200).json({ success: true, messages });
};
