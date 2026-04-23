const CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbyBmT4GrkMfU0sF_oIPkXMEWvLBgv3C__kg18R2Ji-Hgq3xdx_8Z-435ZTV4H9dd8rJ/exec",
  LOW_SCORE_THRESHOLD: 2,
  DEFAULT_CRITERIA: [
    "Mesai disiplini",
    "İlk yanıt hızı",
    "Operasyonel çeviklik",
    "Problem çözme",
    "İletişim kalitesi",
    "Üye memnuniyeti",
    "Slack/grup iletişimi",
    "Ekip içi uyum",
    "Sistem ve bonus bilgisi",
    "Admin genel değerlendirme"
  ]
};

const state = {
  user: null,
  employees: [],
  criteria: [],
  records: [],
  reviewQueue: []
};

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("tr-TR");
}

function formatAverage(value) {
  return toNumber(value).toFixed(2);
}

function normalizeDate(value) {
  if (!value) return "";
  const raw = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(raw)) {
    const [dd, mm, yyyy] = raw.split(".");
    return `${yyyy}-${mm}-${dd}`;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [dd, mm, yyyy] = raw.split("/");
    return `${yyyy}-${mm}-${dd}`;
  }

  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  return raw;
}

function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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
  if (input) input.value = todayStr();
}

function setStatus(text) {
  if ($("statusText")) $("statusText").textContent = text;
}

function getTelegramUser() {
  const tg = window.Telegram?.WebApp;
  if (tg) {
    try {
      tg.ready();
      tg.expand();
    } catch (err) {}
  }

  const user = tg?.initDataUnsafe?.user || null;

  if (user) {
    return {
      fullName: [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || "Bilinmiyor",
      username: user.username ? `@${user.username}` : "@yok",
      id: user.id || 0,
      source: "Telegram Mini App"
    };
  }

  return {
    fullName: "Tarayıcı Demo",
    username: "@demo",
    id: 0,
    source: "Tarayıcı testi / Telegram dışı açılış"
  };
}

function renderUserInfo() {
  const user = state.user;
  $("userChip").textContent = user.fullName;
  $("userInfo").textContent = `Kullanıcı: ${user.fullName} | ${user.username} | ID: ${user.id}`;
  $("sourceInfo").textContent = `Kaynak: ${user.source}`;
}

function fillCriteriaSelect(criteria) {
  const select = $("criteriaSelect");
  if (!select) return;

  select.innerHTML = `<option value="">Kriter seç</option>`;

  criteria.forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item;
    opt.textContent = item;
    select.appendChild(opt);
  });
}

function fillEmployeeSelect(employees) {
  const select = $("employeeSelect");
  if (!select) return;

  select.innerHTML = `<option value="">Çalışan seç</option>`;

  employees.forEach((emp) => {
    const opt = document.createElement("option");
    opt.value = emp.name;
    opt.textContent = emp.name;
    select.appendChild(opt);
  });
}

function normalizeEmployee(item) {
  if (typeof item === "string") {
    return {
      name: item.trim(),
      role: "Belirtilmedi",
      active: true
    };
  }

  return {
    name: String(
      item.name ||
      item.employeeName ||
      item.fullName ||
      item.ad ||
      item.calisan ||
      item.employee ||
      ""
    ).trim(),
    role: String(
      item.role ||
      item.rol ||
      item.title ||
      item.position ||
      "Belirtilmedi"
    ).trim(),
    active: item.active !== false && item.aktif !== false
  };
}

function normalizeRecord(item) {
  return {
    date: normalizeDate(
      item.date ||
      item.tarih ||
      item.createdAt ||
      item.created_at ||
      ""
    ),
    employeeName: String(
      item.employeeName ||
      item.employee ||
      item.calisan ||
      item.name ||
      ""
    ).trim(),
    criteria: String(
      item.criteria ||
      item.kriter ||
      item.metric ||
      item.category ||
      ""
    ).trim(),
    score: toNumber(
      item.score ||
      item.puan ||
      item.point ||
      item.rating ||
      0
    ),
    note: String(
      item.note ||
      item.not ||
      item.comment ||
      item.aciklama ||
      ""
    ).trim()
  };
}

function uniqueTextList(arr) {
  return [...new Set(arr.map((x) => String(x || "").trim()).filter(Boolean))];
}

function normalizeBootstrap(raw) {
  const root = raw?.data || raw?.payload || raw?.result || raw || {};

  let employees = [];
  let criteria = [];
  let records = [];
  let reviewQueue = [];

  const rawEmployees =
    root.employees ||
    root.staff ||
    root.users ||
    root.calisanlar ||
    [];

  const rawCriteria =
    root.criteria ||
    root.kriterler ||
    [];

  const rawRecords =
    root.records ||
    root.scores ||
    root.points ||
    root.logs ||
    root.evaluations ||
    root.kayitlar ||
    [];

  const rawReviewQueue =
    root.reviewQueue ||
    root.review ||
    root.incelemeKuyrugu ||
    [];

  employees = Array.isArray(rawEmployees)
    ? rawEmployees.map(normalizeEmployee).filter((x) => x.name)
    : [];

  records = Array.isArray(rawRecords)
    ? rawRecords.map(normalizeRecord).filter((x) => x.employeeName)
    : [];

  reviewQueue = Array.isArray(rawReviewQueue)
    ? rawReviewQueue.map(normalizeRecord).filter((x) => x.employeeName)
    : [];

  if (!reviewQueue.length) {
    reviewQueue = records.filter((r) => r.score <= CONFIG.LOW_SCORE_THRESHOLD);
  }

  if (Array.isArray(rawCriteria) && rawCriteria.length) {
    criteria = rawCriteria.map((x) => String(x.name || x.kriter || x).trim()).filter(Boolean);
  } else {
    criteria = uniqueTextList(records.map((r) => r.criteria));
  }

  if (!criteria.length) {
    criteria = [...CONFIG.DEFAULT_CRITERIA];
  }

  if (!employees.length) {
    employees = uniqueTextList(records.map((r) => r.employeeName)).map((name) => ({
      name,
      role: "Belirtilmedi",
      active: true
    }));
  }

  return {
    employees,
    criteria,
    records,
    reviewQueue
  };
}

function getEmployeeSummary(employeeName) {
  const list = state.records.filter((r) => r.employeeName === employeeName);
  const total = list.length;
  const low = list.filter((r) => r.score <= CONFIG.LOW_SCORE_THRESHOLD).length;
  const average = total
    ? list.reduce((sum, r) => sum + toNumber(r.score), 0) / total
    : 0;

  return {
    total,
    low,
    average
  };
}

function renderTopStats() {
  const activeCount = state.employees.filter((e) => e.active !== false).length;
  const todayCount = state.records.filter((r) => normalizeDate(r.date) === todayStr()).length;
  const lowScoreCount = state.records.filter((r) => r.score <= CONFIG.LOW_SCORE_THRESHOLD).length;

  $("activeCount").textContent = formatNumber(activeCount);
  $("todayCount").textContent = formatNumber(todayCount);
  $("lowScoreCount").textContent = formatNumber(lowScoreCount);
}

function renderEmployees() {
  const box = $("employeesContent");
  if (!box) return;

  if (!state.employees.length) {
    box.innerHTML = `<div class="empty-box">Henüz çalışan verisi yok.</div>`;
    return;
  }

  box.innerHTML = state.employees.map((emp) => {
    const summary = getEmployeeSummary(emp.name);

    return `
      <div class="employee-card">
        <div class="employee-name">${escapeHtml(emp.name)}</div>
        <div class="employee-role">${escapeHtml(emp.role || "Belirtilmedi")}</div>
        <div class="employee-stats">
          <div class="metric">
            <div class="metric-label">Kayıt</div>
            <div class="metric-value">${formatNumber(summary.total)}</div>
          </div>
          <div class="metric">
            <div class="metric-label">Ortalama</div>
            <div class="metric-value">${formatAverage(summary.average)}</div>
          </div>
          <div class="metric">
            <div class="metric-label">Düşük</div>
            <div class="metric-value">${formatNumber(summary.low)}</div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function renderReports() {
  const totalRecords = state.records.length;
  const totalScore = state.records.reduce((sum, r) => sum + toNumber(r.score), 0);
  const averageScore = totalRecords ? totalScore / totalRecords : 0;
  const reviewCount = state.reviewQueue.length;

  $("reportTotalRecords").textContent = formatNumber(totalRecords);
  $("reportAverageScore").textContent = formatAverage(averageScore);
  $("reportReviewQueue").textContent = formatNumber(reviewCount);

  const rankingBody = $("rankingBody");
  const rankingRows = state.employees
    .map((emp) => {
      const summary = getEmployeeSummary(emp.name);
      return {
        name: emp.name,
        role: emp.role,
        total: summary.total,
        average: summary.average,
        low: summary.low
      };
    })
    .sort((a, b) => b.average - a.average);

  if (!rankingRows.length) {
    rankingBody.innerHTML = `<tr><td colspan="5">Henüz rapor verisi yok.</td></tr>`;
  } else {
    rankingBody.innerHTML = rankingRows.map((row) => `
      <tr>
        <td>${escapeHtml(row.name)}</td>
        <td>${escapeHtml(row.role || "Belirtilmedi")}</td>
        <td>${formatNumber(row.total)}</td>
        <td>${formatAverage(row.average)}</td>
        <td>${
          row.low > 0
            ? `<span class="badge-low">${formatNumber(row.low)} adet</span>`
            : `<span class="badge-ok">Temiz</span>`
        }</td>
      </tr>
    `).join("");
  }

  const reviewBody = $("reviewBody");
  const queue = [...state.reviewQueue].sort((a, b) => {
    return normalizeDate(b.date).localeCompare(normalizeDate(a.date));
  });

  if (!queue.length) {
    reviewBody.innerHTML = `<tr><td colspan="5">İnceleme kuyruğu boş.</td></tr>`;
  } else {
    reviewBody.innerHTML = queue.map((item) => `
      <tr>
        <td>${escapeHtml(item.date || "-")}</td>
        <td>${escapeHtml(item.employeeName || "-")}</td>
        <td>${escapeHtml(item.criteria || "-")}</td>
        <td><span class="badge-low">${escapeHtml(item.score)}</span></td>
        <td>${escapeHtml(item.note || "-")}</td>
      </tr>
    `).join("");
  }
}

function renderAll() {
  fillEmployeeSelect(state.employees);
  fillCriteriaSelect(state.criteria);
  renderTopStats();
  renderEmployees();
  renderReports();
}

function buildUrl(url, params = {}) {
  const u = new URL(url);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      u.searchParams.set(key, value);
    }
  });
  return u.toString();
}

async function readJsonResponse(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(text || "Geçersiz JSON cevabı");
  }
}

async function fetchBootstrap() {
  const apiUrl = CONFIG.API_URL.trim();

  if (!apiUrl || apiUrl.includes("BURAYA_APPS_SCRIPT_WEB_APP_URL")) {
    throw new Error("API_URL girilmemiş.");
  }

  const attempts = [
    { method: "GET", url: buildUrl(apiUrl, { action: "bootstrap" }) },
    { method: "GET", url: buildUrl(apiUrl, { action: "getBootstrap" }) },
    { method: "GET", url: buildUrl(apiUrl, { action: "getAppBootstrap" }) },
    { method: "GET", url: buildUrl(apiUrl, { mode: "bootstrap" }) }
  ];

  let lastError = "Bootstrap alınamadı.";

  for (const item of attempts) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        cache: "no-store"
      });

      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        continue;
      }

      const json = await readJsonResponse(res);
      if (json) return json;
    } catch (err) {
      lastError = err.message || String(err);
    }
  }

  throw new Error(lastError);
}

async function sendSave(payload) {
  const apiUrl = CONFIG.API_URL.trim();

  const actionNames = [
    "saveScore",
    "saveEvaluation",
    "addScore",
    "createEvaluation",
    "saveRecord"
  ];

  let lastError = "Kayıt yapılamadı.";

  for (const action of actionNames) {
    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
          action,
          date: payload.date,
          tarih: payload.date,
          employee: payload.employeeName,
          employeeName: payload.employeeName,
          calisan: payload.employeeName,
          criteria: payload.criteria,
          kriter: payload.criteria,
          score: payload.score,
          puan: payload.score,
          note: payload.note,
          not: payload.note,
          telegramUserId: state.user.id,
          telegramUsername: state.user.username,
          fullName: state.user.fullName
        })
      });

      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        continue;
      }

      const txt = await res.text();
      let json = null;

      try {
        json = JSON.parse(txt);
      } catch (err) {
        json = { ok: true, raw: txt };
      }

      if (
        json?.ok === true ||
        json?.success === true ||
        json?.status === "ok" ||
        json?.result === "ok" ||
        json?.saved === true
      ) {
        return json;
      }

      if (json && !json.error) {
        return json;
      }
    } catch (err) {
      lastError = err.message || String(err);
    }
  }

  throw new Error(lastError);
}

async function handleSave() {
  const payload = {
    date: $("scoreDate").value,
    employeeName: $("employeeSelect").value,
    criteria: $("criteriaSelect").value,
    score: toNumber($("scoreSelect").value),
    note: $("noteInput").value.trim()
  };

  if (!payload.date || !payload.employeeName || !payload.criteria || !payload.score) {
    alert("Tarih, çalışan, kriter ve puan seçmeden kaydedemezsin.");
    return;
  }

  try {
    setStatus("Kayıt gönderiliyor...");

    await sendSave(payload);

    $("noteInput").value = "";
    $("scoreSelect").value = "";

    const raw = await fetchBootstrap();
    const normalized = normalizeBootstrap(raw);

    state.employees = normalized.employees;
    state.criteria = normalized.criteria;
    state.records = normalized.records;
    state.reviewQueue = normalized.reviewQueue;

    renderAll();
    setStatus(`Kayıt tamam. ${payload.employeeName} için puan işlendi.`);
    switchTab("home");
  } catch (err) {
    setStatus(`Kayıt hatası: ${err.message}`);
    alert(`Kayıt sırasında hata oldu:\n${err.message}`);
  }
}

function setupSaveButton() {
  const btn = $("saveBtn");
  if (!btn) return;
  btn.addEventListener("click", handleSave);
}

async function initApp() {
  state.user = getTelegramUser();
  renderUserInfo();
  setStatus("Veriler yükleniyor...");

  try {
    const raw = await fetchBootstrap();
    const normalized = normalizeBootstrap(raw);

    state.employees = normalized.employees;
    state.criteria = normalized.criteria;
    state.records = normalized.records;
    state.reviewQueue = normalized.reviewQueue;

    renderAll();
    setStatus("Sistem hazır. Çalışan ve kriterler sheet üzerinden yüklendi.");
  } catch (err) {
    state.criteria = [...CONFIG.DEFAULT_CRITERIA];
    fillCriteriaSelect(state.criteria);
    renderEmployees();
    renderReports();
    renderTopStats();
    setStatus(`Backend okunamadı: ${err.message}`);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setToday();
  setupSaveButton();
  initApp();
});
