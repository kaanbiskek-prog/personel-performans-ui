const API_URL = "https://script.google.com/macros/s/AKfycbyBmT4GrkMfU0sF_oIPkXMEWvLBgv3C__kg18R2Ji-Hgq3xdx_8Z-435ZTV4H9dd8rJ/exec";

const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;

const state = {
  actor: null,
  employees: [],
  allEmployees: [],
  criteria: [],
  authorizedUsers: [],
  stats: { activeCount: 0, todayCount: 0, lowScoreCount: 0 },
  recentRecords: [],
  reportSummary: []
};

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  prepareTelegramShell();
  setupActions();
  bootstrap();
});

function prepareTelegramShell() {
  if (tg) {
    try {
      tg.ready();
      tg.expand();
    } catch (err) {}
  }

  document.getElementById("scoreDate").value = todayInputValue();
}

function getTelegramUser() {
  const user = tg && tg.initDataUnsafe ? tg.initDataUnsafe.user : null;

  if (user) {
    return {
      id: String(user.id || ""),
      fullName: [user.first_name || "", user.last_name || ""].join(" ").trim(),
      username: user.username ? "@" + String(user.username).replace(/^@/, "") : ""
    };
  }

  return {
    id: "",
    fullName: "Tarayıcı açılışı",
    username: ""
  };
}

async function bootstrap() {
  setStatus("Veriler yükleniyor...");
  const user = getTelegramUser();

  try {
    const res = await apiGet("bootstrap", {
      userId: user.id,
      fullName: user.fullName,
      username: user.username
    });

    if (!res.ok) throw new Error(res.error || "Bootstrap hatası");

    const data = res.data || {};
    state.actor = data.actor || null;
    state.employees = data.employees || [];
    state.allEmployees = data.allEmployees || [];
    state.criteria = data.criteria || [];
    state.authorizedUsers = data.authorizedUsers || [];
    state.stats = data.stats || state.stats;
    state.recentRecords = data.recentRecords || [];
    state.reportSummary = data.reportSummary || [];

    renderUserInfo(user);
    renderStats();
    renderEmployeeSelect();
    renderCriteriaSelect();
    renderEmployees();
    renderAuthorizedUsers();
    renderReports();
    applyPermissions();
    setStatus(state.actor && state.actor.active ? "Sistem hazır." : "Bu kullanıcıya yetki tanımlı değil.");
  } catch (err) {
    console.error(err);
    setStatus("Yükleme hatası: " + err.message);
    alert("Yükleme hatası: " + err.message);
  }
}

function applyPermissions() {
  const actor = state.actor || {};
  const canScore = !!actor.can_score;
  const canViewReports = !!actor.can_view_reports;
  const canManage = !!actor.can_manage_employees;

  const saveBtn = document.getElementById("saveBtn");
  const reviewBtn = document.getElementById("reviewBtn");
  const dailyAccessNote = document.getElementById("dailyAccessNote");
  const reportsTab = document.querySelector('[data-tab="reports"]');
  const reportsSection = document.getElementById("reports");
  const adminPanels = document.getElementById("adminPanels");
  const authUserWrap = document.getElementById("authUserWrap");

  saveBtn.disabled = !canScore;
  reviewBtn.disabled = !canScore;

  if (!canScore) {
    dailyAccessNote.style.display = "block";
    dailyAccessNote.textContent = "Bu hesap puan girişi yapamaz. Yetki admin/manager tarafından verilmeli.";
  } else {
    dailyAccessNote.style.display = "none";
  }

  if (!canViewReports) {
    reportsTab.style.display = "none";
    reportsSection.style.display = "none";
    if (document.querySelector(".tab.active") === reportsTab) {
      openTab("home");
    }
  } else {
    reportsTab.style.display = "";
  }

  adminPanels.style.display = canManage ? "block" : "none";
  authUserWrap.style.display = canManage ? "block" : "none";
}

function renderUserInfo(user) {
  const actor = state.actor || {};
  document.getElementById("userChip").textContent =
    actor.full_name || user.fullName || "Bilinmeyen kullanıcı";

  document.getElementById("userInfo").textContent =
    "Kullanıcı: " + (actor.full_name || user.fullName || "-") +
    " | " + (actor.username || user.username || "-") +
    " | ID: " + (actor.telegram_user_id || user.id || "-");

  document.getElementById("sourceInfo").textContent =
    "Kaynak: " + (tg ? "Telegram Mini App" : "Tarayıcı açılışı") +
    " | Rol: " + (actor.role || "none");
}

function renderStats() {
  document.getElementById("activeCount").textContent = state.stats.activeCount || 0;
  document.getElementById("todayCount").textContent = state.stats.todayCount || 0;
  document.getElementById("lowScoreCount").textContent = state.stats.lowScoreCount || 0;
}

function renderEmployeeSelect() {
  const select = document.getElementById("employeeSelect");
  select.innerHTML = '<option value="">Çalışan seç</option>';

  state.employees.forEach(emp => {
    const opt = document.createElement("option");
    opt.value = emp.employee_id;
    opt.textContent = emp.employee_name;
    select.appendChild(opt);
  });

  document.getElementById("employeeCountPill").textContent = (state.allEmployees.length || state.employees.length) + " kişi";
}

function renderCriteriaSelect() {
  const select = document.getElementById("criteriaSelect");
  select.innerHTML = '<option value="">Kriter seç</option>';

  state.criteria.forEach(item => {
    const opt = document.createElement("option");
    opt.value = item.criterion_id;
    opt.textContent = item.criterion_name;
    select.appendChild(opt);
  });
}

function renderEmployees() {
  const wrap = document.getElementById("employeeList");
  const list = (state.allEmployees.length ? state.allEmployees : state.employees);

  if (!list.length) {
    wrap.innerHTML = '<div class="card stat"><div class="label">Henüz çalışan yok.</div></div>';
    return;
  }

  wrap.innerHTML = list.map((emp, index) => {
    const actionButton = state.actor && state.actor.can_manage_employees
      ? '<button class="primary-btn employee-action" data-action="toggle-employee" data-id="' + escapeHtml(emp.employee_id) + '">' + (emp.active ? "Pasife Al" : "Aktif Et") + '</button>'
      : '';

    return (
      '<div class="card stat">' +
        '<div class="label">#' + (index + 1) + '</div>' +
        '<div class="value" style="font-size:32px;">' + escapeHtml(emp.employee_name) + '</div>' +
        '<div class="label">Rol: ' + escapeHtml(emp.employee_role) + '</div>' +
        '<div class="label">Durum: ' + (emp.active ? "Aktif" : "Pasif") + '</div>' +
        (actionButton ? '<div class="actions" style="margin-top:12px;">' + actionButton + '</div>' : "") +
      '</div>'
    );
  }).join("");
}

function renderAuthorizedUsers() {
  const pill = document.getElementById("authCountPill");
  const wrap = document.getElementById("authUserList");

  pill.textContent = (state.authorizedUsers || []).length + " kişi";

  if (!state.authorizedUsers.length) {
    wrap.innerHTML = '<div class="card stat"><div class="label">Henüz yetkili kullanıcı yok.</div></div>';
    return;
  }

  wrap.innerHTML = state.authorizedUsers.map(user => {
    return (
      '<div class="card stat">' +
        '<div class="label">' + escapeHtml(user.role || "none") + '</div>' +
        '<div class="value" style="font-size:28px;">' + escapeHtml(user.full_name || "-") + '</div>' +
        '<div class="label">' + escapeHtml(user.username || "-") + '</div>' +
        '<div class="label">ID: ' + escapeHtml(user.telegram_user_id || "-") + '</div>' +
        '<div class="label">Puan: ' + (user.can_score ? "Var" : "Yok") + ' | Rapor: ' + (user.can_view_reports ? "Var" : "Yok") + '</div>' +
        '<div class="label">Yönetim: ' + (user.can_manage_employees ? "Var" : "Yok") + ' | Durum: ' + (user.active ? "Aktif" : "Pasif") + '</div>' +
        '<div class="actions" style="margin-top:12px;">' +
          '<button class="primary-btn auth-action" data-action="toggle-auth" data-id="' + escapeHtml(user.telegram_user_id) + '">' + (user.active ? "Pasife Al" : "Aktif Et") + '</button>' +
        '</div>' +
      '</div>'
    );
  }).join("");
}

function renderReports() {
  const summaryWrap = document.getElementById("reportSummary");
  const body = document.getElementById("recentRecordsBody");

  if (state.reportSummary.length) {
    summaryWrap.innerHTML = state.reportSummary.map(item => {
      return (
        '<div class="card stat">' +
          '<div class="label">' + escapeHtml(item.label) + '</div>' +
          '<div class="value">' + escapeHtml(item.value) + '</div>' +
        '</div>'
      );
    }).join("");
  } else {
    summaryWrap.innerHTML = "";
  }

  document.getElementById("reportCountPill").textContent = (state.recentRecords || []).length + " kayıt";

  if (!state.recentRecords.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty-td">Henüz kayıt yok.</td></tr>';
    return;
  }

  body.innerHTML = state.recentRecords.map(item => {
    return (
      '<tr>' +
        '<td>' + escapeHtml(item.score_date || "-") + '</td>' +
        '<td>' + escapeHtml(item.employee_name || "-") + '</td>' +
        '<td>' + escapeHtml(item.criterion_name || "-") + '</td>' +
        '<td>' + escapeHtml(String(item.score || "-")) + '</td>' +
        '<td>' + escapeHtml(item.note || "-") + '</td>' +
        '<td>' + escapeHtml(item.entered_by_name || "-") + '</td>' +
      '</tr>'
    );
  }).join("");
}

function setupActions() {
  document.getElementById("saveBtn").addEventListener("click", saveScore);
  document.getElementById("reviewBtn").addEventListener("click", submitReview);
  document.getElementById("addEmployeeBtn").addEventListener("click", saveEmployee);
  document.getElementById("saveAuthUserBtn").addEventListener("click", saveAuthorizedUser);

  document.getElementById("employeeList").addEventListener("click", async (event) => {
    const btn = event.target.closest(".employee-action");
    if (!btn) return;
    await toggleEmployee(btn.dataset.id);
  });

  document.getElementById("authUserList").addEventListener("click", async (event) => {
    const btn = event.target.closest(".auth-action");
    if (!btn) return;
    await toggleAuthorizedUser(btn.dataset.id);
  });
}

async function saveScore() {
  const employeeId = document.getElementById("employeeSelect").value;
  const criterionId = document.getElementById("criteriaSelect").value;
  const score = document.getElementById("scoreSelect").value;
  const scoreDate = document.getElementById("scoreDate").value;
  const note = document.getElementById("noteInput").value.trim();
  const btn = document.getElementById("saveBtn");

  if (!employeeId || !criterionId || !score || !scoreDate) {
    alert("Çalışan, kriter, puan ve tarih boş bırakılamaz.");
    return;
  }

  const user = getTelegramUser();

  try {
    btn.disabled = true;
    btn.textContent = "Kaydediliyor...";

    const res = await apiPost("saveScore", {
      userId: user.id,
      fullName: user.fullName,
      username: user.username,
      employeeId,
      criterionId,
      score,
      scoreDate,
      note
    });

    if (!res.ok) throw new Error(res.error || "Kayıt kaydedilemedi.");

    document.getElementById("noteInput").value = "";
    document.getElementById("scoreSelect").value = "";
    alert((res.data && res.data.message) || "Kayıt kaydedildi.");
    await bootstrap();
    openTab("reports");
  } catch (err) {
    console.error(err);
    alert("Kaydetme hatası: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Kaydet";
  }
}

async function submitReview() {
  const employeeId = document.getElementById("employeeSelect").value;
  const note = document.getElementById("noteInput").value.trim();
  const input = document.getElementById("reviewFile");
  const btn = document.getElementById("reviewBtn");

  if (!employeeId) {
    alert("Önce çalışan seç.");
    return;
  }

  if (!input.files || !input.files[0]) {
    alert("Önce belge ya da görsel seç.");
    return;
  }

  const file = input.files[0];
  const base64 = await fileToBase64(file);
  const user = getTelegramUser();

  try {
    btn.disabled = true;
    btn.textContent = "Gönderiliyor...";

    const res = await apiPost("submitReview", {
      userId: user.id,
      fullName: user.fullName,
      username: user.username,
      employeeId,
      note,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      fileBase64: base64
    });

    if (!res.ok) throw new Error(res.error || "İnceleme kuyruğuna gönderilemedi.");

    input.value = "";
    alert((res.data && res.data.message) || "İnceleme kuyruğuna gönderildi.");
  } catch (err) {
    console.error(err);
    alert("Gönderme hatası: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "İnceleme Kuyruğuna Gönder";
  }
}

async function saveEmployee() {
  const employeeName = document.getElementById("employeeNameInput").value.trim();
  const employeeRole = document.getElementById("employeeRoleInput").value.trim();
  const btn = document.getElementById("addEmployeeBtn");
  const user = getTelegramUser();

  if (!employeeName || !employeeRole) {
    alert("Çalışan adı ve rolü boş bırakılamaz.");
    return;
  }

  try {
    btn.disabled = true;
    btn.textContent = "Kaydediliyor...";

    const res = await apiPost("saveEmployee", {
      userId: user.id,
      employeeName,
      employeeRole
    });

    if (!res.ok) throw new Error(res.error || "Çalışan kaydedilemedi.");

    document.getElementById("employeeNameInput").value = "";
    document.getElementById("employeeRoleInput").value = "";
    alert((res.data && res.data.message) || "Çalışan eklendi.");
    await bootstrap();
  } catch (err) {
    console.error(err);
    alert("Çalışan kayıt hatası: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Çalışanı Kaydet";
  }
}

async function toggleEmployee(employeeId) {
  const user = getTelegramUser();

  try {
    const res = await apiPost("toggleEmployee", {
      userId: user.id,
      employeeId
    });

    if (!res.ok) throw new Error(res.error || "Çalışan durumu değiştirilemedi.");
    alert((res.data && res.data.message) || "İşlem tamam.");
    await bootstrap();
  } catch (err) {
    console.error(err);
    alert("Çalışan işlem hatası: " + err.message);
  }
}

async function saveAuthorizedUser() {
  const targetTelegramUserId = document.getElementById("authTelegramIdInput").value.trim();
  const targetFullName = document.getElementById("authFullNameInput").value.trim();
  const targetUsername = document.getElementById("authUsernameInput").value.trim();
  const targetRole = document.getElementById("authRoleSelect").value;
  const btn = document.getElementById("saveAuthUserBtn");
  const user = getTelegramUser();

  if (!targetTelegramUserId || !targetFullName || !targetRole) {
    alert("Telegram ID, ad soyad ve rol zorunlu.");
    return;
  }

  try {
    btn.disabled = true;
    btn.textContent = "Kaydediliyor...";

    const res = await apiPost("saveAuthorizedUser", {
      userId: user.id,
      targetTelegramUserId,
      targetFullName,
      targetUsername,
      targetRole
    });

    if (!res.ok) throw new Error(res.error || "Yetkili kullanıcı kaydedilemedi.");

    document.getElementById("authTelegramIdInput").value = "";
    document.getElementById("authFullNameInput").value = "";
    document.getElementById("authUsernameInput").value = "";
    document.getElementById("authRoleSelect").value = "scorer";
    alert((res.data && res.data.message) || "Yetkili kullanıcı kaydedildi.");
    await bootstrap();
  } catch (err) {
    console.error(err);
    alert("Yetkili kayıt hatası: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Yetkiliyi Kaydet";
  }
}

async function toggleAuthorizedUser(targetTelegramUserId) {
  const user = getTelegramUser();

  try {
    const res = await apiPost("toggleAuthorizedUser", {
      userId: user.id,
      targetTelegramUserId
    });

    if (!res.ok) throw new Error(res.error || "Yetkili kullanıcı durumu değiştirilemedi.");
    alert((res.data && res.data.message) || "İşlem tamam.");
    await bootstrap();
  } catch (err) {
    console.error(err);
    alert("Yetkili işlem hatası: " + err.message);
  }
}

function setupTabs() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => openTab(btn.dataset.tab));
  });
}

function openTab(tabName) {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });

  document.querySelectorAll(".section").forEach(section => {
    section.classList.toggle("active", section.id === tabName);
  });
}

async function apiGet(action, params = {}) {
  const query = new URLSearchParams({ action, ...params });
  const response = await fetch(API_URL + "?" + query.toString(), {
    method: "GET",
    credentials: "omit"
  });
  return response.json();
}

async function apiPost(action, params = {}) {
  const body = new URLSearchParams({ action, ...params });
  const response = await fetch(API_URL, {
    method: "POST",
    body,
    credentials: "omit"
  });
  return response.json();
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function setStatus(text) {
  document.getElementById("statusText").textContent = text;
}

function todayInputValue() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + d;
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
