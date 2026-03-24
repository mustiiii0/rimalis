(function () {
  let latestEntries = [];

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function toIsoFromInput(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString();
  }

  function formatDate(dateValue) {
    return window.RimalisI18n?.formatDateTime?.(dateValue) || new Date(dateValue).toLocaleString();
  }

  function collectFilters() {
    return {
      actionLike: String(document.getElementById('auditActionLike')?.value || '').trim(),
      outcome: String(document.getElementById('auditOutcome')?.value || '').trim(),
      from: toIsoFromInput(document.getElementById('auditFrom')?.value),
      to: toIsoFromInput(document.getElementById('auditTo')?.value),
      limit: 200,
    };
  }

  function toQuery(filters) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val !== '' && val !== null && val !== undefined) params.set(key, val);
    });
    return params.toString();
  }

  function renderTable(entries) {
    const body = document.getElementById('auditTableBody');
    if (!body) return;

    if (!entries.length) {
      body.textContent = '';
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 7;
      td.textContent = 'Ingen audit-data hittades.';
      tr.appendChild(td);
      body.appendChild(tr);
      return;
    }

    body.textContent = '';
    entries.forEach((entry) => {
      const action = entry.metadata?.action || entry.eventType || '-';
      const outcome = entry.metadata?.outcome || '-';
      const outcomeClass = outcome === 'success' ? 'success' : outcome === 'failed' ? 'failed' : '';
      const actor = entry.actorName || entry.actorEmail || entry.actorUserId || 'System';
      const tr = document.createElement('tr');
      const c1 = document.createElement('td');
      c1.textContent = formatDate(entry.createdAt);
      const c2 = document.createElement('td');
      c2.textContent = actor;
      const c3 = document.createElement('td');
      c3.textContent = action;
      const c4 = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = `audit-badge ${outcomeClass}`;
      badge.textContent = outcome;
      c4.appendChild(badge);
      const c5 = document.createElement('td');
      c5.textContent = entry.method || '-';
      const c6 = document.createElement('td');
      c6.textContent = entry.path || '-';
      const c7 = document.createElement('td');
      c7.textContent = entry.ipAddress || '-';
      tr.appendChild(c1);
      tr.appendChild(c2);
      tr.appendChild(c3);
      tr.appendChild(c4);
      tr.appendChild(c5);
      tr.appendChild(c6);
      tr.appendChild(c7);
      body.appendChild(tr);
    });
  }

  async function loadAuditEntries() {
    if (!window.RimalisAPI) return;
    const filters = collectFilters();
    const query = toQuery(filters);
    const body = await window.RimalisAPI.request(`/admin/audit${query ? `?${query}` : ''}`, { auth: true });
    latestEntries = Array.isArray(body.entries) ? body.entries : [];
    renderTable(latestEntries);
  }

  function exportCsv() {
    const filters = collectFilters();
    const query = toQuery(filters);
    const url = `${window.RimalisAPI.API_BASE}/admin/audit/export.csv${query ? `?${query}` : ''}`;
    window.open(url, '_blank', 'noopener');
  }

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      await loadAuditEntries();
    } catch (err) {
      if (window.showNotification) window.showNotification(err.message || 'Kunde inte ladda audit-logg', 'error');
    }

    document.getElementById('auditApplyBtn')?.addEventListener('click', async () => {
      try {
        await loadAuditEntries();
      } catch (err) {
        if (window.showNotification) window.showNotification(err.message || 'Filter misslyckades', 'error');
      }
    });

    document.getElementById('auditExportBtn')?.addEventListener('click', exportCsv);
  });
})();
