const { Redis } = require("@upstash/redis");

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Fungsi verifikasi token Turnstile
async function verifyTurnstile(token, clientIP) {
  const secret = process.env.SECRET_KEY_CF;
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

  const { slug, message, captchaToken } = req.body || {};

  // Validasi input
  if (!slug || !message)
    return res.status(400).json({ error: "Slug dan pesan wajib diisi" });

  if (message.trim().length < 1)
    return res.status(400).json({ error: "Pesan tidak boleh kosong" });

  if (message.length > 500)
    return res.status(400).json({ error: "Pesan maksimal 500 karakter" });

  // Validasi captcha
  if (!captchaToken) {
    return res.status(400).json({ error: "Verifikasi keamanan diperlukan" });
  }

  const clientIP = req.headers["cf-connecting-ip"] || req.socket.remoteAddress || "";
  const isCaptchaValid = await verifyTurnstile(captchaToken, clientIP);
  if (!isCaptchaValid) {
    return res.status(403).json({ error: "Captcha tidak valid, coba lagi" });
  }

  // resolve slug ke username
  const usernameLower = await redis.get(`slug:${slug.toLowerCase()}`);
  if (!usernameLower) return res.status(404).json({ error: "Link tidak ditemukan" });

  const msgData = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    message: message.trim(),
    sentAt: Date.now(),
    read: false,
  };

  await redis.lpush(`messages:${usernameLower}`, JSON.stringify(msgData));

  return res.status(200).json({ success: true });
};