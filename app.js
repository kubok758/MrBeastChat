const DEFAULT_API_KEY = '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';
const MODEL = 'deepseek/deepseek-v4-flash';
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const SYSTEM_PROMPT = 'Ты играешь роль MrBeast для фанового сайта MrBeastChat. Не утверждай, что ты настоящий Джимми Дональдсон. Отвечай энергично, дружелюбно, мемно, по-русски, с вайбом больших челленджей, денег, благотворительности и YouTube. Коротко, если вопрос простой. Не обещай реальные деньги, призы или связь с настоящим MrBeast.';
const AVATAR_HTML = `<img src="person-mrbeast.png" alt="MrBeast" onerror="this.remove(); this.parentElement.classList.add('avatar-fallback'); this.parentElement.textContent='MB';" />`;

const appEl = document.querySelector('.app');
const messagesEl = document.querySelector('#messages');
const form = document.querySelector('#form');
const input = document.querySelector('#input');
const sendBtn = document.querySelector('#sendBtn');
const statusEl = document.querySelector('#status');
const apiKeyInput = document.querySelector('#apiKeyInput');
const saveKeyBtn = document.querySelector('#saveKeyBtn');
const newChatBtn = document.querySelector('#newChatBtn');
const chatList = document.querySelector('#chatList');
const clearBtn = document.querySelector('#clearBtn');
const menuBtn = document.querySelector('#menuBtn');
const sidebar = document.querySelector('#sidebar');

let chats = safeJson(localStorage.getItem('mb_chats'), []);
let activeId = localStorage.getItem('mb_active') || null;
let busy = false;

if (!chats.length) createChat(false);
if (!activeId || !chats.find(c => c.id === activeId)) activeId = chats[0].id;
apiKeyInput.value = localStorage.getItem('openrouter_key') || DEFAULT_API_KEY;
renderAll();

function safeJson(raw, fallback) {
  try { return JSON.parse(raw) || fallback; } catch { return fallback; }
}

function createChat(render = true) {
  const chat = { id: crypto.randomUUID(), title: 'Новый чат', messages: [] };
  chats.unshift(chat);
  activeId = chat.id;
  save();
  if (render) renderAll();
}

function activeChat() { return chats.find(c => c.id === activeId); }
function isMobile() { return window.matchMedia('(max-width: 800px)').matches; }
function save() {
  localStorage.setItem('mb_chats', JSON.stringify(chats));
  localStorage.setItem('mb_active', activeId);
}

function renderAll() {
  renderChatList();
  renderMessages();
}

function renderChatList() {
  chatList.innerHTML = '';
  chats.forEach(chat => {
    const el = document.createElement('div');
    el.className = 'chat-item' + (chat.id === activeId ? ' active' : '');
    el.textContent = chat.title;
    el.onclick = () => {
      activeId = chat.id;
      save();
      renderAll();
      if (isMobile()) sidebar.classList.remove('open');
    };
    chatList.appendChild(el);
  });
}

function renderMessages() {
  const chat = activeChat();
  messagesEl.innerHTML = '';
  if (!chat.messages.length) {
    messagesEl.innerHTML = `<div class="welcome"><div class="big-avatar mrbeast-avatar">${AVATAR_HTML}</div><h1>MrBeastChat</h1><p>Общайся с вайбовым MrBeast: челленджи, идеи роликов, деньги, безумные проекты и мотивация.</p><div class="chips"><button data-prompt="Придумай безумный челлендж на 24 часа">24h челлендж</button><button data-prompt="Придумай идею вирусного YouTube-ролика">Идея ролика</button><button data-prompt="Как бы ты потратил миллион долларов?">$1M</button></div></div>`;
    document.querySelectorAll('[data-prompt]').forEach(b => b.onclick = () => sendMessage(b.dataset.prompt));
    return;
  }
  chat.messages.forEach(m => addBubble(m.role, m.content, false));
  scrollDown();
}

function addBubble(role, text, animate = true) {
  const row = document.createElement('div');
  row.className = 'msg ' + (role === 'user' ? 'user' : 'bot');
  row.innerHTML = role === 'assistant'
    ? `<div class="mini-avatar mrbeast-avatar">${AVATAR_HTML}</div><div class="bubble"></div>`
    : `<div class="bubble"></div>`;
  row.querySelector('.bubble').textContent = text;
  messagesEl.appendChild(row);
  if (animate) scrollDown();
  return row;
}

function addTyping() {
  const row = document.createElement('div');
  row.className = 'msg bot';
  row.innerHTML = `<div class="mini-avatar mrbeast-avatar">${AVATAR_HTML}</div><div class="bubble typing"><i></i><i></i><i></i></div>`;
  messagesEl.appendChild(row);
  scrollDown();
  return row;
}

async function sendMessage(text) {
  text = (text || input.value).trim();
  if (!text || busy) return;

  input.value = '';
  input.style.height = 'auto';

  const chat = activeChat();
  if (!chat.messages.length) chat.title = text.slice(0, 34);
  chat.messages.push({ role: 'user', content: text });
  save();
  renderMessages();
  renderChatList();

  busy = true;
  sendBtn.disabled = true;
  statusEl.textContent = 'печатает...';
  const typing = addTyping();

  try {
    const answer = await askOpenRouter(chat.messages);
    typing.remove();
    chat.messages.push({ role: 'assistant', content: answer });
    save();
    addBubble('assistant', answer);
  } catch (e) {
    typing.remove();
    addBubble('assistant', makeNiceError(e));
  } finally {
    busy = false;
    sendBtn.disabled = false;
    statusEl.textContent = 'онлайн';
  }
}

async function askOpenRouter(history) {
  const apiKey = (localStorage.getItem('openrouter_key') || DEFAULT_API_KEY).trim();
  if (!apiKey) throw new Error('API key пустой');

  const historyMessages = history
    .slice(-18)
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role, content: m.content }));

  const payload = {
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...historyMessages
    ],
    max_tokens: 900,
    temperature: 0.88,
    top_p: 0.95,
    stream: false
  };

  const res = await fetch(API_URL, {
    method: 'POST',
    mode: 'cors',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': location.origin,
      'X-OpenRouter-Title': 'MrBeastChat'
    },
    body: JSON.stringify(payload)
  });

  const raw = await res.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch {}

  if (!res.ok) {
    const apiMessage = data?.error?.message || data?.message || raw || res.statusText;
    throw new Error(`${res.status} ${apiMessage}`.slice(0, 450));
  }

  return extractAnswer(data);
}

function extractAnswer(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string' && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const text = content
      .map(part => typeof part === 'string' ? part : (part?.text || part?.content || ''))
      .join('\n')
      .trim();
    if (text) return text;
  }
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  return 'Я тут, но OpenRouter вернул пустой ответ.';
}

function isNetworkOrCorsError(e) {
  const msg = String(e?.message || e);
  return msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed') || msg.includes('TypeError');
}

function makeNiceError(e) {
  const msg = String(e?.message || e);

  if (isNetworkOrCorsError(e)) {
    return 'Браузер не смог достучаться до OpenRouter. Проверь интернет/VPN и обнови страницу. Если именно на GitHub Pages будет снова Load failed — значит браузер режет прямой запрос, тогда нужен маленький proxy/Cloudflare Worker.\n\nОшибка: ' + msg;
  }

  if (msg.includes('401') || msg.includes('403')) {
    return 'OpenRouter не принял API-ключ. Проверь, что ключ правильный и не отключён.\n\nОшибка: ' + msg;
  }

  if (msg.includes('402') || msg.toLowerCase().includes('credits')) {
    return 'На OpenRouter не хватает кредитов или стоит лимит.\n\nОшибка: ' + msg;
  }

  if (msg.includes('429')) {
    return 'OpenRouter ограничил частоту запросов. Подожди немного и попробуй ещё раз.\n\nОшибка: ' + msg;
  }

  return 'Упс, OpenRouter не ответил. Проверь ключ, лимиты или VPN/интернет.\n\nОшибка: ' + msg;
}

function toggleSidebar() {
  if (isMobile()) {
    sidebar.classList.toggle('open');
  } else {
    appEl.classList.toggle('sidebar-closed');
  }
}

form.onsubmit = e => { e.preventDefault(); sendMessage(); };
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 140) + 'px';
});
input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
newChatBtn.onclick = () => createChat(true);
clearBtn.onclick = () => {
  if (!confirm('Удалить текущий чат?')) return;
  chats = chats.filter(c => c.id !== activeId);
  if (!chats.length) createChat(false);
  activeId = chats[0].id;
  save();
  renderAll();
};
menuBtn.onclick = e => {
  e.stopPropagation();
  toggleSidebar();
};
saveKeyBtn.onclick = () => {
  localStorage.setItem('openrouter_key', apiKeyInput.value.trim() || DEFAULT_API_KEY);
  alert('Ключ сохранён');
};
document.addEventListener('click', e => {
  if (isMobile() && sidebar.classList.contains('open') && !sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
    sidebar.classList.remove('open');
  }
});
window.addEventListener('resize', () => {
  if (!isMobile()) sidebar.classList.remove('open');
});
function scrollDown(){ messagesEl.scrollTop = messagesEl.scrollHeight; }

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(reg => reg.update()).catch(() => {});
}
