const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyBmT4GrkMfU0sF_oIPkXMEWvLBgv3C__kg18R2Ji-Hgq3xdx_8Z-435ZTV4H9dd8rJ/exec";
const LOW_SCORE_THRESHOLD = 2;

const $ = (id) => document.getElementById(id);

const state = {
  tg: null,
  user: null,
  data: {
    employees: [],
    criteria: [],
    records: [],
    reviewQueue: []
  }
};

function switchTab(tabId) {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });

  document.querySelectorAll(".section").forEach((section) => {
    section.classList.toggle("active", section.id === tabId);
  });
}

function setupTabs() {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
}

function setToday() {
  const input = $("scoreDate");
  if (!input) return;

  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  input.value = `${yyyy}-${mm}-${dd}`;
}

function todayYmd() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setStatus(message) {
  if ($("statusText")) {
    $("statusText").textContent = message;
  }
}

function setUserVisuals() {
  const tg = window.Telegram?.WebApp || null;
  state.tg = tg;

  if (tg) {
    try {
      tg.ready();
      tg.expand();
    } catch (_) {}
  }

  const user = tg?.initDataUnsafe?.user || null;
  state.user = user;

  const fullName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(" ").trim()
    : "Tarayıcı Demo";

  const username = user?.username ? `@${user.username}` : "@demo";
  const userId = user?.id || 0;

  $("userChip").textContent = fullName || "Kullanıcı";
  $("userInfo").textContent = `Kullanıcı: ${fullName} | ${username} | ID: ${userId}`;
  $("sourceInfo").textContent = user
    ? "Kaynak: Telegram Mini App"
    : "Kaynak: Tarayıcı testi / Telegram dışı açılış";
}

function getTelegramPayload() {
  const user = state.user || null;

  const fullName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(" ").trim()
    : "Tarayıcı Demo";

  return {
    telegramUserId: user?.id || 0,
    telegramUsername: user?.username ? `@${user.username}` : "@demo",
    fullName
  };
}

function normalizeApiData(data) {
  return {
    employees: Array.isArray(data?.employees) ? data.employees : [],
    criteria: Array.isArray(data?.criteria) ? data.criteria : [],
    records: Array.isArray(data?.records) ? data.records : [],
    reviewQueue: Array.isArray(data?.reviewQueue) ? data.reviewQueue : []
  };
}

function uniqueEmployees(employees) {
  const map = new Map();

  employees.forEach((item) => {
    const name = String(item?.name || "").trim();
    if (!name) return;

    if (!map.has(name)) {
      map.set(name, {
        name,
        role: String(item?.role || "Belirtilmedi").trim() || "Belirtilmedi",
        active: item?.active !== false
      });
    }
  });

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "tr"));
}

function uniqueCriteria(criteria) {
  const list = criteria
    .map((x) => String(x || "").trim())
    .filter(Boolean);

  return [...new Set(list)];
}

function fillEmployeeSelect() {
  const select = $("employeeSelect");
  if (!select) return;

  const current = select.value;
  const employees = uniqueEmployees(state.data.employees);

  select.innerHTML = `<option value="">Çalışan seç</option>`;

  employees.forEach((emp) => {
    const opt = document.createElement("option");
    opt.value = emp.name;
    opt.textContent = emp.name;
    select.appendChild(opt);
  });

  if (employees.some((e) => e.name === current)) {
    select.value = current;
  }
}

function fillCriteriaSelect() {
  const select = $("criteriaSelect");
  if (!select) return;

  const current = select.value;
  const criteria = uniqueCriteria(state.data.criteria);

  select.innerHTML = `<option value="">Kriter seç</option>`;

  criteria.forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item;
    opt.textContent = item;
    select.appendChild(opt);
  });

  if (criteria.includes(current)) {
    select.value = current;
  }
}

function updateStats() {
  const employees = uniqueEmployees(state.data.employees);
  const records = state.data.records || [];
  const reviewQueue = state.data.reviewQueue || [];
  const today = todayYmd();

  const activeCount = employees.filter((e) => e.active !== false).length;
  const todayCount = records.filter((r) => String(r.date || "").trim() === today).length;
  const lowCount = reviewQueue.length || records.filter((r) => Number(r.score || 0) <= LOW_SCORE_THRESHOLD).length;

  $("activeCount").textContent = String(activeCount);
  $("todayCount").textContent = String(todayCount);
  $("lowScoreCount").textContent = String(lowCount);
}

function renderEmployees() {
  const section = $("employees");
  if (!section) return;

  const employees = uniqueEmployees(state.data.employees);

  if (!employees.length) {
    section.innerHTML = `
      <h2>Çalışanlar</h2>
      <p>Henüz çalışan bulunamadı. Google Sheet içindeki <strong>Personel</strong> sayfasına personel ekle.</p>
    `;
    return;
  }

  const rows = employees
    .map((emp, index) => {
      return `
        <div style="
          border:1px solid rgba(120,170,255,.22);
          border-radius:18px;
          padding:16px;
          background:rgba(255,255,255,.03);
        ">
          <div style="font-size:12px;opacity:.7;margin-bottom:8px;">#${index + 1}</div>
          <div style="font-size:20px;font-weight:800;margin-bottom:8px;">${escapeHtml(emp.name)}</div>
          <div style="font-size:14px;opacity:.9;margin-bottom:6px;">Rol: ${escapeHtml(emp.role || "Belirtilmedi")}</div>
          <div style="font-size:14px;opacity:.9;">Durum: ${emp.active ? "Aktif" : "Pasif"}</div>
        </div>
      `;
    })
    .join("");

  section.innerHTML = `
    <h2>Çalışanlar</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;">
      ${rows}
    </div>
  `;
}

function renderReports() {
  const section = $("reports");
  if (!section) return;

  const records = [...(state.data.records || [])];
  const reviewQueue = state.data.reviewQueue || [];
  const today = todayYmd();

  const totalCount = records.length;
  const todayCount = records.filter((r) => String(r.date || "").trim() === today).length;
  const reviewCount = reviewQueue.length || records.filter((r) => Number(r.score || 0) <= LOW_SCORE_THRESHOLD).length;

  const recent = records
    .slice()
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, 10);

  const recentHtml = recent.length
    ? recent.map((r) => `
        <div style="
          border:1px solid rgba(120,170,255,.18);
          border-radius:14px;
          padding:12px;
          background:rgba(255,255,255,.02);
          margin-bottom:10px;
        ">
          <div style="font-weight:700;margin-bottom:6px;">${escapeHtml(r.employeeName)} — ${escapeHtml(r.criteria)}</div>
          <div style="font-size:14px;opacity:.9;margin-bottom:4px;">Puan: ${escapeHtml(r.score)} | Tarih: ${escapeHtml(r.date || "-")}</div>
          <div style="font-size:14px;opacity:.8;">Not: ${escapeHtml(r.note || "-")}</div>
        </div>
      `).join("")
    : `<p>Henüz kayıt yok.</p>`;

  section.innerHTML = `
    <h2>Raporlar</h2>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:18px;">
      <div style="border:1px solid rgba(120,170,255,.22);border-radius:18px;padding:16px;background:rgba(255,255,255,.03);">
        <div style="font-size:13px;opacity:.75;margin-bottom:8px;">Toplam kayıt</div>
        <div style="font-size:36px;font-weight:900;">${totalCount}</div>
      </div>

      <div style="border:1px solid rgba(120,170,255,.22);border-radius:18px;padding:16px;background:rgba(255,255,255,.03);">
        <div style="font-size:13px;opacity:.75;margin-bottom:8px;">Bugünkü kayıt</div>
        <div style="font-size:36px;font-weight:900;">${todayCount}</div>
      </div>

      <div style="border:1px solid rgba(120,170,255,.22);border-radius:18px;padding:16px;background:rgba(255,255,255,.03);">
        <div style="font-size:13px;opacity:.75;margin-bottom:8px;">İnceleme bekleyen</div>
        <div style="font-size:36px;font-weight:900;">${reviewCount}</div>
      </div>
    </div>

    <div style="margin-top:8px;">
      <h3 style="margin:0 0 14px 0;">Son kayıtlar</h3>
      ${recentHtml}
    </div>
  `;
}

function applyData(data) {
  state.data = normalizeApiData(data);

  fillEmployeeSelect();
  fillCriteriaSelect();
  updateStats();
  renderEmployees();
  renderReports();
}

function ensureApiConfigured() {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes("BURAYA_APPS_SCRIPT_EXEC_LINKINI_YAPISTIR")) {
    throw new Error("APPS_SCRIPT_URL alanına Apps Script /exec linki girilmemiş.");
  }
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      cache: "no-store",
      signal: controller.signal
    });

    const text = await response.text();

    let json;
    try {
      json = JSON.parse(text);
    } catch (_) {
      throw new Error("API JSON yerine farklı cevap döndü.");
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    if (!json.ok) {
      throw new Error(json.error || "API hata döndürdü.");
    }

    return json;
  } finally {
    clearTimeout(timer);
  }
}

async function loadBootstrap() {
  ensureApiConfigured();

  setStatus("Veriler yükleniyor...");

  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.set("action", "bootstrap");
  url.searchParams.set("_ts", Date.now().toString());

  const json = await fetchJsonWithTimeout(url.toString(), { method: "GET" });
  applyData(json.data || {});

  const user = state.user;
  setStatus(
    user
      ? "Sistem hazır. Telegram kullanıcı bilgisi ve panel verileri yüklendi."
      : "Sistem hazır. Tarayıcı testi modunda veriler yüklendi."
  );
}

async function saveRecord() {
  ensureApiConfigured();

  const employeeName = $("employeeSelect")?.value?.trim() || "";
  const criteria = $("criteriaSelect")?.value?.trim() || "";
  const score = $("scoreSelect")?.value?.trim() || "";
  const note = $("noteInput")?.value?.trim() || "";
  const date = $("scoreDate")?.value?.trim() || todayYmd();

  if (!employeeName) {
    alert("Çalışan seçmeden kayıt atamazsın.");
    return;
  }

  if (!criteria) {
    alert("Kriter seçmeden kayıt atamazsın.");
    return;
  }

  if (!score) {
    alert("Puan seçmeden kayıt atamazsın.");
    return;
  }

  const btn = $("fakeSaveBtn");
  const originalText = btn.textContent;

  try {
    btn.disabled = true;
    btn.textContent = "Kaydediliyor...";

    setStatus("Kayıt gönderiliyor...");

    const tgInfo = getTelegramPayload();

    const body = new URLSearchParams();
    body.append("action", "savescore");
    body.append("date", date);
    body.append("employeeName", employeeName);
    body.append("criteria", criteria);
    body.append("score", score);
    body.append("note", note);
    body.append("telegramUserId", String(tgInfo.telegramUserId));
    body.append("telegramUsername", tgInfo.telegramUsername);
    body.append("fullName", tgInfo.fullName);

    const json = await fetchJsonWithTimeout(
      APPS_SCRIPT_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
        },
        body: body.toString()
      },
      20000
    );

    applyData(json.data || {});

    $("scoreSelect").value = "";
    $("noteInput").value = "";

    const low = Number(score) <= LOW_SCORE_THRESHOLD;
    setStatus(
      low
        ? `Kayıt alındı. ${employeeName} için düşük puan kaydı inceleme sırasına düştü.`
        : `Kayıt alındı. ${employeeName} için değerlendirme başarıyla kaydedildi.`
    );

    switchTab("home");

    if (state.tg?.HapticFeedback?.notificationOccurred) {
      try {
        state.tg.HapticFeedback.notificationOccurred("success");
      } catch (_) {}
    }
  } catch (err) {
    console.error(err);
    setStatus(`Kayıt hatası: ${err.message || err}`);
    alert(`Kayıt gönderilemedi:\n${err.message || err}`);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

function setupSaveButton() {
  const btn = $("fakeSaveBtn");
  if (!btn) return;

  btn.addEventListener("click", saveRecord);
}

async function bootstrapApp() {
  try {
    setupTabs();
    setToday();
    setUserVisuals();
    setupSaveButton();
    await loadBootstrap();
  } catch (err) {
    console.error(err);
    setStatus(`Bağlantı hatası: ${err.message || err}`);

    if ($("employees")) {
      $("employees").innerHTML = `
        <h2>Çalışanlar</h2>
        <p>Veri alınamadı. Önce Apps Script deploy linkini ve erişim ayarlarını kontrol et.</p>
      `;
    }

    if ($("reports")) {
      $("reports").innerHTML = `
        <h2>Raporlar</h2>
        <p>Veri alınamadı. API bağlantısı kurulmadan rapor oluşmaz.</p>
      `;
    }
  }
}

document.addEventListener("DOMContentLoaded", bootstrapApp);
