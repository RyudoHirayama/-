// このファイルを firebase-config.js としてコピーし、
// Firebaseコンソール > プロジェクトの設定 > 全般 > マイアプリ(ウェブ) の値を貼り付けてください。
// firebase-config.js は .gitignore 対象なので、実際の値をコミットしても構いませんが分離してあります。
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Firebaseコンソール > プロジェクトの設定 > Cloud Messaging > ウェブ構成
// 「ウェブプッシュ証明書」で生成した鍵ペアの「キーペア」文字列をここに貼り付けてください。
export const vapidKey = "YOUR_WEB_PUSH_VAPID_KEY";
