// =============================================
// storage.js — localStorage helpers
// =============================================

const KEYS = {
  baseline: 'cs2t_baseline',
  alerts:   'cs2t_alerts',
  history:  'cs2t_alert_history',
  notif:    'cs2t_notif_dismissed',
};

// ---- Daily price baseline ----

function getTodayStr() {
  return new Date().toDateString();
}

function saveDailyBaseline(items) {
  const prices = {};
  items.forEach(item => {
    if (item.suggested_price > 0) {
      prices[item.market_hash_name] = item.suggested_price;
    }
  });
  try {
    localStorage.setItem(KEYS.baseline, JSON.stringify({ date: getTodayStr(), prices }));
  } catch (_) {}
}

function getDailyBaseline() {
  try {
    const raw = localStorage.getItem(KEYS.baseline);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.date !== getTodayStr()) return null; // expired — new day
    return data;
  } catch (_) { return null; }
}

function calculateChange(item, baseline) {
  if (!baseline || !baseline.prices) return null;
  const prev = baseline.prices[item.market_hash_name];
  if (!prev || !item.suggested_price) return null;
  const abs = item.suggested_price - prev;
  const pct = (abs / prev) * 100;
  return { prev, abs, pct };
}

// ---- Alerts ----

function getAlerts() {
  try { return JSON.parse(localStorage.getItem(KEYS.alerts) || '[]'); }
  catch (_) { return []; }
}

function saveAlerts(list) {
  try { localStorage.setItem(KEYS.alerts, JSON.stringify(list)); } catch (_) {}
}

function addAlert(skinName, type, targetPrice) {
  const list = getAlerts();
  const alert = {
    id: Date.now().toString(),
    skinName,
    type,          // 'above' | 'below'
    targetPrice,
    createdAt: new Date().toISOString(),
    triggered: false,
  };
  list.push(alert);
  saveAlerts(list);
  return alert;
}

function removeAlert(id) {
  saveAlerts(getAlerts().filter(a => a.id !== id));
}

function clearAlerts() {
  saveAlerts([]);
}

// ---- Alert History ----

function getAlertHistory() {
  try { return JSON.parse(localStorage.getItem(KEYS.history) || '[]'); }
  catch (_) { return []; }
}

function pushAlertHistory(entry) {
  const hist = getAlertHistory();
  hist.unshift(entry);
  if (hist.length > 100) hist.length = 100;
  try { localStorage.setItem(KEYS.history, JSON.stringify(hist)); } catch (_) {}
}

function clearAlertHistory() {
  try { localStorage.removeItem(KEYS.history); } catch (_) {}
}

// ---- Notification dismissed flag ----

function isNotifDismissed() {
  return localStorage.getItem(KEYS.notif) === '1';
}

function setNotifDismissed() {
  try { localStorage.setItem(KEYS.notif, '1'); } catch (_) {}
}
