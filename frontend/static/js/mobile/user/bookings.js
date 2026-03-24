(function () {
  let cachedBookings = [];

  async function ensureI18nReady() {
    if (typeof window.RimalisI18n?.ready === 'function') {
      try {
        await window.RimalisI18n.ready();
      } catch (_) {
        // Keep page functional if dictionaries fail to load
      }
    }
  }

  function i18n(key, fallback) {
    return window.RimalisI18n?.t?.(key, fallback || key) || fallback || key;
  }

  function fmtDateTime(value) {
    return window.RimalisI18n?.formatDateTime?.(value) || value || '-';
  }

  function bookingBadge(status) {
    const map = {
      booked: i18n('booking_status_booked', 'Bokad'),
      rescheduled: i18n('booking_status_rescheduled', 'Ombokad'),
      cancelled: i18n('booking_status_cancelled', 'Avbokad'),
    };
    return map[status] || status || '-';
  }

  function updateSummary(bookings) {
    const counts = {
      booked: bookings.filter((item) => item.status === 'booked').length,
      rescheduled: bookings.filter((item) => item.status === 'rescheduled').length,
      cancelled: bookings.filter((item) => item.status === 'cancelled').length,
    };

    const booked = document.getElementById('mobileBookingsBookedCount');
    const rescheduled = document.getElementById('mobileBookingsRescheduledCount');
    const cancelled = document.getElementById('mobileBookingsCancelledCount');
    if (booked) booked.textContent = String(counts.booked);
    if (rescheduled) rescheduled.textContent = String(counts.rescheduled);
    if (cancelled) cancelled.textContent = String(counts.cancelled);
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
      empty.className = 'mobile-booking-history-empty';
      empty.textContent = i18n('booking_no_history', 'Ingen historik än');
      container.appendChild(empty);
      return;
    }

    const list = document.createElement('div');
    list.className = 'mobile-booking-history-list';
    events.forEach((eventItem) => {
      const row = document.createElement('div');
      row.className = 'mobile-booking-history-item';
      const type = document.createElement('strong');
      type.textContent = eventItem.eventType || '-';
      const created = document.createElement('small');
      created.textContent = fmtDateTime(eventItem.createdAt);
      row.appendChild(type);
      row.appendChild(created);
      list.appendChild(row);
    });
    container.appendChild(list);
  }

  function buildCard(booking) {
    const canEdit = booking.status !== 'cancelled';
    const card = document.createElement('article');
    card.className = 'mobile-booking-card';
    card.dataset.bookingId = String(booking.id || '');
    card.dataset.propertyId = String(booking.propertyId || '');

    const head = document.createElement('div');
    head.className = 'mobile-booking-card__head';

    const info = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = booking.title || '-';
    const meta = document.createElement('p');
    meta.textContent = `${booking.location || '-'} • ${fmtDateTime(booking.scheduledAt)}`;
    const status = document.createElement('p');
    status.textContent = bookingBadge(booking.status);
    info.appendChild(title);
    info.appendChild(meta);
    info.appendChild(status);

    const badge = document.createElement('span');
    badge.className = 'mobile-booking-card__badge';
    badge.dataset.status = booking.status || '';
    badge.textContent = bookingBadge(booking.status);

    head.appendChild(info);
    head.appendChild(badge);

    const actions = document.createElement('div');
    actions.className = 'mobile-booking-card__actions';

    const historyButton = document.createElement('button');
    historyButton.type = 'button';
    historyButton.dataset.action = 'history';
    historyButton.textContent = i18n('booking_history', 'Historik');

    const rescheduleButton = document.createElement('button');
    rescheduleButton.type = 'button';
    rescheduleButton.dataset.action = 'reschedule';
    rescheduleButton.textContent = i18n('booking_reschedule', 'Boka om');
    if (!canEdit) rescheduleButton.disabled = true;

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.dataset.action = 'cancel';
    cancelButton.textContent = i18n('user_cancel_booking', 'Avboka');
    if (!canEdit) cancelButton.disabled = true;

    actions.appendChild(historyButton);
    actions.appendChild(rescheduleButton);
    actions.appendChild(cancelButton);

    const historyInline = document.createElement('div');
    historyInline.className = 'mobile-booking-inline hidden';

    const rescheduleInline = document.createElement('div');
    rescheduleInline.className = 'mobile-booking-inline hidden';

    const helper = document.createElement('div');
    helper.className = 'mobile-booking-inline__helper';
    helper.textContent = i18n('booking_select_new_slot', 'Välj en ny tid');
    const slotList = document.createElement('div');
    slotList.className = 'mobile-booking-slot-list';
    const confirmButton = document.createElement('button');
    confirmButton.className = 'mobile-booking-confirm';
    confirmButton.type = 'button';
    confirmButton.dataset.action = 'confirm-reschedule';
    confirmButton.disabled = true;
    confirmButton.textContent = i18n('booking_confirm_reschedule', 'Bekräfta ombokning');

    rescheduleInline.appendChild(helper);
    rescheduleInline.appendChild(slotList);
    rescheduleInline.appendChild(confirmButton);

    card.appendChild(head);
    card.appendChild(actions);
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
      updateSummary(bookings);

      if (!bookings.length) {
        const empty = document.createElement('div');
        empty.className = 'mobile-bookings-empty';
        empty.textContent = i18n('user_no_bookings_yet', 'Du har inga bokningar ännu.');
        container.textContent = '';
        container.appendChild(empty);
        return;
      }

      container.textContent = '';
      bookings.forEach((booking) => container.appendChild(buildCard(booking)));

      container.querySelectorAll('[data-action="cancel"]').forEach((button) => {
        button.addEventListener('click', async () => {
          const card = button.closest('[data-booking-id]');
          const bookingId = card?.dataset.bookingId;
          if (!bookingId) return;
          try {
            await window.RimalisAPI.request(`/viewings/me/bookings/${bookingId}/cancel`, {
              method: 'POST',
              auth: true,
            });
            if (typeof window.showNotification === 'function') {
              window.showNotification(i18n('user_booking_cancelled', 'Bokningen är avbokad'), 'info');
            }
            await loadBookings();
          } catch (error) {
            if (typeof window.showNotification === 'function') {
              window.showNotification(error.message || i18n('user_booking_cancel_failed', 'Kunde inte avboka bokningen'), 'error');
            }
          }
        });
      });

      container.querySelectorAll('[data-action="history"]').forEach((button) => {
        button.addEventListener('click', async () => {
          const card = button.closest('[data-booking-id]');
          const bookingId = card?.dataset.bookingId;
          const historyBox = card?.querySelector('.mobile-booking-inline');
          if (!bookingId || !historyBox) return;
          try {
            const events = await loadBookingHistory(bookingId);
            renderBookingHistory(historyBox, events);
            historyBox.classList.toggle('hidden');
          } catch (error) {
            if (typeof window.showNotification === 'function') {
              window.showNotification(error.message || i18n('booking_history_load_failed', 'Kunde inte ladda historiken'), 'error');
            }
          }
        });
      });

      container.querySelectorAll('[data-action="reschedule"]').forEach((button) => {
        button.addEventListener('click', async () => {
          const card = button.closest('[data-booking-id]');
          const bookingId = card?.dataset.bookingId;
          const propertyId = card?.dataset.propertyId;
          const inlines = card?.querySelectorAll('.mobile-booking-inline');
          const inline = inlines?.[1];
          const slotList = inline?.querySelector('.mobile-booking-slot-list');
          const confirmButton = inline?.querySelector('.mobile-booking-confirm');
          const booking = cachedBookings.find((entry) => String(entry.id) === String(bookingId));
          if (!bookingId || !propertyId || !inline || !slotList || !confirmButton || !booking) return;

          try {
            slotList.textContent = '';
            confirmButton.disabled = true;
            confirmButton.dataset.slotId = '';
            const slots = await loadRescheduleSlots(propertyId, booking.scheduledAt);
            const available = slots.filter((slot) => Number(slot.availableCount || 0) > 0 && String(slot.status || '').toLowerCase() === 'open');

            if (!available.length) {
              const empty = document.createElement('div');
              empty.className = 'mobile-booking-history-empty';
              empty.textContent = i18n('property_no_slots', 'Inga lediga tider tillgängliga.');
              slotList.appendChild(empty);
            } else {
              available.forEach((slot) => {
                const slotButton = document.createElement('button');
                slotButton.type = 'button';
                slotButton.className = 'mobile-booking-slot-item';
                slotButton.dataset.slotId = String(slot.id || '');
                const when = document.createElement('strong');
                when.textContent = fmtDateTime(slot.startsAt);
                const count = document.createElement('small');
                count.textContent = `${i18n('property_slot_available', 'Lediga platser')}: ${slot.availableCount}`;
                slotButton.appendChild(when);
                slotButton.appendChild(count);
                slotList.appendChild(slotButton);
              });

              slotList.querySelectorAll('[data-slot-id]').forEach((slotButton) => {
                slotButton.addEventListener('click', () => {
                  slotList.querySelectorAll('[data-slot-id]').forEach((item) => item.classList.remove('is-selected'));
                  slotButton.classList.add('is-selected');
                  confirmButton.disabled = false;
                  confirmButton.dataset.slotId = slotButton.dataset.slotId || '';
                });
              });
            }

            inline.classList.toggle('hidden');

            if (!confirmButton.dataset.bound) {
              confirmButton.addEventListener('click', async () => {
                const slotId = confirmButton.dataset.slotId;
                if (!slotId) return;
                try {
                  await window.RimalisAPI.request(`/viewings/me/bookings/${bookingId}/reschedule`, {
                    method: 'POST',
                    auth: true,
                    body: JSON.stringify({ slotId }),
                  });
                  if (typeof window.showNotification === 'function') {
                    window.showNotification(i18n('booking_rescheduled_success', 'Bokningen har uppdaterats'), 'success');
                  }
                  await loadBookings();
                } catch (error) {
                  if (typeof window.showNotification === 'function') {
                    window.showNotification(error.message || i18n('booking_reschedule_failed', 'Kunde inte boka om tiden'), 'error');
                  }
                }
              });
              confirmButton.dataset.bound = '1';
            }
          } catch (error) {
            if (typeof window.showNotification === 'function') {
              window.showNotification(error.message || i18n('property_load_slots_failed', 'Kunde inte ladda tider'), 'error');
            }
          }
        });
      });
    } catch (error) {
      const fail = document.createElement('div');
      fail.className = 'mobile-bookings-error';
      fail.textContent = error.message || i18n('user_load_bookings_failed', 'Kunde inte ladda bokningarna');
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
