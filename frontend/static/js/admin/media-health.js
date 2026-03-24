(function () {
  const STORAGE_KEY = 'rimalis_admin_media_health_saved_views_v1';
  let latestHealth = null;

  function i18n(key) {
    return window.RimalisI18n?.t?.(key, key) || key;
  }

  async function ensureI18nReady() {
    if (typeof window.RimalisI18n?.ready === 'function') {
      try { await window.RimalisI18n.ready(); } catch (_) {}
    }
  }

  function notify(message, type = 'info') {
    if (typeof window.showNotification === 'function') {
      window.showNotification(message, type);
      return;
    }
    const el = document.createElement('div');
    el.className = 'notice';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function formatNumber(value) {
    return window.RimalisI18n?.formatNumber?.(value) || String(value || 0);
  }

  function formatDateTime(value) {
    return window.RimalisI18n?.formatDateTime?.(value) || '-';
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value;
  }

  function readCleanupParams() {
    const days = Number.parseInt(String(document.getElementById('mediaOlderThanDays')?.value || '30'), 10);
    const prefix = String(document.getElementById('mediaPrefix')?.value || 'uploads/images/').trim();
    return {
      olderThanDays: Number.isFinite(days) && days >= 0 ? days : 30,
      prefix: prefix || 'uploads/images/',
    };
  }

  function getSavedViews() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch (_) {
      return {};
    }
  }

  function saveSavedViews(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data || {}));
  }

  function populateSavedViews() {
    const sel = document.getElementById('mediaSavedView');
    if (!sel) return;
    const views = getSavedViews();
    sel.textContent = '';
    const base = document.createElement('option');
    base.value = 'default';
    base.textContent = 'Saved views';
    sel.appendChild(base);
    const focus = document.createElement('option');
    focus.value = 'orphans-focus';
    focus.textContent = 'Orphans focus';
    sel.appendChild(focus);
    Object.keys(views).forEach((name) => {
      const opt = document.createElement('option');
      opt.value = `custom:${name}`;
      opt.textContent = name;
      sel.appendChild(opt);
    });
  }

  function applySavedView(value) {
    if (value === 'orphans-focus') {
      const days = document.getElementById('mediaOlderThanDays');
      const prefix = document.getElementById('mediaPrefix');
      if (days) days.value = '14';
      if (prefix) prefix.value = 'uploads/images/';
      return;
    }

    if (!value.startsWith('custom:')) return;
    const name = value.slice('custom:'.length);
    const view = getSavedViews()[name];
    if (!view) return;

    const days = document.getElementById('mediaOlderThanDays');
    const prefix = document.getElementById('mediaPrefix');
    if (days) days.value = String(view.olderThanDays || 30);
    if (prefix) prefix.value = String(view.prefix || 'uploads/images/');
  }

  function renderHealth() {
    const health = latestHealth;
    if (!health) return;

    setText('mediaTotalStorage', `${health.totalMB} MB`);
    setText('mediaObjectCount', formatNumber(health.totalObjects));
    setText('mediaOrphanCount', `${formatNumber(health?.orphanEstimate?.count || 0)} (${health?.orphanEstimate?.mb || 0} MB)`);
    setText('mediaDriver', String(health.driver || '-').toUpperCase());

    setText('mediaImagesStats', `${formatNumber(health.images?.objects || 0)} ${i18n('admin_media_health_objects_suffix')} • ${health.images?.mb || 0} MB`);
    setText('mediaAvatarsStats', `${formatNumber(health.avatars?.objects || 0)} ${i18n('admin_media_health_objects_suffix')} • ${health.avatars?.mb || 0} MB`);

    const cron = health.cron || {};
    const cronState = cron.enabled ? i18n('admin_media_health_cron_enabled') : i18n('admin_media_health_cron_disabled');
    setText('mediaCronInfo', `${cronState} • ${cron.time || '-'} • ${i18n('admin_media_health_older_than_days')}: ${cron.olderThanDays ?? '-'} • ${cron.prefix || '-'}`);

    const sampleWrap = document.getElementById('mediaOrphanSample');
    if (sampleWrap) {
      const sample = Array.isArray(health?.orphanEstimate?.sample) ? health.orphanEstimate.sample : [];
      sampleWrap.textContent = '';
      if (!sample.length) {
        const d = document.createElement('div');
        d.className = 'support-empty';
        d.textContent = i18n('admin_media_health_no_orphans');
        sampleWrap.appendChild(d);
      } else {
        sample.slice(0, 20).forEach((item) => {
          const date = item?.lastModified ? formatDateTime(item.lastModified) : '-';
          const row = document.createElement('div');
          row.className = 'media-list-item';
          const p1 = document.createElement('p');
          p1.textContent = `${date} • ${String(item.size || 0)} B`;
          const p2 = document.createElement('p');
          p2.textContent = String(item.key || '-');
          row.append(p1, p2);
          sampleWrap.appendChild(row);
        });
      }
    }

    const tableBody = document.getElementById('mediaLargestListingsBody');
    if (tableBody) {
      const rows = Array.isArray(health.largestListings) ? health.largestListings : [];
      tableBody.textContent = '';
      if (!rows.length) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 7;
        td.textContent = i18n('admin_media_health_no_listings');
        tr.appendChild(td);
        tableBody.appendChild(tr);
      } else {
        rows.forEach((item) => {
          const score = Number(item.healthScore || 0);
          const risk = Number(item.orphanRisk || 0);
          const scoreClass = score >= 80 ? 'text-emerald-300' : (score >= 55 ? 'text-amber-300' : 'text-rose-300');
          const tr = document.createElement('tr');
          const cells = [
            String(item.referenceCode || item.id || '-'),
            String(item.title || '-'),
            String(item.imageCount || 0),
            `${String(item.totalImageMB || 0)} MB`,
            `${String(Math.round(risk * 100))}%`,
            `${String(score)}/100`,
            String(formatDateTime(item.updatedAt)),
          ];
          cells.forEach((txt, idx) => {
            const td = document.createElement('td');
            td.textContent = txt;
            if (idx === 5) td.className = scoreClass;
            tr.appendChild(td);
          });
          tableBody.appendChild(tr);
        });
      }
    }

    const daysInput = document.getElementById('mediaOlderThanDays');
    const prefixInput = document.getElementById('mediaPrefix');
    if (daysInput && health?.orphanEstimate?.olderThanDays != null) daysInput.value = String(health.orphanEstimate.olderThanDays);
    if (prefixInput && health?.orphanEstimate?.prefix) prefixInput.value = String(health.orphanEstimate.prefix);
  }

  async function loadHealth() {
    const body = await window.RimalisAPI.request('/admin/media-health', { auth: true });
    latestHealth = body?.health || null;
    renderHealth();
  }

  async function runCleanup(apply) {
    const params = readCleanupParams();
    const body = await window.RimalisAPI.request('/admin/media-health/cleanup', {
      method: 'POST',
      auth: true,
      body: JSON.stringify({
        apply: Boolean(apply),
        prefix: params.prefix,
        olderThanDays: params.olderThanDays,
      }),
    });

    const result = body?.result || {};
    if (apply) {
      notify(i18n('admin_media_health_cleanup_done').replace('{count}', String(result.deletedCount || 0)).replace('{mb}', String(result.deletedMB || 0)), 'success');
    } else {
      notify(i18n('admin_media_health_dry_run_done').replace('{count}', String(result.orphanCount || 0)).replace('{mb}', String(result.orphanMB || 0)), 'info');
    }

    await loadHealth();
  }

  function bindEvents() {
    document.getElementById('mediaRefreshBtn')?.addEventListener('click', async () => {
      try {
        await loadHealth();
        notify(i18n('admin_support_refresh_success'), 'success');
      } catch (err) {
        notify(err.message || i18n('admin_media_health_load_failed'), 'error');
      }
    });

    document.getElementById('mediaDryRunBtn')?.addEventListener('click', async () => {
      try { await runCleanup(false); } catch (err) { notify(err.message || i18n('admin_media_health_cleanup_failed'), 'error'); }
    });

    document.getElementById('mediaApplyCleanupBtn')?.addEventListener('click', async () => {
      const ok = window.confirm(i18n('admin_media_health_cleanup_confirm'));
      if (!ok) return;
      try { await runCleanup(true); } catch (err) { notify(err.message || i18n('admin_media_health_cleanup_failed'), 'error'); }
    });

    document.getElementById('mediaSavedView')?.addEventListener('change', (event) => {
      applySavedView(String(event.target.value || 'default'));
    });

    document.getElementById('mediaSaveViewBtn')?.addEventListener('click', () => {
      const name = window.prompt('Name this view');
      if (!name) return;
      const params = readCleanupParams();
      const views = getSavedViews();
      views[String(name).trim()] = {
        olderThanDays: params.olderThanDays,
        prefix: params.prefix,
      };
      saveSavedViews(views);
      populateSavedViews();
      notify('View saved', 'success');
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await ensureI18nReady();
    if (!window.RimalisAPI) return;

    bindEvents();
    populateSavedViews();

    try {
      await loadHealth();
    } catch (err) {
      notify(err.message || i18n('admin_media_health_load_failed'), 'error');
    }

    if (window.AdminLive?.onEvent) {
      window.AdminLive.onEvent((event) => {
        if (!event || event.type !== 'media.updated') return;
        loadHealth().catch(() => {});
      });
    }
  });

  window.addEventListener('rimalis:language-changed', async () => {
    await ensureI18nReady();
    renderHealth();
  });
})();
