const API_BASE_URL = "https://script.google.com/macros/s/AKfycbyBmT4GrkMfU0sF_oIPkXMEWvLBgv3C__kg18R2Ji-Hgq3xdx_8Z-435ZTV4H9dd8rJ/exec";

const STATE = {
  tgUser: null,
  permissions: {
    isKnownUser: false,
    isAdmin: false,
    canManagePersonnel: false,
    canScore: false,
    canViewReports: false
  },
  employees: [],
  allPersonnel: [],
  criteria: [],
  reports: null,
  reviewQueue: []
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

function boolToText(val) {
  return val ? "Evet" : "Hayır";
}

function roleLabel(role) {
  const r = String(role || "").toLowerCase();
  if (r === "admin") return "Admin";
  if (r === "yonetici") return "Yönetici";
  return "Çalışan";
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

  return await res.json();
}

async function apiPost(payload) {
  const res = await fetch(API_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload)
  });

  return await res.json();
}

function renderPermissionUI() {
  const canScore = !!STATE.permissions.canScore;
  const canViewReports = !!STATE.permissions.canViewReports;
  const canManagePersonnel = !!STATE.permissions.canManagePersonnel;
  const isKnownUser = !!STATE.permissions.isKnownUser;

  $("tabDaily").classList.toggle("hidden-tab", !canScore);
  $("tabReports").classList.toggle("hidden-tab", !canViewReports);
  $("tabReview").classList.toggle("hidden-tab", !isKnownUser);

  $("managePersonnelCard").classList.toggle("hidden", !canManagePersonnel);
  $("managePersonnelLocked").classList.toggle("hidden", canManagePersonnel);

  if (!canScore && document.querySelector('.tab.active[data-tab="daily"]')) {
    switchTab("home");
  }

  if (!canViewReports && document.querySelector('.tab.active[data-tab="reports"]')) {
    switchTab("home");
  }

  if (!isKnownUser && document.querySelector('.tab.active[data-tab="review"]')) {
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
  $("employeeCountPill").textContent = `${STATE.allPersonnel.length} kişi`;

  if (!STATE.allPersonnel.length) {
    wrap.innerHTML = `<div class="empty-block">Henüz personel yok.</div>`;
    return;
  }

  wrap.innerHTML = STATE.allPersonnel
    .map((employee) => {
      return `
        <div class="employee-card">
          <div class="employee-top">
            <div class="employee-name">${escapeHtml(employee.name)}</div>
            <div class="role-badge">${escapeHtml(roleLabel(employee.role))}</div>
          </div>
          <div class="employee-meta">
            Durum: ${employee.active ? "Aktif" : "Pasif"}<br>
            Puan verebilir: ${boolToText(employee.canScore)}<br>
            Rapor görebilir: ${boolToText(employee.canViewReports)}<br>
            Telegram ID: ${escapeHtml(employee.tgUserId || "-")}<br>
            Telegram Username: ${escapeHtml(employee.tgUsername ? "@" + employee.tgUsername : "-")}
          </div>
        </div>
      `;
    })
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

function renderPersonnelPicker() {
  const picker = $("personnelPicker");
  picker.innerHTML = `<option value="">Yeni personel ekle</option>`;

  STATE.allPersonnel.forEach((person) => {
    const option = document.createElement("option");
    option.value = person.name;
    option.textContent = `${person.name} (${roleLabel(person.role)})`;
    picker.appendChild(option);
  });
}

function clearPersonnelForm() {
  $("personnelPicker").value = "";
  $("personnelNameInput").value = "";
  $("personnelRoleSelect").value = "calisan";
  $("personnelActiveSelect").value = "true";
  $("personnelCanScoreSelect").value = "false";
  $("personnelCanViewReportsSelect").value = "false";
  $("personnelTgIdInput").value = "";
  $("personnelTgUsernameInput").value = "";
  $("personnelSaveBtn").dataset.originalName = "";
}

function applyRoleDefaults(isCreateMode = false) {
  const role = $("personnelRoleSelect").value;

  if (role === "admin" || role === "yonetici") {
    if (isCreateMode) {
      $("personnelCanScoreSelect").value = "true";
      $("personnelCanViewReportsSelect").value = "true";
    }
  }

  if (role === "calisan" && isCreateMode) {
    $("personnelCanScoreSelect").value = "false";
    $("personnelCanViewReportsSelect").value = "false";
  }
}

function fillPersonnelForm(name) {
  const person = STATE.allPersonnel.find((p) => p.name === name);

  if (!person) {
    clearPersonnelForm();
    return;
  }

  $("personnelNameInput").value = person.name || "";
  $("personnelRoleSelect").value = person.role || "calisan";
  $("personnelActiveSelect").value = person.active ? "true" : "false";
  $("personnelCanScoreSelect").value = person.canScore ? "true" : "false";
  $("personnelCanViewReportsSelect").value = person.canViewReports ? "true" : "false";
  $("personnelTgIdInput").value = person.tgUserId || "";
  $("personnelTgUsernameInput").value = person.tgUsername || "";
  $("personnelSaveBtn").dataset.originalName = person.name || "";
}

function renderReviewHistory() {
  const body = $("reviewQueueBody");
  const list = Array.isArray(STATE.reviewQueue) ? STATE.reviewQueue : [];

  $("reviewQueuePill").textContent = `${list.length} kayıt`;

  if (!list.length) {
    body.innerHTML = `<tr><td colspan="7" class="empty-td">Henüz inceleme kaydı yok.</td></tr>`;
    return;
  }

  body.innerHTML = list
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.requestNo || "-")}</td>
          <td>${escapeHtml(row.type || "-")}</td>
          <td>${escapeHtml(row.targetPerson || "-")}</td>
          <td>${escapeHtml(row.fileNames || "-")}</td>
          <td>${escapeHtml(row.status || "-")}</td>
          <td>${escapeHtml(row.createdAt || "-")}</td>
          <td>${escapeHtml(row.submittedBy || "-")}</td>
        </tr>
      `
    )
    .join("");
}

function updateReviewFileInfo() {
  const input = $("reviewFiles");
  const info = $("reviewFileInfo");
  const files = Array.from(input.files || []);

  if (!files.length) {
    info.textContent = "Maksimum 3 dosya. Her dosya en fazla 4 MB. Toplam en fazla 8 MB.";
    return;
  }

  const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
  const totalMb = (totalSize / (1024 * 1024)).toFixed(2);
  info.textContent = `${files.length} dosya seçildi • Toplam ${totalMb} MB`;
}

function clearReviewForm() {
  $("reviewType").value = "Belge";
  $("reviewTarget").value = "";
  $("reviewDescription").value = "";
  $("reviewFiles").value = "";
  updateReviewFileInfo();
}

async function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || "");
      const commaIndex = result.indexOf(",");
      const base64 = commaIndex >= 0 ? result.slice(commaIndex + 1) : result;

      resolve({
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size || 0,
        base64
      });
    };

    reader.onerror = () => reject(new Error(`Dosya okunamadı: ${file.name}`));
    reader.readAsDataURL(file);
  });
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
    STATE.allPersonnel = data.allPersonnel || [];
    STATE.criteria = data.criteria || [];
    STATE.reports = data.reports || null;
    STATE.reviewQueue = data.reviewQueue || [];

    renderPermissionUI();
    renderStats();
    renderEmployees();
    renderEmployeeSelect();
    renderCriteriaInputs();
    renderReports();
    renderPersonnelPicker();
    renderReviewHistory();

    if (!STATE.permissions.isKnownUser && STATE.tgUser?.id) {
      setStatus("Bu kullanıcı panelde tanımlı değil. Yöneticiden yetki tanımlaması iste.");
      return;
    }

    if (!STATE.permissions.canScore && !STATE.permissions.canViewReports && !STATE.permissions.canManagePersonnel && !STATE.permissions.isKnownUser) {
      setStatus("Giriş yapıldı. Fakat bu kullanıcıya panel yetkisi tanımlı değil.");
      return;
    }

    setStatus("Sistem hazır.");
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

async function handlePersonnelSave() {
  if (!STATE.permissions.canManagePersonnel) {
    showAppAlert("Bu alan için yetkin yok.");
    return;
  }

  const btn = $("personnelSaveBtn");
  const oldText = btn.textContent;

  const originalName = (btn.dataset.originalName || "").trim();
  const name = $("personnelNameInput").value.trim();
  const role = $("personnelRoleSelect").value.trim();
  const active = $("personnelActiveSelect").value === "true";
  const canScore = $("personnelCanScoreSelect").value === "true";
  const canViewReports = $("personnelCanViewReportsSelect").value === "true";
  const tgUserId = $("personnelTgIdInput").value.trim();
  const tgUsername = $("personnelTgUsernameInput").value.trim().replace(/^@/, "");

  if (!name) {
    showAppAlert("Ad Soyad boş olamaz.");
    return;
  }

  try {
    btn.disabled = true;
    btn.textContent = "Kaydediliyor...";

    const data = await apiPost({
      action: "upsertPersonnel",
      tgUserId: STATE.tgUser?.id || "",
      tgUsername: STATE.tgUser?.username || "",
      tgFullName: STATE.tgUser?.fullName || "",
      originalName,
      personnel: {
        name,
        role,
        active,
        canScore,
        canViewReports,
        tgUserId,
        tgUsername
      }
    });

    if (!data.ok) {
      throw new Error(data.message || "Personel kaydedilemedi");
    }

    showAppAlert(data.message || "Personel kaydedildi.");
    clearPersonnelForm();
    await loadBootstrap();
  } catch (err) {
    console.error(err);
    showAppAlert(`Personel kaydetme hatası: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = oldText;
  }
}

async function handlePersonnelDeactivate() {
  if (!STATE.permissions.canManagePersonnel) {
    showAppAlert("Bu alan için yetkin yok.");
    return;
  }

  const originalName = ($("personnelSaveBtn").dataset.originalName || "").trim();
  const currentName = $("personnelNameInput").value.trim();
  const targetName = originalName || currentName;

  if (!targetName) {
    showAppAlert("Pasife alınacak personeli seç.");
    return;
  }

  const btn = $("personnelDeactivateBtn");
  const oldText = btn.textContent;

  try {
    btn.disabled = true;
    btn.textContent = "Pasife alınıyor...";

    const data = await apiPost({
      action: "deactivatePersonnel",
      tgUserId: STATE.tgUser?.id || "",
      tgUsername: STATE.tgUser?.username || "",
      tgFullName: STATE.tgUser?.fullName || "",
      targetName
    });

    if (!data.ok) {
      throw new Error(data.message || "Pasife alma başarısız");
    }

    showAppAlert(data.message || "Personel pasife alındı.");
    clearPersonnelForm();
    await loadBootstrap();
  } catch (err) {
    console.error(err);
    showAppAlert(`Pasife alma hatası: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = oldText;
  }
}

async function handleReviewSubmit() {
  if (!STATE.permissions.isKnownUser) {
    showAppAlert("Bu kullanıcı panelde tanımlı değil.");
    return;
  }

  const type = $("reviewType").value.trim();
  const target = $("reviewTarget").value.trim();
  const description = $("reviewDescription").value.trim();
  const files = Array.from($("reviewFiles").files || []);

  if (!description) {
    showAppAlert("Açıklama yaz.");
    return;
  }

  if (!files.length) {
    showAppAlert("En az bir dosya seç.");
    return;
  }

  if (files.length > 3) {
    showAppAlert("En fazla 3 dosya yükleyebilirsin.");
    return;
  }

  const maxPerFile = 4 * 1024 * 1024;
  const maxTotal = 8 * 1024 * 1024;
  const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);

  for (const file of files) {
    if ((file.size || 0) > maxPerFile) {
      showAppAlert(`"${file.name}" 4 MB sınırını aşıyor.`);
      return;
    }
  }

  if (totalSize > maxTotal) {
    showAppAlert("Toplam dosya boyutu 8 MB sınırını aşıyor.");
    return;
  }

  const btn = $("reviewSubmitBtn");
  const oldText = btn.textContent;

  try {
    btn.disabled = true;
    btn.textContent = "Gönderiliyor...";

    const encodedFiles = await Promise.all(files.map(readFileAsBase64));

    const data = await apiPost({
      action: "submitReview",
      tgUserId: STATE.tgUser?.id || "",
      tgUsername: STATE.tgUser?.username || "",
      tgFullName: STATE.tgUser?.fullName || "",
      reviewType: type,
      targetPerson: target,
      description,
      files: encodedFiles
    });

    if (!data.ok) {
      throw new Error(data.message || "İnceleme gönderilemedi");
    }

    showAppAlert(data.message || "İnceleme gönderildi.");
    clearReviewForm();
    await loadBootstrap();
    switchTab("review");
  } catch (err) {
    console.error(err);
    showAppAlert(`İnceleme gönderme hatası: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = oldText;
  }
}

function setupEvents() {
  $("employeeSelect").addEventListener("change", renderCriteriaInputs);
  $("saveBtn").addEventListener("click", handleBatchSave);

  $("personnelPicker").addEventListener("change", (e) => {
    const value = e.target.value;
    if (!value) {
      clearPersonnelForm();
      return;
    }
    fillPersonnelForm(value);
  });

  $("personnelRoleSelect").addEventListener("change", () => {
    const isCreateMode = !($("personnelSaveBtn").dataset.originalName || "").trim();
    applyRoleDefaults(isCreateMode);
  });

  $("personnelSaveBtn").addEventListener("click", handlePersonnelSave);
  $("personnelDeactivateBtn").addEventListener("click", handlePersonnelDeactivate);
  $("personnelResetBtn").addEventListener("click", clearPersonnelForm);

  $("reviewFiles").addEventListener("change", updateReviewFileInfo);
  $("reviewSubmitBtn").addEventListener("click", handleReviewSubmit);
}

document.addEventListener("DOMContentLoaded", async () => {
  setupTabs();
  setToday();
  initTelegramInfo();
  setupEvents();
  clearPersonnelForm();
  clearReviewForm();
  await loadBootstrap();
});
