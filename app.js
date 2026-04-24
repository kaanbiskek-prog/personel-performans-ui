const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyBmT4GrkMfU0sF_oIPkXMEWvLBgv3C__kg18R2Ji-Hgq3xdx_8Z-435ZTV4H9dd8rJ/exec";

const $ = (id) => document.getElementById(id);
const state = {
  tgUser: null,
  currentUser: null,
  permissions: {
    isKnownUser: false,
    canManageEmployees: false,
    canScore: false,
    canViewReports: false,
  },
  employees: [],
  rateableEmployees: [],
  criteria: [],
  records: [],
};

function switchTab(tabId) {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  document.querySelectorAll('.section').forEach((section) => {
    section.classList.toggle('active', section.id === tabId);
  });
}

function setupTabs() {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

function setToday() {
  const input = $('scoreDate');
  if (!input) return;
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  input.value = `${yyyy}-${mm}-${dd}`;
}

function initTelegramInfo() {
  const tg = window.Telegram?.WebApp;
  if (tg) {
    try {
      tg.ready();
      tg.expand();
    } catch (_) {}
  }

  const user = tg?.initDataUnsafe?.user || null;
  state.tgUser = user;

  const fullName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || 'Telegram Kullanıcısı'
    : 'Tarayıcı Demo';
  const username = user?.username ? `@${user.username}` : '@demo';
  const userId = user?.id ? String(user.id) : '0';

  if ($('userChip')) $('userChip').textContent = fullName;
  if ($('userInfo')) $('userInfo').textContent = `Kullanıcı: ${fullName} | ${username} | ID: ${userId}`;
  if ($('sourceInfo')) $('sourceInfo').textContent = user
    ? 'Kaynak: Telegram Mini App'
    : 'Kaynak: Tarayıcı testi / Telegram dışı açılış';
  if ($('statusText')) $('statusText').textContent = 'Veriler yükleniyor...';
}

function getRequestUserPayload() {
  const user = state.tgUser;
  const fullName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || 'Telegram Kullanıcısı'
    : 'Tarayıcı Demo';

  return {
    telegramUserId: user?.id ? String(user.id) : '',
    telegramUsername: user?.username ? `@${user.username}` : '',
    fullName,
  };
}

async function apiRequest(action, extra = {}) {
  if (!WEB_APP_URL || WEB_APP_URL.includes('BURAYA_APPS_SCRIPT_WEB_APP_URL_YAPISTIR')) {
    throw new Error('WEB_APP_URL boş. app.js içine Apps Script Web App URL yapıştırılmamış.');
  }

  const payload = {
    action,
    ...getRequestUserPayload(),
    ...extra,
  };

  const res = await fetch(WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!json.ok) {
    throw new Error(json.error || 'Bilinmeyen sunucu hatası');
  }
  return json;
}

function normalizeBootstrap(data) {
  const safeCurrentUser = data?.currentUser || {
    isKnownUser: false,
    name: 'Yetkisiz Kullanıcı',
    username: '@yok',
    telegramUserId: '-',
    role: 'ziyaretci',
    permissions: {
      isKnownUser: false,
      canManageEmployees: false,
      canScore: false,
      canViewReports: false,
    },
  };

  const safePermissions = safeCurrentUser.permissions || data?.permissions || {
    isKnownUser: false,
    canManageEmployees: false,
    canScore: false,
    canViewReports: false,
  };

  state.currentUser = safeCurrentUser;
  state.permissions = safePermissions;
  state.employees = Array.isArray(data?.employees) ? data.employees : [];
  state.rateableEmployees = Array.isArray(data?.rateableEmployees) ? data.rateableEmployees : [];
  state.criteria = Array.isArray(data?.criteria) ? data.criteria : [];
  state.records = Array.isArray(data?.records) ? data.records : [];

  if ($('activeCount')) $('activeCount').textContent = String(data?.activeCount || 0);
  if ($('todayCount')) $('todayCount').textContent = String(data?.todayCount || 0);
  if ($('lowScoreCount')) $('lowScoreCount').textContent = String(data?.lowScoreCount || 0);

  if ($('statusText')) {
    if (!safePermissions.isKnownUser) {
      $('statusText').textContent = 'Yetkisiz kullanıcı. Önce Personel sheet içine seni admin/yönetici olarak eklemek gerekiyor.';
    } else {
      $('statusText').textContent = `Giriş başarılı. Rol: ${roleLabel(safeCurrentUser.role)}.`;
    }
  }

  if ($('userInfo')) {
    $('userInfo').textContent = `Kullanıcı: ${safeCurrentUser.name} | ${safeCurrentUser.username || '@yok'} | ID: ${safeCurrentUser.telegramUserId || '-'}`;
  }

  fillEmployeeSelect();
  fillCriteriaSelect();
  renderEmployees();
  renderReports();
  applyPermissionsToUI();
}

function roleLabel(role) {
  if (role === 'admin') return 'Admin';
  if (role === 'yonetici') return 'Yönetici';
  if (role === 'calisan') return 'Çalışan';
  return 'Ziyaretçi';
}

function fillEmployeeSelect() {
  const select = $('employeeSelect');
  if (!select) return;

  select.innerHTML = '<option value="">Çalışan seç</option>';
  state.rateableEmployees.forEach((employee) => {
    const opt = document.createElement('option');
    opt.value = employee.name;
    opt.textContent = employee.name;
    select.appendChild(opt);
  });
}

function fillCriteriaSelect() {
  const select = $('criteriaSelect');
  if (!select) return;

  select.innerHTML = '<option value="">Kriter seç</option>';
  state.criteria.forEach((criteria) => {
    const opt = document.createElement('option');
    opt.value = criteria.name;
    opt.textContent = criteria.name;
    select.appendChild(opt);
  });
}

function renderEmployees() {
  const wrap = $('employeeList');
  const pill = $('employeeCountPill');
  if (!wrap) return;

  const visibleEmployees = state.rateableEmployees;
  if (pill) pill.textContent = `${visibleEmployees.length} kişi`;

  if (!visibleEmployees.length) {
    wrap.innerHTML = '<div class="empty-box">Henüz çalışan yok.</div>';
    return;
  }

  wrap.innerHTML = visibleEmployees.map((employee, index) => `
    <div class="employee-card">
      <div class="employee-order">#${index + 1}</div>
      <div class="employee-name">${escapeHtml(employee.name)}</div>
      <div class="employee-meta">Rol: ${roleLabel(employee.role)}</div>
      <div class="employee-meta">Durum: ${employee.active ? 'Aktif' : 'Pasif'}</div>
    </div>
  `).join('');
}

function renderReports() {
  const body = $('recentRecordsBody');
  const pill = $('reportCountPill');
  const summary = $('reportSummary');
  if (pill) pill.textContent = `${state.records.length} kayıt`;

  if (summary) {
    const avg = state.records.length
      ? (state.records.reduce((sum, r) => sum + Number(r.score || 0), 0) / state.records.length).toFixed(2)
      : '0.00';

    summary.innerHTML = `
      <div class="summary-card"><div class="summary-label">Toplam kayıt</div><div class="summary-value">${state.records.length}</div></div>
      <div class="summary-card"><div class="summary-label">Ortalama puan</div><div class="summary-value">${avg}</div></div>
      <div class="summary-card"><div class="summary-label">Düşük puan</div><div class="summary-value">${state.records.filter(r => Number(r.score) <= 2).length}</div></div>
    `;
  }

  if (!body) return;

  if (!state.records.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty-td">Henüz kayıt yok.</td></tr>';
    return;
  }

  const rows = [...state.records].slice(-20).reverse();
  body.innerHTML = rows.map((r) => `
    <tr>
      <td>${escapeHtml(r.date || '')}</td>
      <td>${escapeHtml(r.employeeName || '')}</td>
      <td>${escapeHtml(r.criteria || '')}</td>
      <td>${escapeHtml(String(r.score || ''))}</td>
      <td>${escapeHtml(r.note || '')}</td>
      <td>${escapeHtml(r.fullName || '')}</td>
    </tr>
  `).join('');
}

function applyPermissionsToUI() {
  const canScore = !!state.permissions?.canScore;
  const canViewReports = !!state.permissions?.canViewReports;

  const saveBtn = $('saveBtn');
  if (saveBtn) saveBtn.disabled = !canScore;

  const dailyTab = document.querySelector('.tab[data-tab="daily"]');
  if (dailyTab) dailyTab.style.display = canScore ? '' : 'none';

  const reportTab = document.querySelector('.tab[data-tab="reports"]');
  if (reportTab) reportTab.style.display = canViewReports ? '' : 'none';

  if (!canScore && document.querySelector('.tab.active')?.dataset?.tab === 'daily') {
    switchTab('home');
  }
  if (!canViewReports && document.querySelector('.tab.active')?.dataset?.tab === 'reports') {
    switchTab('home');
  }
}

function setupSaveButton() {
  const btn = $('saveBtn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    try {
      if (!state.permissions?.canScore) {
        alert('Puan verme yetkin yok.');
        return;
      }

      const date = $('scoreDate')?.value || '';
      const employeeName = $('employeeSelect')?.value || '';
      const criteria = $('criteriaSelect')?.value || '';
      const score = $('scoreSelect')?.value || '';
      const note = $('noteInput')?.value?.trim() || '';

      if (!date || !employeeName || !criteria || !score) {
        alert('Tarih, çalışan, kriter ve puan zorunlu.');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Kaydediliyor...';

      const response = await apiRequest('saveScore', {
        date,
        employeeName,
        note,
        criteriaItems: [{ criteria, score: Number(score) }],
      });

      normalizeBootstrap(response.data);
      $('scoreSelect').value = '';
      $('criteriaSelect').value = '';
      $('noteInput').value = '';
      switchTab('home');
      alert('Kayıt başarılı.');
    } catch (err) {
      alert(`Kaydetme hatası: ${err.message || err}`);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Kaydet';
    }
  });
}

async function loadBootstrap() {
  try {
    const response = await apiRequest('bootstrap');
    normalizeBootstrap(response.data);
  } catch (err) {
    console.error(err);
    if ($('statusText')) {
      $('statusText').textContent = `Yükleme hatası: ${err.message || err}`;
    }

    const fallbackUser = getRequestUserPayload();
    if ($('userInfo')) {
      $('userInfo').textContent = `Kullanıcı: ${fallbackUser.fullName || 'Yetkisiz Kullanıcı'} | ${fallbackUser.telegramUsername || '@yok'} | ID: ${fallbackUser.telegramUserId || '-'}`;
    }
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  setToday();
  initTelegramInfo();
  setupSaveButton();
  await loadBootstrap();
});
