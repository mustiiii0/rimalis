// ===== CHAT WIDGET =====

let chatHistory = [];
let isTyping = false;
let isSendingToSupport = false;
const CHAT_PROFILE_KEY = 'rimalis_chat_profile';
const CHAT_TICKETS_KEY = 'rimalis_chat_tickets';
const CHAT_HISTORY_KEY = 'rimalisChatHistory';
let chatReplyPoller = null;

function i18n(key) {
    return window.RimalisI18n?.t?.(key, key) || key;
}

function i18nArray(key, fallback = []) {
    const value = window.RimalisI18n?.t?.(key, fallback);
    return Array.isArray(value) ? value : fallback;
}

function getWelcomeMessages() {
    return i18nArray('chat_welcome_messages', []);
}

function getChatSubjectSource() {
    const page = (window.location.pathname.split('/').pop() || 'home.html').replace('.html', '');
    return `chat:${page || 'home'}`;
}

function getStoredProfile() {
    try {
        const raw = localStorage.getItem(CHAT_PROFILE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (_err) {
        return {};
    }
}

function saveProfile(profile) {
    localStorage.setItem(CHAT_PROFILE_KEY, JSON.stringify(profile || {}));
}

function loadTickets() {
    try {
      const raw = localStorage.getItem(CHAT_TICKETS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_err) {
      return [];
    }
}

function saveTickets(tickets) {
    const normalized = Array.isArray(tickets) ? tickets : [];
    const deduped = [];
    const seen = new Set();
    normalized.forEach((ticket) => {
        if (!ticket?.id || !ticket?.token) return;
        const key = `${ticket.id}:${ticket.token}`;
        if (seen.has(key)) return;
        seen.add(key);
        deduped.push(ticket);
    });
    localStorage.setItem(CHAT_TICKETS_KEY, JSON.stringify(deduped.slice(-30)));
}

function getDefaultProfile() {
    const user = window.RimalisAPI?.getUser?.() || null;
    const stored = getStoredProfile();
    return {
        name: stored.name || user?.name || '',
        email: stored.email || user?.email || '',
        phone: stored.phone || user?.phone || '',
    };
}

function askForMissingProfile(defaults) {
    const profile = { ...defaults };

    if (!profile.name || profile.name.length < 2) {
        profile.name = String(window.prompt(i18n('chat_prompt_name'), profile.name || '') || '').trim();
    }

    // Only ask for contact if neither email nor phone is present.
    const hasEmail = profile.email && profile.email.includes('@');
    const hasPhone = profile.phone && profile.phone.length >= 5;
    if (!hasEmail && !hasPhone) {
        const maybeEmail = String(window.prompt(i18n('chat_prompt_email'), profile.email || '') || '').trim().toLowerCase();
        if (maybeEmail.includes('@')) {
            profile.email = maybeEmail;
        } else {
            profile.phone = String(window.prompt(i18n('chat_prompt_phone'), profile.phone || '') || '').trim();
        }
    }

    return profile;
}

async function sendMessageToSupport(messageText, profile) {
    const defaults = getDefaultProfile();
    const selectedProfile = profile || askForMissingProfile(defaults);

    const hasValidEmail = selectedProfile.email && selectedProfile.email.includes('@');
    const hasValidPhone = selectedProfile.phone && selectedProfile.phone.length >= 5;
    if (!selectedProfile.name || selectedProfile.name.length < 2 || (!hasValidEmail && !hasValidPhone)) {
        throw new Error(i18n('chat_profile_required'));
    }

    saveProfile(selectedProfile);

    return window.RimalisAPI.request('/messages/public', {
        method: 'POST',
        body: JSON.stringify({
            propertyId: getChatSubjectSource(),
            name: selectedProfile.name,
            email: selectedProfile.email,
            phone: selectedProfile.phone,
            message: messageText,
        }),
    });
}

function toggleChatWidget() {
    const chatBox = document.getElementById('chatBox');
    const chatWidget = document.querySelector('.chat-widget');
    if (!chatBox || !chatWidget) return;

    const isOpen = chatBox.classList.contains('active');
    chatBox.classList.toggle('active', !isOpen);
    chatWidget.classList.toggle('open', !isOpen);

    if (!isOpen) {
        loadChatHistory();
        pollSupportReplies();
    }
}

function addPendingTicket(message) {
    if (!message?.id || !message?.publicToken) return;
    const tickets = loadTickets();
    const existingIndex = tickets.findIndex((t) => t.id === message.id && t.token === message.publicToken);
    if (existingIndex >= 0) {
      tickets[existingIndex] = {
        ...tickets[existingIndex],
        createdAt: message.createdAt || tickets[existingIndex].createdAt || new Date().toISOString(),
      };
      saveTickets(tickets);
      return;
    }
    tickets.push({
      id: message.id,
      token: message.publicToken,
      lastSeenReplyAt: null,
      createdAt: message.createdAt || new Date().toISOString(),
      page: getChatSubjectSource(),
    });
    saveTickets(tickets);
}

function markTicketSeenReply(id, token, repliedAt) {
    const tickets = loadTickets().map((t) => {
      if (t.id !== id || t.token !== token) return t;
      return {
        ...t,
        lastSeenReplyAt: repliedAt || t.lastSeenReplyAt || null,
      };
    });
    saveTickets(tickets);
}

function hasMessageInHistory(text, timestamp) {
    return chatHistory.some((entry) => {
        if (entry.type !== 'received') return false;
        if (entry.message !== text) return false;
        if (!timestamp) return true;
        return String(entry.timestamp || '') === String(timestamp);
    });
}

async function pollSupportReplies() {
    const tickets = loadTickets().filter((t) => t && t.id && t.token);
    if (!tickets.length) return;

    const responses = await Promise.allSettled(
      tickets.map((ticket) =>
        window.RimalisAPI.request(`/messages/public/${encodeURIComponent(ticket.id)}/reply?token=${encodeURIComponent(ticket.token)}`)
          .then((body) => ({ ticket, reply: body?.reply || null }))
      )
    );

    responses.forEach((result) => {
      if (result.status !== 'fulfilled') return;
      const ticket = result.value.ticket;
      const reply = result.value.reply;
      if (!reply?.adminReply) return;
      const replyAt = reply.repliedAt || null;
      const seenAt = ticket.lastSeenReplyAt || null;
      const hasNewReply =
        !seenAt ||
        (replyAt && Number.isFinite(Date.parse(replyAt)) && Number.isFinite(Date.parse(seenAt)) && Date.parse(replyAt) > Date.parse(seenAt));
      if (!hasNewReply) return;

      const replyText = `${i18n('chat_support_reply_prefix')} ${reply.adminReply}`;
      if (!hasMessageInHistory(replyText, replyAt)) {
        addMessage(replyText, 'received');
        chatHistory.push({
          type: 'received',
          message: replyText,
          timestamp: replyAt || new Date().toISOString(),
        });
        saveChatHistory();
      }
      markTicketSeenReply(ticket.id, ticket.token, replyAt);
    });
}

function extractValidationMessage(error) {
    const fallback = i18n('chat_validation_failed');
    const fieldErrors = error?.body?.details?.fieldErrors;
    if (!fieldErrors || typeof fieldErrors !== 'object') return fallback;

    const messages = Object.values(fieldErrors)
      .flat()
      .filter(Boolean)
      .map((value) => String(value).trim())
      .filter(Boolean);

    return messages[0] || fallback;
}

function startChatReplyPolling() {
    if (chatReplyPoller) return;
    chatReplyPoller = window.setInterval(() => {
      pollSupportReplies().catch(() => {});
    }, 12000);
}

function initChat() {
    const chatButton = document.getElementById('chatButton');
    const chatBox = document.getElementById('chatBox');
    const closeChat = document.getElementById('closeChat');
    const sendMessage = document.getElementById('sendMessage');
    const chatInput = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages');
    
    if (!chatButton) return;
    
    // Öppna/stäng chat
    chatButton.addEventListener('click', toggleChatWidget);
    
    if (closeChat) {
        closeChat.addEventListener('click', () => {
            chatBox.classList.remove('active');
            const chatWidget = document.querySelector('.chat-widget');
            if (chatWidget) chatWidget.classList.remove('open');
        });
    }
    
    // Skicka meddelande
    if (sendMessage && chatInput) {
        sendMessage.addEventListener('click', () => {
            sendUserMessage();
        });
        
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendUserMessage();
            }
        });
    }
    
    // Lägg till välkomstmeddelande om chatMessages är tom
    if (chatMessages && chatMessages.children.length === 0) {
        getWelcomeMessages().forEach((message) => addMessage(message, 'received'));
    }

    startChatReplyPolling();
    pollSupportReplies().catch(() => {});
}

function sendUserMessage() {
    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendMessage');
    const message = chatInput.value.trim();
    
    if (!message) return;
    if (isSendingToSupport) return;
    if (message.length < 3) {
        const tooShort = i18n('chat_message_too_short');
        addMessage(tooShort, 'received');
        showNotification(tooShort, 'error');
        return;
    }

    let profile;
    try {
        profile = askForMissingProfile(getDefaultProfile());
        const hasValidEmail = profile.email && profile.email.includes('@');
        const hasValidPhone = profile.phone && profile.phone.length >= 5;
        if (!profile.name || profile.name.length < 2 || (!hasValidEmail && !hasValidPhone)) {
            showNotification(i18n('chat_profile_required'), 'error');
            return;
        }
    } catch (_err) {
        showNotification(i18n('chat_profile_required'), 'error');
        return;
    }
    
    // Lägg till användarens meddelande
    addMessage(message, 'sent');
    chatInput.value = '';
    
    // Spara i historik
    chatHistory.push({
        type: 'sent',
        message: message,
        timestamp: new Date().toISOString()
    });
    
    // Visa "skriver..." indikator
    showTypingIndicator();
    isSendingToSupport = true;
    if (sendButton) sendButton.disabled = true;

    sendMessageToSupport(message, profile)
        .then((body) => {
            hideTypingIndicator();
            addPendingTicket(body?.message);
            const ticketId = body?.message?.id ? String(body.message.id).slice(0, 8) : '';
            const response = ticketId
                ? `${i18n('chat_sent_support_confirmation')} #${ticketId}`
                : i18n('chat_sent_support_confirmation');
            addMessage(response, 'received');
            chatHistory.push({
                type: 'received',
                message: response,
                timestamp: new Date().toISOString()
            });
            saveChatHistory();
            pollSupportReplies().catch(() => {});
        })
        .catch((error) => {
            hideTypingIndicator();
            const failText = i18n('chat_support_send_failed');
            addMessage(failText, 'received');
            chatHistory.push({
                type: 'received',
                message: failText,
                timestamp: new Date().toISOString()
            });
            saveChatHistory();
            const raw = String(error?.message || '');
            const friendly = raw.toLowerCase().includes('validation failed')
                ? extractValidationMessage(error)
                : (raw || i18n('chat_support_send_failed'));
            showNotification(friendly, 'error');
        })
        .finally(() => {
            isSendingToSupport = false;
            if (sendButton) sendButton.disabled = false;
        });
}

function addMessage(text, type) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}`;
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = String(text || '');
    messageDiv.appendChild(bubble);
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTypingIndicator() {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-message received typing-indicator';
    typingDiv.id = 'typingIndicator';
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    const icon = document.createElement('i');
    icon.className = 'fas fa-ellipsis-h';
    bubble.appendChild(icon);
    bubble.appendChild(document.createTextNode(` ${i18n('chat_typing')}`));
    typingDiv.appendChild(bubble);
    
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

function loadChatHistory() {
    const saved = localStorage.getItem(CHAT_HISTORY_KEY);
    const chatMessages = document.getElementById('chatMessages');
    
    if (!chatMessages) return;
    
    // Rensa chatMessages
    chatMessages.textContent = '';
    
    if (saved) {
        chatHistory = JSON.parse(saved);
        
        // Visa senaste 20 meddelandena
        const recentMessages = chatHistory.slice(-20);
        recentMessages.forEach(msg => {
            addMessage(msg.message, msg.type);
        });
    } else {
        // Visa välkomstmeddelande
        const welcomeMessages = getWelcomeMessages();
        welcomeMessages.forEach((message) => addMessage(message, 'received'));

        chatHistory = welcomeMessages.map((message) => ({
            type: 'received',
            message,
            timestamp: new Date().toISOString(),
        }));
    }
}

function saveChatHistory() {
    // Spara bara de senaste 50 meddelandena
    const historyToSave = chatHistory.slice(-50);
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(historyToSave));
}

function clearChatHistory() {
    chatHistory = [];
    localStorage.removeItem(CHAT_HISTORY_KEY);
    localStorage.removeItem(CHAT_TICKETS_KEY);
    
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        chatMessages.textContent = '';
        getWelcomeMessages().forEach((message) => addMessage(message, 'received'));
    }
    
    showNotification(i18n('chat_history_cleared'), 'info');
}

// Exporera chat API
window.chatAPI = {
    sendMessage: sendUserMessage,
    clearHistory: clearChatHistory,
    loadHistory: loadChatHistory
};

window.toggleChatWidget = toggleChatWidget;
