(function () {
  const LANGUAGE_KEY = 'rimalis_language';
  const SUPPORTED = ['sv', 'en'];

  function currentLang() {
    const saved = (localStorage.getItem(LANGUAGE_KEY) || 'sv').toLowerCase();
    return SUPPORTED.includes(saved) ? saved : 'sv';
  }

  function setLabel(lang) {
    const label = document.getElementById('adminSelectedLanguage');
    if (!label) return;
    const isEn = lang === 'en';
    label.textContent = isEn ? '🇬🇧 EN' : '🇸🇪 SV';
  }

  function setActive(lang) {
    document.querySelectorAll('.admin-lang-option').forEach((opt) => {
      opt.classList.toggle('active', opt.dataset.lang === lang);
    });
  }

  function closeMenu() {
    const menu = document.getElementById('adminLanguageMenu');
    if (menu) menu.classList.remove('active');
  }

  async function applyLanguage(lang) {
    const normalized = SUPPORTED.includes(lang) ? lang : 'sv';
    const button = document.getElementById('adminLanguageBtn');
    if (button) {
      button.disabled = true;
      button.classList.add('opacity-60');
    }
    localStorage.setItem(LANGUAGE_KEY, normalized);
    setLabel(normalized);
    setActive(normalized);
    closeMenu();

    try {
      if (window.RimalisI18n?.setLanguage) {
        await window.RimalisI18n.setLanguage(normalized);
        return;
      }
      if (window.RimalisI18n?.refresh) {
        await window.RimalisI18n.refresh(normalized);
      }
      window.dispatchEvent(new CustomEvent('rimalis:language-changed', { detail: { lang: normalized } }));
    } finally {
      if (button) {
        button.disabled = false;
        button.classList.remove('opacity-60');
      }
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    const button = document.getElementById('adminLanguageBtn');
    const menu = document.getElementById('adminLanguageMenu');
    if (!button || !menu) return;

    const lang = currentLang();
    setLabel(lang);
    setActive(lang);

    button.addEventListener('click', function (event) {
      event.stopPropagation();
      menu.classList.toggle('active');
    });

    menu.addEventListener('click', function (event) {
      event.stopPropagation();
      const option = event.target.closest('.admin-lang-option');
      if (!option) return;
      applyLanguage((option.dataset.lang || '').toLowerCase());
    });

    document.addEventListener('click', closeMenu);
  });
})();
