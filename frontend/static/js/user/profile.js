// ===== PROFILE SETTINGS =====

document.addEventListener('DOMContentLoaded', async function () {
  await loadProfile();
  initProfileAvatarUpload();
  initProfileForm();
  initPasswordForm();
  initNotificationToggles();
  initDeleteAccount();
});

function i18n(key, fallback) {
  return window.RimalisI18n?.t?.(key, fallback) || fallback;
}

function templatePath(path) {
  const normalized = String(path || '');
  return (window.location.pathname || '').includes('/templates/mobile/')
    ? normalized.replace('/templates/', '/templates/mobile/')
    : normalized;
}

function getMainProfileForm() {
  return document.getElementById('userProfileMainForm') || document.querySelector('.glass-dark form');
}

function safeAvatar(url) {
  if (typeof url !== 'string') return '/static/image/avatar-placeholder.svg';
  const trimmed = url.trim();
  if (!trimmed) return '/static/image/avatar-placeholder.svg';
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/static/uploads/') ||
    trimmed.startsWith('/uploads/') ||
    trimmed.startsWith('data:image/')
  ) {
    return trimmed;
  }
  return '/static/image/avatar-placeholder.svg';
}

function setAvatarEverywhere(url) {
  const src = safeAvatar(url);
  document.querySelectorAll('#userProfileAvatarPreview, #userProfileSidebarAvatar, .glass-dark .text-center img').forEach((img) => {
    if (img instanceof HTMLImageElement) img.src = src;
  });
  document.dispatchEvent(new CustomEvent('rimalis:avatar-updated', { detail: { src } }));
}

async function loadProfile() {
  if (!window.RimalisAPI) return;

  try {
    const body = await window.RimalisAPI.request('/users/me', { auth: true });
    const user = body.user || {};
    const name = user.name || '';
    const [firstName, ...rest] = name.split(' ');
    const lastName = rest.join(' ');

    const firstNameInput = document.getElementById('profileFirstName');
    const lastNameInput = document.getElementById('profileLastName');
    const emailInput = document.getElementById('profileEmail');
    const phoneInput = document.getElementById('profilePhone');
    const whatsappCountryCodeInput = document.getElementById('profileWhatsappCountryCode');
    const whatsappNumberInput = document.getElementById('profileWhatsappNumber');
    const addressInput = document.getElementById('profileAddress');
    const postalInput = document.getElementById('profilePostalCode');
    const cityInput = document.getElementById('profileCity');
    const countryInput = document.getElementById('profileCountry');

    if (firstNameInput) firstNameInput.value = firstName || '';
    if (lastNameInput) lastNameInput.value = lastName || '';
    if (emailInput) emailInput.value = user.email || '';
    if (phoneInput) phoneInput.value = user.phone || '';
    if (whatsappCountryCodeInput) whatsappCountryCodeInput.value = user.whatsappCountryCode || '+46';
    if (whatsappNumberInput) whatsappNumberInput.value = user.whatsappNumber || '';
    if (addressInput) addressInput.value = user.address || '';
    if (postalInput) postalInput.value = user.postalCode || '';
    if (cityInput) cityInput.value = user.city || '';
    if (countryInput) countryInput.value = user.country || '';

    setAvatarEverywhere(user.avatarUrl);
  } catch (_err) {
    // ignore
  }
}

function initProfileAvatarUpload() {
  const button = document.getElementById('userProfileChangePhotoBtn');
  const input = document.getElementById('userProfileAvatarInput');
  if (!button || !input || !window.RimalisAPI) return;

  button.addEventListener('click', function () {
    if (button.dataset.openModal === 'true') {
      window.toggleAvatarModal?.(true);
      return;
    }
    input.click();
  });

  input.addEventListener('change', async function () {
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showNotification(i18n('user_profile_image_invalid'), 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showNotification(i18n('user_profile_image_too_large'), 'error');
      return;
    }

    const formData = new FormData();
    formData.append('image', file);

    button.disabled = true;
    const icon = button.querySelector('i');
    const oldIconClass = icon ? icon.className : '';
    if (icon) {
      icon.className = 'fas fa-spinner fa-spin';
    }

    try {
      const upload = await window.RimalisAPI.request('/uploads/avatar', {
        method: 'POST',
        auth: true,
        body: formData,
      });

      const imageUrl = upload?.imageUrl;
      if (!imageUrl) throw new Error(i18n('user_profile_image_upload_failed'));

      const body = await window.RimalisAPI.request('/users/me', {
        method: 'PATCH',
        auth: true,
        body: JSON.stringify({ avatarUrl: imageUrl }),
      });

      const sessionUser = window.RimalisAPI.getUser() || {};
      window.RimalisAPI.setSession({
        accessToken: window.RimalisAPI.getAccessToken(),
        refreshToken: window.RimalisAPI.getRefreshToken(),
        user: { ...sessionUser, ...(body.user || {}), avatarUrl: imageUrl },
      });
      setAvatarEverywhere(imageUrl);
      showNotification(i18n('user_profile_image_saved'), 'success');
    } catch (err) {
      showNotification(err.message || i18n('user_profile_image_upload_failed'), 'error');
    } finally {
      button.disabled = false;
      if (icon) {
        icon.className = oldIconClass || 'fas fa-pen';
      }
      input.value = '';
    }
  });
}

function initProfileForm() {
  const form = getMainProfileForm();
  if (!form || !window.RimalisAPI) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const firstName = document.getElementById('profileFirstName')?.value?.trim() || '';
    const lastName = document.getElementById('profileLastName')?.value?.trim() || '';
    const name = `${firstName} ${lastName}`.trim();
    const phone = document.getElementById('profilePhone')?.value?.trim() || '';
    const whatsappCountryCode = document.getElementById('profileWhatsappCountryCode')?.value?.trim() || '';
    const whatsappNumberRaw = document.getElementById('profileWhatsappNumber')?.value?.trim() || '';
    const whatsappNumber = whatsappNumberRaw.replace(/[^\d]/g, '');
    const address = document.getElementById('profileAddress')?.value?.trim() || '';
    const postalCode = document.getElementById('profilePostalCode')?.value?.trim() || '';
    const city = document.getElementById('profileCity')?.value?.trim() || '';
    const country = document.getElementById('profileCountry')?.value?.trim() || '';

    if (!name || name.length < 2) {
      showNotification(i18n('user_enter_valid_name'), 'error');
      return;
    }
    if (whatsappNumber && !/^\+\d{1,4}$/.test(whatsappCountryCode)) {
      showNotification(i18n('user_select_whatsapp_country_code', 'Välj giltig landskod för WhatsApp'), 'error');
      return;
    }
    if (whatsappNumber && (whatsappNumber.length < 6 || whatsappNumber.length > 20)) {
      showNotification(i18n('user_enter_valid_whatsapp_number', 'Ange ett giltigt WhatsApp-nummer'), 'error');
      return;
    }

    try {
      const body = await window.RimalisAPI.request('/users/me', {
        method: 'PATCH',
        auth: true,
        body: JSON.stringify({
          name,
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
      showNotification(i18n('user_profile_saved'), 'success');
    } catch (err) {
      showNotification(err.message || i18n('user_could_not_save_profile'), 'error');
    }
  });
}

function initPasswordForm() {
  const passwordForm = document.getElementById('userPasswordForm');
  if (!passwordForm || !window.RimalisAPI) return;

  passwordForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const current = document.getElementById('profileCurrentPassword')?.value || '';
    const next = document.getElementById('profileNewPassword')?.value || '';
    const confirm = document.getElementById('profileConfirmPassword')?.value || '';

    if (!current || !next || !confirm) {
      showNotification(i18n('user_fill_password_fields'), 'error');
      return;
    }
    if (next !== confirm) {
      showNotification(i18n('user_passwords_do_not_match'), 'error');
      return;
    }
    if (next.length < 8) {
      showNotification(i18n('user_password_min_length'), 'error');
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
      showNotification(i18n('user_password_updated'), 'success');
      passwordForm.reset();
      await window.RimalisAPI.logout();
      window.setTimeout(function () {
        window.location.href = templatePath('/templates/auth/login.html');
      }, 500);
    } catch (err) {
      showNotification(err.message || i18n('user_password_update_failed', 'Kunde inte uppdatera lösenord'), 'error');
    }
  });
}

function initNotificationToggles() {
  document.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.addEventListener('change', function () {
      const setting =
        this.dataset.settingKey ||
        this.closest('.menu-item')?.querySelector('.menu-title')?.textContent?.trim() ||
        this.closest('.flex.items-center')?.querySelector('h3')?.textContent ||
        i18n('user_notification');
      const status = this.checked ? i18n('user_enabled') : i18n('user_disabled');
      showNotification(`${setting} ${status}`, 'info');

      const settings = JSON.parse(localStorage.getItem('notificationSettings') || '{}');
      settings[setting] = this.checked;
      localStorage.setItem('notificationSettings', JSON.stringify(settings));
    });
  });

  const settings = JSON.parse(localStorage.getItem('notificationSettings') || '{}');
  document.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    const setting =
      checkbox.dataset.settingKey ||
      checkbox.closest('.menu-item')?.querySelector('.menu-title')?.textContent?.trim() ||
      checkbox.closest('.flex.items-center')?.querySelector('h3')?.textContent;
    if (setting && settings[setting] !== undefined) {
      checkbox.checked = settings[setting];
    }
  });
}

function initDeleteAccount() {
  const button = document.getElementById('deleteAccountButton');
  if (!button || !window.RimalisAPI) return;

  button.addEventListener('click', async function () {
    const warning = i18n(
      'user_delete_account_warning',
      'user_delete_account_warning'
    );
    if (!window.confirm(warning)) return;

    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = i18n('user_deleting');

    try {
      await window.RimalisAPI.request('/users/me', {
        method: 'DELETE',
        auth: true,
      });
      await window.RimalisAPI.logout();
      showNotification(i18n('user_account_deleted'), 'success');
      window.setTimeout(() => {
        window.location.href = templatePath('/templates/public/home.html');
      }, 450);
    } catch (err) {
      button.disabled = false;
      button.textContent = originalText;
      showNotification(err.message || i18n('user_account_delete_failed'), 'error');
    }
  });
}
