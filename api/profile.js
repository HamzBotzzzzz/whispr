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

  const { slug } = req.query;
  if (!slug) return res.status(400).json({ error: "Slug wajib diisi" });

  const usernameLower = await redis.get(`slug:${slug.toLowerCase()}`);
  if (!usernameLower) return res.status(404).json({ error: "Profil tidak ditemukan" });

  const raw = await redis.get(`user:${usernameLower}`);
  if (!raw) return res.status(404).json({ error: "Profil tidak ditemukan" });

  const user = typeof raw === "string" ? JSON.parse(raw) : raw;

  return res.status(200).json({
    success: true,
    username: user.username,
    slug: user.slug,
  });
};
