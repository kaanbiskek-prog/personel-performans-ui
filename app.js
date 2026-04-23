const $ = (id) => document.getElementById(id);

function switchTab(tabId) {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });

  document.querySelectorAll(".section").forEach(section => {
    section.classList.toggle("active", section.id === tabId);
  });
}

function setupTabs() {
  document.querySelectorAll(".tab").forEach(btn => {
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

  const fullName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(" ").trim()
    : "Bilinmiyor";

  const username = user?.username ? `@${user.username}` : "@yok";
  const userId = user?.id || 0;

  $("userChip").textContent = user ? fullName : "Tarayıcı Demo";
  $("userInfo").textContent = `Kullanıcı: ${fullName} | ${username} | ID: ${userId}`;
  $("sourceInfo").textContent = user
    ? "Kaynak: Telegram Mini App"
    : "Kaynak: Tarayıcı testi / Telegram dışı açılış";
  $("statusText").textContent = user
    ? "Telegram kullanıcı bilgisi başarıyla alındı."
    : "Telegram dışı açılış. Bu normal.";

  // örnek çalışan listesi
  const select = $("employeeSelect");
  ["İzel", "Emre", "Merve", "Kadir", "Taner"].forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });
}

function setupFakeSave() {
  $("fakeSaveBtn").addEventListener("click", () => {
    const employee = $("employeeSelect").value;
    const criteria = $("criteriaSelect").value;
    const score = $("scoreSelect").value;

    if (employee === "Çalışan seç" || criteria === "Kriter seç" || score === "Puan seç") {
      alert("Çalışan, kriter ve puan seçmeden kaydedemezsin.");
      return;
    }

    $("statusText").textContent = `Test kaydı hazır: ${employee} / ${criteria} / ${score}`;
    if (score === "1" || score === "2") {
      $("lowScoreCount").textContent = String(Number($("lowScoreCount").textContent) + 1);
    }
    $("todayCount").textContent = String(Number($("todayCount").textContent) + 1);
    switchTab("home");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setToday();
  initTelegramInfo();
  setupFakeSave();
});