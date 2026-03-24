// ===== MOBILE USER MESSAGES (FULLSCREEN CHAT) =====

let allMessagesState = [];
let selectedMessageId = null;
let activeTab = 'all';
let chatSearch = '';
const PENDING_CHAT_THREAD_KEY = 'rimalis_pending_chat_thread';
const propertyDetailCache = new Map();

document.addEventListener('DOMContentLoaded', function () {
  bindMessagesChrome();
});

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

function bindMessagesChrome() {
  const backBtn = document.getElementById('mobileMessagesBackBtn');
  const newChatBtn = document.getElementById('mobileMessagesNewChatBtn');
  const closeModalBtn = document.getElementById('mobileMessagesCloseModalBtn');
  const modal = document.getElementById('newChatModal');

  backBtn?.addEventListener('click', function () {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = 'dashboard.html';
  });

  newChatBtn?.addEventListener('click', function () {
    window.toggleModal?.();
  });

  closeModalBtn?.addEventListener('click', function () {
    window.toggleModal?.();
  });

  modal?.addEventListener('click', function (event) {
    if (event.target === modal) window.toggleModal?.();
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      if (modal?.classList.contains('show')) {
        window.toggleModal?.(false);
        return;
      }
      closeMobileChatDetail();
    }
  });
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

function getRequestedThreadId() {
  try {
    const params = new URLSearchParams(window.location.search);
    const queryThread = String(params.get('thread') || '').trim();
    const storedThread = String(localStorage.getItem(PENDING_CHAT_THREAD_KEY) || '').trim();
    return queryThread || storedThread || '';
  } catch (_err) {
    return '';
  }
}

function consumeRequestedThreadId() {
  try {
    localStorage.removeItem(PENDING_CHAT_THREAD_KEY);
  } catch (_err) {
    // ignore
  }
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has('thread')) {
      url.searchParams.delete('thread');
      window.history.replaceState({}, '', url.toString());
    }
  } catch (_err) {
    // ignore
  }
}

function getInitials(label) {
  return String(label || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '--';
}

function deriveMessageName(message) {
  return message.senderName || message.authorName || message.subject || i18n('message', 'Meddelande');
}

function derivePropertyLabel(message) {
  return String(message.propertyTitle || message.subject || '').trim();
}

function derivePropertyImage(message) {
  return message.propertyImage || message.imageUrl || '';
}

function formatPrice(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return '';
  if (window.RimalisI18n?.formatCurrencySEK) return window.RimalisI18n.formatCurrencySEK(amount, { compact: false });
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

function formatCount(value, suffix) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return '';
  return `${window.RimalisI18n?.formatNumber?.(amount) || amount} ${suffix}`;
}

function derivePropertyLocation(details, message) {
  return String(
    details?.address
      || details?.location
      || message.propertyLocation
      || message.location
      || ''
  ).trim();
}

async function getPropertyContextDetails(message) {
  const propertyId = String(message?.propertyId || '').trim();
  if (!propertyId || !window.RimalisAPI) return null;
  if (propertyDetailCache.has(propertyId)) return propertyDetailCache.get(propertyId);

  try {
    const body = await window.RimalisAPI.request(`/properties/${encodeURIComponent(propertyId)}`);
    const property = body?.property || body || null;
    propertyDetailCache.set(propertyId, property);
    return property;
  } catch (_err) {
    propertyDetailCache.set(propertyId, null);
    return null;
  }
}

function previewSnippet(message) {
  return String(message.content || '').trim() || i18n('user_no_messages_yet');
}

function deriveMessageType(message) {
  const name = deriveMessageName(message).toLowerCase();
  return /mäkl|agent|broker|fastighet/.test(name) ? 'agent' : 'private';
}

function appendIcon(parent, classes) {
  const icon = document.createElement('i');
  icon.className = classes;
  parent.appendChild(icon);
  return icon;
}

function createBookingCard() {
  const card = document.createElement('div');
  card.className = 'message-booking-card';

  const title = document.createElement('div');
  title.className = 'message-booking-card__title';
  appendIcon(title, 'fas fa-calendar-alt');
  title.appendChild(document.createTextNode(' Boka visning'));

  const slots = document.createElement('div');
  slots.className = 'message-booking-slots';
  [
    ['Tisdag', '14:00'],
    ['Onsdag', '16:30'],
    ['Torsdag', '10:00'],
    ['Fredag', '13:00'],
  ].forEach(([day, time]) => {
    const button = document.createElement('button');
    button.className = 'message-booking-slot';
    button.type = 'button';
    button.appendChild(document.createTextNode(day));
    const timeNode = document.createElement('span');
    timeNode.textContent = time;
    button.appendChild(timeNode);
    slots.appendChild(button);
  });

  const confirm = document.createElement('button');
  confirm.className = 'message-booking-confirm';
  confirm.type = 'button';
  confirm.textContent = 'Bekräfta vald tid';

  card.append(title, slots, confirm);
  return card;
}

function createMessagesEmptyState() {
  const box = document.createElement('div');
  box.className = 'empty-state';

  const iconWrap = document.createElement('div');
  iconWrap.className = 'empty-icon';
  appendIcon(iconWrap, 'fas fa-comment');

  const title = document.createElement('div');
  title.className = 'empty-title';
  title.textContent = i18n('user_no_messages_yet', 'Inga meddelanden ännu');

  const body = document.createElement('div');
  body.className = 'empty-text';
  body.textContent = i18n('user_no_messages_yet');

  const button = document.createElement('button');
  button.className = 'start-chat-btn';
  button.type = 'button';
  button.dataset.action = 'open-new-chat';
  button.textContent = i18n('user_start_chat', 'Starta chat');

  box.append(iconWrap, title, body, button);
  return box;
}

function createNewChatContactItem(message) {
  const name = deriveMessageName(message);
  const subtitle = derivePropertyLabel(message) || previewSnippet(message);
  const item = document.createElement('div');
  item.className = 'contact-item';

  const avatar = document.createElement('div');
  avatar.className = 'contact-avatar';
  avatar.textContent = getInitials(name);

  const info = document.createElement('div');
  info.className = 'contact-info';
  const title = document.createElement('h4');
  title.textContent = name;
  const meta = document.createElement('p');
  meta.textContent = subtitle;
  info.append(title, meta);

  item.append(avatar, info);
  item.addEventListener('click', function () {
    selectedMessageId = message.id;
    renderMessages();
    openMobileChatDetail(message);
    window.toggleModal(false);
  });

  return item;
}

function filteredMessages() {
  const base = sortedMessages().filter((message) => {
    const name = deriveMessageName(message).toLowerCase();
    const content = String(message.content || '').toLowerCase();
    if (chatSearch && !`${name} ${content}`.includes(chatSearch)) return false;
    if (activeTab === 'unread' && message.state === 'read') return false;
    return true;
  });
  return base;
}

function renderMessageList(parent, selectedId) {
  parent.textContent = '';
  filteredMessages().forEach((message) => {
    const active = message.id === selectedId;
    const unread = message.state !== 'read';
    const name = deriveMessageName(message);
    const previewText = previewSnippet(message);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = `chat-item ${unread ? 'unread' : ''} ${active ? 'active' : ''}`;
    button.dataset.action = 'select-message';
    button.dataset.messageId = String(message.id || '');

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    const avatarImage = document.createElement('div');
    avatarImage.className = 'avatar-image';
    avatarImage.textContent = getInitials(name);
    avatar.appendChild(avatarImage);
    if (deriveMessageType(message) === 'agent') {
      const online = document.createElement('span');
      online.className = 'online-indicator';
      avatar.appendChild(online);
    }

    const content = document.createElement('div');
    content.className = 'chat-info';

    const header = document.createElement('div');
    header.className = 'chat-header-row';
    const title = document.createElement('span');
    title.className = 'chat-name';
    title.textContent = name;
    const date = document.createElement('span');
    date.className = 'chat-time';
    date.textContent = formatDateTime(message.createdAt);
    header.appendChild(title);
    header.appendChild(date);

    const preview = document.createElement('div');
    preview.className = 'chat-preview';
    const previewBody = document.createElement('div');
    previewBody.className = 'preview-text';
    previewBody.textContent = previewText;
    preview.appendChild(previewBody);
    if (unread) {
      const badge = document.createElement('span');
      badge.className = 'unread-badge';
      badge.textContent = String((message.thread || []).filter((item) => item.authorType !== 'owner').length || 1);
      preview.appendChild(badge);
    }

    const propertyTitle = derivePropertyLabel(message);
    const propertyImage = derivePropertyImage(message);
    content.appendChild(header);
    content.appendChild(preview);
    if (propertyTitle && propertyImage) {
      const propertyPreview = document.createElement('div');
      propertyPreview.className = 'property-preview';
      const thumb = document.createElement('img');
      thumb.src = propertyImage;
      thumb.alt = propertyTitle;
      const label = document.createElement('span');
      label.textContent = propertyTitle;
      propertyPreview.appendChild(thumb);
      propertyPreview.appendChild(label);
      content.appendChild(propertyPreview);
    }
    button.appendChild(avatar);
    button.appendChild(content);

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
        authorName: message.senderName || deriveMessageName(message),
        content: previewSnippet(message),
        createdAt: message.createdAt,
      }];

  parent.textContent = '';
  const scroll = document.createElement('div');
  scroll.className = 'messages-stack';
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
    const row = document.createElement('div');
    row.className = `message-row ${reply.authorType === 'owner' ? 'own' : ''}`;
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = getInitials(reply.authorType === 'owner' ? 'Du' : (reply.authorName || deriveMessageName(message)));
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    const text = document.createElement('div');
    text.className = 'message-text';
    text.textContent = reply.content || '';
    const time = document.createElement('div');
    time.className = 'message-time';
    time.textContent = formatDateTime(reply.createdAt);
    bubble.appendChild(text);
    bubble.appendChild(time);

    if (reply.authorType !== 'owner' && /visning|boka|ledig tid|nästa vecka/i.test(String(reply.content || ''))) {
      bubble.appendChild(createBookingCard());
    }

    row.appendChild(avatar);
    row.appendChild(bubble);
    scroll.appendChild(row);
  });

  parent.appendChild(scroll);
}

function closeMobileChatDetail() {
  const detail = document.getElementById('mobileChatDetail');
  if (!detail) return;
  detail.classList.remove('active');
  document.body.classList.remove('mobile-chat-open');
}

async function markThreadRead(message) {
  if (!message || message.state === 'read' || !window.RimalisAPI) return;
  try {
    await window.RimalisAPI.request(`/messages/me/${encodeURIComponent(message.id)}/read`, {
      method: 'PATCH',
      auth: true,
    });
    const target = allMessagesState.find((item) => String(item.id) === String(message.id));
    if (target) target.state = 'read';
    renderMessages();
    document.dispatchEvent(new CustomEvent('rimalis:messages-updated'));
  } catch (_err) {
    // ignore read-mark failure
  }
}

async function openMobileChatDetail(message) {
  const detail = document.getElementById('mobileChatDetail');
  const messagesHost = document.getElementById('mobileChatMessages');
  if (!detail || !messagesHost) return;

  const name = deriveMessageName(message);
  const avatar = document.getElementById('mobileChatDetailAvatar');
  const title = document.getElementById('mobileChatDetailName');
  const meta = document.getElementById('mobileChatDetailMeta');
  const context = document.getElementById('mobileChatContext');
  const contextTitle = document.getElementById('mobileChatContextTitle');
  const contextMeta = document.getElementById('mobileChatContextMeta');
  const contextImage = document.getElementById('mobileChatContextImage');
  const contextImageFallback = document.getElementById('mobileChatContextFallback');
  const contextSpecs = document.getElementById('mobileChatContextSpecs');
  const contextArea = document.getElementById('mobileChatContextArea');
  const contextRooms = document.getElementById('mobileChatContextRooms');
  const composerInput = document.getElementById('threadReplyText');
  const propertyTitle = derivePropertyLabel(message);
  const propertyImage = derivePropertyImage(message);
  const latestReply = Array.isArray(message.thread) && message.thread.length
    ? message.thread[message.thread.length - 1]
    : null;
  const propertyDetails = await getPropertyContextDetails(message);
  const location = derivePropertyLocation(propertyDetails, message) || previewSnippet(message);
  const areaValue = formatCount(propertyDetails?.livingArea ?? propertyDetails?.listingDetails?.area ?? propertyDetails?.area, i18n('unit_sqm', 'm²'));
  const roomsValue = formatCount(propertyDetails?.rooms ?? propertyDetails?.listingDetails?.rooms, i18n('property_feature_rooms', 'rum'));
  const priceValue = formatPrice(propertyDetails?.price);

  if (avatar) avatar.textContent = getInitials(name);
  if (title) title.textContent = name;
  if (meta) meta.textContent = latestReply ? formatDateTime(latestReply.createdAt) : formatDateTime(message.createdAt);
  if (context && !propertyTitle && !propertyImage && !propertyDetails) {
    context.hidden = true;
  } else if (context) {
    context.hidden = false;
  }
  if (contextTitle) contextTitle.textContent = priceValue || propertyTitle || i18n('message', 'Meddelande');
  if (contextMeta) contextMeta.textContent = location || propertyTitle || previewSnippet(message);
  if (contextImage && contextImageFallback) {
    if (propertyImage) {
      contextImage.hidden = false;
      contextImage.src = propertyImage;
      contextImage.alt = propertyTitle || i18n('message', 'Meddelande');
      contextImageFallback.hidden = true;
    } else {
      contextImage.hidden = true;
      contextImage.removeAttribute('src');
      contextImageFallback.hidden = false;
      contextImageFallback.textContent = getInitials(propertyTitle || name);
    }
  }
  if (contextSpecs && contextArea && contextRooms) {
    const areaLabel = contextArea.querySelector('span');
    const roomsLabel = contextRooms.querySelector('span');
    contextArea.hidden = !areaValue;
    contextRooms.hidden = !roomsValue;
    if (areaLabel) areaLabel.textContent = areaValue;
    if (roomsLabel) roomsLabel.textContent = roomsValue;
    contextSpecs.hidden = !areaValue && !roomsValue;
  }
  if (composerInput) composerInput.placeholder = i18n('user_write_reply');

  renderConversation(messagesHost, message);
  detail.classList.add('active');
  document.body.classList.add('mobile-chat-open');
  markThreadRead(message);

  const scroll = document.getElementById('threadMessagesScroll');
  if (scroll) scroll.scrollTop = scroll.scrollHeight;
}

function renderMessages() {
  const container = document.getElementById('userMessagesList');
  if (!container) return;

  const sorted = sortedMessages();
  if (!selectedMessageId || !sorted.find((m) => m.id === selectedMessageId)) {
    selectedMessageId = sorted[0]?.id || null;
  }

  const selected = sorted.find((m) => m.id === selectedMessageId);
  const unreadCount = sorted.filter((m) => m.state !== 'read').length;
  const unreadBadge = document.getElementById('messagesUnreadBadge');
  if (unreadBadge) unreadBadge.textContent = String(unreadCount);

  if (!selected) {
    const box = createMessagesEmptyState();
    container.textContent = '';
    container.appendChild(box);
    closeMobileChatDetail();
    return;
  }

  container.textContent = '';
  renderMessageList(container, selected.id);
}

async function hydrateMessages() {
  if (!window.RimalisAPI) return;

  const response = await window.RimalisAPI.request('/messages/me', { auth: true });
  allMessagesState = Array.isArray(response.messages)
    ? response.messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    : [];
  const requestedThreadId = getRequestedThreadId();
  if (requestedThreadId) {
    const requested = allMessagesState.find((message) => String(message.id) === requestedThreadId);
    if (requested) {
      selectedMessageId = requested.id;
      renderMessages();
      openMobileChatDetail(requested);
      consumeRequestedThreadId();
      return;
    }
  }
  renderMessages();
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

async function deleteCurrentThread() {
  const selected = allMessagesState.find((m) => String(m.id) === String(selectedMessageId));
  if (!selected) return;

  const confirmed = window.confirm(i18n('user_confirm_delete_message', 'Ta bort den här chatten?'));
  if (!confirmed) return;

  await window.RimalisAPI.request(`/messages/me/${encodeURIComponent(selected.id)}`, {
    method: 'DELETE',
    auth: true,
  });

  allMessagesState = allMessagesState.filter((message) => String(message.id) !== String(selected.id));
  selectedMessageId = allMessagesState[0]?.id || null;
  renderMessages();
  closeMobileChatDetail();
  notify(i18n('user_message_deleted', 'Chatten togs bort'), 'success');
}

function bindEvents() {
  const container = document.getElementById('userMessagesList');
  const detail = document.getElementById('mobileChatDetail');
  const backButton = document.getElementById('mobileChatBackButton');
  if (!container) return;

  container.addEventListener('click', async function (event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;

    if (button.dataset.action === 'select-message') {
      selectedMessageId = button.dataset.messageId || null;
      renderMessages();
      const selected = allMessagesState.find((message) => String(message.id) === String(selectedMessageId));
      if (selected) await openMobileChatDetail(selected);
      return;
    }

    if (button.dataset.action === 'open-new-chat') {
      window.toggleModal?.(true);
    }
  });

  detail?.addEventListener('click', async function (event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    if (button.dataset.action === 'send-thread-reply') {
      try {
        await sendReplyToCurrentThread();
        const selected = allMessagesState.find((message) => message.id === selectedMessageId);
        if (selected) await openMobileChatDetail(selected);
      } catch (error) {
        notify(error.message || i18n('user_reply_failed'), 'error');
      }
      return;
    }

    if (button.dataset.action === 'delete-thread') {
      try {
        await deleteCurrentThread();
      } catch (error) {
        notify(error.message || i18n('user_delete_message_failed', 'Kunde inte ta bort chatten'), 'error');
      }
    }
  });

  backButton?.addEventListener('click', closeMobileChatDetail);

  document.getElementById('searchChats')?.addEventListener('input', function (event) {
    chatSearch = String(event.target.value || '').trim().toLowerCase();
    renderMessages();
  });

  document.querySelectorAll('#chatTabs [data-tab]').forEach((tab) => {
    tab.addEventListener('click', function () {
      activeTab = tab.dataset.tab || 'all';
      document.querySelectorAll('#chatTabs [data-tab]').forEach((item) => item.classList.toggle('active', item === tab));
      renderMessages();
    });
  });
}

document.addEventListener('DOMContentLoaded', function () {
  (async function () {
    await ensureI18nReady();
    bindEvents();
    try {
      await hydrateMessages();
    } catch (error) {
      notify(error.message || i18n('user_could_not_load_messages'), 'error');
    }
  })();
});

window.addEventListener('rimalis:language-changed', async function () {
  await ensureI18nReady();
  renderMessages();
});

window.toggleModal = function toggleModal(forceState) {
  const modal = document.getElementById('newChatModal');
  if (!modal) return;

  const shouldOpen = typeof forceState === 'boolean'
    ? forceState
    : !modal.classList.contains('show');

  modal.classList.toggle('show', shouldOpen);
  document.body.classList.toggle('mobile-chat-open', shouldOpen || document.getElementById('mobileChatDetail')?.classList.contains('active'));
  renderNewChatContacts();
};

function renderNewChatContacts() {
  const list = document.getElementById('newChatContactList');
  const searchInput = document.getElementById('newChatSearchInput');
  if (!list) return;
  const query = String(searchInput?.value || '').trim().toLowerCase();
  const contacts = filteredMessages()
    .filter((message) => {
      const name = deriveMessageName(message).toLowerCase();
      return !query || name.includes(query);
    })
    .slice(0, 8);
  list.textContent = '';
  if (!contacts.length) {
    const empty = document.createElement('div');
    empty.className = 'contact-empty';
    empty.textContent = i18n('user_no_messages_yet', 'Inga meddelanden ännu.');
    list.appendChild(empty);
    return;
  }
  contacts.forEach((message) => {
    list.appendChild(createNewChatContactItem(message));
  });
}

document.getElementById('newChatSearchInput')?.addEventListener('input', renderNewChatContacts);
