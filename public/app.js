(() => {
  'use strict';

  const AVATAR_COLORS = {
    '社長': '#f4511e',
    '専務': '#8e63d1',
    '平山': '#26a69a',
    '辻井': '#4fc3f7',
    '吉道': '#ffa726',
    '江本': '#ec407a'
  };
  const FALLBACK_COLORS = ['#f4511e', '#8e63d1', '#26a69a', '#4fc3f7', '#ffa726', '#ec407a'];

  const state = {
    user: localStorage.getItem('takeuchi_user') || null,
    members: [],
    messages: [],
    pendingPhoto: null // { file, url(objectURL) }
  };

  const $ = (sel) => document.querySelector(sel);
  const feedEl = $('#feed');
  const boardFeedEl = $('#boardFeed');
  const photoGridEl = $('#photoGrid');
  const toastEl = $('#toast');

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  function colorFor(name) {
    if (AVATAR_COLORS[name]) return AVATAR_COLORS[name];
    let hash = 0;
    for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) % 997;
    return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
  }

  function initials(name) {
    return name.slice(0, 1);
  }

  function fmtTime(ts) {
    const d = new Date(ts);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const hm = d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    if (sameDay) return hm;
    return `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
  }

  // ---------- 起動シーケンス ----------
  async function init() {
    const res = await fetch('/api/members');
    state.members = await res.json();

    renderMemberGrid();

    if (state.user && state.members.includes(state.user)) {
      enterApp();
    } else {
      $('#loginOverlay').classList.remove('hidden');
    }

    setupTabs();
    setupComposer();
    setupHeaderButtons();
  }

  function renderMemberGrid() {
    const grid = $('#memberGrid');
    grid.innerHTML = '';
    state.members.forEach((name) => {
      const btn = document.createElement('button');
      btn.className = 'member-btn';
      btn.style.background = colorFor(name);
      btn.innerHTML = `<span class="avatar-emoji">${initials(name)}</span>${name}`;
      btn.addEventListener('click', () => {
        state.user = name;
        localStorage.setItem('takeuchi_user', name);
        enterApp();
      });
      grid.appendChild(btn);
    });
  }

  function enterApp() {
    $('#loginOverlay').classList.add('hidden');
    $('#app').classList.remove('hidden');
    $('#whoami').textContent = `${state.user} としてログイン中`;
    connectSocket();
    initPush();
  }

  function setupHeaderButtons() {
    $('#switchUserBtn').addEventListener('click', () => {
      localStorage.removeItem('takeuchi_user');
      location.reload();
    });
  }

  function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        $('#' + btn.dataset.tab).classList.add('active');
      });
    });
  }

  // ---------- Socket.IO ----------
  let socket;
  function connectSocket() {
    socket = io();
    socket.on('chat:init', (messages) => {
      state.messages = messages;
      renderAll();
    });
    socket.on('chat:new', (message) => {
      state.messages.push(message);
      appendMessage(message);
      renderBoardIfNeeded(message);
      renderPhotoIfNeeded(message);
      if (message.author !== state.user) {
        toast(message.type === 'announcement' ? `📢 ${message.author}さんから連絡事項` : `${message.author}さんから新着メッセージ`);
      }
    });
    socket.on('chat:like', ({ id, likes }) => {
      const m = state.messages.find((x) => x.id === id);
      if (m) m.likes = likes;
      document.querySelectorAll(`[data-like-id="${id}"]`).forEach((btn) => updateLikeBtn(btn, id));
    });
  }

  // ---------- 描画 ----------
  function renderAll() {
    feedEl.innerHTML = '';
    boardFeedEl.innerHTML = '';
    photoGridEl.innerHTML = '';

    if (state.messages.length === 0) {
      feedEl.innerHTML = '<p class="empty-hint">まだメッセージがありません。<br>最初のひとことを送ってみよう🎉</p>';
    }

    state.messages.forEach((m) => {
      appendMessage(m, feedEl, false);
      renderBoardIfNeeded(m);
      renderPhotoIfNeeded(m);
    });
    ensureBoardEmptyHint();
    ensurePhotoEmptyHint();

    scrollToBottom();
  }

  function scrollToBottom() {
    const main = document.querySelector('.main');
    if (document.getElementById('timeline').classList.contains('active')) {
      main.scrollTop = main.scrollHeight;
    }
  }

  function buildMsgRow(m) {
    const row = document.createElement('div');
    row.className = 'msg-row' + (m.author === state.user ? ' mine' : '');

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.style.background = colorFor(m.author);
    avatar.textContent = initials(m.author);

    const col = document.createElement('div');
    col.className = 'msg-col';

    const authorEl = document.createElement('div');
    authorEl.className = 'msg-author';
    authorEl.textContent = m.author;
    col.appendChild(authorEl);

    if (m.text) {
      const bubble = document.createElement('div');
      bubble.className = 'bubble' + (m.type === 'announcement' ? ' announcement' : '');
      if (m.type === 'announcement') {
        const badge = document.createElement('div');
        badge.className = 'announcement-badge';
        badge.textContent = '📢 連絡事項';
        bubble.appendChild(badge);
      }
      const textSpan = document.createElement('div');
      textSpan.textContent = m.text;
      bubble.appendChild(textSpan);
      col.appendChild(bubble);
    }

    if (m.photo) {
      const wrap = document.createElement('div');
      wrap.className = 'photo-wrap';
      const img = document.createElement('img');
      img.className = 'msg-photo';
      img.src = m.photo.url;
      img.loading = 'lazy';
      img.addEventListener('click', () => window.open(m.photo.url, '_blank'));
      wrap.appendChild(img);
      if (m.photo.private) {
        const badge = document.createElement('span');
        badge.className = 'private-badge';
        badge.textContent = '😄 プライベート';
        wrap.appendChild(badge);
      }
      col.appendChild(wrap);
    }

    const meta = document.createElement('div');
    meta.className = 'msg-meta';
    const time = document.createElement('span');
    time.className = 'msg-time';
    time.textContent = fmtTime(m.createdAt);
    const likeBtn = document.createElement('button');
    likeBtn.className = 'like-btn';
    likeBtn.dataset.likeId = m.id;
    likeBtn.addEventListener('click', () => {
      likeBtn.classList.add('pop');
      setTimeout(() => likeBtn.classList.remove('pop'), 400);
      socket.emit('chat:like', { id: m.id, user: state.user });
    });
    updateLikeBtn(likeBtn, m.id, m.likes);
    meta.appendChild(likeBtn);
    meta.appendChild(time);
    col.appendChild(meta);

    row.appendChild(avatar);
    row.appendChild(col);
    return row;
  }

  function updateLikeBtn(btn, id, likesArg) {
    const m = likesArg ? { likes: likesArg } : state.messages.find((x) => x.id === id);
    const likes = m ? m.likes : [];
    const likedByMe = likes.includes(state.user);
    btn.classList.toggle('liked', likedByMe);
    btn.innerHTML = `<span class="heart">${likedByMe ? '❤️' : '🤍'}</span>${likes.length > 0 ? likes.length : 'いいね'}`;
    btn.title = likes.length ? likes.join('、') + ' がいいね' : '';
  }

  function appendMessage(m) {
    const hint = feedEl.querySelector('.empty-hint');
    if (hint) hint.remove();
    const row = buildMsgRow(m);
    feedEl.appendChild(row);
    scrollToBottom();
  }

  function renderBoardIfNeeded(m) {
    if (m.type !== 'announcement') return;
    const hint = boardFeedEl.querySelector('.empty-hint');
    if (hint) hint.remove();
    boardFeedEl.appendChild(buildMsgRow(m));
  }

  function renderPhotoIfNeeded(m) {
    if (!m.photo) return;
    const hint = photoGridEl.querySelector('.empty-hint');
    if (hint) hint.remove();
    const wrap = document.createElement('div');
    wrap.className = 'photo-wrap';
    const img = document.createElement('img');
    img.src = m.photo.url;
    img.loading = 'lazy';
    img.addEventListener('click', () => window.open(m.photo.url, '_blank'));
    wrap.appendChild(img);
    if (m.photo.private) {
      const badge = document.createElement('span');
      badge.className = 'private-badge';
      badge.textContent = '😄';
      wrap.appendChild(badge);
    }
    photoGridEl.appendChild(wrap);
  }

  function ensureBoardEmptyHint() {
    if (boardFeedEl.children.length === 0) {
      boardFeedEl.innerHTML = '<p class="empty-hint">まだ連絡事項はありません📭</p>';
    }
  }

  function ensurePhotoEmptyHint() {
    if (photoGridEl.children.length === 0) {
      photoGridEl.innerHTML = '<p class="empty-hint">まだ写真の投稿はありません📷</p>';
    }
  }

  // ---------- 入力欄 ----------
  function setupComposer() {
    const form = $('#composer');
    const textInput = $('#textInput');
    const photoInput = $('#photoInput');
    const previewWrap = $('#photoPreviewWrap');
    const previewImg = $('#photoPreview');
    const removePhotoBtn = $('#removePhotoBtn');
    const announceCheck = $('#announceCheck');
    const privateCheck = $('#privateCheck');

    textInput.addEventListener('input', () => {
      textInput.style.height = 'auto';
      textInput.style.height = Math.min(textInput.scrollHeight, 100) + 'px';
    });
    textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form.requestSubmit();
      }
    });

    photoInput.addEventListener('change', () => {
      const file = photoInput.files[0];
      if (!file) return;
      state.pendingPhoto = { file };
      previewImg.src = URL.createObjectURL(file);
      previewWrap.classList.remove('hidden');
    });

    removePhotoBtn.addEventListener('click', () => {
      state.pendingPhoto = null;
      photoInput.value = '';
      privateCheck.checked = false;
      previewWrap.classList.add('hidden');
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = textInput.value.trim();
      if (!text && !state.pendingPhoto) return;

      const sendBtn = form.querySelector('.send-btn');
      sendBtn.disabled = true;

      try {
        let photo = null;
        if (state.pendingPhoto) {
          const fd = new FormData();
          fd.append('photo', state.pendingPhoto.file);
          const res = await fetch('/api/upload', { method: 'POST', body: fd });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'アップロードに失敗しました');
          photo = { url: data.url, private: privateCheck.checked };
        }

        socket.emit('chat:new', {
          author: state.user,
          text,
          type: announceCheck.checked ? 'announcement' : 'normal',
          photo
        });

        textInput.value = '';
        textInput.style.height = 'auto';
        announceCheck.checked = false;
        removePhotoBtn.click();
      } catch (err) {
        toast('⚠️ ' + err.message);
      } finally {
        sendBtn.disabled = false;
      }
    });
  }

  // ---------- プッシュ通知 ----------
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
  }

  async function initPush() {
    const btn = $('#notifyBtn');
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      btn.textContent = '🔕 通知非対応';
      btn.disabled = true;
      return;
    }

    const reg = await navigator.serviceWorker.register('/sw.js');
    const existing = await reg.pushManager.getSubscription();
    updateNotifyBtn(btn, existing);

    btn.addEventListener('click', async () => {
      const current = await reg.pushManager.getSubscription();
      if (current) {
        toast('🔔 通知は有効です');
        return;
      }
      if (Notification.permission === 'denied') {
        toast('⚠️ ブラウザの設定で通知がブロックされています');
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast('通知が許可されませんでした');
        return;
      }
      const { key } = await (await fetch('/api/vapid-public-key')).json();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key)
      });
      await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub, user: state.user })
      });
      updateNotifyBtn(btn, sub);
      toast('🔔 プッシュ通知をONにしました！');
    });
  }

  function updateNotifyBtn(btn, sub) {
    if (sub) {
      btn.textContent = '🔔 通知ON';
      btn.classList.add('active');
    } else {
      btn.textContent = '🔕 通知OFF';
      btn.classList.remove('active');
    }
  }

  init();
})();
