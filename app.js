const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyBmT4GrkMfU0sF_oIPkXMEWvLBgv3C__kg18R2Ji-Hgq3xdx_8Z-435ZTV4H9dd8rJ/exec";

const $ = (id) => document.getElementById(id);

const APP_STATE = {
  employees: [],
  criteria: [],
  records: [],
  reviewQueue: [],
  currentUser: {
    fullName: "Tarayıcı Demo",
    username: "@demo",
    userId: 0,
    source: "Tarayıcı testi / Telegram dışı açılış"
  }
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateTR(iso) {
  if (!iso) return "-";
  const parts = String(iso).split("-");
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return String(iso);
}

function formatDateTimeTR(text) {
  if (!text) return "-";
  return String(text).replace(" ", " / ");
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

function setToday() {
  const input = $("scoreDate");
  if (input) input.value = todayIso();
}

function initTelegramInfo() {
  const tg = window.Telegram?.WebApp;

  if (tg) {
    try {
      tg.ready();
      tg.expand();
    } catch (err) {}
  }

  const user = tg?.initDataUnsafe?.user || null;

  const fullName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(" ").trim()
    : "Tarayıcı Demo";

  const username = user?.username ? `@${user.username}` : "@demo";
  const userId = user?.id || 0;
  const source = user ? "Telegram Mini App" : "Tarayıcı testi / Telegram dışı açılış";

  APP_STATE.currentUser = {
    fullName,
    username,
    userId,
    source
  };

  $("userChip").textContent = fullName;
  $("userInfo").textContent = `Kullanıcı: ${fullName} | ${username} | ID: ${userId}`;
  $("sourceInfo").textContent = `Kaynak: ${source}`;
  $("statusText").textContent = user
    ? "Telegram kullanıcı bilgisi başarıyla alındı."
    : "Telegram dışı açılış. Bu normal.";
}

function setStatus(message, isError = false) {
  const el = $("statusText");
  el.textContent = message;
  el.classList.toggle("status-error", isError);
}

async function fetchBootstrap() {
  if (!WEB_APP_URL || WEB_APP_URL.includes("BURAYA_APPS_SCRIPT")) {
    throw new Error("WEB_APP_URL alanına Apps Script /exec linki girilmemiş.");
  }

  const url = `${WEB_APP_URL}?action=getBootstrap&_=${Date.now()}`;
  const response = await fetch(url, {
    method: "GET"
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(data.error || "Bootstrap verisi alınamadı.");
  }

  return data.data || {
    employees: [],
    criteria: [],
    records: [],
    reviewQueue: []
  };
}

async function saveRecord(payload) {
  if (!WEB_APP_URL || WEB_APP_URL.includes("BURAYA_APPS_SCRIPT")) {
    throw new Error("WEB_APP_URL alanına Apps Script /exec linki girilmemiş.");
  }

  const response = await fetch(WEB_APP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({
      action: "saveScore",
      ...payload
    })
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(data.error || "Kayıt kaydedilemedi.");
  }

  return data;
}

function normalizeEmployees(rawEmployees) {
  return (rawEmployees || [])
    .filter((item) => item && item.name)
    .map((item) => ({
      name: String(item.name).trim(),
      role: String(item.role || "Belirtilmedi").trim() || "Belirtilmedi",
      active: item.active !== false
    }));
}

function normalizeCriteria(rawCriteria) {
  return (rawCriteria || [])
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function normalizeRecords(rawRecords) {
  return (rawRecords || [])
    .filter((item) => item && item.employeeName)
    .map((item) => ({
      createdAt: item.createdAt || "",
      date: item.date || "",
      employeeName: String(item.employeeName || "").trim(),
      criteria: String(item.criteria || "").trim(),
      score: Number(item.score || 0),
      note: String(item.note || "").trim(),
      telegramUserId: String(item.telegramUserId || "").trim(),
      telegramUsername: String(item.telegramUsername || "").trim(),
      fullName: String(item.fullName || "").trim(),
      review: Boolean(item.review)
    }));
}

function hydrateState(data) {
  APP_STATE.employees = normalizeEmployees(data.employees);
  APP_STATE.criteria = normalizeCriteria(data.criteria);
  APP_STATE.records = normalizeRecords(data.records);
  APP_STATE.reviewQueue = Array.isArray(data.reviewQueue)
    ? data.reviewQueue
    : APP_STATE.records.filter((r) => Number(r.score) <= 2);
}

function populateEmployeeSelect() {
  const select = $("employeeSelect");
  select.innerHTML = `<option value="">Çalışan seç</option>`;

  APP_STATE.employees
    .filter((emp) => emp.active)
    .sort((a, b) => a.name.localeCompare(b.name, "tr"))
    .forEach((emp) => {
      const opt = document.createElement("option");
      opt.value = emp.name;
      opt.textContent = emp.name;
      select.appendChild(opt);
    });
}

function populateCriteriaSelect() {
  const select = $("criteriaSelect");
  select.innerHTML = `<option value="">Kriter seç</option>`;

  APP_STATE.criteria.forEach((criterion) => {
    const opt = document.createElement("option");
    opt.value = criterion;
    opt.textContent = criterion;
    select.appendChild(opt);
  });
}

function updateStats() {
  const activeEmployees = APP_STATE.employees.filter((emp) => emp.active).length;
  const today = todayIso();
  const todayCount = APP_STATE.records.filter((r) => r.date === today).length;
  const lowScoreCount = APP_STATE.records.filter((r) => Number(r.score) <= 2).length;

  $("activeCount").textContent = String(activeEmployees);
  $("todayCount").textContent = String(todayCount);
  $("lowScoreCount").textContent = String(lowScoreCount);
}

function getEmployeeStatsMap() {
  const map = {};

  APP_STATE.employees.forEach((emp) => {
    map[emp.name] = {
      name: emp.name,
      role: emp.role,
      active: emp.active,
      total: 0,
      low: 0,
      sum: 0,
      avg: 0
    };
  });

  APP_STATE.records.forEach((rec) => {
    if (!map[rec.employeeName]) {
      map[rec.employeeName] = {
        name: rec.employeeName,
        role: "Belirtilmedi",
        active: true,
        total: 0,
        low: 0,
        sum: 0,
        avg: 0
      };
    }

    map[rec.employeeName].total += 1;
    map[rec.employeeName].sum += Number(rec.score || 0);

    if (Number(rec.score) <= 2) {
      map[rec.employeeName].low += 1;
    }
  });

  Object.values(map).forEach((item) => {
    item.avg = item.total ? (item.sum / item.total).toFixed(2) : "0.00";
  });

  return map;
}

function renderEmployees() {
  const box = $("employeeList");
  const pill = $("employeeCountPill");
  const map = getEmployeeStatsMap();
  const list = Object.values(map).sort((a, b) => a.name.localeCompare(b.name, "tr"));

  pill.textContent = `${list.length} kişi`;

  if (!list.length) {
    box.innerHTML = `<div class="empty-state">Henüz çalışan verisi bulunamadı.</div>`;
    return;
  }

  box.innerHTML = list
    .map((emp) => {
      const statusClass = emp.active ? "badge-green" : "badge-red";
      const statusText = emp.active ? "Aktif" : "Pasif";

      return `
        <div class="employee-card">
          <div class="employee-top">
            <div>
              <div class="employee-name">${escapeHtml(emp.name)}</div>
              <div class="employee-role">${escapeHtml(emp.role)}</div>
            </div>
            <div class="badge ${statusClass}">${statusText}</div>
          </div>

          <div class="employee-stats">
            <div class="mini-stat">
              <span>Kayıt</span>
              <strong>${emp.total}</strong>
            </div>
            <div class="mini-stat">
              <span>Ort.</span>
              <strong>${emp.avg}</strong>
            </div>
            <div class="mini-stat">
              <span>Düşük</span>
              <strong>${emp.low}</strong>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderReports() {
  const summary = $("reportSummary");
  const tbody = $("recentRecordsBody");
  const pill = $("reportCountPill");

  const total = APP_STATE.records.length;
  const today = todayIso();
  const todayTotal = APP_STATE.records.filter((r) => r.date === today).length;
  const lowTotal = APP_STATE.records.filter((r) => Number(r.score) <= 2).length;
  const avgScore = total
    ? (
        APP_STATE.records.reduce((acc, item) => acc + Number(item.score || 0), 0) / total
      ).toFixed(2)
    : "0.00";

  pill.textContent = `${total} kayıt`;

  summary.innerHTML = `
    <div class="summary-card">
      <div class="summary-label">Toplam kayıt</div>
      <div class="summary-value">${total}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Ortalama puan</div>
      <div class="summary-value">${avgScore}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Bugünkü kayıt</div>
      <div class="summary-value">${todayTotal}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">İnceleme kuyruğu</div>
      <div class="summary-value">${lowTotal}</div>
    </div>
  `;

  const recent = [...APP_STATE.records].reverse().slice(0, 15);

  if (!recent.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-td">Henüz kayıt yok.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = recent
    .map((rec) => {
      const scoreClass = Number(rec.score) <= 2 ? "score-bad" : "score-good";
      return `
        <tr>
          <td>${escapeHtml(formatDateTR(rec.date))}</td>
          <td>${escapeHtml(rec.employeeName)}</td>
          <td>${escapeHtml(rec.criteria)}</td>
          <td><span class="score-pill ${scoreClass}">${escapeHtml(rec.score)}</span></td>
          <td>${escapeHtml(rec.note || "-")}</td>
          <td>${escapeHtml(rec.fullName || rec.telegramUsername || "-")}</td>
        </tr>
      `;
    })
    .join("");
}

function collectFormData() {
  return {
    date: $("scoreDate").value,
    employeeName: $("employeeSelect").value,
    criteria: $("criteriaSelect").value,
    score: $("scoreSelect").value,
    note: $("noteInput").value.trim(),
    telegramUserId: APP_STATE.currentUser.userId,
    telegramUsername: APP_STATE.currentUser.username,
    fullName: APP_STATE.currentUser.fullName
  };
}

function validateForm(data) {
  if (!data.date) return "Tarih boş olamaz.";
  if (!data.employeeName) return "Çalışan seç.";
  if (!data.criteria) return "Kriter seç.";
  if (!data.score) return "Puan seç.";
  return "";
}

function resetFormAfterSave() {
  $("scoreSelect").value = "";
  $("noteInput").value = "";
}

async function loadBootstrapAndRender() {
  setStatus("Sistem verileri yükleniyor...");
  const data = await fetchBootstrap();
  hydrateState(data);
  populateEmployeeSelect();
  populateCriteriaSelect();
  updateStats();
  renderEmployees();
  renderReports();
  setStatus("Sistem hazır. Çalışan ve kriterler sheet üzerinden yüklendi.");
}

async function handleSaveClick() {
  const btn = $("saveBtn");
  const payload = collectFormData();
  const validationError = validateForm(payload);

  if (validationError) {
    alert(validationError);
    return;
  }

  btn.disabled = true;
  btn.textContent = "Kaydediliyor...";

  try {
    const result = await saveRecord(payload);

    if (result.data) {
      hydrateState(result.data);
    } else {
      const fresh = await fetchBootstrap();
      hydrateState(fresh);
    }

    populateEmployeeSelect();
    populateCriteriaSelect();
    updateStats();
    renderEmployees();
    renderReports();
    resetFormAfterSave();

    setStatus(
      `Kayıt başarıyla kaydedildi: ${payload.employeeName} / ${payload.criteria} / ${payload.score}`
    );

    switchTab("home");
  } catch (err) {
    console.error(err);
    setStatus(`Hata: ${err.message || err}`, true);
    alert(`Kayıt sırasında hata oluştu:\n${err.message || err}`);
  } finally {
    btn.disabled = false;
    btn.textContent = "Kaydet";
  }
}

function setupActions() {
  $("saveBtn").addEventListener("click", handleSaveClick);
}

document.addEventListener("DOMContentLoaded", async () => {
  setupTabs();
  setToday();
  initTelegramInfo();
  setupActions();

  try {
    await loadBootstrapAndRender();
  } catch (err) {
    console.error(err);
    setStatus(`Veri yükleme hatası: ${err.message || err}`, true);
  }
});
