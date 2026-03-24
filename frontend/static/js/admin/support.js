(function () {
  const STORAGE_KEY = 'rimalis_admin_support_saved_views_v1';
  let allMessages = [];
  let filteredMessages = [];
  let cachedSettings = {};
  let supportAgents = [];
  let macros = [];
  let selectedMessageId = null;
  let selectedIds = new Set();
  let refreshTimer = null;
  let loading = false;

  async function ensureI18nReady() {
    if (typeof window.RimalisI18n?.ready === 'function') {
      try { await window.RimalisI18n.ready(); } catch (_) {}
    }
  }

  function i18n(key) {
    return window.RimalisI18n?.t?.(key, key) || key;
  }

  function notify(message, type = 'info') {
    if (typeof window.showNotification === 'function') {
      window.showNotification(message, type);
      return;
    }
    const n = document.createElement('div');
    n.className = 'notice';
    n.textContent = message;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 2200);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function formatDateTime(value) {
    return window.RimalisI18n?.formatDateTime?.(value) || '-';
  }

  function relativeTime(dateValue) {
    const timestamp = new Date(dateValue).getTime();
    if (!Number.isFinite(timestamp)) return '-';
    const ms = Date.now() - timestamp;
    const minutes = Math.max(0, Math.floor(ms / 60000));
    if (minutes < 60) return i18n('admin_time_minutes_ago').replace('{count}', String(minutes));
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return i18n('admin_time_hours_ago').replace('{count}', String(hours));
    const days = Math.floor(hours / 24);
    return i18n('admin_time_days_ago').replace('{count}', String(days));
  }

  function statusLabel(status) {
    if (status === 'replied') return i18n('admin_support_status_replied');
    if (status === 'unread') return i18n('admin_messages_filter_unread');
    return i18n('admin_messages_filter_read');
  }

  function parseMetaLine(line, labels) {
    const lower = String(line || '').toLowerCase();
    const label = labels.find((candidate) => lower.startsWith(candidate));
    if (!label) return null;
    return line.slice(label.length).trim();
  }

  function parseFollowupDate(rawValue) {
    const normalized = String(rawValue || '').trim();
    const timestamp = Date.parse(normalized);
    if (!Number.isFinite(timestamp)) return null;
    return new Date(timestamp).toISOString();
  }

  function parseCustomerThread(content, createdAt) {
    const source = String(content || '').replace(/\r/g, '').trim();
    const lines = source.split('\n');
    const contact = { name: '', email: '', phone: '' };

    let cursor = 0;
    while (cursor < lines.length) {
      const current = lines[cursor].trim();
      if (!current) { cursor += 1; break; }

      const name = parseMetaLine(current, ['namn:', 'name:']);
      const email = parseMetaLine(current, ['e-post:', 'email:']);
      const phone = parseMetaLine(current, ['telefon:', 'phone:']);

      if (name !== null) { contact.name = name; cursor += 1; continue; }
      if (email !== null) { contact.email = email; cursor += 1; continue; }
      if (phone !== null) { contact.phone = phone; cursor += 1; continue; }
      break;
    }

    const body = lines.slice(cursor).join('\n').trim();
    const markerRegex = /\n---\n(?:Uppföljning|Follow-up)\s*\(([^)]+)\)\n/g;
    const markers = [];
    let match;
    while ((match = markerRegex.exec(body))) {
      markers.push({ rawDate: match[1], start: match.index, end: markerRegex.lastIndex });
    }

    const messages = [];
    const firstBlock = markers.length ? body.slice(0, markers[0].start).trim() : body;
    if (firstBlock) messages.push({ type: 'customer', text: firstBlock, timestamp: createdAt || null });

    markers.forEach((marker, index) => {
      const nextMarker = markers[index + 1];
      const text = body.slice(marker.end, nextMarker ? nextMarker.start : body.length).trim();
      if (!text) return;
      messages.push({ type: 'customer-followup', text, timestamp: parseFollowupDate(marker.rawDate) });
    });

    const lastCustomerMessage = messages.length ? messages[messages.length - 1].text : '';
    return { contact, messages, lastCustomerMessage, followupCount: Math.max(0, messages.length - 1) };
  }

  function getMessageStatus(message) {
    if (message?.state === 'unread') return 'unread';
    if (message?.adminReply) return 'replied';
    return 'read';
  }

  function enhanceMessage(raw) {
    const thread = parseCustomerThread(raw.content, raw.createdAt);
    const status = getMessageStatus(raw);
    const lastActivityAt = raw.createdAt || raw.repliedAt || null;
    const meta = raw.threadMeta || {};

    return {
      ...raw,
      status,
      thread,
      lastActivityAt,
      assigneeUserId: meta.assigneeUserId || null,
      assigneeName: meta.assigneeName || null,
      threadStatus: meta.status || 'open',
      priority: meta.priority || 'normal',
      noteCount: Number(meta.noteCount || 0),
      searchBlob: [
        raw.userName,
        raw.subject,
        raw.content,
        raw.adminReply,
        thread.lastCustomerMessage,
        thread.contact.name,
        thread.contact.email,
        thread.contact.phone,
        meta.assigneeName,
      ].filter(Boolean).join(' ').toLowerCase(),
    };
  }

  function findMessage(id) {
    return allMessages.find((m) => m.id === id) || null;
  }

  function getSavedViews() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return data && typeof data === 'object' ? data : {};
    } catch (_) {
      return {};
    }
  }

  function saveSavedViews(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data || {}));
  }

  function populateSavedViews() {
    const sel = document.getElementById('supportSavedView');
    if (!sel) return;
    const custom = getSavedViews();
    sel.textContent = '';
    const base = [
      { value: 'default', label: 'Saved views' },
      { value: 'unread-24h', label: 'Unread + last 24h' },
    ];
    base.forEach((item) => {
      const opt = document.createElement('option');
      opt.value = item.value;
      opt.textContent = item.label;
      sel.appendChild(opt);
    });
    Object.keys(custom).forEach((name) => {
      const opt = document.createElement('option');
      opt.value = `custom:${name}`;
      opt.textContent = name;
      sel.appendChild(opt);
    });
  }

  function populateAgents() {
    const assigneeFilter = document.getElementById('supportAssigneeFilter');
    const bulkAssignee = document.getElementById('supportBulkAssignee');
    const detailAssignee = document.getElementById('supportDetailAssignee');
    const append = (sel, value, label) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      sel.appendChild(opt);
    };
    if (assigneeFilter) {
      assigneeFilter.textContent = '';
      append(assigneeFilter, 'all', 'All assignees');
      append(assigneeFilter, 'unassigned', 'Unassigned');
      append(assigneeFilter, 'me', 'Assigned to me');
      supportAgents.forEach((a) => append(assigneeFilter, String(a.id || ''), String(a.name || a.email || a.id || '')));
    }
    if (bulkAssignee) {
      bulkAssignee.textContent = '';
      append(bulkAssignee, '', 'Select assignee');
      append(bulkAssignee, '__unassign__', 'Unassign');
      supportAgents.forEach((a) => append(bulkAssignee, String(a.id || ''), String(a.name || a.email || a.id || '')));
    }
    if (detailAssignee) {
      detailAssignee.textContent = '';
      append(detailAssignee, '', 'Unassigned');
      supportAgents.forEach((a) => append(detailAssignee, String(a.id || ''), String(a.name || a.email || a.id || '')));
    }
  }

  function populateMacros() {
    const sel = document.getElementById('supportMacroSelect');
    if (!sel) return;
    sel.textContent = '';
    const base = document.createElement('option');
    base.value = '';
    base.textContent = 'Quick replies';
    sel.appendChild(base);
    macros.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = String(m.id || '');
      opt.textContent = String(m.name || '');
      sel.appendChild(opt);
    });
  }

  function renderStats() {
    const unreadCount = allMessages.filter((m) => m.state === 'unread').length;
    const totalCount = allMessages.length;
    const repliedCount = allMessages.filter((m) => Boolean(m.adminReply)).length;

    const unreadEl = document.getElementById('supportUnreadCount');
    const totalEl = document.getElementById('supportTotalCount');
    const repliedEl = document.getElementById('supportRepliedCount');
    const supportEmailEl = document.getElementById('supportEmailText');

    if (unreadEl) unreadEl.textContent = window.RimalisI18n?.formatNumber?.(unreadCount) || String(unreadCount);
    if (totalEl) totalEl.textContent = window.RimalisI18n?.formatNumber?.(totalCount) || String(totalCount);
    if (repliedEl) repliedEl.textContent = window.RimalisI18n?.formatNumber?.(repliedCount) || String(repliedCount);
    if (supportEmailEl) supportEmailEl.textContent = cachedSettings.supportEmail || '-';
  }

  function applyPresetView(value) {
    if (value === 'unread-24h') {
      const now = Date.now();
      document.getElementById('supportStateFilter').value = 'unread';
      filteredMessages = allMessages.filter((m) => m.state === 'unread' && (now - new Date(m.createdAt).getTime()) <= (24 * 60 * 60 * 1000));
      renderAll(true);
      return true;
    }

    if (value.startsWith('custom:')) {
      const name = value.slice('custom:'.length);
      const saved = getSavedViews()[name];
      if (saved) {
        if (document.getElementById('supportSearch')) document.getElementById('supportSearch').value = saved.search || '';
        if (document.getElementById('supportStateFilter')) document.getElementById('supportStateFilter').value = saved.state || 'all';
        if (document.getElementById('supportAssigneeFilter')) document.getElementById('supportAssigneeFilter').value = saved.assignee || 'all';
        if (document.getElementById('supportSort')) document.getElementById('supportSort').value = saved.sort || 'newest';
      }
      return false;
    }
    return false;
  }

  function applyFilters() {
    const searchValue = String(document.getElementById('supportSearch')?.value || '').toLowerCase().trim();
    const stateFilter = document.getElementById('supportStateFilter')?.value || 'all';
    const assigneeFilter = document.getElementById('supportAssigneeFilter')?.value || 'all';
    const sortValue = document.getElementById('supportSort')?.value || 'newest';
    const meId = window.RimalisAPI?.getUser?.()?.id || null;

    filteredMessages = allMessages.filter((message) => {
      const matchesSearch = !searchValue || message.searchBlob.includes(searchValue);
      const matchesState =
        stateFilter === 'all' ||
        (stateFilter === 'unread' && message.status === 'unread') ||
        (stateFilter === 'read' && message.status === 'read') ||
        (stateFilter === 'replied' && message.status === 'replied');

      const matchesAssignee =
        assigneeFilter === 'all' ||
        (assigneeFilter === 'unassigned' && !message.assigneeUserId) ||
        (assigneeFilter === 'me' && meId && message.assigneeUserId === meId) ||
        (assigneeFilter !== 'all' && assigneeFilter !== 'unassigned' && assigneeFilter !== 'me' && message.assigneeUserId === assigneeFilter);

      return matchesSearch && matchesState && matchesAssignee;
    });

    filteredMessages.sort((a, b) => {
      const aTime = new Date(a.lastActivityAt || a.createdAt).getTime();
      const bTime = new Date(b.lastActivityAt || b.createdAt).getTime();

      if (sortValue === 'oldest') return aTime - bTime;
      if (sortValue === 'unread') {
        const aUnread = a.status === 'unread' ? 0 : 1;
        const bUnread = b.status === 'unread' ? 0 : 1;
        return aUnread - bUnread || bTime - aTime;
      }
      return bTime - aTime;
    });
  }

  function renderList() {
    const list = document.getElementById('supportList');
    if (!list) return;
    list.textContent = '';

    if (!filteredMessages.length) {
      const empty = document.createElement('div');
      empty.className = 'support-empty';
      empty.textContent = i18n('admin_support_no_items');
      list.appendChild(empty);
      return;
    }

    filteredMessages.forEach((message) => {
      const isActive = message.id === selectedMessageId;
      const preview = message.thread.lastCustomerMessage || String(message.content || '').slice(0, 140);
      const article = document.createElement('article');
      article.className = `support-list-item ${message.status === 'unread' ? 'unread' : ''} ${isActive ? 'active' : ''}`.trim();
      article.dataset.ticketId = String(message.id || '');
      const check = document.createElement('input');
      check.className = 'support-list-item-check';
      check.type = 'checkbox';
      check.dataset.selectId = String(message.id || '');
      check.checked = selectedIds.has(message.id);
      const main = document.createElement('div');
      main.className = 'support-list-item-main';
      const head = document.createElement('div');
      head.className = 'support-list-item-head';
      const user = document.createElement('span');
      user.className = 'support-list-item-user';
      user.textContent = message.userName || i18n('admin_support_unknown_sender');
      const time = document.createElement('span');
      time.className = 'support-list-item-time';
      time.textContent = relativeTime(message.lastActivityAt || message.createdAt);
      head.append(user, time);
      const subject = document.createElement('div');
      subject.className = 'support-list-item-subject';
      subject.textContent = message.subject || i18n('admin_support_unknown_subject');
      const badges = document.createElement('div');
      badges.className = 'support-list-item-badges';
      const addBadge = (txt) => {
        if (!txt) return;
        const b = document.createElement('span');
        b.className = 'support-mini-badge';
        b.textContent = txt;
        badges.appendChild(b);
      };
      if (message.thread.followupCount > 0) addBadge(`${i18n('admin_support_thread_updated')} (${message.thread.followupCount})`);
      if (message.assigneeName) addBadge(`@${message.assigneeName}`);
      if (message.threadStatus && message.threadStatus !== 'open') addBadge(message.threadStatus);
      if (message.priority && message.priority !== 'normal') addBadge(message.priority);
      if (message.noteCount > 0) addBadge(`Notes: ${message.noteCount}`);
      const pv = document.createElement('div');
      pv.className = 'support-list-item-preview';
      pv.textContent = preview;
      main.append(head, subject, badges, pv);
      article.append(check, main);
      list.appendChild(article);
    });
  }

  function renderContactDetails(message) {
    const contact = message.thread.contact;
    const contactEl = document.getElementById('supportDetailContact');
    if (!contactEl) return;

    const rows = [];
    if (contact.name) rows.push(`${i18n('admin_support_contact_name')}: ${contact.name}`);
    if (contact.email) rows.push(`${i18n('admin_support_contact_email')}: ${contact.email}`);
    if (contact.phone) rows.push(`${i18n('admin_support_contact_phone')}: ${contact.phone}`);

    contactEl.textContent = rows.length ? rows.join('\n') : '-';
  }

  function renderThreadHistory(message) {
    const historyWrap = document.getElementById('supportThreadHistoryWrap');
    const historyBody = document.getElementById('supportThreadHistory');
    if (!historyWrap || !historyBody) return;

    const entries = message.thread.messages;
    if (!entries.length) {
      historyWrap.classList.add('hidden');
      historyBody.textContent = '-';
      return;
    }

    historyWrap.classList.remove('hidden');
    historyBody.textContent = '';
    entries.forEach((entry, index) => {
      const timestamp = entry.timestamp ? formatDateTime(entry.timestamp) : '-';
      const wrap = document.createElement('div');
      wrap.className = 'support-thread-item';
      const meta = document.createElement('p');
      meta.className = 'support-thread-item-meta';
      meta.textContent = `${i18n('admin_support_thread_message')} ${index + 1} • ${timestamp}`;
      const text = document.createElement('p');
      text.className = 'support-thread-item-text';
      text.textContent = String(entry.text || '');
      wrap.append(meta, text);
      historyBody.appendChild(wrap);
    });
  }

  function renderNotes(notes) {
    const list = document.getElementById('supportNotesList');
    if (!list) return;
    list.textContent = '';
    if (!Array.isArray(notes) || !notes.length) {
      const d = document.createElement('div');
      d.className = 'support-empty';
      d.textContent = 'No notes yet';
      list.appendChild(d);
      return;
    }
    notes.forEach((n) => {
      const wrap = document.createElement('div');
      wrap.className = 'support-thread-item';
      const meta = document.createElement('p');
      meta.className = 'support-thread-item-meta';
      meta.textContent = `${n.authorName || 'Admin'} • ${formatDateTime(n.createdAt)}`;
      const text = document.createElement('p');
      text.className = 'support-thread-item-text';
      text.textContent = String(n.note || '');
      wrap.append(meta, text);
      list.appendChild(wrap);
    });
  }

  async function loadNotes(messageId) {
    const body = await window.RimalisAPI.request(`/admin/messages/${encodeURIComponent(messageId)}/notes`, { auth: true });
    renderNotes(body?.notes || []);
  }

  function renderDetail() {
    const empty = document.getElementById('supportDetailEmpty');
    const content = document.getElementById('supportDetailContent');
    const message = findMessage(selectedMessageId);

    if (!message) {
      if (empty) empty.classList.remove('hidden');
      if (content) content.classList.add('hidden');
      return;
    }

    if (empty) empty.classList.add('hidden');
    if (content) content.classList.remove('hidden');

    const statusEl = document.getElementById('supportDetailBadge');
    const subjectEl = document.getElementById('supportDetailSubject');
    const metaEl = document.getElementById('supportDetailMeta');
    const msgEl = document.getElementById('supportDetailMessage');
    const replyWrapEl = document.getElementById('supportExistingReplyWrap');
    const replyEl = document.getElementById('supportExistingReply');

    if (statusEl) {
      statusEl.className = `support-status ${message.status}`;
      statusEl.textContent = statusLabel(message.status);
    }

    if (subjectEl) subjectEl.textContent = message.subject || i18n('admin_support_unknown_subject');
    if (metaEl) {
      const created = formatDateTime(message.createdAt);
      metaEl.textContent = `${message.userName || i18n('admin_support_unknown_sender')} • ${created}`;
    }

    const lastCustomer = message.thread.lastCustomerMessage || message.content || '-';
    if (msgEl) msgEl.textContent = lastCustomer;

    renderContactDetails(message);
    renderThreadHistory(message);

    if (message.adminReply) {
      if (replyWrapEl) replyWrapEl.classList.remove('hidden');
      if (replyEl) replyEl.textContent = message.adminReply;
    } else {
      if (replyWrapEl) replyWrapEl.classList.add('hidden');
      if (replyEl) replyEl.textContent = '-';
    }

    const markBtn = document.getElementById('supportMarkReadBtn');
    if (markBtn) markBtn.disabled = message.status !== 'unread';

    const detailAssignee = document.getElementById('supportDetailAssignee');
    const detailStatus = document.getElementById('supportDetailStatus');
    const detailPriority = document.getElementById('supportDetailPriority');
    if (detailAssignee) detailAssignee.value = message.assigneeUserId || '';
    if (detailStatus) detailStatus.value = message.threadStatus || 'open';
    if (detailPriority) detailPriority.value = message.priority || 'normal';
  }

  function renderAll(skipFilterRecalc = false) {
    renderStats();
    if (!skipFilterRecalc) applyFilters();

    const selectedStillExists = selectedMessageId && filteredMessages.some((message) => message.id === selectedMessageId);
    if (!selectedStillExists) selectedMessageId = filteredMessages[0]?.id || null;

    renderList();
    renderDetail();
    const selectedAll = filteredMessages.length > 0 && filteredMessages.every((m) => selectedIds.has(m.id));
    const selectAll = document.getElementById('supportSelectAll');
    if (selectAll) selectAll.checked = selectedAll;
  }

  async function loadData(options = {}) {
    if (loading) return;
    loading = true;

    const preserveSelection = options.preserveSelection !== false;
    const previousSelection = preserveSelection ? selectedMessageId : null;

    try {
      const [messagesBody, settingsBody, agentsBody, macrosBody] = await Promise.all([
        window.RimalisAPI.request('/admin/messages', { auth: true }),
        window.RimalisAPI.request('/admin/settings', { auth: true }),
        window.RimalisAPI.request('/admin/support/agents', { auth: true }),
        window.RimalisAPI.request('/admin/support/macros', { auth: true }),
      ]);

      const rawMessages = Array.isArray(messagesBody?.messages) ? messagesBody.messages : [];
      allMessages = rawMessages.map(enhanceMessage);
      cachedSettings = settingsBody?.settings || {};
      supportAgents = Array.isArray(agentsBody?.agents) ? agentsBody.agents : [];
      macros = Array.isArray(macrosBody?.macros) ? macrosBody.macros : [];

      populateAgents();
      populateMacros();
      populateSavedViews();

      if (preserveSelection && previousSelection && allMessages.some((message) => message.id === previousSelection)) {
        selectedMessageId = previousSelection;
      }

      renderAll();
      if (selectedMessageId) {
        loadNotes(selectedMessageId).catch(() => {});
      } else {
        renderNotes([]);
      }
    } finally {
      loading = false;
    }
  }

  async function markRead(messageId) {
    await window.RimalisAPI.request(`/admin/messages/${encodeURIComponent(messageId)}/read`, {
      method: 'PATCH',
      auth: true,
    });

    allMessages = allMessages.map((message) =>
      message.id === messageId ? enhanceMessage({ ...message, state: 'read' }) : message
    );
    renderAll();
  }

  async function markAllRead() {
    const unreadMessages = allMessages.filter((message) => message.state === 'unread');
    if (!unreadMessages.length) return;

    await Promise.allSettled(
      unreadMessages.map((message) =>
        window.RimalisAPI.request(`/admin/messages/${encodeURIComponent(message.id)}/read`, {
          method: 'PATCH',
          auth: true,
        })
      )
    );

    allMessages = allMessages.map((message) => enhanceMessage({ ...message, state: 'read' }));
    renderAll();
  }

  async function sendReply() {
    const selected = findMessage(selectedMessageId);
    if (!selected) {
      notify(i18n('admin_select_message_first'), 'error');
      return;
    }

    const textarea = document.getElementById('supportReplyBox');
    const reply = String(textarea?.value || '').trim();
    if (!reply) {
      notify(i18n('admin_write_reply_first'), 'error');
      return;
    }

    await window.RimalisAPI.request(`/admin/messages/${encodeURIComponent(selected.id)}/reply`, {
      method: 'POST',
      auth: true,
      body: JSON.stringify({ reply }),
    });

    if (textarea) textarea.value = '';
    await loadData({ preserveSelection: true });
    notify(i18n('admin_reply_sent'), 'success');
  }

  async function saveMeta() {
    const selected = findMessage(selectedMessageId);
    if (!selected) return;

    const assigneeUserId = document.getElementById('supportDetailAssignee')?.value || null;
    const status = document.getElementById('supportDetailStatus')?.value || 'open';
    const priority = document.getElementById('supportDetailPriority')?.value || 'normal';

    await window.RimalisAPI.request(`/admin/messages/${encodeURIComponent(selected.id)}/meta`, {
      method: 'PATCH',
      auth: true,
      body: JSON.stringify({ assigneeUserId: assigneeUserId || null, status, priority }),
    });
    await loadData({ preserveSelection: true });
    notify('Meta saved', 'success');
  }

  async function addNote() {
    const selected = findMessage(selectedMessageId);
    if (!selected) return;

    const input = document.getElementById('supportNoteInput');
    const note = String(input?.value || '').trim();
    if (!note) {
      notify('Write a note first', 'error');
      return;
    }

    const body = await window.RimalisAPI.request(`/admin/messages/${encodeURIComponent(selected.id)}/notes`, {
      method: 'POST',
      auth: true,
      body: JSON.stringify({ note }),
    });
    if (input) input.value = '';
    renderNotes(body?.notes || []);
    await loadData({ preserveSelection: true });
    notify('Note added', 'success');
  }

  function applyMacroToReply() {
    const id = document.getElementById('supportMacroSelect')?.value || '';
    if (!id) return;
    const macro = macros.find((m) => m.id === id);
    if (!macro) return;
    const selected = findMessage(selectedMessageId);
    const name = selected?.thread?.contact?.name || selected?.userName || 'kund';
    const subject = String(selected?.subject || '');
    const refMatch = subject.match(/\(([A-Z0-9-]{4,})\)/i);
    const ref = refMatch?.[1] || selected?.propertyId || '-';
    const text = String(macro.body || '')
      .replaceAll('{namn}', name)
      .replaceAll('{annons_ref}', ref);
    const box = document.getElementById('supportReplyBox');
    if (box) box.value = text;
  }

  async function saveMacro() {
    const name = String(document.getElementById('supportMacroName')?.value || '').trim();
    const body = String(document.getElementById('supportReplyBox')?.value || '').trim();
    if (!name || !body) {
      notify('Macro name and reply text are required', 'error');
      return;
    }

    await window.RimalisAPI.request('/admin/support/macros', {
      method: 'POST',
      auth: true,
      body: JSON.stringify({ name, body }),
    });
    document.getElementById('supportMacroName').value = '';
    await loadData({ preserveSelection: true });
    notify('Macro saved', 'success');
  }

  async function applyBulk() {
    const ids = Array.from(selectedIds);
    if (!ids.length) {
      notify('Select at least one thread', 'error');
      return;
    }
    const action = document.getElementById('supportBulkAction')?.value || '';
    if (!action) {
      notify('Select bulk action first', 'error');
      return;
    }

    const assigneeValue = document.getElementById('supportBulkAssignee')?.value || '';
    const macroText = String(document.getElementById('supportBulkMacroText')?.value || '').trim();

    const payload = { messageIds: ids, action };
    if (action === 'assign') payload.assigneeUserId = assigneeValue === '__unassign__' ? null : (assigneeValue || null);
    if (action === 'reply_macro') payload.macroText = macroText;

    const body = await window.RimalisAPI.request('/admin/messages/bulk', {
      method: 'POST',
      auth: true,
      body: JSON.stringify(payload),
    });

    selectedIds = new Set();
    await loadData({ preserveSelection: true });
    notify(`Bulk done: ${body?.result?.changed || 0}/${ids.length}`, 'success');
  }

  function saveCurrentView() {
    const name = window.prompt('Name this view');
    if (!name) return;
    const safeName = String(name).trim();
    if (!safeName) return;

    const data = getSavedViews();
    data[safeName] = {
      search: String(document.getElementById('supportSearch')?.value || ''),
      state: String(document.getElementById('supportStateFilter')?.value || 'all'),
      assignee: String(document.getElementById('supportAssigneeFilter')?.value || 'all'),
      sort: String(document.getElementById('supportSort')?.value || 'newest'),
    };
    saveSavedViews(data);
    populateSavedViews();
    notify('View saved', 'success');
  }

  function bindEvents() {
    document.getElementById('supportSearch')?.addEventListener('input', renderAll);
    document.getElementById('supportStateFilter')?.addEventListener('change', renderAll);
    document.getElementById('supportAssigneeFilter')?.addEventListener('change', renderAll);
    document.getElementById('supportSort')?.addEventListener('change', renderAll);

    document.getElementById('supportSavedView')?.addEventListener('change', (event) => {
      const value = String(event.target.value || 'default');
      const handled = applyPresetView(value);
      if (!handled) renderAll();
    });
    document.getElementById('supportSaveViewBtn')?.addEventListener('click', saveCurrentView);

    document.getElementById('supportSelectAll')?.addEventListener('change', (event) => {
      const checked = Boolean(event.target.checked);
      filteredMessages.forEach((m) => {
        if (checked) selectedIds.add(m.id);
        else selectedIds.delete(m.id);
      });
      renderAll();
    });

    document.getElementById('supportList')?.addEventListener('click', async (event) => {
      const check = event.target.closest('[data-select-id]');
      if (check) {
        const id = check.getAttribute('data-select-id');
        if (id) {
          if (check.checked) selectedIds.add(id);
          else selectedIds.delete(id);
        }
        return;
      }

      const card = event.target.closest('[data-ticket-id]');
      if (!card) return;
      const messageId = card.getAttribute('data-ticket-id');
      if (!messageId) return;

      selectedMessageId = messageId;
      renderAll();
      loadNotes(messageId).catch(() => {});

      const selected = findMessage(messageId);
      if (selected?.state === 'unread') {
        try { await markRead(messageId); } catch (_) {}
      }
    });

    document.getElementById('refreshSupportBtn')?.addEventListener('click', async () => {
      try {
        await loadData({ preserveSelection: true });
        notify(i18n('admin_support_refresh_success'), 'success');
      } catch (err) {
        notify(err.message || i18n('admin_support_load_failed'), 'error');
      }
    });

    document.getElementById('supportMarkAllReadBtn')?.addEventListener('click', async () => {
      try {
        await markAllRead();
        notify(i18n('admin_unread_marked_read'), 'success');
      } catch (err) {
        notify(err.message || i18n('admin_support_mark_read_failed'), 'error');
      }
    });

    document.getElementById('supportMarkReadBtn')?.addEventListener('click', async () => {
      if (!selectedMessageId) return notify(i18n('admin_select_message_first'), 'error');
      try {
        await markRead(selectedMessageId);
        notify(i18n('admin_support_marked_read'), 'success');
      } catch (err) {
        notify(err.message || i18n('admin_support_mark_read_failed'), 'error');
      }
    });

    document.getElementById('supportSendReplyBtn')?.addEventListener('click', async () => {
      try { await sendReply(); } catch (err) { notify(err.message || i18n('admin_send_reply_failed'), 'error'); }
    });

    document.getElementById('supportOpenInboxBtn')?.addEventListener('click', () => {
      window.location.href = 'messages.html';
    });

    document.getElementById('supportSaveMetaBtn')?.addEventListener('click', async () => {
      try { await saveMeta(); } catch (err) { notify(err.message || 'Could not save meta', 'error'); }
    });

    document.getElementById('supportAddNoteBtn')?.addEventListener('click', async () => {
      try { await addNote(); } catch (err) { notify(err.message || 'Could not add note', 'error'); }
    });

    document.getElementById('supportMacroSelect')?.addEventListener('change', applyMacroToReply);
    document.getElementById('supportSaveMacroBtn')?.addEventListener('click', async () => {
      try { await saveMacro(); } catch (err) { notify(err.message || 'Could not save macro', 'error'); }
    });

    document.getElementById('supportApplyBulkBtn')?.addEventListener('click', async () => {
      try { await applyBulk(); } catch (err) { notify(err.message || 'Could not apply bulk', 'error'); }
    });
  }

  function startAutoRefresh() {
    if (refreshTimer) return;
    refreshTimer = window.setInterval(() => {
      loadData({ preserveSelection: true }).catch(() => {});
    }, 30000);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await ensureI18nReady();
    if (!window.RimalisAPI) return;

    bindEvents();

    try {
      await loadData({ preserveSelection: false });
      startAutoRefresh();
    } catch (err) {
      notify(err.message || i18n('admin_support_load_failed'), 'error');
    }

    if (window.AdminLive?.onEvent) {
      window.AdminLive.onEvent((event) => {
        if (!event || event.type !== 'support.updated') return;
        loadData({ preserveSelection: true }).catch(() => {});
      });
    }
  });

  window.addEventListener('rimalis:language-changed', async () => {
    await ensureI18nReady();
    renderAll();
  });
})();
