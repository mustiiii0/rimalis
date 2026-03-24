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
      published: i18n('user_tab_active'),
      pending: i18n('user_tab_pending'),
      sold: i18n('user_tab_sold'),
      draft: i18n('user_tab_draft'),
    };
    return labels[status] || status || i18n('user_status_unknown');
  }

  function mkr(price) {
    return window.RimalisI18n?.formatCurrencySEK?.(price) || i18n('value_not_set');
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

  function escapeHtml(str) {
    return String(str ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function badge(status) {
    if (status === 'published') return `<span class="bg-green-500/20 text-green-400 px-4 py-2 rounded-full text-sm font-bold">${i18n('user_status_active')}</span>`;
    if (status === 'pending') return `<span class="bg-yellow-500/20 text-yellow-400 px-4 py-2 rounded-full text-sm font-bold">${i18n('user_status_pending')}</span>`;
    return `<span class="bg-white/10 text-white px-4 py-2 rounded-full text-sm font-bold">${i18n('user_status_draft')}</span>`;
  }

  function soldActionButton(status, id) {
    if (status !== 'published') return '';
    return `<button class="btn-outline px-4 py-3 text-[#e2ff31] border-[#e2ff31]/40 hover:bg-[#e2ff31]/15" data-mark-sold="${id}" title="${i18n('user_mark_listing_sold')}"><i class="fas fa-check-circle"></i></button>`;
  }

  function renderTabs(tabsEl, listings, activeStatus) {
    if (!tabsEl) return;
    tabsEl.textContent = '';
    TAB_STATUSES.forEach((status) => {
      const count = listings.filter((item) => item.status === status).length;
      const isActive = activeStatus === status;
      const btn = document.createElement('button');
      btn.className = `px-6 py-3 rounded-full transition ${isActive ? 'bg-[#e2ff31] text-black font-bold' : 'hover:bg-white/5'}`;
      btn.dataset.status = status;
      btn.type = 'button';
      btn.textContent = `${statusText(status)} (${count})`;
      tabsEl.appendChild(btn);
    });
  }

  function renderListings(container, listings, status) {
    const filtered = listings.filter((item) => item.status === status);
    if (!filtered.length) {
      const box = document.createElement('div');
      box.className = 'glass-dark p-6 rounded-3xl text-white/60';
      box.textContent = i18n('user_no_status_listings').replace('{status}', statusText(status).toLowerCase());
      container.textContent = '';
      container.appendChild(box);
      return;
    }

    container.textContent = '';
    filtered.forEach((p) => {
      const row = document.createElement('div');
      row.className = 'glass-dark p-6 rounded-3xl flex gap-6 items-center';

      const media = document.createElement('div');
      media.className = 'w-32 h-32 rounded-2xl overflow-hidden flex-shrink-0';
      const image = safeImageUrl(p.imageUrl);
      if (image) {
        const img = document.createElement('img');
        img.src = image;
        img.className = 'w-full h-full object-cover';
        img.alt = p.title || i18n('property_card_title_fallback');
        img.loading = 'lazy';
        media.appendChild(img);
      } else {
        const noImage = document.createElement('div');
        noImage.className = 'w-full h-full bg-white/5 flex items-center justify-center text-white/40 text-xs';
        noImage.textContent = i18n('no_image');
        media.appendChild(noImage);
      }

      const content = document.createElement('div');
      content.className = 'flex-1';
      const top = document.createElement('div');
      top.className = 'flex justify-between items-start mb-2';
      const info = document.createElement('div');
      const h3 = document.createElement('h3');
      h3.className = 'text-2xl font-bold';
      h3.textContent = p.title || i18n('property_card_title_fallback');
      const pLoc = document.createElement('p');
      pLoc.className = 'text-white/40';
      pLoc.textContent = `${p.location || i18n('value_not_set')} · ${window.RimalisI18n?.formatDate?.(p.createdAt) || '-'}`;
      const pRef = document.createElement('p');
      pRef.className = 'text-white/35 text-sm mt-1';
      pRef.textContent = `Ref: ${p.referenceCode || referenceFromId(p.id)}`;
      info.appendChild(h3);
      info.appendChild(pLoc);
      info.appendChild(pRef);

      const badgeWrap = document.createElement('div');
      if (p.status === 'published') badgeWrap.className = 'bg-green-500/20 text-green-400 px-4 py-2 rounded-full text-sm font-bold';
      else if (p.status === 'pending') badgeWrap.className = 'bg-yellow-500/20 text-yellow-400 px-4 py-2 rounded-full text-sm font-bold';
      else badgeWrap.className = 'bg-white/10 text-white px-4 py-2 rounded-full text-sm font-bold';
      badgeWrap.textContent = p.status === 'published' ? i18n('user_status_active') : p.status === 'pending' ? i18n('user_status_pending') : i18n('user_status_draft');

      top.appendChild(info);
      top.appendChild(badgeWrap);

      const meta = document.createElement('div');
      meta.className = 'flex items-center gap-6 text-white/60';
      const s1 = document.createElement('span');
      const s1i = document.createElement('i');
      s1i.className = 'fas fa-tag mr-2';
      s1.appendChild(s1i);
      s1.appendChild(document.createTextNode(mkr(p.price)));
      const s2 = document.createElement('span');
      const s2i = document.createElement('i');
      s2i.className = 'fas fa-home mr-2';
      s2.appendChild(s2i);
      s2.appendChild(document.createTextNode(statusText(p.status)));
      meta.appendChild(s1);
      meta.appendChild(s2);
      content.appendChild(top);
      content.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'flex gap-2';
      const openBtn = document.createElement('button');
      openBtn.className = 'btn-outline px-4 py-3';
      openBtn.dataset.openListing = String(p.id || '');
      const openIcon = document.createElement('i');
      openIcon.className = 'fas fa-eye';
      openBtn.appendChild(openIcon);
      actions.appendChild(openBtn);
      if (p.status === 'published') {
        const soldBtn = document.createElement('button');
        soldBtn.className = 'btn-outline px-4 py-3 text-[#e2ff31] border-[#e2ff31]/40 hover:bg-[#e2ff31]/15';
        soldBtn.dataset.markSold = String(p.id || '');
        soldBtn.title = i18n('user_mark_listing_sold');
        const soldIcon = document.createElement('i');
        soldIcon.className = 'fas fa-check-circle';
        soldBtn.appendChild(soldIcon);
        actions.appendChild(soldBtn);
      }
      const delBtn = document.createElement('button');
      delBtn.className = 'btn-outline px-4 py-3 text-red-300 border-red-500/30 hover:bg-red-500/20';
      delBtn.dataset.deleteListing = String(p.id || '');
      const delIcon = document.createElement('i');
      delIcon.className = 'fas fa-trash';
      delBtn.appendChild(delIcon);
      actions.appendChild(delBtn);

      row.appendChild(media);
      row.appendChild(content);
      row.appendChild(actions);
      container.appendChild(row);
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

      if (!listings.length) {
        renderTabs(tabsEl, listings, 'published');
        const box = document.createElement('div');
        box.className = 'glass-dark p-6 rounded-3xl text-white/60';
        box.textContent = i18n('user_no_listings_yet');
        container.textContent = '';
        container.appendChild(box);
        return;
      }

      let activeStatus = listings.some((item) => item.status === 'published')
        ? 'published'
        : listings[0].status;

      const rerender = () => {
        renderTabs(tabsEl, listings, activeStatus);
        renderListings(container, listings, activeStatus);
      };

      rerender();

      if (!tabsEl.dataset.langBound) {
        tabsEl.addEventListener('click', (event) => {
          const btn = event.target.closest('button[data-status]');
          if (!btn) return;
          activeStatus = btn.dataset.status || activeStatus;
          rerender();
        });
        tabsEl.dataset.langBound = '1';
      }

      if (!container.dataset.langBound) {
        container.addEventListener('click', async (event) => {
          const openBtn = event.target.closest('button[data-open-listing]');
          if (openBtn) {
            const listingId = openBtn.dataset.openListing;
            if (listingId) {
              window.location.href = `../public/property-modal.html?id=${encodeURIComponent(listingId)}`;
            }
            return;
          }

          const soldBtn = event.target.closest('button[data-mark-sold]');
          if (soldBtn) {
            const listingId = soldBtn.dataset.markSold;
            if (!listingId) return;
            if (!window.confirm(i18n('user_mark_listing_sold_confirm'))) return;
            soldBtn.disabled = true;
            try {
              await window.RimalisAPI.request(`/users/me/listings/${encodeURIComponent(listingId)}/status`, {
                method: 'PATCH',
                auth: true,
                body: JSON.stringify({ status: 'sold' }),
              });

              const item = listings.find((x) => x.id === listingId);
              if (item) item.status = 'sold';
              if (activeStatus === 'published' && !listings.some((x) => x.status === 'published')) {
                activeStatus = listings.some((x) => x.status === 'sold') ? 'sold' : listings[0].status;
              }
              rerender();
              if (typeof window.showNotification === 'function') {
                window.showNotification(i18n('user_listing_marked_sold'), 'success');
              }
            } catch (err) {
              alert(err.message || i18n('user_could_not_mark_sold'));
              soldBtn.disabled = false;
            }
            return;
          }

          const deleteBtn = event.target.closest('button[data-delete-listing]');
          if (!deleteBtn) return;

          const listingId = deleteBtn.dataset.deleteListing;
          if (!listingId) return;
          if (!window.confirm(i18n('user_delete_listing_confirm'))) return;

          deleteBtn.disabled = true;

          try {
            await window.RimalisAPI.request(`/users/me/listings/${encodeURIComponent(listingId)}`, {
              method: 'DELETE',
              auth: true,
            });

            const index = listings.findIndex((x) => x.id === listingId);
            if (index >= 0) listings.splice(index, 1);

            if (!listings.length) {
              renderTabs(tabsEl, listings, 'published');
              const box = document.createElement('div');
              box.className = 'glass-dark p-6 rounded-3xl text-white/60';
              box.textContent = i18n('user_no_listings_yet');
              container.textContent = '';
              container.appendChild(box);
              return;
            }

            if (!listings.some((x) => x.status === activeStatus)) {
              activeStatus = listings[0].status;
            }
            rerender();
          } catch (err) {
            alert(err.message || i18n('user_could_not_delete_listing'));
            deleteBtn.disabled = false;
          }
        });
        container.dataset.langBound = '1';
      }
    } catch (err) {
      const box = document.createElement('div');
      box.className = 'glass-dark p-6 rounded-3xl text-red-300';
      box.textContent = err.message || i18n('user_could_not_load_listings');
      container.textContent = '';
      container.appendChild(box);
    }
  }

  document.addEventListener('DOMContentLoaded', loadListings);
  window.addEventListener('rimalis:language-changed', loadListings);
})();
