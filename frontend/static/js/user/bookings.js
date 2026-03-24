(function () {
  let cachedBookings = [];

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

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function fmtDateTime(value) {
    return window.RimalisI18n?.formatDateTime?.(value) || value || '-';
  }

  function bookingBadge(status) {
    const map = {
      booked: i18n('booking_status_booked'),
      rescheduled: i18n('booking_status_rescheduled'),
      cancelled: i18n('booking_status_cancelled'),
    };
    return map[status] || status || '-';
  }

  async function loadRescheduleSlots(propertyId, scheduledAt) {
    const from = new Date(scheduledAt || Date.now());
    const to = new Date(from.getTime() + 30 * 24 * 60 * 60 * 1000);
    const qs = new URLSearchParams({
      fromAt: from.toISOString(),
      toAt: to.toISOString(),
    });
    const body = await window.RimalisAPI.request(`/viewings/slots/public/${encodeURIComponent(propertyId)}?${qs.toString()}`, { auth: true });
    return Array.isArray(body?.slots) ? body.slots : [];
  }

  async function loadBookingHistory(bookingId) {
    const body = await window.RimalisAPI.request(`/viewings/me/bookings/${encodeURIComponent(bookingId)}/history`, { auth: true });
    return Array.isArray(body?.events) ? body.events : [];
  }

  function renderBookingHistory(container, events) {
    container.textContent = '';
    if (!events.length) {
      const empty = document.createElement('div');
      empty.className = 'text-white/40 text-sm';
      empty.textContent = i18n('booking_no_history');
      container.appendChild(empty);
      return;
    }
    const list = document.createElement('div');
    list.className = 'space-y-2 mt-3';
    events.forEach((e) => {
      const row = document.createElement('div');
      row.className = 'text-sm text-white/70 border border-white/10 rounded-xl px-3 py-2';
      const type = document.createElement('div');
      type.className = 'font-semibold text-white';
      type.textContent = e.eventType || '-';
      const created = document.createElement('div');
      created.className = 'text-white/50';
      created.textContent = fmtDateTime(e.createdAt);
      row.appendChild(type);
      row.appendChild(created);
      list.appendChild(row);
    });
    container.appendChild(list);
  }

  function buildCard(b) {
    const canEdit = b.status !== 'cancelled';
    const card = document.createElement('div');
    card.className = 'glass-dark rounded-3xl p-6 space-y-4';
    card.dataset.bookingId = String(b.id || '');
    card.dataset.propertyId = String(b.propertyId || '');
    const top = document.createElement('div');
    top.className = 'flex items-start justify-between gap-4';
    const left = document.createElement('div');
    const h3 = document.createElement('h3');
    h3.className = 'text-xl font-bold';
    h3.textContent = b.title || '-';
    const pLoc = document.createElement('p');
    pLoc.className = 'text-white/40';
    pLoc.textContent = `${b.location || '-'} • ${fmtDateTime(b.scheduledAt)}`;
    const pStatus = document.createElement('p');
    pStatus.className = 'text-[#e2ff31] font-semibold mt-1';
    pStatus.textContent = bookingBadge(b.status);
    left.appendChild(h3);
    left.appendChild(pLoc);
    left.appendChild(pStatus);
    const right = document.createElement('div');
    right.className = 'flex items-center gap-2';
    const historyBtn = document.createElement('button');
    historyBtn.className = 'btn-outline booking-history-btn';
    historyBtn.dataset.action = 'history';
    historyBtn.textContent = i18n('booking_history');
    const rescheduleBtn = document.createElement('button');
    rescheduleBtn.className = 'btn-outline booking-reschedule-btn';
    rescheduleBtn.dataset.action = 'reschedule';
    rescheduleBtn.textContent = i18n('booking_reschedule');
    if (!canEdit) rescheduleBtn.disabled = true;
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-outline booking-cancel-btn';
    cancelBtn.dataset.action = 'cancel';
    cancelBtn.textContent = i18n('user_cancel_booking');
    if (!canEdit) cancelBtn.disabled = true;
    right.appendChild(historyBtn);
    right.appendChild(rescheduleBtn);
    right.appendChild(cancelBtn);
    top.appendChild(left);
    top.appendChild(right);

    const historyInline = document.createElement('div');
    historyInline.className = 'booking-inline booking-inline-history hidden';
    const rescheduleInline = document.createElement('div');
    rescheduleInline.className = 'booking-inline booking-inline-reschedule hidden';
    const helper = document.createElement('div');
    helper.className = 'text-sm text-white/50 mb-2';
    helper.textContent = i18n('booking_select_new_slot');
    const slotList = document.createElement('div');
    slotList.className = 'booking-slot-list space-y-2';
    const actionWrap = document.createElement('div');
    actionWrap.className = 'mt-3';
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn-primary booking-confirm-reschedule';
    confirmBtn.dataset.action = 'confirm-reschedule';
    confirmBtn.disabled = true;
    confirmBtn.textContent = i18n('booking_confirm_reschedule');
    actionWrap.appendChild(confirmBtn);
    rescheduleInline.appendChild(helper);
    rescheduleInline.appendChild(slotList);
    rescheduleInline.appendChild(actionWrap);
    card.appendChild(top);
    card.appendChild(historyInline);
    card.appendChild(rescheduleInline);
    return card;
  }

  async function loadBookings() {
    const container = document.getElementById('bookingsContainer');
    if (!container || !window.RimalisAPI) return;

    try {
      const body = await window.RimalisAPI.request('/viewings/me/bookings', { auth: true });
      const bookings = body.bookings || [];
      cachedBookings = bookings;

      if (!bookings.length) {
        const empty = document.createElement('div');
        empty.className = 'glass-dark rounded-3xl p-6 text-white/60';
        empty.textContent = i18n('user_no_bookings_yet');
        container.textContent = '';
        container.appendChild(empty);
        return;
      }

      container.textContent = '';
      bookings.forEach((booking) => container.appendChild(buildCard(booking)));

      container.querySelectorAll('[data-action="cancel"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const card = btn.closest('[data-booking-id]');
          const bookingId = card?.dataset.bookingId;
          if (!bookingId) return;
          try {
            await window.RimalisAPI.request(`/viewings/me/bookings/${bookingId}/cancel`, {
              method: 'POST',
              auth: true,
            });
            showNotification(i18n('user_booking_cancelled'), 'info');
            await loadBookings();
          } catch (err) {
            showNotification(err.message || i18n('user_booking_cancel_failed'), 'error');
          }
        });
      });

      container.querySelectorAll('[data-action="history"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const card = btn.closest('[data-booking-id]');
          const bookingId = card?.dataset.bookingId;
          const historyBox = card?.querySelector('.booking-inline-history');
          if (!bookingId || !historyBox) return;
          try {
            const events = await loadBookingHistory(bookingId);
            renderBookingHistory(historyBox, events);
            historyBox.classList.toggle('hidden');
          } catch (err) {
            showNotification(err.message || i18n('booking_history_load_failed'), 'error');
          }
        });
      });

      container.querySelectorAll('[data-action="reschedule"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const card = btn.closest('[data-booking-id]');
          const bookingId = card?.dataset.bookingId;
          const propertyId = card?.dataset.propertyId;
          const inline = card?.querySelector('.booking-inline-reschedule');
          const list = inline?.querySelector('.booking-slot-list');
          const confirmBtn = inline?.querySelector('.booking-confirm-reschedule');
          const booking = cachedBookings.find((x) => String(x.id) === String(bookingId));
          if (!bookingId || !propertyId || !inline || !list || !confirmBtn || !booking) return;
          try {
            confirmBtn.replaceWith(confirmBtn.cloneNode(true));
            const freshConfirmBtn = inline.querySelector('.booking-confirm-reschedule');
            if (!freshConfirmBtn) return;
            freshConfirmBtn.disabled = true;
            freshConfirmBtn.dataset.slotId = '';
            const slots = await loadRescheduleSlots(propertyId, booking.scheduledAt);
            const available = slots.filter((s) => Number(s.availableCount || 0) > 0 && String(s.status || '').toLowerCase() === 'open');
            if (!available.length) {
              list.textContent = '';
              const empty = document.createElement('div');
              empty.className = 'text-white/40 text-sm';
              empty.textContent = i18n('property_no_slots');
              list.appendChild(empty);
            } else {
              list.textContent = '';
              available.forEach((s) => {
                const slotBtn = document.createElement('button');
                slotBtn.className = 'w-full text-left rounded-xl border border-white/10 px-3 py-2 hover:border-[#e2ff31]';
                slotBtn.dataset.slotId = String(s.id || '');
                const when = document.createElement('div');
                when.className = 'font-semibold';
                when.textContent = fmtDateTime(s.startsAt);
                const count = document.createElement('div');
                count.className = 'text-white/50 text-sm';
                count.textContent = `${i18n('property_slot_available')}: ${s.availableCount}`;
                slotBtn.appendChild(when);
                slotBtn.appendChild(count);
                list.appendChild(slotBtn);
              });
              let selectedSlotId = '';
              list.querySelectorAll('[data-slot-id]').forEach((slotBtn) => {
                slotBtn.addEventListener('click', () => {
                  list.querySelectorAll('[data-slot-id]').forEach((x) => x.classList.remove('ring-2', 'ring-[#e2ff31]'));
                  slotBtn.classList.add('ring-2', 'ring-[#e2ff31]');
                  selectedSlotId = slotBtn.dataset.slotId || '';
                  freshConfirmBtn.disabled = !selectedSlotId;
                  freshConfirmBtn.dataset.slotId = selectedSlotId;
                });
              });
            }
            inline.classList.toggle('hidden');
            freshConfirmBtn.addEventListener('click', async () => {
              const slotId = freshConfirmBtn.dataset.slotId;
              if (!slotId) return;
              try {
                await window.RimalisAPI.request(`/viewings/me/bookings/${bookingId}/reschedule`, {
                  method: 'POST',
                  auth: true,
                  body: JSON.stringify({ slotId }),
                });
                showNotification(i18n('booking_rescheduled_success'), 'success');
                await loadBookings();
              } catch (err) {
                showNotification(err.message || i18n('booking_reschedule_failed'), 'error');
              }
            });
          } catch (err) {
            showNotification(err.message || i18n('property_load_slots_failed'), 'error');
          }
        });
      });
    } catch (err) {
      const fail = document.createElement('div');
      fail.className = 'glass-dark rounded-3xl p-6 text-red-300';
      fail.textContent = err.message || i18n('user_load_bookings_failed');
      container.textContent = '';
      container.appendChild(fail);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    (async () => {
      await ensureI18nReady();
      await loadBookings();
    })();
  });

  window.addEventListener('rimalis:language-changed', async () => {
    await ensureI18nReady();
    await loadBookings();
  });
})();
