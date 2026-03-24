(function () {
  let cachedProperties = [];

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

  function referenceFromId(id) {
    const source = String(id || '');
    if (!source) return '-';
    let hash = 0;
    for (let i = 0; i < source.length; i += 1) {
      hash = ((hash * 31) + source.charCodeAt(i)) >>> 0;
    }
    return `RG8-${String(hash % 10000).padStart(4, '0')}`;
  }

  function notify(message) {
    const n = document.createElement('div');
    n.className = 'notice';
    n.textContent = message;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 2200);
  }

  function mkr(price) {
    return window.RimalisI18n?.formatCurrencySEK?.(price) || '-';
  }

  function statusBadge(status) {
    const span = document.createElement('span');
    if (status === 'deleted') {
      span.className = 'badge warn';
      span.textContent = i18n('admin_status_deleted') || 'Deleted';
      return span;
    }
    if (status === 'published') {
      span.className = 'badge good';
      span.textContent = i18n('admin_status_published');
      return span;
    }
    if (status === 'pending') {
      span.className = 'badge warn';
      span.textContent = i18n('admin_status_pending');
      return span;
    }
    span.className = 'badge info';
    span.textContent = i18n('admin_status_draft');
    return span;
  }

  function statusSv(status) {
    if (status === 'deleted') return 'deleted';
    if (status === 'published') return 'published';
    if (status === 'pending') return 'pending';
    return 'draft';
  }

  function renderRows(properties) {
    cachedProperties = Array.isArray(properties) ? properties : [];
    const tbody = document.querySelector('#propertiesTable tbody');
    if (!tbody) return;

    tbody.textContent = '';
    cachedProperties.forEach((p) => {
      const tr = document.createElement('tr');
      tr.dataset.status = statusSv(p.status);
      tr.dataset.id = String(p.id || '');
      const tdProp = document.createElement('td');
      tdProp.className = 'property-cell';
      const name = document.createElement('span');
      name.className = 'property-name';
      name.textContent = String(p.title || '');
      const loc = document.createElement('span');
      loc.className = 'small';
      loc.textContent = String(p.location || '');
      tdProp.append(name, loc);
      const tdRef = document.createElement('td');
      tdRef.textContent = String(p.referenceCode || referenceFromId(p.id));
      const tdPrice = document.createElement('td');
      tdPrice.textContent = mkr(p.price);
      const tdStatus = document.createElement('td');
      tdStatus.appendChild(statusBadge(p.status));
      const tdDash = document.createElement('td');
      tdDash.textContent = '-';
      const tdActions = document.createElement('td');
      const actions = document.createElement('div');
      actions.className = 'actions';
      const createBtn = (action, icon) => {
        const b = document.createElement('button');
        b.className = 'icon-btn';
        b.dataset.action = action;
        const i = document.createElement('i');
        i.className = `fas ${icon}`;
        b.appendChild(i);
        return b;
      };
      actions.appendChild(createBtn('view', 'fa-eye'));
      if (p.status === 'deleted') {
        actions.appendChild(createBtn('restore', 'fa-rotate-left'));
      } else {
        actions.append(createBtn('publish', 'fa-check'), createBtn('draft', 'fa-archive'), createBtn('delete', 'fa-trash'));
      }
      tdActions.appendChild(actions);
      tr.append(tdProp, tdRef, tdPrice, tdStatus, tdDash, tdActions);
      tbody.appendChild(tr);
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await ensureI18nReady();

    const search = document.getElementById('propertySearch');
    const status = document.getElementById('propertyStatus');
    const addPropertyBtn = document.getElementById('addPropertyBtn');

    try {
      const body = await window.RimalisAPI.request('/properties', { auth: true });
      renderRows(body.properties || []);
    } catch (err) {
      notify(err.message || i18n('admin_load_properties_failed'));
    }

    function applyFilter() {
      const q = (search?.value || '').toLowerCase().trim();
      const rawStatus = status?.value || 'all';
      const statusMap = {
        [i18n('admin_filter_status_published_value')]: 'published',
        [i18n('admin_filter_status_pending_value')]: 'pending',
        [i18n('admin_filter_status_draft_value')]: 'draft',
      };
      const st = statusMap[rawStatus] || rawStatus;

      Array.from(document.querySelectorAll('#propertiesTable tbody tr')).forEach((row) => {
        const txt = row.textContent.toLowerCase();
        const rowSt = row.dataset.status || 'all';
        const okQ = !q || txt.includes(q);
        const okS = st === 'all' || rowSt === st;
        row.style.display = okQ && okS ? '' : 'none';
      });
    }

    search?.addEventListener('input', applyFilter);
    status?.addEventListener('change', applyFilter);
    addPropertyBtn?.addEventListener('click', () => {
      window.location.href = '/templates/user/create_listing/step1_listing_info.html?source=admin';
    });

    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('.icon-btn');
      if (!btn) return;

      const row = btn.closest('tr[data-id]');
      if (!row) return;
      const propertyId = row.dataset.id;
      const action = btn.dataset.action;

      if (action === 'view') {
        window.location.href = `../public/property-modal.html?id=${encodeURIComponent(propertyId)}`;
        return;
      }

      if (action === 'delete') {
        const ok = window.confirm(i18n('admin_property_delete_confirm') || 'Delete this listing?');
        if (!ok) return;
        await window.RimalisAPI.request(`/properties/${propertyId}`, {
          method: 'DELETE',
          auth: true,
          body: JSON.stringify({ reason: 'admin_delete' }),
        });
        notify(i18n('admin_property_deleted') || 'Property deleted');
        const body = await window.RimalisAPI.request('/properties', { auth: true });
        renderRows(body.properties || []);
        return;
      }

      if (action === 'restore') {
        await window.RimalisAPI.request(`/properties/${propertyId}/restore`, {
          method: 'POST',
          auth: true,
        });
        notify(i18n('admin_property_restored') || 'Property restored');
        const body = await window.RimalisAPI.request('/properties', { auth: true });
        renderRows(body.properties || []);
        return;
      }

      const statusNext = action === 'publish' ? 'published' : 'draft';
      try {
        await window.RimalisAPI.request(`/properties/${propertyId}/status`, {
          method: 'PATCH',
          auth: true,
          body: JSON.stringify({ status: statusNext }),
        });
        notify(i18n('admin_status_updated'));
        const body = await window.RimalisAPI.request('/properties', { auth: true });
        renderRows(body.properties || []);
      } catch (err) {
        notify(err.message || i18n('admin_update_status_failed'));
      }
    });
  });

  window.addEventListener('rimalis:language-changed', async () => {
    await ensureI18nReady();
    if (cachedProperties.length) renderRows(cachedProperties);
  });
})();
