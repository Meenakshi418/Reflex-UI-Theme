// FocusFlow – Popup Script

const FEATURE_KEYS = [
  'progressiveReveal', 'readingFocus', 'simplification',
  'distractionFreeze', 'autoScroll', 'sectionCollapse', 'focusMode'
];

let settings = {
  frustrationDetection: true,
  adaptiveTheme: true,
  progressiveReveal: false,
  readingFocus: false,
  simplification: false,
  distractionFreeze: false,
  autoScroll: false,
  sectionCollapse: false,
  focusMode: false,
};

let currentScore = 0;

// ── Load settings ────────────────────────────────────────────
chrome.storage.sync.get('focusflowSettings', (data) => {
  if (data.focusflowSettings) {
    settings = { ...settings, ...data.focusflowSettings };
  }
  renderSettings();
  pollScore();
});

// ── Render ────────────────────────────────────────────────────
function renderSettings() {
  document.getElementById('adaptiveTheme').checked = settings.adaptiveTheme;

  FEATURE_KEYS.forEach(key => {
    const cb = document.querySelector(`input[data-key="${key}"]`);
    if (cb) cb.checked = !!settings[key];

    const row = document.querySelector(`.feature-row[data-key="${key}"]`);
    if (row) row.classList.toggle('active', !!settings[key]);
  });
}

function updateMeter(score) {
  currentScore = score;
  const fill = document.getElementById('meterFill');
  const display = document.getElementById('scoreDisplay');
  const status = document.getElementById('frustStatus');

  fill.style.width = score + '%';
  display.innerHTML = `${score} <span>/ 100</span>`;

  fill.className = 'meter-fill';
  status.className = 'frust-status';

  if (score < 30) {
    status.textContent = '😌 Calm — browsing normally';
  } else if (score < 60) {
    fill.classList.add('warn');
    status.classList.add('active');
    status.textContent = '😤 Mild frustration detected';
  } else {
    fill.classList.add('danger');
    status.classList.add('danger');
    status.textContent = '🚨 High frustration — adaptations activated!';
  }
}

// ── Save + send to content script ────────────────────────────
function saveSettings() {
  chrome.storage.sync.set({ focusflowSettings: settings });
}

function sendFeatureToggle(key, enabled) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    chrome.tabs.sendMessage(tabs[0].id, {
      type: enabled ? 'ENABLE_FEATURE' : 'DISABLE_FEATURE',
      feature: key,
    });
  });
}

// ── Poll frustration score ────────────────────────────────────
function pollScore() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_FRUSTRATION_SCORE' }, () => {
      if (chrome.runtime.lastError) { } // tab might not have content script
    });
  });
}

// ── Listen for score updates ──────────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'FRUSTRATION_UPDATE') updateMeter(msg.score);
  if (msg.type === 'ADAPTIVE_TRIGGERED') {
    // Update toggles to reflect auto-activated features
    ['focusMode', 'readingFocus', 'distractionFreeze'].forEach(k => {
      settings[k] = true;
    });
    saveSettings();
    renderSettings();
  }
});

// ── Feature toggle clicks ─────────────────────────────────────
FEATURE_KEYS.forEach(key => {
  const cb = document.querySelector(`input[data-key="${key}"]`);
  const row = document.querySelector(`.feature-row[data-key="${key}"]`);
  if (!cb) return;

  cb.addEventListener('change', () => {
    settings[key] = cb.checked;
    if (row) row.classList.toggle('active', cb.checked);
    saveSettings();
    sendFeatureToggle(key, cb.checked);
  });

  // Also allow clicking the row itself
  if (row) {
    row.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT') return;
      cb.checked = !cb.checked;
      cb.dispatchEvent(new Event('change'));
    });
  }
});

// ── Adaptive theme toggle ─────────────────────────────────────
document.getElementById('adaptiveTheme').addEventListener('change', (e) => {
  settings.adaptiveTheme = e.target.checked;
  saveSettings();
});

// ── Reset frustration ─────────────────────────────────────────
document.getElementById('btnReset').addEventListener('click', () => {
  updateMeter(0);
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    chrome.tabs.sendMessage(tabs[0].id, { type: 'RESET_FRUSTRATION' });
  });
});
if (frustrationScore > 40) {
  showThemeSelector();
}