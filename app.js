const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyBmT4GrkMfU0sF_oIPkXMEWvLBgv3C__kg18R2Ji-Hgq3xdx_8Z-435ZTV4H9dd8rJ/exec";
const $ = (id) => document.getElementById(id);

const APP = {
  tgUser: null,
  data: null
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

function getTelegramUser() {
  const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;

  if (tg) {
    try {
      tg.ready();
      tg.expand();
    } catch (e) {}
  }

  const user = tg && tg.initDataUnsafe ? tg.initDataUnsafe.user : null;

  return {
    id: user && user.id ? String(user.id) : "",
    username: user && user.username ? `@${String(user.username).toLowerCase()}` : "@yok",
    fullName: user
      ? [user.first_name || "", user.last_name || ""].join(" ").trim()
      : "Tarayici Demo",
    isTelegram: !!user
  };
}

function getFallbackCurrentUser() {
  const tgUser = APP.tgUser || getTelegramUser();

  return {
    name: tgUser.fullName || "Yetkisiz Kullanici",
    fullName: tgUser.fullName || "Yetkisiz Kullanici",
    role: "guest",
    active: false,
    canScore: false,
    canSeeReports: false,
    canManageEmployees: false,
    telegramUserId: tgUser.id || "-",
    telegramUsername: tgUser.username || "@yok",
    isKnownUser: false
  };
}

function setStatus(message) {
  if ($("statusText")) {
    $("statusText").textContent = message;
  }
}

function setUserMeta(currentUser) {
  const tgUser = APP.tgUser || getTelegramUser();
  const userToShow = currentUser || getFallbackCurrentUser();

  if ($("userChip")) {
    $("userChip").textContent = userToShow.fullName || tgUser.fullName || "Kullanici";
  }

  if ($("userInfo")) {
    $("userInfo").textContent =
      `Kullanici: ${userToShow.fullName || "Bilinmiyor"} | ${userToShow.telegramUsername || "@yok"} | ID: ${userToShow.telegramUserId || "-"}`;
  }

  if ($("sourceInfo")) {
    $("sourceInfo").textContent = tgUser.isTelegram
      ? "Kaynak: Telegram Mini App"
      : "Kaynak: Tarayici testi / Telegram disi acilis";
  }
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildPayload(action, extra = {}) {
  const tgUser = APP.tgUser || getTelegramUser();

  return {
    action,
    telegramUserId: tgUser.id || "",
    telegramUsername: tgUser.username || "@yok",
    fullName: tgUser.fullName || "Bilinmiyor",
    ...extra
  };
}

async function callApi(action, extra = {}) {
  const payload = buildPayload(action, extra);

  const response = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload),
    cache: "no-store"
  });

  const json = await response.json();

  if (!json.ok) {
    throw new Error(json.error || "Bilinmeyen API hatasi");
  }

  return json;
}

function renderStats(stats = {}) {
  if ($("activeCount")) $("activeCount").textContent = Number(stats.activeEmployees || 0);
  if ($("todayCount")) $("todayCount").textContent = Number(stats.todayCount || 0);
  if ($("lowScoreCount")) $("lowScoreCount").textContent = Number(stats.lowScoreCount || 0);
}

function renderEmployeeSelect(employees) {
  const select = $("employeeSelect");
  if (!select) return;

  const list = safeArray(employees);

  select.innerHTML = `<option value="">Calisan sec</option>`;

  list.forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item.name;
    opt.textContent = item.name;
    select.appendChild(opt);
  });
}

function renderCriteriaSelect(criteria) {
  const select = $("criteriaSelect");
  if (!select) return;

  const list = safeArray(criteria);

  select.innerHTML = `<option value="">Kriter sec</option>`;

  list.forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item.name;
    opt.textContent = item.name;
    select.appendChild(opt);
  });
}

function renderEmployees(employees) {
  const wrap = $("employeeList");
  const pill = $("employeeCountPill");
  if (!wrap) return;

  const list = safeArray(employees).filter((item) => item.active);

  if (pill) {
    pill.textContent = `${list.length} kisi`;
  }

  if (!list.length) {
    wrap.innerHTML = `
      <div class="empty-box">
        Henuz calisan yok.
      </div>
    `;
    return;
  }

  wrap.innerHTML = list.map((item, index) => {
    return `
      <div class="employee-card">
        <div class="employee-order">#${index + 1}</div>
        <div class="employee-name">${escapeHtml(item.name)}</div>
        <div class="employee-meta">Rol: ${escapeHtml(item.role)}</div>
        <div class="employee-meta">Durum: ${item.active ? "Aktif" : "Pasif"}</div>
      </div>
    `;
  }).join("");
}

function averageFromRecords(records) {
  if (!records.length) return "0.00";
  const total = records.reduce((sum, item) => sum + Number(item.score || 0), 0);
  return (total / records.length).toFixed(2);
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function renderReports(records, canSeeReports) {
  const summaryWrap = $("reportSummary");
  const tbody = $("recentRecordsBody");
  const pill = $("reportCountPill");
  const tabBtn = document.querySelector('.tab[data-tab="reports"]');
  const reportsSection = $("reports");

  if (tabBtn) {
    tabBtn.style.display = canSeeReports ? "" : "none";
  }

  if (reportsSection) {
    reportsSection.style.display = canSeeReports ? "" : "none";
  }

  if (!canSeeReports) {
    if (summaryWrap) summaryWrap.innerHTML = "";
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-td">Rapor goruntuleme yetkin yok.</td>
        </tr>
      `;
    }
    return;
  }

  const list = safeArray(records);
  const monthPrefix = currentMonthKey();
  const monthRecords = list.filter((item) => String(item.date || "").startsWith(monthPrefix));

  if (pill) {
    pill.textContent = `${list.length} kayit`;
  }

  if (summaryWrap) {
    summaryWrap.innerHTML = `
      <div class="summary-card">
        <div class="summary-label">Toplam kayit</div>
        <div class="summary-value">${list.length}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Genel ortalama</div>
        <div class="summary-value">${averageFromRecords(list)}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Bu ay ortalama</div>
        <div class="summary-value">${averageFromRecords(monthRecords)}</div>
      </div>
    `;
  }

  if (!tbody) return;

  if (!list.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-td">Henuz kayit yok.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.slice(0, 25).map((item) => {
    return `
      <tr>
        <td>${escapeHtml(item.date || "")}</td>
        <td>${escapeHtml(item.employeeName || "")}</td>
        <td>${escapeHtml(item.criteria || "")}</td>
        <td>${escapeHtml(String(item.score || ""))}</td>
        <td>${escapeHtml(item.note || "")}</td>
        <td>${escapeHtml(item.fullName || "")}</td>
      </tr>
    `;
  }).join("");
}

function applyPermissions(currentUser) {
  const canScore = !!(currentUser && currentUser.canScore);
  const canSeeReports = !!(currentUser && currentUser.canSeeReports);

  const saveBtn = $("saveBtn");
  if (saveBtn) {
    saveBtn.disabled = !canScore;
    saveBtn.textContent = canScore ? "Kaydet" : "Yetki yok";
  }

  renderReports(APP.data && APP.data.records ? APP.data.records : [], canSeeReports);

  if (!canSeeReports && document.querySelector('.tab.active[data-tab="reports"]')) {
    switchTab("home");
  }
}

function renderAll() {
  const data = APP.data || {};
  const currentUser = data.currentUser || getFallbackCurrentUser();

  setUserMeta(currentUser);
  renderStats(data.stats || {});
  renderEmployeeSelect(data.scoringEmployees || []);
  renderCriteriaSelect(data.criteria || []);
  renderEmployees(data.employees || []);
  applyPermissions(currentUser);

  if (!currentUser.isKnownUser) {
    setStatus("Yetkin tanimli degil. Personel sheet'e eklenmen lazim.");
  } else {
    setStatus(`Sistem hazir. Giris yapan: ${currentUser.fullName}`);
  }
}

async function loadBootstrap() {
  try {
    setStatus("Veriler yukleniyor...");
    APP.tgUser = getTelegramUser();

    const response = await callApi("bootstrap");
    APP.data = response.data || {};

    if (!APP.data.currentUser) {
      APP.data.currentUser = getFallbackCurrentUser();
    }

    renderAll();
  } catch (err) {
    const fallback = getFallbackCurrentUser();
    setUserMeta(fallback);
    setStatus(`Yukleme hatasi: ${err.message}`);
  }
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function bindSaveButton() {
  const btn = $("saveBtn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const employeeName = $("employeeSelect") ? $("employeeSelect").value : "";
    const criteria = $("criteriaSelect") ? $("criteriaSelect").value : "";
    const score = $("scoreSelect") ? $("scoreSelect").value : "";
    const note = $("noteInput") ? $("noteInput").value.trim() : "";
    const date = $("scoreDate") ? $("scoreDate").value : "";

    if (!employeeName) {
      alert("Calisan sec.");
      return;
    }

    if (!criteria) {
      alert("Kriter sec.");
      return;
    }

    if (!score) {
      alert("Puan sec.");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Kaydediliyor...";

    try {
      const response = await callApi("saverecord", {
        employeeName,
        criteria,
        score,
        note,
        date
      });

      APP.data = response.data || APP.data;
      renderAll();

      if ($("noteInput")) $("noteInput").value = "";
      if ($("scoreSelect")) $("scoreSelect").value = "";
      if ($("criteriaSelect")) $("criteriaSelect").value = "";
      if ($("employeeSelect")) $("employeeSelect").value = "";

      alert("Kayit basarili.");
      switchTab("reports");
    } catch (err) {
      alert("Kaydetme hatasi: " + err.message);
    } finally {
      const currentUser = APP.data && APP.data.currentUser ? APP.data.currentUser : getFallbackCurrentUser();
      btn.disabled = !currentUser.canScore;
      btn.textContent = currentUser.canScore ? "Kaydet" : "Yetki yok";
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  setupTabs();
  setToday();
  bindSaveButton();
  await loadBootstrap();
});
