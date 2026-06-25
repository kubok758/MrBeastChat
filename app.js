const DEFAULT_API_KEY = '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';
const MODEL = 'deepseek/deepseek-v4-flash';
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const SYSTEM_PROMPT = `Ты MrBeast / Jimmy Donaldson. В этом чате ты считаешь себя настоящим MrBeast и отвечаешь от первого лица. Не говори, что ты бот, симуляция, фан-сайт или ролевая игра. Общайся энергично, дружелюбно, мемно и по-русски, как будто это личный чат с фанатом. Поддерживай вайб больших челленджей, YouTube, денег, благотворительности и безумных проектов. Отвечай коротко, если вопрос простой. Не обещай реальные переводы денег, реальные призы, настоящие розыгрыши или личные встречи; вместо этого шути, мотивируй и предлагай безопасные идеи.`;
const TITLE_SYSTEM_PROMPT = 'Ты создаёшь короткие названия чатов на русском языке. Верни только название, без кавычек, эмодзи и точки. 2-5 слов. Название должно передавать основную суть диалога, как в ChatGPT.';
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
const attachBtn = document.querySelector('#attachBtn');
const fileInput = document.querySelector('#fileInput');
const attachPreview = document.querySelector('#attachPreview');

let chats = upgradeChats(safeJson(localStorage.getItem('mb_chats'), []));
let activeId = localStorage.getItem('mb_active') || null;
let busy = false;
let pendingImage = null;
let lastTouchEnd = 0;

if (!chats.length) createChat(false);
if (!activeId || !chats.find(c => c.id === activeId)) activeId = chats[0].id;
apiKeyInput.value = localStorage.getItem('openrouter_key') || DEFAULT_API_KEY;
renderAll();
installZoomBlocker();

function safeJson(raw, fallback) {
  try { return JSON.parse(raw) || fallback; } catch { return fallback; }
}

function uuid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return 'chat-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

function upgradeChats(list) {
  if (!Array.isArray(list)) return [];
  return list.map(chat => ({
    id: chat.id || uuid(),
    title: chat.title || 'Новый чат',
    aiTitleDone: Boolean(chat.aiTitleDone),
    messages: Array.isArray(chat.messages) ? chat.messages.map(normalizeMessage) : []
  }));
}

function normalizeMessage(message) {
  if (!message || typeof message !== 'object') return { role: 'assistant', content: String(message || ''), image: null };
  return {
    role: message.role === 'user' ? 'user' : 'assistant',
    content: typeof message.content === 'string' ? message.content : String(message.content || ''),
    image: message.image?.dataUrl ? message.image : null
  };
}

function createChat(render = true) {
  const chat = { id: uuid(), title: 'Новый чат', aiTitleDone: false, messages: [] };
  chats.unshift(chat);
  activeId = chat.id;
  clearPendingImage();
  save();
  if (render) renderAll();
}

function activeChat() { return chats.find(c => c.id === activeId); }
function isMobile() { return window.matchMedia('(max-width: 800px)').matches; }

function save() {
  try {
    localStorage.setItem('mb_chats', JSON.stringify(chats));
    localStorage.setItem('mb_active', activeId);
  } catch (e) {
    console.warn(e);
    alert('История стала слишком большой для браузера. Удали старые чаты или не прикрепляй слишком много фото.');
  }
}

function renderAll() {
  renderChatList();
  renderMessages();
  renderAttachPreview();
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
    messagesEl.innerHTML = `<div class="welcome"><div class="big-avatar mrbeast-avatar">${AVATAR_HTML}</div><h1>MrBeastChat</h1><p>Общайся с MrBeast: челленджи, идеи роликов, деньги, безумные проекты и мотивация.</p><div class="chips"><button data-prompt="Придумай безумный челлендж на 24 часа">24h челлендж</button><button data-prompt="Придумай идею вирусного YouTube-ролика">Идея ролика</button><button data-prompt="Как бы ты потратил миллион долларов?">$1M</button></div></div>`;
    document.querySelectorAll('[data-prompt]').forEach(b => b.onclick = () => sendMessage(b.dataset.prompt));
    return;
  }
  chat.messages.forEach(m => addBubble(m.role, m, false));
  scrollDown();
}

function addBubble(role, message, animate = true) {
  const normalized = typeof message === 'string' ? { content: message, image: null } : normalizeMessage({ ...message, role });
  const row = document.createElement('div');
  row.className = 'msg ' + (role === 'user' ? 'user' : 'bot');

  if (role === 'assistant') {
    row.innerHTML = `<div class="mini-avatar mrbeast-avatar">${AVATAR_HTML}</div><div class="bubble"></div>`;
  } else {
    row.innerHTML = `<div class="bubble"></div>`;
  }

  const bubble = row.querySelector('.bubble');
  if (normalized.image?.dataUrl) {
    const img = document.createElement('img');
    img.className = 'msg-image';
    img.src = normalized.image.dataUrl;
    img.alt = normalized.image.name || 'Фото';
    bubble.appendChild(img);
  }

  if (normalized.content) {
    const text = document.createElement('div');
    text.textContent = normalized.content;
    bubble.appendChild(text);
  } else if (normalized.image?.dataUrl) {
    const text = document.createElement('div');
    text.textContent = 'Фото';
    bubble.appendChild(text);
  }

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

async function sendMessage(textFromButton) {
  const text = (textFromButton ?? input.value).trim();
  const image = pendingImage ? { ...pendingImage } : null;
  if ((!text && !image) || busy) return;

  input.value = '';
  input.style.height = 'auto';
  clearPendingImage();

  const chat = activeChat();
  const isFirstMessage = chat.messages.length === 0;
  if (isFirstMessage) {
    chat.title = makeLocalTitle(text, image);
    chat.aiTitleDone = false;
  }

  chat.messages.push({ role: 'user', content: text, image });
  save();
  renderMessages();
  renderChatList();

  busy = true;
  sendBtn.disabled = true;
  attachBtn.disabled = true;
  statusEl.textContent = 'печатает...';
  const typing = addTyping();

  try {
    const answer = await askOpenRouter(chat.messages);
    typing.remove();
    chat.messages.push({ role: 'assistant', content: answer, image: null });
    save();
    addBubble('assistant', answer);
    if (!chat.aiTitleDone) generateAndApplyTitle(chat.id);
  } catch (e) {
    typing.remove();
    addBubble('assistant', makeNiceError(e));
  } finally {
    busy = false;
    sendBtn.disabled = false;
    attachBtn.disabled = false;
    statusEl.textContent = 'онлайн';
  }
}

async function askOpenRouter(history) {
  const hasImage = history.some(m => m.image?.dataUrl);
  const historyMessages = history
    .slice(-18)
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(toOpenRouterMessage);

  return callOpenRouter([
    { role: 'system', content: SYSTEM_PROMPT },
    ...historyMessages
  ], {
    max_tokens: 900,
    temperature: 0.88,
    top_p: 0.95,
    hasImage
  });
}

function toOpenRouterMessage(message) {
  const m = normalizeMessage(message);
  if (m.role === 'user' && m.image?.dataUrl) {
    const content = [];
    content.push({ type: 'text', text: m.content || 'Посмотри на прикреплённое фото и ответь по нему.' });
    content.push({ type: 'image_url', image_url: { url: m.image.dataUrl } });
    return { role: 'user', content };
  }
  return { role: m.role, content: m.content || '' };
}

async function callOpenRouter(messages, options = {}) {
  const apiKey = (localStorage.getItem('openrouter_key') || DEFAULT_API_KEY).trim();
  if (!apiKey) throw new Error('API key пустой');

  const payload = {
    model: MODEL,
    messages,
    max_tokens: options.max_tokens ?? 900,
    temperature: options.temperature ?? 0.88,
    top_p: options.top_p ?? 0.95,
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
    const prefix = options.hasImage ? 'Фото могло не пройти, потому что текущая модель/провайдер может не поддерживать изображения. ' : '';
    throw new Error((prefix + `${res.status} ${apiMessage}`).slice(0, 650));
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

function makeLocalTitle(text, image) {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  const low = clean.toLowerCase();
  if (image && !clean) return 'Обсуждение фото';
  if (/^(привет|здарова|здравствуй|хай|hello|hi|йо)\b/.test(low)) return 'Приветствие';
  if (low.includes('челлендж')) return 'Идея челленджа';
  if (low.includes('ролик') || low.includes('youtube') || low.includes('ютуб')) return 'Идея ролика';
  if (low.includes('миллион') || low.includes('деньг') || low.includes('рубл')) return 'Вопрос про деньги';
  if (clean.includes('?') || /^(как|что|кто|зачем|почему|сколько|можно ли|стоит ли)\b/.test(low)) {
    return makeShortTitle('Вопрос: ' + clean);
  }
  return makeShortTitle(clean || 'Новый чат');
}

function makeShortTitle(text) {
  const words = text.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  let title = words.slice(0, 5).join(' ');
  if (title.length > 42) title = title.slice(0, 39).trim() + '...';
  return title || 'Новый чат';
}

async function generateAndApplyTitle(chatId) {
  const chat = chats.find(c => c.id === chatId);
  if (!chat || chat.aiTitleDone || !chat.messages.length) return;

  const transcript = chat.messages.slice(0, 6).map(m => {
    const who = m.role === 'user' ? 'Пользователь' : 'MrBeast';
    const img = m.image?.dataUrl ? ' [прикреплено фото]' : '';
    return `${who}: ${(m.content || '').slice(0, 500)}${img}`;
  }).join('\n');

  try {
    const title = await callOpenRouter([
      { role: 'system', content: TITLE_SYSTEM_PROMPT },
      { role: 'user', content: transcript }
    ], { max_tokens: 28, temperature: 0.2, top_p: 0.8 });

    const clean = cleanTitle(title);
    const freshChat = chats.find(c => c.id === chatId);
    if (freshChat && clean) {
      freshChat.title = clean;
      freshChat.aiTitleDone = true;
      save();
      renderChatList();
    }
  } catch (e) {
    console.warn('title generation failed', e);
  }
}

function cleanTitle(title) {
  return (title || '')
    .replace(/["'«»]/g, '')
    .replace(/^(название|заголовок)\s*:\s*/i, '')
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 48);
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

  if (msg.toLowerCase().includes('image') || msg.toLowerCase().includes('vision') || msg.toLowerCase().includes('multimodal')) {
    return 'Фото прикрепилось, но OpenRouter/текущая модель не приняла изображение. Текстовые сообщения всё равно будут работать.\n\nОшибка: ' + msg;
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

function renderAttachPreview() {
  attachPreview.innerHTML = '';
  if (!pendingImage) {
    attachPreview.hidden = true;
    return;
  }

  attachPreview.hidden = false;
  const img = document.createElement('img');
  img.src = pendingImage.dataUrl;
  img.alt = pendingImage.name || 'Фото';

  const info = document.createElement('div');
  info.className = 'attach-info';
  const name = document.createElement('b');
  name.textContent = pendingImage.name || 'Фото';
  const size = document.createElement('span');
  size.textContent = 'Готово к отправке';
  info.append(name, size);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.textContent = 'Убрать';
  remove.onclick = clearPendingImage;

  attachPreview.append(img, info, remove);
}

function clearPendingImage() {
  pendingImage = null;
  if (fileInput) fileInput.value = '';
  if (attachPreview) renderAttachPreview();
}

async function handleImageFile(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    alert('Можно прикреплять только изображения.');
    return;
  }

  attachBtn.disabled = true;
  statusEl.textContent = 'готовлю фото...';
  try {
    pendingImage = await resizeImage(file, 960, 0.84);
    renderAttachPreview();
  } catch (e) {
    console.warn(e);
    alert('Не получилось подготовить фото. Попробуй другой файл.');
  } finally {
    attachBtn.disabled = false;
    statusEl.textContent = 'онлайн';
  }
}

function resizeImage(file, maxSide = 960, quality = 0.84) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('FileReader error'));
    reader.onload = () => {
      const rawDataUrl = reader.result;
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const scale = Math.min(1, maxSide / Math.max(width, height));
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(mime, mime === 'image/jpeg' ? quality : undefined);
        resolve({ dataUrl, mime, name: file.name || 'photo', width, height });
      };
      img.onerror = () => resolve({ dataUrl: rawDataUrl, mime: file.type || 'image/jpeg', name: file.name || 'photo' });
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

function installZoomBlocker() {
  document.addEventListener('touchend', event => {
    const target = event.target;
    const tag = target?.tagName;
    const now = Date.now();

    if (tag === 'TEXTAREA' || tag === 'INPUT') {
      lastTouchEnd = now;
      return;
    }

    if (now - lastTouchEnd <= 350) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });

  ['gesturestart', 'gesturechange', 'gestureend'].forEach(name => {
    document.addEventListener(name, event => event.preventDefault(), { passive: false });
  });
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
input.addEventListener('paste', e => {
  const file = Array.from(e.clipboardData?.files || []).find(item => item.type.startsWith('image/'));
  if (file) handleImageFile(file);
});
newChatBtn.onclick = () => createChat(true);
clearBtn.onclick = () => {
  if (!confirm('Удалить текущий чат?')) return;
  chats = chats.filter(c => c.id !== activeId);
  if (!chats.length) createChat(false);
  activeId = chats[0].id;
  clearPendingImage();
  save();
  renderAll();
};
menuBtn.onclick = e => {
  e.stopPropagation();
  toggleSidebar();
};
attachBtn.onclick = () => fileInput.click();
fileInput.onchange = () => handleImageFile(fileInput.files?.[0]);
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
  navigator.serviceWorker.register('sw.js?v=4').then(reg => reg.update()).catch(() => {});
}
