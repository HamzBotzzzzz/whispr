const { createClient } = require("@supabase/supabase-js");

// endpoint ini terima multipart/form-data dengan field "audio" (blob .webm)
// pakai busboy untuk parse karena vercel serverless ga support multer by default
const busboy = require("busboy");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rYW5kcWZ3aGdmYXVtZ214cmNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNjc3MjIsImV4cCI6MjA5MDk0MzcyMn0.f33zDpE5PRpxclPYDkh7W_drwdzbIs9QuvfSU3yz9CI"
  );

  return new Promise((resolve) => {
    const bb = busboy({ headers: req.headers, limits: { fileSize: 5 * 1024 * 1024 } }); // max 5MB
    let fileBuffer = null;
    let mimetype = "audio/webm";
    let recipient = null;
    let tooLarge = false;

    bb.on("field", (name, val) => {
      if (name === "recipient") recipient = val.toLowerCase().replace(/[^a-z0-9_]/g, "");
    });

    bb.on("file", (name, file, info) => {
      mimetype = info.mimeType || "audio/webm";
      const chunks = [];

      file.on("data", (chunk) => chunks.push(chunk));
      file.on("limit", () => { tooLarge = true; });
      file.on("close", () => {
        if (!tooLarge) fileBuffer = Buffer.concat(chunks);
      });
    });

    bb.on("close", async () => {
      if (tooLarge) {
        res.status(413).json({ error: "File terlalu besar, maksimal 5MB" });
        return resolve();
      }
      if (!fileBuffer || fileBuffer.length === 0) {
        res.status(400).json({ error: "File audio tidak ditemukan" });
        return resolve();
      }
      if (!recipient) {
        res.status(400).json({ error: "Recipient wajib diisi" });
        return resolve();
      }

      // ekstensi berdasarkan mimetype
      const ext = mimetype.includes("ogg") ? "ogg" : mimetype.includes("mp4") ? "mp4" : "webm";
      const filename = `${recipient}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;

      const { data, error } = await supabase.storage
        .from("voice-notes")
        .upload(filename, fileBuffer, {
          contentType: mimetype,
          upsert: false,
        });

      if (error) {
        console.error("Supabase upload error:", error);
        res.status(500).json({ error: "Gagal upload audio" });
        return resolve();
      }

      // ambil public URL
      const { data: urlData } = supabase.storage
        .from("voice-notes")
        .getPublicUrl(filename);

      res.status(200).json({ success: true, audio_url: urlData.publicUrl });
      resolve();
    });

    bb.on("error", (err) => {
      console.error("Busboy error:", err);
      res.status(500).json({ error: "Gagal memproses file" });
      resolve();
    });

    req.pipe(bb);
  });
};
