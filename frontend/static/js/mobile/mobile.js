(function () {
  function updateMobileClocks() {
    const value = new Date().toLocaleTimeString('sv-SE', {
      hour: '2-digit',
      minute: '2-digit',
    });
    document.querySelectorAll("[class*='statusbar'] > span:first-child").forEach((node) => {
      node.textContent = value;
    });
  }

  async function updateMobileMessageBadge() {
    const chatLinks = Array.from(document.querySelectorAll(".bottom-nav .nav-item[href*='messages.html']"));
    if (!chatLinks.length || !window.RimalisAPI?.getAccessToken?.()) return;

    try {
      const response = await window.RimalisAPI.request('/messages/me', { auth: true });
      const unreadCount = Array.isArray(response?.messages)
        ? response.messages.filter((message) => message.state !== 'read').length
        : 0;

      chatLinks.forEach((link) => {
        let badge = link.querySelector('.nav-badge');
        if (!unreadCount) {
          badge?.remove();
          return;
        }
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'nav-badge';
          link.classList.add('mobile-relative');
          link.appendChild(badge);
        }
        badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
      });
    } catch (_err) {
      // ignore badge failures
    }
  }

  function ensureToastHost() {
    let host = document.getElementById('mobileToastHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'mobileToastHost';
      host.className = 'mobile-toast-host';
      document.body.appendChild(host);
    }
    return host;
  }

  function showNotification(message, type) {
    const host = ensureToastHost();
    const toast = document.createElement('div');
    toast.textContent = String(message || '');
    toast.className = `mobile-toast mobile-toast--${type === 'success' ? 'success' : type === 'error' ? 'error' : 'info'}`;
    host.appendChild(toast);
    window.setTimeout(() => {
      toast.remove();
      if (!host.childElementCount) host.remove();
    }, 3200);
  }

  if (typeof window.showNotification !== 'function') {
    window.showNotification = showNotification;
  }


  function handleCreateListingClick() {
    const isLoggedIn = Boolean(window.RimalisAPI?.getAccessToken?.());
    const target = '../user/create_listing/step1_listing_info.html';
    if (!isLoggedIn) {
      window.location.href = `../auth/login.html?next=${encodeURIComponent(target)}`;
      return;
    }
    window.location.href = target;
  }

  function bindMobileActionHooks() {
    document.querySelectorAll('[data-mobile-login-target]').forEach((el) => {
      if (el.dataset.mobileActionBound === '1') return;
      el.dataset.mobileActionBound = '1';
      el.addEventListener('click', (event) => {
        event.preventDefault();
        const href = el.getAttribute('data-mobile-login-target') || '../auth/login.html';
        const authTarget = el.getAttribute('data-mobile-auth-target');
        const isLoggedIn = Boolean(window.RimalisAPI?.getAccessToken?.());
        window.location.href = isLoggedIn && authTarget ? authTarget : href;
      });
    });

    document.querySelectorAll('[data-create-listing-trigger]').forEach((el) => {
      if (el.dataset.mobileActionBound === '1') return;
      el.dataset.mobileActionBound = '1';
      el.addEventListener('click', (event) => {
        event.preventDefault();
        handleCreateListingClick();
      });
    });
  }

  function initMobileContactForm() {
    const form = document.getElementById('contactForm');
    if (!form || form.dataset.mobileContactBound === '1') return;
    form.dataset.mobileContactBound = '1';
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const t = window.RimalisI18n?.t || ((_, fallback) => fallback);
      const firstName = document.getElementById('firstName')?.value;
      const lastName = document.getElementById('lastName')?.value;
      const email = document.getElementById('contactEmail')?.value;
      const message = document.getElementById('message')?.value;

      if (!firstName || !lastName || !email || !message) {
        showNotification(t('contact_required_fields', 'Fyll i alla obligatoriska fält'), 'error');
        return;
      }

      if (typeof validateEmail === 'function' && !validateEmail(email)) {
        showNotification(t('newsletter_invalid_email', 'Ange en giltig e-postadress'), 'error');
        return;
      }

      showNotification(t('contact_success', 'Tack för ditt meddelande! Vi återkommer inom 24h.'), 'success');
      this.reset();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    updateMobileClocks();
    window.clearInterval(window.__mobileClockTimer);
    window.__mobileClockTimer = window.setInterval(updateMobileClocks, 30000);
    updateMobileMessageBadge();
    bindMobileActionHooks();
    initMobileContactForm();
  });

  document.addEventListener('rimalis:messages-updated', updateMobileMessageBadge);
})();
