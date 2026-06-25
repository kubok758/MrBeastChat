const DEFAULT_API_KEY = 'om-2e73gps9uRiQrRzBEntekuV9KPwZRq8szkgC1ZRqPuP';
const MODEL = 'deepseek/deepseek-v4-flash';
const API_URL = 'https://api.openmodel.ai/v1/chat/completions';
const AVATAR_HTML = `<img src="person-mrbeast.png" alt="MrBeast" onerror="this.remove(); this.parentElement.classList.add('avatar-fallback'); this.parentElement.textContent='MB';" />`;

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

let chats = JSON.parse(localStorage.getItem('mb_chats') || '[]');
let activeId = localStorage.getItem('mb_active') || null;
let busy = false;

if (!chats.length) createChat(false);
if (!activeId || !chats.find(c => c.id === activeId)) activeId = chats[0].id;
apiKeyInput.value = localStorage.getItem('openmodel_key') || DEFAULT_API_KEY;
renderAll();

function createChat(render = true) {
  const chat = { id: crypto.randomUUID(), title: 'Новый чат', messages: [] };
  chats.unshift(chat);
  activeId = chat.id;
  save();
  if (render) renderAll();
}

function activeChat() { return chats.find(c => c.id === activeId); }
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
    el.onclick = () => { activeId = chat.id; save(); renderAll(); sidebar.classList.remove('open'); };
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

  busy = true; sendBtn.disabled = true; statusEl.textContent = 'печатает...';
  const typing = addTyping();
  try {
    const answer = await askOpenModel(chat.messages);
    typing.remove();
    chat.messages.push({ role: 'assistant', content: answer });
    save();
    addBubble('assistant', answer);
  } catch (e) {
    typing.remove();
    addBubble('assistant', 'Упс, API не ответил. Проверь ключ, VPN/интернет или CORS.\n\nОшибка: ' + e.message);
  } finally {
    busy = false; sendBtn.disabled = false; statusEl.textContent = 'онлайн';
  }
}

async function askOpenModel(history) {
  const apiKey = localStorage.getItem('openmodel_key') || DEFAULT_API_KEY;
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.85,
      max_tokens: 900,
      messages: [
        { role: 'system', content: 'Ты играешь роль MrBeast для фанового сайта MrBeastChat. Не утверждай, что ты настоящий Джимми Дональдсон. Отвечай энергично, дружелюбно, мемно, по-русски, с вайбом больших челленджей, денег, благотворительности и YouTube. Коротко, если вопрос простой. Не обещай реальные деньги, призы или связь с настоящим MrBeast.' },
        ...history.slice(-18)
      ]
    })
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`.slice(0, 220));
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || 'Я тут, но модель вернула пустой ответ.';
}

form.onsubmit = e => { e.preventDefault(); sendMessage(); };
input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 140) + 'px'; });
input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
newChatBtn.onclick = () => createChat(true);
clearBtn.onclick = () => { if (confirm('Удалить текущий чат?')) { chats = chats.filter(c => c.id !== activeId); if (!chats.length) createChat(false); activeId = chats[0].id; save(); renderAll(); } };
menuBtn.onclick = () => sidebar.classList.toggle('open');
saveKeyBtn.onclick = () => { localStorage.setItem('openmodel_key', apiKeyInput.value.trim() || DEFAULT_API_KEY); alert('Ключ сохранён'); };
document.addEventListener('click', e => { if (innerWidth <= 800 && sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== menuBtn) sidebar.classList.remove('open'); });
function scrollDown(){ messagesEl.scrollTop = messagesEl.scrollHeight; }
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
