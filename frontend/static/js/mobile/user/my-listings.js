(function () {
  const TAB_STATUSES = ['published', 'pending', 'sold', 'draft'];

  function i18n(key, fallback) {
    return window.RimalisI18n?.t?.(key, fallback) || fallback;
  }

  async function ensureI18nReady() {
    if (window.RimalisI18n?.refresh) {
      await window.RimalisI18n.refresh(window.RimalisI18n.getLang?.());
    }
  }

  function statusText(status) {
    const labels = {
      published: i18n('user_tab_active', 'Aktiva'),
      pending: i18n('user_tab_pending', 'Väntar'),
      sold: i18n('user_tab_sold', 'Sålda'),
      draft: i18n('user_tab_draft', 'Utkast'),
    };
    return labels[status] || status || i18n('user_status_unknown', 'Okänd');
  }

  function formatPrice(price) {
    return window.RimalisI18n?.formatCurrencySEK?.(price) || i18n('value_not_set', '-');
  }

  function safeImageUrl(url) {
    if (typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    if (trimmed.startsWith('/static/uploads/') || trimmed.startsWith('/uploads/')) return trimmed;
    if (trimmed.startsWith('data:image/')) return trimmed;
    return '';
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

  function updateSummaryCounts(listings) {
    const map = {
      published: 'mobileListingsPublishedCount',
      pending: 'mobileListingsPendingCount',
      sold: 'mobileListingsSoldCount',
    };
    Object.entries(map).forEach(([status, id]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(listings.filter((item) => item.status === status).length);
    });
  }

  function renderTabs(tabsEl, listings, activeStatus) {
    if (!tabsEl) return;
    tabsEl.textContent = '';
    TAB_STATUSES.forEach((status) => {
      const count = listings.filter((item) => item.status === status).length;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.status = status;
      button.className = status === activeStatus ? 'is-active' : '';
      button.textContent = `${statusText(status)} (${count})`;
      tabsEl.appendChild(button);
    });
  }

  function renderEmpty(container, message, type) {
    const box = document.createElement('div');
    box.className = type === 'error' ? 'mobile-my-listings-error' : 'mobile-my-listings-empty';
    box.textContent = message;
    container.textContent = '';
    container.appendChild(box);
  }

  function renderListings(container, listings, status) {
    const filtered = listings.filter((item) => item.status === status);
    if (!filtered.length) {
      renderEmpty(
        container,
        i18n('user_no_status_listings', 'Inga annonser i denna kategori just nu.').replace('{status}', statusText(status).toLowerCase()),
        'empty'
      );
      return;
    }

    container.textContent = '';
    filtered.forEach((listing) => {
      const card = document.createElement('article');
      card.className = 'mobile-my-listing-card';

      const media = document.createElement('div');
      media.className = 'mobile-my-listing-card__media';
      const image = safeImageUrl(listing.imageUrl);

      if (image) {
        const img = document.createElement('img');
        img.src = image;
        img.alt = listing.title || i18n('property_card_title_fallback', 'Annons');
        img.loading = 'lazy';
        media.appendChild(img);
      } else {
        const fallback = document.createElement('div');
        fallback.className = 'flex items-center justify-center text-[#98a2b3] text-sm';
        fallback.textContent = i18n('no_image', 'Ingen bild');
        media.appendChild(fallback);
      }

      const statusBadge = document.createElement('span');
      statusBadge.className = 'mobile-my-listing-card__status';
      statusBadge.dataset.status = listing.status || 'draft';
      statusBadge.textContent = statusText(listing.status);
      media.appendChild(statusBadge);

      const body = document.createElement('div');
      body.className = 'mobile-my-listing-card__body';

      const head = document.createElement('div');
      head.className = 'mobile-my-listing-card__head';

      const titleWrap = document.createElement('div');
      const title = document.createElement('h3');
      title.textContent = listing.title || i18n('property_card_title_fallback', 'Annons');
      const meta = document.createElement('p');
      meta.textContent = `${listing.location || i18n('value_not_set', '-')} · ${window.RimalisI18n?.formatDate?.(listing.createdAt) || '-'}`;
      const ref = document.createElement('p');
      ref.className = 'mobile-my-listing-card__ref';
      ref.textContent = `Ref: ${listing.referenceCode || referenceFromId(listing.id)}`;
      titleWrap.appendChild(title);
      titleWrap.appendChild(meta);
      titleWrap.appendChild(ref);

      const price = document.createElement('span');
      price.className = 'mobile-my-listing-card__price';
      price.textContent = formatPrice(listing.price);

      head.appendChild(titleWrap);
      head.appendChild(price);

      const metaRow = document.createElement('div');
      metaRow.className = 'mobile-my-listing-card__meta';
      [
        ['fas fa-home', statusText(listing.status)],
        ['fas fa-calendar', window.RimalisI18n?.formatDate?.(listing.createdAt) || '-'],
        ['fas fa-tag', formatPrice(listing.price)],
      ].forEach(([iconClass, label]) => {
        const item = document.createElement('span');
        appendIcon(item, iconClass);
        item.appendChild(document.createTextNode(label));
        metaRow.appendChild(item);
      });

      const actions = document.createElement('div');
      actions.className = 'mobile-my-listing-card__actions';

      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.dataset.openListing = String(listing.id || '');
      appendIcon(openBtn, 'fas fa-eye');
      actions.appendChild(openBtn);

      if (listing.status === 'published') {
        const soldBtn = document.createElement('button');
        soldBtn.type = 'button';
        soldBtn.dataset.markSold = String(listing.id || '');
        soldBtn.title = i18n('user_mark_listing_sold', 'Markera som såld');
        appendIcon(soldBtn, 'fas fa-check-circle');
        actions.appendChild(soldBtn);
      }

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.dataset.deleteListing = String(listing.id || '');
      appendIcon(deleteBtn, 'fas fa-trash');
      actions.appendChild(deleteBtn);

      body.appendChild(head);
      body.appendChild(metaRow);
      body.appendChild(actions);
      card.appendChild(media);
      card.appendChild(body);
      container.appendChild(card);
    });
  }

  async function loadListings() {
    const container = document.getElementById('myListingsContainer');
    const tabsEl = document.getElementById('myListingsTabs');
    if (!container || !tabsEl || !window.RimalisAPI) return;

    try {
      await ensureI18nReady();
      const body = await window.RimalisAPI.request('/users/me/listings', { auth: true });
      const listings = body.listings || [];
      updateSummaryCounts(listings);

      if (!listings.length) {
        renderTabs(tabsEl, listings, 'published');
        renderEmpty(container, i18n('user_no_listings_yet', 'Du har inga annonser ännu.'), 'empty');
        return;
      }

      let activeStatus = listings.some((item) => item.status === 'published') ? 'published' : (listings[0].status || 'draft');

      const rerender = () => {
        renderTabs(tabsEl, listings, activeStatus);
        renderListings(container, listings, activeStatus);
        updateSummaryCounts(listings);
      };

      rerender();

      if (!tabsEl.dataset.boundClicks) {
        tabsEl.addEventListener('click', (event) => {
          const button = event.target.closest('button[data-status]');
          if (!button) return;
          activeStatus = button.dataset.status || activeStatus;
          rerender();
        });
        tabsEl.dataset.boundClicks = '1';
      }

      if (!container.dataset.boundClicks) {
        container.addEventListener('click', async (event) => {
          const openBtn = event.target.closest('button[data-open-listing]');
          if (openBtn?.dataset.openListing) {
            window.location.href = `/templates/mobile/public/property-modal.html?id=${encodeURIComponent(openBtn.dataset.openListing)}`;
            return;
          }

          const soldBtn = event.target.closest('button[data-mark-sold]');
          if (soldBtn?.dataset.markSold) {
            const listingId = soldBtn.dataset.markSold;
            if (!window.confirm(i18n('user_mark_listing_sold_confirm', 'Markera annonsen som såld?'))) return;
            soldBtn.disabled = true;
            try {
              await window.RimalisAPI.request(`/users/me/listings/${encodeURIComponent(listingId)}/status`, {
                method: 'PATCH',
                auth: true,
                body: JSON.stringify({ status: 'sold' }),
              });

              const item = listings.find((entry) => String(entry.id) === String(listingId));
              if (item) item.status = 'sold';
              if (activeStatus === 'published' && !listings.some((entry) => entry.status === 'published')) {
                activeStatus = listings.some((entry) => entry.status === 'sold') ? 'sold' : (listings[0].status || 'draft');
              }
              rerender();
            } catch (error) {
              alert(error.message || i18n('user_could_not_mark_sold', 'Kunde inte markera som såld.'));
              soldBtn.disabled = false;
            }
            return;
          }

          const deleteBtn = event.target.closest('button[data-delete-listing]');
          if (deleteBtn?.dataset.deleteListing) {
            const listingId = deleteBtn.dataset.deleteListing;
            if (!window.confirm(i18n('user_delete_listing_confirm', 'Vill du ta bort annonsen?'))) return;
            deleteBtn.disabled = true;
            try {
              await window.RimalisAPI.request(`/users/me/listings/${encodeURIComponent(listingId)}`, {
                method: 'DELETE',
                auth: true,
              });

              const index = listings.findIndex((entry) => String(entry.id) === String(listingId));
              if (index >= 0) listings.splice(index, 1);

              if (!listings.length) {
                renderTabs(tabsEl, listings, 'published');
                updateSummaryCounts(listings);
                renderEmpty(container, i18n('user_no_listings_yet', 'Du har inga annonser ännu.'), 'empty');
                return;
              }

              if (!listings.some((entry) => entry.status === activeStatus)) {
                activeStatus = listings[0].status || 'draft';
              }
              rerender();
            } catch (error) {
              alert(error.message || i18n('user_could_not_delete_listing', 'Kunde inte ta bort annonsen.'));
              deleteBtn.disabled = false;
            }
          }
        });
        container.dataset.boundClicks = '1';
      }
    } catch (error) {
      renderEmpty(
        container,
        error.message || i18n('user_could_not_load_listings', 'Kunde inte ladda annonserna.'),
        'error'
      );
    }
  }

  document.addEventListener('DOMContentLoaded', loadListings);
  window.addEventListener('rimalis:language-changed', loadListings);
})();
