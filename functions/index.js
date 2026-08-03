const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();
const db = getFirestore();

// 「連絡事項」として送られたメッセージだけ、登録済み端末全員にプッシュ通知する。
exports.sendAnnouncementPush = onDocumentCreated('messages/{messageId}', async (event) => {
  const message = event.data?.data();
  if (!message || message.type !== 'announcement') return;

  const subsSnap = await db.collection('subscriptions').get();
  const tokens = subsSnap.docs.map((d) => d.id);
  if (tokens.length === 0) return;

  const title = `📢 連絡事項 - ${message.author}`;
  const body = message.text
    ? String(message.text).slice(0, 90)
    : (message.photo ? '写真が届きました📷' : '');

  const response = await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: { url: '/' },
    webpush: { fcmOptions: { link: '/' } }
  });

  const staleTokens = [];
  response.responses.forEach((res, idx) => {
    if (!res.success) {
      const code = res.error && res.error.code;
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        staleTokens.push(tokens[idx]);
      }
    }
  });
  await Promise.all(staleTokens.map((t) => db.collection('subscriptions').doc(t).delete()));
});
