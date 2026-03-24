(function () {
  function i18n(key, fallback) {
    return window.RimalisI18n?.t?.(key, fallback) || fallback;
  }

  function initContactForm() {
    const form = document.getElementById('contactForm');
    if (!form || form.dataset.pageHooksBound === '1') return;
    form.dataset.pageHooksBound = '1';

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      const firstName = document.getElementById('firstName')?.value;
      const lastName = document.getElementById('lastName')?.value;
      const email = document.getElementById('contactEmail')?.value;
      const message = document.getElementById('message')?.value;

      if (!firstName || !lastName || !email || !message) {
        window.showNotification?.(i18n('contact_required_fields', 'Fyll i alla obligatoriska fält'), 'error');
        return;
      }

      if (typeof window.validateEmail === 'function' && !window.validateEmail(email)) {
        window.showNotification?.(i18n('newsletter_invalid_email', 'Ange en giltig e-postadress'), 'error');
        return;
      }

      window.showNotification?.(i18n('contact_success', 'Tack för ditt meddelande! Vi återkommer inom 24h.'), 'success');
      form.reset();
    });
  }

  function initFaqToggles() {
    document.querySelectorAll('[data-faq-btn]').forEach((button) => {
      if (button.dataset.pageHooksBound === '1') return;
      button.dataset.pageHooksBound = '1';
      button.addEventListener('click', () => {
        const content = button.parentElement?.querySelector('[data-faq-content]');
        content?.classList.toggle('hidden');
      });
    });
  }

  function initLegalBackLinks() {
    document.querySelectorAll('[data-history-back]').forEach((link) => {
      if (link.dataset.pageHooksBound === '1') return;
      link.dataset.pageHooksBound = '1';
      link.addEventListener('click', (event) => {
        event.preventDefault();
        window.history.back();
      });
    });
  }

  function initSearchRedirect() {
    const targetPath = document.body?.dataset.redirectTarget;
    if (!targetPath || document.body?.dataset.redirectBound === '1') return;
    document.body.dataset.redirectBound = '1';

    const url = new URL(window.location.href);
    const target = new URL(targetPath, window.location.origin);
    url.searchParams.forEach((value, key) => target.searchParams.set(key, value));
    window.location.replace(target.toString());
  }

  document.addEventListener('DOMContentLoaded', function () {
    initContactForm();
    initFaqToggles();
    initLegalBackLinks();
    initSearchRedirect();
  });
})();
