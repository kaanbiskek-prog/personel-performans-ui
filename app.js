const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyBmT4GrkMfU0sF_oIPkXMEWvLBgv3C__kg18R2Ji-Hgq3xdx_8Z-435ZTV4H9dd8rJ/exec";

const $ = (id) => document.getElementById(id);

const state = {
  employees: [],
  criteriaRows: [],
  records: [],
  currentUser: null
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

  state.currentUser = {
    fullName,
    username,
    userId,
    isTelegram: !!user
  };

  $("userChip").textContent = fullName;
  $("userInfo").textContent = `Kullanıcı: ${fullName} | ${username} | ID: ${userId}`;
  $("sourceInfo").textContent = user
    ? "Kaynak: Telegram Mini App"
    : "Kaynak: Tarayıcı testi / Telegram dışı açılış";
}

async function fetchBootstrap() {
  if (!SCRIPT_URL || SCRIPT_URL.includes("BURAYA_APPS_SCRIPT_WEB_APP_URL_YAPISTIR")) {
    throw new Error("SCRIPT_URL boş. app.js içine Apps Script linkini yapıştır.");
  }

  const url = `${SCRIPT_URL}?action=bootstrap&_=${Date.now()}`;
  const res = await fetch(url, { method: "GET" });
  const json = await res.json();

  if (!json.ok) {
    throw new Error(json.error || "Bootstrap verisi alınamadı.");
  }

  return json.data;
}

async function postJSON(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload)
  });

  const json = await res.json();
  return json;
}

async function loadBootstrap() {
  setStatus("Veriler yükleniyor...");

  try {
    const data = await fetchBootstrap();
    hydrateState(data);
    renderAll();
    setStatus("Sistem hazır. Tüm kriterler tek ekranda puanlanabilir.");
  } catch (err) {
    setStatus(`Veri yükleme hatası: ${err.message}`);
    console.error(err);
  }
}

function hydrateState(data) {
  state.employees = Array.isArray(data.employees) ? data.employees : [];
  state.criteriaRows = Array.isArray(data.criteriaRows)
    ? data.criteriaRows
    : (Array.isArray(data.criteria) ? data.criteria.map((name, i) => ({
        code: `KRT${String(i + 1).padStart(3, "0")}`,
        name,
        active: true,
        order: i + 1
      })) : []);
  state.records = Array.isArray(data.records) ? data.records : [];
}

function renderAll() {
  renderStats();
  renderEmployeeSelect();
  renderCriteriaList();
  renderEmployeesSection();
  renderReportsSection();
  updateProgressPill();
}

function renderStats() {
  const activeEmployees = state.employees.filter((e) => e.active !== false);
  const today = $("scoreDate")?.value || getTodayString();
  const todayRecords = state.records.filter((r) => r.date === today);

  $("activeCount").textContent = String(activeEmployees.length);
  $("todayCount").textContent = String(todayRecords.length);
  $("lowScoreCount").textContent = String(todayRecords.filter((r) => Number(r.score) <= 2).length);
}

function renderEmployeeSelect() {
  const select = $("employeeSelect");
  if (!select) return;

  const currentValue = select.value;

  const employees = state.employees
    .filter((item) => item.active !== false && item.name)
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));

  select.innerHTML = `<option value="">Çalışan seç</option>` +
    employees.map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join("");

  if (employees.some((e) => e.name === currentValue)) {
    select.value = currentValue;
  } else if (employees.length > 0) {
    select.value = employees[0].name;
  }

  updateProgressPill();
}

function renderCriteriaList() {
  const wrap = $("bulkCriteriaList");
  if (!wrap) return;

  if (!state.criteriaRows.length) {
    wrap.innerHTML = `<div class="empty-box">Aktif kriter bulunamadı.</div>`;
    return;
  }

  wrap.innerHTML = state.criteriaRows.map((item, index) => {
    const title = escapeHtml(item.name);
    return `
      <div class="criteria-row" data-criteria="${title}" data-index="${index}" data-score="">
        <div class="criteria-info">
          <div class="criteria-code">${escapeHtml(item.code || `KRT${String(index + 1).padStart(3, "0")}`)}</div>
          <div class="criteria-name">${title}</div>
        </div>
        <div class="score-pills">
          <button type="button" class="score-pill" data-value="1">1</button>
          <button type="button" class="score-pill" data-value="2">2</button>
          <button type="button" class="score-pill" data-value="3">3</button>
          <button type="button" class="score-pill" data-value="4">4</button>
          <button type="button" class="score-pill" data-value="5">5</button>
        </div>
      </div>
    `;
  }).join("");

  wrap.querySelectorAll(".score-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      const row = btn.closest(".criteria-row");
      if (!row) return;

      row.dataset.score = btn.dataset.value;
      row.querySelectorAll(".score-pill").forEach((x) => x.classList.remove("active"));
      btn.classList.add("active");
    });
  });
}

function renderEmployeesSection() {
  const list = $("employeeList");
  const pill = $("employeeCountPill");

  if (!list || !pill) return;

  const employees = state.employees
    .filter((e) => e.active !== false)
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));

  pill.textContent = `${employees.length} kişi`;

  if (!employees.length) {
    list.innerHTML = `<div class="empty-box">Henüz çalışan yok.</div>`;
    return;
  }

  list.innerHTML = employees.map((item, i) => `
    <div class="employee-card">
      <div class="employee-rank">#${i + 1}</div>
      <div class="employee-name">${escapeHtml(item.name)}</div>
      <div class="employee-meta">Rol: ${escapeHtml(item.role || "Belirtilmedi")}</div>
      <div class="employee-meta">Durum: Aktif</div>
    </div>
  `).join("");
}

function renderReportsSection() {
  renderReportSummary();
  renderAverageTable();
  renderRecentRecords();
}

function renderReportSummary() {
  const wrap = $("reportSummary");
  const pill = $("reportCountPill");
  if (!wrap || !pill) return;

  const today = $("scoreDate")?.value || getTodayString();
  const monthKey = today.slice(0, 7);

  const todayRecords = state.records.filter((r) => r.date === today);
  const monthRecords = state.records.filter((r) => String(r.date || "").startsWith(monthKey));

  pill.textContent = `${state.records.length} kayıt`;

  wrap.innerHTML = `
    <div class="summary-card">
      <div class="summary-label">Bugün Ortalama</div>
      <div class="summary-value">${formatAvg(avg(todayRecords.map((r) => Number(r.score))))}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Bu Ay Ortalama</div>
      <div class="summary-value">${formatAvg(avg(monthRecords.map((r) => Number(r.score))))}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Bu Ay Düşük Puan</div>
      <div class="summary-value">${monthRecords.filter((r) => Number(r.score) <= 2).length}</div>
    </div>
  `;
}

function renderAverageTable() {
  const body = $("averageTableBody");
  if (!body) return;

  const today = $("scoreDate")?.value || getTodayString();
  const monthKey = today.slice(0, 7);

  const employees = state.employees
    .filter((e) => e.active !== false)
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));

  if (!employees.length) {
    body.innerHTML = `<tr><td colspan="5" class="empty-td">Henüz çalışan yok.</td></tr>`;
    return;
  }

  const rows = employees.map((emp) => {
    const todayRecords = state.records.filter((r) => r.employeeName === emp.name && r.date === today);
    const monthRecords = state.records.filter((r) => r.employeeName === emp.name && String(r.date || "").startsWith(monthKey));
    const lowCount = monthRecords.filter((r) => Number(r.score) <= 2).length;

    return `
      <tr>
        <td>${escapeHtml(emp.name)}</td>
        <td>${formatAvg(avg(todayRecords.map((r) => Number(r.score))))}</td>
        <td>${formatAvg(avg(monthRecords.map((r) => Number(r.score))))}</td>
        <td>${monthRecords.length}</td>
        <td>${lowCount}</td>
      </tr>
    `;
  }).join("");

  body.innerHTML = rows;
}

function renderRecentRecords() {
  const body = $("recentRecordsBody");
  if (!body) return;

  const sorted = [...state.records].sort((a, b) => {
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  }).slice(0, 30);

  if (!sorted.length) {
    body.innerHTML = `<tr><td colspan="6" class="empty-td">Henüz kayıt yok.</td></tr>`;
    return;
  }

  body.innerHTML = sorted.map((r) => `
    <tr>
      <td>${escapeHtml(formatDateTR(r.date))}</td>
      <td>${escapeHtml(r.employeeName || "-")}</td>
      <td>${escapeHtml(r.criteria || "-")}</td>
      <td>${escapeHtml(String(r.score || "-"))}</td>
      <td>${escapeHtml(r.note || "-")}</td>
      <td>${escapeHtml(r.fullName || r.telegramUsername || "-")}</td>
    </tr>
  `).join("");
}

function collectScores() {
  const rows = [...document.querySelectorAll(".criteria-row")];

  return rows.map((row) => ({
    criteria: row.dataset.criteria || "",
    score: Number(row.dataset.score || 0)
  }));
}

function validateBulkForm() {
  const employeeName = $("employeeSelect").value.trim();
  if (!employeeName) {
    throw new Error("Çalışan seçmeden kaydedemezsin.");
  }

  const date = $("scoreDate").value.trim();
  if (!date) {
    throw new Error("Tarih boş olamaz.");
  }

  const scores = collectScores();
  if (!scores.length) {
    throw new Error("Kriter listesi boş.");
  }

  const emptyScores = scores.filter((x) => !x.score);
  if (emptyScores.length) {
    throw new Error("Tüm kriterlere puan vermeden kaydetme.");
  }

  return {
    employeeName,
    date,
    scores
  };
}

function clearCriteriaSelections() {
  document.querySelectorAll(".criteria-row").forEach((row) => {
    row.dataset.score = "";
    row.querySelectorAll(".score-pill").forEach((btn) => btn.classList.remove("active"));
  });
}

function moveToNextEmployee() {
  const select = $("employeeSelect");
  if (!select) return;

  const options = [...select.options].filter((o) => o.value);
  if (!options.length) return;

  const currentIndex = options.findIndex((o) => o.value === select.value);
  const nextIndex = currentIndex >= 0 && currentIndex < options.length - 1 ? currentIndex + 1 : 0;

  select.value = options[nextIndex].value;
  updateProgressPill();
}

function updateProgressPill() {
  const pill = $("employeeProgressPill");
  const select = $("employeeSelect");
  if (!pill || !select) return;

  const options = [...select.options].filter((o) => o.value);
  if (!options.length) {
    pill.textContent = "0 / 0";
    return;
  }

  const currentIndex = options.findIndex((o) => o.value === select.value);
  const safeIndex = currentIndex >= 0 ? currentIndex + 1 : 1;

  pill.textContent = `${safeIndex} / ${options.length}`;
}

async function setupSaveButton() {
  const btn = $("saveBtn");
  if (!btn) return;

  btn.replaceWith(btn.cloneNode(true));
  const freshBtn = $("saveBtn");

  freshBtn.addEventListener("click", async () => {
    try {
      const { employeeName, date, scores } = validateBulkForm();

      const payload = {
        action: "saveBulkEvaluation",
        employeeName,
        date,
        note: $("noteInput").value.trim(),
        telegramUserId: String(state.currentUser?.userId || 0),
        telegramUsername: String(state.currentUser?.username || "@demo"),
        fullName: String(state.currentUser?.fullName || "Tarayıcı Demo"),
        scores
      };

      freshBtn.disabled = true;
      freshBtn.textContent = "Kaydediliyor...";

      const json = await postJSON(SCRIPT_URL, payload);

      if (!json.ok) {
        throw new Error(json.error || "Kaydetme başarısız.");
      }

      hydrateState(json.data);
      renderAll();
      clearCriteriaSelections();
      $("noteInput").value = "";
      moveToNextEmployee();

      setStatus(`${employeeName} için ${scores.length} kriter tek seferde kaydedildi.`);
      switchTab("daily");
    } catch (err) {
      alert(`Kaydetme hatası: ${err.message}`);
      console.error(err);
    } finally {
      freshBtn.disabled = false;
      freshBtn.textContent = "Kaydet ve sıradaki çalışana geç";
    }
  });
}

function setStatus(text) {
  $("statusText").textContent = text;
}

function getTodayString() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function avg(arr) {
  const clean = arr.filter((x) => Number(x) > 0);
  if (!clean.length) return 0;
  return clean.reduce((sum, x) => sum + Number(x), 0) / clean.length;
}

function formatAvg(value) {
  if (!value) return "0.00";
  return Number(value).toFixed(2);
}

function formatDateTR(dateStr) {
  if (!dateStr || !dateStr.includes("-")) return dateStr || "-";
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.addEventListener("DOMContentLoaded", async () => {
  setupTabs();
  setToday();
  initTelegramInfo();
  await loadBootstrap();
  await setupSaveButton();

  $("employeeSelect")?.addEventListener("change", updateProgressPill);
  $("scoreDate")?.addEventListener("change", () => {
    renderStats();
    renderReportsSection();
  });
});
