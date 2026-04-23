const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyBmT4GrkMfU0sF_oIPkXMEWvLBgv3C__kg18R2Ji-Hgq3xdx_8Z-435ZTV4H9dd8rJ/exec";

const $ = (id) => document.getElementById(id);

const state = {
  employees: [],
  criteria: [],
  records: [],
  reviewQueue: [],
  telegramUser: null
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

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  input.value = `${yyyy}-${mm}-${dd}`;
}

function getTodayString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDateTR(value) {
  if (!value) return "-";

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}.${m}.${y}`;
  }

  return value;
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
  state.telegramUser = user;

  const fullName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(" ").trim()
    : "Tarayıcı Demo";

  const username = user?.username ? `@${user.username}` : "@demo";
  const userId = user?.id || 0;

  if ($("userChip")) $("userChip").textContent = user ? fullName : "Tarayıcı Demo";
  if ($("userInfo")) $("userInfo").textContent = `Kullanıcı: ${fullName} | ${username} | ID: ${userId}`;
  if ($("sourceInfo")) $("sourceInfo").textContent = user
    ? "Kaynak: Telegram Mini App"
    : "Kaynak: Tarayıcı testi / Telegram dışı açılış";
}

async function fetchJsonFromResponse(response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Geçersiz sunucu cevabı: ${text.slice(0, 200)}`);
  }
}

async function loadBootstrap() {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes("BURAYA_APPS_SCRIPT_EXEC_LINKINI_YAPISTIR")) {
    throw new Error("APPS_SCRIPT_URL boş. app.js içine /exec linkini yapıştır.");
  }

  if ($("statusText")) $("statusText").textContent = "Veriler yükleniyor...";

  const url = `${APPS_SCRIPT_URL}?action=bootstrap&_=${Date.now()}`;

  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
    cache: "no-store"
  });

  const result = await fetchJsonFromResponse(response);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  if (!result.ok) {
    throw new Error(result.error || "Bootstrap verisi alınamadı.");
  }

  const data = result.data || {};

  state.employees = Array.isArray(data.employees) ? data.employees : [];
  state.criteria = Array.isArray(data.criteria) ? data.criteria : [];
  state.records = Array.isArray(data.records) ? data.records : [];
  state.reviewQueue = Array.isArray(data.reviewQueue) ? data.reviewQueue : [];

  populateEmployeeSelect();
  populateCriteriaSelect();
  renderEmployees();
  renderReports();
  updateStats();

  if ($("statusText")) $("statusText").textContent = "Sistem hazır. Veriler yüklendi.";
}

function populateEmployeeSelect() {
  const select = $("employeeSelect");
  if (!select) return;

  select.innerHTML = `<option value="">Çalışan seç</option>`;

  state.employees.forEach((employee) => {
    if (!employee || !employee.name) return;
    if (employee.active === false) return;

    const opt = document.createElement("option");
    opt.value = employee.name;
    opt.textContent = employee.name;
    select.appendChild(opt);
  });
}

function populateCriteriaSelect() {
  const select = $("criteriaSelect");
  if (!select) return;

  select.innerHTML = `<option value="">Kriter seç</option>`;

  state.criteria.forEach((criteria) => {
    const opt = document.createElement("option");
    opt.value = criteria;
    opt.textContent = criteria;
    select.appendChild(opt);
  });
}

function updateStats() {
  const activeEmployees = state.employees.filter((x) => x && x.active !== false).length;
  const today = getTodayString();
  const todayRecords = state.records.filter((x) => x.date === today).length;
  const lowScoreRecords = state.records.filter((x) => Number(x.score) <= 2).length;

  if ($("activeCount")) $("activeCount").textContent = String(activeEmployees);
  if ($("todayCount")) $("todayCount").textContent = String(todayRecords);
  if ($("lowScoreCount")) $("lowScoreCount").textContent = String(lowScoreRecords);

  if ($("employeeCountPill")) {
    $("employeeCountPill").textContent = `${activeEmployees} kişi`;
  }

  if ($("reportCountPill")) {
    $("reportCountPill").textContent = `${state.records.length} kayıt`;
  }
}

function renderEmployees() {
  const wrap = $("employeeList");
  if (!wrap) return;

  if (!state.employees.length) {
    wrap.innerHTML = `<div class="empty-box">Çalışan verisi bulunamadı.</div>`;
    return;
  }

  wrap.innerHTML = state.employees
    .filter((employee) => employee && employee.name)
    .map((employee, index) => {
      const role = employee.role || "Belirtilmedi";
      const activeText = employee.active === false ? "Pasif" : "Aktif";

      return `
        <div class="employee-card">
          <div class="employee-no">#${index + 1}</div>
          <div class="employee-name">${escapeHtml(employee.name)}</div>
          <div class="employee-meta">Rol: ${escapeHtml(role)}</div>
          <div class="employee-meta">Durum: ${escapeHtml(activeText)}</div>
        </div>
      `;
    })
    .join("");
}

function buildReportSummary() {
  const total = state.records.length;
  const low = state.records.filter((x) => Number(x.score) <= 2).length;

  let average = 0;
  if (total > 0) {
    const sum = state.records.reduce((acc, item) => acc + Number(item.score || 0), 0);
    average = sum / total;
  }

  return [
    { label: "Toplam kayıt", value: total },
    { label: "İnceleme gereken", value: low },
    { label: "Ortalama puan", value: total ? average.toFixed(2) : "0.00" }
  ];
}

function renderReports() {
  const summaryWrap = $("reportSummary");
  const body = $("recentRecordsBody");

  const summary = buildReportSummary();

  if (summaryWrap) {
    summaryWrap.innerHTML = summary
      .map((item) => {
        return `
          <div class="summary-card">
            <div class="summary-label">${escapeHtml(item.label)}</div>
            <div class="summary-value">${escapeHtml(item.value)}</div>
          </div>
        `;
      })
      .join("");
  }

  if (!body) return;

  if (!state.records.length) {
    body.innerHTML = `
      <tr>
        <td colspan="6" class="empty-td">Henüz kayıt yok.</td>
      </tr>
    `;
    return;
  }

  const recent = [...state.records].reverse().slice(0, 15);

  body.innerHTML = recent
    .map((item) => {
      return `
        <tr>
          <td>${escapeHtml(formatDateTR(item.date))}</td>
          <td>${escapeHtml(item.employeeName || "-")}</td>
          <td>${escapeHtml(item.criteria || "-")}</td>
          <td>${escapeHtml(item.score || "-")}</td>
          <td>${escapeHtml(item.note || "-")}</td>
          <td>${escapeHtml(item.fullName || item.telegramUsername || "-")}</td>
        </tr>
      `;
    })
    .join("");
}

function getCurrentUserPayload() {
  const user = state.telegramUser;

  if (!user) {
    return {
      telegramUserId: "0",
      telegramUsername: "@demo",
      fullName: "Tarayıcı Demo"
    };
  }

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();

  return {
    telegramUserId: String(user.id || 0),
    telegramUsername: user.username ? `@${user.username}` : "@yok",
    fullName: fullName || "Telegram Kullanıcı"
  };
}

async function saveRecordToApi(payload) {
  const formData = new URLSearchParams();

  Object.entries(payload).forEach(([key, value]) => {
    formData.append(key, value == null ? "" : String(value));
  });

  const response = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    body: formData,
    redirect: "follow",
    cache: "no-store"
  });

  const result = await fetchJsonFromResponse(response);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  if (!result.ok) {
    throw new Error(result.error || "Kayıt kaydedilemedi.");
  }

  return result;
}

function resetFormAfterSave() {
  if ($("scoreSelect")) $("scoreSelect").value = "";
  if ($("criteriaSelect")) $("criteriaSelect").value = "";
  if ($("noteInput")) $("noteInput").value = "";
}

function setupSaveButton() {
  const btn = $("saveBtn");
  if (!btn) return;

  btn.removeEventListener("click", handleSaveClick);
  btn.addEventListener("click", handleSaveClick);
}

async function handleSaveClick() {
  const btn = $("saveBtn");
  const employeeName = $("employeeSelect")?.value?.trim() || "";
  const criteria = $("criteriaSelect")?.value?.trim() || "";
  const score = $("scoreSelect")?.value?.trim() || "";
  const note = $("noteInput")?.value?.trim() || "";
  const date = $("scoreDate")?.value?.trim() || getTodayString();

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

  try {
    btn.disabled = true;
    btn.textContent = "Kaydediliyor...";

    if ($("statusText")) {
      $("statusText").textContent = "Kayıt gönderiliyor...";
    }

    const userPayload = getCurrentUserPayload();

    const result = await saveRecordToApi({
      action: "saveScore",
      date,
      employeeName,
      criteria,
      score,
      note,
      telegramUserId: userPayload.telegramUserId,
      telegramUsername: userPayload.telegramUsername,
      fullName: userPayload.fullName
    });

    if (result.data) {
      state.employees = Array.isArray(result.data.employees) ? result.data.employees : state.employees;
      state.criteria = Array.isArray(result.data.criteria) ? result.data.criteria : state.criteria;
      state.records = Array.isArray(result.data.records) ? result.data.records : state.records;
      state.reviewQueue = Array.isArray(result.data.reviewQueue) ? result.data.reviewQueue : state.reviewQueue;
    } else if (result.record) {
      state.records.push(result.record);
    }

    populateEmployeeSelect();
    populateCriteriaSelect();
    renderEmployees();
    renderReports();
    updateStats();
    resetFormAfterSave();

    if ($("statusText")) {
      $("statusText").textContent = `${employeeName} için kayıt başarıyla kaydedildi.`;
    }

    switchTab("home");
    alert("Kayıt başarıyla kaydedildi.");
  } catch (err) {
    console.error("Kaydetme hatası:", err);
    if ($("statusText")) {
      $("statusText").textContent = `Kayıt hatası: ${err.message}`;
    }
    alert(`Kaydetme hatası: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = "Kaydet";
  }
}

async function initApp() {
  setupTabs();
  setToday();
  initTelegramInfo();
  setupSaveButton();

  try {
    await loadBootstrap();
  } catch (err) {
    console.error("Bootstrap hatası:", err);
    if ($("statusText")) {
      $("statusText").textContent = `Veri yükleme hatası: ${err.message}`;
    }
    alert(`Veri yükleme hatası: ${err.message}`);
  }
}

document.addEventListener("DOMContentLoaded", initApp);
