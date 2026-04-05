const { Redis } = require("@upstash/redis");
const { createClient } = require("@supabase/supabase-js");

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

  const { username } = req.body || {};
  if (!username) return res.status(400).json({ error: "Username wajib diisi" });

  const key = `messages:${username.toLowerCase()}`;

  // pakai lrange bukan get — pesan disimpan sebagai Redis List
  const rawMessages = await redis.lrange(key, 0, -1);

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

  // Hapus semua pesan dari Redis
  await redis.del(key);

  return res.status(200).json({ success: true });
};
