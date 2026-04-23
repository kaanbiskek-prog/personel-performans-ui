const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyBmT4GrkMfU0sF_oIPkXMEWvLBgv3C__kg18R2Ji-Hgq3xdx_8Z-435ZTV4H9dd8rJ/exec";

const $ = (id) => document.getElementById(id);

const state = {
  employees: [],
  criteria: [],
  records: [],
  reviewQueue: [],
  telegramUser: null
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function findSaveButton() {
  return (
    $("fakeSaveBtn") ||
    $("saveBtn") ||
    document.querySelector('[data-action="save"]') ||
    document.querySelector(".primary-btn")
  );
}

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

function getTodayYMD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function setToday() {
  const input = $("scoreDate");
  if (!input) return;
  input.value = getTodayYMD();
}

function normalizeDateString(value) {
  if (!value) return "";

  if (typeof value === "string") {
    const raw = value.trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

    if (/^\d{2}\.\d{2}\.\d{4}$/.test(raw)) {
      const [dd, mm, yyyy] = raw.split(".");
      return `${yyyy}-${mm}-${dd}`;
    }

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
      const [dd, mm, yyyy] = raw.split("/");
      return `${yyyy}-${mm}-${dd}`;
    }

    const dt = new Date(raw);
    if (!Number.isNaN(dt.getTime())) {
      const yyyy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const dd = String(dt.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }

    return raw;
  }

  const dt = new Date(value);
  if (!Number.isNaN(dt.getTime())) {
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  return "";
}

function setStatus(message, isError = false) {
  const el = $("statusText");
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? "#ffb4b4" : "";
}

function setUserMeta(fullName, username, userId, sourceText, chipText) {
  if ($("userChip")) $("userChip").textContent = chipText;
  if ($("userInfo")) $("userInfo").textContent = `Kullanıcı: ${fullName} | ${username} | ID: ${userId}`;
  if ($("sourceInfo")) $("sourceInfo").textContent = `Kaynak: ${sourceText}`;
}

function initTelegramInfo() {
  const tg = window.Telegram?.WebApp;

  if (tg) {
    try {
      tg.ready();
      tg.expand();
    } catch (err) {
      console.warn("Telegram WebApp init warning:", err);
    }
  }

  const user = tg?.initDataUnsafe?.user || null;
  state.telegramUser = user;

  if (user) {
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || "Bilinmiyor";
    const username = user.username ? `@${user.username}` : "@yok";
    const userId = user.id || 0;

    setUserMeta(fullName, username, userId, "Telegram Mini App", fullName);
    setStatus("Telegram kullanıcı bilgisi başarıyla alındı.");
  } else {
    setUserMeta("Tarayıcı Demo", "@demo", 0, "Tarayıcı testi / Telegram dışı açılış", "Tarayıcı Demo");
    setStatus("Telegram dışı açılış. Bu normal.");
  }
}

function populateEmployeeSelect() {
  const select = $("employeeSelect");
  if (!select) return;

  const previousValue = select.value;
  select.innerHTML = `<option value="">Çalışan seç</option>`;

  state.employees
    .filter((item) => item && item.name && item.active !== false)
    .forEach((item) => {
      const opt = document.createElement("option");
      opt.value = item.name;
      opt.textContent = item.name;
      select.appendChild(opt);
    });

  if ([...select.options].some((o) => o.value === previousValue)) {
    select.value = previousValue;
  }
}

function populateCriteriaSelect() {
  const select = $("criteriaSelect");
  if (!select) return;

  const previousValue = select.value;
  select.innerHTML = `<option value="">Kriter seç</option>`;

  state.criteria
    .filter(Boolean)
    .forEach((item) => {
      const opt = document.createElement("option");
      opt.value = item;
      opt.textContent = item;
      select.appendChild(opt);
    });

  if ([...select.options].some((o) => o.value === previousValue)) {
    select.value = previousValue;
  }
}

function renderStats() {
  const activeEmployees = state.employees.filter((e) => e && e.active !== false).length;
  const today = getTodayYMD();
  const todayCount = state.records.filter((r) => normalizeDateString(r.date) === today).length;
  const lowScoreCount = state.records.filter((r) => Number(r.score) <= 2).length;

  if ($("activeCount")) $("activeCount").textContent = String(activeEmployees);
  if ($("todayCount")) $("todayCount").textContent = String(todayCount);
  if ($("lowScoreCount")) $("lowScoreCount").textContent = String(lowScoreCount);
}

function renderEmployeesSection() {
  const section = $("employees");
  if (!section) return;

  const employees = state.employees.filter((e) => e && e.name);

  if (!employees.length) {
    section.innerHTML = `
      <h2>Çalışanlar</h2>
      <p>Henüz çalışan verisi bulunamadı.</p>
    `;
    return;
  }

  const cards = employees
    .map((item, index) => {
      return `
        <div class="employee-card">
          <div class="employee-index">#${index + 1}</div>
          <div class="employee-name">${escapeHtml(item.name)}</div>
          <div class="employee-meta">Rol: ${escapeHtml(item.role || "Belirtilmedi")}</div>
          <div class="employee-meta">Durum: ${item.active === false ? "Pasif" : "Aktif"}</div>
        </div>
      `;
    })
    .join("");

  section.innerHTML = `
    <h2>Çalışanlar</h2>
    <div class="employee-list">${cards}</div>
  `;
}

function renderReportsSection() {
  const section = $("reports");
  if (!section) return;

  const total = state.records.length;
  const low = state.records.filter((r) => Number(r.score) <= 2).length;
  const avg = total
    ? (state.records.reduce((sum, r) => sum + Number(r.score || 0), 0) / total).toFixed(2)
    : "0.00";

  const recent = [...state.records]
    .reverse()
    .slice(0, 8)
    .map((r) => {
      return `
        <div class="report-row">
          <strong>${escapeHtml(r.employeeName || "-")}</strong>
          <span>${escapeHtml(r.criteria || "-")}</span>
          <span>Puan: ${escapeHtml(r.score || "-")}</span>
          <span>Tarih: ${escapeHtml(normalizeDateString(r.date) || "-")}</span>
        </div>
      `;
    })
    .join("");

  section.innerHTML = `
    <h2>Raporlar</h2>
    <div class="report-summary">
      <div>Toplam kayıt: <strong>${total}</strong></div>
      <div>Düşük puan: <strong>${low}</strong></div>
      <div>Ortalama puan: <strong>${avg}</strong></div>
    </div>
    <div class="report-list">
      ${recent || "<p>Henüz kayıt yok.</p>"}
    </div>
  `;
}

function clearFormAfterSave() {
  if ($("employeeSelect")) $("employeeSelect").value = "";
  if ($("criteriaSelect")) $("criteriaSelect").value = "";
  if ($("scoreSelect")) $("scoreSelect").value = "";
  if ($("noteInput")) $("noteInput").value = "";
  setToday();
}

function readBootstrapPayload(data) {
  state.employees = Array.isArray(data?.employees) ? data.employees : [];
  state.criteria = Array.isArray(data?.criteria) ? data.criteria : [];
  state.records = Array.isArray(data?.records) ? data.records : [];
  state.reviewQueue = Array.isArray(data?.reviewQueue) ? data.reviewQueue : [];

  populateEmployeeSelect();
  populateCriteriaSelect();
  renderStats();
  renderEmployeesSection();
  renderReportsSection();
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    cache: "no-store",
    ...options
  });

  const text = await response.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new Error(`Sunucu JSON dönmedi: ${text.slice(0, 200)}`);
  }

  if (!response.ok) {
    throw new Error(json.error || `HTTP hata: ${response.status}`);
  }

  return json;
}

async function loadBootstrap() {
  if (!WEB_APP_URL || WEB_APP_URL.includes("BURAYA_APPS_SCRIPT_EXEC_LINKINI_YAPISTIR")) {
    setStatus("Apps Script URL girilmemiş. app.js içindeki WEB_APP_URL alanını doldur.", true);
    return;
  }

  setStatus("Veriler yükleniyor...");

  try {
    const url = `${WEB_APP_URL}?action=bootstrap&_=${Date.now()}`;
    const json = await fetchJson(url, { method: "GET" });

    if (!json.ok) {
      throw new Error(json.error || "Bootstrap başarısız.");
    }

    readBootstrapPayload(json.data || {});
    setStatus("Sistem hazır. Çalışan ve kriterler yüklendi.");
  } catch (err) {
    console.error("Bootstrap error:", err);
    setStatus(`Veri yüklenemedi: ${err.message}`, true);
  }
}

async function saveEvaluation(event) {
  if (event) event.preventDefault();

  const btn = findSaveButton();
  if (!btn) {
    alert("Kaydet butonu bulunamadı.");
    return;
  }

  const date = $("scoreDate")?.value?.trim() || getTodayYMD();
  const employeeName = $("employeeSelect")?.value?.trim() || "";
  const criteria = $("criteriaSelect")?.value?.trim() || "";
  const score = $("scoreSelect")?.value?.trim() || "";
  const note = $("noteInput")?.value?.trim() || "";

  if (!employeeName) {
    alert("Çalışan seçmeden kaydedemezsin.");
    return;
  }

  if (!criteria) {
    alert("Kriter seçmeden kaydedemezsin.");
    return;
  }

  if (!score) {
    alert("Puan seçmeden kaydedemezsin.");
    return;
  }

  if (!WEB_APP_URL || WEB_APP_URL.includes("BURAYA_APPS_SCRIPT_EXEC_LINKINI_YAPISTIR")) {
    alert("Apps Script URL girilmemiş.");
    return;
  }

  const tgUser = state.telegramUser || {};
  const fullName = tgUser
    ? [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ").trim() || "Bilinmiyor"
    : "Tarayıcı Demo";

  const telegramUsername = tgUser?.username ? `@${tgUser.username}` : "@demo";
  const telegramUserId = tgUser?.id || 0;

  const payload = {
    action: "saveScore",
    date,
    employeeName,
    criteria,
    score: Number(score),
    note,
    telegramUserId,
    telegramUsername,
    fullName
  };

  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Kaydediliyor...";
  setStatus("Kayıt gönderiliyor...");

  try {
    const json = await fetchJson(WEB_APP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!json.ok) {
      throw new Error(json.error || "Kaydetme başarısız.");
    }

    if (json.data) {
      readBootstrapPayload(json.data);
    } else if (json.record) {
      state.records.push(json.record);
      renderStats();
      renderReportsSection();
    }

    clearFormAfterSave();
    switchTab("home");
    setStatus(`Kayıt başarıyla alındı: ${employeeName} / ${criteria} / ${score}`);
    alert("Kayıt başarıyla kaydedildi.");
  } catch (err) {
    console.error("Save error:", err);
    setStatus(`Kaydetme hatası: ${err.message}`, true);
    alert(`Kaydetme hatası: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

function setupSaveButton() {
  const btn = findSaveButton();
  if (!btn) {
    console.warn("Kaydet butonu bulunamadı.");
    return;
  }

  btn.addEventListener("click", saveEvaluation);
}

document.addEventListener("DOMContentLoaded", async () => {
  setupTabs();
  setToday();
  initTelegramInfo();
  setupSaveButton();
  await loadBootstrap();
});
