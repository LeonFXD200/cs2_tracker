// =============================================
// app.js — Main application controller
// =============================================

// ---- State ----
let allItems       = [];  // raw from API
let processedItems = [];  // with change data attached
let baseline       = null;
let currentTab     = 'dashboard';

// Market tab pagination
let marketPage     = 1;
const PER_PAGE     = 75;

// Refresh countdown
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let refreshTimer   = null;
let countdownTimer = null;
let secondsLeft    = REFRESH_INTERVAL_MS / 1000;

// Sort state for full-page tables
const sortState = {
  gainers: { col: 'pct', dir: 'desc' },
  losers:  { col: 'pct', dir: 'asc'  },
};

// ---- Boot ----
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupRefreshBtn();
  setupMarketControls();
  setupAlertsTab();
  setupNotifBanner();
  setupGainersLosersSearch();
  init();
});

async function init() {
  showLoading(true);
  baseline = getDailyBaseline();
  renderAlertsList();
  renderAlertHistory();
  updateAlertBadge();

  try {
    await loadAndRender(false);
    startRefreshCycle();
  } catch (err) {
    showError(err.message);
  }
  showLoading(false);
}

// ---- Core data cycle ----
async function loadAndRender(force = false) {
  hideError();
  setLiveStatus('loading');

  try {
    allItems = await fetchItems(force);
  } catch (err) {
    setLiveStatus('error');
    throw err;
  }

  const isFirstLoad = !baseline;

  if (isFirstLoad) {
    // First load today — capture baseline, show notice
    saveDailyBaseline(allItems);
    baseline = getDailyBaseline();
    document.getElementById('baselineNotice').style.display = 'block';
    setTimeout(() => {
      document.getElementById('baselineNotice').style.display = 'none';
    }, 8000);
  }

  // Attach change data to every item
  processedItems = allItems.map(item => {
    const chg = calculateChange(item, baseline);
    return { ...item, chg };
  });

  renderAll();
  checkAlerts(processedItems, getAlerts());
  setLiveStatus('live');
  updateHeaderStats();
  buildTicker();
  resetCountdown();
}

function renderAll() {
  renderDashboard();
  renderGainersFull();
  renderLosersFull();
  renderMarket();
}

// ---- Dashboard ----
function renderDashboard() {
  const gainers = getSorted('gainers', 10);
  const losers  = getSorted('losers',  10);
  renderMiniTable('dashGainersBody', gainers);
  renderMiniTable('dashLosersBody',  losers);
}

function renderMiniTable(tbodyId, items) {
  const tbody = document.getElementById(tbodyId);
  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty">No data yet — check back after next refresh.</td></tr>`;
    return;
  }
  tbody.innerHTML = items.map((item, i) => {
    const price = fmtPrice(item.suggested_price);
    const chgCell = chgPillHtml(item.chg);
    return `<tr>
      <td class="rank">${i + 1}</td>
      <td class="skin-name" title="${escHtml(item.market_hash_name)}">${escHtml(shortName(item.market_hash_name))}</td>
      <td class="price-val mono">$${price}</td>
      <td>${chgCell}</td>
      <td><button class="btn-alert-row" onclick="quickAlert('${escAttr(item.market_hash_name)}', ${item.suggested_price})">+ Alert</button></td>
    </tr>`;
  }).join('');
}

// ---- Gainers full tab ----
function renderGainersFull() {
  const query   = document.getElementById('gainersSearch').value.toLowerCase();
  const { col, dir } = sortState.gainers;
  const gainers = getGainers().filter(item =>
    item.market_hash_name.toLowerCase().includes(query)
  );
  sortItems(gainers, col, dir);
  renderFullTable('gainersFullBody', gainers, 7);
}

function renderLosersFull() {
  const query  = document.getElementById('losersSearch').value.toLowerCase();
  const { col, dir } = sortState.losers;
  const losers = getLosers().filter(item =>
    item.market_hash_name.toLowerCase().includes(query)
  );
  sortItems(losers, col, dir);
  renderFullTable('losersFullBody', losers, 7);
}

function renderFullTable(tbodyId, items, colCount) {
  const tbody = document.getElementById(tbodyId);
  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="${colCount}" class="empty">No items match.</td></tr>`;
    return;
  }
  tbody.innerHTML = items.map((item, i) => {
    return `<tr>
      <td class="rank">${i + 1}</td>
      <td class="skin-name" title="${escHtml(item.market_hash_name)}">${escHtml(shortName(item.market_hash_name))}</td>
      <td class="price-val mono">$${fmtPrice(item.suggested_price)}</td>
      <td>${chgPillHtml(item.chg)}</td>
      <td class="mono ${item.chg ? (item.chg.abs >= 0 ? 'green' : 'red') : ''}">${item.chg ? (item.chg.abs >= 0 ? '+' : '') + fmtPrice(item.chg.abs) : '—'}</td>
      <td class="qty-val mono">${item.quantity}</td>
      <td><button class="btn-alert-row" onclick="quickAlert('${escAttr(item.market_hash_name)}', ${item.suggested_price})">+ Alert</button></td>
    </tr>`;
  }).join('');
}

// ---- Market Tab ----
function renderMarket() {
  const query  = document.getElementById('marketSearch').value.toLowerCase();
  const sort   = document.getElementById('marketSort').value;
  const filter = document.getElementById('marketFilter').value;

  let items = processedItems.filter(item =>
    item.market_hash_name.toLowerCase().includes(query)
  );

  if (filter === 'gainers') items = items.filter(i => i.chg && i.chg.pct > 0);
  if (filter === 'losers')  items = items.filter(i => i.chg && i.chg.pct < 0);

  switch (sort) {
    case 'pct_desc':   items.sort((a, b) => (b.chg?.pct ?? -999) - (a.chg?.pct ?? -999)); break;
    case 'pct_asc':    items.sort((a, b) => (a.chg?.pct ?? 999)  - (b.chg?.pct ?? 999));  break;
    case 'price_desc': items.sort((a, b) => b.suggested_price - a.suggested_price); break;
    case 'price_asc':  items.sort((a, b) => a.suggested_price - b.suggested_price); break;
    case 'name_asc':   items.sort((a, b) => a.market_hash_name.localeCompare(b.market_hash_name)); break;
    case 'qty_desc':   items.sort((a, b) => b.quantity - a.quantity); break;
  }

  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  if (marketPage > pages) marketPage = pages;

  const slice = items.slice((marketPage - 1) * PER_PAGE, marketPage * PER_PAGE);

  const tbody = document.getElementById('marketBody');
  if (!slice.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty">No items match your filters.</td></tr>`;
  } else {
    tbody.innerHTML = slice.map(item => {
      return `<tr>
        <td class="skin-name" title="${escHtml(item.market_hash_name)}">${escHtml(shortName(item.market_hash_name))}</td>
        <td class="price-val mono">$${fmtPrice(item.suggested_price)}</td>
        <td class="mono muted">$${fmtPrice(item.min_price)}</td>
        <td class="mono muted">$${fmtPrice(item.max_price)}</td>
        <td>${chgPillHtml(item.chg)}</td>
        <td class="mono ${item.chg ? (item.chg.abs >= 0 ? 'green' : 'red') : ''}">${item.chg ? (item.chg.abs >= 0 ? '+' : '') + fmtPrice(item.chg.abs) : '—'}</td>
        <td class="qty-val mono">${item.quantity}</td>
        <td><button class="btn-alert-row" onclick="quickAlert('${escAttr(item.market_hash_name)}', ${item.suggested_price})">+ Alert</button></td>
      </tr>`;
    }).join('');
  }

  renderPagination(pages, total);
}

function renderPagination(pages, total) {
  const pg  = document.getElementById('marketPagination');
  const inf = document.getElementById('marketPageInfo');
  inf.textContent = `${total.toLocaleString()} items`;

  if (pages <= 1) { pg.innerHTML = ''; return; }

  let html = '';
  html += `<button class="page-btn" onclick="goPage(1)" ${marketPage===1?'disabled':''}>«</button>`;
  html += `<button class="page-btn" onclick="goPage(${marketPage-1})" ${marketPage===1?'disabled':''}>‹</button>`;

  const range = buildPageRange(marketPage, pages);
  range.forEach(p => {
    if (p === '…') {
      html += `<span style="color:var(--text-3);padding:0 4px">…</span>`;
    } else {
      html += `<button class="page-btn ${p===marketPage?'active':''}" onclick="goPage(${p})">${p}</button>`;
    }
  });

  html += `<button class="page-btn" onclick="goPage(${marketPage+1})" ${marketPage===pages?'disabled':''}>›</button>`;
  html += `<button class="page-btn" onclick="goPage(${pages})" ${marketPage===pages?'disabled':''}>»</button>`;
  pg.innerHTML = html;
}

function buildPageRange(cur, total) {
  if (total <= 7) return Array.from({length: total}, (_, i) => i+1);
  const pages = new Set([1, total, cur, cur-1, cur+1].filter(p => p >= 1 && p <= total));
  const sorted = [...pages].sort((a,b) => a-b);
  const result = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i-1] > 1) result.push('…');
    result.push(p);
  });
  return result;
}

function goPage(p) {
  marketPage = p;
  renderMarket();
  document.getElementById('tab-market')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---- Helpers: sorted subsets ----
function getGainers() {
  return processedItems.filter(i => i.chg && i.chg.pct > 0).sort((a,b) => b.chg.pct - a.chg.pct);
}
function getLosers() {
  return processedItems.filter(i => i.chg && i.chg.pct < 0).sort((a,b) => a.chg.pct - b.chg.pct);
}
function getSorted(type, limit) {
  const list = type === 'gainers' ? getGainers() : getLosers();
  return limit ? list.slice(0, limit) : list;
}

function sortItems(items, col, dir) {
  const sign = dir === 'desc' ? -1 : 1;
  items.sort((a, b) => {
    switch (col) {
      case 'name':  return sign * a.market_hash_name.localeCompare(b.market_hash_name);
      case 'price': return sign * (a.suggested_price - b.suggested_price);
      case 'pct':   return sign * ((a.chg?.pct ?? 0) - (b.chg?.pct ?? 0));
      case 'abs':   return sign * ((a.chg?.abs ?? 0) - (b.chg?.abs ?? 0));
      case 'qty':   return sign * (a.quantity - b.quantity);
      default:      return 0;
    }
  });
}

// ---- Ticker tape ----
function buildTicker() {
  const top = [...processedItems]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 30);

  if (!top.length) return;

  const inner = document.getElementById('tickerInner');
  const items = top.map(item => {
    const chg   = item.chg;
    const cls   = chg ? (chg.pct > 0 ? 'green' : chg.pct < 0 ? 'red' : '') : '';
    const arrow = chg ? (chg.pct > 0 ? '▲' : chg.pct < 0 ? '▼' : '—') : '';
    const pct   = chg ? Math.abs(chg.pct).toFixed(2) + '%' : '';
    return `<span class="ticker-item">
      <span class="t-name">${escHtml(shortName(item.market_hash_name, 30))}</span>
      <span class="t-price">$${fmtPrice(item.suggested_price)}</span>
      ${chg ? `<span class="t-chg ${cls}">${arrow} ${pct}</span>` : ''}
    </span>`;
  }).join('');

  // Duplicate for seamless loop
  inner.innerHTML = items + items;

  // Adjust animation duration based on content count
  const duration = Math.max(40, top.length * 3);
  inner.style.animationDuration = `${duration}s`;
}

// ---- Header stats ----
function updateHeaderStats() {
  const g = getGainers().length;
  const l = getLosers().length;
  document.getElementById('hdrGainers').textContent = g;
  document.getElementById('hdrLosers').textContent  = l;
  document.getElementById('hdrTracked').textContent = processedItems.length.toLocaleString();
}

// ---- Refresh cycle ----
function startRefreshCycle() {
  clearTimers();
  refreshTimer = setInterval(async () => {
    clearApiCache();
    try { await loadAndRender(true); }
    catch (err) { showError(err.message); setLiveStatus('error'); }
  }, REFRESH_INTERVAL_MS);

  secondsLeft = REFRESH_INTERVAL_MS / 1000;
  countdownTimer = setInterval(tickCountdown, 1000);
}

function resetCountdown() {
  secondsLeft = REFRESH_INTERVAL_MS / 1000;
}

function tickCountdown() {
  secondsLeft = Math.max(0, secondsLeft - 1);
  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  document.getElementById('hdrRefresh').textContent = `${m}:${String(s).padStart(2, '0')}`;
}

function clearTimers() {
  if (refreshTimer)   clearInterval(refreshTimer);
  if (countdownTimer) clearInterval(countdownTimer);
}

// ---- UI setup ----
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${tab}`)?.classList.add('active');
      currentTab = tab;
      if (tab === 'alerts') renderAlertsList();
    });
  });
}

function setupRefreshBtn() {
  document.getElementById('refreshBtn').addEventListener('click', async () => {
    clearTimers();
    clearApiCache();
    showLoading(true);
    try { await loadAndRender(true); }
    catch (err) { showError(err.message); }
    showLoading(false);
    startRefreshCycle();
  });

  document.getElementById('alertsHeaderBtn').addEventListener('click', () => {
    switchTab('alerts');
  });

  document.getElementById('errorRetryBtn')?.addEventListener('click', async () => {
    hideError();
    clearApiCache();
    showLoading(true);
    try { await loadAndRender(true); startRefreshCycle(); }
    catch (err) { showError(err.message); }
    showLoading(false);
  });
}

function setupMarketControls() {
  ['marketSearch', 'marketSort', 'marketFilter'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      marketPage = 1;
      renderMarket();
    });
  });
}

function setupGainersLosersSearch() {
  document.getElementById('gainersSearch').addEventListener('input', renderGainersFull);
  document.getElementById('losersSearch').addEventListener('input', renderLosersFull);

  // Sortable headers
  document.getElementById('gainersFullTable')?.querySelectorAll('th[data-col]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (sortState.gainers.col === col) {
        sortState.gainers.dir = sortState.gainers.dir === 'asc' ? 'desc' : 'asc';
      } else {
        sortState.gainers.col = col;
        sortState.gainers.dir = 'desc';
      }
      updateSortHeaders('gainersFullTable', sortState.gainers);
      renderGainersFull();
    });
  });

  document.getElementById('losersFullTable')?.querySelectorAll('th[data-col]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (sortState.losers.col === col) {
        sortState.losers.dir = sortState.losers.dir === 'asc' ? 'desc' : 'asc';
      } else {
        sortState.losers.col = col;
        sortState.losers.dir = 'desc';
      }
      updateSortHeaders('losersFullTable', sortState.losers);
      renderLosersFull();
    });
  });
}

function updateSortHeaders(tableId, state) {
  document.getElementById(tableId)?.querySelectorAll('th[data-col]').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.col === state.col) {
      th.classList.add(state.dir === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });
}

// ---- Alerts Tab ----
let selectedAlertSkin = null;

function setupAlertsTab() {
  const input      = document.getElementById('alertSkinInput');
  const dropdown   = document.getElementById('alertAutocomplete');
  const addBtn     = document.getElementById('addAlertBtn');
  const clearBtn   = document.getElementById('clearAlertsBtn');
  const clearHist  = document.getElementById('clearHistoryBtn');

  input.addEventListener('input', () => {
    selectedAlertSkin = null;
    document.getElementById('alertCurrentWrap').style.display = 'none';
    document.getElementById('alertFormHint').textContent = '';

    const q = input.value.trim().toLowerCase();
    if (q.length < 2) { closeDropdown(dropdown); return; }

    const matches = allItems
      .filter(i => i.market_hash_name.toLowerCase().includes(q))
      .slice(0, 10);

    if (!matches.length) { closeDropdown(dropdown); return; }

    dropdown.innerHTML = matches.map(item =>
      `<div class="autocomplete-item" data-name="${escAttr(item.market_hash_name)}" data-price="${item.suggested_price}">
        <span>${escHtml(item.market_hash_name)}</span>
        <span class="ac-price">$${fmtPrice(item.suggested_price)}</span>
      </div>`
    ).join('');

    dropdown.querySelectorAll('.autocomplete-item').forEach(el => {
      el.addEventListener('click', () => {
        const name  = el.dataset.name;
        const price = parseFloat(el.dataset.price);
        input.value = name;
        selectedAlertSkin = { name, price };
        document.getElementById('alertCurrentVal').textContent  = `$${fmtPrice(price)}`;
        document.getElementById('alertCurrentWrap').style.display = 'block';
        closeDropdown(dropdown);
      });
    });

    dropdown.classList.add('open');
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.autocomplete-wrap')) closeDropdown(dropdown);
  });

  addBtn.addEventListener('click', () => {
    const hint = document.getElementById('alertFormHint');
    hint.className = 'form-hint';

    if (!selectedAlertSkin) {
      hint.textContent = 'Please select a skin from the dropdown.';
      hint.className = 'form-hint error';
      return;
    }

    const dir   = document.querySelector('input[name="alertDir"]:checked').value;
    const price = parseFloat(document.getElementById('alertPriceInput').value);

    if (!price || price <= 0) {
      hint.textContent = 'Enter a valid target price.';
      hint.className = 'form-hint error';
      return;
    }

    addAlert(selectedAlertSkin.name, dir, price);
    renderAlertsList();
    updateAlertBadge();
    showToast('Alert Set', `You'll be notified when ${selectedAlertSkin.name} ${dir === 'above' ? 'rises above' : 'drops below'} $${price.toFixed(2)}.`, 'success');

    // Reset form
    input.value = '';
    document.getElementById('alertPriceInput').value = '';
    document.getElementById('alertCurrentWrap').style.display = 'none';
    selectedAlertSkin = null;
    hint.textContent = '';
  });

  clearBtn.addEventListener('click', () => {
    if (!confirm('Clear all active alerts?')) return;
    clearAlerts();
    renderAlertsList();
    updateAlertBadge();
  });

  clearHist.addEventListener('click', () => {
    clearAlertHistory();
    renderAlertHistory();
  });
}

function closeDropdown(el) {
  el.classList.remove('open');
  el.innerHTML = '';
}

function renderAlertsList() {
  const container = document.getElementById('alertsList');
  const alerts    = getAlerts();

  if (!alerts.length) {
    container.innerHTML = '<div class="empty">No active alerts. Set one above!</div>';
    return;
  }

  container.innerHTML = alerts.map(alert => {
    const icon  = alert.type === 'above' ? '📈' : '📉';
    const cls   = alert.type === 'above' ? 'above' : 'below';
    const dir   = alert.type === 'above' ? '↑ Rises above' : '↓ Drops below';
    return `<div class="alert-item">
      <div class="alert-icon">${icon}</div>
      <div class="alert-info">
        <div class="alert-skin">${escHtml(alert.skinName)}</div>
        <div class="alert-detail">${dir} <span class="at-price ${cls}">$${fmtPrice(alert.targetPrice)}</span></div>
      </div>
      <button class="alert-remove" onclick="removeAlertAndRender('${alert.id}')">Remove</button>
    </div>`;
  }).join('');
}

function renderAlertHistory() {
  const container = document.getElementById('alertHistory');
  const hist      = getAlertHistory();

  if (!hist.length) {
    container.innerHTML = '<div class="empty">No alerts triggered yet.</div>';
    return;
  }

  container.innerHTML = hist.map(entry => {
    const dir  = entry.type === 'above' ? 'rose above' : 'dropped below';
    const icon = entry.type === 'above' ? '📈' : '📉';
    const time = new Date(entry.firedAt).toLocaleString();
    return `<div class="history-item">
      <div class="history-icon">${icon}</div>
      <div class="history-info">
        <div>${escHtml(entry.skinName)} ${dir} $${fmtPrice(entry.targetPrice)} — hit <strong>$${fmtPrice(entry.priceAt)}</strong></div>
        <div class="history-time">${time}</div>
      </div>
    </div>`;
  }).join('');
}

function removeAlertAndRender(id) {
  removeAlert(id);
  renderAlertsList();
  updateAlertBadge();
}

function updateAlertBadge() {
  const badge  = document.getElementById('alertsBadge');
  const count  = getAlerts().length;
  badge.textContent = count;
  badge.style.display = count > 0 ? 'inline-flex' : 'none';
}

// Called from table rows
function quickAlert(skinName, currentPrice) {
  switchTab('alerts');
  document.getElementById('alertSkinInput').value = skinName;
  selectedAlertSkin = { name: skinName, price: currentPrice };
  document.getElementById('alertCurrentVal').textContent  = `$${fmtPrice(currentPrice)}`;
  document.getElementById('alertCurrentWrap').style.display = 'block';
  document.getElementById('alertPriceInput').focus();
}

// ---- Notification banner ----
function setupNotifBanner() {
  if (isNotifDismissed() || !('Notification' in window)) return;
  if (Notification.permission !== 'default') return;

  document.getElementById('notifBanner').style.display = 'flex';

  document.getElementById('enableNotifBtn').addEventListener('click', async () => {
    const ok = await requestNotifPermission();
    document.getElementById('notifBanner').style.display = 'none';
    if (ok) showToast('Notifications enabled', 'You\'ll receive alerts even when the tab is in the background.', 'success');
  });

  document.getElementById('dismissNotifBtn').addEventListener('click', () => {
    setNotifDismissed();
    document.getElementById('notifBanner').style.display = 'none';
  });
}

// ---- Util: status & overlays ----
function showLoading(on) {
  document.getElementById('loadingOverlay').classList.toggle('hidden', !on);
}

function showError(msg) {
  const banner = document.getElementById('errorBanner');
  document.getElementById('errorMsg').textContent = `⚠ ${msg}`;
  banner.style.display = 'flex';
}

function hideError() {
  document.getElementById('errorBanner').style.display = 'none';
}

function setLiveStatus(state) {
  const dot  = document.getElementById('liveDot');
  const text = document.getElementById('liveStatus');
  dot.className = 'live-dot';
  if (state === 'live')    { dot.classList.add('active'); text.textContent = 'Live Data'; }
  if (state === 'loading') { text.textContent = 'Updating…'; }
  if (state === 'error')   { dot.classList.add('error');  text.textContent = 'Fetch failed'; }
}

function switchTab(name) {
  document.querySelector(`.tab-btn[data-tab="${name}"]`)?.click();
}

// ---- Util: formatting ----
function fmtPrice(n) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function shortName(name, maxLen = 40) {
  return name.length > maxLen ? name.slice(0, maxLen - 1) + '…' : name;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(str) {
  return String(str).replace(/'/g, '\\\'');
}

function chgPillHtml(chg) {
  if (!chg) return `<span class="chg-pill flat">—</span>`;
  const cls   = chg.pct > 0 ? 'up' : chg.pct < 0 ? 'down' : 'flat';
  const arrow = chg.pct > 0 ? '▲' : chg.pct < 0 ? '▼' : '—';
  const val   = Math.abs(chg.pct).toFixed(2) + '%';
  return `<span class="chg-pill ${cls}">${arrow} ${val}</span>`;
}
