// ===== MODAL HANTERING =====

let activeModal = null;

function i18n(key) {
    return window.RimalisI18n?.t?.(key, key) || key;
}

function initModals() {
    bindModalActionHooks();
    initLoginModal();
    initMobileMenu();
    initPropertyModal();
}

// ===== LOGIN MODAL =====
function initLoginModal() {
    const loginModal = document.getElementById('loginModal');
    const loginForm = document.getElementById('loginForm');
    
    if (!loginModal) return;
    
    // Stäng vid klick utanför
    window.addEventListener('click', function(event) {
        if (event.target === loginModal) {
            closeLogin();
        }
    });
    
    // Hantera login form
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleLogin();
        });
    }
}

function openLogin() {
    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
        loginModal.classList.add('active');
        document.body.classList.add('rimalis-lock-scroll');
        activeModal = loginModal;
    }
}

function closeLogin() {
    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
        loginModal.classList.remove('active');
        document.body.classList.remove('rimalis-lock-scroll');
        activeModal = null;
    }
}

function bindModalActionHooks() {
    document.querySelectorAll('[data-close-login]').forEach((el) => {
        if (el.dataset.modalActionBound === '1') return;
        el.dataset.modalActionBound = '1';
        el.addEventListener('click', (event) => {
            event.preventDefault();
            closeLogin();
        });
    });

    document.querySelectorAll('[data-close-mobile-menu]').forEach((el) => {
        if (el.dataset.mobileMenuBound === '1') return;
        el.dataset.mobileMenuBound = '1';
        el.addEventListener('click', () => {
            closeMobileMenu();
        });
    });

    document.querySelectorAll('[data-nav-target]').forEach((el) => {
        if (el.dataset.navTargetBound === '1') return;
        el.dataset.navTargetBound = '1';
        const href = el.getAttribute('data-nav-target') || '';
        if (!href) return;
        el.addEventListener('click', (event) => {
            if (el.tagName !== 'A') {
                event.preventDefault();
            }
            window.location.href = href;
        });
    });

    document.querySelectorAll('[data-logout-trigger]').forEach((el) => {
        if (el.dataset.logoutBound === '1') return;
        el.dataset.logoutBound = '1';
        el.addEventListener('click', (event) => {
            event.preventDefault();
            if (typeof window.logout === 'function') window.logout();
        });
    });

    document.querySelectorAll('[data-history-back]').forEach((el) => {
        if (el.dataset.historyBackBound === '1') return;
        el.dataset.historyBackBound = '1';
        el.addEventListener('click', (event) => {
            event.preventDefault();
            window.history.back();
        });
    });

    document.querySelectorAll('[data-click-target]').forEach((el) => {
        if (el.dataset.clickTargetBound === '1') return;
        el.dataset.clickTargetBound = '1';
        el.addEventListener('click', (event) => {
            event.preventDefault();
            const target = document.getElementById(el.getAttribute('data-click-target') || '');
            target?.click();
        });
    });

    document.querySelectorAll('[data-clear-favorites]').forEach((el) => {
        if (el.dataset.clearFavoritesBound === '1') return;
        el.dataset.clearFavoritesBound = '1';
        el.addEventListener('click', (event) => {
            event.preventDefault();
            if (typeof window.clearAllFavorites === 'function') window.clearAllFavorites();
        });
    });

    document.querySelectorAll('[data-call-fn]').forEach((el) => {
        if (el.dataset.callFnBound === '1') return;
        el.dataset.callFnBound = '1';
        el.addEventListener('click', (event) => {
            event.preventDefault();
            const fnName = el.getAttribute('data-call-fn') || '';
            const target = window[fnName];
            if (typeof target !== 'function') return;
            const rawArgs = el.getAttribute('data-call-args');
            if (rawArgs == null || rawArgs === '') {
                target();
                return;
            }
            const args = rawArgs.split('|').map((value) => {
                if (value === 'true') return true;
                if (value === 'false') return false;
                if (value === 'null') return null;
                return value;
            });
            target(...args);
        });
    });
}

async function handleLogin() {
    const email = document.getElementById('loginEmail')?.value;
    const password = document.getElementById('loginPassword')?.value;
    
    if (!email || !password) {
        showNotification(i18n('modal_fill_email_password'), 'error');
        return;
    }
    
    if (!validateEmail(email)) {
        showNotification(i18n('newsletter_invalid_email'), 'error');
        return;
    }
    
    if (!window.RimalisAPI) {
        showNotification(i18n('api_client_reload_required'), 'error');
        return;
    }

    try {
        const body = await window.RimalisAPI.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });

        window.RimalisAPI.setSession(body);
        showNotification(i18n('modal_welcome_back'), 'success');
        closeLogin();

        const redirect = body.user?.role === 'admin'
            ? '../admin/dashboard.html'
            : '../user/dashboard.html';

        window.setTimeout(() => {
            window.location.href = redirect;
        }, 250);
    } catch (err) {
        showNotification(err.message || i18n('modal_invalid_credentials'), 'error');
    }
}

// ===== MOBIL MENY =====
function initMobileMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    
    if (!mobileMenu) return;
    
    // Stäng vid klick utanför
    window.addEventListener('click', function(event) {
        if (event.target === mobileMenu) {
            closeMobileMenu();
        }
    });
}

function openMobileMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenu) {
        mobileMenu.classList.add('active');
        document.body.classList.add('rimalis-lock-scroll');
        activeModal = mobileMenu;
    }
}

function closeMobileMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenu) {
        mobileMenu.classList.remove('active');
        document.body.classList.remove('rimalis-lock-scroll');
        activeModal = null;
    }
}

// ===== PROPERTY MODAL =====
function initPropertyModal() {
    // Lyssna efter klick på property cards
    document.querySelectorAll('.prop-card').forEach(card => {
        // Sidor med inline onclick hanterar redan navigering själva.
        if (card.hasAttribute('onclick')) return;

        card.addEventListener('click', function(e) {
            // Ignorera om man klickar på favorite-btn
            if (e.target.closest('.favorite-btn')) return;
            
            const propertyId = this.dataset.property;
            if (!propertyId) return;
            openProperty(propertyId);
        });
    });
}

function openProperty(propertyId) {
    // Bygg korrekt länk oavsett om vi är i /public, /user eller /admin.
    let target = 'property-modal.html';
    const path = window.location.pathname;
    const isMobile = path.includes('/templates/mobile/');

    if (path.includes('/templates/user/') || path.includes('/templates/mobile/user/')) {
        target = isMobile ? '/templates/mobile/public/property-modal.html' : '../public/property-modal.html';
    } else if (path.includes('/templates/admin/')) {
        target = '../public/property-modal.html';
    } else if (isMobile && path.includes('/templates/mobile/public/')) {
        target = '/templates/mobile/public/property-modal.html';
    }

    window.location.href = `${target}?id=${encodeURIComponent(propertyId)}`;
}

// ===== PROPERTY DATA (API-driven) =====
async function getPropertyData(propertyId) {
    if (!window.RimalisAPI) return null;

    try {
        const body = await window.RimalisAPI.request(`/properties/${propertyId}`);
        return body.property || null;
    } catch (_err) {
        return null;
    }
}
