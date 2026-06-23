# 営業報告チャット (Sales Report Chat)

営業メンバーがログインして、**写真などを添付しながらリアルタイムで報告しあえる**チャットアプリです。
PWA 対応なので、PC のブラウザでもスマホのホーム画面に追加してアプリのようにも使えます。

## 主な機能

- 📧 メールアドレス＋パスワードでのログイン / 新規登録
- 💬 全員共有のリアルタイムチャット（報告フィード）
- 📷 写真の添付・プレビュー・タップで拡大表示
- 📱 PWA 対応（スマホのホーム画面に追加可能・オフラインキャッシュ）
- 🔒 Firebase セキュリティルールでログインユーザーのみアクセス可

## 技術スタック

- フロントエンド: React + Vite
- PWA: vite-plugin-pwa
- バックエンド: Firebase（Authentication / Firestore / Storage）

---

## セットアップ手順

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. アイコンの生成（任意・初回のみ）

```bash
npm run gen:icons
```

`public/icons/icon-192.png` と `icon-512.png` が生成されます。

### 3. Firebase プロジェクトの作成

1. [Firebase コンソール](https://console.firebase.google.com/) でプロジェクトを作成
2. **Authentication** を有効化し、ログイン方法で「メール / パスワード」を有効にする
3. **Firestore Database** を作成（本番モードで可）
4. **Storage** を有効化
5. プロジェクトの設定 > マイアプリ から「ウェブアプリ」を追加し、`firebaseConfig` の値を取得

### 4. 環境変数の設定

`.env.example` を `.env.local` にコピーして値を入力します。

```bash
cp .env.example .env.local
```

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### 5. セキュリティルールの適用

`firestore.rules` と `storage.rules` の内容を Firebase コンソール（または Firebase CLI）で適用してください。
ログイン済みのユーザーだけが読み書きできる設定になっています。

### 6. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで表示された URL（通常 `http://localhost:5173`）を開きます。

### 7. 本番ビルド

```bash
npm run build
npm run preview   # ビルド結果の確認
```

`dist/` を Firebase Hosting / Vercel / Netlify などにデプロイすれば営業全員に URL を配るだけで使えます。

---

## 使い方

1. 初回は「アカウント作成」から名前・メール・パスワードを登録
2. ログインすると全員共有の報告フィードが表示されます
3. 📷 ボタンで写真を添付し、テキストと一緒に「送信」
4. 投稿はリアルタイムで全員に反映されます（画像はタップで拡大）

> Ctrl/⌘ + Enter でも送信できます。

## 今後の拡張アイデア

- チャンネル / グループ分け（地域・チーム別）
- 既読・リアクション・メンション
- 報告のテンプレート化（訪問先・商談状況など）
- プッシュ通知（Firebase Cloud Messaging）
- 管理者用の集計ダッシュボード
