(function () {
  let cachedUsers = [];

  async function ensureI18nReady() {
    if (typeof window.RimalisI18n?.ready === 'function') {
      try {
        await window.RimalisI18n.ready();
      } catch (_) {
        // Keep page functional even if dictionaries fail to load
      }
    }
  }

  function i18n(key) {
    return window.RimalisI18n?.t?.(key, key) || key;
  }

  function notify(message) {
    const n = document.createElement('div');
    n.className = 'notice';
    n.textContent = message;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 2200);
  }

  function roleLabel(role) {
    if (role === 'admin') return i18n('admin_role_admin');
    if (role === 'user') return i18n('admin_role_user');
    return role;
  }

  function formatDate(date) {
    return window.RimalisI18n?.formatDate?.(date) || '-';
  }

  function formatDateTime(date) {
    return window.RimalisI18n?.formatDateTime?.(date) || '-';
  }

  function createUserRow(u) {
    const isDeleted = u.status === 'deleted';
    const statusText = isDeleted ? (i18n('admin_status_deleted') || 'Deleted') : i18n('admin_status_active');
    const tr = document.createElement('tr');
    tr.dataset.id = String(u.id || '');
    tr.dataset.role = String(u.role || 'user');
    const tdName = document.createElement('td');
    const strong = document.createElement('strong');
    strong.textContent = String(u.name || '');
    const email = document.createElement('div');
    email.className = 'user-email';
    email.textContent = String(u.email || '');
    tdName.append(strong, email);
    const tdRole = document.createElement('td');
    const select = document.createElement('select');
    select.className = 'select user-role-select';
    select.dataset.userRole = '';
    [['user', i18n('admin_role_user')], ['admin', i18n('admin_role_admin')]].forEach(([val, label]) => {
      const o = document.createElement('option');
      o.value = val;
      o.textContent = label;
      if (u.role === val) o.selected = true;
      select.appendChild(o);
    });
    tdRole.appendChild(select);
    const tdStatus = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = `badge ${isDeleted ? 'warn' : 'good'}`;
    badge.textContent = statusText;
    tdStatus.appendChild(badge);
    const tdCreated = document.createElement('td');
    tdCreated.textContent = formatDate(u.createdAt);
    const tdLogin = document.createElement('td');
    tdLogin.textContent = formatDateTime(u.lastLoginAt);
    const tdActions = document.createElement('td');
    const actions = document.createElement('div');
    actions.className = 'actions';
    const save = document.createElement('button');
    save.className = 'icon-btn';
    save.title = i18n('admin_save_role');
    save.dataset.action = 'save-role';
    const saveIcon = document.createElement('i');
    saveIcon.className = 'fas fa-save';
    save.appendChild(saveIcon);
    actions.appendChild(save);
    const secondary = document.createElement('button');
    secondary.className = 'icon-btn';
    secondary.dataset.action = isDeleted ? 'restore-user' : 'delete-user';
    secondary.title = isDeleted ? (i18n('admin_restore_user') || 'Restore user') : i18n('admin_delete_user');
    const secIcon = document.createElement('i');
    secIcon.className = `fas ${isDeleted ? 'fa-rotate-left' : 'fa-trash'}`;
    secondary.appendChild(secIcon);
    actions.appendChild(secondary);
    tdActions.appendChild(actions);
    tr.append(tdName, tdRole, tdStatus, tdCreated, tdLogin, tdActions);
    return tr;
  }

  function renderUsers(users) {
    const tbody = document.querySelector('#usersTable tbody');
    if (!tbody) return;
    tbody.textContent = '';
    users.forEach((u) => tbody.appendChild(createUserRow(u)));
  }

  async function fetchUsers() {
    const body = await window.RimalisAPI.request('/admin/users', { auth: true });
    cachedUsers = body.users || [];
    renderUsers(cachedUsers);
    return cachedUsers;
  }

  async function createUser() {
    const name = window.prompt(i18n('admin_prompt_name'));
    if (!name || !name.trim()) return;
    const email = window.prompt(i18n('admin_prompt_email'));
    if (!email || !email.trim()) return;
    const password = window.prompt(i18n('admin_prompt_password'));
    if (!password || password.length < 8) {
      notify(i18n('admin_password_min_8'));
      return;
    }
    const roleRaw = window.prompt(i18n('admin_prompt_role'), 'user');
    const role = String(roleRaw || 'user').trim().toLowerCase();
    if (!['admin', 'user'].includes(role)) {
      notify(i18n('admin_invalid_role'));
      return;
    }

    await window.RimalisAPI.request('/admin/users', {
      method: 'POST',
      auth: true,
      body: JSON.stringify({ name: name.trim(), email: email.trim(), password, role }),
    });
    notify(i18n('admin_user_created'));
    await fetchUsers();
  }

  async function saveRole(tr) {
    const userId = tr?.dataset?.id;
    if (!userId) return;
    const select = tr.querySelector('[data-user-role]');
    const role = select?.value;
    if (!role) return;

    await window.RimalisAPI.request(`/admin/users/${userId}`, {
      method: 'PATCH',
      auth: true,
      body: JSON.stringify({ role }),
    });
    notify(i18n('admin_role_updated'));
    await fetchUsers();
  }

  async function removeUser(tr) {
    const userId = tr?.dataset?.id;
    if (!userId) return;
    const name = tr.querySelector('strong')?.textContent?.trim() || i18n('admin_user_fallback_name');
    const ok = window.confirm(i18n('admin_delete_user_confirm').replace('{name}', name));
    if (!ok) return;

    await window.RimalisAPI.request(`/admin/users/${userId}`, {
      method: 'DELETE',
      auth: true,
    });
    notify(i18n('admin_user_deleted'));
    await fetchUsers();
  }

  async function restoreUser(tr) {
    const userId = tr?.dataset?.id;
    if (!userId) return;
    await window.RimalisAPI.request(`/admin/users/${userId}/restore`, {
      method: 'POST',
      auth: true,
    });
    notify(i18n('admin_user_restored') || 'User restored');
    await fetchUsers();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await ensureI18nReady();

    const search = document.getElementById('userSearch');
    const role = document.getElementById('userRole');
    const createBtn = document.querySelector('.admin-top-actions .btn.btn-primary');

    try {
      await fetchUsers();
    } catch (err) {
      notify(err.message || i18n('admin_load_users_failed'));
    }

    function applyFilter() {
      const q = (search?.value || '').toLowerCase().trim();
      const r = role?.value || 'all';
      Array.from(document.querySelectorAll('#usersTable tbody tr')).forEach((row) => {
        const text = row.textContent.toLowerCase();
        const rowRole = row.dataset.role || '';
        const okQ = !q || text.includes(q);
        const okR = r === 'all' || rowRole === r;
        row.style.display = okQ && okR ? '' : 'none';
      });
    }

    search?.addEventListener('input', applyFilter);
    role?.addEventListener('change', applyFilter);
    createBtn?.addEventListener('click', async () => {
      try {
        await createUser();
      } catch (err) {
        notify(err.message || i18n('admin_create_user_failed'));
      }
    });

    document.querySelector('#usersTable tbody')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const tr = btn.closest('tr[data-id]');
      if (!tr) return;

      try {
        if (btn.dataset.action === 'save-role') {
          await saveRole(tr);
          return;
        }
        if (btn.dataset.action === 'delete-user') {
          await removeUser(tr);
          return;
        }
        if (btn.dataset.action === 'restore-user') {
          await restoreUser(tr);
        }
      } catch (err) {
        notify(err.message || i18n('admin_action_failed'));
      }
    });
  });

  window.addEventListener('rimalis:language-changed', async () => {
    await ensureI18nReady();
    if (cachedUsers.length) renderUsers(cachedUsers);
  });
})();
