const $ = (id) => document.getElementById(id);

// BURAYI KENDİ APPS SCRIPT WEB APP URL'N İLE DEĞİŞTİR
const API_BASE_URL = "https://script.google.com/macros/s/AKfycbyBmT4GrkMfU0sF_oIPkXMEWvLBgv3C__kg18R2Ji-Hgq3xdx_8Z-435ZTV4H9dd8rJ/exec";

let APP_USER = null;

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

function initTelegramInfo() {
  const tg = window.Telegram?.WebApp;

  if (tg) {
    try {
      tg.ready();
      tg.expand();
    } catch (e) {}
  }

  const user = tg?.initDataUnsafe?.user || null;

  const fullName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(" ").trim()
    : "Tarayıcı Demo";

  const username = user?.username ? `@${user.username}` : "";
  const userId = user?.id ? String(user.id) : "";

  APP_USER = {
    telegramId: userId,
    fullName,
    username
  };

  if ($("userChip")) $("userChip").textContent = fullName || "Bilinmiyor";
  if ($("userInfo")) $("userInfo").textContent = `Kullanıcı: ${fullName} ${username} ${userId}`.trim();
  if ($("sourceInfo")) $("sourceInfo").textContent = user
    ? "Kaynak: Telegram Mini App"
    : "Kaynak: Web Demo";
  if ($("statusText")) $("statusText").textContent = "Panel hazır.";
}

async function apiCall(payload) {
  const res = await fetch(API_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload)
  });

  const text = await res.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new Error("API JSON dönmedi: " + text);
  }

  if (!json.ok) {
    throw new Error(json.error || "Sunucu hatası");
  }

  return json;
}

function renderEmployees(employees) {
  const select = $("employeeSelect");
  const list = $("employeeList");
  const pill = $("employeeCountPill");

  if (select) {
    select.innerHTML = `<option value="">Çalışan seç</option>`;
    employees.forEach((emp) => {
      const opt = document.createElement("option");
      opt.value = emp.full_name;
      opt.textContent = emp.full_name;
      select.appendChild(opt);
    });
  }

  if (pill) {
    pill.textContent = `${employees.length} kişi`;
  }

  if (!list) return;

  if (!employees.length) {
    list.innerHTML = `<div class="employee-card"><div class="employee-name">Kayıtlı çalışan yok</div><div class="employee-sub">Users sayfasında aktif çalışan bulunamadı.</div></div>`;
    return;
  }

  list.innerHTML = employees.map((emp) => `
    <div class="employee-card">
      <div class="employee-name">${escapeHtml(emp.full_name || "-")}</div>
      <div class="employee-sub">${escapeHtml(emp.username || "")}</div>
    </div>
  `).join("");
}

function renderSummary(summary) {
  const wrap = $("reportSummary");
  if (!wrap) return;

  wrap.innerHTML = `
    <div class="summary-box">
      <div class="summary-label">Toplam kayıt</div>
      <div class="summary-value">${summary.totalRecords || 0}</div>
    </div>
    <div class="summary-box">
      <div class="summary-label">Bugünkü kayıt</div>
      <div class="summary-value">${summary.todayCount || 0}</div>
    </div>
    <div class="summary-box">
      <div class="summary-label">Düşük puan</div>
      <div class="summary-value">${summary.lowScoreCount || 0}</div>
    </div>
  `;
}

function renderRecentRecords(records) {
  const body = $("recentRecordsBody");
  const pill = $("reportCountPill");

  if (pill) pill.textContent = `${records.length} kayıt`;

  if (!body) return;

  if (!records.length) {
    body.innerHTML = `
      <tr>
        <td colspan="6" class="empty-td">Henüz kayıt yok.</td>
      </tr>
    `;
    return;
  }

  body.innerHTML = records.map((r) => `
    <tr>
      <td>${escapeHtml(r.score_date || "-")}</td>
      <td>${escapeHtml(r.employee_name || "-")}</td>
      <td>${escapeHtml(r.criteria || "-")}</td>
      <td>${escapeHtml(String(r.score || "-"))}</td>
      <td>${escapeHtml(r.note || "-")}</td>
      <td>${escapeHtml(r.created_by_name || "-")}</td>
    </tr>
  `).join("");
}

async function loadInitData() {
  const result = await apiCall({
    action: "getInitData",
    user: APP_USER || {}
  });

  const employees = result.employees || [];
  const records = result.recentRecords || [];
  const summary = result.summary || {};

  if ($("activeCount")) $("activeCount").textContent = String(summary.activeEmployees || 0);
  if ($("todayCount")) $("todayCount").textContent = String(summary.todayCount || 0);
  if ($("lowScoreCount")) $("lowScoreCount").textContent = String(summary.lowScoreCount || 0);

  renderEmployees(employees);
  renderSummary(summary);
  renderRecentRecords(records);

  if ($("statusText")) $("statusText").textContent = "Veriler yüklendi.";
}

function getCriteriaScores() {
  const scores = {};
  document.querySelectorAll(".criteria-score").forEach((select) => {
    const criteria = select.dataset.criteria || "";
    const value = select.value ? Number(select.value) : null;
    if (criteria) {
      scores[criteria] = value;
    }
  });
  return scores;
}

function hasLowScore(scores) {
  return Object.values(scores).some((v) => Number(v) === 1 || Number(v) === 2);
}

function updateProofRequirement() {
  const scores = getCriteriaScores();
  const low = hasLowScore(scores);

  const wrap = $("proofWrap");
  const input = $("proofFile");

  if (!wrap || !input) return;

  if (low) {
    wrap.classList.remove("hidden");
    input.required = true;
  } else {
    wrap.classList.add("hidden");
    input.required = false;
    input.value = "";
  }
}

function bindCriteriaWatchers() {
  document.querySelectorAll(".criteria-score").forEach((select) => {
    select.addEventListener("change", updateProofRequirement);
  });
}

function validateForm(scores) {
  const date = $("scoreDate")?.value || "";
  const employee = $("employeeSelect")?.value || "";
  const note = $("noteInput")?.value?.trim() || "";

  if (!date) {
    throw new Error("Tarih seçmeden kaydedemezsin.");
  }

  if (!employee) {
    throw new Error("Çalışan seçmeden kaydedemezsin.");
  }

  const filled = Object.values(scores).filter((v) => v !== null);
  if (!filled.length) {
    throw new Error("Kriter puanı girmeden kaydedemezsin.");
  }

  const hasEmpty = Object.values(scores).some((v) => v === null);
  if (hasEmpty) {
    throw new Error("Tüm kriterleri puanlamadan kaydedemezsin.");
  }

  if (hasLowScore(scores) && !note) {
    throw new Error("1 veya 2 puan verildiğinde not zorunludur.");
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadProofIfNeeded(employeeName, note, scores) {
  const low = hasLowScore(scores);
  const input = $("proofFile");

  if (!low) return null;

  if (!input || !input.files || !input.files[0]) {
    throw new Error("1 veya 2 puan verildiği için belge/görsel yüklemek zorunludur.");
  }

  const file = input.files[0];
  const base64 = await fileToBase64(file);

  const result = await apiCall({
    action: "uploadProof",
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    base64,
    employeeName,
    note,
    scores,
    uploadedBy: APP_USER || {}
  });

  return result.fileMeta || null;
}

function resetForm() {
  document.querySelectorAll(".criteria-score").forEach((select) => {
    select.value = "";
  });

  if ($("noteInput")) $("noteInput").value = "";
  if ($("proofFile")) $("proofFile").value = "";
  updateProofRequirement();
}

async function saveEvaluation() {
  const btn = $("saveBtn");

  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Kaydediliyor...";
    }

    const date = $("scoreDate")?.value || "";
    const employeeName = $("employeeSelect")?.value || "";
    const note = $("noteInput")?.value?.trim() || "";
    const scores = getCriteriaScores();

    validateForm(scores);

    const proofMeta = await uploadProofIfNeeded(employeeName, note, scores);

    const result = await apiCall({
      action: "saveDailyEvaluation",
      date,
      employeeName,
      note,
      scores,
      proofMeta,
      createdBy: APP_USER || {}
    });

    alert(result.message || "Kayıt başarıyla alındı.");
    if ($("statusText")) $("statusText").textContent = result.message || "Kayıt başarıyla alındı.";

    resetForm();
    switchTab("home");
    await loadInitData();
  } catch (err) {
    alert(err.message || "Kaydetme hatası oluştu.");
    if ($("statusText")) $("statusText").textContent = "Hata: " + (err.message || "Bilinmeyen hata");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Kaydet";
    }
  }
}

function setupSaveButton() {
  const btn = $("saveBtn");
  if (!btn) return;
  btn.addEventListener("click", saveEvaluation);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    setupTabs();
    setToday();
    initTelegramInfo();
    bindCriteriaWatchers();
    updateProofRequirement();
    setupSaveButton();
    await loadInitData();
  } catch (err) {
    console.error(err);
    if ($("statusText")) {
      $("statusText").textContent = "Başlangıç hatası: " + (err.message || "Bilinmeyen hata");
    }
  }
});
