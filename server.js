const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const webpush = require('web-push');

const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const KEYS_FILE = path.join(DATA_DIR, 'vapid-keys.json');

for (const dir of [DATA_DIR, UPLOAD_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const MEMBERS = ['社長', '専務', '平山', '辻井', '吉道', '江本'];

// VAPID keys are generated once and kept on disk so push subscriptions stay valid.
let vapidKeys;
if (fs.existsSync(KEYS_FILE)) {
  vapidKeys = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf-8'));
} else {
  vapidKeys = webpush.generateVAPIDKeys();
  fs.writeFileSync(KEYS_FILE, JSON.stringify(vapidKeys, null, 2));
}
webpush.setVapidDetails('mailto:info@takeuchi-seisakusho.example', vapidKeys.publicKey, vapidKeys.privateKey);

function loadDB() {
  if (fs.existsSync(DB_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    } catch (e) {
      console.error('db.json の読み込みに失敗しました。初期化します。', e);
    }
  }
  return { messages: [], subscriptions: [] };
}
const db = loadDB();
function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, crypto.randomUUID() + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('画像ファイルのみアップロードできます'));
    }
    cb(null, true);
  }
});

app.get('/api/members', (req, res) => res.json(MEMBERS));
app.get('/api/messages', (req, res) => res.json(db.messages));
app.get('/api/vapid-public-key', (req, res) => res.json({ key: vapidKeys.publicKey }));

app.post('/api/upload', (req, res) => {
  upload.single('photo')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'ファイルがありません' });
    res.json({ url: '/uploads/' + req.file.filename });
  });
});

app.post('/api/subscribe', (req, res) => {
  const { subscription, user } = req.body || {};
  if (!subscription || !subscription.endpoint || !MEMBERS.includes(user)) {
    return res.status(400).json({ error: 'invalid subscription' });
  }
  db.subscriptions = db.subscriptions.filter(s => s.subscription.endpoint !== subscription.endpoint);
  db.subscriptions.push({ user, subscription });
  saveDB();
  res.json({ ok: true });
});

app.post('/api/unsubscribe', (req, res) => {
  const { endpoint } = req.body || {};
  if (endpoint) {
    db.subscriptions = db.subscriptions.filter(s => s.subscription.endpoint !== endpoint);
    saveDB();
  }
  res.json({ ok: true });
});

function broadcastPush(message) {
  const title = message.type === 'announcement'
    ? `📢 連絡事項 - ${message.author}`
    : `${message.author}さんから`;
  const body = message.text
    ? message.text.slice(0, 90)
    : (message.photo ? '写真が届きました📷' : '');
  const payload = JSON.stringify({ title, body, url: '/' });

  db.subscriptions.forEach(({ subscription }) => {
    webpush.sendNotification(subscription, payload).catch((err) => {
      if (err.statusCode === 410 || err.statusCode === 404) {
        db.subscriptions = db.subscriptions.filter(s => s.subscription.endpoint !== subscription.endpoint);
        saveDB();
      } else {
        console.error('push送信エラー', err.message);
      }
    });
  });
}

io.on('connection', (socket) => {
  socket.emit('chat:init', db.messages);

  socket.on('chat:new', (msg) => {
    if (!msg || !MEMBERS.includes(msg.author)) return;
    const text = typeof msg.text === 'string' ? msg.text.slice(0, 2000).trim() : '';
    const photo = msg.photo && typeof msg.photo.url === 'string'
      ? { url: msg.photo.url, private: !!msg.photo.private }
      : null;
    if (!text && !photo) return;

    const message = {
      id: crypto.randomUUID(),
      author: msg.author,
      text,
      type: msg.type === 'announcement' ? 'announcement' : 'normal',
      photo,
      likes: [],
      createdAt: Date.now()
    };
    db.messages.push(message);
    saveDB();
    io.emit('chat:new', message);
    if (message.type === 'announcement') {
      broadcastPush(message);
    }
  });

  socket.on('chat:like', ({ id, user } = {}) => {
    if (!MEMBERS.includes(user)) return;
    const message = db.messages.find(m => m.id === id);
    if (!message) return;
    const idx = message.likes.indexOf(user);
    if (idx >= 0) message.likes.splice(idx, 1);
    else message.likes.push(user);
    saveDB();
    io.emit('chat:like', { id, likes: message.likes });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🏭 武内製作所 社内トーク が起動しました: http://localhost:${PORT}`);
});
