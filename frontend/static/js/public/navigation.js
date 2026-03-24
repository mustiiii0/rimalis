// ===== NAVIGATION MELLAN SIDOR =====

const INSTAGRAM_URL = 'https://www.instagram.com/rimalisgroup/';
const LINKEDIN_URL = 'https://www.linkedin.com/company/rimalis-group/';
const FACEBOOK_URL = 'https://www.facebook.com/rimalisgroup/';
const USER_KEY = 'rimalis_user';
const LEGACY_USER_KEY = 'rimalis_user';
const NEWSLETTER_KEY = 'rimalis_newsletter';
const LEGACY_NEWSLETTER_KEY = 'rimalisNewsletter';
const LANGUAGE_KEY = 'rimalis_language';

const LANGUAGE_META = {
    sv: { flag: '🇸🇪', labelKey: 'language_swedish', fallback: 'Svenska' },
    en: { flag: '🇬🇧', labelKey: 'language_english', fallback: 'English' },
    ar: { flag: '🇸🇦', labelKey: 'language_arabic', fallback: 'العربية' },
};

const FALLBACK_I18N = {};

function inMobileTemplates() {
    return (window.location.pathname || '').includes('/templates/mobile/');
}

function templatePath(section, file) {
    return `/templates/${inMobileTemplates() ? 'mobile/' : ''}${section}/${file}`;
}

const HOME_PATH = templatePath('public', 'home.html');
const PROPERTIES_PATH = templatePath('public', 'properties.html');
const AREAS_PATH = templatePath('public', 'areas.html');
const ABOUT_PATH = templatePath('public', 'about.html');
const CONTACT_PATH = templatePath('public', 'contact.html');
const FAQ_PATH = templatePath('public', 'faq.html');
const SERVICES_VALUATION_PATH = templatePath('public', 'services/valuation.html');
const SERVICES_SELL_PATH = templatePath('public', 'services/sell.html');
const SERVICES_BUY_PATH = templatePath('public', 'services/buy.html');
const SERVICES_INVEST_PATH = templatePath('public', 'services/invest.html');
const COMPANY_CAREERS_PATH = templatePath('public', 'company/careers.html');
const COMPANY_PRESS_PATH = templatePath('public', 'company/press.html');
const NOT_FOUND_PATH = templatePath('public', '404.html');
const PRIVACY_PATH = templatePath('legal', 'privacy.html');
const TERMS_PATH = templatePath('legal', 'terms.html');
const COOKIES_PATH = templatePath('legal', 'cookies.html');

let i18nData = { ...FALLBACK_I18N };
let siteControls = {
    maintenanceMode: false,
    maintenanceMessage: '',
    maintenanceStartsAt: null,
    maintenanceEndsAt: null,
    banner: { enabled: false, text: '', level: 'info' },
    abHome: { enabled: false, activeVariant: 'a' },
    sectionControls: {},
    contentBlocks: {},
    redirectRules: {},
    accessRules: {},
    previewAuthorized: false,
    pages: [],
};

const PUBLIC_PAGE_META = {
    home: { path: HOME_PATH, navKey: 'nav_home', defaultShowInNav: true },
    properties: { path: PROPERTIES_PATH, navKey: 'nav_properties', defaultShowInNav: true },
    areas: { path: AREAS_PATH, navKey: 'nav_areas', defaultShowInNav: true },
    about: { path: ABOUT_PATH, navKey: 'nav_about', defaultShowInNav: true },
    contact: { path: CONTACT_PATH, navKey: 'nav_contact', defaultShowInNav: true },
    faq: { path: FAQ_PATH, navKey: 'nav_faq', defaultShowInNav: false },
    valuation: { path: SERVICES_VALUATION_PATH, navKey: 'footer_valuation', defaultShowInNav: false },
    sell: { path: SERVICES_SELL_PATH, navKey: 'footer_sell', defaultShowInNav: false },
    buy: { path: SERVICES_BUY_PATH, navKey: 'footer_buy', defaultShowInNav: false },
    invest: { path: SERVICES_INVEST_PATH, navKey: 'footer_invest', defaultShowInNav: false },
    careers: { path: COMPANY_CAREERS_PATH, navKey: 'footer_career', defaultShowInNav: false },
    press: { path: COMPANY_PRESS_PATH, navKey: 'footer_press', defaultShowInNav: false },
    '404': { path: NOT_FOUND_PATH, navKey: 'public_page_unavailable_title', defaultShowInNav: false },
    privacy: { path: PRIVACY_PATH, navKey: 'footer_privacy', defaultShowInNav: false },
    terms: { path: TERMS_PATH, navKey: 'footer_terms', defaultShowInNav: false },
    cookies: { path: COOKIES_PATH, navKey: 'footer_cookies', defaultShowInNav: false },
};

const SECTION_SELECTOR_MAP = {
    home: {
        hero: '.hero-bg',
        search: '.hero-bg .glass-dark',
        featured: '#featuredPropertiesGrid',
        about: '#homeAboutTitle',
        areas: '#homeAreasTitle',
        chat: '.chat-widget',
    },
    properties: {
        hero: 'section.pt-32',
        grid: '#propertiesGrid',
        chat: '.chat-widget',
    },
    areas: {
        hero: 'section.pt-32',
        grid: 'main .grid',
        chat: '.chat-widget',
    },
};

if (typeof window.showNotification !== 'function') {
    window.showNotification = function showNotification(message, type = 'info') {
        const notice = document.createElement('div');
        notice.className = `fixed top-24 right-6 z-[1000] px-5 py-3 rounded-xl text-sm font-bold shadow-2xl border ${
            type === 'error'
                ? 'bg-red-500/20 border-red-400/40 text-red-100'
                : type === 'success'
                    ? 'bg-green-500/20 border-green-400/40 text-green-100'
                    : 'bg-black/80 border-white/15 text-white'
        }`;
        notice.textContent = String(message || '');
        document.body.appendChild(notice);
        setTimeout(() => notice.remove(), 2400);
    };
}

function getCurrentLanguage() {
    const saved = (localStorage.getItem(LANGUAGE_KEY) || 'sv').toLowerCase();
    return LANGUAGE_META[saved] ? saved : 'sv';
}

function t(key) {
    return i18nData[key] || window.RimalisI18n?.t?.(key, key) || key;
}

function languageLabel(lang) {
    const meta = LANGUAGE_META[lang] || LANGUAGE_META.sv;
    const translated = t(meta.labelKey);
    return translated && translated !== meta.labelKey ? translated : meta.fallback;
}

async function loadI18n(language) {
    const lang = LANGUAGE_META[language] ? language : 'sv';
    try {
        const response = await fetch(`/static/i18n/${lang}.json`, { cache: 'no-cache' });
        if (!response.ok) throw new Error(`i18n ${lang} not found`);
        const data = await response.json();
        i18nData = { ...FALLBACK_I18N, ...(data || {}) };
    } catch (_err) {
        i18nData = { ...FALLBACK_I18N };
    }
}

function getDefaultPageControls() {
    return Object.keys(PUBLIC_PAGE_META).map((slug) => ({
        slug,
        enabled: true,
        showInNav: Boolean(PUBLIC_PAGE_META[slug]?.defaultShowInNav),
        maintenanceMessage: '',
    }));
}

function normalizeControls(payload) {
    const defaults = getDefaultPageControls();
    const incomingPages = Array.isArray(payload?.pages) ? payload.pages : [];
    const map = new Map(incomingPages.map((p) => [String(p.slug || ''), p]));

    return {
        maintenanceMode: Boolean(payload?.maintenanceMode),
        maintenanceMessage: String(payload?.maintenanceMessage || ''),
        maintenanceStartsAt: payload?.maintenanceStartsAt || null,
        maintenanceEndsAt: payload?.maintenanceEndsAt || null,
        banner: {
            enabled: Boolean(payload?.banner?.enabled),
            text: String(payload?.banner?.text || ''),
            level: ['info', 'warning', 'success'].includes(payload?.banner?.level) ? payload.banner.level : 'info',
        },
        abHome: {
            enabled: Boolean(payload?.abHome?.enabled),
            activeVariant: payload?.abHome?.activeVariant === 'b' ? 'b' : 'a',
        },
        sectionControls: (payload?.sectionControls && typeof payload.sectionControls === 'object') ? payload.sectionControls : {},
        contentBlocks: (payload?.contentBlocks && typeof payload.contentBlocks === 'object') ? payload.contentBlocks : {},
        redirectRules: (payload?.redirectRules && typeof payload.redirectRules === 'object') ? payload.redirectRules : {},
        accessRules: (payload?.accessRules && typeof payload.accessRules === 'object') ? payload.accessRules : {},
        previewAuthorized: Boolean(payload?.previewAuthorized),
        pages: defaults.map((defaultPage) => {
            const incoming = map.get(defaultPage.slug);
            return {
                slug: defaultPage.slug,
                enabled: incoming?.enabled ?? defaultPage.enabled,
                showInNav: incoming?.showInNav ?? defaultPage.showInNav,
                maintenanceMessage: String(incoming?.maintenanceMessage || ''),
            };
        }),
    };
}

async function loadSiteControls() {
    try {
        const params = new URLSearchParams(window.location.search);
        const preview = params.get('preview') || '';
        const suffix = preview ? `?preview=${encodeURIComponent(preview)}` : '';
        const response = await fetch(`/api/public/site-controls${suffix}`, { cache: 'no-cache' });
        if (response.status === 304) return;
        if (!response.ok) throw new Error('Could not fetch site controls');
        const body = await response.json();
        siteControls = normalizeControls(body?.controls || {});
    } catch (_err) {
        siteControls = normalizeControls({});
    }
}

function nowTimestamp() {
    return Date.now();
}

function timestampOrNull(value) {
    if (!value) return null;
    const ts = Date.parse(value);
    return Number.isFinite(ts) ? ts : null;
}

function isMaintenanceWindowActive() {
    if (!siteControls.maintenanceMode) return false;
    const start = timestampOrNull(siteControls.maintenanceStartsAt);
    const end = timestampOrNull(siteControls.maintenanceEndsAt);
    const now = nowTimestamp();
    if (start && now < start) return false;
    if (end && now > end) return false;
    return true;
}

function getCurrentPublicSlug() {
    const path = window.location.pathname || '';
    const file = path.split('/').pop() || 'home.html';
    const slug = file.replace('.html', '').trim().toLowerCase();
    if (
        slug === 'home' ||
        slug === 'properties' ||
        slug === 'areas' ||
        slug === 'about' ||
        slug === 'contact' ||
        slug === 'faq' ||
        slug === 'valuation' ||
        slug === 'sell' ||
        slug === 'buy' ||
        slug === 'invest' ||
        slug === 'careers' ||
        slug === 'press' ||
        slug === '404' ||
        slug === 'privacy' ||
        slug === 'terms' ||
        slug === 'cookies'
    ) {
        return slug;
    }
    return null;
}

function getPageControl(slug) {
    return siteControls.pages.find((p) => p.slug === slug) || null;
}

function isPageEnabled(slug) {
    const page = getPageControl(slug);
    if (!page) return true;
    if (siteControls.previewAuthorized) return true;
    if (isMaintenanceWindowActive()) return false;
    return Boolean(page.enabled);
}

function getPageRedirect(slug) {
    const rule = siteControls.redirectRules?.[slug];
    if (!rule || typeof rule !== 'object') return '';
    if (!rule.enabled) return '';
    const to = String(rule.to || '').trim();
    return to || '';
}

function isAuthenticated() {
    try {
        const user = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
        const token = localStorage.getItem('rimalis_access_token') || '';
        return Boolean(token || (user && user.email));
    } catch (_err) {
        return Boolean(localStorage.getItem('rimalis_access_token'));
    }
}

function navPathForHomeFallback() {
    const firstEnabled = siteControls.pages.find((p) => p.enabled && PUBLIC_PAGE_META[p.slug]?.path);
    return firstEnabled ? PUBLIC_PAGE_META[firstEnabled.slug].path : HOME_PATH;
}

function renderUnavailablePage(message) {
    const finalMessage = String(message || siteControls.maintenanceMessage || t('public_page_unavailable_message'));
    const homePath = navPathForHomeFallback();
    document.body.textContent = '';
    const wrap = document.createElement('div');
    wrap.className = 'rimalis-unavailable-page';
    const article = document.createElement('article');
    article.className = 'rimalis-unavailable-page__card';
    const h1 = document.createElement('h1');
    h1.className = 'rimalis-unavailable-page__title';
    h1.textContent = t('public_page_unavailable_title');
    const p = document.createElement('p');
    p.className = 'rimalis-unavailable-page__text';
    p.textContent = finalMessage;
    const a = document.createElement('a');
    a.href = homePath;
    a.className = 'rimalis-unavailable-page__link';
    a.textContent = t('public_page_unavailable_back_home');
    article.append(h1, p, a);
    wrap.appendChild(article);
    document.body.appendChild(wrap);
}

function enforcePageAvailability() {
    const slug = getCurrentPublicSlug();
    if (!slug) return true;
    if (siteControls.previewAuthorized) return true;

    const accessRule = siteControls.accessRules?.[slug];
    if (accessRule === 'authenticated' && !isAuthenticated()) {
        window.RimalisAPI?.writeAuthDebug?.('public_access_redirect', {
            slug,
            target: templatePath('auth', 'login.html'),
            reason: 'page_requires_auth',
        });
        window.location.href = templatePath('auth', 'login.html');
        return false;
    }

    const redirectTo = getPageRedirect(slug);
    if (redirectTo) {
        window.location.href = redirectTo;
        return false;
    }

    if (isPageEnabled(slug)) return true;
    const page = getPageControl(slug);
    renderUnavailablePage(page?.maintenanceMessage || '');
    return false;
}

function renderGlobalBanner() {
    if (!siteControls.banner?.enabled || !siteControls.banner?.text) return;
    if (siteControls.previewAuthorized === false && !isPageEnabled(getCurrentPublicSlug() || 'home') && !isMaintenanceWindowActive()) return;

    const level = siteControls.banner.level || 'info';
    const colorMap = {
        info: 'background:#0e1a2a;border:1px solid rgba(147,197,253,.45);color:#dbeafe;',
        warning: 'background:#2a1a0e;border:1px solid rgba(251,191,36,.45);color:#fde68a;',
        success: 'background:#102215;border:1px solid rgba(74,222,128,.45);color:#dcfce7;',
    };
    const wrapper = document.createElement('div');
    wrapper.id = 'siteGlobalBanner';
    wrapper.style.cssText = `position:sticky;top:0;z-index:60;padding:10px 16px;text-align:center;font-weight:700;${colorMap[level] || colorMap.info}`;
    wrapper.textContent = siteControls.banner.text;
    document.body.prepend(wrapper);
}

function applySectionControls() {
    const slug = getCurrentPublicSlug();
    if (!slug) return;
    const pageConfig = siteControls.sectionControls?.[slug];
    if (!pageConfig || typeof pageConfig !== 'object') return;
    const selectorMap = SECTION_SELECTOR_MAP[slug] || {};

    Object.entries(pageConfig).forEach(([key, enabled]) => {
        const selector = selectorMap[key];
        if (!selector) return;
        document.querySelectorAll(selector).forEach((node) => {
            if (!(node instanceof HTMLElement)) return;
            node.classList.toggle('is-hidden-by-control', !enabled);
        });
    });
}

function applyContentBlocks() {
    Object.entries(siteControls.contentBlocks || {}).forEach(([key, value]) => {
        const text = String(value || '').trim();
        if (!text) return;
        const target = document.querySelector(`[data-site-content-key="${key}"]`) || document.getElementById(key);
        if (target) target.textContent = text;
    });
}

function applyHomeABTest() {
    const slug = getCurrentPublicSlug();
    if (slug !== 'home') return;
    if (!siteControls.abHome?.enabled) return;

    const variant = siteControls.abHome.activeVariant === 'b' ? 'b' : 'a';
    const line1 = siteControls.contentBlocks?.[`home.hero.line1.${variant}`];
    const line2 = siteControls.contentBlocks?.[`home.hero.line2.${variant}`];
    const desc = siteControls.contentBlocks?.[`home.hero.desc.${variant}`];
    if (line1) {
        const el = document.getElementById('homeHeroLine1');
        if (el) el.textContent = line1;
    }
    if (line2) {
        const el = document.getElementById('homeHeroLine2');
        if (el) el.textContent = line2;
    }
    if (desc) {
        const el = document.getElementById('homeHeroDescription');
        if (el) el.textContent = desc;
    }
}

function applyMobileMenuControls() {
    const slugByPath = {};
    Object.entries(PUBLIC_PAGE_META).forEach(([slug, meta]) => {
        if (!meta?.path) return;
        slugByPath[meta.path] = slug;
        slugByPath[meta.path.replace(inMobileTemplates() ? '/templates/mobile/public/' : '/templates/public/', '')] = slug;
    });

    document.querySelectorAll('.mobile-menu-links a[href]').forEach((anchor) => {
        const href = anchor.getAttribute('href') || '';
        const cleanHref = href.replace(/^\.\//, '').replace(/^\//, '');
        const normalized = href.startsWith('/') ? href : templatePath('public', cleanHref);
        const slug = slugByPath[normalized] || slugByPath[href] || null;
        if (!slug) return;

        const page = getPageControl(slug);
        if (page && (!page.enabled || !page.showInNav) && !siteControls.previewAuthorized) {
            anchor.classList.add('is-hidden-by-control');
        }
    });
}

function migrateLegacyStorageKeys() {
    const legacyUser = localStorage.getItem(LEGACY_USER_KEY);
    if (legacyUser && !localStorage.getItem(USER_KEY)) {
        localStorage.setItem(USER_KEY, legacyUser);
    }
    if (legacyUser) localStorage.removeItem(LEGACY_USER_KEY);

    const legacyNewsletter = localStorage.getItem(LEGACY_NEWSLETTER_KEY);
    if (legacyNewsletter && !localStorage.getItem(NEWSLETTER_KEY)) {
        localStorage.setItem(NEWSLETTER_KEY, legacyNewsletter);
    }
    if (legacyNewsletter) localStorage.removeItem(LEGACY_NEWSLETTER_KEY);
}

// Skapa gemensam navigation för alla sidor
function createNavigation() {
    // Hämta aktuell sida för att markera aktiv länk
    const currentPage = window.location.pathname.split('/').pop() || 'home.html';
    let currentUser = null;
    try {
        currentUser = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    } catch (_err) {
        currentUser = null;
    }
    const accountHref = currentUser
        ? (currentUser.role === 'admin' ? '/templates/admin/dashboard.html' : templatePath('user', 'dashboard.html'))
        : templatePath('auth', 'login.html');
    const accountLabel = currentUser ? t('nav_account') : t('nav_login');
    const currentLang = getCurrentLanguage();
    const langMeta = LANGUAGE_META[currentLang] || LANGUAGE_META.sv;

    const defaultPublicItems = [
        { slug: 'home', path: HOME_PATH, key: 'nav_home', fallback: 'Hem' },
        { slug: 'properties', path: PROPERTIES_PATH, key: 'nav_properties', fallback: 'Bostäder' },
        { slug: 'areas', path: AREAS_PATH, key: 'nav_areas', fallback: 'Områden' },
        { slug: 'about', path: ABOUT_PATH, key: 'nav_about', fallback: 'Om oss' },
        { slug: 'contact', path: CONTACT_PATH, key: 'nav_contact', fallback: 'Kontakt' },
    ];
    const configuredItemsRaw = window.RimalisMenuConfig?.getPublicMainItems?.() || defaultPublicItems;
    const configuredItems = configuredItemsRaw.map((item) => ({
        slug: item.key || item.slug,
        path: item.path,
        key: item.labelKey || item.key,
        fallback: item.fallback || '',
    }));
    const navItems = configuredItems.filter((item) => {
        const page = getPageControl(item.slug);
        if (!page) return true;
        return page.enabled && page.showInNav;
    });
    const isArabic = currentLang === 'ar';
    const orderedNavItems = isArabic ? [...navItems].reverse() : navItems;

    const navLinksHtml = orderedNavItems
        .map((item) => `<a href="${item.path}" class="text-base font-bold ${isArabic ? 'tracking-normal' : 'uppercase tracking-widest'} ${currentPage === `${item.slug}.html` ? 'text-[#e2ff31]' : 'text-white/70 hover:text-white'} transition-colors">${t(item.key) || item.fallback || item.key}</a>`)
        .join('');

    return `
        <header class="fixed top-0 left-0 right-0 z-40 px-6 lg:px-12 py-5 transition-all duration-300" id="mainNav">
            <div class="w-full nav-top-row flex justify-between items-center">
                <div class="flex items-center gap-3 nav-home-trigger" data-nav-home="${HOME_PATH}" style="cursor: pointer;">
                    <img src="/static/image/Rimalis-Group.png" alt="Rimalis Group" class="brand-logo brand-logo--nav">
                </div>

                <nav class="nav-primary-links hidden lg:flex items-center gap-12">
                    ${navLinksHtml}
                </nav>

                <div class="flex items-center gap-4 nav-actions">
                    <button data-account-href="${accountHref}" class="btn-outline hidden md:flex nav-account-trigger">
                        <i class="far fa-user"></i>
                        <span>${accountLabel}</span>
                    </button>

                    <div class="language-selector hidden md:block">
                        <button class="language-btn" id="languageBtn">
                            <span id="selectedLanguage"><span class="selected-language-flag">${langMeta.flag}</span><span class="selected-language-code">${currentLang.toUpperCase()}</span></span>
                            <i class="fas fa-chevron-down text-xs"></i>
                        </button>
                        <div class="language-dropdown" id="languageDropdown">
                            <div class="language-option ${currentLang === 'sv' ? 'active' : ''}" data-lang="sv" data-flag="🇸🇪">🇸🇪 ${languageLabel('sv')}</div>
                            <div class="language-option ${currentLang === 'en' ? 'active' : ''}" data-lang="en" data-flag="🇬🇧">🇬🇧 ${languageLabel('en')}</div>
                            <div class="language-option ${currentLang === 'ar' ? 'active' : ''}" data-lang="ar" data-flag="🇸🇦">🇸🇦 ${languageLabel('ar')}</div>
                        </div>
                    </div>
                    
                    <button class="mobile-menu-btn nav-mobile-trigger">
                        <i class="fas fa-bars"></i>
                    </button>
                </div>
            </div>
        </header>
    `;
}

// Skapa footer för alla sidor
function createFooter() {
    return `
        <footer class="bg-black border-t border-white/5 pt-20 pb-10 px-6 lg:px-12">
            <div class="max-w-[1600px] mx-auto">
                <div class="grid md:grid-cols-12 gap-12 mb-20">
                    <div class="md:col-span-4">
                        <div class="flex items-center gap-3 mb-6 nav-home-trigger" data-nav-home="${HOME_PATH}" style="cursor: pointer;">
                            <img src="/static/image/Rimalis-Group.png" alt="Rimalis Group" class="brand-logo brand-logo--footer">
                        </div>
                        <p class="text-white/40 leading-relaxed">
                            ${t('footer_desc')}
                        </p>
                    </div>

                    <div class="md:col-span-2">
                        <h6 class="font-black uppercase text-xs tracking-widest text-[#e2ff31] mb-6">${t('footer_services')}</h6>
                        <ul class="space-y-3 text-white/40">
                            <li><a href="${SERVICES_VALUATION_PATH}" class="hover:text-white transition">${t('footer_valuation')}</a></li>
                            <li><a href="${SERVICES_SELL_PATH}" class="hover:text-white transition">${t('footer_sell')}</a></li>
                            <li><a href="${SERVICES_BUY_PATH}" class="hover:text-white transition">${t('footer_buy')}</a></li>
                            <li><a href="${SERVICES_INVEST_PATH}" class="hover:text-white transition">${t('footer_invest')}</a></li>
                        </ul>
                    </div>

                    <div class="md:col-span-2">
                        <h6 class="font-black uppercase text-xs tracking-widest text-[#e2ff31] mb-6">${t('footer_about')}</h6>
                        <ul class="space-y-3 text-white/40">
                            <li><a href="${COMPANY_CAREERS_PATH}" class="hover:text-white transition">${t('footer_career')}</a></li>
                            <li><a href="${COMPANY_PRESS_PATH}" class="hover:text-white transition">${t('footer_press')}</a></li>
                            <li><a href="${CONTACT_PATH}" class="hover:text-white transition">${t('nav_contact')}</a></li>
                        </ul>
                    </div>

                    <div class="md:col-span-4">
                        <h6 class="font-black uppercase text-xs tracking-widest text-[#e2ff31] mb-6">${t('footer_contact')}</h6>
                        <p class="text-white/40 leading-relaxed">
                            Birger Jarlsgatan 18<br>
                            114 34 Stockholm<br>
                            08-123 456 78<br>
                            support@rimalis.se
                        </p>
                        <div class="flex gap-4 mt-6">
                            <a href="${INSTAGRAM_URL}" target="_blank" rel="noopener noreferrer" class="text-white/40 hover:text-[#e2ff31] transition"><i class="fab fa-instagram text-xl"></i></a>
                            <a href="${LINKEDIN_URL}" target="_blank" rel="noopener noreferrer" class="text-white/40 hover:text-[#e2ff31] transition"><i class="fab fa-linkedin-in text-xl"></i></a>
                            <a href="${FACEBOOK_URL}" target="_blank" rel="noopener noreferrer" class="text-white/40 hover:text-[#e2ff31] transition"><i class="fab fa-facebook-f text-xl"></i></a>
                        </div>
                    </div>
                </div>

                <div class="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center text-white/20 text-xs font-black uppercase tracking-widest">
                    <p>${t('footer_copyright')}</p>
                    <div class="flex gap-8 mt-4 md:mt-0">
                        <a href="${PRIVACY_PATH}" class="hover:text-white transition">${t('footer_privacy')}</a>
                        <a href="${TERMS_PATH}" class="hover:text-white transition">${t('footer_terms')}</a>
                        <a href="${COOKIES_PATH}" class="hover:text-white transition">${t('footer_cookies')}</a>
                    </div>
                </div>
            </div>
        </footer>
    `;
}

// ===== LANGUAGE SELECTOR =====
function setSelectedLanguageDisplay(container, lang) {
    if (!container || !lang || !LANGUAGE_META[lang]) return;
    container.textContent = '';
    const flag = document.createElement('span');
    flag.className = 'selected-language-flag';
    flag.textContent = LANGUAGE_META[lang].flag;
    const code = document.createElement('span');
    code.className = 'selected-language-code';
    code.textContent = lang.toUpperCase();
    container.append(flag, code);
}

function initLanguageSelector() {
    const languageBtn = document.getElementById('languageBtn');
    const languageDropdown = document.getElementById('languageDropdown');
    const languageOptions = document.querySelectorAll('.language-option');
    const selectedLanguage = document.getElementById('selectedLanguage') || document.getElementById('currentLanguage');
    const currentLang = getCurrentLanguage();

    if (!languageBtn) return;
    if (languageBtn.dataset.languageBound === '1') return;
    languageBtn.dataset.languageBound = '1';

    languageOptions.forEach((option) => {
        option.classList.toggle('active', option.dataset.lang === currentLang);
    });

    if (selectedLanguage) {
        setSelectedLanguageDisplay(selectedLanguage, currentLang);
    }

    languageBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (languageDropdown) languageDropdown.classList.toggle('active');
    });

    if (!document.body.dataset.languageOutsideBound) {
        document.body.dataset.languageOutsideBound = '1';
        document.addEventListener('click', () => {
            document.querySelectorAll('.language-dropdown.active').forEach((dropdown) => {
                dropdown.classList.remove('active');
            });
        });
    }

    if (languageDropdown) {
        if (languageDropdown.dataset.languageBound !== '1') {
            languageDropdown.dataset.languageBound = '1';
        }
        languageDropdown.addEventListener('click', (e) => e.stopPropagation());
    }

    languageOptions.forEach(option => {
        if (option.dataset.languageBound === '1') return;
        option.dataset.languageBound = '1';
        option.addEventListener('click', async (e) => {
            e.stopPropagation();
            const lang = option.dataset.lang;
            const flag = option.dataset.flag;
            if (!lang || !LANGUAGE_META[lang]) return;

            languageOptions.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');

            if (selectedLanguage) {
                setSelectedLanguageDisplay(selectedLanguage, lang);
            }

            if (languageDropdown) {
                languageDropdown.classList.remove('active');
            }

            languageBtn.disabled = true;
            languageBtn.classList.add('opacity-60', 'pointer-events-none');
            try {
                localStorage.setItem(LANGUAGE_KEY, lang);
                if (window.RimalisI18n?.setLanguage) {
                    await window.RimalisI18n.setLanguage(lang);
                } else if (window.RimalisI18n?.refresh) {
                    await window.RimalisI18n.refresh(lang);
                    window.dispatchEvent(new CustomEvent('rimalis:language-changed', { detail: { lang } }));
                }

                await loadI18n(lang);
                const navContainer = document.getElementById('nav-container');
                const footerContainer = document.getElementById('footer-container');
                if (navContainer) setContainerHtml(navContainer, createNavigation());
                if (footerContainer) setContainerHtml(footerContainer, createFooter());
                if (typeof initLanguageSelector === 'function') initLanguageSelector();
                bindDynamicNavActions();
                showNotification(`${t('lang_changed')}: ${option.textContent.trim()}`, 'success');
            } finally {
                languageBtn.disabled = false;
                languageBtn.classList.remove('opacity-60', 'pointer-events-none');
            }
        });
    });
}

function setContainerHtml(container, html) {
    if (!container) return;
    const frag = document.createRange().createContextualFragment(html);
    container.replaceChildren(frag);
}

function bindDynamicNavActions() {
    document.querySelectorAll('.nav-home-trigger[data-nav-home]').forEach((el) => {
        el.onclick = () => { window.location.href = el.getAttribute('data-nav-home') || HOME_PATH; };
    });
    document.querySelectorAll('.nav-account-trigger[data-account-href]').forEach((el) => {
        el.onclick = () => { window.location.href = el.getAttribute('data-account-href') || templatePath('auth', 'login.html'); };
    });
    document.querySelectorAll('.nav-mobile-trigger').forEach((el) => {
        el.onclick = () => { if (typeof openMobileMenu === 'function') openMobileMenu(); };
    });
}

// ===== NEWSLETTER FORM =====
function initNewsletter() {
    const newsletterForm = document.getElementById('newsletterForm');

    if (!newsletterForm) return;

    newsletterForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const email = document.getElementById('newsletterEmail')?.value;

        if (!email) {
            showNotification(t('newsletter_missing_email'), 'error');
            return;
        }

        if (!validateEmail(email)) {
            showNotification(t('newsletter_invalid_email'), 'error');
            return;
        }

        // Spara i localStorage
        const subscribers = JSON.parse(localStorage.getItem(NEWSLETTER_KEY) || '[]');
        if (!subscribers.includes(email)) {
            subscribers.push(email);
            localStorage.setItem(NEWSLETTER_KEY, JSON.stringify(subscribers));
        }

        showNotification(t('newsletter_success'), 'success');
        this.reset();
    });
}

// ===== IMAGE OPTIMIZATION =====
function optimizeImageElement(img) {
    if (!(img instanceof HTMLImageElement)) return;
    if (img.dataset.optimized === 'true') return;
    if (img.classList.contains('brand-logo')) return;
    if (img.closest('header, #mainNav, .mobile-menu-header')) return;

    img.decoding = 'async';

    // Lazy-load all non-critical images by default.
    if (!img.hasAttribute('loading') && img.dataset.eager !== 'true') {
        img.setAttribute('loading', 'lazy');
    }
    if (img.getAttribute('loading') === 'lazy' && !img.hasAttribute('fetchpriority')) {
        img.setAttribute('fetchpriority', 'low');
    }

    const src = img.getAttribute('src') || '';
    if (!src.includes('images.unsplash.com') || img.hasAttribute('srcset')) {
        img.dataset.optimized = 'true';
        return;
    }

    try {
        const base = new URL(src, window.location.origin);
        const widths = [480, 768, 1024, 1440, 1920];
        const srcset = widths.map((w) => {
            const u = new URL(base.toString());
            u.searchParams.set('w', String(w));
            if (!u.searchParams.get('auto')) u.searchParams.set('auto', 'format');
            if (!u.searchParams.get('fit')) u.searchParams.set('fit', 'crop');
            if (!u.searchParams.get('q')) u.searchParams.set('q', '80');
            return `${u.toString()} ${w}w`;
        }).join(', ');

        img.setAttribute('srcset', srcset);

        if (!img.hasAttribute('sizes')) {
            if (img.closest('.prop-card, .grid')) {
                img.setAttribute('sizes', '(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw');
            } else {
                img.setAttribute('sizes', '(max-width: 1024px) 100vw, 80vw');
            }
        }
    } catch (_err) {
        // ignore malformed urls
    }

    img.dataset.optimized = 'true';
}

function initResponsiveImages() {
    document.querySelectorAll('img').forEach(optimizeImageElement);

    if (window.__rimalisImageObserverInit) return;
    window.__rimalisImageObserverInit = true;

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (!(node instanceof HTMLElement)) return;
                if (node.tagName === 'IMG') {
                    optimizeImageElement(node);
                    return;
                }
                node.querySelectorAll?.('img').forEach(optimizeImageElement);
            });
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

// ===== SIDSPECIFIK INITIERING =====
async function initPage() {
    migrateLegacyStorageKeys();
    await loadI18n(getCurrentLanguage());
    await loadSiteControls();
    if (!enforcePageAvailability()) return;
    renderGlobalBanner();

    // Ladda navigation och footer om de finns som containers
    const navContainer = document.getElementById('nav-container');
    const footerContainer = document.getElementById('footer-container');

    if (navContainer && navContainer.children.length === 0) {
        setContainerHtml(navContainer, createNavigation());
    }

    if (footerContainer && footerContainer.children.length === 0) {
        setContainerHtml(footerContainer, createFooter());
    }

    applyContentBlocks();
    applyHomeABTest();
    applySectionControls();
    applyMobileMenuControls();

    // Initiera alla moduler (säker init per sida)
    if (typeof initFavorites === 'function') initFavorites();
    if (typeof initChat === 'function') initChat();
    if (typeof initFilters === 'function') initFilters();
    if (typeof initModals === 'function') initModals();
    if (typeof initLanguageSelector === 'function') initLanguageSelector();
    bindDynamicNavActions();
    if (typeof initNewsletter === 'function') initNewsletter();
    if (typeof initResponsiveImages === 'function') initResponsiveImages();
    if (typeof initImageLoading === 'function') initImageLoading();
    if (typeof initPropertyCards === 'function') initPropertyCards();
}

// Kör init när DOM är laddad
document.addEventListener('DOMContentLoaded', initPage);

// Lyssna på popstate (tillbaka-knapp i browser)
window.addEventListener('popstate', function () {
    if (typeof closeAllModals === 'function') closeAllModals();
});
