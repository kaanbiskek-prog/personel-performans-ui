const API_BASE_URL = "BURAYA_APPS_SCRIPT_WEB_APP_URL";

const STATE = {
  tgUser: null,
  permissions: {
    isKnownUser: false,
    isAdmin: false,
    canScore: false,
    canViewReports: false
  },
  employees: [],
  criteria: [],
  reports: null
};

const $ = (id) => document.getElementById(id);

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

  STATE.tgUser = user
    ? {
        id: String(user.id || ""),
        username: user.username ? String(user.username).replace(/^@/, "") : "",
        fullName: [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || "Adsız Kullanıcı"
      }
    : {
        id: "",
        username: "demo",
        fullName: "Tarayıcı Demo"
      };

  $("userChip").textContent = user ? STATE.tgUser.fullName : "Tarayıcı Demo";
  $("userInfo").textContent = `Kullanıcı: ${STATE.tgUser.fullName} | @${STATE.tgUser.username || "yok"} | ID: ${STATE.tgUser.id || "-"}`;
  $("sourceInfo").textContent = user
    ? "Kaynak: Telegram Mini App"
    : "Kaynak: Tarayıcı testi / Telegram dışı açılış";
}

function showAppAlert(message) {
  const tg = window.Telegram?.WebApp;
  if (tg?.showAlert) {
    tg.showAlert(message);
  } else {
    alert(message);
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatAvg(value) {
  if (value === null || value === undefined || value === "") return "-";
  const num = Number(value);
  if (Number.isNaN(num)) return "-";
  return num.toFixed(2);
}

function setStatus(text) {
  $("statusText").textContent = text;
}

async function apiGet(action, params = {}) {
  const url = new URL(API_BASE_URL);
  url.searchParams.set("action", action);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value == null ? "" : String(value));
  });

  const res = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store"
  });

  const data = await res.json();
  return data;
}

async function apiPost(payload) {
  const res = await fetch(API_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  return data;
}

function renderPermissionUI() {
  const canScore = !!STATE.permissions.canScore;
  const canViewReports = !!STATE.permissions.canViewReports;

  $("tabDaily").classList.toggle("hidden-tab", !canScore);
  $("tabReports").classList.toggle("hidden-tab", !canViewReports);

  if (!canScore && document.querySelector('.tab.active[data-tab="daily"]')) {
    switchTab("home");
  }

  if (!canViewReports && document.querySelector('.tab.active[data-tab="reports"]')) {
    switchTab("home");
  }
}

function renderStats() {
  $("activeCount").textContent = String(STATE.employees.length);
  $("todayCount").textContent = String(STATE.reports?.todayCount || 0);
  $("lowScoreCount").textContent = String(STATE.reports?.lowScoreCount || 0);
}

function renderEmployeeSelect() {
  const select = $("employeeSelect");
  select.innerHTML = `<option value="">Çalışan seç</option>`;

  STATE.employees.forEach((employee) => {
    const option = document.createElement("option");
    option.value = employee.name;
    option.textContent = employee.name;
    select.appendChild(option);
  });
}

function renderEmployees() {
  const wrap = $("employeeList");
  $("employeeCountPill").textContent = `${STATE.employees.length} kişi`;

  if (!STATE.employees.length) {
    wrap.innerHTML = `<div class="empty-block">Henüz çalışan yok.</div>`;
    return;
  }

  wrap.innerHTML = STATE.employees
    .map(
      (employee, index) => `
        <div class="employee-card">
          <div class="employee-order">#${index + 1}</div>
          <div class="employee-name">${escapeHtml(employee.name)}</div>
          <div class="employee-meta">
            Rol: ${escapeHtml(employee.role || "çalışan")}<br>
            Durum: ${employee.active ? "Aktif" : "Pasif"}
          </div>
        </div>
      `
    )
    .join("");
}

function renderCriteriaInputs() {
  const employeeName = $("employeeSelect").value;
  const wrap = $("criteriaList");

  if (!employeeName) {
    $("criteriaCountPill").textContent = `0 kriter`;
    $("criteriaHelpText").textContent = "Çalışan seçildiğinde tüm aktif kriterler burada açılır.";
    wrap.innerHTML = `<div class="empty-block">Henüz çalışan seçilmedi.</div>`;
    return;
  }

  if (!STATE.criteria.length) {
    $("criteriaCountPill").textContent = `0 kriter`;
    wrap.innerHTML = `<div class="empty-block">Aktif kriter bulunamadı.</div>`;
    return;
  }

  $("criteriaCountPill").textContent = `${STATE.criteria.length} kriter`;
  $("criteriaHelpText").textContent = `${employeeName} için tüm kriterlere tek ekranda puan verebilirsin.`;

  wrap.innerHTML = STATE.criteria
    .map(
      (criterion) => `
        <div class="criteria-item">
          <div class="criteria-left">
            <div class="criteria-code">${escapeHtml(criterion.code)}</div>
            <div class="criteria-name">${escapeHtml(criterion.name)}</div>
          </div>
          <div class="criteria-select-wrap">
            <select class="criterion-score" data-code="${escapeHtml(criterion.code)}" data-name="${escapeHtml(criterion.name)}">
              <option value="">Puan seç</option>
              <option value="1">1 - Çok Zayıf</option>
              <option value="2">2 - Zayıf</option>
              <option value="3">3 - Orta</option>
              <option value="4">4 - İyi</option>
              <option value="5">5 - Çok İyi</option>
            </select>
          </div>
        </div>
      `
    )
    .join("");
}

function renderReports() {
  const summaryWrap = $("reportSummary");
  const averageBody = $("averageRowsBody");
  const recentBody = $("recentRecordsBody");

  if (!STATE.permissions.canViewReports) {
    $("reportCountPill").textContent = `Yetkisiz`;
    summaryWrap.innerHTML = `<div class="locked-note">Bu alanı görüntüleme yetkin yok.</div>`;
    averageBody.innerHTML = `<tr><td colspan="4" class="empty-td">Rapor yetkin yok.</td></tr>`;
    recentBody.innerHTML = `<tr><td colspan="6" class="empty-td">Rapor yetkin yok.</td></tr>`;
    return;
  }

  const reports = STATE.reports || {
    totalRecords: 0,
    todayCount: 0,
    lowScoreCount: 0,
    todayAverage: 0,
    monthAverage: 0,
    employeeAverages: [],
    recentRecords: []
  };

  $("reportCountPill").textContent = `${reports.totalRecords || 0} kayıt`;

  summaryWrap.innerHTML = `
    <div class="summary-card">
      <div class="summary-label">Bugünkü Ortalama</div>
      <div class="summary-value">${formatAvg(reports.todayAverage)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Aylık Ortalama</div>
      <div class="summary-value">${formatAvg(reports.monthAverage)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Bugünkü Kayıt</div>
      <div class="summary-value">${reports.todayCount || 0}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Düşük Puan</div>
      <div class="summary-value">${reports.lowScoreCount || 0}</div>
    </div>
  `;

  if (!reports.employeeAverages?.length) {
    averageBody.innerHTML = `<tr><td colspan="4" class="empty-td">Henüz ortalama verisi yok.</td></tr>`;
  } else {
    averageBody.innerHTML = reports.employeeAverages
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.employee)}</td>
            <td>${formatAvg(row.todayAverage)}</td>
            <td>${formatAvg(row.monthAverage)}</td>
            <td>${row.totalCount || 0}</td>
          </tr>
        `
      )
      .join("");
  }

  if (!reports.recentRecords?.length) {
    recentBody.innerHTML = `<tr><td colspan="6" class="empty-td">Henüz kayıt yok.</td></tr>`;
  } else {
    recentBody.innerHTML = reports.recentRecords
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.date)}</td>
            <td>${escapeHtml(row.employee)}</td>
            <td>${escapeHtml(row.criterion)}</td>
            <td>${escapeHtml(row.score)}</td>
            <td>${escapeHtml(row.note || "-")}</td>
            <td>${escapeHtml(row.enteredBy || "-")}</td>
          </tr>
        `
      )
      .join("");
  }
}

async function loadBootstrap() {
  try {
    setStatus("Veriler yükleniyor...");

    const data = await apiGet("bootstrap", {
      tgUserId: STATE.tgUser?.id || "",
      tgUsername: STATE.tgUser?.username || "",
      tgFullName: STATE.tgUser?.fullName || ""
    });

    if (!data.ok) {
      throw new Error(data.message || "Bootstrap hatası");
    }

    STATE.permissions = data.permissions || STATE.permissions;
    STATE.employees = data.employees || [];
    STATE.criteria = data.criteria || [];
    STATE.reports = data.reports || null;

    renderPermissionUI();
    renderStats();
    renderEmployees();
    renderEmployeeSelect();
    renderCriteriaInputs();
    renderReports();

    if (!STATE.permissions.isKnownUser && STATE.tgUser?.id) {
      setStatus("Bu kullanıcı panelde tanımlı değil. Yöneticiden yetki tanımlaması iste.");
      return;
    }

    if (!STATE.permissions.canScore && !STATE.permissions.canViewReports) {
      setStatus("Giriş yapıldı. Fakat bu kullanıcıya panel yetkisi tanımlı değil.");
      return;
    }

    setStatus("Sistem hazır. Toplu puanlama aktif.");
  } catch (err) {
    setStatus(`Yükleme hatası: ${err.message}`);
    console.error(err);
  }
}

async function handleBatchSave() {
  if (!STATE.permissions.canScore) {
    showAppAlert("Bu kullanıcı puan verme yetkisine sahip değil.");
    return;
  }

  const date = $("scoreDate").value.trim();
  const employeeName = $("employeeSelect").value.trim();
  const note = $("noteInput").value.trim();

  if (!date) {
    showAppAlert("Tarih seç.");
    return;
  }

  if (!employeeName) {
    showAppAlert("Çalışan seç.");
    return;
  }

  const scoreSelects = Array.from(document.querySelectorAll(".criterion-score"));

  if (!scoreSelects.length) {
    showAppAlert("Aktif kriter bulunamadı.");
    return;
  }

  const scores = [];

  for (const select of scoreSelects) {
    const score = select.value;
    const code = select.dataset.code || "";
    const name = select.dataset.name || "";

    if (!score) {
      showAppAlert("Tüm kriterlere puan vermeden kaydedemezsin.");
      return;
    }

    scores.push({
      code,
      name,
      score: Number(score)
    });
  }

  const btn = $("saveBtn");
  const oldText = btn.textContent;

  try {
    btn.disabled = true;
    btn.textContent = "Kaydediliyor...";

    const data = await apiPost({
      action: "batchSave",
      tgUserId: STATE.tgUser?.id || "",
      tgUsername: STATE.tgUser?.username || "",
      tgFullName: STATE.tgUser?.fullName || "",
      date,
      employeeName,
      note,
      scores
    });

    if (!data.ok) {
      throw new Error(data.message || "Kayıt başarısız");
    }

    showAppAlert(data.message || "Kayıt başarılı.");

    $("noteInput").value = "";
    document.querySelectorAll(".criterion-score").forEach((el) => {
      el.value = "";
    });

    await loadBootstrap();
    switchTab(STATE.permissions.canViewReports ? "reports" : "home");
  } catch (err) {
    console.error(err);
    showAppAlert(`Kaydetme hatası: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = oldText;
  }
}

function setupEvents() {
  $("employeeSelect").addEventListener("change", renderCriteriaInputs);
  $("saveBtn").addEventListener("click", handleBatchSave);
}

document.addEventListener("DOMContentLoaded", async () => {
  setupTabs();
  setToday();
  initTelegramInfo();
  setupEvents();
  await loadBootstrap();
});
