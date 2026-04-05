const { Redis } = require("@upstash/redis");

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function verifyTurnstile(token, clientIP) {
  const secret = process.env.SECRET_KEY_CF || "0x4AAAAAAC0YXKvn2Rk4ja1EmUSLHdikuls";
  if (!secret) {
    console.error("CF_TURNSTILE_SECRET tidak diset");
    return false;
  }
  const formData = new URLSearchParams();
  formData.append("secret", secret);
  formData.append("response", token);
  if (clientIP) formData.append("remoteip", clientIP);

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: formData,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  const data = await response.json();
  return data.success === true;
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { slug, message, audio_url, captchaToken } = req.body || {};

  // minimal harus ada salah satu: message atau audio_url
  if (!slug) return res.status(400).json({ error: "Slug wajib diisi" });
  if (!message && !audio_url) return res.status(400).json({ error: "Pesan atau voice note wajib diisi" });
  if (message && message.trim().length < 1) return res.status(400).json({ error: "Pesan tidak boleh kosong" });
  if (message && message.length > 500) return res.status(400).json({ error: "Pesan maksimal 500 karakter" });

  // validasi captcha
  if (!captchaToken) return res.status(400).json({ error: "Verifikasi keamanan diperlukan" });

  const clientIP = req.headers["cf-connecting-ip"] || req.socket.remoteAddress || "";
  const isCaptchaValid = await verifyTurnstile(captchaToken, clientIP);
  if (!isCaptchaValid) return res.status(403).json({ error: "Captcha tidak valid, coba lagi" });

  // resolve slug ke username
  const usernameLower = await redis.get(`slug:${slug.toLowerCase()}`);
  if (!usernameLower) return res.status(404).json({ error: "Link tidak ditemukan" });

  // tentukan type
  let type = "text";
  if (message && audio_url) type = "both";
  else if (audio_url) type = "voice";

  const msgData = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    message: message ? message.trim() : null,
    audio_url: audio_url || null,
    type,
    sentAt: Date.now(),
    read: false,
  };

  await redis.lpush(`messages:${usernameLower}`, JSON.stringify(msgData));

  return res.status(200).json({ success: true });
};
