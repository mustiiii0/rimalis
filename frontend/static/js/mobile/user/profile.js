(function () {
  document.addEventListener('DOMContentLoaded', function () {
    document.body.classList.add('mobile-profile-js-ready');
    bindMobileSettingsSearch();
    bindMobileSettingsPanels();
    bindSettingsLanguageOptions();
    hydrateMobileProfileSummary();
    initMobileProfileForm();
    initMobilePasswordForm();
    initMobileNotificationToggles();
    bindAvatarModal();
    bindMobileProfileChrome();
    syncAvatarFallback();
  });

  function i18n(key, fallback) {
    return window.RimalisI18n?.t?.(key, fallback) || fallback;
  }

  function formatCount(value) {
    return window.RimalisI18n?.formatNumber?.(value) || String(value);
  }

  function bindMobileSettingsSearch() {
    const searchInput = document.getElementById('mobileSettingsSearch');
    if (!searchInput) return;

    searchInput.addEventListener('input', function () {
      const term = String(searchInput.value || '').trim().toLowerCase();
      document.querySelectorAll('.settings-card, .danger').forEach((card) => {
        const text = (card.textContent || '').toLowerCase();
        card.style.display = !term || text.includes(term) ? '' : 'none';
      });
    });
  }

  async function hydrateMobileProfileSummary() {
    if (!window.RimalisAPI?.request) return;

    try {
      const [userBody, favoritesBody, messagesBody, listingsBody, searchesBody] = await Promise.all([
        window.RimalisAPI.request('/users/me', { auth: true }),
        window.RimalisAPI.request('/favorites/me', { auth: true }),
        window.RimalisAPI.request('/messages/me', { auth: true }),
        window.RimalisAPI.request('/users/me/listings', { auth: true }),
        window.RimalisAPI.request('/users/me/saved-searches', { auth: true }),
      ]);

      const user = userBody?.user || {};
      const favorites = favoritesBody?.favorites || [];
      const messages = messagesBody?.messages || [];
      const listings = listingsBody?.listings || [];
      const savedSearches = searchesBody?.savedSearches || [];

      setText('userSidebarName', user.name || i18n('user_profile_account_fallback', 'Mitt konto'));
      setText('userSidebarEmail', user.email || i18n('user_profile_no_email_added', 'Ingen e-post tillagd'));
      setText('settingsInfoName', user.name || i18n('value_not_set', 'Ej angivet'));
      setText('settingsInfoEmail', user.email || i18n('settings_not_specified_feminine', 'Ej angiven'));
      setText('settingsInfoPhone', user.phone || i18n('value_not_set', 'Ej angivet'));
      setText('settingsInfoAddress', buildAddress(user));
      fillMobileProfileForm(user);
      setText('profileStatFavorites', String(favorites.length));
      setText('profileStatSearches', String(savedSearches.length));
      setText('profileStatMessages', String(messages.length));
      setText('profileStatListings', String(listings.length));
      setText('profileListingsCount', String(listings.length));
      setText('profileListingsSubtitle', buildListingsSubtitle(listings));
      setText('profileFavoritesSubtitle', favorites.length
        ? i18n('user_profile_saved_objects_count', '{count} sparade objekt').replace('{count}', formatCount(favorites.length))
        : i18n('user_profile_no_saved_objects', 'Inga sparade objekt ännu'));
      setText('profileSearchesSubtitle', savedSearches.length
        ? i18n('user_profile_active_alerts_count', '{count} aktiva bevakningar').replace('{count}', formatCount(savedSearches.length))
        : i18n('user_profile_no_active_alerts', 'Inga aktiva bevakningar ännu'));
      setText('profileMessagesSubtitle', buildMessagesSubtitle(messages));
      setText('profileUnreadMessagesSubtitle', buildMessagesSubtitle(messages));
      setText('profileDraftsSubtitle', buildDraftsSubtitle(listings));
      setText('settingsSavedSearchesSubtitle', savedSearches.length
        ? i18n('user_profile_active_alerts_count', '{count} aktiva bevakningar').replace('{count}', formatCount(savedSearches.length))
        : i18n('user_profile_no_active_alerts_short', 'Inga aktiva bevakningar'));
      setText('settingsSavedSearchesValue', savedSearches.length
        ? i18n('user_profile_saved_searches_count', '{count} sparade sökningar').replace('{count}', formatCount(savedSearches.length))
        : i18n('user_no_saved_searches_yet', 'Du har inga sparade sökningar ännu.'));
      syncSettingsLanguageLabel();

      const planBadge = document.getElementById('userProfilePlanBadge');
      if (planBadge) {
        const roleLabel = user.role === 'admin' ? i18n('user_role_admin', 'Administratör') : i18n('user_role_member', 'Medlem');
        planBadge.textContent = '';
        const icon = document.createElement('i');
        icon.className = 'fas fa-star';
        planBadge.append(icon, document.createTextNode(` ${roleLabel}`));
      }

      const desc = document.getElementById('userProfileDesc');
      if (desc) {
        const city = [user.city, user.country].filter(Boolean).join(', ');
        desc.textContent = city
          ? i18n('user_profile_desc_with_city', 'Hantera ditt konto, dina annonser och dina sparade bostäder från {city}.').replace('{city}', city)
          : i18n('user_profile_desc_default', 'Hantera ditt konto, dina annonser och dina sparade bostäder.');
      }

      renderRecentFavorites(favorites);
      syncAvatarFallback(user.name || '');
    } catch (_err) {
      // Leave template fallbacks in place.
    }
  }

  function bindAvatarModal() {
    const trigger = document.getElementById('userProfileChangePhotoTrigger');
    const hotspot = document.getElementById('userProfileAvatarHotspot');
    const uploadButton = document.getElementById('userProfileChangePhotoBtn');
    const input = document.getElementById('userProfileAvatarInput');
    const modal = document.getElementById('avatarModal');
    const closeBtn = document.getElementById('avatarModalCloseBtn');
    const takePhoto = document.getElementById('avatarTakePhotoOption');
    const library = document.getElementById('avatarLibraryOption');
    const remove = document.getElementById('avatarRemoveOption');

    if (uploadButton) uploadButton.dataset.openModal = 'true';

    window.toggleAvatarModal = function toggleAvatarModal(force) {
      if (!modal) return;
      const show = typeof force === 'boolean' ? force : !modal.classList.contains('show');
      modal.classList.toggle('show', show);
    };

    trigger?.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      window.toggleAvatarModal(true);
    });

    trigger?.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      window.toggleAvatarModal(true);
    });

    hotspot?.addEventListener('click', function (event) {
      if (event.target.closest('#userProfileChangePhotoTrigger')) return;
      window.toggleAvatarModal(true);
    });

    closeBtn?.addEventListener('click', function () {
      window.toggleAvatarModal(false);
    });

    modal?.addEventListener('click', function (event) {
      if (event.target === modal) window.toggleAvatarModal(false);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      window.toggleAvatarModal(false);
    });

    takePhoto?.addEventListener('click', function () {
      input?.click();
      window.toggleAvatarModal(false);
    });

    library?.addEventListener('click', function () {
      input?.click();
      window.toggleAvatarModal(false);
    });

    remove?.addEventListener('click', async function () {
      window.toggleAvatarModal(false);
      const preview = document.getElementById('userProfileAvatarPreview');
      if (preview) preview.src = '/static/image/avatar-placeholder.svg';
      syncAvatarFallback();
      if (!window.RimalisAPI?.request) return;
      try {
        await window.RimalisAPI.request('/users/me', {
          method: 'PATCH',
          auth: true,
          body: JSON.stringify({ avatarUrl: null }),
        });
      } catch (_err) {
        // Keep local initials fallback even if request fails.
      }
    });

    document.addEventListener('rimalis:avatar-updated', function () {
      syncAvatarFallback();
    });
  }

  function bindMobileProfileChrome() {
    const logoutBtn = document.getElementById('mobileProfileLogoutBtn');
    logoutBtn?.addEventListener('click', function () {
      if (typeof window.logout === 'function') window.logout();
    });
  }

  function bindMobileSettingsPanels() {
    const panels = Array.from(document.querySelectorAll('.info-panel'));
    if (!panels.length) return;

    window.closeAllPanels = function closeAllPanels() {
      panels.forEach((panel) => panel.classList.remove('open'));
    };

    window.openInfoPanel = function openInfoPanel(type) {
      window.closeAllPanels();
      const map = {
        personal: 'personalInfo',
        security: 'securityInfo',
        notifications: 'notificationsInfo',
        'saved-searches': 'savedSearchesInfo',
        filters: 'filtersInfo',
        language: 'languageInfo',
      };
      const panel = document.getElementById(map[type] || '');
      if (panel) panel.classList.add('open');
    };

    document.querySelectorAll('[data-open-panel]').forEach((item) => {
      const open = function () {
        window.openInfoPanel(item.getAttribute('data-open-panel'));
      };
      item.addEventListener('click', open);
      item.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        open();
      });
    });

    document.querySelectorAll('[data-close-panels]').forEach((button) => {
      button.addEventListener('click', function () {
        window.closeAllPanels();
      });
    });

    document.getElementById('mobileSettingsLogoutBtn')?.addEventListener('click', function () {
      if (typeof window.logout === 'function') window.logout();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') window.closeAllPanels();
    });

    window.addEventListener('rimalis:language-changed', function () {
      syncSettingsLanguageLabel();
    });
  }

  function syncSettingsLanguageLabel() {
    const current = String(window.RimalisI18n?.getLanguage?.() || localStorage.getItem('rimalis_language') || 'sv').toLowerCase();
    const keyByLang = {
      sv: 'language_swedish',
      en: 'language_english',
      ar: 'language_arabic',
    };
    const key = keyByLang[current] || 'language_swedish';
    const fallbackByLang = {
      sv: 'Svenska',
      en: 'English',
      ar: 'العربية',
    };
    const value = i18n(key, fallbackByLang[current] || 'Svenska');
    setText('settingsLanguageSubtitle', value);
    setText('settingsLanguageValue', value);
    document.querySelectorAll('[data-language-option]').forEach((button) => {
      const lang = String(button.getAttribute('data-language-option') || '').toLowerCase();
      const active = lang === current;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function bindSettingsLanguageOptions() {
    document.querySelectorAll('[data-language-option]').forEach((button) => {
      button.addEventListener('click', async function () {
        const lang = String(button.getAttribute('data-language-option') || '').toLowerCase();
        if (!lang || !window.RimalisI18n?.setLanguage) return;
        try {
          await window.RimalisI18n.setLanguage(lang);
          syncSettingsLanguageLabel();
        } catch (_err) {
          // Keep current language if switching fails.
        }
      });
    });
  }

  function fillMobileProfileForm(user) {
    const fullName = String(user?.name || '').trim();
    const parts = fullName.split(/\s+/).filter(Boolean);
    const firstName = parts.shift() || '';
    const lastName = parts.join(' ');

    setValue('profileFirstName', firstName);
    setValue('profileLastName', lastName);
    setValue('profileEmail', user?.email || '');
    setValue('profilePhone', user?.phone || '');
    setValue('profileWhatsappCountryCode', user?.whatsappCountryCode || '+46');
    setValue('profileWhatsappNumber', user?.whatsappNumber || '');
    setValue('profileAddress', user?.address || '');
    setValue('profilePostalCode', user?.postalCode || '');
    setValue('profileCity', user?.city || '');
    setValue('profileCountry', user?.country || '');
  }

  function initMobileProfileForm() {
    const form = document.getElementById('userProfileMainForm');
    if (!form || !window.RimalisAPI?.request) return;

    function clearFieldErrors() {
      form.querySelectorAll('.settings-field-error').forEach((node) => node.remove());
      form.querySelectorAll('.is-invalid').forEach((node) => node.classList.remove('is-invalid'));
    }

    function setFieldError(inputId, message) {
      const input = document.getElementById(inputId);
      if (!input) return;
      input.classList.add('is-invalid');
      const error = document.createElement('div');
      error.className = 'settings-field-error';
      error.textContent = message;
      input.insertAdjacentElement('afterend', error);
      try {
        input.focus({ preventScroll: false });
      } catch (_err) {
        // ignore
      }
    }

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      clearFieldErrors();

      const firstName = document.getElementById('profileFirstName')?.value?.trim() || '';
      const lastName = document.getElementById('profileLastName')?.value?.trim() || '';
      const name = `${firstName} ${lastName}`.trim();
      const email = document.getElementById('profileEmail')?.value?.trim().toLowerCase() || '';
      const phone = document.getElementById('profilePhone')?.value?.trim() || '';
      const whatsappCountryCode = document.getElementById('profileWhatsappCountryCode')?.value?.trim() || '';
      const whatsappNumberRaw = document.getElementById('profileWhatsappNumber')?.value?.trim() || '';
      const whatsappNumber = whatsappNumberRaw.replace(/[^\d]/g, '');
      const address = document.getElementById('profileAddress')?.value?.trim() || '';
      const postalCode = document.getElementById('profilePostalCode')?.value?.trim() || '';
      const city = document.getElementById('profileCity')?.value?.trim() || '';
      const country = document.getElementById('profileCountry')?.value?.trim() || '';

      if (!name || name.length < 2) {
        setFieldError(firstName ? 'profileLastName' : 'profileFirstName', i18n('profile_validation_name', 'Ange ett giltigt namn'));
        notify(i18n('profile_validation_name', 'Ange ett giltigt namn'), 'error');
        return;
      }
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        setFieldError('profileEmail', i18n('profile_validation_email', 'Ange en giltig e-postadress'));
        notify(i18n('profile_validation_email', 'Ange en giltig e-postadress'), 'error');
        return;
      }
      if (whatsappNumber && !/^\+\d{1,4}$/.test(whatsappCountryCode)) {
        setFieldError('profileWhatsappCountryCode', i18n('profile_validation_whatsapp_code', 'Välj giltig landskod för WhatsApp'));
        notify(i18n('profile_validation_whatsapp_code', 'Välj giltig landskod för WhatsApp'), 'error');
        return;
      }
      if (whatsappNumber && (whatsappNumber.length < 6 || whatsappNumber.length > 20)) {
        setFieldError('profileWhatsappNumber', i18n('profile_validation_whatsapp_number', 'Ange ett giltigt WhatsApp-nummer'));
        notify(i18n('profile_validation_whatsapp_number', 'Ange ett giltigt WhatsApp-nummer'), 'error');
        return;
      }

      try {
        const body = await window.RimalisAPI.request('/users/me', {
          method: 'PATCH',
          auth: true,
          body: JSON.stringify({
            name,
            email,
            phone,
            whatsappCountryCode: whatsappNumber ? whatsappCountryCode : null,
            whatsappNumber: whatsappNumber || null,
            address,
            postalCode,
            city,
            country,
          }),
        });

        const user = window.RimalisAPI.getUser() || {};
        window.RimalisAPI.setSession({
          accessToken: window.RimalisAPI.getAccessToken(),
          refreshToken: window.RimalisAPI.getRefreshToken(),
          user: { ...user, ...(body.user || {}) },
        });
        await hydrateMobileProfileSummary();
        notify(i18n('profile_saved_success', 'Dina uppgifter sparades'), 'success');
      } catch (err) {
        notify(err.message || 'Kunde inte spara dina uppgifter', 'error');
      }
    });
  }

  function initMobilePasswordForm() {
    const form = document.getElementById('userPasswordForm');
    if (!form || !window.RimalisAPI?.request) return;

    function clearFieldErrors() {
      form.querySelectorAll('.settings-field-error').forEach((node) => node.remove());
      form.querySelectorAll('.is-invalid').forEach((node) => node.classList.remove('is-invalid'));
    }

    function setFieldError(inputId, message) {
      const input = document.getElementById(inputId);
      if (!input) return;
      input.classList.add('is-invalid');
      const error = document.createElement('div');
      error.className = 'settings-field-error';
      error.textContent = message;
      input.insertAdjacentElement('afterend', error);
      try {
        input.focus({ preventScroll: false });
      } catch (_err) {
        // ignore
      }
    }

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      clearFieldErrors();
      const current = document.getElementById('profileCurrentPassword')?.value || '';
      const next = document.getElementById('profileNewPassword')?.value || '';
      const confirm = document.getElementById('profileConfirmPassword')?.value || '';

      if (!current || !next || !confirm) {
        if (!current) setFieldError('profileCurrentPassword', i18n('profile_validation_required', 'Det här fältet krävs'));
        if (!next) setFieldError('profileNewPassword', i18n('profile_validation_required', 'Det här fältet krävs'));
        if (!confirm) setFieldError('profileConfirmPassword', i18n('profile_validation_required', 'Det här fältet krävs'));
        notify(i18n('profile_validation_password_fields', 'Fyll i alla lösenordsfält'), 'error');
        return;
      }
      if (next !== confirm) {
        setFieldError('profileConfirmPassword', i18n('profile_validation_password_match', 'De nya lösenorden matchar inte'));
        notify(i18n('profile_validation_password_match', 'De nya lösenorden matchar inte'), 'error');
        return;
      }
      if (next.length < 8) {
        setFieldError('profileNewPassword', i18n('profile_validation_password_len', 'Lösenordet måste vara minst 8 tecken'));
        notify(i18n('profile_validation_password_len', 'Lösenordet måste vara minst 8 tecken'), 'error');
        return;
      }

      try {
        await window.RimalisAPI.request('/users/me/password', {
          method: 'PATCH',
          auth: true,
          body: JSON.stringify({
            currentPassword: current,
            newPassword: next,
          }),
        });
        form.reset();
        notify(i18n('profile_password_saved', 'Lösenordet uppdaterades'), 'success');
      } catch (err) {
        notify(err.message || 'Kunde inte uppdatera lösenordet', 'error');
      }
    });
  }

  function initMobileNotificationToggles() {
    const settings = JSON.parse(localStorage.getItem('notificationSettings') || '{}');
    document.querySelectorAll('.mobile-user-settings-page input[type="checkbox"]').forEach((checkbox) => {
      const key = checkbox.dataset.settingKey || checkbox.closest('.menu-item')?.querySelector('.menu-title')?.textContent?.trim() || '';
      if (key && Object.prototype.hasOwnProperty.call(settings, key)) {
        checkbox.checked = !!settings[key];
      }

      checkbox.addEventListener('change', function () {
        if (key) settings[key] = checkbox.checked;
        localStorage.setItem('notificationSettings', JSON.stringify(settings));
        notify(`${key || 'Inställning'} ${checkbox.checked ? 'aktiverad' : 'avstängd'}`, 'info');
      });
    });
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function setValue(id, value) {
    const node = document.getElementById(id);
    if (node) node.value = value;
  }

  function notify(message, type) {
    if (typeof window.showNotification === 'function') {
      window.showNotification(message, type || 'info');
    }
  }

  function buildListingsSubtitle(listings) {
    const published = listings.filter((item) => item.status === 'published').length;
    const pending = listings.filter((item) => item.status === 'pending').length;
    if (!listings.length) return i18n('user_no_listings_yet', 'Du har inga annonser ännu');
    if (published && pending) return i18n('user_profile_published_and_pending', '{published} publicerade, {pending} väntande')
      .replace('{published}', formatCount(published))
      .replace('{pending}', formatCount(pending));
    if (published) return i18n('user_profile_published_listings_count', '{count} publicerade annonser').replace('{count}', formatCount(published));
    if (pending) return i18n('user_profile_pending_listings_count', '{count} väntande annonser').replace('{count}', formatCount(pending));
    return i18n('user_profile_total_listings_count', '{count} annonser totalt').replace('{count}', formatCount(listings.length));
  }

  function buildAddress(user) {
    const parts = [user?.address, user?.postalCode, user?.city, user?.country].filter(Boolean);
    return parts.length ? parts.join(', ') : i18n('settings_not_specified_feminine', 'Ej angiven');
  }

  function buildMessagesSubtitle(messages) {
    const unread = messages.filter((item) => item.state !== 'read').length;
    if (!messages.length) return i18n('user_profile_no_conversations', 'Inga konversationer ännu');
    if (!unread) return i18n('user_profile_conversations_count', '{count} konversationer').replace('{count}', formatCount(messages.length));
    return i18n('user_profile_unread_conversations_count', '{count} olästa konversationer').replace('{count}', formatCount(unread));
  }

  function buildDraftsSubtitle(listings) {
    const drafts = listings.filter((item) => item.status === 'draft').length;
    if (!drafts) return i18n('user_profile_no_unpublished_listings', 'Inga opublicerade annonser');
    if (drafts === 1) return i18n('user_profile_one_unpublished_listing', '1 annons ej publicerad');
    return i18n('user_profile_unpublished_listings_count', '{count} annonser ej publicerade').replace('{count}', formatCount(drafts));
  }

  function renderRecentFavorites(favorites) {
    const wrap = document.getElementById('profileRecentFavorites');
    if (!wrap) return;

    wrap.replaceChildren();

    if (!favorites.length) {
      const empty = document.createElement('div');
      empty.className = 'saved-empty';
      empty.textContent = i18n('user_no_favorites_yet', 'Du har inte sparat några bostäder ännu.');
      wrap.appendChild(empty);
      return;
    }

    favorites.slice(0, 3).forEach((favorite) => {
      wrap.appendChild(createRecentFavoriteCard(favorite));
    });
  }

  function createRecentFavoriteCard(favorite) {
    const property = favorite.property || favorite.listing || favorite;
    const href = property?.id
      ? `/templates/mobile/public/property-modal.html?id=${encodeURIComponent(property.id)}`
      : '/templates/mobile/public/properties.html';
    const image = Array.isArray(property?.imageUrls) && property.imageUrls[0]
      ? property.imageUrls[0]
      : property?.imageUrl || '/static/image/property-placeholder.jpg';
    const location = [property?.city, property?.location, property?.address].filter(Boolean)[0] || i18n('property_without_address', 'Bostad utan adress');

    const link = document.createElement('a');
    link.className = 'mini-card';
    link.href = href;

    const img = document.createElement('img');
    img.src = image;
    img.alt = location;

    const info = document.createElement('span');
    info.className = 'mini-info';
    const price = document.createElement('span');
    price.className = 'mini-price';
    price.textContent = formatPrice(property?.price);
    const address = document.createElement('span');
    address.className = 'mini-address';
    address.textContent = location;
    info.append(price, address);

    const icon = document.createElement('i');
    icon.className = 'fas fa-chevron-right row-arrow';

    link.append(img, info, icon);
    return link;
  }

  function formatPrice(value) {
    const amount = Number(value || 0);
    if (!amount) return 'Pris saknas';
    if (window.RimalisI18n?.formatCurrencySEK) return window.RimalisI18n.formatCurrencySEK(amount, { compact: false });
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function syncAvatarFallback(name) {
    const preview = document.getElementById('userProfileAvatarPreview');
    const initials = document.getElementById('userProfileAvatarInitials');
    if (!preview || !initials) return;

    const resolvedName = String(name || document.getElementById('userSidebarName')?.textContent || '').trim();
    const src = preview.getAttribute('src') || '';
    const isPlaceholder = !src || src.includes('avatar-placeholder.svg');

    initials.textContent = buildInitials(resolvedName);
    preview.style.display = isPlaceholder ? 'none' : 'block';
    initials.style.display = isPlaceholder ? 'flex' : 'none';
  }

  function buildInitials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'JD';
    return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
  }
})();
