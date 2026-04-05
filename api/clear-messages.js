// /api/clear-messages.js
const { Redis } = require("@upstash/redis");
const { createClient } = require("@supabase/supabase-js");

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rYW5kcWZ3aGdmYXVtZ214cmNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNjc3MjIsImV4cCI6MjA5MDk0MzcyMn0.f33zDpE5PRpxclPYDkh7W_drwdzbIs9QuvfSU3yz9CI"
);

// Helper: extract path from Supabase URL
function extractStoragePath(url) {
  try {
    const u = new URL(url);
    // Format: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
    const parts = u.pathname.split('/');
    const bucketIndex = parts.indexOf('public') + 1;
    if (bucketIndex > 0 && parts[bucketIndex]) {
      return parts.slice(bucketIndex + 1).join('/');
    }
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
  const messages = await redis.get(key);
  let audioPaths = [];

  if (messages && Array.isArray(messages)) {
    for (const msg of messages) {
      if (msg.audio_url) {
        const path = extractStoragePath(msg.audio_url);
        if (path) audioPaths.push(path);
      }
    }
  }

  // Hapus file dari Supabase Storage
  if (audioPaths.length > 0) {
    const { error } = await supabase.storage
      .from('voice-notes') // ganti dengan nama bucket Anda
      .remove(audioPaths);
    if (error) console.error("Gagal hapus file audio:", error);
  }

  // Hapus semua pesan dari Redis
  await redis.del(key);

  return res.status(200).json({ success: true });
};
