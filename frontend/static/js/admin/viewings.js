(function () {
  const state = {
    bookings: [],
    filters: {},
  };

  function t(key, fallback = '') {
    return window.RimalisI18n?.t ? window.RimalisI18n.t(key, fallback) : (fallback || key);
  }

  function notify(message, type = 'info') {
    if (!message) return;
    if (typeof window.showNotification === 'function') {
      window.showNotification(message, type);
      return;
    }
    const n = document.createElement('div');
    n.className = `notice notice-${type}`;
    n.textContent = message;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 2600);
  }

  function toIsoOrEmpty(datetimeLocal) {
    if (!datetimeLocal) return '';
    const d = new Date(datetimeLocal);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString();
  }

  function fmtDateTime(value) {
    try {
      if (window.RimalisI18n?.formatDateTime) return window.RimalisI18n.formatDateTime(value);
      return new Date(value).toLocaleString('sv-SE');
    } catch (_) {
      return value || '-';
    }
  }

  function fmtPriceSek(price) {
    if (window.RimalisI18n?.formatCurrencySEK) return window.RimalisI18n.formatCurrencySEK(price, { compact: false });
    const num = Number(price || 0);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
  }

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function readFilters() {
    const fromAt = toIsoOrEmpty(document.getElementById('filterFromAt')?.value || '');
    const toAt = toIsoOrEmpty(document.getElementById('filterToAt')?.value || '');
    const city = (document.getElementById('filterCity')?.value || '').trim();
    const ownerId = (document.getElementById('filterOwnerId')?.value || '').trim();
    const propertyId = (document.getElementById('filterPropertyId')?.value || '').trim();
    const status = (document.getElementById('filterStatus')?.value || '').trim();
    const attendanceStatus = (document.getElementById('filterAttendanceStatus')?.value || '').trim();
    return { fromAt, toAt, city, ownerId, propertyId, status, attendanceStatus };
  }

  function toQuery(filters = {}) {
    const qs = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v).trim() !== '') qs.set(k, String(v));
    });
    return qs.toString();
  }

  function attendanceBadge(status) {
    const span = document.createElement('span');
    if (status === 'pending') {
      span.className = 'badge warn';
      span.textContent = t('admin_viewings_attendance_pending', 'Ej markerad');
      return span;
    }
    if (status === 'attended') {
      span.className = 'badge good';
      span.textContent = t('admin_viewings_attendance_attended', 'Närvarande');
      return span;
    }
    if (status === 'no_show') {
      span.className = 'badge bad';
      span.textContent = t('admin_viewings_attendance_no_show', 'Uteblev');
      return span;
    }
    span.className = 'badge';
    span.textContent = '-';
    return span;
  }

  function bookingBadge(status) {
    const span = document.createElement('span');
    if (status === 'booked') {
      span.className = 'badge';
      span.textContent = t('admin_viewings_status_booked', 'Bokad');
      return span;
    }
    if (status === 'rescheduled') {
      span.className = 'badge info';
      span.textContent = t('admin_viewings_status_rescheduled', 'Ombokad');
      return span;
    }
    if (status === 'cancelled') {
      span.className = 'badge bad';
      span.textContent = t('admin_viewings_status_cancelled', 'Avbokad');
      return span;
    }
    span.className = 'badge';
    span.textContent = '-';
    return span;
  }

  function renderTable() {
    const table = document.getElementById('viewingsTable');
    if (!table) return;
    table.textContent = '';

    if (!state.bookings.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = t('admin_viewings_no_matches', 'Inga bokningar matchar filtren.');
      table.appendChild(empty);
      return;
    }
    const scroll = document.createElement('div');
    scroll.className = 'table-scroll';
    const tbl = document.createElement('table');
    tbl.className = 'viewings-table';
    const thead = document.createElement('thead');
    const hr = document.createElement('tr');
    [
      t('admin_viewings_col_time', 'Tid'),
      t('admin_viewings_col_property', 'Objekt'),
      t('admin_viewings_col_agent', 'Mäklare'),
      t('admin_viewings_col_buyer', 'Köpare'),
      t('admin_viewings_col_status', 'Status'),
      t('admin_viewings_col_attendance', 'Närvaro'),
      t('admin_viewings_col_actions', 'Åtgärder'),
    ].forEach((h) => {
      const th = document.createElement('th');
      th.textContent = h;
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    const tbody = document.createElement('tbody');
    state.bookings.forEach((b) => {
      const tr = document.createElement('tr');
      tr.dataset.bookingId = String(b.id || '');
      const tdTime = document.createElement('td');
      tdTime.textContent = fmtDateTime(b.scheduledAt);
      const tdProperty = document.createElement('td');
      const pCell = document.createElement('div');
      pCell.className = 'property-cell';
      if (b.property?.imageUrl) {
        const img = document.createElement('img');
        img.src = b.property.imageUrl;
        img.alt = b.property?.title || t('property_card_title_fallback', 'Objekt');
        img.loading = 'lazy';
        pCell.appendChild(img);
      } else {
        const fallback = document.createElement('div');
        fallback.className = 'thumb-fallback';
        fallback.textContent = t('common_no_image', 'Ingen bild');
        pCell.appendChild(fallback);
      }
      const d = document.createElement('div');
      const l1 = document.createElement('div');
      l1.className = 'font-semibold';
      l1.textContent = b.property?.title || '-';
      const l2 = document.createElement('div');
      l2.className = 'muted';
      l2.textContent = b.property?.location || '-';
      const l3 = document.createElement('div');
      l3.className = 'muted';
      l3.textContent = `${b.property?.referenceCode || '-'} · ${fmtPriceSek(b.property?.price || 0)}`;
      d.append(l1, l2, l3);
      pCell.appendChild(d);
      tdProperty.appendChild(pCell);
      const tdAgent = document.createElement('td');
      const ag1 = document.createElement('div');
      ag1.textContent = String(b.property?.ownerName || '-');
      const ag2 = document.createElement('div');
      ag2.className = 'muted';
      ag2.textContent = String(b.property?.ownerEmail || '');
      tdAgent.append(ag1, ag2);
      const tdBuyer = document.createElement('td');
      const by1 = document.createElement('div');
      by1.textContent = String(b.buyer?.name || '-');
      const by2 = document.createElement('div');
      by2.className = 'muted';
      by2.textContent = String(b.buyer?.email || '');
      tdBuyer.append(by1, by2);
      const tdStatus = document.createElement('td');
      tdStatus.appendChild(bookingBadge(b.status));
      const tdAtt = document.createElement('td');
      tdAtt.appendChild(attendanceBadge(b.attendanceStatus));
      const tdActions = document.createElement('td');
      const rowActions = document.createElement('div');
      rowActions.className = 'row-actions';
      ['attended', 'no_show'].forEach((action) => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-ghost btn-sm';
        btn.dataset.action = action;
        btn.textContent = action === 'attended'
          ? t('admin_viewings_attendance_attended', 'Närvarande')
          : t('admin_viewings_attendance_no_show', 'Uteblev');
        rowActions.appendChild(btn);
      });
      tdActions.appendChild(rowActions);
      tr.append(tdTime, tdProperty, tdAgent, tdBuyer, tdStatus, tdAtt, tdActions);
      tbody.appendChild(tr);
    });
    tbl.append(thead, tbody);
    scroll.appendChild(tbl);
    table.appendChild(scroll);
  }

  async function fetchBookings() {
    const qs = toQuery(state.filters);
    const path = qs ? `/viewings/admin/bookings?${qs}` : '/viewings/admin/bookings';
    const body = await window.RimalisAPI.request(path, { auth: true });
    state.bookings = Array.isArray(body?.bookings) ? body.bookings : [];
    renderTable();
  }

  async function markAttendance(bookingId, attendanceStatus) {
    await window.RimalisAPI.request(`/viewings/admin/bookings/${encodeURIComponent(bookingId)}/check-in`, {
      method: 'POST',
      auth: true,
      body: JSON.stringify({ attendanceStatus }),
    });
  }

  function bindEvents() {
    document.getElementById('applyViewingsFilterBtn')?.addEventListener('click', async () => {
      state.filters = readFilters();
      try {
        await fetchBookings();
      } catch (err) {
        notify(err.message || t('admin_viewings_fetch_failed', 'Kunde inte läsa bokningar'), 'error');
      }
    });

    document.getElementById('reloadViewingsBtn')?.addEventListener('click', async () => {
      try {
        await fetchBookings();
        notify(t('admin_viewings_reloaded', 'Uppdaterat'), 'success');
      } catch (err) {
        notify(err.message || t('admin_viewings_fetch_failed', 'Kunde inte läsa bokningar'), 'error');
      }
    });

    document.getElementById('exportViewingsBtn')?.addEventListener('click', () => {
      const qs = toQuery(readFilters());
      const path = qs ? `/api/viewings/admin/bookings/export.csv?${qs}` : '/api/viewings/admin/bookings/export.csv';
      window.open(path, '_blank', 'noopener');
    });

    document.getElementById('viewingsTable')?.addEventListener('click', async (event) => {
      const btn = event.target.closest('button[data-action]');
      if (!btn) return;
      const row = btn.closest('tr[data-booking-id]');
      if (!row) return;
      const bookingId = row.dataset.bookingId;
      const action = btn.dataset.action;
      const attendanceStatus = action === 'attended' ? 'attended' : (action === 'no_show' ? 'no_show' : '');
      if (!attendanceStatus) return;

      try {
        btn.disabled = true;
        await markAttendance(bookingId, attendanceStatus);
        await fetchBookings();
        notify(t('admin_viewings_attendance_updated', 'Närvaro uppdaterad'), 'success');
      } catch (err) {
        notify(err.message || t('admin_viewings_attendance_update_failed', 'Kunde inte uppdatera närvaro'), 'error');
      } finally {
        btn.disabled = false;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (!window.RimalisAPI) return;
    state.filters = readFilters();
    bindEvents();
    try {
      await fetchBookings();
    } catch (err) {
      notify(err.message || t('admin_viewings_fetch_failed', 'Kunde inte läsa bokningar'), 'error');
    }
  });

  window.addEventListener('rimalis:language-changed', function () {
    renderTable();
  });
})();
