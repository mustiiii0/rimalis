(function () {
  const LANGUAGE_KEY = 'rimalis_language';
  const DEFAULT_LANG = 'sv';
  let currentDict = {};
  let liveTranslatorObserver = null;
  let switchOverlayEl = null;
  let switchOverlayStartedAt = 0;
  let previousActiveElement = null;
  let previousScrollX = 0;
  let previousScrollY = 0;

  function getLang() {
    const lang = (localStorage.getItem(LANGUAGE_KEY) || DEFAULT_LANG).toLowerCase();
    if (lang === 'en') return 'en';
    if (lang === 'ar') return 'ar';
    return 'sv';
  }

  function t(key, fallback = '') {
    if (!currentDict || typeof currentDict !== 'object') return fallback || key;
    return currentDict[key] || fallback || key;
  }

  function normalizeLang(lang) {
    const normalized = String(lang || '').toLowerCase();
    if (normalized === 'en') return 'en';
    if (normalized === 'ar') return 'ar';
    return 'sv';
  }

  function localeFor(lang = getLang()) {
    const normalized = normalizeLang(lang);
    if (normalized === 'en') return 'en-GB';
    if (normalized === 'ar') return 'ar-SA-u-nu-latn';
    return 'sv-SE';
  }

  function applyDocumentDirection(lang) {
    const normalized = normalizeLang(lang);
    const isRtl = normalized === 'ar';
    document.documentElement.setAttribute('lang', normalized);
    document.documentElement.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
    if (document.body) {
      document.body.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
      document.body.classList.toggle('rtl-active', isRtl);
    }
    document.documentElement.classList.toggle('rtl-active', isRtl);
    if (document.body) {
      document.body.classList.toggle('rimalis-rtl-font', isRtl);
      document.body.classList.toggle('rimalis-ltr-font', !isRtl);
    }
  }

  function ensureRtlStyles() {}

  function formatNumber(value, options = {}) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '-';
    return new Intl.NumberFormat(localeFor(), options).format(n);
  }

  function formatCurrencySEK(value, options = {}) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return '-';
    const lang = getLang();
    const compact = options.compact !== false;
    if (!compact) {
      const amount = new Intl.NumberFormat(localeFor(lang), { maximumFractionDigits: 0 }).format(Math.round(n));
      return lang === 'en' ? `${amount} SEK` : `${amount} kr`;
    }
    if (n >= 1000000) {
      const short = `${(n / 1000000).toFixed(1)}`;
      return lang === 'en' ? `${short} MSEK` : `${short} Mkr`;
    }
    const amount = new Intl.NumberFormat(localeFor(lang), { maximumFractionDigits: 0 }).format(Math.round(n));
    return lang === 'en' ? `${amount} SEK` : `${amount} kr`;
  }

  function formatDate(value, options = {}) {
    if (!value) return '-';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return new Intl.DateTimeFormat(localeFor(), options).format(d);
  }

  function formatDateTime(value, options = {}) {
    if (!value) return '-';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    const defaults = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' };
    return new Intl.DateTimeFormat(localeFor(), { ...defaults, ...options }).format(d);
  }

  function ensureSwitchOverlay() {
    if (switchOverlayEl) return switchOverlayEl;
    const el = document.createElement('div');
    el.id = 'rimalis-language-overlay';
    el.className = 'rimalis-language-overlay';
    el.setAttribute('aria-live', 'polite');
    const box = document.createElement('div');
    box.className = 'rimalis-language-overlay__box';
    const spinner = document.createElement('span');
    spinner.className = 'rimalis-language-overlay__spinner';
    const textNode = document.createElement('span');
    textNode.id = 'rimalisLanguageOverlayText';
    textNode.textContent = 'Updating language...';
    box.append(spinner, textNode);
    el.appendChild(box);
    document.body.appendChild(el);
    switchOverlayEl = el;
    return switchOverlayEl;
  }

  function showLanguageSwitchOverlay(lang) {
    const el = ensureSwitchOverlay();
    const text = el.querySelector('#rimalisLanguageOverlayText');
    if (text) {
      const normalized = normalizeLang(lang);
      text.textContent = normalized === 'en' ? 'Updating language...' : normalized === 'ar' ? '...جاري تحديث اللغة' : 'Uppdaterar språk...';
    }
    switchOverlayStartedAt = Date.now();
    previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    previousScrollX = window.scrollX || window.pageXOffset || 0;
    previousScrollY = window.scrollY || window.pageYOffset || 0;
    document.body.classList.add('rimalis-disable-pointer-events');
    el.classList.add('is-visible');
    requestAnimationFrame(() => {
      el.classList.add('is-active');
    });
  }

  function hideLanguageSwitchOverlay() {
    const el = ensureSwitchOverlay();
    const minVisibleMs = 160;
    const elapsed = Date.now() - switchOverlayStartedAt;
    const wait = Math.max(0, minVisibleMs - elapsed);
    window.setTimeout(() => {
      el.classList.remove('is-active');
      window.setTimeout(() => {
        el.classList.remove('is-visible');
      }, 170);
      document.body.classList.remove('rimalis-disable-pointer-events');
      if (Number.isFinite(previousScrollX) && Number.isFinite(previousScrollY)) {
        window.scrollTo(previousScrollX, previousScrollY);
      }
      if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        try {
          previousActiveElement.focus({ preventScroll: true });
        } catch (_err) {
          // ignore focus restore issues
        }
      }
      previousActiveElement = null;
    }, wait);
  }

  const ALLOWED_I18N_HTML_KEYS = new Set([
    'about_agents_title',
    'about_hero_badge',
    'about_hero_title',
    'about_values_title',
    'areas_guide_title',
    'areas_hero_title',
    'areas_map_title',
    'auth_terms_html',
    'contact_hero_title',
    'home_about_title',
    'home_areas_title',
    'home_featured_title',
    'home_mobile_sell_title_html',
    'legal_privacy_heading_html',
    'legal_privacy_content_html',
    'legal_terms_heading_html',
    'legal_terms_content_html',
    'legal_cookies_heading_html',
    'legal_cookies_content_html',
    'properties_hero_title',
    'user_favorites_title',
    'user_my_listings_title',
    'user_profile_settings_title',
  ]);

  const ALLOWED_I18N_HTML_SELECTORS = new Set([
    '#aboutHeroBadge',
    '#contactSendBtn',
    '#pageSearchButton',
    '#userMyListingsCreateBtn',
  ]);

  function canRenderI18nHtml(key, selector) {
    if (ALLOWED_I18N_HTML_KEYS.has(String(key || ''))) return true;
    return ALLOWED_I18N_HTML_SELECTORS.has(String(selector || ''));
  }

  async function loadDictionary(lang) {
    const response = await fetch(`/static/i18n/${lang}.json`, { cache: 'no-cache' });
    if (!response.ok) throw new Error('Could not load i18n');
    return response.json();
  }

  function setText(selector, value) {
    if (!value) return;
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
  }

  function setPlaceholder(selector, value) {
    if (!value) return;
    const el = document.querySelector(selector);
    if (el) el.setAttribute('placeholder', value);
  }

  function setHtml(selector, value, key) {
    if (!value) return;
    const el = document.querySelector(selector);
    if (!el) return;
    if (!canRenderI18nHtml(key, selector)) {
      el.textContent = value;
      return;
    }
    el.innerHTML = value;
  }

  function setTitle(value) {
    if (value) document.title = value;
  }

  function setSelectOptions(selectId, labels) {
    const select = document.getElementById(selectId);
    if (!select || !Array.isArray(labels)) return;
    labels.forEach((label, i) => {
      if (select.options[i] && label) select.options[i].textContent = label;
    });
  }

  function applyDataI18n(dict) {
    if (!dict || typeof dict !== 'object') return;

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (!key || !dict[key]) return;

      if (el.hasAttribute('data-i18n-html')) {
        if (canRenderI18nHtml(key)) el.innerHTML = dict[key];
        else el.textContent = dict[key];
        return;
      }

      if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && (el.hasAttribute('placeholder') || el.hasAttribute('data-i18n-placeholder'))) {
        el.setAttribute('placeholder', dict[key]);
        return;
      }

      el.textContent = dict[key];
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (!key || !dict[key]) return;
      el.setAttribute('placeholder', dict[key]);
    });

    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      if (!key || !dict[key]) return;
      el.setAttribute('title', dict[key]);
    });
  }

  function replaceTextNodes(replacements, root = document.body) {
    if (!replacements || typeof replacements !== 'object') return;
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const updates = [];

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parentTag = node.parentElement?.tagName;
      if (!parentTag || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parentTag)) continue;
      const raw = node.nodeValue || '';
      const normalized = raw.replace(/\s+/g, ' ').trim();
      if (!normalized) continue;
      const translated = replacements[normalized];
      if (!translated) continue;
      if (typeof translated === 'string' && (translated.includes('<') || translated.includes('>'))) continue;

      const leading = raw.match(/^\s*/)?.[0] || '';
      const trailing = raw.match(/\s*$/)?.[0] || '';
      updates.push([node, `${leading}${translated}${trailing}`]);
    }

    updates.forEach(([node, value]) => {
      node.nodeValue = value;
    });
  }

  function ensureLiveTranslation(replacements) {
    if (!document.body) return;

    if (liveTranslatorObserver) {
      liveTranslatorObserver.disconnect();
      liveTranslatorObserver = null;
    }

    if (!replacements || typeof replacements !== 'object' || Object.keys(replacements).length === 0) return;

    liveTranslatorObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            const holder = document.createElement('span');
            holder.appendChild(node.cloneNode(true));
            replaceTextNodes(replacements, holder);
            if (holder.firstChild && node.nodeValue !== holder.firstChild.nodeValue) {
              node.nodeValue = holder.firstChild.nodeValue;
            }
            return;
          }
          if (node.nodeType === Node.ELEMENT_NODE) {
            replaceTextNodes(replacements, node);
          }
        });
      });
    });

    liveTranslatorObserver.observe(document.body, { childList: true, subtree: true });
  }

  function applyCommon(dict) {
    setText('#loginModal h3', dict.login_welcome_back);
    setText('#loginModal p.text-white\\/40', dict.login_modal_subtitle);
    setPlaceholder('#loginEmail', dict.field_email);
    setPlaceholder('#loginPassword', dict.field_password);
    setText('#loginModal button[type="submit"]', dict.login_btn);
    setText('#loginModal a[href*="forgot_password"]', dict.forgot_password);
    setText('#loginModal a[href*="register"]', dict.register_link);
    const rememberLabel = document.querySelector('#loginModal label.flex.items-center.gap-2.text-white\\/50');
    if (rememberLabel && dict.auth_remember_me) {
      let span = rememberLabel.querySelector('span');
      if (!span) {
        span = document.createElement('span');
        rememberLabel.appendChild(span);
      }
      span.textContent = dict.auth_remember_me;
    }
    const noAccountText = document.querySelector('#loginModal p.text-center.text-white\\/40.text-sm.mt-6');
    if (noAccountText && dict.auth_no_account) {
      const regLink = noAccountText.querySelector('a[href*="register"]');
      noAccountText.textContent = '';
      const lead = document.createElement('span');
      lead.textContent = dict.auth_no_account;
      noAccountText.appendChild(lead);
      if (regLink) {
        noAccountText.appendChild(document.createTextNode(' '));
        noAccountText.appendChild(regLink);
      }
    }

    const chatHeader = document.querySelector('#chatBox .chat-header span');
    if (chatHeader && dict.chat_title) chatHeader.textContent = dict.chat_title;
    setPlaceholder('#chatInput', dict.chat_placeholder);

    const mobileMenu = document.querySelectorAll('#mobileMenu .mobile-menu-links a');
    if (mobileMenu.length >= 6) {
      if (dict.nav_home) mobileMenu[0].textContent = dict.nav_home;
      if (dict.nav_properties) mobileMenu[1].textContent = dict.nav_properties;
      if (dict.nav_areas) mobileMenu[2].textContent = dict.nav_areas;
      if (dict.nav_about) mobileMenu[3].textContent = dict.nav_about;
      if (dict.nav_contact) mobileMenu[4].textContent = dict.nav_contact;
      if (dict.nav_login) mobileMenu[5].textContent = dict.nav_login;
    }
    setText('#mobileMenu .mt-8 p', dict.follow_us);
  }

  function applyHome(dict) {
    if (!location.pathname.endsWith('/home.html')) return;
    setTitle(dict.title_home);
    setText('#homeHeroBadge', dict.home_hero_badge);
    setText('#homeHeroLine1', dict.home_hero_line1);
    setText('#homeHeroLine2', dict.home_hero_line2);
    setText('#homeHeroDescription', dict.home_hero_description);
    setPlaceholder('#searchInput', dict.search_placeholder);
    setHtml('#pageSearchButton', `<i class="fas fa-search mr-2"></i>${dict.search_btn || t('search_btn')}`);
    setText('#priceBtn span', dict.choose_price);
    setPlaceholder('#minPrice', dict.min_price);
    setPlaceholder('#maxPrice', dict.max_price);
    setText('#applyPrice', dict.apply_price);
    setText('#homePopularSearchesLabel', dict.popular_searches);
    setPlaceholder('#newsletterEmail', dict.newsletter_email_placeholder);
    setSelectOptions('propertyType', dict.option_property_types);
    setSelectOptions('roomCount', dict.option_room_count);
    setSelectOptions('livingArea', dict.option_living_area);
    setHtml('#homeFeaturedTitle', dict.home_featured_title, 'home_featured_title');
    setText('#homeFeaturedBtn', dict.home_featured_btn);
    setText('#homeAboutKicker', dict.home_about_kicker);
    setHtml('#homeAboutTitle', dict.home_about_title, 'home_about_title');
    setText('#homeAboutDesc', dict.home_about_desc);
    setText('#homeAboutService1', dict.home_about_service_1);
    setText('#homeAboutService2', dict.home_about_service_2);
    setText('#homeAboutBtn', dict.home_about_btn);
    setText('#homeQuoteText', dict.home_quote_text);
    setText('#homeQuoteAuthor', dict.home_quote_author);
    setHtml('#homeAreasTitle', dict.home_areas_title, 'home_areas_title');
    setText('#homeAreasBtn', dict.home_areas_btn);
    setText('#homeArea1Title', dict.home_area_1_title);
    setText('#homeArea2Title', dict.home_area_2_title);
    setText('#homeArea3Title', dict.home_area_3_title);
    setText('#homeArea1Count', dict.home_area_1_count);
    setText('#homeArea2Count', dict.home_area_2_count);
    setText('#homeArea3Count', dict.home_area_3_count);
    setText('#homePopularSearch1', dict.home_popular_search_1);
    setText('#homePopularSearch2', dict.home_popular_search_2);
    setText('#homePopularSearch3', dict.home_popular_search_3);
    setText('#homePopularSearch4', dict.home_popular_search_4);
    setText('#homePopularSearch5', dict.home_popular_search_5);
    setText('#homePopularSearch6', dict.home_popular_search_6);
    setText('#homeNewsletterTitle', dict.home_newsletter_title);
    setText('#homeNewsletterDesc', dict.home_newsletter_desc);
    setText('#homeNewsletterBtn', dict.home_newsletter_btn);
  }

  function applyProperties(dict) {
    if (!location.pathname.endsWith('/properties.html')) return;
    setTitle(dict.title_properties);
    setHtml('#propertiesHeroTitle', dict.properties_hero_title, 'properties_hero_title');
    setText('#propertiesHeroDesc', dict.properties_hero_desc);
    setPlaceholder('#searchInput', dict.search_placeholder);
    setHtml('#pageSearchButton', `<i class="fas fa-search mr-2"></i>${dict.search_btn || t('search_btn')}`);
    setText('#priceBtn span', dict.choose_price);
    setPlaceholder('#minPrice', dict.min_price);
    setPlaceholder('#maxPrice', dict.max_price);
    setText('#applyPrice', dict.apply_price);
    setSelectOptions('propertyType', dict.option_property_types);
    setSelectOptions('roomCount', dict.option_room_count);
    setSelectOptions('livingArea', dict.option_living_area);
    setSelectOptions('propertiesSort', dict.option_sorting);
  }

  function applySearch(dict) {
    if (!location.pathname.endsWith('/search.html')) return;
    setTitle(dict.title_search);
    setText('main h1', dict.search_results_title);
    const p = document.querySelector('main p.text-white\\/60');
    if (p) {
      p.textContent = '';
      p.append(document.createTextNode(`${t('search_results_for', 'Resultat för:')} `));
      const span = document.createElement('span');
      span.id = 'searchTerm';
      span.className = 'text-[#e2ff31]';
      span.textContent = document.getElementById('searchTerm')?.textContent || t('search_all_properties', 'alla objekt');
      p.appendChild(span);
    }
  }

  function applyPropertyModal(dict) {
    if (!location.pathname.endsWith('/property-modal.html')) return;
    setTitle(dict.title_property_details);
    setText('.back-button span', dict.back_to_results);
    setText('.description-section h2', dict.about_property);
    setText('.floorplan-section h2', dict.floor_plan);
    setText('.similar-section h2', dict.similar_properties);
    setText('.btn-call', dict.call_btn);
    setText('.btn-email', dict.email_btn);
  }

  function applyContact(dict) {
    if (!location.pathname.endsWith('/contact.html')) return;
    setTitle(dict.title_contact);
    setHtml('#contactHeroTitle', dict.contact_hero_title, 'contact_hero_title');
    setText('#contactHeroDesc', dict.contact_hero_desc);
    setText('#contactDetailsTitle', dict.contact_details_title);
    setText('#contactVisitTitle', dict.contact_visit_title);
    setText('#contactCallTitle', dict.contact_call_title);
    setText('#contactEmailTitle', dict.contact_email_title);
    setText('#contactReplyText', dict.contact_reply_24h);
    setText('#contactFollowTitle', dict.follow_us);
    setText('#contactSendTitle', dict.contact_send_title);
    setHtml('#contactSendBtn', `${dict.contact_send_btn || t('contact_send_btn')} <i class="fas fa-paper-plane ml-2"></i>`);
    setPlaceholder('#firstName', dict.field_first_name);
    setPlaceholder('#lastName', dict.field_last_name);
    setPlaceholder('#contactEmail', dict.field_email);
    setPlaceholder('#phone', dict.field_phone_optional);
    setPlaceholder('#message', dict.field_message);
    setSelectOptions('contactSubject', dict.option_contact_subjects);
  }

  function applyAbout(dict) {
    if (!location.pathname.endsWith('/about.html')) return;
    setTitle(dict.title_about);
    setHtml('#aboutHeroBadge', `<i class="fas fa-star mr-2 text-xs"></i>${dict.about_hero_badge || t('about_hero_badge')}`);
    setHtml('#aboutHeroTitle', dict.about_hero_title, 'about_hero_title');
    setText('#aboutHeroDesc', dict.about_hero_desc);
    setText('#aboutStatSold', dict.about_stat_sold);
    setText('#aboutStatExperience', dict.about_stat_experience);
    setText('#aboutStatHappy', dict.about_stat_happy);
    setText('#aboutQuoteText', dict.about_quote_text);
    setText('#aboutQuoteAuthor', dict.about_quote_author);
    setHtml('#aboutValuesTitle', dict.about_values_title, 'about_values_title');
    setText('#aboutValue1Title', dict.about_value_1_title);
    setText('#aboutValue1Desc', dict.about_value_1_desc);
    setText('#aboutValue2Title', dict.about_value_2_title);
    setText('#aboutValue2Desc', dict.about_value_2_desc);
    setText('#aboutValue3Title', dict.about_value_3_title);
    setText('#aboutValue3Desc', dict.about_value_3_desc);
    setHtml('#aboutAgentsTitle', dict.about_agents_title, 'about_agents_title');
    setText('#aboutHow1Title', dict.about_how_1_title);
    setText('#aboutHow1Desc', dict.about_how_1_desc);
    setText('#aboutHow2Title', dict.about_how_2_title);
    setText('#aboutHow2Desc', dict.about_how_2_desc);
    setText('#aboutHow3Title', dict.about_how_3_title);
    setText('#aboutHow3Desc', dict.about_how_3_desc);
  }

  function applyAuth(dict) {
    if (!location.pathname.includes('/templates/auth/') && !location.pathname.includes('/templates/mobile/auth/')) return;
    setText('a[href*="home.html"]', dict.auth_back);

    if (location.pathname.endsWith('/login.html')) {
      setTitle(dict.title_login);
      setText('h1.text-2xl', dict.login_welcome_back);
      setText('p.text-white\\/40.text-sm.mt-2', dict.login_modal_subtitle);
      setPlaceholder('#loginEmail', dict.field_email);
      setPlaceholder('#loginPassword', dict.field_password);
      setText('button[type="submit"]', dict.login_btn);
      setText('a[href*="forgot_password"]', dict.forgot_password);
      setText('#loginRememberMe', dict.auth_remember_me);
      setText('#loginNoAccountText', dict.auth_no_account);
      setText('a[href*="register"]', dict.register_link);
    }

    if (location.pathname.endsWith('/register.html')) {
      setTitle(dict.title_register);
      setText('h1.text-2xl', dict.auth_register_title);
      setText('p.text-white\\/40.text-sm.mt-2', dict.auth_register_subtitle);
      setPlaceholder('#firstName', dict.field_first_name);
      setPlaceholder('#lastName', dict.field_last_name);
      setPlaceholder('#registerEmail', dict.field_email);
      setPlaceholder('#phone', dict.auth_phone);
      setPlaceholder('#registerPassword', dict.field_password);
      setPlaceholder('#confirmPassword', dict.auth_confirm_password);
      setText('button[type="submit"]', dict.auth_create_account);
      setHtml('#registerTermsText', dict.auth_terms_html, 'auth_terms_html');
      setText('#registerHasAccountText', dict.auth_already_have_account);
      setText('a[href*="login.html"]', dict.login_btn);
    }

    if (location.pathname.endsWith('/forgot_password.html')) {
      setTitle(dict.title_forgot_password);
      setText('h1.text-2xl', dict.auth_forgot_title);
      setText('p.text-white\\/40.text-sm.mt-2', dict.auth_forgot_subtitle);
      setPlaceholder('#forgotEmail', dict.field_email);
      setText('button[type="submit"]', dict.auth_send_reset_link);
    }

    if (location.pathname.endsWith('/reset_password.html')) {
      setTitle(dict.title_reset_password);
      setText('h1.text-2xl', dict.auth_reset_title);
      setText('p.text-white\\/40.text-sm.mt-2', dict.auth_reset_subtitle);
      setPlaceholder('#newPassword', dict.auth_new_password);
      setPlaceholder('#confirmPassword', dict.auth_confirm_password);
      setText('button[type="submit"]', dict.auth_save_new_password);
    }
  }

  function applyAreas(dict) {
    if (!location.pathname.endsWith('/areas.html')) return;
    setTitle(dict.title_areas);
    setHtml('#areasHeroTitle', dict.areas_hero_title, 'areas_hero_title');
    setText('#areasHeroDesc', dict.areas_hero_desc);

    setText('#areasCard1Desc', dict.areas_card_1_desc);
    setText('#areasCard1Title', dict.areas_card_1_title);
    setText('#areasCard1Count', dict.areas_card_1_count);
    setText('#areasCard1From', dict.areas_card_1_from);
    setText('#areasCard2Desc', dict.areas_card_2_desc);
    setText('#areasCard2Title', dict.areas_card_2_title);
    setText('#areasCard2Count', dict.areas_card_2_count);
    setText('#areasCard2From', dict.areas_card_2_from);
    setText('#areasCard3Desc', dict.areas_card_3_desc);
    setText('#areasCard3Title', dict.areas_card_3_title);
    setText('#areasCard3Count', dict.areas_card_3_count);
    setText('#areasCard3From', dict.areas_card_3_from);
    setText('#areasCard4Desc', dict.areas_card_4_desc);
    setText('#areasCard4Title', dict.areas_card_4_title);
    setText('#areasCard4Count', dict.areas_card_4_count);
    setText('#areasCard4From', dict.areas_card_4_from);
    setText('#areasCard5Desc', dict.areas_card_5_desc);
    setText('#areasCard5Title', dict.areas_card_5_title);
    setText('#areasCard5Count', dict.areas_card_5_count);
    setText('#areasCard5From', dict.areas_card_5_from);
    setText('#areasCard6Desc', dict.areas_card_6_desc);
    setText('#areasCard6Title', dict.areas_card_6_title);
    setText('#areasCard6Count', dict.areas_card_6_count);
    setText('#areasCard6From', dict.areas_card_6_from);

    setHtml('#areasGuideTitle', dict.areas_guide_title, 'areas_guide_title');
    setText('#areasGuideItem1Title', dict.areas_guide_1_title);
    setText('#areasGuideItem1Desc', dict.areas_guide_1_desc);
    setText('#areasGuideItem2Title', dict.areas_guide_2_title);
    setText('#areasGuideItem2Desc', dict.areas_guide_2_desc);
    setText('#areasGuideItem3Title', dict.areas_guide_3_title);
    setText('#areasGuideItem3Desc', dict.areas_guide_3_desc);
    setText('#areasGuideItem4Title', dict.areas_guide_4_title);
    setText('#areasGuideItem4Desc', dict.areas_guide_4_desc);
    setHtml('#areasMapTitle', dict.areas_map_title, 'areas_map_title');
  }

  function applyFaq(dict) {
    if (!location.pathname.endsWith('/faq.html')) return;
    setTitle(dict.title_faq);
    setText('main h1', dict.faq_title);
  }

  function applyBackoffice(dict) {
    const path = location.pathname;
    const mobileAwarePath = path.startsWith('/templates/mobile/')
      ? path.replace('/templates/mobile/', '/templates/')
      : path;

    const titleMap = {
      '/templates/user/dashboard.html': 'title_user_dashboard',
      '/templates/user/favorites.html': 'title_user_favorites',
      '/templates/user/my_listings.html': 'title_user_my_listings',
      '/templates/user/messages.html': 'title_user_messages',
      '/templates/user/profile_settings.html': 'title_user_profile_settings',
      '/templates/user/bookings.html': 'title_user_bookings',
      '/templates/user/saved-searches.html': 'title_user_saved_searches',
      '/templates/user/create_listing/step1_listing_info.html': 'title_user_create_listing_step1',
      '/templates/user/create_listing/step2_media.html': 'title_user_create_listing_step2',
      '/templates/user/create_listing/step3_preview_submit.html': 'title_user_create_listing_step3',
      '/templates/user/create_listing/submitted_success.html': 'title_user_create_listing_submitted',
      '/templates/admin/dashboard.html': 'title_admin_dashboard',
      '/templates/admin/properties.html': 'title_admin_properties',
      '/templates/admin/users.html': 'title_admin_users',
      '/templates/admin/review_queue.html': 'title_admin_review_queue',
      '/templates/admin/messages.html': 'title_admin_messages',
      '/templates/admin/settings.html': 'title_admin_settings',
    };

    const mappedTitleKey = titleMap[mobileAwarePath];
    if (mappedTitleKey && dict[mappedTitleKey]) setTitle(dict[mappedTitleKey]);

    setHtml('#userFavoritesTitle', dict.user_favorites_title, 'user_favorites_title');
    setText('#userFavoritesSortLatest', dict.user_sort_latest_saved);
    setText('#userFavoritesClearAllText', dict.user_clear_all);

    setHtml('#userMyListingsTitle', dict.user_my_listings_title, 'user_my_listings_title');
    setText('#userMyListingsDesc', dict.user_manage_published_listings);
    setHtml('#userMyListingsCreateBtn', `<i class="fas fa-plus-circle mr-2"></i>${dict.user_create_new_listing || t('user_create_new_listing')}`);

    setHtml('#userProfileTitle', dict.user_profile_settings_title, 'user_profile_settings_title');
    setText('#userProfileDesc', dict.user_profile_settings_desc);
    setText('#userProfileChangePhotoBtn', dict.user_change_profile_photo);
  }

  async function refresh(langOverride) {
    try {
      const lang = normalizeLang(langOverride || getLang() || DEFAULT_LANG);
      const dict = await loadDictionary(lang);
      currentDict = dict || {};
      applyDocumentDirection(lang);
      ensureRtlStyles();
      applyCommon(dict);
      applyHome(dict);
      applyProperties(dict);
      applySearch(dict);
      applyPropertyModal(dict);
      applyContact(dict);
      applyAbout(dict);
      applyAreas(dict);
      applyFaq(dict);
      applyAuth(dict);
      applyBackoffice(dict);
      applyDataI18n(dict);
      const replacements = dict.text_replacements || {};
      replaceTextNodes(replacements);
      ensureLiveTranslation(replacements);
      window.dispatchEvent(new CustomEvent('rimalis:i18n-applied', { detail: { lang } }));
      return true;
    } catch (_err) {
      // no-op
      return false;
    }
  }

  async function setLanguage(nextLang, options = {}) {
    const lang = normalizeLang(nextLang);
    const shouldDispatch = options.dispatchEvent !== false;
    showLanguageSwitchOverlay(lang);
    localStorage.setItem(LANGUAGE_KEY, lang);
    const ok = await refresh(lang);
    if (shouldDispatch) {
      window.dispatchEvent(new CustomEvent('rimalis:language-changed', { detail: { lang, source: 'i18n' } }));
    }
    hideLanguageSwitchOverlay();
    return ok;
  }

  async function init() {
    await refresh();
  }

  window.RimalisI18n = { t, getLang, refresh, setLanguage, formatNumber, formatCurrencySEK, formatDate, formatDateTime, localeFor };

  window.addEventListener('rimalis:language-changed', async (event) => {
    const lang = event?.detail?.lang;
    if (event?.detail?.source === 'i18n') return;
    await setLanguage(lang, { dispatchEvent: false });
  });

  window.addEventListener('storage', async (event) => {
    if (event.key !== LANGUAGE_KEY) return;
    const incoming = normalizeLang(event.newValue || DEFAULT_LANG);
    if (incoming === getLang()) return;
    await setLanguage(incoming, { dispatchEvent: true });
  });

  document.addEventListener('DOMContentLoaded', init);
})();
