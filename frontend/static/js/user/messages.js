// ===== USER MESSAGES (THREAD VIEW, REAL BACKEND THREADS) =====

let allMessagesState = [];
let selectedMessageId = null;

async function ensureI18nReady() {
  if (typeof window.RimalisI18n?.ready === 'function') {
    try {
      await window.RimalisI18n.ready();
    } catch (_err) {
      // Keep page usable even if i18n failed
    }
  }
}

function i18n(key, fallback = key) {
  return window.RimalisI18n?.t?.(key, fallback) || fallback;
}

function notify(message, type = 'info') {
  if (typeof window.showNotification === 'function') {
    window.showNotification(message, type);
    return;
  }
  if (type === 'error') console.error(message);
  else console.log(message);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDateTime(dateLike) {
  return window.RimalisI18n?.formatDateTime?.(dateLike) || '-';
}

function formatDayLabel(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return i18n('today', 'Idag');
  const now = new Date();
  const sameDay = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
  if (sameDay) return i18n('today', 'Idag');
  return date.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });
}

function sortedMessages() {
  return [...allMessagesState].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function getInitials(label) {
  return String(label || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'RG';
}

function renderMessageList(parent, selectedId) {
  parent.textContent = '';
  sortedMessages().forEach((message) => {
    const active = message.id === selectedId;
    const unread = message.state !== 'read';
    const name = message.senderName || message.authorName || message.subject || i18n('message');
    const previewText = message.content || i18n('user_no_messages_yet');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `w-full rounded-2xl border px-4 py-3 text-left transition-all mobile-message-list-item ${
      active
        ? 'border-[#e2ff31] bg-[#e2ff31]/10'
        : 'border-white/10 hover:border-[#e2ff31]/40 hover:bg-white/5'
    }`;
    button.dataset.action = 'select-message';
    button.dataset.messageId = String(message.id || '');

    const row = document.createElement('div');
    row.className = 'mobile-message-list-item__row';

    const avatar = document.createElement('div');
    avatar.className = 'mobile-message-list-item__avatar';
    avatar.textContent = getInitials(name);

    const content = document.createElement('div');
    content.className = 'mobile-message-list-item__content';

    const header = document.createElement('div');
    header.className = 'mobile-message-list-item__header';
    const title = document.createElement('div');
    title.className = 'line-clamp-1 text-sm font-bold';
    title.textContent = name;
    const date = document.createElement('div');
    date.className = 'mt-1 text-xs text-white/50';
    date.textContent = formatDateTime(message.createdAt);
    header.appendChild(title);
    header.appendChild(date);

    const preview = document.createElement('div');
    preview.className = 'mobile-message-list-item__preview';
    preview.textContent = previewText;

    content.appendChild(header);
    content.appendChild(preview);
    row.appendChild(avatar);
    row.appendChild(content);
    button.appendChild(row);

    if (unread) {
      const badge = document.createElement('span');
      badge.className = 'mobile-message-list-item__badge';
      badge.textContent = '2';
      button.appendChild(badge);
    }
    parent.appendChild(button);
  });
}

function threadBubbleNode(reply) {
  const kind = reply.authorType || 'public';
  const who = kind === 'admin' ? i18n('admin') : kind === 'owner' ? i18n('seller', 'Säljare') : (reply.authorName || i18n('buyer', 'Köpare'));
  const bubbleClass = kind === 'owner'
    ? 'border-cyan-300/40 bg-cyan-300/10'
    : kind === 'admin'
      ? 'border-[#e2ff31]/35 bg-[#e2ff31]/10'
      : 'border-white/10 bg-white/5';

  const article = document.createElement('article');
  article.className = `rounded-2xl border px-4 py-3 ${bubbleClass}`;
  article.dataset.kind = kind;
  const meta = document.createElement('div');
  meta.className = 'mb-1 text-[11px] text-white/50';
  meta.textContent = `${who} • ${formatDateTime(reply.createdAt)}`;
  const text = document.createElement('p');
  text.className = 'whitespace-pre-line text-sm';
  text.textContent = reply.content || '';
  article.appendChild(meta);
  article.appendChild(text);
  return article;
}

function renderConversation(parent, message) {
  const thread = Array.isArray(message.thread) && message.thread.length
    ? message.thread
    : [{
        id: `${message.id}-legacy`,
        authorType: 'public',
        authorName: message.senderName || i18n('buyer', 'Köpare'),
        content: message.content || '',
        createdAt: message.createdAt,
      }];
  parent.textContent = '';
  const scroll = document.createElement('div');
  scroll.className = 'max-h-[420px] space-y-3 overflow-auto pr-1';
  scroll.id = 'threadMessagesScroll';
  let lastDayLabel = '';
  thread.forEach((reply) => {
    const dayLabel = formatDayLabel(reply.createdAt);
    if (dayLabel !== lastDayLabel) {
      lastDayLabel = dayLabel;
      const divider = document.createElement('div');
      divider.className = 'mobile-chat-date-divider';
      const pill = document.createElement('span');
      pill.textContent = dayLabel;
      divider.appendChild(pill);
      scroll.appendChild(divider);
    }
    scroll.appendChild(threadBubbleNode(reply));
  });
  const typing = document.createElement('div');
  typing.className = 'mobile-chat-typing';
  for (let i = 0; i < 3; i += 1) {
    typing.appendChild(document.createElement('span'));
  }
  scroll.appendChild(typing);
  parent.appendChild(scroll);
}

function closeMobileChatDetail() {
  const detail = document.getElementById('mobileChatDetail');
  if (!detail) return;
  detail.hidden = true;
  document.body.classList.remove('mobile-chat-open');
}

function openMobileChatDetail(message) {
  const detail = document.getElementById('mobileChatDetail');
  const messagesHost = document.getElementById('mobileChatMessages');
  if (!detail || !messagesHost) return;

  const name = message.senderName || message.authorName || message.subject || i18n('message');
  const avatar = document.getElementById('mobileChatDetailAvatar');
  const title = document.getElementById('mobileChatDetailName');
  const meta = document.getElementById('mobileChatDetailMeta');
  const contextTitle = document.getElementById('mobileChatContextTitle');
  const contextMeta = document.getElementById('mobileChatContextMeta');
  const contextImage = document.getElementById('mobileChatContextImage');
  const composerInput = document.getElementById('threadReplyText');

  if (avatar) avatar.textContent = getInitials(name);
  if (title) title.textContent = name;
  if (meta) meta.textContent = message.state !== 'read' ? i18n('user_unread_messages', 'Oläst meddelande') : formatDateTime(message.createdAt);
  if (contextTitle) contextTitle.textContent = message.subject || i18n('message');
  if (contextMeta) contextMeta.textContent = message.content || formatDateTime(message.createdAt);
  if (contextImage) {
    contextImage.src = message.propertyImage || message.imageUrl || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=200';
    contextImage.alt = message.subject || i18n('message');
  }
  if (composerInput) composerInput.placeholder = i18n('user_write_reply');

  renderConversation(messagesHost, message);
  detail.hidden = false;
  document.body.classList.add('mobile-chat-open');

  const scroll = document.getElementById('threadMessagesScroll');
  if (scroll) scroll.scrollTop = scroll.scrollHeight;
}

function renderMessages() {
  const container = document.getElementById('userMessagesList');
  const unreadText = document.getElementById('messagesUnreadText');
  if (!container) return;

  const sorted = sortedMessages();
  if (!selectedMessageId || !sorted.find((m) => m.id === selectedMessageId)) {
    selectedMessageId = sorted[0]?.id || null;
  }

  const selected = sorted.find((m) => m.id === selectedMessageId);
  const unreadCount = sorted.filter((m) => m.state !== 'read').length;
  if (unreadText) {
    unreadText.textContent = `${i18n('user_you_have')} ${unreadCount} ${i18n('user_unread_messages')}`;
  }

  if (!selected) {
    const box = document.createElement('div');
    box.className = 'p-8 text-white/60';
    box.textContent = i18n('user_no_messages_yet');
    container.textContent = '';
    container.appendChild(box);
    closeMobileChatDetail();
    return;
  }

  container.textContent = '';
  const list = document.createElement('section');
  list.className = 'grid gap-6 p-4 lg:grid-cols-3';
  const aside = document.createElement('aside');
  aside.className = 'max-h-[620px] space-y-2 overflow-auto pr-1 lg:col-span-1';
  renderMessageList(aside, selected.id);
  list.appendChild(aside);
  container.appendChild(list);
}

async function hydrateMessages() {
  if (!window.RimalisAPI) return;
  const loadMoreBtn = document.getElementById('userMessagesLoadMoreBtn');

  const response = await window.RimalisAPI.request('/messages/me', { auth: true });
  allMessagesState = Array.isArray(response.messages)
    ? response.messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    : [];
  renderMessages();

  if (loadMoreBtn) loadMoreBtn.style.display = 'none';
}

async function sendReplyToCurrentThread() {
  const selected = allMessagesState.find((m) => m.id === selectedMessageId);
  if (!selected) return;

  const input = document.getElementById('threadReplyText');
  const content = String(input?.value || '').trim();
  if (!content) {
    notify(i18n('user_fill_message'), 'error');
    return;
  }

  await window.RimalisAPI.request(`/messages/me/${selected.id}/reply`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ content }),
  });

  if (input) input.value = '';
  notify(i18n('user_reply_sent'), 'success');
  await hydrateMessages();
}

function bindEvents() {
  const container = document.getElementById('userMessagesList');
  const detail = document.getElementById('mobileChatDetail');
  const backButton = document.getElementById('mobileChatBackButton');
  if (!container) return;

  container.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;

    const action = button.dataset.action;

    if (action === 'select-message') {
      selectedMessageId = button.dataset.messageId || null;
      renderMessages();
      const selected = allMessagesState.find((message) => String(message.id) === String(selectedMessageId));
      if (selected) openMobileChatDetail(selected);
      return;
    }
  });

  detail?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    if (button.dataset.action === 'send-thread-reply') {
      try {
        await sendReplyToCurrentThread();
        const selected = allMessagesState.find((message) => message.id === selectedMessageId);
        if (selected) openMobileChatDetail(selected);
      } catch (error) {
        notify(error.message || i18n('user_reply_failed'), 'error');
      }
    }
  });

  backButton?.addEventListener('click', closeMobileChatDetail);
}

document.addEventListener('DOMContentLoaded', () => {
  (async () => {
    await ensureI18nReady();
    bindEvents();
    try {
      await hydrateMessages();
    } catch (error) {
      notify(error.message || i18n('user_could_not_load_messages'), 'error');
    }
  })();
});

window.addEventListener('rimalis:language-changed', async () => {
  await ensureI18nReady();
  renderMessages();
});
