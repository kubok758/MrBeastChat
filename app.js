const DEFAULT_API_KEY = 'om-2e73gps9uRiQrRzBEntekuV9KPwZRq8szkgC1ZRqPuP';
const MODEL = 'deepseek-v4-flash';
const API_URL = 'https://api.openmodel.ai/v1/messages';
const PUBLIC_CORS_PROXY = 'https://corsproxy.io/?url=';
const USE_PROXY_FALLBACK = true;
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
apiKeyInput.value = localStorage.getItem('openmodel_key') || DEFAULT_API_KEY;
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
    const answer = await askOpenModel(chat.messages);
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

async function askOpenModel(history) {
  const apiKey = (localStorage.getItem('openmodel_key') || DEFAULT_API_KEY).trim();
  const messages = history
    .slice(-18)
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role, content: m.content }));

  const payload = {
    model: MODEL,
    system: SYSTEM_PROMPT,
    messages,
    max_tokens: 900,
    temperature: 0.85,
    stream: false
  };

  try {
    return await callOpenModel(API_URL, apiKey, payload, 'direct');
  } catch (directError) {
    // На GitHub Pages Safari часто режет прямой запрос к API по CORS.
    // Поэтому для тестового ключа включён запасной вариант через публичный CORS proxy.
    if (!USE_PROXY_FALLBACK || !isNetworkOrCorsError(directError)) throw directError;
    const proxyUrl = PUBLIC_CORS_PROXY + encodeURIComponent(API_URL);
    try {
      return await callOpenModel(proxyUrl, apiKey, payload, 'proxy');
    } catch (proxyError) {
      proxyError.directError = directError;
      proxyError.usedProxy = true;
      throw proxyError;
    }
  }
}

async function callOpenModel(url, apiKey, payload, modeName) {
  const res = await fetch(url, {
    method: 'POST',
    mode: 'cors',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(payload)
  });

  const raw = await res.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch {}

  if (!res.ok) {
    const apiMessage = data?.error?.message || data?.message || raw || res.statusText;
    throw new Error(`[${modeName}] ${res.status} ${apiMessage}`.slice(0, 420));
  }

  return extractAnswer(data);
}

function extractAnswer(data) {
  const content = data?.content;
  if (Array.isArray(content)) {
    const text = content
      .filter(part => part?.type === 'text' && part?.text)
      .map(part => part.text)
      .join('\n')
      .trim();
    if (text) return text;
  }

  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  if (data?.choices?.[0]?.message?.content?.trim()) return data.choices[0].message.content.trim();
  return 'Я тут, но модель вернула пустой ответ.';
}

function isNetworkOrCorsError(e) {
  const msg = String(e?.message || e);
  return msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed') || msg.includes('TypeError');
}

function makeNiceError(e) {
  const msg = String(e?.message || e);
  const directMsg = e?.directError ? String(e.directError?.message || e.directError) : '';

  if (isNetworkOrCorsError(e) || isNetworkOrCorsError(e?.directError)) {
    return 'OpenModel не дал браузеру прямой запрос, я попробовал запасной CORS-proxy, но он тоже не ответил. Проверь VPN/интернет и обнови страницу. Если снова будет так же — нужен свой маленький proxy/Cloudflare Worker, потому что GitHub Pages сам API-ключ безопасно не прокинет.\n\nОшибка: ' + (directMsg || msg);
  }

  return 'Упс, API не ответил. Проверь ключ, лимиты или VPN/интернет.\n\nОшибка: ' + msg;
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
  localStorage.setItem('openmodel_key', apiKeyInput.value.trim() || DEFAULT_API_KEY);
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
