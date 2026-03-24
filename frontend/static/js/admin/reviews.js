(function () {
  let currentReviews = [];

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

  function mkr(price) {
    return window.RimalisI18n?.formatCurrencySEK?.(price) || i18n('value_not_set');
  }

  function notify(message) {
    const n = document.createElement('div');
    n.className = 'notice';
    n.textContent = message;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 2200);
  }

  function renderReviews(reviews) {
    const container = document.getElementById('reviewList');
    if (!container) return;
    currentReviews = Array.isArray(reviews) ? reviews : [];
    container.textContent = '';

    if (!currentReviews.length) {
      const article = document.createElement('article');
      article.className = 'card review-card';
      const p = document.createElement('p');
      p.className = 'small';
      p.textContent = i18n('admin_no_reviews_in_queue');
      article.appendChild(p);
      container.appendChild(article);
      return;
    }
    currentReviews.forEach((r) => {
      const article = document.createElement('article');
      article.className = 'card review-card';
      article.dataset.review = String(r.id || '');
      article.dataset.propertyId = String(r.property?.id || r.propertyId || '');

      const head = document.createElement('div');
      head.className = 'review-head';
      const thumbWrap = document.createElement('div');
      thumbWrap.className = 'review-thumb-wrap';
      if (r.property?.imageUrl) {
        const img = document.createElement('img');
        img.className = 'review-thumb';
        img.src = r.property.imageUrl;
        img.alt = r.property?.title || i18n('admin_listing_image_alt');
        img.loading = 'lazy';
        thumbWrap.appendChild(img);
      } else {
        const fallback = document.createElement('div');
        fallback.className = 'review-thumb review-thumb-fallback';
        fallback.textContent = i18n('no_image');
        thumbWrap.appendChild(fallback);
      }
      const headContent = document.createElement('div');
      headContent.className = 'review-head-content';
      const h3 = document.createElement('h3');
      h3.textContent = r.property?.title || i18n('property_no_title');
      const p = document.createElement('p');
      p.className = 'small';
      p.textContent = `${r.property?.location || i18n('admin_location_not_specified')}${r.property?.price ? ` · ${mkr(r.property.price)}` : ''}`;
      headContent.append(h3, p);
      const badge = document.createElement('span');
      badge.className = 'badge warn';
      badge.textContent = i18n('user_status_pending');
      head.append(thumbWrap, headContent, badge);

      const meta = document.createElement('div');
      meta.className = 'review-meta small';
      [
        `${i18n('admin_id_label')}: ${String(r.id || '').slice(0, 8)}`,
        `${i18n('admin_ref_label')}: ${r.property?.referenceCode || referenceFromId(r.property?.id || r.propertyId)}`,
        `${i18n('admin_review_label')}: ${r.status}`,
        `${i18n('admin_listing_label')}: ${r.property?.propertyStatus || i18n('admin_unknown')}`,
      ].forEach((txt) => {
        const span = document.createElement('span');
        span.textContent = txt;
        meta.appendChild(span);
      });

      const actions = document.createElement('div');
      actions.className = 'actions';
      const btns = [
        ['btn btn-ghost', 'view', i18n('admin_view_listing')],
        ['btn btn-primary', 'approve', i18n('admin_approve')],
        ['btn btn-ghost', 'changes', i18n('admin_request_changes')],
        ['btn btn-ghost', 'reject', i18n('admin_reject')],
      ];
      btns.forEach(([cls, action, label]) => {
        const btn = document.createElement('button');
        btn.className = cls;
        btn.dataset.action = action;
        if (action === 'view') btn.dataset.propertyId = String(r.property?.id || r.propertyId || '');
        btn.textContent = label;
        actions.appendChild(btn);
      });

      article.append(head, meta, actions);
      container.appendChild(article);
    });
  }

  async function fetchQueue() {
    const body = await window.RimalisAPI.request('/reviews/queue', { auth: true });
    renderReviews(body.reviews || []);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await ensureI18nReady();

    try {
      await fetchQueue();
    } catch (err) {
      notify(err.message || i18n('admin_load_review_queue_failed'));
    }

    document.getElementById('reviewList')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const card = btn.closest('[data-review]');
      if (!card) return;

      const action = btn.dataset.action;
      if (action === 'view') {
        const propertyId = btn.dataset.propertyId || card.dataset.propertyId;
        if (propertyId) {
          window.open(`../public/property-modal.html?id=${encodeURIComponent(propertyId)}`, '_blank');
        }
        return;
      }
      if (action === 'changes') {
        notify(i18n('admin_change_request_sent'));
        return;
      }

      const status = action === 'approve' ? 'approved' : 'rejected';

      try {
        await window.RimalisAPI.request(`/reviews/${card.dataset.review}`, {
          method: 'PATCH',
          auth: true,
          body: JSON.stringify({ status }),
        });
        notify(status === 'approved' ? i18n('admin_listing_approved') : i18n('admin_listing_rejected'));
        await fetchQueue();
      } catch (err) {
        notify(err.message || i18n('admin_update_review_failed'));
      }
    });

    document.getElementById('massApproveBtn')?.addEventListener('click', async () => {
      const pending = currentReviews.filter((r) => r?.status === 'pending');
      if (!pending.length) {
        notify(i18n('admin_no_pending_to_approve'));
        return;
      }

      const btn = document.getElementById('massApproveBtn');
      if (btn) {
        btn.disabled = true;
        btn.textContent = i18n('admin_approving');
      }

      try {
        await Promise.all(
          pending.map((r) =>
            window.RimalisAPI.request(`/reviews/${r.id}`, {
              method: 'PATCH',
              auth: true,
              body: JSON.stringify({ status: 'approved' }),
            })
          )
        );
        notify(i18n('admin_mass_approved_count').replace('{count}', String(pending.length)));
        await fetchQueue();
      } catch (err) {
        notify(err.message || i18n('admin_mass_approve_failed'));
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = i18n('admin_mass_approve');
        }
      }
    });
  });

  window.addEventListener('rimalis:language-changed', async () => {
    await ensureI18nReady();
    if (currentReviews.length) renderReviews(currentReviews);
  });
})();
