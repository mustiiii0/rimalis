// ===== Rimalis Group - HUVUD-JAVASCRIPT =====

// Hårdkodade bild-URLs (ersätter behovet av lokala bilder)
const IMAGES = {
    // Hero bilder
    hero: {
        bg: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=90&w=2400',
        about: 'https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&q=80&w=1000'
    },
    
    // Property bilder
    properties: {
        'glass-house': {
            main: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=1000',
            gallery: [
                'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&q=80&w=800',
                'https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&q=80&w=800',
                'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&q=80&w=800'
            ]
        },
        penthouse: {
            main: 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&q=80&w=1000',
            gallery: [
                'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&q=80&w=800',
                'https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&q=80&w=800',
                'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&q=80&w=800'
            ]
        },
        'lake-house': {
            main: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&q=80&w=1000',
            gallery: [
                'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&q=80&w=800',
                'https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&q=80&w=800',
                'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&q=80&w=800'
            ]
        }
    },
    
    // Områdesbilder
    areas: {
        damascus: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=800',
        aleppo: 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&q=80&w=800',
        homs: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&q=80&w=800',
        latakia: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&q=80&w=800',
        hama: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&q=80&w=800'
    },
    
    // Agentbilder
    agents: {
        'erik-lindgren': 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=400',
        'anna-nilsson': 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400',
        'placeholder': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400'
    }
};

// Initiera alla moduler när DOM är laddad
function safeInit(fn) {
    try {
        fn();
    } catch (err) {
        console.error('Init error:', err);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    safeInit(initNavigation);
    safeInit(initFavorites);
    safeInit(initChat);
    safeInit(initFilters);
    safeInit(initModals);
    safeInit(initImageLoading);
    safeInit(initKeyboardSupport);
    safeInit(initPropertyCards);
    safeInit(initLiveNotifications);
});

// ===== NAVIGATION =====
function initNavigation() {
    const nav = document.getElementById('mainNav');
    
    window.addEventListener('scroll', function() {
        if (nav) {
            if (window.scrollY > 50) {
                nav.classList.add('glass-dark', 'py-3');
                nav.classList.remove('py-5');
            } else {
                nav.classList.remove('glass-dark', 'py-3');
                nav.classList.add('py-5');
            }
        }
    });
}

// ===== PROPERTY CARDS =====
function initPropertyCards() {
    // Data on cards should come from API/template rendering.
    // Keep existing image sources as-is to avoid overriding real listing images.
}

// ===== BILDOPTIMERING =====
function initImageLoading() {
    document.querySelectorAll('img').forEach(img => {
        if (img.complete) {
            img.classList.add('loaded');
        } else {
            img.addEventListener('load', function() {
                this.classList.add('loaded');
            });
        }
    });
}

// ===== KEYBOARD SUPPORT =====
function initKeyboardSupport() {
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });
}

// ===== STÄNG ALLA MODAL =====
function closeAllModals() {
    const loginModal = document.getElementById('loginModal');
    const mobileMenu = document.getElementById('mobileMenu');
    const chatBox = document.getElementById('chatBox');
    const chatWidget = document.querySelector('.chat-widget');
    const pricePanel = document.getElementById('pricePanel');
    
    if (loginModal) loginModal.classList.remove('active');
    if (mobileMenu) mobileMenu.classList.remove('active');
    if (chatBox) chatBox.classList.remove('active');
    if (chatWidget) chatWidget.classList.remove('open');
    if (pricePanel) pricePanel.classList.remove('active');
    
    document.body.style.overflow = 'auto';
}

// ===== HJÄLPFUNKTIONER =====
function formatPrice(price) {
    return window.RimalisI18n?.formatCurrencySEK?.(price, { compact: false }) || `${price}`;
}

function formatNumber(num) {
    return window.RimalisI18n?.formatNumber?.(num) || `${num}`;
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function showNotification(message, type = 'info') {
    const colors = {
        success: 'border-green-500',
        error: 'border-red-500',
        info: 'border-[#e2ff31]'
    };
    
    const notification = document.createElement('div');
    notification.className = `fixed top-24 right-6 z-50 px-6 py-4 rounded-2xl glass-dark border-l-4 ${colors[type]} animate-slideUp`;
    notification.textContent = String(message || '');
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// ===== LIVE NOTIFICATIONS (IN-APP PUSH STYLE) =====
let notificationPollTimer = null;
let hasNotificationPrimed = false;
const seenNotificationIds = new Set();

function initLiveNotifications() {
    if (!window.RimalisAPI?.getUser || !window.RimalisAPI?.request) return;
    if (!window.RimalisAPI.getAccessToken?.()) return;
    const user = window.RimalisAPI.getUser();
    if (!user || !user.id) return;

    const poll = async () => {
        try {
            const body = await window.RimalisAPI.request('/notifications/me?limit=20', { auth: true, optionalAuth: true });
            const list = Array.isArray(body.notifications) ? body.notifications : [];
            const unreadCount = Number(body.unreadCount || 0);

            if (!hasNotificationPrimed) {
                list.forEach((n) => seenNotificationIds.add(n.id));
                hasNotificationPrimed = true;
            } else {
                list.forEach((n) => {
                    if (!seenNotificationIds.has(n.id) && !n.isRead) {
                        showNotification(`${n.title}: ${n.body}`, 'info');
                    }
                    seenNotificationIds.add(n.id);
                });
            }

            window.dispatchEvent(new CustomEvent('rimalis:notifications-updated', {
                detail: { unreadCount, notifications: list },
            }));
        } catch (_err) {
            // silent background polling
        }
    };

    poll();
    if (notificationPollTimer) clearInterval(notificationPollTimer);
    notificationPollTimer = setInterval(poll, 30000);
}
