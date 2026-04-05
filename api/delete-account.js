const { Redis } = require("@upstash/redis");
const { createClient } = require("@supabase/supabase-js");
const bcrypt = require("bcryptjs");

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

function extractStoragePath(url) {
  try {
    const u = new URL(url);
    // URL format: .../storage/v1/object/public/voice-notes/username/file.webm
    const marker = '/voice-notes/';
    const idx = u.pathname.indexOf(marker);
    if (idx !== -1) return u.pathname.slice(idx + marker.length);
    return null;
  } catch {
    return null;
  }
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

  const raw = await redis.get(`user:${username.toLowerCase()}`);
  if (!raw) return res.status(404).json({ error: "Akun tidak ditemukan" });

  const user = typeof raw === "string" ? JSON.parse(raw) : raw;

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: "Password salah" });

  // Ambil semua pesan pakai lrange (bukan get)
  const messagesKey = `messages:${username.toLowerCase()}`;
  const rawMessages = await redis.lrange(messagesKey, 0, -1);

  const audioPaths = [];
  for (const item of rawMessages) {
    try {
      const msg = typeof item === "string" ? JSON.parse(item) : item;
      if (msg.audio_url) {
        const path = extractStoragePath(msg.audio_url);
        if (path) audioPaths.push(path);
      }
    } catch (_) {}
  }

  // Hapus file audio dari Supabase Storage
  if (audioPaths.length > 0) {
    const { error } = await supabase.storage.from("voice-notes").remove(audioPaths);
    if (error) console.error("Gagal hapus file audio:", error);
  }

  // Hapus semua data Redis
  await redis.del(`user:${username.toLowerCase()}`);
  await redis.del(`slug:${user.slug.toLowerCase()}`);
  await redis.del(messagesKey);

  return res.status(200).json({ success: true });
};
