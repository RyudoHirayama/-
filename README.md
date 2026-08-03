# 武内製作所 社内トーク

社内メンバー（社長・専務・平山・辻井・吉道・江本）だけで使う、ゆるくてキャッチーな社内コミュニケーションアプリです。
チャット形式で連絡事項・いいね・写真（プライベート含む）を共有でき、重要な連絡事項はプッシュ通知で届きます。

Firebase（Firestore + Storage + Cloud Messaging + Cloud Functions + Hosting）上で動く、サーバー管理不要の構成です。

## 主な機能

- 💬 **タイムライン**: 全員でリアルタイムに雑談・連絡ができるチャット（Firestoreでリアルタイム同期）
- 📢 **連絡事項**: メッセージ送信時に「連絡事項」チェックを入れると、専用の連絡事項ボードに表示され、購読している全員へプッシュ通知が飛びます
- ❤️ **いいね**: メッセージにワンタップでいいねできます（誰がいいねしたか確認可）
- 📷 **写真共有**: 業務の写真もプライベートな写真も投稿OK。「プライベート投稿」にチェックすると目印バッジが付きます（あくまで目印で、閲覧制限機能ではありません）
- 🔔 **プッシュ通知**: Firebase Cloud Messaging（Web Push）に対応。ブラウザを閉じていても連絡事項の通知が届きます
- 🎨 見出しから絵文字・丸ゴシックフォント・パステルカラーまで、堅苦しくないデザインに調整済み

## 技術構成

- **Firestore**: チャットメッセージ・いいね・プッシュ通知トークンの保存＆リアルタイム配信
- **Firebase Storage**: 写真のアップロード先
- **Firebase Authentication（匿名認証）**: Firestore/Storageのセキュリティルールを機能させるための最小限の認証
- **Cloud Functions**: 「連絡事項」が投稿された時に登録済み端末へプッシュ通知を送信
- **Firebase Hosting**: 静的ファイル（`public/`配下、ビルド不要のプレーンHTML/CSS/JS）の配信

## セットアップ手順

### 1. Firebaseプロジェクトを作成

1. https://console.firebase.google.com/ で新規プロジェクトを作成
2. **Firestore Database** を作成（本番モードでOK。ルールは後述のものをデプロイします）
3. **Storage** を有効化
4. **Authentication** → Sign-in method → 「匿名」を有効化
5. **Cloud Messaging** → 「ウェブ構成」→「ウェブプッシュ証明書」で鍵ペアを生成（VAPIDキーとして使用）
6. プロジェクトの設定 → 全般 → 「マイアプリ」でウェブアプリを追加し、`firebaseConfig` を取得
7. Cloud Functions を使うため、**Blazeプラン（従量課金）**へのアップグレードが必要です（6人規模の利用であれば無料枠内に収まる想定ですが、課金設定自体は必要です）

### 2. 設定ファイルを作成

```bash
cp public/firebase-config.example.js public/firebase-config.js
```

`public/firebase-config.js` を開き、手順1-6で取得した値と、手順1-5のVAPIDキーを入力してください。

`public/firebase-messaging-sw.js` の中の `firebase.initializeApp({...})` にも、**同じ値をもう一度**手動で入力してください（Service Workerはローカルファイルをimportできないため、値を直接埋め込む必要があります）。

`.firebaserc` の `default` プロジェクトIDも、実際のプロジェクトIDに書き換えてください。

### 3. Firebase CLIでデプロイ

```bash
npm install -g firebase-tools
firebase login

# Cloud Functionsの依存関係をインストール
cd functions && npm install && cd ..

# Firestore/Storageのルール、Functions、Hostingを一括デプロイ
firebase deploy
```

デプロイ後に表示される Hosting の URL（`https://<プロジェクトID>.web.app`）にアクセスすると、メンバー一覧から自分の名前を選んでチャットに参加できます。

### ローカルでの動作確認（任意）

```bash
firebase emulators:start
```

Firestore・Auth・Storage・Functions・Hostingをまとめてローカルで起動できます（詳細は [Firebase Local Emulator Suite](https://firebase.google.com/docs/emulator-suite) を参照してください）。

## プッシュ通知を使うには

1. ヘッダーの「🔔 通知OFF」ボタンをタップ
2. ブラウザの通知許可ダイアログで「許可」を選択
3. 以降、誰かが「📢 連絡事項」付きでメッセージを送ると、Cloud Functions経由で登録済み端末全員にプッシュ通知が届きます

※ Web Push は HTTPS 環境が必要です（Firebase Hostingは自動でHTTPS配信されます）。

## セキュリティについて

- 6名の名前を自己申告して参加する簡易的な仕組みで、パスワード認証はありません（社内の信頼関係を前提にした設計です）
- Firestore/Storageのセキュリティルール（`firestore.rules` / `storage.rules`）により、匿名認証済みユーザーのみ読み書きできます
- 写真の「プライベート」表示は分類目印であり、アクセス制御ではありません（Storageの認証済みユーザー全員が閲覧できます）

## ディレクトリ構成

```
public/                       静的フロントエンド（Firebase Hosting配信対象）
  index.html
  style.css
  app.js                      Firestore/Storage/Messaging連携ロジック
  firebase-messaging-sw.js    プッシュ通知用Service Worker
  firebase-config.example.js  設定テンプレート（コピーしてfirebase-config.jsを作成）
functions/                    Cloud Functions（連絡事項プッシュ通知の送信）
firestore.rules               Firestoreセキュリティルール
storage.rules                 Storageセキュリティルール
firebase.json                 Firebaseプロジェクト設定
```
