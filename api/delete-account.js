const { Redis } = require("@upstash/redis");
const bcrypt = require("bcryptjs");

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { username, password } = req.body || {};

  if (!username || !password)
    return res.status(400).json({ error: "Username dan password wajib diisi" });

  const raw = await redis.get(`user:${username.toLowerCase()}`);
  if (!raw) return res.status(404).json({ error: "Akun tidak ditemukan" });

  const user = typeof raw === "string" ? JSON.parse(raw) : raw;

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: "Password salah" });

  // hapus semua data user
  await redis.del(`user:${username.toLowerCase()}`);
  await redis.del(`slug:${user.slug.toLowerCase()}`);
  await redis.del(`messages:${username.toLowerCase()}`);

  return res.status(200).json({ success: true });
};
