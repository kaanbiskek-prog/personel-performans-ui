const API_URL = "https://script.google.com/macros/s/AKfycbyBmT4GrkMfU0sF_oIPkXMEWvLBgv3C__kg18R2Ji-Hgq3xdx_8Z-435ZTV4H9dd8rJ/exec";

const $ = (id) => document.getElementById(id);

const state = {
  employees: [],
  criteria: [],
  records: [],
  reviewQueue: []
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  if (!input) return;

  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  input.value = `${yyyy}-${mm}-${dd}`;
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return "-";

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split("-");
    return `${d}.${m}.${y}`;
  }

  return dateStr;
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getTelegramUser() {
  const tg = window.Telegram?.WebApp;

  if (tg) {
    try {
      tg.ready();
      tg.expand();
    } catch (e) {
      console.warn("Telegram init uyarısı:", e);
    }
  }

  return tg?.initDataUnsafe?.user || null;
}

function initTelegramInfo() {
  const user = getTelegramUser();

  const fullName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(" ").trim()
    : "Tarayıcı Demo";

  const username = user?.username ? `@${user.username}` : "@demo";
  const userId = user?.id || 0;

  $("userChip").textContent = user ? fullName : "Tarayıcı Demo";
  $("userInfo").textContent = `Kullanıcı: ${fullName} | ${username} | ID: ${userId}`;
  $("sourceInfo").textContent = user
    ? "Kaynak: Telegram Mini App"
    : "Kaynak: Tarayıcı testi / Telegram dışı açılış";
  $("statusText").textContent = "Veriler yükleniyor...";
}

function fillEmployeeSelect() {
  const select = $("employeeSelect");
  if (!select) return;

  select.innerHTML = `<option value="">Çalışan seç</option>`;

  state.employees.forEach((emp) => {
    const opt = document.createElement("option");
    opt.value = emp.name || "";
    opt.textContent = emp.name || "";
    select.appendChild(opt);
  });
}

function fillCriteriaSelect() {
  const select = $("criteriaSelect");
  if (!select) return;

  select.innerHTML = `<option value="">Kriter seç</option>`;

  state.criteria.forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item;
    opt.textContent = item;
    select.appendChild(opt);
  });
}

function renderStats() {
  const activeCount = state.employees.filter((x) => x.active !== false).length;
  const todayValue = $("scoreDate")?.value || "";
  const todayCount = state.records.filter((r) => r.date === todayValue).length;
  const lowScoreCount = state.records.filter((r) => Number(r.score) <= 2).length;

  $("activeCount").textContent = String(activeCount);
  $("todayCount").textContent = String(todayCount);
  $("lowScoreCount").textContent = String(lowScoreCount);
}

function renderEmployees() {
  const list = $("employeeList");
  const pill = $("employeeCountPill");

  if (!list || !pill) return;

  pill.textContent = `${state.employees.length} kişi`;

  if (!state.employees.length) {
    list.innerHTML = `<div class="empty-box">Henüz çalışan verisi yok.</div>`;
    return;
  }

  list.innerHTML = state.employees
    .map((emp, index) => {
      return `
        <div class="employee-card">
          <div class="employee-index">#${index + 1}</div>
          <div class="employee-name">${escapeHtml(emp.name)}</div>
          <div class="employee-meta">Rol: ${escapeHtml(emp.role || "Belirtilmedi")}</div>
          <div class="employee-meta">Durum: ${emp.active === false ? "Pasif" : "Aktif"}</div>
        </div>
      `;
    })
    .join("");
}

function buildSummaryCards() {
  const total = state.records.length;
  const low = state.records.filter((r) => Number(r.score) <= 2).length;
  const avg =
    total > 0
      ? (
          state.records.reduce((sum, r) => sum + Number(r.score || 0), 0) / total
        ).toFixed(2)
      : "0.00";

  return [
    { title: "Toplam kayıt", value: total },
    { title: "Düşük puan", value: low },
    { title: "Ortalama puan", value: avg }
  ];
}

function renderReports() {
  const summary = $("reportSummary");
  const pill = $("reportCountPill");
  const tbody = $("recentRecordsBody");

  if (!summary || !pill || !tbody) return;

  pill.textContent = `${state.records.length} kayıt`;

  const cards = buildSummaryCards();

  summary.innerHTML = cards
    .map(
      (card) => `
        <div class="mini-stat">
          <div class="mini-stat-title">${escapeHtml(card.title)}</div>
          <div class="mini-stat-value">${escapeHtml(card.value)}</div>
        </div>
      `
    )
    .join("");

  if (!state.records.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-td">Henüz kayıt yok.</td>
      </tr>
    `;
    return;
  }

  const lastRecords = [...state.records].reverse().slice(0, 10);

  tbody.innerHTML = lastRecords
    .map(
      (r) => `
        <tr>
          <td>${escapeHtml(formatDisplayDate(r.date))}</td>
          <td>${escapeHtml(r.employeeName)}</td>
          <td>${escapeHtml(r.criteria)}</td>
          <td>${escapeHtml(r.score)}</td>
          <td>${escapeHtml(r.note || "-")}</td>
          <td>${escapeHtml(r.fullName || r.telegramUsername || "-")}</td>
        </tr>
      `
    )
    .join("");
}

function renderAll() {
  fillEmployeeSelect();
  fillCriteriaSelect();
  renderStats();
  renderEmployees();
  renderReports();
}

async function loadBootstrap() {
  try {
    $("statusText").textContent = "Veriler yükleniyor...";

    const url = `${API_URL}?action=bootstrap&_=${Date.now()}`;
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store"
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const json = await res.json();

    if (!json.ok) {
      throw new Error(json.error || "Bootstrap verisi alınamadı.");
    }

    state.employees = Array.isArray(json.data?.employees) ? json.data.employees : [];
    state.criteria = Array.isArray(json.data?.criteria) ? json.data.criteria : [];
    state.records = Array.isArray(json.data?.records) ? json.data.records : [];
    state.reviewQueue = Array.isArray(json.data?.reviewQueue) ? json.data.reviewQueue : [];

    renderAll();
    $("statusText").textContent = "Sistem hazır.";
  } catch (err) {
    console.error("Bootstrap hatası:", err);
    $("statusText").textContent = `Yükleme hatası: ${err.message}`;
  }
}

function resetFormAfterSave() {
  $("scoreSelect").value = "";
  $("noteInput").value = "";
}

function getCurrentUserPayload() {
  const tgUser = getTelegramUser();

  const fullName = tgUser
    ? [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ").trim()
    : "Tarayıcı Demo";

  return {
    telegramUserId: tgUser?.id || 0,
    telegramUsername: tgUser?.username ? `@${tgUser.username}` : "@demo",
    fullName
  };
}

async function sendScoreNoCors(payload) {
  const body = new URLSearchParams(payload);

  await fetch(API_URL, {
    method: "POST",
    body,
    mode: "no-cors",
    cache: "no-store"
  });
}

function setupSaveButton() {
  const btn = $("saveBtn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const employeeName = $("employeeSelect").value.trim();
    const criteria = $("criteriaSelect").value.trim();
    const score = $("scoreSelect").value.trim();
    const note = $("noteInput").value.trim();
    const date = $("scoreDate").value.trim();

    if (!employeeName || !criteria || !score || !date) {
      alert("Çalışan, kriter, puan ve tarih zorunlu.");
      return;
    }

    const beforeCount = state.records.length;

    const payload = {
      action: "saveScore",
      date,
      employeeName,
      criteria,
      score,
      note,
      ...getCurrentUserPayload()
    };

    try {
      btn.disabled = true;
      btn.textContent = "Kaydediliyor...";
      $("statusText").textContent = "Kayıt gönderiliyor...";

      await sendScoreNoCors(payload);

      await sleep(1500);
      await loadBootstrap();

      const afterCount = state.records.length;

      if (afterCount > beforeCount) {
        resetFormAfterSave();
        switchTab("home");
        $("statusText").textContent = `${employeeName} için kayıt başarıyla kaydedildi.`;
        alert("Kayıt başarıyla kaydedildi.");
      } else {
        $("statusText").textContent =
          "İstek gönderildi ama kayıt listede görünmedi. Apps Script tarafını kontrol et.";
        alert("İstek gönderildi ama kayıt doğrulanamadı. Sheet tarafını kontrol et.");
      }
    } catch (err) {
      console.error("Kaydetme hatası:", err);
      $("statusText").textContent = `Kaydetme hatası: ${err.message}`;
      alert(`Kaydetme hatası: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = "Kaydet";
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  setupTabs();
  setToday();
  initTelegramInfo();
  setupSaveButton();
  await loadBootstrap();
});
