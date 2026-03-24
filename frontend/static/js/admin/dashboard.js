(function () {
  let latestStats = null;

  async function ensureI18nReady() {
    if (typeof window.RimalisI18n?.ready === 'function') {
      try {
        await window.RimalisI18n.ready();
      } catch (_) {
        // Keep page functional even if dictionaries fail to load
      }
    }
  }

  function i18n(key) {
    return window.RimalisI18n?.t?.(key, key) || key;
  }

  function animate(el, target) {
    const nTarget = Number(target);
    if (!Number.isFinite(nTarget)) return;
    let n = 0;
    const step = Math.max(1, Math.floor(nTarget / 35));
    const timer = setInterval(() => {
      n += step;
      if (n >= nTarget) {
        n = nTarget;
        clearInterval(timer);
      }
      el.textContent = window.RimalisI18n?.formatNumber?.(n) || String(n);
    }, 20);
  }

  function renderActivity(stats) {
    const feed = document.getElementById('activityFeed');
    if (!feed) return;
    feed.textContent = '';
    const rows = [
      [i18n('admin_system_status'), i18n('admin_api_synced')],
      [i18n('admin_status_pending'), `${stats.pendingReviews || 0} ${i18n('admin_objects')}`],
      [i18n('admin_unread_messages_label'), `${stats.totalMessages || 0} ${i18n('admin_items')}`],
    ];
    rows.forEach(([title, meta]) => {
      const item = document.createElement('div');
      item.className = 'item';
      const strong = document.createElement('strong');
      strong.textContent = title;
      const span = document.createElement('span');
      span.className = 'small';
      span.textContent = meta;
      item.append(strong, span);
      feed.appendChild(item);
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await ensureI18nReady();
    if (!window.RimalisAPI) return;

    try {
      const body = await window.RimalisAPI.request('/admin/dashboard', { auth: true });
      const stats = body.stats || {};
      latestStats = stats;

      const values = [
        stats.totalProperties || 0,
        stats.pendingReviews || 0,
        stats.totalUsers || 0,
        stats.totalMessages || 0,
      ];

      document.querySelectorAll('.kpi-value').forEach((el, idx) => {
        animate(el, values[idx] || 0);
      });

      renderActivity(stats);
    } catch (err) {
      console.error(err);
    }
  });

  window.addEventListener('rimalis:language-changed', async () => {
    await ensureI18nReady();
    if (latestStats) renderActivity(latestStats);
  });
})();
