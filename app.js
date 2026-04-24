const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyBmT4GrkMfU0sF_oIPkXMEWvLBgv3C__kg18R2Ji-Hgq3xdx_8Z-435ZTV4H9dd8rJ/exec";

const state = {
  tg: null,
  tgUser: null,
  viewer: null,
  permissions: {
    isAdmin: false,
    canManagePersonnel: false,
    canRate: false,
    canViewReports: false,
    isKnownUser: false
  },
  stats: {
    activeEmployeeCount: 0,
    todayCount: 0,
    lowScoreCount: 0
  },
  employees: [],
  personnel: [],
  criteria: [],
  reports: {
    summary: null,
    employeeAverages: [],
    recentRecords: []
  }
};

const $ = (id) => document.getElementById(id);

function initTelegram() {
  const tg = window.Telegram?.WebApp || null;
  state.tg = tg;

  if (tg) {
    try {
      tg.ready();
      tg.expand();
    } catch (err) {}
  }

  const user = tg?.initDataUnsafe?.user || null;
  state.tgUser = user;
}

function getViewerPayload() {
  const user = state.tgUser;

  return {
    tgUserId: user?.id ? String(user.id) : "",
    tgUsername: user?.username ? String(user.username) : "",
    tgFullName: user
      ? [user.first_name, user.last_name].filter(Boolean).join(" ").trim()
      : ""
  };
}

async function api(action, payload = {}) {
  if (!WEB_APP_URL || WEB_APP_URL.includes("BURAYA_APPS_SCRIPT_EXEC_URL")) {
    throw new Error("WEB_APP_URL henüz app.js içine eklenmemiş.");
  }

  const body = new URLSearchParams();
  body.append("action", action);

  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    body.append(key, String(value));
  });

  const res = await fetch(WEB_APP_URL, {
    method: "POST",
    body
  });

  const json = await res.json();
  if (!json.ok) {
    throw new Error(json.message || "İşlem başarısız.");
  }
  return json;
}

function setupTabs() {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.classList.contains("hidden")) return;
      switchTab(btn.dataset.tab);
    });
  });
}

function switchTab(tabId) {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });

  document.querySelectorAll(".section").forEach((section) => {
    section.classList.toggle("active", section.id === tabId);
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

async function bootstrapData(showStatus = true) {
  if (showStatus) {
    $("statusText").textContent = "Veriler yükleniyor...";
  }

  const res = await api("bootstrap", getViewerPayload());

  state.viewer = res.viewer;
  state.permissions = res.permissions;
  state.stats = res.stats || state.stats;
  state.employees = Array.isArray(res.employees) ? res.employees : [];
  state.personnel = Array.isArray(res.personnel) ? res.personnel : [];
  state.criteria = Array.isArray(res.criteria) ? res.criteria : [];
  state.reports = res.reports || state.reports;

  renderAll(res.firstAdminCreated === true);
}

function renderAll(firstAdminCreated = false) {
  renderViewer(firstAdminCreated);
  renderPermissions();
  renderStats();
  renderDaily();
  renderEmployees();
  renderReports();
  renderManagement();
}

function renderViewer(firstAdminCreated = false) {
  const viewer = state.viewer || {};
  const fullName = viewer.fullName || "Yetkisiz Kullanıcı";
  const username = viewer.telegramUsername ? `@${viewer.telegramUsername}` : "@yok";
  const tgId = viewer.telegramUserId || "-";

  $("userChip").textContent = fullName;
  $("userInfo").textContent = `Kullanıcı: ${fullName} | ${username} | ID: ${tgId}`;
  $("sourceInfo").textContent = state.tgUser
    ? "Kaynak: Telegram Mini App"
    : "Kaynak: Tarayıcı testi";

  if (firstAdminCreated) {
    $("statusText").textContent = "İlk Admin otomatik oluşturuldu. Sistem hazır.";
    return;
  }

  if (!state.permissions.isKnownUser) {
    $("statusText").textContent = "Bu kullanıcı sisteme tanımlı değil. Admin seni eklemeli.";
    return;
  }

  const roleText = viewer.role ? `Rol: ${viewer.role}` : "Rol bulunamadı";
  $("statusText").textContent = `Sistem hazır. ${roleText}`;
}

function renderPermissions() {
  $("tabDaily").classList.toggle("hidden", !state.permissions.canRate);
  $("tabReports").classList.toggle("hidden", !state.permissions.canViewReports);
  $("tabManagement").classList.toggle("hidden", !state.permissions.canManagePersonnel);

  $("daily").classList.toggle("hidden", !state.permissions.canRate);
  $("reports").classList.toggle("hidden", !state.permissions.canViewReports);
  $("management").classList.toggle("hidden", !state.permissions.canManagePersonnel);

  const activeTab = document.querySelector(".tab.active");
  if (activeTab && activeTab.classList.contains("hidden")) {
    switchTab("home");
  }
}

function renderStats() {
  $("activeCount").textContent = state.stats.activeEmployeeCount || 0;
  $("todayCount").textContent = state.stats.todayCount || 0;
  $("lowScoreCount").textContent = state.stats.lowScoreCount || 0;
}

function renderDaily() {
  renderEmployeeOptions();
  renderCriteriaList();
}

function renderEmployeeOptions() {
  const select = $("employeeSelect");
  const current = select.value;

  select.innerHTML = `<option value="">Çalışan seç</option>`;

  state.employees.forEach((emp) => {
    const opt = document.createElement("option");
    opt.value = emp.id;
    opt.textContent = emp.fullName;
    select.appendChild(opt);
  });

  if (state.employees.some((x) => x.id === current)) {
    select.value = current;
  }
}

function renderCriteriaList() {
  const wrap = $("criteriaList");
  if (!wrap) return;

  const oldValues = {};
  wrap.querySelectorAll("select[data-code]").forEach((sel) => {
    oldValues[sel.dataset.code] = sel.value;
  });

  wrap.innerHTML = "";

  state.criteria.forEach((criterion, index) => {
    const row = document.createElement("div");
    row.className = "criteria-row";

    row.innerHTML = `
      <div class="criteria-name">${index + 1}. ${criterion.name}</div>
      <select data-code="${criterion.code}">
        <option value="">Puan seç</option>
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="3">3</option>
        <option value="4">4</option>
        <option value="5">5</option>
      </select>
    `;

    wrap.appendChild(row);

    const select = row.querySelector("select");
    if (oldValues[criterion.code]) {
      select.value = oldValues[criterion.code];
    }
  });
}

function renderEmployees() {
  const wrap = $("employeeList");
  if (!wrap) return;

  const activePersonnel = state.personnel.filter((p) => p.active);
  $("employeeCountPill").textContent = `${activePersonnel.length} kişi`;

  if (!activePersonnel.length) {
    wrap.innerHTML = `<div class="employee-card"><div class="employee-name">Henüz personel yok.</div></div>`;
    return;
  }

  wrap.innerHTML = activePersonnel.map((p, i) => `
    <div class="employee-card">
      <div class="employee-index">#${i + 1}</div>
      <div class="employee-name">${escapeHtml(p.fullName || "-")}</div>
      <div class="employee-meta">Rol: ${escapeHtml(p.role || "-")}</div>
      <div class="employee-meta">Durum: ${p.active ? "Aktif" : "Pasif"}</div>
    </div>
  `).join("");
}

function renderReports() {
  if (!state.permissions.canViewReports) return;

  const reports = state.reports || {};
  const summary = reports.summary || null;
  const employeeAverages = Array.isArray(reports.employeeAverages) ? reports.employeeAverages : [];
  const recentRecords = Array.isArray(reports.recentRecords) ? reports.recentRecords : [];

  const summaryWrap = $("reportSummary");
  if (summaryWrap) {
    if (!summary) {
      summaryWrap.innerHTML = "";
    } else {
      summaryWrap.innerHTML = `
        <div class="summary-box">
          <div class="summary-label">Bugün Ortalama</div>
          <div class="summary-value">${numberOrDash(summary.todayAverage)}</div>
        </div>
        <div class="summary-box">
          <div class="summary-label">Ay Ortalama</div>
          <div class="summary-value">${numberOrDash(summary.monthAverage)}</div>
        </div>
        <div class="summary-box">
          <div class="summary-label">Bugünkü Kayıt</div>
          <div class="summary-value">${summary.totalTodayRecords || 0}</div>
        </div>
        <div class="summary-box">
          <div class="summary-label">Aylık Kayıt</div>
          <div class="summary-value">${summary.totalMonthRecords || 0}</div>
        </div>
      `;
    }
  }

  $("reportCountPill").textContent = `${recentRecords.length} kayıt`;

  const avgBody = $("employeeAveragesBody");
  if (avgBody) {
    if (!employeeAverages.length) {
      avgBody.innerHTML = `<tr><td colspan="3" class="empty-td">Henüz veri yok.</td></tr>`;
    } else {
      avgBody.innerHTML = employeeAverages.map((item) => `
        <tr>
          <td>${escapeHtml(item.employeeName || "-")}</td>
          <td>${item.recordCount || 0}</td>
          <td>${numberOrDash(item.average)}</td>
        </tr>
      `).join("");
    }
  }

  const recentBody = $("recentRecordsBody");
  if (recentBody) {
    if (!recentRecords.length) {
      recentBody.innerHTML = `<tr><td colspan="6" class="empty-td">Henüz kayıt yok.</td></tr>`;
    } else {
      recentBody.innerHTML = recentRecords.map((r) => `
        <tr>
          <td>${escapeHtml(r.date || "-")}</td>
          <td>${escapeHtml(r.employeeName || "-")}</td>
          <td>${escapeHtml(r.criterionName || "-")}</td>
          <td>${escapeHtml(String(r.score || "-"))}</td>
          <td>${escapeHtml(r.note || "-")}</td>
          <td>${escapeHtml(r.ratedByName || "-")}</td>
        </tr>
      `).join("");
    }
  }
}

function renderManagement() {
  if (!state.permissions.canManagePersonnel) return;

  const wrap = $("managementList");
  if (!wrap) return;

  if (!state.personnel.length) {
    wrap.innerHTML = `<div class="management-item"><div class="management-name">Henüz personel yok.</div></div>`;
    return;
  }

  wrap.innerHTML = state.personnel.map((p) => `
    <div class="management-item">
      <div class="management-top">
        <div class="management-name">${escapeHtml(p.fullName || "-")}</div>
        <div class="role-badge">${escapeHtml(p.role || "-")}</div>
      </div>

      <div class="management-meta">ID: ${escapeHtml(p.id || "-")}</div>
      <div class="management-meta">Telegram ID: ${escapeHtml(p.telegramUserId || "-")}</div>
      <div class="management-meta">Username: ${escapeHtml(p.telegramUsername || "-")}</div>
      <div class="management-meta">
        <span class="state-badge ${p.active ? "active" : "passive"}">
          ${p.active ? "Aktif" : "Pasif"}
        </span>
      </div>

      <div class="management-actions">
        <button class="small-btn" data-edit-id="${p.id}">Düzenle</button>
        <button class="${p.active ? "small-btn-danger" : "small-btn"}" data-toggle-id="${p.id}" data-next-active="${p.active ? "false" : "true"}">
          ${p.active ? "Pasife Al" : "Aktif Et"}
        </button>
      </div>
    </div>
  `).join("");

  wrap.querySelectorAll("[data-edit-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      fillManagementForm(btn.dataset.editId);
      switchTab("management");
    });
  });

  wrap.querySelectorAll("[data-toggle-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await api("setPersonnelActive", {
          ...getViewerPayload(),
          personId: btn.dataset.toggleId,
          active: btn.dataset.nextActive
        });

        await bootstrapData(false);
        alert("Durum güncellendi.");
      } catch (err) {
        alert("Durum güncelleme hatası: " + err.message);
      }
    });
  });
}

function fillManagementForm(personId) {
  const person = state.personnel.find((p) => p.id === personId);
  if (!person) return;

  $("managerPersonId").value = person.id || "";
  $("managerFullName").value = person.fullName || "";
  $("managerRole").value = person.role || "Calisan";
  $("managerActive").value = String(Boolean(person.active));
  $("managerTelegramId").value = person.telegramUserId || "";
  $("managerTelegramUsername").value = person.telegramUsername || "";
}

function resetManagementForm() {
  $("managerPersonId").value = "";
  $("managerFullName").value = "";
  $("managerRole").value = "Calisan";
  $("managerActive").value = "true";
  $("managerTelegramId").value = "";
  $("managerTelegramUsername").value = "";
}

function bindActions() {
  $("saveBtn")?.addEventListener("click", saveBulkScores);
  $("savePersonBtn")?.addEventListener("click", savePerson);
  $("resetPersonBtn")?.addEventListener("click", resetManagementForm);
}

async function saveBulkScores() {
  try {
    const employeeId = $("employeeSelect").value;
    const date = $("scoreDate").value;
    const note = $("noteInput").value.trim();

    if (!employeeId) {
      alert("Önce çalışan seç.");
      return;
    }

    if (!date) {
      alert("Tarih boş olamaz.");
      return;
    }

    const scoreRows = [];
    let hasEmpty = false;

    document.querySelectorAll("#criteriaList select[data-code]").forEach((sel) => {
      const code = sel.dataset.code;
      const score = sel.value;

      if (!score) {
        hasEmpty = true;
        return;
      }

      scoreRows.push({
        code,
        score: Number(score)
      });
    });

    if (hasEmpty) {
      alert("Tüm kriterlere puan vermeden kaydedemezsin.");
      return;
    }

    if (!scoreRows.length) {
      alert("Kaydedilecek puan yok.");
      return;
    }

    const btn = $("saveBtn");
    btn.disabled = true;
    btn.textContent = "Kaydediliyor...";

    await api("saveBulkScores", {
      ...getViewerPayload(),
      date,
      employeeId,
      note,
      scoresJson: JSON.stringify(scoreRows)
    });

    document.querySelectorAll("#criteriaList select[data-code]").forEach((sel) => {
      sel.value = "";
    });
    $("noteInput").value = "";

    await bootstrapData(false);
    switchTab("home");
    $("statusText").textContent = "Toplu puan kaydı başarıyla yapıldı.";
    alert("Kayıt tamamlandı.");
  } catch (err) {
    alert("Kaydetme hatası: " + err.message);
  } finally {
    const btn = $("saveBtn");
    btn.disabled = false;
    btn.textContent = "Tümünü Kaydet";
  }
}

async function savePerson() {
  try {
    const fullName = $("managerFullName").value.trim();
    const role = $("managerRole").value;
    const active = $("managerActive").value;
    const personId = $("managerPersonId").value.trim();
    const telegramUserId = $("managerTelegramId").value.trim();
    const telegramUsername = $("managerTelegramUsername").value.trim();

    if (!fullName) {
      alert("Ad Soyad boş olamaz.");
      return;
    }

    const btn = $("savePersonBtn");
    btn.disabled = true;
    btn.textContent = "Kaydediliyor...";

    await api("savePersonnel", {
      ...getViewerPayload(),
      personId,
      fullName,
      role,
      active,
      telegramUserId,
      telegramUsername
    });

    resetManagementForm();
    await bootstrapData(false);
    alert("Personel kaydedildi.");
  } catch (err) {
    alert("Personel kayıt hatası: " + err.message);
  } finally {
    const btn = $("savePersonBtn");
    btn.disabled = false;
    btn.textContent = "Kaydet";
  }
}

function numberOrDash(value) {
  if (value === null || value === undefined || value === "") return "-";
  const num = Number(value);
  if (Number.isNaN(num)) return "-";
  return num.toFixed(2);
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.addEventListener("DOMContentLoaded", async () => {
  initTelegram();
  setupTabs();
  setToday();
  bindActions();

  try {
    await bootstrapData(true);
  } catch (err) {
    $("statusText").textContent = "Yükleme hatası: " + err.message;
    console.error(err);
  }
});
