(function () {
  let controls = null;
  let versions = [];
  let auditEntries = [];
  let currentAdminLevel = 'content';

  const SECTION_PRESET = {
    home: ['hero', 'search', 'featured', 'about', 'areas', 'chat'],
    properties: ['hero', 'grid', 'chat'],
    areas: ['hero', 'grid', 'chat'],
  };

  const CONTENT_KEYS = [
    'homeHeroBadge',
    'homeHeroLine1',
    'homeHeroLine2',
    'homeHeroDescription',
    'propertiesHeroTitle',
    'propertiesHeroDesc',
    'areasHeroTitle',
    'areasHeroDesc',
  ];

  function i18n(key) {
    return window.RimalisI18n?.t?.(key, key) || key;
  }

  function notify(message, type = 'info') {
    if (window.showNotification) {
      window.showNotification(message, type);
      return;
    }
    const n = document.createElement('div');
    n.className = 'notice';
    n.textContent = message;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 2200);
  }

  function getCurrentUserId() {
    return window.RimalisAPI?.getUser?.()?.id || '';
  }

  function resolveAdminLevel(data) {
    const userId = getCurrentUserId();
    const levels = Array.isArray(data?.adminLevels) ? data.adminLevels : [];
    const mine = levels.find((item) => String(item?.userId || '') === String(userId));
    return mine?.adminLevel === 'super' ? 'super' : 'content';
  }

  function applyRoleGuards() {
    const isSuper = currentAdminLevel === 'super';
    const guardedIds = ['maintenanceMode', 'maintenanceStartsAt', 'maintenanceEndsAt'];
    guardedIds.forEach((id) => {
      const node = document.getElementById(id);
      if (!node) return;
      node.disabled = !isSuper;
      node.title = isSuper ? '' : 'Endast super admin kan ändra detta';
    });

    const rotateBtn = document.getElementById('rotatePreviewBtn');
    if (rotateBtn) {
      rotateBtn.disabled = !isSuper;
      rotateBtn.title = isSuper ? '' : 'Endast super admin kan rotera preview-token';
    }

    document.querySelectorAll('[data-admin-level-id]').forEach((node) => {
      node.disabled = !isSuper;
      node.title = isSuper ? '' : 'Endast super admin kan ändra roller';
    });
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function toLocalInput(isoValue) {
    if (!isoValue) return '';
    const date = new Date(isoValue);
    if (Number.isNaN(date.getTime())) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d}T${hh}:${mm}`;
  }

  function toIsoOrNull(localValue) {
    const v = String(localValue || '').trim();
    if (!v) return null;
    const date = new Date(v);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  function pageTitleFromSlug(slug) {
    const map = {
      home: i18n('nav_home'),
      properties: i18n('nav_properties'),
      areas: i18n('nav_areas'),
      about: i18n('nav_about'),
      contact: i18n('nav_contact'),
      faq: 'FAQ',
      privacy: i18n('footer_privacy'),
      terms: i18n('footer_terms'),
      cookies: i18n('footer_cookies'),
    };
    return map[slug] || slug;
  }

  function renderKpis() {
    const pages = controls?.pages || [];
    const enabled = pages.filter((p) => p.enabled).length;
    const nav = pages.filter((p) => p.showInNav).length;
    const pagesEl = document.getElementById('scPagesCount');
    const enabledEl = document.getElementById('scEnabledCount');
    const navEl = document.getElementById('scNavCount');
    if (pagesEl) pagesEl.textContent = String(pages.length);
    if (enabledEl) enabledEl.textContent = String(enabled);
    if (navEl) navEl.textContent = String(nav);
  }

  function setValues(data) {
    controls = data;
    currentAdminLevel = resolveAdminLevel(data);

    const maintenanceMode = document.getElementById('maintenanceMode');
    const maintenanceMessage = document.getElementById('maintenanceMessage');
    const maintenanceStartsAt = document.getElementById('maintenanceStartsAt');
    const maintenanceEndsAt = document.getElementById('maintenanceEndsAt');

    if (maintenanceMode) maintenanceMode.checked = Boolean(data.maintenanceMode);
    if (maintenanceMessage) maintenanceMessage.value = data.maintenanceMessage || '';
    if (maintenanceStartsAt) maintenanceStartsAt.value = toLocalInput(data.maintenanceStartsAt);
    if (maintenanceEndsAt) maintenanceEndsAt.value = toLocalInput(data.maintenanceEndsAt);

    const bannerEnabled = document.getElementById('bannerEnabled');
    const bannerLevel = document.getElementById('bannerLevel');
    const bannerText = document.getElementById('bannerText');
    if (bannerEnabled) bannerEnabled.checked = Boolean(data.banner?.enabled);
    if (bannerLevel) bannerLevel.value = data.banner?.level || 'info';
    if (bannerText) bannerText.value = data.banner?.text || '';

    const abHomeEnabled = document.getElementById('abHomeEnabled');
    const abHomeVariant = document.getElementById('abHomeVariant');
    if (abHomeEnabled) abHomeEnabled.checked = Boolean(data.abHome?.enabled);
    if (abHomeVariant) abHomeVariant.value = data.abHome?.activeVariant || 'a';

    const abHeadlineA = document.getElementById('abHeadlineA');
    const abHeadlineB = document.getElementById('abHeadlineB');
    if (abHeadlineA) abHeadlineA.value = data.contentBlocks?.['home.hero.line1.a'] || '';
    if (abHeadlineB) abHeadlineB.value = data.contentBlocks?.['home.hero.line1.b'] || '';

    const rows = document.getElementById('siteControlsRows');
    if (rows) {
      rows.textContent = '';
      (data.pages || []).forEach((page) => {
        const homeLock = page.slug === 'home';
        const redirect = data.redirectRules?.[page.slug] || { enabled: false, to: '' };
        const access = data.accessRules?.[page.slug] || 'public';
        const tr = document.createElement('tr');
        tr.dataset.slug = String(page.slug || '');

        const tdTitle = document.createElement('td');
        const strong = document.createElement('strong');
        strong.textContent = pageTitleFromSlug(page.slug);
        const small = document.createElement('div');
        small.className = 'small';
        small.textContent = `/${page.slug || ''}`;
        tdTitle.append(strong, small);

        const mkSwitch = (cls, checked, disabled) => {
          const label = document.createElement('label');
          label.className = 'switch';
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.className = cls;
          input.checked = Boolean(checked);
          if (disabled) input.disabled = true;
          const slider = document.createElement('span');
          slider.className = 'slider';
          label.append(input, slider);
          return label;
        };

        const tdEnabled = document.createElement('td');
        tdEnabled.appendChild(mkSwitch('ctrl-enabled', page.enabled, homeLock));
        const tdNav = document.createElement('td');
        tdNav.appendChild(mkSwitch('ctrl-nav', page.showInNav));

        const tdAccess = document.createElement('td');
        const select = document.createElement('select');
        select.className = 'select ctrl-access';
        [['public', 'Public'], ['authenticated', 'Authenticated']].forEach(([v, txt]) => {
          const o = document.createElement('option');
          o.value = v;
          o.textContent = txt;
          if (access === v) o.selected = true;
          select.appendChild(o);
        });
        tdAccess.appendChild(select);

        const tdRedirect = document.createElement('td');
        const redirectSwitch = mkSwitch('ctrl-redirect-enabled', redirect.enabled);
        redirectSwitch.style.marginBottom = '6px';
        const redirectInput = document.createElement('input');
        redirectInput.className = 'input ctrl-redirect-to';
        redirectInput.value = String(redirect.to || '');
        redirectInput.placeholder = 'https://...';
        tdRedirect.append(redirectSwitch, redirectInput);

        const tdMsg = document.createElement('td');
        const msg = document.createElement('input');
        msg.className = 'input ctrl-message';
        msg.value = String(page.maintenanceMessage || '');
        tdMsg.appendChild(msg);

        tr.append(tdTitle, tdEnabled, tdNav, tdAccess, tdRedirect, tdMsg);
        rows.appendChild(tr);
      });
    }

    const sectionRows = document.getElementById('sectionControlsRows');
    if (sectionRows) {
      sectionRows.textContent = '';
      Object.entries(SECTION_PRESET).forEach(([slug, sections]) => {
        const cfg = data.sectionControls?.[slug] || {};
        const row = document.createElement('div');
        row.className = 'row-item';
        sections.forEach((section) => {
          const checked = cfg[section] !== false;
          const label = document.createElement('label');
          label.className = 'toggle-row';
          const span = document.createElement('span');
          span.textContent = `${slug}.${section}`;
          const sw = document.createElement('label');
          sw.className = 'switch';
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.dataset.sectionSlug = slug;
          input.dataset.sectionKey = section;
          input.checked = checked;
          const slider = document.createElement('span');
          slider.className = 'slider';
          sw.append(input, slider);
          label.append(span, sw);
          row.appendChild(label);
        });
        sectionRows.appendChild(row);
      });
    }

    const contentRows = document.getElementById('contentBlocksRows');
    if (contentRows) {
      contentRows.textContent = '';
      CONTENT_KEYS.forEach((key) => {
        const value = data.contentBlocks?.[key] || '';
        const row = document.createElement('div');
        row.className = 'row-item';
        const label = document.createElement('label');
        label.className = 'small';
        label.textContent = key;
        const input = document.createElement('input');
        input.className = 'input';
        input.dataset.contentKey = key;
        input.value = String(value);
        row.append(label, input);
        contentRows.appendChild(row);
      });
    }

    const adminRows = document.getElementById('adminLevelsRows');
    if (adminRows) {
      adminRows.textContent = '';
      (data.adminLevels || []).forEach((admin) => {
        const row = document.createElement('div');
        row.className = 'row-item';
        const left = document.createElement('div');
        const strong = document.createElement('strong');
        strong.textContent = String(admin.name || admin.email || admin.userId || '');
        const small = document.createElement('div');
        small.className = 'small';
        small.textContent = String(admin.email || '');
        left.append(strong, small);
        const select = document.createElement('select');
        select.className = 'select';
        select.dataset.adminLevelId = String(admin.userId || '');
        [['super', 'Super'], ['content', 'Content']].forEach(([v, txt]) => {
          const o = document.createElement('option');
          o.value = v;
          o.textContent = txt;
          if (admin.adminLevel === v) o.selected = true;
          select.appendChild(o);
        });
        row.append(left, select);
        adminRows.appendChild(row);
      });
    }

    const previewLink = document.getElementById('previewLink');
    if (previewLink) {
      const token = data.previewToken || '';
      previewLink.value = token ? `${window.location.origin}/templates/public/home.html?preview=${token}` : '';
    }

    renderKpis();
    applyRoleGuards();
  }

  function collectPayload() {
    const rows = Array.from(document.querySelectorAll('#siteControlsRows tr[data-slug]'));
    const pages = rows.map((row) => {
      const slug = row.getAttribute('data-slug') || '';
      return {
        slug,
        enabled: row.querySelector('.ctrl-enabled')?.checked ?? true,
        showInNav: row.querySelector('.ctrl-nav')?.checked ?? true,
        maintenanceMessage: String(row.querySelector('.ctrl-message')?.value || '').trim(),
      };
    });

    const redirectRules = {};
    const accessRules = {};
    rows.forEach((row) => {
      const slug = row.getAttribute('data-slug') || '';
      redirectRules[slug] = {
        enabled: row.querySelector('.ctrl-redirect-enabled')?.checked ?? false,
        to: String(row.querySelector('.ctrl-redirect-to')?.value || '').trim(),
      };
      accessRules[slug] = String(row.querySelector('.ctrl-access')?.value || 'public');
    });

    const sectionControls = {};
    document.querySelectorAll('[data-section-slug][data-section-key]').forEach((node) => {
      const slug = node.getAttribute('data-section-slug') || '';
      const key = node.getAttribute('data-section-key') || '';
      if (!sectionControls[slug]) sectionControls[slug] = {};
      sectionControls[slug][key] = node.checked;
    });

    const contentBlocks = {};
    document.querySelectorAll('[data-content-key]').forEach((node) => {
      const key = node.getAttribute('data-content-key') || '';
      if (!CONTENT_KEYS.includes(key)) return;
      contentBlocks[key] = String(node.value || '').trim();
    });

    const abHeadlineA = String(document.getElementById('abHeadlineA')?.value || '').trim();
    const abHeadlineB = String(document.getElementById('abHeadlineB')?.value || '').trim();
    if (abHeadlineA) contentBlocks['home.hero.line1.a'] = abHeadlineA;
    if (abHeadlineB) contentBlocks['home.hero.line1.b'] = abHeadlineB;

    const adminLevels = Array.from(document.querySelectorAll('[data-admin-level-id]')).map((node) => ({
      userId: node.getAttribute('data-admin-level-id') || '',
      adminLevel: String(node.value || 'content'),
    })).filter((item) => item.userId);

    const isSuper = currentAdminLevel === 'super';
    const maintenanceModeNext = document.getElementById('maintenanceMode')?.checked ?? false;
    const maintenanceModeCurrent = Boolean(controls?.maintenanceMode);

    return {
      maintenanceMode: isSuper ? maintenanceModeNext : maintenanceModeCurrent,
      maintenanceMessage: String(document.getElementById('maintenanceMessage')?.value || '').trim(),
      maintenanceStartsAt: isSuper ? toIsoOrNull(document.getElementById('maintenanceStartsAt')?.value || '') : (controls?.maintenanceStartsAt || null),
      maintenanceEndsAt: isSuper ? toIsoOrNull(document.getElementById('maintenanceEndsAt')?.value || '') : (controls?.maintenanceEndsAt || null),
      banner: {
        enabled: document.getElementById('bannerEnabled')?.checked ?? false,
        text: String(document.getElementById('bannerText')?.value || '').trim(),
        level: String(document.getElementById('bannerLevel')?.value || 'info'),
      },
      abHome: {
        enabled: document.getElementById('abHomeEnabled')?.checked ?? false,
        activeVariant: String(document.getElementById('abHomeVariant')?.value || 'a'),
      },
      sectionControls,
      contentBlocks,
      redirectRules,
      accessRules,
      adminLevels: isSuper ? adminLevels : [],
      note: 'manual-save',
      pages,
    };
  }

  function renderVersions() {
    const list = document.getElementById('siteControlVersionsList');
    if (!list) return;
    if (!versions.length) {
      list.textContent = '';
      const item = document.createElement('div');
      item.className = 'list-item';
      item.textContent = 'Inga versioner ännu.';
      list.appendChild(item);
      return;
    }

    list.textContent = '';
    versions.forEach((v) => {
      const created = window.RimalisI18n?.formatDateTime?.(v.createdAt) || v.createdAt;
      const item = document.createElement('div');
      item.className = 'list-item';
      const head = document.createElement('div');
      const strong = document.createElement('strong');
      strong.textContent = String(v.note || 'save');
      head.appendChild(strong);
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = `${v.actorEmail || 'system'} • ${created}`;
      const actions = document.createElement('div');
      actions.style.marginTop = '8px';
      actions.style.display = 'flex';
      actions.style.justifyContent = 'flex-end';
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.dataset.restoreVersionId = String(v.id || '');
      btn.textContent = 'Återställ';
      actions.appendChild(btn);
      item.append(head, meta, actions);
      list.appendChild(item);
    });
  }

  function renderAudit() {
    const list = document.getElementById('siteControlAuditList');
    if (!list) return;
    if (!auditEntries.length) {
      list.textContent = '';
      const item = document.createElement('div');
      item.className = 'list-item';
      item.textContent = 'Ingen aktivitet ännu.';
      list.appendChild(item);
      return;
    }

    list.textContent = '';
    auditEntries.forEach((entry) => {
      const created = window.RimalisI18n?.formatDateTime?.(entry.createdAt) || entry.createdAt;
      const item = document.createElement('div');
      item.className = 'list-item';
      const head = document.createElement('div');
      const strong = document.createElement('strong');
      strong.textContent = String(entry.action || '');
      head.appendChild(strong);
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = `${entry.actorEmail || 'system'} • ${entry.actorIp || '-'} • ${created}`;
      item.append(head, meta);
      list.appendChild(item);
    });
  }

  async function loadControls() {
    const body = await window.RimalisAPI.request('/admin/site-controls', { auth: true });
    setValues(body.controls || { maintenanceMode: false, maintenanceMessage: '', pages: [] });
  }

  async function loadVersionsAndAudit() {
    const [versionsRes, auditRes] = await Promise.allSettled([
      window.RimalisAPI.request('/admin/site-controls/versions', { auth: true }),
      window.RimalisAPI.request('/admin/site-controls/audit', { auth: true }),
    ]);

    if (versionsRes.status === 'fulfilled') {
      versions = Array.isArray(versionsRes.value?.versions) ? versionsRes.value.versions : [];
    }
    if (auditRes.status === 'fulfilled') {
      auditEntries = Array.isArray(auditRes.value?.entries) ? auditRes.value.entries : [];
    }

    // If one side fails but the other succeeds, keep UX stable and avoid false "internal server error" on save.
    if (versionsRes.status === 'rejected' && auditRes.status === 'rejected') {
      throw versionsRes.reason || auditRes.reason || new Error('Kunde inte ladda historik');
    }

    renderVersions();
    renderAudit();
  }

  async function saveControls() {
    const payload = collectPayload();
    const body = await window.RimalisAPI.request('/admin/site-controls', {
      method: 'PATCH',
      auth: true,
      body: JSON.stringify(payload),
    });
    setValues(body.controls || payload);
    try {
      await loadVersionsAndAudit();
    } catch (_err) {
      // Main save already succeeded; don't fail UX on history refresh.
    }
  }

  async function restoreVersion(versionId) {
    const body = await window.RimalisAPI.request(`/admin/site-controls/versions/${encodeURIComponent(versionId)}/restore`, {
      method: 'POST',
      auth: true,
      body: JSON.stringify({}),
    });
    setValues(body.controls || controls);
    await loadVersionsAndAudit();
  }

  async function rotatePreviewToken() {
    const body = await window.RimalisAPI.request('/admin/site-controls/preview-token/rotate', {
      method: 'POST',
      auth: true,
      body: JSON.stringify({}),
    });
    const token = body?.preview?.token || '';
    if (token) {
      controls.previewToken = token;
      const previewLink = document.getElementById('previewLink');
      if (previewLink) previewLink.value = `${window.location.origin}/templates/public/home.html?preview=${token}`;
    }
    await loadVersionsAndAudit();
  }

  async function copyPreview() {
    const input = document.getElementById('previewLink');
    const value = String(input?.value || '').trim();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      notify('Previewlänk kopierad', 'success');
    } catch (_err) {
      notify('Kunde inte kopiera previewlänk', 'error');
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (!window.RimalisAPI) return;

    try {
      await loadControls();
      await loadVersionsAndAudit();
    } catch (err) {
      notify(err.message || i18n('admin_site_controls_load_failed'), 'error');
    }

    document.getElementById('siteControlsReloadBtn')?.addEventListener('click', async () => {
      try {
        await loadControls();
        await loadVersionsAndAudit();
        notify(i18n('admin_site_controls_reload_success'), 'success');
      } catch (err) {
        notify(err.message || i18n('admin_site_controls_load_failed'), 'error');
      }
    });

    document.getElementById('siteControlsSaveBtn')?.addEventListener('click', async () => {
      try {
        await saveControls();
        notify(i18n('admin_site_controls_saved'), 'success');
      } catch (err) {
        const details = err?.body?.details;
        const detailHint = details && typeof details === 'object'
          ? (Object.values(details.fieldErrors || {}).flat().filter(Boolean)[0] || '')
          : '';
        notify(detailHint || err?.body?.message || err.message || i18n('admin_site_controls_save_failed'), 'error');
      }
    });

    document.getElementById('rotatePreviewBtn')?.addEventListener('click', async () => {
      try {
        await rotatePreviewToken();
        notify('Preview-token roterad', 'success');
      } catch (err) {
        notify(err.message || 'Kunde inte rotera preview-token', 'error');
      }
    });

    document.getElementById('copyPreviewBtn')?.addEventListener('click', copyPreview);

    document.getElementById('siteControlVersionsList')?.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-restore-version-id]');
      if (!button) return;
      const versionId = button.getAttribute('data-restore-version-id');
      if (!versionId) return;
      try {
        await restoreVersion(versionId);
        notify('Version återställd', 'success');
      } catch (err) {
        notify(err.message || 'Kunde inte återställa version', 'error');
      }
    });
  });
})();
