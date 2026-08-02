// バックグラウンド（タブが閉じている/非アクティブ）でプッシュ通知を受け取るためのService Worker。
// Service Workerはpublic/firebase-config.jsをESモジュールとしてimportできないため、
// 同じ値をここにも直接記入してください（Firebaseコンソール > プロジェクトの設定 > 全般 > マイアプリ）。
// 値自体は秘密情報ではなく、Firestore/Storageのセキュリティルール側でアクセス制御しています。
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const n = payload.notification || {};
  self.registration.showNotification(n.title || '武内製作所 社内トーク', {
    body: n.body || '',
    tag: 'takeuchi-talk',
    renotify: true,
    data: { url: (payload.data && payload.data.url) || '/' }
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
