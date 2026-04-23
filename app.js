const API_BASE = "https://script.google.com/macros/s/AKfycbyBmT4GrkMfU0sF_oIPkXMEWvLBgv3C__kg18R2Ji-Hgq3xdx_8Z-435ZTV4H9dd8rJ/exec";

const $ = (id) => document.getElementById(id);

const state = {
  telegramUser: null,
  bootstrap: null
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
  const tg = window.Telegram?.WebApp;

  if (tg) {
    try {
      tg.ready();
      tg.expand();
    } catch (e) {}
  }

  const user = tg?.initDataUnsafe?.user || null;

  if (!user) {
    return {
      id: "0",
      first_name: "Tarayıcı",
      last_name: "Demo",
      username: "demo"
    };
  }

  return {
    id: String(user.id || "0"),
    first_name: user.first_name || "",
    last_name: user.last_name || "",
    username: user.username || ""
  };
}

function getFullName(user) {
  return [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || "Bilinmiyor";
}

function setStatus(text) {
  if ($("statusText")) $("statusText").textContent = text;
}

function setUserMeta(text) {
  if ($("userInfo")) $("userInfo").textContent = text;
}

function setSourceMeta(text) {
  if ($("sourceInfo")) $("sourceInfo").textContent = text;
}

function updateStats(stats) {
  $("activeCount").textContent = String(stats?.activeEmployees || 0);
  $("todayCount").textContent = String(stats?.todayScores || 0);
  $("lowScoreCount").textContent = String(stats?.lowScoresToday || 0);
}

function fillEmployees(employees) {
  const select = $("employeeSelect");
  if (!select) return;

  select.innerHTML = `<option value="">Çalışan seç</option>`;

  employees.forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item.id;
    opt.textContent = item.department ? `${item.name} (${item.department})` : item.name;
    select.appendChild(opt);
  });
}

function fillCriteria(criteria) {
  const select = $("criteriaSelect");
  if (!select) return;

  select.innerHTML = `<option value="">Kriter seç</option>`;

  criteria.forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item.id;
    opt.textContent = item.name;
    select.appendChild(opt);
  });
}

async function apiGet(params) {
  if (!API_BASE || API_BASE.includes("BURAYA_APPS_SCRIPT_EXEC_URL")) {
    throw new Error("API_BASE alanına Apps Script exec URL yazılmamış.");
  }

  const url = new URL(API_BASE);

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

async function loadBootstrap() {
  state.telegramUser = getTelegramUser();

  const fullName = getFullName(state.telegramUser);
  const username = state.telegramUser.username || "";

  $("userChip").textContent = fullName || "Yükleniyor...";
  setStatus("Veriler yükleniyor...");
  setUserMeta("Kullanıcı bilgisi hazırlanıyor...");
  setSourceMeta("Kaynak kontrol ediliyor...");

  const data = await apiGet({
    action: "bootstrap",
    userId: state.telegramUser.id,
    fullName: fullName,
    username: username
  });

  if (!data.ok) {
    throw new Error(data.error || "Bootstrap hatası");
  }

  state.bootstrap = data;

  $("userChip").textContent = data.user?.fullName || fullName || "Bilinmiyor";

  setUserMeta(
    `Kullanıcı: ${data.user?.fullName || fullName} | ${data.user?.username || "@yok"} | ID: ${data.user?.userId || state.telegramUser.id}`
  );

  setSourceMeta(
    state.telegramUser.id === "0"
      ? "Kaynak: Tarayıcı testi / Telegram dışı açılış"
      : `Kaynak: Telegram Mini App | Rol: ${data.user?.role || "bilinmiyor"}`
  );

  if (data.user?.canScore) {
    setStatus("Sistem hazır. Çalışan ve kriterler sheet üzerinden yüklendi.");
  } else {
    setStatus("Sistem açıldı fakat bu kullanıcı puan girişi yetkisine sahip değil.");
  }

  updateStats(data.stats || {});
  fillEmployees(data.employees || []);
  fillCriteria(data.criteria || []);
}

function validateForm() {
  const date = $("scoreDate").value;
  const employeeId = $("employeeSelect").value;
  const criteriaId = $("criteriaSelect").value;
  const score = $("scoreSelect").value;

  if (!date) {
    alert("Tarih seçmeden kaydedemezsin.");
    return null;
  }

  if (!employeeId) {
    alert("Çalışan seçmeden kaydedemezsin.");
    return null;
  }

  if (!criteriaId) {
    alert("Kriter seçmeden kaydedemezsin.");
    return null;
  }

  if (!score) {
    alert("Puan seçmeden kaydedemezsin.");
    return null;
  }

  return {
    date,
    employeeId,
    criteriaId,
    score,
    note: $("noteInput").value.trim()
  };
}

function clearFormAfterSave() {
  $("scoreSelect").value = "";
  $("noteInput").value = "";
}

function setupSaveButton() {
  const btn = $("fakeSaveBtn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const payload = validateForm();
    if (!payload) return;

    const fullName = getFullName(state.telegramUser || getTelegramUser());
    const username = (state.telegramUser && state.telegramUser.username) || "";

    btn.disabled = true;
    btn.textContent = "Kaydediliyor...";

    try {
      const data = await apiGet({
        action: "saveScore",
        userId: (state.telegramUser && state.telegramUser.id) || "0",
        fullName: fullName,
        username: username,
        date: payload.date,
        employeeId: payload.employeeId,
        criteriaId: payload.criteriaId,
        score: payload.score,
        note: payload.note
      });

      if (!data.ok) {
        throw new Error(data.error || "Kayıt sırasında hata oluştu.");
      }

      updateStats(data.stats || {});
      setStatus(data.message || "Puan kaydedildi.");
      clearFormAfterSave();
      switchTab("home");
      alert(data.message || "Puan kaydedildi.");
    } catch (err) {
      setStatus("Hata: " + err.message);
      alert("Hata: " + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "Kaydet";
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  setupTabs();
  setToday();
  setupSaveButton();

  try {
    await loadBootstrap();
  } catch (err) {
    $("userChip").textContent = "Hata";
    setStatus("Bağlantı hatası: " + err.message);
    setUserMeta("Kullanıcı bilgisi alınamadı.");
    setSourceMeta("Kaynak: API bağlantısı başarısız.");
  }
});
