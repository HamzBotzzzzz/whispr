const { Redis } = require("@upstash/redis");
const bcrypt = require("bcryptjs");

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

function generateCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * 26)]).join("");
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { username, password } = req.body || {};

  if (!username || !password)
    return res.status(400).json({ error: "Username dan password wajib diisi" });

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username))
    return res.status(400).json({ error: "Username hanya boleh huruf, angka, underscore (3-20 karakter)" });

  if (password.length < 6)
    return res.status(400).json({ error: "Password minimal 6 karakter" });

  // cek username udah exist belum
  const existing = await redis.get(`user:${username.toLowerCase()}`);
  if (existing) return res.status(409).json({ error: "Username sudah dipakai" });

  const code = generateCode();
  const slug = `${username}${code}`;
  const hashedPw = await bcrypt.hash(password, 10);

  const userData = {
    username,
    usernameLower: username.toLowerCase(),
    slug,
    code,
    password: hashedPw,
    createdAt: Date.now(),
  };

  await redis.set(`user:${username.toLowerCase()}`, JSON.stringify(userData));
  await redis.set(`slug:${slug.toLowerCase()}`, username.toLowerCase());

  return res.status(201).json({
    success: true,
    username,
    slug,
  });
};
