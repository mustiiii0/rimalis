(function () {
  function i18n(key) {
    return window.RimalisI18n?.t?.(key, key) || key;
  }

  function notify(message, type = 'info') {
    if (window.showNotification) {
      window.showNotification(message, type);
      return;
    }

    const n = document.createElement('div');
    n.className = 'notice';
    n.textContent = message;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 2200);
  }

  function setValues(settings) {
    const map = {
      siteName: 'siteName',
      supportEmail: 'supportEmail',
      contactPhone: 'contactPhone',
      smtpHost: 'smtpHost',
      smtpPort: 'smtpPort',
      smtpUser: 'smtpUser',
      vatPercent: 'vatPercent',
      commissionPercent: 'commissionPercent',
      fixedFee: 'fixedFee',
      sessionTimeoutMin: 'sessionTimeoutMin',
    };

    Object.entries(map).forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el && settings[key] !== undefined && settings[key] !== null) {
        el.value = String(settings[key]);
      }
    });
  }

  function collectPayload() {
    const get = (id) => document.getElementById(id)?.value ?? '';
    const toNumber = (value, fallback) => {
      const n = Number(String(value ?? '').trim());
      return Number.isFinite(n) ? n : fallback;
    };

    return {
      siteName: get('siteName').trim(),
      supportEmail: get('supportEmail').trim(),
      contactPhone: get('contactPhone').trim(),
      smtpHost: get('smtpHost').trim(),
      smtpPort: toNumber(get('smtpPort'), 587),
      smtpUser: get('smtpUser').trim(),
      vatPercent: toNumber(get('vatPercent'), 25),
      commissionPercent: toNumber(get('commissionPercent'), 3.5),
      fixedFee: toNumber(get('fixedFee'), 5000),
      sessionTimeoutMin: toNumber(get('sessionTimeoutMin'), 30),
    };
  }

  async function loadSettings() {
    const body = await window.RimalisAPI.request('/admin/settings', { auth: true });
    setValues(body.settings || {});
  }

  async function saveSettings() {
    const payload = collectPayload();
    const body = await window.RimalisAPI.request('/admin/settings', {
      method: 'PATCH',
      auth: true,
      body: JSON.stringify(payload),
    });

    setValues(body.settings || {});
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (!window.RimalisAPI) return;

    try {
      await loadSettings();
    } catch (err) {
      notify(err.message || i18n('admin_load_settings_failed'), 'error');
    }

    const runSave = async () => {
        try {
          await saveSettings();
          notify(i18n('admin_settings_saved'), 'success');
        } catch (err) {
          notify(err.message || i18n('admin_save_settings_failed'), 'error');
        }
    };

    const saveBtn = document.getElementById('saveSettingsBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', runSave);
    }

    const saveAllBtn = document.getElementById('saveAllSettingsBtn');
    if (saveAllBtn) {
      saveAllBtn.addEventListener('click', runSave);
    }
  });
})();
