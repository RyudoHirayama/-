import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore, collection, addDoc, updateDoc, doc, setDoc,
  onSnapshot, query, orderBy, limit, serverTimestamp, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";
import {
  getMessaging, getToken, onMessage, isSupported as messagingIsSupported
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging.js";

const MEMBERS = ['社長', '専務', '平山', '辻井', '吉道', '江本'];
const AVATAR_COLORS = {
  '社長': '#f4511e',
  '専務': '#8e63d1',
  '平山': '#26a69a',
  '辻井': '#4fc3f7',
  '吉道': '#ffa726',
  '江本': '#ec407a'
};

const $ = (sel) => document.querySelector(sel);
const feedEl = $('#feed');
const boardFeedEl = $('#boardFeed');
const photoGridEl = $('#photoGrid');
const toastEl = $('#toast');

const state = {
  user: localStorage.getItem('takeuchi_user') || null,
  messages: [],
  knownIds: new Set(),
  pendingPhoto: null,
  firstSnapshot: true
};

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toastEl.classList.remove('show'), 2600);
}

function colorFor(name) {
  return AVATAR_COLORS[name] || '#f4511e';
}
function initials(name) {
  return name.slice(0, 1);
}
function fmtTime(ts) {
  if (!ts) return '送信中…';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hm = d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  return sameDay ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

function showFatalSetupError(detail) {
  document.body.innerHTML = `
    <div style="max-width:520px;margin:40px auto;padding:24px;font-family:sans-serif;line-height:1.7;">
      <h1 style="font-size:20px;">⚠️ Firebaseの設定が必要です</h1>
      <p><code>public/firebase-config.js</code> が見つかりません。<br>
      <code>public/firebase-config.example.js</code> をコピーして、Firebaseコンソールで取得した設定値を入力してください。</p>
      <pre style="background:#f4f4f4;padding:12px;border-radius:8px;overflow:auto;">${detail}</pre>
    </div>`;
}

async function boot() {
  let firebaseConfig, vapidKey;
  try {
    ({ firebaseConfig, vapidKey } = await import('./firebase-config.js'));
  } catch (e) {
    showFatalSetupError(String(e));
    return;
  }

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);

  await new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        unsubscribe();
        resolve();
      } else {
        signInAnonymously(auth).catch((e) => toast('⚠️ 認証エラー: ' + e.message));
      }
    });
  });

  renderMemberGrid();

  if (state.user && MEMBERS.includes(state.user)) {
    enterApp();
  } else {
    $('#loginOverlay').classList.remove('hidden');
  }

  setupTabs();
  setupComposer({ db, storage });
  setupHeaderButtons();
  subscribeMessages({ db });

  function enterApp() {
    $('#loginOverlay').classList.add('hidden');
    $('#app').classList.remove('hidden');
    $('#whoami').textContent = `${state.user} としてログイン中`;
    initPush({ app, db });
  }

  function renderMemberGrid() {
    const grid = $('#memberGrid');
    grid.innerHTML = '';
    MEMBERS.forEach((name) => {
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

  function setupHeaderButtons() {
    $('#switchUserBtn').addEventListener('click', () => {
      localStorage.removeItem('takeuchi_user');
      location.reload();
    });
  }

  function subscribeMessages({ db }) {
    const q = query(collection(db, 'messages'), orderBy('createdAt', 'asc'), limit(300));
    onSnapshot(q, (snap) => {
      const newMessages = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      if (!state.firstSnapshot) {
        newMessages.forEach((m) => {
          if (!state.knownIds.has(m.id) && m.author !== state.user) {
            toast(m.type === 'announcement' ? `📢 ${m.author}さんから連絡事項` : `${m.author}さんから新着メッセージ`);
          }
        });
      }

      state.messages = newMessages;
      state.knownIds = new Set(newMessages.map((m) => m.id));
      state.firstSnapshot = false;
      renderAll();
    }, (err) => {
      toast('⚠️ 読み込みエラー: ' + err.message);
    });
  }

  function likeMessage(id) {
    const m = state.messages.find((x) => x.id === id);
    if (!m) return;
    const liked = (m.likes || []).includes(state.user);
    updateDoc(doc(db, 'messages', id), {
      likes: liked ? arrayRemove(state.user) : arrayUnion(state.user)
    }).catch((e) => toast('⚠️ ' + e.message));
  }

  function setupComposer({ db, storage }) {
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
          const file = state.pendingPhoto.file;
          if (!file.type.startsWith('image/')) throw new Error('画像ファイルのみアップロードできます');
          if (file.size > 8 * 1024 * 1024) throw new Error('画像サイズは8MB以下にしてください');
          const path = `photos/${crypto.randomUUID()}-${file.name}`;
          const fileRef = ref(storage, path);
          await uploadBytes(fileRef, file);
          const url = await getDownloadURL(fileRef);
          photo = { url, private: privateCheck.checked };
        }

        await addDoc(collection(db, 'messages'), {
          author: state.user,
          text,
          type: announceCheck.checked ? 'announcement' : 'normal',
          photo,
          likes: [],
          createdAt: serverTimestamp()
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
    const likes = m.likes || [];
    const likedByMe = likes.includes(state.user);
    likeBtn.classList.toggle('liked', likedByMe);
    likeBtn.innerHTML = `<span class="heart">${likedByMe ? '❤️' : '🤍'}</span>${likes.length > 0 ? likes.length : 'いいね'}`;
    likeBtn.title = likes.length ? likes.join('、') + ' がいいね' : '';
    likeBtn.addEventListener('click', () => {
      likeBtn.classList.add('pop');
      setTimeout(() => likeBtn.classList.remove('pop'), 400);
      likeMessage(m.id);
    });
    meta.appendChild(likeBtn);
    meta.appendChild(time);
    col.appendChild(meta);

    row.appendChild(avatar);
    row.appendChild(col);
    return row;
  }

  function renderAll() {
    feedEl.innerHTML = '';
    boardFeedEl.innerHTML = '';
    photoGridEl.innerHTML = '';

    if (state.messages.length === 0) {
      feedEl.innerHTML = '<p class="empty-hint">まだメッセージがありません。<br>最初のひとことを送ってみよう🎉</p>';
    }

    const announcements = state.messages.filter((m) => m.type === 'announcement');
    if (announcements.length === 0) {
      boardFeedEl.innerHTML = '<p class="empty-hint">まだ連絡事項はありません📭</p>';
    }
    const photos = state.messages.filter((m) => m.photo);
    if (photos.length === 0) {
      photoGridEl.innerHTML = '<p class="empty-hint">まだ写真の投稿はありません📷</p>';
    }

    state.messages.forEach((m) => feedEl.appendChild(buildMsgRow(m)));
    announcements.forEach((m) => boardFeedEl.appendChild(buildMsgRow(m)));
    photos.forEach((m) => {
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
    });

    scrollToBottom();
  }

  function scrollToBottom() {
    const main = document.querySelector('.main');
    if (document.getElementById('timeline').classList.contains('active')) {
      main.scrollTop = main.scrollHeight;
    }
  }

  function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        $('#' + btn.dataset.tab).classList.add('active');
        if (btn.dataset.tab === 'timeline') scrollToBottom();
      });
    });
  }

  async function initPush({ app, db }) {
    const btn = $('#notifyBtn');
    const supported = await messagingIsSupported().catch(() => false);
    if (!supported || !('serviceWorker' in navigator)) {
      btn.textContent = '🔕 通知非対応';
      btn.disabled = true;
      return;
    }

    const messaging = getMessaging(app);
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    onMessage(messaging, (payload) => {
      const n = payload.notification || {};
      toast(`🔔 ${n.title || ''} ${n.body || ''}`.trim());
    });

    async function registerToken() {
      const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg });
      if (!token) throw new Error('トークンを取得できませんでした');
      await setDoc(doc(db, 'subscriptions', token), {
        user: state.user,
        token,
        updatedAt: serverTimestamp()
      });
      updateNotifyBtn(btn, true);
    }

    updateNotifyBtn(btn, Notification.permission === 'granted');
    if (Notification.permission === 'granted') {
      registerToken().catch((e) => console.error('通知トークン登録エラー', e));
    }

    btn.addEventListener('click', async () => {
      if (Notification.permission === 'denied') {
        toast('⚠️ ブラウザの設定で通知がブロックされています');
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast('通知が許可されませんでした');
        return;
      }
      try {
        await registerToken();
        toast('🔔 プッシュ通知をONにしました！');
      } catch (e) {
        toast('⚠️ 通知登録エラー: ' + e.message);
      }
    });
  }

  function updateNotifyBtn(btn, on) {
    if (on) {
      btn.textContent = '🔔 通知ON';
      btn.classList.add('active');
    } else {
      btn.textContent = '🔕 通知OFF';
      btn.classList.remove('active');
    }
  }
}

boot();
