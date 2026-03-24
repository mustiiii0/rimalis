(function () {
  function setFeedback(el, message, isError) {
    if (!el) return;
    el.textContent = message || '';
    el.className = isError
      ? 'text-center text-sm text-red-300 mt-4'
      : 'text-center text-sm text-[#e2ff31] mt-4';
  }

  function i18n(key) {
    return window.RimalisI18n?.t?.(key, key) || key;
  }

  function ensureApi() {
    const api = window.RimalisAPI || window.RimalisAPI;
    if (!api) {
      throw new Error(i18n('api_client_missing'));
    }
    return api;
  }

  function redirectAfterLogin(user) {
    if (user?.role === 'admin') {
      window.location.href = '../admin/dashboard.html';
      return;
    }
    window.location.href = '../user/dashboard.html';
  }

  function initLoginForm() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    const feedback = document.getElementById('loginFeedback');

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      setFeedback(feedback, i18n('auth_logging_in'), false);

      const email = document.getElementById('loginEmail')?.value?.trim();
      const password = document.getElementById('loginPassword')?.value;

      try {
        const api = ensureApi();
        const body = await api.request('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });

        if (body?.requiresTwoFactor) {
          const hint = body?.devCode ? ` (${i18n('auth_2fa_dev_code')}: ${body.devCode})` : '';
          const entered = window.prompt(`${i18n('auth_2fa_enter_code')}${hint}`, body?.devCode || '');
          const code = String(entered || '').trim();
          if (!/^\d{6}$/.test(code)) {
            setFeedback(feedback, i18n('auth_2fa_invalid_code'), true);
            return;
          }

          const verified = await api.request('/auth/login/2fa', {
            method: 'POST',
            body: JSON.stringify({ challengeId: body.challengeId, code }),
          });
          api.setSession(verified);
          redirectAfterLogin(verified.user);
          return;
        }

        api.setSession(body);
        redirectAfterLogin(body.user);
      } catch (err) {
        setFeedback(feedback, err.message || i18n('auth_login_failed'), true);
      }
    });
  }


  function bindPasswordToggles() {
    document.querySelectorAll('[data-password-toggle]').forEach((button) => {
      if (button.dataset.passwordToggleBound === '1') return;
      button.dataset.passwordToggleBound = '1';
      button.addEventListener('click', function () {
        const input = document.getElementById(button.dataset.passwordToggle || '');
        const icon = button.querySelector('i');
        if (!input || !icon) return;
        const nextType = input.type === 'password' ? 'text' : 'password';
        input.type = nextType;
        icon.className = nextType === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
      });
    });
  }

  function initRegisterForm() {
    const form = document.getElementById('registerForm');
    if (!form) return;

    const feedback = document.getElementById('registerFeedback');

    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      const firstName = document.getElementById('firstName')?.value?.trim() || '';
      const lastName = document.getElementById('lastName')?.value?.trim() || '';
      const name = `${firstName} ${lastName}`.trim();
      const email = document.getElementById('registerEmail')?.value?.trim();
      const phone = document.getElementById('phone')?.value?.trim() || '';
      const password = document.getElementById('registerPassword')?.value;
      const confirm = document.getElementById('confirmPassword')?.value;

      if (password !== confirm) {
        setFeedback(feedback, i18n('auth_password_mismatch'), true);
        return;
      }

      setFeedback(feedback, i18n('auth_creating_account'), false);

      try {
        const api = ensureApi();
        await api.request('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ name, email, password, phone }),
        });
        setFeedback(feedback, i18n('auth_account_created'), false);
        window.setTimeout(function () {
          window.location.href = './login.html';
        }, 700);
      } catch (err) {
        setFeedback(feedback, err.message || i18n('auth_register_failed'), true);
      }
    });
  }


  function initForgotPasswordForm() {
    const form = document.getElementById('forgotForm');
    if (!form || form.dataset.authBound === '1') return;
    form.dataset.authBound = '1';

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      const email = document.getElementById('forgotEmail')?.value;
      if (!email) return;

      const message = `${i18n('auth_reset_link_sent_to')} ${email}`;
      if (window.showNotification) {
        window.showNotification(message, 'success');
      } else {
        window.alert(message);
      }
      window.location.href = 'login.html';
    });
  }

  function initResetPasswordForm() {
    const form = document.getElementById('resetForm');
    if (!form || form.dataset.authBound === '1') return;
    form.dataset.authBound = '1';

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      const newPassword = document.getElementById('newPassword')?.value || '';
      const confirmPassword = document.getElementById('confirmPassword')?.value || '';

      if (newPassword !== confirmPassword) {
        const message = i18n('auth_password_mismatch');
        if (window.showNotification) window.showNotification(message, 'error');
        else window.alert(message);
        return;
      }

      if (newPassword.length < 6) {
        const message = i18n('auth_password_min_6');
        if (window.showNotification) window.showNotification(message, 'error');
        else window.alert(message);
        return;
      }

      const message = i18n('auth_password_updated');
      if (window.showNotification) window.showNotification(message, 'success');
      else window.alert(message);
      window.location.href = 'login.html';
    });
  }

  function autoInitAuthPages() {
    initLoginForm();
    initRegisterForm();
    initForgotPasswordForm();
    initResetPasswordForm();
  }

  bindPasswordToggles();

  bindPasswordToggles();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInitAuthPages);
  } else {
    autoInitAuthPages();
  }

  const authApi = {
    initLoginForm,
    initRegisterForm,
    initForgotPasswordForm,
    initResetPasswordForm,
    bindPasswordToggles,
  };
  window.RimalisAuth = authApi;
})();
