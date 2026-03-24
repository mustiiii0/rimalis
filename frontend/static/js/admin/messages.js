(function () {
  let allMessages = [];
  let selectedMessageId = null;

  function i18n(key) {
    return window.RimalisI18n?.t?.(key, key) || key;
  }

  function notify(message) {
    if (window.showNotification) {
      window.showNotification(message, 'info');
      return;
    }
    console.log(message);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function relativeTime(dateValue) {
    const ms = Date.now() - new Date(dateValue).getTime();
    const minutes = Math.max(0, Math.floor(ms / 60000));
    if (minutes < 60) return i18n('admin_time_minutes_ago').replace('{count}', String(minutes));
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return i18n('admin_time_hours_ago').replace('{count}', String(hours));
    const days = Math.floor(hours / 24);
    return i18n('admin_time_days_ago').replace('{count}', String(days));
  }

  function filteredMessages() {
    const q = String(document.getElementById('messageSearch')?.value || '').toLowerCase().trim();
    const f = String(document.getElementById('messageFilter')?.value || 'all');

    return allMessages.filter((m) => {
      const text = [m.userName, m.userEmail, m.subject, m.content].join(' ').toLowerCase();
      const okQ = !q || text.includes(q);
      const okF = f === 'all' || m.state === f;
      return okQ && okF;
    });
  }

  function renderMessageList() {
    const list = document.getElementById('messageList');
    if (!list) return;

    const data = filteredMessages();
    list.textContent = '';
    if (!data.length) {
      const empty = document.createElement('div');
      empty.className = 'item';
      empty.textContent = 'Inga meddelanden matchar filtret.';
      list.appendChild(empty);
      return;
    }
    data.forEach((m) => {
      const isActive = m.id === selectedMessageId;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `item msg ${m.state === 'unread' ? 'unread' : ''} ${isActive ? 'active' : ''}`.trim();
      btn.dataset.id = String(m.id || '');
      const strong = document.createElement('strong');
      strong.textContent = String(m.userName || 'Okänd');
      const meta = document.createElement('span');
      meta.className = 'small';
      meta.textContent = `${String(m.subject || '-')} • ${relativeTime(m.createdAt)}`;
      const p = document.createElement('p');
      p.textContent = String(m.content || '');
      btn.append(strong, meta, p);
      list.appendChild(btn);
    });
  }

  function renderThread() {
    const header = document.getElementById('messageThreadHeader');
    const body = document.getElementById('messageThreadBody');
    if (!header || !body) return;

    const message = allMessages.find((m) => m.id === selectedMessageId);
    if (!message) {
      header.textContent = 'Välj ett meddelande för att se tråden.';
      body.textContent = '';
      return;
    }

    header.textContent = '';
    const strong = document.createElement('strong');
    strong.textContent = String(message.userName || 'Okänd');
    header.appendChild(strong);
    header.appendChild(document.createTextNode(` • ${String(message.subject || '-')}`));

    const thread = Array.isArray(message.thread) && message.thread.length
      ? message.thread
      : [{
          id: `${message.id}-legacy`,
          authorType: 'public',
          authorName: message.userName || 'Köpare',
          content: message.content,
          createdAt: message.createdAt,
        }];

    body.textContent = '';
    thread.forEach((reply) => {
      const kind = reply.authorType || 'public';
      const who = kind === 'admin' ? 'Admin' : kind === 'owner' ? 'Säljare' : (reply.authorName || 'Köpare');
      const cls = kind === 'admin'
        ? 'border-[#e2ff31]/40 bg-[#e2ff31]/10'
        : kind === 'owner'
          ? 'border-cyan-300/30 bg-cyan-300/10'
          : 'border-white/10 bg-white/5';
      const article = document.createElement('article');
      article.className = `rounded-2xl border px-4 py-3 ${cls}`;
      const meta = document.createElement('div');
      meta.className = 'mb-1 text-xs text-white/50';
      meta.textContent = `${who} • ${new Date(reply.createdAt).toLocaleString()}`;
      const p = document.createElement('p');
      p.className = 'whitespace-pre-line text-sm';
      p.textContent = String(reply.content || '');
      article.append(meta, p);
      body.appendChild(article);
    });

    body.scrollTop = body.scrollHeight;
  }

  async function loadMessages() {
    const body = await window.RimalisAPI.request('/admin/messages', { auth: true });
    allMessages = Array.isArray(body.messages) ? body.messages : [];

    if (!selectedMessageId || !allMessages.find((m) => m.id === selectedMessageId)) {
      selectedMessageId = allMessages[0]?.id || null;
    }

    renderMessageList();
    renderThread();
  }

  async function markAllUnreadRead() {
    const unread = allMessages.filter((m) => m.state === 'unread');
    await Promise.allSettled(
      unread.map((m) => window.RimalisAPI.request(`/admin/messages/${m.id}/read`, { method: 'PATCH', auth: true }))
    );
    await loadMessages();
  }

  async function sendReply() {
    if (!selectedMessageId) {
      notify('Välj ett meddelande först.');
      return;
    }

    const input = document.getElementById('replyBox');
    const reply = String(input?.value || '').trim();
    if (!reply) {
      notify('Skriv ett svar först.');
      return;
    }

    await window.RimalisAPI.request(`/admin/messages/${selectedMessageId}/reply`, {
      method: 'POST',
      auth: true,
      body: JSON.stringify({ reply }),
    });

    if (input) input.value = '';
    notify('Svar skickat');
    await loadMessages();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      await loadMessages();
    } catch (err) {
      notify(err.message || 'Kunde inte ladda meddelanden');
    }

    document.getElementById('messageSearch')?.addEventListener('input', () => {
      renderMessageList();
      renderThread();
    });
    document.getElementById('messageFilter')?.addEventListener('change', () => {
      renderMessageList();
      renderThread();
    });

    document.getElementById('messageList')?.addEventListener('click', (event) => {
      const card = event.target.closest('[data-id]');
      if (!card) return;
      selectedMessageId = card.dataset.id;
      renderMessageList();
      renderThread();
    });

    document.getElementById('markReadBtn')?.addEventListener('click', async () => {
      try {
        await markAllUnreadRead();
      } catch (err) {
        notify(err.message || 'Kunde inte markera som läst');
      }
    });

    document.getElementById('sendReplyBtn')?.addEventListener('click', async () => {
      try {
        await sendReply();
      } catch (err) {
        notify(err.message || 'Kunde inte skicka svar');
      }
    });
  });
})();
