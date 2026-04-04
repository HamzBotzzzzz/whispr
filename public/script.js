/* ============================
   GLOBAL STATE & UTILITIES
   ============================ */
const state = {
  session: null,
  currentSlug: null,
  messages: []
};

function generateMessageId(msg) {
  const raw = `${msg.message}|${msg.sentAt}`;
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
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;").replace(/\n/g, "<br>");
}
function escapeJsString(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
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
    const previewHtml = !isRead ? `<div class="new-message-badge mono">✦ NEW MESSAGE RECEIVED</div><div class="text-sm italic" style="color:var(--accent);opacity:0.9;">Klik untuk membaca & melihat isi pesan</div>` : '';
    const contentHtml = isRead ? `<p class="text-sm mb-4" style="color:var(--text);line-height:1.7;">${escapeHtml(msg.message)}</p>` : '';
    return `<div class="msg-card ${unreadClass} mb-3" data-msg-id="${msgId}" data-raw-msg="${escapeJsString(msg.message)}" onclick="handleMessageClick(this, '${msgId}', \`${escapeJsString(msg.message)}\`)">
              ${previewHtml}
              <div class="msg-content" style="${isRead ? 'display:block' : 'display:none'}">${contentHtml}</div>
              <div class="flex items-center justify-between"><span class="text-xs mono" style="color:var(--muted);">${formatTime(msg.sentAt)}</span><span class="text-xs mono px-2 py-0.5 rounded" style="background:var(--surface2);color:var(--muted);">anonim</span></div>
            </div>`;
  }).join("");
}

function handleMessageClick(cardElement, msgId, rawMessage) {
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
      contentDiv.innerHTML = `<p class="text-sm mb-4" style="color:var(--text);line-height:1.7;">${escapeHtml(rawMessage)}</p>`;
      contentDiv.style.display = 'block';
    }
  }
  openViewer(rawMessage);
}

function openViewer(text) {
  const viewer = document.getElementById('msg-viewer');
  const viewerMsgDiv = document.getElementById('viewer-msg');
  if (!viewer || !viewerMsgDiv) return;
  viewerMsgDiv.innerHTML = escapeHtml(text).replace(/\n/g, '<br>');
  viewer.style.display = 'block';
  requestAnimationFrame(() => viewer.classList.add('show'));
  document.body.style.overflow = 'hidden';
}
function closeViewer() {
  const viewer = document.getElementById('msg-viewer');
  if (!viewer) return;
  viewer.classList.remove('show');
  setTimeout(() => {
    viewer.style.display = 'none';
  }, 250);
  document.body.style.overflow = '';
}

// ---- Router & load page ----
async function loadPage(pageName) {
  const res = await fetch(`${pageName}.html`);
  const html = await res.text();
  document.getElementById('app-root').innerHTML = html;
  // re-attach global event listeners setelah konten dimuat
  attachGlobalListeners();
  if (pageName === 'auth') initAuthPage();
  else if (pageName === 'dashboard') initDashboard();
  else if (pageName === 'send') {
    const slug = state.currentSlug;
    if (slug) initSendPage(slug);
  }
  // show/hide page transition class (tetap pakai class .page di masing-masing file)
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const activePage = document.querySelector(`#page-${pageName}`);
  if (activePage) activePage.classList.add('active');
}

function router() {
  const path = window.location.pathname;
  try {
    const raw = localStorage.getItem("whispr_session");
    if (raw) state.session = JSON.parse(raw);
  } catch(e) { localStorage.removeItem("whispr_session"); }
  if (path.startsWith("/@")) {
    state.currentSlug = path.slice(2);
    loadPage('send');
  } else if (path === "/" || path === "") {
    if (state.session) loadPage('dashboard');
    else loadPage('auth');
  } else loadPage('404');
}

function attachGlobalListeners() {
  // re-attach semua tombol dan event yang bersifat dinamis
  document.getElementById('btn-login')?.addEventListener('click', doLogin);
  document.getElementById('btn-register')?.addEventListener('click', doRegister);
  document.getElementById('copy-btn')?.addEventListener('click', copyLink);
  document.getElementById('btn-send')?.addEventListener('click', doSend);
  document.getElementById('tab-login')?.addEventListener('click', () => switchAuthTab('login'));
  document.getElementById('tab-register')?.addEventListener('click', () => switchAuthTab('register'));
  document.getElementById('dash-nav-home')?.addEventListener('click', () => showDashTab('home'));
  document.getElementById('dash-nav-pesan')?.addEventListener('click', () => showDashTab('pesan'));
  document.getElementById('btn-clear-confirm')?.addEventListener('click', doClearMessages);
  document.getElementById('btn-delete-confirm')?.addEventListener('click', doDeleteAccount);
  window.scrollTopBtn = document.getElementById('scroll-top');
  if (window.scrollTopBtn) {
    window.scrollTopBtn.onclick = () => window.scrollTo({top:0,behavior:'smooth'});
  }
  window.addEventListener('scroll', () => {
    if (window.scrollTopBtn) {
      if (window.scrollY > 300) window.scrollTopBtn.classList.add('visible');
      else window.scrollTopBtn.classList.remove('visible');
    }
  });
}

// ---- Auth functions ----
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
    setTimeout(() => { loadPage('dashboard'); }, 400);
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
    setTimeout(() => { loadPage('dashboard'); }, 400);
  } catch(e) { toast("Koneksi bermasalah", "error"); } finally { setLoading(btn, false); }
}
function saveSession(session) { state.session = session; localStorage.setItem("whispr_session", JSON.stringify(session)); }
function doLogout() { localStorage.removeItem("whispr_session"); state.session = null; state.messages = []; toast("Sampai jumpa!"); setTimeout(() => loadPage('auth'), 400); }

// ---- Dashboard functions ----
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

// ---- Send page ----
async function initSendPage(slug) {
  try {
    const res = await fetch(`/api/profile?slug=${encodeURIComponent(slug)}`);
    if (!res.ok) { loadPage('404'); return; }
    const data = await res.json();
    document.getElementById("send-username").textContent = `@${data.username}`;
    document.title = `Kirim pesan anonim ke @${data.username} · whispr`;
  } catch(e) { loadPage('404'); }
}
async function doSend() {
  const message = document.getElementById("send-msg").value.trim();
  if (!message) return toast("Tulis pesan dulu", "error");
  if (message.length > 500) return toast("Pesan terlalu panjang (maks 500 karakter)", "error");
  const captchaToken = document.querySelector('[name="cf-turnstile-response"]')?.value;
  if (!captchaToken) {
    toast("Verifikasi keamanan gagal, coba refresh halaman.", "error");
    return;
  }
  const btn = document.getElementById("btn-send");
  setLoading(btn, true);
  try {
    const res = await fetch("/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: state.currentSlug, message, captchaToken })
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 403) toast("Captcha tidak valid, coba lagi", "error");
      else toast(data.error || "Gagal kirim", "error");
      return;
    }
    document.getElementById("send-form-wrap").style.display = "none";
    document.getElementById("send-success").style.display = "block";
    if (typeof turnstile !== 'undefined') {
      turnstile.reset(document.getElementById('captcha-widget'));
    }
  } catch(e) { toast("Koneksi bermasalah", "error"); } finally { setLoading(btn, false); }
}
function resetSendForm() {
  document.getElementById("send-msg").value = "";
  document.getElementById("char-count").textContent = "0 / 500";
  document.getElementById("send-form-wrap").style.display = "block";
  document.getElementById("send-success").style.display = "none";
  if (typeof turnstile !== 'undefined') {
    turnstile.reset(document.getElementById('captcha-widget'));
  }
}
function updateCharCount() {
  const len = document.getElementById("send-msg").value.length;
  const el = document.getElementById("char-count");
  el.textContent = `${len} / 500`;
  el.className = "char-count" + (len > 450 ? " warn" : "") + (len > 480 ? " danger" : "");
}

// ---- Danger zone modals ----
function showClearMessagesModal() {
  const backdrop = document.getElementById("modal-backdrop"), modal = document.getElementById("modal-clear");
  backdrop.style.display = "block"; modal.style.display = "block";
  setTimeout(() => { backdrop.classList.add("show"); modal.classList.add("show"); }, 10);
}
function showDeleteAccountModal() {
  document.getElementById("delete-confirm-pw").value = "";
  const backdrop = document.getElementById("modal-backdrop"), modal = document.getElementById("modal-delete");
  backdrop.style.display = "block"; modal.style.display = "block";
  setTimeout(() => { backdrop.classList.add("show"); modal.classList.add("show"); }, 10);
}
function closeModal() {
  const backdrop = document.getElementById("modal-backdrop"), clearModal = document.getElementById("modal-clear"), deleteModal = document.getElementById("modal-delete");
  backdrop.classList.remove("show");
  if (clearModal) clearModal.classList.remove("show");
  if (deleteModal) deleteModal.classList.remove("show");
  setTimeout(() => {
    backdrop.style.display = "none";
    if (clearModal) clearModal.style.display = "none";
    if (deleteModal) deleteModal.style.display = "none";
  }, 200);
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
      loadPage('auth');
    }, 1000);
  } catch(e) { toast("Koneksi bermasalah", "error"); } finally { setLoading(btn, false); }
}

// init auth page event
function initAuthPage() {
  document.getElementById("login-username")?.addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });
  document.getElementById("login-password")?.addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });
  document.getElementById("reg-username")?.addEventListener("keydown", e => { if (e.key === "Enter") doRegister(); });
  document.getElementById("reg-password")?.addEventListener("keydown", e => { if (e.key === "Enter") doRegister(); });
}

// start
document.addEventListener("DOMContentLoaded", () => {
  router();
});