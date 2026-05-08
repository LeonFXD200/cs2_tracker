// =============================================
// alerts.js — Price alert checking & notifications
// =============================================

// Track alert+price combos already fired this session so we don't spam
const _fired = new Set();

async function requestNotifPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied')  return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function sendBrowserNotif(title, body) {
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: 'https://www.counterstrike.com/favicon.ico',
        silent: false,
      });
    } catch (_) {}
  }
}

function showToast(title, body, type = 'alert') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const icons = { alert: '🔔', success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}-toast`;
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || '🔔'}</div>
    <div class="toast-content">
      <div class="toast-title">${escHtml(title)}</div>
      <div class="toast-body">${escHtml(body)}</div>
    </div>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 7000);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function checkAlerts(processedItems, alerts) {
  if (!alerts.length || !processedItems.length) return;

  const byName = {};
  processedItems.forEach(item => { byName[item.market_hash_name] = item; });

  alerts.forEach(alert => {
    const item = byName[alert.skinName];
    if (!item) return;

    const price = item.suggested_price;
    const fireKey = `${alert.id}__${alert.type}__${Math.floor(price * 10)}`;
    if (_fired.has(fireKey)) return;

    const hit =
      (alert.type === 'above' && price >= alert.targetPrice) ||
      (alert.type === 'below' && price <= alert.targetPrice);

    if (!hit) return;

    _fired.add(fireKey);

    const dir = alert.type === 'above' ? 'risen above' : 'dropped below';
    const title = `CS2 Alert — ${alert.skinName}`;
    const body  = `Price has ${dir} your $${alert.targetPrice.toFixed(2)} target. Now: $${price.toFixed(2)}`;

    sendBrowserNotif(title, body);
    showToast(title, body, 'alert');

    pushAlertHistory({
      id:          Date.now().toString(),
      skinName:    alert.skinName,
      type:        alert.type,
      targetPrice: alert.targetPrice,
      priceAt:     price,
      firedAt:     new Date().toISOString(),
    });
  });
}
