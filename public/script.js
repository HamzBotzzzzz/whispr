/* ============================
   GLOBAL STATE & UTILITIES
   ============================ */
const state = {
  session: null,      // { username, slug }
  currentSlug: null,
  messages: []
};

// Generate ID unik untuk pesan
function generateMessageId(msg) {
  const raw = `${msg.message}|${msg.sentAt}|${msg.audio_url || ''}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  return `msg_${Math.abs(hash)}`;
}

function getReadStorageKey(username) { return `whispr_read_${username}`; }
function getReadIds(username) {
  const stored = localStorage.getItem(getReadStorageKey(username));
  return stored ? JSON.parse(stored) : [];
}
function saveReadId(username, msgId) {
  const current = getReadIds(username);
  if (!current.includes(msgId)) {
    current.push(msgId);
    localStorage.setItem(getReadStorageKey(username), JSON.stringify(current));
  }
}
function isMessageRead(username, msgId) {
  return getReadIds(username).includes(msgId);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;").replace(/\n/g, "<br>");
}
function escapeJsString(str) {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\')
            .replace(/`/g, '\\`')
            .replace(/'/g, "\\'")
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r');
}
function formatTime(ts) {
  const d = new Date(ts), now = new Date(), diff = now - d;
  const mins = Math.floor(diff / 60000), hours = Math.floor(diff / 3600000), days = Math.floor(diff / 86400000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  if (hours < 24) return `${hours} jam lalu`;
  if (days < 7) return `${days} hari lalu`;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}
function setLoading(btn, loading) {
  if (loading) {
    btn.dataset.origText = btn.innerHTML;
    btn.innerHTML = `<span class="spin"></span>`;
    btn.disabled = true;
  } else {
    btn.innerHTML = btn.dataset.origText || btn.innerHTML;
    btn.disabled = false;
  }
}
function toast(msg, type = "success") {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.className = `show ${type}`;
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => el.className = el.className.replace("show", "").trim(), 3000);
}

/* ============================
   RENDER MESSAGES
   ============================ */
function renderMessages() {
  const container = document.getElementById("messages-container");
  if (!container) return;
  if (!state.messages.length) {
    container.innerHTML = `<div class="empty"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg><p>Belum ada pesan masuk</p><p class="text-xs mono">bagikan linkmu untuk mulai menerima pesan</p></div>`;
    return;
  }
  const username = state.session.username;
  container.innerHTML = state.messages.map((msg, idx) => {
    const msgId = generateMessageId(msg);
    const isRead = isMessageRead(username, msgId);
    const unreadClass = isRead ? 'read' : 'unread';
    const hasAudio = !!msg.audio_url;
    const hasText = msg.message && msg.message.trim().length > 0;

    let unreadLabel = '✦ NEW MESSAGE RECEIVED';
    if (!isRead) {
      if (msg.type === 'voice') unreadLabel = '🎙 VOICE NOTE RECEIVED';
      else if (msg.type === 'both') unreadLabel = '🎙 VOICE NOTE + PESAN RECEIVED';
    }

    const previewHtml = !isRead
      ? `<div class="new-message-badge mono">${unreadLabel}</div><div class="text-sm italic" style="color:var(--accent);opacity:0.9;">Klik untuk membaca & mendengarkan</div>`
      : '';

    const audioPlayerHtml = hasAudio
      ? `<div class="msg-audio-player" onclick="event.stopPropagation()">
          <div class="msg-audio-icon">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
          </div>
          <button class="msg-play-btn" onclick="toggleMsgAudio('audio-${msgId}', this)" data-playing="false">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
          </button>
          <div class="vn-progress-wrap" style="flex:1;" onclick="seekMsgAudio('audio-${msgId}', event)">
            <div class="vn-progress-bar" id="prog-${msgId}"></div>
          </div>
          <span class="vn-duration" id="dur-${msgId}">0:00</span>
          <audio id="audio-${msgId}" src="${msg.audio_url}" preload="metadata"
            ontimeupdate="updateMsgProgress('${msgId}', this)"
            onloadedmetadata="updateMsgDuration('${msgId}', this)"
            onended="resetMsgAudio('${msgId}', document.querySelector('[onclick*=audio-${msgId}]'))">
          </audio>
        </div>`
      : '';

    const textHtml = hasText ? `<p class="text-sm mb-3" style="color:var(--text);line-height:1.7;">${escapeHtml(msg.message)}</p>` : '';
    const contentHtml = isRead ? `${textHtml}${audioPlayerHtml}` : '';

    const clickAttr = !isRead
      ? `onclick="handleMessageClick(this, '${msgId}', '${escapeJsString(msg.message || '')}', ${hasAudio})"`
      : `onclick="openViewer('${escapeJsString(msg.message || '')}', '${msg.audio_url || ''}')"`;

    return `<div class="msg-card ${unreadClass} mb-3" data-msg-id="${msgId}" ${clickAttr}>
              ${previewHtml}
              <div class="msg-content" style="${isRead ? 'display:block' : 'display:none'}">${contentHtml}</div>
              <div class="flex items-center justify-between mt-2">
                <span class="text-xs mono" style="color:var(--muted);">${formatTime(msg.sentAt)}</span>
                <div style="display:flex;align-items:center;gap:6px;">
                  ${hasAudio ? '<span class="text-xs mono px-2 py-0.5 rounded" style="background:rgba(200,241,53,0.12);color:var(--accent);border:1px solid rgba(200,241,53,0.3);">🎙 vn</span>' : ''}
                  <span class="text-xs mono px-2 py-0.5 rounded" style="background:var(--surface2);color:var(--muted);">anonim</span>
                </div>
              </div>
            </div>`;
  }).join("");
}

// Audio helpers
function toggleMsgAudio(audioId, btn) {
  const audio = document.getElementById(audioId);
  if (!audio) return;
  document.querySelectorAll('audio').forEach(a => { if (a.id !== audioId && !a.paused) { a.pause(); const ob = document.querySelector(`[onclick*="${a.id}"]`); if(ob) resetPlayIcon(ob); }});
  if (audio.paused) {
    audio.play();
    btn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
  } else {
    audio.pause();
    resetPlayIcon(btn);
  }
}
function resetPlayIcon(btn) {
  btn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>';
}
function updateMsgProgress(msgId, audio) {
  const bar = document.getElementById('prog-' + msgId);
  const dur = document.getElementById('dur-' + msgId);
  if (bar && audio.duration) bar.style.width = (audio.currentTime / audio.duration * 100) + '%';
  if (dur) dur.textContent = formatAudioTime(audio.currentTime);
}
function updateMsgDuration(msgId, audio) {
  const dur = document.getElementById('dur-' + msgId);
  if (dur && audio.duration && isFinite(audio.duration)) dur.textContent = formatAudioTime(audio.duration);
}
function resetMsgAudio(msgId, btn) {
  const bar = document.getElementById('prog-' + msgId);
  if (bar) bar.style.width = '0%';
  if (btn) resetPlayIcon(btn);
}
function seekMsgAudio(audioId, e) {
  const audio = document.getElementById(audioId);
  if (!audio || !audio.duration) return;
  const rect = e.currentTarget.getBoundingClientRect();
  audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
}
function formatAudioTime(secs) {
  const s = Math.floor(secs % 60), m = Math.floor(secs / 60);
  return `${m}:${s.toString().padStart(2,'0')}`;
}

function handleMessageClick(cardElement, msgId, rawMessage, hasAudio) {
  const username = state.session.username;
  const isRead = isMessageRead(username, msgId);
  if (!isRead) {
    saveReadId(username, msgId);
    cardElement.classList.remove('unread');
    cardElement.classList.add('read');
    const badge = cardElement.querySelector('.new-message-badge');
    if (badge) badge.remove();
    const italicText = cardElement.querySelector('.italic');
    if (italicText) italicText.remove();
    const contentDiv = cardElement.querySelector('.msg-content');
    if (contentDiv) {
      const msg = state.messages.find(m => generateMessageId(m) === msgId);
      let inner = '';
      if (msg && msg.message) inner += `<p class="text-sm mb-3" style="color:var(--text);line-height:1.7;">${escapeHtml(msg.message)}</p>`;
      if (msg && msg.audio_url) {
        inner += `<div class="msg-audio-player" onclick="event.stopPropagation()">
          <div class="msg-audio-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg></div>
          <button class="msg-play-btn" onclick="toggleMsgAudio('audio-${msgId}', this)" data-playing="false">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
          </button>
          <div class="vn-progress-wrap" style="flex:1;" onclick="seekMsgAudio('audio-${msgId}', event)">
            <div class="vn-progress-bar" id="prog-${msgId}"></div>
          </div>
          <span class="vn-duration" id="dur-${msgId}">0:00</span>
          <audio id="audio-${msgId}" src="${msg.audio_url}" preload="metadata"
            ontimeupdate="updateMsgProgress('${msgId}', this)"
            onloadedmetadata="updateMsgDuration('${msgId}', this)"
            onended="resetMsgAudio('${msgId}', this.parentElement.querySelector('.msg-play-btn'))">
          </audio>
        </div>`;
      }
      contentDiv.innerHTML = inner;
      contentDiv.style.display = 'block';
    }
  }
  const msgData = state.messages.find(m => generateMessageId(m) === msgId);
  openViewer(rawMessage, msgData?.audio_url || '');
}

function openViewer(text, audioUrl) {
  const viewer = document.getElementById('msg-viewer');
  const viewerMsgDiv = document.getElementById('viewer-msg');
  if (!viewer || !viewerMsgDiv) return;

  let content = '';
  if (text && text.trim()) content += `<p style="line-height:1.65;font-size:16px;">${escapeHtml(text)}</p>`;
  if (audioUrl) {
    content += `<div class="msg-audio-player" style="margin-top:${text ? '16px' : '0'};" onclick="event.stopPropagation()">
      <div class="msg-audio-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg></div>
      <button class="msg-play-btn" onclick="toggleMsgAudio('viewer-audio', this)">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
      </button>
      <div class="vn-progress-wrap" style="flex:1;" onclick="seekMsgAudio('viewer-audio', event)">
        <div class="vn-progress-bar" id="prog-viewer"></div>
      </div>
      <span class="vn-duration" id="dur-viewer">0:00</span>
      <audio id="viewer-audio" src="${audioUrl}" preload="metadata"
        ontimeupdate="updateMsgProgress('viewer', this)"
        onloadedmetadata="updateMsgDuration('viewer', this)"
        onended="resetMsgAudio('viewer', this.parentElement.querySelector('.msg-play-btn'))">
      </audio>
    </div>`;
  }

  viewerMsgDiv.innerHTML = content;
  viewer.style.display = 'block';
  viewer.style.pointerEvents = 'auto';
  void viewer.offsetHeight;
  viewer.classList.add('show');
  document.body.style.overflow = 'hidden';
}
function closeViewer() {
  const viewer = document.getElementById('msg-viewer');
  if (!viewer) return;
  const va = document.getElementById('viewer-audio');
  if (va) { va.pause(); va.currentTime = 0; }
  viewer.classList.remove('show');
  viewer.style.pointerEvents = 'none';
  setTimeout(() => { viewer.style.display = 'none'; }, 250);
  document.body.style.overflow = '';
}

/* ============================
   ROUTER & PAGE CONTROLLER
   ============================ */
function router() {
  const path = window.location.pathname;
  try {
    const raw = localStorage.getItem("whispr_session");
    if (raw) state.session = JSON.parse(raw);
  } catch(e) { localStorage.removeItem("whispr_session"); }
  if (path.startsWith("/@")) {
    state.currentSlug = path.slice(2);
    showPage("send");
    initSendPage(state.currentSlug);
  } else if (path === "/" || path === "") {
    if (state.session) { showPage("dashboard"); initDashboard(); }
    else showPage("auth");
  } else showPage("404");
}
function showPage(name) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const el = document.getElementById(`page-${name}`);
  if (el) {
    el.classList.add("active");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

/* ============================
   AUTH FUNCTIONS
   ============================ */
function switchAuthTab(tab) {
  const loginForm = document.getElementById("form-login"), regForm = document.getElementById("form-register");
  const tabLogin = document.getElementById("tab-login"), tabReg = document.getElementById("tab-register");
  if (tab === "login") {
    loginForm.style.display = "block"; regForm.style.display = "none";
    tabLogin.classList.add("active"); tabReg.classList.remove("active");
  } else {
    loginForm.style.display = "none"; regForm.style.display = "block";
    tabLogin.classList.remove("active"); tabReg.classList.add("active");
  }
}
async function doLogin() {
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value;
  if (!username || !password) return toast("Isi semua field", "error");
  const btn = document.getElementById("btn-login");
  setLoading(btn, true);
  try {
    const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
    const data = await res.json();
    if (!res.ok) return toast(data.error || "Login gagal", "error");
    saveSession({ username: data.username, slug: data.slug });
    toast(`Selamat datang, ${data.username}!`);
    setTimeout(() => { showPage("dashboard"); initDashboard(); }, 400);
  } catch(e) { toast("Koneksi bermasalah", "error"); } finally { setLoading(btn, false); }
}
async function doRegister() {
  const username = document.getElementById("reg-username").value.trim();
  const password = document.getElementById("reg-password").value;
  if (!username || !password) return toast("Isi semua field", "error");
  const btn = document.getElementById("btn-register");
  setLoading(btn, true);
  try {
    const res = await fetch("/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
    const data = await res.json();
    if (!res.ok) return toast(data.error || "Registrasi gagal", "error");
    saveSession({ username: data.username, slug: data.slug });
    toast(`Akun ${data.username} berhasil dibuat!`);
    setTimeout(() => { showPage("dashboard"); initDashboard(); }, 400);
  } catch(e) { toast("Koneksi bermasalah", "error"); } finally { setLoading(btn, false); }
}
function saveSession(session) { state.session = session; localStorage.setItem("whispr_session", JSON.stringify(session)); }
function doLogout() { localStorage.removeItem("whispr_session"); state.session = null; state.messages = []; toast("Sampai jumpa!"); setTimeout(() => showPage("auth"), 400); }

/* ============================
   DASHBOARD
   ============================ */
function initDashboard() {
  if (!state.session) return;
  const { username, slug } = state.session;
  const baseUrl = window.location.origin;
  const link = `${baseUrl}/@${slug}`;
  document.getElementById("nav-username").textContent = `@${username}`;
  document.getElementById("link-text").textContent = link;
  document.getElementById("stat-username").textContent = `@${username}`;
  loadMessages();
}
function showDashTab(tab) {
  const homeDiv = document.getElementById("dash-home"), pesanDiv = document.getElementById("dash-pesan");
  const isHome = tab === "home";
  const activeContent = isHome ? homeDiv : pesanDiv;
  const inactiveContent = isHome ? pesanDiv : homeDiv;
  if (activeContent.style.display === "block" || (activeContent === homeDiv && homeDiv.style.display !== "none")) return;
  inactiveContent.classList.remove("active");
  setTimeout(() => {
    inactiveContent.style.display = "none";
    activeContent.style.display = "block";
    void activeContent.offsetWidth;
    activeContent.classList.add("active");
  }, 150);
  document.getElementById("dash-nav-home").classList.toggle("active", isHome);
  document.getElementById("dash-nav-pesan").classList.toggle("active", !isHome);
  if (!isHome) loadMessages();
}
async function loadMessages() {
  if (!state.session) return;
  const { username } = state.session;
  const container = document.getElementById("messages-container");
  if (container) container.innerHTML = `<div class="flex justify-center py-12"><div class="spin"></div></div>`;
  try {
    const res = await fetch(`/api/messages?username=${encodeURIComponent(username)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    state.messages = data.messages || [];
    renderMessages();
    updateBadge();
    document.getElementById("stat-total").textContent = state.messages.length;
  } catch(e) { if (container) container.innerHTML = `<div class="empty"><p>Gagal memuat pesan</p></div>`; }
}
function updateBadge() {
  const badge = document.getElementById("msg-badge");
  const count = state.messages.length;
  if (count > 0) { badge.style.display = "inline-flex"; badge.textContent = count > 99 ? "99+" : count; }
  else badge.style.display = "none";
}
function copyLink() {
  const link = document.getElementById("link-text").textContent;
  navigator.clipboard.writeText(link).then(() => {
    const btn = document.getElementById("copy-btn");
    btn.textContent = "✓ Disalin";
    setTimeout(() => btn.textContent = "Salin", 2000);
    toast("Link disalin!");
  });
}
function shareLink() {
  const link = document.getElementById("link-text").textContent;
  if (navigator.share) navigator.share({ title: "whispr — kirim pesan anonim ke gw", url: link });
  else copyLink();
}

/* ============================
   SEND PAGE
   ============================ */
async function initSendPage(slug) {
  try {
    const res = await fetch(`/api/profile?slug=${encodeURIComponent(slug)}`);
    if (!res.ok) { showPage("404"); return; }
    const data = await res.json();
    state.sendPageRecipient = data.username;
    document.getElementById("send-username").textContent = `@${data.username}`;
    document.title = `Kirim pesan anonim ke @${data.username} · whispr`;
  } catch(e) { showPage("404"); }
}

async function doSend() {
  const message = document.getElementById("send-msg").value.trim();
  const hasVoice = !!state.vnBlob;

  if (!message && !hasVoice) return toast("Tulis pesan atau rekam suara dulu", "error");
  if (message.length > 500) return toast("Pesan terlalu panjang (maks 500 karakter)", "error");

  const captchaToken = document.querySelector('[name="cf-turnstile-response"]')?.value;
  if (!captchaToken) { toast("Verifikasi keamanan gagal, coba refresh halaman.", "error"); return; }

  const btn = document.getElementById("btn-send");
  setLoading(btn, true);

  try {
    let audio_url = null;
    if (hasVoice) {
      toast("Mengupload voice note...");
      const recipient = state.sendPageRecipient || state.currentSlug;
      const formData = new FormData();
      formData.append("audio", state.vnBlob, "voice.webm");
      formData.append("recipient", recipient);
      const uploadRes = await fetch("/api/upload-audio", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) { toast(uploadData.error || "Gagal upload audio", "error"); return; }
      audio_url = uploadData.audio_url;
    }

    const res = await fetch("/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: state.currentSlug, message: message || null, audio_url, captchaToken })
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 403) toast("Captcha tidak valid, coba lagi", "error");
      else toast(data.error || "Gagal kirim", "error");
      return;
    }
    document.getElementById("send-form-wrap").style.display = "none";
    document.getElementById("send-success").style.display = "block";
    state.vnBlob = null;
    if (typeof turnstile !== 'undefined') turnstile.reset(document.getElementById('captcha-widget'));
  } catch(e) {
    toast("Koneksi bermasalah", "error");
  } finally {
    setLoading(btn, false);
  }
}

function resetSendForm() {
  document.getElementById("send-msg").value = "";
  document.getElementById("char-count").textContent = "0 / 500";
  document.getElementById("send-form-wrap").style.display = "block";
  document.getElementById("send-success").style.display = "none";
  cancelRecording();
  if (typeof turnstile !== 'undefined') turnstile.reset(document.getElementById('captcha-widget'));
}
function updateCharCount() {
  const len = document.getElementById("send-msg").value.length;
  const el = document.getElementById("char-count");
  el.textContent = `${len} / 500`;
  el.className = "char-count" + (len > 450 ? " warn" : "") + (len > 480 ? " danger" : "");
}

/* ============================
   DANGER ZONE MODALS
   ============================ */
function showClearMessagesModal() {
  const bd = document.getElementById("modal-backdrop");
  const m = document.getElementById("modal-clear");
  bd.style.display = "block"; bd.style.pointerEvents = "auto";
  m.style.display = "block"; m.style.pointerEvents = "auto";
}

function showDeleteAccountModal() {
  document.getElementById("delete-confirm-pw").value = "";
  const bd = document.getElementById("modal-backdrop");
  const m = document.getElementById("modal-delete");
  bd.style.display = "block"; bd.style.pointerEvents = "auto";
  m.style.display = "block"; m.style.pointerEvents = "auto";
}

function closeModal() {
  const bd = document.getElementById("modal-backdrop");
  const mc = document.getElementById("modal-clear");
  const md = document.getElementById("modal-delete");
  bd.style.display = "none"; bd.style.pointerEvents = "none";
  mc.style.display = "none"; mc.style.pointerEvents = "none";
  md.style.display = "none"; md.style.pointerEvents = "none";
}

async function doClearMessages() {
  if (!state.session) return;
  const btn = document.getElementById("btn-clear-confirm");
  setLoading(btn, true);
  try {
    const res = await fetch("/api/clear-messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: state.session.username }) });
    const data = await res.json();
    if (!res.ok) return toast(data.error || "Gagal hapus pesan", "error");
    state.messages = [];
    document.getElementById("stat-total").textContent = "0";
    updateBadge();
    closeModal();
    toast("Semua pesan berhasil dihapus");
    if (document.getElementById("dash-pesan").style.display !== "none") loadMessages();
  } catch(e) { toast("Koneksi bermasalah", "error"); } finally { setLoading(btn, false); }
}

async function doDeleteAccount() {
  if (!state.session) return;
  const password = document.getElementById("delete-confirm-pw").value;
  if (!password) return toast("Masukkan password", "error");
  const btn = document.getElementById("btn-delete-confirm");
  setLoading(btn, true);
  try {
    const res = await fetch("/api/delete-account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: state.session.username, password }) });
    const data = await res.json();
    if (!res.ok) return toast(data.error || "Gagal hapus akun", "error");
    closeModal();
    toast("Akun berhasil dihapus");
    setTimeout(() => {
      localStorage.removeItem("whispr_session");
      state.session = null;
      state.messages = [];
      showPage("auth");
    }, 1000);
  } catch(e) { toast("Koneksi bermasalah", "error"); } finally { setLoading(btn, false); }
}

/* ============================
   VOICE NOTE RECORDER
   ============================ */
state.vnBlob = null;
state.vnMediaRecorder = null;
state.vnChunks = [];
state.vnTimerInterval = null;
state.vnSeconds = 0;
state.vnPreviewAudio = null;

async function toggleRecording() {
  if (state.vnMediaRecorder && state.vnMediaRecorder.state === 'recording') {
    stopRecording();
  } else {
    startRecording();
  }
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.vnChunks = [];
    state.vnSeconds = 0;

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
      : 'audio/ogg';

    state.vnMediaRecorder = new MediaRecorder(stream, { mimeType });
    state.vnMediaRecorder.ondataavailable = e => { if (e.data.size > 0) state.vnChunks.push(e.data); };
    state.vnMediaRecorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      state.vnBlob = new Blob(state.vnChunks, { type: mimeType });
      showVnPreview();
    };

    state.vnMediaRecorder.start(100);

    document.getElementById('vn-idle').style.display = 'none';
    document.getElementById('vn-recording').style.display = 'flex';
    document.getElementById('vn-preview-wrap').style.display = 'none';
    document.getElementById('vn-cancel-btn').style.display = 'block';

    updateVnTimer();
    state.vnTimerInterval = setInterval(() => {
      state.vnSeconds++;
      if (state.vnSeconds >= 120) stopRecording();
      updateVnTimer();
    }, 1000);

  } catch(e) {
    if (e.name === 'NotAllowedError') toast("Izin mikrofon ditolak", "error");
    else toast("Mikrofon tidak tersedia", "error");
  }
}

function stopRecording() {
  clearInterval(state.vnTimerInterval);
  if (state.vnMediaRecorder && state.vnMediaRecorder.state !== 'inactive') {
    state.vnMediaRecorder.stop();
  }
  document.getElementById('vn-recording').style.display = 'none';
}

function updateVnTimer() {
  const m = Math.floor(state.vnSeconds / 60), s = state.vnSeconds % 60;
  document.getElementById('vn-timer').textContent = `${m}:${s.toString().padStart(2,'0')}`;
}

function showVnPreview() {
  document.getElementById('vn-idle').style.display = 'none';
  document.getElementById('vn-recording').style.display = 'none';
  document.getElementById('vn-preview-wrap').style.display = 'block';

  if (state.vnPreviewAudio) { state.vnPreviewAudio.pause(); state.vnPreviewAudio = null; }
  const url = URL.createObjectURL(state.vnBlob);
  state.vnPreviewAudio = new Audio(url);
  state.vnPreviewAudio.onloadedmetadata = () => {
    const d = state.vnPreviewAudio.duration;
    if (isFinite(d)) document.getElementById('vn-duration').textContent = formatAudioTime(d);
  };
  state.vnPreviewAudio.ontimeupdate = () => {
    if (!state.vnPreviewAudio.duration) return;
    const pct = state.vnPreviewAudio.currentTime / state.vnPreviewAudio.duration * 100;
    document.getElementById('vn-progress-bar').style.width = pct + '%';
    document.getElementById('vn-duration').textContent = formatAudioTime(state.vnPreviewAudio.currentTime);
  };
  state.vnPreviewAudio.onended = () => {
    document.getElementById('vn-progress-bar').style.width = '0%';
    document.getElementById('vn-play-icon').innerHTML = '<polygon points="5,3 19,12 5,21"/>';
  };
}

function togglePreviewPlay() {
  const audio = state.vnPreviewAudio;
  if (!audio) return;
  const icon = document.getElementById('vn-play-icon');
  if (audio.paused) {
    audio.play();
    icon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
  } else {
    audio.pause();
    icon.innerHTML = '<polygon points="5,3 19,12 5,21"/>';
  }
}

function seekPreview(e) {
  if (!state.vnPreviewAudio || !state.vnPreviewAudio.duration) return;
  const rect = e.currentTarget.getBoundingClientRect();
  state.vnPreviewAudio.currentTime = ((e.clientX - rect.left) / rect.width) * state.vnPreviewAudio.duration;
}

function reRecord() {
  cancelRecording();
  document.getElementById('vn-idle').style.display = 'flex';
  document.getElementById('vn-cancel-btn').style.display = 'none';
}

function cancelRecording() {
  clearInterval(state.vnTimerInterval);
  if (state.vnMediaRecorder && state.vnMediaRecorder.state !== 'inactive') {
    state.vnMediaRecorder.stop();
  }
  if (state.vnPreviewAudio) { state.vnPreviewAudio.pause(); state.vnPreviewAudio = null; }
  state.vnBlob = null;
  state.vnChunks = [];
  state.vnSeconds = 0;

  const idleEl = document.getElementById('vn-idle');
  const recEl = document.getElementById('vn-recording');
  const prevEl = document.getElementById('vn-preview-wrap');
  const cancelBtn = document.getElementById('vn-cancel-btn');
  if (idleEl) idleEl.style.display = 'flex';
  if (recEl) recEl.style.display = 'none';
  if (prevEl) prevEl.style.display = 'none';
  if (cancelBtn) cancelBtn.style.display = 'none';
}

/* ============================
   INITIALIZATION
   ============================ */
document.addEventListener("DOMContentLoaded", () => {
  ["login-username", "login-password"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });
  });
  ["reg-username", "reg-password"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("keydown", e => { if (e.key === "Enter") doRegister(); });
  });
  router();
  window.addEventListener("scroll", () => {
    const btn = document.getElementById("scroll-top");
    if (window.scrollY > 300) btn.classList.add("visible");
    else btn.classList.remove("visible");
  });
  setTimeout(() => { const home = document.getElementById("dash-home"); if (home) home.classList.add("active"); }, 100);
});
